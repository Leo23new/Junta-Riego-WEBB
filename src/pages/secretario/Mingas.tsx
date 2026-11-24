import { useState, useEffect, useCallback } from 'react'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { Modal } from '../../components/ui/Modal'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'
import useAuth from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

type EstadoMinga = 'abierta' | 'cerrada'
type EstadoAsistencia = 'presente' | 'ausente_justificado' | 'ausente'

interface Minga {
  id: string
  junta_id: string
  fecha: string
  hora: string
  lugar: string
  actividad: string
  min_participantes: number
  estado: EstadoMinga
  porcentaje_participacion: number | null
  created_at: string
  creado_por: string | null
}

interface AsistenciaRow {
  id: string
  junta_id: string
  minga_id: string
  miembro_id: string
  estado: EstadoAsistencia
  susceptible_multa: boolean
  created_at: string
  miembro_nombres: string
  miembro_apellidos: string
  miembro_cedula: string
}

interface HistorialItem {
  minga_id: string
  fecha: string
  estado: EstadoAsistencia
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFecha(fecha: string): string {
  if (!fecha) return ''
  const [year, month, day] = fecha.split('-')
  return `${day}/${month}/${year}`
}

function BadgeEstadoMinga({ estado }: { estado: EstadoMinga }) {
  const map: Record<EstadoMinga, { label: string; clase: string }> = {
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

export default function Mingas() {
  const { usuario, juntaId } = useAuth()

  // List view state
  const [mingas, setMingas] = useState<Minga[]>([])
  const [cargandoLista, setCargandoLista] = useState(false)
  const [alertaLista, setAlertaLista] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)

  // Modal nueva minga
  const [modalNueva, setModalNueva] = useState(false)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaHora, setNuevaHora] = useState('')
  const [nuevaLugar, setNuevaLugar] = useState('')
  const [nuevaActividad, setNuevaActividad] = useState('')
  const [nuevaMinParticipantes, setNuevaMinParticipantes] = useState('0')
  const [sinMiembrosActivos, setSinMiembrosActivos] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState('')

  // Detail view
  const [selectedMinga, setSelectedMinga] = useState<Minga | null>(null)
  const [asistencias, setAsistencias] = useState<AsistenciaRow[]>([])
  const [cargandoAsistencias, setCargandoAsistencias] = useState(false)
  const [alertaDetalle, setAlertaDetalle] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)

  // Modal cerrar minga
  const [modalCerrar, setModalCerrar] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  // Historial por miembro
  const [miembroHistorial, setMiembroHistorial] = useState('')
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  // ── Fetch mingas ─────────────────────────────────────────────────────────

  const fetchMingas = useCallback(async () => {
    if (!juntaId) return
    setCargandoLista(true)
    const { data, error } = await supabase
      .from('mingas')
      .select('*')
      .eq('junta_id', juntaId)
      .order('fecha', { ascending: false })

    if (error) {
      setAlertaLista({ tipo: 'error', mensaje: 'Error al cargar mingas.' })
    } else {
      setMingas((data ?? []) as Minga[])
    }
    setCargandoLista(false)
  }, [juntaId])

  useEffect(() => {
    fetchMingas()
  }, [fetchMingas])

  // ── Fetch asistencias ────────────────────────────────────────────────────

  const fetchAsistencias = useCallback(async (mingaId: string) => {
    setCargandoAsistencias(true)
    const { data, error } = await supabase
      .from('asistencia_mingas')
      .select(`
        *,
        miembros!miembro_id (nombres, apellidos, cedula)
      `)
      .eq('minga_id', mingaId)
      .order('miembros(apellidos)')

    if (error) {
      setAlertaDetalle({ tipo: 'error', mensaje: 'Error al cargar lista de asistencia.' })
      setCargandoAsistencias(false)
      return
    }

    const rows: AsistenciaRow[] = ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      junta_id: r.junta_id,
      minga_id: r.minga_id,
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
    if (selectedMinga) {
      fetchAsistencias(selectedMinga.id)
      setAlertaDetalle(null)
      setMiembroHistorial('')
      setHistorial([])
    }
  }, [selectedMinga, fetchAsistencias])

  // ── Nueva minga ──────────────────────────────────────────────────────────

  async function abrirModalNueva() {
    setNuevaFecha('')
    setNuevaHora('')
    setNuevaLugar('')
    setNuevaActividad('')
    setNuevaMinParticipantes('0')
    setErrorModal('')
    setSinMiembrosActivos(false)
    setModalNueva(true)

    if (juntaId) {
      const { data, error } = await supabase
        .from('miembros')
        .select('id')
        .eq('junta_id', juntaId)
        .eq('activo', true)
      if (!error && (data ?? []).length === 0) {
        setSinMiembrosActivos(true)
      }
    }
  }

  async function handleCrearMinga() {
    const minParticipantes = Number(nuevaMinParticipantes)
    if (
      !nuevaFecha ||
      !nuevaHora ||
      !nuevaLugar.trim() ||
      !nuevaActividad.trim() ||
      nuevaMinParticipantes === '' ||
      Number.isNaN(minParticipantes) ||
      minParticipantes < 0
    ) {
      setErrorModal('Todos los campos son obligatorios.')
      return
    }
    if (!juntaId) return
    setGuardando(true)
    setErrorModal('')

    // 1. Insert minga
    const { data: mingaData, error: mingaError } = await supabase
      .from('mingas')
      .insert({
        junta_id: juntaId,
        fecha: nuevaFecha,
        hora: nuevaHora,
        lugar: nuevaLugar.trim(),
        actividad: nuevaActividad.trim(),
        min_participantes: minParticipantes,
        estado: 'abierta',
        creado_por: usuario?.id ?? null,
      })
      .select()
      .single()

    if (mingaError || !mingaData) {
      setErrorModal('Error al crear la minga. Intente de nuevo.')
      setGuardando(false)
      return
    }

    const nuevaMingaId = (mingaData as Minga).id

    // 2. Fetch active members
    const { data: miembrosData, error: miembrosError } = await supabase
      .from('miembros')
      .select('id')
      .eq('junta_id', juntaId)
      .eq('activo', true)

    if (miembrosError) {
      setErrorModal('Minga creada, pero hubo un error al obtener los miembros.')
      setGuardando(false)
      setModalNueva(false)
      await fetchMingas()
      return
    }

    const miembros = (miembrosData ?? []) as { id: string }[]

    // 3. Bulk insert attendance rows
    if (miembros.length > 0) {
      const filas = miembros.map((m) => ({
        junta_id: juntaId,
        minga_id: nuevaMingaId,
        miembro_id: m.id,
        estado: 'ausente',
        susceptible_multa: false,
      }))

      const { error: asistenciaError } = await supabase
        .from('asistencia_mingas')
        .insert(filas)

      if (asistenciaError) {
        setErrorModal('Minga creada, pero hubo un error al crear la lista de asistencia.')
        setGuardando(false)
        setModalNueva(false)
        await fetchMingas()
        return
      }
    }

    setGuardando(false)
    setModalNueva(false)
    await fetchMingas()
    setAlertaLista({
      tipo: 'exito',
      mensaje: `Minga creada con lista de asistencia para ${miembros.length} miembros.`,
    })
  }

  // ── Cambio de estado de asistencia ──────────────────────────────────────

  async function handleEstadoChange(asistenciaId: string, nuevoEstado: EstadoAsistencia) {
    // Optimistic update
    setAsistencias((prev) =>
      prev.map((a) => (a.id === asistenciaId ? { ...a, estado: nuevoEstado } : a))
    )

    const { error } = await supabase
      .from('asistencia_mingas')
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

  // ── Cerrar minga ──────────────────────────────────────────────────────────

  async function handleCerrarMinga() {
    if (!selectedMinga) return
    setCerrando(true)

    // 1. Fetch all attendance rows
    const { data: filas, error: fetchError } = await supabase
      .from('asistencia_mingas')
      .select('*')
      .eq('minga_id', selectedMinga.id)

    if (fetchError || !filas) {
      setAlertaDetalle({ tipo: 'error', mensaje: 'Error al obtener la lista de asistencia.' })
      setCerrando(false)
      return
    }

    const total = filas.length
    const presentes = filas.filter((f: any) => f.estado === 'presente').length
    const porcentaje = total > 0 ? Math.round((presentes / total) * 10000) / 100 : 0
    const cumplido = presentes >= selectedMinga.min_participantes

    // 2. Mark absences susceptible to fine
    const { error: multaError } = await supabase
      .from('asistencia_mingas')
      .update({ susceptible_multa: true })
      .eq('minga_id', selectedMinga.id)
      .eq('estado', 'ausente')

    if (multaError) {
      setAlertaDetalle({ tipo: 'error', mensaje: 'Error al marcar inasistencias para multa.' })
      setCerrando(false)
      return
    }

    // 3. Update minga record
    const { error: updateError } = await supabase
      .from('mingas')
      .update({ estado: 'cerrada', porcentaje_participacion: porcentaje })
      .eq('id', selectedMinga.id)

    if (updateError) {
      setAlertaDetalle({ tipo: 'error', mensaje: 'Error al cerrar la minga.' })
      setCerrando(false)
      return
    }

    // 4. Update local state
    const mingaActualizada: Minga = {
      ...selectedMinga,
      estado: 'cerrada',
      porcentaje_participacion: porcentaje,
    }
    setSelectedMinga(mingaActualizada)
    setMingas((prev) =>
      prev.map((m) => (m.id === selectedMinga.id ? mingaActualizada : m))
    )

    // 5. Refetch attendance to reflect susceptible_multa changes
    await fetchAsistencias(selectedMinga.id)

    setCerrando(false)
    setModalCerrar(false)
    setAlertaDetalle({
      tipo: 'exito',
      mensaje: `Minga cerrada. Participación: ${porcentaje}%. Mínimo requerido: ${selectedMinga.min_participantes}/${total} ${cumplido ? 'cumplido' : 'no cumplido'}.`,
    })
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
      .from('asistencia_mingas')
      .select(`
        minga_id,
        estado,
        mingas!minga_id (fecha)
      `)
      .eq('miembro_id', miembroId)
      .eq('junta_id', juntaId)
      .order('mingas(fecha)', { ascending: false })
      .limit(5)

    if (!error && data) {
      setHistorial(
        (data as any[]).map((r) => ({
          minga_id: r.minga_id,
          fecha: r.mingas?.fecha ?? '',
          estado: r.estado as EstadoAsistencia,
        }))
      )
    }
    setCargandoHistorial(false)
  }

  // ── Columns ──────────────────────────────────────────────────────────────

  const columnasMingas: ColumnaTabla<Minga>[] = [
    {
      cabecera: 'Fecha',
      accesador: (m) => formatFecha(m.fecha),
    },
    {
      cabecera: 'Hora',
      accesador: (m) => m.hora.substring(0, 5),
    },
    {
      cabecera: 'Lugar',
      accesador: 'lugar',
    },
    {
      cabecera: 'Actividad',
      accesador: 'actividad',
    },
    {
      cabecera: 'Estado',
      accesador: (m) => <BadgeEstadoMinga estado={m.estado} />,
    },
    {
      cabecera: 'Participación',
      accesador: (m) =>
        m.porcentaje_participacion !== null ? `${m.porcentaje_participacion}%` : '—',
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
          disabled={selectedMinga?.estado === 'cerrada'}
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
  if (selectedMinga) {
    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <Boton variante="fantasma" onClick={() => setSelectedMinga(null)}>
            ← Volver
          </Boton>
          <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">
            <h1 className="text-xl font-semibold text-gray-900">
              Minga del {formatFecha(selectedMinga.fecha)} — {selectedMinga.actividad}
            </h1>
            <BadgeEstadoMinga estado={selectedMinga.estado} />
            {selectedMinga.estado === 'cerrada' && selectedMinga.porcentaje_participacion !== null && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Participación: {selectedMinga.porcentaje_participacion}%
              </span>
            )}
          </div>
          {selectedMinga.estado !== 'cerrada' && (
            <Boton variante="peligro" onClick={() => setModalCerrar(true)}>
              Cerrar minga
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
                  <li key={h.minga_id} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-600">{formatFecha(h.fecha)}</span>
                    <BadgeEstadoAsistencia estado={h.estado} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Modal: cerrar minga */}
        <Modal
          abierto={modalCerrar}
          onCerrar={() => !cerrando && setModalCerrar(false)}
          titulo="Cerrar minga"
          tamaño="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Al cerrar la minga se calculará el porcentaje de participación y se marcarán las
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
                onClick={handleCerrarMinga}
                cargando={cerrando}
              >
                Cerrar minga
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
        <h1 className="text-2xl font-semibold text-gray-900">Mingas</h1>
        <Boton variante="primario" onClick={abrirModalNueva}>
          Nueva minga
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
        columnas={columnasMingas}
        datos={mingas}
        cargando={cargandoLista}
        camposFiltro={['lugar', 'actividad']}
        filasPorPagina={10}
        accionesExtra={(minga) => (
          <Boton
            variante="fantasma"
            tamaño="sm"
            onClick={() => setSelectedMinga(minga)}
          >
            Ver asistencia
          </Boton>
        )}
      />

      {/* Modal: nueva minga */}
      <Modal
        abierto={modalNueva}
        onCerrar={() => !guardando && setModalNueva(false)}
        titulo="Nueva minga"
        tamaño="lg"
      >
        <div className="space-y-4">
          {errorModal && (
            <Alerta tipo="error" mensaje={errorModal} onCerrar={() => setErrorModal('')} />
          )}

          {sinMiembrosActivos && (
            <Alerta
              tipo="advertencia"
              mensaje="No hay miembros activos; la lista de asistencia quedará vacía."
            />
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
              placeholder="Ej. Canal principal"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Actividad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Actividad <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nuevaActividad}
              onChange={(e) => setNuevaActividad(e.target.value)}
              placeholder="Ej. Limpieza de canal"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Mínimo de participantes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mínimo de participantes <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              value={nuevaMinParticipantes}
              onChange={(e) => setNuevaMinParticipantes(e.target.value)}
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
              onClick={handleCrearMinga}
              cargando={guardando}
            >
              Crear minga
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
