export type Rol = 'super_admin' | 'admin' | 'secretario' | 'tesorero' | 'miembro'

export type EstadoAsistencia = 'presente' | 'ausente_justificado' | 'ausente'

export type EstadoMulta = 'pendiente' | 'confirmada' | 'anulada' | 'pagada'

export type EstadoActivo = 'bueno' | 'regular' | 'mantenimiento' | 'baja'

export type EstadoCumplimiento = 'pendiente' | 'en_proceso' | 'cumplida'

export type TipoMovimiento = 'entrada' | 'salida'

export type TipoConvocatoria = 'asamblea' | 'minga'

export type TipoOrigenMulta = 'asamblea' | 'minga'
