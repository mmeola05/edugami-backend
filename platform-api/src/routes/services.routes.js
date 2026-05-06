const express = require("express");
const router = express.Router();
const c = require("../controllers/services.controller");
const { requireAuth, requirePermission } = require("../middlewares/auth");

router.get("/", requireAuth, requirePermission("services.read"), c.list);
router.post("/:serviceKey/restart", requireAuth, requirePermission("services.command"), c.restart);

module.exports = router;
