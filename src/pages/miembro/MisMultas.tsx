import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMiembro } from '../../hooks/useMiembro'
import { Alerta } from '../../components/ui/Alerta'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'

// ENLACE CORREO → MIEMBRO: no existe FK entre perfiles.id y miembros.id.
// Las multas del miembro autenticado se obtienen filtrando por el id de la
// fila de `miembros` resuelta comparando miembros.correo con el correo de
// autenticación (hook useMiembro). RLS aísla por junta.

type EstadoMulta = 'pendiente' | 'confirmada' | 'anulada' | 'pagada'

interface Multa {
  id: string
  miembro_id: string
  origen_tipo: 'asamblea' | 'minga'
  monto: number
  estado: EstadoMulta
  ingreso_id: string | null
  created_at: string
}

const ESTADO_BADGE: Record<EstadoMulta, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  confirmada: 'bg-blue-100 text-blue-800',
  pagada: 'bg-green-100 text-green-800',
  anulada: 'bg-gray-100 text-gray-600',
}

const ESTADO_ETIQUETA: Record<EstadoMulta, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  pagada: 'Pagada',
  anulada: 'Anulada',
}

type Filtro = 'todas' | EstadoMulta

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'pendiente', etiqueta: 'Pendiente' },
  { valor: 'confirmada', etiqueta: 'Confirmada' },
  { valor: 'pagada', etiqueta: 'Pagada' },
  { valor: 'anulada', etiqueta: 'Anulada' },
]

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

const columnas: ColumnaTabla<Multa>[] = [
  { cabecera: 'Fecha', accesador: (m) => formatearFecha(m.created_at) },
  { cabecera: 'Monto', accesador: (m) => `$${Number(m.monto).toFixed(2)}`, className: 'text-right' },
  {
    cabecera: 'Estado',
    accesador: (m) => (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ESTADO_BADGE[m.estado]}`}>
        {ESTADO_ETIQUETA[m.estado]}
      </span>
    ),
  },
  { cabecera: 'Origen', accesador: (m) => (m.origen_tipo === 'asamblea' ? 'Asamblea' : 'Minga') },
]

export default function MisMultas() {
  const { miembro, cargando: miembroCargando } = useMiembro()
  const [multas, setMultas] = useState<Multa[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todas')

  useEffect(() => {
    if (miembroCargando) return

    if (!miembro) {
      setMultas([])
      setCargando(false)
      return
    }

    let mounted = true
    setCargando(true)

    supabase
      .from('multas')
      .select('*')
      .eq('miembro_id', miembro.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          console.error('Error al cargar las multas:', error.message)
          setMultas([])
        } else {
          setMultas((data as Multa[]) ?? [])
        }
        setCargando(false)
      })

    return () => {
      mounted = false
    }
  }, [miembro, miembroCargando])

  const multasFiltradas = filtro === 'todas' ? multas : multas.filter((m) => m.estado === filtro)
  const pendientes = multas.filter((m) => m.estado === 'pendiente').length
  const totalPagado = multas
    .filter((m) => m.estado === 'pagada')
    .reduce((suma, m) => suma + Number(m.monto), 0)

  if (!miembroCargando && !miembro) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Mis multas</h1>
        <Alerta tipo="advertencia" mensaje="No se encontró su registro de miembro. Contacte al Secretario." />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis multas</h1>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Pendientes</p>
          <p className="text-2xl font-bold text-gray-900">{pendientes}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total pagado en multas</p>
          <p className="text-2xl font-bold text-gray-900">${totalPagado.toFixed(2)}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => setFiltro(f.valor)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filtro === f.valor
                ? 'bg-green-600 border-green-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      <Tabla<Multa>
        columnas={columnas}
        datos={multasFiltradas}
        cargando={cargando || miembroCargando}
        filasPorPagina={15}
      />
    </div>
  )
}
