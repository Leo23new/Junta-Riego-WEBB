import { useState, useEffect, useCallback, useRef } from 'react'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { Modal } from '../../components/ui/Modal'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'
import { SubidaArchivo } from '../../components/ui/SubidaArchivo'
import useAuth from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

type TipoConvocatoria = 'asamblea' | 'minga'
type EstadoConvocatoria = 'vigente' | 'finalizada'

interface Convocatoria {
  id: string
  junta_id: string
  tipo: TipoConvocatoria
  titulo: string
  fecha: string
  hora: string | null
  lugar: string | null
  orden_del_dia: string | null
  plazo_confirmacion: string | null
  documento_path: string | null
  estado: EstadoConvocatoria
  created_at: string
  creado_por: string | null
}

const INPUT_CLASE =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatearFecha(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  if (!y || !m || !d) return iso ?? ''
  return `${d}/${m}/${y}`
}

function BadgeTipo({ tipo }: { tipo: TipoConvocatoria }) {
  const config =
    tipo === 'asamblea'
      ? { clase: 'bg-blue-100 text-blue-800', etiqueta: 'Asamblea' }
      : { clase: 'bg-green-100 text-green-800', etiqueta: 'Minga' }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.clase}`}
    >
      {config.etiqueta}
    </span>
  )
}

function BadgeEstado({ estado }: { estado: EstadoConvocatoria }) {
  const config =
    estado === 'vigente'
      ? { clase: 'bg-green-100 text-green-800', etiqueta: 'Vigente' }
      : { clase: 'bg-gray-100 text-gray-700', etiqueta: 'Finalizada' }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.clase}`}
    >
      {config.etiqueta}
    </span>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ConvocatoriasSecretario() {
  const { usuario, juntaId } = useAuth()

  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([])
  const [cargandoLista, setCargandoLista] = useState(false)
  const [alertaLista, setAlertaLista] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)

  // Modal nueva convocatoria
  const [modalNueva, setModalNueva] = useState(false)
  const [nuevoTipo, setNuevoTipo] = useState<TipoConvocatoria>('asamblea')
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaHora, setNuevaHora] = useState('')
  const [nuevoLugar, setNuevoLugar] = useState('')
  const [nuevoOrdenDelDia, setNuevoOrdenDelDia] = useState('')
  const [nuevoPlazo, setNuevoPlazo] = useState('')
  const [archivoDocumento, setArchivoDocumento] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState('')

  // Modal finalizar
  const [convocatoriaAFinalizar, setConvocatoriaAFinalizar] = useState<Convocatoria | null>(null)
  const [finalizando, setFinalizando] = useState(false)

  const autoFinalizadas = useRef(false)

  // ── Auto-dismiss de la alerta de página (4 s) ────────────────────────────

  useEffect(() => {
    if (!alertaLista) return
    const t = setTimeout(() => setAlertaLista(null), 4000)
    return () => clearTimeout(t)
  }, [alertaLista])

  // ── Fetch + auto-finalizar (RF-25.5) ─────────────────────────────────────

  const fetchConvocatorias = useCallback(async () => {
    if (!juntaId) return
    setCargandoLista(true)
    const { data, error } = await supabase
      .from('convocatorias')
      .select('*')
      .eq('junta_id', juntaId)
      .order('fecha', { ascending: false })

    if (error) {
      setAlertaLista({ tipo: 'error', mensaje: 'Error al cargar convocatorias.' })
      setCargandoLista(false)
      return
    }

    let filas = (data ?? []) as Convocatoria[]

    // RF-25.5: finalizar automáticamente las vencidas (una vez por carga)
    if (!autoFinalizadas.current) {
      const hoy = new Date().toISOString().slice(0, 10)
      const vencidas = filas.filter((c) => c.estado === 'vigente' && c.fecha < hoy)
      for (const c of vencidas) {
        const { error: updError } = await supabase
          .from('convocatorias')
          .update({ estado: 'finalizada' })
          .eq('id', c.id)
        if (!updError) {
          c.estado = 'finalizada'
        }
      }
      filas = [...filas]
      autoFinalizadas.current = true
    }

    setConvocatorias(filas)
    setCargandoLista(false)
  }, [juntaId])

  useEffect(() => {
    fetchConvocatorias()
  }, [fetchConvocatorias])

  // ── Nueva convocatoria ───────────────────────────────────────────────────

  function abrirModalNueva() {
    setNuevoTipo('asamblea')
    setNuevoTitulo('')
    setNuevaFecha('')
    setNuevaHora('')
    setNuevoLugar('')
    setNuevoOrdenDelDia('')
    setNuevoPlazo('')
    setArchivoDocumento(null)
    setErrorModal('')
    setModalNueva(true)
  }

  async function handleCrear() {
    if (
      !nuevoTitulo.trim() ||
      !nuevaFecha ||
      !nuevaHora ||
      !nuevoLugar.trim() ||
      !nuevoOrdenDelDia.trim()
    ) {
      setErrorModal('Complete todos los campos obligatorios.')
      return
    }
    if (!juntaId) return
    setGuardando(true)
    setErrorModal('')

    // 1. Subir documento (si se seleccionó)
    let documentoPath: string | null = null
    if (archivoDocumento) {
      const path = `${juntaId}/${Date.now()}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('documentos-convocatorias')
        .upload(path, archivoDocumento)
      if (uploadError) {
        setErrorModal('Error al subir el documento. Intente de nuevo.')
        setGuardando(false)
        return
      }
      documentoPath = path
    }

    // 2. Insertar convocatoria
    const { data: nuevaData, error: insertError } = await supabase
      .from('convocatorias')
      .insert({
        junta_id: juntaId,
        tipo: nuevoTipo,
        titulo: nuevoTitulo.trim(),
        fecha: nuevaFecha,
        hora: nuevaHora,
        lugar: nuevoLugar.trim(),
        orden_del_dia: nuevoOrdenDelDia.trim(),
        plazo_confirmacion: nuevoPlazo || null,
        documento_path: documentoPath,
        estado: 'vigente',
        creado_por: usuario?.id ?? null,
      })
      .select()
      .single()

    if (insertError || !nuevaData) {
      setErrorModal('Error al publicar la convocatoria. Intente de nuevo.')
      setGuardando(false)
      return
    }

    const nuevaConvocatoriaId = (nuevaData as Convocatoria).id

    // 3. RF-25.2 — notificar a todos los usuarios activos de la junta
    let notificados = 0
    const { data: perfilesData, error: perfilesError } = await supabase
      .from('perfiles')
      .select('id')
      .eq('junta_id', juntaId)
      .eq('activo', true)

    if (perfilesError) {
      setGuardando(false)
      setModalNueva(false)
      await fetchConvocatorias()
      setAlertaLista({
        tipo: 'exito',
        mensaje: 'Convocatoria publicada, pero hubo un error al notificar a los usuarios.',
      })
      return
    }

    const perfiles = (perfilesData ?? []) as { id: string }[]
    if (perfiles.length > 0) {
      const filas = perfiles.map((p) => ({
        junta_id: juntaId,
        usuario_id: p.id,
        tipo: 'convocatoria',
        referencia_id: nuevaConvocatoriaId,
        referencia_tipo: 'convocatoria',
        mensaje: `Nueva convocatoria: "${nuevoTitulo.trim()}" — ${nuevaFecha}`,
        leida: false,
      }))
      const { error: notifError } = await supabase.from('notificaciones').insert(filas)
      if (notifError) {
        setGuardando(false)
        setModalNueva(false)
        await fetchConvocatorias()
        setAlertaLista({
          tipo: 'exito',
          mensaje: 'Convocatoria publicada, pero hubo un error al notificar a los usuarios.',
        })
        return
      }
      notificados = perfiles.length
    }

    setGuardando(false)
    setModalNueva(false)
    await fetchConvocatorias()
    setAlertaLista({
      tipo: 'exito',
      mensaje: `Convocatoria publicada. Se notificó a ${notificados} usuarios.`,
    })
  }

  // ── Finalizar manualmente ────────────────────────────────────────────────

  async function handleFinalizar() {
    if (!convocatoriaAFinalizar) return
    setFinalizando(true)

    const { error } = await supabase
      .from('convocatorias')
      .update({ estado: 'finalizada' })
      .eq('id', convocatoriaAFinalizar.id)

    setFinalizando(false)
    if (error) {
      setAlertaLista({ tipo: 'error', mensaje: 'Error al finalizar la convocatoria.' })
      setConvocatoriaAFinalizar(null)
      return
    }
    setConvocatoriaAFinalizar(null)
    await fetchConvocatorias()
    setAlertaLista({ tipo: 'exito', mensaje: 'Convocatoria finalizada.' })
  }

  // ── Ver documento ────────────────────────────────────────────────────────

  async function handleVerDocumento(documentoPath: string) {
    const { data, error } = await supabase.storage
      .from('documentos-convocatorias')
      .createSignedUrl(documentoPath, 600)
    if (error || !data) {
      setAlertaLista({ tipo: 'error', mensaje: 'Error al obtener el documento.' })
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  // ── Columnas ─────────────────────────────────────────────────────────────

  const columnas: ColumnaTabla<Convocatoria>[] = [
    { cabecera: 'Título', accesador: 'titulo' },
    { cabecera: 'Tipo', accesador: (c) => <BadgeTipo tipo={c.tipo} /> },
    { cabecera: 'Fecha', accesador: (c) => formatearFecha(c.fecha) },
    { cabecera: 'Hora', accesador: (c) => (c.hora ? c.hora.substring(0, 5) : '—') },
    { cabecera: 'Estado', accesador: (c) => <BadgeEstado estado={c.estado} /> },
    {
      cabecera: 'Documento',
      accesador: (c) =>
        c.documento_path ? (
          <Boton variante="fantasma" tamaño="sm" onClick={() => handleVerDocumento(c.documento_path!)}>
            Ver
          </Boton>
        ) : (
          '—'
        ),
    },
    {
      cabecera: 'Acciones',
      accesador: (c) =>
        c.estado === 'vigente' ? (
          <Boton
            variante="peligro"
            tamaño="sm"
            onClick={() => setConvocatoriaAFinalizar(c)}
          >
            Finalizar
          </Boton>
        ) : (
          '—'
        ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Convocatorias</h1>
        <Boton variante="primario" onClick={abrirModalNueva}>
          Nueva convocatoria
        </Boton>
      </div>

      {/* Alerta de página */}
      {alertaLista && (
        <Alerta
          tipo={alertaLista.tipo}
          mensaje={alertaLista.mensaje}
          onCerrar={() => setAlertaLista(null)}
        />
      )}

      {/* Tabla */}
      <Tabla
        columnas={columnas}
        datos={convocatorias}
        cargando={cargandoLista}
        camposFiltro={['titulo', 'lugar']}
        filasPorPagina={10}
      />

      {/* Modal: nueva convocatoria */}
      <Modal
        abierto={modalNueva}
        onCerrar={() => !guardando && setModalNueva(false)}
        titulo="Nueva convocatoria"
        tamaño="lg"
      >
        <div className="space-y-4">
          {errorModal && (
            <Alerta tipo="error" mensaje={errorModal} onCerrar={() => setErrorModal('')} />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                value={nuevoTipo}
                onChange={(e) => setNuevoTipo(e.target.value as TipoConvocatoria)}
                className={INPUT_CLASE}
              >
                <option value="asamblea">Asamblea</option>
                <option value="minga">Minga</option>
              </select>
            </div>

            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nuevoTitulo}
                onChange={(e) => setNuevoTitulo(e.target.value)}
                placeholder="Ej. Asamblea general ordinaria"
                className={INPUT_CLASE}
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={nuevaFecha}
                onChange={(e) => setNuevaFecha(e.target.value)}
                className={INPUT_CLASE}
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
                className={INPUT_CLASE}
              />
            </div>

            {/* Lugar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lugar <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nuevoLugar}
                onChange={(e) => setNuevoLugar(e.target.value)}
                placeholder="Ej. Sede de la junta"
                className={INPUT_CLASE}
              />
            </div>

            {/* Plazo de confirmación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plazo de confirmación
              </label>
              <input
                type="date"
                value={nuevoPlazo}
                onChange={(e) => setNuevoPlazo(e.target.value)}
                className={INPUT_CLASE}
              />
            </div>
          </div>

          {/* Orden del día */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Orden del día <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={nuevoOrdenDelDia}
              onChange={(e) => setNuevoOrdenDelDia(e.target.value)}
              placeholder="Puntos del orden del día"
              className={INPUT_CLASE}
            />
          </div>

          {/* Documento */}
          <SubidaArchivo
            tiposPermitidos={['application/pdf']}
            tamañoMaxMB={10}
            etiqueta="Documento de convocatoria (PDF, máx. 10 MB)"
            onArchivo={(archivo) => setArchivoDocumento(archivo)}
          />

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-2">
            <Boton
              variante="secundario"
              onClick={() => setModalNueva(false)}
              disabled={guardando}
            >
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={handleCrear} cargando={guardando}>
              Publicar convocatoria
            </Boton>
          </div>
        </div>
      </Modal>

      {/* Modal: finalizar convocatoria */}
      <Modal
        abierto={convocatoriaAFinalizar !== null}
        onCerrar={() => !finalizando && setConvocatoriaAFinalizar(null)}
        titulo="Finalizar convocatoria"
        tamaño="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ¿Finalizar la convocatoria «{convocatoriaAFinalizar?.titulo}»?
          </p>
          <div className="flex justify-end gap-3">
            <Boton
              variante="secundario"
              onClick={() => setConvocatoriaAFinalizar(null)}
              disabled={finalizando}
            >
              Cancelar
            </Boton>
            <Boton variante="peligro" onClick={handleFinalizar} cargando={finalizando}>
              Finalizar
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
