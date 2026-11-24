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
import Mingas from './pages/secretario/Mingas'
import Predios from './pages/secretario/Predios'
import Horarios from './pages/secretario/Horarios'
import Ingresos from './pages/tesorero/Ingresos'
import Multas from './pages/tesorero/Multas'
import Egresos from './pages/tesorero/Egresos'
import Inventario from './pages/tesorero/Inventario'
import ActivosFijos from './pages/tesorero/ActivosFijos'
import Comprobantes from './pages/tesorero/Comprobantes'
import Reportes from './pages/tesorero/Reportes'
import MiInformacion from './pages/miembro/MiInformacion'
import MisPagos from './pages/miembro/MisPagos'
import MisMultas from './pages/miembro/MisMultas'
import MisPredios from './pages/miembro/MisPredios'
import Convocatorias from './pages/miembro/Convocatorias'
import ConvocatoriasSecretario from './pages/secretario/Convocatorias'
import Actas from './pages/secretario/Actas'
import Comunicaciones from './pages/secretario/Comunicaciones'

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
            <Route path="/secretario/mingas" element={<Mingas />} />
            <Route path="/secretario/predios" element={<Predios />} />
            <Route path="/secretario/horarios" element={<Horarios />} />
            <Route path="/secretario/convocatorias" element={<ConvocatoriasSecretario />} />
            <Route path="/secretario/actas" element={<Actas />} />
            <Route path="/secretario/comunicaciones" element={<Comunicaciones />} />
          </Route>
        </Route>

        {/* Tesorero */}
        <Route element={<ProtectedRoute rolesPermitidos={['tesorero', 'admin', 'super_admin']} />}>
          <Route element={<AppShell />}>
            <Route path="/tesorero/ingresos" element={<Ingresos />} />
            <Route path="/tesorero/multas" element={<Multas />} />
            <Route path="/tesorero/egresos" element={<Egresos />} />
            <Route path="/tesorero/inventario" element={<Inventario />} />
            <Route path="/tesorero/activos" element={<ActivosFijos />} />
            <Route path="/tesorero/reportes" element={<Reportes />} />
            <Route path="/tesorero/comprobantes" element={<Comprobantes />} />
          </Route>
        </Route>

        {/* Miembro */}
        <Route element={<ProtectedRoute rolesPermitidos={['miembro', 'secretario', 'admin', 'super_admin']} />}>
          <Route element={<AppShell />}>
            <Route path="/miembro/informacion" element={<MiInformacion />} />
            <Route path="/miembro/pagos" element={<MisPagos />} />
            <Route path="/miembro/multas" element={<MisMultas />} />
            <Route path="/miembro/predios" element={<MisPredios />} />
            <Route path="/miembro/convocatorias" element={<Convocatorias />} />
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
