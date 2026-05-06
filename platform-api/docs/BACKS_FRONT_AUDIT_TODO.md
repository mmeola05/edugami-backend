# Auditoria de platform-api, ops-agent y frontend

## Objetivo

Revisar lo que ya existe en los dos backends y en el frontend para saber:

- Que esta creado.
- Que falta para que lo actual este completo.
- Que hay que adaptar para el nuevo sistema de modulos, roles y permisos.

## Resumen corto

Estado actual:

- `platform-api`: tiene una base amplia para ROOT y ya soporta catalogo `modules`, permisos por modulo, roles tenant, usuarios tenant y login tenant inicial.
- `ops-agent`: existe, pero ahora mismo funciona como stub; acepta reinicios, pero no controla servicios reales.
- `edugami-frontend`: tiene login, layout, dashboard visual y tenants, pero faltan muchas pantallas que el sidebar ya muestra y no consume todos los endpoints reales.

Bloqueo tecnico detectado:

- Resuelto en la practica local: `npm.cmd run build` compila correctamente el frontend.

## 1. platform-api

### Ya existe

Autenticacion:

- Login ROOT: `POST /api/v1/auth/login/root`
- Refresh token
- Logout
- Password recovery
- `GET /api/v1/auth/me`
- Rate limit de login en memoria
- Bloqueo por intentos fallidos usando BBDD
- JWT con permisos incluidos

ROOT:

- Dashboard
- Platform accounts
- RBAC interno
- Tenants
- Tenant modules
- Platform modules
- Alerts
- Services
- Metrics
- Realtime SSE

Servicios internos:

- Email
- Telegram
- WhatsApp
- Templates de email
- Realtime ROOT con SSE
- Ops-agent integration para reinicio de servicios

### Falta para que este al 100% lo actual

Base de datos:

- Faltan migraciones versionadas.
- Faltan seeds claros de tablas base.
- No hay script visible para crear estructura inicial.
- No hay seed de permisos ROOT/SUPPORT completo.
- No hay seed de servicios en `platform_services`.
- No hay seed de modulos correcto.

Configuracion:

- `app.js` devuelve version `14.0.0` en `/health`, pero `package.json` y server hablan de `16.0.0`.
- Swagger dice version `13.0.0`; esta desactualizado.
- No se ven anotaciones OpenAPI reales en rutas.
- `OPS_AGENT_SHARED_TOKEN` tiene default `change-me`; deberia obligarse en produccion.
- CORS esta abierto a todo.
- Falta estrategia por entorno: dev, staging, prod.

Auth:

- El login tenant ya existe; falta crear pantallas tenant reales.
- `auth/me` devuelve permisos y modulos efectivos para plataforma.
- Los tokens guardan permisos dentro del JWT, pero `auth/me`, `refresh` y `requirePermission` recalculan permisos desde BBDD para plataforma.
- Rate limit en memoria no escala si hay varios procesos.
- Falta rotacion de refresh tokens.
- Falta auditoria de sesiones/login mas completa.

RBAC:

- Existe RBAC interno para plataforma.
- Falta separar claramente `ROOT` y `SUPPORT`.
- RBAC tenant base existe: `TENANT_ADMIN`, `TEACHER`, `STUDENT`.
- Falta asociar permisos a modulos.
- Falta permiso por accion dentro de cada modulo.
- Existe endpoint para permisos/modulos efectivos por usuario tenant.

Tenants:

- CRUD basico existe.
- Filtros basicos existen.
- `DEFAULT_MODULES` actual usa modulos ROOT dentro de tenants; hay que corregirlo.
- Falta validacion de slug unico.
- Falta activar tenant desde endpoint dedicado; ahora se cambia con `PATCH`.
- Falta actividad/auditoria real por tenant.
- `timezone` se usa en frontend, pero no se devuelve desde backend en `tenants.service.js`.

Modulos:

- La tabla duplicada `platform_modules` fue retirada; el catalogo unico es `modules`.
- Falta `parent_module_key`.
- Falta apagado global robusto.
- Falta apagado por tenant validado contra catalogo.
- Falta resolver modulos efectivos.
- Falta impedir que un modulo ROOT se asigne a un tenant.
- Falta jerarquia tipo `ANALYTICS -> REPORTS`.

Alerts:

- Crear/listar/resolver/reabrir existe.
- Falta filtros por estado, severidad, tenant y fechas.
- Falta paginacion.
- Falta detalle de alert.
- Falta listar deliveries.
- Falta reintentar delivery.
- Falta politica de notificaciones por tenant/modulo.

Services:

- Listado y reinicio existen.
- Falta sincronizar estado real desde `ops-agent`.
- Falta confirmar resultado final del reinicio.
- Falta historico completo de acciones.
- Falta permisos mas finos: ver estado vs reiniciar.
- Falta bloquear reinicios peligrosos por entorno.

Metrics:

- Overview y charts existen.
- Falta historico real de CPU/RAM/latencia.
- Falta metricas por servicio.
- Falta metricas por tenant.
- Falta normalizar formato para frontend.

Realtime:

- SSE ROOT existe.
- Falta keepalive/ping periodico independiente de metricas.
- Falta cerrar conexiones con errores controlados.
- Falta reconexion con backoff desde frontend.
- Ya hay eventos para cambios de modulos/roles/accesos principales; falta canal tenant por sesion para echar usuarios en vivo de modulos.
- Falta WebSocket futuro para usuario/sesion/clase si se va a necesitar.

Calidad:

- No hay tests.
- No hay lint/format configurado.
- No hay validacion de env por entorno.
- No hay migraciones.
- No hay documentacion de endpoints actualizada.
- Varios textos tienen encoding roto (`MÃ³dulos`, `invÃ¡lido`, etc.).

### Cambios necesarios por el nuevo sistema de modulos

1. Crear tabla `modules`.
2. Migrar `platform_modules` a `modules` y retirar la tabla duplicada.
3. Anadir `scope`, `parent_module_key`, `global_enabled`, `display_order`.
4. Mantener `tenant_modules` solo para activacion por tenant.
5. Crear `permissions` asociada a `module_key` y `action`.
6. Crear tablas tenant: `tenant_roles`, `tenant_role_modules`, `tenant_role_permissions`, `user_tenant_roles`.
7. Implementar resolucion de modulos efectivos.
8. Implementar resolucion de permisos efectivos.
9. Devolver en `auth/me` usuario, rol, permisos efectivos y modulos efectivos.
10. Adaptar middleware para permisos por accion.
11. Validar que padres apagados apaguen hijos.

## 2. ops-agent

### Ya existe

Endpoints:

- `GET /health`
- `GET /services`
- `POST /services/:serviceKey/restart`
- `POST /telegram/command`

Seguridad:

- Usa header `x-ops-shared-token`.

Lista fija de servicios:

```js
"platform-api",
"ops-agent",
"postgres",
"mqtt",
"frontend"
```

### Falta para que este al 100% lo actual

Funcion real:

- Ahora no reinicia servicios reales.
- No lee estado real de procesos.
- No diferencia servicios controlables de servicios solo observables.
- No tiene adaptadores para Windows services, PM2, Docker, systemd o scripts.
- No registra acciones.
- No devuelve estado final del reinicio.

Seguridad:

- `OPS_AGENT_SHARED_TOKEN` puede quedarse como `change-me`.
- No hay allowlist configurable por entorno.
- No hay rate limit.
- No hay auditoria de origen.
- No hay firma ni expiracion de comandos.

Configuracion:

- La lista de servicios esta hardcodeada.
- Falta fichero/env para definir servicios:
  - key
  - nombre
  - tipo
  - metodo de control
  - comando permitido
  - restartable
  - timeout

Integracion con `platform-api`:

- `platform-api` registra accion como accepted, pero no verifica resultado.
- Falta endpoint de status detallado para que `platform-api` actualice `platform_services`.
- Falta webhook/callback o polling.

Telegram:

- Endpoint existe, pero no hay integracion real con bot.
- Comando solo entiende `reinicia X`.
- Falta permisos por usuario/chat.
- Falta confirmacion y auditoria.

Calidad:

- No hay tests.
- No hay validacion de env.
- No hay logs estructurados.
- No hay documentacion de contrato con `platform-api`.

### Cambios necesarios

1. Crear configuracion de servicios controlables.
2. Implementar providers de control segun entorno.
3. Implementar status real por servicio.
4. Implementar restart real con timeout y resultado.
5. Registrar auditoria de comandos.
6. Endurecer token compartido.
7. Devolver errores normalizados compatibles con `platform-api`.
8. Crear documentacion de contrato `platform-api <-> ops-agent`.

## 3. edugami-frontend

### Ya existe

Auth:

- Login ROOT.
- Recovery password.
- Reset password.
- Store de usuario.
- Route guard basico.
- Preview login en dev.

Layout:

- `MainLayout`
- `AuthLayout`
- Header
- Sidebar
- User menu
- Theme toggle
- Language switcher

Pantallas:

- Dashboard visual ROOT en `IndexPage.vue`.
- Tenants list.
- Tenant detail.
- Login/recovery/reset.
- 404.

API clients:

- Auth
- Dashboard
- Tenants
- Tenant modules
- Alerts
- Metrics
- Services
- Platform module update

Realtime:

- Cliente SSE en `utils/realtime.js`.
- Boot `sse.js` existe, pero no esta activado en Quasar.
- MQTT manager existe, pero boot MQTT tampoco esta activado.

### Falta para que este al 100% lo actual

Build/config:

- Build bloqueado por Node `22.11.0`; Quasar pide `22.22.0+`.
- `src/boot/sse.js` importa `getAccessToken`, pero `authUtil.js` exporta `getToken`.
- RESUELTO 2026-05-01: `src/pages/root/DashboardPage.vue` fue eliminado porque la ruta real usa `IndexPage.vue`.
- `delete.js` usa `api` y `notificationUtil`, pero no estan importados/creados correctamente.

Auth:

- `authUtil.js` guarda tokens con `localStorage`.
- `axiosConfig.js` lee tokens desde `Quasar LocalStorage`.
- Esa diferencia puede hacer que Authorization no se envie.
- No hay refresh automatico si expira access token.
- No hay guards por permiso.
- No hay guards por modulo.
- `isAdmin` solo mira `role === 'ROOT'`.

Rutas:

- Solo existen:
  - `/root/dashboard`
  - `/root/tenants`
  - `/root/tenants/:tenantId`
- El sidebar enlaza a rutas que no existen:
  - `/root/accounts`
  - `/root/alerts`
  - `/root/services`
  - `/root/metrics`
  - `/root/rbac`
- Falta ruta para catalogo de modulos ROOT.
- Falta ruta para SUPPORT.
- Faltan rutas tenant/admin/teacher/student.

Dashboard:

- `IndexPage.vue` usa datos mock.
- No consume `getDashboardOverview`, `getAlerts`, `getMetricsOverview`, `getServices`.
- Resolver alert solo hace `console.log`.
- Realtime status esta fijo en `connected`.
- Uptime esta hardcodeado.

Tenants:

- Lista y create/edit basico existen.
- `timezone` existe en frontend, pero backend no lo persiste/devuelve.
- `Nuevos (24h)` esta hardcodeado en `1`.
- Activar/suspender usa `PATCH`; existe endpoint `suspend`, pero no se usa.
- Falta paginacion server-side si crece.

Tenant detail:

- Gestiona modulos actuales, pero esos modulos son incorrectos para tenant.
- No entiende jerarquia padre-hijo.
- No entiende `global_enabled`.
- No muestra si un modulo esta apagado por padre.
- No muestra motivo de desactivacion.
- Boton `Editar` no hace nada.
- Activar/suspender usa `PATCH`, no endpoint especifico.
- Actividad de instancia es placeholder.

Pantallas faltantes para endpoints existentes:

- Platform accounts.
- RBAC roles/permisos.
- Alerts center.
- Services control.
- Metrics/charts.
- Realtime status.
- Platform/global modules.
- Support dashboard.
- Tenant roles.
- Tenant role permissions.

Diseño/UX:

- Sidebar debe pasar a secciones desplegables.
- Debe generarse desde modulos efectivos y permisos.
- Debe ocultar secciones vacias.
- Debe ocultar acciones sin permiso.
- Falta estado loading/error real en varias cards.
- Falta normalizar textos con i18n.
- Hay textos con encoding roto.

### Cambios necesarios por el nuevo sistema de modulos

1. Crear store de auth con:
   - usuario
   - scope
   - roles
   - permisos efectivos
   - modulos efectivos
2. Unificar almacenamiento de tokens.
3. Anadir guards por permiso y modulo.
4. Crear generador de sidebar por rol/scope.
5. Convertir sidebar a desplegables.
6. Crear rutas por scope:
   - `/root/*`
   - `/support/*`
   - `/tenant/*`
   - `/teacher/*`
   - `/student/*`
7. Crear pantalla de catalogo global de modulos.
8. Crear pantalla de modulos por tenant con jerarquia.
9. Crear pantalla de roles/permisos tenant.
10. Adaptar dashboard para consumir backend real.

## Prioridad Recomendada

### Fase 1: estabilizar lo actual

1. Subir Node a `22.22.0+`.
2. Arreglar token storage frontend.
3. Arreglar imports rotos (`getAccessToken`, `getDashboard`, `delete.js`).
4. Conectar dashboard a APIs reales.
5. Quitar u ocultar sidebar links sin ruta.
6. Corregir `DEFAULT_MODULES` de tenants.
7. Actualizar `/health` y Swagger version.
8. Crear migraciones/seeds iniciales.

### Fase 2: nuevo sistema de modulos

1. Crear `modules`.
2. Crear `permissions`.
3. Retirar `platform_modules` tras migrar su estado.
4. Limpiar `tenant_modules`.
5. Crear jerarquia `ANALYTICS -> REPORTS`.
6. Crear resolucion de modulos efectivos.
7. Crear resolucion de permisos efectivos.
8. Actualizar `auth/me`.
9. Adaptar sidebar.

### Fase 3: completar producto ROOT/SUPPORT

1. Pantalla platform accounts.
2. Pantalla RBAC.
3. Pantalla alerts.
4. Pantalla services.
5. Pantalla metrics.
6. Pantalla global modules.
7. Pantalla support.
8. Ops-agent real.

### Fase 4: tenant real

1. Auth usuarios tenant.
2. Roles tenant.
3. Sidebar tenant/admin/teacher/student.
4. Pantallas tenant reales:
   - academic
   - classes
   - students
   - teachers
   - courses
   - ai tutor
   - analytics/reports

## Actualizacion Codex - 2026-04-22

Hecho en esta pasada:

- Frontend compila correctamente con `npm.cmd run build`.
- Corregido almacenamiento de tokens para usar Quasar `LocalStorage` de forma consistente.
- Corregidos imports rotos: `getAccessToken`, `getDashboard`, `delete.js`.
- Corregido `setTenantModules`: ahora llama a `PUT /root/tenants/:tenantId/modules`.
- Dashboard ROOT conectado a endpoints reales de dashboard, alertas, metricas y servicios.
- Sidebar ya no enlaza a `/root/accounts`; usa `/root/platform-accounts`.
- Creadas rutas ROOT para alertas, servicios, metricas, RBAC, cuentas y catalogo de modulos.
- Creadas pantallas ROOT especificas para modulos, alertas, servicios, metricas, cuentas de plataforma y RBAC.
- Eliminada la pantalla comodin `RootOperationalPage.vue`; las rutas ROOT principales usan pantallas propias.
- `TenantDetailPage.vue` muestra modulos como arbol padre/hijos con estado efectivo y motivo de apagado.
- Sembrados roles tenant por defecto para tenants existentes:
  - `TENANT_ADMIN`
  - `TEACHER`
  - `STUDENT`
- Sembradas visibilidades de modulos y permisos tenant por rol.
- Nuevo endpoint ROOT de lectura: `GET /root/tenants/:tenantId/roles`.
- Nuevo endpoint ROOT de lectura: `GET /root/tenants/:tenantId/roles/:roleCode`.
- Reparados SFC corruptos: `AlertsPreviewCard.vue` y `RecentActivityCard.vue`.
- Actualizado `/health` y Swagger a version `16.0.0`.
- `DEFAULT_MODULES` de tenants ya no usa modulos ROOT; usa modulos tenant.
- Backend devuelve y valida `timezone` para tenants.
- Ananadida migracion versionada `sql/migrations/001_modules_roles_permissions.sql`.
- Ananadido catalogo `modules`, tabla `permissions` y tablas base tenant roles/permisos al `schema.sql`.
- `tenant_modules` queda validado contra modulos `scope = TENANT` desde backend.
- `auth/me`, login y refresh devuelven modulos efectivos de plataforma cuando la migracion esta aplicada.

Verificado:

- Migracion SQL aplicada correctamente en la BBDD local `edugami_v2`.
- Smoke test ROOT API correcto para `auth/me`, dashboard, tenants, modules, metrics, services y alerts.
- `node --check` correcto en archivos backend tocados y `ops-agent`.
- `npm.cmd run test` ejecuta, pero no hay tests reales definidos.
- `npm.cmd run build` del frontend correcto.

Sigue pendiente:

- Aplicar la migracion SQL en otros entornos fuera de la BBDD local si existen.
- Endurecer las pantallas ROOT nuevas con UX avanzada, paginacion server-side y permisos por accion.
- Completar usuarios tenant y modulos/permisos efectivos por usuario tenant cuando exista auth tenant real.
- Implementar auth y RBAC tenant real.
- Implementar ops-agent real; sigue siendo stub de control.
- Anadir tests backend/frontend.
- Limpiar textos con encoding roto en todo el proyecto.

## Estado Funcional ROOT - 2026-04-22

## Actualizacion UI ROOT - 2026-04-22

Hecho:

- Header ROOT:
  - El buscador ya abre resultados navegables a pantallas ROOT reales.
  - La campana ya muestra alertas abiertas del backend y avisos locales del store.
  - Los menus del header tienen estado vacio propio en vez de quedarse sin funcion.
- Sidebar:
  - El contador de alertas ya sale desde `GET /alerts?status=open`.
  - Si no hay alertas abiertas, no muestra badge falso.
- Dashboard ROOT:
  - Quitados datos mock iniciales de alertas, actividad y servicios.
  - Los botones de alertas, metricas, modulos y tenants navegan a rutas reales.
  - Resolver alertas y reiniciar servicios quedan ocultos si faltan permisos.
- Centro de alertas:
  - Estado vacio visual cuando no hay datos para el filtro.
  - Columna/acciones de resolver o reabrir ocultas sin `alerts.manage`.
- Cuentas de plataforma:
  - Crear/editar cuentas oculto sin `platform_accounts.manage`.
  - Estado vacio visual.
  - Añadido bloque de control de accesos con resumen ROOT/SUPPORT/suspendidas.

Verificado:

- `npm.cmd run build` correcto tras estos cambios.

## Actualizacion UI Operativa - 2026-04-22

Hecho:

- Metricas:
  - Añadido bloque de salud operativa con score calculado desde RAM, DB ping, alertas abiertas y servicios degradados.
  - Añadidas barras reales de memoria y latencia DB.
  - Añadido listado de servicios registrados desde `metrics.overview`.
  - Los charts muestran estado vacio propio cuando no hay actividad.
  - La lista de observabilidad pendiente diferencia lo que ya esta listo de lo que depende del ops-agent real.
- Servicios:
  - Añadido resumen de despliegue de servidor unico.
  - Añadido estado general operativo/degradado/incidencia.
  - Añadidos indicadores de reiniciable y resultado de ultima accion.
  - Añadido estado vacio si no hay servicios en `platform_services`.
- Menu de usuario:
  - Redisenado para mostrar rol, email, modulos efectivos y permisos efectivos.
  - Accesos rapidos reales a RBAC y catalogo de modulos si el usuario tiene esos modulos.
  - Logout con descripcion clara.

Verificado:

- `npm.cmd run build` correcto tras esta segunda pasada.

## Actualizacion UI RBAC y Modulos - 2026-04-23

Hecho:

- Catalogo de modulos:
  - Rehecha la pantalla para explicar la regla de apagado efectivo padre/hijo.
  - Añadido buscador por clave, nombre, descripcion y padre.
  - Añadidos contadores por scope: raices, total visible y apagados efectivos.
  - Los hijos muestran claramente si estan apagados por su propio estado o por padre apagado.
  - Eliminado texto con encoding roto en la vista.
  - Se mantiene control por permiso `platform_modules.manage`; sin permiso queda en solo lectura.
- Roles y permisos:
  - Rehecha la pantalla para agrupar permisos por modulo.
  - Añadido filtro por scope `ROOT`/`SUPPORT`.
  - Añadido buscador por permiso, descripcion y modulo.
  - Añadido resumen del rol seleccionado: permisos seleccionados, disponibles y estado.
  - Añadida advertencia visual para roles protegidos.
  - Añadidas acciones por grupo para seleccionar todos o ninguno de los permisos de un modulo.
  - Estados vacios para roles y permisos filtrados.
  - Se mantiene control por permiso `rbac.manage`; sin permiso queda en lectura.

Verificado:

- `npm.cmd run build` correcto tras los cambios.

Pendiente:

- Confirmacion modal antes de apagar modulos criticos ROOT como `RBAC`, `GLOBAL_MODULES` o `ROOT_DASHBOARD`.
- Impedir desde backend cambios peligrosos que puedan dejar sin acceso al ultimo ROOT operativo.
- Auditoria visible de cambios RBAC/modulos: quien cambio que, cuando y motivo.
- Tests automaticos de guard de rutas cuando un modulo se apaga en vivo.

Siguiente recomendado:

- Auditoria BBDD profesional: tablas vivas, tablas vacias esperadas, constraints/FK, seeds, datos muertos y scripts para comprobarlo siempre.

## Auditoria BBDD Profesional - 2026-04-23

Hecho:

- Añadido script `platform-api/scripts/audit-db-professional.js`.
- Añadido comando `npm run audit:db` en `platform-api/package.json`.
- El script revisa:
  - tablas esperadas,
  - tablas legacy que no deben existir,
  - tablas vacias normales vs sospechosas,
  - constraints/FK principales,
  - indices esperados,
  - triggers,
  - duplicados,
  - modulos huerfanos,
  - permisos sin modulo,
  - mismatch de scope entre `permissions` y `modules`,
  - `tenant_modules` con modulos no TENANT,
  - asignaciones RBAC huerfanas,
  - alert deliveries sin alert,
  - acciones de servicio sin servicio.
- Añadido informe legible en `platform-api/docs/DATABASE_AUDIT_REPORT.md`.

Resultado local:

- Estado: `OK`
- Errores: 0
- Warnings: 0
- Info: 0
- Tablas esperadas: 23
- `platform_modules`: no existe
- `platform_permissions`: no existe
- `modules`: 29 (`ROOT`: 10, `SUPPORT`: 7, `TENANT`: 12)
- `permissions`: 37
- `tenant_modules` con scope no TENANT: 0
- `permissionScopeMismatch`: 0
- Duplicados relevantes: 0

Pendiente:

- Crear politica de limpieza/rotacion de tokens antiguos.
- Sembrar permisos `SUPPORT` especificos si el rol soporte debe tener alcance propio.
- Añadir auditoria visible para cambios criticos de modulos, permisos, roles y usuarios.
- Proteger desde backend el ultimo ROOT operativo para no dejar la plataforma sin administracion.

Siguiente recomendado:

- Endurecimiento backend de cambios criticos RBAC/modulos antes de construir mas pantallas encima.

## Endurecimiento RBAC/Modulos Criticos - 2026-04-23

Hecho:

- Añadida tabla `platform_audit_events` para auditoria de cambios criticos.
- Añadida migracion versionada `platform-api/sql/migrations/009_platform_audit_events.sql`.
- Añadido script `npm run db:ensure-audit` para crear la tabla/indices si faltan.
- Añadido endpoint ROOT:
  - `GET /api/v1/root/audit`
- Añadido servicio de auditoria reutilizable:
  - `platform-api/src/services/audit.service.js`
- `modules.service` ahora bloquea apagar modulos ROOT criticos:
  - `ROOT_DASHBOARD`
  - `RBAC`
  - `GLOBAL_MODULES`
- Cambios de modulos quedan auditados con:
  - actor,
  - tipo de evento,
  - entidad,
  - accion,
  - estado anterior,
  - estado posterior,
  - metadata.
- `rbac.service` ahora protege el acceso ROOT critico:
  - no permite dejar sin permisos criticos al ultimo ROOT operativo.
  - aplica esta regla en cambios de rol, permisos de rol, borrado de rol, revocacion de rol y permisos directos.
- Permisos criticos ROOT protegidos:
  - `dashboard.read`
  - `rbac.read`
  - `rbac.manage`
  - `platform_modules.read`
  - `platform_modules.manage`
- Cambios RBAC quedan auditados:
  - creacion/edicion/borrado de rol,
  - cambios de permisos de rol,
  - asignacion/revocacion de rol a cuenta,
  - permisos directos de cuenta.
- `audit-db-professional.js` ahora incluye `platform_audit_events` e indices esperados de auditoria.

Verificado:

- `node --check` correcto en servicios, controladores, rutas y scripts nuevos/tocados.
- `npm.cmd run db:ensure-audit` correcto.
- `npm.cmd run audit:db` correcto:
  - Estado `OK`
  - Errores `0`
  - Warnings `0`
  - Tablas esperadas `24`
- Prueba de proteccion:
  - apagar `RBAC` devuelve `CRITICAL_MODULE_DISABLE_BLOCKED`.
- Smoke ROOT API correcto incluyendo:
  - `root/audit`

Pendiente:

- Crear pantalla frontend de auditoria o bloque dentro de RBAC para ver `platform_audit_events`.
- Pedir confirmacion visual antes de intentar apagar modulos criticos, aunque backend ya lo bloquee.
- Añadir motivo obligatorio para cambios criticos si quieres trazabilidad mas formal.
- Extender auditoria a tenants, usuarios tenant y modulos tenant.

Siguiente recomendado:

- Crear vista ROOT de auditoria operativa o empezar el ops-agent real minimo. Si priorizamos seguridad administrativa, toca la vista de auditoria; si priorizamos datos reales de servicios/metricas, toca ops-agent.

## Vista ROOT de Auditoria Operativa - 2026-04-23

Hecho:

- Añadida pantalla frontend:
  - `edugami-frontend/src/pages/root/AuditPage.vue`
- Añadida ruta:
  - `/root/audit`
- Añadido cliente API:
  - `getAuditEvents(params)` -> `GET /root/audit`
- Añadido enlace en sidebar:
  - `Auditoria`
  - cuelga del modulo `RBAC` porque actualmente no existe modulo propio `AUDIT`.
- Añadido guard de ruta:
  - `audit` requiere modulo efectivo `RBAC`.
- Añadido al buscador del header:
  - `Auditoria`
- Añadidas traducciones de menu:
  - `menu.audit`

La pantalla muestra:

- resumen de eventos,
- eventos de modulos,
- eventos RBAC,
- numero de actores,
- filtro por tipo de evento,
- busqueda por actor/entidad/evento,
- timeline de cambios,
- detalle expandible con `before_json`, `after_json` y `metadata_json`.

Verificado:

- `npm.cmd run build` correcto.

Pendiente:

- Decidir si crear modulo propio `AUDIT` en el catalogo o mantenerlo dentro de `RBAC`.
- Añadir filtros backend por fecha, actor, entidad y tipo de evento si crece el volumen.
- Añadir paginacion real server-side.
- Añadir motivo obligatorio para cambios criticos y mostrarlo en la pantalla.

Siguiente recomendado:

- Ops-agent real minimo para convertir Servicios/Metricas en datos reales de proceso/servicio.

## Idea pendiente: Observabilidad Total Enterprise - 2026-04-23

Añadido documento especifico:

- `platform-api/docs/OBSERVABILITY_TOTAL_DESIGN_TODO.md`

Objetivo:

- Diseñar antes de implementar una solución enterprise de observabilidad total para EDUGAMI:
  - auditoría CRUD completa,
  - captura centralizada de errores frontend/backend,
  - logs particionados en PostgreSQL,
  - alertas automáticas,
  - incident response,
  - reporting operativo y de seguridad,
  - correlación end-to-end,
  - detección de anomalías,
  - resiliencia de logs.

Importante:

- No implementar código todavía.
- Primero hacer fase de diseño lógico con arquitectura, SQL conceptual, flujos, políticas de retención, seguridad, trade-offs y preguntas de validación.

Relación con lo actual:

- Ya existe `platform_audit_events` como primera base para cambios críticos.
- Ya existen `platform_alert_events`, `platform_alert_deliveries`, `platform_login_attempts` y `platform_service_actions`.
- El diseño enterprise debe decidir si estas tablas se mantienen, se migran o se integran en un modelo más amplio.

### Centro de alertas

Funcion:

- Centralizar incidencias de plataforma.
- Permitir crear eventos desde backend o futuros jobs.
- Mostrar severidad: `info`, `warning`, `error`, `fatal`.
- Resolver o reabrir alertas desde ROOT.
- Registrar entregas por canal en `platform_alert_deliveries` cuando se envie por email, Telegram o WhatsApp.

Uso previsto:

- Caida de servicio.
- Error repetido de BBDD.
- Reinicio solicitado/fallido.
- Consumo alto de CPU/RAM cuando el ops-agent real lo mida.
- Problemas de MQTT o latencia.

Pendiente:

- Filtros backend reales por estado/severidad/tenant/fechas.
- Paginacion server-side.
- Detalle de alert y deliveries.
- Politicas por tenant/modulo.
- Crear alertas automaticas desde metricas y servicios.

### Servicios / Microservicios

Contexto actual:

- Ahora todo esta pensado para una unica maquina: frontend, `platform-api`, `ops-agent`, PostgreSQL Docker, MQTT y resto de servicios.
- La pantalla de servicios muestra estado registrado en `platform_services`, reinicios y ultimas acciones.
- Aun no mide CPU/RAM por proceso porque `ops-agent` sigue siendo stub.

Que debe medir en futuro:

- Estado real del proceso/contenedor.
- PID o container id.
- CPU/RAM por servicio.
- Uptime por servicio.
- Ultimo restart y resultado final.
- Logs recientes o enlace a logs.
- Latencia healthcheck por servicio.

### Metricas globales

Ahora muestra:

- Host.
- RAM global.
- Load average CPU.
- Ping DB.
- Acciones de servicios 24h.
- Historico simple de alertas, logins y acciones.

Preparado para futuro:

- CPU/RAM por proceso.
- Latencia HTTP por endpoint.
- MQTT conexiones y throughput.
- PostgreSQL conexiones, queries lentas y storage.
- Alertas generadas automaticamente por umbrales.

### RBAC

Mejora aplicada:

- Los permisos se agrupan visualmente por modulo cuando existe relacion en la tabla `permissions`.
- Los permisos sin modulo ya no deberian crecer; el catalogo unico `permissions` debe tener `module_key`, `scope` y `action`.

Pendiente:

- Migrar completamente `platform_permissions` hacia `permissions` o mantener sincronizacion formal.
- Guards frontend por permiso y modulo.
- Confirmaciones para cambios criticos.

### Catalogo de modulos

Mejora aplicada:

- Ya no se muestra como tabla plana.
- Se muestra como arbol por scope (`ROOT`, `SUPPORT`, `TENANT`).
- Los modulos con `parent_module_key` aparecen como hijos del modulo padre.
- El catalogo maestro tiene 29 modulos porque suma todos los scopes:
  - 10 `ROOT`
  - 7 `SUPPORT`
  - 12 `TENANT`
- Esto no significa que un tenant tenga 29 modulos activos. Cada tenant usa solo filas de `tenant_modules`, ahora mismo 9 para el tenant local de prueba.

Pendiente:

- Editor de jerarquia.
- Validacion visual de padre apagado/hijos apagados.
- Resolver apagado efectivo por padre desactivado a nivel tenant.

### Tablas vacias normales ahora mismo

Estas tablas pueden estar vacias en desarrollo y no son un error:

- `tenant_roles`: se usara cuando exista auth tenant real.
- `tenant_role_modules`: se usara para visibilidad de modulos por rol tenant.
- `tenant_role_permissions`: se usara para permisos por rol tenant.
- `user_tenant_roles`: se usara para asignar usuarios tenant a roles.
- `platform_alert_events`: vacia si no se han creado alertas.
- `platform_alert_deliveries`: vacia si no se han enviado alertas por email/Telegram/WhatsApp.
- `platform_account_permissions`: vacia si no hay permisos directos, porque ahora se usan permisos por rol.

Tablas duplicadas/legacy:

- `platform_permissions` fue retirada en la migracion 008.
- `permissions` es el catalogo unico con `module_key`, `scope` y `action`.
- `platform_modules` fue retirada en la migracion 006; `modules.global_enabled` es la unica fuente de verdad.

## Actualizacion Codex - Auditoria exhaustiva ROOT - 2026-04-27

### Estado real ROOT

El bloque ROOT ya esta funcional de extremo a extremo en estas areas:

- dashboard ROOT,
- tenants y detalle de tenant,
- cuentas de plataforma,
- RBAC interno,
- modulos globales,
- auditoria,
- alertas operativas,
- servicios,
- metricas,
- observabilidad base frontend/backend.

Tambien queda confirmado que `AUDIT` ya existe como modulo real y no como idea futura:

- existe en BBDD,
- tiene permisos `audit.read` y `audit.manage`,
- backend lo protege,
- frontend lo consume en rutas/guards/sidebar.

### Hallazgos reales pendientes

#### No bloqueantes para pasar a TENANT

1. RESUELTO 2026-05-01: el sidebar ROOT ya se agrupa por secciones desplegables.

2. RESUELTO 2026-05-01: se elimino la pagina muerta `DashboardPage.vue`.

3. RESUELTO 2026-05-01: existe `/root/no-access` para el fallback de guards y SSE.

4. `ops-agent` y notificaciones dependen aun de configuracion real de entorno.
   - Sin `OPS_RESTART_*` y SMTP valido, el flujo existe pero no ejecuta toda la operacion real.

5. Quedan restos de encoding/documentacion antigua desfasada.

#### Bloqueantes duros detectados

Ninguno para comenzar TENANT.

### Decision

**Si, se puede pasar a TENANT ya.**

ROOT esta suficientemente rematado para no seguir frenando el avance del producto. Lo que queda es principalmente:

- hardening,
- limpieza,
- UX final,
- configuracion de entorno.

### Recomendacion de paso

Antes o en paralelo al arranque TENANT, conviene hacer un remate corto ROOT:

1. Validar configuracion real de `ops-agent`, Docker/PostgreSQL y SMTP.
2. Completar limpieza de docs antiguas con encoding/desfase historico.
3. Revisar UX final de confirmaciones y textos de alto impacto.

Despues de eso, el siguiente bloque natural es TENANT:

1. layout tenant,
2. auth tenant real con login normal email/usuario + password, resolviendo tenants/contextos despues de autenticar,
3. sidebar tenant por modulos efectivos,
4. primeras pantallas funcionales tenant.

### Requisito obligatorio de familias/tutores

Antes de modelar pantallas o tablas de alumnos/familias, respetar:

- un padre/tutor puede tener varios hijos,
- los hijos pueden estar en clases, asignaturas y tenants/centros distintos,
- el login debe ser normal y no pedir tenant/centro manualmente,
- nunca asumir padre = alumno unico, clase unica o tenant unico,
- el acceso familiar debe depender de relaciones explicitas familiar-alumno,
- el familiar solo ve alumnos autorizados y nunca datos de otros alumnos de la clase.

Documento de arquitectura fijado:

- `platform-api/docs/TENANT_FAMILY_ACCESS_MODEL.md`
- `platform-api/docs/TENANT_ADMIN_MODULES_MODEL.md`

## Actualizacion Codex - Remate ROOT y estado pendiente - 2026-05-01

### Tachado reciente

- ~~Resolver fallback `/root/no-access`.~~
- ~~Eliminar pagina muerta `DashboardPage.vue`.~~
- ~~Evitar sidebar ROOT con secciones hardcoded.~~
- ~~Mantener `Panel de Control` como acceso directo fuera de desplegables.~~
- ~~Usar jerarquia del sidebar solo si viene de `modules.parent_module_key` en BBDD.~~
- ~~Anadir confirmaciones visuales para apagar modulos sensibles.~~
- ~~Anadir confirmaciones visuales para cambios RBAC sensibles.~~
- ~~Anadir confirmacion visual antes de reiniciar servicios.~~
- ~~Corregir crash de logger por objetos circulares en `privacy.js`.~~
- ~~Corregir `POST /root/alerts/:id/status` por inferencia de tipos PostgreSQL `42P08`.~~
- ~~Hacer fail-fast de `platform-api` si Postgres no esta disponible.~~
- ~~Enviar email directo por SMTP cuando falla el arranque antes de tener DB disponible.~~
- ~~Redisenar templates de correo y regenerar previews.~~
- ~~Quitar ancho fijo `max-width:760px` de los templates de correo.~~
- ~~Unificar dialogs de formularios y confirmaciones con componentes compartidos.~~
- ~~Quitar paginacion visual de tablas ROOT y dejar scroll.~~
- ~~Anadir seleccion multiple y acciones masivas en centro de alertas.~~
- ~~Anadir confirmacion visual antes de acciones masivas de alertas.~~
- ~~Mejorar auditoria con filtros por actor/fecha y diff JSON rojo/verde.~~
- ~~Ajustar responsive base de tablas, dialogs y sidebar ROOT.~~
- ~~Limpiar textos rotos de UI heredada detectados en RBAC.~~

### Pendiente real antes de TENANT

- Validar entorno local completo:
  - Docker Desktop arrancado.
  - PostgreSQL accesible en `127.0.0.1:5432`.
  - `npm run db:migrate` aplicado sin errores.
  - `platform-api`, `ops-agent` y frontend arrancan a la vez.
- Validar SMTP real:
  - Gmail/app password vigente.
  - correos llegan a bandeja principal o spam.
  - templates se ven bien en Gmail/Outlook/mobile.
- Validar `ops-agent` real:
  - `OPS_RESTART_*` configurado.
  - reinicio de servicios funciona fuera de modo simulado.
  - health checks reflejan procesos reales.
- Hacer una pasada UX final ROOT:
  - textos con encoding raro en docs heredadas.
  - revisar estados vacios y errores en pantallas ROOT.
  - probar en navegador responsive de alertas/RBAC/modulos/servicios.
- Limpieza documental:
  - RESUELTO 2026-05-01: docs principales ya no dicen que falte UI de auditoria.
  - RESUELTO 2026-05-01: docs principales ya no dejan sidebar plano como pendiente abierto.
  - docs antiguas que mencionen tablas legacy retiradas.

### Siguiente bloque grande

- TENANT:
  - layout tenant.
  - login tenant real.
  - guards tenant por modulo/permisos.
  - sidebar tenant por modulos efectivos.
  - Admin Tenant como bloque prioritario:
    - periodos academicos.
    - clases.
    - asignaturas.
    - matriculas.
    - alumnos.
    - profesores.
    - asignaciones docentes.
    - usuarios tenant.
    - roles/permisos.
    - invitaciones.
    - auditoria tenant.
    - politicas familiares.
  - modelo familiar/tutor multi-hijo y multi-tenant con relaciones explicitas.
  - usuarios tenant.
  - roles tenant.
  - primeras pantallas funcionales tenant.

Documento de alcance Admin Tenant:

- `platform-api/docs/TENANT_ADMIN_MODULES_MODEL.md`

Orden recomendado para no construir pantallas sobre un modelo incompleto:

1. Base academica: periodos, clases, asignaturas, alumnos, matriculas, profesores y asignaciones docentes.
2. Gestion de acceso: usuarios tenant, roles/permisos, invitaciones, padres/tutores, politicas y auditoria tenant.
3. Operativa: comunicados, notificaciones, incidencias internas, supervision de actividades y analitica.
4. Config: settings, modulos, politicas, suscripcion/limites, importacion/exportacion e integraciones.
