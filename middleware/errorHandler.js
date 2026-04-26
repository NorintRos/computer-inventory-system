// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const isClientError = status >= 400 && status < 500;

  console.error(err.stack);

  const message =
    isClientError && err.message ? err.message : 'An unexpected error occurred.';

  const isApi = req.path.startsWith('/api');
  if (!isApi && req.accepts('html')) {
    return res.status(status).render('error', {
      title: status >= 500 ? 'Something went wrong' : 'Error',
      message,
      layout: 'main',
    });
  }

  return res.status(status).json({
    error: isClientError && err.message ? err.message : 'Internal Server Error',
  });
};

module.exports = errorHandler;
