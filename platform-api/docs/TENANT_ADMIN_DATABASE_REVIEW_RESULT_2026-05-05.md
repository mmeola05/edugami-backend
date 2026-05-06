# Resultado Revision BBDD/Admin Tenant - 2026-05-05

Estado: revision real parcial completada contra la BBDD local.

No se han tocado datos, no se han ejecutado migraciones y no se han borrado tablas.

## Veredicto

Decision actual: `NO RESET INMEDIATO SIN RECONCILIACION PREVIA`.

La BBDD local responde y contiene parte de las tablas y modulos nuevos, pero el repositorio no contiene las migraciones que han generado ese estado.

El problema principal no parece ser que falten permisos en la BBDD actual. El problema real es mas grave:

- La BBDD esta por delante del repositorio.
- Hay migraciones aplicadas que no existen como archivos versionados.
- Frontend y backend no implementan todo lo que la BBDD ya registra.
- No se puede recrear el entorno de forma fiable desde cero con lo que hay en el repo.

Reset solo es recomendable si antes se hace backup y se acepta perder/recrear los datos locales. Para dejar el proyecto sano, primero hay que recuperar o reconstruir las migraciones faltantes.

## Hallazgos criticos

### 1. BBDD local accesible

La BBDD `edugami_v2` responde en local.

Se ha comprobado:

- existen tenants,
- existe cuenta root activa,
- existe usuario tenant admin activo,
- existen modulos tenant registrados,
- existen permisos tenant efectivos para el admin probado.

Conclusion:

- El problema actual no es simplemente Docker apagado.
- La BBDD tiene estructura tenant avanzada, pero esa estructura no esta reflejada correctamente en el repo.

### 2. Migraciones aplicadas sin archivo en el repositorio

La tabla `schema_migrations` indica que estan aplicadas migraciones hasta:

- `026_force_sync_modules.sql`

Pero en `platform-api/sql/migrations` solo existen archivos hasta:

- `017_ai_tutor_teacher_only.sql`

Migraciones aplicadas en BBDD que no existen en el repo:

- `018_tenant_invitations.sql`
- `019_tenant_operational_modules.sql`
- `020_tenant_audit_events.sql`
- `021_tenant_metadata.sql`
- `022_tenant_admin_full_modules.sql`
- `023_tenant_core_foundation.sql`
- `024_tenant_family_policies.sql`
- `025_tenant_login_security.sql`
- `026_force_sync_modules.sql`

Impacto:

- Otro entorno no puede reconstruir esta BBDD.
- Un reset ahora dejaria fuera tablas/permisos ya aplicados.
- Cualquier bug sera dificil de reproducir.
- ROOT y Tenant pueden divergir segun la maquina.

Accion obligatoria:

- Recuperar esos SQL desde la rama/historial/herramienta que los genero, o reconstruirlos desde el estado actual de BBDD.
- Versionarlos en `platform-api/sql/migrations`.
- No seguir creando modulos encima hasta cerrar esta brecha.

### 3. La BBDD contiene mas modulos que el frontend/backend real

La BBDD registra 24 modulos tenant, entre ellos:

- `ATTENDANCE`
- `AUDIT_LOGS`
- `COMMUNICATIONS`
- `GUARDIANS`
- `IMPORT`
- `INCIDENTS`
- `INVITATIONS`
- `SETTINGS`

Tambien se ha comprobado que el tenant admin probado tiene acceso efectivo a muchos de ellos.

Pero el frontend actual solo enlaza/renderiza una parte:

- Dashboard
- Periodos
- Clases
- Alumnos
- Matriculas
- Asignaturas
- Profesores
- Asignaciones docentes
- Usuarios admin
- Reports
- Tutor IA

No hay rutas/pantallas reales para varios modulos registrados en BBDD:

- Asistencia
- Incidencias
- Comunicados
- Invitaciones
- Auditoria tenant
- Importacion/exportacion
- Settings/configuracion
- Padres/tutores como pagina propia completa

Conclusion:

- Si "no salen los modulos nuevos", la causa principal esta en frontend/rutas/sidebar y no en permisos.
- La BBDD dice que existen, pero la UI no los muestra ni los implementa.

### 4. Backend incompleto respecto a las tablas nuevas

`platform-api/src/routes/tenant.routes.js` expone endpoints para:

- overview,
- usuarios/roles tenant,
- periodos,
- clases,
- asignaturas,
- alumnos,
- tutores vinculados a alumno,
- matriculas,
- profesores,
- asignaciones docentes,
- guardians basico.

Pero no hay endpoints actuales completos para:

- invitaciones,
- asistencia,
- incidencias,
- comunicados,
- auditoria tenant,
- importacion/exportacion,
- settings/configuracion avanzada.

Tampoco aparecen en esta copia controladores/servicios como:

- `tenantInvitations`
- `tenantOperational`
- `tenantAudit`
- `tenantBulk`
- `tenantSettings`

Conclusion:

- La infraestructura prometida no esta realmente presente en el repo actual.
- Hay tablas/modulos que no tienen API funcional suficiente.

### 5. Muchas paginas tenant siguen siendo wrappers genericos

Varias paginas de `edugami-frontend/src/pages/tenant` son wrappers pequenos sobre `TenantResourcePage.vue`.

Ejemplos:

- `TenantCoursesPage.vue`
- `TenantEnrollmentsPage.vue`
- `TenantStudentsPage.vue`
- `TenantTeacherAssignmentsPage.vue`
- `TenantTeachersPage.vue`
- `TenantReportsPage.vue`
- `TenantAiTutorPage.vue`

Esto incumple el criterio de cierre definido:

- cada modulo importante debe tener UI propia,
- no basta con wrappers genericos,
- las pantallas deben responder a casos reales del centro.

### 6. El scope de producto debe ser 7 modulos, no 24 entradas crudas

La BBDD puede tener modulos tecnicos o permisos internos, pero el producto Admin Tenant debe mostrarse al usuario como:

- Dashboard
- Academico
- Personas
- Accesos
- Comunicacion
- Seguimiento
- Configuracion

Riesgo actual:

- confundir modulos internos con navegacion final,
- mostrar demasiadas piezas sueltas,
- crear pantallas incompletas solo porque existe una tabla o permiso.

Accion:

- Mantener catalogo interno si hace falta.
- Rehacer navegacion y permisos visibles desde los 7 bloques finales.
- Las subpantallas deben colgar de esos bloques de producto.

## Comprobaciones tecnicas realizadas

Resultado:

- Import de rutas backend: correcto.
- Import de rutas tenant: correcto.
- Build frontend: correcto.
- Permisos exigidos por rutas tenant actuales: existen en BBDD.
- Admin tenant probado: tiene modulos/permisos efectivos.
- Migraciones aplicadas vs archivos: inconsistente.

Esto significa:

- el proyecto compila,
- no todo esta roto,
- pero el estado no es reproducible ni funcionalmente completo.

## Decision recomendada

Recomendacion principal: `RECONCILIACION ANTES DE RESET`.

Orden correcto:

1. Congelar nuevas features tenant.
2. Hacer backup/export de BBDD local.
3. Recuperar o reconstruir migraciones `018` a `026`.
4. Versionar esas migraciones en `platform-api/sql/migrations`.
5. Crear un check que compare `schema_migrations` contra archivos existentes.
6. Decidir si se hace:
   - limpieza controlada sobre BBDD actual, o
   - reset limpio desde migraciones ya corregidas.
7. Alinear backend/frontend con el scope final de 7 modulos.

Reset ahora mismo sin recuperar migraciones puede ocultar el problema, no arreglarlo.

## Plan para dejarlo sano

### Fase 1: recuperar trazabilidad de BBDD

- Recuperar SQL faltantes de Antigravity, git, otra rama o copia local.
- Si no existen, generar una migracion de reconciliacion desde el esquema actual.
- Documentar que tablas son oficiales y cuales quedan marcadas para eliminar.

### Fase 2: cerrar contrato backend

Crear o completar endpoints para:

- invitaciones,
- comunicados,
- notificaciones,
- incidencias,
- auditoria tenant,
- settings,
- importacion/exportacion,
- familias/tutores con permisos por alumno.

Cada endpoint debe tener:

- permiso real,
- validacion Joi,
- aislamiento por `tenant_id`,
- auditoria si toca datos sensibles.

### Fase 3: cerrar contrato frontend

Rehacer la navegacion Admin Tenant sobre los 7 bloques:

- Dashboard
- Academico
- Personas
- Accesos
- Comunicacion
- Seguimiento
- Configuracion

Y dentro:

- usar paginas propias para cada flujo importante,
- reducir wrappers genericos,
- usar drawers/paneles en vez de dialogs para editar,
- mantener estilo claro educativo/premium,
- no copiar ROOT.

### Fase 4: prueba de cierre

Validar en local:

- login unico,
- entrada como root,
- entrada como tenant admin,
- cambio de contexto si aplica,
- CRUD academico basico,
- invitacion y activacion de usuario,
- comunicacion/incidencia/auditoria,
- permisos y 403 correctos,
- aislamiento entre tenants.

## Estado final de esta revision

No se puede declarar Admin Tenant al 100%.

Estado real:

- BBDD: avanzada pero no trazable desde repo.
- Backend: compila, pero faltan modulos operativos.
- Frontend: compila, pero faltan rutas/pantallas finales.
- Permisos actuales: mejor de lo esperado para rutas existentes.
- Riesgo principal: migraciones perdidas y producto desalineado.

## Actualizacion operativa 2026-05-05

Se ha creado backup JSON local antes de tocar BBDD mediante:

- `platform-api/scripts/backup-json.js`

Se ha aplicado una migracion nueva versionada:

- `platform-api/sql/migrations/027_tenant_academic_active_period_actions.sql`

Resultado comprobado con:

- `platform-api/scripts/check-tenant-academic-v2.js`

Comprobaciones correctas:

- migracion `027` registrada en `schema_migrations`,
- un periodo activo por tenant,
- tabla `tenant_academic_history_events` creada,
- permisos nuevos creados:
  - `academic_history.read`,
  - `students.move`,
  - `students.assign_subjects`,
  - `teacher_assignments.assign`.

Esto no resuelve la falta historica de migraciones `018` a `026`, pero deja el nuevo corte academico v2 versionado y aplicado.

Siguiente paso recomendado:

- seguir reconciliando migraciones `018` a `026`,
- probar flujos academicos v2 con datos reales,
- adaptar frontend para usar acciones simples sin exponer matriculas como tabla tecnica.
