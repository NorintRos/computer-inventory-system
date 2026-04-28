const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Item = require('../../models/Item');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const { requireAuth } = require('../../middleware/uiAuth');
const { upload, saveToGridFS } = require('../../config/upload');

const router = express.Router();

router.use(requireAuth);

async function loadEnabledUsers() {
  return User.find({ status: 'Enabled' }).select('username role').sort({ username: 1 }).lean();
}

router.get('/', (req, res) => {
  res.render('transactions/index', { title: 'Transactions' });
});

router.get('/checkout', async (req, res, next) => {
  try {
    const items = await Item.find({ deleted: false, status: 'Available' })
      .sort({ itemId: 1 })
      .lean();
    const users = await loadEnabledUsers();
    res.render('transactions/checkout', { title: 'Check out', items, users });
  } catch (err) {
    next(err);
  }
});

const checkoutValidation = [
  body('itemId').isMongoId().withMessage('Select a valid item'),
  body('userId').isMongoId().withMessage('Select a valid user'),
  body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes are too long'),
];

router.post('/checkout', upload.single('document'), checkoutValidation, async (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    req.flash('error', result.array().map((e) => e.msg).join(' '));
    return res.redirect('/transactions/checkout');
  }

  try {
    const { itemId, userId, notes = '' } = req.body;

    const item = await Item.findOne({ _id: itemId, deleted: false });
    if (!item) {
      req.flash('error', 'Item not found.');
      return res.redirect('/transactions/checkout');
    }
    if (item.status !== 'Available') {
      req.flash('error', `Item cannot be checked out (status: ${item.status}).`);
      return res.redirect('/transactions/checkout');
    }

    const user = await User.findOne({ _id: userId, status: 'Enabled' });
    if (!user) {
      req.flash('error', 'User not found or account is disabled.');
      return res.redirect('/transactions/checkout');
    }

    const documentId = req.file ? await saveToGridFS(req.file) : null;

    await Transaction.create({
      item: item._id,
      user: user._id,
      type: 'checkout',
      documentId,
      performedBy: req.user._id,
      notes: typeof notes === 'string' ? notes : '',
    });

    item.status = 'In-Use';
    item.assignedTo = user._id;
    await item.save();

    req.flash('success', `Checked out ${item.itemId} to ${user.username}.`);
    return res.redirect('/items');
  } catch (err) {
    return next(err);
  }
});

router.get('/checkin', async (req, res, next) => {
  try {
    const items = await Item.find({ deleted: false, status: 'In-Use' })
      .populate('assignedTo', 'username')
      .sort({ itemId: 1 })
      .lean();

    res.render('transactions/checkin', { title: 'Check in', items });
  } catch (err) {
    next(err);
  }
});

const checkinValidation = [
  body('itemId').isMongoId().withMessage('Select a valid item'),
  body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes are too long'),
];

router.post('/checkin', upload.single('document'), checkinValidation, async (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    req.flash('error', result.array().map((e) => e.msg).join(' '));
    return res.redirect('/transactions/checkin');
  }

  try {
    const { itemId, notes = '' } = req.body;

    const item = await Item.findOne({ _id: itemId, deleted: false });
    if (!item) {
      req.flash('error', 'Item not found.');
      return res.redirect('/transactions/checkin');
    }
    if (item.status !== 'In-Use') {
      req.flash('error', `Item is not checked out (status: ${item.status}).`);
      return res.redirect('/transactions/checkin');
    }

    const documentId = req.file ? await saveToGridFS(req.file) : null;

    await Transaction.create({
      item: item._id,
      user: item.assignedTo,
      type: 'checkin',
      documentId,
      performedBy: req.user._id,
      notes: typeof notes === 'string' ? notes : '',
    });

    item.status = 'Available';
    item.assignedTo = null;
    await item.save();

    req.flash('success', `Checked in ${item.itemId}.`);
    return res.redirect('/items');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
