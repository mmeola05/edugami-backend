const { ok, fail } = require("../utils/response");
const service = require("../services/modules.service");

async function list(req, res, next) {
  try {
    return ok(res, await service.list());
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    return ok(res, await service.update(req.body.moduleKey, req.body.isEnabled, {
      actor: req.user,
      context: req.context,
      reason: req.body.reason || null
    }), "Modulo actualizado");
  } catch (error) {
    if (error.message === "CRITICAL_MODULE_DISABLE_BLOCKED") {
      return fail(res, "CRITICAL_MODULE_DISABLE_BLOCKED", "No se puede apagar este modulo critico desde catalogo global", 409);
    }
    next(error);
  }
}

module.exports = { list, update };
