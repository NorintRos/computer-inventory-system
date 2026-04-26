const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');

const router = express.Router();

const parseExpiryMs = (s) => {
  if (!s) return 8 * 60 * 60 * 1000;
  const m = String(s).trim().match(/^(\d+)([smhd])$/);
  if (!m) return 8 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]];
  return n * unit;
};

function clearAuthCookie(res) {
  res.clearCookie(process.env.COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

router.get('/login', (req, res) => {
  if (req.user) {
    return res.redirect(req.query.next && req.query.next.startsWith('/') ? req.query.next : '/');
  }
  return res.render('auth/login', {
    title: 'Sign in',
    returnTo: req.query.next && req.query.next.startsWith('/') ? req.query.next : '/',
  });
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password, returnTo } = req.body;
    const safeNext = typeof returnTo === 'string' && returnTo.startsWith('/') ? returnTo : '/';

    if (!username || !password) {
      req.flash('error', 'Username and password are required.');
      return res.redirect('/auth/login');
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      req.flash('error', 'Invalid credentials.');
      return res.redirect('/auth/login');
    }
    if (user.status === 'Disabled') {
      req.flash('error', 'This account is disabled.');
      return res.redirect('/auth/login');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      req.flash('error', 'Invalid credentials.');
      return res.redirect('/auth/login');
    }

    const payload = {
      id: String(user._id),
      username: user.username,
      role: user.role,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    res.cookie(process.env.COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: parseExpiryMs(process.env.JWT_EXPIRES_IN),
    });

    req.flash('success', `Welcome back, ${user.username}.`);
    return res.redirect(safeNext);
  } catch (err) {
    return next(err);
  }
});

function logout(req, res) {
  clearAuthCookie(res);
  req.flash('success', 'You have been logged out.');
  res.redirect('/auth/login');
}

router.get('/logout', logout);
router.post('/logout', logout);

module.exports = router;
