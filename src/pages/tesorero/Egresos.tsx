import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import useAuth from '../../hooks/useAuth'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { Modal } from '../../components/ui/Modal'
import { Formulario, CampoFormulario } from '../../components/ui/Formulario'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'
import { SubidaArchivo } from '../../components/ui/SubidaArchivo'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Egreso {
  id: string
  junta_id: string
  categoria: string
  proveedor: string | null
  descripcion: string
  monto: number
  fecha: string
  metodo_pago: string
  comprobante_path: string | null
  created_at: string
  registrado_por: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

const CATEGORIAS = [
  'Mantenimiento',
  'Insumos',
  'Servicios',
  'Salarios',
  'Transporte',
  'Administrativo',
  'Otro',
]

const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Depósito', 'Otro']

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function hoyISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  categoria: string
  proveedor: string
  descripcion: string
  monto: string
  fecha: string
  metodo_pago: string
}

const FORM_VACÍO: FormState = {
  categoria: '',
  proveedor: '',
  descripcion: '',
  monto: '',
  fecha: hoyISO(),
  metodo_pago: 'Efectivo',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Egresos() {
  const { usuario, juntaId } = useAuth()

  // Data
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [cargando, setCargando] = useState(true)

  // Filters
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtroMontoMin, setFiltroMontoMin] = useState('')
  const [filtroMontoMax, setFiltroMontoMax] = useState('')

  // Page-level alert
  const [alerta, setAlerta] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)

  // Auto-dismiss alert after 4s
  useEffect(() => {
    if (!alerta) return
    const t = setTimeout(() => setAlerta(null), 4000)
    return () => clearTimeout(t)
  }, [alerta])

  // Create modal
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACÍO)
  const [errores, setErrores] = useState<Partial<FormState>>({})
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)

  // ─── Load data ─────────────────────────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    if (!juntaId) return
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('egresos')
        .select('*')
        .eq('junta_id', juntaId)
        .order('fecha', { ascending: false })

      if (error) throw error

      setEgresos(
        ((data ?? []) as unknown as Array<Omit<Egreso, 'monto'> & { monto: string | number }>).map(
          (r) => ({ ...r, monto: Number(r.monto) }),
        ),
      )
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al cargar los egresos.' })
    } finally {
      setCargando(false)
    }
  }, [juntaId])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // ─── Client-side filters ───────────────────────────────────────────────────

  const egresosFiltrados = egresos.filter((e) => {
    if (filtroCategoria !== 'todas' && e.categoria !== filtroCategoria) return false
    if (filtroProveedor.trim() && !(e.proveedor ?? '').toLowerCase().includes(filtroProveedor.trim().toLowerCase()))
      return false
    if (filtroDesde && e.fecha < filtroDesde) return false
    if (filtroHasta && e.fecha > filtroHasta) return false
    if (filtroMontoMin && e.monto < parseFloat(filtroMontoMin)) return false
    if (filtroMontoMax && e.monto > parseFloat(filtroMontoMax)) return false
    return true
  })

  const totalEgresos = egresosFiltrados.reduce((acc, e) => acc + e.monto, 0)

  // ─── View comprobante ──────────────────────────────────────────────────────

  async function verComprobante(path: string) {
    const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(path, 3600)
    if (error || !data?.signedUrl) {
      setAlerta({ tipo: 'error', mensaje: 'No se pudo abrir el comprobante.' })
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  // ─── Modal handlers ────────────────────────────────────────────────────────

  function abrirNuevo() {
    setForm({ ...FORM_VACÍO, fecha: hoyISO() })
    setErrores({})
    setComprobanteFile(null)
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setComprobanteFile(null)
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // 1. Client-side validation
    const nuevosErrores: Partial<FormState> = {}
    if (!form.categoria) nuevosErrores.categoria = 'Campo requerido.'
    if (!form.descripcion.trim()) nuevosErrores.descripcion = 'Campo requerido.'
    const monto = parseFloat(form.monto)
    if (!form.monto || isNaN(monto) || monto <= 0) nuevosErrores.monto = 'Debe ser mayor a 0.'
    if (!form.fecha) nuevosErrores.fecha = 'Campo requerido.'
    if (!form.metodo_pago) nuevosErrores.metodo_pago = 'Campo requerido.'

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores)
      return
    }
    setErrores({})

    setGuardando(true)
    try {
      // 2. Upload comprobante first (if any)
      let comprobantePath: string | null = null
      if (comprobanteFile) {
        const ext = comprobanteFile.name.split('.').pop()
        const path = `${juntaId}/E-${Date.now()}.${ext}`
        const { error: errSubida } = await supabase.storage
          .from('comprobantes')
          .upload(path, comprobanteFile)
        if (errSubida && !errSubida.message?.includes('already exists')) throw errSubida
        comprobantePath = path
      }

      // 3. Insert
      const { error: errInsert } = await supabase.from('egresos').insert({
        junta_id: juntaId!,
        categoria: form.categoria,
        proveedor: form.proveedor.trim() || null,
        descripcion: form.descripcion.trim(),
        monto: parseFloat(form.monto),
        fecha: form.fecha,
        metodo_pago: form.metodo_pago,
        comprobante_path: comprobantePath,
        registrado_por: usuario?.id ?? null,
      })

      if (errInsert) throw errInsert

      // 4. Success
      cerrarModal()
      await cargarDatos()
      setAlerta({ tipo: 'exito', mensaje: 'Egreso registrado correctamente.' })
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al registrar el egreso. Intente nuevamente.' })
    } finally {
      setGuardando(false)
    }
  }

  // ─── Table columns ─────────────────────────────────────────────────────────

  const columnas: ColumnaTabla<Egreso>[] = [
    { cabecera: 'Fecha', accesador: (e) => formatearFecha(e.fecha) },
    { cabecera: 'Categoría', accesador: 'categoria' },
    { cabecera: 'Proveedor', accesador: (e) => e.proveedor || '—' },
    {
      cabecera: 'Descripción',
      accesador: (e) => (
        <span className="block max-w-xs truncate" title={e.descripcion}>
          {e.descripcion}
        </span>
      ),
    },
    { cabecera: 'Monto', accesador: (e) => `$${e.monto.toFixed(2)}` },
    { cabecera: 'Método', accesador: 'metodo_pago' },
    {
      cabecera: 'Comprobante',
      accesador: (e) =>
        e.comprobante_path ? (
          <button
            type="button"
            onClick={() => verComprobante(e.comprobante_path!)}
            className="text-green-700 font-medium underline hover:text-green-900"
          >
            Ver
          </button>
        ) : (
          '—'
        ),
    },
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-4">
      {/* Heading row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Egresos</h1>
        <Boton variante="primario" onClick={abrirNuevo}>
          + Nuevo egreso
        </Boton>
      </div>

      {/* Page alert */}
      {alerta && <Alerta tipo={alerta.tipo} mensaje={alerta.mensaje} onCerrar={() => setAlerta(null)} />}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total egresos</p>
          <p className="text-2xl font-bold text-red-600">${totalEgresos.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Registros</p>
          <p className="text-2xl font-bold text-gray-800">{egresosFiltrados.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-categoria" className="text-sm font-medium text-gray-600">
            Categoría
          </label>
          <select
            id="filtro-categoria"
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className={INPUT_CLASS + ' w-44'}
          >
            <option value="todas">Todas</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-proveedor" className="text-sm font-medium text-gray-600">
            Proveedor
          </label>
          <input
            id="filtro-proveedor"
            type="text"
            value={filtroProveedor}
            onChange={(e) => setFiltroProveedor(e.target.value)}
            placeholder="Proveedor"
            className={INPUT_CLASS + ' w-48'}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-desde" className="text-sm font-medium text-gray-600">
            Desde
          </label>
          <input
            id="filtro-desde"
            type="date"
            value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)}
            className={INPUT_CLASS + ' w-40'}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-hasta" className="text-sm font-medium text-gray-600">
            Hasta
          </label>
          <input
            id="filtro-hasta"
            type="date"
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
            className={INPUT_CLASS + ' w-40'}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-monto-min" className="text-sm font-medium text-gray-600">
            Monto mín.
          </label>
          <input
            id="filtro-monto-min"
            type="number"
            min={0}
            step={0.01}
            value={filtroMontoMin}
            onChange={(e) => setFiltroMontoMin(e.target.value)}
            placeholder="0.00"
            className={INPUT_CLASS + ' w-32'}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-monto-max" className="text-sm font-medium text-gray-600">
            Monto máx.
          </label>
          <input
            id="filtro-monto-max"
            type="number"
            min={0}
            step={0.01}
            value={filtroMontoMax}
            onChange={(e) => setFiltroMontoMax(e.target.value)}
            placeholder="0.00"
            className={INPUT_CLASS + ' w-32'}
          />
        </div>
      </div>

      {/* Table */}
      <Tabla<Egreso>
        columnas={columnas}
        datos={egresosFiltrados}
        cargando={cargando}
        camposFiltro={['descripcion', 'proveedor']}
        filasPorPagina={15}
      />

      {/* ── Create modal ── */}
      <Modal abierto={modalAbierto} onCerrar={cerrarModal} titulo="Nuevo egreso" tamaño="lg">
        <Formulario onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Categoría */}
            <CampoFormulario label="Categoría" htmlFor="categoria" requerido error={errores.categoria}>
              <select
                id="categoria"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className={INPUT_CLASS}
              >
                <option value="">Seleccione…</option>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </CampoFormulario>

            {/* Proveedor */}
            <CampoFormulario label="Proveedor" htmlFor="proveedor">
              <input
                id="proveedor"
                type="text"
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            {/* Descripción */}
            <CampoFormulario
              label="Descripción"
              htmlFor="descripcion"
              requerido
              error={errores.descripcion}
            >
              <textarea
                id="descripcion"
                rows={3}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                className={INPUT_CLASS + ' resize-none sm:col-span-2'}
              />
            </CampoFormulario>

            {/* Monto */}
            <CampoFormulario label="Monto (USD)" htmlFor="monto" requerido error={errores.monto}>
              <input
                id="monto"
                type="number"
                min={0.01}
                step={0.01}
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            {/* Fecha */}
            <CampoFormulario label="Fecha" htmlFor="fecha" requerido error={errores.fecha}>
              <input
                id="fecha"
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            {/* Método de pago */}
            <CampoFormulario
              label="Método de pago"
              htmlFor="metodo_pago"
              requerido
              error={errores.metodo_pago}
            >
              <select
                id="metodo_pago"
                value={form.metodo_pago}
                onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })}
                className={INPUT_CLASS}
              >
                {METODOS_PAGO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </CampoFormulario>
          </div>

          {/* Comprobante */}
          <div className="mt-4">
            <SubidaArchivo
              tiposPermitidos={['image/jpeg', 'image/png', 'application/pdf']}
              tamañoMaxMB={10}
              etiqueta="Comprobante de egreso (JPG/PNG/PDF, máx. 10 MB)"
              onArchivo={(archivo) => setComprobanteFile(archivo)}
            />
          </div>

          {/* Modal footer buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <Boton type="button" variante="secundario" onClick={cerrarModal}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="primario" cargando={guardando}>
              Registrar
            </Boton>
          </div>
        </Formulario>
      </Modal>
    </div>
  )
}
