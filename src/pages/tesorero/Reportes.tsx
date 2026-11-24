import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import useAuth from '../../hooks/useAuth'
import { useJunta } from '../../hooks/useJunta'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { exportarTablaPDF } from '../../lib/reportesPDF'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Ingreso {
  fecha: string
  concepto: string
  monto: number
  miembro_id: string | null
  metodo_pago: string
  numero_recibo: string
}

interface Egreso {
  fecha: string
  categoria: string
  descripcion: string
  monto: number
  metodo_pago: string
}

interface MultaConMiembro {
  miembro_id: string
  monto: number
  estado: string
  created_at: string
  miembros: { nombres: string; apellidos: string; cedula: string } | null
}

interface ActivoFijo {
  codigo: string
  nombre: string
  valor_adquisicion: number
  fecha_adquisicion: string
  vida_util_anos: number
  estado: string
}

interface Grupo {
  clave: string
  cantidad: number
  total: number
}

interface CuentaPorCobrar {
  miembro: string
  cedula: string
  numMultas: number
  total: number
}

interface ResultadoReporte {
  totalIngresos: number
  totalEgresos: number
  gruposIngresos: Grupo[]
  gruposEgresos: Grupo[]
  cuentasPorCobrar: CuentaPorCobrar[]
  totalCxC: number
  valorActivoFijos: number
  depreciacionAcumulada: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

function dinero(n: number): string {
  return `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function primerDiaAnio(): string {
  return `${new Date().getFullYear()}-01-01`
}

function ultimoDiaAnio(): string {
  return `${new Date().getFullYear()}-12-31`
}

function agrupar(
  filas: Array<{ clave: string; monto: number }>,
): Grupo[] {
  const mapa = new Map<string, Grupo>()
  for (const f of filas) {
    const clave = f.clave || 'Sin especificar'
    const g = mapa.get(clave) ?? { clave, cantidad: 0, total: 0 }
    g.cantidad += 1
    g.total += f.monto
    mapa.set(clave, g)
  }
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total)
}

// ─── Component ───────────────────────────────────────────────────────────────

type Tab = 'balance' | 'ingresos-egresos' | 'cxc'

export default function Reportes() {
  const { juntaId } = useAuth()
  const { junta } = useJunta()

  const [desde, setDesde] = useState(primerDiaAnio())
  const [hasta, setHasta] = useState(ultimoDiaAnio())
  const [tab, setTab] = useState<Tab>('balance')

  const [cargando, setCargando] = useState(false)
  const [generado, setGenerado] = useState(false)
  const [resultado, setResultado] = useState<ResultadoReporte | null>(null)
  const [alerta, setAlerta] = useState<{
    tipo: 'exito' | 'error' | 'advertencia' | 'info'
    mensaje: string
  } | null>(null)

  useEffect(() => {
    if (!alerta) return
    const t = setTimeout(() => setAlerta(null), 6000)
    return () => clearTimeout(t)
  }, [alerta])

  // ─── Generar reporte ───────────────────────────────────────────────────────

  async function generar(e: React.FormEvent) {
    e.preventDefault()
    if (!juntaId) return

    if (!desde || !hasta || desde > hasta) {
      setAlerta({ tipo: 'error', mensaje: 'El rango de fechas no es válido.' })
      return
    }

    setCargando(true)
    try {
      const [resIngresos, resEgresos, resMultas, resActivos] = await Promise.all([
        supabase
          .from('ingresos')
          .select('fecha, concepto, monto, miembro_id, metodo_pago, numero_recibo')
          .eq('junta_id', juntaId)
          .gte('fecha', desde)
          .lte('fecha', hasta),
        supabase
          .from('egresos')
          .select('fecha, categoria, descripcion, monto, metodo_pago')
          .eq('junta_id', juntaId)
          .gte('fecha', desde)
          .lte('fecha', hasta),
        supabase
          .from('multas')
          .select('miembro_id, monto, estado, created_at, miembros!miembro_id(nombres, apellidos, cedula)')
          .eq('junta_id', juntaId)
          .in('estado', ['pendiente', 'confirmada'])
          .gte('created_at', `${desde}T00:00:00`)
          .lte('created_at', `${hasta}T23:59:59`),
        supabase
          .from('activos_fijos')
          .select('codigo, nombre, valor_adquisicion, fecha_adquisicion, vida_util_anos, estado')
          .eq('junta_id', juntaId)
          .neq('estado', 'baja'),
      ])

      if (resIngresos.error) throw resIngresos.error
      if (resEgresos.error) throw resEgresos.error
      if (resMultas.error) throw resMultas.error
      if (resActivos.error) throw resActivos.error

      const ingresos = ((resIngresos.data ?? []) as unknown as Array<
        Omit<Ingreso, 'monto'> & { monto: string | number }
      >).map((r) => ({ ...r, monto: Number(r.monto) }))
      const egresos = ((resEgresos.data ?? []) as unknown as Array<
        Omit<Egreso, 'monto'> & { monto: string | number }
      >).map((r) => ({ ...r, monto: Number(r.monto) }))
      const multas = ((resMultas.data ?? []) as unknown as Array<
        Omit<MultaConMiembro, 'monto'> & { monto: string | number }
      >).map((r) => ({ ...r, monto: Number(r.monto) }))
      const activos = ((resActivos.data ?? []) as unknown as Array<
        Omit<ActivoFijo, 'valor_adquisicion' | 'vida_util_anos'> & {
          valor_adquisicion: string | number
          vida_util_anos: string | number
        }
      >).map((r) => ({
        ...r,
        valor_adquisicion: Number(r.valor_adquisicion),
        vida_util_anos: Number(r.vida_util_anos),
      }))

      // Depreciación acumulada por activo (RPC)
      const depreciaciones = await Promise.all(
        activos.map(async (a) => {
          try {
            const { data, error } = await supabase.rpc('calcular_depreciacion', {
              valor_adquisicion: a.valor_adquisicion,
              vida_util_anos: a.vida_util_anos,
              fecha_adquisicion: a.fecha_adquisicion,
            })
            if (error || data === null || data === undefined) return 0
            return Number(data)
          } catch {
            return 0
          }
        }),
      )

      const valorActivoFijos = activos.reduce((s, a) => s + a.valor_adquisicion, 0)
      const depreciacionAcumulada = depreciaciones.reduce((s, d) => s + d, 0)

      const totalIngresos = ingresos.reduce((s, i) => s + i.monto, 0)
      const totalEgresos = egresos.reduce((s, x) => s + x.monto, 0)

      // Cuentas por cobrar agrupadas por miembro
      const mapaCxC = new Map<string, CuentaPorCobrar>()
      for (const m of multas) {
        const nombre = m.miembros
          ? `${m.miembros.apellidos}, ${m.miembros.nombres}`
          : 'Miembro no disponible'
        const cedula = m.miembros?.cedula ?? '—'
        const clave = m.miembro_id
        const c = mapaCxC.get(clave) ?? { miembro: nombre, cedula, numMultas: 0, total: 0 }
        c.numMultas += 1
        c.total += m.monto
        mapaCxC.set(clave, c)
      }
      const cuentasPorCobrar = Array.from(mapaCxC.values()).sort((a, b) => b.total - a.total)
      const totalCxC = cuentasPorCobrar.reduce((s, c) => s + c.total, 0)

      setResultado({
        totalIngresos,
        totalEgresos,
        gruposIngresos: agrupar(ingresos.map((i) => ({ clave: i.concepto, monto: i.monto }))),
        gruposEgresos: agrupar(egresos.map((x) => ({ clave: x.categoria, monto: x.monto }))),
        cuentasPorCobrar,
        totalCxC,
        valorActivoFijos,
        depreciacionAcumulada,
      })
      setGenerado(true)
      setAlerta({ tipo: 'exito', mensaje: 'Reporte generado correctamente.' })
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al generar el reporte. Intente nuevamente.' })
    } finally {
      setCargando(false)
    }
  }

  // ─── Valores derivados ─────────────────────────────────────────────────────

  const activosFijosNetos = (resultado?.valorActivoFijos ?? 0) - (resultado?.depreciacionAcumulada ?? 0)
  const efectivo = (resultado?.totalIngresos ?? 0) - (resultado?.totalEgresos ?? 0)
  const totalActivos = activosFijosNetos + efectivo
  const totalPasivos = 0
  const totalPatrimonio = totalActivos - totalPasivos
  const excedente = (resultado?.totalIngresos ?? 0) - (resultado?.totalEgresos ?? 0)

  // ─── Exportar PDF de la pestaña activa ─────────────────────────────────────

  function exportarPDF() {
    if (!resultado) return
    const juntaNombre = junta?.nombre ?? 'Junta'
    const periodo = { desde, hasta }

    if (tab === 'balance') {
      exportarTablaPDF({
        titulo: 'Balance General',
        juntaNombre,
        periodo,
        columnas: ['Concepto', 'Monto'],
        filas: [
          ['Activos fijos (neto de depreciación)', dinero(activosFijosNetos)],
          ['Efectivo (ingresos − egresos del período)', dinero(efectivo)],
          ['Pasivos', dinero(0)],
          ['Excedente del período', dinero(excedente)],
        ],
        totales: ['TOTAL PATRIMONIO', dinero(totalPatrimonio)],
        nombreArchivo: `balance-general-${desde}_${hasta}`,
      })
    } else if (tab === 'ingresos-egresos') {
      const filas: (string | number)[][] = []
      for (const g of resultado.gruposIngresos) filas.push([g.clave, g.cantidad, dinero(g.total)])
      filas.push(['SUBTOTAL INGRESOS', '', dinero(resultado.totalIngresos)])
      for (const g of resultado.gruposEgresos) filas.push([g.clave, g.cantidad, dinero(g.total)])
      filas.push(['SUBTOTAL EGRESOS', '', dinero(resultado.totalEgresos)])
      exportarTablaPDF({
        titulo: 'Ingresos y Egresos',
        juntaNombre,
        periodo,
        columnas: ['Concepto / Categoría', 'Cantidad', 'Total'],
        filas,
        totales: ['EXCEDENTE DEL PERÍODO', '', dinero(excedente)],
        nombreArchivo: `ingresos-egresos-${desde}_${hasta}`,
      })
    } else {
      exportarTablaPDF({
        titulo: 'Cuentas por Cobrar',
        juntaNombre,
        periodo,
        columnas: ['Miembro', 'Cédula', 'N.º multas', 'Total pendiente'],
        filas: resultado.cuentasPorCobrar.map((c) => [
          c.miembro,
          c.cedula,
          c.numMultas,
          dinero(c.total),
        ]),
        totales: [
          'TOTAL GENERAL',
          '',
          resultado.cuentasPorCobrar.reduce((s, c) => s + c.numMultas, 0),
          dinero(resultado.totalCxC),
        ],
        nombreArchivo: `cuentas-por-cobrar-${desde}_${hasta}`,
      })
    }
  }

  // ─── Render helpers ─────────────────────────────────────────────────────────

  const tabs: Array<{ id: Tab; etiqueta: string }> = [
    { id: 'balance', etiqueta: 'Balance General' },
    { id: 'ingresos-egresos', etiqueta: 'Ingresos y Egresos' },
    { id: 'cxc', etiqueta: 'Cuentas por Cobrar' },
  ]

  const sinDatos = generado && !cargando && !resultado
  const memoTab = useMemo(() => tab, [tab])

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-4">
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Reportes económicos</h1>
        <Boton
          variante="secundario"
          onClick={exportarPDF}
          disabled={!generado || cargando || !resultado}
        >
          Exportar PDF
        </Boton>
      </div>

      {/* Page alert */}
      {alerta && <Alerta tipo={alerta.tipo} mensaje={alerta.mensaje} onCerrar={() => setAlerta(null)} />}

      {/* Period selector */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <form onSubmit={generar} className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div>
            <label htmlFor="rep-desde" className="block text-sm font-medium text-gray-700 mb-1">
              Desde
            </label>
            <input
              id="rep-desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className={INPUT_CLASS + ' sm:w-44'}
            />
          </div>
          <div>
            <label htmlFor="rep-hasta" className="block text-sm font-medium text-gray-700 mb-1">
              Hasta
            </label>
            <input
              id="rep-hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className={INPUT_CLASS + ' sm:w-44'}
            />
          </div>
          <Boton type="submit" variante="primario" cargando={cargando}>
            Generar
          </Boton>
        </form>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              memoTab === t.id
                ? 'bg-green-700 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>

      {cargando && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
          Generando reporte…
        </div>
      )}

      {sinDatos && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
          No hay datos para el período seleccionado.
        </div>
      )}

      {!generado && !cargando && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          Seleccione un período y presione «Generar» para ver los reportes.
        </div>
      )}

      {resultado && !cargando && (
        <>
          {/* ── Tab 1: Balance General ── */}
          {tab === 'balance' && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              {/*
                Supuestos: la junta es una organización sin fines de lucro de pequeño
                tamaño. No existen datos de pasivos en el esquema, por lo que se
                asume 0. El "efectivo" se aproxima como ingresos − egresos del
                período (no hay saldo inicial de caja). El patrimonio se calcula
                como total activos − total pasivos.
              */}
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">Balance General</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Del {desde} al {hasta} — aproximación basada en los datos disponibles
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <th className="px-4 py-2 font-medium">Concepto</th>
                    <th className="px-4 py-2 font-medium text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="bg-green-50/50">
                    <td colSpan={2} className="px-4 py-1.5 font-semibold text-gray-700">
                      ACTIVOS
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 pl-8 text-gray-700">
                      Activos fijos (valor de adquisición, neto de depreciación)
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-gray-800">
                      {dinero(activosFijosNetos)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 pl-8 text-gray-700">
                      Efectivo (aproximación: ingresos − egresos del período)
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-gray-800">
                      {dinero(efectivo)}
                    </td>
                  </tr>
                  <tr className="bg-gray-50 font-bold">
                    <td className="px-4 py-2 text-gray-900">Total activos</td>
                    <td className="px-4 py-2 text-right text-gray-900">{dinero(totalActivos)}</td>
                  </tr>
                  <tr className="bg-red-50/50">
                    <td colSpan={2} className="px-4 py-1.5 font-semibold text-gray-700">
                      PASIVOS
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 pl-8 text-gray-700">Pasivos</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-800">
                      {dinero(0)} (sin pasivos registrados)
                    </td>
                  </tr>
                  <tr className="bg-blue-50/50">
                    <td colSpan={2} className="px-4 py-1.5 font-semibold text-gray-700">
                      PATRIMONIO
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 pl-8 text-gray-700">Excedente del período</td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        excedente >= 0 ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {dinero(excedente)}
                    </td>
                  </tr>
                  <tr className="bg-gray-50 font-bold">
                    <td className="px-4 py-2 text-gray-900">Total patrimonio</td>
                    <td className="px-4 py-2 text-right text-gray-900">{dinero(totalPatrimonio)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ── Tab 2: Ingresos y Egresos ── */}
          {tab === 'ingresos-egresos' && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">Ingresos y Egresos</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Agrupados por concepto (ingresos) y categoría (egresos) — Del {desde} al {hasta}
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <th className="px-4 py-2 font-medium">Concepto / Categoría</th>
                    <th className="px-4 py-2 font-medium text-right">Cantidad</th>
                    <th className="px-4 py-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="bg-green-50/50">
                    <td colSpan={3} className="px-4 py-1.5 font-semibold text-gray-700">
                      INGRESOS
                    </td>
                  </tr>
                  {resultado.gruposIngresos.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-2 pl-8 text-gray-400">
                        Sin ingresos en el período.
                      </td>
                    </tr>
                  )}
                  {resultado.gruposIngresos.map((g) => (
                    <tr key={`ing-${g.clave}`}>
                      <td className="px-4 py-2 pl-8 text-gray-700">{g.clave}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{g.cantidad}</td>
                      <td className="px-4 py-2 text-right font-medium text-gray-800">
                        {dinero(g.total)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-2 text-gray-900">Subtotal ingresos</td>
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 text-right text-gray-900">
                      {dinero(resultado.totalIngresos)}
                    </td>
                  </tr>
                  <tr className="bg-red-50/50">
                    <td colSpan={3} className="px-4 py-1.5 font-semibold text-gray-700">
                      EGRESOS
                    </td>
                  </tr>
                  {resultado.gruposEgresos.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-2 pl-8 text-gray-400">
                        Sin egresos en el período.
                      </td>
                    </tr>
                  )}
                  {resultado.gruposEgresos.map((g) => (
                    <tr key={`egr-${g.clave}`}>
                      <td className="px-4 py-2 pl-8 text-gray-700">{g.clave}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{g.cantidad}</td>
                      <td className="px-4 py-2 text-right font-medium text-gray-800">
                        {dinero(g.total)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-2 text-gray-900">Subtotal egresos</td>
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 text-right text-gray-900">
                      {dinero(resultado.totalEgresos)}
                    </td>
                  </tr>
                  <tr className="font-bold">
                    <td className="px-4 py-3 text-gray-900">Excedente (ingresos − egresos)</td>
                    <td className="px-4 py-3" />
                    <td
                      className={`px-4 py-3 text-right ${
                        excedente >= 0 ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {dinero(excedente)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ── Tab 3: Cuentas por Cobrar ── */}
          {tab === 'cxc' && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">Cuentas por Cobrar</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Multas pendientes o confirmadas por miembro — Del {desde} al {hasta}
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <th className="px-4 py-2 font-medium">Miembro</th>
                    <th className="px-4 py-2 font-medium">Cédula</th>
                    <th className="px-4 py-2 font-medium text-right">N.º multas</th>
                    <th className="px-4 py-2 font-medium text-right">Total pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resultado.cuentasPorCobrar.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                        No hay cuentas por cobrar en el período.
                      </td>
                    </tr>
                  )}
                  {resultado.cuentasPorCobrar.map((c) => (
                    <tr key={`${c.cedula}-${c.miembro}`}>
                      <td className="px-4 py-2 text-gray-700">{c.miembro}</td>
                      <td className="px-4 py-2 text-gray-600">{c.cedula}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{c.numMultas}</td>
                      <td className="px-4 py-2 text-right font-medium text-gray-800">
                        {dinero(c.total)}
                      </td>
                    </tr>
                  ))}
                  {resultado.cuentasPorCobrar.length > 0 && (
                    <tr className="bg-gray-50 font-bold">
                      <td className="px-4 py-2 text-gray-900" colSpan={3}>
                        Total general de cuentas por cobrar
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {dinero(resultado.totalCxC)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
