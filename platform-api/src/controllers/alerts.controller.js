const { ok, created, fail } = require("../utils/response");
const service = require("../services/alerts.service");
const { publishRootEvent } = require("../realtime");

async function list(req, res, next) {
  try {
    return ok(res, await service.list(req.query || {}));
  } catch (error) {
    next(error);
  }
}

async function report(req, res, next) {
  try {
    return ok(res, await service.report());
  } catch (error) {
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    const item = await service.getDetail(req.params.alertId);
    if (!item) return fail(res, "NOT_FOUND", "Alerta no encontrada", 404);
    return ok(res, item);
  } catch (error) {
    next(error);
  }
}

async function reportFrontendError(req, res, next) {
  try {
    const alert = await service.raiseOperationalAlert({
      ruleKey: "frontend_runtime_error",
      dedupeKey: `frontend:${req.body.routePath || "unknown"}:${req.body.message || "unknown"}`,
      severity: req.body.severity || "error",
      title: "Error de frontend en ROOT UI",
      message: req.body.message || "Se produjo un error no controlado en el frontend.",
      summary: {
        component: req.body.component || null,
        stack: req.body.stack || null
      },
      context: {
        routePath: req.body.routePath || null,
        requestId: req.body.requestId || req.context?.requestId || null,
        correlationId: req.body.correlationId || req.context?.correlationId || null
      },
      sourceType: "frontend"
    });
    return created(res, alert, "Error frontend registrado");
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const alert = await service.create(req.body, {
      actor: req.user,
      context: req.context
    });
    publishRootEvent("alert", alert);
    publishRootEvent("activity", {
      type: "alert_created",
      message: `Nueva alerta: ${alert.title}`,
      createdAt: new Date()
    });
    return created(res, alert, "Alerta creada");
  } catch (error) {
    next(error);
  }
}

async function resolve(req, res, next) {
  try {
    const item = await service.resolve(req.params.alertId, req.body.resolutionNote, {
      actor: req.user,
      context: req.context
    });
    if (!item) return fail(res, "NOT_FOUND", "Alerta no encontrada", 404);
    
    publishRootEvent("alert_resolved", { id: req.params.alertId });
    publishRootEvent("activity", {
      type: "alert_resolved",
      message: `Alerta resuelta: ${item.title || req.params.alertId}`,
      createdAt: new Date()
    });
    
    return ok(res, item, "Alerta resuelta");
  } catch (error) {
    next(error);
  }
}

async function reopen(req, res, next) {
  try {
    const item = await service.reopen(req.params.alertId, {
      actor: req.user,
      context: req.context,
      note: req.body?.note || ""
    });
    if (!item) return fail(res, "NOT_FOUND", "Alerta no encontrada", 404);
    return ok(res, item, "Alerta reabierta");
  } catch (error) {
    next(error);
  }
}

async function changeStatus(req, res, next) {
  try {
    const item = await service.changeStatus(req.params.alertId, req.body.status, {
      actor: req.user,
      context: req.context,
      note: req.body.note || ""
    });
    if (!item) return fail(res, "NOT_FOUND", "Alerta no encontrada", 404);
    return ok(res, item, "Estado de alerta actualizado");
  } catch (error) {
    next(error);
  }
}

async function addNote(req, res, next) {
  try {
    const item = await service.addNote(req.params.alertId, req.body.body, {
      actor: req.user,
      noteType: req.body.noteType,
      isInternal: req.body.isInternal
    });
    if (!item) return fail(res, "NOT_FOUND", "Alerta no encontrada", 404);
    return created(res, item, "Nota registrada");
  } catch (error) {
    next(error);
  }
}

async function assign(req, res, next) {
  try {
    const item = await service.assign(req.params.alertId, req.body, {
      actor: req.user,
      context: req.context
    });
    if (!item) return fail(res, "NOT_FOUND", "Alerta no encontrada", 404);
    return ok(res, item, "Asignacion de alerta actualizada");
  } catch (error) {
    next(error);
  }
}

module.exports = { list, report, detail, reportFrontendError, create, resolve, reopen, changeStatus, addNote, assign };
