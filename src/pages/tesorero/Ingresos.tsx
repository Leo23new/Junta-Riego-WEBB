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

interface Miembro {
  id: string
  nombres: string
  apellidos: string
  cedula: string
}

interface Ingreso {
  id: string
  junta_id: string
  miembro_id: string | null
  concepto: string
  monto: number
  fecha: string
  metodo_pago: string
  numero_recibo: string
  comprobante_path: string | null
  created_at: string
  registrado_por: string | null
  // joined:
  miembro_nombres: string | null
  miembro_apellidos: string | null
  miembro_cedula: string | null
}

type IngresoRow = Ingreso & {
  miembros?: { nombres: string; apellidos: string; cedula: string } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Depósito', 'Otro']

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  miembro_id: string
  concepto: string
  monto: string
  fecha: string
  metodo_pago: string
}

const FORM_VACÍO: FormState = {
  miembro_id: '',
  concepto: '',
  monto: '',
  fecha: '',
  metodo_pago: 'Efectivo',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Ingresos() {
  const { usuario, juntaId } = useAuth()

  // Data
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [cargando, setCargando] = useState(true)

  // Filters
  const [filtroMiembro, setFiltroMiembro] = useState('')
  const [filtroConcepto, setFiltroConcepto] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtroMetodo, setFiltroMetodo] = useState('todos')

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
      const [resIngresos, resMiembros] = await Promise.all([
        supabase
          .from('ingresos')
          .select(`*, miembros!miembro_id (nombres, apellidos, cedula)`)
          .eq('junta_id', juntaId)
          .order('fecha', { ascending: false }),
        supabase
          .from('miembros')
          .select('id, nombres, apellidos, cedula')
          .eq('junta_id', juntaId)
          .eq('activo', true)
          .order('apellidos'),
      ])

      if (resIngresos.error) throw resIngresos.error
      if (resMiembros.error) throw resMiembros.error

      const planos: Ingreso[] = ((resIngresos.data ?? []) as unknown as IngresoRow[]).map((r) => ({
        id: r.id,
        junta_id: r.junta_id,
        miembro_id: r.miembro_id,
        concepto: r.concepto,
        monto: Number(r.monto),
        fecha: r.fecha,
        metodo_pago: r.metodo_pago,
        numero_recibo: r.numero_recibo,
        comprobante_path: r.comprobante_path,
        created_at: r.created_at,
        registrado_por: r.registrado_por,
        miembro_nombres: r.miembros?.nombres ?? null,
        miembro_apellidos: r.miembros?.apellidos ?? null,
        miembro_cedula: r.miembros?.cedula ?? null,
      }))

      setIngresos(planos)
      setMiembros((resMiembros.data ?? []) as Miembro[])
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al cargar los ingresos.' })
    } finally {
      setCargando(false)
    }
  }, [juntaId])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // ─── Client-side filters ───────────────────────────────────────────────────

  const ingresosFiltrados = ingresos.filter((i) => {
    if (filtroMiembro.trim()) {
      const q = filtroMiembro.trim().toLowerCase()
      const nombre = `${i.miembro_nombres ?? ''} ${i.miembro_apellidos ?? ''}`.toLowerCase()
      if (!nombre.includes(q)) return false
    }
    if (filtroConcepto.trim() && !i.concepto.toLowerCase().includes(filtroConcepto.trim().toLowerCase()))
      return false
    if (filtroDesde && i.fecha < filtroDesde) return false
    if (filtroHasta && i.fecha > filtroHasta) return false
    if (filtroMetodo !== 'todos' && i.metodo_pago !== filtroMetodo) return false
    return true
  })

  // ─── View comprobante ──────────────────────────────────────────────────────

  async function verComprobante(path: string) {
    const { data, error } = await supabase.storage
      .from('comprobantes')
      .createSignedUrl(path, 3600)
    if (error || !data?.signedUrl) {
      setAlerta({ tipo: 'error', mensaje: 'No se pudo abrir el comprobante.' })
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  // ─── Modal handlers ────────────────────────────────────────────────────────

  function abrirNuevo() {
    setForm(FORM_VACÍO)
    setErrores({})
    setComprobanteFile(null)
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setComprobanteFile(null)
  }

  // ─── Generate unique receipt number ────────────────────────────────────────

  async function generarNumeroRecibo(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const candidato = `R-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}${i > 0 ? '-' + i : ''}`
      const { data: existe } = await supabase
        .from('ingresos')
        .select('id')
        .eq('numero_recibo', candidato)
        .eq('junta_id', juntaId!)
        .maybeSingle()
      if (!existe) return candidato
    }
    return ''
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // 1. Client-side validation
    const nuevosErrores: Partial<FormState> = {}
    if (!form.concepto.trim()) nuevosErrores.concepto = 'Campo requerido.'
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
      let numeroRecibo = await generarNumeroRecibo()
      if (!numeroRecibo) {
        setAlerta({ tipo: 'error', mensaje: 'No se pudo generar un número de recibo único.' })
        return
      }

      // Upload comprobante first (retry once on unique-constraint conflict)
      for (let intento = 0; intento < 2; intento++) {
        let comprobantePath: string | null = null

        if (comprobanteFile) {
          const ext = comprobanteFile.name.split('.').pop()
          const path = `${juntaId}/${numeroRecibo}.${ext}`
          const { error: errSubida } = await supabase.storage
            .from('comprobantes')
            .upload(path, comprobanteFile)
          if (errSubida && !errSubida.message?.includes('already exists')) throw errSubida
          comprobantePath = path
        }

        const { error: errInsert } = await supabase.from('ingresos').insert({
          junta_id: juntaId!,
          miembro_id: form.miembro_id || null,
          concepto: form.concepto.trim(),
          monto: parseFloat(form.monto),
          fecha: form.fecha,
          metodo_pago: form.metodo_pago,
          numero_recibo: numeroRecibo,
          comprobante_path: comprobantePath,
          registrado_por: usuario?.id ?? null,
        })

        if (!errInsert) {
          cerrarModal()
          await cargarDatos()
          setAlerta({
            tipo: 'exito',
            mensaje: `Ingreso registrado. Recibo N.º ${numeroRecibo}.`,
          })
          return
        }

        // Unique constraint on numero_recibo → retry once with a new number
        if (errInsert.code === '23505' && intento === 0) {
          numeroRecibo = await generarNumeroRecibo()
          if (!numeroRecibo) throw new Error('numero_recibo')
          continue
        }
        throw errInsert
      }
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al registrar el ingreso. Intente nuevamente.' })
    } finally {
      setGuardando(false)
    }
  }

  // ─── Table columns ─────────────────────────────────────────────────────────

  const columnas: ColumnaTabla<Ingreso>[] = [
    { cabecera: 'Recibo', accesador: 'numero_recibo' },
    { cabecera: 'Fecha', accesador: (i) => formatearFecha(i.fecha) },
    {
      cabecera: 'Miembro',
      accesador: (i) =>
        i.miembro_apellidos
          ? `${i.miembro_apellidos}, ${i.miembro_nombres}`
          : '—',
    },
    { cabecera: 'Concepto', accesador: 'concepto' },
    { cabecera: 'Monto', accesador: (i) => `$${i.monto.toFixed(2)}` },
    { cabecera: 'Método', accesador: 'metodo_pago' },
    {
      cabecera: 'Comprobante',
      accesador: (i) =>
        i.comprobante_path ? (
          <button
            type="button"
            onClick={() => verComprobante(i.comprobante_path!)}
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
        <h1 className="text-2xl font-bold text-gray-800">Ingresos</h1>
        <Boton variante="primario" onClick={abrirNuevo}>
          + Nuevo ingreso
        </Boton>
      </div>

      {/* Page alert */}
      {alerta && (
        <Alerta tipo={alerta.tipo} mensaje={alerta.mensaje} onCerrar={() => setAlerta(null)} />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-miembro" className="text-sm font-medium text-gray-600">
            Miembro
          </label>
          <input
            id="filtro-miembro"
            type="text"
            value={filtroMiembro}
            onChange={(e) => setFiltroMiembro(e.target.value)}
            placeholder="Nombre o apellidos"
            className={INPUT_CLASS + ' w-48'}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-concepto" className="text-sm font-medium text-gray-600">
            Concepto
          </label>
          <input
            id="filtro-concepto"
            type="text"
            value={filtroConcepto}
            onChange={(e) => setFiltroConcepto(e.target.value)}
            placeholder="Concepto"
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
          <label htmlFor="filtro-metodo" className="text-sm font-medium text-gray-600">
            Método de pago
          </label>
          <select
            id="filtro-metodo"
            value={filtroMetodo}
            onChange={(e) => setFiltroMetodo(e.target.value)}
            className={INPUT_CLASS + ' w-40'}
          >
            <option value="todos">Todos</option>
            {METODOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <Tabla<Ingreso>
        columnas={columnas}
        datos={ingresosFiltrados}
        cargando={cargando}
        camposFiltro={['numero_recibo', 'concepto']}
        filasPorPagina={15}
      />

      {/* ── Create modal ── */}
      <Modal abierto={modalAbierto} onCerrar={cerrarModal} titulo="Nuevo ingreso" tamaño="lg">
        <Formulario onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Miembro */}
            <CampoFormulario label="Miembro" htmlFor="miembro_id">
              <select
                id="miembro_id"
                value={form.miembro_id}
                onChange={(e) => setForm({ ...form, miembro_id: e.target.value })}
                className={INPUT_CLASS}
              >
                <option value="">Sin miembro</option>
                {miembros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.apellidos}, {m.nombres} — {m.cedula}
                  </option>
                ))}
              </select>
            </CampoFormulario>

            {/* Concepto */}
            <CampoFormulario label="Concepto" htmlFor="concepto" requerido error={errores.concepto}>
              <input
                id="concepto"
                type="text"
                value={form.concepto}
                onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                className={INPUT_CLASS}
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
              etiqueta="Comprobante de pago (JPG/PNG/PDF, máx. 10 MB)"
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
