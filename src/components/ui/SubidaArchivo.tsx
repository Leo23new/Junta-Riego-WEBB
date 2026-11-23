import React, { useRef, useState, DragEvent } from 'react'

export interface SubidaArchivoProps {
  onArchivo: (archivo: File) => void
  tiposPermitidos: string[]
  tamañoMaxMB: number
  etiqueta?: string
  archivoActual?: string | null
}

export function SubidaArchivo({
  onArchivo,
  tiposPermitidos,
  tamañoMaxMB,
  etiqueta = 'Subir archivo',
  archivoActual,
}: SubidaArchivoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)

  function validarYProcesar(archivo: File) {
    if (!tiposPermitidos.includes(archivo.type)) {
      setError(
        `Tipo de archivo no permitido. Se aceptan: ${tiposPermitidos.join(', ')}`
      )
      setArchivoSeleccionado(null)
      return
    }
    const tamañoMB = archivo.size / (1024 * 1024)
    if (tamañoMB > tamañoMaxMB) {
      setError(`El archivo supera el tamaño máximo de ${tamañoMaxMB} MB.`)
      setArchivoSeleccionado(null)
      return
    }
    setError(null)
    setArchivoSeleccionado(archivo.name)
    onArchivo(archivo)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (archivo) validarYProcesar(archivo)
    // reset so the same file can be re-selected
    e.target.value = ''
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setArrastrando(false)
    const archivo = e.dataTransfer.files?.[0]
    if (archivo) validarYProcesar(archivo)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setArrastrando(true)
  }

  function handleDragLeave() {
    setArrastrando(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {etiqueta && (
        <span className="text-sm font-medium text-gray-700">{etiqueta}</span>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors',
          arrastrando
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 bg-gray-50 hover:border-green-400 hover:bg-green-50',
        ].join(' ')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        aria-label="Zona de carga de archivo"
      >
        <svg
          className="w-8 h-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0L8 8m4-4l4 4"
          />
        </svg>
        <p className="text-sm text-gray-500">
          Arrastra un archivo aquí o{' '}
          <span className="text-green-700 font-medium underline">seleccionar archivo</span>
        </p>
        <p className="text-xs text-gray-400">
          Máximo {tamañoMaxMB} MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={tiposPermitidos.join(',')}
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
      />

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {archivoSeleccionado && !error && (
        <p className="text-sm text-green-700">
          Archivo seleccionado: <span className="font-medium">{archivoSeleccionado}</span>
        </p>
      )}

      {archivoActual && !archivoSeleccionado && (
        <p className="text-xs text-gray-500">
          Archivo actual: <span className="font-medium">{archivoActual}</span>
        </p>
      )}
    </div>
  )
}
