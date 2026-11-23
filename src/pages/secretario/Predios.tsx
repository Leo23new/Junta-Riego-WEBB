import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import useAuth from '../../hooks/useAuth'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { Modal } from '../../components/ui/Modal'
import { Formulario, CampoFormulario } from '../../components/ui/Formulario'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'
import { SubidaArchivo } from '../../components/ui/SubidaArchivo'
import { MapaPredio } from '../../components/ui/MapaPredio'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Miembro {
  id: string
  nombres: string
  apellidos: string
  cedula: string
}

interface Sector {
  id: string
  nombre: string
}

interface Predio {
  id: string
  junta_id: string
  miembro_id: string
  codigo_catastral: string | null
  superficie: number | null
  sector_id: string | null
  tipo_uso: string | null
  latitud: number | null
  longitud: number | null
  created_at: string
  creado_por: string | null
  // joined
  miembro_nombres: string
  miembro_apellidos: string
  miembro_cedula: string
  sector_nombre: string | null
}

interface ImagenPredio {
  id: string
  predio_id: string
  storage_path: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

const TIPOS_USO = ['agrícola', 'pecuario', 'mixto', 'habitacional', 'comercial', 'otro']

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  miembro_id: string
  codigo_catastral: string
  superficie: string
  sector_id: string
  tipo_uso: string
  latitud: number | null
  longitud: number | null
}

const FORM_VACÍO: FormState = {
  miembro_id: '',
  codigo_catastral: '',
  superficie: '',
  sector_id: '',
  tipo_uso: '',
  latitud: null,
  longitud: null,
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Predios() {
  const { usuario, juntaId } = useAuth()

  // Data
  const [predios, setPredios] = useState<Predio[]>([])
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [sectores, setSectores] = useState<Sector[]>([])
  const [cargando, setCargando] = useState(true)

  // Page-level alert
  const [alerta, setAlerta] = useState<{ tipo: 'exito' | 'error' | 'advertencia'; mensaje: string } | null>(null)

  // Create / Edit modal
  const [modalAbierto, setModalAbierto] = useState(false)
  const [predioEditando, setPredioEditando] = useState<Predio | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VACÍO)
  const [errorMiembro, setErrorMiembro] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Images
  const [imagenesExistentes, setImagenesExistentes] = useState<ImagenPredio[]>([])
  const [pendingImages, setPendingImages] = useState<File[]>([])

  // Delete confirmation modal
  const [predioAEliminar, setPredioAEliminar] = useState<Predio | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // Auto-dismiss alert
  useEffect(() => {
    if (!alerta) return
    const t = setTimeout(() => setAlerta(null), 4000)
    return () => clearTimeout(t)
  }, [alerta])

  // ─── Load data ─────────────────────────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    if (!juntaId) return
    setCargando(true)
    try {
      const [resPredios, resMiembros, resSectores] = await Promise.all([
        supabase
          .from('predios')
          .select(`
            *,
            miembros!miembro_id (nombres, apellidos, cedula),
            sectores!sector_id (nombre)
          `)
          .eq('junta_id', juntaId)
          .order('created_at', { ascending: false }),
        supabase
          .from('miembros')
          .select('id, nombres, apellidos, cedula')
          .eq('junta_id', juntaId)
          .eq('activo', true)
          .order('apellidos'),
        supabase
          .from('sectores')
          .select('id, nombre')
          .eq('junta_id', juntaId)
          .order('nombre'),
      ])

      if (resPredios.error) throw resPredios.error
      if (resMiembros.error) throw resMiembros.error
      if (resSectores.error) throw resSectores.error

      // Flatten joins
      const prediosPlanos: Predio[] = (resPredios.data ?? []).map((p: Record<string, unknown>) => {
        const miembroJoin = p['miembros'] as { nombres: string; apellidos: string; cedula: string } | null
        const sectorJoin = p['sectores'] as { nombre: string } | null
        return {
          id: p['id'] as string,
          junta_id: p['junta_id'] as string,
          miembro_id: p['miembro_id'] as string,
          codigo_catastral: p['codigo_catastral'] as string | null,
          superficie: p['superficie'] as number | null,
          sector_id: p['sector_id'] as string | null,
          tipo_uso: p['tipo_uso'] as string | null,
          latitud: p['latitud'] as number | null,
          longitud: p['longitud'] as number | null,
          created_at: p['created_at'] as string,
          creado_por: p['creado_por'] as string | null,
          miembro_nombres: miembroJoin?.nombres ?? '',
          miembro_apellidos: miembroJoin?.apellidos ?? '',
          miembro_cedula: miembroJoin?.cedula ?? '',
          sector_nombre: sectorJoin?.nombre ?? null,
        }
      })

      setPredios(prediosPlanos)
      setMiembros(resMiembros.data ?? [])
      setSectores(resSectores.data ?? [])
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al cargar los datos.' })
    } finally {
      setCargando(false)
    }
  }, [juntaId])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // ─── Load images for editing predio ────────────────────────────────────────

  async function cargarImagenes(predioId: string) {
    const { data } = await supabase
      .from('imagenes_predios')
      .select('id, predio_id, storage_path')
      .eq('predio_id', predioId)
    setImagenesExistentes((data as ImagenPredio[]) ?? [])
  }

  // ─── Open modals ───────────────────────────────────────────────────────────

  function abrirNuevo() {
    setPredioEditando(null)
    setForm(FORM_VACÍO)
    setErrorMiembro('')
    setImagenesExistentes([])
    setPendingImages([])
    setModalAbierto(true)
  }

  function abrirEditar(p: Predio) {
    setPredioEditando(p)
    setForm({
      miembro_id: p.miembro_id,
      codigo_catastral: p.codigo_catastral ?? '',
      superficie: p.superficie !== null ? String(p.superficie) : '',
      sector_id: p.sector_id ?? '',
      tipo_uso: p.tipo_uso ?? '',
      latitud: p.latitud,
      longitud: p.longitud,
    })
    setErrorMiembro('')
    setPendingImages([])
    cargarImagenes(p.id)
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setPredioEditando(null)
    setPendingImages([])
    setImagenesExistentes([])
  }

  // ─── Image upload ───────────────────────────────────────────────────────────

  async function subirImagenes(predioId: string, files: File[]) {
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${juntaId}/${predioId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('predios-imagenes')
        .upload(path, file)
      if (!error) {
        await supabase
          .from('imagenes_predios')
          .insert({ junta_id: juntaId, predio_id: predioId, storage_path: path })
      }
    }
  }

  function handleNuevaImagen(archivo: File) {
    setPendingImages((prev) => [...prev, archivo])
  }

  function quitarPendiente(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index))
  }

  async function eliminarImagenExistente(imagen: ImagenPredio) {
    await supabase.storage.from('predios-imagenes').remove([imagen.storage_path])
    await supabase.from('imagenes_predios').delete().eq('id', imagen.id)
    setImagenesExistentes((prev) => prev.filter((img) => img.id !== imagen.id))
  }

  // ─── Form submit ───────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.miembro_id) {
      setErrorMiembro('Seleccione un miembro.')
      return
    }
    setErrorMiembro('')
    setGuardando(true)

    try {
      if (predioEditando) {
        // Update
        const { error } = await supabase
          .from('predios')
          .update({
            miembro_id: form.miembro_id,
            codigo_catastral: form.codigo_catastral.trim() || null,
            superficie: form.superficie ? parseFloat(form.superficie) : null,
            sector_id: form.sector_id || null,
            tipo_uso: form.tipo_uso || null,
            latitud: form.latitud,
            longitud: form.longitud,
          })
          .eq('id', predioEditando.id)

        if (error) throw error

        if (pendingImages.length > 0) {
          await subirImagenes(predioEditando.id, pendingImages)
        }

        setAlerta({ tipo: 'exito', mensaje: 'Predio actualizado correctamente.' })
      } else {
        // Insert
        const { data, error } = await supabase
          .from('predios')
          .insert({
            junta_id: juntaId,
            miembro_id: form.miembro_id,
            codigo_catastral: form.codigo_catastral.trim() || null,
            superficie: form.superficie ? parseFloat(form.superficie) : null,
            sector_id: form.sector_id || null,
            tipo_uso: form.tipo_uso || null,
            latitud: form.latitud,
            longitud: form.longitud,
            creado_por: usuario?.id ?? null,
          })
          .select('id')
          .single()

        if (error) throw error

        if (pendingImages.length > 0 && data?.id) {
          await subirImagenes(data.id, pendingImages)
        }

        setAlerta({ tipo: 'exito', mensaje: 'Predio registrado correctamente.' })
      }

      cerrarModal()
      await cargarDatos()
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al guardar. Intente nuevamente.' })
    } finally {
      setGuardando(false)
    }
  }

  // ─── Delete predio ─────────────────────────────────────────────────────────

  async function verificarYEliminar(predio: Predio) {
    // RF-10.3: check if miembro has financial records
    const { count } = await supabase
      .from('ingresos')
      .select('id', { count: 'exact', head: true })
      .eq('miembro_id', predio.miembro_id)
      .eq('junta_id', juntaId!)

    if (count && count > 0) {
      setAlerta({
        tipo: 'advertencia',
        mensaje: 'No se puede eliminar: el miembro tiene registros financieros asociados.',
      })
      return
    }

    setPredioAEliminar(predio)
  }

  async function confirmarEliminar() {
    if (!predioAEliminar) return
    setEliminando(true)

    try {
      // Delete images from storage and DB
      const { data: imagenes } = await supabase
        .from('imagenes_predios')
        .select('id, storage_path')
        .eq('predio_id', predioAEliminar.id)

      if (imagenes && imagenes.length > 0) {
        const paths = imagenes.map((img: { storage_path: string }) => img.storage_path)
        await supabase.storage.from('predios-imagenes').remove(paths)
        await supabase.from('imagenes_predios').delete().eq('predio_id', predioAEliminar.id)
      }

      const { error } = await supabase
        .from('predios')
        .delete()
        .eq('id', predioAEliminar.id)

      if (error) throw error

      setAlerta({ tipo: 'exito', mensaje: 'Predio eliminado correctamente.' })
      setPredioAEliminar(null)
      await cargarDatos()
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al eliminar el predio.' })
    } finally {
      setEliminando(false)
    }
  }

  // ─── Table columns ─────────────────────────────────────────────────────────

  const columnas: ColumnaTabla<Predio>[] = [
    {
      cabecera: 'Miembro',
      accesador: (p) => `${p.miembro_apellidos}, ${p.miembro_nombres}`,
    },
    { cabecera: 'Cédula', accesador: 'miembro_cedula' },
    {
      cabecera: 'Código catastral',
      accesador: (p) => p.codigo_catastral ?? '—',
    },
    {
      cabecera: 'Superficie (m²)',
      accesador: (p) => (p.superficie !== null ? p.superficie : '—'),
    },
    {
      cabecera: 'Sector',
      accesador: (p) => p.sector_nombre ?? '—',
    },
    {
      cabecera: 'Tipo de uso',
      accesador: (p) => p.tipo_uso ?? '—',
    },
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-4">
      {/* Heading row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Predios</h1>
        <Boton variante="primario" onClick={abrirNuevo}>
          + Nuevo predio
        </Boton>
      </div>

      {/* Page alert */}
      {alerta && (
        <Alerta
          tipo={alerta.tipo}
          mensaje={alerta.mensaje}
          onCerrar={() => setAlerta(null)}
        />
      )}

      {/* Table */}
      <Tabla<Predio>
        columnas={columnas}
        datos={predios}
        cargando={cargando}
        camposFiltro={['miembro_apellidos', 'miembro_nombres', 'miembro_cedula', 'codigo_catastral']}
        filasPorPagina={15}
        accionesExtra={(p) => (
          <div className="flex gap-2">
            <Boton variante="fantasma" tamaño="sm" onClick={() => abrirEditar(p)}>
              Ver/Editar
            </Boton>
            <Boton variante="peligro" tamaño="sm" onClick={() => verificarYEliminar(p)}>
              Eliminar
            </Boton>
          </div>
        )}
      />

      {/* ── Create / Edit modal ── */}
      <Modal
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        titulo={predioEditando ? 'Editar predio' : 'Nuevo predio'}
        tamaño="xl"
      >
        <Formulario onSubmit={handleSubmit}>
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left: form fields */}
            <div className="flex-1 space-y-4">
              {/* Miembro */}
              <CampoFormulario label="Miembro" htmlFor="miembro_id" requerido error={errorMiembro}>
                <select
                  id="miembro_id"
                  value={form.miembro_id}
                  onChange={(e) => setForm({ ...form, miembro_id: e.target.value })}
                  className={INPUT_CLASS}
                >
                  <option value="">— Seleccione un miembro —</option>
                  {miembros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.apellidos}, {m.nombres} — {m.cedula}
                    </option>
                  ))}
                </select>
              </CampoFormulario>

              {/* Código catastral */}
              <CampoFormulario label="Código catastral" htmlFor="codigo_catastral">
                <input
                  id="codigo_catastral"
                  type="text"
                  value={form.codigo_catastral}
                  onChange={(e) => setForm({ ...form, codigo_catastral: e.target.value })}
                  className={INPUT_CLASS}
                />
              </CampoFormulario>

              {/* Superficie */}
              <CampoFormulario label="Superficie (m²)" htmlFor="superficie">
                <input
                  id="superficie"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.superficie}
                  onChange={(e) => setForm({ ...form, superficie: e.target.value })}
                  className={INPUT_CLASS}
                />
              </CampoFormulario>

              {/* Sector */}
              <CampoFormulario label="Sector" htmlFor="sector_id">
                <select
                  id="sector_id"
                  value={form.sector_id}
                  onChange={(e) => setForm({ ...form, sector_id: e.target.value })}
                  className={INPUT_CLASS}
                >
                  <option value="">— Sin sector —</option>
                  {sectores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </CampoFormulario>

              {/* Tipo de uso */}
              <CampoFormulario label="Tipo de uso" htmlFor="tipo_uso">
                <select
                  id="tipo_uso"
                  value={form.tipo_uso}
                  onChange={(e) => setForm({ ...form, tipo_uso: e.target.value })}
                  className={INPUT_CLASS}
                >
                  <option value="">— Sin especificar —</option>
                  {TIPOS_USO.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </CampoFormulario>

              {/* Coordinates (readonly, filled by map) */}
              <div className="grid grid-cols-2 gap-4">
                <CampoFormulario label="Latitud" htmlFor="latitud">
                  <input
                    id="latitud"
                    type="number"
                    readOnly
                    value={form.latitud ?? ''}
                    className={INPUT_CLASS + ' bg-gray-50 cursor-default'}
                  />
                </CampoFormulario>
                <CampoFormulario label="Longitud" htmlFor="longitud">
                  <input
                    id="longitud"
                    type="number"
                    readOnly
                    value={form.longitud ?? ''}
                    className={INPUT_CLASS + ' bg-gray-50 cursor-default'}
                  />
                </CampoFormulario>
              </div>

              {/* Images section */}
              <div className="space-y-3 pt-2 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">Imágenes del predio</h3>

                {/* Existing images (edit mode) */}
                {imagenesExistentes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {imagenesExistentes.map((img) => (
                      <div key={img.id} className="relative group">
                        <div className="w-16 h-16 rounded border border-gray-200 bg-gray-100 flex items-center justify-center overflow-hidden">
                          <span className="text-xs text-gray-400 text-center px-1 break-all">
                            {img.storage_path.split('/').pop()}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => eliminarImagenExistente(img)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 leading-none"
                          aria-label="Eliminar imagen"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <SubidaArchivo
                  tiposPermitidos={['image/jpeg', 'image/png', 'image/webp']}
                  tamañoMaxMB={5}
                  etiqueta="Agregar imagen"
                  onArchivo={handleNuevaImagen}
                />

                {/* Pending images list */}
                {pendingImages.length > 0 && (
                  <ul className="space-y-1">
                    {pendingImages.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between text-sm text-gray-700 bg-gray-50 rounded px-3 py-1.5"
                      >
                        <span className="truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => quitarPendiente(i)}
                          className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
                          aria-label="Quitar imagen pendiente"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Right: map */}
            <div className="flex-1 min-w-0">
              <MapaPredio
                latitud={form.latitud}
                longitud={form.longitud}
                onCoordenadas={(lat, lng) =>
                  setForm((prev) => ({ ...prev, latitud: lat, longitud: lng }))
                }
                height="350px"
              />
              <p className="mt-1 text-xs text-gray-500">
                Haz clic en el mapa para fijar la ubicación.
              </p>
            </div>
          </div>

          {/* Modal footer */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <Boton type="button" variante="secundario" onClick={cerrarModal}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="primario" cargando={guardando}>
              {predioEditando ? 'Guardar cambios' : 'Registrar'}
            </Boton>
          </div>
        </Formulario>
      </Modal>

      {/* ── Delete confirmation modal ── */}
      <Modal
        abierto={!!predioAEliminar}
        onCerrar={() => setPredioAEliminar(null)}
        titulo="Eliminar predio"
        tamaño="sm"
      >
        <p className="text-sm text-gray-700">
          ¿Eliminar el predio con código{' '}
          <strong>«{predioAEliminar?.codigo_catastral ?? 'Sin código'}»</strong>?
          Esta acción no se puede deshacer y se eliminarán todas las imágenes asociadas.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Boton
            type="button"
            variante="secundario"
            onClick={() => setPredioAEliminar(null)}
          >
            Cancelar
          </Boton>
          <Boton
            type="button"
            variante="peligro"
            cargando={eliminando}
            onClick={confirmarEliminar}
          >
            Eliminar
          </Boton>
        </div>
      </Modal>
    </div>
  )
}
