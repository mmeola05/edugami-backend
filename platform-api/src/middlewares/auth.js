const { verify } = require("../utils/jwt");
const { fail } = require("../utils/response");
const platformAuth = require("../services/auth.service");

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const [scheme, headerToken] = auth.split(" ");
  const token = (scheme === "Bearer" ? headerToken : null) || req.query.token;

  if (!token) {
    return fail(res, "AUTH_REQUIRED", "Debes autenticarte", 401);
  }

  try {
    req.user = verify(token);
    return next();
  } catch {
    return fail(res, "INVALID_TOKEN", "Token inválido o expirado", 401);
  }
}

function requirePermission(permission) {
  return async (req, res, next) => {
    let permissions = req.user?.permissions || [];
    if (req.user?.scope === "platform" && req.user?.sub) {
      try {
        permissions = await platformAuth.getPermissions(req.user.sub);
        req.user.permissions = permissions;
      } catch (error) {
        return next(error);
      }
    }
    if (permissions.includes("*") || permissions.includes(permission)) {
      return next();
    }
    return fail(res, "FORBIDDEN", `Falta el permiso ${permission}`, 403);
  };
}

module.exports = { requireAuth, requirePermission };
