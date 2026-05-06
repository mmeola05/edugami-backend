const { ok } = require("../utils/response");
const service = require("../services/audit.service");

async function list(req, res, next) {
  try {
    return ok(res, await service.list(req.query));
  } catch (error) {
    next(error);
  }
}

module.exports = { list };
