import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import useAuth from './useAuth'

export interface Miembro {
  id: string
  junta_id: string
  cedula: string
  nombres: string
  apellidos: string
  direccion: string | null
  telefono: string | null
  correo: string | null
  sector_id: string | null
  fecha_ingreso: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

interface UseMiembroResult {
  miembro: Miembro | null
  cargando: boolean
}

// Hook that resolves the authenticated user's miembros row by correo match.
// NOTE: this linkage requires miembros.correo to equal the auth email.
// There is no FK between perfiles.id and miembros.id, so the member's own
// records are found by matching miembros.correo === usuario.email (scoped
// to the user's junta). RLS isolates by junta; the per-member filter is
// the miembro id obtained here.
export function useMiembro(): UseMiembroResult {
  const { usuario, juntaId, cargando: authCargando } = useAuth()
  const [miembro, setMiembro] = useState<Miembro | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (authCargando) return

    if (!usuario?.email || !juntaId) {
      setMiembro(null)
      setCargando(false)
      return
    }

    let mounted = true
    setCargando(true)

    supabase
      .from('miembros')
      .select('*')
      .eq('correo', usuario.email)
      .eq('junta_id', juntaId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          console.error('Error al buscar el registro de miembro:', error.message)
          setMiembro(null)
        } else {
          setMiembro((data as Miembro) ?? null)
        }
        setCargando(false)
      })

    return () => {
      mounted = false
    }
  }, [usuario, juntaId, authCargando])

  return { miembro, cargando }
}
