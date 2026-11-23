# Design Document

## Overview

El **Sistema Multi-Junta de Gestión Integral** es una plataforma web multi-tenant para juntas de riego, juntas de agua potable, juntas parroquiales rurales y comités barriales del Ecuador. Varias organizaciones operan sobre la misma aplicación con datos completamente aislados entre sí.

La arquitectura se basa en un frontend React + Vite + TypeScript + Tailwind CSS que se comunica directamente con Supabase (PostgreSQL + Auth + Storage) a través de `supabase-js`. No existe backend propio: toda la lógica de acceso a datos reside en las políticas RLS de PostgreSQL y en funciones SQL auxiliares. La aplicación se ejecuta localmente en `http://127.0.0.1:8081`.

**Principios de diseño:**

- **Sin backend propio**: el cliente `supabase-js` hace todas las llamadas a la API REST y en tiempo real de Supabase.
- **Aislamiento multi-tenant por RLS**: la columna `junta_id` está presente en todas las tablas de negocio; las políticas RLS garantizan que cada consulta retorne solo los registros de la junta del usuario autenticado (RF-01.2, RNF-01).
- **Rol almacenado en `perfiles`**: nunca en `user_metadata` de Supabase Auth (RNF-02.2).
- **Secretos en `.env.local`**: la clave `service_role` solo se usa en scripts de prueba fuera del frontend (RNF-02.3).

---

## Architecture

La arquitectura sigue un modelo de **SPA con backend-as-a-service**:

```
┌─────────────────────────────────────────────────────────────┐
│                   Navegador (React SPA)                      │
│                                                             │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Páginas │  │ Hooks    │  │  Lib/    │  │ Tailwind   │  │
│  │ por rol │  │ useAuth  │  │ supabase │  │ CSS        │  │
│  │         │  │ usePerfil│  │ auth     │  │            │  │
│  └────┬────┘  └────┬─────┘  └────┬─────┘  └────────────┘  │
│       └────────────┴─────────────┘                          │
│                        │  supabase-js                        │
└────────────────────────┼────────────────────────────────────┘
                         │  HTTPS / WSS
┌────────────────────────▼────────────────────────────────────┐
│                    Supabase Cloud                            │
│                                                             │
│  ┌────────────┐  ┌───────────────┐  ┌───────────────────┐  │
│  │ Supabase   │  │  PostgreSQL   │  │  Supabase         │  │
│  │ Auth       │  │  + RLS        │  │  Storage          │  │
│  │            │  │  + Triggers   │  │  (buckets)        │  │
│  └────────────┘  └───────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────��───┘
```

**Flujo de autenticación y autorización:**

1. El usuario se autentica con Supabase Auth (correo + contraseña).
2. El frontend lee el perfil desde la tabla `perfiles` usando `auth.uid()`.
3. Cada petición a la API REST de Supabase incluye el JWT del usuario.
4. Las políticas RLS en PostgreSQL evalúan `auth.uid()` y `get_junta_id()` para filtrar registros.
5. El frontend redirige al usuario al panel correspondiente según su rol.

---

## Components and Interfaces

### Estructura de directorios

```
src/
  pages/
    auth/
      Login.tsx               # Formulario de inicio de sesión
      RecuperarClave.tsx       # Solicitud de restablecimiento de contraseña
    super-admin/
      Juntas.tsx               # Listado y registro de juntas (RF-01)
      AsignarAdmin.tsx         # Asignación del rol Administrador (RF-04)
    admin/
      Configuracion.tsx        # Datos generales de la junta (RF-02)
      Sectores.tsx             # Gestión de sectores (RF-02.2)
      Cuentas.tsx              # Administración de cuentas de miembros (RF-05)
    secretario/
      Miembros.tsx             # Nómina de miembros (RF-07)
      Asambleas.tsx            # Registro y asistencia a asambleas (RF-08)
      Mingas.tsx               # Registro y asistencia a mingas (RF-09)
      Predios.tsx              # Predios y recursos por miembro (RF-10, RF-11)
      Horarios.tsx             # Calendario semanal de servicios (RF-12)
      Convocatorias.tsx        # Emisión de convocatorias (RF-25)
      Actas.tsx                # Archivo de actas y resoluciones (RF-26)
      Comunicaciones.tsx       # Correspondencia institucional (RF-29)
    tesorero/
      Ingresos.tsx             # Registro de ingresos (RF-13)
      Multas.tsx               # Gestión de multas (RF-15)
      Egresos.tsx              # Registro de egresos (RF-16)
      Comprobantes.tsx         # Gestión de comprobantes (RF-20)
      Inventario.tsx           # Control de inventario (RF-21)
      ActivosFijos.tsx         # Gestión de activos fijos (RF-22)
      Reportes.tsx             # Reportes económicos (RF-24)
    miembro/
      MiInformacion.tsx        # Datos personales del miembro (RF-32)
      MisPagos.tsx             # Historial de pagos (RF-32.2)
      MisMultas.tsx            # Multas pendientes y pagadas (RF-32.3)
      MisPredios.tsx           # Predios registrados a su nombre (RF-32.4)
      Convocatorias.tsx        # Convocatorias vigentes (RF-32.5)
    compartido/
      Mensajes.tsx             # Bandeja de mensajes internos (RF-33)
      Notificaciones.tsx       # Centro de notificaciones
  components/
    layout/
      Sidebar.tsx              # Navegación lateral por rol
      Header.tsx               # Encabezado con logo, usuario y notificaciones
      ProtectedRoute.tsx       # Componente de ruta protegida por rol
    ui/
      Tabla.tsx                # Tabla reutilizable con paginación y filtros
      Modal.tsx                # Modal genérico
      Formulario.tsx           # Wrapper de formulario con validación
      Boton.tsx                # Botón con variantes de estilo
      Alerta.tsx               # Componente de alerta/notificación visual
      MapaPredio.tsx           # Mapa interactivo para seleccionar coordenadas
      SubidaArchivo.tsx        # Componente de subida de archivos con validación
  lib/
    supabase.ts                # Inicialización del cliente supabase-js
    auth.ts                    # Helpers de autenticación y lectura de perfiles
  hooks/
    useAuth.ts                 # Estado de sesión y usuario autenticado
    usePerfil.ts               # Perfil y rol del usuario actual
    useJunta.ts                # Datos de la junta activa
```

### Rutas de la aplicación

```
/                              → Redirige según rol al iniciar sesión
/login                         → Login.tsx (pública)
/recuperar-clave               → RecuperarClave.tsx (pública)

/super-admin/juntas            → Juntas.tsx
/super-admin/asignar-admin     → AsignarAdmin.tsx

/admin/configuracion           → Configuracion.tsx
/admin/sectores                → Sectores.tsx
/admin/cuentas                 → Cuentas.tsx

/secretario/miembros           → Miembros.tsx
/secretario/asambleas          → Asambleas.tsx
/secretario/mingas             → Mingas.tsx
/secretario/predios            → Predios.tsx
/secretario/horarios           → Horarios.tsx
/secretario/convocatorias      → Convocatorias.tsx
/secretario/actas              → Actas.tsx
/secretario/comunicaciones     → Comunicaciones.tsx

/tesorero/ingresos             → Ingresos.tsx
/tesorero/multas               → Multas.tsx
/tesorero/egresos              → Egresos.tsx
/tesorero/comprobantes         → Comprobantes.tsx
/tesorero/inventario           → Inventario.tsx
/tesorero/activos-fijos        → ActivosFijos.tsx
/tesorero/reportes             → Reportes.tsx

/miembro/mi-informacion        → MiInformacion.tsx
/miembro/mis-pagos             → MisPagos.tsx
/miembro/mis-multas            → MisMultas.tsx
/miembro/mis-predios           → MisPredios.tsx
/miembro/convocatorias         → Convocatorias.tsx

/mensajes                      → Mensajes.tsx (todos los roles)
/notificaciones                → Notificaciones.tsx (todos los roles)
```

**Redirección al iniciar sesión según rol:**

| Rol | Ruta de inicio |
|---|---|
| `super_admin` | `/super-admin/juntas` |
| `admin` | `/admin/configuracion` |
| `secretario` | `/secretario/miembros` |
| `tesorero` | `/tesorero/ingresos` |
| `miembro` | `/miembro/mi-informacion` |

### Componente ProtectedRoute

`ProtectedRoute` recibe una lista de roles permitidos y redirige a `/login` si el usuario no está autenticado, o a una página de acceso denegado si su rol no está en la lista.

```typescript
// src/components/layout/ProtectedRoute.tsx
interface ProtectedRouteProps {
  rolesPermitidos: Rol[];
  children: React.ReactNode;
}
```

### Hook useAuth

```typescript
// src/hooks/useAuth.ts
interface AuthState {
  usuario: User | null;
  perfil: Perfil | null;
  juntaId: string | null;
  rol: Rol | null;
  cargando: boolean;
}
```

---

## Data Models

### Tipos TypeScript

```typescript
// src/types/index.ts

type Rol = 'super_admin' | 'admin' | 'secretario' | 'tesorero' | 'miembro';
type EstadoAsistencia = 'presente' | 'ausente_justificado' | 'ausente';
type EstadoMulta = 'pendiente' | 'confirmada' | 'anulada' | 'pagada';
type EstadoActivo = 'bueno' | 'regular' | 'mantenimiento' | 'baja';
type EstadoCumplimiento = 'pendiente' | 'en_proceso' | 'cumplida';
type TipoMovimiento = 'entrada' | 'salida';
type TipoConvocatoria = 'asamblea' | 'minga';
type TipoOrigenMulta = 'asamblea' | 'minga';
```

### Esquema de base de datos

#### Tablas de Plataforma

```sql
-- Tabla principal de juntas (RF-01)
CREATE TABLE juntas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              text NOT NULL UNIQUE,
  tipo                text NOT NULL
                        CHECK (tipo IN ('riego','agua_potable','parroquial','barrial')),
  provincia           text NOT NULL,
  canton              text NOT NULL,
  parroquia           text NOT NULL,
  direccion           text NOT NULL,
  fecha_constitucion  date NOT NULL,
  logo_url            text,
  creado_por          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Perfiles de usuario: rol y vínculo con junta (RNF-02.2)
-- junta_id es NULL solo para super_admin
CREATE TABLE perfiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  junta_id        uuid REFERENCES juntas(id),
  rol             text NOT NULL
                    CHECK (rol IN ('super_admin','admin','secretario','tesorero','miembro')),
  nombre_completo text NOT NULL,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT un_admin_por_junta UNIQUE NULLS NOT DISTINCT (junta_id, rol)
    -- La unicidad del admin activo se refuerza también por RLS y lógica de aplicación (RF-04.5)
);
```

#### Tablas Administrativas

```sql
-- Sectores geográficos o productivos de la junta (RF-02.2)
CREATE TABLE sectores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id    uuid NOT NULL REFERENCES juntas(id),
  nombre      text NOT NULL,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sectores_junta ON sectores(junta_id);

-- Nómina de miembros (RF-07)
CREATE TABLE miembros (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id      uuid NOT NULL REFERENCES juntas(id),
  cedula        text NOT NULL,
  nombres       text NOT NULL,
  apellidos     text NOT NULL,
  direccion     text,
  telefono      text,
  correo        text,
  sector_id     uuid REFERENCES sectores(id),
  fecha_ingreso date NOT NULL,
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  creado_por    uuid REFERENCES auth.users(id),
  CONSTRAINT uq_cedula_junta UNIQUE (cedula, junta_id)
);
CREATE INDEX idx_miembros_junta ON miembros(junta_id);
CREATE UNIQUE INDEX idx_miembros_cedula_junta ON miembros(cedula, junta_id);

-- Asambleas (RF-08)
CREATE TABLE asambleas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id      uuid NOT NULL REFERENCES juntas(id),
  fecha         date NOT NULL,
  hora          time NOT NULL,
  lugar         text NOT NULL,
  orden_del_dia text,
  estado        text NOT NULL DEFAULT 'abierta'
                  CHECK (estado IN ('abierta','cerrada')),
  porcentaje_participacion numeric(5,2),
  created_at    timestamptz NOT NULL DEFAULT now(),
  creado_por    uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_asambleas_junta ON asambleas(junta_id);

-- Asistencia a asambleas (RF-08)
CREATE TABLE asistencia_asambleas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id        uuid NOT NULL REFERENCES juntas(id),
  asamblea_id     uuid NOT NULL REFERENCES asambleas(id) ON DELETE CASCADE,
  miembro_id      uuid NOT NULL REFERENCES miembros(id),
  estado          text NOT NULL DEFAULT 'ausente'
                    CHECK (estado IN ('presente','ausente_justificado','ausente')),
  susceptible_multa boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_asistencia_asamblea UNIQUE (asamblea_id, miembro_id)
);
CREATE INDEX idx_asistencia_asambleas_junta ON asistencia_asambleas(junta_id);

-- Mingas (RF-09)
CREATE TABLE mingas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id            uuid NOT NULL REFERENCES juntas(id),
  fecha               date NOT NULL,
  hora                time NOT NULL,
  lugar               text NOT NULL,
  actividad           text NOT NULL,
  min_participantes   integer NOT NULL DEFAULT 0,
  estado              text NOT NULL DEFAULT 'abierta'
                        CHECK (estado IN ('abierta','cerrada')),
  porcentaje_participacion numeric(5,2),
  created_at          timestamptz NOT NULL DEFAULT now(),
  creado_por          uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_mingas_junta ON mingas(junta_id);

-- Asistencia a mingas (RF-09)
CREATE TABLE asistencia_mingas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id        uuid NOT NULL REFERENCES juntas(id),
  minga_id        uuid NOT NULL REFERENCES mingas(id) ON DELETE CASCADE,
  miembro_id      uuid NOT NULL REFERENCES miembros(id),
  estado          text NOT NULL DEFAULT 'ausente'
                    CHECK (estado IN ('presente','ausente_justificado','ausente')),
  susceptible_multa boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_asistencia_minga UNIQUE (minga_id, miembro_id)
);
CREATE INDEX idx_asistencia_mingas_junta ON asistencia_mingas(junta_id);

-- Predios o recursos de cada miembro (RF-10, RF-11)
CREATE TABLE predios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id         uuid NOT NULL REFERENCES juntas(id),
  miembro_id       uuid NOT NULL REFERENCES miembros(id),
  codigo_catastral text NOT NULL,
  superficie       numeric(10,2),
  sector_id        uuid REFERENCES sectores(id),
  tipo_uso         text,
  latitud          numeric(10,7),
  longitud         numeric(10,7),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  creado_por       uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_predios_junta ON predios(junta_id);
CREATE INDEX idx_predios_miembro ON predios(miembro_id);

-- Imágenes de predios almacenadas en Supabase Storage (RF-11)
CREATE TABLE imagenes_predios (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id     uuid NOT NULL REFERENCES juntas(id),
  predio_id    uuid NOT NULL REFERENCES predios(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_imagenes_predios_junta ON imagenes_predios(junta_id);

-- Bloques de horario semanal (RF-12)
CREATE TABLE horarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id    uuid NOT NULL REFERENCES juntas(id),
  miembro_id  uuid NOT NULL REFERENCES miembros(id),
  servicio    text NOT NULL,
  dia_semana  integer NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  hora_inicio time NOT NULL,
  hora_fin    time NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_horario_valido CHECK (hora_fin > hora_inicio)
);
CREATE INDEX idx_horarios_solapamiento
  ON horarios(junta_id, servicio, dia_semana, hora_inicio, hora_fin);
```

#### Tablas Financieras

```sql
-- Tabla de sanciones configurada por el Administrador (RF-15.2)
CREATE TABLE tabla_sanciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id     uuid NOT NULL REFERENCES juntas(id),
  tipo_evento  text NOT NULL CHECK (tipo_evento IN ('asamblea','minga')),
  monto        numeric(10,2) NOT NULL CHECK (monto > 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_sancion_tipo_junta UNIQUE (junta_id, tipo_evento)
);
CREATE INDEX idx_tabla_sanciones_junta ON tabla_sanciones(junta_id);

-- Ingresos por pagos de los miembros (RF-13)
CREATE TABLE ingresos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id         uuid NOT NULL REFERENCES juntas(id),
  miembro_id       uuid REFERENCES miembros(id),
  concepto         text NOT NULL,
  monto            numeric(10,2) NOT NULL CHECK (monto > 0),
  fecha            date NOT NULL,
  metodo_pago      text NOT NULL,
  numero_recibo    text NOT NULL,
  comprobante_path text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  registrado_por   uuid REFERENCES auth.users(id),
  CONSTRAINT uq_recibo_junta UNIQUE (numero_recibo, junta_id)
);
CREATE INDEX idx_ingresos_junta ON ingresos(junta_id);
CREATE UNIQUE INDEX idx_ingresos_recibo_junta ON ingresos(numero_recibo, junta_id);

-- Multas por inasistencia (RF-15)
CREATE TABLE multas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id      uuid NOT NULL REFERENCES juntas(id),
  miembro_id    uuid NOT NULL REFERENCES miembros(id),
  origen_id     uuid NOT NULL,
  origen_tipo   text NOT NULL CHECK (origen_tipo IN ('asamblea','minga')),
  monto         numeric(10,2) NOT NULL CHECK (monto > 0),
  estado        text NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','confirmada','anulada','pagada')),
  ingreso_id    uuid REFERENCES ingresos(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  confirmado_por uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_multas_junta ON multas(junta_id);
CREATE INDEX idx_multas_miembro ON multas(miembro_id);

-- Egresos (RF-16)
CREATE TABLE egresos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id         uuid NOT NULL REFERENCES juntas(id),
  categoria        text NOT NULL,
  proveedor        text,
  descripcion      text NOT NULL,
  monto            numeric(10,2) NOT NULL CHECK (monto > 0),
  fecha            date NOT NULL,
  metodo_pago      text NOT NULL,
  comprobante_path text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  registrado_por   uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_egresos_junta ON egresos(junta_id);

-- Artículos de inventario (RF-21)
CREATE TABLE inventario_articulos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id      uuid NOT NULL REFERENCES juntas(id),
  codigo        text NOT NULL,
  nombre        text NOT NULL,
  unidad_medida text NOT NULL,
  stock_actual  numeric(10,3) NOT NULL DEFAULT 0,
  stock_minimo  numeric(10,3) NOT NULL DEFAULT 0,
  categoria     text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_codigo_inventario_junta UNIQUE (codigo, junta_id)
);
CREATE INDEX idx_inventario_articulos_junta ON inventario_articulos(junta_id);

-- Movimientos de inventario (RF-21)
CREATE TABLE inventario_movimientos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id      uuid NOT NULL REFERENCES juntas(id),
  articulo_id   uuid NOT NULL REFERENCES inventario_articulos(id),
  tipo          text NOT NULL CHECK (tipo IN ('entrada','salida')),
  cantidad      numeric(10,3) NOT NULL CHECK (cantidad > 0),
  fecha         date NOT NULL,
  motivo        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  registrado_por uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_inventario_movimientos_junta ON inventario_movimientos(junta_id);

-- Activos fijos (RF-22)
CREATE TABLE activos_fijos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id          uuid NOT NULL REFERENCES juntas(id),
  codigo            text NOT NULL,
  nombre            text NOT NULL,
  descripcion       text,
  valor_adquisicion numeric(12,2) NOT NULL CHECK (valor_adquisicion > 0),
  fecha_adquisicion date NOT NULL,
  vida_util_anos    integer NOT NULL CHECK (vida_util_anos > 0),
  estado            text NOT NULL DEFAULT 'bueno'
                      CHECK (estado IN ('bueno','regular','mantenimiento','baja')),
  fecha_baja        date,
  motivo_baja       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  registrado_por    uuid REFERENCES auth.users(id),
  CONSTRAINT uq_codigo_activo_junta UNIQUE (codigo, junta_id)
);
CREATE INDEX idx_activos_fijos_junta ON activos_fijos(junta_id);
```

#### Tablas de Comunicaciones

```sql
-- Convocatorias (RF-25)
CREATE TABLE convocatorias (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id            uuid NOT NULL REFERENCES juntas(id),
  tipo                text NOT NULL CHECK (tipo IN ('asamblea','minga')),
  titulo              text NOT NULL,
  fecha               date NOT NULL,
  hora                time NOT NULL,
  lugar               text NOT NULL,
  orden_del_dia       text,
  plazo_confirmacion  date,
  documento_path      text,
  estado              text NOT NULL DEFAULT 'vigente'
                        CHECK (estado IN ('vigente','finalizada')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  creado_por          uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_convocatorias_junta ON convocatorias(junta_id);

-- Actas de asambleas (RF-26)
CREATE TABLE actas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id        uuid NOT NULL REFERENCES juntas(id),
  asamblea_id     uuid REFERENCES asambleas(id),
  titulo          text NOT NULL,
  fecha           date NOT NULL,
  descripcion     text,
  documento_path  text,
  publicada       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  creado_por      uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_actas_junta ON actas(junta_id);

-- Resoluciones vinculadas a un acta (RF-26)
CREATE TABLE resoluciones (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id           uuid NOT NULL REFERENCES juntas(id),
  acta_id            uuid NOT NULL REFERENCES actas(id) ON DELETE CASCADE,
  numero             text NOT NULL,
  descripcion        text NOT NULL,
  estado_cumplimiento text NOT NULL DEFAULT 'pendiente'
                       CHECK (estado_cumplimiento IN ('pendiente','en_proceso','cumplida')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_resoluciones_junta ON resoluciones(junta_id);

-- Comunicaciones externas (RF-29)
CREATE TABLE comunicaciones_externas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id             uuid NOT NULL REFERENCES juntas(id),
  institucion_remitente text NOT NULL,
  asunto               text NOT NULL,
  fecha_recepcion      date NOT NULL,
  numero_oficio        text,
  resumen              text,
  documento_path       text,
  respuesta            text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  registrado_por       uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_comunicaciones_externas_junta ON comunicaciones_externas(junta_id);

-- Mensajes internos entre usuarios (RF-33)
CREATE TABLE mensajes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id        uuid NOT NULL REFERENCES juntas(id),
  remitente_id    uuid NOT NULL REFERENCES auth.users(id),
  destinatario_id uuid NOT NULL REFERENCES auth.users(id),
  asunto          text NOT NULL,
  cuerpo          text NOT NULL,
  leido           boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mensajes_junta ON mensajes(junta_id);
CREATE INDEX idx_mensajes_destinatario ON mensajes(destinatario_id);

-- Notificaciones del sistema (RF-04.4, RF-05.2, RF-25.2, RF-33.4)
CREATE TABLE notificaciones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id         uuid NOT NULL REFERENCES juntas(id),
  usuario_id       uuid NOT NULL REFERENCES auth.users(id),
  tipo             text NOT NULL,
  referencia_id    uuid,
  referencia_tipo  text,
  mensaje          text NOT NULL,
  leida            boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notificaciones_junta ON notificaciones(junta_id);
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id);
```

#### Bitácora de auditoría

```sql
-- Registro de cambios en tablas críticas (RF-07.6, RF-10.5, RF-13.6, RF-16.5, RF-26.5)
CREATE TABLE auditoria (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id         uuid REFERENCES juntas(id),
  tabla_afectada   text NOT NULL,
  operacion        text NOT NULL CHECK (operacion IN ('INSERT','UPDATE','DELETE')),
  registro_id      uuid NOT NULL,
  datos_anteriores jsonb,
  datos_nuevos     jsonb,
  usuario_id       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_auditoria_junta ON auditoria(junta_id);
CREATE INDEX idx_auditoria_tabla ON auditoria(tabla_afectada, registro_id);
```

### Funciones SQL auxiliares

```sql
-- Devuelve el junta_id del usuario autenticado
CREATE OR REPLACE FUNCTION get_junta_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT junta_id FROM perfiles WHERE id = auth.uid();
$$;

-- Devuelve el rol del usuario autenticado
CREATE OR REPLACE FUNCTION get_rol()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT rol FROM perfiles WHERE id = auth.uid();
$$;

-- Verifica si el usuario tiene un rol específico
CREATE OR REPLACE FUNCTION tiene_rol(rol_requerido text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles
    WHERE id = auth.uid() AND rol = rol_requerido
  );
$$;

-- Calcula la depreciación acumulada de un activo fijo (método lineal) (RF-22.3)
CREATE OR REPLACE FUNCTION calcular_depreciacion(
  valor_adquisicion numeric,
  vida_util_anos integer,
  fecha_adquisicion date
)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT LEAST(
    valor_adquisicion,
    ROUND(
      (valor_adquisicion / vida_util_anos)
      * EXTRACT(YEAR FROM AGE(CURRENT_DATE, fecha_adquisicion))
      + (valor_adquisicion / vida_util_anos / 12)
      * EXTRACT(MONTH FROM AGE(CURRENT_DATE, fecha_adquisicion)),
      2
    )
  );
$$;

-- Detecta solapamiento de horarios para el mismo servicio y día (RF-12.2)
CREATE OR REPLACE FUNCTION hay_solapamiento_horario(
  p_junta_id uuid,
  p_servicio text,
  p_dia_semana integer,
  p_hora_inicio time,
  p_hora_fin time,
  p_excluir_id uuid DEFAULT NULL
)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM horarios
    WHERE junta_id = p_junta_id
      AND servicio = p_servicio
      AND dia_semana = p_dia_semana
      AND id IS DISTINCT FROM p_excluir_id
      AND (hora_inicio, hora_fin) OVERLAPS (p_hora_inicio, p_hora_fin)
  );
$$;
```

---

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe mantenerse verdadero en todas las ejecuciones válidas de un sistema; en esencia, una afirmación formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre las especificaciones legibles por humanos y las garantías de corrección verificables por máquina.*

### Property 1: Unicidad de junta_id

*Para cualquier* conjunto de juntas creadas en la plataforma, todos los `junta_id` asignados deben ser distintos entre sí; ningún identificador puede repetirse.

**Validates: Requirements 1.2**

### Property 2: Rechazo de campos obligatorios vacíos

*Para cualquier* envío del formulario de registro de junta donde al menos un campo obligatorio (nombre, tipo, provincia, cantón, parroquia, dirección, fecha_constitucion) esté ausente o vacío, la operación debe rechazarse con un mensaje de error que identifique el campo faltante.

**Validates: Requirements 1.3**

### Property 3: Unicidad de nombre de junta

*Para cualquier* nombre de junta ya registrado en la plataforma, el intento de crear otra junta con ese mismo nombre debe siempre ser rechazado.

**Validates: Requirements 1.4**

### Property 4: Auditoría en creación de registros

*Para cualquier* junta creada exitosamente, los campos `created_at` y `creado_por` deben estar presentes, ser no nulos y reflejar la hora exacta del registro y el usuario que lo realizó.

**Validates: Requirements 1.5**

### Property 5: Restricción de eliminación de sector con miembros

*Para cualquier* sector que tenga al menos un miembro activo asociado, el intento de eliminación debe ser rechazado siempre, mostrando el número de miembros afectados.

**Validates: Requirements 2.4**

### Property 6: Un único administrador activo por junta

*Para cualquier* junta, después de cualquier secuencia de asignaciones o cambios de rol, el número de usuarios con rol `admin` activo debe ser como máximo uno.

**Validates: Requirements 4.5**

### Property 7: Unicidad de correo por junta

*Para cualquier* correo electrónico ya registrado en una junta, el intento de crear otro usuario con ese mismo correo en la misma junta debe siempre ser rechazado.

**Validates: Requirements 5.5**

### Property 8: Unicidad de cédula por junta

*Para cualquier* cédula ya registrada en una junta, el intento de registrar otro miembro con esa misma cédula en la misma junta debe ser rechazado con un mensaje de duplicado.

**Validates: Requirements 7.3**

### Property 9: Completitud de lista de asistencia y generación de multas

*Para cualquier* asamblea o minga creada en cualquier junta, la lista de asistencia generada debe contener exactamente tantos registros como miembros activos tenga esa junta en ese momento, ni más ni menos. Al cerrar el registro con N ausentes no justificados, deben crearse exactamente N multas en estado `pendiente`.

**Validates: Requirements 8.2, 15.1**

### Property 10: Corrección del porcentaje de participación

*Para cualquier* asamblea o minga cerrada con un total de T miembros y P marcados como presentes, el porcentaje de participación almacenado debe ser exactamente `ROUND(P / T * 100, 2)`.

**Validates: Requirements 8.4, 9.4**

### Property 11: Marcado automático de susceptible de multa

*Para cualquier* registro de asistencia en estado `ausente` (sin justificación), el campo `susceptible_multa` debe ser `true`; para cualquier registro en estado `presente` o `ausente_justificado`, debe ser `false`.

**Validates: Requirements 8.5, 9.5**

### Property 12: Rechazo de solapamiento de horarios

*Para cualquier* par de bloques horarios del mismo servicio y día de la semana dentro de la misma junta cuyos intervalos `[hora_inicio, hora_fin)` se superpongan, el intento de crear el segundo bloque debe fallar con un mensaje que identifique el bloque en conflicto.

**Validates: Requirements 12.2**

### Property 13: Unicidad de número de recibo por junta

*Para cualquier* conjunto de ingresos registrados en una junta, todos los `numero_recibo` deben ser únicos dentro de esa junta; ningún número puede repetirse.

**Validates: Requirements 13.2**

### Property 14: Validación de archivos subidos

*Para cualquier* archivo cuyo tipo MIME no sea `image/jpeg`, `image/png`, `image/webp` (para imágenes de predios, RF-11) o `image/jpeg`, `image/png`, `application/pdf` (para comprobantes, RF-20), o cuyo tamaño supere el límite configurado (5 MB para imágenes de predios, 10 MB para comprobantes), el intento de subida debe rechazarse con un mensaje descriptivo del error.

**Validates: Requirements 11.4, 11.5, 20.2, 20.3**

### Property 15: Corrección del cálculo de depreciación lineal

*Para cualquier* activo fijo con valor de adquisición `V`, vida útil `U` años y fecha de adquisición `F`, la depreciación acumulada calculada en cualquier momento `T` debe ser `MIN(V, V / U * años_transcurridos(F, T))`, con precisión de dos decimales.

**Validates: Requirements 22.3**

### Property 16: Aislamiento multi-tenant por RLS

*Para cualquier* usuario autenticado de la junta A, toda consulta sobre cualquier tabla de negocio debe retornar únicamente registros cuyo `junta_id` sea igual al de la junta A. Para cualquier par de juntas distintas A y B, un usuario de junta A no debe poder leer ni escribir registros de junta B, ni siquiera mediante petición directa a la API REST.

**Validates: Requirements 1.2, 1.3**

---

## Error Handling

### Estrategia general

El frontend sigue un patrón consistente para el manejo de errores:

1. **Errores de validación de formulario** se muestran inmediatamente junto al campo incorrecto antes de enviar la petición a Supabase (RF-01.3, RF-07.3, RF-11.4, RF-20.2).
2. **Errores de la API de Supabase** (violaciones de restricciones únicas, errores RLS, timeouts) se capturan en el hook o en la función de servicio y se comunican al usuario mediante el componente `Alerta`.
3. **Errores de autenticación** redirigen al usuario a `/login` (RNF-02.4).
4. **Errores de autorización** (rol insuficiente) muestran una página de acceso denegado (RNF-02.5).
5. **Errores de Storage** (tipo o tamaño de archivo incorrecto) se validan en el cliente antes de la subida y se muestran con el componente `Alerta` (RF-11.5, RF-20.3).

### Códigos de error de Supabase y manejo

| Código PostgreSQL | Situación | Respuesta en UI |
|---|---|---|
| `23505` (unique_violation) | Nombre de junta duplicado, cédula duplicada, recibo duplicado | Mensaje de duplicado en el campo correspondiente |
| `23503` (foreign_key_violation) | Eliminar sector con miembros, eliminar predio con historial | Mensaje con número de registros dependientes |
| `42501` (insufficient_privilege) | Acceso a datos de otra junta bloqueado por RLS | Alerta de acceso denegado; log en consola |
| `PGRST116` | Registro no encontrado | Mensaje de "registro no encontrado" |

### Validaciones en el cliente (antes de llamar a Supabase)

- **Campos obligatorios**: verificados con validación de formulario en React antes del submit.
- **Formato de cédula ecuatoriana**: validación del algoritmo de módulo 10 en el cliente.
- **Tipo y tamaño de archivos**: verificación del `file.type` y `file.size` antes de llamar a `supabase.storage.from().upload()`.
- **Solapamiento de horarios**: consulta previa a `horarios` con `hay_solapamiento_horario()` antes de insertar.
- **Monto positivo**: validación numérica en formularios financieros.

---

## Testing Strategy

### Enfoque dual

La estrategia de pruebas combina **pruebas basadas en ejemplos** (Vitest + Testing Library) y **pruebas basadas en propiedades** (fast-check) para cobertura complementaria.

#### Pruebas unitarias basadas en ejemplos (Vitest)

Cubren casos concretos, condiciones de borde y puntos de integración:

- Inicialización del cliente `supabase.ts` con variables de entorno correctas.
- Comportamiento del `ProtectedRoute` cuando el usuario no está autenticado o su rol no es permitido.
- Redirección al panel correcto según rol al iniciar sesión.
- Renderizado del logotipo en el `Header` cuando `logo_url` está configurado (RF-02.5).
- Comportamiento del componente `SubidaArchivo` con archivos válidos e inválidos.
- Cálculo de la depreciación lineal para activos con valores concretos (RF-22.3).
- Generación del número de recibo único con ejemplos fijos (RF-13.2).

#### Pruebas basadas en propiedades (fast-check, mínimo 100 iteraciones por propiedad)

Cada prueba de propiedad referencia la propiedad del diseño en su comentario de etiqueta:
`// Feature: sistema-multi-junta, Property N: <texto de la propiedad>`

- *P1 — Unicidad de junta_id*: genera N registros de juntas con nombres distintos, verifica que todos los UUIDs asignados sean únicos.
- *P2 — Rechazo de campos obligatorios vacíos*: genera combinaciones de formularios con al menos un campo obligatorio vacío o nulo; verifica que la función de validación siempre retorna error con el nombre del campo faltante.
- *P3 — Unicidad de nombre de junta*: genera un nombre y lo registra; luego intenta registrar otro con el mismo nombre; verifica que siempre falla con error de duplicado.
- *P4 — Auditoría en creación*: genera datos de junta válidos, crea el registro, verifica que `created_at` y `creado_por` son siempre no nulos.
- *P5 — Rechazo de eliminación de sector con miembros*: genera sectores con 1..N miembros asociados; verifica que el intento de eliminar el sector siempre falla.
- *P6 — Único admin activo por junta*: genera secuencias de asignaciones de rol de admin; verifica que en ningún momento hay más de un admin activo por junta.
- *P7 y P8 — Unicidad de correo y cédula*: genera pares de usuarios con el mismo correo o la misma cédula en la misma junta; verifica que el segundo registro siempre falla.
- *P9 — Completitud de asistencia y multas*: genera juntas con N miembros activos, crea una asamblea, verifica que se generan exactamente N registros de asistencia. Cierra con K ausentes; verifica que se crean exactamente K multas pendientes.
- *P10 — Porcentaje de participación*: genera valores de P (presentes) y T (total, T ≥ P ≥ 0, T > 0); verifica que `porcentaje = ROUND(P/T*100, 2)`.
- *P11 — Susceptible de multa*: genera registros de asistencia con estado arbitrario; verifica que `susceptible_multa = (estado === 'ausente')`.
- *P12 — Sin solapamiento de horarios*: genera pares de bloques horarios con solapamiento calculado; verifica que `hay_solapamiento_horario()` retorna `true` exactamente cuando los intervalos se solapan.
- *P13 — Unicidad de número de recibo*: genera N ingresos en la misma junta; verifica que todos los `numero_recibo` son distintos.
- *P14 — Validación de archivos*: genera tipos MIME y tamaños de archivo arbitrarios; verifica que la función de validación acepta solo los tipos y tamaños permitidos.
- *P15 — Depreciación lineal*: genera valores V > 0, U > 0 y una fecha de adquisición; verifica que `calcular_depreciacion(V, U, F)` está siempre en el rango `[0, V]` y sigue la fórmula lineal.
- *P16 — Aislamiento multi-tenant*: simula dos usuarios de juntas distintas A y B; verifica que al consultar cualquier tabla de negocio, los resultados del usuario A no incluyen registros con `junta_id = B`.

### Configuración de fast-check

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
```

```typescript
// En cada archivo de prueba de propiedad
import fc from 'fast-check';

// Mínimo 100 iteraciones
fc.configureGlobal({ numRuns: 100 });
```

### Cobertura de integración

Las pruebas de integración con la base de datos real de Supabase (entorno de staging) cubren:

- Autenticación completa con Supabase Auth.
- Verificación de que las políticas RLS bloquean el acceso cruzado entre juntas.
- Subida y descarga de archivos en cada bucket con usuarios de distintos roles.
- Generación de reportes PDF a partir de datos reales (RF-24.5).

---

## Supabase Storage

### Buckets

| Bucket | Acceso | Ruta interna |
|---|---|---|
| `predios-imagenes` | Privado (RLS) | `{junta_id}/{predio_id}/{filename}` |
| `comprobantes` | Privado (RLS) | `{junta_id}/{tipo}/{registro_id}/{filename}` |
| `documentos-actas` | Privado (RLS) | `{junta_id}/actas/{acta_id}/{filename}` |
| `documentos-convocatorias` | Privado (RLS) | `{junta_id}/convocatorias/{conv_id}/{filename}` |
| `comunicaciones-externas` | Privado (RLS) | `{junta_id}/comunicaciones/{com_id}/{filename}` |
| `logos-juntas` | Público (lectura) | `{junta_id}/logo/{filename}` |

Los buckets privados aplican políticas de Storage que verifican que el `junta_id` del path coincida con el del usuario autenticado (mismo mecanismo que RLS en tablas).

---

## Políticas RLS

### Funciones auxiliares

Las políticas RLS utilizan las funciones `get_junta_id()` y `get_rol()` descritas en el modelo de datos para mantener las políticas legibles y eficientes.

### Matriz de permisos

| Tabla | super_admin | admin | secretario | tesorero | miembro |
|---|---|---|---|---|---|
| `juntas` | SELECT, INSERT, UPDATE | SELECT (propia) | SELECT (propia) | SELECT (propia) | SELECT (propia) |
| `perfiles` | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE (propia junta) | SELECT (propia junta) | SELECT (propia junta) | SELECT (propio) |
| `sectores` | — | CRUD (propia junta) | SELECT (propia junta) | SELECT (propia junta) | SELECT (propia junta) |
| `miembros` | — | CRUD (propia junta) | CRUD (propia junta) | SELECT (propia junta) | SELECT (propio) |
| `asambleas` | — | SELECT (propia junta) | CRUD (propia junta) | SELECT (propia junta) | — |
| `asistencia_asambleas` | — | SELECT (propia junta) | CRUD (propia junta) | SELECT (propia junta) | SELECT (propio) |
| `mingas` | — | SELECT (propia junta) | CRUD (propia junta) | SELECT (propia junta) | — |
| `asistencia_mingas` | — | SELECT (propia junta) | CRUD (propia junta) | SELECT (propia junta) | SELECT (propio) |
| `predios` | — | SELECT (propia junta) | CRUD (propia junta) | SELECT (propia junta) | SELECT (propio) |
| `imagenes_predios` | — | SELECT (propia junta) | CRUD (propia junta) | SELECT (propia junta) | SELECT (propio) |
| `horarios` | — | SELECT (propia junta) | CRUD (propia junta) | SELECT (propia junta) | SELECT (propio) |
| `tabla_sanciones` | — | CRUD (propia junta) | SELECT (propia junta) | SELECT (propia junta) | — |
| `ingresos` | — | SELECT (propia junta) | SELECT (propia junta) | CRUD (propia junta) | SELECT (propio) |
| `multas` | — | SELECT (propia junta) | SELECT (propia junta) | CRUD (propia junta) | SELECT (propio) |
| `egresos` | — | SELECT (propia junta) | SELECT (propia junta) | CRUD (propia junta) | — |
| `inventario_articulos` | — | SELECT (propia junta) | SELECT (propia junta) | CRUD (propia junta) | — |
| `inventario_movimientos` | — | SELECT (propia junta) | SELECT (propia junta) | CRUD (propia junta) | — |
| `activos_fijos` | — | SELECT (propia junta) | SELECT (propia junta) | CRUD (propia junta) | — |
| `convocatorias` | — | SELECT (propia junta) | CRUD (propia junta) | SELECT (propia junta) | SELECT (propia junta) |
| `actas` | — | SELECT (propia junta) | CRUD (propia junta) | SELECT (propia junta) | SELECT (propia junta) |
| `resoluciones` | — | SELECT (propia junta) | CRUD (propia junta) | SELECT (propia junta) | SELECT (propia junta) |
| `comunicaciones_externas` | — | SELECT (propia junta) | CRUD (propia junta) | SELECT (propia junta) | — |
| `mensajes` | — | CRUD (propia junta) | SELECT (propios) | SELECT (propios) | CRUD (propios) |
| `notificaciones` | — | SELECT (propia junta) | SELECT (propios) | SELECT (propios) | SELECT (propios) |
| `auditoria` | SELECT | SELECT (propia junta) | — | — | — |

### Ejemplos de políticas SQL

```sql
-- ============================================================
-- Tabla: juntas
-- ============================================================
ALTER TABLE juntas ENABLE ROW LEVEL SECURITY;

-- Solo el super_admin puede crear juntas (RF-01)
CREATE POLICY "super_admin puede crear juntas"
  ON juntas FOR INSERT
  TO authenticated
  WITH CHECK (get_rol() = 'super_admin');

-- Todos los autenticados ven su propia junta; super_admin ve todas
CREATE POLICY "ver juntas propias o todas para super_admin"
  ON juntas FOR SELECT
  TO authenticated
  USING (
    get_rol() = 'super_admin'
    OR id = get_junta_id()
  );

-- Solo el super_admin puede actualizar juntas
CREATE POLICY "super_admin puede actualizar juntas"
  ON juntas FOR UPDATE
  TO authenticated
  USING (get_rol() = 'super_admin')
  WITH CHECK (get_rol() = 'super_admin');

-- ============================================================
-- Tabla: perfiles
-- ============================================================
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- Los usuarios ven su propio perfil y el super_admin ve todos
CREATE POLICY "ver perfiles propios o todos para super_admin"
  ON perfiles FOR SELECT
  TO authenticated
  USING (
    get_rol() = 'super_admin'
    OR id = auth.uid()
    OR junta_id = get_junta_id()
  );

-- Solo el admin y super_admin pueden insertar perfiles
CREATE POLICY "admin puede crear perfiles en su junta"
  ON perfiles FOR INSERT
  TO authenticated
  WITH CHECK (
    get_rol() = 'super_admin'
    OR (get_rol() = 'admin' AND junta_id = get_junta_id())
  );

-- Solo el admin y super_admin pueden actualizar perfiles
CREATE POLICY "admin puede actualizar perfiles en su junta"
  ON perfiles FOR UPDATE
  TO authenticated
  USING (
    get_rol() = 'super_admin'
    OR (get_rol() = 'admin' AND junta_id = get_junta_id())
  )
  WITH CHECK (
    get_rol() = 'super_admin'
    OR (get_rol() = 'admin' AND junta_id = get_junta_id())
  );

-- ============================================================
-- Tabla: miembros
-- ============================================================
ALTER TABLE miembros ENABLE ROW LEVEL SECURITY;

-- Admin y secretario pueden crear miembros en su junta (RF-07)
CREATE POLICY "admin y secretario pueden insertar miembros"
  ON miembros FOR INSERT
  TO authenticated
  WITH CHECK (
    junta_id = get_junta_id()
    AND get_rol() IN ('admin', 'secretario')
  );

-- Admin, secretario y tesorero ven todos los miembros de su junta
-- El miembro ve solo su propio registro (RF-32.1)
CREATE POLICY "ver miembros de la junta o propio"
  ON miembros FOR SELECT
  TO authenticated
  USING (
    (junta_id = get_junta_id() AND get_rol() IN ('admin','secretario','tesorero'))
    OR (id::text = (SELECT perfil_miembro_id FROM perfiles WHERE id = auth.uid())::text)
  );

-- Admin y secretario pueden actualizar miembros en su junta
CREATE POLICY "admin y secretario pueden actualizar miembros"
  ON miembros FOR UPDATE
  TO authenticated
  USING (
    junta_id = get_junta_id()
    AND get_rol() IN ('admin', 'secretario')
  )
  WITH CHECK (
    junta_id = get_junta_id()
    AND get_rol() IN ('admin', 'secretario')
  );

-- ============================================================
-- Tabla: ingresos
-- ============================================================
ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;

-- Solo el tesorero puede registrar ingresos en su junta (RF-13)
CREATE POLICY "tesorero puede insertar ingresos"
  ON ingresos FOR INSERT
  TO authenticated
  WITH CHECK (
    junta_id = get_junta_id()
    AND get_rol() = 'tesorero'
  );

-- Admin y tesorero ven todos los ingresos; miembro ve los propios
CREATE POLICY "ver ingresos de la junta o propios"
  ON ingresos FOR SELECT
  TO authenticated
  USING (
    (junta_id = get_junta_id() AND get_rol() IN ('admin','tesorero','secretario'))
    OR (miembro_id IS NOT NULL AND miembro_id::text IN (
      SELECT m.id::text FROM miembros m
      JOIN perfiles p ON p.id = auth.uid()
      WHERE m.correo = p.id::text
    ))
  );

-- Solo el tesorero puede actualizar ingresos de su junta
CREATE POLICY "tesorero puede actualizar ingresos"
  ON ingresos FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() = 'tesorero')
  WITH CHECK (junta_id = get_junta_id() AND get_rol() = 'tesorero');

-- ============================================================
-- Tabla: mensajes
-- ============================================================
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

-- Un usuario solo puede ver mensajes donde es remitente o destinatario (RF-33)
CREATE POLICY "ver mensajes propios"
  ON mensajes FOR SELECT
  TO authenticated
  USING (
    junta_id = get_junta_id()
    AND (remitente_id = auth.uid() OR destinatario_id = auth.uid())
  );

-- Un usuario puede enviar mensajes dentro de su junta
CREATE POLICY "enviar mensajes en la junta"
  ON mensajes FOR INSERT
  TO authenticated
  WITH CHECK (
    junta_id = get_junta_id()
    AND remitente_id = auth.uid()
  );

-- Un usuario puede marcar como leído solo sus propios mensajes recibidos
CREATE POLICY "marcar leido mensajes propios"
  ON mensajes FOR UPDATE
  TO authenticated
  USING (
    junta_id = get_junta_id()
    AND destinatario_id = auth.uid()
  )
  WITH CHECK (
    junta_id = get_junta_id()
    AND destinatario_id = auth.uid()
  );
```

---

## Bitácora mediante triggers

La función `fn_auditoria()` se instala como trigger `AFTER INSERT OR UPDATE OR DELETE` en las tablas críticas. Escribe en `auditoria` con `datos_anteriores` (OLD) y `datos_nuevos` (NEW) en JSONB.

```sql
-- Función genérica de auditoría
CREATE OR REPLACE FUNCTION fn_auditoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO auditoria (
    junta_id,
    tabla_afectada,
    operacion,
    registro_id,
    datos_anteriores,
    datos_nuevos,
    usuario_id
  ) VALUES (
    COALESCE(NEW.junta_id, OLD.junta_id),
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Instalación en tablas críticas
CREATE TRIGGER trg_auditoria_miembros
  AFTER INSERT OR UPDATE OR DELETE ON miembros
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

CREATE TRIGGER trg_auditoria_ingresos
  AFTER INSERT OR UPDATE OR DELETE ON ingresos
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

CREATE TRIGGER trg_auditoria_egresos
  AFTER INSERT OR UPDATE OR DELETE ON egresos
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

CREATE TRIGGER trg_auditoria_multas
  AFTER INSERT OR UPDATE OR DELETE ON multas
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

CREATE TRIGGER trg_auditoria_activos_fijos
  AFTER INSERT OR UPDATE OR DELETE ON activos_fijos
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

CREATE TRIGGER trg_auditoria_actas
  AFTER INSERT OR UPDATE OR DELETE ON actas
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

CREATE TRIGGER trg_auditoria_resoluciones
  AFTER INSERT OR UPDATE OR DELETE ON resoluciones
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
```

---

## Decisiones de diseño y rationales

| Decisión | Alternativa considerada | Razón de la elección |
|---|---|---|
| Sin backend propio; solo supabase-js | API REST propia con Node.js | Reduce la complejidad operativa; Supabase provee auth, storage y RLS sin infraestructura adicional |
| Rol en tabla `perfiles` | `user_metadata` de Supabase Auth | `user_metadata` no está protegido por RLS; la tabla `perfiles` permite políticas granulares |
| `junta_id` en cada tabla de negocio | Schema separado por junta | Un solo schema es más sencillo de mantener y escalar; RLS garantiza el aislamiento |
| fast-check para pruebas de propiedades | Implementación manual de generadores | fast-check es una librería madura con shrinking automático de contraejemplos |
| `numeric(10,2)` para montos | `float` | Evita errores de punto flotante en cálculos financieros |
| Trigger genérico `fn_auditoria()` | Triggers individuales por tabla | Un solo trigger reutilizable es más fácil de mantener y auditar |
