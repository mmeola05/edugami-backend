const { logger } = require("../observability/logger");
const { captureException } = require("../observability/sentry");
const alertRules = require("../services/alertRules.service");

function errorHandler(error, req, res, next) {
  logger.error({
    err: error,
    requestId: req.context?.requestId || null,
    correlationId: req.context?.correlationId || null
  }, "Unhandled request error");
  const sentryEventId = captureException(error, req);
  alertRules.handleRuntimeError({ error, req });
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
}

module.exports = { errorHandler };
