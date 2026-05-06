# Scope de Limpieza BBDD - Admin Tenant

Ultima revision: 2026-05-05

Este documento define que partes de la BBDD tenant se pueden eliminar, conservar o reconstruir porque el modelo de Admin Tenant se va a replantear antes de seguir con dashboard, clases, asignaturas, matriculas internas y usuarios tenant.

No es una migracion ejecutable. Es el contrato de limpieza antes de tocar datos reales.

## Decision

Decision actual: `LIMPIEZA/RESET PARCIAL TENANT RECOMENDADO`.

Motivo:

- Hay tablas tenant creadas por migraciones que no existen en el repo.
- La parte academica se va a redisenar.
- El modelo de usuarios tenant, clases, asignaturas y matriculas internas necesita una vuelta antes de seguir.
- No conviene construir UI nueva sobre tablas que probablemente se van a cambiar.

Importante:

- Periodos academicos y matriculas se mantienen en el modelo final.
- Lo que se replantea es su estructura tecnica y su exposicion en UI.
- El periodo activo del tenant debe aplicarse automaticamente en formularios operativos.
- Las matriculas no deben exponerse como concepto tecnico en la UI diaria.

## Regla principal

No borrar nada de ROOT.

ROOT debe seguir funcionando:

- login root,
- tenants,
- modulos globales,
- roles/permisos root,
- auditoria root,
- alertas,
- observabilidad.

## No borrar todavia

Estas tablas o familias deben conservarse hasta tener un sustituto claro, porque el login tenant y la administracion base dependen de ellas:

- `tenants`
- `tenant_users`
- `tenant_roles`
- `user_tenant_roles`
- `tenant_modules`
- `tenant_role_modules`
- `tenant_role_permissions`
- `tenant_refresh_tokens`
- `modules`
- `permissions`
- `module_scope_availability`

Importante:

- Si se decide cambiar tambien el modelo de `tenant_users`, primero hay que crear el nuevo modelo de identidad/contexto.
- No se debe borrar `tenant_users` mientras el login tenant actual dependa de esa tabla.
- Lo correcto es hacer una migracion de transicion o reset completo controlado, no borrar a mano.

## Tablas a conservar como concepto

Estas entidades son obligatorias en el modelo final aunque sus tablas actuales puedan necesitar cambios:

- periodos academicos,
- matriculas de clase,
- matriculas de asignatura,
- historico academico,
- asignaciones docentes por periodo.

Reglas:

- solo puede haber un periodo activo por tenant,
- el periodo activo se usa automaticamente en acciones operativas,
- el periodo no se pide en formularios normales,
- las matriculas se generan desde acciones simples,
- el historico se genera automaticamente.

## Tablas candidatas a corregir o reconstruir

Estas tablas pertenecen al modelo academico/operativo actual y son candidatas a corregirse o reconstruirse con migraciones limpias. No significa eliminar el concepto funcional.

### Academico

Candidatas:

- `tenant_classes`
- `tenant_subjects`
- `tenant_students`
- `tenant_student_classes`
- `tenant_student_subjects`
- `tenant_teacher_assignments`
- `tenant_guardian_student_links`

Conservar/corregir con especial cuidado:

- `tenant_academic_periods`
- `tenant_class_enrollments`
- `tenant_subject_enrollments`

Motivo:

- mezclan relaciones antiguas con el modelo nuevo,
- algunas simplifican demasiado alumno/clase/asignatura,
- hay duplicidad entre relaciones directas y matriculas,
- faltan reglas fuertes de historico, periodo, estado y privacidad,
- el periodo y la matricula deben existir, pero no como friccion diaria en formularios.

### Operativa creada demasiado pronto

Candidatas si existen en la BBDD local:

- `tenant_attendance`
- `tenant_incidents`
- `tenant_communications`
- `tenant_invitations`
- `tenant_audit_events`
- `tenant_login_attempts`
- `tenant_password_reset_tokens`

Motivo:

- proceden de migraciones perdidas o no versionadas,
- no tienen backend/frontend completo en el repo actual,
- pueden rehacerse mejor cuando el modelo de usuarios tenant quede cerrado.

Nota:

- Auditoria tenant puede ser necesaria, pero debe rehacerse como parte del modelo definitivo.
- Invitaciones tambien son necesarias, pero deben depender del nuevo modelo de identidad/contexto.

## Datos que se perderian

Si se eliminan estas tablas, se perderian datos locales de:

- periodos,
- clases,
- asignaturas,
- alumnos,
- matriculas,
- asignaciones docentes,
- vinculos padre/tutor-alumno,
- incidencias,
- comunicados,
- asistencia,
- invitaciones,
- auditoria tenant experimental.

Antes de ejecutar nada:

- hacer backup,
- exportar si hay datos utiles,
- confirmar que son datos demo/desarrollo.

## Nuevo modelo a disenar antes de recrear tablas

Antes de crear nuevas migraciones, hay que cerrar estas decisiones.

### Identidad y usuarios tenant

Definir:

- identidad global de login,
- usuario dentro de tenant,
- contextos multi-tenant,
- roles por tenant,
- perfiles vinculados: alumno, profesor, familiar, staff,
- usuario futuro publico sin duplicar logica,
- invitaciones y activacion.

Regla:

- una cuenta no debe duplicarse por cada tenant si puede tener varios contextos.
- el login visual sigue siendo unico.

### Alumno

Definir:

- si alumno es identidad login, perfil academico o ambas cosas conectadas,
- relacion alumno-tenant,
- estado,
- historico,
- privacidad,
- relacion con tutores,
- posibilidad futura de usuario publico/alumno sin tenant.

### Clase

Definir:

- clase como grupo academico dentro de tenant,
- periodo academico,
- estado,
- tutoria,
- alumnos matriculados,
- asignaturas impartidas,
- profesores asignados,
- historico.

### Asignatura

Definir:

- asignatura catalogo del centro,
- asignatura impartida en clase/periodo,
- profesor por clase/asignatura/periodo,
- alumnos matriculados por clase/asignatura.

### Matricula

Definir:

- matricula de alumno a clase,
- matricula de alumno a asignatura,
- generacion automatica desde anadir/mover alumno,
- generacion automatica desde asignar asignatura,
- uso automatico del periodo activo,
- fechas,
- estado,
- motivo de baja/cambio,
- historico,
- validacion de duplicados/conflictos.

Regla UX:

- no exponer "crear matricula" como accion principal,
- no pedir periodo academico en formularios operativos,
- las acciones visibles son anadir alumno, mover alumno, asignar asignatura o asignar profesor.

### Familias/tutores

Definir:

- relacion tutor-alumno,
- permisos por alumno,
- soporte multi-hijo,
- soporte multi-tenant,
- privacidad estricta,
- nunca acceso a otros alumnos de la clase.

## Orden recomendado

1. Backup/export de BBDD local.
2. Confirmar que los datos academicos actuales son prescindibles.
3. Congelar desarrollo de pantallas academicas tenant.
4. Redisenar modelo de identidad/contexto tenant.
5. Redisenar modelo Academico minimo:
   - periodos,
   - clases,
   - asignaturas,
   - alumnos,
   - matriculas internas automaticas,
   - asignaciones docentes,
   - tutores.
6. Crear migraciones limpias nuevas.
7. Eliminar tablas candidatas solo dentro de una migracion controlada.
8. Ajustar backend a las nuevas tablas.
9. Ajustar frontend a los 7 modulos finales.
10. Probar login root, login tenant y aislamiento multi-tenant.

## No hacer

- No borrar tablas manualmente desde consola sin backup.
- No borrar `tenant_users` hasta tener sustituto.
- No mezclar tablas viejas y nuevas con nombres parecidos.
- No crear mas wrappers frontend encima del modelo actual.
- No sembrar 24 modulos visibles si el producto final son 7 bloques.
- No tocar ROOT durante la limpieza tenant.

## Resultado esperado

Despues de la limpieza:

- BBDD reproducible desde migraciones versionadas.
- ROOT intacto.
- Login tenant funcional.
- Modelo Academico limpio.
- Sin tablas tenant experimentales colgando.
- Sin modulos visibles sin backend/frontend real.
- Base preparada para construir Admin Tenant bien.
