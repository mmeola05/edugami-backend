const { ok, created, fail } = require("../utils/response");
const service = require("../services/tenantUsers.service");

async function list(req, res, next) {
  try {
    return ok(res, await service.list(req.params.tenantId));
  } catch (error) {
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    const item = await service.detail(req.params.tenantId, req.params.userId);
    if (!item) return fail(res, "NOT_FOUND", "Usuario tenant no encontrado", 404);
    return ok(res, item);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    return created(res, await service.create(req.params.tenantId, req.body), "Usuario tenant creado");
  } catch (error) {
    if (error.message === "INVALID_TENANT_ROLE") {
      return fail(res, "INVALID_TENANT_ROLE", `Roles tenant no validos: ${error.invalidRoles.join(", ")}`, 400);
    }
    if (error.code === "23505") {
      return fail(res, "TENANT_USER_EXISTS", "Ya existe un usuario tenant con ese email", 409);
    }
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const item = await service.update(req.params.tenantId, req.params.userId, req.body);
    if (!item) return fail(res, "NOT_FOUND", "Usuario tenant no encontrado", 404);
    return ok(res, item, "Usuario tenant actualizado");
  } catch (error) {
    if (error.message === "INVALID_TENANT_ROLE") {
      return fail(res, "INVALID_TENANT_ROLE", `Roles tenant no validos: ${error.invalidRoles.join(", ")}`, 400);
    }
    next(error);
  }
}

async function setRoles(req, res, next) {
  try {
    const item = await service.setRoles(req.params.tenantId, req.params.userId, req.body.roleCodes);
    if (!item) return fail(res, "NOT_FOUND", "Usuario tenant no encontrado", 404);
    return ok(res, item, "Roles tenant actualizados");
  } catch (error) {
    if (error.message === "INVALID_TENANT_ROLE") {
      return fail(res, "INVALID_TENANT_ROLE", `Roles tenant no validos: ${error.invalidRoles.join(", ")}`, 400);
    }
    next(error);
  }
}

async function effectiveAccess(req, res, next) {
  try {
    const item = await service.getEffectiveAccess(req.params.tenantId, req.params.userId);
    if (!item) return fail(res, "NOT_FOUND", "Usuario tenant no encontrado o suspendido", 404);
    return ok(res, item);
  } catch (error) {
    next(error);
  }
}

module.exports = { list, detail, create, update, setRoles, effectiveAccess };
