const { ok, created, fail } = require("../utils/response");
const service = require("../services/tenants.service");
const { publishRootEvent } = require("../realtime");

async function list(req, res, next) {
  try {
    const filters = {
      status: req.query.status,
      type: req.query.type,
      search: req.query.search
    };
    return ok(res, await service.list(filters));
  } catch (error) {
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    const item = await service.detail(req.params.tenantId);
    if (!item) return fail(res, "NOT_FOUND", "Tenant no encontrado", 404);
    return ok(res, item);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const tenant = await service.create(req.body);
    publishRootEvent("activity", {
      type: "tenant_created",
      message: `Nuevo tenant creado: ${tenant.name}`,
      createdAt: new Date()
    });
    return created(res, tenant, "Tenant creado");
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const item = await service.update(req.params.tenantId, req.body);
    if (!item) return fail(res, "NOT_FOUND", "Tenant no encontrado", 404);
    return ok(res, item, "Tenant actualizado");
  } catch (error) {
    next(error);
  }
}

async function suspend(req, res, next) {
  try {
    const item = await service.suspend(req.params.tenantId);
    if (!item) return fail(res, "NOT_FOUND", "Tenant no encontrado", 404);
    
    publishRootEvent("activity", {
      type: "tenant_suspended",
      message: `Tenant suspendido: ${item.name}`,
      createdAt: new Date()
    });
    
    return ok(res, item, "Tenant suspendido");
  } catch (error) {
    next(error);
  }
}

async function listModules(req, res, next) {
  try {
    return ok(res, await service.listModules(req.params.tenantId));
  } catch (error) {
    next(error);
  }
}

async function listEffectiveModules(req, res, next) {
  try {
    return ok(res, await service.listEffectiveModules(req.params.tenantId));
  } catch (error) {
    next(error);
  }
}

async function setModules(req, res, next) {
  try {
    return ok(res, await service.setModules(req.params.tenantId, req.body.modules), "Módulos actualizados");
  } catch (error) {
    if (error.message === "INVALID_TENANT_MODULE") {
      return fail(res, "INVALID_TENANT_MODULE", `Modulos no validos para tenant: ${error.invalidKeys.join(", ")}`, 400);
    }
    next(error);
  }
}

async function listTenantRoles(req, res, next) {
  try {
    return ok(res, await service.listTenantRoles(req.params.tenantId));
  } catch (error) {
    next(error);
  }
}

async function getTenantRole(req, res, next) {
  try {
    const item = await service.getTenantRole(req.params.tenantId, req.params.roleCode);
    if (!item) return fail(res, "NOT_FOUND", "Rol tenant no encontrado", 404);
    return ok(res, item);
  } catch (error) {
    next(error);
  }
}

async function setTenantRoleAccess(req, res, next) {
  try {
    const item = await service.setTenantRoleAccess(req.params.tenantId, req.params.roleCode, req.body);
    if (!item) return fail(res, "NOT_FOUND", "Rol tenant no encontrado", 404);
    return ok(res, item, "Acceso del rol tenant actualizado");
  } catch (error) {
    if (error.message === "INVALID_TENANT_MODULE") {
      return fail(res, "INVALID_TENANT_MODULE", `Modulos no validos para tenant: ${error.invalidKeys.join(", ")}`, 400);
    }
    if (error.message === "INVALID_TENANT_PERMISSION") {
      return fail(res, "INVALID_TENANT_PERMISSION", `Permisos no validos para tenant: ${error.invalidPermissions.join(", ")}`, 400);
    }
    next(error);
  }
}

module.exports = { list, detail, create, update, suspend, listModules, listEffectiveModules, setModules, listTenantRoles, getTenantRole, setTenantRoleAccess };
