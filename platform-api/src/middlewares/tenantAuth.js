const { fail } = require("../utils/response");
const tenantUsers = require("../services/tenantUsers.service");

function requireTenantAuth(req, res, next) {
  if (req.user?.scope !== "tenant" || !req.user?.tenantId || !req.user?.sub) {
    return fail(res, "TENANT_AUTH_REQUIRED", "Debes iniciar sesion en un tenant", 401);
  }
  return next();
}

async function attachTenantAccess(req, res, next) {
  try {
    const access = await tenantUsers.getEffectiveAccess(req.user.tenantId, req.user.sub);
    if (!access) return fail(res, "TENANT_AUTH_REQUIRED", "Sesion tenant no valida", 401);
    req.tenantAccess = access;
    req.user.permissions = access.permissions;
    req.user.roles = access.roles.map((role) => role.code);
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireTenantPermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.tenantAccess) {
        const access = await tenantUsers.getEffectiveAccess(req.user.tenantId, req.user.sub);
        if (!access) return fail(res, "TENANT_AUTH_REQUIRED", "Sesion tenant no valida", 401);
        req.tenantAccess = access;
        req.user.permissions = access.permissions;
        req.user.roles = access.roles.map((role) => role.code);
      }

      if (req.tenantAccess.permissions.includes("*") || req.tenantAccess.permissions.includes(permission)) {
        return next();
      }

      return fail(res, "FORBIDDEN", `Falta el permiso ${permission}`, 403);
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { requireTenantAuth, attachTenantAccess, requireTenantPermission };
