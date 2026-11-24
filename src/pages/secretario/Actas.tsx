import { useState, useEffect, useCallback } from 'react'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { Modal } from '../../components/ui/Modal'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'
import { SubidaArchivo } from '../../components/ui/SubidaArchivo'
import useAuth from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

type EstadoCumplimiento = 'pendiente' | 'en_proceso' | 'cumplida'

interface Acta {
  id: string
  junta_id: string
  asamblea_id: string | null
  titulo: string
  fecha: string
  descripcion: string | null
  documento_path: string | null
  publicada: boolean
  created_at: string
  creado_por: string | null
  // joined:
  asamblea_fecha: string | null
  asamblea_lugar: string | null
}

interface Resolucion {
  id: string
  junta_id: string
  acta_id: string
  numero: string
  descripcion: string
  estado_cumplimiento: EstadoCumplimiento
  created_at: string
}

interface AsambleaOption {
  id: string
  fecha: string
  lugar: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFecha(fecha: string | null): string {
  if (!fecha) return ''
  const [year, month, day] = fecha.split('-')
  return `${day}/${month}/${year}`
}

const INPUT_CLASE =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

const ESTADO_CUMPLIMIENTO: Record<EstadoCumplimiento, { label: string; clase: string }> = {
  pendiente: { label: 'Pendiente', clase: 'bg-yellow-100 text-yellow-700' },
  en_proceso: { label: 'En proceso', clase: 'bg-blue-100 text-blue-700' },
  cumplida: { label: 'Cumplida', clase: 'bg-green-100 text-green-700' },
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Actas() {
  const { usuario, juntaId } = useAuth()

  // List state
  const [actas, setActas] = useState<Acta[]>([])
  const [asambleas, setAsambleas] = useState<AsambleaOption[]>([])
  const [cargando, setCargando] = useState(false)
  const [alerta, setAlerta] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)

  // Filters
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtroAsamblea, setFiltroAsamblea] = useState('')

  // Auto-dismiss alert (4 s)
  useEffect(() => {
    if (!alerta) return
    const t = setTimeout(() => setAlerta(null), 4000)
    return () => clearTimeout(t)
  }, [alerta])

  // Modal nueva acta
  const [modalNueva, setModalNueva] = useState(false)
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [nuevoAsambleaId, setNuevoAsambleaId] = useState('')
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaDescripcion, setNuevaDescripcion] = useState('')
  const [nuevoArchivo, setNuevoArchivo] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState('')

  // Modal publicar
  const [actaAPublicar, setActaAPublicar] = useState<Acta | null>(null)
  const [publicando, setPublicando] = useState(false)

  // Modal resoluciones
  const [actaResoluciones, setActaResoluciones] = useState<Acta | null>(null)
  const [resoluciones, setResoluciones] = useState<Resolucion[]>([])
  const [cargandoResoluciones, setCargandoResoluciones] = useState(false)
  const [errorResoluciones, setErrorResoluciones] = useState('')
  const [exitoResoluciones, setExitoResoluciones] = useState('')
  const [nuevaResNumero, setNuevaResNumero] = useState('')
  const [nuevaResDescripcion, setNuevaResDescripcion] = useState('')
  const [guardandoResolucion, setGuardandoResolucion] = useState(false)
  const [resolucionAEliminar, setResolucionAEliminar] = useState<string | null>(null)
  const [eliminandoResolucion, setEliminandoResolucion] = useState(false)

  // ── Fetch actas y asambleas ─────────────────────────────────────────────

  const fetchActas = useCallback(async () => {
    if (!juntaId) return
    setCargando(true)
    const { data, error } = await supabase
      .from('actas')
      .select('*, asambleas!asamblea_id (fecha, lugar)')
      .eq('junta_id', juntaId)
      .order('fecha', { ascending: false })

    if (error) {
      setAlerta({ tipo: 'error', mensaje: 'Error al cargar actas.' })
    } else {
      setActas(
        ((data ?? []) as any[]).map((r) => ({
          ...r,
          asamblea_fecha: r.asambleas?.fecha ?? null,
          asamblea_lugar: r.asambleas?.lugar ?? null,
        })) as Acta[]
      )
    }
    setCargando(false)
  }, [juntaId])

  const fetchAsambleas = useCallback(async () => {
    if (!juntaId) return
    const { data, error } = await supabase
      .from('asambleas')
      .select('id, fecha, lugar')
      .eq('junta_id', juntaId)
      .order('fecha', { ascending: false })

    if (!error && data) {
      setAsambleas((data ?? []) as AsambleaOption[])
    }
  }, [juntaId])

  useEffect(() => {
    fetchActas()
    fetchAsambleas()
  }, [fetchActas, fetchAsambleas])

  // ── Fetch resoluciones ──────────────────────────────────────────────────

  const fetchResoluciones = useCallback(async (actaId: string) => {
    setCargandoResoluciones(true)
    setErrorResoluciones('')
    const { data, error } = await supabase
      .from('resoluciones')
      .select('*')
      .eq('acta_id', actaId)
      .order('numero')

    if (error) {
      setErrorResoluciones('Error al cargar resoluciones.')
    } else {
      setResoluciones((data ?? []) as Resolucion[])
    }
    setCargandoResoluciones(false)
  }, [])

  useEffect(() => {
    if (actaResoluciones) {
      fetchResoluciones(actaResoluciones.id)
    }
  }, [actaResoluciones, fetchResoluciones])

  // ── Filters ─────────────────────────────────────────────────────────────

  const actasFiltradas = actas.filter((a) => {
    if (filtroDesde && a.fecha < filtroDesde) return false
    if (filtroHasta && a.fecha > filtroHasta) return false
    if (filtroAsamblea) {
      if (filtroAsamblea === 'sin' ? a.asamblea_id !== null : a.asamblea_id !== filtroAsamblea)
        return false
    }
    return true
  })

  // ── Nueva acta ──────────────────────────────────────────────────────────

  function abrirModalNueva() {
    setNuevoTitulo('')
    setNuevoAsambleaId('')
    setNuevaFecha('')
    setNuevaDescripcion('')
    setNuevoArchivo(null)
    setErrorModal('')
    setModalNueva(true)
  }

  async function handleCrearActa() {
    if (!nuevoTitulo.trim() || !nuevaFecha) {
      setErrorModal('El título y la fecha son obligatorios.')
      return
    }
    if (!juntaId) return
    setGuardando(true)
    setErrorModal('')

    // 1. Upload document (if any)
    let documentoPath: string | null = null
    if (nuevoArchivo) {
      const nombreSanitizado = nuevoArchivo.name.replace(/\s+/g, '-')
      const path = `${juntaId}/${Date.now()}-${nombreSanitizado}`
      const { error: uploadError } = await supabase.storage
        .from('documentos-actas')
        .upload(path, nuevoArchivo)

      if (uploadError) {
        setErrorModal('Error al subir el documento. Intente de nuevo.')
        setGuardando(false)
        return
      }
      documentoPath = path
    }

    // 2. Insert acta
    const { error: insertError } = await supabase.from('actas').insert({
      junta_id: juntaId,
      asamblea_id: nuevoAsambleaId || null,
      titulo: nuevoTitulo.trim(),
      fecha: nuevaFecha,
      descripcion: nuevaDescripcion.trim() || null,
      documento_path: documentoPath,
      publicada: false,
      creado_por: usuario?.id,
    })

    if (insertError) {
      setErrorModal('Error al registrar el acta. Intente de nuevo.')
      setGuardando(false)
      return
    }

    setGuardando(false)
    setModalNueva(false)
    await fetchActas()
    setAlerta({ tipo: 'exito', mensaje: 'Acta registrada como borrador.' })
  }

  // ── Ver documento ────────────────────────────────────────────────────────

  async function handleVerDocumento(path: string) {
    const { data, error } = await supabase.storage
      .from('documentos-actas')
      .createSignedUrl(path, 600)

    if (error || !data) {
      setAlerta({ tipo: 'error', mensaje: 'Error al generar el enlace del documento.' })
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  // ── Publicar acta ───────────────────────────────────────────────────────

  async function handlePublicar() {
    if (!actaAPublicar) return
    setPublicando(true)

    const { error } = await supabase
      .from('actas')
      .update({ publicada: true })
      .eq('id', actaAPublicar.id)

    if (error) {
      setAlerta({ tipo: 'error', mensaje: 'Error al publicar el acta.' })
    } else {
      await fetchActas()
      setAlerta({
        tipo: 'exito',
        mensaje: 'Acta publicada. Visible para todos los usuarios de la junta.',
      })
    }

    setPublicando(false)
    setActaAPublicar(null)
  }

  // ── Cambiar estado de cumplimiento ───────────────────────────────────────

  async function handleEstadoCumplimiento(resolucion: Resolucion, nuevo: EstadoCumplimiento) {
    if (nuevo === resolucion.estado_cumplimiento) return
    const anterior = resolucion.estado_cumplimiento

    // Optimistic update
    setResoluciones((prev) =>
      prev.map((r) => (r.id === resolucion.id ? { ...r, estado_cumplimiento: nuevo } : r))
    )

    const { error } = await supabase
      .from('resoluciones')
      .update({ estado_cumplimiento: nuevo })
      .eq('id', resolucion.id)

    if (error) {
      // Revert
      setResoluciones((prev) =>
        prev.map((r) => (r.id === resolucion.id ? { ...r, estado_cumplimiento: anterior } : r))
      )
      setExitoResoluciones('')
      setErrorResoluciones('Error al actualizar el cumplimiento de la resolución.')
    }
  }

  // ── Nueva resolución ────────────────────────────────────────────────────

  async function handleCrearResolucion() {
    if (!actaResoluciones || !juntaId) return
    if (!nuevaResNumero.trim() || !nuevaResDescripcion.trim()) {
      setErrorResoluciones('El número y la descripción de la resolución son obligatorios.')
      setExitoResoluciones('')
      return
    }

    setGuardandoResolucion(true)
    setErrorResoluciones('')

    const { error } = await supabase.from('resoluciones').insert({
      junta_id: juntaId,
      acta_id: actaResoluciones.id,
      numero: nuevaResNumero.trim(),
      descripcion: nuevaResDescripcion.trim(),
      estado_cumplimiento: 'pendiente',
    })

    if (error) {
      setErrorResoluciones('Error al registrar la resolución.')
    } else {
      setNuevaResNumero('')
      setNuevaResDescripcion('')
      setExitoResoluciones('Resolución registrada.')
      setTimeout(() => setExitoResoluciones(''), 3000)
      await fetchResoluciones(actaResoluciones.id)
    }
    setGuardandoResolucion(false)
  }

  // ── Eliminar resolución ──────────────────────────────────────────────────

  async function handleEliminarResolucion() {
    if (!resolucionAEliminar || !actaResoluciones) return
    setEliminandoResolucion(true)

    const { error } = await supabase
      .from('resoluciones')
      .delete()
      .eq('id', resolucionAEliminar)

    if (error) {
      setErrorResoluciones('Error al eliminar la resolución.')
    } else {
      await fetchResoluciones(actaResoluciones.id)
    }

    setEliminandoResolucion(false)
    setResolucionAEliminar(null)
  }

  // ── Columns ─────────────────────────────────────────────────────────────

  const columnas: ColumnaTabla<Acta>[] = [
    {
      cabecera: 'Título',
      accesador: (a) => (
        <span className="block max-w-[14rem] truncate" title={a.titulo}>
          {a.titulo}
        </span>
      ),
    },
    {
      cabecera: 'Asamblea',
      accesador: (a) => (a.asamblea_fecha ? formatFecha(a.asamblea_fecha) : '—'),
    },
    {
      cabecera: 'Fecha',
      accesador: (a) => formatFecha(a.fecha),
    },
    {
      cabecera: 'Publicada',
      accesador: (a) =>
        a.publicada ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Publicada
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            Borrador
          </span>
        ),
    },
    {
      cabecera: 'Documento',
      accesador: (a) =>
        a.documento_path ? (
          <button
            type="button"
            onClick={() => handleVerDocumento(a.documento_path!)}
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
        <h1 className="text-2xl font-semibold text-gray-900">Actas y resoluciones</h1>
        <Boton variante="primario" onClick={abrirModalNueva}>
          Nueva acta
        </Boton>
      </div>

      {/* Alert */}
      {alerta && (
        <Alerta
          tipo={alerta.tipo}
          mensaje={alerta.mensaje}
          onCerrar={() => setAlerta(null)}
        />
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4">
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
        <div className="min-w-[16rem]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Asamblea</label>
          <select
            value={filtroAsamblea}
            onChange={(e) => setFiltroAsamblea(e.target.value)}
            className={INPUT_CLASE}
          >
            <option value="">Todas</option>
            <option value="sin">Sin asamblea</option>
            {asambleas.map((a) => (
              <option key={a.id} value={a.id}>
                {formatFecha(a.fecha)} — {a.lugar}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <Tabla
        columnas={columnas}
        datos={actasFiltradas}
        cargando={cargando}
        camposFiltro={['titulo']}
        filasPorPagina={10}
        accionesExtra={(acta) => (
          <div className="flex items-center gap-2">
            {!acta.publicada && (
              <Boton variante="secundario" tamaño="sm" onClick={() => setActaAPublicar(acta)}>
                Publicar
              </Boton>
            )}
            <Boton variante="primario" tamaño="sm" onClick={() => setActaResoluciones(acta)}>
              Resoluciones
            </Boton>
          </div>
        )}
      />

      {/* Modal: nueva acta */}
      <Modal
        abierto={modalNueva}
        onCerrar={() => !guardando && setModalNueva(false)}
        titulo="Nueva acta"
        tamaño="lg"
      >
        <div className="space-y-4">
          {errorModal && (
            <Alerta tipo="error" mensaje={errorModal} onCerrar={() => setErrorModal('')} />
          )}

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nuevoTitulo}
              onChange={(e) => setNuevoTitulo(e.target.value)}
              placeholder="Ej. Acta de asamblea ordinaria"
              className={INPUT_CLASE}
            />
          </div>

          {/* Asamblea asociada */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Asamblea asociada
            </label>
            <select
              value={nuevoAsambleaId}
              onChange={(e) => setNuevoAsambleaId(e.target.value)}
              className={INPUT_CLASE}
            >
              <option value="">Sin asamblea</option>
              {asambleas.map((a) => (
                <option key={a.id} value={a.id}>
                  {formatFecha(a.fecha)} — {a.lugar}
                </option>
              ))}
            </select>
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

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              rows={3}
              value={nuevaDescripcion}
              onChange={(e) => setNuevaDescripcion(e.target.value)}
              placeholder="Resumen del contenido del acta..."
              className={INPUT_CLASE}
            />
          </div>

          {/* Documento */}
          <SubidaArchivo
            tiposPermitidos={[
              'application/pdf',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ]}
            tamañoMaxMB={10}
            etiqueta="Documento del acta (PDF/DOCX, máx. 10 MB)"
            onArchivo={setNuevoArchivo}
          />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Boton
              variante="secundario"
              onClick={() => setModalNueva(false)}
              disabled={guardando}
            >
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={handleCrearActa} cargando={guardando}>
              Registrar acta
            </Boton>
          </div>
        </div>
      </Modal>

      {/* Modal: confirmar publicación */}
      <Modal
        abierto={actaAPublicar !== null}
        onCerrar={() => !publicando && setActaAPublicar(null)}
        titulo="Publicar acta"
        tamaño="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ¿Publicar el acta «{actaAPublicar?.titulo}»? Será visible para todos los usuarios
            activos de la junta.
          </p>
          <div className="flex justify-end gap-3">
            <Boton
              variante="secundario"
              onClick={() => setActaAPublicar(null)}
              disabled={publicando}
            >
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={handlePublicar} cargando={publicando}>
              Publicar
            </Boton>
          </div>
        </div>
      </Modal>

      {/* Modal: resoluciones */}
      <Modal
        abierto={actaResoluciones !== null}
        onCerrar={() => {
          if (!cargandoResoluciones && !guardandoResolucion && !eliminandoResolucion) {
            setActaResoluciones(null)
            setResolucionAEliminar(null)
          }
        }}
        titulo={`Resoluciones — ${actaResoluciones?.titulo ?? ''}`}
        tamaño="xl"
      >
        <div className="space-y-4">
          {errorResoluciones && (
            <Alerta
              tipo="error"
              mensaje={errorResoluciones}
              onCerrar={() => setErrorResoluciones('')}
            />
          )}
          {exitoResoluciones && (
            <p className="text-sm text-green-700">{exitoResoluciones}</p>
          )}

          {/* Lista de resoluciones */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm text-gray-700">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">N.º</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Descripción</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Cumplimiento</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargandoResoluciones ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      Cargando resoluciones...
                    </td>
                  </tr>
                ) : resoluciones.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      No hay resoluciones registradas para este acta
                    </td>
                  </tr>
                ) : (
                  resoluciones.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100 even:bg-gray-50">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{r.numero}</td>
                      <td className="px-4 py-3 max-w-[18rem]">{r.descripcion}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={r.estado_cumplimiento}
                            onChange={(e) =>
                              handleEstadoCumplimiento(
                                r,
                                e.target.value as EstadoCumplimiento
                              )
                            }
                            className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="en_proceso">En proceso</option>
                            <option value="cumplida">Cumplida</option>
                          </select>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              ESTADO_CUMPLIMIENTO[r.estado_cumplimiento].clase
                            }`}
                          >
                            {ESTADO_CUMPLIMIENTO[r.estado_cumplimiento].label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {resolucionAEliminar === r.id ? (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600">¿Seguro?</span>
                            <Boton
                              variante="peligro"
                              tamaño="sm"
                              className="!px-2 !py-1 !text-xs"
                              onClick={handleEliminarResolucion}
                              cargando={eliminandoResolucion}
                            >
                              Sí
                            </Boton>
                            <Boton
                              variante="secundario"
                              tamaño="sm"
                              className="!px-2 !py-1 !text-xs"
                              onClick={() => setResolucionAEliminar(null)}
                              disabled={eliminandoResolucion}
                            >
                              No
                            </Boton>
                          </div>
                        ) : (
                          <Boton
                            variante="peligro"
                            tamaño="sm"
                            className="!px-2 !py-1 !text-xs"
                            onClick={() => setResolucionAEliminar(r.id)}
                          >
                            Eliminar
                          </Boton>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Nueva resolución */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Nueva resolución</h2>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  N.º <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nuevaResNumero}
                  onChange={(e) => setNuevaResNumero(e.target.value)}
                  placeholder="001"
                  className={INPUT_CLASE}
                />
              </div>
              <div className="sm:col-span-5">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Descripción <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={nuevaResDescripcion}
                  onChange={(e) => setNuevaResDescripcion(e.target.value)}
                  placeholder="Descripción de la resolución..."
                  className={INPUT_CLASE}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Boton
                variante="primario"
                onClick={handleCrearResolucion}
                cargando={guardandoResolucion}
              >
                Agregar resolución
              </Boton>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
