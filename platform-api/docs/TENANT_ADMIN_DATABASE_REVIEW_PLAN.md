# Plan de Revision BBDD - Admin Tenant

Ultima revision: 2026-05-05

Este documento define como revisar la base de datos antes de cerrar Admin Tenant. La revision de BBDD es obligatoria para llegar al 100%.

Resultado de la revision real parcial del 2026-05-05:

- `platform-api/docs/TENANT_ADMIN_DATABASE_REVIEW_RESULT_2026-05-05.md`

Scope de limpieza/reset parcial tenant:

- `platform-api/docs/TENANT_ADMIN_DB_CLEANUP_SCOPE.md`

## Objetivo

Comprobar si la base de datos actual esta alineada con el scope final de Admin Tenant:

- Dashboard.
- Academico.
- Personas.
- Accesos.
- Comunicacion.
- Seguimiento.
- Configuracion.

No se deben proponer funcionalidades fuera de ese scope.

## Problema actual

Se han realizado migraciones recientes y puede haber inconsistencias:

- estructura incoherente entre ROOT y Tenant,
- tablas duplicadas,
- tablas incompletas,
- tablas mal relacionadas,
- columnas obsoletas,
- permisos no sembrados,
- modulos creados pero no visibles,
- datos corruptos o no alineados con el modelo,
- posible ruptura de funcionalidad ROOT.

## Reglas obligatorias

Despues de la revision:

- ROOT debe funcionar exactamente como antes.
- El sistema debe soportar multi-tenant real.
- Las entidades tenant deben estar aisladas por `tenant_id`.
- No debe haber relaciones ambiguas entre identidad, usuario tenant, alumno, profesor, tutor y staff.
- No debe haber endpoints que exijan permisos inexistentes.
- No debe haber modulos frontend visibles sin soporte backend.
- No debe haber tablas vivas sin responsabilidad clara.

## Entidades que deben quedar claras

### ROOT

Debe conservar:

- cuentas root/plataforma,
- roles y permisos root,
- tenants,
- modulos globales,
- auditoria root,
- alertas,
- servicios/metricas/observabilidad,
- configuracion operativa necesaria.

ROOT no debe depender de tablas academicas tenant para arrancar.

### Identidad y acceso tenant

Debe quedar claro:

- identidad de login,
- usuario tenant,
- roles tenant,
- permisos tenant,
- contextos multi-tenant,
- refresh tokens tenant,
- modulos visibles por rol,
- modulos activos por tenant.

### Academico

Debe cubrir:

- periodos academicos,
- clases,
- asignaturas,
- matriculas,
- asignaciones docentes,
- calendario academico.

### Personas

Debe cubrir:

- alumnos,
- profesores,
- padres/tutores,
- staff,
- usuarios,
- relaciones familiares por alumno.

### Accesos

Debe cubrir:

- roles,
- permisos,
- invitaciones,
- suspensiones,
- contextos de usuario.

### Comunicacion

Debe cubrir:

- comunicados,
- notificaciones,
- plantillas,
- programacion,
- entregas.

### Seguimiento

Debe cubrir:

- analitica,
- reports,
- supervision de actividades,
- incidencias,
- uso de plataforma.

### Configuracion

Debe cubrir:

- settings,
- modulos activos,
- politicas,
- suscripcion y limites,
- integraciones externas como Fase 4,
- auditoria,
- importacion/exportacion.

## Checklist de auditoria

### 1. Inventario de tablas

Revisar:

- tablas existentes,
- tablas vacias,
- tablas sin FK,
- tablas sin `tenant_id` cuando deberian tenerlo,
- tablas duplicadas por responsabilidad,
- tablas ROOT mezcladas con Tenant.

Resultado esperado:

- conservar,
- corregir,
- eliminar,
- migrar datos,
- resetear.

### 2. Inventario de columnas

Revisar:

- columnas obsoletas,
- columnas mal nombradas,
- JSON usado como cajon desastre,
- fechas sin timezone donde aplique,
- estados sin check constraint,
- referencias por texto donde deberia haber FK.

### 3. Relaciones y constraints

Revisar:

- PK compuestas donde hay aislamiento tenant,
- FK con `tenant_id`,
- cascadas peligrosas,
- unique constraints correctas,
- checks de estado,
- indices para consultas principales.

### 4. Permisos y modulos

Revisar:

- cada ruta tenant tiene permiso existente,
- cada permiso apunta a modulo existente,
- cada modulo tenant existe en `module_scope_availability`,
- cada tenant tiene `tenant_modules`,
- cada rol tiene `tenant_role_modules`,
- cada rol tiene `tenant_role_permissions`,
- los nuevos tenants reciben seeds completos.

### 5. Datos semilla

Revisar:

- usuario root funcional,
- roles root,
- permisos root,
- tenant demo si aplica,
- roles tenant base,
- modulos tenant base,
- permisos tenant base,
- settings iniciales,
- datos minimos para smoke test.

### 6. Compatibilidad ROOT

Probar:

- login root,
- dashboard root,
- tenants root,
- modulos root,
- roles/permisos root,
- alertas,
- auditoria,
- servicios/metricas.

### 7. Smoke test Tenant Admin

Probar:

- login tenant,
- seleccion/contexto tenant,
- dashboard tenant,
- ver modulos finales,
- crear periodo,
- crear clase,
- crear asignatura,
- crear alumno,
- crear profesor,
- anadir alumno a clase y verificar matricula interna automatica,
- mover alumno y verificar cierre/apertura de historico,
- asignar asignatura y verificar matricula interna automatica,
- confirmar que los formularios operativos usan el periodo activo sin pedirlo,
- crear asignacion docente,
- invitar usuario,
- registrar incidencia,
- crear comunicado,
- ver auditoria.

## Opcion A: Limpieza

Usar si la base actual es recuperable.

Pasos:

1. Hacer backup.
2. Inventariar tablas y datos.
3. Marcar tablas a conservar, eliminar o corregir.
4. Crear migraciones de limpieza.
5. Corregir constraints/FK.
6. Corregir seeds de modulos/permisos.
7. Ejecutar smoke test ROOT.
8. Ejecutar smoke test Tenant Admin.

Ventaja:

- Conserva datos utiles.

Riesgo:

- Puede arrastrar deuda oculta si la estructura esta muy mezclada.

## Opcion B: Reset completo

Preferible si hay dudas fuertes.

Pasos:

1. Hacer backup.
2. Borrar/recrear BBDD local.
3. Aplicar migraciones limpias desde una unica carpeta oficial.
4. Insertar usuario root funcional.
5. Insertar configuracion base ROOT.
6. Insertar modulos/permisos ROOT.
7. Insertar modulos/permisos Tenant.
8. Crear tenant demo.
9. Crear usuario Tenant Admin demo.
10. Ejecutar smoke test ROOT.
11. Ejecutar smoke test Tenant Admin.

Ventaja:

- Deja una base limpia y repetible.

Riesgo:

- Pierde datos locales si no se hace backup.

## Decision esperada

La revision debe terminar con una decision documentada:

- `LIMPIEZA`, si la BBDD actual es recuperable.
- `RESET`, si la consistencia no esta clara.

La decision debe incluir:

- motivos,
- riesgos,
- plan de migracion,
- tablas afectadas,
- datos semilla necesarios,
- pruebas ejecutadas.

## Criterio de aceptacion

La BBDD se considera alineada cuando:

- no hay duplicidad de responsabilidades,
- no hay permisos rotos,
- no hay modulos invisibles por error,
- no hay dependencias ROOT rotas,
- no hay relaciones tenant ambiguas,
- todos los datos tenant tienen aislamiento correcto,
- se puede recrear el entorno desde cero de forma repetible,
- los smoke tests ROOT y Tenant Admin pasan.
