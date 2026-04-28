const { sendApiError } = require('./apiResponse');

const adminOnly = (req, res, next) => {
  if (!req.user) {
    return sendApiError(res, 401, 'Authentication required');
  }
  if (req.user.role !== 'Admin') {
    return sendApiError(res, 403, 'Admin access required');
  }
  return next();
};

module.exports = { adminOnly };
