const express = require("express");
const router = express.Router();
const c = require("../controllers/metrics.controller");
const { requireAuth, requirePermission } = require("../middlewares/auth");
router.get('/overview', requireAuth, requirePermission('dashboard.read'), c.overview);
router.get('/charts', requireAuth, requirePermission('dashboard.read'), c.charts);
module.exports = router;
