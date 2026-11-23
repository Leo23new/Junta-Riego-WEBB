import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import useAuth from '../../hooks/useAuth'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { Modal } from '../../components/ui/Modal'
import { Formulario, CampoFormulario } from '../../components/ui/Formulario'

interface Junta {
  id: string
  nombre: string
  tipo: 'riego' | 'agua_potable' | 'parroquial' | 'barrial'
  provincia: string
  canton: string
  parroquia: string
  direccion: string
  fecha_constitucion: string | null
  created_at: string
  creado_por: string | null
}

const TIPO_LABELS: Record<Junta['tipo'], string> = {
  riego: 'Riego',
  agua_potable: 'Agua Potable',
  parroquial: 'Parroquial',
  barrial: 'Barrial',
}

const TIPO_OPTIONS: { value: Junta['tipo']; label: string }[] = [
  { value: 'riego', label: 'Riego' },
  { value: 'agua_potable', label: 'Agua Potable' },
  { value: 'parroquial', label: 'Parroquial' },
  { value: 'barrial', label: 'Barrial' },
]

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

function formatFecha(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

const COLUMNAS: ColumnaTabla<Junta>[] = [
  { cabecera: 'Nombre', accesador: 'nombre' },
  {
    cabecera: 'Tipo',
    accesador: (fila) => TIPO_LABELS[fila.tipo] ?? fila.tipo,
  },
  { cabecera: 'Provincia', accesador: 'provincia' },
  { cabecera: 'Cantón', accesador: 'canton' },
  {
    cabecera: 'Creada',
    accesador: (fila) => formatFecha(fila.created_at),
  },
]

interface FormState {
  nombre: string
  tipo: Junta['tipo'] | ''
  provincia: string
  canton: string
  parroquia: string
  direccion: string
  fechaConstitucion: string
}

interface FormErrors {
  nombre?: string
  tipo?: string
  provincia?: string
  canton?: string
  parroquia?: string
  direccion?: string
  formulario?: string
}

const FORM_INICIAL: FormState = {
  nombre: '',
  tipo: '',
  provincia: '',
  canton: '',
  parroquia: '',
  direccion: '',
  fechaConstitucion: '',
}

const ERRORS_INICIAL: FormErrors = {}

export default function Juntas() {
  const { usuario } = useAuth()

  const [juntas, setJuntas] = useState<Junta[]>([])
  const [cargandoTabla, setCargandoTabla] = useState(true)

  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [errores, setErrores] = useState<FormErrors>(ERRORS_INICIAL)
  const [guardando, setGuardando] = useState(false)

  const [alerta, setAlerta] = useState<{ tipo: 'exito' | 'error' | 'advertencia' | 'info'; mensaje: string } | null>(null)

  async function cargarJuntas() {
    setCargandoTabla(true)
    const { data, error } = await supabase
      .from('juntas')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      mostrarAlerta('error', error.message)
    } else {
      setJuntas((data as Junta[]) ?? [])
    }
    setCargandoTabla(false)
  }

  useEffect(() => {
    cargarJuntas()
  }, [])

  function mostrarAlerta(tipo: 'exito' | 'error' | 'advertencia' | 'info', mensaje: string) {
    setAlerta({ tipo, mensaje })
    setTimeout(() => setAlerta(null), 4000)
  }

  function abrirModal() {
    setForm(FORM_INICIAL)
    setErrores(ERRORS_INICIAL)
    setModalAbierto(true)
  }

  function cerrarModal() {
    setForm(FORM_INICIAL)
    setErrores(ERRORS_INICIAL)
    setModalAbierto(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errores[name as keyof FormErrors]) {
      setErrores((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Client-side validation
    const nuevosErrores: FormErrors = {}
    if (!form.nombre.trim()) nuevosErrores.nombre = 'El nombre es requerido.'
    if (!form.tipo) nuevosErrores.tipo = 'El tipo es requerido.'
    if (!form.provincia.trim()) nuevosErrores.provincia = 'La provincia es requerida.'
    if (!form.canton.trim()) nuevosErrores.canton = 'El cantón es requerido.'
    if (!form.parroquia.trim()) nuevosErrores.parroquia = 'La parroquia es requerida.'
    if (!form.direccion.trim()) nuevosErrores.direccion = 'La dirección es requerida.'

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores)
      return
    }

    setGuardando(true)

    // Uniqueness check
    const { data: existe, error: errorBusqueda } = await supabase
      .from('juntas')
      .select('id')
      .eq('nombre', form.nombre.trim())
      .maybeSingle()

    if (errorBusqueda) {
      setErrores({ formulario: errorBusqueda.message })
      setGuardando(false)
      return
    }

    if (existe) {
      setErrores({ nombre: 'Ya existe una junta con este nombre.' })
      setGuardando(false)
      return
    }

    // Insert
    const { error: errorInsert } = await supabase.from('juntas').insert({
      nombre: form.nombre.trim(),
      tipo: form.tipo as Junta['tipo'],
      provincia: form.provincia.trim(),
      canton: form.canton.trim(),
      parroquia: form.parroquia.trim(),
      direccion: form.direccion.trim(),
      fecha_constitucion: form.fechaConstitucion || null,
      creado_por: usuario?.id ?? null,
    })

    if (errorInsert) {
      setErrores({ formulario: errorInsert.message })
      setGuardando(false)
      return
    }

    cerrarModal()
    await cargarJuntas()
    mostrarAlerta('exito', 'Junta registrada correctamente.')
    setGuardando(false)
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Juntas registradas</h1>
        <Boton variante="primario" onClick={abrirModal}>
          Nueva junta
        </Boton>
      </div>

      {/* Page-level alert */}
      {alerta && (
        <Alerta
          tipo={alerta.tipo}
          mensaje={alerta.mensaje}
          onCerrar={() => setAlerta(null)}
        />
      )}

      {/* Table */}
      <Tabla<Junta>
        columnas={COLUMNAS}
        datos={juntas}
        cargando={cargandoTabla}
        camposFiltro={['nombre', 'provincia', 'canton']}
        filasPorPagina={10}
      />

      {/* Registration modal */}
      <Modal
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        titulo="Nueva junta"
        tamaño="lg"
      >
        <Formulario onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CampoFormulario label="Nombre" htmlFor="nombre" error={errores.nombre} requerido>
              <input
                id="nombre"
                name="nombre"
                type="text"
                value={form.nombre}
                onChange={handleChange}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            <CampoFormulario label="Tipo" htmlFor="tipo" error={errores.tipo} requerido>
              <select
                id="tipo"
                name="tipo"
                value={form.tipo}
                onChange={handleChange}
                className={INPUT_CLASS}
              >
                <option value="">Seleccione un tipo</option>
                {TIPO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </CampoFormulario>

            <CampoFormulario label="Provincia" htmlFor="provincia" error={errores.provincia} requerido>
              <input
                id="provincia"
                name="provincia"
                type="text"
                value={form.provincia}
                onChange={handleChange}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            <CampoFormulario label="Cantón" htmlFor="canton" error={errores.canton} requerido>
              <input
                id="canton"
                name="canton"
                type="text"
                value={form.canton}
                onChange={handleChange}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            <CampoFormulario label="Parroquia" htmlFor="parroquia" error={errores.parroquia} requerido>
              <input
                id="parroquia"
                name="parroquia"
                type="text"
                value={form.parroquia}
                onChange={handleChange}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            <CampoFormulario label="Dirección" htmlFor="direccion" error={errores.direccion} requerido>
              <input
                id="direccion"
                name="direccion"
                type="text"
                value={form.direccion}
                onChange={handleChange}
                className={INPUT_CLASS}
              />
            </CampoFormulario>

            <CampoFormulario label="Fecha de constitución" htmlFor="fechaConstitucion">
              <input
                id="fechaConstitucion"
                name="fechaConstitucion"
                type="date"
                value={form.fechaConstitucion}
                onChange={handleChange}
                className={INPUT_CLASS}
              />
            </CampoFormulario>
          </div>

          {errores.formulario && (
            <Alerta tipo="error" mensaje={errores.formulario} onCerrar={() => setErrores((prev) => ({ ...prev, formulario: undefined }))} />
          )}

          {/* Footer buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Boton type="button" variante="secundario" onClick={cerrarModal}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="primario" cargando={guardando} disabled={guardando}>
              Guardar
            </Boton>
          </div>
        </Formulario>
      </Modal>
    </div>
  )
}
