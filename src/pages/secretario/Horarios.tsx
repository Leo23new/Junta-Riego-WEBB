import { useState, useEffect, useCallback, useMemo } from 'react'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { Modal } from '../../components/ui/Modal'
import useAuth from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Horario {
  id: string
  junta_id: string
  miembro_id: string
  servicio: string
  dia_semana: number // 1-7
  hora_inicio: string // 'HH:MM:SS'
  hora_fin: string
  created_at: string
  updated_at: string
  miembro_nombres: string
  miembro_apellidos: string
}

interface Miembro {
  id: string
  nombres: string
  apellidos: string
  cedula: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] // índice = dia_semana - 1

const HORA_INICIO_JORNADA = 6 // 06:00
const HORA_FIN_JORNADA = 20 // 20:00
const FILAS_MEDIA_HORA = (HORA_FIN_JORNADA - HORA_INICIO_JORNADA) * 2 // 28
const ALTO_FILA_PX = 24
const ALTO_COLUMNA_PX = FILAS_MEDIA_HORA * ALTO_FILA_PX // 672

const PALETAS = [
  'bg-green-200 text-green-900 border-green-400',
  'bg-blue-200 text-blue-900 border-blue-400',
  'bg-purple-200 text-purple-900 border-purple-400',
  'bg-yellow-200 text-yellow-900 border-yellow-400',
  'bg-pink-200 text-pink-900 border-pink-400',
]

const INPUT_CLASE =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

function colorServicio(servicio: string) {
  let h = 0
  for (const c of servicio) h = (h * 31 + c.charCodeAt(0)) % 997
  return PALETAS[h % PALETAS.length]
}

/** Convierte 'HH:MM' o 'HH:MM:SS' a minutos desde medianoche. */
function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

/** Formatea minutos como 'HH:MM'. */
function desdeMinutos(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Horarios() {
  const { juntaId } = useAuth()

  const [horarios, setHorarios] = useState<Horario[]>([])
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [cargando, setCargando] = useState(false)
  const [alerta, setAlerta] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)

  // Form state (create + edit share the same modal)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<Horario | null>(null)
  const [fMiembro, setFMiembro] = useState('')
  const [fServicio, setFServicio] = useState('')
  const [fDia, setFDia] = useState('1')
  const [fHoraInicio, setFHoraInicio] = useState('')
  const [fHoraFin, setFHoraFin] = useState('')
  const [errorModal, setErrorModal] = useState('')
  const [conflicto, setConflicto] = useState<Horario | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  // Auto-dismiss page alert after 4 s
  useEffect(() => {
    if (!alerta) return
    const t = setTimeout(() => setAlerta(null), 4000)
    return () => clearTimeout(t)
  }, [alerta])

  // ── Fetch data ──────────────────────────────────────────────────────────

  const fetchDatos = useCallback(async () => {
    if (!juntaId) return
    setCargando(true)

    const [{ data: horariosData, error: horariosError }, { data: miembrosData, error: miembrosError }] =
      await Promise.all([
        supabase
          .from('horarios')
          .select('*, miembros!miembro_id (nombres, apellidos)')
          .eq('junta_id', juntaId),
        supabase
          .from('miembros')
          .select('id, nombres, apellidos, cedula')
          .eq('junta_id', juntaId)
          .eq('activo', true)
          .order('apellidos'),
      ])

    if (horariosError) {
      setAlerta({ tipo: 'error', mensaje: 'Error al cargar los horarios.' })
    } else {
      setHorarios(
        ((horariosData ?? []) as any[]).map((r) => ({
          ...r,
          miembro_nombres: r.miembros?.nombres ?? '',
          miembro_apellidos: r.miembros?.apellidos ?? '',
        })) as Horario[]
      )
    }

    if (!miembrosError) setMiembros((miembrosData ?? []) as Miembro[])
    setCargando(false)
  }, [juntaId])

  useEffect(() => {
    fetchDatos()
  }, [fetchDatos])

  // ── Modal helpers ────────────────────────────────────────────────────────

  function abrirCrear(dia?: number) {
    setEditando(null)
    setFMiembro('')
    setFServicio('')
    setFDia(String(dia ?? 1))
    setFHoraInicio('')
    setFHoraFin('')
    setErrorModal('')
    setConflicto(null)
    setEliminando(false)
    setModalAbierto(true)
  }

  function abrirEditar(h: Horario) {
    setEditando(h)
    setFMiembro(h.miembro_id)
    setFServicio(h.servicio)
    setFDia(String(h.dia_semana))
    setFHoraInicio(h.hora_inicio.substring(0, 5))
    setFHoraFin(h.hora_fin.substring(0, 5))
    setErrorModal('')
    setConflicto(null)
    setEliminando(false)
    setModalAbierto(true)
  }

  // ── Overlap conflict handling ────────────────────────────────────────────

  async function buscarConflicto(excluirId: string | null): Promise<Horario | null> {
    if (!juntaId) return null
    let query = supabase
      .from('horarios')
      .select('*, miembros!miembro_id (nombres, apellidos)')
      .eq('junta_id', juntaId)
      .eq('servicio', fServicio.trim())
      .eq('dia_semana', Number(fDia))
    if (excluirId) query = query.neq('id', excluirId)

    const { data, error } = await query
    if (error || !data) return null

    const nuevoIni = aMinutos(fHoraInicio)
    const nuevoFin = aMinutos(fHoraFin)

    const fila = ((data ?? []) as any[]).find((r) => {
      const ini = aMinutos(r.hora_inicio)
      const fin = aMinutos(r.hora_fin)
      return nuevoIni < fin && ini < nuevoFin
    })
    if (!fila) return null
    return {
      ...fila,
      miembro_nombres: fila.miembros?.nombres ?? '',
      miembro_apellidos: fila.miembros?.apellidos ?? '',
    } as Horario
  }

  // ── Submit (create / edit) ────────────────────────────────────────────────

  async function handleGuardar() {
    setErrorModal('')
    setConflicto(null)

    // 1. Client-side validation
    if (!fMiembro || !fServicio.trim() || !fDia || !fHoraInicio || !fHoraFin) {
      setErrorModal('Todos los campos son obligatorios.')
      return
    }
    if (aMinutos(fHoraFin) <= aMinutos(fHoraInicio)) {
      setErrorModal('La hora de fin debe ser posterior a la hora de inicio.')
      return
    }
    if (!juntaId) return

    setGuardando(true)

    // 2. RPC overlap check
    const { data: solapa, error: rpcError } = await supabase.rpc('hay_solapamiento_horario', {
      p_junta_id: juntaId,
      p_servicio: fServicio.trim(),
      p_dia_semana: Number(fDia),
      p_hora_inicio: fHoraInicio,
      p_hora_fin: fHoraFin,
      p_excluir_id: editando?.id ?? null,
    })

    if (rpcError) {
      setErrorModal('Error al verificar solapamiento. Intente de nuevo.')
      setGuardando(false)
      return
    }

    if (solapa === true) {
      const bloque = await buscarConflicto(editando?.id ?? null)
      if (bloque) {
        setConflicto(bloque)
        setErrorModal(
          `Ya existe un bloque en colisión: "${bloque.servicio}" de ${bloque.hora_inicio.substring(0, 5)} a ${bloque.hora_fin.substring(0, 5)} (${bloque.miembro_apellidos}).`
        )
      } else {
        setErrorModal('Ya existe un bloque en colisión con este servicio y día.')
      }
      setGuardando(false)
      return
    }

    // 3. Insert or update
    if (editando) {
      const { error } = await supabase
        .from('horarios')
        .update({
          miembro_id: fMiembro,
          servicio: fServicio.trim(),
          dia_semana: Number(fDia),
          hora_inicio: fHoraInicio,
          hora_fin: fHoraFin,
        })
        .eq('id', editando.id)

      setGuardando(false)
      if (error) {
        setErrorModal('Error al actualizar el bloque. Intente de nuevo.')
        return
      }
      setModalAbierto(false)
      await fetchDatos()
      setAlerta({ tipo: 'exito', mensaje: 'Bloque actualizado.' })
    } else {
      const { error } = await supabase.from('horarios').insert({
        junta_id: juntaId,
        miembro_id: fMiembro,
        servicio: fServicio.trim(),
        dia_semana: Number(fDia),
        hora_inicio: fHoraInicio,
        hora_fin: fHoraFin,
      })

      setGuardando(false)
      if (error) {
        setErrorModal('Error al crear el bloque. Intente de nuevo.')
        return
      }
      setModalAbierto(false)
      await fetchDatos()
      setAlerta({ tipo: 'exito', mensaje: 'Bloque creado.' })
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  async function handleEliminar() {
    if (!editando) return
    setGuardando(true)
    const { error } = await supabase.from('horarios').delete().eq('id', editando.id)
    setGuardando(false)
    if (error) {
      setErrorModal('Error al eliminar el bloque. Intente de nuevo.')
      return
    }
    setModalAbierto(false)
    await fetchDatos()
    setAlerta({ tipo: 'exito', mensaje: 'Bloque eliminado.' })
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const hoy = new Date().getDay() // 0=Dom ... 6=Sáb
  const diaHoy = hoy === 0 ? 7 : hoy

  const serviciosUnicos = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const h of horarios) if (!mapa.has(h.servicio)) mapa.set(h.servicio, colorServicio(h.servicio))
    return Array.from(mapa.entries())
  }, [horarios])

  const horariosPorDia = useMemo(() => {
    const mapa = new Map<number, Horario[]>()
    for (let d = 1; d <= 7; d++) mapa.set(d, [])
    for (const h of horarios) mapa.get(h.dia_semana)?.push(h)
    return mapa
  }, [horarios])

  const etiquetasHora = useMemo(() => {
    const lista: string[] = []
    for (let i = 0; i <= FILAS_MEDIA_HORA; i++) {
      lista.push(desdeMinutos((HORA_INICIO_JORNADA * 60) + i * 30))
    }
    return lista
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Horarios</h1>
        <Boton variante="primario" onClick={() => abrirCrear()}>
          Nuevo bloque
        </Boton>
      </div>

      {/* Alert */}
      {alerta && (
        <Alerta tipo={alerta.tipo} mensaje={alerta.mensaje} onCerrar={() => setAlerta(null)} />
      )}

      {cargando && <p className="text-sm text-gray-500">Cargando horarios...</p>}

      {/* Weekly grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px] rounded-lg border border-gray-200 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[4rem_repeat(7,1fr)] border-b border-gray-200 bg-gray-50">
            <div className="h-10" />
            {DIAS.map((dia, i) => (
              <div
                key={dia}
                className={`h-10 flex items-center justify-center text-sm font-medium text-gray-700 border-l border-gray-200 ${
                  diaHoy === i + 1 ? 'bg-green-50' : ''
                }`}
              >
                {dia}
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="grid grid-cols-[4rem_repeat(7,1fr)]">
            {/* Time labels */}
            <div className="relative w-16" style={{ height: `${ALTO_COLUMNA_PX}px` }}>
              {etiquetasHora.slice(0, FILAS_MEDIA_HORA).map((et, i) => (
                <div
                  key={et}
                  className="absolute left-0 w-full pr-1 text-right text-[10px] text-gray-400"
                  style={{ top: `${i * ALTO_FILA_PX}px`, height: `${ALTO_FILA_PX}px` }}
                >
                  {et}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {DIAS.map((dia, i) => {
              const diaSemana = i + 1
              return (
                <div
                  key={dia}
                  className="relative border-l border-gray-200 cursor-pointer hover:bg-green-50/40"
                  style={{
                    height: `${ALTO_COLUMNA_PX}px`,
                    backgroundImage:
                      'repeating-linear-gradient(to bottom, transparent 0, transparent 23px, #f3f4f6 23px, #f3f4f6 24px)',
                  }}
                  onClick={() => abrirCrear(diaSemana)}
                >
                  {(horariosPorDia.get(diaSemana) ?? []).map((h) => {
                    const startMin = aMinutos(h.hora_inicio)
                    const durMin = aMinutos(h.hora_fin) - startMin
                    const top = ((startMin - HORA_INICIO_JORNADA * 60) / 30) * ALTO_FILA_PX
                    const height = (durMin / 30) * ALTO_FILA_PX
                    return (
                      <div
                        key={h.id}
                        className={`absolute left-1 right-1 rounded px-1.5 py-0.5 text-xs overflow-hidden cursor-pointer border ${colorServicio(h.servicio)}`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        onClick={(e) => {
                          e.stopPropagation()
                          abrirEditar(h)
                        }}
                      >
                        <div className="font-semibold truncate">{h.servicio}</div>
                        <div className="text-[10px] opacity-80 truncate">{h.miembro_apellidos}</div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      {serviciosUnicos.length > 0 && (
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Servicios:</span>
          {serviciosUnicos.map(([servicio, clase]) => (
            <span key={servicio} className="inline-flex items-center gap-1.5 text-sm text-gray-600">
              <span className={`h-3 w-3 rounded-sm border ${clase}`} />
              {servicio}
            </span>
          ))}
        </div>
      )}

      {/* Modal: crear / editar */}
      <Modal
        abierto={modalAbierto}
        onCerrar={() => !guardando && setModalAbierto(false)}
        titulo={editando ? 'Editar bloque horario' : 'Nuevo bloque horario'}
        tamaño="md"
      >
        <div className="space-y-4">
          {errorModal && (
            <Alerta tipo="error" mensaje={errorModal} onCerrar={() => setErrorModal('')} />
          )}
          {conflicto && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">Bloque en colisión</p>
              <p className="mt-1">
                «{conflicto.servicio}» — {DIAS[conflicto.dia_semana - 1]}, de{' '}
                {conflicto.hora_inicio.substring(0, 5)} a {conflicto.hora_fin.substring(0, 5)} (
                {conflicto.miembro_apellidos})
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Miembro */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Miembro <span className="text-red-500">*</span>
              </label>
              <select
                value={fMiembro}
                onChange={(e) => setFMiembro(e.target.value)}
                className={INPUT_CLASE}
              >
                <option value="">— Seleccionar miembro —</option>
                {miembros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.apellidos}, {m.nombres} — {m.cedula}
                  </option>
                ))}
              </select>
            </div>

            {/* Servicio */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Servicio <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fServicio}
                onChange={(e) => setFServicio(e.target.value)}
                placeholder="Ej. Riego Lateral 3"
                className={INPUT_CLASE}
              />
            </div>

            {/* Día */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Día <span className="text-red-500">*</span>
              </label>
              <select
                value={fDia}
                onChange={(e) => setFDia(e.target.value)}
                className={INPUT_CLASE}
              >
                {DIAS.map((dia, i) => (
                  <option key={dia} value={i + 1}>
                    {dia}
                  </option>
                ))}
              </select>
            </div>

            {/* Hora inicio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora inicio <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={fHoraInicio}
                onChange={(e) => setFHoraInicio(e.target.value)}
                className={INPUT_CLASE}
              />
            </div>

            {/* Hora fin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora fin <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={fHoraFin}
                onChange={(e) => setFHoraFin(e.target.value)}
                className={INPUT_CLASE}
              />
            </div>
          </div>

          {/* Footer */}
          {!eliminando ? (
            <div className="flex items-center justify-between pt-2">
              {editando ? (
                <Boton variante="peligro" onClick={() => setEliminando(true)} disabled={guardando}>
                  Eliminar
                </Boton>
              ) : (
                <span />
              )}
              <div className="flex justify-end gap-3">
                <Boton
                  variante="secundario"
                  onClick={() => setModalAbierto(false)}
                  disabled={guardando}
                >
                  Cancelar
                </Boton>
                <Boton variante="primario" onClick={handleGuardar} cargando={guardando}>
                  {editando ? 'Guardar cambios' : 'Crear bloque'}
                </Boton>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-red-700">¿Eliminar este bloque?</span>
              <div className="flex justify-end gap-3">
                <Boton variante="secundario" onClick={() => setEliminando(false)} disabled={guardando}>
                  Cancelar
                </Boton>
                <Boton variante="peligro" onClick={handleEliminar} cargando={guardando}>
                  Confirmar
                </Boton>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
