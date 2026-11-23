import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Rol } from '../types'

interface Perfil {
  id: string
  junta_id: string | null
  rol: Rol
  nombre_completo: string
  activo: boolean
}

interface UsePerfilResult {
  perfil: Perfil | null
  cargando: boolean
  error: string | null
  refetch: () => void
}

export function usePerfil(): UsePerfilResult {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => {
    setTick((t) => t + 1)
  }, [])

  useEffect(() => {
    let mounted = true
    setCargando(true)
    setError(null)

    supabase.auth.getUser().then(async ({ data: { user }, error: userError }) => {
      if (!mounted) return

      if (userError || !user) {
        setPerfil(null)
        setError(userError?.message ?? 'No hay sesión activa.')
        setCargando(false)
        return
      }

      const { data, error: perfilError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', user.id)
        .limit(1)
        .single()

      if (!mounted) return

      if (perfilError || !data) {
        setPerfil(null)
        setError(perfilError?.message ?? 'No se encontró el perfil.')
      } else {
        setPerfil(data as Perfil)
        setError(null)
      }
      setCargando(false)
    })

    return () => {
      mounted = false
    }
  }, [tick])

  return { perfil, cargando, error, refetch }
}
