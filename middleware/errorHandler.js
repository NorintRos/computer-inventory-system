// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const isClientError = status >= 400 && status < 500;

  console.error(err.stack);

  res.status(status).json({
    error: isClientError && err.message ? err.message : 'Internal Server Error',
  });
};

module.exports = errorHandler;
