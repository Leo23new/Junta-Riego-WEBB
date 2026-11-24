import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { useJunta } from '../../hooks/useJunta'
import { signOut } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { Rol } from '../../types'

interface HeaderProps {
  onMenuToggle: () => void
}

const rolConfig: Record<Rol, { label: string; clase: string }> = {
  super_admin: { label: 'Super Admin', clase: 'bg-purple-100 text-purple-800' },
  admin: { label: 'Administrador', clase: 'bg-blue-100 text-blue-800' },
  secretario: { label: 'Secretario/a', clase: 'bg-yellow-100 text-yellow-800' },
  tesorero: { label: 'Tesorero/a', clase: 'bg-green-100 text-green-800' },
  miembro: { label: 'Miembro', clase: 'bg-gray-100 text-gray-700' },
}

export function Header({ onMenuToggle }: HeaderProps) {
  const navigate = useNavigate()
  const { usuario, perfil, rol, juntaId } = useAuth()
  const { junta } = useJunta()
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0)

  useEffect(() => {
    if (!usuario || !juntaId) return

    async function fetchNoLeidos() {
      const { count } = await supabase
        .from('mensajes')
        .select('id', { count: 'exact', head: true })
        .eq('destinatario_id', usuario!.id)
        .eq('leido', false)
        .eq('junta_id', juntaId!)
      setMensajesNoLeidos(count ?? 0)
    }

    fetchNoLeidos()

    const channel = supabase
      .channel(`mensajes-unread-${usuario.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensajes',
          filter: `destinatario_id=eq.${usuario.id}`,
        },
        () => fetchNoLeidos()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [usuario, juntaId])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const rolInfo = rol ? rolConfig[rol] : null

  return (
    <header className="h-16 bg-white shadow-sm flex items-center px-4 gap-4 flex-shrink-0">
      {/* Hamburger (mobile only) */}
      <button
        type="button"
        onClick={onMenuToggle}
        className="md:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="Abrir menú"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Junta name */}
      <span className="font-semibold text-gray-800 text-sm truncate flex-1">
        {junta?.nombre ?? 'Sistema Multi-Junta'}
      </span>

      {/* Right side */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* User name */}
        {perfil?.nombre_completo && (
          <span className="hidden sm:block text-sm text-gray-600 max-w-[160px] truncate">
            {perfil.nombre_completo}
          </span>
        )}

        {/* Role badge */}
        {rolInfo && (
          <span
            className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${rolInfo.clase}`}
          >
            {rolInfo.label}
          </span>
        )}

        {/* Mensajes no leídos */}
        <NavLink
          to="/mensajes"
          className="relative p-1.5 text-gray-500 hover:text-green-700 transition-colors"
          aria-label="Mensajes"
        >
          <span className="text-lg leading-none">✉</span>
          {mensajesNoLeidos > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
              {mensajesNoLeidos > 9 ? '9+' : mensajesNoLeidos}
            </span>
          )}
        </NavLink>

        {/* Logout */}
        <button
          type="button"
          onClick={handleSignOut}
          className="text-sm text-gray-600 hover:text-red-600 transition-colors px-3 py-1.5 rounded-md hover:bg-red-50 border border-transparent hover:border-red-200"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}
