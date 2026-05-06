const { ok, fail } = require("../utils/response");
const auth = require("../services/auth.service");
const tenantAuth = require("../services/tenantAuth.service");
const unifiedAuth = require("../services/unifiedAuth.service");
const { sendEmail } = require("../services/email.service");
const { recoveryTemplate } = require("../utils/emailTemplates.util");

async function login(req, res, next) {
  try {
    return ok(res, await auth.login(req.body.email, req.body.password, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      context: req.context
    }), "Login correcto");
  } catch (error) {
    if (error.message === "INVALID_CREDENTIALS") return fail(res, "INVALID_CREDENTIALS", "Credenciales invalidas", 401);
    if (error.message === "ACCOUNT_SUSPENDED") return fail(res, "ACCOUNT_SUSPENDED", "Cuenta suspendida", 403);
    if (error.message === "ACCOUNT_LOCKED") return fail(res, "ACCOUNT_LOCKED", "Cuenta bloqueada temporalmente por intentos fallidos", 423);
    next(error);
  }
}

async function unifiedLogin(req, res, next) {
  try {
    return ok(res, await unifiedAuth.login(req.body.email, req.body.password, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      context: req.context
    }), "Login correcto");
  } catch (error) {
    if (error.message === "INVALID_CREDENTIALS") return fail(res, "INVALID_CREDENTIALS", "Credenciales invalidas", 401);
    next(error);
  }
}

async function tenantLogin(req, res, next) {
  try {
    return ok(
      res,
      await tenantAuth.login(req.body.email, req.body.password, {
        tenantId: req.body.tenantId,
        tenantSlug: req.body.tenantSlug,
        context: req.context
      }),
      "Login tenant correcto"
    );
  } catch (error) {
    if (error.message === "INVALID_CREDENTIALS") return fail(res, "INVALID_CREDENTIALS", "Credenciales invalidas", 401);
    if (error.message === "TENANT_SUSPENDED") return fail(res, "TENANT_SUSPENDED", "Tenant suspendido", 403);
    if (error.message === "ACCOUNT_SUSPENDED") return fail(res, "ACCOUNT_SUSPENDED", "Cuenta suspendida", 403);
    if (error.message === "TENANT_CONTEXT_NOT_ALLOWED") return fail(res, "TENANT_CONTEXT_NOT_ALLOWED", "Contexto tenant no autorizado", 403);
    next(error);
  }
}

async function me(req, res, next) {
  try {
    if (req.user.scope !== "platform") {
      return fail(res, "INVALID_PLATFORM_TOKEN", "Token de plataforma invalido", 401);
    }
    return ok(res, {
      platformAccountId: req.user.sub,
      role: req.user.role
    });
  } catch (error) {
    next(error);
  }
}

async function platformAccess(req, res, next) {
  try {
    if (req.user.scope !== "platform") {
      return fail(res, "INVALID_PLATFORM_TOKEN", "Token de plataforma invalido", 401);
    }
    const permissions = await auth.getPermissions(req.user.sub);
    return ok(res, {
      permissions,
      modules: await auth.getEffectivePlatformModules(req.user.role, permissions)
    });
  } catch (error) {
    next(error);
  }
}

async function refresh(req, res, next) {
  try {
    return ok(res, await auth.refresh(req.body.refreshToken), "Sesion renovada");
  } catch (error) {
    if (error.message === "INVALID_REFRESH_TOKEN") return fail(res, "INVALID_REFRESH_TOKEN", "Refresh token invalido", 401);
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    return ok(res, await auth.logout(req.body.refreshToken), "Sesion cerrada");
  } catch (error) {
    next(error);
  }
}

async function tenantRefresh(req, res, next) {
  try {
    return ok(res, await tenantAuth.refresh(req.body.refreshToken), "Sesion tenant renovada");
  } catch (error) {
    if (error.message === "INVALID_REFRESH_TOKEN") return fail(res, "INVALID_REFRESH_TOKEN", "Refresh token invalido", 401);
    next(error);
  }
}

async function tenantLogout(req, res, next) {
  try {
    return ok(res, await tenantAuth.logout(req.body.refreshToken), "Sesion tenant cerrada");
  } catch (error) {
    next(error);
  }
}

async function tenantSwitchContext(req, res, next) {
  try {
    return ok(
      res,
      await tenantAuth.switchContext(req.user, {
        tenantId: req.body.tenantId,
        tenantSlug: req.body.tenantSlug
      }),
      "Contexto tenant actualizado"
    );
  } catch (error) {
    if (error.message === "INVALID_TENANT_TOKEN") return fail(res, "INVALID_TENANT_TOKEN", "Token tenant invalido o sin acceso", 401);
    if (error.message === "TENANT_CONTEXT_REQUIRED") return fail(res, "TENANT_CONTEXT_REQUIRED", "Selecciona un contexto tenant", 400);
    if (error.message === "TENANT_CONTEXT_NOT_ALLOWED") return fail(res, "TENANT_CONTEXT_NOT_ALLOWED", "Contexto tenant no autorizado", 403);
    if (error.message === "TENANT_SUSPENDED") return fail(res, "TENANT_SUSPENDED", "Tenant suspendido", 403);
    if (error.message === "ACCOUNT_SUSPENDED") return fail(res, "ACCOUNT_SUSPENDED", "Cuenta suspendida", 403);
    next(error);
  }
}

async function tenantMe(req, res, next) {
  try {
    return ok(res, await tenantAuth.me(req.user));
  } catch (error) {
    if (error.message === "INVALID_TENANT_TOKEN") return fail(res, "INVALID_TENANT_TOKEN", "Token tenant invalido o sin acceso", 401);
    next(error);
  }
}

async function tenantAccess(req, res, next) {
  try {
    return ok(res, await tenantAuth.access(req.user));
  } catch (error) {
    if (error.message === "INVALID_TENANT_TOKEN") return fail(res, "INVALID_TENANT_TOKEN", "Token tenant invalido o sin acceso", 401);
    next(error);
  }
}

async function requestRecovery(req, res, next) {
  try {
    const result = await auth.requestRecovery(req.body.email);
    if (result.recoveryUrl && result.email) {
      await sendEmail(result.email, "Recuperacion de contrasena ROOT", recoveryTemplate(result.recoveryUrl));
    }
    return ok(res, { accepted: true }, "Solicitud procesada");
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    return ok(res, await auth.resetPassword(req.body.token, req.body.newPassword), "Contrasena actualizada");
  } catch (error) {
    if (error.message === "INVALID_TOKEN") return fail(res, "INVALID_TOKEN", "Token invalido o expirado", 400);
    next(error);
  }
}

module.exports = {
  login,
  unifiedLogin,
  tenantLogin,
  me,
  refresh,
  logout,
  tenantRefresh,
  tenantLogout,
  tenantSwitchContext,
  tenantMe,
  platformAccess,
  tenantAccess,
  requestRecovery,
  resetPassword
};
