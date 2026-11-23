# Implementation Plan: Sistema Multi-Junta de Gestión Integral

## Overview

Plan de implementación incremental para la plataforma web multi-tenant de gestión de juntas (riego, agua potable, parroquiales y barriales) del Ecuador. Las tareas se organizan en dos fases: **Fase 1** cubre el mínimo funcional y demostrable (requerida), y **Fase 2** añade las funcionalidades adicionales (opcional).

Cada tarea produce código funcional e integrado; no existe código huérfano. La base de datos y las políticas RLS se definen en una sola migración SQL (tarea 2) que sustenta todas las páginas posteriores.

## Tasks

### Fase 1 — Mínimo funcional y demostrable (REQUERIDA, se implementa primero)

- [x] 1. Scaffolding del proyecto y configuración base
  - Inicializar proyecto con `npm create vite@latest` (React + TypeScript).
  - Instalar y configurar Tailwind CSS v3.
  - Configurar `vite.config.ts` con `server: { host: '127.0.0.1', port: 8081, strictPort: true }`.
  - Crear `.env.local` con las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (valores de ejemplo; nunca credenciales reales en el repositorio).
  - Crear `src/lib/supabase.ts` que inicialice el cliente `supabase-js` leyendo las variables de entorno.
  - Crear `src/types/index.ts` con los tipos TypeScript: `Rol`, `EstadoAsistencia`, `EstadoMulta`, `EstadoActivo`, `EstadoCumplimiento`, `TipoMovimiento`, `TipoConvocatoria`, `TipoOrigenMulta`.
  - _Requisitos: RNF-02, RNF-05_

- [x] 2. Migración SQL única — esquema completo
  - Crear `supabase/migrations/001_schema.sql` con:
    - Las 26 tablas del modelo de datos definidas en design.md, con la columna `junta_id` en cada tabla de negocio.
    - Todos los índices especificados en el diseño.
    - Las 5 funciones SQL auxiliares: `get_junta_id()`, `get_rol()`, `tiene_rol()`, `calcular_depreciacion()`, `hay_solapamiento_horario()`.
    - Las políticas RLS para todas las tablas según la matriz de permisos del diseño (incluyendo las políticas de ejemplo para `juntas`, `perfiles`, `miembros`, `ingresos` y `mensajes`).
    - La función genérica `fn_auditoria()` y los triggers instalados en: `miembros`, `ingresos`, `egresos`, `multas`, `activos_fijos`, `actas`, `resoluciones`.
    - La creación de los 6 buckets de Storage (`predios-imagenes`, `comprobantes`, `documentos-actas`, `documentos-convocatorias`, `comunicaciones-externas`, `logos-juntas`) con sus políticas de acceso (privado con RLS para los 5 primeros; público de lectura para `logos-juntas`).
  - _Requisitos: RNF-01, RNF-02_

- [x] 3. Script de datos semilla
  - Crear `scripts/seed.mjs` que use la clave `service_role` leída desde variables de entorno (nunca hardcodeada) para:
    - Crear una junta de ejemplo llamada "Junta de Riego San Pablo".
    - Crear un usuario de prueba por cada rol: `super_admin`, `admin`, `secretario`, `tesorero`, `miembro`.
    - Insertar sus registros en la tabla `perfiles` con el `junta_id` y `rol` correspondientes.
  - El script debe ser idempotente: no falla si la junta o los usuarios ya existen.
  - _Requisitos: RNF-02_

- [x] 4. Autenticación y rutas protegidas
  - Crear `src/hooks/useAuth.ts` con el estado `{ usuario, perfil, juntaId, rol, cargando }` leyendo el perfil desde la tabla `perfiles` tras el login.
  - Crear `src/hooks/usePerfil.ts` y `src/hooks/useJunta.ts` con sus respectivos estados.
  - Crear `src/lib/auth.ts` con helpers para obtener la sesión activa y cerrar sesión.
  - Crear `src/components/layout/ProtectedRoute.tsx` que redirija a `/login` si el usuario no está autenticado, o a `/acceso-denegado` si su rol no está en la lista `rolesPermitidos`.
  - Crear `src/pages/auth/Login.tsx` con formulario de correo + contraseña que use `supabase.auth.signInWithPassword()`.
  - Crear `src/pages/auth/RecuperarClave.tsx` para solicitar restablecimiento de contraseña.
  - Configurar React Router en `src/App.tsx` con todas las rutas del diseño y la redirección al panel correcto según rol al iniciar sesión.
  - _Requisitos: RNF-02_

- [x] 5. Layout base y componentes UI reutilizables
  - Crear `src/components/layout/Sidebar.tsx` con menú de navegación adaptado por rol (enlaces distintos para super_admin, admin, secretario, tesorero y miembro).
  - Crear `src/components/layout/Header.tsx` con logotipo de la junta (desde `logo_url`), nombre del usuario autenticado y botón de cierre de sesión.
  - Implementar colapso a menú hamburguesa cuando el ancho del dispositivo es < 768 px.
  - Crear los componentes UI reutilizables en `src/components/ui/`: `Tabla.tsx` (con paginación y filtros), `Modal.tsx`, `Formulario.tsx`, `Boton.tsx`, `Alerta.tsx`, `SubidaArchivo.tsx`.
  - _Requisitos: RNF-04_

- [x] 6. RF-01 — Registrar juntas (Super Administrador)
  - Crear `src/pages/super-admin/Juntas.tsx` con:
    - Formulario de nueva junta: nombre, tipo (riego/agua_potable/parroquial/barrial), provincia, cantón, parroquia, dirección, fecha_constitucion.
    - Validación de campos obligatorios antes de guardar (RF-01.3).
    - Verificación de unicidad del nombre consultando Supabase antes de insertar (RF-01.4).
    - Listado de todas las juntas registradas con fecha de creación y usuario creador.
  - _Requisitos: RF-01_

- [x] 7. RF-04 — Asignar Administrador de la Junta (Super Administrador)
  - Crear `src/pages/super-admin/AsignarAdmin.tsx` con:
    - Selector de usuario existente (desde `perfiles`) y selector de junta destino.
    - Verificación de que la junta destino no tenga ya un admin activo; si lo tiene, pedir confirmación antes de reasignar (RF-04.3).
    - Al asignar, actualizar el perfil en `perfiles` con el nuevo `rol` y `junta_id`.
    - Insertar un registro en `notificaciones` para el usuario asignado (RF-04.4).
  - _Requisitos: RF-04_

- [x] 8. RF-02 — Configurar datos generales y sectores (Administrador)
  - Crear `src/pages/admin/Configuracion.tsx` que permita al Administrador editar: nombre, logotipo (upload al bucket `logos-juntas`), descripción, contacto y datos legales de la junta.
  - Crear `src/pages/admin/Sectores.tsx` con CRUD completo de sectores (nombre, descripción).
  - Al intentar eliminar un sector con miembros asociados, consultar `miembros` y rechazar mostrando el número de miembros afectados (RF-02.4).
  - _Requisitos: RF-02_

- [x] 9. RF-05 — Administrar cuentas de miembros (Administrador)
  - Crear `src/pages/admin/Cuentas.tsx` con:
    - Formulario para crear cuenta: correo, nombre completo y rol (secretario, tesorero o miembro); usar `supabase.auth.admin.inviteUserByEmail()` para enviar la invitación (RF-05.2).
    - Formulario de edición de nombre, correo y rol de cuentas existentes.
    - Botón de desactivación que ponga `activo = false` en `perfiles` sin borrar el historial (RF-05.4).
    - Verificación de correo único dentro de la junta antes de crear (RF-05.5).
  - _Requisitos: RF-05_

- [x] 10. RF-07 — Nómina de miembros (Secretario)
  - Crear `src/pages/secretario/Miembros.tsx` con:
    - CRUD de miembros: cédula, nombres, apellidos, dirección, teléfono, correo, sector_id, fecha_ingreso.
    - Validación del algoritmo de módulo 10 para la cédula ecuatoriana antes de guardar.
    - Verificación de unicidad de cédula dentro de la junta (RF-07.3).
    - Opción de marcar miembro como inactivo conservando historial (RF-07.4).
    - Filtros por estado (activo/inactivo), sector y nombre.
  - _Requisitos: RF-07_

- [x] 11. RF-08 — Asistencia a asambleas (Secretario)
  - Crear `src/pages/secretario/Asambleas.tsx` con:
    - Formulario de nueva asamblea: fecha, hora, lugar, orden del día.
    - Al crear asamblea, insertar automáticamente en `asistencia_asambleas` un registro por cada miembro activo de la junta (RF-08.2).
    - Interfaz de marcado de asistencia: presente / ausente_justificado / ausente.
    - Al cerrar asamblea: calcular `porcentaje_participacion = ROUND(presentes / total * 100, 2)` y actualizar `susceptible_multa = true` para todos los registros con estado `ausente` (RF-08.4, RF-08.5).
    - Vista de historial de asistencia por miembro.
  - _Requisitos: RF-08_

- [x] 12. RF-10/RF-11 — Predios y recursos de miembros (Secretario)
  - Crear `src/pages/secretario/Predios.tsx` con:
    - CRUD de predios: código catastral, superficie, sector_id, tipo de uso, latitud, longitud.
    - Al intentar eliminar un predio con historial financiero (registros en `ingresos` vinculados), rechazar y mostrar aviso de dependencia (RF-10.3).
  - Crear `src/components/ui/MapaPredio.tsx` usando Leaflet (o similar sin clave API) para seleccionar coordenadas en un mapa interactivo; mostrar pin en latitud/longitud guardados (RF-11.1, RF-11.6).
  - Integrar `SubidaArchivo.tsx` para subir imágenes al bucket `predios-imagenes`: validar tipo (JPG/PNG/WEBP) y tamaño (máx. 5 MB) antes de llamar a `supabase.storage.upload()` (RF-11.4, RF-11.5).
  - _Requisitos: RF-10, RF-11_

- [ ] 13. RF-13 — Registrar ingresos (Tesorero)
  - Crear `src/pages/tesorero/Ingresos.tsx` con:
    - Formulario: miembro_id, concepto, monto, fecha, metodo_pago.
    - Generación automática de `numero_recibo` único por junta verificando unicidad en `ingresos` antes de insertar (RF-13.2).
    - Integrar `SubidaArchivo.tsx` para subida de comprobante (JPG/PNG/PDF, máx. 10 MB) al bucket `comprobantes`.
    - Filtros por miembro, concepto, rango de fechas y método de pago.
  - _Requisitos: RF-13_

- [ ] 14. RF-15 — Multas por inasistencia (Tesorero)
  - Crear `src/pages/tesorero/Multas.tsx` con:
    - Generación automática de un registro en `multas` (estado `pendiente`) por cada `asistencia_asambleas` o `asistencia_mingas` con `susceptible_multa = true` al cerrar el evento (RF-15.1); el monto se lee de `tabla_sanciones` según `tipo_evento` (RF-15.2).
    - Vista de revisión para que el Tesorero confirme o anule cada multa pendiente (RF-15.3).
    - Al registrar el pago de una multa, crear el ingreso correspondiente y vincular `multas.ingreso_id`, cambiando el estado a `pagada` (RF-15.5).
    - Resumen de multas pendientes y pagadas filtrable por miembro y período.
  - _Requisitos: RF-15_

- [ ] 15. RF-16 — Registrar egresos (Tesorero)
  - Crear `src/pages/tesorero/Egresos.tsx` con:
    - Formulario: categoría, proveedor, descripción, monto, fecha, metodo_pago.
    - Integrar `SubidaArchivo.tsx` para subida de comprobante (JPG/PNG/PDF, máx. 10 MB) al bucket `comprobantes`.
    - Filtros por categoría, proveedor, rango de fechas y monto.
  - _Requisitos: RF-16_

- [ ] 16. RF-32 — Consulta individual del Miembro
  - Crear `src/pages/miembro/MiInformacion.tsx` con datos personales del miembro autenticado.
  - Crear `src/pages/miembro/MisPagos.tsx` con historial de pagos (fecha, concepto, monto).
  - Crear `src/pages/miembro/MisMultas.tsx` con multas pendientes y pagadas del miembro.
  - Crear `src/pages/miembro/MisPredios.tsx` con predios a su nombre y mapa de ubicación cuando hay coordenadas.
  - Crear `src/pages/miembro/Convocatorias.tsx` con convocatorias vigentes e historial de eventos.
  - Las políticas RLS garantizan que cada consulta retorne únicamente los registros del miembro autenticado.
  - _Requisitos: RF-32_

- [ ] 17. Verificación de aislamiento entre juntas
  - Crear `scripts/verify-isolation.mjs` que, usando credenciales de dos usuarios de juntas distintas obtenidas de variables de entorno, consulte directamente la API REST de Supabase con el JWT de cada usuario e intente leer registros de la junta opuesta en las tablas `miembros`, `ingresos` y `predios`.
  - El script verifica que cada consulta retorne 0 filas o un error 403, e imprime `PASS` o `FAIL` por cada verificación.
  - _Requisitos: RNF-01_

---

### Fase 2 — Funcionalidades adicionales (OPCIONAL)

- [ ] 18. RF-09 — Asistencia a mingas (Secretario)
  - Crear `src/pages/secretario/Mingas.tsx` siguiendo el mismo flujo que la tarea 11 (Asambleas) pero para mingas: campos adicionales `actividad` y `min_participantes`.
  - Generar lista de asistencia automática, marcar ausencias y calcular porcentaje de participación al cerrar.
  - _Requisitos: RF-09_

- [ ] 19. RF-12 — Calendario semanal y horarios (Secretario)
  - Crear `src/pages/secretario/Horarios.tsx` con:
    - Vista cuadrícula semanal (7 columnas × franjas horarias) con bloques asignados por servicio.
    - Formulario para crear bloque: miembro_id, servicio, dia_semana (1–7), hora_inicio, hora_fin.
    - Antes de guardar, llamar a `hay_solapamiento_horario()` y rechazar si hay conflicto mostrando el bloque en colisión (RF-12.2).
    - Edición y eliminación de bloques existentes.
  - _Requisitos: RF-12_

- [ ] 20. RF-20 — Gestionar comprobantes de pago (Tesorero)
  - Crear `src/pages/tesorero/Comprobantes.tsx` con:
    - Listado de comprobantes vinculados a ingresos y egresos.
    - Integrar `SubidaArchivo.tsx` para subida de comprobante (JPG/PNG/PDF, máx. 10 MB) con validación de tipo y tamaño antes del upload.
    - Visualización en modal (imagen o enlace a PDF).
    - Eliminación del archivo en Supabase Storage y desvinculación del registro financiero (RF-20.5).
  - _Requisitos: RF-20_

- [ ] 21. RF-21 — Gestionar inventario (Tesorero)
  - Crear `src/pages/tesorero/Inventario.tsx` con:
    - CRUD de artículos: código, nombre, unidad de medida, stock_minimo, categoría.
    - Formulario de movimiento (entrada/salida): artículo, cantidad, fecha, motivo.
    - Al registrar salida, recalcular `stock_actual` del artículo y mostrar alerta visual si queda por debajo de `stock_minimo` (RF-21.3).
    - Listado de artículos con stock actual actualizado.
  - _Requisitos: RF-21_

- [ ] 22. RF-22 — Activos fijos (Tesorero)
  - Crear `src/pages/tesorero/ActivosFijos.tsx` con:
    - CRUD de activos fijos: código, nombre, descripción, valor_adquisicion, fecha_adquisicion, vida_util_anos, estado.
    - Mostrar depreciación acumulada calculada con `calcular_depreciacion()` en el detalle de cada activo (RF-22.3).
    - Acción de dar de baja: registrar fecha_baja, motivo y usuario conservando el historial (RF-22.4).
    - Filtros por estado y categoría.
  - _Requisitos: RF-22_

- [ ] 23. RF-24 — Reportes económicos (Tesorero)
  - Crear `src/pages/tesorero/Reportes.tsx` con:
    - Reporte de Balance General (activos, pasivos, patrimonio) para un período seleccionado.
    - Reporte de Ingresos y Egresos detallado por categoría y período.
    - Reporte de Cuentas por Cobrar con deudas pendientes por miembro.
    - Exportación de cualquier reporte a PDF usando una librería del lado cliente (p. ej. jsPDF).
    - El Administrador también puede visualizar todos los reportes de su junta (RF-24.6).
  - _Requisitos: RF-24_

- [ ] 24. RF-25 — Convocatorias (Secretario)
  - Crear `src/pages/secretario/Convocatorias.tsx` con:
    - Formulario de nueva convocatoria: tipo (asamblea/minga), título, fecha, hora, lugar, orden del día, plazo de confirmación.
    - Al publicar, insertar un registro en `notificaciones` por cada miembro activo de la junta (RF-25.2).
    - Integrar `SubidaArchivo.tsx` para adjuntar documento PDF al bucket `documentos-convocatorias`.
    - Marcar convocatoria como `finalizada` cuando su fecha sea anterior a la fecha actual (RF-25.5).
  - _Requisitos: RF-25_

- [ ] 25. RF-26 — Actas y resoluciones (Secretario)
  - Crear `src/pages/secretario/Actas.tsx` con:
    - Integrar `SubidaArchivo.tsx` para subir actas (PDF/DOCX) al bucket `documentos-actas`, asociadas a una asamblea, con título, fecha y descripción.
    - Al publicar un acta (`publicada = true`), hacerla visible a todos los usuarios activos de la junta (RF-26.2).
    - Gestión de resoluciones vinculadas al acta: número, descripción, estado de cumplimiento (pendiente/en_proceso/cumplida).
    - Archivo de actas filtrable por fecha y asamblea.
  - _Requisitos: RF-26_

- [ ] 26. RF-29 — Comunicaciones externas (Secretario)
  - Crear `src/pages/secretario/Comunicaciones.tsx` con:
    - CRUD de comunicaciones externas: institución remitente, asunto, fecha de recepción, número de oficio, resumen.
    - Integrar `SubidaArchivo.tsx` para adjuntar documento PDF al bucket `comunicaciones-externas`.
    - Campo de respuesta asociada a la comunicación recibida (RF-29.3).
    - Archivo filtrable por institución, asunto y rango de fechas.
  - _Requisitos: RF-29_

- [ ] 27. RF-33 — Mensajería interna (Administrador / Miembro)
  - Crear `src/pages/compartido/Mensajes.tsx` con:
    - Bandeja de entrada (mensajes recibidos) y salida (mensajes enviados).
    - Formulario de redacción con selector de destinatario (usuario de la misma junta), asunto y cuerpo.
    - El Administrador puede enviar mensajes individuales o grupales a varios miembros.
    - Notificación visual (badge en el Header) cuando hay mensajes no leídos (RF-33.4).
    - Marcar mensajes como leídos automáticamente al visualizarlos en la bandeja (RF-33.5).
  - _Requisitos: RF-33_

- [ ] 28. RNF-03 — Exportación manual de datos (Administrador)
  - Agregar en `src/pages/admin/Configuracion.tsx` un botón "Exportar datos de la junta".
  - Al hacer clic, consultar las tablas de negocio de la junta y generar archivos CSV descargables desde el navegador (RNF-03.2, RNF-03.3).
  - _Requisitos: RNF-03_

## Notes

- Las tareas de Fase 1 son **requeridas** y deben implementarse en el orden indicado; las de Fase 2 son **opcionales** y pueden ejecutarse en cualquier orden después de completar la Fase 1.
- La tarea 2 (migración SQL) es el prerequisito de todas las tareas de páginas y scripts que acceden a Supabase.
- Las tareas 1, 2 y 3 no dependen entre sí y pueden ejecutarse en paralelo.
- La clave `service_role` se usa únicamente en `scripts/seed.mjs` y `scripts/verify-isolation.mjs`, nunca en el frontend.
- El componente `SubidaArchivo.tsx` creado en la tarea 5 se reutiliza en las tareas 12, 13, 15, 20, 24, 25 y 26 para validaciones de tipo y tamaño de archivos antes del upload.
- No se incluyen tareas de pruebas unitarias ni de integración, salvo la tarea 17 (verificación de aislamiento entre juntas).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "3"] },
    { "id": 1, "tasks": ["4"] },
    { "id": 2, "tasks": ["5"] },
    { "id": 3, "tasks": ["6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"] },
    { "id": 4, "tasks": ["17"] },
    { "id": 5, "tasks": ["18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28"] }
  ]
}
```
