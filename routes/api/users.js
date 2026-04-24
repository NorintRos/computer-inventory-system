const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../../models/User');
const ApiKey = require('../../models/ApiKey');
const auth = require('../../middleware/auth');
const { adminOnly } = require('../../middleware/rbac');

const router = express.Router();

router.use(auth, adminOnly);

router.post('/', async (req, res, next) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hash, role });

    const userObj = user.toObject();
    delete userObj.password;
    return res.status(201).json(userObj);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
});

router.patch('/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['Admin', 'Technician'].includes(role)) {
      return res.status(400).json({ error: 'Role must be Admin or Technician' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true },
    ).select('-password');

    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Enabled', 'Disabled'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Enabled or Disabled' });
    }

    if (status === 'Disabled' && req.params.id === String(req.user._id)) {
      return res.status(400).json({ error: 'Cannot disable your own account' });
    }

    // Load first so we can 404 before mutating anything.
    const existing = await User.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    // CRITICAL: invalidate keys BEFORE flipping the user status so a cascade
    // failure leaves the user still able to log in, not stuck disabled with
    // live API keys (direct violation of CLAUDE.md "Business Rules" #3).
    if (status === 'Disabled') {
      await ApiKey.updateMany({ createdBy: existing._id }, { active: false });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true },
    ).select('-password');

    return res.json(user);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
});

module.exports = router;
