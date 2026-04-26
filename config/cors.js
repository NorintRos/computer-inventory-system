const corsOptions = {
  origin(origin, callback) {
    // Allow same-origin (origin is undefined for same-origin requests)
    if (!origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

module.exports = corsOptions;
