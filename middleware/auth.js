const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    [, token] = authHeader.split(' ');
  }
  if (!token && req.cookies) {
    token = req.cookies[process.env.COOKIE_NAME];
  }
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Accept both `id` (dev) and `sub` (master) claims so tokens minted by
    // either side still validate during the transition.
    const userId = decoded.id || decoded.sub;
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (user.status === 'Disabled') {
      return res.status(403).json({ error: 'Account is disabled' });
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
};

// Endpoints that accept JWT OR x-api-key (per CLAUDE.md, only GET /api/items).
const authOrApiKey = async (req, res, next) => {
  const hasBearer = req.headers.authorization?.startsWith('Bearer ');
  const cookieName = process.env.COOKIE_NAME;
  const hasCookie = cookieName && req.cookies?.[cookieName];
  if (hasBearer || hasCookie) {
    return auth(req, res, next);
  }
  // Lazy-require to avoid circular imports.
  // eslint-disable-next-line global-require
  const { validateApiKey } = require('./apiKey');
  return validateApiKey(req, res, next);
};

const signToken = (user) => jwt.sign(
  { id: user._id, username: user.username, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
);

module.exports = auth;
module.exports.auth = auth;
module.exports.authenticateJwt = auth;
module.exports.authenticateJwtOrApiKey = authOrApiKey;
module.exports.signToken = signToken;
