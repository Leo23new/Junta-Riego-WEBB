import React, { useEffect, useState } from 'react'
import useAuth from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Formulario, CampoFormulario } from '../../components/ui/Formulario'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'
import { SubidaArchivo } from '../../components/ui/SubidaArchivo'

interface Junta {
  id: string
  nombre: string
  tipo: string
  provincia: string
  canton: string
  parroquia: string
  direccion: string
  fecha_constitucion: string | null
  logo_url: string | null
  created_at: string
}

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

function obtenerIniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

export default function Configuracion() {
  const { juntaId } = useAuth()

  const [junta, setJunta] = useState<Junta | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [alerta, setAlerta] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)
  const [alertaLogo, setAlertaLogo] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)
  const [errores, setErrores] = useState<Partial<Record<keyof Junta, string>>>({})

  // Form state
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('')
  const [provincia, setProvincia] = useState('')
  const [canton, setCanton] = useState('')
  const [parroquia, setParroquia] = useState('')
  const [direccion, setDireccion] = useState('')
  const [fechaConstitucion, setFechaConstitucion] = useState('')

  useEffect(() => {
    if (!juntaId) return
    cargarJunta()
  }, [juntaId])

  async function cargarJunta() {
    setCargando(true)
    const { data, error } = await supabase
      .from('juntas')
      .select('*')
      .eq('id', juntaId)
      .single()

    if (error || !data) {
      setCargando(false)
      return
    }

    const j = data as Junta
    setJunta(j)
    setNombre(j.nombre ?? '')
    setTipo(j.tipo ?? '')
    setProvincia(j.provincia ?? '')
    setCanton(j.canton ?? '')
    setParroquia(j.parroquia ?? '')
    setDireccion(j.direccion ?? '')
    setFechaConstitucion(j.fecha_constitucion ?? '')
    setCargando(false)
  }

  function mostrarAlerta(tipo: 'exito' | 'error', mensaje: string) {
    setAlerta({ tipo, mensaje })
    setTimeout(() => setAlerta(null), 4000)
  }

  function validar(): boolean {
    const nuevosErrores: Partial<Record<keyof Junta, string>> = {}
    if (!nombre.trim()) nuevosErrores.nombre = 'El nombre es requerido.'
    if (!tipo.trim()) nuevosErrores.tipo = 'El tipo es requerido.'
    if (!provincia.trim()) nuevosErrores.provincia = 'La provincia es requerida.'
    if (!canton.trim()) nuevosErrores.canton = 'El cantón es requerido.'
    if (!parroquia.trim()) nuevosErrores.parroquia = 'La parroquia es requerida.'
    if (!direccion.trim()) nuevosErrores.direccion = 'La dirección es requerida.'
    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validar() || !juntaId) return

    setGuardando(true)
    const { error } = await supabase
      .from('juntas')
      .update({
        nombre,
        tipo,
        provincia,
        canton,
        parroquia,
        direccion,
        fecha_constitucion: fechaConstitucion || null,
      })
      .eq('id', juntaId)

    setGuardando(false)

    if (error) {
      mostrarAlerta('error', error.message)
    } else {
      setJunta((prev) => prev ? { ...prev, nombre, tipo, provincia, canton, parroquia, direccion, fecha_constitucion: fechaConstitucion || null } : prev)
      mostrarAlerta('exito', 'Configuración guardada correctamente.')
    }
  }

  async function handleLogoFile(archivo: File) {
    if (!juntaId) return
    setSubiendoLogo(true)
    setAlertaLogo(null)

    const ext = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${juntaId}/logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('logos-juntas')
      .upload(path, archivo, { upsert: true })

    if (uploadError) {
      setAlertaLogo({ tipo: 'error', mensaje: uploadError.message })
      setSubiendoLogo(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('logos-juntas')
      .getPublicUrl(path)

    const publicUrl = urlData.publicUrl

    const { error: updateError } = await supabase
      .from('juntas')
      .update({ logo_url: publicUrl })
      .eq('id', juntaId)

    setSubiendoLogo(false)

    if (updateError) {
      setAlertaLogo({ tipo: 'error', mensaje: updateError.message })
    } else {
      setJunta((prev) => prev ? { ...prev, logo_url: publicUrl } : prev)
      setAlertaLogo({ tipo: 'exito', mensaje: 'Logo actualizado correctamente.' })
    }
  }

  if (cargando) {
    return (
      <div className="p-8 text-gray-500">Cargando configuración…</div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Configuración de la Junta</h1>

      {alerta && (
        <div className="mb-4">
          <Alerta tipo={alerta.tipo} mensaje={alerta.mensaje} onCerrar={() => setAlerta(null)} />
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <Formulario onSubmit={handleSubmit}>
          <CampoFormulario label="Nombre" htmlFor="nombre" requerido error={errores.nombre}>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={INPUT_CLASS}
            />
          </CampoFormulario>

          <CampoFormulario label="Tipo" htmlFor="tipo" requerido error={errores.tipo}>
            <select
              id="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Seleccione un tipo…</option>
              <option value="riego">Riego</option>
              <option value="agua_potable">Agua potable</option>
              <option value="parroquial">Parroquial</option>
              <option value="barrial">Barrial</option>
            </select>
          </CampoFormulario>

          <CampoFormulario label="Provincia" htmlFor="provincia" requerido error={errores.provincia}>
            <input
              id="provincia"
              type="text"
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
              className={INPUT_CLASS}
            />
          </CampoFormulario>

          <CampoFormulario label="Cantón" htmlFor="canton" requerido error={errores.canton}>
            <input
              id="canton"
              type="text"
              value={canton}
              onChange={(e) => setCanton(e.target.value)}
              className={INPUT_CLASS}
            />
          </CampoFormulario>

          <CampoFormulario label="Parroquia" htmlFor="parroquia" requerido error={errores.parroquia}>
            <input
              id="parroquia"
              type="text"
              value={parroquia}
              onChange={(e) => setParroquia(e.target.value)}
              className={INPUT_CLASS}
            />
          </CampoFormulario>

          <CampoFormulario label="Dirección" htmlFor="direccion" requerido error={errores.direccion}>
            <input
              id="direccion"
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className={INPUT_CLASS}
            />
          </CampoFormulario>

          <CampoFormulario label="Fecha de constitución" htmlFor="fechaConstitucion">
            <input
              id="fechaConstitucion"
              type="date"
              value={fechaConstitucion}
              onChange={(e) => setFechaConstitucion(e.target.value)}
              className={INPUT_CLASS}
            />
          </CampoFormulario>

          {/* Logo section */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-3">Logo de la junta</p>
            <div className="flex flex-col items-center gap-4">
              {/* Logo preview */}
              <div className="relative">
                {subiendoLogo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-full z-10">
                    <svg className="animate-spin h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  </div>
                )}
                {junta?.logo_url ? (
                  <img
                    src={junta.logo_url}
                    alt="Logo de la junta"
                    className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-500">
                    {nombre ? obtenerIniciales(nombre) : '?'}
                  </div>
                )}
              </div>

              {alertaLogo && (
                <Alerta
                  tipo={alertaLogo.tipo}
                  mensaje={alertaLogo.mensaje}
                  onCerrar={() => setAlertaLogo(null)}
                />
              )}

              <div className="w-full">
                <SubidaArchivo
                  tiposPermitidos={['image/jpeg', 'image/png', 'image/webp']}
                  tamañoMaxMB={2}
                  etiqueta="Cambiar logo"
                  archivoActual={junta?.logo_url ?? null}
                  onArchivo={handleLogoFile}
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Boton
              type="submit"
              variante="primario"
              cargando={guardando}
              disabled={guardando}
            >
              Guardar cambios
            </Boton>
          </div>
        </Formulario>
      </div>
    </div>
  )
}
