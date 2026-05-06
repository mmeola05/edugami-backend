# Modelo Admin Tenant

## Objetivo

El Admin Tenant representa la administracion completa de un centro educativo, academia o institucion.

Su objetivo no es impartir clase. Esa responsabilidad pertenece al profesor. El Admin Tenant organiza, supervisa, controla y configura el funcionamiento del centro.

Este documento fija el modelo funcional que debe guiar las pantallas, rutas, permisos, migraciones y servicios del bloque tenant.

El estado real de desarrollo, porcentajes y checklist de lo pendiente se mantiene en:

- `platform-api/docs/TENANT_ADMIN_PROGRESS_STATUS.md`

El plan especifico de revision de BBDD se mantiene en:

- `platform-api/docs/TENANT_ADMIN_DATABASE_REVIEW_PLAN.md`

## Principios base

- Separar responsabilidades: admin no es profesor, profesor no es root, familiar no es alumno.
- No asumir relaciones simples 1:1 en alumnos, familias, profesores, clases o tenants.
- Mantener historico academico y operativo.
- Aislar estrictamente datos entre tenants.
- Resolver permisos por contexto, rol, modulo y relacion explicita.
- Disenar para centros reales, no para una demo.

## Scope final del producto

Este bloque define el alcance real del producto terminado para Admin Tenant. Todo lo listado aqui se considera obligatorio para llegar al 100%.

No se deben sugerir funcionalidades fuera de este scope mientras se este cerrando Admin Tenant.

### Modulos finales de producto

Los modulos finales que debe ver y entender el usuario son:

- Dashboard.
- Academico.
- Personas.
- Accesos.
- Comunicacion.
- Seguimiento.
- Configuracion.

Estos son modulos de producto, no necesariamente tablas ni rutas 1:1. Internamente pueden existir subpantallas, entidades, permisos y endpoints mas pequenos.

### Dashboard

Debe incluir:

- KPIs del centro: alumnos, profesores, clases, incidencias y uso.
- Actividad reciente.
- Avisos y alertas.
- Accesos rapidos.
- Selector de periodo academico.

### Academico

Debe incluir:

- Periodos academicos con CRUD, estados y jerarquia.
- Clases con CRUD, alumnos, profesores, asignaturas e historico.
- Asignaturas con CRUD y relacion con clases y profesores.
- Matriculas como modelo interno con estados, validaciones e historico automatico.
- Asignaciones docentes con CRUD, roles y validacion de conflictos.
- Calendario academico.

Regla UX:

- El periodo academico no se pide en formularios operativos normales.
- El sistema usa automaticamente el periodo activo del tenant.
- Solo puede haber un periodo activo por tenant.
- Las matriculas existen, pero no se exponen como concepto tecnico en la UI diaria.
- Las acciones visibles deben ser simples: anadir alumno, mover alumno, asignar asignatura o asignar profesor.
- El historico se genera automaticamente a partir de esas acciones.
- El periodo solo se muestra en selector global, analitica, historico y gestion de periodos.

### Personas

Debe incluir:

- Alumnos con CRUD, historial, tutores y matriculas.
- Profesores con CRUD, asignaciones y carga academica.
- Padres/tutores con vinculacion y permisos por alumno.
- Staff con roles internos.
- Usuarios con identidad, roles y contextos.

### Accesos

Debe incluir:

- Roles: crear, editar y asignar.
- Permisos: matriz por modulo y accion.
- Invitaciones con flujo completo.
- Suspensiones de usuarios y accesos.
- Contextos de usuario multi-rol.

### Comunicacion

Debe incluir:

- Comunicados: crear, programar, enviar y medir.
- Notificaciones manuales y automaticas.
- Plantillas.
- Programacion de envios.
- Estado de entrega.

### Seguimiento

Debe incluir:

- Analitica de uso, actividad y rendimiento.
- Reports exportables.
- Supervision de actividades.
- Incidencias con CRUD y flujo de estados.
- Uso de plataforma.

### Configuracion

Debe incluir:

- Settings del centro.
- Modulos activos.
- Politicas.
- Suscripcion y limites.
- Integraciones.
- Auditoria.
- Importacion/exportacion.

## Criterio de cierre funcional

Un modulo esta al 100% cuando:

- Todas sus funcionalidades del scope estan implementadas.
- Tiene UI propia, no wrappers genericos.
- Tiene validaciones reales.
- Respeta permisos y aislamiento tenant.
- Tiene auditoria cuando aplica.
- Puede usarse en un centro real sin soporte manual.

## Fuera de alcance

No forma parte de Admin Tenant:

- Creacion de actividades educativas, que pertenece al profesor.
- LMS completo.
- Evaluacion pedagogica avanzada.
- Experiencia de alumno final.
- Funcionalidad ROOT.

## Mapa tecnico interno

Este mapa no sustituye al scope final de producto. Sirve para ordenar entidades, servicios, migraciones, permisos y pantallas internas.

### Academic Core

Base estructural del sistema academico del centro.

- Periodos academicos.
- Clases.
- Asignaturas.
- Matriculas.
- Alumnos.
- Profesores.
- Asignaciones docentes.

### Operativa

Gestion del funcionamiento diario y supervision del centro.

- Actividades, solo supervision admin.
- Comunicados.
- Notificaciones.
- Incidencias internas.
- Analitica.

### Gestion

Control de usuarios, roles y relaciones organizativas.

- Usuarios.
- Roles y permisos.
- Padres/tutores.
- Invitaciones.
- Auditoria tenant.

### Config

Configuracion, limites e integraciones del centro.

- Settings.
- Modulos.
- Politicas.
- Suscripcion y limites.
- Integraciones.

## Academic Core

### Periodos academicos

Entidad obligatoria para que clases, matriculas, asignaciones docentes, historiales y analitica tengan contexto temporal.

Debe soportar:

- curso escolar,
- trimestre,
- evaluacion,
- calendario academico,
- fechas de inicio y fin,
- estado: planificado, activo, cerrado, archivado.

Reglas obligatorias:

- solo puede haber un periodo activo por tenant,
- el periodo activo se usa automaticamente en acciones operativas,
- los formularios de clases, alumnos, asignaturas, profesores y movimientos no deben pedir periodo por defecto,
- cambiar el periodo activo es una accion de gestion de periodos,
- el periodo debe ser visible solo en selector global, analitica, historico y gestion de periodos.

Ejemplos:

- Curso 2026/2027.
- Primer trimestre 2026/2027.
- Segunda evaluacion 2026/2027.

Sin periodos academicos, el sistema no puede responder bien a preguntas como "quien era profesor de matematicas en 2 ESO A durante el primer trimestre" o "que asignaturas curso este alumno el ano pasado".

### Clases

Gestion de grupos educativos.

Funciones:

- crear, editar y archivar clases,
- crear clases dentro del periodo activo del tenant,
- ver alumnos matriculados,
- ver profesores asignados,
- ver asignaturas impartidas,
- estado: activa, archivada.

Reglas:

- una clase pertenece a un tenant,
- una clase puede existir en varios periodos como instancias historicas,
- archivar una clase no debe borrar matriculas ni historico,
- mover alumnos, asignar asignaturas o asignar profesores debe crear/actualizar matriculas y asignaciones usando el periodo activo.

### Asignaturas

Definicion de materias del centro.

Funciones:

- crear, editar y archivar asignaturas,
- asignar asignaturas a clases,
- asignar profesores por clase usando el periodo activo,
- ver alumnos matriculados.

Reglas:

- una asignatura pertenece a un tenant,
- puede estar activa o archivada,
- puede impartirse en varias clases,
- puede tener profesores distintos segun clase y periodo.

### Matriculas

El alumno no "esta en una clase" sin mas. La relacion debe modelarse mediante matriculas explicitas.

Importante:

- Las matriculas siguen existiendo en el modelo.
- No deben exponerse como concepto tecnico principal en la UI.
- El usuario no deberia tener que "crear una matricula" manualmente en el flujo normal.
- Las matriculas se generan o actualizan automaticamente al anadir alumno, mover alumno, asignar asignatura o cambiar estado.
- El historico se genera automaticamente; el usuario no debe mantener historico a mano.

Matricula de clase:

- alumno,
- clase,
- tenant,
- periodo academico,
- fecha de inicio,
- fecha de fin,
- estado: activa, pendiente, finalizada, suspendida, anulada.

Matricula de asignatura:

- alumno,
- asignatura,
- clase si aplica,
- tenant,
- periodo academico,
- fecha de inicio,
- fecha de fin,
- estado.

Reglas:

- un alumno puede tener varias matriculas historicas,
- un alumno puede estar en varias asignaturas simultaneamente,
- no se deben borrar matriculas antiguas,
- la analitica y los informes deben usar matriculas con fechas y periodo,
- si no se especifica periodo desde una pantalla de gestion avanzada, se usa el periodo activo del tenant,
- las pantallas operativas deben hablar de alumnos, clases y asignaturas, no de matriculas como concepto tecnico.

### Alumnos

Gestion completa de estudiantes.

Funciones:

- alta, edicion y suspension,
- anadir alumno a una clase,
- mover alumno entre clases,
- asignar asignaturas al alumno,
- historial academico,
- vinculacion con padres/tutores,
- consulta de estado academico y operativo.

Reglas:

- un alumno pertenece a un tenant para sus datos academicos de ese centro,
- puede tener historico de clases y asignaturas,
- puede tener varios tutores autorizados,
- ningun familiar ve datos del alumno sin relacion explicita,
- mover o reasignar un alumno debe cerrar/abrir las matriculas internas necesarias sin pedir al admin que gestione la tabla tecnica.

### Profesores

Gestion del profesorado.

Funciones:

- alta, edicion y suspension,
- asignacion a clases y asignaturas,
- ver carga academica,
- ver donde ensena,
- consultar historico docente.

Reglas:

- un profesor puede dar varias asignaturas,
- puede estar en multiples clases,
- sus asignaciones deben depender de periodo academico,
- suspender un profesor no debe borrar historico.
- en formularios operativos se usa el periodo activo; el periodo solo se elige manualmente desde gestion de periodos/historico/analitica.

### Asignaciones docentes

No basta con relacionar profesor con asignatura o profesor con clase. La asignacion real incluye profesor, clase, asignatura y periodo academico.

Entidad minima:

- profesor,
- clase,
- asignatura,
- periodo academico,
- tenant,
- rol docente: titular, apoyo, sustituto, coordinador,
- fecha de inicio,
- fecha de fin,
- estado.

Ejemplo:

- Ana da Matematicas en 2 ESO A durante 2026-T1.

Reglas:

- un profesor puede tener varias asignaciones activas,
- una clase/asignatura puede tener mas de un docente si el centro lo necesita,
- los cambios deben quedar auditados,
- las actividades creadas por profesores deben poder trazarse contra esta asignacion.

## Operativa

### Actividades

El Admin Tenant no crea actividades docentes por defecto. Su papel es supervisar.

Funciones:

- ver actividades creadas por profesores,
- filtrar por clase, profesor, asignatura y periodo,
- ver uso y metricas,
- detectar problemas,
- desactivar actividades si es necesario.

Reglas:

- crear actividades pertenece al profesor salvo permiso especifico,
- desactivar actividades debe dejar auditoria,
- no debe romper el historico de resultados.

### Comunicados

Mensajes oficiales del centro.

Funciones:

- crear comunicados,
- enviar a todo el centro,
- enviar a clases,
- enviar a profesores,
- enviar a alumnos,
- enviar a padres/tutores,
- programar envio,
- ver estado de entrega.

Ejemplos:

- avisos,
- reuniones,
- anuncios importantes,
- cambios de horario,
- informacion institucional.

Reglas:

- debe respetar politicas de privacidad y permisos de tutor,
- debe mantener trazabilidad de destinatarios,
- debe soportar borrador, programado, enviado y cancelado.

### Notificaciones

Avisos rapidos y operativos.

Funciones:

- envio manual o automatico,
- recordatorios,
- alertas,
- eventos.

Diferencia con comunicados:

- son mas cortas,
- orientadas a accion inmediata,
- pueden ser generadas por reglas del sistema.

### Incidencias internas

Registro operativo para problemas del centro.

Funciones:

- crear incidencia,
- asignar responsable,
- clasificar por tipo,
- cambiar estado,
- adjuntar contexto,
- cerrar con resolucion.

Ejemplos:

- error reportado por profesor,
- problema con cuenta de alumno,
- incidencia de acceso familiar,
- actividad bloqueada,
- dato academico incorrecto.

### Analitica

Datos para toma de decisiones.

Funciones:

- rendimiento por clase,
- rendimiento por alumno,
- rendimiento por asignatura,
- uso de la plataforma,
- evolucion temporal,
- comparativas por periodo academico.

Objetivo:

- detectar problemas,
- mejorar ensenanza,
- tomar decisiones operativas,
- identificar bajo uso o riesgos.

Reglas:

- la analitica debe filtrar por permisos,
- los padres/tutores solo ven agregados de alumnos autorizados,
- el admin tenant no debe ver datos de otros tenants.

## Gestion

### Usuarios

Gestion de cuentas del tenant.

Funciones:

- crear usuarios,
- editar usuarios,
- activar o suspender,
- ver actividad,
- asignar roles,
- enlazar usuarios con profesor, alumno o tutor si aplica.

Reglas:

- una identidad puede tener varios contextos,
- no duplicar cuentas si el mismo email ya existe,
- suspender acceso tenant no tiene por que borrar la identidad global.

### Roles y permisos

Control de acceso dentro del tenant.

Roles base:

- admin tenant,
- staff,
- profesor,
- alumno,
- padre/tutor.

Roles de staff no docente a soportar por modelo:

- secretaria,
- coordinacion,
- direccion,
- orientador,
- soporte interno del centro.

Reglas:

- el modelo debe permitir roles personalizados,
- los permisos deben estar ligados a modulos y acciones,
- los permisos efectivos deben recalcularse al cambiar contexto.

### Padres y tutores

Gestion familiar.

Funciones:

- vincular padres/tutores con alumnos,
- invitar padres/tutores,
- revocar accesos,
- ver accesos concedidos,
- configurar permisos por relacion familiar-alumno.

Reglas:

- un padre puede tener varios hijos,
- los hijos pueden estar en distintas clases,
- los hijos pueden estar en distintos tenants,
- nunca asumir padre = un alumno,
- nunca asumir padre = una clase,
- nunca asumir padre = un tenant.

Referencia obligatoria:

- `platform-api/docs/TENANT_FAMILY_ACCESS_MODEL.md`

### Politicas de privacidad familiar

No todos los tutores tienen los mismos derechos. La relacion padre/tutor-alumno debe poder limitar acciones concretas.

Permisos posibles por relacion:

- ver informes,
- recibir comunicados,
- justificar asistencia,
- ver notas,
- contactar profesor,
- ver progreso,
- ver incidencias,
- recibir notificaciones.

Reglas:

- la politica se aplica por alumno y tenant,
- un tutor puede tener permisos distintos para hijos distintos,
- revocar permiso debe afectar inmediatamente a futuras lecturas,
- los cambios deben auditarse.

### Invitaciones

Flujo obligatorio para incorporar usuarios sin crear cuentas duplicadas.

Debe soportar:

- invitar por email,
- aceptar invitacion,
- caducidad,
- reenviar,
- revocar,
- registrar quien invita,
- registrar contexto propuesto: tenant, rol, alumno, relacion familiar si aplica.

Casos:

- invitar profesor,
- invitar padre/tutor,
- invitar staff,
- invitar alumno si el centro lo permite.

Reglas:

- aceptar una invitacion debe reutilizar identidad existente si el email ya tiene cuenta,
- si no existe cuenta, debe crear identidad y luego enlazar contexto,
- la invitacion no debe conceder acceso hasta aceptacion valida,
- una invitacion revocada o caducada no puede usarse.

### Auditoria tenant

El Admin Tenant necesita ver actividad sensible del centro.

Eventos obligatorios:

- quien creo usuario,
- quien edito usuario,
- quien suspendio alumno o profesor,
- quien vinculo padre/tutor con alumno,
- quien revoco acceso familiar,
- quien cambio permisos,
- quien cambio rol,
- quien creo o cerro incidencia,
- quien desactivo actividad,
- quien cambio configuracion del centro.

Campos minimos:

- tenant,
- actor,
- tipo de evento,
- entidad,
- accion,
- estado anterior,
- estado posterior,
- metadata,
- fecha,
- request/correlation id si existe.

Reglas:

- la auditoria tenant no debe mezclarse con otros tenants,
- ROOT puede necesitar vista global, pero Admin Tenant solo ve su centro,
- cambios sensibles deben tener motivo cuando aplique.

### Importacion y exportacion

Los centros reales necesitan cargar y extraer informacion de forma operativa.

Debe soportar:

- importar alumnos por CSV/Excel,
- importar profesores por CSV/Excel,
- importar clases/asignaturas,
- exportar listados,
- descargar plantillas,
- validar errores antes de confirmar,
- previsualizar altas, cambios y duplicados,
- registrar auditoria de importacion.

Reglas:

- nunca insertar parcialmente sin resumen claro,
- detectar duplicados por email, documento o identificador interno cuando exista,
- permitir correccion de errores,
- respetar limites de suscripcion.

## Config

### Settings

Configuracion general del centro.

Funciones:

- datos del centro,
- idioma,
- zona horaria,
- politicas de acceso,
- comportamiento del sistema,
- preferencias de comunicacion.

### Modulos

Control de funcionalidades activas.

Funciones:

- activar o desactivar modulos tenant permitidos,
- ver modulos bloqueados por plan,
- ver modulos bloqueados por ROOT,
- ver dependencias padre/hijo.

Ejemplos:

- gamificacion,
- IA,
- social,
- analytics,
- actividades,
- perfil.

Reglas:

- depende del plan contratado,
- depende de configuracion ROOT,
- depende de permisos del rol,
- desactivar modulo critico debe pedir confirmacion y auditarse.

### Politicas

Configuracion transversal de reglas del centro.

Politicas posibles:

- privacidad familiar,
- asistencia,
- comunicaciones,
- acceso por rol,
- seguridad de sesiones,
- visibilidad de calificaciones,
- contacto familia-profesor.

### Suscripcion y limites

Gestion del plan.

Funciones:

- ver plan actual,
- ver limites de alumnos,
- ver limites de profesores,
- ver funcionalidades disponibles,
- ver uso actual,
- solicitar upgrade o downgrade.

Reglas:

- los limites deben aplicarse tambien en importaciones,
- una pantalla puede informar pero la autoridad final debe estar en backend.

### Integraciones

Preparacion para conectar servicios externos del centro.

Ejemplos:

- SMTP del centro,
- calendario,
- sistemas academicos externos,
- proveedores SSO,
- almacenamiento externo,
- herramientas de comunicacion.

Integraciones academicas a contemplar:

- Alexia,
- Moodle,
- Google Classroom,
- otros sistemas academicos, LMS o plataformas usadas por centros.

Scope inicial de integraciones:

- conectar cuenta/instancia externa,
- validar credenciales y permisos,
- importar alumnos,
- importar profesores,
- importar clases,
- importar asignaturas,
- importar usuarios,
- sincronizar cambios desde el sistema externo hacia EduGami,
- registrar logs de importacion/sincronizacion,
- mostrar errores entendibles al admin tenant.

Integracion avanzada:

- crear entidades en sistemas externos desde EduGami,
- sincronizacion bidireccional completa,
- mapeo configurable de entidades,
- mapeo de roles y permisos externos,
- resolucion de conflictos,
- logs detallados,
- auditoria de cambios,
- gestion de errores y reintentos,
- control por plan contratado,
- control por modulo habilitado desde ROOT/tenant.

Regla de scope:

- Esto pertenece a Configuracion/Fase 4.
- No es obligatorio para cerrar la base academica inicial.
- La base academica inicial debe funcionar aunque no haya integraciones externas.
- El primer objetivo es importar/sincronizar desde sistemas externos hacia EduGami, no crear todo desde EduGami hacia fuera.

## Entidades conceptuales clave

Lista minima para modelar correctamente Admin Tenant:

- `academic_periods`
- `tenant_classes`
- `tenant_subjects`
- `tenant_students`
- `tenant_teachers`
- `tenant_class_enrollments`
- `tenant_subject_enrollments`
- `tenant_teacher_assignments`
- `tenant_guardian_student_links`
- `tenant_guardian_policies`
- `tenant_invitations`
- `tenant_audit_events`
- `tenant_import_jobs`
- `tenant_incidents`
- `tenant_announcements`
- `tenant_notifications`
- `tenant_settings`

Los nombres exactos pueden variar, pero estas responsabilidades no deben desaparecer.

## Orden de implementacion recomendado

### Fase 1: base academica

1. Periodos academicos.
2. Clases.
3. Asignaturas.
4. Alumnos.
5. Matriculas.
6. Profesores.
7. Asignaciones docentes.

### Fase 2: gestion de acceso

1. Usuarios tenant.
2. Roles y permisos.
3. Invitaciones.
4. Padres/tutores.
5. Politicas de privacidad familiar.
6. Auditoria tenant.

### Fase 3: operativa

1. Comunicados.
2. Notificaciones.
3. Incidencias internas.
4. Supervision de actividades.
5. Analitica inicial.

### Fase 4: configuracion y escala

1. Settings.
2. Modulos tenant.
3. Suscripcion y limites.
4. Importacion/exportacion.
5. Integraciones:
   - Alexia,
   - Moodle,
   - Google Classroom,
   - conexion, importacion y sincronizacion inicial,
   - creacion/sincronizacion avanzada como fase posterior.

## Estilo visual Tenant Admin y Teacher

Tenant Admin y Teacher no deben copiar el estilo ROOT.

ROOT representa control tecnico de plataforma: infraestructura, monitorizacion, alertas y operativa interna. Su estilo puede ser mas oscuro, tecnico y tipo panel de control.

Tenant Admin y Teacher pertenecen al mundo educativo. Deben sentirse mas cercanos, claros, humanos y agradables para trabajar muchas horas.

### Direccion visual

El estilo de Tenant Admin y Teacher debe ser:

- limpio,
- moderno,
- educativo,
- premium,
- profesional pero cercano,
- colorido sin ser infantil,
- guiado sin ser pesado,
- visual sin saturar.

No debe parecer:

- DevOps,
- panel tecnico oscuro,
- dashboard generico,
- interfaz infantil,
- maqueta recargada,
- copia visual de ROOT.

### Diferencia por zona

| Zona | Identidad visual | Sensacion principal |
| --- | --- | --- |
| ROOT | Tecnica, oscura, operativa, plataforma | Control de infraestructura |
| Tenant Admin | Clara, organizada, academica, guiada | Gestion educativa real |
| Teacher | Creativa, practica, visual, comoda | Creacion y seguimiento pedagogico |
| Student/User futuro | Mas gamificado, animado y emocional | Aprendizaje con progreso y motivacion |

### Paleta recomendada

Tenant Admin y Teacher pueden usar una paleta mas rica que ROOT:

- indigo para marca y acciones principales,
- cyan para tecnologia, informacion y datos,
- verde para estados correctos, activo y progreso,
- naranja para avisos operativos o pendientes,
- rosa/fucsia controlado para acentos creativos,
- amarillo suave para destacados positivos,
- slate/grises modernos para texto, bordes y estructura.

Reglas de color:

- no dominar toda la UI con azul/morado,
- no usar colores chillones,
- no mezclar demasiados colores en el mismo bloque,
- cada color debe tener significado,
- los estados deben ser consistentes en todas las pantallas,
- el modo claro debe sentirse como el modo principal para Tenant Admin y Teacher,
- el modo oscuro puede existir, pero no debe convertir estas areas en ROOT.

### Sistema visual obligatorio

Debe existir un sistema coherente y reutilizable:

- tokens SCSS centralizados,
- tamanos de fuente consistentes,
- jerarquia clara de titulos, subtitulos, labels y captions,
- cards con tamanos armonizados,
- espaciado consistente,
- botones con jerarquia clara: primario, secundario, ghost, peligro,
- inputs y selects limpios, redondeados y legibles,
- campos de fecha basados en Quasar, no inputs nativos feos,
- badges con color y semantica,
- estados visuales claros: activo, pendiente, suspendido, archivado, error,
- drawers laterales para crear/editar sin perder contexto,
- dialogs solo para confirmaciones criticas o decisiones bloqueantes,
- tablas compactas cuando haya volumen,
- cards solo cuando aporten contexto o decision rapida.

### Componentes base a consolidar

Para llegar al 100%, Tenant Admin y Teacher deben compartir componentes visuales:

- layout tenant/teacher,
- sidebar adaptada a contexto educativo,
- header con busqueda y acciones claras,
- page header reutilizable,
- toolbar de filtros,
- empty state,
- error state,
- loading state,
- metric cards compactas,
- entity cards,
- compact data list,
- scroll table compacta,
- right drawer form,
- right drawer detail,
- confirm dialog critico,
- date field Quasar,
- search input,
- status badge,
- role badge,
- action menu,
- bulk action bar.

### UX Tenant Admin

El Admin Tenant ve muchas entidades: clases, alumnos, profesores, asignaturas, matriculas, comunicados, configuraciones y analitica. La interfaz debe evitar saturacion.

Reglas UX:

- pantallas claras,
- flujos guiados,
- agrupaciones visuales,
- filtros visibles,
- busqueda rapida,
- vistas compactas cuando haya muchos datos,
- detalles laterales para no perder contexto,
- acciones rapidas solo cuando sean obvias,
- acciones peligrosas siempre confirmadas,
- formularios divididos por bloques logicos,
- textos cortos y utiles,
- no meter todo en tablas si una lista o card comunica mejor,
- no meter todo en cards si hay volumen real,
- mantener visible el contexto: tenant, periodo, clase, estado.

### UX Teacher

Teacher necesita trabajar contenido y seguimiento pedagogico.

Reglas UX:

- acceso rapido a clases y asignaturas,
- colores utiles para identificar materias, grupos y estados,
- creacion de actividades comoda,
- supervision de entregas y progreso,
- menos configuracion administrativa,
- mas foco en contenido, alumnos y resultados,
- Tutor IA visible solo para profesor cuando el modulo este habilitado.

### Criterios visuales de calidad

Antes de considerar una pantalla terminada:

- debe verse bien en claro y oscuro, pero el claro debe ser excelente,
- debe tener tamanos parecidos al dashboard ROOT en densidad y escala, sin cards gigantes injustificadas,
- debe tener spacing consistente,
- los inputs/selects/date pickers deben verse modernos,
- no debe haber textos apelotonados ni elementos flotando sin jerarquia,
- las acciones principales deben ser obvias,
- los estados vacios deben explicar que hacer,
- mobile debe ser usable,
- no debe depender de capturas o datos demo para entenderse,
- debe pasar build frontend.

## Checklist de diseno antes de implementar pantallas

- Cada pantalla tenant tiene modulo requerido.
- Cada accion sensible tiene permiso requerido.
- Cada consulta filtra por `tenant_id`.
- Familias/tutores filtran por relacion explicita con alumno.
- Clases, asignaturas y asignaciones tienen periodo academico.
- Los formularios operativos usan automaticamente el periodo activo.
- Solo gestion de periodos, selector global, analitica e historico muestran/permiten elegir periodo.
- Matriculas tienen fechas, estado e historico, pero no se exponen como concepto tecnico en la UI diaria.
- Anadir alumno, mover alumno, asignar asignatura y asignar profesor generan historico automaticamente.
- Invitaciones no duplican identidades.
- Suspender no borra historico.
- Cambios sensibles quedan auditados.
- Importaciones validan antes de escribir.
- Analitica respeta permisos y privacidad.
- Tenant Admin y Teacher tienen identidad visual propia, no copiada de ROOT.
- La UI usa el sistema visual centralizado y no estilos sueltos por pantalla.
- Los formularios usan componentes Quasar estilizados, especialmente fechas.
- Crear/editar prioriza drawer o edicion en pagina; dialog solo cuando tenga sentido.
- Cards, tablas y filtros se eligen segun el volumen real de datos.

## Revision obligatoria de BBDD

Se han realizado migraciones recientes y la base de datos puede haber quedado en un estado inconsistente. Antes de dar Admin Tenant por cerrado, hay que revisar la BBDD real, no solo los archivos.

### Problemas a detectar

La revision debe comprobar:

- estructura incoherente entre ROOT y Tenant,
- tablas duplicadas,
- tablas incompletas,
- tablas sin uso real,
- columnas incorrectas,
- relaciones mal definidas,
- constraints ausentes o debiles,
- permisos declarados pero no sembrados,
- modulos declarados pero no visibles por rol,
- datos corruptos o no alineados con el modelo actual,
- posible ruptura de funcionalidad ROOT,
- ambiguedad entre identidad global, usuario tenant, alumno, profesor, tutor y staff.

### Objetivo de la revision

La revision debe:

1. Analizar el estado actual de la base de datos.
2. Detectar tablas innecesarias, columnas incorrectas, relaciones mal definidas y duplicidades.
3. Confirmar que ROOT sigue funcionando exactamente como antes.
4. Confirmar que el sistema soporta multi-tenant correctamente.
5. Confirmar que las entidades Tenant estan aisladas por tenant.
6. Confirmar que no hay ambiguedad en relaciones clave.

### Opcion A: limpieza

Usar esta opcion si la estructura actual es recuperable.

Debe incluir:

- eliminar lo que no corresponde al modelo actual,
- ajustar tablas a Academico, Personas, Accesos, Comunicacion, Seguimiento y Configuracion,
- corregir relaciones y constraints,
- corregir permisos y seeds,
- mantener datos validos si son utiles,
- dejar migraciones limpias y repetibles.

### Opcion B: reset completo

Es preferible si hay dudas fuertes sobre la consistencia real.

Debe incluir:

- borrar la base de datos actual,
- recrearla desde cero con estructura correcta,
- aplicar migraciones limpias,
- insertar datos por defecto para ROOT,
- crear usuario root funcional,
- crear configuracion base,
- crear entorno operativo inicial,
- crear nuevas tablas para Tenant Admin alineadas con este modelo,
- sembrar modulos, permisos, roles y datos minimos por defecto.

### Condicion obligatoria despues de la revision

Despues de limpiar o resetear:

- ROOT debe funcionar exactamente como antes.
- Multi-tenant debe funcionar correctamente.
- Las nuevas entidades tenant deben estar bien aisladas.
- No debe haber relaciones ambiguas.
- No debe haber permisos exigidos por rutas que no existan en BBDD.
- No debe haber modulos visibles en frontend sin soporte backend real.
- No debe haber endpoints tenant sin auditoria cuando modifican datos sensibles.

### Resultado esperado

La revision de BBDD debe producir:

- listado de tablas a conservar,
- listado de tablas a eliminar,
- listado de columnas a corregir,
- listado de constraints/FK a crear o ajustar,
- listado de seeds obligatorios,
- decision documentada: limpieza o reset,
- plan de migracion seguro,
- smoke test ROOT,
- smoke test Tenant Admin.

## Objetivo de revision funcional

Antes de cerrar Admin Tenant hay que revisar si:

1. Falta alguna funcionalidad critica para uso real en centros educativos.
2. Hay funcionalidades redundantes o mal agrupadas.
3. La division en modulos finales es coherente.
4. El modelo de datos es correcto y escalable.
5. La base de datos es consistente y alineada con el modelo.
6. El sistema puede usarse en produccion sin bloqueos.

## Objetivo final

El Admin Tenant debe quedar como un sistema:

- realista,
- escalable,
- usable en centros reales,
- preparado para crecimiento SaaS,
- compatible con alumnos, profesores, familias, staff y futuros usuarios publicos sin duplicar logica.
