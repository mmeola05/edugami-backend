const pino = require("pino");
const pinoHttp = require("pino-http");
const { config } = require("../config/config");
const { redactValue } = require("./privacy");

const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: "platform-api", env: config.SENTRY_ENVIRONMENT },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers.x-ops-shared-token",
      "req.body.password",
      "req.body.token",
      "req.body.refreshToken",
      "res.headers['set-cookie']"
    ],
    censor: "***"
  },
  formatters: {
    log(object) {
      return redactValue(object);
    }
  }
});

const httpLogger = pinoHttp({
  logger,
  customProps(req) {
    return {
      requestId: req.context?.requestId || null,
      correlationId: req.context?.correlationId || null
    };
  },
  customSuccessMessage(req, res) {
    return `${req.method} ${req.originalUrl} -> ${res.statusCode}`;
  },
  customErrorMessage(req, res, error) {
    return `${req.method} ${req.originalUrl} -> ${res.statusCode} (${error.message})`;
  }
});

module.exports = { logger, httpLogger };
