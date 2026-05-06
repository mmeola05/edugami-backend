const platformAuth = require("./auth.service");
const tenantAuth = require("./tenantAuth.service");

function platformContext(account) {
  return {
    scope: "platform",
    id: `platform:${account.platform_account_id}`,
    label: account.role === "ROOT" ? "Panel ROOT" : "Soporte",
    email: account.email,
    role: account.role
  };
}

function tenantContext(context) {
  return {
    scope: "tenant",
    id: `tenant:${context.tenantId}`,
    tenantId: context.tenantId,
    tenantSlug: context.tenantSlug,
    label: context.tenantName,
    roles: context.roles,
    modules: context.modules,
    permissions: context.permissions
  };
}

async function login(email, password, meta = {}) {
  const platformAccount = await platformAuth.findValidPlatformAccount(email, password);
  const tenantContexts = await tenantAuth.findValidTenantContexts(email, password);

  const contexts = [
    ...(platformAccount ? [platformContext(platformAccount)] : []),
    ...tenantContexts.map(tenantContext)
  ];

  if (contexts.length === 0) {
    await platformAuth.registerAttempt(null, email, false, { ...meta, failureReason: "invalid_unified_credentials" });
    throw new Error("INVALID_CREDENTIALS");
  }

  if (contexts.length > 1) {
    return {
      requiresContextSelection: true,
      contexts
    };
  }

  const selected = contexts[0];
  if (selected.scope === "platform") {
    const session = await platformAuth.issuePlatformSession(platformAccount, meta);
    return {
      requiresContextSelection: false,
      selectedContext: selected,
      ...session
    };
  }

  const session = await tenantAuth.login(email, password, { tenantId: selected.tenantId });
  return {
    scope: "tenant",
    requiresContextSelection: false,
    selectedContext: selected,
    ...session
  };
}

module.exports = { login };
