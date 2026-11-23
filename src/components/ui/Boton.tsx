import React from 'react'

export interface BotonProps {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  variante?: 'primario' | 'secundario' | 'peligro' | 'fantasma'
  tamaño?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  cargando?: boolean
  className?: string
}

const varianteClases: Record<NonNullable<BotonProps['variante']>, string> = {
  primario: 'bg-green-700 hover:bg-green-800 text-white border border-transparent',
  secundario: 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700',
  peligro: 'bg-red-600 hover:bg-red-700 text-white border border-transparent',
  fantasma: 'bg-transparent hover:bg-gray-100 text-gray-600 border border-transparent',
}

const tamañoClases: Record<NonNullable<BotonProps['tamaño']>, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function Boton({
  children,
  onClick,
  type = 'button',
  variante = 'primario',
  tamaño = 'md',
  disabled = false,
  cargando = false,
  className = '',
}: BotonProps) {
  const isDisabled = disabled || cargando

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-md font-medium',
        'transition-colors duration-150',
        'focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        varianteClases[variante],
        tamañoClases[tamaño],
        className,
      ].join(' ')}
    >
      {cargando && (
        <svg
          className="animate-spin h-4 w-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}
