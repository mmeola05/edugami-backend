const { ok, fail } = require("../utils/response");
const service = require("../services/services.service");

async function list(req, res, next) {
  try {
    return ok(res, await service.list());
  } catch (error) {
    next(error);
  }
}

async function restart(req, res, next) {
  try {
    return ok(res, await service.restart(req.params.serviceKey, {
      actor: req.user,
      context: req.context,
      reason: req.body?.reason || null
    }), "Reinicio solicitado");
  } catch (error) {
    if (error.message === "SERVICE_NOT_FOUND") return fail(res, "SERVICE_NOT_FOUND", "Servicio no encontrado", 404);
    if (error.message === "SERVICE_NOT_RESTARTABLE") return fail(res, "SERVICE_NOT_RESTARTABLE", "Servicio no reiniciable", 400);
    if (error.message === "OPS_AGENT_RESTART_FAILED") return fail(res, "OPS_AGENT_RESTART_FAILED", "El agente no pudo reiniciar el servicio", 502);
    next(error);
  }
}

module.exports = { list, restart };
