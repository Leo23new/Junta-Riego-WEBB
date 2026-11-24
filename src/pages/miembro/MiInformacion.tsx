import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import useAuth from '../../hooks/useAuth'
import { useJunta } from '../../hooks/useJunta'
import { useMiembro } from '../../hooks/useMiembro'
import { Alerta } from '../../components/ui/Alerta'

// ENLACE CORREO → MIEMBRO: no existe FK entre perfiles.id y miembros.id.
// El registro del miembro autenticado se localiza comparando
// miembros.correo === usuario.email (filtrado por su junta). Esto requiere
// que el correo registrado en la tabla miembros coincida con el correo de
// autenticación. El aislamiento por junta lo garantiza RLS; el filtro por
// miembro se hace con la fila resuelta aquí (hook useMiembro).

interface SectorInfo {
  nombre: string
}

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{etiqueta}</p>
      <p className="text-base font-medium text-gray-900">{valor ?? '—'}</p>
    </div>
  )
}

export default function MiInformacion() {
  const { usuario } = useAuth()
  const { junta } = useJunta()
  const { miembro, cargando } = useMiembro()
  const [sector, setSector] = useState<string | null>(null)

  useEffect(() => {
    if (!miembro?.sector_id) {
      setSector(null)
      return
    }
    let mounted = true
    supabase
      .from('sectores')
      .select('nombre')
      .eq('id', miembro.sector_id)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) setSector((data as SectorInfo | null)?.nombre ?? null)
      })
    return () => {
      mounted = false
    }
  }, [miembro])

  if (cargando) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi información</h1>
        <div className="bg-white rounded-lg shadow p-6 h-48 animate-pulse" />
      </div>
    )
  }

  if (!miembro) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Mi información</h1>
        <Alerta tipo="advertencia" mensaje="No se encontró su registro de miembro. Contacte al Secretario." />
        <p className="text-sm text-gray-500">
          Correo de autenticación: <span className="font-medium text-gray-700">{usuario?.email}</span>
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi información</h1>
      <div className="bg-white rounded-lg shadow p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Nombres" valor={miembro.nombres} />
        <Campo etiqueta="Apellidos" valor={miembro.apellidos} />
        <Campo etiqueta="Cédula" valor={miembro.cedula} />
        <Campo etiqueta="Dirección" valor={miembro.direccion} />
        <Campo etiqueta="Teléfono" valor={miembro.telefono} />
        <Campo etiqueta="Correo" valor={miembro.correo} />
        <Campo etiqueta="Sector" valor={sector} />
        <Campo etiqueta="Fecha de ingreso" valor={formatearFecha(miembro.fecha_ingreso)} />
        <Campo
          etiqueta="Estado"
          valor={
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                miembro.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {miembro.activo ? 'Activo' : 'Inactivo'}
            </span>
          }
        />
        <Campo etiqueta="Junta" valor={junta?.nombre ?? '—'} />
      </div>
    </div>
  )
}
