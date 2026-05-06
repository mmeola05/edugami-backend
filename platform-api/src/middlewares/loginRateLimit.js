const { fail } = require("../utils/response");
const { config } = require("../config/config");
const memory = new Map();
function loginRateLimit(req,res,next){
  const key = `${req.ip}:${String(req.body?.email||"").toLowerCase()}`;
  const now = Date.now();
  const windowMs = config.LOGIN_RATE_WINDOW_MINUTES * 60 * 1000;
  const record = memory.get(key) || { count:0, firstAt: now };
  if (now - record.firstAt > windowMs) { record.count = 0; record.firstAt = now; }
  record.count += 1; memory.set(key, record);
  if (record.count > config.LOGIN_RATE_MAX_ATTEMPTS) return fail(res, 'RATE_LIMITED', 'Demasiados intentos de login. Prueba más tarde.', 429);
  next();
}
module.exports = { loginRateLimit };
