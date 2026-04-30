const rateLimit = require('express-rate-limit');

const options = {
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    if (req.path.startsWith('/api') || !req.accepts('html')) {
      return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }
    return res.status(429).render('429', { title: 'Too many requests', layout: 'main' });
  },
};

const limiter = rateLimit(options);
limiter.options = options;

module.exports = limiter;
