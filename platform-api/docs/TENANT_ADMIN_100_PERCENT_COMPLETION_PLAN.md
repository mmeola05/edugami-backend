# Plan 100% Admin Tenant

Ultima revision: 2026-05-06

Este documento es el plan operativo para terminar Admin Tenant como producto completo. No es un MVP ni una demo. Todo lo listado aqui debe quedar resuelto para poder decir que Tenant Admin esta listo para un centro real.

Documentos fuente:

- `platform-api/docs/TENANT_ADMIN_MODULES_MODEL.md`
- `platform-api/docs/TENANT_ADMIN_PROGRESS_STATUS.md`
- `platform-api/docs/TENANT_ADMIN_DATABASE_REVIEW_PLAN.md`
- `platform-api/docs/TENANT_ADMIN_DATABASE_REVIEW_RESULT_2026-05-05.md`
- `platform-api/docs/TENANT_ADMIN_DB_CLEANUP_SCOPE.md`
- `platform-api/docs/TENANT_ADMIN_DB_CLEANUP_RESULT_2026-05-05.md`

## Reglas de producto

- El usuario final entiende Admin Tenant en 7 bloques: Dashboard, Academico, Personas, Accesos, Comunicacion, Seguimiento y Configuracion.
- Internamente puede haber mas rutas, permisos y tablas, pero la experiencia no debe parecer una lista tecnica de tablas.
- No se deben mostrar modulos sin backend/frontend real.
- ROOT no se toca salvo necesidad estricta.
- Teacher no es Admin Tenant; Teacher tendra experiencia propia.
- Tutor IA queda solo para Teacher de momento.
- Las matriculas existen, pero son internas. La UI habla de anadir alumno, mover alumno, asignar asignatura y asignar profesor.
- El periodo activo del tenant se usa automaticamente en formularios operativos.
- Solo gestion de periodos, selector global, analitica e historico muestran periodo.
- Todo cambio sensible debe tener auditoria.
- Todo acceso debe respetar `tenant_id`, rol, permisos y relaciones explicitas.

## Estado limpio de BBDD actual

Catalogo tenant actual tras limpieza:

- `PERIODS`
- `CLASSES`
- `STUDENTS`
- `COURSES`
- `TEACHERS`
- `TEACHER_ASSIGNMENTS`
- `TENANT_ADMIN`
- `REPORTS`
- `AI_TUTOR`
- `ENROLLMENTS`

Notas:

- `ENROLLMENTS` es modulo tecnico interno y no debe aparecer como seccion principal de UI.
- `AI_TUTOR` queda solo para `TEACHER`.
- Se eliminaron tablas tenant experimentales vacias: asistencia, comunicaciones, incidencias, invitaciones, auditoria tenant antigua, login attempts tenant y reset tokens tenant.
- Siguen pendientes de reconciliar migraciones `018` a `026`.

## Orden obligatorio de trabajo

### Fase 0 - Saneamiento tecnico

Objetivo: poder seguir construyendo sin arrastrar inconsistencia.

Pendiente:

- Reconciliar migraciones `018` a `026` o documentar una migracion de consolidacion.
- Crear script/check que compare `schema_migrations` contra archivos reales.
- Crear smoke test automatico para ROOT.
- Crear smoke test automatico para Tenant Admin.
- Confirmar que un entorno limpio puede recrearse desde migraciones versionadas.
- Revisar seeds de tenant nuevo: modulos, roles, permisos y usuario tenant admin.

Cierre:

- `node scripts/migrate.js` debe funcionar en BBDD limpia.
- Login root funciona.
- Login tenant funciona.
- No faltan permisos exigidos por rutas.
- No hay modulos tenant visibles sin ruta y backend.

### Fase 1 - Sistema visual Tenant Admin / Teacher

Objetivo: que todas las pantallas nuevas compartan armonia visual.

Pendiente:

- Consolidar componentes reutilizables:
  - `TenantPageHeader`
  - `TenantFilterBar`
  - `TenantMetricCard`
  - `TenantEntityCard`
  - `TenantCompactList`
  - `TenantScrollTable`
  - `TenantRightDrawerForm`
  - `TenantRightDrawerDetail`
  - `TenantEmptyState`
  - `TenantStatusBadge`
  - `TenantBulkActionBar`
  - `AppDateField`
- Unificar tamanos de cards, inputs, botones, headings y captions.
- Revisar modo claro como modo principal.
- Revisar modo oscuro para que no parezca ROOT.
- Eliminar estilos sueltos duplicados dentro de paginas si ya pueden vivir en componentes.
- Revisar responsive mobile de sidebar, header, drawers y listas.

Cierre:

- Ninguna pantalla tenant importante inventa su propio sistema visual.
- Build frontend correcto.
- No hay cards gigantes sin contenido.
- No hay tablas con paginacion innecesaria.

## Dashboard

### Pantallas

- Dashboard principal del centro.
- Selector global de periodo academico.
- Panel de actividad reciente.
- Panel de avisos y alertas.
- Accesos rapidos contextualizados.

### Backend

- Endpoint de KPIs reales:
  - alumnos activos,
  - profesores activos,
  - clases activas,
  - asignaturas activas,
  - incidencias abiertas,
  - uso reciente,
  - comunicados pendientes,
  - invitaciones pendientes.
- Endpoint de actividad reciente tenant.
- Endpoint de avisos operativos.

### UI/UX

- No debe parecer ROOT.
- Debe priorizar gestion educativa.
- Debe tener cards compactas, no bloques vacios.
- Debe mostrar periodo activo.
- Acciones rapidas:
  - crear clase,
  - anadir alumno,
  - invitar usuario,
  - crear comunicado,
  - registrar incidencia.

### Pendiente actual

- Redisenar `TenantDashboardPage.vue`.
- Conectar datos reales.
- Anadir selector global de periodo.
- Quitar contenido placeholder.

## Academico

### Periodos

Hecho:

- Pagina propia.
- CRUD base.
- Periodo activo unico en BBDD.
- Fechas con Quasar.

Pendiente:

- Jerarquia curso/trimestre/evaluacion.
- Cierre de periodo con confirmacion.
- Validacion de solapamientos de fechas.
- Calendario academico.
- Accion de cambiar periodo activo con auditoria.
- Mostrar impacto antes de cerrar/activar.

### Clases

Hecho:

- Pagina propia.
- Cards/lista visual.
- Crear/editar.
- Detalle lateral con alumnos/asignaturas/profesores.

Pendiente:

- Archivo real de clase.
- Ver historico de alumnos.
- Ver historico de profesores.
- Accion rapida: anadir alumno a clase.
- Accion rapida: asignar asignatura a clase.
- Accion rapida: asignar profesor.
- Validar duplicados por nombre/codigo/periodo.
- Vista compacta para muchas clases.

### Asignaturas

Hecho:

- Pagina propia.
- Cards, filtros, crear/editar.
- Detalle lateral con alumnos, clases y profesores.

Pendiente:

- Asignar asignatura a clase desde la propia pantalla.
- Ver clases donde se imparte por periodo.
- Archivo real de asignatura.
- Validar duplicados por codigo/nombre.
- Separar catalogo de asignatura e imparticion por clase/periodo si el modelo lo requiere.

### Alumnos

Hecho:

- Pagina propia.
- Busqueda, filtros, KPIs, lista compacta.
- Drawer detalle.
- Crear/editar.
- Mover alumno.
- Asignar asignaturas.
- No pide periodo.

Pendiente:

- Perfil completo de alumno.
- Historial academico visible y filtrable.
- Tutores y politicas por alumno.
- Suspension con motivo.
- Importacion masiva.
- Prevencion de duplicados.
- Vista de privacidad familiar.
- Acciones bulk:
  - mover grupo de alumnos,
  - asignar asignatura a varios alumnos,
  - suspender,
  - exportar.

### Matriculas internas

Hecho:

- Modelo interno.
- Periodo activo automatico.
- Historico automatico.
- Endpoints de accion simple.
- `ENROLLMENTS` oculto de navegacion.

Pendiente:

- Revisar constraints y duplicados.
- Cerrar correctamente matriculas anteriores al mover.
- Motivo de baja/cambio.
- Vista de historico entendible, no tabla tecnica.
- Auditoria de cambios.
- Tests de cambios academicos.

### Asignaciones docentes

Siguiente trabajo inmediato.

Debe hacerse ahora:

- Convertir `TenantTeacherAssignmentsPage.vue` en pagina propia.
- Dejar de usar `TenantResourcePage`.
- Mostrar profesor, clase, asignatura, rol, estado y fechas opcionales.
- No pedir periodo.
- Usar periodo activo automaticamente.
- Drawer para crear/editar.
- Lista compacta o cards, no tabla grande.
- KPIs:
  - asignaciones activas,
  - profesores con carga,
  - clases cubiertas,
  - conflictos detectados.
- Avisos visuales:
  - mismo profesor repetido,
  - misma clase/asignatura con varios titulares activos,
  - asignaciones suspendidas,
  - asignaciones completadas,
  - falta profesor en clase/asignatura si se puede detectar.
- Acciones:
  - asignar profesor,
  - cambiar rol docente,
  - suspender/completar asignacion,
  - editar fechas.
- Traducciones ES/EN.
- Build frontend.
- Actualizar progreso.

Backend pendiente:

- Validar conflicto de titular activo por clase/asignatura/periodo.
- Permitir varios docentes si rol no es titular.
- Registrar historico/auditoria.
- Endpoint de resumen de carga docente.
- Tests de permisos y aislamiento.

### Calendario academico

Pendiente completo:

- Crear modelo de calendario academico.
- Eventos de centro.
- Fechas lectivas/no lectivas.
- Evaluaciones.
- Filtros por periodo.
- Integracion futura con comunicados/notificaciones.

## Personas

### Profesores

Debe hacerse despues de Asignaciones docentes.

Pendiente:

- Convertir `TenantTeachersPage.vue` en pagina propia.
- Perfil docente.
- Estado y roles.
- Carga academica.
- Clases que imparte.
- Asignaturas que imparte.
- Historico docente.
- Crear/editar profesor.
- Suspender profesor con motivo.
- Invitar profesor si no existe cuenta.
- Detectar profesores sin asignacion.
- Exportar listado.

Backend:

- Alta/edicion especifica de profesor.
- Vincular usuario tenant con perfil profesor.
- Carga academica por periodo.
- Historico y auditoria.

### Padres/tutores

Pendiente:

- Pagina propia dentro de Personas.
- Vincular tutor a alumno.
- Invitar tutor.
- Ver hijos vinculados.
- Permisos por alumno:
  - ver informes,
  - recibir comunicados,
  - justificar asistencia,
  - ver notas,
  - contactar profesor,
  - ver incidencias.
- Revocar acceso.
- Soporte multi-hijo y multi-tenant.
- Nunca mostrar companeros de clase.

Backend:

- Modelo de politicas familiares.
- Endpoints de permisos por relacion.
- Auditoria.
- Tests de privacidad.

### Staff

Pendiente:

- Roles no docentes:
  - secretaria,
  - coordinacion,
  - direccion,
  - orientador,
  - soporte interno.
- Alta/edicion.
- Permisos por rol.
- Suspensiones.
- Invitaciones.

### Usuarios

Hecho parcial:

- `TenantAdminUsersPage.vue` existe.
- Listar/crear/editar usuarios y roles base.

Pendiente:

- Redisenar al nuevo sistema visual.
- Contextos multi-rol.
- Perfil enlazado: profesor, alumno, tutor, staff.
- Suspender acceso tenant sin borrar identidad.
- Evitar duplicados por email.
- Actividad reciente.
- Auditoria.

## Accesos

### Roles y permisos

Pendiente:

- Pantalla de roles tenant.
- Matriz visual de permisos por modulo y accion.
- Crear rol personalizado.
- Editar rol.
- Asignar usuarios.
- Ver impacto antes de cambiar permisos.
- Confirmacion en cambios sensibles.
- Auditoria.

### Invitaciones

Pendiente completo tras limpieza:

- Nueva tabla/migracion definitiva.
- Invitar por email.
- Aceptar invitacion.
- Caducidad.
- Reenviar.
- Revocar.
- Vincular rol/contexto.
- Invitar profesor/tutor/staff/alumno si aplica.
- Reutilizar identidad si email existe.
- Plantillas de email profesionales.
- Auditoria.

### Suspensiones

Pendiente:

- Suspender usuario.
- Suspender rol/contexto.
- Suspender alumno/profesor sin borrar historico.
- Motivo obligatorio en acciones sensibles.
- Reversion controlada.

## Comunicacion

Pendiente completo:

- Comunicados.
- Notificaciones.
- Plantillas.
- Programacion de envios.
- Estado de entrega.
- Destinatarios:
  - todo el centro,
  - clases,
  - profesores,
  - alumnos,
  - padres/tutores,
  - staff.
- Preferencias de comunicacion.
- Logs de entrega.
- Auditoria.

Backend:

- Crear nuevas migraciones definitivas.
- Endpoints y servicios.
- Integracion email/SMS/push segun fase.

UI:

- Bandeja/lista de comunicados.
- Compositor guiado.
- Selector de destinatarios.
- Vista de entregas.
- Estados: borrador, programado, enviado, cancelado.

## Seguimiento

### Analitica / Reports

Pendiente:

- Rehacer `TenantReportsPage.vue` como pagina real.
- KPIs por periodo.
- Uso de plataforma.
- Actividad por clase.
- Actividad por alumno.
- Actividad por asignatura.
- Filtros por periodo, clase, asignatura, profesor.
- Exportar reportes.
- Respetar permisos y privacidad.

### Supervision de actividades

Pendiente:

- Ver actividades creadas por profesores.
- Filtrar por clase, profesor, asignatura y periodo.
- Ver uso y metricas.
- Desactivar actividad con confirmacion.
- Auditoria.

### Incidencias

Pendiente:

- Nueva migracion definitiva.
- CRUD de incidencias.
- Estados.
- Responsable.
- Prioridad.
- Comentarios.
- Resolucion.
- Notificaciones si aplica.
- Auditoria.

## Configuracion

### Settings

Pendiente:

- Datos del centro.
- Idioma.
- Zona horaria.
- Politicas de acceso.
- Preferencias de comunicacion.
- Seguridad basica.
- Auditoria de cambios.

### Modulos tenant

Pendiente:

- Pantalla de modulos habilitados.
- Separar:
  - permitido por ROOT,
  - permitido por plan,
  - habilitado por tenant,
  - visible por rol.
- Confirmar cambios criticos.
- Auditoria.

### Politicas

Pendiente:

- Politicas familiares.
- Politicas de comunicacion.
- Politicas de asistencia.
- Politicas de sesiones.
- Visibilidad de notas/progreso.

### Suscripcion y limites

Pendiente:

- Ver plan.
- Ver limites.
- Ver uso actual.
- Bloqueos por limite.
- Solicitar cambio de plan.
- Aplicar limites en importaciones y altas.

### Importacion/exportacion

Pendiente:

- CSV/Excel alumnos.
- CSV/Excel profesores.
- CSV/Excel clases.
- CSV/Excel asignaturas.
- Plantillas descargables.
- Previsualizacion.
- Validacion de errores.
- Deteccion de duplicados.
- Confirmacion final.
- Job de importacion.
- Auditoria.

### Integraciones externas

Fase avanzada, pero debe estar contemplada.

Pendiente:

- Alexia.
- Moodle.
- Google Classroom.
- Conexion.
- Validacion de credenciales.
- Importar alumnos.
- Importar profesores.
- Importar clases.
- Importar asignaturas.
- Importar usuarios.
- Sincronizar cambios hacia EduGami.
- Logs de sync.
- Errores entendibles.
- Mapeo de entidades.
- Control por plan/modulo.
- Auditoria.

## Backend transversal pendiente

- Auditoria tenant definitiva.
- Servicio de invitaciones definitivo.
- Servicio de comunicaciones definitivo.
- Servicio de incidencias definitivo.
- Servicio de settings definitivo.
- Servicio de import/export.
- Servicio de integraciones.
- Tests de aislamiento por tenant.
- Tests de permisos.
- Tests de periodo activo.
- Tests de historico automatico.
- Tests de privacidad familiar.
- Seeds reproducibles.

## Frontend transversal pendiente

- Eliminar wrappers genericos en pantallas principales.
- Crear paginas propias para:
  - Asignaciones docentes,
  - Profesores,
  - Reports,
  - Usuarios/Roles,
  - Padres/tutores,
  - Dashboard,
  - Settings,
  - Comunicacion,
  - Incidencias,
  - Import/export.
- Unificar componentes tenant.
- Revisar traducciones ES/EN completas.
- Revisar responsive mobile.
- Revisar empty/loading/error states.
- Revisar confirmaciones de acciones sensibles.
- Revisar accesibilidad basica.

## BBDD pendiente

- Reconciliar `018` a `026`.
- Revisar constraints:
  - un periodo activo por tenant,
  - no duplicar clases por codigo/periodo,
  - no duplicar asignaturas por codigo,
  - no duplicar alumnos por referencia externa cuando exista,
  - no duplicar asignacion titular activa si no se permite.
- Revisar FK con `tenant_id`.
- Revisar indices para:
  - alumnos por tenant/clase,
  - asignaturas por tenant,
  - matriculas por alumno/periodo,
  - asignaciones por profesor/clase/asignatura/periodo,
  - historico por alumno y entidad.
- Crear nuevas tablas definitivas solo cuando haya backend/frontend correspondiente.

## Orden inmediato desde hoy

1. `TenantTeacherAssignmentsPage.vue` como pagina propia.
2. Backend de conflictos/carga docente.
3. `TenantTeachersPage.vue` como pagina propia.
4. Redisenar `TenantDashboardPage.vue` con datos reales.
5. Usuarios/Roles/Invitaciones.
6. Padres/tutores y politicas familiares.
7. Reports/Analitica real.
8. Comunicacion.
9. Incidencias.
10. Settings/Configuracion.
11. Import/export.
12. Integraciones externas.

## Criterio final 100%

Admin Tenant esta al 100% cuando:

- Las 7 areas de producto existen y son usables.
- Todas las pantallas principales tienen UI propia.
- No quedan wrappers genericos en modulos importantes.
- No hay modulos visibles sin backend.
- No hay permisos rotos.
- No hay tablas vivas sin responsabilidad.
- ROOT sigue funcionando.
- Login tenant funciona.
- Multi-tenant esta aislado.
- Padres/tutores solo ven alumnos autorizados.
- Periodo activo se aplica automaticamente.
- Matriculas son internas y generan historico.
- Cambios sensibles tienen auditoria.
- Build frontend pasa.
- Smoke backend pasa.
- Se puede recrear la BBDD desde migraciones versionadas.
