import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMiembro } from '../../hooks/useMiembro'
import { Alerta } from '../../components/ui/Alerta'
import { MapaPredio } from '../../components/ui/MapaPredio'

// ENLACE CORREO → MIEMBRO: no existe FK entre perfiles.id y miembros.id.
// Los predios del miembro autenticado se obtienen filtrando por el id de la
// fila de `miembros` resuelta comparando miembros.correo con el correo de
// autenticación (hook useMiembro). RLS aísla por junta.

interface Predio {
  id: string
  miembro_id: string
  codigo_catastral: string
  superficie: number | null
  sector_id: string | null
  tipo_uso: string | null
  latitud: number | null
  longitud: number | null
  sectores?: { nombre: string } | null
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{etiqueta}</p>
      <p className="text-base font-medium text-gray-900">{valor ?? '—'}</p>
    </div>
  )
}

export default function MisPredios() {
  const { miembro, cargando: miembroCargando } = useMiembro()
  const [predios, setPredios] = useState<Predio[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (miembroCargando) return

    if (!miembro) {
      setPredios([])
      setCargando(false)
      return
    }

    let mounted = true
    setCargando(true)

    supabase
      .from('predios')
      .select('*, sectores!sector_id (nombre)')
      .eq('miembro_id', miembro.id)
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          console.error('Error al cargar los predios:', error.message)
          setPredios([])
        } else {
          setPredios((data as Predio[]) ?? [])
        }
        setCargando(false)
      })

    return () => {
      mounted = false
    }
  }, [miembro, miembroCargando])

  if (!miembroCargando && !miembro) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Mis predios</h1>
        <Alerta tipo="advertencia" mensaje="No se encontró su registro de miembro. Contacte al Secretario." />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis predios</h1>

      {cargando || miembroCargando ? (
        <div className="bg-white rounded-lg shadow p-6 h-48 animate-pulse" />
      ) : predios.length === 0 ? (
        <p className="text-gray-500">No tiene predios registrados.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {predios.map((p) => (
            <div key={p.id} className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo etiqueta="Código catastral" valor={p.codigo_catastral} />
                <Campo etiqueta="Superficie (m²)" valor={p.superficie != null ? Number(p.superficie).toLocaleString('es-EC') : '—'} />
                <Campo etiqueta="Sector" valor={p.sectores?.nombre ?? '—'} />
                <Campo etiqueta="Tipo de uso" valor={p.tipo_uso} />
              </div>
              {p.latitud !== null && p.longitud !== null && (
                <MapaPredio latitud={p.latitud} longitud={p.longitud} height="250px" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
