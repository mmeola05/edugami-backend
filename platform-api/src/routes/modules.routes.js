const express = require("express");
const router = express.Router();
const c = require("../controllers/modules.controller");
const { requireAuth, requirePermission } = require("../middlewares/auth");
const { validate } = require("../middlewares/validate");
const s = require("../utils/schemas");

router.get("/", requireAuth, requirePermission("platform_modules.read"), c.list);
router.put("/", requireAuth, requirePermission("platform_modules.manage"), validate(s.updatePlatformModule), c.update);

module.exports = router;
