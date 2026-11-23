# Requirements Document

## Introduction

El **Sistema Multi-Junta de Gestión Integral** es una plataforma web multi-tenant para juntas de riego, juntas de agua potable, juntas parroquiales rurales y comités barriales del Ecuador. Varias juntas operan sobre la misma aplicación con datos completamente aislados entre sí. La interfaz y toda la documentación están en español.

La plataforma cubre cuatro módulos principales:

- **Plataforma**: registro y configuración de juntas, gestión de roles y cuentas de usuario.
- **Administrativo**: nómina de miembros, asistencia a asambleas y mingas, predios, horarios y calendario.
- **Financiero**: ingresos, multas, egresos, comprobantes, inventario, activos fijos y reportes económicos.
- **Comunicaciones**: convocatorias, actas y resoluciones, mensajería interna y correspondencia institucional.

---

## Glossary

- **Sistema**: la aplicación web Multi-Junta de Gestión Integral.
- **Junta**: organización registrada en la plataforma (junta de riego, agua potable, parroquial rural o comité barrial).
- **Super_Administrador**: usuario con acceso completo a todas las juntas de la plataforma.
- **Administrador**: usuario con acceso completo dentro de una sola junta.
- **Secretario**: usuario responsable de la gestión administrativa de una junta.
- **Tesorero**: usuario responsable de la gestión financiera de una junta.
- **Miembro**: usuario socio de una junta con acceso de solo consulta.
- **Perfil**: registro en la tabla `perfiles` que asocia un usuario de Supabase Auth con un rol y una junta.
- **junta_id**: identificador único de la junta que acompaña cada registro de negocio para garantizar el aislamiento multi-tenant.
- **RLS**: Row Level Security, política de seguridad a nivel de fila en PostgreSQL/Supabase.
- **Predio**: parcela o recurso hídrico registrado a nombre de un miembro.
- **Asamblea**: reunión formal de la junta.
- **Minga**: jornada de trabajo comunitario organizada por la junta.
- **Convocatoria**: notificación oficial que cita a los miembros a una asamblea o minga.
- **Acta**: documento oficial que resume los acuerdos de una asamblea.
- **Comprobante**: documento que respalda un ingreso o egreso económico.
- **Activo_Fijo**: bien duradero de propiedad de la junta (maquinaria, terrenos, vehículos, etc.).

---

## Requirements

---

### Requisito RF-01: Registrar juntas

**Historia de usuario:** Como Super_Administrador, quiero registrar nuevas juntas en la plataforma, para que cada organización tenga su propio espacio de datos aislado.

#### Criterios de aceptación

1. THE Sistema SHALL permitir al Super_Administrador crear una nueva Junta con nombre, tipo, provincia, cantón, parroquia, dirección y fecha de constitución.
2. WHEN el Super_Administrador registra una Junta, THE Sistema SHALL asignar un `junta_id` único e inmutable a ese registro.
3. WHEN el Super_Administrador omite algún campo obligatorio del formulario, THE Sistema SHALL mostrar un mensaje de error indicando qué campo falta antes de guardar.
4. IF un nombre de Junta ya existe en la plataforma, THEN THE Sistema SHALL rechazar el registro y mostrar un mensaje indicando que el nombre ya está en uso.
5. WHEN una Junta es registrada, THE Sistema SHALL guardar la fecha y el usuario que realizó el registro.

---

### Requisito RF-02: Configurar datos generales y sectores de la junta

**Historia de usuario:** Como Administrador, quiero configurar los datos generales y los sectores de mi junta, para mantener la información organizacional actualizada.

#### Criterios de aceptación

1. WHILE el usuario tiene el rol Administrador de una Junta, THE Sistema SHALL permitir editar nombre, logotipo, descripción, contacto y datos legales de esa Junta.
2. THE Administrador SHALL poder crear, editar y eliminar sectores geográficos o productivos asociados a su Junta.
3. WHEN el Administrador guarda cambios en la configuración, THE Sistema SHALL registrar la fecha y hora de la última modificación.
4. IF el Administrador intenta eliminar un sector que tiene Miembros asociados, THEN THE Sistema SHALL rechazar la eliminación y mostrar el número de Miembros afectados.
5. WHERE la Junta tiene logotipo configurado, THE Sistema SHALL mostrar el logotipo en el encabezado de la interfaz de esa Junta.

---

### Requisito RF-04: Asignar el rol de Administrador de la Junta

**Historia de usuario:** Como Super_Administrador, quiero asignar el rol de Administrador a un usuario dentro de una junta, para delegar la gestión operativa de esa organización.

#### Criterios de aceptación

1. THE Super_Administrador SHALL poder seleccionar un usuario existente y asignarle el rol Administrador dentro de una Junta específica.
2. WHEN el Super_Administrador asigna el rol, THE Sistema SHALL actualizar el Perfil del usuario en la tabla `perfiles` con el rol y el `junta_id` correspondientes.
3. IF el usuario ya tiene el rol Administrador en otra Junta, THEN THE Sistema SHALL solicitar confirmación antes de reasignarlo.
4. WHEN el rol es asignado, THE Sistema SHALL notificar al usuario afectado mediante un mensaje en la plataforma.
5. THE Sistema SHALL garantizar que cada Junta tenga como máximo un usuario con rol Administrador activo al mismo tiempo.

---

### Requisito RF-05: Administrar cuentas de miembros

**Historia de usuario:** Como Administrador, quiero crear, editar y desactivar cuentas de usuario de los miembros de mi junta, para controlar el acceso a la plataforma.

#### Criterios de aceptación

1. THE Administrador SHALL poder crear cuentas de usuario asignando correo electrónico, nombre completo y rol (Secretario, Tesorero o Miembro) dentro de su Junta.
2. WHEN el Administrador crea una cuenta, THE Sistema SHALL enviar una invitación de acceso al correo del usuario mediante Supabase Auth.
3. THE Administrador SHALL poder editar el nombre, correo y rol de cualquier cuenta dentro de su Junta.
4. WHEN el Administrador desactiva una cuenta, THE Sistema SHALL revocar el acceso del usuario sin eliminar su historial de registros.
5. IF el Administrador intenta crear una cuenta con un correo ya registrado en la misma Junta, THEN THE Sistema SHALL rechazar la operación y mostrar un mensaje de duplicado.
6. WHILE un usuario está desactivado, THE Sistema SHALL impedir el inicio de sesión de ese usuario.

---

### Requisito RF-07: Registrar y mantener la nómina de miembros

**Historia de usuario:** Como Secretario, quiero registrar y mantener la nómina de miembros de la junta, para contar con un padrón actualizado de socios.

#### Criterios de aceptación

1. THE Secretario SHALL poder registrar un nuevo Miembro con cédula, nombres, apellidos, dirección, teléfono, correo y fecha de ingreso.
2. THE Secretario SHALL poder editar los datos personales de cualquier Miembro de su Junta.
3. WHEN el Secretario registra un Miembro con una cédula ya existente en la misma Junta, THE Sistema SHALL rechazar el registro y mostrar un mensaje de duplicado.
4. THE Secretario SHALL poder marcar un Miembro como inactivo cuando este deje de pertenecer a la Junta, conservando su historial.
5. THE Sistema SHALL mostrar la nómina filtrable por estado (activo/inactivo), sector y nombre.
6. WHEN se registra o edita un Miembro, THE Sistema SHALL guardar la fecha, hora y usuario que realizó la acción.

---

### Requisito RF-08: Registrar asistencia a asambleas

**Historia de usuario:** Como Secretario, quiero registrar la asistencia de los miembros a las asambleas, para llevar un control oficial de participación.

#### Criterios de aceptación

1. THE Secretario SHALL poder crear un registro de Asamblea con fecha, hora, lugar y descripción del orden del día.
2. WHEN una Asamblea es creada, THE Sistema SHALL generar una lista de asistencia con todos los Miembros activos de la Junta.
3. THE Secretario SHALL poder marcar la asistencia de cada Miembro como presente, ausente con justificación o ausente sin justificación.
4. WHEN el Secretario cierra el registro de asistencia, THE Sistema SHALL calcular y almacenar el porcentaje de participación de la Asamblea.
5. IF un Miembro estuvo ausente sin justificación, THEN THE Sistema SHALL marcar ese registro como susceptible de multa para el Tesorero.
6. THE Sistema SHALL permitir consultar el historial de asistencia de un Miembro a todas las Asambleas.

---

### Requisito RF-09: Registrar asistencia a mingas

**Historia de usuario:** Como Secretario, quiero registrar la asistencia de los miembros a las mingas, para llevar un control de participación en trabajos comunitarios.

#### Criterios de aceptación

1. THE Secretario SHALL poder crear un registro de Minga con fecha, hora, lugar, actividad programada y número mínimo de participantes esperado.
2. WHEN una Minga es creada, THE Sistema SHALL generar una lista de asistencia con todos los Miembros activos de la Junta.
3. THE Secretario SHALL poder marcar la asistencia de cada Miembro como presente, ausente con justificación o ausente sin justificación.
4. WHEN el Secretario cierra el registro de asistencia de una Minga, THE Sistema SHALL calcular y almacenar el porcentaje de participación.
5. IF un Miembro estuvo ausente sin justificación en una Minga, THEN THE Sistema SHALL marcar ese registro como susceptible de multa para el Tesorero.

---

### Requisito RF-10: Registrar predios o recursos de cada miembro

**Historia de usuario:** Como Secretario, quiero registrar los predios o recursos asociados a cada miembro, para vincular los activos individuales con su titular.

#### Criterios de aceptación

1. THE Secretario SHALL poder registrar uno o más Predios a nombre de un Miembro, indicando código catastral, superficie, sector y tipo de uso.
2. THE Secretario SHALL poder editar los datos de un Predio existente.
3. WHEN el Secretario intenta eliminar un Predio que tiene historial financiero asociado, THE Sistema SHALL rechazar la eliminación y mostrar un aviso de dependencia.
4. THE Sistema SHALL mostrar la lista de Predios de un Miembro dentro del perfil del Miembro.
5. WHEN se registra o edita un Predio, THE Sistema SHALL guardar la fecha, hora y usuario que realizó la acción.

---

### Requisito RF-11: Registrar localización e imagen del predio con mapa

**Historia de usuario:** Como Secretario, quiero registrar la ubicación geográfica y una imagen del predio, para contar con evidencia visual y coordenadas exactas de cada propiedad.

#### Criterios de aceptación

1. WHEN el Secretario abre el formulario de un Predio, THE Sistema SHALL mostrar un mapa interactivo para marcar las coordenadas del Predio.
2. THE Secretario SHALL poder guardar las coordenadas geográficas (latitud y longitud) del Predio seleccionadas en el mapa.
3. THE Secretario SHALL poder subir una o más imágenes del Predio, almacenadas en Supabase Storage.
4. WHEN el Secretario sube una imagen, THE Sistema SHALL validar que el archivo sea de tipo JPG, PNG o WEBP y no supere 5 MB.
5. IF el archivo supera el tamaño permitido o no es del tipo aceptado, THEN THE Sistema SHALL rechazar la carga y mostrar un mensaje descriptivo del error.
6. WHERE un Predio tiene coordenadas registradas, THE Sistema SHALL mostrar su ubicación en el mapa dentro del detalle del Predio.

---

### Requisito RF-12: Gestionar calendario semanal y horarios de uso de servicios

**Historia de usuario:** Como Secretario, quiero gestionar el calendario semanal y los horarios de uso de los servicios de la junta, para organizar la distribución equitativa de los recursos.

#### Criterios de aceptación

1. THE Secretario SHALL poder crear bloques de horario semanal asignando un Miembro, un servicio, un día de la semana, hora de inicio y hora de fin.
2. WHEN el Secretario intenta guardar un bloque de horario que se superpone con otro del mismo servicio, THE Sistema SHALL rechazar el conflicto y mostrar el bloque en colisión.
3. THE Secretario SHALL poder editar o eliminar bloques de horario existentes.
4. THE Sistema SHALL mostrar el calendario semanal en vista de cuadrícula con los bloques asignados por día y franja horaria.
5. WHEN se modifica el calendario, THE Sistema SHALL registrar la fecha, hora y usuario que realizó el cambio.

---

### Requisito RF-13: Registrar ingresos por pagos de los miembros

**Historia de usuario:** Como Tesorero, quiero registrar los pagos realizados por los miembros, para mantener un control actualizado de los ingresos de la junta.

#### Criterios de aceptación

1. THE Tesorero SHALL poder registrar un ingreso indicando Miembro pagador, concepto, monto, fecha y método de pago.
2. WHEN el Tesorero registra un ingreso, THE Sistema SHALL generar un número de recibo único e irrepetible dentro de la Junta.
3. THE Sistema SHALL permitir asociar un Comprobante digital (imagen o PDF) al registro de ingreso, almacenado en Supabase Storage.
4. WHEN un ingreso es registrado, THE Sistema SHALL actualizar el saldo en cuenta de la Junta de forma inmediata.
5. THE Tesorero SHALL poder consultar el historial de ingresos filtrado por Miembro, concepto, rango de fechas y método de pago.
6. WHEN se registra un ingreso, THE Sistema SHALL guardar la fecha, hora y usuario Tesorero que lo registró.

---

### Requisito RF-15: Generar multas por inasistencia

**Historia de usuario:** Como Tesorero, quiero generar multas automáticas por inasistencias no justificadas, para incentivar la participación de los miembros.

#### Criterios de aceptación

1. WHEN el Secretario cierra el registro de asistencia de una Asamblea o Minga con ausencias no justificadas, THE Sistema SHALL crear automáticamente un registro de multa pendiente por cada Miembro ausente.
2. THE Sistema SHALL calcular el monto de cada multa según la tabla de sanciones configurada por el Administrador para su Junta.
3. THE Tesorero SHALL poder revisar, confirmar o anular cada multa pendiente antes de hacerla efectiva.
4. WHEN el Tesorero confirma una multa, THE Sistema SHALL registrarla como deuda pendiente del Miembro afectado.
5. WHEN el Miembro paga la multa, THE Sistema SHALL marcar la deuda como saldada y vincularla al registro de ingreso correspondiente.
6. THE Sistema SHALL mostrar el resumen de multas pendientes y pagadas por Miembro y por período.

---

### Requisito RF-16: Registrar egresos

**Historia de usuario:** Como Tesorero, quiero registrar los egresos de la junta, para controlar los gastos y mantener las cuentas al día.

#### Criterios de aceptación

1. THE Tesorero SHALL poder registrar un egreso indicando categoría, proveedor, descripción, monto, fecha y método de pago.
2. THE Sistema SHALL permitir asociar un Comprobante digital al registro de egreso, almacenado en Supabase Storage.
3. WHEN el Tesorero registra un egreso, THE Sistema SHALL actualizar el saldo en cuenta de la Junta de forma inmediata.
4. THE Tesorero SHALL poder consultar el historial de egresos filtrado por categoría, proveedor, rango de fechas y monto.
5. WHEN se registra un egreso, THE Sistema SHALL guardar la fecha, hora y usuario Tesorero que lo registró.

---

### Requisito RF-20: Gestionar comprobantes de pago

**Historia de usuario:** Como Tesorero, quiero gestionar los comprobantes digitales de pago, para contar con respaldo documental de cada transacción financiera.

#### Criterios de aceptación

1. THE Tesorero SHALL poder subir, visualizar y eliminar comprobantes digitales (JPG, PNG, PDF) asociados a ingresos o egresos.
2. WHEN el Tesorero sube un comprobante, THE Sistema SHALL validar que el archivo sea JPG, PNG o PDF y no supere 10 MB.
3. IF el archivo supera el tamaño o no cumple el tipo permitido, THEN THE Sistema SHALL rechazar la carga y mostrar un mensaje descriptivo.
4. THE Sistema SHALL almacenar los comprobantes en Supabase Storage bajo la ruta del `junta_id` correspondiente.
5. WHEN un comprobante es eliminado, THE Sistema SHALL eliminarlo de Supabase Storage y desvincularlo del registro financiero.

---

### Requisito RF-21: Gestionar inventario

**Historia de usuario:** Como Tesorero, quiero gestionar el inventario de materiales e insumos de la junta, para controlar las existencias disponibles.

#### Criterios de aceptación

1. THE Tesorero SHALL poder registrar artículos de inventario con código, nombre, unidad de medida, cantidad inicial y categoría.
2. THE Tesorero SHALL poder registrar entradas y salidas de inventario indicando cantidad, fecha y motivo.
3. WHEN una salida de inventario reduce el stock de un artículo por debajo del mínimo configurado, THE Sistema SHALL mostrar una alerta visual al Tesorero.
4. THE Sistema SHALL mostrar el inventario actual con las cantidades disponibles actualizadas.
5. WHEN se registra una movimiento de inventario, THE Sistema SHALL guardar la fecha, hora y usuario que lo realizó.

---

### Requisito RF-22: Gestionar activos fijos

**Historia de usuario:** Como Tesorero, quiero registrar y gestionar los activos fijos de la junta, para controlar el patrimonio de la organización.

#### Criterios de aceptación

1. THE Tesorero SHALL poder registrar un Activo_Fijo con código, nombre, descripción, valor de adquisición, fecha de adquisición, vida útil estimada y estado.
2. THE Tesorero SHALL poder editar los datos de un Activo_Fijo existente y actualizar su estado (bueno, regular, en mantenimiento, dado de baja).
3. THE Sistema SHALL calcular la depreciación acumulada de cada Activo_Fijo según el método lineal, usando valor de adquisición y vida útil.
4. WHEN un Activo_Fijo es dado de baja, THE Sistema SHALL registrar la fecha, motivo y usuario que realizó la baja, conservando el historial.
5. THE Sistema SHALL mostrar el listado de Activos_Fijos filtrable por estado y categoría.

---

### Requisito RF-24: Emitir reportes económicos

**Historia de usuario:** Como Tesorero, quiero emitir reportes económicos de la junta, para informar a los directivos y miembros sobre la situación financiera.

#### Criterios de aceptación

1. THE Sistema SHALL generar un reporte de Balance General con activos, pasivos y patrimonio de la Junta para un período seleccionado.
2. THE Sistema SHALL generar un reporte de Ingresos y Egresos detallado por categoría y período.
3. THE Sistema SHALL generar un reporte de Cuentas por Cobrar con el detalle de deudas pendientes por Miembro.
4. WHEN el Tesorero solicita un reporte, THE Sistema SHALL calcularlo con los datos registrados hasta la fecha y hora de la solicitud.
5. THE Sistema SHALL permitir exportar cualquier reporte en formato PDF.
6. WHERE el Administrador tiene acceso, THE Sistema SHALL permitirle visualizar todos los reportes económicos de su Junta.

---

### Requisito RF-25: Emitir convocatorias a asambleas y mingas

**Historia de usuario:** Como Secretario, quiero emitir convocatorias oficiales a asambleas y mingas, para notificar a los miembros con la información necesaria.

#### Criterios de aceptación

1. THE Secretario SHALL poder crear una Convocatoria indicando tipo (Asamblea o Minga), fecha, hora, lugar, orden del día y plazo de confirmación.
2. WHEN el Secretario publica una Convocatoria, THE Sistema SHALL notificar a todos los Miembros activos de la Junta mediante un mensaje interno en la plataforma.
3. THE Sistema SHALL permitir adjuntar documentos de apoyo (PDF) a la Convocatoria, almacenados en Supabase Storage.
4. THE Miembro SHALL poder consultar las Convocatorias vigentes desde su panel personal.
5. WHEN la fecha de la Convocatoria haya pasado, THE Sistema SHALL marcarla automáticamente como finalizada.

---

### Requisito RF-26: Archivar y publicar actas y resoluciones

**Historia de usuario:** Como Secretario, quiero archivar y publicar las actas y resoluciones de las asambleas, para contar con un repositorio oficial accesible.

#### Criterios de aceptación

1. THE Secretario SHALL poder subir un Acta en formato PDF o DOCX, asociada a una Asamblea específica, con título, fecha y descripción.
2. WHEN el Secretario publica un Acta, THE Sistema SHALL hacerla visible a todos los usuarios activos de la Junta.
3. THE Secretario SHALL poder registrar Resoluciones individuales vinculadas a un Acta, con número, descripción y estado de cumplimiento.
4. THE Sistema SHALL mostrar el archivo de Actas filtrable por fecha y Asamblea.
5. WHEN el Secretario actualiza el estado de cumplimiento de una Resolución, THE Sistema SHALL guardar la fecha y el usuario que realizó el cambio.

---

### Requisito RF-29: Registrar comunicaciones de otras instituciones

**Historia de usuario:** Como Secretario, quiero registrar las comunicaciones recibidas de otras instituciones, para mantener un archivo de la correspondencia oficial.

#### Criterios de aceptación

1. THE Secretario SHALL poder registrar una comunicación externa indicando institución remitente, asunto, fecha de recepción, número de oficio y resumen.
2. THE Sistema SHALL permitir adjuntar el documento original en formato PDF a la comunicación, almacenado en Supabase Storage.
3. THE Secretario SHALL poder registrar la respuesta emitida por la Junta asociada a una comunicación recibida.
4. THE Sistema SHALL mostrar el archivo de comunicaciones externas filtrable por institución, asunto y rango de fechas.
5. WHEN se registra una comunicación, THE Sistema SHALL guardar la fecha, hora y usuario que realizó el registro.

---

### Requisito RF-32: Consultar información individual

**Historia de usuario:** Como Miembro, quiero consultar mi información personal, mis pagos, mis multas y mis predios, para conocer mi situación dentro de la junta.

#### Criterios de aceptación

1. WHILE el usuario tiene el rol Miembro, THE Sistema SHALL mostrarle únicamente su propia información personal, historial de pagos, multas y Predios.
2. THE Miembro SHALL poder ver el detalle de cada pago registrado a su nombre, incluyendo fecha, concepto y monto.
3. THE Miembro SHALL poder ver las multas pendientes y pagadas asociadas a su cuenta.
4. THE Miembro SHALL poder ver los Predios registrados a su nombre con su información básica y ubicación en el mapa.
5. THE Miembro SHALL poder ver las Convocatorias vigentes y el historial de Asambleas y Mingas a las que fue convocado.

---

### Requisito RF-33: Enviar y recibir mensajes

**Historia de usuario:** Como Administrador o Miembro, quiero enviar y recibir mensajes dentro de la plataforma, para comunicarme con otros usuarios de mi junta sin salir del sistema.

#### Criterios de aceptación

1. THE Sistema SHALL proporcionar una bandeja de mensajes internos a cada usuario de la Junta.
2. THE Administrador SHALL poder enviar mensajes individuales o grupales a uno o más Miembros de su Junta.
3. THE Miembro SHALL poder enviar mensajes al Administrador de su Junta.
4. WHEN un usuario recibe un mensaje nuevo, THE Sistema SHALL mostrar una notificación visual en la interfaz.
5. WHILE el usuario está en la bandeja de mensajes, THE Sistema SHALL marcar automáticamente como leídos los mensajes visualizados.
6. THE Sistema SHALL conservar el historial de mensajes de cada usuario durante la vigencia de su cuenta.

---

## Requisitos No Funcionales

---

### Requisito RNF-01: Aislamiento multi-tenant

**Historia de usuario:** Como Super_Administrador, quiero que los datos de cada junta estén completamente aislados, para garantizar la privacidad y seguridad de cada organización.

#### Criterios de aceptación

1. THE Sistema SHALL incluir la columna `junta_id` en todas las tablas de negocio de la base de datos.
2. THE Sistema SHALL aplicar políticas RLS en Supabase para que cada consulta retorne únicamente los registros cuyo `junta_id` coincida con la junta del usuario autenticado.
3. IF un usuario intenta acceder a un recurso de otra Junta mediante una petición directa a la API, THEN THE Sistema SHALL rechazar la solicitud con un error de autorización.
4. THE Sistema SHALL validar el `junta_id` del usuario en cada operación de lectura y escritura sobre datos de negocio.

---

### Requisito RNF-02: Seguridad

**Historia de usuario:** Como Super_Administrador, quiero que la autenticación y el control de acceso sean seguros, para proteger la plataforma y los datos de los usuarios.

#### Criterios de aceptación

1. THE Sistema SHALL utilizar Supabase Auth para gestionar la autenticación de todos los usuarios.
2. THE Sistema SHALL almacenar el rol de cada usuario exclusivamente en la tabla `perfiles`, sin usar `user_metadata` de Supabase Auth.
3. THE Sistema SHALL leer las variables de entorno desde el archivo `.env.local` y nunca exponer la clave `service_role` en el código del frontend.
4. WHEN un usuario no autenticado intenta acceder a cualquier ruta protegida, THE Sistema SHALL redirigirlo a la página de inicio de sesión.
5. WHEN un usuario autenticado intenta acceder a una funcionalidad fuera de su rol, THE Sistema SHALL mostrar una página de acceso denegado.

---

### Requisito RNF-03: Respaldo de datos

**Historia de usuario:** Como Administrador, quiero que los datos de mi junta estén respaldados automáticamente y que pueda exportarlos manualmente, para prevenir la pérdida de información.

#### Criterios de aceptación

1. THE Sistema SHALL depender de la política de backups automáticos diarios que provee Supabase para la base de datos.
2. THE Administrador SHALL poder solicitar la exportación manual de los datos de su Junta en formato CSV desde el módulo de configuración.
3. WHEN el Administrador solicita una exportación, THE Sistema SHALL generar el archivo CSV y permitir su descarga inmediata.

---

### Requisito RNF-04: Responsividad de la interfaz

**Historia de usuario:** Como usuario de cualquier rol, quiero que la interfaz se adapte correctamente a diferentes dispositivos, para usar la plataforma desde escritorio, tablet o móvil.

#### Criterios de aceptación

1. THE Sistema SHALL renderizar todas las páginas con un diseño responsivo compatible con resoluciones desde 360 px hasta 1920 px de ancho.
2. WHEN el ancho del dispositivo es menor a 768 px, THE Sistema SHALL colapsar la barra de navegación lateral en un menú hamburguesa.
3. THE Sistema SHALL garantizar que todos los formularios y tablas sean usables sin desplazamiento horizontal en resoluciones de 360 px o más.

---

### Requisito RNF-05: Disponibilidad local

**Historia de usuario:** Como desarrollador, quiero que la aplicación esté disponible en la dirección local configurada, para trabajar de forma predecible en el entorno de desarrollo.

#### Criterios de aceptación

1. THE Sistema SHALL ejecutarse en la dirección `http://127.0.0.1:8081` usando Vite con `host: '127.0.0.1'` y `port: 8081` fijos en la configuración.
2. WHEN el puerto 8081 esté ocupado, THE Sistema SHALL mostrar un error en la consola indicando que el puerto no está disponible, sin reasignarlo automáticamente.
