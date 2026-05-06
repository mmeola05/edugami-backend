const express = require("express");
const router = express.Router();
const c = require("../controllers/dashboard.controller");
const { requireAuth, requirePermission } = require("../middlewares/auth");

router.get("/", requireAuth, requirePermission("dashboard.read"), c.overview);

module.exports = router;
