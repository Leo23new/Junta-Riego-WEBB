import React, { useEffect, useState } from 'react'
import useAuth from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Tabla, ColumnaTabla } from '../../components/ui/Tabla'
import { Modal } from '../../components/ui/Modal'
import { Formulario, CampoFormulario } from '../../components/ui/Formulario'
import { Boton } from '../../components/ui/Boton'
import { Alerta } from '../../components/ui/Alerta'

interface Sector {
  id: string
  junta_id: string
  nombre: string
  descripcion: string | null
  created_at: string
}

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

const TEXTAREA_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none'

function formatearFecha(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const año = d.getFullYear()
  return `${dia}/${mes}/${año}`
}

export default function Sectores() {
  const { juntaId } = useAuth()

  const [sectores, setSectores] = useState<Sector[]>([])
  const [cargando, setCargando] = useState(true)
  const [alerta, setAlerta] = useState<{ tipo: 'exito' | 'error' | 'advertencia'; mensaje: string } | null>(null)

  // Create / Edit modal
  const [modalAbierto, setModalAbierto] = useState(false)
  const [sectorEditando, setSectorEditando] = useState<Sector | null>(null)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [errorNombre, setErrorNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Delete confirmation modal
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false)
  const [sectorAEliminar, setSectorAEliminar] = useState<Sector | null>(null)
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    if (!juntaId) return
    cargarSectores()
  }, [juntaId])

  async function cargarSectores() {
    setCargando(true)
    const { data, error } = await supabase
      .from('sectores')
      .select('*')
      .eq('junta_id', juntaId)
      .order('nombre')

    if (!error && data) {
      setSectores(data as Sector[])
    }
    setCargando(false)
  }

  function mostrarAlerta(tipo: 'exito' | 'error' | 'advertencia', mensaje: string) {
    setAlerta({ tipo, mensaje })
    setTimeout(() => setAlerta(null), 4000)
  }

  function abrirModalCrear() {
    setSectorEditando(null)
    setNombre('')
    setDescripcion('')
    setErrorNombre('')
    setModalAbierto(true)
  }

  function abrirModalEditar(sector: Sector) {
    setSectorEditando(sector)
    setNombre(sector.nombre)
    setDescripcion(sector.descripcion ?? '')
    setErrorNombre('')
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setSectorEditando(null)
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) {
      setErrorNombre('El nombre es requerido.')
      return
    }
    setErrorNombre('')

    if (!juntaId) return
    setGuardando(true)

    let error
    if (sectorEditando) {
      const result = await supabase
        .from('sectores')
        .update({ nombre, descripcion: descripcion || null })
        .eq('id', sectorEditando.id)
      error = result.error
    } else {
      const result = await supabase
        .from('sectores')
        .insert({ junta_id: juntaId, nombre, descripcion: descripcion || null })
      error = result.error
    }

    setGuardando(false)

    if (error) {
      mostrarAlerta('error', error.message)
    } else {
      cerrarModal()
      await cargarSectores()
      mostrarAlerta('exito', sectorEditando ? 'Sector actualizado correctamente.' : 'Sector creado correctamente.')
    }
  }

  async function handleEliminarClick(sector: Sector) {
    if (!juntaId) return

    // Dependency check
    const { count, error } = await supabase
      .from('miembros')
      .select('id', { count: 'exact', head: true })
      .eq('sector_id', sector.id)
      .eq('junta_id', juntaId)

    if (error) {
      mostrarAlerta('error', error.message)
      return
    }

    if (count !== null && count > 0) {
      mostrarAlerta(
        'advertencia',
        `No se puede eliminar: hay ${count} miembro(s) asociado(s) a este sector.`
      )
      return
    }

    setSectorAEliminar(sector)
    setModalEliminarAbierto(true)
  }

  async function confirmarEliminar() {
    if (!sectorAEliminar) return
    setEliminando(true)

    const { error } = await supabase
      .from('sectores')
      .delete()
      .eq('id', sectorAEliminar.id)

    setEliminando(false)
    setModalEliminarAbierto(false)
    setSectorAEliminar(null)

    if (error) {
      mostrarAlerta('error', error.message)
    } else {
      await cargarSectores()
      mostrarAlerta('exito', 'Sector eliminado correctamente.')
    }
  }

  const columnas: ColumnaTabla<Sector>[] = [
    { cabecera: 'Nombre', accesador: 'nombre' },
    {
      cabecera: 'Descripción',
      accesador: (s) => s.descripcion ?? '—',
    },
    {
      cabecera: 'Creado',
      accesador: (s) => formatearFecha(s.created_at),
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sectores</h1>
        <Boton variante="primario" onClick={abrirModalCrear}>
          Nuevo sector
        </Boton>
      </div>

      {alerta && (
        <div className="mb-4">
          <Alerta tipo={alerta.tipo} mensaje={alerta.mensaje} onCerrar={() => setAlerta(null)} />
        </div>
      )}

      <Tabla<Sector>
        columnas={columnas}
        datos={sectores}
        cargando={cargando}
        camposFiltro={['nombre']}
        filasPorPagina={10}
        accionesExtra={(sector) => (
          <div className="flex items-center gap-2">
            <Boton variante="fantasma" tamaño="sm" onClick={() => abrirModalEditar(sector)}>
              Editar
            </Boton>
            <Boton variante="peligro" tamaño="sm" onClick={() => handleEliminarClick(sector)}>
              Eliminar
            </Boton>
          </div>
        )}
      />

      {/* Create / Edit modal */}
      <Modal
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        titulo={sectorEditando ? 'Editar sector' : 'Nuevo sector'}
      >
        <Formulario onSubmit={handleGuardar}>
          <CampoFormulario label="Nombre" htmlFor="sector-nombre" requerido error={errorNombre}>
            <input
              id="sector-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={INPUT_CLASS}
              autoFocus
            />
          </CampoFormulario>

          <CampoFormulario label="Descripción" htmlFor="sector-descripcion">
            <textarea
              id="sector-descripcion"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className={TEXTAREA_CLASS}
            />
          </CampoFormulario>

          <div className="flex justify-end gap-2 pt-2">
            <Boton type="button" variante="secundario" onClick={cerrarModal} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="primario" cargando={guardando} disabled={guardando}>
              {sectorEditando ? 'Guardar cambios' : 'Crear sector'}
            </Boton>
          </div>
        </Formulario>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        abierto={modalEliminarAbierto}
        onCerrar={() => { setModalEliminarAbierto(false); setSectorAEliminar(null) }}
        titulo="Eliminar sector"
        tamaño="sm"
      >
        <p className="text-sm text-gray-700 mb-6">
          ¿Está seguro de eliminar el sector «{sectorAEliminar?.nombre}»? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <Boton
            type="button"
            variante="secundario"
            onClick={() => { setModalEliminarAbierto(false); setSectorAEliminar(null) }}
            disabled={eliminando}
          >
            Cancelar
          </Boton>
          <Boton
            type="button"
            variante="peligro"
            cargando={eliminando}
            disabled={eliminando}
            onClick={confirmarEliminar}
          >
            Eliminar
          </Boton>
        </div>
      </Modal>
    </div>
  )
}
