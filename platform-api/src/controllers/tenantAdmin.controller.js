const { ok, created, fail } = require("../utils/response");
const tenantUsers = require("../services/tenantUsers.service");
const tenants = require("../services/tenants.service");

async function listUsers(req, res, next) {
  try {
    return ok(res, await tenantUsers.list(req.user.tenantId));
  } catch (error) {
    return next(error);
  }
}

async function createUser(req, res, next) {
  try {
    return created(res, await tenantUsers.create(req.user.tenantId, req.body), "Usuario tenant creado");
  } catch (error) {
    if (error.message === "INVALID_TENANT_ROLE") {
      return fail(res, "INVALID_TENANT_ROLE", `Roles tenant no validos: ${error.invalidRoles.join(", ")}`, 400);
    }
    if (error.code === "23505") {
      return fail(res, "TENANT_USER_EXISTS", "Ya existe un usuario tenant con ese email", 409);
    }
    return next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const item = await tenantUsers.update(req.user.tenantId, req.params.userId, req.body);
    if (!item) return fail(res, "NOT_FOUND", "Usuario tenant no encontrado", 404);
    return ok(res, item, "Usuario tenant actualizado");
  } catch (error) {
    if (error.message === "INVALID_TENANT_ROLE") {
      return fail(res, "INVALID_TENANT_ROLE", `Roles tenant no validos: ${error.invalidRoles.join(", ")}`, 400);
    }
    return next(error);
  }
}

async function listRoles(req, res, next) {
  try {
    return ok(res, await tenants.listTenantRoles(req.user.tenantId));
  } catch (error) {
    return next(error);
  }
}

async function setRoleAccess(req, res, next) {
  try {
    const updated = await tenants.setTenantRoleAccess(req.user.tenantId, req.params.roleCode, req.body);
    if (!updated) return fail(res, "NOT_FOUND", "Rol tenant no encontrado", 404);
    return ok(res, updated, "Permisos del rol actualizados");
  } catch (error) {
    if (error.message === "INVALID_TENANT_MODULE") {
      return fail(res, "INVALID_TENANT_MODULE", `Modulos no validos: ${error.invalidKeys.join(", ")}`, 400);
    }
    if (error.message === "INVALID_TENANT_PERMISSION") {
      return fail(res, "INVALID_TENANT_PERMISSION", `Permisos no validos: ${error.invalidPermissions.join(", ")}`, 400);
    }
    return next(error);
  }
}

async function getSettings(req, res, next) {
  try {
    const settings = await tenants.getSettings(req.user.tenantId);
    return ok(res, settings);
  } catch (error) {
    return next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const settings = await tenants.updateSettings(req.user.tenantId, req.body);
    return ok(res, settings, "Configuración del centro actualizada");
  } catch (error) {
    return next(error);
  }
}

module.exports = { listUsers, createUser, updateUser, listRoles, setRoleAccess, getSettings, updateSettings };
