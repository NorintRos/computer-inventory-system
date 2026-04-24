const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');

const router = express.Router();

// Parse a simple JWT duration string (e.g., '8h', '30m', '1d') into milliseconds.
// Keeps the cookie maxAge coupled to JWT_EXPIRES_IN so they can't drift apart.
const parseExpiryMs = (s) => {
  if (!s) return 8 * 60 * 60 * 1000;
  const m = String(s).trim().match(/^(\d+)([smhd])$/);
  if (!m) return 8 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]];
  return n * unit;
};

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'Disabled') {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = { id: user._id, username: user.username, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.cookie(process.env.COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: parseExpiryMs(process.env.JWT_EXPIRES_IN),
    });

    return res.json({ token, user: { id: user._id, username: user.username, role: user.role } });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
