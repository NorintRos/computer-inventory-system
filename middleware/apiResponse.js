const sendApiError = (res, status, message, details) => {
  const payload = { error: message };
  if (Array.isArray(details) && details.length) {
    payload.details = details;
  }
  return res.status(status).json(payload);
};

module.exports = { sendApiError };
