const Sentry = require("@sentry/node");
const { config } = require("../config/config");
const { redactValue } = require("./privacy");

function initSentry() {
  if (!config.SENTRY_ENABLED || !config.SENTRY_DSN) return;

  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.SENTRY_ENVIRONMENT,
    tracesSampleRate: config.SENTRY_TRACES_SAMPLE_RATE,
    sendDefaultPii: false,
    beforeSend(event) {
      const safe = redactValue(event);
      if (safe.request?.headers) {
        delete safe.request.headers.authorization;
        delete safe.request.headers.cookie;
        delete safe.request.headers["x-ops-shared-token"];
      }
      return safe;
    }
  });
}

function captureException(error, req, extra = {}) {
  if (!config.SENTRY_ENABLED || !config.SENTRY_DSN) return null;

  let eventId = null;
  Sentry.withScope((scope) => {
    scope.setTag("service", "platform-api");
    scope.setTag("request_id", req?.context?.requestId || extra.requestId || "unknown");
    scope.setTag("correlation_id", req?.context?.correlationId || extra.correlationId || "unknown");
    if (req?.user?.sub) scope.setUser({ id: req.user.sub });
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

module.exports = { Sentry, initSentry, captureException };
