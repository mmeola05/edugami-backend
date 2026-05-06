# Tiempo real de EduGami

## Regla de arquitectura

### SSE
Usar SSE para:
- dashboard ROOT
- alertas globales
- métricas
- estado de servicios
- eventos pasivos de panel

### WebSocket
Reservar WebSocket para:
- progreso en vivo por usuario
- barras de progreso
- temporizadores
- minijuegos
- sesiones activas
- eventos dirigidos a usuario / clase / sesión

## Decisión actual
En esta versión:
- ROOT ya usa SSE
- WebSocket queda preparado como siguiente capa, no activado aún

## Canales recomendados para futuro
- `user:{userId}`
- `session:{sessionId}`
- `class:{classId}`

## Ventaja
Así no tienes que rehacer ROOT cuando metas tiempo real fino para alumnado o juego.
