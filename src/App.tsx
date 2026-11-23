import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import AppShell from './components/layout/AppShell'
import Login from './pages/auth/Login'
import RecuperarClave from './pages/auth/RecuperarClave'
import AccesoDenegado from './pages/AccesoDenegado'
import Juntas from './pages/super-admin/Juntas'
import AsignarAdmin from './pages/super-admin/AsignarAdmin'
import Configuracion from './pages/admin/Configuracion'
import Sectores from './pages/admin/Sectores'
import Cuentas from './pages/admin/Cuentas'
import Miembros from './pages/secretario/Miembros'
import Asambleas from './pages/secretario/Asambleas'
import Predios from './pages/secretario/Predios'

const Placeholder = ({ titulo }: { titulo: string }) => (
  <div className="p-8 text-gray-500">{titulo} — próximamente</div>
)

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes (no layout) */}
        <Route path="/login" element={<Login />} />
        <Route path="/recuperar-clave" element={<RecuperarClave />} />
        <Route path="/acceso-denegado" element={<AccesoDenegado />} />

        {/* Super Admin */}
        <Route element={<ProtectedRoute rolesPermitidos={['super_admin']} />}>
          <Route element={<AppShell />}>
            <Route path="/super-admin/juntas" element={<Juntas />} />
            <Route path="/super-admin/asignar-admin" element={<AsignarAdmin />} />
          </Route>
        </Route>

        {/* Admin */}
        <Route element={<ProtectedRoute rolesPermitidos={['admin', 'super_admin']} />}>
          <Route element={<AppShell />}>
            <Route path="/admin/configuracion" element={<Configuracion />} />
            <Route path="/admin/sectores" element={<Sectores />} />
            <Route path="/admin/cuentas" element={<Cuentas />} />
          </Route>
        </Route>

        {/* Secretario */}
        <Route element={<ProtectedRoute rolesPermitidos={['secretario', 'admin', 'super_admin']} />}>
          <Route element={<AppShell />}>
            <Route path="/secretario/miembros" element={<Miembros />} />
            <Route path="/secretario/asambleas" element={<Asambleas />} />
            <Route path="/secretario/predios" element={<Predios />} />
            <Route path="/secretario/horarios" element={<Placeholder titulo="Horarios" />} />
            <Route path="/secretario/convocatorias" element={<Placeholder titulo="Convocatorias" />} />
            <Route path="/secretario/actas" element={<Placeholder titulo="Actas" />} />
            <Route path="/secretario/comunicaciones" element={<Placeholder titulo="Comunicaciones" />} />
          </Route>
        </Route>

        {/* Tesorero */}
        <Route element={<ProtectedRoute rolesPermitidos={['tesorero', 'admin', 'super_admin']} />}>
          <Route element={<AppShell />}>
            <Route path="/tesorero/ingresos" element={<Placeholder titulo="Ingresos" />} />
            <Route path="/tesorero/multas" element={<Placeholder titulo="Multas" />} />
            <Route path="/tesorero/egresos" element={<Placeholder titulo="Egresos" />} />
            <Route path="/tesorero/inventario" element={<Placeholder titulo="Inventario" />} />
            <Route path="/tesorero/activos" element={<Placeholder titulo="Activos" />} />
            <Route path="/tesorero/reportes" element={<Placeholder titulo="Reportes" />} />
            <Route path="/tesorero/comprobantes" element={<Placeholder titulo="Comprobantes" />} />
          </Route>
        </Route>

        {/* Miembro */}
        <Route element={<ProtectedRoute rolesPermitidos={['miembro', 'secretario', 'admin', 'super_admin']} />}>
          <Route element={<AppShell />}>
            <Route path="/miembro/informacion" element={<Placeholder titulo="Mi información" />} />
            <Route path="/miembro/pagos" element={<Placeholder titulo="Mis pagos" />} />
            <Route path="/miembro/multas" element={<Placeholder titulo="Mis multas" />} />
            <Route path="/miembro/predios" element={<Placeholder titulo="Mis predios" />} />
            <Route path="/miembro/convocatorias" element={<Placeholder titulo="Convocatorias" />} />
          </Route>
        </Route>

        {/* Mensajes (any authenticated user) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/mensajes" element={<Placeholder titulo="Mensajes" />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
