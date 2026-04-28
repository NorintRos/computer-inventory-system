const { validationResult } = require('express-validator');
const { sendApiError } = require('./apiResponse');

const normalizeValidationErrors = (rawErrors) =>
  rawErrors.map((err) => ({
    field: err.path,
    location: err.location,
    message: err.msg,
  }));

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const details = normalizeValidationErrors(errors.array());

  return res.status(400).json({
    error: 'Validation failed',
    details,
    errors: details,
  });
};

module.exports = { validateRequest, normalizeValidationErrors, sendApiError };
