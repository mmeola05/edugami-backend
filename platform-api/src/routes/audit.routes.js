const express = require("express");
const router = express.Router();
const c = require("../controllers/audit.controller");
const { requireAuth, requirePermission } = require("../middlewares/auth");

router.get("/", requireAuth, requirePermission("audit.read"), c.list);

module.exports = router;
