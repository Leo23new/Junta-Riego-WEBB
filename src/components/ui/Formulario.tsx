import React from 'react'

export interface FormularioProps {
  onSubmit: (e: React.FormEvent) => void
  children: React.ReactNode
  className?: string
}

export function Formulario({ onSubmit, children, className = '' }: FormularioProps) {
  return (
    <form
      onSubmit={onSubmit}
      className={`space-y-4 ${className}`}
      noValidate
    >
      {children}
    </form>
  )
}

export interface CampoFormularioProps {
  label: string
  htmlFor: string
  error?: string
  requerido?: boolean
  children: React.ReactNode
}

export function CampoFormulario({
  label,
  htmlFor,
  error,
  requerido = false,
  children,
}: CampoFormularioProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">
        {label}
        {requerido && (
          <span className="text-red-500 ml-1" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
