const express = require("express");
const router = express.Router();
const c = require("../controllers/rbac.controller");
const { requireAuth, requirePermission } = require("../middlewares/auth");
const { validate } = require("../middlewares/validate");
const s = require("../utils/schemas");

router.get("/", requireAuth, requirePermission("rbac.read"), c.overview);
router.get("/roles", requireAuth, requirePermission("rbac.read"), c.listRoles);
router.get("/roles/:roleId", requireAuth, requirePermission("rbac.read"), c.getRole);
router.post("/roles", requireAuth, requirePermission("rbac.manage"), validate(s.createRole), c.createRole);
router.patch("/roles/:roleId", requireAuth, requirePermission("rbac.manage"), validate(s.updateRole), c.updateRole);
router.delete("/roles/:roleId", requireAuth, requirePermission("rbac.manage"), c.deleteRole);
router.put("/roles/:roleId/permissions", requireAuth, requirePermission("rbac.manage"), validate(s.rolePermissions), c.setRolePermissions);

router.get("/accounts/:accountId", requireAuth, requirePermission("rbac.read"), c.accountRbac);
router.post("/accounts/:accountId/roles", requireAuth, requirePermission("rbac.manage"), validate(s.assignRole), c.assignRole);
router.delete("/accounts/:accountId/roles/:roleId", requireAuth, requirePermission("rbac.manage"), c.revokeRole);
router.put("/accounts/:accountId/permissions", requireAuth, requirePermission("rbac.manage"), validate(s.directPermissions), c.setDirectPermissions);

module.exports = router;
