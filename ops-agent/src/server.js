require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const pino = require("pino");
const pinoHttp = require("pino-http");
const Sentry = require("@sentry/node");
const os = require("os");
const net = require("net");
const { randomUUID } = require("crypto");
const { exec } = require("child_process");

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "password",
  "token",
  "refresh_token",
  "email",
  "x-ops-shared-token"
]);

function redactString(value) {
  return value.replace(EMAIL_PATTERN, "***@***");
}

function redactValue(value) {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, current]) => {
      if (SENSITIVE_KEYS.has(String(key).toLowerCase())) {
        return [key, "***"];
      }
      return [key, redactValue(current)];
    })
  );
}

const app = express();
const port = Number(process.env.OPS_AGENT_PORT || 7010);
const sharedToken = process.env.OPS_AGENT_SHARED_TOKEN || "change-me";
const sentryEnabled = process.env.OPS_SENTRY_ENABLED === "true" && Boolean(process.env.OPS_SENTRY_DSN);

const logger = pino({
  level: process.env.OPS_LOG_LEVEL || "info",
  base: { service: "ops-agent", env: process.env.OPS_SENTRY_ENVIRONMENT || "local" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers.x-ops-shared-token",
      "req.body.password",
      "req.body.token"
    ],
    censor: "***"
  },
  formatters: {
    log(object) {
      return redactValue(object);
    }
  }
});

if (sentryEnabled) {
  Sentry.init({
    dsn: process.env.OPS_SENTRY_DSN,
    environment: process.env.OPS_SENTRY_ENVIRONMENT || "local",
    tracesSampleRate: Number(process.env.OPS_SENTRY_TRACES_SAMPLE_RATE || 0),
    sendDefaultPii: false,
    beforeSend(event) {
      return redactValue(event);
    }
  });
}

function captureException(error, req, extra = {}) {
  if (!sentryEnabled) return null;

  let eventId = null;
  Sentry.withScope((scope) => {
    scope.setTag("service", "ops-agent");
    scope.setTag("request_id", req?.context?.requestId || extra.requestId || "unknown");
    scope.setTag("correlation_id", req?.context?.correlationId || extra.correlationId || "unknown");
    scope.setContext("request", redactValue({
      method: req?.method,
      path: req?.originalUrl,
      ip: req?.context?.ipAddress,
      userAgent: req?.context?.userAgent
    }));
    scope.setContext("extra", redactValue(extra));
    eventId = Sentry.captureException(error);
  });

  return eventId;
}

const httpLogger = pinoHttp({
  logger,
  customProps(req) {
    return {
      requestId: req.context?.requestId || null,
      correlationId: req.context?.correlationId || null
    };
  }
});

app.use(helmet());
app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || req.body?.requestId || randomUUID();
  const correlationId = req.headers["x-correlation-id"] || req.body?.correlationId || requestId;

  req.context = {
    requestId,
    correlationId,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] || null,
    method: req.method,
    routePath: req.originalUrl
  };

  res.setHeader("x-request-id", requestId);
  res.setHeader("x-correlation-id", correlationId);
  next();
});
app.use(httpLogger);
app.use(express.json());

const defaultServices = [
  {
    key: "platform-api",
    health: { type: "http", url: process.env.OPS_HEALTH_PLATFORM_API || "http://127.0.0.1:7002/health" },
    restartCommand: process.env.OPS_RESTART_PLATFORM_API || "",
    message: "Backend principal"
  },
  {
    key: "ops-agent",
    health: { type: "http", url: process.env.OPS_HEALTH_OPS_AGENT || `http://127.0.0.1:${port}/health` },
    restartCommand: process.env.OPS_RESTART_OPS_AGENT || "",
    message: "Agente de operaciones"
  },
  {
    key: "postgres",
    health: { type: "tcp", host: process.env.OPS_HEALTH_POSTGRES_HOST || "127.0.0.1", port: Number(process.env.OPS_HEALTH_POSTGRES_PORT || 5432) },
    restartCommand: process.env.OPS_RESTART_POSTGRES || "",
    message: "PostgreSQL"
  },
  {
    key: "mqtt",
    health: { type: "tcp", host: process.env.OPS_HEALTH_MQTT_HOST || "127.0.0.1", port: Number(process.env.OPS_HEALTH_MQTT_PORT || 1883) },
    restartCommand: process.env.OPS_RESTART_MQTT || "",
    message: "MQTT"
  },
  {
    key: "frontend",
    health: { type: "http", url: process.env.OPS_HEALTH_FRONTEND || "http://127.0.0.1:9000" },
    restartCommand: process.env.OPS_RESTART_FRONTEND || "",
    message: "Frontend"
  }
];

function loadServices() {
  if (!process.env.OPS_AGENT_SERVICES_JSON) return defaultServices;
  try {
    const parsed = JSON.parse(process.env.OPS_AGENT_SERVICES_JSON);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultServices;
  } catch {
    logger.warn("OPS_AGENT_SERVICES_JSON invalido; se usa configuracion por defecto");
    return defaultServices;
  }
}

const services = loadServices();

function auth(req, res, next) {
  if (req.headers["x-ops-shared-token"] !== sharedToken) {
    return res.status(401).json({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Shared token invalido",
        requestId: req.context?.requestId || null,
        correlationId: req.context?.correlationId || null
      }
    });
  }

  next();
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function checkHttp(url, context = {}) {
  const started = Date.now();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(2500),
    headers: {
      "x-request-id": context.requestId || randomUUID(),
      "x-correlation-id": context.correlationId || randomUUID()
    }
  });

  return {
    ok: response.ok,
    latencyMs: Date.now() - started,
    code: response.status
  };
}

function checkTcp(host, tcpPort) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.createConnection({ host, port: tcpPort });

    const finish = (ok, reason = null) => {
      socket.destroy();
      resolve({
        ok,
        latencyMs: Date.now() - started,
        reason
      });
    };

    socket.setTimeout(2500);
    socket.on("connect", () => finish(true));
    socket.on("timeout", () => finish(false, "timeout"));
    socket.on("error", (error) => finish(false, error.code || "error"));
  });
}

async function runtimeFor(service, context = {}) {
  const lastCheckAt = new Date().toISOString();

  try {
    let probe;
    if (service.health?.type === "http") {
      probe = await checkHttp(service.health.url, context);
    } else if (service.health?.type === "tcp") {
      probe = await checkTcp(service.health.host, service.health.port);
    } else {
      probe = { ok: false, reason: "health_not_configured" };
    }

    return {
      key: service.key,
      status: probe.ok ? "up" : "down",
      healthStatus: probe.ok ? "healthy" : probe.reason || "unhealthy",
      restartable: Boolean(service.restartCommand),
      pid: service.key === "ops-agent" ? process.pid : null,
      uptimeSec: service.key === "ops-agent" ? Math.round(process.uptime()) : null,
      cpuPercent: null,
      memoryMb: service.key === "ops-agent" ? Math.round(process.memoryUsage().rss / 1024 / 1024) : null,
      latencyMs: probe.latencyMs || null,
      lastCheckAt,
      message: service.message || null
    };
  } catch (error) {
    logger.warn({
      err: error,
      serviceKey: service.key,
      requestId: context.requestId || null,
      correlationId: context.correlationId || null
    }, "Health check failed");

    return {
      key: service.key,
      status: "down",
      healthStatus: error.code || "health_check_failed",
      restartable: Boolean(service.restartCommand),
      pid: service.key === "ops-agent" ? process.pid : null,
      uptimeSec: service.key === "ops-agent" ? Math.round(process.uptime()) : null,
      cpuPercent: null,
      memoryMb: service.key === "ops-agent" ? Math.round(process.memoryUsage().rss / 1024 / 1024) : null,
      latencyMs: null,
      lastCheckAt,
      message: service.message || null
    };
  }
}

async function allRuntime(context = {}) {
  return Promise.all(services.map((service) => runtimeFor(service, context)));
}

function runRestartCommand(service) {
  return new Promise((resolve, reject) => {
    if (!service.restartCommand) {
      reject(Object.assign(new Error("SERVICE_NOT_RESTARTABLE"), { code: "SERVICE_NOT_RESTARTABLE" }));
      return;
    }

    exec(service.restartCommand, { timeout: 20000 }, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(new Error("RESTART_COMMAND_FAILED"), {
          code: "RESTART_COMMAND_FAILED",
          details: stderr || error.message
        }));
        return;
      }

      resolve({
        accepted: true,
        status: "completed",
        stdout: stdout?.trim() || null,
        stderr: stderr?.trim() || null
      });
    });
  });
}

async function handleRestart(serviceKey, context = {}, body = {}) {
  const service = services.find((item) => item.key === serviceKey);
  if (!service) {
    return {
      status: 404,
      payload: { ok: false, error: { code: "SERVICE_NOT_ALLOWED", message: "Servicio no permitido" } }
    };
  }

  try {
    const result = await runRestartCommand(service);
    logger.info({
      serviceKey: service.key,
      requestId: context.requestId || null,
      correlationId: context.correlationId || null
    }, "Restart command completed");

    return {
      status: 200,
      payload: {
        ok: true,
        message: "Reinicio ejecutado",
        data: {
          serviceKey: service.key,
          accepted: true,
          restartable: true,
          commandId: randomUUID(),
          status: result.status,
          reason: body.reason || null,
          requestedBy: body.actor || null,
          requestId: context.requestId || null,
          correlationId: context.correlationId || null
        }
      }
    };
  } catch (error) {
    logger.warn({
      err: error,
      serviceKey: serviceKey,
      requestId: context.requestId || null,
      correlationId: context.correlationId || null
    }, "Restart command failed");

    const code = error.code || "RESTART_COMMAND_FAILED";
    return {
      status: code === "SERVICE_NOT_RESTARTABLE" ? 400 : 502,
      payload: {
        ok: false,
        error: {
          code,
          message: code === "SERVICE_NOT_RESTARTABLE" ? "Servicio sin comando de reinicio configurado" : "El comando de reinicio fallo",
          details: error.details || null,
          requestId: context.requestId || null,
          correlationId: context.correlationId || null
        }
      }
    };
  }
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "ops-agent", version: "16.1.0" });
});

app.get("/services", auth, asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    data: await allRuntime(req.context)
  });
}));

app.get("/summary", auth, asyncHandler(async (req, res) => {
  const total = os.totalmem();
  const free = os.freemem();

  res.json({
    ok: true,
    data: {
      host: {
        hostname: os.hostname(),
        uptimeSec: os.uptime(),
        cpuLoad1m: os.loadavg()[0],
        cpuLoad5m: os.loadavg()[1],
        cpuLoad15m: os.loadavg()[2],
        cpuCount: os.cpus().length,
        memoryUsedMb: Math.round((total - free) / 1024 / 1024),
        memoryTotalMb: Math.round(total / 1024 / 1024)
      },
      services: await allRuntime(req.context),
      collectedAt: new Date().toISOString()
    }
  });
}));

app.post("/services/:serviceKey/restart", auth, asyncHandler(async (req, res) => {
  const result = await handleRestart(req.params.serviceKey, req.context, req.body || {});
  return res.status(result.status).json(result.payload);
}));

app.post("/telegram/command", auth, asyncHandler(async (req, res) => {
  const text = String(req.body?.text || "").trim().toLowerCase();
  if (!text.startsWith("reinicia ")) {
    return res.status(400).json({ ok: false, error: { code: "UNKNOWN_COMMAND", message: "Comando no reconocido" } });
  }

  const result = await handleRestart(text.replace("reinicia ", "").trim(), req.context, req.body || {});
  return res.status(result.status).json(result.payload);
}));

app.use((error, req, res, next) => {
  logger.error({
    err: error,
    requestId: req.context?.requestId || null,
    correlationId: req.context?.correlationId || null
  }, "Unhandled ops-agent error");

  const sentryEventId = captureException(error, req);
  if (sentryEventId) {
    res.setHeader("x-sentry-event-id", sentryEventId);
  }

  res.status(500).json({
    ok: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Se ha producido un error inesperado",
      requestId: req.context?.requestId || null,
      correlationId: req.context?.correlationId || null,
      sentryEventId
    }
  });
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  captureException(error, null, { process: "uncaughtException" });
});

process.on("unhandledRejection", (error) => {
  logger.fatal({ err: error }, "Unhandled rejection");
  captureException(error instanceof Error ? error : new Error(String(error)), null, { process: "unhandledRejection" });
});

app.listen(port, () => logger.info(`ops-agent listening on :${port}`));
