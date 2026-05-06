const { ok, created, fail } = require("../utils/response");
const service = require("../services/notifications.service");

async function saveToken(req, res, next) {
  try {
    const { token, platform } = req.body;
    if (!token) return fail(res, "INVALID_INPUT", "Token is required", 400);
    
    const result = await service.saveToken(req.user.sub, token, platform);
    return created(res, result, "Push token saved");
  } catch (error) {
    next(error);
  }
}

async function listTokens(req, res, next) {
  try {
    const tokens = await service.listTokens(req.user.sub);
    return ok(res, tokens);
  } catch (error) {
    next(error);
  }
}

async function removeToken(req, res, next) {
  try {
    const { tokenId } = req.params;
    const result = await service.removeToken(req.user.sub, tokenId);
    if (!result) return fail(res, "NOT_FOUND", "Token not found", 404);
    return ok(res, result, "Token removed");
  } catch (error) {
    next(error);
  }
}

module.exports = { saveToken, listTokens, removeToken };
