const rateLimit = require('express-rate-limit');

const options = {
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
};

const limiter = rateLimit(options);
limiter.options = options;

module.exports = limiter;
