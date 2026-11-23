import React, { useState, useMemo } from 'react'

export interface ColumnaTabla<T> {
  cabecera: string
  accesador: keyof T | ((fila: T) => React.ReactNode)
  className?: string
}

export interface TablaProps<T> {
  columnas: ColumnaTabla<T>[]
  datos: T[]
  cargando?: boolean
  filtroPorDefecto?: string
  camposFiltro?: (keyof T)[]
  filasPorPagina?: number
  accionesExtra?: (fila: T) => React.ReactNode
}

function getCellValue<T>(fila: T, accesador: ColumnaTabla<T>['accesador']): React.ReactNode {
  if (typeof accesador === 'function') return accesador(fila)
  const val = fila[accesador]
  if (val === null || val === undefined) return ''
  return String(val)
}

export function Tabla<T extends object>({
  columnas,
  datos,
  cargando = false,
  filtroPorDefecto = '',
  camposFiltro = [],
  filasPorPagina = 10,
  accionesExtra,
}: TablaProps<T>) {
  const [filtro, setFiltro] = useState(filtroPorDefecto)
  const [pagina, setPagina] = useState(1)

  const datosFiltrados = useMemo(() => {
    if (!filtro.trim() || camposFiltro.length === 0) return datos
    const q = filtro.toLowerCase()
    return datos.filter((fila) =>
      camposFiltro.some((campo) => {
        const val = fila[campo]
        return val !== null && val !== undefined && String(val).toLowerCase().includes(q)
      })
    )
  }, [datos, filtro, camposFiltro])

  const totalPaginas = Math.max(1, Math.ceil(datosFiltrados.length / filasPorPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * filasPorPagina
  const datosPagina = datosFiltrados.slice(inicio, inicio + filasPorPagina)

  const handleFiltro = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiltro(e.target.value)
    setPagina(1)
  }

  const columnasFinal = accionesExtra
    ? [...columnas, { cabecera: 'Acciones', accesador: accionesExtra } as ColumnaTabla<T>]
    : columnas

  return (
    <div className="flex flex-col gap-3">
      {/* Filter */}
      {camposFiltro.length > 0 && (
        <input
          type="text"
          value={filtro}
          onChange={handleFiltro}
          placeholder="Buscar..."
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-sm text-gray-700">
          <thead>
            <tr className="bg-gray-100 text-left">
              {columnasFinal.map((col, i) => (
                <th
                  key={i}
                  className={`px-4 py-3 font-semibold text-gray-600 ${col.className ?? ''}`}
                >
                  {col.cabecera}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-gray-100">
                  {columnasFinal.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : datosPagina.length === 0 ? (
              <tr>
                <td
                  colSpan={columnasFinal.length}
                  className="px-4 py-10 text-center text-gray-400"
                >
                  No hay registros
                </td>
              </tr>
            ) : (
              datosPagina.map((fila, i) => (
                <tr
                  key={i}
                  className="border-t border-gray-100 even:bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  {columnas.map((col, j) => (
                    <td key={j} className={`px-4 py-3 ${col.className ?? ''}`}>
                      {getCellValue(fila, col.accesador)}
                    </td>
                  ))}
                  {accionesExtra && (
                    <td className="px-4 py-3">{accionesExtra(fila)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!cargando && datosFiltrados.length > filasPorPagina && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <button
            type="button"
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={paginaActual === 1}
            className="px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <span>
            Página {paginaActual} de {totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={paginaActual === totalPaginas}
            className="px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
