const { ok } = require("../utils/response");
const reportsService = require("../services/tenantReports.service");

async function dashboard(req, res, next) {
  try {
    const data = await reportsService.getDashboard(req.user.tenantId, req.access);
    return ok(res, data, "Dashboard de informes recuperado");
  } catch (error) {
    return next(error);
  }
}

module.exports = { dashboard };
