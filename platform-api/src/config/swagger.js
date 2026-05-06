const swaggerJsDoc = require("swagger-jsdoc");

module.exports = swaggerJsDoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "EduGami ROOT API", version: "16.0.0" },
    servers: [{ url: "http://localhost:7002/api/v1" }]
  },
  apis: ["./src/routes/*.js"]
});
