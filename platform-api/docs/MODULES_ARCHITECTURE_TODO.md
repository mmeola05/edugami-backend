# Arquitectura de modulos, roles y permisos

## Objetivo

Separar bien estos conceptos:

- **Modulo**: zona funcional de la app. Ejemplo: `COURSES`, `AI_TUTOR`, `ANALYTICS`.
- **Modulo padre**: agrupa hijos. Ejemplo: `ANALYTICS` contiene `REPORTS`.
- **Activacion global**: ROOT puede apagar un modulo para todos los tenants.
- **Activacion por tenant**: ROOT puede apagar un modulo solo para un tenant.
- **Visibilidad por rol**: cada rol ve solo los modulos que le corresponden.
- **Permiso por accion**: dentro de un modulo visible, cada accion necesita permiso.

## Problema actual

Ahora `tenant_modules` contiene claves que son de ROOT:

```js
"DASHBOARD_ROOT",
"PLATFORM_ACCOUNTS",
"RBAC",
"TENANTS",
"ALERTS",
"SERVICE_CONTROL"
```

Eso no deberia estar en tenants. Son herramientas internas de plataforma, no funcionalidades educativas del cliente.

## Regla De Acceso

Un usuario puede ejecutar una accion solo si se cumple todo:

```txt
modulo activo globalmente
+ padres activos globalmente
+ modulo activo para el tenant
+ padres activos para el tenant
+ modulo visible para su rol
+ permiso concreto de accion
```

Ejemplo:

- Si `ANALYTICS` esta apagado globalmente, nadie usa `REPORTS`.
- Si `ANALYTICS` esta apagado solo para un tenant, ese tenant no ve `REPORTS`.
- Si `ANALYTICS` esta activo pero el usuario no tiene `reports.read`, no puede ver reportes.

## Scopes De Modulos

Usar una tabla unica de catalogo con `scope`.

Scopes:

```js
"ROOT"
"SUPPORT"
"TENANT"
```

Esto evita crear tres sistemas distintos y permite validar que un modulo ROOT no acabe asignado a un tenant.

## Modulos Propuestos

### ROOT

```js
"ROOT_DASHBOARD",
"TENANTS",
"PLATFORM_ACCOUNTS",
"SUPPORT_ACCOUNTS",
"RBAC",
"GLOBAL_MODULES",
"ALERTS",
"SERVICES",
"METRICS",
"REALTIME_STATUS"
```

Agrupacion de sidebar:

- Dashboard
- Tenants
- Administracion: cuentas, roles, permisos, catalogo de modulos
- Operacion: alertas, servicios, metricas, realtime

### SUPPORT

```js
"SUPPORT_DASHBOARD",
"TENANT_LOOKUP",
"TENANT_READONLY",
"ALERTS_READ",
"ALERTS_RESOLVE",
"SERVICE_STATUS_READ",
"TICKETS"
```

Support puede ayudar y revisar, pero no deberia gestionar RBAC global, cuentas ROOT ni acciones peligrosas.

### TENANT

Modulos raiz:

```js
"ACADEMIC",
"AI",
"ANALYTICS"
```

Hijos:

```txt
ACADEMIC
  CLASSES
  STUDENTS
  TEACHERS
  COURSES

AI
  AI_TUTOR

ANALYTICS
  REPORTS
  DASHBOARDS
  EXPORTS
```

Regla importante:

Si se apaga `ANALYTICS`, tambien quedan apagados `REPORTS`, `DASHBOARDS` y `EXPORTS`, aunque esos hijos tengan `is_enabled = true`.

## Roles Tenant

### TENANT_ADMIN

Puede ver casi todo lo contratado:

```js
"ACADEMIC",
"CLASSES",
"STUDENTS",
"TEACHERS",
"COURSES",
"AI",
"AI_TUTOR",
"ANALYTICS",
"REPORTS"
```

### TEACHER

Puede compartir modulos con admin, pero con menos permisos:

```js
"CLASSES",
"STUDENTS",
"COURSES",
"AI_TUTOR",
"ANALYTICS",
"REPORTS"
```

Ejemplo: puede ver reportes de sus clases, no reportes globales del tenant.

### STUDENT

Vista limitada:

```js
"CLASSES",
"COURSES",
"AI_TUTOR",
"ANALYTICS_STUDENT"
```

`ANALYTICS_STUDENT` puede ser una vista propia de progreso, separada de `REPORTS`.

## Permisos Por Accion

Los modulos no sustituyen permisos.

Ejemplo:

```js
module: "COURSES"
permissions: [
  "courses.read",
  "courses.create",
  "courses.update",
  "courses.delete",
  "courses.publish"
]
```

Ejemplo por rol:

- `TENANT_ADMIN`: `courses.read`, `courses.create`, `courses.update`, `courses.delete`
- `TEACHER`: `courses.read`, `courses.update`
- `STUDENT`: `courses.read`

## Modelo De Datos Recomendado

### Nueva tabla `modules`

Catalogo maestro de modulos.

```sql
modules (
  module_key text primary key,
  parent_module_key text null references modules(module_key),
  scope text not null,
  name text not null,
  description text,
  global_enabled boolean not null default true,
  display_order int not null default 0,
  created_at timestamp not null,
  updated_at timestamp not null
)
```

Uso:

- `scope`: `ROOT`, `SUPPORT` o `TENANT`.
- `global_enabled`: apagado global por super admin.
- `parent_module_key`: jerarquia padre-hijo. Ejemplo: `REPORTS` depende de `ANALYTICS`.
- `display_order`: orden de sidebar.

### Mantener `tenant_modules`

Activacion por tenant.

```sql
tenant_modules (
  tenant_id uuid not null,
  module_key text not null references modules(module_key),
  is_enabled boolean not null default true,
  updated_at timestamp not null,
  primary key (tenant_id, module_key)
)
```

Notas:

- Solo debe aceptar modulos `scope = TENANT`.
- No guardar estado efectivo de hijos. Se calcula mirando padres.

Opcional:

```sql
enabled_by uuid null,
disabled_reason text null,
created_at timestamp not null
```

### Nueva tabla `permissions`

Permisos por accion.

```sql
permissions (
  permission_code text primary key,
  module_key text not null references modules(module_key),
  scope text not null,
  action text not null,
  description text
)
```

Ejemplos:

```js
"courses.read"
"courses.create"
"reports.read"
"reports.export"
```

### Nuevas tablas tenant

Roles de tenant:

```sql
tenant_roles (
  role_id uuid primary key,
  tenant_id uuid not null,
  code text not null,
  name text not null,
  is_system boolean not null default false,
  created_at timestamp not null,
  updated_at timestamp not null
)
```

Modulos visibles por rol:

```sql
tenant_role_modules (
  tenant_id uuid not null,
  role_code text not null,
  module_key text not null references modules(module_key),
  is_visible boolean not null default true,
  primary key (tenant_id, role_code, module_key)
)
```

Permisos por rol:

```sql
tenant_role_permissions (
  tenant_id uuid not null,
  role_code text not null,
  permission_code text not null references permissions(permission_code),
  primary key (tenant_id, role_code, permission_code)
)
```

Usuarios asignados a roles:

```sql
user_tenant_roles (
  tenant_id uuid not null,
  user_id uuid not null,
  role_code text not null,
  primary key (tenant_id, user_id, role_code)
)
```

### Tablas actuales a revisar

`platform_modules`

- Retirada en la migracion `006_normalize_modules_and_constraints.sql`.
- La unica fuente de verdad de activacion global es `modules.global_enabled`.

`tenant_modules`

- Mantener.
- Limpiar claves ROOT actuales.
- Validar que solo reciba modulos `TENANT`.

`platform_permissions`

- Retirada en la migracion `008_unify_permissions_catalog.sql`.
- La unica fuente de verdad de permisos es `permissions`.

`platform_roles`, `platform_role_permissions`, `platform_role_assignments`

- Mantener para `ROOT` y `SUPPORT`.
- No mezclarlas con roles de tenant salvo que se generalicen con `scope`.

## Sidebar

RESUELTO 2026-05-01: el sidebar ROOT ya usa secciones desplegables.

Reglas:

- Mostrar una seccion solo si tiene al menos un hijo visible.
- Ocultar hijos si su modulo esta apagado globalmente.
- Ocultar hijos si su modulo esta apagado para el tenant.
- Ocultar hijos si su padre esta apagado.
- Ocultar botones/acciones si falta el permiso concreto.

### Ejemplo ROOT

```js
[
  { label: "Dashboard", to: "/root/dashboard" },
  {
    label: "Tenants",
    children: [
      { label: "Listado", to: "/root/tenants" },
      { label: "Modulos por tenant", to: "/root/tenants/modules" }
    ]
  },
  {
    label: "Administracion",
    children: [
      { label: "Cuentas ROOT", to: "/root/platform-accounts" },
      { label: "Cuentas Support", to: "/root/support-accounts" },
      { label: "Roles y permisos", to: "/root/rbac" },
      { label: "Catalogo de modulos", to: "/root/modules" }
    ]
  },
  {
    label: "Operacion",
    children: [
      { label: "Alertas", to: "/root/alerts" },
      { label: "Servicios", to: "/root/services" },
      { label: "Metricas", to: "/root/metrics" },
      { label: "Tiempo real", to: "/root/realtime" }
    ]
  }
]
```

### Ejemplo Tenant

```js
[
  { label: "Dashboard", to: "/tenant/dashboard" },
  {
    label: "Academico",
    module: "ACADEMIC",
    children: [
      { label: "Clases", module: "CLASSES", to: "/tenant/classes" },
      { label: "Cursos", module: "COURSES", to: "/tenant/courses" },
      { label: "Profesores", module: "TEACHERS", to: "/tenant/teachers" },
      { label: "Estudiantes", module: "STUDENTS", to: "/tenant/students" }
    ]
  },
  {
    label: "IA",
    module: "AI",
    children: [
      { label: "Tutor IA", module: "AI_TUTOR", to: "/tenant/ai-tutor" }
    ]
  },
  {
    label: "Analitica",
    module: "ANALYTICS",
    children: [
      { label: "Reportes", module: "REPORTS", to: "/tenant/reports" }
    ]
  }
]
```

## Cambios A Hacer

### Backend

1. Crear catalogo `modules`.
2. Retirar `platform_modules` y usar solo `modules.global_enabled`.
3. Limpiar `DEFAULT_MODULES` de tenants.
4. Sembrar solo modulos tenant reales.
5. Implementar jerarquia con `parent_module_key`.
6. Implementar resolucion de modulos efectivos.
7. Implementar permisos por accion.
8. Separar roles internos (`ROOT`, `SUPPORT`) de roles tenant (`TENANT_ADMIN`, `TEACHER`, `STUDENT`).
9. Validar que `tenant_modules` solo acepte modulos `TENANT`.

### Frontend

1. Convertir sidebar a secciones desplegables.
2. Generar sidebar desde modulos efectivos y permisos.
3. Ocultar rutas ROOT que aun no tengan pantalla real.
4. Ocultar acciones dentro de pantallas si falta permiso.
5. Crear pantallas para catalogo de modulos y modulos por tenant cuando toque.

### Base De Datos

1. Crear `modules`.
2. Crear o adaptar `permissions`.
3. Crear `tenant_roles`.
4. Crear `tenant_role_modules`.
5. Crear `tenant_role_permissions`.
6. Crear `user_tenant_roles`.
7. Retirar `platform_modules` tras migrar su estado a `modules`.
8. Limpiar `tenant_modules` de claves ROOT.
9. Migrar `REPORTS` como hijo de `ANALYTICS`.

## Orden Recomendado

1. Definir catalogo `modules` con `scope` y `parent_module_key`.
2. Migrar datos actuales.
3. Cambiar seeds de tenants.
4. Resolver modulos efectivos en backend.
5. Resolver permisos efectivos en backend.
6. Adaptar sidebar.
7. Probar apagado global.
8. Probar apagado por tenant.
9. Probar apagado de padre (`ANALYTICS`) y ocultacion de hijos (`REPORTS`).
10. Probar permisos por accion.

## Actualizacion Codex - 2026-04-22

Avance implementado:

- Migracion aplicada en la BBDD local `edugami_v2` y validada con smoke test.
- `schema.sql` ya define `modules`, `permissions`, `tenant_roles`, `tenant_role_modules`, `tenant_role_permissions` y `user_tenant_roles`.
- Existe migracion versionada en `sql/migrations/001_modules_roles_permissions.sql`.
- El catalogo inicial separa `ROOT`, `SUPPORT` y `TENANT`.
- `REPORTS`, `DASHBOARDS`, `EXPORTS` y `ANALYTICS_STUDENT` cuelgan de `ANALYTICS`.
- `tenant_modules` referencia el catalogo en esquema nuevo y la migracion limpia/modifica claves ROOT antiguas.
- El backend valida que `tenant_modules` solo acepte modulos `scope = TENANT`.
- La lectura de modulos por tenant devuelve `global_enabled`, `effective_enabled` y `disabled_reason`.
- Existe endpoint `GET /root/tenants/:tenantId/modules/effective` con arbol padre/hijos.
- La BBDD local tiene trigger para impedir que `tenant_modules` reciba modulos que no sean `scope = TENANT`.
- `TenantDetailPage.vue` consume modulos efectivos y muestra motivo de apagado.
- Sembrados roles tenant base y sus permisos/modulos:
  - `TENANT_ADMIN`
  - `TEACHER`
  - `STUDENT`
- Existen endpoints ROOT de lectura para roles tenant.
- `auth/me` devuelve modulos efectivos de plataforma para ROOT/SUPPORT cuando la migracion esta aplicada.
- El frontend tiene ruta base para `/root/modules` y sidebar corregido.

Pendiente:

- Crear pantallas tenant reales para consumir estos modulos/permisos en la app del cliente.
- Retirado el uso historico de `platform_modules`; queda solo el permiso con nombre `platform_modules.*` como etiqueta de API para catalogo global.

## Actualizacion Codex - 2026-04-22 tarde

Avance implementado:

- Nueva migracion `sql/migrations/005_tenant_users_auth_and_access.sql`.
- Nuevas tablas:
  - `tenant_users`
  - `tenant_refresh_tokens`
- `user_tenant_roles` queda conectado por FK a `tenant_users`.
- Nuevo login tenant:
  - `POST /api/v1/auth/login/tenant`
  - `POST /api/v1/auth/tenant/refresh`
  - `POST /api/v1/auth/tenant/logout`
  - `GET /api/v1/auth/tenant/me`
- Actualizacion 2026-05-01: el login tenant ya no requiere `tenantSlug` en la UX. Acepta email/password, resuelve los contextos tenant autorizados y permite `tenantId`/`tenantSlug` solo como contexto opcional validado.
- `auth/me` de plataforma recalcula permisos desde BBDD en cada llamada.
- `requirePermission` ya no confia solo en permisos antiguos del JWT para plataforma: consulta permisos frescos antes de autorizar.
- Nuevo endpoint ROOT para usuarios tenant:
  - `GET /root/tenants/:tenantId/users`
  - `POST /root/tenants/:tenantId/users`
  - `GET /root/tenants/:tenantId/users/:userId`
  - `PATCH /root/tenants/:tenantId/users/:userId`
  - `PUT /root/tenants/:tenantId/users/:userId/roles`
  - `GET /root/tenants/:tenantId/users/:userId/effective-access`
- Nuevo endpoint ROOT para editar acceso de roles tenant:
  - `PUT /root/tenants/:tenantId/roles/:roleCode/access`
- Los cambios de modulos, roles y asignaciones emiten eventos SSE ROOT:
  - `tenant_access_policy_changed`
  - `tenant_role_access_updated`
  - `tenant_user_roles_updated`
  - `platform_account_rbac_updated`
  - `access_policy_changed`
- `TenantDetailPage.vue` muestra roles tenant, permite editar modulos/permisos del rol y crear usuarios tenant.
- Smoke test actualizado con `root/tenants/:tenantId/users`.
- Seguridad de sesion ajustada:
  - Los JWT nuevos ya no incluyen arrays de permisos/modulos.
  - `GET /auth/me` devuelve identidad minima.
  - `GET /auth/access` y `GET /auth/tenant/access` son los endpoints explicitos para pedir permisos/modulos cuando el cliente necesite recalcular UI.
- Normalizacion BBDD:
  - `module_scopes` normaliza los tipos `ROOT`, `SUPPORT` y `TENANT`.
  - `modules.scope` referencia `module_scopes(scope_code)`.
  - `permissions(module_key, scope)` referencia `modules(module_key, scope)` para impedir permisos con scope incoherente.
  - `tenant_role_modules`, `tenant_role_permissions` y `user_tenant_roles` referencian `tenant_roles(tenant_id, code)`.
  - `platform_modules` ya no existe en la BBDD local ni en `schema.sql`.
  - `platform_permissions` ya no existe; `platform_role_permissions` y `platform_account_permissions` guardan `permission_code` contra `permissions`.

Decision tecnica sobre tiempo real:

- Ahora: SSE para panel ROOT porque ya existe y es suficiente para refrescar vistas administrativas.
- Para expulsar usuarios tenant en vivo cuando cambie rol/modulo: mejor WebSocket/SSE por sesion de navegador. MQTT lo dejaria para dispositivos/backend/eventos IoT, no como canal principal de autorizacion UI.
- Aunque no llegue el evento realtime, `auth/access` y `auth/tenant/access` recalculan permisos y modulos desde BBDD, asi que el cliente puede comparar y recargar sin recibir datos sensibles por el evento.

## Actualizacion UI de catalogo y RBAC - 2026-04-23

Hecho:

- `ModulesPage.vue` ya representa el catalogo unico `modules` como arbol por scope.
- La vista muestra padre/hijos y diferencia estado propio de estado efectivo.
- Si un padre esta apagado, sus hijos aparecen como bloqueados por `padre apagado`.
- Añadido buscador para encontrar modulos por clave, nombre, descripcion o padre.
- Se mantienen acciones de activacion solo para usuarios con `platform_modules.manage`.
- `RbacPage.vue` agrupa permisos por `module_key` y permite filtrar por scope `ROOT` o `SUPPORT`.
- Se puede seleccionar o limpiar todos los permisos de un modulo desde el grupo visual.
- Los roles protegidos se marcan con aviso para evitar cambios accidentales.

Pendiente:

- Backend debe proteger cambios peligrosos de catalogo:
  - no apagar `GLOBAL_MODULES` o `RBAC` si deja sin administracion a ROOT,
  - no quitar permisos criticos al ultimo ROOT efectivo,
  - registrar auditoria con actor, accion y motivo.
- El frontend debe pedir confirmacion explicita al apagar modulos criticos.
- Falta extender el mismo patron visual a roles tenant cuando existan pantallas tenant completas.

## Auditoria BBDD de modulos y permisos - 2026-04-23

Hecho:

- Añadido `npm run audit:db` para comprobar integridad real de BBDD.
- Auditoria local ejecutada contra `edugami_v2`.
- Confirmado:
  - `modules` es el catalogo unico.
  - `platform_modules` no existe.
  - `permissions` es el catalogo unico de permisos.
  - `platform_permissions` no existe.
  - `tenant_modules` solo contiene modulos `scope = TENANT`.
  - No hay permisos con scope distinto al scope de su modulo.
  - No hay modulos hijos con padre inexistente.
  - No hay duplicados de `module_key` ni `permission_code`.
  - Existen indices clave para scopes, tenant modules y acciones de servicio.
  - Existe trigger para impedir modulos no TENANT en `tenant_modules`.

Resultado:

- `modules`: 29
  - `ROOT`: 10
  - `SUPPORT`: 7
  - `TENANT`: 12
- `permissions`: 37
  - `ROOT`: 15
  - `TENANT`: 22
- `tenant_modules`: 18, todos TENANT.

Observacion:

- Ahora mismo no hay permisos `SUPPORT` especificos en `permissions`. Si soporte debe tener permisos propios distintos de ROOT, hay que sembrar permisos `SUPPORT` asociados a modulos `SUPPORT`.

## Protecciones criticas - 2026-04-23

Hecho:

- Backend bloquea apagar modulos ROOT criticos:
  - `ROOT_DASHBOARD`
  - `RBAC`
  - `GLOBAL_MODULES`
- Backend protege al ultimo ROOT operativo:
  - no permite cambios que dejen sin permisos criticos de dashboard, RBAC o catalogo de modulos.
- Cambios criticos quedan registrados en `platform_audit_events`.
- Endpoint de lectura preparado:
  - `GET /api/v1/root/audit`

Verificado:

- Intentar apagar `RBAC` desde servicio devuelve `CRITICAL_MODULE_DISABLE_BLOCKED`.
- Smoke ROOT API correcto incluyendo `root/audit`.

Pendiente:

- RESUELTO 2026-04-23: ya existe UI ROOT para consultar auditoria.
- RESUELTO 2026-05-01: hay confirmacion visual antes de apagar modulos criticos, modificar RBAC sensible y reiniciar servicios.
- RESUELTO 2026-05-01: auditoria tiene filtros por tipo, actor, busqueda y rango de fechas, con comparacion JSON visual.
- Motivo obligatorio para cambios de alto impacto.

## Actualizacion UI auditoria - 2026-04-23

Hecho:

- Ya existe vista ROOT para consultar `platform_audit_events`.
- Ruta frontend:
  - `/root/audit`
- La vista se protege usando modulo efectivo `RBAC`.
- La opcion aparece en sidebar como `Auditoria`.

Decision actual:

- No se crea modulo `AUDIT` todavia para no inflar el catalogo.
- Auditoria queda agrupada bajo `RBAC` porque esta relacionada con seguridad administrativa.

Pendiente:

- Si auditoria crece como modulo independiente, crear `AUDIT` en `modules`, permiso `audit.read` y mover la ruta a ese modulo.

## Actualizacion Codex - 2026-04-27

Esta decision ya no aplica.

Estado actual confirmado:

- `AUDIT` existe ya como modulo ROOT real.
- Existen permisos:
  - `audit.read`
  - `audit.manage`
- La ruta `/root/audit` ya cuelga de ese modulo en frontend.
- Backend ya protege la lectura con `requirePermission('audit.read')`.

Nueva decision vigente:

- Mantener `AUDIT` como modulo propio.
- No volver a agrupar auditoria dentro de `RBAC`.
- Tratar auditoria como capacidad operativa de plataforma, no como simple subvista administrativa.
