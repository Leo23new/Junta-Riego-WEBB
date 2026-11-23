import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import useAuth from '../../hooks/useAuth'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { Modal } from '../../components/ui/Modal'
import { Formulario, CampoFormulario } from '../../components/ui/Formulario'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Sector {
  id: string
  nombre: string
}

interface Miembro {
  id: string
  junta_id: string
  cedula: string
  nombres: string
  apellidos: string
  direccion: string
  telefono: string | null
  correo: string | null
  sector_id: string | null
  fecha_ingreso: string
  activo: boolean
  created_at: string
  creado_por: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

/** RF-07.2 — Validación de cédula ecuatoriana (Módulo 10) */
function validarCedula(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false
  const digits = cedula.split('').map(Number)
  const provincia = parseInt(cedula.slice(0, 2))
  if (provincia < 1 || provincia > 24) return false
  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2]
  let suma = 0
  for (let i = 0; i < 9; i++) {
    let val = digits[i] * coeficientes[i]
    if (val >= 10) val -= 9
    suma += val
  }
  const digitoVerificador = suma % 10 === 0 ? 0 : 10 - (suma % 10)
  return digitoVerificador === digits[9]
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  cedula: string
  nombres: string
  apellidos: string
  direccion: string
  telefono: string
  correo: string
  sector_id: string
  fecha_ingreso: string
}

const FORM_VACÍO: FormState = {
  cedula: '',
  nombres: '',
  apellidos: '',
  direccion: '',
  telefono: '',
  correo: '',
  sector_id: '',
  fecha_ingreso: '',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Miembros() {
  const { usuario, juntaId } = useAuth()

  // Data
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [sectores, setSectores] = useState<Sector[]>([])
  const [cargando, setCargando] = useState(true)

  // Filters
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos')
  const [filtroSector, setFiltroSector] = useState<string>('todos')

  // Page-level alert
  const [alerta, setAlerta] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)

  // Create / Edit modal
  const [modalAbierto, setModalAbierto] = useState(false)
  const [miembroEditando, setMiembroEditando] = useState<Miembro | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VACÍO)
  const [errores, setErrores] = useState<Partial<FormState>>({})
  const [errorCedula, setErrorCedula] = useState<string>('')
  const [guardando, setGuardando] = useState(false)

  // Inactivate confirmation modal
  const [modalInactivar, setModalInactivar] = useState<Miembro | null>(null)
  const [inactivando, setInactivando] = useState(false)

  // ─── Load data ─────────────────────────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    if (!juntaId) return
    setCargando(true)
    try {
      const [resMiembros, resSectores] = await Promise.all([
        supabase
          .from('miembros')
          .select('*')
          .eq('junta_id', juntaId)
          .order('apellidos'),
        supabase
          .from('sectores')
          .select('id, nombre')
          .eq('junta_id', juntaId)
          .order('nombre'),
      ])

      if (resMiembros.error) throw resMiembros.error
      if (resSectores.error) throw resSectores.error

      setMiembros(resMiembros.data ?? [])
      setSectores(resSectores.data ?? [])
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al cargar los datos.' })
    } finally {
      setCargando(false)
    }
  }, [juntaId])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // ─── Filtered list ─────────────────────────────────────────────────────────

  const miembrosFiltrados = miembros.filter((m) => {
    if (filtroEstado === 'activo' && !m.activo) return false
    if (filtroEstado === 'inactivo' && m.activo) return false
    if (filtroSector !== 'todos' && m.sector_id !== filtroSector) return false
    return true
  })

  // ─── Open modals ───────────────────────────────────────────────────────────

  function abrirNuevo() {
    setMiembroEditando(null)
    setForm(FORM_VACÍO)
    setErrores({})
    setErrorCedula('')
    setModalAbierto(true)
  }

  function abrirEditar(m: Miembro) {
    setMiembroEditando(m)
    setForm({
      cedula: m.cedula,
      nombres: m.nombres,
      apellidos: m.apellidos,
      direccion: m.direccion,
      telefono: m.telefono ?? '',
      correo: m.correo ?? '',
      sector_id: m.sector_id ?? '',
      fecha_ingreso: m.fecha_ingreso,
    })
    setErrores({})
    setErrorCedula('')
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setMiembroEditando(null)
  }

  // ─── Cedula blur validation ─────────────────────────────────────────────────

  function handleCedulaBlur() {
    if (form.cedula && !validarCedula(form.cedula)) {
      setErrorCedula('Cédula ecuatoriana inválida.')
    } else {
      setErrorCedula('')
    }
  }

  // ─── Form submit ───────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // 1. Required field validation
    const nuevosErrores: Partial<FormState> = {}
    if (!form.cedula.trim()) nuevosErrores.cedula = 'Campo requerido.'
    if (!form.nombres.trim()) nuevosErrores.nombres = 'Campo requerido.'
    if (!form.apellidos.trim()) nuevosErrores.apellidos = 'Campo requerido.'
    if (!form.direccion.trim()) nuevosErrores.direccion = 'Campo requerido.'
    if (!form.fecha_ingreso) nuevosErrores.fecha_ingreso = 'Campo requerido.'

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores)
      return
    }
    setErrores({})

    // 2. Cedula format validation
    if (!validarCedula(form.cedula.trim())) {
      setErrorCedula('Cédula ecuatoriana inválida.')
      return
    }
    setErrorCedula('')

    setGuardando(true)
    try {
      // 3. Uniqueness check
      let queryUniq = supabase
        .from('miembros')
        .select('id')
        .eq('cedula', form.cedula.trim())
        .eq('junta_id', juntaId!)

      if (miembroEditando) {
        // Only check if cedula changed
        if (form.cedula.trim() !== miembroEditando.cedula) {
          queryUniq = queryUniq.neq('id', miembroEditando.id)
          const { data: dup } = await queryUniq.maybeSingle()
          if (dup) {
            setErrorCedula('Ya existe un miembro con esta cédula.')
            return
          }
        }
      } else {
        const { data: dup } = await queryUniq.maybeSingle()
        if (dup) {
          setErrorCedula('Ya existe un miembro con esta cédula.')
          return
        }
      }

      // 4. Insert or update
      if (miembroEditando) {
        const { error } = await supabase
          .from('miembros')
          .update({
            cedula: form.cedula.trim(),
            nombres: form.nombres.trim(),
            apellidos: form.apellidos.trim(),
            direccion: form.direccion.trim(),
            telefono: form.telefono.trim() || null,
            correo: form.correo.trim() || null,
            sector_id: form.sector_id || null,
            fecha_ingreso: form.fecha_ingreso,
          })
          .eq('id', miembroEditando.id)
        if (error) throw error
        setAlerta({ tipo: 'exito', mensaje: 'Miembro actualizado correctamente.' })
      } else {
        const { error } = await supabase.from('miembros').insert({
          junta_id: juntaId!,
          cedula: form.cedula.trim(),
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          direccion: form.direccion.trim(),
          telefono: form.telefono.trim() || null,
          correo: form.correo.trim() || null,
          sector_id: form.sector_id || null,
          fecha_ingreso: form.fecha_ingreso,
          activo: true,
          creado_por: usuario?.id ?? null,
        })
        if (error) throw error
        setAlerta({ tipo: 'exito', mensaje: 'Miembro registrado correctamente.' })
      }

      cerrarModal()
      await cargarDatos()
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al guardar. Intente nuevamente.' })
    } finally {
      setGuardando(false)
    }
  }

  // ─── Activate / Inactivate ─────────────────────────────────────────────────

  async function confirmarInactivar() {
    if (!modalInactivar) return
    setInactivando(true)
    try {
      const { error } = await supabase
        .from('miembros')
        .update({ activo: false })
        .eq('id', modalInactivar.id)
      if (error) throw error
      setAlerta({ tipo: 'exito', mensaje: `${modalInactivar.nombres} ${modalInactivar.apellidos} marcado como inactivo.` })
      setModalInactivar(null)
      await cargarDatos()
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al inactivar el miembro.' })
    } finally {
      setInactivando(false)
    }
  }

  async function activar(m: Miembro) {
    try {
      const { error } = await supabase
        .from('miembros')
        .update({ activo: true })
        .eq('id', m.id)
      if (error) throw error
      setAlerta({ tipo: 'exito', mensaje: `${m.nombres} ${m.apellidos} activado correctamente.` })
      await cargarDatos()
    } catch {
      setAlerta({ tipo: 'error', mensaje: 'Error al activar el miembro.' })
    }
  }

  // ─── Table columns ─────────────────────────────────────────────────────────

  const sectorMap = new Map(sectores.map((s) => [s.id, s.nombre]))

  const columnas: ColumnaTabla<Miembro>[] = [
    { cabecera: 'Cédula', accesador: 'cedula' },
    { cabecera: 'Nombres', accesador: 'nombres' },
    { cabecera: 'Apellidos', accesador: 'apellidos' },
    {
      cabecera: 'Sector',
      accesador: (m) => (m.sector_id ? sectorMap.get(m.sector_id) ?? '—' : '—'),
    },
    {
      cabecera: 'Teléfono',
      accesador: (m) => m.telefono ?? '—',
    },
    {
      cabecera: 'Estado',
      accesador: (m) =>
        m.activo ? (
          <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-medium">
            Activo
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2.5 py-0.5 text-xs font-medium">
            Inactivo
          </span>
        ),
    },
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-4">
      {/* Heading row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Nómina de Miembros</h1>
        <Boton variante="primario" onClick={abrirNuevo}>
          + Nuevo miembro
        </Boton>
      </div>

      {/* Page alert */}
      {alerta && (
        <Alerta
          tipo={alerta.tipo}
          mensaje={alerta.mensaje}
          onCerrar={() => setAlerta(null)}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label htmlFor="filtro-estado" className="text-sm font-medium text-gray-600">
            Estado:
          </label>
          <select
            id="filtro-estado"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
            className={INPUT_CLASS + ' w-auto'}
          >
            <option value="todos">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="filtro-sector" className="text-sm font-medium text-gray-600">
            Sector:
          </label>
          <select
            id="filtro-sector"
            value={filtroSector}
            onChange={(e) => setFiltroSector(e.target.value)}
            className={INPUT_CLASS + ' w-auto'}
          >
            <option value="todos">Todos</option>
            {sectores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <Tabla<Miembro>
        columnas={columnas}
        datos={miembrosFiltrados}
        cargando={cargando}
        camposFiltro={['cedula', 'nombres', 'apellidos']}
        filasPorPagina={15}
        accionesExtra={(m) => (
          <div className="flex gap-2">
            <Boton variante="fantasma" tamaño="sm" onClick={() => abrirEditar(m)}>
              Editar
            </Boton>
            {m.activo ? (
              <Boton variante="peligro" tamaño="sm" onClick={() => setModalInactivar(m)}>
                Inactivar
              </Boton>
            ) : (
              <Boton variante="secundario" tamaño="sm" onClick={() => activar(m)}>
                Activar
              </Boton>
            )}
          </div>
        )}
      />

      {/* ── Create / Edit modal ── */}
      <Modal
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        titulo={miembroEditando ? 'Editar miembro' : 'Nuevo miembro'}
        tamaño="lg"
      >
        <Formulario onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cédula */}
            <CampoFormulario
              label="Cédula"
              htmlFor="cedula"
              requerido
              error={errores.cedula || errorCedula}
            >
              <input
                id="cedula"
                type="text"
                maxLength={10}
                value={form.cedula}
                onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                onBlur={handleCedulaBlur}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            {/* Fecha de ingreso */}
            <CampoFormulario
              label="Fecha de ingreso"
              htmlFor="fecha_ingreso"
              requerido
              error={errores.fecha_ingreso}
            >
              <input
                id="fecha_ingreso"
                type="date"
                value={form.fecha_ingreso}
                onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            {/* Nombres */}
            <CampoFormulario
              label="Nombres"
              htmlFor="nombres"
              requerido
              error={errores.nombres}
            >
              <input
                id="nombres"
                type="text"
                value={form.nombres}
                onChange={(e) => setForm({ ...form, nombres: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            {/* Apellidos */}
            <CampoFormulario
              label="Apellidos"
              htmlFor="apellidos"
              requerido
              error={errores.apellidos}
            >
              <input
                id="apellidos"
                type="text"
                value={form.apellidos}
                onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            {/* Dirección */}
            <CampoFormulario
              label="Dirección"
              htmlFor="direccion"
              requerido
              error={errores.direccion}
            >
              <input
                id="direccion"
                type="text"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            {/* Sector */}
            <CampoFormulario label="Sector" htmlFor="sector_id">
              <select
                id="sector_id"
                value={form.sector_id}
                onChange={(e) => setForm({ ...form, sector_id: e.target.value })}
                className={INPUT_CLASS}
              >
                <option value="">Sin sector</option>
                {sectores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </CampoFormulario>

            {/* Teléfono */}
            <CampoFormulario label="Teléfono" htmlFor="telefono">
              <input
                id="telefono"
                type="text"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            {/* Correo */}
            <CampoFormulario label="Correo" htmlFor="correo">
              <input
                id="correo"
                type="email"
                value={form.correo}
                onChange={(e) => setForm({ ...form, correo: e.target.value })}
                className={INPUT_CLASS}
              />
            </CampoFormulario>
          </div>

          {/* Modal footer buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <Boton type="button" variante="secundario" onClick={cerrarModal}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="primario" cargando={guardando}>
              {miembroEditando ? 'Guardar cambios' : 'Registrar'}
            </Boton>
          </div>
        </Formulario>
      </Modal>

      {/* ── Inactivate confirmation modal ── */}
      <Modal
        abierto={!!modalInactivar}
        onCerrar={() => setModalInactivar(null)}
        titulo="Inactivar miembro"
        tamaño="sm"
      >
        <p className="text-sm text-gray-700">
          ¿Marcar como inactivo a{' '}
          <strong>
            {modalInactivar?.nombres} {modalInactivar?.apellidos}
          </strong>
          ? El historial se conservará.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Boton
            type="button"
            variante="secundario"
            onClick={() => setModalInactivar(null)}
          >
            Cancelar
          </Boton>
          <Boton
            type="button"
            variante="peligro"
            cargando={inactivando}
            onClick={confirmarInactivar}
          >
            Inactivar
          </Boton>
        </div>
      </Modal>
    </div>
  )
}
