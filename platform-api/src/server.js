const app = require("./app");
const { config } = require("./config/config");
const { initDb } = require("./config/db");
const { logger } = require("./observability/logger");
const { initSentry, captureException } = require("./observability/sentry");
const { sendEmail } = require("./services/email.service");
const { alertTemplate } = require("./utils/emailTemplates.util");

initSentry();

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  captureException(error, null, { process: "uncaughtException" });
});

process.on("unhandledRejection", (error) => {
  logger.fatal({ err: error }, "Unhandled rejection");
  captureException(
    error instanceof Error ? error : new Error(String(error)),
    null,
    { process: "unhandledRejection" },
  );
});

async function notifyStartupFailure(error, context) {
  if (!config.SMTP_HOST || !config.ALERT_EMAIL_TO) return;

  try {
    const html = alertTemplate(error, {
      module: "platform-api.startup",
      ...context,
    });

    const recipients = String(config.ALERT_EMAIL_TO)
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

    await Promise.race([
      sendEmail(
        recipients,
        `[EduGami][${config.SENTRY_ENVIRONMENT}] platform-api startup failed`,
        html,
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("STARTUP_EMAIL_TIMEOUT")), 8000),
      ),
    ]);
  } catch (emailError) {
    logger.warn({ err: emailError }, "Startup failure email notification failed");
  }
}

async function start() {
  try {
    await initDb();
  } catch (error) {
    logger.fatal(
      {
        err: error,
        dbHost: config.DB_HOST,
        dbPort: config.DB_PORT,
        dbName: config.DB_NAME,
      },
      "Database connection failed during startup",
    );
    captureException(error, null, { process: "startup", dependency: "postgres" });
    await notifyStartupFailure(error, {
      dependency: "postgres",
      dbHost: config.DB_HOST,
      dbPort: config.DB_PORT,
      dbName: config.DB_NAME,
    });
    process.exit(1);
  }

  const server = app.listen(config.APP_PORT, () =>
    logger.info(`platform-api v16 listening on :${config.APP_PORT}`),
  );

  server.on("error", (error) => {
    logger.fatal({ err: error, port: config.APP_PORT }, "HTTP server failed to start");
    captureException(error, null, { process: "startup", dependency: "http" });
    notifyStartupFailure(error, {
      dependency: "http",
      port: config.APP_PORT,
    }).finally(() => process.exit(1));
  });
}
start().catch((error) => {
  logger.fatal({ err: error }, "Startup failed");
  captureException(error, null, { process: "startup" });
  notifyStartupFailure(error, { dependency: "startup" }).finally(() =>
    process.exit(1),
  );
});
