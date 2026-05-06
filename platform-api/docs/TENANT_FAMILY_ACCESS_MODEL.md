# Modelo obligatorio de acceso de padres/tutores

## Principio base

Un padre, madre o tutor no representa a un unico alumno. Tampoco representa una unica clase, asignatura o tenant.

El sistema debe soportar que una misma cuenta de familiar tenga acceso explicito a varios alumnos, incluso si esos alumnos pertenecen a clases distintas, asignaturas distintas o tenants/centros distintos.

Ejemplo real:

- hijo A en 1 ESO A del Colegio A,
- hijo B en 3 ESO B del Colegio A,
- hijo C en una academia externa que tambien usa EduGami.

Este caso debe funcionar sin duplicar cuentas innecesariamente y sin mezclar datos entre tenants.

## Relaciones obligatorias

El acceso familiar debe modelarse con relaciones explicitas, no por inferencia desde email, apellido, clase o tenant.

Relaciones minimas:

- familiar/tutor <-> alumno,
- alumno <-> tenant,
- alumno <-> clase/grupo,
- alumno <-> asignaturas.

Una cuenta familiar puede tener multiples relaciones `familiar_alumno`. Cada relacion debe indicar como minimo:

- `guardian_user_id`,
- `student_id`,
- `tenant_id`,
- tipo de relacion: madre, padre, tutor legal, autorizado, otro,
- estado: pendiente, activo, revocado,
- permisos concretos: progreso, asistencia, mensajes, calificaciones, informes, pagos si aplica,
- fechas de alta/revocacion,
- auditoria de quien concedio o revoco el acceso.

La politica de privacidad familiar debe poder limitar acciones por relacion concreta. No todos los tutores tienen los mismos derechos para todos los alumnos.

Permisos habituales:

- ver informes,
- recibir comunicados,
- justificar asistencia,
- ver notas,
- contactar profesor,
- ver progreso,
- ver incidencias,
- recibir notificaciones.

## Aislamiento multi-tenant

Cada tenant mantiene aislamiento estricto. Aunque un familiar tenga hijos en varios tenants, cada consulta debe resolverse dentro del contexto autorizado.

Reglas:

- nunca asumir `guardian_user_id -> tenant_id` como relacion unica,
- nunca cargar datos de alumnos por clase completa para un familiar,
- nunca exponer companeros de clase,
- nunca mezclar agregados entre tenants sin separar contexto visible,
- cada lectura debe comprobar relacion explicita familiar-alumno y pertenencia del alumno al tenant solicitado.

## Experiencia de producto

Un familiar debe poder ver:

- login normal con email/usuario y password, sin tener que escribir tenant/centro,
- vista agregada de todos sus hijos autorizados,
- selector de hijo,
- selector de centro/tenant cuando haya mas de uno,
- resumen por alumno sin datos de otros alumnos,
- cambio claro de contexto cuando entra en un tenant/centro concreto.

La vista agregada puede mostrar totales globales del familiar, pero cualquier dato sensible debe conservar trazabilidad de alumno y tenant.

## Login y resolucion de contexto

El login de usuarios tenant/familia debe ser normal: email/usuario y password. No debe pedir `tenantSlug` como requisito de UX para entrar.

Despues de autenticar la identidad, el backend debe resolver los contextos disponibles:

- tenants donde el usuario tiene acceso,
- roles por tenant,
- alumnos autorizados si es familiar/tutor,
- modulos y permisos efectivos por contexto.

Si el usuario solo tiene un tenant/contexto, la aplicacion puede entrar directamente. Si tiene varios, debe mostrar selector de centro, hijo o contexto despues del login.

Reglas:

- no duplicar cuentas por centro si la misma persona usa el mismo email/identidad,
- no confiar en el tenant elegido por el usuario sin validar relacion autorizada,
- el token/sesion debe incluir identidad global y contexto activo o permitir cambiarlo de forma controlada,
- cada cambio de contexto debe recalcular permisos efectivos.

Este modelo debe convivir con usuarios publicos sin tenant. Un padre/tutor o alumno puede tener tambien perfil publico, pero el acceso a datos academicos sigue dependiendo siempre del contexto tenant y de relaciones explicitas.

## Consultas seguras

Patron correcto:

1. Resolver alumnos autorizados para el familiar.
2. Filtrar por tenant activo o por tenant permitido en selector.
3. Filtrar datos academicos por `student_id IN (...)`.
4. Aplicar permisos de la relacion familiar-alumno.
5. Devolver solo datos del alumno autorizado.

Patrones prohibidos:

- buscar alumnos por email del familiar,
- asumir un unico `student_id`,
- asumir un unico `tenant_id`,
- usar la clase/grupo como scope suficiente para un familiar,
- devolver listas de alumnos de la clase,
- mezclar datos de distintos tenants en una respuesta sin separacion de contexto.

## Implicacion para TENANT

Cuando se implemente TENANT, los roles familiares no deben ser una variante simple de `STUDENT`.

Debe existir una capacidad especifica de familia/tutor con permisos limitados y siempre mediados por relaciones explicitas con alumnos.

El alcance completo del Admin Tenant, incluyendo periodos, matriculas, asignaciones docentes, invitaciones, auditoria tenant y politicas familiares, queda definido en:

- `platform-api/docs/TENANT_ADMIN_MODULES_MODEL.md`

Este documento bloquea cualquier diseno que asuma:

- un padre = un alumno,
- un padre = una clase,
- un padre = un tenant,
- un padre puede ver datos de companeros del alumno.
