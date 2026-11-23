import { useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { useJunta } from '../../hooks/useJunta'
import { signOut } from '../../lib/auth'
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
  const { perfil, rol } = useAuth()
  const { junta } = useJunta()

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
