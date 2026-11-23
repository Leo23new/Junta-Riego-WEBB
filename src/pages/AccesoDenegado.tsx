import { Link } from 'react-router-dom'

export default function AccesoDenegado() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Acceso denegado</h1>
        <p className="text-gray-500 mb-6">No tienes permisos para acceder a esta sección.</p>
        <Link to="/login" className="text-blue-600 hover:underline text-sm">
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  )
}
