import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import useAuth from '../../hooks/useAuth'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { Modal } from '../../components/ui/Modal'
import { Formulario, CampoFormulario } from '../../components/ui/Formulario'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'

// ─── Types ───────────────────────────────────────────────────────────────────

type EstadoActivo = 'bueno' | 'regular' | 'mantenimiento' | 'baja'

interface ActivoFijo {
  id: string
  junta_id: string
  codigo: string
  nombre: string
  descripcion: string | null
  valor_adquisicion: number
  fecha_adquisicion: string
  vida_util_anos: number
  estado: EstadoActivo
  fecha_baja: string | null
  motivo_baja: string | null
  created_at: string
  depreciacion_acumulada: number | null
  valor_neto: number | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

const ESTADOS: Array<{ valor: EstadoActivo; etiqueta: string; clases: string }> = [
  { valor: 'bueno', etiqueta: 'Bueno', clases: 'bg-green-100 text-green-700' },
  { valor: 'regular', etiqueta: 'Regular', clases: 'bg-yellow-100 text-yellow-700' },
  { valor: 'mantenimiento', etiqueta: 'Mantenimiento', clases: 'bg-blue-100 text-blue-700' },
  { valor: 'baja', etiqueta: 'Baja', clases: 'bg-gray-200 text-gray-600' },
]

function badgeEstado(estado: EstadoActivo) {
  const e = ESTADOS.find((x) => x.valor === estado)
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e?.clases ?? 'bg-gray-200 text-gray-600'}`}>
      {e?.etiqueta ?? estado}
    </span>
  )
}

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function formatearDinero(valor: number | null | undefined): string {
  const n = Number(valor ?? 0)
  return `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function hoyISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

async function obtenerDepreciacion(
  valor: number,
  vidaUtil: number,
  fecha: string,
): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('calcular_depreciacion', {
      valor_adquisicion: valor,
      vida_util_anos: vidaUtil,
      fecha_adquisicion: fecha,
    })
    if (error || data === null || data === undefined) return null
    return Number(data)
  } catch {
    return null
  }
}

// ─── Form states ─────────────────────────────────────────────────────────────

interface ActivoFormState {
  codigo: string
  nombre: string
  descripcion: string
  valor: string
  fecha: string
  vidaUtil: string
  estado: 'bueno' | 'regular' | 'mantenimiento'
}

const ACTIVO_VACIO: ActivoFormState = {
  codigo: '',
  nombre: '',
  descripcion: '',
  valor: '',
  fecha: '',
  vidaUtil: '',
  estado: 'bueno',
}

interface BajaFormState {
  fecha: string
  motivo: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ActivosFijos() {
  const { usuario, juntaId } = useAuth()

  // Data
  const [activos, setActivos] = useState<ActivoFijo[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoActivo>('todos')

  // Alerts
  const [alerta, setAlerta] = useState<{
    tipo: 'exito' | 'error' | 'advertencia' | 'info'
    mensaje: string
  } | null>(null)

  useEffect(() => {
    if (!alerta) return
    const t = setTimeout(() => setAlerta(null), 6000)
    return () => clearTimeout(t)
  }, [alerta])

  // Create modal
  const [modalNuevo, setModalNuevo] = useState(false)
  const [form, setForm] = useState<ActivoFormState>({ ...ACTIVO_VACIO })
  const [errores, setErrores] = useState<Partial<Record<keyof ActivoFormState, string>>>({})
  const [guardando, setGuardando] = useState(false)

  // Detail modal
  const [activoDetalle, setActivoDetalle] = useState<ActivoFijo | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [detalleDepreciacion, setDetalleDepreciacion] = useState<number | null>(null)

  // Baja modal
  const [activoBaja, setActivoBaja] = useState<ActivoFijo | null>(null)
  const [formBaja, setFormBaja] = useState<BajaFormState>({ fecha: hoyISO(), motivo: '' })
  const [erroresBaja, setErroresBaja] = useState<{ fecha?: string; motivo?: string }>({})
  const [dandoBaja, setDandoBaja] = useState(false)

  // ─── Load data ─────────────────────────────────────────────────────────────

  const cargarActivos = useCallback(async () => {
    if (!juntaId) return
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('activos_fijos')
        .select('*')
        .eq('junta_id', juntaId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const filas = ((data ?? []) as unknown as Array<
        Omit<ActivoFijo, 'valor_adquisicion' | 'vida_util_anos'> & {
          valor_adquisicion: string | number
          vida_util_anos: string | number
        }
      >).map((r) => ({
        ...r,
        valor_adquisicion: Number(r.valor_adquisicion),
        vida_util_anos: Number(r.vida_util_anos),
        depreciacion_acumulada: null,
        valor_neto: null,
      }))

      const conDepreciacion = await Promise.all(
        filas.map(async (f) => {
          const dep = await obtenerDepreciacion(f.valor_adquisicion, f.vida_util_anos, f.fecha_adquisicion)
          return {
            ...f,
            depreciacion_acumulada: dep,
            valor_neto: dep !== null ? f.valor_adquisicion - dep : null,
          }
        }),
      )

      setActivos(conDepreciacion)
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al cargar los activos fijos.' })
    } finally {
      setCargando(false)
    }
  }, [juntaId])

  useEffect(() => {
    cargarActivos()
  }, [cargarActivos])

  // ─── Filtering and summary ─────────────────────────────────────────────────

  const activosFiltrados =
    filtroEstado === 'todos' ? activos : activos.filter((a) => a.estado === filtroEstado)

  const activosValuables = activosFiltrados.filter((a) => a.estado !== 'baja')
  const totalAdquisicion = activosValuables.reduce((s, a) => s + a.valor_adquisicion, 0)
  const totalDepreciacion = activosValuables.reduce(
    (s, a) => s + (a.depreciacion_acumulada ?? 0),
    0,
  )
  const totalValorNeto = totalAdquisicion - totalDepreciacion

  // ─── Create handlers ───────────────────────────────────────────────────────

  function abrirNuevo() {
    setForm({ ...ACTIVO_VACIO })
    setErrores({})
    setModalNuevo(true)
  }

  async function guardarActivo(e: React.FormEvent) {
    e.preventDefault()

    const nuevosErrores: Partial<Record<keyof ActivoFormState, string>> = {}
    if (!form.codigo.trim()) nuevosErrores.codigo = 'Campo requerido.'
    if (!form.nombre.trim()) nuevosErrores.nombre = 'Campo requerido.'
    const valor = parseFloat(form.valor)
    if (form.valor === '' || isNaN(valor) || valor <= 0)
      nuevosErrores.valor = 'Debe ser mayor a 0.'
    if (!form.fecha) nuevosErrores.fecha = 'Campo requerido.'
    const vidaUtil = parseInt(form.vidaUtil, 10)
    if (form.vidaUtil === '' || isNaN(vidaUtil) || vidaUtil <= 0)
      nuevosErrores.vidaUtil = 'Debe ser mayor a 0.'
    if (!form.estado) nuevosErrores.estado = 'Campo requerido.'

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores)
      return
    }
    setErrores({})

    setGuardando(true)
    try {
      // Unique codigo per junta
      const { data: existentes } = await supabase
        .from('activos_fijos')
        .select('id')
        .eq('junta_id', juntaId!)
        .eq('codigo', form.codigo.trim())

      if (existentes && existentes.length > 0) {
        setErrores({ codigo: 'Ya existe un activo con este código.' })
        return
      }

      const { error } = await supabase.from('activos_fijos').insert({
        junta_id: juntaId!,
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        valor_adquisicion: parseFloat(form.valor),
        fecha_adquisicion: form.fecha,
        vida_util_anos: parseInt(form.vidaUtil, 10),
        estado: form.estado,
        registrado_por: usuario?.id,
      })
      if (error) throw error

      setModalNuevo(false)
      await cargarActivos()
      setAlerta({ tipo: 'exito', mensaje: 'Activo fijo registrado correctamente.' })
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al guardar el activo fijo. Intente nuevamente.' })
    } finally {
      setGuardando(false)
    }
  }

  // ─── Detail handlers ───────────────────────────────────────────────────────

  async function abrirDetalle(a: ActivoFijo) {
    setActivoDetalle(a)
    setCargandoDetalle(true)
    setDetalleDepreciacion(a.depreciacion_acumulada)
    try {
      const dep = await obtenerDepreciacion(a.valor_adquisicion, a.vida_util_anos, a.fecha_adquisicion)
      setDetalleDepreciacion(dep)
    } finally {
      setCargandoDetalle(false)
    }
  }

  // ─── Baja handlers ────────────────────────────────────────────────────────

  function abrirBaja(a: ActivoFijo) {
    setActivoBaja(a)
    setFormBaja({ fecha: hoyISO(), motivo: '' })
    setErroresBaja({})
  }

  async function confirmarBaja(e: React.FormEvent) {
    e.preventDefault()
    if (!activoBaja) return

    const nuevosErrores: { fecha?: string; motivo?: string } = {}
    if (!formBaja.fecha) nuevosErrores.fecha = 'Campo requerido.'
    if (!formBaja.motivo.trim()) nuevosErrores.motivo = 'Campo requerido.'

    if (Object.keys(nuevosErrores).length > 0) {
      setErroresBaja(nuevosErrores)
      return
    }
    setErroresBaja({})

    setDandoBaja(true)
    try {
      const { error } = await supabase
        .from('activos_fijos')
        .update({
          estado: 'baja',
          fecha_baja: formBaja.fecha,
          motivo_baja: formBaja.motivo.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', activoBaja.id)
      if (error) throw error

      setActivoBaja(null)
      await cargarActivos()
      setAlerta({ tipo: 'exito', mensaje: 'Activo dado de baja. El historial se conserva.' })
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al dar de baja el activo.' })
    } finally {
      setDandoBaja(false)
    }
  }

  // ─── Table columns ──────────────────────────────────────────────────────────

  const columnas: ColumnaTabla<ActivoFijo>[] = [
    { cabecera: 'Código', accesador: 'codigo' },
    { cabecera: 'Nombre', accesador: 'nombre' },
    { cabecera: 'Estado', accesador: (a) => badgeEstado(a.estado) },
    { cabecera: 'Adquisición', accesador: (a) => formatearFecha(a.fecha_adquisicion) },
    { cabecera: 'Valor adq.', accesador: (a) => formatearDinero(a.valor_adquisicion) },
    {
      cabecera: 'Deprec. acum.',
      accesador: (a) =>
        a.depreciacion_acumulada === null ? '—' : formatearDinero(a.depreciacion_acumulada),
    },
    {
      cabecera: 'Valor neto',
      accesador: (a) =>
        a.valor_neto === null ? '—' : formatearDinero(a.valor_neto),
    },
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-4">
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Activos fijos</h1>
        <Boton variante="primario" onClick={abrirNuevo}>
          + Nuevo activo fijo
        </Boton>
      </div>

      {/* Page alert */}
      {alerta && <Alerta tipo={alerta.tipo} mensaje={alerta.mensaje} onCerrar={() => setAlerta(null)} />}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-gray-500 font-medium">Total activos</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{activosFiltrados.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-gray-500 font-medium">Valor de adquisición</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{formatearDinero(totalAdquisicion)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-gray-500 font-medium">Depreciación acumulada</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatearDinero(totalDepreciacion)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-gray-500 font-medium">Valor neto</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{formatearDinero(totalValorNeto)}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <label htmlFor="filtro-estado" className="text-sm font-medium text-gray-700 mr-3">
          Estado
        </label>
        <select
          id="filtro-estado"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as 'todos' | EstadoActivo)}
          className={INPUT_CLASS + ' sm:max-w-xs'}
        >
          <option value="todos">Todos</option>
          {ESTADOS.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.etiqueta}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Tabla<ActivoFijo>
        columnas={columnas}
        datos={activosFiltrados}
        cargando={cargando}
        camposFiltro={['codigo', 'nombre']}
        filasPorPagina={15}
        accionesExtra={(a) => (
          <div className="flex gap-2">
            <Boton variante="fantasma" tamaño="sm" onClick={() => abrirDetalle(a)}>
              Ver
            </Boton>
            {a.estado !== 'baja' && (
              <Boton variante="peligro" tamaño="sm" onClick={() => abrirBaja(a)}>
                Dar de baja
              </Boton>
            )}
          </div>
        )}
      />

      {/* ── Create modal ── */}
      <Modal
        abierto={modalNuevo}
        onCerrar={() => setModalNuevo(false)}
        titulo="Nuevo activo fijo"
        tamaño="lg"
      >
        <Formulario onSubmit={guardarActivo}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CampoFormulario label="Código" htmlFor="af-codigo" requerido error={errores.codigo}>
              <input
                id="af-codigo"
                type="text"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            <CampoFormulario label="Nombre" htmlFor="af-nombre" requerido error={errores.nombre}>
              <input
                id="af-nombre"
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            <div className="sm:col-span-2">
              <CampoFormulario label="Descripción" htmlFor="af-descripcion" error={errores.descripcion}>
                <textarea
                  id="af-descripcion"
                  rows={3}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className={INPUT_CLASS}
                />
              </CampoFormulario>
            </div>

            <CampoFormulario label="Valor de adquisición" htmlFor="af-valor" requerido error={errores.valor}>
              <input
                id="af-valor"
                type="number"
                min={0.01}
                step={0.01}
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            <CampoFormulario label="Fecha de adquisición" htmlFor="af-fecha" requerido error={errores.fecha}>
              <input
                id="af-fecha"
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            <CampoFormulario label="Vida útil (años)" htmlFor="af-vida" requerido error={errores.vidaUtil}>
              <input
                id="af-vida"
                type="number"
                min={1}
                step={1}
                value={form.vidaUtil}
                onChange={(e) => setForm({ ...form, vidaUtil: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            <CampoFormulario label="Estado" htmlFor="af-estado" requerido error={errores.estado}>
              <select
                id="af-estado"
                value={form.estado}
                onChange={(e) =>
                  setForm({ ...form, estado: e.target.value as ActivoFormState['estado'] })
                }
                className={INPUT_CLASS}
              >
                <option value="bueno">Bueno</option>
                <option value="regular">Regular</option>
                <option value="mantenimiento">Mantenimiento</option>
              </select>
            </CampoFormulario>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Boton type="button" variante="secundario" onClick={() => setModalNuevo(false)}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="primario" cargando={guardando}>
              Registrar
            </Boton>
          </div>
        </Formulario>
      </Modal>

      {/* ── Detail modal (RF-22.3) ── */}
      <Modal
        abierto={activoDetalle !== null}
        onCerrar={() => setActivoDetalle(null)}
        titulo={`Detalle del activo — ${activoDetalle?.codigo ?? ''}`}
        tamaño="md"
      >
        {activoDetalle && (
          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-44 shrink-0 text-gray-500">Código</dt>
                <dd className="font-medium text-gray-800">{activoDetalle.codigo}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-44 shrink-0 text-gray-500">Nombre</dt>
                <dd className="font-medium text-gray-800">{activoDetalle.nombre}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-44 shrink-0 text-gray-500">Descripción</dt>
                <dd className="text-gray-800">{activoDetalle.descripcion || '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-44 shrink-0 text-gray-500">Estado</dt>
                <dd>{badgeEstado(activoDetalle.estado)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-44 shrink-0 text-gray-500">Fecha de adquisición</dt>
                <dd className="text-gray-800">{formatearFecha(activoDetalle.fecha_adquisicion)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-44 shrink-0 text-gray-500">Vida útil</dt>
                <dd className="text-gray-800">{activoDetalle.vida_util_anos} años</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-44 shrink-0 text-gray-500">Valor de adquisición</dt>
                <dd className="text-gray-800">{formatearDinero(activoDetalle.valor_adquisicion)}</dd>
              </div>
            </dl>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
              <p className="text-xs uppercase text-gray-500 font-medium">Depreciación acumulada</p>
              <p className="text-2xl font-semibold text-gray-800">
                {cargandoDetalle ? 'Calculando…' : formatearDinero(detalleDepreciacion)}
              </p>
              <p className="text-xs uppercase text-gray-500 font-medium pt-2">Valor neto en libros</p>
              <p className="text-2xl font-bold text-green-700">
                {cargandoDetalle
                  ? 'Calculando…'
                  : formatearDinero(
                      activoDetalle.valor_adquisicion - (detalleDepreciacion ?? 0),
                    )}
              </p>
            </div>

            {activoDetalle.estado === 'baja' && (
              <div className="space-y-3">
                <span className="inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold">
                  Dado de baja
                </span>
                <dl className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-44 shrink-0 text-gray-500">Fecha de baja</dt>
                    <dd className="text-gray-800">{formatearFecha(activoDetalle.fecha_baja)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-44 shrink-0 text-gray-500">Motivo de baja</dt>
                    <dd className="text-gray-800">{activoDetalle.motivo_baja || '—'}</dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="flex justify-end">
              <Boton type="button" variante="secundario" onClick={() => setActivoDetalle(null)}>
                Cerrar
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Baja modal (RF-22.4) ── */}
      <Modal
        abierto={activoBaja !== null}
        onCerrar={() => setActivoBaja(null)}
        titulo={`Dar de baja el activo — ${activoBaja?.codigo ?? ''}`}
        tamaño="md"
      >
        {activoBaja && (
          <Formulario onSubmit={confirmarBaja}>
            <dl className="space-y-2 text-sm mb-4">
              <div className="flex gap-2">
                <dt className="w-40 shrink-0 text-gray-500">Nombre</dt>
                <dd className="font-medium text-gray-800">{activoBaja.nombre}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-40 shrink-0 text-gray-500">Valor</dt>
                <dd className="text-gray-800">{formatearDinero(activoBaja.valor_adquisicion)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-40 shrink-0 text-gray-500">Estado</dt>
                <dd>{badgeEstado(activoBaja.estado)}</dd>
              </div>
            </dl>

            <p className="text-sm text-gray-600 mb-4">
              El activo no será eliminado: el registro se conserva en el historial con su motivo de baja.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CampoFormulario label="Fecha de baja" htmlFor="baja-fecha" requerido error={erroresBaja.fecha}>
                <input
                  id="baja-fecha"
                  type="date"
                  value={formBaja.fecha}
                  onChange={(e) => setFormBaja({ ...formBaja, fecha: e.target.value })}
                  className={INPUT_CLASS}
                />
              </CampoFormulario>

              <div className="sm:col-span-2">
                <CampoFormulario label="Motivo" htmlFor="baja-motivo" requerido error={erroresBaja.motivo}>
                  <textarea
                    id="baja-motivo"
                    rows={3}
                    value={formBaja.motivo}
                    onChange={(e) => setFormBaja({ ...formBaja, motivo: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </CampoFormulario>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Boton type="button" variante="secundario" onClick={() => setActivoBaja(null)}>
                Cancelar
              </Boton>
              <Boton type="submit" variante="peligro" cargando={dandoBaja}>
                Dar de baja
              </Boton>
            </div>
          </Formulario>
        )}
      </Modal>
    </div>
  )
}
