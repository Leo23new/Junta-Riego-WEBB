import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import useAuth from '../../hooks/useAuth'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { Modal } from '../../components/ui/Modal'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'
import { SubidaArchivo } from '../../components/ui/SubidaArchivo'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ComprobanteRow {
  key: string
  origen: 'ingreso' | 'egreso'
  registro_id: string
  referencia: string
  fecha: string
  descripcion: string
  monto: number
  metodo_pago: string
  comprobante_path: string | null
}

interface IngresoRaw {
  id: string
  fecha: string
  concepto: string
  monto: number
  metodo_pago: string
  numero_recibo: string | null
  comprobante_path: string | null
}

interface EgresoRaw {
  id: string
  fecha: string
  descripcion: string
  monto: number
  metodo_pago: string
  comprobante_path: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function esPdf(path: string): boolean {
  return path.toLowerCase().endsWith('.pdf')
}

function extensionDe(archivo: File): string {
  const partes = archivo.name.split('.')
  const ext = partes.length > 1 ? partes[partes.length - 1] : 'bin'
  return ext.toLowerCase()
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Comprobantes() {
  const { juntaId } = useAuth()

  // Data
  const [registros, setRegistros] = useState<ComprobanteRow[]>([])
  const [cargando, setCargando] = useState(true)

  // Filters
  const [filtroOrigen, setFiltroOrigen] = useState('todos')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  // Page-level alert
  const [alerta, setAlerta] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)
  useEffect(() => {
    if (!alerta) return
    const t = setTimeout(() => setAlerta(null), 4000)
    return () => clearTimeout(t)
  }, [alerta])

  // Viewer modal
  const [verRow, setVerRow] = useState<ComprobanteRow | null>(null)
  const [verUrl, setVerUrl] = useState<string | null>(null)
  const [verCargando, setVerCargando] = useState(false)

  // Attach modal
  const [adjuntarRow, setAdjuntarRow] = useState<ComprobanteRow | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorAdjuntar, setErrorAdjuntar] = useState<string | null>(null)

  // Delete modal
  const [eliminarRow, setEliminarRow] = useState<ComprobanteRow | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  // ─── Load data ─────────────────────────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    if (!juntaId) return
    setCargando(true)
    try {
      const [ing, egr] = await Promise.all([
        supabase
          .from('ingresos')
          .select('id, fecha, concepto, monto, metodo_pago, numero_recibo, comprobante_path')
          .eq('junta_id', juntaId)
          .order('fecha', { ascending: false }),
        supabase
          .from('egresos')
          .select('id, fecha, descripcion, monto, metodo_pago, comprobante_path')
          .eq('junta_id', juntaId)
          .order('fecha', { ascending: false }),
      ])

      if (ing.error) throw ing.error
      if (egr.error) throw egr.error

      const filasIngreso = ((ing.data ?? []) as unknown as IngresoRaw[]).map((r) => ({
        key: `ingreso-${r.id}`,
        origen: 'ingreso' as const,
        registro_id: r.id,
        referencia: r.numero_recibo ?? '—',
        fecha: r.fecha,
        descripcion: r.concepto,
        monto: Number(r.monto),
        metodo_pago: r.metodo_pago ?? '—',
        comprobante_path: r.comprobante_path ?? null,
      }))

      const filasEgreso = ((egr.data ?? []) as unknown as EgresoRaw[]).map((r) => ({
        key: `egreso-${r.id}`,
        origen: 'egreso' as const,
        registro_id: r.id,
        referencia: 'Egreso',
        fecha: r.fecha,
        descripcion: r.descripcion,
        monto: Number(r.monto),
        metodo_pago: r.metodo_pago ?? '—',
        comprobante_path: r.comprobante_path ?? null,
      }))

      // Rows with comprobante first, then missing ones at the end
      const todas = [...filasIngreso, ...filasEgreso]
      const conComprobante = todas.filter((r) => r.comprobante_path)
      const sinComprobante = todas.filter((r) => !r.comprobante_path)
      setRegistros([...conComprobante, ...sinComprobante])
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al cargar los comprobantes.' })
    } finally {
      setCargando(false)
    }
  }, [juntaId])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // ─── Client-side filters ───────────────────────────────────────────────────

  const registrosFiltrados = registros.filter((r) => {
    if (filtroOrigen !== 'todos' && r.origen !== filtroOrigen) return false
    if (filtroDesde && r.fecha < filtroDesde) return false
    if (filtroHasta && r.fecha > filtroHasta) return false
    return true
  })

  const conComprobante = registrosFiltrados.filter((r) => r.comprobante_path).length
  const sinComprobante = registrosFiltrados.filter((r) => !r.comprobante_path).length

  // ─── Viewer ────────────────────────────────────────────────────────────────

  async function abrirVer(fila: ComprobanteRow) {
    if (!fila.comprobante_path) return
    setVerRow(fila)
    setVerUrl(null)
    setVerCargando(true)
    try {
      const { data, error } = await supabase.storage
        .from('comprobantes')
        .createSignedUrl(fila.comprobante_path, 600)
      if (error || !data?.signedUrl) throw error
      setVerUrl(data.signedUrl)
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'No se pudo abrir el comprobante.' })
      setVerRow(null)
    } finally {
      setVerCargando(false)
    }
  }

  function cerrarVer() {
    setVerRow(null)
    setVerUrl(null)
  }

  // ─── Attach ────────────────────────────────────────────────────────────────

  function abrirAdjuntar(fila: ComprobanteRow) {
    setAdjuntarRow(fila)
    setArchivo(null)
    setErrorAdjuntar(null)
  }

  function cerrarAdjuntar() {
    setAdjuntarRow(null)
    setArchivo(null)
    setErrorAdjuntar(null)
  }

  async function handleAdjuntar() {
    if (!adjuntarRow || !juntaId) return
    if (!archivo) {
      setErrorAdjuntar('Seleccione un archivo para adjuntar.')
      return
    }

    setGuardando(true)
    setErrorAdjuntar(null)
    try {
      const ext = extensionDe(archivo)
      const path = `${juntaId}/${adjuntarRow.origen === 'ingreso' ? 'I' : 'E'}-${adjuntarRow.registro_id}.${ext}`

      const { error: errSubida } = await supabase.storage
        .from('comprobantes')
        .upload(path, archivo, { upsert: true })
      if (errSubida) throw errSubida

      const tabla = adjuntarRow.origen === 'ingreso' ? 'ingresos' : 'egresos'
      const { error: errUpdate } = await supabase
        .from(tabla)
        .update({ comprobante_path: path })
        .eq('id', adjuntarRow.registro_id)
      if (errUpdate) throw errUpdate

      cerrarAdjuntar()
      await cargarDatos()
      setAlerta({ tipo: 'exito', mensaje: 'Comprobante adjuntado correctamente.' })
    } catch {
      setErrorAdjuntar('Error al adjuntar el comprobante. Intente nuevamente.')
    } finally {
      setGuardando(false)
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async function handleEliminar() {
    if (!eliminarRow?.comprobante_path) return
    setEliminando(true)
    setErrorEliminar(null)
    try {
      const { error: errRemove } = await supabase.storage
        .from('comprobantes')
        .remove([eliminarRow.comprobante_path])
      if (errRemove) throw errRemove

      const tabla = eliminarRow.origen === 'ingreso' ? 'ingresos' : 'egresos'
      const { error: errUpdate } = await supabase
        .from(tabla)
        .update({ comprobante_path: null })
        .eq('id', eliminarRow.registro_id)
      if (errUpdate) throw errUpdate

      setEliminarRow(null)
      await cargarDatos()
      setAlerta({ tipo: 'exito', mensaje: 'Comprobante eliminado y desvinculado.' })
    } catch {
      setErrorEliminar('Error al eliminar el comprobante. Intente nuevamente.')
    } finally {
      setEliminando(false)
    }
  }

  // ─── Table columns ─────────────────────────────────────────────────────────

  const columnas: ColumnaTabla<ComprobanteRow>[] = [
    {
      cabecera: 'Tipo',
      accesador: (r) => (
        <span
          className={[
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
            r.origen === 'ingreso'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800',
          ].join(' ')}
        >
          {r.origen === 'ingreso' ? 'Ingreso' : 'Egreso'}
        </span>
      ),
    },
    { cabecera: 'Referencia', accesador: 'referencia' },
    { cabecera: 'Fecha', accesador: (r) => formatearFecha(r.fecha) },
    {
      cabecera: 'Descripción',
      accesador: (r) => (
        <span title={r.descripcion} className="block max-w-xs truncate">
          {r.descripcion}
        </span>
      ),
    },
    { cabecera: 'Monto', accesador: (r) => `$${r.monto.toFixed(2)}` },
    {
      cabecera: 'Comprobante',
      accesador: (r) =>
        r.comprobante_path ? (
          <button
            type="button"
            onClick={() => abrirVer(r)}
            className="text-green-700 font-medium underline hover:text-green-900"
          >
            Sí
          </button>
        ) : (
          'No'
        ),
    },
    {
      cabecera: 'Acciones',
      accesador: (r) => (
        <div className="flex items-center gap-2">
          {!r.comprobante_path && (
            <Boton variante="secundario" tamaño="sm" onClick={() => abrirAdjuntar(r)}>
              Adjuntar
            </Boton>
          )}
          {r.comprobante_path && (
            <>
              <Boton variante="fantasma" tamaño="sm" onClick={() => abrirVer(r)}>
                Ver
              </Boton>
              <Boton
                variante="peligro"
                tamaño="sm"
                onClick={() => {
                  setEliminarRow(r)
                  setErrorEliminar(null)
                }}
              >
                Eliminar
              </Boton>
            </>
          )}
        </div>
      ),
    },
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-4">
      {/* Heading */}
      <h1 className="text-2xl font-bold text-gray-800">Comprobantes de pago</h1>

      {/* Page alert */}
      {alerta && (
        <Alerta tipo={alerta.tipo} mensaje={alerta.mensaje} onCerrar={() => setAlerta(null)} />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-origen" className="text-sm font-medium text-gray-600">
            Origen
          </label>
          <select
            id="filtro-origen"
            value={filtroOrigen}
            onChange={(e) => setFiltroOrigen(e.target.value)}
            className={INPUT_CLASS + ' w-40'}
          >
            <option value="todos">Todos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Egresos</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-desde" className="text-sm font-medium text-gray-600">
            Desde
          </label>
          <input
            id="filtro-desde"
            type="date"
            value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)}
            className={INPUT_CLASS + ' w-40'}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-hasta" className="text-sm font-medium text-gray-600">
            Hasta
          </label>
          <input
            id="filtro-hasta"
            type="date"
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
            className={INPUT_CLASS + ' w-40'}
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[180px] rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Con comprobante</p>
          <p className="text-2xl font-bold text-green-700">{conComprobante}</p>
        </div>
        <div className="flex-1 min-w-[180px] rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Sin comprobante</p>
          <p className="text-2xl font-bold text-gray-400">{sinComprobante}</p>
        </div>
      </div>

      {/* Table */}
      <Tabla<ComprobanteRow>
        columnas={columnas}
        datos={registrosFiltrados}
        cargando={cargando}
        camposFiltro={['descripcion', 'referencia']}
        filasPorPagina={15}
      />

      {/* ── Viewer modal ── */}
      <Modal
        abierto={!!verRow}
        onCerrar={cerrarVer}
        titulo="Comprobante"
        tamaño="lg"
      >
        <div className="flex flex-col gap-4">
          {verCargando && (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-green-700" />
            </div>
          )}
          {verUrl && verRow?.comprobante_path && esPdf(verRow.comprobante_path) && (
            <iframe
              src={verUrl}
              title="Comprobante PDF"
              className="w-full h-[500px] rounded-md border border-gray-200"
            />
          )}
          {verUrl && verRow?.comprobante_path && !esPdf(verRow.comprobante_path) && (
            <img
              src={verUrl}
              alt="Comprobante"
              className="max-h-[500px] mx-auto rounded-md"
            />
          )}
          {verUrl && (
            <div className="flex justify-end">
              <Boton
                variante="secundario"
                onClick={() => window.open(verUrl, '_blank')}
              >
                Abrir en nueva pestaña
              </Boton>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Attach modal ── */}
      <Modal
        abierto={!!adjuntarRow}
        onCerrar={cerrarAdjuntar}
        titulo="Adjuntar comprobante"
        tamaño="md"
      >
        {adjuntarRow && (
          <div className="flex flex-col gap-4">
            {/* Read-only summary */}
            <div className="grid grid-cols-3 gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
              <div>
                <p className="text-gray-500">Tipo</p>
                <p className="font-semibold text-gray-800">
                  {adjuntarRow.origen === 'ingreso' ? 'Ingreso' : 'Egreso'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Fecha</p>
                <p className="font-semibold text-gray-800">
                  {formatearFecha(adjuntarRow.fecha)}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Monto</p>
                <p className="font-semibold text-gray-800">
                  ${adjuntarRow.monto.toFixed(2)}
                </p>
              </div>
            </div>

            <SubidaArchivo
              tiposPermitidos={['image/jpeg', 'image/png', 'application/pdf']}
              tamañoMaxMB={10}
              etiqueta="Comprobante (JPG/PNG/PDF, máx. 10 MB)"
              onArchivo={(f) => setArchivo(f)}
            />

            {errorAdjuntar && (
              <Alerta
                tipo="error"
                mensaje={errorAdjuntar}
                onCerrar={() => setErrorAdjuntar(null)}
              />
            )}

            <div className="flex justify-end gap-3">
              <Boton variante="secundario" onClick={cerrarAdjuntar} disabled={guardando}>
                Cancelar
              </Boton>
              <Boton
                variante="primario"
                onClick={handleAdjuntar}
                cargando={guardando}
                disabled={!archivo}
              >
                Adjuntar
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete confirmation modal ── */}
      <Modal
        abierto={!!eliminarRow}
        onCerrar={() => setEliminarRow(null)}
        titulo="Eliminar comprobante"
        tamaño="md"
      >
        {eliminarRow && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-700">
              ¿Eliminar el comprobante de{' '}
              <span className="font-semibold">{eliminarRow.descripcion}</span>? El archivo se
              eliminará del almacenamiento y quedará desvinculado del registro.
            </p>

            {errorEliminar && (
              <Alerta
                tipo="error"
                mensaje={errorEliminar}
                onCerrar={() => setErrorEliminar(null)}
              />
            )}

            <div className="flex justify-end gap-3">
              <Boton
                variante="secundario"
                onClick={() => setEliminarRow(null)}
                disabled={eliminando}
              >
                Cancelar
              </Boton>
              <Boton
                variante="peligro"
                onClick={handleEliminar}
                cargando={eliminando}
              >
                Eliminar
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
