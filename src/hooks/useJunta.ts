import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import useAuth from './useAuth'

interface Junta {
  id: string
  nombre: string
  tipo: string
  provincia: string
  canton: string
  parroquia: string
  direccion: string
  logo_url: string | null
  creado_por: string | null
  created_at: string
  updated_at: string
}

interface UseJuntaResult {
  junta: Junta | null
  cargando: boolean
  error: string | null
}

export function useJunta(): UseJuntaResult {
  const { juntaId, cargando: authCargando } = useAuth()
  const [junta, setJunta] = useState<Junta | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authCargando) return

    if (juntaId === null) {
      setJunta(null)
      setCargando(false)
      setError(null)
      return
    }

    let mounted = true
    setCargando(true)
    setError(null)

    supabase
      .from('juntas')
      .select('*')
      .eq('id', juntaId)
      .limit(1)
      .single()
      .then(({ data, error: juntaError }) => {
        if (!mounted) return

        if (juntaError || !data) {
          setJunta(null)
          setError(juntaError?.message ?? 'No se encontró la junta.')
        } else {
          setJunta(data as Junta)
          setError(null)
        }
        setCargando(false)
      })

    return () => {
      mounted = true
    }
  }, [juntaId, authCargando])

  return { junta, cargando, error }
}
