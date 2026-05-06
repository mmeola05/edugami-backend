const express = require("express");
const router = express.Router();
const c = require("../controllers/platformAccounts.controller");
const { requireAuth, requirePermission } = require("../middlewares/auth");
const { validate } = require("../middlewares/validate");
const s = require("../utils/schemas");

router.get("/", requireAuth, requirePermission("platform_accounts.read"), c.list);
router.get("/:accountId", requireAuth, requirePermission("platform_accounts.read"), c.detail);
router.post("/", requireAuth, requirePermission("platform_accounts.manage"), validate(s.createPlatformAccount), c.create);
router.patch("/:accountId", requireAuth, requirePermission("platform_accounts.manage"), validate(s.updatePlatformAccount), c.update);

module.exports = router;
