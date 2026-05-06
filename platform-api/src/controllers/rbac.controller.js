const { ok, created, fail } = require("../utils/response");
const service = require("../services/rbac.service");

async function overview(req, res, next) {
  try { return ok(res, await service.overview()); } catch (error) { next(error); }
}

async function listRoles(req, res, next) {
  try { return ok(res, await service.listRoles()); } catch (error) { next(error); }
}

async function getRole(req, res, next) {
  try {
    const item = await service.getRole(req.params.roleId);
    if (!item) return fail(res, "NOT_FOUND", "Rol no encontrado", 404);
    return ok(res, item);
  } catch (error) { next(error); }
}

async function createRole(req, res, next) {
  try {
    return created(res, await service.createRole(req.body, { actor: req.user, context: req.context }), "Rol creado");
  } catch (error) { next(error); }
}

async function updateRole(req, res, next) {
  try {
    const item = await service.updateRole(req.params.roleId, req.body, { actor: req.user, context: req.context });
    if (!item) return fail(res, "NOT_FOUND", "Rol no encontrado", 404);
    return ok(res, item, "Rol actualizado");
  } catch (error) {
    if (error.message === "PROTECTED_ROLE_CODE") return fail(res, "PROTECTED_ROLE_CODE", "No puedes cambiar el code de un rol protegido", 400);
    if (error.message === "LAST_ROOT_ACCESS_BLOCKED") return fail(res, "LAST_ROOT_ACCESS_BLOCKED", "No puedes dejar al ultimo ROOT operativo sin permisos criticos", 409);
    next(error);
  }
}

async function deleteRole(req, res, next) {
  try {
    const result = await service.deleteRole(req.params.roleId, { actor: req.user, context: req.context });
    if (!result.deleted) return fail(res, "NOT_FOUND", "Rol no encontrado", 404);
    return ok(res, result, "Rol eliminado");
  } catch (error) {
    if (error.message === "PROTECTED_ROLE") return fail(res, "PROTECTED_ROLE", "No puedes eliminar un rol critico", 400);
    if (error.message === "LAST_ROOT_ACCESS_BLOCKED") return fail(res, "LAST_ROOT_ACCESS_BLOCKED", "No puedes dejar al ultimo ROOT operativo sin permisos criticos", 409);
    next(error);
  }
}

async function setRolePermissions(req, res, next) {
  try {
    const item = await service.setRolePermissions(req.params.roleId, req.body.permissionCodes, { actor: req.user, context: req.context });
    if (!item) return fail(res, "NOT_FOUND", "Rol no encontrado", 404);
    return ok(res, item, "Permisos del rol actualizados");
  } catch (error) {
    if (error.message === "LAST_ROOT_ACCESS_BLOCKED") return fail(res, "LAST_ROOT_ACCESS_BLOCKED", "No puedes quitar permisos criticos al ultimo ROOT operativo", 409);
    next(error);
  }
}

async function accountRbac(req, res, next) {
  try { return ok(res, await service.getAccountRbac(req.params.accountId)); } catch (error) { next(error); }
}

async function assignRole(req, res, next) {
  try {
    return ok(res, await service.assignRole(req.params.accountId, req.body.roleId, { actor: req.user, context: req.context }), "Rol asignado");
  } catch (error) { next(error); }
}

async function revokeRole(req, res, next) {
  try {
    return ok(res, await service.revokeRole(req.params.accountId, req.params.roleId, { actor: req.user, context: req.context }), "Rol revocado");
  } catch (error) {
    if (error.message === "PROTECTED_ROLE") return fail(res, "PROTECTED_ROLE", "No puedes revocar un rol critico desde esta operacion", 400);
    if (error.message === "LAST_ROOT_ACCESS_BLOCKED") return fail(res, "LAST_ROOT_ACCESS_BLOCKED", "No puedes dejar al ultimo ROOT operativo sin permisos criticos", 409);
    next(error);
  }
}

async function setDirectPermissions(req, res, next) {
  try {
    return ok(res, await service.setDirectPermissions(req.params.accountId, req.body.permissionCodes, { actor: req.user, context: req.context }), "Permisos directos actualizados");
  } catch (error) {
    if (error.message === "LAST_ROOT_ACCESS_BLOCKED") return fail(res, "LAST_ROOT_ACCESS_BLOCKED", "No puedes dejar al ultimo ROOT operativo sin permisos criticos", 409);
    next(error);
  }
}

module.exports = {
  overview,
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  setRolePermissions,
  accountRbac,
  assignRole,
  revokeRole,
  setDirectPermissions
};
