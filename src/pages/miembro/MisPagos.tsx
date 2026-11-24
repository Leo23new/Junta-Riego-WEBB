import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMiembro } from '../../hooks/useMiembro'
import { Alerta } from '../../components/ui/Alerta'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'

// ENLACE CORREO → MIEMBRO: no existe FK entre perfiles.id y miembros.id.
// Los pagos del miembro autenticado se obtienen filtrando ingresos por el
// id de la fila de `miembros` resuelta comparando miembros.correo con el
// correo de autenticación (hook useMiembro). RLS aísla por junta.

interface Ingreso {
  id: string
  miembro_id: string
  concepto: string
  monto: number
  fecha: string
  metodo_pago: string | null
  numero_recibo: string | null
}

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

const columnas: ColumnaTabla<Ingreso>[] = [
  { cabecera: 'Fecha', accesador: (f) => formatearFecha(f.fecha) },
  { cabecera: 'Concepto', accesador: 'concepto' },
  { cabecera: 'Monto', accesador: (f) => `$${Number(f.monto).toFixed(2)}`, className: 'text-right' },
  { cabecera: 'Método', accesador: (f) => f.metodo_pago ?? '—' },
  { cabecera: 'Recibo', accesador: (f) => f.numero_recibo ?? '—' },
]

export default function MisPagos() {
  const { miembro, cargando: miembroCargando } = useMiembro()
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (miembroCargando) return

    if (!miembro) {
      setIngresos([])
      setCargando(false)
      return
    }

    let mounted = true
    setCargando(true)

    supabase
      .from('ingresos')
      .select('*')
      .eq('miembro_id', miembro.id)
      .order('fecha', { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          console.error('Error al cargar los pagos:', error.message)
          setIngresos([])
        } else {
          setIngresos((data as Ingreso[]) ?? [])
        }
        setCargando(false)
      })

    return () => {
      mounted = false
    }
  }, [miembro, miembroCargando])

  const total = ingresos.reduce((suma, i) => suma + Number(i.monto), 0)

  if (!miembroCargando && !miembro) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Mis pagos</h1>
        <Alerta tipo="advertencia" mensaje="No se encontró su registro de miembro. Contacte al Secretario." />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis pagos</h1>

      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <p className="text-sm text-gray-500">Total pagado</p>
        <p className="text-2xl font-bold text-gray-900">${total.toFixed(2)}</p>
      </div>

      <Tabla<Ingreso>
        columnas={columnas}
        datos={ingresos}
        cargando={cargando || miembroCargando}
        filasPorPagina={15}
      />
    </div>
  )
}
