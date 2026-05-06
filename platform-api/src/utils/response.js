function ok(res, data = {}, message = "OK") {
  return res.status(200).json({
    ok: true,
    message,
    data,
    meta: {
      requestId: res.getHeader("x-request-id") || null,
      correlationId: res.getHeader("x-correlation-id") || null
    }
  });
}

function created(res, data = {}, message = "Created") {
  return res.status(201).json({
    ok: true,
    message,
    data,
    meta: {
      requestId: res.getHeader("x-request-id") || null,
      correlationId: res.getHeader("x-correlation-id") || null
    }
  });
}

function fail(res, code, message, status = 400) {
  return res.status(status).json({
    ok: false,
    error: {
      code,
      message,
      requestId: res.getHeader("x-request-id") || null,
      correlationId: res.getHeader("x-correlation-id") || null
    }
  });
}

module.exports = { ok, created, fail };
