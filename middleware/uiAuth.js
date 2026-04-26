const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

function clearAuthCookie(res) {
  const name = process.env.COOKIE_NAME;
  if (!name) return;
  res.clearCookie(name, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

/**
 * Loads JWT user from cookie into req.user and res.locals.user for SSR.
 * Does not block; invalid or missing token leaves user unset.
 */
async function attachUser(req, res, next) {
  res.locals.user = null;
  const cookieName = process.env.COOKIE_NAME;
  const token = cookieName && req.cookies?.[cookieName];
  if (!token) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.sub;
    if (userId == null || !mongoose.isValidObjectId(String(userId))) {
      clearAuthCookie(res);
      return next();
    }
    const user = await User.findById(userId).select('-password').lean();
    if (user && user.status === 'Enabled') {
      req.user = user;
      res.locals.user = user;
    }
  } catch (e) {
    if (
      e.name === 'JsonWebTokenError' ||
      e.name === 'TokenExpiredError' ||
      e.name === 'CastError'
    ) {
      clearAuthCookie(res);
      // Bad or stale cookie — treat as logged out (do not 500 the whole site)
    } else {
      return next(e);
    }
  }
  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    const nextUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/auth/login?next=${nextUrl}`);
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    const nextUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/auth/login?next=${nextUrl}`);
  }
  if (req.user.role !== 'Admin') {
    return res.status(403).render('forbidden', { title: 'Access denied' });
  }
  return next();
}

module.exports = { attachUser, requireAuth, requireAdmin };
