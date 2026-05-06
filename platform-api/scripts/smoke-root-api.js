require("dotenv").config();

const { Pool } = require("pg");
const { sign } = require("../src/utils/jwt");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function getRootAccount() {
  const result = await pool.query(`
    SELECT platform_account_id, role
    FROM platform_accounts
    WHERE role = 'ROOT' AND status = 'active'
    LIMIT 1
  `);
  return result.rows[0] || null;
}

async function getPermissions(accountId) {
  const result = await pool.query(`
    SELECT DISTINCT p.permission_code
    FROM permissions p
    LEFT JOIN platform_role_permissions rp ON rp.permission_code = p.permission_code
    LEFT JOIN platform_role_assignments ra ON ra.role_id = rp.role_id
    LEFT JOIN platform_account_permissions ap ON ap.permission_code = p.permission_code
    WHERE ra.platform_account_id = $1 OR ap.platform_account_id = $1
    ORDER BY p.permission_code
  `, [accountId]);
  return result.rows.map((row) => row.permission_code);
}

async function main() {
  const account = await getRootAccount();
  if (!account) throw new Error("No active ROOT account found");

  const permissions = await getPermissions(account.platform_account_id);
  const token = sign({
    sub: account.platform_account_id,
    role: account.role,
    scope: "platform"
  });

  const endpoints = [
    "auth/me",
    "auth/access",
    "root/dashboard",
    "root/tenants",
    "root/modules",
    "root/metrics/overview",
    "root/services",
    "root/alerts",
    "root/platform-accounts",
    "root/rbac",
    "root/audit"
  ];

  const firstTenant = await pool.query("SELECT tenant_id FROM tenants ORDER BY created_at LIMIT 1");
  if (firstTenant.rows[0]) {
    const tenantId = firstTenant.rows[0].tenant_id;
    endpoints.push(`root/tenants/${tenantId}/modules/effective`);
    endpoints.push(`root/tenants/${tenantId}/roles`);
    endpoints.push(`root/tenants/${tenantId}/users`);
  }

  for (const endpoint of endpoints) {
    const response = await fetch(`http://localhost:7002/api/v1/${endpoint}`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const body = await response.json();
    const status = body.ok === true ? "ok" : JSON.stringify(body.error || body);
    console.log(`${endpoint} ${response.status} ${status}`);
  }
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
