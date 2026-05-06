const { randomUUID } = require("crypto");

function requestContext(req, res, next) {
  const requestId = req.headers["x-request-id"] || randomUUID();
  const correlationId = req.headers["x-correlation-id"] || requestId;

  req.context = {
    requestId,
    correlationId,
    startedAt: new Date().toISOString(),
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] || null,
    method: req.method,
    routePath: req.originalUrl,
    sessionId: req.headers["x-session-id"] || null
  };

  res.setHeader("x-request-id", requestId);
  res.setHeader("x-correlation-id", correlationId);
  next();
}

module.exports = { requestContext };
