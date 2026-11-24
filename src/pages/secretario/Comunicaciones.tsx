import { useState, useEffect, useCallback } from 'react'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { Modal } from '../../components/ui/Modal'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'
import { SubidaArchivo } from '../../components/ui/SubidaArchivo'
import useAuth from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Comunicacion {
  id: string
  junta_id: string
  institucion_remitente: string
  asunto: string
  fecha_recepcion: string
  numero_oficio: string | null
  resumen: string | null
  documento_path: string | null
  respuesta: string | null
  created_at: string
  registrado_por: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFecha(fecha: string | null): string {
  if (!fecha) return ''
  const [year, month, day] = fecha.split('-')
  return `${day}/${month}/${year}`
}

function hoyISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const INPUT_CLASE =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

const BUCKET = 'comunicaciones-externas'

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Comunicaciones() {
  const { usuario, juntaId } = useAuth()

  // List state
  const [comunicaciones, setComunicaciones] = useState<Comunicacion[]>([])
  const [cargando, setCargando] = useState(false)
  const [alerta, setAlerta] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)

  // Filters
  const [filtroInstitucion, setFiltroInstitucion] = useState('')
  const [filtroAsunto, setFiltroAsunto] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  // Auto-dismiss alert (4 s)
  useEffect(() => {
    if (!alerta) return
    const t = setTimeout(() => setAlerta(null), 4000)
    return () => clearTimeout(t)
  }, [alerta])

  // Modal nueva / editar (shared form state)
  const [modalForm, setModalForm] = useState<'nueva' | 'editar' | null>(null)
  const [editando, setEditando] = useState<Comunicacion | null>(null)
  const [fInstitucion, setFInstitucion] = useState('')
  const [fAsunto, setFAsunto] = useState('')
  const [fFecha, setFFecha] = useState('')
  const [fNumeroOficio, setFNumeroOficio] = useState('')
  const [fResumen, setFResumen] = useState('')
  const [fRespuesta, setFRespuesta] = useState('')
  const [fArchivo, setFArchivo] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState('')

  // Modal responder
  const [aResponder, setAResponder] = useState<Comunicacion | null>(null)
  const [textoRespuesta, setTextoRespuesta] = useState('')
  const [guardandoRespuesta, setGuardandoRespuesta] = useState(false)
  const [errorRespuesta, setErrorRespuesta] = useState('')

  // Modal eliminar
  const [aEliminar, setAEliminar] = useState<Comunicacion | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // ── Fetch ───────────────────────────────────────────────────────────────

  const fetchComunicaciones = useCallback(async () => {
    if (!juntaId) return
    setCargando(true)
    const { data, error } = await supabase
      .from('comunicaciones_externas')
      .select('*')
      .eq('junta_id', juntaId)
      .order('fecha_recepcion', { ascending: false })

    if (error) {
      setAlerta({ tipo: 'error', mensaje: 'Error al cargar las comunicaciones.' })
    } else {
      setComunicaciones((data ?? []) as Comunicacion[])
    }
    setCargando(false)
  }, [juntaId])

  useEffect(() => {
    fetchComunicaciones()
  }, [fetchComunicaciones])

  // ── Filters ─────────────────────────────────────────────────────────────

  const filtradas = comunicaciones.filter((c) => {
    if (
      filtroInstitucion &&
      !c.institucion_remitente.toLowerCase().includes(filtroInstitucion.toLowerCase())
    )
      return false
    if (filtroAsunto && !c.asunto.toLowerCase().includes(filtroAsunto.toLowerCase()))
      return false
    if (filtroDesde && c.fecha_recepcion < filtroDesde) return false
    if (filtroHasta && c.fecha_recepcion > filtroHasta) return false
    return true
  })

  // ── Nueva comunicación ──────────────────────────────────────────────────

  function abrirModalNueva() {
    setEditando(null)
    setFInstitucion('')
    setFAsunto('')
    setFFecha(hoyISO())
    setFNumeroOficio('')
    setFResumen('')
    setFRespuesta('')
    setFArchivo(null)
    setErrorModal('')
    setModalForm('nueva')
  }

  function abrirModalEditar(c: Comunicacion) {
    setEditando(c)
    setFInstitucion(c.institucion_remitente)
    setFAsunto(c.asunto)
    setFFecha(c.fecha_recepcion)
    setFNumeroOficio(c.numero_oficio ?? '')
    setFResumen(c.resumen ?? '')
    setFRespuesta(c.respuesta ?? '')
    setFArchivo(null)
    setErrorModal('')
    setModalForm('editar')
  }

  async function handleGuardar() {
    if (!fInstitucion.trim() || !fAsunto.trim() || !fFecha) {
      setErrorModal('La institución, el asunto y la fecha de recepción son obligatorios.')
      return
    }
    if (!juntaId) return
    setGuardando(true)
    setErrorModal('')

    // 1. Upload document (if selected)
    let documentoPath: string | null = editando?.documento_path ?? null
    if (fArchivo) {
      const path = `${juntaId}/C-${Date.now()}.pdf`
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, fArchivo)
      if (uploadError) {
        setErrorModal('Error al subir el documento. Intente de nuevo.')
        setGuardando(false)
        return
      }
      // Remove old file when replacing
      if (editando?.documento_path) {
        await supabase.storage.from(BUCKET).remove([editando.documento_path])
      }
      documentoPath = path
    }

    // 2. Insert or update
    if (editando) {
      const { error: updateError } = await supabase
        .from('comunicaciones_externas')
        .update({
          institucion_remitente: fInstitucion.trim(),
          asunto: fAsunto.trim(),
          fecha_recepcion: fFecha,
          numero_oficio: fNumeroOficio.trim() || null,
          resumen: fResumen.trim() || null,
          documento_path: documentoPath,
          respuesta: fRespuesta.trim() || null,
        })
        .eq('id', editando.id)

      if (updateError) {
        setErrorModal('Error al actualizar la comunicación. Intente de nuevo.')
        setGuardando(false)
        return
      }
    } else {
      const { error: insertError } = await supabase.from('comunicaciones_externas').insert({
        junta_id: juntaId,
        institucion_remitente: fInstitucion.trim(),
        asunto: fAsunto.trim(),
        fecha_recepcion: fFecha,
        numero_oficio: fNumeroOficio.trim() || null,
        resumen: fResumen.trim() || null,
        documento_path: documentoPath,
        respuesta: fRespuesta.trim() || null,
        registrado_por: usuario?.id,
      })

      if (insertError) {
        setErrorModal('Error al registrar la comunicación. Intente de nuevo.')
        setGuardando(false)
        return
      }
    }

    setGuardando(false)
    setModalForm(null)
    setEditando(null)
    await fetchComunicaciones()
    setAlerta({
      tipo: 'exito',
      mensaje: editando ? 'Comunicación actualizada.' : 'Comunicación registrada.',
    })
  }

  // ── Ver documento ────────────────────────────────────────────────────────

  async function handleVerDocumento(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600)
    if (error || !data) {
      setAlerta({ tipo: 'error', mensaje: 'Error al generar el enlace del documento.' })
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  // ── Responder ────────────────────────────────────────────────────────────

  async function handleResponder() {
    if (!aResponder) return
    if (!textoRespuesta.trim()) {
      setErrorRespuesta('La respuesta es obligatoria.')
      return
    }
    setGuardandoRespuesta(true)
    setErrorRespuesta('')

    const { error } = await supabase
      .from('comunicaciones_externas')
      .update({ respuesta: textoRespuesta.trim() })
      .eq('id', aResponder.id)

    if (error) {
      setErrorRespuesta('Error al registrar la respuesta. Intente de nuevo.')
    } else {
      setAResponder(null)
      await fetchComunicaciones()
      setAlerta({ tipo: 'exito', mensaje: 'Respuesta registrada.' })
    }
    setGuardandoRespuesta(false)
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────

  async function handleEliminar() {
    if (!aEliminar) return
    setEliminando(true)

    // Remove document from storage if it exists
    if (aEliminar.documento_path) {
      await supabase.storage.from(BUCKET).remove([aEliminar.documento_path])
    }

    const { error } = await supabase
      .from('comunicaciones_externas')
      .delete()
      .eq('id', aEliminar.id)

    if (error) {
      setAlerta({ tipo: 'error', mensaje: 'Error al eliminar la comunicación.' })
    } else {
      await fetchComunicaciones()
      setAlerta({ tipo: 'exito', mensaje: 'Comunicación eliminada.' })
    }

    setEliminando(false)
    setAEliminar(null)
  }

  // ── Columns ─────────────────────────────────────────────────────────────

  const columnas: ColumnaTabla<Comunicacion>[] = [
    {
      cabecera: 'Fecha recepción',
      accesador: (c) => formatFecha(c.fecha_recepcion),
    },
    {
      cabecera: 'Institución',
      accesador: (c) => (
        <span className="block max-w-[14rem] truncate" title={c.institucion_remitente}>
          {c.institucion_remitente}
        </span>
      ),
    },
    { cabecera: 'N.º oficio', accesador: (c) => c.numero_oficio ?? '—' },
    {
      cabecera: 'Asunto',
      accesador: (c) => (
        <span className="block max-w-[16rem] truncate" title={c.asunto}>
          {c.asunto}
        </span>
      ),
    },
    {
      cabecera: 'Respuesta',
      accesador: (c) =>
        c.respuesta && c.respuesta.trim() !== '' ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Sí
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            No
          </span>
        ),
    },
    {
      cabecera: 'Documento',
      accesador: (c) =>
        c.documento_path ? (
          <button
            type="button"
            onClick={() => handleVerDocumento(c.documento_path!)}
            className="text-sm text-green-700 hover:underline"
          >
            Ver
          </button>
        ) : (
          '—'
        ),
    },
  ]

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Comunicaciones externas</h1>
        <Boton variante="primario" onClick={abrirModalNueva}>
          Nueva comunicación
        </Boton>
      </div>

      {/* Alert */}
      {alerta && (
        <Alerta tipo={alerta.tipo} mensaje={alerta.mensaje} onCerrar={() => setAlerta(null)} />
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[14rem]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Institución</label>
          <input
            type="text"
            value={filtroInstitucion}
            onChange={(e) => setFiltroInstitucion(e.target.value)}
            placeholder="Ej. GAD Parroquial"
            className={INPUT_CLASE}
          />
        </div>
        <div className="min-w-[14rem]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
          <input
            type="text"
            value={filtroAsunto}
            onChange={(e) => setFiltroAsunto(e.target.value)}
            placeholder="Buscar por asunto"
            className={INPUT_CLASE}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha desde</label>
          <input
            type="date"
            value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)}
            className={INPUT_CLASE}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha hasta</label>
          <input
            type="date"
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
            className={INPUT_CLASE}
          />
        </div>
      </div>

      {/* Table */}
      <Tabla
        columnas={columnas}
        datos={filtradas}
        cargando={cargando}
        camposFiltro={['numero_oficio']}
        filasPorPagina={15}
        accionesExtra={(c) => (
          <div className="flex items-center gap-2">
            <Boton
              variante="fantasma"
              tamaño="sm"
              onClick={() => abrirModalEditar(c)}
            >
              Editar
            </Boton>
            {!(c.respuesta && c.respuesta.trim() !== '') && (
              <Boton
                variante="secundario"
                tamaño="sm"
                onClick={() => {
                  setAResponder(c)
                  setTextoRespuesta('')
                  setErrorRespuesta('')
                }}
              >
                Responder
              </Boton>
            )}
            <Boton
              variante="peligro"
              tamaño="sm"
              onClick={() => setAEliminar(c)}
            >
              Eliminar
            </Boton>
          </div>
        )}
      />

      {/* Modal: nueva / editar comunicación */}
      <Modal
        abierto={modalForm !== null}
        onCerrar={() => !guardando && setModalForm(null)}
        titulo={modalForm === 'editar' ? 'Editar comunicación' : 'Nueva comunicación'}
        tamaño="lg"
      >
        <div className="space-y-4">
          {errorModal && (
            <Alerta tipo="error" mensaje={errorModal} onCerrar={() => setErrorModal('')} />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Institución remitente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Institución remitente <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fInstitucion}
                onChange={(e) => setFInstitucion(e.target.value)}
                placeholder="Ej. GAD Parroquial Rural"
                className={INPUT_CLASE}
              />
            </div>

            {/* N.º de oficio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                N.º de oficio
              </label>
              <input
                type="text"
                value={fNumeroOficio}
                onChange={(e) => setFNumeroOficio(e.target.value)}
                placeholder="Ej. GAD-2024-135"
                className={INPUT_CLASE}
              />
            </div>

            {/* Fecha de recepción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de recepción <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={fFecha}
                onChange={(e) => setFFecha(e.target.value)}
                className={INPUT_CLASE}
              />
            </div>
          </div>

          {/* Asunto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Asunto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fAsunto}
              onChange={(e) => setFAsunto(e.target.value)}
              placeholder="Ej. Convocatoria a mesa de diálogo"
              className={INPUT_CLASE}
            />
          </div>

          {/* Resumen */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resumen</label>
            <textarea
              rows={3}
              value={fResumen}
              onChange={(e) => setFResumen(e.target.value)}
              placeholder="Resumen del contenido de la comunicación..."
              className={INPUT_CLASE}
            />
          </div>

          {/* Respuesta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Respuesta</label>
            <textarea
              rows={3}
              value={fRespuesta}
              onChange={(e) => setFRespuesta(e.target.value)}
              placeholder="Respuesta enviada a la institución (opcional al crear)..."
              className={INPUT_CLASE}
            />
          </div>

          {/* Documento */}
          <SubidaArchivo
            tiposPermitidos={['application/pdf']}
            tamañoMaxMB={10}
            etiqueta="Documento (PDF, máx. 10 MB)"
            archivoActual={editando?.documento_path ?? null}
            onArchivo={setFArchivo}
          />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Boton
              variante="secundario"
              onClick={() => setModalForm(null)}
              disabled={guardando}
            >
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={handleGuardar} cargando={guardando}>
              {modalForm === 'editar' ? 'Guardar cambios' : 'Registrar comunicación'}
            </Boton>
          </div>
        </div>
      </Modal>

      {/* Modal: responder */}
      <Modal
        abierto={aResponder !== null}
        onCerrar={() => !guardandoRespuesta && setAResponder(null)}
        titulo="Responder comunicación"
        tamaño="md"
      >
        <div className="space-y-4">
          {errorRespuesta && (
            <Alerta
              tipo="error"
              mensaje={errorRespuesta}
              onCerrar={() => setErrorRespuesta('')}
            />
          )}

          {/* Resumen de solo lectura */}
          <dl className="text-sm text-gray-600 space-y-1 border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex gap-2">
              <dt className="font-medium text-gray-700">Institución:</dt>
              <dd>{aResponder?.institucion_remitente}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-700">Asunto:</dt>
              <dd>{aResponder?.asunto}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-700">Fecha:</dt>
              <dd>{aResponder ? formatFecha(aResponder.fecha_recepcion) : ''}</dd>
            </div>
          </dl>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Respuesta <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={textoRespuesta}
              onChange={(e) => setTextoRespuesta(e.target.value)}
              placeholder="Describa la respuesta enviada a la institución..."
              className={INPUT_CLASE}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Boton
              variante="secundario"
              onClick={() => setAResponder(null)}
              disabled={guardandoRespuesta}
            >
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={handleResponder} cargando={guardandoRespuesta}>
              Registrar respuesta
            </Boton>
          </div>
        </div>
      </Modal>

      {/* Modal: confirmar eliminación */}
      <Modal
        abierto={aEliminar !== null}
        onCerrar={() => !eliminando && setAEliminar(null)}
        titulo="Eliminar comunicación"
        tamaño="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ¿Eliminar la comunicación de {aEliminar?.institucion_remitente} (
            {aEliminar?.asunto})?
          </p>
          <div className="flex justify-end gap-3">
            <Boton
              variante="secundario"
              onClick={() => setAEliminar(null)}
              disabled={eliminando}
            >
              Cancelar
            </Boton>
            <Boton variante="peligro" onClick={handleEliminar} cargando={eliminando}>
              Eliminar
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
