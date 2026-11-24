import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import useAuth from '../../hooks/useAuth'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { Modal } from '../../components/ui/Modal'
import { Formulario, CampoFormulario } from '../../components/ui/Formulario'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'

// ─── Types ───────────────────────────────────────────────────────────────────

type OrigenTipo = 'asamblea' | 'minga'
type EstadoMulta = 'pendiente' | 'confirmada' | 'anulada' | 'pagada'

interface Multa {
  id: string
  junta_id: string
  miembro_id: string
  origen_id: string
  origen_tipo: OrigenTipo
  monto: number
  estado: EstadoMulta
  ingreso_id: string | null
  created_at: string
  confirmado_por: string | null
  // joined:
  miembro_nombres: string
  miembro_apellidos: string
  miembro_cedula: string
  ingreso_numero_recibo: string | null
  ingreso_comprobante_path: string | null
}

type MultaRow = Omit<Multa, 'miembro_nombres' | 'miembro_apellidos' | 'miembro_cedula' | 'ingreso_numero_recibo' | 'ingreso_comprobante_path'> & {
  miembros?: { nombres: string; apellidos: string; cedula: string } | null
  ingresos?: { numero_recibo: string; comprobante_path: string | null } | null
}

interface Sancion {
  id: string
  junta_id: string
  tipo_evento: OrigenTipo
  monto: number
}

interface AsistenciaFlagged {
  id: string
  miembro_id: string
  origen_id: string
  origen_tipo: OrigenTipo
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Depósito', 'Otro']

const ESTADO_BADGE: Record<EstadoMulta, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  confirmada: 'bg-blue-100 text-blue-800',
  pagada: 'bg-green-100 text-green-800',
  anulada: 'bg-gray-100 text-gray-600',
}

function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Multas() {
  const { usuario, juntaId } = useAuth()

  const [pestana, setPestana] = useState<'generacion' | 'registro'>('generacion')

  // Alerts
  const [alerta, setAlerta] = useState<{ tipo: 'exito' | 'error' | 'advertencia' | 'info'; mensaje: string } | null>(null)

  useEffect(() => {
    if (!alerta) return
    const t = setTimeout(() => setAlerta(null), 5000)
    return () => clearTimeout(t)
  }, [alerta])

  // ── Tab 1: Generación state ──
  const [asistenciasFlag, setAsistenciasFlag] = useState<AsistenciaFlagged[]>([])
  const [sanciones, setSanciones] = useState<Sancion[]>([])
  const [multasGeneradas, setMultasGeneradas] = useState(0)
  const [cargandoGeneracion, setCargandoGeneracion] = useState(false)
  const [generando, setGenerando] = useState(false)

  // ── Tab 2: Registro state ──
  const [multas, setMultas] = useState<Multa[]>([])
  const [cargandoMultas, setCargandoMultas] = useState(false)

  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroMiembro, setFiltroMiembro] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  // Modals
  const [multaConfirmar, setMultaConfirmar] = useState<Multa | null>(null)
  const [multaAnular, setMultaAnular] = useState<Multa | null>(null)
  const [multaPagar, setMultaPagar] = useState<Multa | null>(null)
  const [procesando, setProcesando] = useState(false)

  // Payment form
  const [pagoFecha, setPagoFecha] = useState(fechaHoy())
  const [pagoMetodo, setPagoMetodo] = useState('Efectivo')
  const [errorPago, setErrorPago] = useState<string | null>(null)

  // ─── Load data (generación) ────────────────────────────────────────────────

  const cargarGeneracion = useCallback(async () => {
    if (!juntaId) return
    setCargandoGeneracion(true)
    try {
      const [resAsistA, resAsistM, resSanciones, resMultas] = await Promise.all([
        supabase
          .from('asistencia_asambleas')
          .select('id, miembro_id, asamblea_id')
          .eq('junta_id', juntaId)
          .eq('susceptible_multa', true),
        supabase
          .from('asistencia_mingas')
          .select('id, miembro_id, minga_id')
          .eq('junta_id', juntaId)
          .eq('susceptible_multa', true),
        supabase
          .from('tabla_sanciones')
          .select('id, junta_id, tipo_evento, monto')
          .eq('junta_id', juntaId),
        supabase
          .from('multas')
          .select('origen_id, origen_tipo, miembro_id')
          .eq('junta_id', juntaId),
      ])

      if (resAsistA.error) throw resAsistA.error
      if (resAsistM.error) throw resAsistM.error
      if (resSanciones.error) throw resSanciones.error
      if (resMultas.error) throw resMultas.error

      const existentes = new Set(
        ((resMultas.data ?? []) as { origen_id: string; origen_tipo: string; miembro_id: string }[]).map(
          (m) => `${m.origen_id}|${m.origen_tipo}|${m.miembro_id}`,
        ),
      )

      const asambleasFlag: AsistenciaFlagged[] = (
        (resAsistA.data ?? []) as { id: string; miembro_id: string; asamblea_id: string }[]
      ).map((r) => ({ id: r.id, miembro_id: r.miembro_id, origen_id: r.asamblea_id, origen_tipo: 'asamblea' }))

      const mingasFlag: AsistenciaFlagged[] = (
        (resAsistM.data ?? []) as { id: string; miembro_id: string; minga_id: string }[]
      ).map((r) => ({ id: r.id, miembro_id: r.miembro_id, origen_id: r.minga_id, origen_tipo: 'minga' }))

      const todas = [...asambleasFlag, ...mingasFlag].filter(
        (a) => !existentes.has(`${a.origen_id}|${a.origen_tipo}|${a.miembro_id}`),
      )

      setAsistenciasFlag(todas)
      setSanciones((resSanciones.data ?? []) as Sancion[])
      setMultasGeneradas(((resMultas.data ?? []) as unknown[]).length)
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al cargar los datos de generación de multas.' })
    } finally {
      setCargandoGeneracion(false)
    }
  }, [juntaId])

  // ─── Load data (registro) ──────────────────────────────────────────────────

  const cargarMultas = useCallback(async () => {
    if (!juntaId) return
    setCargandoMultas(true)
    try {
      const { data, error } = await supabase
        .from('multas')
        .select(
          `*,
          miembros!miembro_id (nombres, apellidos, cedula),
          ingresos!ingreso_id (numero_recibo, comprobante_path)`,
        )
        .eq('junta_id', juntaId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const planas: Multa[] = ((data ?? []) as unknown as MultaRow[]).map((r) => ({
        id: r.id,
        junta_id: r.junta_id,
        miembro_id: r.miembro_id,
        origen_id: r.origen_id,
        origen_tipo: r.origen_tipo,
        monto: Number(r.monto),
        estado: r.estado,
        ingreso_id: r.ingreso_id,
        created_at: r.created_at,
        confirmado_por: r.confirmado_por,
        miembro_nombres: r.miembros?.nombres ?? '',
        miembro_apellidos: r.miembros?.apellidos ?? '',
        miembro_cedula: r.miembros?.cedula ?? '',
        ingreso_numero_recibo: r.ingresos?.numero_recibo ?? null,
        ingreso_comprobante_path: r.ingresos?.comprobante_path ?? null,
      }))

      setMultas(planas)
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al cargar el registro de multas.' })
    } finally {
      setCargandoMultas(false)
    }
  }, [juntaId])

  useEffect(() => {
    if (pestana === 'generacion') cargarGeneracion()
    else cargarMultas()
  }, [pestana, cargarGeneracion, cargarMultas])

  // ─── Generate fines ────────────────────────────────────────────────────────

  async function generarMultas() {
    if (!juntaId || asistenciasFlag.length === 0) return
    setGenerando(true)
    try {
      const mapaSanciones = new Map(sanciones.map((s) => [s.tipo_evento, Number(s.monto)]))
      const faltantes = new Set<OrigenTipo>()

      let generadas = 0
      const procesadas: AsistenciaFlagged[] = []

      for (const a of asistenciasFlag) {
        const monto = mapaSanciones.get(a.origen_tipo)
        if (monto === undefined) {
          faltantes.add(a.origen_tipo)
          continue
        }
        const { error } = await supabase.from('multas').insert({
          junta_id: juntaId,
          miembro_id: a.miembro_id,
          origen_id: a.origen_id,
          origen_tipo: a.origen_tipo,
          monto,
          estado: 'pendiente',
        })
        if (error) throw error
        procesadas.push(a)
        generadas++
      }

      // Reset susceptible_multa on processed rows
      for (const a of procesadas) {
        const tabla = a.origen_tipo === 'asamblea' ? 'asistencia_asambleas' : 'asistencia_mingas'
        await supabase.from(tabla).update({ susceptible_multa: false }).eq('id', a.id)
      }

      if (faltantes.size > 0) {
        const tipos = [...faltantes].join(' y ')
        setAlerta({
          tipo: 'advertencia',
          mensaje:
            generadas > 0
              ? `Se generaron ${generadas} multas. No hay monto de sanción configurado para ${tipos}. Configure la tabla de sanciones.`
              : `No hay monto de sanción configurado para ${tipos}. Configure la tabla de sanciones.`,
        })
      } else if (generadas > 0) {
        setAlerta({ tipo: 'exito', mensaje: `Se generaron ${generadas} multas.` })
      }

      await cargarGeneracion()
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al generar las multas. Intente nuevamente.' })
    } finally {
      setGenerando(false)
    }
  }

  // ─── Confirm / annul ───────────────────────────────────────────────────────

  async function confirmarMulta() {
    if (!multaConfirmar) return
    setProcesando(true)
    try {
      const { error } = await supabase
        .from('multas')
        .update({ estado: 'confirmada', confirmado_por: usuario?.id ?? null })
        .eq('id', multaConfirmar.id)
      if (error) throw error
      setMultaConfirmar(null)
      await cargarMultas()
      setAlerta({ tipo: 'exito', mensaje: 'Multa confirmada.' })
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al confirmar la multa.' })
    } finally {
      setProcesando(false)
    }
  }

  async function anularMulta() {
    if (!multaAnular) return
    setProcesando(true)
    try {
      const { error } = await supabase
        .from('multas')
        .update({ estado: 'anulada' })
        .eq('id', multaAnular.id)
      if (error) throw error
      setMultaAnular(null)
      await cargarMultas()
      setAlerta({ tipo: 'exito', mensaje: 'Multa anulada.' })
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al anular la multa.' })
    } finally {
      setProcesando(false)
    }
  }

  // ─── Payment ───────────────────────────────────────────────────────────────

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

  async function registrarPago(e: React.FormEvent) {
    e.preventDefault()
    if (!multaPagar || !juntaId) return
    if (!pagoFecha) {
      setErrorPago('La fecha del pago es requerida.')
      return
    }
    setErrorPago(null)
    setProcesando(true)
    try {
      const numeroRecibo = await generarNumeroRecibo()
      if (!numeroRecibo) throw new Error('numero_recibo')

      const { data: ingresoNuevo, error: errIngreso } = await supabase
        .from('ingresos')
        .insert({
          junta_id: juntaId,
          miembro_id: multaPagar.miembro_id,
          concepto: 'Pago de multa por inasistencia',
          monto: multaPagar.monto,
          fecha: pagoFecha,
          metodo_pago: pagoMetodo,
          numero_recibo: numeroRecibo,
          registrado_por: usuario?.id ?? null,
        })
        .select('id')
        .single()

      if (errIngreso) throw errIngreso
      if (!ingresoNuevo?.id) throw new Error('ingreso_id')

      const { error: errMulta } = await supabase
        .from('multas')
        .update({ estado: 'pagada', ingreso_id: ingresoNuevo.id })
        .eq('id', multaPagar.id)
      if (errMulta) throw errMulta

      setMultaPagar(null)
      await cargarMultas()
      setAlerta({ tipo: 'exito', mensaje: `Pago registrado. Recibo N.º ${numeroRecibo}.` })
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al registrar el pago de la multa.' })
    } finally {
      setProcesando(false)
    }
  }

  // ─── View receipt ──────────────────────────────────────────────────────────

  async function verRecibo(path: string) {
    const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(path, 3600)
    if (error || !data?.signedUrl) {
      setAlerta({ tipo: 'error', mensaje: 'No se pudo abrir el comprobante.' })
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  // ─── Derived values ────────────────────────────────────────────────────────

  const pendientesGenerar = asistenciasFlag.length
  const haySanciones = sanciones.length > 0

  const multasFiltradas = multas.filter((m) => {
    if (filtroEstado !== 'todos' && m.estado !== filtroEstado) return false
    if (filtroMiembro.trim()) {
      const q = filtroMiembro.trim().toLowerCase()
      const texto = `${m.miembro_nombres} ${m.miembro_apellidos} ${m.miembro_cedula}`.toLowerCase()
      if (!texto.includes(q)) return false
    }
    const fecha = m.created_at.split('T')[0]
    if (filtroDesde && fecha < filtroDesde) return false
    if (filtroHasta && fecha > filtroHasta) return false
    return true
  })

  const cuentaPendientes = multas.filter((m) => m.estado === 'pendiente').length
  const cuentaConfirmadas = multas.filter((m) => m.estado === 'confirmada').length
  const cuentaPagadas = multas.filter((m) => m.estado === 'pagada').length
  const totalRecaudado = multas
    .filter((m) => m.estado === 'pagada')
    .reduce((sum, m) => sum + m.monto, 0)

  // ─── Table columns ─────────────────────────────────────────────────────────

  const columnas: ColumnaTabla<Multa>[] = [
    {
      cabecera: 'Miembro',
      accesador: (m) =>
        m.miembro_apellidos ? `${m.miembro_apellidos}, ${m.miembro_nombres}` : '—',
    },
    { cabecera: 'Cédula', accesador: (m) => m.miembro_cedula || '—' },
    {
      cabecera: 'Origen',
      accesador: (m) => (m.origen_tipo === 'asamblea' ? 'Asamblea' : 'Minga'),
    },
    { cabecera: 'Monto', accesador: (m) => `$${m.monto.toFixed(2)}` },
    {
      cabecera: 'Fecha',
      accesador: (m) => formatearFecha(m.created_at),
    },
    {
      cabecera: 'Estado',
      accesador: (m) => (
        <span
          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[m.estado]}`}
        >
          {m.estado.charAt(0).toUpperCase() + m.estado.slice(1)}
        </span>
      ),
    },
    {
      cabecera: 'Recibo',
      accesador: (m) =>
        m.ingreso_comprobante_path ? (
          <button
            type="button"
            onClick={() => verRecibo(m.ingreso_comprobante_path!)}
            className="text-green-700 font-medium underline hover:text-green-900"
          >
            {m.ingreso_numero_recibo ?? 'Ver recibo'}
          </button>
        ) : (
          m.ingreso_numero_recibo ?? '—'
        ),
    },
  ]

  const acciones = (m: Multa) => (
    <div className="flex gap-2">
      {m.estado === 'pendiente' && (
        <>
          <Boton
            variante="secundario"
            tamaño="sm"
            onClick={() => setMultaConfirmar(m)}
          >
            Confirmar
          </Boton>
          <Boton variante="peligro" tamaño="sm" onClick={() => setMultaAnular(m)}>
            Anular
          </Boton>
        </>
      )}
      {m.estado === 'confirmada' && (
        <Boton
          variante="primario"
          tamaño="sm"
          onClick={() => {
            setMultaPagar(m)
            setPagoFecha(fechaHoy())
            setPagoMetodo('Efectivo')
            setErrorPago(null)
          }}
        >
          Registrar pago
        </Boton>
      )}
    </div>
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Multas</h1>

      {alerta && (
        <Alerta tipo={alerta.tipo} mensaje={alerta.mensaje} onCerrar={() => setAlerta(null)} />
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setPestana('generacion')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            pestana === 'generacion'
              ? 'bg-green-700 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Generación
        </button>
        <button
          type="button"
          onClick={() => setPestana('registro')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            pestana === 'registro'
              ? 'bg-green-700 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Registro de multas
        </button>
      </div>

      {/* ── Tab 1: Generación ── */}
      {pestana === 'generacion' && (
        <div className="space-y-4">
          {!haySanciones && (
            <Alerta
              tipo="advertencia"
              mensaje="No hay sanciones configuradas. Pida al Administrador configurar la tabla de sanciones."
            />
          )}

          {/* Summary card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumen de generación</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                <p className="text-sm text-gray-500">Asistencias marcadas (asambleas)</p>
                <p className="text-2xl font-bold text-gray-800">
                  {asistenciasFlag.filter((a) => a.origen_tipo === 'asamblea').length}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                <p className="text-sm text-gray-500">Asistencias marcadas (mingas)</p>
                <p className="text-2xl font-bold text-gray-800">
                  {asistenciasFlag.filter((a) => a.origen_tipo === 'minga').length}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                <p className="text-sm text-gray-500">Multas ya generadas</p>
                <p className="text-2xl font-bold text-gray-800">{multasGeneradas}</p>
              </div>
              <div className="rounded-lg border border-yellow-300 p-4 bg-yellow-50">
                <p className="text-sm text-yellow-700">Pendientes de generar</p>
                <p className="text-2xl font-bold text-yellow-800">{pendientesGenerar}</p>
              </div>
            </div>

            <div className="mt-6">
              <Boton
                variante="primario"
                onClick={generarMultas}
                cargando={generando}
                disabled={pendientesGenerar === 0 || !haySanciones || cargandoGeneracion}
              >
                Generar multas
              </Boton>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Registro ── */}
      {pestana === 'registro' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-700">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-800">{cuentaPendientes}</p>
            </div>
            <div className="rounded-lg border border-blue-300 bg-blue-50 p-4">
              <p className="text-sm text-blue-700">Confirmadas</p>
              <p className="text-2xl font-bold text-blue-800">{cuentaConfirmadas}</p>
            </div>
            <div className="rounded-lg border border-green-300 bg-green-50 p-4">
              <p className="text-sm text-green-700">Pagadas</p>
              <p className="text-2xl font-bold text-green-800">{cuentaPagadas}</p>
            </div>
            <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">Total recaudado</p>
              <p className="text-2xl font-bold text-gray-800">${totalRecaudado.toFixed(2)}</p>
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label htmlFor="filtro-estado" className="text-sm font-medium text-gray-600">
                Estado
              </label>
              <select
                id="filtro-estado"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className={INPUT_CLASS + ' w-44'}
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="confirmada">Confirmada</option>
                <option value="pagada">Pagada</option>
                <option value="anulada">Anulada</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="filtro-miembro-m" className="text-sm font-medium text-gray-600">
                Miembro
              </label>
              <input
                id="filtro-miembro-m"
                type="text"
                value={filtroMiembro}
                onChange={(e) => setFiltroMiembro(e.target.value)}
                placeholder="Nombre, apellidos o cédula"
                className={INPUT_CLASS + ' w-56'}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="filtro-desde-m" className="text-sm font-medium text-gray-600">
                Desde
              </label>
              <input
                id="filtro-desde-m"
                type="date"
                value={filtroDesde}
                onChange={(e) => setFiltroDesde(e.target.value)}
                className={INPUT_CLASS + ' w-40'}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="filtro-hasta-m" className="text-sm font-medium text-gray-600">
                Hasta
              </label>
              <input
                id="filtro-hasta-m"
                type="date"
                value={filtroHasta}
                onChange={(e) => setFiltroHasta(e.target.value)}
                className={INPUT_CLASS + ' w-40'}
              />
            </div>
          </div>

          {/* Table */}
          <Tabla<Multa>
            columnas={columnas}
            datos={multasFiltradas}
            cargando={cargandoMultas}
            camposFiltro={['miembro_apellidos', 'miembro_nombres', 'miembro_cedula']}
            filasPorPagina={15}
            accionesExtra={acciones}
          />
        </div>
      )}

      {/* ── Confirm modal ── */}
      <Modal
        abierto={multaConfirmar !== null}
        onCerrar={() => setMultaConfirmar(null)}
        titulo="Confirmar multa"
        tamaño="sm"
      >
        {multaConfirmar && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              ¿Desea confirmar la multa de{' '}
              <strong>
                {multaConfirmar.miembro_apellidos}, {multaConfirmar.miembro_nombres}
              </strong>{' '}
              por <strong>${multaConfirmar.monto.toFixed(2)}</strong>? Quedará registrada como deuda
              pendiente del miembro.
            </p>
            <div className="flex justify-end gap-3">
              <Boton variante="secundario" onClick={() => setMultaConfirmar(null)}>
                Cancelar
              </Boton>
              <Boton variante="primario" onClick={confirmarMulta} cargando={procesando}>
                Confirmar
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Annul modal ── */}
      <Modal
        abierto={multaAnular !== null}
        onCerrar={() => setMultaAnular(null)}
        titulo="Anular multa"
        tamaño="sm"
      >
        {multaAnular && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              ¿Desea anular la multa de{' '}
              <strong>
                {multaAnular.miembro_apellidos}, {multaAnular.miembro_nombres}
              </strong>{' '}
              por <strong>${multaAnular.monto.toFixed(2)}</strong>? Esta acción deja la multa sin
              efecto.
            </p>
            <div className="flex justify-end gap-3">
              <Boton variante="secundario" onClick={() => setMultaAnular(null)}>
                Cancelar
              </Boton>
              <Boton variante="peligro" onClick={anularMulta} cargando={procesando}>
                Anular
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Payment modal ── */}
      <Modal
        abierto={multaPagar !== null}
        onCerrar={() => setMultaPagar(null)}
        titulo="Registrar pago de multa"
        tamaño="md"
      >
        {multaPagar && (
          <Formulario onSubmit={registrarPago}>
            <div className="space-y-4">
              <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700">
                <p>
                  <span className="font-medium">Miembro:</span>{' '}
                  {multaPagar.miembro_apellidos}, {multaPagar.miembro_nombres}
                </p>
                <p>
                  <span className="font-medium">Monto de la multa:</span> $
                  {multaPagar.monto.toFixed(2)}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CampoFormulario
                  label="Fecha del pago"
                  htmlFor="pago-fecha"
                  requerido
                  error={errorPago ?? undefined}
                >
                  <input
                    id="pago-fecha"
                    type="date"
                    value={pagoFecha}
                    onChange={(e) => setPagoFecha(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </CampoFormulario>

                <CampoFormulario label="Método de pago" htmlFor="pago-metodo" requerido>
                  <select
                    id="pago-metodo"
                    value={pagoMetodo}
                    onChange={(e) => setPagoMetodo(e.target.value)}
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

              <div className="flex justify-end gap-3">
                <Boton type="button" variante="secundario" onClick={() => setMultaPagar(null)}>
                  Cancelar
                </Boton>
                <Boton type="submit" variante="primario" cargando={procesando}>
                  Registrar pago
                </Boton>
              </div>
            </div>
          </Formulario>
        )}
      </Modal>
    </div>
  )
}
