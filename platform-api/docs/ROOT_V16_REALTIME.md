# ROOT v16 - Tiempo real bien planteado

## Decisión final

### ROOT
- usa **SSE**
- sirve para panel, alertas, métricas y estado

### Futuro por usuario / sesión
- queda preparado para **WebSocket**
- pensado para barras de progreso, contadores y sesiones vivas

## Por qué así
No mezclas todo en una sola tecnología y no rehaces ROOT después.

## Carpeta nueva
- `src/realtime/`

## Archivos
- `src/realtime/index.js`
- `src/realtime/rootSseHub.js`
- `src/realtime/channelKeys.js`

## Reglas
- `ROOT` → SSE
- `user:{userId}` → WebSocket futuro
- `session:{sessionId}` → WebSocket futuro
- `class:{classId}` → WebSocket futuro
