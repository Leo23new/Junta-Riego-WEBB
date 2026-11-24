import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import useAuth from '../../hooks/useAuth'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'

// ENLACE CORREO → MIEMBRO: las convocatorias son de la junta (no por
// miembro), por lo que aquí solo se filtra por junta_id. El enlace
// correo → miembros (hook useMiembro) no es necesario en esta página.

type TipoConvocatoria = 'asamblea' | 'minga'

interface Convocatoria {
  id: string
  junta_id: string
  tipo: TipoConvocatoria
  titulo: string
  fecha: string
  hora: string | null
  lugar: string | null
  orden_del_dia: string | null
  plazo_confirmacion: string | null
  estado: 'vigente' | 'finalizada'
}

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

const TIPO_BADGE: Record<TipoConvocatoria, { clase: string; etiqueta: string }> = {
  asamblea: { clase: 'bg-blue-100 text-blue-800', etiqueta: 'Asamblea' },
  minga: { clase: 'bg-green-100 text-green-800', etiqueta: 'Minga' },
}

const columnas: ColumnaTabla<Convocatoria>[] = [
  { cabecera: 'Fecha', accesador: (c) => formatearFecha(c.fecha) },
  { cabecera: 'Título', accesador: 'titulo' },
  {
    cabecera: 'Tipo',
    accesador: (c) => (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${TIPO_BADGE[c.tipo].clase}`}>
        {TIPO_BADGE[c.tipo].etiqueta}
      </span>
    ),
  },
  { cabecera: 'Lugar', accesador: (c) => c.lugar ?? '—' },
]

export default function Convocatorias() {
  const { juntaId, cargando: authCargando } = useAuth()
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (authCargando) return

    if (!juntaId) {
      setConvocatorias([])
      setCargando(false)
      return
    }

    let mounted = true
    setCargando(true)

    supabase
      .from('convocatorias')
      .select('*')
      .eq('junta_id', juntaId)
      .order('fecha', { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          console.error('Error al cargar las convocatorias:', error.message)
          setConvocatorias([])
        } else {
          setConvocatorias((data as Convocatoria[]) ?? [])
        }
        setCargando(false)
      })

    return () => {
      mounted = false
    }
  }, [juntaId, authCargando])

  const hoy = new Date().toISOString().slice(0, 10)
  const vigentes = convocatorias
    .filter((c) => c.estado === 'vigente' && c.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const historial = convocatorias
    .filter((c) => c.estado === 'finalizada' || c.fecha < hoy)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  if (cargando || authCargando) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Convocatorias</h1>
        <div className="bg-white rounded-lg shadow p-6 h-48 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Convocatorias</h1>

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Vigentes</h2>
        {vigentes.length === 0 ? (
          <p className="text-gray-500">No hay convocatorias vigentes.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {vigentes.map((c) => (
              <div key={c.id} className="bg-white rounded-lg shadow p-6 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold text-gray-900">{c.titulo}</h3>
                  <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${TIPO_BADGE[c.tipo].clase}`}>
                    {TIPO_BADGE[c.tipo].etiqueta}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Fecha:</span> {formatearFecha(c.fecha)}
                  {c.hora && <> · <span className="font-medium">Hora:</span> {c.hora}</>}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Lugar:</span> {c.lugar ?? '—'}
                </p>
                {c.orden_del_dia && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Orden del día</p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{c.orden_del_dia}</p>
                  </div>
                )}
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Plazo de confirmación:</span> {formatearFecha(c.plazo_confirmacion)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Historial</h2>
        <Tabla<Convocatoria>
          columnas={columnas}
          datos={historial}
          filasPorPagina={10}
        />
      </section>
    </div>
  )
}
