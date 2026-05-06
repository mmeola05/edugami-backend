# Resultado Limpieza BBDD Tenant - 2026-05-05

Estado: limpieza controlada aplicada.

## Backup e inventario

Antes de borrar nada se genero backup JSON:

- `platform-api/tmp/db-backup-2026-05-05T21-20-53-293Z.json`

Tambien se genero inventario completo de estructura, datos, modulos y permisos:

- `platform-api/tmp/db-inventory-2026-05-05T21-21-30-698Z.json`

## Migraciones aplicadas

Se han aplicado estas migraciones versionadas:

- `028_cleanup_tenant_unimplemented_modules.sql`
- `029_restore_academic_history_permission.sql`
- `030_ai_tutor_teacher_only_cleanup.sql`

## Tablas eliminadas

Se eliminaron tablas tenant experimentales que estaban vacias y no tenian backend/frontend real en el repo actual:

- `tenant_attendance`
- `tenant_audit_events`
- `tenant_communications`
- `tenant_incidents`
- `tenant_invitations`
- `tenant_login_attempts`
- `tenant_password_reset_tokens`

No se tocaron tablas ROOT.

## Modulos tenant eliminados del catalogo actual

Se eliminaron modulos tenant que estaban registrados pero no forman parte implementada del Admin Tenant actual:

- `PROFILE`
- `ACADEMIC`
- `GUARDIANS`
- `INVITATIONS`
- `AUDIT_LOGS`
- `ACTIVITIES`
- `ATTENDANCE`
- `SETTINGS`
- `INCIDENTS`
- `COMMUNICATIONS`
- `IMPORT`
- `AI`
- `ANALYTICS`
- `DASHBOARDS`
- `EXPORTS`
- `ANALYTICS_STUDENT`

Tambien se eliminaron sus permisos tenant asociados y las relaciones en:

- `tenant_modules`
- `tenant_role_modules`
- `tenant_role_permissions`
- `module_scope_availability`
- `permissions`
- `modules`

## Modulos tenant conservados

Catalogo tenant actual tras la limpieza:

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

Nota:

- `ENROLLMENTS` se conserva como modulo tecnico interno para endpoints e historico, pero queda oculto en `tenant_role_modules`.
- Las matriculas no deben aparecer como concepto principal en la UI.
- `AI_TUTOR` queda solo para rol `TEACHER`.

## Permisos restaurados/corregidos

`academic_history.read` se restauro y se movio a `ENROLLMENTS` como permiso interno de historico.

`AI_TUTOR` quedo limitado a:

- rol `TEACHER`,
- permisos `ai_tutor.read` y `ai_tutor.use`.

## Verificacion posterior

Comprobado:

- no quedan modulos tenant no soportados en catalogo,
- no quedan tablas experimentales tenant,
- no faltan permisos exigidos por `tenant.routes.js`,
- `AI_TUTOR` ya no esta asignado a `TENANT_ADMIN`, `STUDENT` ni `GUARDIAN`,
- imports backend correctos,
- build frontend correcto tras la limpieza.

## Pendiente

La limpieza no resuelve aun la deuda historica de migraciones `018` a `026` que figuran aplicadas en BBDD pero no existen en el repo.

Siguiente paso recomendado:

1. Reconciliar o reconstruir migraciones `018` a `026`.
2. Seguir creando solo migraciones versionadas.
3. Continuar Admin Tenant con:
   - `TenantTeacherAssignmentsPage.vue`,
   - `TenantTeachersPage.vue`,
   - dashboard tenant real.
