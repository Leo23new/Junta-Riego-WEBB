import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import useAuth from '../../hooks/useAuth'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'

interface PerfilResumen {
  id: string
  nombre_completo: string
  rol: string
}

interface Mensaje {
  id: string
  junta_id: string
  remitente_id: string
  destinatario_id: string
  asunto: string
  cuerpo: string
  leido: boolean
  created_at: string
  remitente_nombre: string
  destinatario_nombre: string
}

type TabActiva = 'recibidos' | 'enviados'
type VistaDerechaType = 'detalle' | 'redactar' | 'vacio'

function formatFecha(iso: string): string {
  const d = new Date(iso)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const anio = d.getFullYear()
  return `${dia}/${mes}/${anio}`
}

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

export default function Mensajes() {
  const { usuario, perfil, juntaId, rol } = useAuth()

  const [tab, setTab] = useState<TabActiva>('recibidos')
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [cargandoLista, setCargandoLista] = useState(false)
  const [errorLista, setErrorLista] = useState<string | null>(null)

  const [seleccionado, setSeleccionado] = useState<Mensaje | null>(null)
  const [vistaDerecha, setVistaDerecha] = useState<VistaDerechaType>('vacio')

  // Destinatarios disponibles
  const [destinatariosDisponibles, setDestinatariosDisponibles] = useState<PerfilResumen[]>([])

  // Formulario de redacción
  const [destinatariosSeleccionados, setDestinatariosSeleccionados] = useState<string[]>([])
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [exitoEnvio, setExitoEnvio] = useState<string | null>(null)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  // ── Cargar destinatarios disponibles ────────────────────────────────────────
  useEffect(() => {
    if (!juntaId || !usuario) return
    supabase
      .from('perfiles')
      .select('id, nombre_completo, rol')
      .eq('junta_id', juntaId)
      .eq('activo', true)
      .neq('id', usuario.id)
      .then(({ data }) => {
        setDestinatariosDisponibles((data as PerfilResumen[]) ?? [])
      })
  }, [juntaId, usuario])

  // ── Cargar mensajes ─────────────────────────────────────────────────────────
  async function cargarMensajes() {
    if (!usuario || !juntaId) return
    setCargandoLista(true)
    setErrorLista(null)

    try {
      // Obtener mensajes propios
      const filtro =
        tab === 'recibidos'
          ? supabase
              .from('mensajes')
              .select('*')
              .eq('destinatario_id', usuario.id)
              .eq('junta_id', juntaId)
              .order('created_at', { ascending: false })
          : supabase
              .from('mensajes')
              .select('*')
              .eq('remitente_id', usuario.id)
              .eq('junta_id', juntaId)
              .order('created_at', { ascending: false })

      const { data: rawMensajes, error } = await filtro
      if (error) throw error

      const rows = (rawMensajes ?? []) as Omit<Mensaje, 'remitente_nombre' | 'destinatario_nombre'>[]

      // Recopilar ids únicos para lookup de nombres
      const idsUnicos = Array.from(
        new Set(rows.flatMap((m) => [m.remitente_id, m.destinatario_id]))
      )

      let perfilesMap: Record<string, string> = {}
      if (idsUnicos.length > 0) {
        const { data: perfilesData } = await supabase
          .from('perfiles')
          .select('id, nombre_completo')
          .in('id', idsUnicos)
        ;(perfilesData ?? []).forEach((p: { id: string; nombre_completo: string }) => {
          perfilesMap[p.id] = p.nombre_completo
        })
      }

      const mensajesConNombres: Mensaje[] = rows.map((m) => ({
        ...m,
        remitente_nombre: perfilesMap[m.remitente_id] ?? 'Desconocido',
        destinatario_nombre: perfilesMap[m.destinatario_id] ?? 'Desconocido',
      }))

      setMensajes(mensajesConNombres)
    } catch (err: unknown) {
      setErrorLista(err instanceof Error ? err.message : 'Error al cargar mensajes')
    } finally {
      setCargandoLista(false)
    }
  }

  useEffect(() => {
    cargarMensajes()
    // Limpiar selección al cambiar tab
    setSeleccionado(null)
    setVistaDerecha('vacio')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, usuario, juntaId])

  // ── Seleccionar mensaje y marcar como leído ──────────────────────────────────
  async function seleccionarMensaje(msg: Mensaje) {
    setSeleccionado(msg)
    setVistaDerecha('detalle')
    setExitoEnvio(null)
    setErrorEnvio(null)

    if (!msg.leido && tab === 'recibidos') {
      await supabase.from('mensajes').update({ leido: true }).eq('id', msg.id)
      setMensajes((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, leido: true } : m))
      )
      setSeleccionado({ ...msg, leido: true })
    }
  }

  // ── Responder ────────────────────────────────────────────────────────────────
  function responder(msg: Mensaje) {
    setDestinatariosSeleccionados([msg.remitente_id])
    setAsunto(`Re: ${msg.asunto}`)
    setCuerpo('')
    setExitoEnvio(null)
    setErrorEnvio(null)
    setVistaDerecha('redactar')
  }

  // ── Redactar nuevo ───────────────────────────────────────────────────────────
  function redactar() {
    setDestinatariosSeleccionados([])
    setAsunto('')
    setCuerpo('')
    setExitoEnvio(null)
    setErrorEnvio(null)
    setSeleccionado(null)
    setVistaDerecha('redactar')
  }

  // ── Enviar mensaje ───────────────────────────────────────────────────────────
  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault()
    if (!usuario || !juntaId || !perfil) return
    if (destinatariosSeleccionados.length === 0) {
      setErrorEnvio('Selecciona al menos un destinatario.')
      return
    }
    if (!asunto.trim() || !cuerpo.trim()) {
      setErrorEnvio('El asunto y el cuerpo son obligatorios.')
      return
    }

    setEnviando(true)
    setErrorEnvio(null)
    setExitoEnvio(null)

    try {
      for (const destinatarioId of destinatariosSeleccionados) {
        // Insertar mensaje
        const { data: nuevoMensaje, error: errMsg } = await supabase
          .from('mensajes')
          .insert({
            junta_id: juntaId,
            remitente_id: usuario.id,
            destinatario_id: destinatarioId,
            asunto: asunto.trim(),
            cuerpo: cuerpo.trim(),
          })
          .select('id')
          .single()

        if (errMsg) throw errMsg

        // Insertar notificación
        await supabase.from('notificaciones').insert({
          junta_id: juntaId,
          usuario_id: destinatarioId,
          tipo: 'mensaje',
          referencia_id: nuevoMensaje.id,
          referencia_tipo: 'mensaje',
          mensaje: `Nuevo mensaje de ${perfil.nombre_completo}: "${asunto.trim()}"`,
          leida: false,
        })
      }

      setExitoEnvio(
        `Mensaje enviado a ${destinatariosSeleccionados.length} destinatario(s).`
      )
      setDestinatariosSeleccionados([])
      setAsunto('')
      setCuerpo('')
      setVistaDerecha('vacio')
      await cargarMensajes()
    } catch (err: unknown) {
      setErrorEnvio(err instanceof Error ? err.message : 'Error al enviar el mensaje')
    } finally {
      setEnviando(false)
    }
  }

  // ── Toggle destinatario (admin) ──────────────────────────────────────────────
  function toggleDestinatario(id: string) {
    setDestinatariosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  function seleccionarTodos() {
    if (destinatariosSeleccionados.length === destinatariosDisponibles.length) {
      setDestinatariosSeleccionados([])
    } else {
      setDestinatariosSeleccionados(destinatariosDisponibles.map((p) => p.id))
    }
  }

  const esAdmin = rol === 'admin' || rol === 'super_admin'

  return (
    <div className="p-6 space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mensajes</h1>
        <Boton variante="primario" onClick={redactar}>
          ✉ Redactar
        </Boton>
      </div>

      {/* Aviso de envío exitoso (fuera del panel derecho) */}
      {exitoEnvio && vistaDerecha === 'vacio' && (
        <Alerta tipo="exito" mensaje={exitoEnvio} />
      )}

      <div className="flex gap-6 min-h-[500px]">
        {/* ── Columna izquierda ──────────────────────────────────────────────── */}
        <div className="w-1/3 min-w-0 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-3">
            <button
              type="button"
              onClick={() => setTab('recibidos')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'recibidos'
                  ? 'border-b-2 border-green-600 text-green-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Recibidos
            </button>
            <button
              type="button"
              onClick={() => setTab('enviados')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'enviados'
                  ? 'border-b-2 border-green-600 text-green-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Enviados
            </button>
          </div>

          {/* Lista */}
          {cargandoLista ? (
            <p className="text-sm text-gray-400 p-2">Cargando…</p>
          ) : errorLista ? (
            <Alerta tipo="error" mensaje={errorLista} />
          ) : mensajes.length === 0 ? (
            <p className="text-sm text-gray-400 p-2">Sin mensajes.</p>
          ) : (
            <ul className="divide-y divide-gray-100 overflow-y-auto flex-1 border border-gray-200 rounded-md">
              {mensajes.map((msg) => {
                const noLeido = !msg.leido && tab === 'recibidos'
                const activo = seleccionado?.id === msg.id
                return (
                  <li key={msg.id}>
                    <button
                      type="button"
                      onClick={() => seleccionarMensaje(msg)}
                      className={[
                        'w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors',
                        activo ? 'bg-green-50' : '',
                        noLeido ? 'border-l-4 border-blue-500' : 'border-l-4 border-transparent',
                      ].join(' ')}
                    >
                      <p
                        className={`text-sm truncate ${
                          noLeido ? 'font-semibold text-gray-900' : 'text-gray-700'
                        }`}
                      >
                        {tab === 'recibidos' ? msg.remitente_nombre : msg.destinatario_nombre}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{msg.asunto}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatFecha(msg.created_at)}</p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* ── Columna derecha ────────────────────────────────────────────────── */}
        <div className="flex-1 border border-gray-200 rounded-md p-4 overflow-y-auto">
          {/* Estado vacío */}
          {vistaDerecha === 'vacio' && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              {exitoEnvio ? (
                <p className="text-green-600 font-medium text-sm">{exitoEnvio}</p>
              ) : (
                <>
                  <span className="text-4xl mb-2">✉</span>
                  <p className="text-sm">Selecciona un mensaje o redacta uno nuevo.</p>
                </>
              )}
            </div>
          )}

          {/* Detalle del mensaje */}
          {vistaDerecha === 'detalle' && seleccionado && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{seleccionado.asunto}</h2>
                <dl className="mt-2 space-y-1 text-sm text-gray-600">
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-700 w-10">De:</dt>
                    <dd>{seleccionado.remitente_nombre}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-700 w-10">Para:</dt>
                    <dd>{seleccionado.destinatario_nombre}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-700 w-10">Fecha:</dt>
                    <dd>{formatFecha(seleccionado.created_at)}</dd>
                  </div>
                </dl>
              </div>
              <hr className="border-gray-200" />
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{seleccionado.cuerpo}</p>
              {tab === 'recibidos' && (
                <div className="pt-2">
                  <Boton variante="secundario" tamaño="sm" onClick={() => responder(seleccionado)}>
                    Responder
                  </Boton>
                </div>
              )}
            </div>
          )}

          {/* Formulario de redacción */}
          {vistaDerecha === 'redactar' && (
            <form onSubmit={handleEnviar} className="space-y-4">
              <h2 className="text-base font-semibold text-gray-800">Nuevo mensaje</h2>

              {errorEnvio && <Alerta tipo="error" mensaje={errorEnvio} />}

              {/* Destinatarios */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destinatario(s)
                </label>

                {esAdmin ? (
                  /* Admin: checkboxes + seleccionar todos */
                  <div className="border border-gray-300 rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                      <input
                        type="checkbox"
                        checked={
                          destinatariosSeleccionados.length === destinatariosDisponibles.length &&
                          destinatariosDisponibles.length > 0
                        }
                        onChange={seleccionarTodos}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="font-medium">Seleccionar todos</span>
                    </label>
                    <hr className="border-gray-200" />
                    {destinatariosDisponibles.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={destinatariosSeleccionados.includes(p.id)}
                          onChange={() => toggleDestinatario(p.id)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        {p.nombre_completo}
                        <span className="text-xs text-gray-400 ml-auto">{p.rol}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  /* Otros roles: select simple */
                  <select
                    value={destinatariosSeleccionados[0] ?? ''}
                    onChange={(e) =>
                      setDestinatariosSeleccionados(e.target.value ? [e.target.value] : [])
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="">Selecciona un destinatario…</option>
                    {destinatariosDisponibles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre_completo}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Asunto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
                <input
                  type="text"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  required
                  className={INPUT_CLASS}
                  placeholder="Asunto del mensaje"
                />
              </div>

              {/* Cuerpo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
                <textarea
                  value={cuerpo}
                  onChange={(e) => setCuerpo(e.target.value)}
                  required
                  rows={6}
                  className={INPUT_CLASS}
                  placeholder="Escribe tu mensaje aquí…"
                />
              </div>

              <div className="flex gap-2">
                <Boton type="submit" variante="primario" cargando={enviando}>
                  Enviar
                </Boton>
                <Boton
                  type="button"
                  variante="secundario"
                  onClick={() => setVistaDerecha('vacio')}
                  disabled={enviando}
                >
                  Cancelar
                </Boton>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
