export interface AlertaProps {
  tipo: 'exito' | 'error' | 'advertencia' | 'info'
  mensaje: string
  onCerrar?: () => void
}

const config = {
  exito: {
    contenedor: 'bg-green-50 border border-green-200 text-green-800',
    icono: '✓',
    iconoClase: 'text-green-500',
  },
  error: {
    contenedor: 'bg-red-50 border border-red-200 text-red-800',
    icono: '✕',
    iconoClase: 'text-red-500',
  },
  advertencia: {
    contenedor: 'bg-yellow-50 border border-yellow-200 text-yellow-800',
    icono: '!',
    iconoClase: 'text-yellow-500',
  },
  info: {
    contenedor: 'bg-blue-50 border border-blue-200 text-blue-800',
    icono: 'i',
    iconoClase: 'text-blue-500',
  },
}

export function Alerta({ tipo, mensaje, onCerrar }: AlertaProps) {
  const { contenedor, icono, iconoClase } = config[tipo]

  return (
    <div className={`flex items-start gap-3 rounded-md p-4 ${contenedor}`} role="alert">
      <span
        className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full font-bold text-sm ${iconoClase}`}
        aria-hidden="true"
      >
        {icono}
      </span>
      <p className="flex-1 text-sm">{mensaje}</p>
      {onCerrar && (
        <button
          type="button"
          onClick={onCerrar}
          className="flex-shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity ml-auto"
          aria-label="Cerrar"
        >
          ×
        </button>
      )}
    </div>
  )
}
