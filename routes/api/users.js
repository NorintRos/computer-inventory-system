const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../../models/User');
const ApiKey = require('../../models/ApiKey');
const auth = require('../../middleware/auth');
const { adminOnly } = require('../../middleware/rbac');

const router = express.Router();

// All user routes require JWT + Admin
router.use(auth, adminOnly);

// POST /api/users — create new user
router.post('/', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hash, role });

    const userObj = user.toObject();
    delete userObj.password;
    res.status(201).json(userObj);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id/role — update user role
router.patch('/:id/role', async (req, res) => {
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
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id/status — enable/disable user
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Enabled', 'Disabled'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Enabled or Disabled' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true },
    ).select('-password');

    if (!user) return res.status(404).json({ error: 'User not found' });

    // CRITICAL: disabling a user invalidates all their API keys
    if (status === 'Disabled') {
      await ApiKey.updateMany({ createdBy: user._id }, { active: false });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
