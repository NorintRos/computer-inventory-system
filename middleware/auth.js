const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validateApiKey } = require('./apiKey');

const { JWT_SECRET, JWT_EXPIRES_IN: JWT_EXPIRES_IN_ENV } = process.env;
const JWT_EXPIRES_IN = JWT_EXPIRES_IN_ENV || '8h';

function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      username: user.username,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function extractJwtCookie(req) {
  const name = process.env.JWT_COOKIE_NAME || 'cis_token';
  return req.cookies?.[name] || null;
}

/**
 * Requires a valid JWT (Bearer or JWT cookie). User must exist and be Enabled.
 */
async function authenticateJwt(req, res, next) {
  const token = extractBearerToken(req) || extractJwtCookie(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub).select('username role status');
    if (!user || user.status !== 'Enabled') {
      return res.status(401).json({ error: 'Invalid or disabled user' });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * For routes that accept either JWT or `x-api-key`.
 * If Authorization Bearer (or JWT cookie) is present, JWT is used (no fallback to API key on JWT failure).
 */
async function authenticateJwtOrApiKey(req, res, next) {
  const token = extractBearerToken(req) || extractJwtCookie(req);
  if (token) {
    return authenticateJwt(req, res, next);
  }
  return validateApiKey(req, res, next);
}

module.exports = {
  signToken,
  authenticateJwt,
  authenticateJwtOrApiKey,
};
