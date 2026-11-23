import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import useAuth from '../../hooks/useAuth'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'
import { Modal } from '../../components/ui/Modal'
import { Alerta } from '../../components/ui/Alerta'
import { Boton } from '../../components/ui/Boton'
import { Formulario, CampoFormulario } from '../../components/ui/Formulario'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CuentaPerfil {
  id: string
  junta_id: string | null
  rol: 'admin' | 'secretario' | 'tesorero' | 'miembro'
  nombre_completo: string
  activo: boolean
  created_at: string
}

type RolInvitacion = 'secretario' | 'tesorero' | 'miembro'

const ETIQUETAS_ROL: Record<CuentaPerfil['rol'], string> = {
  admin: 'Administrador',
  secretario: 'Secretario/a',
  tesorero: 'Tesorero/a',
  miembro: 'Miembro',
}

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

function formatFecha(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function validarEmail(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Cuentas() {
  const { juntaId } = useAuth()

  // Data
  const [cuentas, setCuentas] = useState<CuentaPerfil[]>([])
  const [cargando, setCargando] = useState(true)

  // Page-level alert
  const [alerta, setAlerta] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)

  // Invite modal
  const [modalInvitar, setModalInvitar] = useState(false)
  const [correo, setCorreo] = useState('')
  const [nombreInvitar, setNombreInvitar] = useState('')
  const [rolInvitar, setRolInvitar] = useState<RolInvitacion>('miembro')
  const [erroresInvitar, setErroresInvitar] = useState<Record<string, string>>({})
  const [errorInvitar, setErrorInvitar] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Edit modal
  const [cuentaEditar, setCuentaEditar] = useState<CuentaPerfil | null>(null)
  const [nombreEditar, setNombreEditar] = useState('')
  const [rolEditar, setRolEditar] = useState<RolInvitacion>('miembro')
  const [erroresEditar, setErroresEditar] = useState<Record<string, string>>({})
  const [errorEditar, setErrorEditar] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Deactivate confirmation modal
  const [cuentaDesactivar, setCuentaDesactivar] = useState<CuentaPerfil | null>(null)
  const [desactivando, setDesactivando] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const cargarCuentas = useCallback(async () => {
    if (!juntaId) return
    setCargando(true)
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('junta_id', juntaId)
      .order('nombre_completo')

    if (error) {
      setAlerta({ tipo: 'error', mensaje: 'Error al cargar las cuentas: ' + error.message })
    } else {
      setCuentas((data ?? []) as CuentaPerfil[])
    }
    setCargando(false)
  }, [juntaId])

  useEffect(() => {
    cargarCuentas()
  }, [cargarCuentas])

  // Auto-dismiss success alerts
  useEffect(() => {
    if (alerta?.tipo === 'exito') {
      const t = setTimeout(() => setAlerta(null), 4000)
      return () => clearTimeout(t)
    }
  }, [alerta])

  // ── Invite ─────────────────────────────────────────────────────────────────

  function abrirInvitar() {
    setCorreo('')
    setNombreInvitar('')
    setRolInvitar('miembro')
    setErroresInvitar({})
    setErrorInvitar('')
    setModalInvitar(true)
  }

  async function handleInvitar(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!correo.trim()) errs.correo = 'El correo es obligatorio.'
    else if (!validarEmail(correo.trim())) errs.correo = 'Ingrese un correo válido.'
    if (!nombreInvitar.trim()) errs.nombre = 'El nombre completo es obligatorio.'
    if (Object.keys(errs).length) { setErroresInvitar(errs); return }

    setErroresInvitar({})
    setErrorInvitar('')
    setEnviando(true)

    // NOTE: The admin-level inviteUserByEmail requires the service_role key and cannot
    // be called from the browser. We use signInWithOtp with shouldCreateUser:true instead,
    // which sends a magic-link to the email address and creates the auth.users row on first use.
    // The nombre_completo and rol supplied here cannot be pre-written to `perfiles` because
    // we don't have the new user's UUID until they accept the link and log in. The user will
    // need to complete their profile on first login.
    const { error } = await supabase.auth.signInWithOtp({
      email: correo.trim(),
      options: { shouldCreateUser: true },
    })

    setEnviando(false)

    if (error) {
      setErrorInvitar('Error al enviar la invitación: ' + error.message)
      return
    }

    setModalInvitar(false)
    setAlerta({
      tipo: 'exito',
      mensaje:
        `Invitación enviada a ${correo.trim()}. El perfil se activará cuando el usuario inicie sesión.`,
    })
  }

  // ── Edit ───────────────────────────────────────────────────────────────────

  function abrirEditar(cuenta: CuentaPerfil) {
    setCuentaEditar(cuenta)
    setNombreEditar(cuenta.nombre_completo)
    setRolEditar(cuenta.rol === 'admin' ? 'miembro' : cuenta.rol)
    setErroresEditar({})
    setErrorEditar('')
  }

  function cerrarEditar() {
    setCuentaEditar(null)
  }

  async function handleEditar(e: React.FormEvent) {
    e.preventDefault()
    if (!cuentaEditar) return
    const errs: Record<string, string> = {}
    if (!nombreEditar.trim()) errs.nombre = 'El nombre completo es obligatorio.'
    if (Object.keys(errs).length) { setErroresEditar(errs); return }

    setErroresEditar({})
    setErrorEditar('')
    setGuardando(true)

    const { error } = await supabase
      .from('perfiles')
      .update({ nombre_completo: nombreEditar.trim(), rol: rolEditar })
      .eq('id', cuentaEditar.id)

    setGuardando(false)

    if (error) {
      setErrorEditar('Error al actualizar: ' + error.message)
      return
    }

    cerrarEditar()
    await cargarCuentas()
    setAlerta({ tipo: 'exito', mensaje: 'Cuenta actualizada correctamente.' })
  }

  // ── Deactivate / Activate ──────────────────────────────────────────────────

  async function confirmarDesactivar() {
    if (!cuentaDesactivar) return
    setDesactivando(true)
    const { error } = await supabase
      .from('perfiles')
      .update({ activo: false })
      .eq('id', cuentaDesactivar.id)
    setDesactivando(false)

    if (error) {
      setAlerta({ tipo: 'error', mensaje: 'Error al desactivar: ' + error.message })
    } else {
      setAlerta({ tipo: 'exito', mensaje: `Cuenta de ${cuentaDesactivar.nombre_completo} desactivada.` })
      await cargarCuentas()
    }
    setCuentaDesactivar(null)
  }

  async function activar(cuenta: CuentaPerfil) {
    const { error } = await supabase
      .from('perfiles')
      .update({ activo: true })
      .eq('id', cuenta.id)

    if (error) {
      setAlerta({ tipo: 'error', mensaje: 'Error al activar: ' + error.message })
    } else {
      setAlerta({ tipo: 'exito', mensaje: `Cuenta de ${cuenta.nombre_completo} activada.` })
      await cargarCuentas()
    }
  }

  // ── Table columns ──────────────────────────────────────────────────────────

  const columnas: ColumnaTabla<CuentaPerfil>[] = [
    {
      cabecera: 'Nombre completo',
      accesador: 'nombre_completo',
    },
    {
      cabecera: 'Rol',
      accesador: (c) => ETIQUETAS_ROL[c.rol] ?? c.rol,
    },
    {
      cabecera: 'Estado',
      accesador: (c) =>
        c.activo ? (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            Activo
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
            Inactivo
          </span>
        ),
    },
    {
      cabecera: 'Creado',
      accesador: (c) => formatFecha(c.created_at),
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Heading */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cuentas de usuarios</h1>
        <Boton variante="primario" onClick={abrirInvitar}>
          Nueva cuenta
        </Boton>
      </div>

      {/* Page-level alert */}
      {alerta && (
        <Alerta tipo={alerta.tipo} mensaje={alerta.mensaje} onCerrar={() => setAlerta(null)} />
      )}

      {/* Table */}
      <Tabla<CuentaPerfil>
        columnas={columnas}
        datos={cuentas}
        cargando={cargando}
        camposFiltro={['nombre_completo']}
        filasPorPagina={10}
        accionesExtra={(cuenta) => (
          <div className="flex items-center gap-2">
            <Boton variante="fantasma" tamaño="sm" onClick={() => abrirEditar(cuenta)}>
              Editar
            </Boton>
            {cuenta.activo ? (
              <Boton variante="peligro" tamaño="sm" onClick={() => setCuentaDesactivar(cuenta)}>
                Desactivar
              </Boton>
            ) : (
              <Boton variante="secundario" tamaño="sm" onClick={() => activar(cuenta)}>
                Activar
              </Boton>
            )}
          </div>
        )}
      />

      {/* ── Invite modal ──────────────────────────────────────────────────── */}
      <Modal
        abierto={modalInvitar}
        onCerrar={() => setModalInvitar(false)}
        titulo="Invitar usuario"
      >
        <Formulario onSubmit={handleInvitar}>
          <CampoFormulario
            label="Correo electrónico"
            htmlFor="inv-correo"
            error={erroresInvitar.correo}
            requerido
          >
            <input
              id="inv-correo"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className={INPUT_CLASS}
              placeholder="usuario@ejemplo.com"
              autoComplete="off"
            />
          </CampoFormulario>

          <CampoFormulario
            label="Nombre completo"
            htmlFor="inv-nombre"
            error={erroresInvitar.nombre}
            requerido
          >
            <input
              id="inv-nombre"
              type="text"
              value={nombreInvitar}
              onChange={(e) => setNombreInvitar(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Nombre Apellido"
            />
          </CampoFormulario>

          {/* NOTE: rol is captured here for reference only. Because we use the anon-client
              OTP flow, we cannot insert a perfiles row at this point (the new user's UUID
              is unknown until they accept the link). The admin will need to edit the profile
              once the user logs in for the first time. */}
          <CampoFormulario label="Rol" htmlFor="inv-rol" requerido>
            <select
              id="inv-rol"
              value={rolInvitar}
              onChange={(e) => setRolInvitar(e.target.value as RolInvitacion)}
              className={INPUT_CLASS}
            >
              <option value="secretario">Secretario/a</option>
              <option value="tesorero">Tesorero/a</option>
              <option value="miembro">Miembro</option>
            </select>
          </CampoFormulario>

          {errorInvitar && <Alerta tipo="error" mensaje={errorInvitar} />}

          <div className="flex justify-end gap-3 pt-2">
            <Boton
              type="button"
              variante="secundario"
              onClick={() => setModalInvitar(false)}
              disabled={enviando}
            >
              Cancelar
            </Boton>
            <Boton type="submit" variante="primario" cargando={enviando}>
              Enviar invitación
            </Boton>
          </div>
        </Formulario>
      </Modal>

      {/* ── Edit modal ────────────────────────────────────────────────────── */}
      <Modal
        abierto={!!cuentaEditar}
        onCerrar={cerrarEditar}
        titulo="Editar cuenta"
      >
        <Formulario onSubmit={handleEditar}>
          <CampoFormulario
            label="Nombre completo"
            htmlFor="edit-nombre"
            error={erroresEditar.nombre}
            requerido
          >
            <input
              id="edit-nombre"
              type="text"
              value={nombreEditar}
              onChange={(e) => setNombreEditar(e.target.value)}
              className={INPUT_CLASS}
            />
          </CampoFormulario>

          <CampoFormulario label="Rol" htmlFor="edit-rol" requerido>
            <select
              id="edit-rol"
              value={rolEditar}
              onChange={(e) => setRolEditar(e.target.value as RolInvitacion)}
              className={INPUT_CLASS}
            >
              <option value="secretario">Secretario/a</option>
              <option value="tesorero">Tesorero/a</option>
              <option value="miembro">Miembro</option>
            </select>
          </CampoFormulario>

          {errorEditar && <Alerta tipo="error" mensaje={errorEditar} />}

          <div className="flex justify-end gap-3 pt-2">
            <Boton
              type="button"
              variante="secundario"
              onClick={cerrarEditar}
              disabled={guardando}
            >
              Cancelar
            </Boton>
            <Boton type="submit" variante="primario" cargando={guardando}>
              Guardar cambios
            </Boton>
          </div>
        </Formulario>
      </Modal>

      {/* ── Deactivate confirmation modal ─────────────────────────────────── */}
      <Modal
        abierto={!!cuentaDesactivar}
        onCerrar={() => setCuentaDesactivar(null)}
        titulo="Confirmar desactivación"
        tamaño="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            ¿Desactivar la cuenta de{' '}
            <span className="font-semibold">{cuentaDesactivar?.nombre_completo}</span>?
            El usuario no podrá iniciar sesión.
          </p>
          <div className="flex justify-end gap-3">
            <Boton
              type="button"
              variante="secundario"
              onClick={() => setCuentaDesactivar(null)}
              disabled={desactivando}
            >
              Cancelar
            </Boton>
            <Boton
              type="button"
              variante="peligro"
              cargando={desactivando}
              onClick={confirmarDesactivar}
            >
              Desactivar
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
