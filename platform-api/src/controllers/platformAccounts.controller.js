const { ok, created, fail } = require("../utils/response");
const service = require("../services/platformAccounts.service");

async function list(req, res, next) {
  try {
    return ok(res, await service.list());
  } catch (error) {
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    const item = await service.detail(req.params.accountId);
    if (!item) return fail(res, "NOT_FOUND", "Cuenta no encontrada", 404);
    return ok(res, item);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    return created(res, await service.create(req.body), "Cuenta creada");
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const item = await service.update(req.params.accountId, req.body);
    if (!item) return fail(res, "NOT_FOUND", "Cuenta no encontrada", 404);
    return ok(res, item, "Cuenta actualizada");
  } catch (error) {
    next(error);
  }
}

module.exports = { list, detail, create, update };
