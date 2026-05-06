const bcrypt = require("bcryptjs");
const crypto = require("crypto");

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function randomToken() {
  return crypto.randomBytes(24).toString("hex");
}

module.exports = { hashPassword, comparePassword, randomToken };
