/**
 * Converts an array of objects to a CSV string and triggers a browser download.
 * @param datos - Array of plain objects
 * @param nombreArchivo - Filename without extension
 */
export function descargarCSV(datos: Record<string, unknown>[], nombreArchivo: string): void {
  if (datos.length === 0) {
    const link = document.createElement('a')
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('sin_datos\n')
    link.download = `${nombreArchivo}.csv`
    link.click()
    return
  }

  const cabeceras = Object.keys(datos[0])
  const filas = datos.map((fila) =>
    cabeceras
      .map((col) => {
        const val = fila[col]
        if (val === null || val === undefined) return ''
        const str = String(val)
        // Escape: wrap in quotes if contains comma, newline or quote; double up quotes
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      })
      .join(',')
  )

  const csv = [cabeceras.join(','), ...filas].join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }) // BOM for Excel
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${nombreArchivo}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
