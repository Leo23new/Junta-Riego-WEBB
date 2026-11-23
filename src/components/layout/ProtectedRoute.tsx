import { Navigate, Outlet } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { Rol } from '../../types'

interface ProtectedRouteProps {
  rolesPermitidos?: Rol[]
}

export function ProtectedRoute({ rolesPermitidos }: ProtectedRouteProps) {
  const { usuario, rol, cargando } = useAuth()

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-gray-500">Cargando...</span>
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  if (rolesPermitidos && rolesPermitidos.length > 0 && (!rol || !rolesPermitidos.includes(rol))) {
    return <Navigate to="/acceso-denegado" replace />
  }

  return <Outlet />
}
