const { ok } = require("../utils/response");
const service = require("../services/metrics.service");
async function overview(req, res, next) {
  try {
    return ok(res, await service.overview());
  } catch (error) {
    next(error);
  }
}
async function charts(req, res, next) {
  try {
    return ok(res, await service.charts());
  } catch (error) {
    next(error);
  }
}
module.exports = { overview, charts };
