-- =============================================================
-- Sistema Multi-Junta de Gestión Integral
-- Migración 001: Esquema completo de base de datos
-- =============================================================
-- Requisitos: RNF-01, RNF-02
-- =============================================================

-- =============================================================
-- EXTENSIONES
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- TABLAS DE PLATAFORMA
-- =============================================================

-- Tabla principal de juntas (RF-01)
CREATE TABLE IF NOT EXISTS juntas (
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
CREATE TABLE IF NOT EXISTS perfiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  junta_id        uuid REFERENCES juntas(id),
  rol             text NOT NULL
                    CHECK (rol IN ('super_admin','admin','secretario','tesorero','miembro')),
  nombre_completo text NOT NULL,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT un_admin_por_junta UNIQUE NULLS NOT DISTINCT (junta_id, rol)
);

-- =============================================================
-- TABLAS ADMINISTRATIVAS
-- =============================================================

-- Sectores geográficos o productivos de la junta (RF-02.2)
CREATE TABLE IF NOT EXISTS sectores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id    uuid NOT NULL REFERENCES juntas(id),
  nombre      text NOT NULL,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sectores_junta ON sectores(junta_id);

-- Nómina de miembros (RF-07)
CREATE TABLE IF NOT EXISTS miembros (
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
CREATE INDEX IF NOT EXISTS idx_miembros_junta ON miembros(junta_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_miembros_cedula_junta ON miembros(cedula, junta_id);

-- Asambleas (RF-08)
CREATE TABLE IF NOT EXISTS asambleas (
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
CREATE INDEX IF NOT EXISTS idx_asambleas_junta ON asambleas(junta_id);

-- Asistencia a asambleas (RF-08)
CREATE TABLE IF NOT EXISTS asistencia_asambleas (
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
CREATE INDEX IF NOT EXISTS idx_asistencia_asambleas_junta ON asistencia_asambleas(junta_id);

-- Mingas (RF-09)
CREATE TABLE IF NOT EXISTS mingas (
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
CREATE INDEX IF NOT EXISTS idx_mingas_junta ON mingas(junta_id);

-- Asistencia a mingas (RF-09)
CREATE TABLE IF NOT EXISTS asistencia_mingas (
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
CREATE INDEX IF NOT EXISTS idx_asistencia_mingas_junta ON asistencia_mingas(junta_id);

-- Predios o recursos de cada miembro (RF-10, RF-11)
CREATE TABLE IF NOT EXISTS predios (
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
CREATE INDEX IF NOT EXISTS idx_predios_junta ON predios(junta_id);
CREATE INDEX IF NOT EXISTS idx_predios_miembro ON predios(miembro_id);

-- Imágenes de predios almacenadas en Supabase Storage (RF-11)
CREATE TABLE IF NOT EXISTS imagenes_predios (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id     uuid NOT NULL REFERENCES juntas(id),
  predio_id    uuid NOT NULL REFERENCES predios(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_imagenes_predios_junta ON imagenes_predios(junta_id);

-- Bloques de horario semanal (RF-12)
CREATE TABLE IF NOT EXISTS horarios (
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
CREATE INDEX IF NOT EXISTS idx_horarios_solapamiento
  ON horarios(junta_id, servicio, dia_semana, hora_inicio, hora_fin);

-- =============================================================
-- TABLAS FINANCIERAS
-- =============================================================

-- Tabla de sanciones configurada por el Administrador (RF-15.2)
CREATE TABLE IF NOT EXISTS tabla_sanciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id     uuid NOT NULL REFERENCES juntas(id),
  tipo_evento  text NOT NULL CHECK (tipo_evento IN ('asamblea','minga')),
  monto        numeric(10,2) NOT NULL CHECK (monto > 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_sancion_tipo_junta UNIQUE (junta_id, tipo_evento)
);
CREATE INDEX IF NOT EXISTS idx_tabla_sanciones_junta ON tabla_sanciones(junta_id);

-- Ingresos por pagos de los miembros (RF-13)
CREATE TABLE IF NOT EXISTS ingresos (
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
CREATE INDEX IF NOT EXISTS idx_ingresos_junta ON ingresos(junta_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingresos_recibo_junta ON ingresos(numero_recibo, junta_id);

-- Multas por inasistencia (RF-15)
CREATE TABLE IF NOT EXISTS multas (
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
CREATE INDEX IF NOT EXISTS idx_multas_junta ON multas(junta_id);
CREATE INDEX IF NOT EXISTS idx_multas_miembro ON multas(miembro_id);

-- Egresos (RF-16)
CREATE TABLE IF NOT EXISTS egresos (
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
CREATE INDEX IF NOT EXISTS idx_egresos_junta ON egresos(junta_id);

-- Artículos de inventario (RF-21)
CREATE TABLE IF NOT EXISTS inventario_articulos (
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
CREATE INDEX IF NOT EXISTS idx_inventario_articulos_junta ON inventario_articulos(junta_id);

-- Movimientos de inventario (RF-21)
CREATE TABLE IF NOT EXISTS inventario_movimientos (
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
CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_junta ON inventario_movimientos(junta_id);

-- Activos fijos (RF-22)
CREATE TABLE IF NOT EXISTS activos_fijos (
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
CREATE INDEX IF NOT EXISTS idx_activos_fijos_junta ON activos_fijos(junta_id);

-- =============================================================
-- TABLAS DE COMUNICACIONES
-- =============================================================

-- Convocatorias (RF-25)
CREATE TABLE IF NOT EXISTS convocatorias (
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
CREATE INDEX IF NOT EXISTS idx_convocatorias_junta ON convocatorias(junta_id);

-- Actas de asambleas (RF-26)
CREATE TABLE IF NOT EXISTS actas (
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
CREATE INDEX IF NOT EXISTS idx_actas_junta ON actas(junta_id);

-- Resoluciones vinculadas a un acta (RF-26)
CREATE TABLE IF NOT EXISTS resoluciones (
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
CREATE INDEX IF NOT EXISTS idx_resoluciones_junta ON resoluciones(junta_id);

-- Comunicaciones externas (RF-29)
CREATE TABLE IF NOT EXISTS comunicaciones_externas (
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
CREATE INDEX IF NOT EXISTS idx_comunicaciones_externas_junta ON comunicaciones_externas(junta_id);

-- Mensajes internos entre usuarios (RF-33)
CREATE TABLE IF NOT EXISTS mensajes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id        uuid NOT NULL REFERENCES juntas(id),
  remitente_id    uuid NOT NULL REFERENCES auth.users(id),
  destinatario_id uuid NOT NULL REFERENCES auth.users(id),
  asunto          text NOT NULL,
  cuerpo          text NOT NULL,
  leido           boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mensajes_junta ON mensajes(junta_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_destinatario ON mensajes(destinatario_id);

-- Notificaciones del sistema (RF-04.4, RF-05.2, RF-25.2, RF-33.4)
CREATE TABLE IF NOT EXISTS notificaciones (
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
CREATE INDEX IF NOT EXISTS idx_notificaciones_junta ON notificaciones(junta_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id);

-- =============================================================
-- BITÁCORA DE AUDITORÍA
-- =============================================================

-- Registro de cambios en tablas críticas (RF-07.6, RF-10.5, RF-13.6, RF-16.5, RF-26.5)
CREATE TABLE IF NOT EXISTS auditoria (
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
CREATE INDEX IF NOT EXISTS idx_auditoria_junta ON auditoria(junta_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria(tabla_afectada, registro_id);

-- =============================================================
-- FUNCIONES SQL AUXILIARES
-- =============================================================

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
  p_junta_id   uuid,
  p_servicio   text,
  p_dia_semana integer,
  p_hora_inicio time,
  p_hora_fin    time,
  p_excluir_id  uuid DEFAULT NULL
)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM horarios
    WHERE junta_id    = p_junta_id
      AND servicio    = p_servicio
      AND dia_semana  = p_dia_semana
      AND id IS DISTINCT FROM p_excluir_id
      AND (hora_inicio, hora_fin) OVERLAPS (p_hora_inicio, p_hora_fin)
  );
$$;

-- =============================================================
-- FUNCIÓN Y TRIGGERS DE AUDITORÍA
-- =============================================================

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
    COALESCE(
      CASE WHEN TG_OP <> 'DELETE' THEN (to_jsonb(NEW) ->> 'junta_id')::uuid ELSE NULL END,
      CASE WHEN TG_OP <> 'INSERT' THEN (to_jsonb(OLD) ->> 'junta_id')::uuid ELSE NULL END
    ),
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(
      CASE WHEN TG_OP <> 'DELETE' THEN (to_jsonb(NEW) ->> 'id')::uuid ELSE NULL END,
      (to_jsonb(OLD) ->> 'id')::uuid
    ),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers en tablas críticas
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

-- =============================================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- =============================================================

ALTER TABLE juntas                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectores                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE miembros                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE asambleas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia_asambleas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mingas                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia_mingas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE predios                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE imagenes_predios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabla_sanciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingresos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE multas                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE egresos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_articulos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_movimientos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE activos_fijos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE convocatorias            ENABLE ROW LEVEL SECURITY;
ALTER TABLE actas                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE resoluciones             ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunicaciones_externas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria                ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- POLÍTICAS RLS — JUNTAS
-- =============================================================

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

-- Solo el super_admin puede eliminar juntas
CREATE POLICY "super_admin puede eliminar juntas"
  ON juntas FOR DELETE
  TO authenticated
  USING (get_rol() = 'super_admin');

-- =============================================================
-- POLÍTICAS RLS — PERFILES
-- =============================================================

-- Los usuarios ven su propio perfil; admin y super_admin ven todos en su junta
CREATE POLICY "ver perfiles propios o todos para super_admin"
  ON perfiles FOR SELECT
  TO authenticated
  USING (
    get_rol() = 'super_admin'
    OR id = auth.uid()
    OR junta_id = get_junta_id()
  );

-- Solo el super_admin puede insertar perfiles directamente
-- (la invitación de usuarios se hace mediante service_role en el backend)
CREATE POLICY "super_admin puede crear perfiles"
  ON perfiles FOR INSERT
  TO authenticated
  WITH CHECK (
    get_rol() = 'super_admin'
    OR (get_rol() = 'admin' AND junta_id = get_junta_id())
  );

-- super_admin puede actualizar cualquiera; admin actualiza perfiles de su junta; usuario actualiza el propio
CREATE POLICY "actualizar perfiles con permisos"
  ON perfiles FOR UPDATE
  TO authenticated
  USING (
    get_rol() = 'super_admin'
    OR (get_rol() = 'admin' AND junta_id = get_junta_id())
    OR id = auth.uid()
  )
  WITH CHECK (
    get_rol() = 'super_admin'
    OR (get_rol() = 'admin' AND junta_id = get_junta_id())
    OR id = auth.uid()
  );

-- =============================================================
-- POLÍTICAS RLS — SECTORES
-- =============================================================

CREATE POLICY "ver sectores de la junta"
  ON sectores FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "admin puede insertar sectores"
  ON sectores FOR INSERT
  TO authenticated
  WITH CHECK (
    junta_id = get_junta_id()
    AND get_rol() IN ('admin', 'super_admin')
  );

CREATE POLICY "admin puede actualizar sectores"
  ON sectores FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('admin', 'super_admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('admin', 'super_admin'));

CREATE POLICY "admin puede eliminar sectores"
  ON sectores FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('admin', 'super_admin'));

-- =============================================================
-- POLÍTICAS RLS — MIEMBROS
-- =============================================================

-- Admin, secretario y tesorero ven todos los miembros de su junta (RF-07, RF-32.1)
CREATE POLICY "ver miembros de la junta"
  ON miembros FOR SELECT
  TO authenticated
  USING (
    junta_id = get_junta_id()
    AND get_rol() IN ('admin', 'secretario', 'tesorero', 'super_admin', 'miembro')
  );

-- Admin y secretario pueden crear miembros en su junta (RF-07)
CREATE POLICY "admin y secretario pueden insertar miembros"
  ON miembros FOR INSERT
  TO authenticated
  WITH CHECK (
    junta_id = get_junta_id()
    AND get_rol() IN ('admin', 'secretario')
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

-- Solo el admin puede eliminar miembros
CREATE POLICY "admin puede eliminar miembros"
  ON miembros FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() = 'admin');

-- =============================================================
-- POLÍTICAS RLS — ASAMBLEAS
-- =============================================================

CREATE POLICY "ver asambleas de la junta"
  ON asambleas FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "secretario puede insertar asambleas"
  ON asambleas FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede actualizar asambleas"
  ON asambleas FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede eliminar asambleas"
  ON asambleas FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

-- =============================================================
-- POLÍTICAS RLS — ASISTENCIA_ASAMBLEAS
-- =============================================================

CREATE POLICY "ver asistencia_asambleas de la junta"
  ON asistencia_asambleas FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "secretario puede insertar asistencia_asambleas"
  ON asistencia_asambleas FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede actualizar asistencia_asambleas"
  ON asistencia_asambleas FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede eliminar asistencia_asambleas"
  ON asistencia_asambleas FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

-- =============================================================
-- POLÍTICAS RLS — MINGAS
-- =============================================================

CREATE POLICY "ver mingas de la junta"
  ON mingas FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "secretario puede insertar mingas"
  ON mingas FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede actualizar mingas"
  ON mingas FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede eliminar mingas"
  ON mingas FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

-- =============================================================
-- POLÍTICAS RLS — ASISTENCIA_MINGAS
-- =============================================================

CREATE POLICY "ver asistencia_mingas de la junta"
  ON asistencia_mingas FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "secretario puede insertar asistencia_mingas"
  ON asistencia_mingas FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede actualizar asistencia_mingas"
  ON asistencia_mingas FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede eliminar asistencia_mingas"
  ON asistencia_mingas FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

-- =============================================================
-- POLÍTICAS RLS — PREDIOS
-- =============================================================

CREATE POLICY "ver predios de la junta"
  ON predios FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "secretario puede insertar predios"
  ON predios FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede actualizar predios"
  ON predios FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede eliminar predios"
  ON predios FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

-- =============================================================
-- POLÍTICAS RLS — IMAGENES_PREDIOS
-- =============================================================

CREATE POLICY "ver imagenes_predios de la junta"
  ON imagenes_predios FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "secretario puede insertar imagenes_predios"
  ON imagenes_predios FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede eliminar imagenes_predios"
  ON imagenes_predios FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

-- =============================================================
-- POLÍTICAS RLS — HORARIOS
-- =============================================================

CREATE POLICY "ver horarios de la junta"
  ON horarios FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "secretario puede insertar horarios"
  ON horarios FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede actualizar horarios"
  ON horarios FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede eliminar horarios"
  ON horarios FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

-- =============================================================
-- POLÍTICAS RLS — TABLA_SANCIONES
-- =============================================================

CREATE POLICY "ver tabla_sanciones de la junta"
  ON tabla_sanciones FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "admin puede insertar tabla_sanciones"
  ON tabla_sanciones FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() = 'admin');

CREATE POLICY "admin puede actualizar tabla_sanciones"
  ON tabla_sanciones FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() = 'admin')
  WITH CHECK (junta_id = get_junta_id() AND get_rol() = 'admin');

CREATE POLICY "admin puede eliminar tabla_sanciones"
  ON tabla_sanciones FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() = 'admin');

-- =============================================================
-- POLÍTICAS RLS — INGRESOS
-- =============================================================

-- Admin, tesorero y secretario ven todos los ingresos; miembro ve los propios
CREATE POLICY "ver ingresos de la junta"
  ON ingresos FOR SELECT
  TO authenticated
  USING (
    (junta_id = get_junta_id() AND get_rol() IN ('admin', 'tesorero', 'secretario', 'super_admin'))
    OR (
      junta_id = get_junta_id()
      AND get_rol() = 'miembro'
      AND miembro_id IN (
        SELECT m.id FROM miembros m
        JOIN perfiles p ON p.junta_id = m.junta_id
        WHERE p.id = auth.uid() AND m.junta_id = get_junta_id()
      )
    )
  );

-- Solo el tesorero puede registrar ingresos en su junta (RF-13)
CREATE POLICY "tesorero puede insertar ingresos"
  ON ingresos FOR INSERT
  TO authenticated
  WITH CHECK (
    junta_id = get_junta_id()
    AND get_rol() = 'tesorero'
  );

-- Tesorero y admin pueden actualizar ingresos
CREATE POLICY "tesorero puede actualizar ingresos"
  ON ingresos FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'admin'));

-- Solo el admin puede eliminar ingresos
CREATE POLICY "admin puede eliminar ingresos"
  ON ingresos FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() = 'admin');

-- =============================================================
-- POLÍTICAS RLS — MULTAS
-- =============================================================

CREATE POLICY "ver multas de la junta"
  ON multas FOR SELECT
  TO authenticated
  USING (
    (junta_id = get_junta_id() AND get_rol() IN ('admin', 'tesorero', 'secretario', 'super_admin'))
    OR (junta_id = get_junta_id() AND get_rol() = 'miembro'
        AND miembro_id IN (
          SELECT m.id FROM miembros m
          JOIN perfiles p ON p.junta_id = m.junta_id
          WHERE p.id = auth.uid() AND m.junta_id = get_junta_id()
        ))
  );

CREATE POLICY "tesorero puede insertar multas"
  ON multas FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'secretario', 'admin'));

CREATE POLICY "tesorero puede actualizar multas"
  ON multas FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'admin'));

CREATE POLICY "admin puede eliminar multas"
  ON multas FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() = 'admin');

-- =============================================================
-- POLÍTICAS RLS — EGRESOS
-- =============================================================

CREATE POLICY "ver egresos de la junta"
  ON egresos FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('admin', 'tesorero', 'secretario', 'super_admin'));

CREATE POLICY "tesorero puede insertar egresos"
  ON egresos FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() = 'tesorero');

CREATE POLICY "tesorero puede actualizar egresos"
  ON egresos FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'admin'));

CREATE POLICY "admin puede eliminar egresos"
  ON egresos FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() = 'admin');

-- =============================================================
-- POLÍTICAS RLS — INVENTARIO_ARTICULOS
-- =============================================================

CREATE POLICY "ver inventario_articulos de la junta"
  ON inventario_articulos FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "tesorero puede insertar inventario_articulos"
  ON inventario_articulos FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'admin'));

CREATE POLICY "tesorero puede actualizar inventario_articulos"
  ON inventario_articulos FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'admin'));

CREATE POLICY "admin puede eliminar inventario_articulos"
  ON inventario_articulos FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() = 'admin');

-- =============================================================
-- POLÍTICAS RLS — INVENTARIO_MOVIMIENTOS
-- =============================================================

CREATE POLICY "ver inventario_movimientos de la junta"
  ON inventario_movimientos FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "tesorero puede insertar inventario_movimientos"
  ON inventario_movimientos FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'admin'));

CREATE POLICY "tesorero puede actualizar inventario_movimientos"
  ON inventario_movimientos FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'admin'));

CREATE POLICY "admin puede eliminar inventario_movimientos"
  ON inventario_movimientos FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() = 'admin');

-- =============================================================
-- POLÍTICAS RLS — ACTIVOS_FIJOS
-- =============================================================

CREATE POLICY "ver activos_fijos de la junta"
  ON activos_fijos FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "tesorero puede insertar activos_fijos"
  ON activos_fijos FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'admin'));

CREATE POLICY "tesorero puede actualizar activos_fijos"
  ON activos_fijos FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('tesorero', 'admin'));

CREATE POLICY "admin puede eliminar activos_fijos"
  ON activos_fijos FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() = 'admin');

-- =============================================================
-- POLÍTICAS RLS — CONVOCATORIAS
-- =============================================================

CREATE POLICY "ver convocatorias de la junta"
  ON convocatorias FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "secretario puede insertar convocatorias"
  ON convocatorias FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede actualizar convocatorias"
  ON convocatorias FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede eliminar convocatorias"
  ON convocatorias FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

-- =============================================================
-- POLÍTICAS RLS — ACTAS
-- =============================================================

CREATE POLICY "ver actas de la junta"
  ON actas FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "secretario puede insertar actas"
  ON actas FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede actualizar actas"
  ON actas FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede eliminar actas"
  ON actas FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

-- =============================================================
-- POLÍTICAS RLS — RESOLUCIONES
-- =============================================================

CREATE POLICY "ver resoluciones de la junta"
  ON resoluciones FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "secretario puede insertar resoluciones"
  ON resoluciones FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede actualizar resoluciones"
  ON resoluciones FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede eliminar resoluciones"
  ON resoluciones FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

-- =============================================================
-- POLÍTICAS RLS — COMUNICACIONES_EXTERNAS
-- =============================================================

CREATE POLICY "ver comunicaciones_externas de la junta"
  ON comunicaciones_externas FOR SELECT
  TO authenticated
  USING (junta_id = get_junta_id());

CREATE POLICY "secretario puede insertar comunicaciones_externas"
  ON comunicaciones_externas FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede actualizar comunicaciones_externas"
  ON comunicaciones_externas FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'))
  WITH CHECK (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

CREATE POLICY "secretario puede eliminar comunicaciones_externas"
  ON comunicaciones_externas FOR DELETE
  TO authenticated
  USING (junta_id = get_junta_id() AND get_rol() IN ('secretario', 'admin'));

-- =============================================================
-- POLÍTICAS RLS — MENSAJES (RF-33)
-- =============================================================

-- Un usuario solo puede ver mensajes donde es remitente o destinatario
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

-- =============================================================
-- POLÍTICAS RLS — NOTIFICACIONES
-- =============================================================

CREATE POLICY "ver notificaciones propias"
  ON notificaciones FOR SELECT
  TO authenticated
  USING (
    junta_id = get_junta_id()
    AND usuario_id = auth.uid()
  );

CREATE POLICY "insertar notificaciones en la junta"
  ON notificaciones FOR INSERT
  TO authenticated
  WITH CHECK (junta_id = get_junta_id());

CREATE POLICY "marcar notificacion leida"
  ON notificaciones FOR UPDATE
  TO authenticated
  USING (junta_id = get_junta_id() AND usuario_id = auth.uid())
  WITH CHECK (junta_id = get_junta_id() AND usuario_id = auth.uid());

-- =============================================================
-- POLÍTICAS RLS — AUDITORÍA
-- =============================================================

-- Super_admin ve toda la auditoría; admin ve la de su junta
CREATE POLICY "ver auditoria permitida"
  ON auditoria FOR SELECT
  TO authenticated
  USING (
    get_rol() = 'super_admin'
    OR (get_rol() = 'admin' AND junta_id = get_junta_id())
  );

-- Solo la función fn_auditoria() (SECURITY DEFINER) inserta en auditoria
-- No se permite INSERT directo desde usuarios autenticados normales
CREATE POLICY "solo sistema puede insertar auditoria"
  ON auditoria FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- =============================================================
-- BUCKETS DE SUPABASE STORAGE
-- =============================================================

-- Insertar buckets de forma idempotente
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('predios-imagenes',       'predios-imagenes',       false, 5242880,   ARRAY['image/jpeg','image/png','image/webp']),
  ('comprobantes',           'comprobantes',           false, 10485760,  ARRAY['image/jpeg','image/png','application/pdf']),
  ('documentos-actas',       'documentos-actas',       false, 10485760,  ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('documentos-convocatorias','documentos-convocatorias',false,10485760, ARRAY['application/pdf']),
  ('comunicaciones-externas','comunicaciones-externas',false, 10485760,  ARRAY['application/pdf']),
  ('logos-juntas',           'logos-juntas',           true,  2097152,   ARRAY['image/jpeg','image/png','image/webp','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- POLÍTICAS RLS — STORAGE: predios-imagenes (privado)
-- =============================================================

CREATE POLICY "predios-imagenes: ver archivos de la junta"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'predios-imagenes'
    AND (storage.foldername(name))[1] = get_junta_id()::text
  );

CREATE POLICY "predios-imagenes: subir archivos de la junta"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'predios-imagenes'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('secretario', 'admin')
  );

CREATE POLICY "predios-imagenes: actualizar archivos de la junta"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'predios-imagenes'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('secretario', 'admin')
  );

CREATE POLICY "predios-imagenes: eliminar archivos de la junta"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'predios-imagenes'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('secretario', 'admin')
  );

-- =============================================================
-- POLÍTICAS RLS — STORAGE: comprobantes (privado)
-- =============================================================

CREATE POLICY "comprobantes: ver archivos de la junta"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'comprobantes'
    AND (storage.foldername(name))[1] = get_junta_id()::text
  );

CREATE POLICY "comprobantes: subir archivos de la junta"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'comprobantes'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('tesorero', 'admin')
  );

CREATE POLICY "comprobantes: actualizar archivos de la junta"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'comprobantes'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('tesorero', 'admin')
  );

CREATE POLICY "comprobantes: eliminar archivos de la junta"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'comprobantes'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('tesorero', 'admin')
  );

-- =============================================================
-- POLÍTICAS RLS — STORAGE: documentos-actas (privado)
-- =============================================================

CREATE POLICY "documentos-actas: ver archivos de la junta"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documentos-actas'
    AND (storage.foldername(name))[1] = get_junta_id()::text
  );

CREATE POLICY "documentos-actas: subir archivos de la junta"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-actas'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('secretario', 'admin')
  );

CREATE POLICY "documentos-actas: actualizar archivos de la junta"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documentos-actas'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('secretario', 'admin')
  );

CREATE POLICY "documentos-actas: eliminar archivos de la junta"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documentos-actas'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('secretario', 'admin')
  );

-- =============================================================
-- POLÍTICAS RLS — STORAGE: documentos-convocatorias (privado)
-- =============================================================

CREATE POLICY "documentos-convocatorias: ver archivos de la junta"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documentos-convocatorias'
    AND (storage.foldername(name))[1] = get_junta_id()::text
  );

CREATE POLICY "documentos-convocatorias: subir archivos de la junta"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-convocatorias'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('secretario', 'admin')
  );

CREATE POLICY "documentos-convocatorias: actualizar archivos de la junta"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documentos-convocatorias'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('secretario', 'admin')
  );

CREATE POLICY "documentos-convocatorias: eliminar archivos de la junta"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documentos-convocatorias'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('secretario', 'admin')
  );

-- =============================================================
-- POLÍTICAS RLS — STORAGE: comunicaciones-externas (privado)
-- =============================================================

CREATE POLICY "comunicaciones-externas: ver archivos de la junta"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'comunicaciones-externas'
    AND (storage.foldername(name))[1] = get_junta_id()::text
  );

CREATE POLICY "comunicaciones-externas: subir archivos de la junta"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'comunicaciones-externas'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('secretario', 'admin')
  );

CREATE POLICY "comunicaciones-externas: actualizar archivos de la junta"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'comunicaciones-externas'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('secretario', 'admin')
  );

CREATE POLICY "comunicaciones-externas: eliminar archivos de la junta"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'comunicaciones-externas'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('secretario', 'admin')
  );

-- =============================================================
-- POLÍTICAS RLS — STORAGE: logos-juntas (público de lectura)
-- =============================================================

-- Lectura pública sin autenticación
CREATE POLICY "logos-juntas: lectura publica"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'logos-juntas');

-- Solo admin y super_admin pueden subir o actualizar logos
CREATE POLICY "logos-juntas: subir logo de la junta"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos-juntas'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('admin', 'super_admin')
  );

CREATE POLICY "logos-juntas: actualizar logo de la junta"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logos-juntas'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('admin', 'super_admin')
  );

CREATE POLICY "logos-juntas: eliminar logo de la junta"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logos-juntas'
    AND (storage.foldername(name))[1] = get_junta_id()::text
    AND get_rol() IN ('admin', 'super_admin')
  );
