import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Rol } from '../types'

interface Perfil {
  id: string
  junta_id: string | null
  rol: Rol
  nombre_completo: string
  activo: boolean
}

interface AuthState {
  usuario: User | null
  perfil: Perfil | null
  juntaId: string | null
  rol: Rol | null
  cargando: boolean
}

async function fetchPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', userId)
    .limit(1)
    .single()

  if (error || !data) return null
  return data as Perfil
}

export default function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    usuario: null,
    perfil: null,
    juntaId: null,
    rol: null,
    cargando: true,
  })

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return

      if (session?.user) {
        const perfil = await fetchPerfil(session.user.id)
        if (mounted) {
          setState({
            usuario: session.user,
            perfil,
            juntaId: perfil?.junta_id ?? null,
            rol: perfil?.rol ?? null,
            cargando: false,
          })
        }
      } else {
        setState({
          usuario: null,
          perfil: null,
          juntaId: null,
          rol: null,
          cargando: false,
        })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_IN' && session?.user) {
          const perfil = await fetchPerfil(session.user.id)
          if (mounted) {
            setState({
              usuario: session.user,
              perfil,
              juntaId: perfil?.junta_id ?? null,
              rol: perfil?.rol ?? null,
              cargando: false,
            })
          }
        } else if (event === 'SIGNED_OUT') {
          if (mounted) {
            setState({
              usuario: null,
              perfil: null,
              juntaId: null,
              rol: null,
              cargando: false,
            })
          }
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return state
}
