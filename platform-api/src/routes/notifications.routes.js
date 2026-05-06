const express = require("express");
const controller = require("../controllers/notifications.controller");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

// Save or update push token
router.post("/token", requireAuth, (req, res, next) => controller.saveToken(req, res, next));

// List all tokens for current user
router.get("/tokens", requireAuth, (req, res, next) => controller.listTokens(req, res, next));

// Remove a specific token
router.delete("/tokens/:tokenId", requireAuth, (req, res, next) => controller.removeToken(req, res, next));

module.exports = router;
