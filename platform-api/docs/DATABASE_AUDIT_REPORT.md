# Auditoria BBDD - 2026-04-23

## Resultado

Estado: **OK**

Comando ejecutado:

```bash
npm.cmd run audit:db
```

Script:

```txt
platform-api/scripts/audit-db-professional.js
```

Base revisada:

- DB: `edugami_v2`
- Host: `127.0.0.1`
- Tablas esperadas: 24
- Errores: 0
- Warnings: 0
- Info: 0

## Resumen de datos

### Catalogo y permisos

- `modules`: 29
  - `ROOT`: 10
  - `SUPPORT`: 7
  - `TENANT`: 12
- `module_scopes`: 3
- `permissions`: 37
  - `ROOT`: 15
  - `TENANT`: 22

Nota:

- No hay permisos `SUPPORT` especificos ahora mismo. El rol `support-ops` puede existir, pero sus permisos actuales vienen del catalogo disponible. Si SUPPORT necesita permisos propios diferenciados, hay que sembrarlos.

### Tenants

- `tenants`: 2
- `tenant_modules`: 18
- `tenant_roles`: 3
- `tenant_role_modules`: 21
- `tenant_role_permissions`: 32
- `tenant_users`: 0
- `tenant_refresh_tokens`: 0
- `user_tenant_roles`: 0

Interpretacion:

- Que `tenant_users`, `tenant_refresh_tokens` y `user_tenant_roles` esten vacias es normal ahora mismo si aun no se han creado usuarios tenant reales.
- Ya existen roles tenant base: `TENANT_ADMIN`, `TEACHER`, `STUDENT`.

### Plataforma ROOT/SUPPORT

- `platform_accounts`: 1
- `platform_roles`: 2
  - `root-super-admin`
  - `support-ops`
- `platform_role_permissions`: 24
- `platform_role_assignments`: 1
- `platform_account_permissions`: 0
- `platform_refresh_tokens`: 12
- `platform_password_reset_tokens`: 3
- `platform_login_attempts`: 16

Interpretacion:

- `platform_account_permissions` vacia es correcto si no se usan permisos directos y se gobierna por rol.
- Conviene limpiar tokens antiguos en produccion con politica de expiracion/rotacion.

### Alertas y servicios

- `platform_alert_events`: 0
- `platform_alert_deliveries`: 0
- `platform_audit_events`: 0
- `platform_services`: 5
  - `up`: 4
  - `degraded`: 1
- `platform_service_actions`: 32

Interpretacion:

- Alertas vacias es correcto si no hay incidencias.
- Auditoria vacia es correcto justo despues de crear la tabla; se llenara con cambios criticos de RBAC/modulos.
- Hay un servicio degradado registrado; no es fallo de integridad, pero hay que revisarlo en la pantalla de servicios o cuando el ops-agent sea real.

## Checks de integridad

Todos estos checks devolvieron `0`:

- `duplicatePlatformModulesTable`
- `duplicatePlatformPermissionsTable`
- `invalidTenantModuleScopes`
- `permissionScopeMismatch`
- `permissionsWithoutModule`
- `modulesWithMissingParent`
- `tenantRoleModulesWithoutRole`
- `tenantRolePermissionsWithoutRole`
- `userTenantRolesWithoutUser`
- `platformRolePermissionsWithoutRole`
- `platformRolePermissionsWithoutPermission`
- `platformAssignmentsWithoutAccount`
- `platformAssignmentsWithoutRole`
- `alertDeliveriesWithoutAlert`
- `serviceActionsWithoutService`

Duplicados revisados y correctos:

- Modulos duplicados: 0
- Permisos duplicados: 0
- Roles tenant duplicados: 0
- Roles plataforma duplicados: 0
- Emails plataforma duplicados: 0

## Constraints e indices clave

Confirmado:

- `modules.scope -> module_scopes(scope_code)`
- `permissions(module_key, scope) -> modules(module_key, scope)`
- `tenant_modules.module_key -> modules(module_key)`
- `tenant_role_modules.module_key -> modules(module_key)`
- `tenant_role_permissions.permission_code -> permissions(permission_code)`
- `user_tenant_roles -> tenant_users`
- `platform_role_permissions.permission_code -> permissions(permission_code)`
- `platform_account_permissions.permission_code -> permissions(permission_code)`

Indices esperados presentes:

- `idx_modules_scope_parent_order`
- `idx_tenant_modules_tenant_enabled`
- `idx_platform_service_actions_service_created`

Trigger presente:

- `trg_enforce_tenant_module_scope` en `tenant_modules`

## Tablas vacias normales

Pueden estar vacias en desarrollo:

- `tenant_users`
- `tenant_refresh_tokens`
- `user_tenant_roles`
- `platform_account_permissions`
- `platform_alert_events`
- `platform_alert_deliveries`
- `platform_audit_events`

## Pendiente recomendado

1. Crear politica de limpieza de tokens:
   - `platform_refresh_tokens`
   - `platform_password_reset_tokens`
   - `tenant_refresh_tokens`
2. Sembrar permisos `SUPPORT` especificos si el rol support debe tener alcance propio.
3. Añadir auditoria visible para cambios criticos:
   - modulos globales,
   - permisos de rol,
   - asignaciones de rol,
   - usuarios tenant.
4. Proteger en backend el ultimo ROOT operativo:
   - no dejarlo sin `rbac.manage`,
   - no dejarlo sin `platform_modules.manage`,
   - no apagar `RBAC` o `GLOBAL_MODULES` sin alternativa.
5. Mantener `npm.cmd run audit:db` como check recurrente despues de migraciones.

## Actualizacion - 2026-04-23

Se ha añadido auditoria de cambios criticos:

- Nueva tabla: `platform_audit_events`.
- Nueva migracion: `platform-api/sql/migrations/009_platform_audit_events.sql`.
- Nuevo comando: `npm.cmd run db:ensure-audit`.
- Nuevos indices:
  - `idx_platform_audit_events_type_created`
  - `idx_platform_audit_events_actor_created`

Auditoria ejecutada despues del cambio:

- Estado: `OK`
- Errores: `0`
- Warnings: `0`
- Tablas esperadas: `24`
