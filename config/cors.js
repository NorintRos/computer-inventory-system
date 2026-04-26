const corsOptions = {
  origin(origin, callback) {
    // Non-browser clients often omit Origin.
    if (!origin) {
      callback(null, true);
      return;
    }

    // Local dev: browsers may use localhost, 127.0.0.1, [::1], or custom hosts — all send Origin on POST.
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
      return;
    }

    try {
      const { hostname } = new URL(origin);
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1'
      ) {
        callback(null, true);
        return;
      }
    } catch {
      // ignore malformed origin
    }

    const allowed = process.env.CORS_ORIGIN;
    if (allowed && origin === allowed) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

module.exports = corsOptions;
