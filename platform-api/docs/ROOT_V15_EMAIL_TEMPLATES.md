# ROOT v15 - Integración de templates premium

Se ha integrado el archivo premium de templates en todo el proyecto:

## Archivo principal
- `src/utils/emailTemplates.util.js`

## Templates disponibles
- `magicLinkTemplate`
- `weeklyDigestTemplate`
- `recoveryTemplate`
- `alertTemplate`

## Compatibilidad
- `src/utils/alertTemplate.util.js` delega al nuevo `alertTemplate`
- `email.service.js` ahora también expone `sendWeeklyDigest`

## Ajustes añadidos
- soporte para `FRONTEND_URL`
- fallback a `FRONTEND_ROOT_URL`
- botón del panel ROOT enlazado desde alertas
