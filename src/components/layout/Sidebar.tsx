import { NavLink } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { useJunta } from '../../hooks/useJunta'
import { Rol } from '../../types'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface NavItem {
  label: string
  to: string
}

const navPorRol: Record<Rol, NavItem[]> = {
  super_admin: [
    { label: 'Juntas', to: '/super-admin/juntas' },
    { label: 'Asignar Admin', to: '/super-admin/asignar-admin' },
  ],
  admin: [
    { label: 'Configuración', to: '/admin/configuracion' },
    { label: 'Sectores', to: '/admin/sectores' },
    { label: 'Cuentas', to: '/admin/cuentas' },
    { label: 'Miembros', to: '/secretario/miembros' },
    { label: 'Asambleas', to: '/secretario/asambleas' },
    { label: 'Predios', to: '/secretario/predios' },
    { label: 'Ingresos', to: '/tesorero/ingresos' },
    { label: 'Multas', to: '/tesorero/multas' },
    { label: 'Egresos', to: '/tesorero/egresos' },
  ],
  secretario: [
    { label: 'Miembros', to: '/secretario/miembros' },
    { label: 'Asambleas', to: '/secretario/asambleas' },
    { label: 'Predios', to: '/secretario/predios' },
    { label: 'Horarios', to: '/secretario/horarios' },
    { label: 'Convocatorias', to: '/secretario/convocatorias' },
    { label: 'Actas', to: '/secretario/actas' },
    { label: 'Comunicaciones', to: '/secretario/comunicaciones' },
  ],
  tesorero: [
    { label: 'Ingresos', to: '/tesorero/ingresos' },
    { label: 'Multas', to: '/tesorero/multas' },
    { label: 'Egresos', to: '/tesorero/egresos' },
    { label: 'Inventario', to: '/tesorero/inventario' },
    { label: 'Activos Fijos', to: '/tesorero/activos' },
    { label: 'Reportes', to: '/tesorero/reportes' },
  ],
  miembro: [
    { label: 'Mi Información', to: '/miembro/informacion' },
    { label: 'Mis Pagos', to: '/miembro/pagos' },
    { label: 'Mis Multas', to: '/miembro/multas' },
    { label: 'Mis Predios', to: '/miembro/predios' },
    { label: 'Convocatorias', to: '/miembro/convocatorias' },
  ],
}

function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

function NavItems({ items }: { items: NavItem[] }) {
  return (
    <>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            [
              'flex items-center px-4 py-2.5 text-sm rounded-md transition-colors',
              isActive
                ? 'bg-green-700 font-semibold text-white'
                : 'text-green-100 hover:bg-green-700/60',
            ].join(' ')
          }
        >
          {item.label}
        </NavLink>
      ))}
    </>
  )
}

function SidebarContent({ onClose }: { onClose: () => void }) {
  const { rol } = useAuth()
  const { junta } = useJunta()

  const items = rol ? navPorRol[rol] ?? [] : []

  return (
    <div className="flex flex-col h-full bg-green-800 w-64">
      {/* Logo / Header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-green-700">
        {junta?.logo_url ? (
          <img
            src={junta.logo_url}
            alt={`Logo ${junta.nombre}`}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">
              {junta ? getInitials(junta.nombre) : 'SJ'}
            </span>
          </div>
        )}
        <span className="text-white font-bold text-sm leading-tight line-clamp-2">
          {junta?.nombre ?? 'Sistema Multi-Junta'}
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
        <NavItems items={items} />
      </nav>

      {/* Bottom: Mensajes (all roles) */}
      <div className="px-2 pb-4 border-t border-green-700 pt-3">
        <NavLink
          to="/mensajes"
          onClick={onClose}
          className={({ isActive }) =>
            [
              'flex items-center px-4 py-2.5 text-sm rounded-md transition-colors',
              isActive
                ? 'bg-green-700 font-semibold text-white'
                : 'text-green-100 hover:bg-green-700/60',
            ].join(' ')
          }
        >
          Mensajes
        </NavLink>
      </div>
    </div>
  )
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop: static column */}
      <div className="hidden md:flex flex-col h-full">
        <SidebarContent onClose={onClose} />
      </div>

      {/* Mobile: overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Panel */}
          <div className="absolute left-0 top-0 h-full z-50">
            <SidebarContent onClose={onClose} />
          </div>
        </div>
      )}
    </>
  )
}
