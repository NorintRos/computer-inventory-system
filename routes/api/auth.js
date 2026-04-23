const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const User = require('../../models/User');
const { signToken } = require('../../middleware/auth');

const router = express.Router();

router.post(
  '/login',
  body('username').trim().notEmpty(),
  body('password').notEmpty(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username, password } = req.body;
      const user = await User.findOne({ username }).select('+password');
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      if (user.status !== 'Enabled') {
        return res.status(403).json({ error: 'Account disabled' });
      }
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = signToken(user);
      return res.json({
        token,
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
          status: user.status,
        },
      });
    } catch (err) {
      return next(err);
    }
  },
);

module.exports = router;
