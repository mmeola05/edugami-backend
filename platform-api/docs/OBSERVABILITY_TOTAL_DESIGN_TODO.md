# Observabilidad Total EDUGAMI - Diseño Pendiente

## Estado

Pendiente de fase de diseño lógico.

No implementar código todavía. Este documento recoge el alcance para diseñar una solución enterprise de observabilidad, auditoría, errores, alertas, incident response y resiliencia de logs.

## Rol requerido

Actuar como:

- Lead Cloud Architect.
- Cybersecurity Specialist.
- Especialista en SaaS de alta criticidad.
- Especialista en observabilidad, respuesta a incidentes, PostgreSQL, Node.js, Vue.js, auditoría forense y cumplimiento normativo.

## Objetivo

Diseñar para EDUGAMI una solución de Observabilidad Total de nivel enterprise que cubra:

- trazabilidad completa de acciones CRUD,
- captura centralizada de errores frontend/backend,
- almacenamiento eficiente de logs,
- alertas automáticas ante incidentes críticos,
- reporting operativo y de seguridad,
- resiliencia, correlación y detección de anomalías.

La entrega debe ser una fase de diseño lógico completa, lista para validación técnica previa a implementación.

## Entregables obligatorios

1. Diseño lógico de arquitectura.
2. Esquema SQL propuesto.
3. Flujos de datos.
4. Políticas de auditoría y retención.
5. Estrategia de middleware y captura frontend/backend.
6. Propuestas avanzadas enterprise-grade.

## Requisitos funcionales

### 1. Auditoría CRUD / Activity Logs

Diseñar un sistema que capture todo movimiento relevante:

- `POST`
- `PUT`
- `PATCH`
- `DELETE`
- operaciones administrativas sensibles.

Campos mínimos:

- actor:
  - `user_id`,
  - rol,
  - tipo de actor,
  - tenant si aplica.
- acción:
  - operación,
  - recurso,
  - módulo,
  - severidad/categoría.
- contexto técnico:
  - IP,
  - user agent,
  - timestamp,
  - método HTTP,
  - ruta,
  - `request_id`,
  - `correlation_id`,
  - `session_id` si existe.
- payload auditado:
  - estado anterior,
  - estado nuevo,
  - diff resumido,
  - campos sensibles enmascarados o anonimizados.
- resultado:
  - éxito/error,
  - código HTTP,
  - mensaje resumido,
  - origen del fallo.

Cumplimiento:

- anonimización o seudonimización de PII,
- minimización de datos,
- integridad de evidencias,
- trazabilidad forense,
- compatibilidad conceptual con buenas prácticas normativas.

### 2. Error Tracking

Frontend Vue:

- errores de renderizado,
- errores de red,
- errores no controlados,
- promesas rechazadas,
- contexto de navegación y usuario.

Backend Node.js:

- excepciones globales,
- errores 4xx/5xx,
- fallos de base de datos,
- timeouts,
- errores de integración externa.

Clasificación:

- operativos,
- negocio,
- seguridad,
- críticos/no críticos,
- recuperables/no recuperables.

### 3. PostgreSQL y particionamiento

Diseñar `audit_logs` o `system_logs` con:

- particionamiento mensual,
- estrategia de índices,
- automatización de creación de particiones,
- archivado/purga,
- rendimiento para alto volumen.

Incluir:

- campos indexados,
- campos no indexados,
- uso de JSONB,
- riesgos de crecimiento,
- estrategia de consultas para paneles.

### 4. Alertas y ticketing

Detectar automáticamente:

- errores 500 críticos,
- fuerza bruta,
- picos anómalos de fallos,
- patrones sospechosos,
- borrados masivos,
- abuso de endpoints sensibles.

Flujo:

- generación de alerta,
- enriquecimiento,
- creación de ticket/incidente,
- panel soporte,
- estados:
  - `PENDIENTE`
  - `EN_INVESTIGACION`
  - `MITIGADO`
  - `RESUELTO`
  - `CERRADO`
- resolución y responsable.

Panel soporte:

- stack trace,
- request/response metadata,
- historial,
- `correlation_id` / `request_id`,
- severidad,
- SLA,
- acciones tomadas.

### 5. Métricas y reporting

Reportes sobre:

- errores frecuentes,
- endpoints problemáticos,
- usuarios/IPs sospechosos,
- volumen CRUD,
- tiempos de resolución,
- rendimiento soporte,
- tendencias de estabilidad.

## Mejoras avanzadas obligatorias

### A. Correlación end-to-end

Rastrear:

```txt
navegador -> frontend -> API/backend -> servicios internos -> BBDD -> logs/alertas
```

Diseñar:

- `correlation_id`,
- `request_id`,
- `trace_id`,
- propagación,
- relación entre logs, auditoría y errores.

### B. Seguridad activa

Detectar:

- borrados masivos,
- scraping abusivo,
- escalación de privilegios,
- cambios administrativos atípicos,
- auth fallida repetida,
- patrones imposibles por geolocalización/frecuencia.

Enfoque:

- reglas,
- thresholds,
- heurísticas,
- camino futuro hacia comportamiento/anomalías.

### C. Resiliencia de logs

Diseñar comportamiento ante:

- caída de BBDD de logs,
- saturación de escritura,
- cola congestionada,
- picos de eventos,
- storage secundario caído.

Proponer:

- buffering,
- colas,
- backpressure,
- reintentos,
- circuit breaker,
- degradación controlada,
- almacenamiento alternativo o diferido.

## Tablas mínimas a diseñar

1. `audit_logs`, particionada por mes.
2. `alerts`.
3. `alert_events` o equivalente para historial.
4. `incident_notes` o equivalente para resolución/seguimiento.
5. Tablas adicionales necesarias para profesionalizar la solución.

Para cada tabla definir:

- propósito,
- columnas,
- tipos,
- PK/FK,
- índices,
- particionamiento,
- JSONB,
- justificación.

## Formato de salida requerido cuando se diseñe

1. Resumen ejecutivo.
2. Arquitectura lógica.
3. Esquema de datos.
4. Auditoría y cumplimiento.
5. Middleware y captura técnica.
6. Alertas e incident response.
7. Mejoras avanzadas.
8. Riesgos, trade-offs y recomendaciones.
9. Preguntas de validación antes de implementar.

## Relación con lo ya implementado

Ya existe una primera base:

- `platform_audit_events` para cambios críticos RBAC/módulos.
- `platform_alert_events`.
- `platform_alert_deliveries`.
- `platform_login_attempts`.
- `platform_service_actions`.
- SSE para eventos ROOT.
- Auditoría BBDD mediante `npm run audit:db`.

Este diseño debe decidir si esas tablas se mantienen, se migran, se envuelven o se sustituyen por un modelo más completo.

## Siguiente paso cuando toque

Preparar documento de arquitectura completo antes de escribir código:

- decisiones técnicas,
- DDL conceptual,
- flujos,
- políticas de retención,
- estrategia de implementación por fases.

## Decision de stack por fases

Principio rector:

- No hacer todo desde cero.
- No instalar demasiadas herramientas a la vez.
- Construir a medida solo la auditoría de negocio propia de EDUGAMI.
- Usar herramientas maduras donde aporten valor claro sin comprometer rendimiento, coste ni mantenibilidad.

### Stack recomendado por fases

#### Fase 1: base propia ligera

Objetivo:

- Trazabilidad útil sin añadir demasiada infraestructura.

Hacer:

- `request_id` y `correlation_id` en backend.
- Logging estructurado con Pino / `pino-http`.
- Auditoría de negocio propia:
  - CRUD,
  - `before/after`,
  - diff,
  - actor,
  - tenant,
  - modulo,
  - IP,
  - user-agent,
  - resultado.
- Cola simple o outbox propio para desacoplar escritura de auditoría.
- Reglas internas iniciales de alerta:
  - errores 500 repetidos,
  - login fallido,
  - cambios RBAC,
  - borrados masivos.
- Diseño SQL preparado para particionamiento mensual.

Evitar en esta fase:

- Wazuh.
- PostHog.
- Redis/BullMQ salvo que ya haga falta por volumen.
- OpenTelemetry completo navegador/backend/collector.

#### Fase 2: errores y performance

Objetivo:

- Captura profesional de errores frontend/backend sin construir un sistema de error tracking propio.

Evaluar/añadir:

- Sentry para Vue.
- Sentry para Node/Express.
- Redacción estricta de PII antes de enviar eventos externos.
- Vincular Sentry event id con `correlation_id` y `request_id`.

Condiciones:

- Definir antes qué datos pueden salir a Sentry.
- Enmascarar emails, tokens, headers sensibles y payloads privados.
- No usar Sentry como auditoría legal principal.

#### Fase 3: trazas y particionado real

Objetivo:

- Trazabilidad más profunda cuando haya carga real o problemas de performance.

Evaluar/añadir:

- OpenTelemetry en backend.
- Propagación de trace context entre servicios.
- `pg_partman` si el PostgreSQL disponible lo soporta y el volumen de logs lo justifica.
- Cola robusta si el outbox simple se queda corto.

Condiciones:

- Evitar doble instrumentación Sentry/OpenTelemetry.
- Medir coste de almacenamiento y cardinalidad de atributos.
- No indexar JSONB completo sin necesidad.

#### Fase 4: seguridad operativa avanzada

Objetivo:

- Subir nivel SOC/seguridad cuando el producto lo justifique.

Evaluar:

- Wazuh para seguridad operativa, brute force, integridad, vulnerabilidades y alertas de sistema.
- PostHog solo para analytics de producto/session replay, no como reemplazo de auditoría forense.

Condiciones:

- No meter Wazuh si todo sigue en una máquina pequeña sin capacidad operativa.
- No duplicar paneles si el equipo no puede atenderlos.
- Definir responsables y flujo de respuesta antes de activar alertas avanzadas.

## Criterio de decisión

Usar herramienta externa cuando:

- resuelve un problema maduro mejor que código propio,
- reduce tiempo de diagnóstico,
- no obliga a exponer PII sin control,
- no añade carga operativa desproporcionada.

Construir propio cuando:

- depende del dominio EDUGAMI,
- requiere `before/after` y diff de entidades,
- afecta a cumplimiento/auditoría forense,
- necesita relacionarse con tenants, roles, módulos y permisos efectivos.

## Riesgo a evitar

No convertir EDUGAMI en una mezcla de herramientas inconexa:

- Sentry,
- OpenTelemetry,
- Pino,
- Wazuh,
- PostHog,
- Redis/BullMQ,
- pg_partman,
- dashboards duplicados.

La meta no es tener muchas piezas, sino trazabilidad accionable, segura y mantenible.

## Decision actual

Prioridad recomendada para cuando empiece la implementación:

1. Auditoría propia + Pino + correlation IDs.
2. Diseño SQL/outbox preparado para particiones.
3. Sentry cuando ya esté clara la política de PII.
4. OpenTelemetry/pg_partman solo si el volumen o la complejidad lo justifican.
5. Wazuh/PostHog como fases futuras, no base inicial.
