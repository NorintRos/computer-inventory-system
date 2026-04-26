const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../../models/User');
const ApiKey = require('../../models/ApiKey');
const { requireAdmin } = require('../../middleware/uiAuth');

const router = express.Router();

router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ username: 1 }).lean();
    res.render('users/index', {
      title: 'User management',
      users,
      currentUserId: String(req.user._id),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      req.flash('error', 'Username and password are required.');
      return res.redirect('/users');
    }
    const r = role === 'Admin' ? 'Admin' : 'Technician';
    const hash = await bcrypt.hash(password, 10);
    await User.create({ username: username.trim(), password: hash, role: r });
    req.flash('success', 'User created.');
    return res.redirect('/users');
  } catch (err) {
    if (err.code === 11000) {
      req.flash('error', 'Username already exists.');
      return res.redirect('/users');
    }
    if (err.name === 'ValidationError') {
      req.flash('error', err.message);
      return res.redirect('/users');
    }
    return next(err);
  }
});

router.post('/:id/role', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      req.flash('error', 'Invalid user.');
      return res.redirect('/users');
    }
    const { role } = req.body;
    if (!['Admin', 'Technician'].includes(role)) {
      req.flash('error', 'Invalid role.');
      return res.redirect('/users');
    }
    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true },
    ).select('-password');
    if (!user) {
      req.flash('error', 'User not found.');
      return res.redirect('/users');
    }
    req.flash('success', 'Role updated.');
    return res.redirect('/users');
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      req.flash('error', 'Invalid user.');
      return res.redirect('/users');
    }
    const { status } = req.body;
    if (!['Enabled', 'Disabled'].includes(status)) {
      req.flash('error', 'Invalid status.');
      return res.redirect('/users');
    }
    if (status === 'Disabled' && id === String(req.user._id)) {
      req.flash('error', 'You cannot disable your own account.');
      return res.redirect('/users');
    }

    const existing = await User.findById(id);
    if (!existing) {
      req.flash('error', 'User not found.');
      return res.redirect('/users');
    }

    if (status === 'Disabled') {
      await ApiKey.updateMany({ createdBy: existing._id }, { active: false });
    }

    await User.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
    req.flash('success', 'Account status updated.');
    return res.redirect('/users');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
