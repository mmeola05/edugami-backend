const jwt = require("jsonwebtoken");
const { config } = require("../config/config");
function getRoleExpiry(role) {
  if (role === "ROOT") return config.JWT_EXPIRES_IN_ROOT;
  return config.JWT_EXPIRES_IN_SUPPORT;
}
function sign(payload) { return jwt.sign(payload, config.JWT_SECRET, { expiresIn: getRoleExpiry(payload.role) }); }
function verify(token) { return jwt.verify(token, config.JWT_SECRET); }
module.exports = { sign, verify };
