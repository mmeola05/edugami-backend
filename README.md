# EduGami Backend

Este repositorio contiene los dos backends de EduGami:

- `platform-api/`: API principal.
- `ops-agent/`: agente/API secundaria de operaciones.

## Arranque local

Instala dependencias dentro de cada carpeta:

```bash
cd platform-api
npm install
npm run dev
```

```bash
cd ops-agent
npm install
npm run dev
```

Configura las variables de entorno en archivos `.env` locales. Los `.env` no se suben al repositorio.
