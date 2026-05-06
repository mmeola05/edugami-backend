const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SENSITIVE_KEYS = new Set([
  "password",
  "password_hash",
  "newpassword",
  "token",
  "access_token",
  "refresh_token",
  "refreshtoken",
  "authorization",
  "cookie",
  "secret",
  "api_key",
  "apikey",
  "smtp_pass",
  "email",
  "actor_email",
  "x-ops-shared-token"
]);

function redactString(value) {
  return value.replace(EMAIL_PATTERN, "***@***");
}

function serializeError(error, seen, depth) {
  const serialized = {
    name: error.name,
    message: redactString(String(error.message || "")),
    stack: typeof error.stack === "string" ? redactString(error.stack) : undefined
  };

  if (error.code) serialized.code = error.code;
  if (error.type) serialized.type = error.type;
  if (error.cause) serialized.cause = redactValue(error.cause, seen, depth + 1);

  for (const [key, current] of Object.entries(error)) {
    if (serialized[key] !== undefined) continue;
    serialized[key] = redactValue(current, seen, depth + 1);
  }

  return serialized;
}

function redactValue(value, seen = new WeakSet(), depth = 0) {
  if (typeof value === "string") return redactString(value);
  if (!value || typeof value !== "object") return value;
  if (depth > 8) return "[MaxDepth]";
  if (seen.has(value)) return "[Circular]";

  seen.add(value);

  if (value instanceof Error) return serializeError(value, seen, depth);
  if (Array.isArray(value)) {
    return value
      .slice(0, 100)
      .map((item) => redactValue(item, seen, depth + 1));
  }

  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length}]`;

  return Object.fromEntries(
    Object.entries(value).map(([key, current]) => {
      if (SENSITIVE_KEYS.has(String(key).toLowerCase())) {
        return [key, "***"];
      }
      return [key, redactValue(current, seen, depth + 1)];
    })
  );
}

module.exports = { redactValue, SENSITIVE_KEYS };
