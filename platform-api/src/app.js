const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const routes = require("./routes");
const swagger = require("./config/swagger");
const { errorHandler } = require("./middlewares/error");
const { requestContext } = require("./middlewares/requestContext");
const { httpLogger } = require("./observability/logger");
const app = express();
app.use(helmet());
app.use(cors());
app.use(requestContext);
app.use(httpLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/health", (req, res) =>
  res.json({ ok: true, service: "platform-api", version: "16.0.0" }),
);
app.use("/api/v1", routes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swagger));
app.get("/openapi.json", (req, res) => res.json(swagger));
app.use((req, res) =>
  res
    .status(404)
    .json({
      ok: false,
      error: { code: "NOT_FOUND", message: "Ruta no encontrada" },
    }),
);
app.use(errorHandler);
module.exports = app;
