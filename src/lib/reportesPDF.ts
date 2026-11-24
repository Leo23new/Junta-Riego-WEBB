import { jsPDF } from 'jspdf'

export interface OpcionesExportarPDF {
  titulo: string
  juntaNombre: string
  periodo: { desde: string; hasta: string }
  columnas: string[]
  filas: (string | number)[][]
  totales?: (string | number)[]
  nombreArchivo: string
}

const MARGEN_IZQ = 14
const ANCHO_UTIL = 182
const ALTO_FILA = 7
const Y_LIMITE = 270

function textoCelda(
  doc: jsPDF,
  valor: string | number,
  x: number,
  ancho: number,
  y: number,
  negrita = false,
): void {
  const s = String(valor ?? '')
  const limitado =
    doc.getTextWidth(s) > ancho - 2 ? doc.splitTextToSize(s, ancho - 2)[0] ?? s : s
  doc.setFont('helvetica', negrita ? 'bold' : 'normal')
  doc.setFontSize(9)
  doc.text(limitado, x + 1, y)
}

export function exportarTablaPDF(opts: OpcionesExportarPDF): void {
  const doc = new jsPDF() // A4 portrait
  const nCols = Math.max(opts.columnas.length, 1)
  const anchoCol = ANCHO_UTIL / nCols
  const xs = Array.from({ length: nCols }, (_, i) => MARGEN_IZQ + i * anchoCol)

  let y = 0

  const renderizarCabecera = () => {
    y = 18
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(opts.juntaNombre, MARGEN_IZQ, y)
    y += 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(opts.titulo, MARGEN_IZQ, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(110, 110, 110)
    doc.text(`Del ${opts.periodo.desde} al ${opts.periodo.hasta}`, MARGEN_IZQ, y)
    y += 5
    doc.setFontSize(8)
    doc.text(`Generado: ${new Date().toLocaleString('es-EC')}`, MARGEN_IZQ, y)
    doc.setTextColor(0, 0, 0)
    y += 10

    // Encabezado de tabla con fondo gris claro
    doc.setFillColor(230, 230, 230)
    doc.rect(MARGEN_IZQ, y - 5, ANCHO_UTIL, ALTO_FILA, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    opts.columnas.forEach((c, i) => doc.text(String(c), xs[i] + 1, y))
    doc.setDrawColor(150, 150, 150)
    doc.line(MARGEN_IZQ, y + 2.5, MARGEN_IZQ + ANCHO_UTIL, y + 2.5)
    y += ALTO_FILA + 2.5
  }

  const agregarFila = (fila: (string | number)[], negrita = false) => {
    if (y + ALTO_FILA > Y_LIMITE) {
      doc.addPage()
      renderizarCabecera()
    }
    fila.forEach((celda, i) => textoCelda(doc, celda, xs[i], anchoCol, y, negrita))
    doc.setDrawColor(220, 220, 220)
    doc.line(MARGEN_IZQ, y + 2, MARGEN_IZQ + ANCHO_UTIL, y + 2)
    y += ALTO_FILA
  }

  renderizarCabecera()
  opts.filas.forEach((f) => agregarFila(f, false))

  if (opts.totales && opts.totales.length > 0) {
    agregarFila(opts.totales, true)
  }

  // Pie de página: número de página centrado
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(110, 110, 110)
    doc.text(`Página ${p} de ${total}`, 105, 292, { align: 'center' })
    doc.setTextColor(0, 0, 0)
  }

  doc.save(opts.nombreArchivo + '.pdf')
}
