const express = require("express");
const router = express.Router();
const c = require("../controllers/realtime.controller");
const { requireAuth, requirePermission } = require("../middlewares/auth");
router.get('/stream', requireAuth, requirePermission('dashboard.read'), c.stream);
router.get('/status', requireAuth, requirePermission('dashboard.read'), c.status);
module.exports = router;
