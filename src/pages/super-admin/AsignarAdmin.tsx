import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { Modal } from '../../components/ui/Modal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Junta {
  id: string
  nombre: string
  tipo: string
}

interface Perfil {
  id: string
  junta_id: string | null
  rol: string
  nombre_completo: string
  activo: boolean
}

interface AsignacionRow {
  junta_id: string
  junta_nombre: string
  junta_tipo: string
  admin_id: string | null
  admin_nombre: string | null
  admin_correo: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  riego: 'Riego',
  agua_potable: 'Agua Potable',
  parroquial: 'Parroquial',
  barrial: 'Barrial',
}

function formatTipo(tipo: string): string {
  return TIPO_LABEL[tipo] ?? tipo
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AsignarAdmin() {
  // Data
  const [filas, setFilas] = useState<AsignacionRow[]>([])
  const [todosPerfiles, setTodosPerfiles] = useState<Perfil[]>([])
  const [cargando, setCargando] = useState(true)

  // Page-level alert
  const [alerta, setAlerta] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)

  // Assignment modal
  const [modalAsignar, setModalAsignar] = useState(false)
  const [filaSeleccionada, setFilaSeleccionada] = useState<AsignacionRow | null>(null)
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('')
  const [errorModal, setErrorModal] = useState<string | null>(null)

  // Confirmation modal
  const [modalConfirmar, setModalConfirmar] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // ── Load data ───────────────────────────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    try {
      const [{ data: juntas, error: errJuntas }, { data: perfiles, error: errPerfiles }] =
        await Promise.all([
          supabase.from('juntas').select('id, nombre, tipo').order('nombre'),
          supabase
            .from('perfiles')
            .select('id, junta_id, rol, nombre_completo, activo')
            .eq('activo', true),
        ])

      if (errJuntas) throw errJuntas
      if (errPerfiles) throw errPerfiles

      const perfilesActivos: Perfil[] = perfiles ?? []
      setTodosPerfiles(perfilesActivos)

      const admins = perfilesActivos.filter((p) => p.rol === 'admin')

      const rows: AsignacionRow[] = (juntas ?? []).map((j: Junta) => {
        const admin = admins.find((a) => a.junta_id === j.id) ?? null
        return {
          junta_id: j.id,
          junta_nombre: j.nombre,
          junta_tipo: j.tipo,
          admin_id: admin?.id ?? null,
          admin_nombre: admin?.nombre_completo ?? null,
          admin_correo: null,
        }
      })

      setFilas(rows)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar datos'
      setAlerta({ tipo: 'error', mensaje: msg })
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // Auto-dismiss success alert
  useEffect(() => {
    if (alerta?.tipo === 'exito') {
      const t = setTimeout(() => setAlerta(null), 4000)
      return () => clearTimeout(t)
    }
  }, [alerta])

  // ── Open assignment modal ────────────────────────────────────────────────────

  function abrirAsignar(fila: AsignacionRow) {
    setFilaSeleccionada(fila)
    setUsuarioSeleccionado('')
    setErrorModal(null)
    setModalAsignar(true)
  }

  function cerrarAsignar() {
    setModalAsignar(false)
    setFilaSeleccionada(null)
    setUsuarioSeleccionado('')
    setErrorModal(null)
  }

  // ── Submit assignment ────────────────────────────────────────────────────────

  function handleSubmitAsignar() {
    if (!filaSeleccionada || !usuarioSeleccionado) {
      setErrorModal('Seleccione un usuario.')
      return
    }

    const esMismoAdmin =
      filaSeleccionada.admin_id !== null &&
      filaSeleccionada.admin_id === usuarioSeleccionado

    if (esMismoAdmin) {
      setErrorModal('El usuario seleccionado ya es el administrador de esta junta.')
      return
    }

    // Reasignación — needs confirmation
    if (filaSeleccionada.admin_id !== null) {
      setModalAsignar(false)
      setModalConfirmar(true)
      return
    }

    // First assignment — proceed directly
    ejecutarAsignacion()
  }

  // ── Execute the actual DB operations ────────────────────────────────────────

  async function ejecutarAsignacion() {
    if (!filaSeleccionada || !usuarioSeleccionado) return

    setGuardando(true)
    setErrorModal(null)

    try {
      // a) Demote previous admin if exists and different user
      if (
        filaSeleccionada.admin_id !== null &&
        filaSeleccionada.admin_id !== usuarioSeleccionado
      ) {
        const { error: errDemote } = await supabase
          .from('perfiles')
          .update({ rol: 'miembro', junta_id: null })
          .eq('id', filaSeleccionada.admin_id)
        if (errDemote) throw errDemote
      }

      // b) Promote new admin
      const { error: errPromote } = await supabase
        .from('perfiles')
        .update({ rol: 'admin', junta_id: filaSeleccionada.junta_id })
        .eq('id', usuarioSeleccionado)
      if (errPromote) throw errPromote

      // c) Insert notification (RF-04.4)
      const { error: errNotif } = await supabase.from('notificaciones').insert({
        junta_id: filaSeleccionada.junta_id,
        usuario_id: usuarioSeleccionado,
        tipo: 'asignacion_admin',
        referencia_id: filaSeleccionada.junta_id,
        referencia_tipo: 'junta',
        mensaje: `Has sido asignado como Administrador de la junta "${filaSeleccionada.junta_nombre}".`,
        leida: false,
      })
      if (errNotif) throw errNotif

      // d) Success
      setModalConfirmar(false)
      setModalAsignar(false)
      setFilaSeleccionada(null)
      setUsuarioSeleccionado('')
      await cargarDatos()
      setAlerta({ tipo: 'exito', mensaje: 'Administrador asignado correctamente.' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al asignar administrador'
      setErrorModal(msg)
      // If confirmation modal was open, re-show assignment modal
      if (modalConfirmar) {
        setModalConfirmar(false)
        setModalAsignar(true)
      }
    } finally {
      setGuardando(false)
    }
  }

  // ── Cancel confirmation → reopen assignment modal ────────────────────────────

  function handleCancelarConfirmacion() {
    setModalConfirmar(false)
    setModalAsignar(true)
  }

  // ── Derived values for confirmation modal ────────────────────────────────────

  const nuevoNombre =
    todosPerfiles.find((p) => p.id === usuarioSeleccionado)?.nombre_completo ?? ''

  // ── Table columns ────────────────────────────────────────────────────────────

  const columnas: ColumnaTabla<AsignacionRow>[] = [
    { cabecera: 'Junta', accesador: 'junta_nombre' },
    {
      cabecera: 'Tipo',
      accesador: (fila) => formatTipo(fila.junta_tipo),
    },
    {
      cabecera: 'Administrador actual',
      accesador: (fila) => fila.admin_nombre ?? '—',
    },
    {
      cabecera: 'Correo',
      accesador: (fila) => fila.admin_correo ?? '—',
    },
  ]

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Title */}
      <h1 className="text-2xl font-bold text-gray-900">Asignar Administrador de Junta</h1>

      {/* Page-level alert */}
      {alerta && (
        <Alerta
          tipo={alerta.tipo}
          mensaje={alerta.mensaje}
          onCerrar={() => setAlerta(null)}
        />
      )}

      {/* Main table */}
      <Tabla<AsignacionRow>
        columnas={columnas}
        datos={filas}
        cargando={cargando}
        camposFiltro={['junta_nombre', 'admin_nombre']}
        filasPorPagina={10}
        accionesExtra={(fila) => (
          <Boton variante="primario" tamaño="sm" onClick={() => abrirAsignar(fila)}>
            Asignar
          </Boton>
        )}
      />

      {/* ── Assignment modal ─────────────────────────────────────────────────── */}
      <Modal
        abierto={modalAsignar}
        onCerrar={cerrarAsignar}
        titulo={`Asignar Administrador — ${filaSeleccionada?.junta_nombre ?? ''}`}
      >
        <div className="flex flex-col gap-4">
          {/* Current admin info */}
          {filaSeleccionada?.admin_id && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
              Administrador actual:{' '}
              <span className="font-semibold">{filaSeleccionada.admin_nombre}</span>
            </div>
          )}

          {/* User select */}
          <div className="flex flex-col gap-1">
            <label htmlFor="select-usuario" className="text-sm font-medium text-gray-700">
              Usuario
            </label>
            <select
              id="select-usuario"
              value={usuarioSeleccionado}
              onChange={(e) => {
                setUsuarioSeleccionado(e.target.value)
                setErrorModal(null)
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Seleccione un usuario</option>
              {todosPerfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre_completo}
                </option>
              ))}
            </select>
          </div>

          {/* Modal error */}
          {errorModal && <Alerta tipo="error" mensaje={errorModal} onCerrar={() => setErrorModal(null)} />}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Boton variante="secundario" onClick={cerrarAsignar}>
              Cancelar
            </Boton>
            <Boton
              variante="primario"
              cargando={guardando}
              onClick={handleSubmitAsignar}
            >
              Asignar
            </Boton>
          </div>
        </div>
      </Modal>

      {/* ── Confirmation modal (reasignación) ───────────────────────────────── */}
      <Modal
        abierto={modalConfirmar}
        onCerrar={handleCancelarConfirmacion}
        titulo="Confirmar reasignación"
      >
        <div className="flex flex-col gap-6">
          <p className="text-sm text-gray-700">
            Esta junta ya tiene un administrador activo:{' '}
            <span className="font-semibold">{filaSeleccionada?.admin_nombre}</span>. ¿Desea
            reemplazarlo por{' '}
            <span className="font-semibold">{nuevoNombre}</span>?
          </p>

          {/* Modal error (shown here if the DB op fails mid-flow) */}
          {errorModal && <Alerta tipo="error" mensaje={errorModal} onCerrar={() => setErrorModal(null)} />}

          <div className="flex justify-end gap-3">
            <Boton variante="secundario" onClick={handleCancelarConfirmacion}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              cargando={guardando}
              onClick={ejecutarAsignacion}
            >
              Confirmar reasignación
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
