const { fail } = require("../utils/response");

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return fail(res, "VALIDATION_ERROR", error.details.map(x => x.message).join(", "), 400);
    }
    req.body = value;
    next();
  };
}

module.exports = { validate };
