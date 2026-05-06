const { ok } = require("../utils/response");
const service = require("../services/dashboard.service");

async function overview(req, res, next) {
  try {
    return ok(res, await service.overview());
  } catch (error) {
    next(error);
  }
}

module.exports = { overview };
