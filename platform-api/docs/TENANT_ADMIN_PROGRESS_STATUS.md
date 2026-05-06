# Estado de Progreso Admin Tenant

Ultima revision: 2026-05-05

Este documento dice por donde va realmente el bloque Admin Tenant. El modelo funcional completo esta en `platform-api/docs/TENANT_ADMIN_MODULES_MODEL.md`; este archivo es el tablero de progreso para saber que esta hecho, que esta a medias y que falta controlar.

El plan operativo completo para terminar Admin Tenant al 100% esta en:

- `platform-api/docs/TENANT_ADMIN_100_PERCENT_COMPLETION_PLAN.md`

## Resumen rapido

Estado global aproximado:

- Backend Admin Tenant: 60%
- Frontend Admin Tenant: 41%
- UI/UX visual Admin Tenant/Teacher: 35%
- Documentacion funcional: 75%
- Estado BBDD/migraciones: inconsistente; BBDD por delante del repo
- Listo para uso real en centro: no todavia

Lectura de los porcentajes:

- 0-20%: definido o placeholder.
- 20-50%: base creada, falta funcionalidad importante.
- 50-75%: base funcional, falta cerrar casos reales.
- 75-90%: usable con validaciones, permisos y UX razonables.
- 90-100%: listo para uso real, probado y pulido.

## Scope final vigente

El scope final de producto queda agrupado en 7 modulos:

- Dashboard.
- Academico.
- Personas.
- Accesos.
- Comunicacion.
- Seguimiento.
- Configuracion.

Los enlaces internos, pantallas, tablas y endpoints pueden ser mas numerosos, pero el usuario final debe entender el producto mediante esos 7 bloques. No se debe seguir aumentando scope fuera de ellos hasta cerrar Admin Tenant.

Fuera de Admin Tenant:

- Creacion de actividades educativas.
- LMS completo.
- Evaluacion pedagogica avanzada.
- Experiencia final de alumno.
- Funcionalidad ROOT.

## Riesgo BBDD

Estado: auditoria real parcial completada y limpieza controlada tenant aplicada.

La BBDD local responde y contiene tablas/modulos tenant avanzados, pero el repositorio no contiene todas las migraciones aplicadas. La BBDD esta por delante del repo y no se puede recrear de forma fiable desde cero con los archivos actuales.

Migraciones aplicadas en BBDD que faltan como archivos versionados:

- `018_tenant_invitations.sql`
- `019_tenant_operational_modules.sql`
- `020_tenant_audit_events.sql`
- `021_tenant_metadata.sql`
- `022_tenant_admin_full_modules.sql`
- `023_tenant_core_foundation.sql`
- `024_tenant_family_policies.sql`
- `025_tenant_login_security.sql`
- `026_force_sync_modules.sql`

Antes de declarar 100%, hay que recuperar/reconstruir esas migraciones y despues decidir:

- limpieza controlada, si la estructura actual es recuperable,
- reset completo, si se acepta recrear la BBDD desde migraciones ya saneadas.

Plan de revision:

- `platform-api/docs/TENANT_ADMIN_DATABASE_REVIEW_PLAN.md`

Resultado de revision real:

- `platform-api/docs/TENANT_ADMIN_DATABASE_REVIEW_RESULT_2026-05-05.md`

Scope de limpieza/reset parcial tenant:

- `platform-api/docs/TENANT_ADMIN_DB_CLEANUP_SCOPE.md`

Resultado de limpieza aplicada:

- `platform-api/docs/TENANT_ADMIN_DB_CLEANUP_RESULT_2026-05-05.md`

Migraciones nuevas aplicadas para el modelo academico v2 y limpieza de catalogo tenant:

- `platform-api/sql/migrations/027_tenant_academic_active_period_actions.sql`
- `platform-api/sql/migrations/028_cleanup_tenant_unimplemented_modules.sql`
- `platform-api/sql/migrations/029_restore_academic_history_permission.sql`
- `platform-api/sql/migrations/030_ai_tutor_teacher_only_cleanup.sql`

Backup/inventario antes de limpiar:

- `platform-api/tmp/db-backup-2026-05-05T21-20-53-293Z.json`
- `platform-api/tmp/db-inventory-2026-05-05T21-21-30-698Z.json`

Scripts auxiliares creados:

- `platform-api/scripts/backup-json.js`
- `platform-api/scripts/check-tenant-academic-v2.js`

Decision actual:

- No hacer reset inmediato sin reconciliar migraciones antes.
- Backup obligatorio antes de cualquier limpieza o reset.
- Catalogo tenant limpiado a modulos soportados actualmente.
- Tablas tenant experimentales vacias eliminadas.
- `ENROLLMENTS` conservado como modulo tecnico interno y oculto de navegacion.
- `AI_TUTOR` limitado a rol `TEACHER`.

Condicion de cierre:

- ROOT debe seguir funcionando exactamente como antes.
- Tenant Admin debe quedar multi-tenant y aislado.
- No puede haber permisos exigidos por rutas que no existan en BBDD.
- No puede haber modulos visibles sin soporte backend real.
- No puede haber relaciones ambiguas entre identidad, tenant user, alumno, profesor, tutor y staff.
- No puede haber migraciones aplicadas en BBDD que no existan en el repo.

## Principios que no se pueden romper

- Admin Tenant organiza, supervisa, controla y configura; no sustituye al profesor.
- Un alumno puede tener historico de clases, asignaturas y matriculas.
- Un profesor puede dar varias asignaturas en varias clases y periodos.
- Solo puede haber un periodo academico activo por tenant.
- El periodo activo se aplica automaticamente en formularios operativos; no se pide al usuario salvo en gestion de periodos, selector global, analitica o historico.
- Las matriculas existen como modelo interno, pero la UI no debe tratarlas como concepto tecnico principal.
- Las acciones visibles deben ser: anadir alumno, mover alumno, asignar asignatura o asignar profesor.
- El historico se genera automaticamente a partir de esas acciones.
- Un padre/tutor accede por relaciones explicitas con alumnos, no por pertenecer a una unica clase.
- Todo debe quedar aislado por tenant.
- El login visual debe ser unico; internamente se resuelve si el usuario entra como root, tenant, profesor, alumno, tutor o futuro usuario publico.
- El Tutor IA queda para profesor de momento, no para Admin Tenant.

## Backend

Estado global: 55%

Ya existe:

- Login/contexto tenant base.
- Middleware tenant con permisos.
- Rutas tenant protegidas por permiso.
- Endpoint de overview tenant.
- Usuarios admin tenant: listar, crear, editar y listar roles.
- Academic Core base:
  - periodos academicos,
  - clases,
  - asignaturas,
  - alumnos,
  - profesores,
  - matriculas internas automaticas,
  - asignaciones docentes,
  - padres/tutores como vinculacion basica.
- Validacion de payloads en rutas principales.
- Migraciones base para periodos, matriculas y asignaciones docentes.
- Migracion v2 aplicada para periodo activo unico, historico automatico y acciones academicas simples.
- Endpoints backend preparados para:
  - mover alumno,
  - asignar asignaturas a alumno,
  - asignar profesor a clase/asignatura,
  - consultar historico academico automatico.
- Separacion de Tutor IA como ruta teacher-only.

Pendiente transversal:

- Auditoria tenant completa.
- Invitaciones por email con aceptar, reenviar, revocar y caducidad.
- Importacion/exportacion CSV/Excel.
- Politicas familiares detalladas por tutor.
- Archivar/suspender con reglas consistentes por entidad.
- Validaciones de solapamientos y conflictos academicos.
- Operativa completa: comunicados, notificaciones, incidencias, analitica real.
- Config completa: settings, modulos, politicas, suscripcion, integraciones.
- Tests de permisos tenant y aislamiento multi-tenant.

## Backend por modulo

| Modulo | Estado | Hecho | Falta controlar o anadir |
| --- | ---: | --- | --- |
| Periodos | 78% | CRUD basico, listado, periodo activo unico aplicado por migracion v2 | Calendario academico real, cierre de periodo, evaluaciones/trimestres anidados y pruebas funcionales de UI |
| Clases | 65% | CRUD basico, asociacion a tenant y periodo activo interno | Archivo real, vista de alumnos/profesores/asignaturas por clase, historico claro |
| Asignaturas | 60% | CRUD basico | Vinculacion fuerte con clases, profesores usando periodo activo, alumnos matriculados por asignatura |
| Alumnos | 60% | CRUD basico, suspension, vinculacion inicial con tutores | Perfil academico completo, historico, privacidad, importacion masiva, evitar duplicados |
| Matriculas internas | 68% | Modelo base, uso de periodo activo, historico automatico y endpoints de accion simple aplicados | Probar flujos con datos reales y adaptar frontend para no exponer tabla tecnica |
| Profesores | 45% | Listado desde usuarios/roles tenant | Alta/edicion especifica, suspension docente, carga academica, historico |
| Asignaciones docentes | 60% | Modelo profesor-clase-asignatura-periodo y accion simple de asignar preparada | Validar solapamientos, roles docentes, sustituciones, trazabilidad y frontend |
| Usuarios/Roles | 50% | Listar/crear/editar usuarios, listar roles | Invitaciones, permisos por rol desde UI, staff no docente, auditoria de cambios |
| Analitica/Reports | 15% | Ruta/pantalla base | Metricas reales, filtros, comparativas, exportacion, KPIs por clase/alumno/asignatura |

## Frontend

Estado global: 41%

Ya existe:

- Layout Tenant separado.
- Sidebar Tenant.
- Header Tenant.
- Tokens SCSS centralizados en `edugami-frontend/src/css/tenant-admin.scss`.
- Estilo base para Quasar: inputs, selects, menus, cards, drawers, dialogs, tables, chips, toggles y scrollbars.
- Rutas reales por modulo, ya no todo vive como una unica pagina gigante.
- `TenantResourcePage` como componente compartido para modulos que aun no tienen pagina propia final.
- Campo de fecha reutilizable con Quasar: `AppDateField.vue`.
- Matriculas ocultas del sidebar como concepto tecnico.
- Alumnos ya tienen pagina propia, no wrapper generico, con vista compacta, detalle lateral y acciones simples:
  - mover alumno,
  - asignar asignaturas,
  - crear/editar alumno sin pedir periodo academico.
- Clases ya enriquecen el detalle lateral con alumnos, asignaturas y profesores asignados cuando los permisos lo permiten.
- Asignaturas ya tienen pagina propia con cards, filtros, crear/editar y detalle lateral cruzando alumnos, clases y profesores asignados.
- Asignaciones docentes usan el periodo activo sin pedir periodo en formulario operativo.
- Build frontend correcto.

Pendiente transversal:

- Rematar modulo por modulo con paginas propias.
- Reducir dialogs y usar mas drawers, paneles laterales o edicion en pagina.
- Igualar tamanos de cards, fuentes, botones, inputs y spacing.
- Separar claramente identidad visual ROOT vs Tenant Admin/Teacher.
- Consolidar modo claro como experiencia principal para Tenant Admin/Teacher.
- Pulir responsive mobile de tenant admin.
- Traducciones completas para tenant admin.
- Revisar accesibilidad basica: labels, foco, estados vacios y errores.
- Evitar tablas cuando una vista de cards/lista sea mas clara.
- Donde haya tablas, usar scroll y no paginacion salvo necesidad real.

## Estado visual Tenant Admin / Teacher

Estado actual: 35%

Ya existe:

- SCSS central para Tenant Admin: `edugami-frontend/src/css/tenant-admin.scss`.
- Tokens base para fondo, superficie, bordes, texto, color principal y sombras.
- Overrides Quasar para inputs, selects, menus, cards, drawers, dialogs, chips, badges, toggles y tablas.
- Layout tenant separado de ROOT.
- Primeras pantallas propias: Periodos, Clases, Alumnos y Asignaturas.
- Uso inicial de drawers para editar/crear sin perder contexto.
- Campo de fecha reutilizable basado en Quasar.

Problema actual:

- Todavia hay mezcla entre pantallas nuevas y wrappers genericos.
- El estilo claro necesita mas personalidad y armonia para parecer educativo premium.
- Hay tamanos que aun se sienten grandes o descompensados en algunos modulos.
- Falta un set de componentes compartidos para evitar que cada pagina invente su propia UI.

Objetivo visual:

- ROOT = tecnico, oscuro, operativo, plataforma.
- Tenant Admin = claro, organizado, academico, gestion educativa real.
- Teacher = creativo, practico, visual, orientado a crear y seguir actividades.

Paleta recomendada:

- indigo para marca y acciones principales,
- cyan para datos e informacion,
- verde para activo/progreso/exito,
- naranja para pendiente/aviso,
- rosa/fucsia como acento creativo controlado,
- amarillo suave para destacados positivos,
- slate/grises modernos para estructura y lectura.

Reglas obligatorias:

- No copiar ROOT.
- No abusar de azul/morado.
- No usar colores chillones ni infantiles.
- Cada color debe tener significado.
- Modo claro debe ser excelente en Tenant Admin/Teacher.
- Modo oscuro puede existir, pero no debe convertir Tenant Admin/Teacher en ROOT.
- Inputs, selects y fechas deben usar Quasar estilizado.
- Crear/editar debe priorizar drawers, paneles laterales o edicion en pagina.
- Dialogs solo para confirmaciones criticas o decisiones bloqueantes.
- Cards solo cuando aporten valor.
- Tablas compactas cuando haya mucho volumen.

Componentes que faltan para cerrar sistema visual:

| Componente | Estado | Uso esperado |
| --- | ---: | --- |
| TenantPageHeader | 0% | Titulo, descripcion, busqueda y accion principal consistente |
| TenantFilterBar | 0% | Filtros visibles, chips activos y limpiar filtros |
| TenantMetricCard | 35% | KPIs compactos y armonizados |
| TenantEntityCard | 25% | Cards de clase, alumno, profesor, asignatura |
| TenantCompactList | 0% | Listas densas para volumen medio |
| TenantScrollTable | 10% | Tablas sin paginacion, con scroll y acciones claras |
| TenantRightDrawerForm | 35% | Crear/editar sin dialogos pesados |
| TenantRightDrawerDetail | 35% | Ver detalle sin salir de la pantalla |
| TenantEmptyState | 0% | Estados vacios utiles y bonitos |
| TenantStatusBadge | 20% | Estados consistentes por modulo |
| TenantBulkActionBar | 0% | Acciones masivas en tablas/listas |
| AppDateField | 60% | Fecha con Quasar y estilo comun |

## Frontend por modulo final

El producto final no se mide por enlaces sueltos, sino por los 7 modulos finales.

| Modulo final | Estado | Pantallas/subsecciones incluidas | Falta principal |
| --- | ---: | --- | --- |
| Dashboard | 35% | KPIs, actividad reciente, alertas, accesos rapidos, selector de periodo | Redisenar con datos reales, alertas utiles y periodo global |
| Academico | 42% | Periodos, clases, asignaturas, matriculas internas, asignaciones docentes, calendario | Cerrar relaciones reales, historico automatico, conflictos y calendario |
| Personas | 32% | Alumnos, profesores, padres/tutores, staff, usuarios | Perfiles completos, carga docente, politicas familiares y staff |
| Accesos | 25% | Roles, permisos, invitaciones, suspensiones, contextos | Matriz visual, flujo completo de invitacion, multi-rol y auditoria |
| Comunicacion | 10% | Comunicados, notificaciones, plantillas, programacion, entregas | Destinatarios reales, envio, metricas y estado de entrega |
| Seguimiento | 15% | Analitica, reports, supervision de actividades, incidencias, uso | Datos reales, exports, filtros y flujo de incidencias |
| Configuracion | 20% | Settings, modulos, politicas, suscripcion, integraciones, auditoria, import/export | BBDD consistente, settings reales, import/export robusto, auditoria e integraciones externas en Fase 4 |

Subpantallas existentes o previstas dentro de esos modulos:

| Subpantalla | Modulo final | Estado actual | Nota |
| --- | --- | ---: | --- |
| Periodos | Academico | 65% | Pagina propia, falta jerarquia completa |
| Clases | Academico | 68% | Pagina propia con detalle relacional inicial: alumnos, asignaturas y profesores |
| Asignaturas | Academico | 55% | Pagina propia con cards, filtros, detalle de alumnos/clases/profesores y crear/editar |
| Matriculas internas | Academico | 55% | Backend y UI de alumno preparados para anadir/mover alumno y asignar asignaturas sin tabla tecnica |
| Asignaciones docentes | Academico | 35% | Backend y formulario basico usan periodo activo; falta detectar conflictos y crear UI final |
| Alumnos | Personas | 45% | Pagina propia con busqueda, filtros, detalle lateral, crear/editar, mover y asignar asignaturas |
| Profesores | Personas | 20% | Falta carga academica y alta/edicion especifica |
| Padres/tutores | Personas | 20% | Falta politica familiar fina |
| Usuarios/Roles | Accesos | 45% | Falta matriz y rediseno al nuevo sistema |
| Invitaciones | Accesos | 20% | Falta aceptacion real, email y reenvio |
| Comunicados | Comunicacion | 15% | Falta envio y estado de entrega |
| Notificaciones | Comunicacion | 5% | Pendiente como modulo real |
| Incidencias | Seguimiento | 20% | Falta flujo de estados |
| Reports/Analitica | Seguimiento | 10% | Placeholder/base |
| Settings | Configuracion | 20% | Falta service claro, auditoria y politicas |
| Import/export | Configuracion | 10% | Importacion demo, export pendiente |
| Integraciones externas | Configuracion | 5% | Fase 4: Alexia, Moodle, Google Classroom; primero conexion/importacion/sync, creacion externa como avanzado |
| Auditoria | Configuracion | 15% | Lista parcial, falta registrar eventos |
| Tutor IA | Fuera de Admin Tenant | 15% | Debe quedar orientado a Teacher |

## Orden recomendado de trabajo

1. Cerrar sistema visual tenant/admin/teacher:
   - tokens SCSS,
   - paleta rica controlada,
   - modo claro premium,
   - componentes compartidos,
   - Quasar inputs/selects/date,
   - cards compactas,
   - drawers reutilizables,
   - filtros reutilizables,
   - badges reutilizables,
   - estados vacios.

2. Rematar Academic Core en frontend:
   - Periodos,
   - Clases,
   - Asignaturas,
   - Alumnos,
   - pulir flujos internos de matricula sin exponer tabla tecnica,
   - Profesores,
   - Asignaciones docentes.

3. Cerrar backend de reglas academicas:
   - conflictos,
   - historico,
   - archivar/suspender,
   - auditoria,
   - tests multi-tenant.

4. Rematar Gestion:
   - usuarios,
   - roles/permisos,
   - padres/tutores,
   - invitaciones,
   - auditoria tenant.

5. Empezar Operativa:
   - comunicados,
   - notificaciones,
   - incidencias,
   - analitica real.

6. Empezar Config:
   - settings,
   - modulos,
   - politicas,
   - suscripcion/limites,
   - integraciones externas en Fase 4:
     - Alexia,
     - Moodle,
     - Google Classroom,
     - conexion, importacion y sincronizacion de alumnos/profesores/clases/asignaturas/usuarios,
     - creacion bidireccional avanzada solo despues de cerrar la base academica inicial.

## Definicion de 100%

Un modulo se considera al 100% cuando cumple todo esto:

- Encaja dentro de uno de los 7 modulos finales del scope.
- No introduce funcionalidades fuera de alcance.
- Tiene backend con rutas, permisos, validacion y reglas reales.
- Respeta aislamiento tenant.
- Tiene UI propia, clara, moderna, responsive y alineada con la identidad Tenant Admin/Teacher.
- No copia el estilo ROOT.
- Usa componentes visuales compartidos y tokens SCSS centrales.
- Usa modo claro excelente y modo oscuro coherente.
- Tiene traducciones.
- Tiene estados de carga, vacio, error y exito.
- Tiene acciones criticas confirmadas.
- Tiene auditoria cuando toca datos sensibles.
- Usa drawers o edicion en pagina para crear/editar cuando sea mejor que dialog.
- Usa tablas compactas solo cuando hay volumen real.
- Usa cards solo cuando aportan contexto o decision rapida.
- Tiene BBDD consistente, constraints correctas y seeds necesarios.
- No rompe ROOT.
- No depende de datos demo para entenderse.
- Tiene pruebas suficientes para permisos y casos principales.

## Nota de producto

Ahora mismo el proyecto tiene buena base tecnica para Admin Tenant, pero todavia no esta para venderlo como modulo completo. La prioridad correcta es convertir la base academica en una experiencia clara y real: menos pantallas genericas, mas flujos guiados, mas contexto visual, identidad propia distinta de ROOT y reglas de centro bien cerradas.
