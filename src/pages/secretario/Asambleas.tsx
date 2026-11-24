import { useState, useEffect, useCallback } from 'react'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { Modal } from '../../components/ui/Modal'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'
import useAuth from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

type EstadoAsamblea = 'abierta' | 'cerrada'
type EstadoAsistencia = 'presente' | 'ausente_justificado' | 'ausente'

interface Asamblea {
  id: string
  junta_id: string
  fecha: string
  hora: string
  lugar: string
  orden_del_dia: string
  estado: EstadoAsamblea
  porcentaje_participacion: number | null
  created_at: string
  creado_por: string | null
}

interface AsistenciaRow {
  id: string
  junta_id: string
  asamblea_id: string
  miembro_id: string
  estado: EstadoAsistencia
  susceptible_multa: boolean
  created_at: string
  miembro_nombres: string
  miembro_apellidos: string
  miembro_cedula: string
}

interface HistorialItem {
  asamblea_id: string
  fecha: string
  estado: EstadoAsistencia
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFecha(fecha: string): string {
  if (!fecha) return ''
  const [year, month, day] = fecha.split('-')
  return `${day}/${month}/${year}`
}

function BadgeEstadoAsamblea({ estado }: { estado: EstadoAsamblea }) {
  const map: Record<EstadoAsamblea, { label: string; clase: string }> = {
    abierta: { label: 'Abierta', clase: 'bg-blue-100 text-blue-700' },
    cerrada: { label: 'Cerrada', clase: 'bg-green-100 text-green-700' },
  }
  const { label, clase } = map[estado]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${clase}`}>
      {label}
    </span>
  )
}

function BadgeEstadoAsistencia({ estado }: { estado: EstadoAsistencia }) {
  const map: Record<EstadoAsistencia, { label: string; clase: string }> = {
    presente: { label: 'Presente', clase: 'bg-green-100 text-green-700' },
    ausente_justificado: { label: 'Justificado', clase: 'bg-yellow-100 text-yellow-700' },
    ausente: { label: 'Ausente', clase: 'bg-red-100 text-red-700' },
  }
  const { label, clase } = map[estado]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${clase}`}>
      {label}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Asambleas() {
  const { usuario, juntaId } = useAuth()

  // List view state
  const [asambleas, setAsambleas] = useState<Asamblea[]>([])
  const [cargandoLista, setCargandoLista] = useState(false)
  const [alertaLista, setAlertaLista] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)

  // Modal nueva asamblea
  const [modalNueva, setModalNueva] = useState(false)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaHora, setNuevaHora] = useState('')
  const [nuevaLugar, setNuevaLugar] = useState('')
  const [nuevaOrden, setNuevaOrden] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState('')

  // Detail view
  const [selectedAsamblea, setSelectedAsamblea] = useState<Asamblea | null>(null)
  const [asistencias, setAsistencias] = useState<AsistenciaRow[]>([])
  const [cargandoAsistencias, setCargandoAsistencias] = useState(false)
  const [alertaDetalle, setAlertaDetalle] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)

  // Modal cerrar asamblea
  const [modalCerrar, setModalCerrar] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  // Historial por miembro
  const [miembroHistorial, setMiembroHistorial] = useState('')
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  // ── Fetch asambleas ──────────────────────────────────────────────────────

  const fetchAsambleas = useCallback(async () => {
    if (!juntaId) return
    setCargandoLista(true)
    const { data, error } = await supabase
      .from('asambleas')
      .select('*')
      .eq('junta_id', juntaId)
      .order('fecha', { ascending: false })

    if (error) {
      setAlertaLista({ tipo: 'error', mensaje: 'Error al cargar asambleas.' })
    } else {
      setAsambleas((data ?? []) as Asamblea[])
    }
    setCargandoLista(false)
  }, [juntaId])

  useEffect(() => {
    fetchAsambleas()
  }, [fetchAsambleas])

  // ── Fetch asistencias ────────────────────────────────────────────────────

  const fetchAsistencias = useCallback(async (asambleaId: string) => {
    setCargandoAsistencias(true)
    const { data, error } = await supabase
      .from('asistencia_asambleas')
      .select(`
        *,
        miembros!miembro_id (nombres, apellidos, cedula)
      `)
      .eq('asamblea_id', asambleaId)
      .order('miembros(apellidos)')

    if (error) {
      setAlertaDetalle({ tipo: 'error', mensaje: 'Error al cargar lista de asistencia.' })
      setCargandoAsistencias(false)
      return
    }

    const rows: AsistenciaRow[] = ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      junta_id: r.junta_id,
      asamblea_id: r.asamblea_id,
      miembro_id: r.miembro_id,
      estado: r.estado as EstadoAsistencia,
      susceptible_multa: r.susceptible_multa,
      created_at: r.created_at,
      miembro_nombres: r.miembros?.nombres ?? '',
      miembro_apellidos: r.miembros?.apellidos ?? '',
      miembro_cedula: r.miembros?.cedula ?? '',
    }))

    setAsistencias(rows)
    setCargandoAsistencias(false)
  }, [])

  useEffect(() => {
    if (selectedAsamblea) {
      fetchAsistencias(selectedAsamblea.id)
      setAlertaDetalle(null)
      setMiembroHistorial('')
      setHistorial([])
    }
  }, [selectedAsamblea, fetchAsistencias])

  // ── Nueva asamblea ───────────────────────────────────────────────────────

  function abrirModalNueva() {
    setNuevaFecha('')
    setNuevaHora('')
    setNuevaLugar('')
    setNuevaOrden('')
    setErrorModal('')
    setModalNueva(true)
  }

  async function handleCrearAsamblea() {
    if (!nuevaFecha || !nuevaHora || !nuevaLugar.trim() || !nuevaOrden.trim()) {
      setErrorModal('Todos los campos son obligatorios.')
      return
    }
    if (!juntaId) return
    setGuardando(true)
    setErrorModal('')

    // 1. Insert asamblea
    const { data: asambleaData, error: asambleaError } = await supabase
      .from('asambleas')
      .insert({
        junta_id: juntaId,
        fecha: nuevaFecha,
        hora: nuevaHora,
        lugar: nuevaLugar.trim(),
        orden_del_dia: nuevaOrden.trim(),
        estado: 'abierta',
        creado_por: usuario?.id ?? null,
      })
      .select()
      .single()

    if (asambleaError || !asambleaData) {
      setErrorModal('Error al crear la asamblea. Intente de nuevo.')
      setGuardando(false)
      return
    }

    const nuevaAsambleaId = (asambleaData as Asamblea).id

    // 2. Fetch active members
    const { data: miembrosData, error: miembrosError } = await supabase
      .from('miembros')
      .select('id')
      .eq('junta_id', juntaId)
      .eq('activo', true)

    if (miembrosError) {
      setErrorModal('Asamblea creada, pero hubo un error al obtener los miembros.')
      setGuardando(false)
      setModalNueva(false)
      await fetchAsambleas()
      return
    }

    const miembros = (miembrosData ?? []) as { id: string }[]

    // 3. Bulk insert attendance rows
    if (miembros.length > 0) {
      const filas = miembros.map((m) => ({
        junta_id: juntaId,
        asamblea_id: nuevaAsambleaId,
        miembro_id: m.id,
        estado: 'ausente',
        susceptible_multa: false,
      }))

      const { error: asistenciaError } = await supabase
        .from('asistencia_asambleas')
        .insert(filas)

      if (asistenciaError) {
        setErrorModal('Asamblea creada, pero hubo un error al crear la lista de asistencia.')
        setGuardando(false)
        setModalNueva(false)
        await fetchAsambleas()
        return
      }
    }

    setGuardando(false)
    setModalNueva(false)
    await fetchAsambleas()
    setAlertaLista({
      tipo: 'exito',
      mensaje: `Asamblea creada con lista de asistencia para ${miembros.length} miembros.`,
    })
  }

  // ── Cambio de estado de asistencia ──────────────────────────────────────

  async function handleEstadoChange(asistenciaId: string, nuevoEstado: EstadoAsistencia) {
    // Optimistic update
    setAsistencias((prev) =>
      prev.map((a) => (a.id === asistenciaId ? { ...a, estado: nuevoEstado } : a))
    )

    const { error } = await supabase
      .from('asistencia_asambleas')
      .update({ estado: nuevoEstado })
      .eq('id', asistenciaId)

    if (error) {
      // Revert
      setAsistencias((prev) =>
        prev.map((a) =>
          a.id === asistenciaId
            ? { ...a, estado: asistencias.find((x) => x.id === asistenciaId)?.estado ?? a.estado }
            : a
        )
      )
      setAlertaDetalle({ tipo: 'error', mensaje: 'Error al actualizar la asistencia.' })
    }
  }

  // ── Cerrar asamblea ──────────────────────────────────────────────────────

  async function handleCerrarAsamblea() {
    if (!selectedAsamblea) return
    setCerrando(true)

    // 1. Fetch all attendance rows
    const { data: filas, error: fetchError } = await supabase
      .from('asistencia_asambleas')
      .select('*')
      .eq('asamblea_id', selectedAsamblea.id)

    if (fetchError || !filas) {
      setAlertaDetalle({ tipo: 'error', mensaje: 'Error al obtener la lista de asistencia.' })
      setCerrando(false)
      return
    }

    const total = filas.length
    const presentes = filas.filter((f: any) => f.estado === 'presente').length
    const porcentaje = total > 0 ? Math.round((presentes / total) * 10000) / 100 : 0

    // 2. Mark absences susceptible to fine
    const { error: multaError } = await supabase
      .from('asistencia_asambleas')
      .update({ susceptible_multa: true })
      .eq('asamblea_id', selectedAsamblea.id)
      .eq('estado', 'ausente')

    if (multaError) {
      setAlertaDetalle({ tipo: 'error', mensaje: 'Error al marcar inasistencias para multa.' })
      setCerrando(false)
      return
    }

    // 3. Update asamblea record
    const { error: updateError } = await supabase
      .from('asambleas')
      .update({ estado: 'cerrada', porcentaje_participacion: porcentaje })
      .eq('id', selectedAsamblea.id)

    if (updateError) {
      setAlertaDetalle({ tipo: 'error', mensaje: 'Error al cerrar la asamblea.' })
      setCerrando(false)
      return
    }

    // 4. Update local state
    const asambleaActualizada: Asamblea = {
      ...selectedAsamblea,
      estado: 'cerrada',
      porcentaje_participacion: porcentaje,
    }
    setSelectedAsamblea(asambleaActualizada)
    setAsambleas((prev) =>
      prev.map((a) => (a.id === selectedAsamblea.id ? asambleaActualizada : a))
    )

    // 5. Refetch attendance to reflect susceptible_multa changes
    await fetchAsistencias(selectedAsamblea.id)

    setCerrando(false)
    setModalCerrar(false)
    setAlertaDetalle({ tipo: 'exito', mensaje: `Asamblea cerrada. Participación: ${porcentaje}%.` })
  }

  // ── Historial por miembro ────────────────────────────────────────────────

  async function handleMiembroHistorialChange(miembroId: string) {
    setMiembroHistorial(miembroId)
    if (!miembroId || !juntaId) {
      setHistorial([])
      return
    }

    setCargandoHistorial(true)
    const { data, error } = await supabase
      .from('asistencia_asambleas')
      .select(`
        asamblea_id,
        estado,
        asambleas!asamblea_id (fecha)
      `)
      .eq('miembro_id', miembroId)
      .eq('junta_id', juntaId)
      .order('asambleas(fecha)', { ascending: false })
      .limit(5)

    if (!error && data) {
      setHistorial(
        (data as any[]).map((r) => ({
          asamblea_id: r.asamblea_id,
          fecha: r.asambleas?.fecha ?? '',
          estado: r.estado as EstadoAsistencia,
        }))
      )
    }
    setCargandoHistorial(false)
  }

  // ── Columns ──────────────────────────────────────────────────────────────

  const columnasAsambleas: ColumnaTabla<Asamblea>[] = [
    {
      cabecera: 'Fecha',
      accesador: (a) => formatFecha(a.fecha),
    },
    {
      cabecera: 'Hora',
      accesador: (a) => a.hora.substring(0, 5),
    },
    {
      cabecera: 'Lugar',
      accesador: 'lugar',
    },
    {
      cabecera: 'Estado',
      accesador: (a) => <BadgeEstadoAsamblea estado={a.estado} />,
    },
    {
      cabecera: 'Participación',
      accesador: (a) =>
        a.porcentaje_participacion !== null ? `${a.porcentaje_participacion}%` : '—',
    },
  ]

  const columnasAsistencias: ColumnaTabla<AsistenciaRow>[] = [
    { cabecera: 'Cédula', accesador: 'miembro_cedula' },
    { cabecera: 'Nombres', accesador: 'miembro_nombres' },
    { cabecera: 'Apellidos', accesador: 'miembro_apellidos' },
    {
      cabecera: 'Asistencia',
      accesador: (row) => (
        <select
          value={row.estado}
          disabled={selectedAsamblea?.estado === 'cerrada'}
          onChange={(e) => handleEstadoChange(row.id, e.target.value as EstadoAsistencia)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <option value="presente">Presente</option>
          <option value="ausente_justificado">Ausente justificado</option>
          <option value="ausente">Ausente</option>
        </select>
      ),
    },
  ]

  // ── Render ───────────────────────────────────────────────────────────────

  // ── Detail view ──────────────────────────────────────────────────────────
  if (selectedAsamblea) {
    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <Boton variante="fantasma" onClick={() => setSelectedAsamblea(null)}>
            ← Volver
          </Boton>
          <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">
            <h1 className="text-xl font-semibold text-gray-900">
              Asamblea del {formatFecha(selectedAsamblea.fecha)} — {selectedAsamblea.lugar}
            </h1>
            <BadgeEstadoAsamblea estado={selectedAsamblea.estado} />
            {selectedAsamblea.estado === 'cerrada' && selectedAsamblea.porcentaje_participacion !== null && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Participación: {selectedAsamblea.porcentaje_participacion}%
              </span>
            )}
          </div>
          {selectedAsamblea.estado !== 'cerrada' && (
            <Boton variante="peligro" onClick={() => setModalCerrar(true)}>
              Cerrar asamblea
            </Boton>
          )}
        </div>

        {/* Alert */}
        {alertaDetalle && (
          <Alerta
            tipo={alertaDetalle.tipo}
            mensaje={alertaDetalle.mensaje}
            onCerrar={() => setAlertaDetalle(null)}
          />
        )}

        {/* Attendance table */}
        <Tabla
          columnas={columnasAsistencias}
          datos={asistencias}
          cargando={cargandoAsistencias}
          filasPorPagina={20}
        />

        {/* Member history */}
        {asistencias.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Ver historial por miembro</h2>
            <select
              value={miembroHistorial}
              onChange={(e) => handleMiembroHistorialChange(e.target.value)}
              className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">— Seleccionar miembro —</option>
              {[...asistencias]
                .sort((a, b) => a.miembro_apellidos.localeCompare(b.miembro_apellidos))
                .map((a) => (
                  <option key={a.miembro_id} value={a.miembro_id}>
                    {a.miembro_apellidos}, {a.miembro_nombres}
                  </option>
                ))}
            </select>

            {cargandoHistorial && (
              <p className="text-sm text-gray-500">Cargando historial...</p>
            )}

            {!cargandoHistorial && miembroHistorial && historial.length === 0 && (
              <p className="text-sm text-gray-400">Sin registros de asistencia anteriores.</p>
            )}

            {!cargandoHistorial && historial.length > 0 && (
              <ul className="space-y-1">
                {historial.map((h) => (
                  <li key={h.asamblea_id} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-600">{formatFecha(h.fecha)}</span>
                    <BadgeEstadoAsistencia estado={h.estado} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Modal: cerrar asamblea */}
        <Modal
          abierto={modalCerrar}
          onCerrar={() => !cerrando && setModalCerrar(false)}
          titulo="Cerrar asamblea"
          tamaño="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Al cerrar la asamblea se calculará el porcentaje de participación y se marcarán las
              inasistencias para multa.
            </p>
            <div className="flex justify-end gap-3">
              <Boton
                variante="secundario"
                onClick={() => setModalCerrar(false)}
                disabled={cerrando}
              >
                Cancelar
              </Boton>
              <Boton
                variante="peligro"
                onClick={handleCerrarAsamblea}
                cargando={cerrando}
              >
                Cerrar asamblea
              </Boton>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Asambleas</h1>
        <Boton variante="primario" onClick={abrirModalNueva}>
          Nueva asamblea
        </Boton>
      </div>

      {/* Alert */}
      {alertaLista && (
        <Alerta
          tipo={alertaLista.tipo}
          mensaje={alertaLista.mensaje}
          onCerrar={() => setAlertaLista(null)}
        />
      )}

      {/* Table */}
      <Tabla
        columnas={columnasAsambleas}
        datos={asambleas}
        cargando={cargandoLista}
        camposFiltro={['lugar']}
        filasPorPagina={10}
        accionesExtra={(asamblea) => (
          <Boton
            variante="fantasma"
            tamaño="sm"
            onClick={() => setSelectedAsamblea(asamblea)}
          >
            Ver asistencia
          </Boton>
        )}
      />

      {/* Modal: nueva asamblea */}
      <Modal
        abierto={modalNueva}
        onCerrar={() => !guardando && setModalNueva(false)}
        titulo="Nueva asamblea"
        tamaño="lg"
      >
        <div className="space-y-4">
          {errorModal && (
            <Alerta tipo="error" mensaje={errorModal} onCerrar={() => setErrorModal('')} />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={nuevaFecha}
                onChange={(e) => setNuevaFecha(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* Hora */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={nuevaHora}
                onChange={(e) => setNuevaHora(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Lugar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lugar <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nuevaLugar}
              onChange={(e) => setNuevaLugar(e.target.value)}
              placeholder="Ej. Casa Comunal"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Orden del día */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Orden del día <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={nuevaOrden}
              onChange={(e) => setNuevaOrden(e.target.value)}
              placeholder="Describa los puntos a tratar..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Boton
              variante="secundario"
              onClick={() => setModalNueva(false)}
              disabled={guardando}
            >
              Cancelar
            </Boton>
            <Boton
              variante="primario"
              onClick={handleCrearAsamblea}
              cargando={guardando}
            >
              Crear asamblea
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
