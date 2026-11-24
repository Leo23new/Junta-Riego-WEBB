import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import useAuth from '../../hooks/useAuth'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { Modal } from '../../components/ui/Modal'
import { Formulario, CampoFormulario } from '../../components/ui/Formulario'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Articulo {
  id: string
  junta_id: string
  codigo: string
  nombre: string
  unidad_medida: string
  stock_actual: number
  stock_minimo: number
  categoria: string | null
  created_at: string
}

interface Movimiento {
  id: string
  junta_id: string
  articulo_id: string
  tipo: 'entrada' | 'salida'
  cantidad: number
  fecha: string
  motivo: string | null
  registrado_por: string | null
  created_at: string
  inventario_articulos?: { nombre: string; unidad_medida: string } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

const UNIDADES = ['Unidad', 'Litro', 'Metro', 'Kg', 'Caja', 'Saco', 'Galón']

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function hoyISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// ─── Form states ─────────────────────────────────────────────────────────────

interface ArticuloFormState {
  codigo: string
  nombre: string
  unidad_medida: string
  stockInicial: string
  stockMinimo: string
  categoria: string
}

const ARTICULO_VACÍO: ArticuloFormState = {
  codigo: '',
  nombre: '',
  unidad_medida: 'Unidad',
  stockInicial: '0',
  stockMinimo: '0',
  categoria: '',
}

interface MovimientoFormState {
  articuloId: string
  tipo: 'entrada' | 'salida'
  cantidad: string
  fecha: string
  motivo: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Inventario() {
  const { usuario, juntaId } = useAuth()

  // Data
  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoMovimientos, setCargandoMovimientos] = useState(true)

  // Tabs
  const [tab, setTab] = useState<'articulos' | 'movimientos'>('articulos')

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

  // Article modal
  const [modalArticulo, setModalArticulo] = useState(false)
  const [editando, setEditando] = useState<Articulo | null>(null)
  const [formArticulo, setFormArticulo] = useState<ArticuloFormState>(ARTICULO_VACÍO)
  const [erroresArticulo, setErroresArticulo] = useState<Partial<ArticuloFormState>>({})
  const [guardandoArticulo, setGuardandoArticulo] = useState(false)

  // Delete confirmation
  const [articuloEliminar, setArticuloEliminar] = useState<Articulo | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // Movement form
  const [formMov, setFormMov] = useState<MovimientoFormState>({
    articuloId: '',
    tipo: 'entrada',
    cantidad: '',
    fecha: hoyISO(),
    motivo: '',
  })
  const [erroresMov, setErroresMov] = useState<{
    articuloId?: string
    cantidad?: string
    fecha?: string
  }>({})
  const [guardandoMov, setGuardandoMov] = useState(false)

  // ─── Load data ─────────────────────────────────────────────────────────────

  const cargarArticulos = useCallback(async () => {
    if (!juntaId) return
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('inventario_articulos')
        .select('*')
        .eq('junta_id', juntaId)
        .order('codigo')

      if (error) throw error

      setArticulos(
        ((data ?? []) as unknown as Array<
          Omit<Articulo, 'stock_actual' | 'stock_minimo'> & {
            stock_actual: string | number
            stock_minimo: string | number
          }
        >).map((r) => ({ ...r, stock_actual: Number(r.stock_actual), stock_minimo: Number(r.stock_minimo) })),
      )
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al cargar los artículos.' })
    } finally {
      setCargando(false)
    }
  }, [juntaId])

  const cargarMovimientos = useCallback(async () => {
    if (!juntaId) return
    setCargandoMovimientos(true)
    try {
      const { data, error } = await supabase
        .from('inventario_movimientos')
        .select('*, inventario_articulos(nombre, unidad_medida)')
        .eq('junta_id', juntaId)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      setMovimientos(
        ((data ?? []) as unknown as Array<
          Omit<Movimiento, 'cantidad'> & { cantidad: string | number }
        >).map((r) => ({ ...r, cantidad: Number(r.cantidad) })),
      )
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al cargar los movimientos.' })
    } finally {
      setCargandoMovimientos(false)
    }
  }, [juntaId])

  useEffect(() => {
    cargarArticulos()
    cargarMovimientos()
  }, [cargarArticulos, cargarMovimientos])

  // ─── Low stock summary ─────────────────────────────────────────────────────

  const bajoMinimo = articulos.filter((a) => a.stock_actual < a.stock_minimo)

  // ─── Article modal handlers ───────────────────────────────────────────────

  function abrirNuevo() {
    setEditando(null)
    setFormArticulo({ ...ARTICULO_VACÍO })
    setErroresArticulo({})
    setModalArticulo(true)
  }

  function abrirEditar(a: Articulo) {
    setEditando(a)
    setFormArticulo({
      codigo: a.codigo,
      nombre: a.nombre,
      unidad_medida: a.unidad_medida,
      stockInicial: String(a.stock_actual),
      stockMinimo: String(a.stock_minimo),
      categoria: a.categoria ?? '',
    })
    setErroresArticulo({})
    setModalArticulo(true)
  }

  function cerrarModalArticulo() {
    setModalArticulo(false)
    setEditando(null)
  }

  async function guardarArticulo(e: React.FormEvent) {
    e.preventDefault()

    const nuevosErrores: Partial<ArticuloFormState> = {}
    if (!formArticulo.codigo.trim()) nuevosErrores.codigo = 'Campo requerido.'
    if (!formArticulo.nombre.trim()) nuevosErrores.nombre = 'Campo requerido.'
    if (!formArticulo.unidad_medida) nuevosErrores.unidad_medida = 'Campo requerido.'
    const min = parseFloat(formArticulo.stockMinimo)
    if (formArticulo.stockMinimo === '' || isNaN(min) || min < 0)
      nuevosErrores.stockMinimo = 'Debe ser 0 o mayor.'

    if (Object.keys(nuevosErrores).length > 0) {
      setErroresArticulo(nuevosErrores)
      return
    }
    setErroresArticulo({})

    setGuardandoArticulo(true)
    try {
      // Uniqueness check (codigo per junta)
      let query = supabase
        .from('inventario_articulos')
        .select('id')
        .eq('junta_id', juntaId!)
        .eq('codigo', formArticulo.codigo.trim())
      if (editando) query = query.neq('id', editando.id)

      const { data: existentes } = await query
      if (existentes && existentes.length > 0) {
        setErroresArticulo({ codigo: 'Ya existe un artículo con este código.' })
        return
      }

      if (editando) {
        const { error } = await supabase
          .from('inventario_articulos')
          .update({
            codigo: formArticulo.codigo.trim(),
            nombre: formArticulo.nombre.trim(),
            unidad_medida: formArticulo.unidad_medida,
            stock_minimo: parseFloat(formArticulo.stockMinimo),
            categoria: formArticulo.categoria.trim() || null,
          })
          .eq('id', editando.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('inventario_articulos').insert({
          junta_id: juntaId!,
          codigo: formArticulo.codigo.trim(),
          nombre: formArticulo.nombre.trim(),
          unidad_medida: formArticulo.unidad_medida,
          stock_actual: parseFloat(formArticulo.stockInicial) || 0,
          stock_minimo: parseFloat(formArticulo.stockMinimo) || 0,
          categoria: formArticulo.categoria.trim() || null,
        })
        if (error) throw error
      }

      cerrarModalArticulo()
      await cargarArticulos()
      setAlerta({
        tipo: 'exito',
        mensaje: editando ? 'Artículo actualizado correctamente.' : 'Artículo registrado correctamente.',
      })
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al guardar el artículo. Intente nuevamente.' })
    } finally {
      setGuardandoArticulo(false)
    }
  }

  // ─── Delete article ────────────────────────────────────────────────────────

  async function confirmarEliminar() {
    if (!articuloEliminar) return
    setEliminando(true)
    try {
      const { count, error: errCount } = await supabase
        .from('inventario_movimientos')
        .select('id', { count: 'exact', head: true })
        .eq('articulo_id', articuloEliminar.id)

      if (errCount) throw errCount

      if (count && count > 0) {
        setArticuloEliminar(null)
        setAlerta({ tipo: 'advertencia', mensaje: 'No se puede eliminar: el artículo tiene movimientos registrados.' })
        return
      }

      const { error } = await supabase
        .from('inventario_articulos')
        .delete()
        .eq('id', articuloEliminar.id)
      if (error) throw error

      setArticuloEliminar(null)
      await cargarArticulos()
      setAlerta({ tipo: 'exito', mensaje: 'Artículo eliminado.' })
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al eliminar el artículo.' })
    } finally {
      setEliminando(false)
    }
  }

  // ─── Movement submit ───────────────────────────────────────────────────────

  async function registrarMovimiento(e: React.FormEvent) {
    e.preventDefault()

    const nuevosErrores: { articuloId?: string; cantidad?: string; fecha?: string } = {}
    if (!formMov.articuloId) nuevosErrores.articuloId = 'Campo requerido.'
    const cantidad = parseFloat(formMov.cantidad)
    if (!formMov.cantidad || isNaN(cantidad) || cantidad <= 0)
      nuevosErrores.cantidad = 'Debe ser mayor a 0.'
    if (!formMov.fecha) nuevosErrores.fecha = 'Campo requerido.'

    if (Object.keys(nuevosErrores).length > 0) {
      setErroresMov(nuevosErrores)
      return
    }
    setErroresMov({})

    const articulo = articulos.find((a) => a.id === formMov.articuloId)
    if (!articulo) {
      setErroresMov({ articuloId: 'Artículo no válido.' })
      return
    }

    // Stock check for salida
    if (formMov.tipo === 'salida' && articulo.stock_actual < cantidad) {
      setErroresMov({
        cantidad: `Stock insuficiente. Disponible: ${articulo.stock_actual} ${articulo.unidad_medida}.`,
      })
      return
    }

    setGuardandoMov(true)
    try {
      // Insert movement
      const { error: errInsert } = await supabase.from('inventario_movimientos').insert({
        junta_id: juntaId!,
        articulo_id: formMov.articuloId,
        tipo: formMov.tipo,
        cantidad: parseFloat(formMov.cantidad),
        fecha: formMov.fecha,
        motivo: formMov.motivo.trim() || null,
        registrado_por: usuario?.id,
      })
      if (errInsert) throw errInsert

      // Recalculate stock
      const nuevoStock =
        formMov.tipo === 'entrada'
          ? articulo.stock_actual + cantidad
          : articulo.stock_actual - cantidad

      const { error: errUpdate } = await supabase
        .from('inventario_articulos')
        .update({ stock_actual: nuevoStock })
        .eq('id', formMov.articuloId)
      if (errUpdate) throw errUpdate

      await Promise.all([cargarArticulos(), cargarMovimientos()])

      if (formMov.tipo === 'salida' && nuevoStock < articulo.stock_minimo) {
        setAlerta({
          tipo: 'advertencia',
          mensaje: `El artículo ${articulo.nombre} quedó por debajo del stock mínimo (${nuevoStock} ${articulo.unidad_medida}).`,
        })
      } else {
        setAlerta({ tipo: 'exito', mensaje: 'Movimiento registrado.' })
      }

      // Clear form (keep tipo)
      setFormMov((f) => ({ ...f, articuloId: '', cantidad: '', fecha: hoyISO(), motivo: '' }))
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al registrar el movimiento. Intente nuevamente.' })
    } finally {
      setGuardandoMov(false)
    }
  }

  function irAMovimientos(articulo: Articulo) {
    setFormMov((f) => ({ ...f, articuloId: articulo.id }))
    setTab('movimientos')
  }

  // ─── Article table columns ──────────────────────────────────────────────────

  const columnas: ColumnaTabla<Articulo>[] = [
    { cabecera: 'Código', accesador: 'codigo' },
    { cabecera: 'Nombre', accesador: 'nombre' },
    { cabecera: 'Unidad', accesador: 'unidad_medida' },
    {
      cabecera: 'Stock actual',
      accesador: (a) =>
        a.stock_actual < a.stock_minimo ? (
          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">
            {a.stock_actual} (bajo mínimo)
          </span>
        ) : (
          a.stock_actual
        ),
    },
    { cabecera: 'Stock mínimo', accesador: (a) => a.stock_minimo },
    { cabecera: 'Categoría', accesador: (a) => a.categoria || '—' },
  ]

  // ─── Movement table columns ─────────────────────────────────────────────────

  const columnasMov: ColumnaTabla<Movimiento>[] = [
    { cabecera: 'Fecha', accesador: (m) => formatearFecha(m.fecha) },
    { cabecera: 'Artículo', accesador: (m) => m.inventario_articulos?.nombre ?? '—' },
    {
      cabecera: 'Tipo',
      accesador: (m) =>
        m.tipo === 'entrada' ? (
          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
            Entrada
          </span>
        ) : (
          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">
            Salida
          </span>
        ),
    },
    {
      cabecera: 'Cantidad',
      accesador: (m) => `${m.cantidad} ${m.inventario_articulos?.unidad_medida ?? ''}`.trim(),
    },
    { cabecera: 'Motivo', accesador: (m) => m.motivo || '—' },
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-4">
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Inventario</h1>
        {tab === 'articulos' && (
          <Boton variante="primario" onClick={abrirNuevo}>
            + Nuevo artículo
          </Boton>
        )}
      </div>

      {/* Page alert */}
      {alerta && <Alerta tipo={alerta.tipo} mensaje={alerta.mensaje} onCerrar={() => setAlerta(null)} />}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('articulos')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'articulos' ? 'bg-green-700 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Artículos
        </button>
        <button
          type="button"
          onClick={() => setTab('movimientos')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'movimientos' ? 'bg-green-700 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Movimientos
        </button>
      </div>

      {/* ── Tab 1: Artículos ── */}
      {tab === 'articulos' && (
        <div className="space-y-4">
          {bajoMinimo.length > 0 && (
            <Alerta
              tipo="advertencia"
              mensaje={`${bajoMinimo.length} artículo(s) por debajo del stock mínimo: ${bajoMinimo
                .map((a) => a.nombre)
                .join(', ')}`}
            />
          )}

          <Tabla<Articulo>
            columnas={columnas}
            datos={articulos}
            cargando={cargando}
            camposFiltro={['codigo', 'nombre']}
            filasPorPagina={15}
            accionesExtra={(a) => (
              <div className="flex gap-2">
                <Boton variante="fantasma" tamaño="sm" onClick={() => abrirEditar(a)}>
                  Editar
                </Boton>
                <Boton variante="secundario" tamaño="sm" onClick={() => irAMovimientos(a)}>
                  Movimiento
                </Boton>
                <Boton variante="peligro" tamaño="sm" onClick={() => setArticuloEliminar(a)}>
                  Eliminar
                </Boton>
              </div>
            )}
          />
        </div>
      )}

      {/* ── Tab 2: Movimientos ── */}
      {tab === 'movimientos' && (
        <div className="space-y-4">
          {/* Movement form card */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Registrar movimiento</h2>
            <Formulario onSubmit={registrarMovimiento}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <CampoFormulario
                  label="Artículo"
                  htmlFor="mov-articulo"
                  requerido
                  error={erroresMov.articuloId}
                >
                  <select
                    id="mov-articulo"
                    value={formMov.articuloId}
                    onChange={(e) => setFormMov({ ...formMov, articuloId: e.target.value })}
                    className={INPUT_CLASS}
                  >
                    <option value="">Seleccione…</option>
                    {articulos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.codigo} — {a.nombre}
                      </option>
                    ))}
                  </select>
                </CampoFormulario>

                <CampoFormulario label="Tipo" htmlFor="mov-tipo" requerido>
                  <select
                    id="mov-tipo"
                    value={formMov.tipo}
                    onChange={(e) =>
                      setFormMov({ ...formMov, tipo: e.target.value as 'entrada' | 'salida' })
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="entrada">Entrada</option>
                    <option value="salida">Salida</option>
                  </select>
                </CampoFormulario>

                <CampoFormulario
                  label="Cantidad"
                  htmlFor="mov-cantidad"
                  requerido
                  error={erroresMov.cantidad}
                >
                  <input
                    id="mov-cantidad"
                    type="number"
                    min={0.001}
                    step={0.001}
                    value={formMov.cantidad}
                    onChange={(e) => setFormMov({ ...formMov, cantidad: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </CampoFormulario>

                <CampoFormulario label="Fecha" htmlFor="mov-fecha" requerido error={erroresMov.fecha}>
                  <input
                    id="mov-fecha"
                    type="date"
                    value={formMov.fecha}
                    onChange={(e) => setFormMov({ ...formMov, fecha: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </CampoFormulario>

                <CampoFormulario label="Motivo" htmlFor="mov-motivo">
                  <input
                    id="mov-motivo"
                    type="text"
                    value={formMov.motivo}
                    onChange={(e) => setFormMov({ ...formMov, motivo: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </CampoFormulario>
              </div>

              <div className="flex justify-end">
                <Boton type="submit" variante="primario" cargando={guardandoMov}>
                  Registrar movimiento
                </Boton>
              </div>
            </Formulario>
          </div>

          {/* History table */}
          <Tabla<Movimiento>
            columnas={columnasMov}
            datos={movimientos}
            cargando={cargandoMovimientos}
            filasPorPagina={15}
          />
        </div>
      )}

      {/* ── Article create/edit modal ── */}
      <Modal
        abierto={modalArticulo}
        onCerrar={cerrarModalArticulo}
        titulo={editando ? 'Editar artículo' : 'Nuevo artículo'}
        tamaño="md"
      >
        <Formulario onSubmit={guardarArticulo}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CampoFormulario
              label="Código"
              htmlFor="art-codigo"
              requerido
              error={erroresArticulo.codigo}
            >
              <input
                id="art-codigo"
                type="text"
                value={formArticulo.codigo}
                onChange={(e) => setFormArticulo({ ...formArticulo, codigo: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            <CampoFormulario
              label="Nombre"
              htmlFor="art-nombre"
              requerido
              error={erroresArticulo.nombre}
            >
              <input
                id="art-nombre"
                type="text"
                value={formArticulo.nombre}
                onChange={(e) => setFormArticulo({ ...formArticulo, nombre: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            <CampoFormulario
              label="Unidad de medida"
              htmlFor="art-unidad"
              requerido
              error={erroresArticulo.unidad_medida}
            >
              <select
                id="art-unidad"
                value={formArticulo.unidad_medida}
                onChange={(e) =>
                  setFormArticulo({ ...formArticulo, unidad_medida: e.target.value })
                }
                className={INPUT_CLASS}
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </CampoFormulario>

            <CampoFormulario
              label="Categoría"
              htmlFor="art-categoria"
              error={erroresArticulo.categoria}
            >
              <input
                id="art-categoria"
                type="text"
                value={formArticulo.categoria}
                onChange={(e) => setFormArticulo({ ...formArticulo, categoria: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            {!editando && (
              <CampoFormulario
                label="Stock inicial"
                htmlFor="art-stock-inicial"
                error={erroresArticulo.stockInicial}
              >
                <input
                  id="art-stock-inicial"
                  type="number"
                  min={0}
                  step={0.001}
                  value={formArticulo.stockInicial}
                  onChange={(e) =>
                    setFormArticulo({ ...formArticulo, stockInicial: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </CampoFormulario>
            )}

            {editando && (
              <CampoFormulario label="Stock actual (solo lectura)" htmlFor="art-stock-actual">
                <input
                  id="art-stock-actual"
                  type="text"
                  value={String(editando.stock_actual)}
                  readOnly
                  disabled
                  className={INPUT_CLASS + ' bg-gray-100 text-gray-500'}
                />
              </CampoFormulario>
            )}

            <CampoFormulario
              label="Stock mínimo"
              htmlFor="art-stock-minimo"
              requerido
              error={erroresArticulo.stockMinimo}
            >
              <input
                id="art-stock-minimo"
                type="number"
                min={0}
                step={0.001}
                value={formArticulo.stockMinimo}
                onChange={(e) =>
                  setFormArticulo({ ...formArticulo, stockMinimo: e.target.value })
                }
                className={INPUT_CLASS}
              />
            </CampoFormulario>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Boton type="button" variante="secundario" onClick={cerrarModalArticulo}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="primario" cargando={guardandoArticulo}>
              {editando ? 'Guardar cambios' : 'Registrar'}
            </Boton>
          </div>
        </Formulario>
      </Modal>

      {/* ── Delete confirmation modal ── */}
      <Modal
        abierto={articuloEliminar !== null}
        onCerrar={() => setArticuloEliminar(null)}
        titulo="Eliminar artículo"
        tamaño="sm"
      >
        <p className="text-sm text-gray-600">
          ¿Está seguro de eliminar el artículo{' '}
          <span className="font-semibold">
            {articuloEliminar?.codigo} — {articuloEliminar?.nombre}
          </span>
          ? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Boton type="button" variante="secundario" onClick={() => setArticuloEliminar(null)}>
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
