const express = require('express');
const mongoose = require('mongoose');
const Item = require('../../models/Item');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const { authenticateJwt } = require('../../middleware/auth');
const { upload, saveToGridFS } = require('../../config/upload');

const router = express.Router();

router.use(authenticateJwt);

router.post('/checkout', upload.single('document'), async (req, res, next) => {
  try {
    const { itemId, userId, notes } = req.body;

    if (!itemId || !userId) {
      return res.status(400).json({ error: 'itemId and userId are required' });
    }
    if (!mongoose.isValidObjectId(itemId) || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid id format' });
    }

    const item = await Item.findOne({ _id: itemId, deleted: false });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.status !== 'Available') {
      return res.status(400).json({ error: `Item cannot be checked out (status: ${item.status})` });
    }

    const user = await User.findOne({ _id: userId, status: 'Enabled' });
    if (!user) return res.status(404).json({ error: 'User not found or disabled' });

    const documentId = req.file ? await saveToGridFS(req.file) : null;

    const transaction = await Transaction.create({
      item: item._id,
      user: user._id,
      type: 'checkout',
      documentId,
      performedBy: req.user._id,
      notes: notes || '',
    });

    item.status = 'In-Use';
    item.assignedTo = user._id;
    await item.save();

    return res.status(201).json(transaction);
  } catch (err) {
    return next(err);
  }
});

router.post('/checkin', upload.single('document'), async (req, res, next) => {
  try {
    const { itemId, notes } = req.body;

    if (!itemId) {
      return res.status(400).json({ error: 'itemId is required' });
    }
    if (!mongoose.isValidObjectId(itemId)) {
      return res.status(400).json({ error: 'Invalid id format' });
    }

    const item = await Item.findOne({ _id: itemId, deleted: false });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.status !== 'In-Use') {
      return res.status(400).json({ error: `Item is not checked out (status: ${item.status})` });
    }

    const documentId = req.file ? await saveToGridFS(req.file) : null;

    const transaction = await Transaction.create({
      item: item._id,
      user: item.assignedTo,
      type: 'checkin',
      documentId,
      performedBy: req.user._id,
      notes: notes || '',
    });

    item.status = 'Available';
    item.assignedTo = null;
    await item.save();

    return res.status(201).json(transaction);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
