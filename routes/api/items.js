const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Item = require('../../models/Item');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const { authenticateJwt, authenticateJwtOrApiKey } = require('../../middleware/auth');
const { adminOnly } = require('../../middleware/rbac');

const router = express.Router();

const buildFileLink = (documentId) => {
  if (!documentId) return null;
  return `/api/files/${documentId.toString()}`;
};

router.get('/', authenticateJwtOrApiKey, async (req, res, next) => {
  try {
    const filter = { deleted: false };
    const { status, category, brand } = req.query;
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (brand) filter.brand = brand;

    const items = await Item.find(filter)
      .populate('assignedTo', 'username')
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({ items });
  } catch (err) {
    return next(err);
  }
});

// GET /api/items/reports/summary — inventory status summary counts
router.get('/reports/summary', authenticateJwt, async (req, res, next) => {
  try {
    const statusCounts = await Item.aggregate([
      { $match: { deleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const summary = {
      total: 0,
      available: 0,
      inUse: 0,
      maintenance: 0,
      retired: 0,
    };

    statusCounts.forEach((entry) => {
      summary.total += entry.count;
      if (entry._id === 'Available') summary.available = entry.count;
      if (entry._id === 'In-Use') summary.inUse = entry.count;
      if (entry._id === 'Maintenance') summary.maintenance = entry.count;
      if (entry._id === 'Retired') summary.retired = entry.count;
    });

    return res.json({ summary });
  } catch (err) {
    return next(err);
  }
});

// GET /api/items/reports/aging — items acquired more than 3 years ago
router.get('/reports/aging', authenticateJwt, async (req, res, next) => {
  try {
    const threshold = new Date();
    threshold.setFullYear(threshold.getFullYear() - 3);

    const items = await Item.find({
      deleted: false,
      dateAcquired: { $lt: threshold },
    })
      .select('itemId serialNumber model brand category status dateAcquired assignedTo')
      .populate('assignedTo', 'username role status')
      .sort({ dateAcquired: 1 })
      .lean();

    return res.json({ thresholdDate: threshold, count: items.length, items });
  } catch (err) {
    return next(err);
  }
});

// GET /api/items/reports/user-audit/:userId — all currently assigned items for a user
router.get('/reports/user-audit/:userId', authenticateJwt, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const user = await User.findById(userId).select('username role status').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const items = await Item.find({
      deleted: false,
      assignedTo: userId,
      status: 'In-Use',
    })
      .select('itemId serialNumber model brand category status dateAcquired updatedAt')
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({ user, count: items.length, items });
  } catch (err) {
    return next(err);
  }
});

// GET /api/items/:id/history — chronological transaction history for an item
router.get('/:id/history', authenticateJwt, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item id' });
    }

    const item = await Item.findOne({ _id: req.params.id, deleted: false })
      .select('itemId model brand category status assignedTo')
      .populate('assignedTo', 'username role status')
      .lean();

    if (!item) return res.status(404).json({ error: 'Item not found' });

    const transactions = await Transaction.find({ item: req.params.id })
      .populate('user', 'username role status')
      .populate('performedBy', 'username role')
      .sort({ createdAt: 1 })
      .lean();

    const history = transactions.map((trx) => ({
      id: trx._id,
      type: trx.type,
      timestamp: trx.createdAt,
      assignee: trx.user
        ? {
            id: trx.user._id,
            username: trx.user.username,
            role: trx.user.role,
            status: trx.user.status,
          }
        : null,
      performedBy: trx.performedBy
        ? {
            id: trx.performedBy._id,
            username: trx.performedBy.username,
            role: trx.performedBy.role,
          }
        : null,
      notes: trx.notes || '',
      documentLink: buildFileLink(trx.documentId),
      documentId: trx.documentId || null,
    }));

    return res.json({ item, history });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', authenticateJwt, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item id' });
    }
    const item = await Item.findOne({ _id: req.params.id, deleted: false })
      .populate('assignedTo', 'username')
      .lean();
    if (!item) return res.status(404).json({ error: 'Item not found' });
    return res.json(item);
  } catch (err) {
    return next(err);
  }
});

const itemCreateValidation = [
  body('itemId').trim().notEmpty().withMessage('itemId is required'),
  body('serialNumber').trim().notEmpty().withMessage('serialNumber is required'),
  body('model').trim().notEmpty().withMessage('model is required'),
  body('brand').trim().notEmpty().withMessage('brand is required'),
  body('category')
    .isIn(['Laptop', 'Desktop', 'Server', 'Monitor', 'Keyboard', 'Mouse', 'Printer', 'Other'])
    .withMessage('Invalid category'),
  body('dateAcquired').isISO8601().withMessage('dateAcquired must be a valid date'),
];

router.post('/', authenticateJwt, itemCreateValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { itemId, serialNumber, model, brand, category, dateAcquired } = req.body;
    const item = await Item.create({ itemId, serialNumber, model, brand, category, dateAcquired });
    return res.status(201).json(item);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'itemId or serialNumber already exists' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
});

router.put('/:id', authenticateJwt, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item id' });
    }
    const update = { ...req.body };
    delete update.itemId;
    delete update.deleted;

    const item = await Item.findOneAndUpdate({ _id: req.params.id, deleted: false }, update, {
      new: true,
      runValidators: true,
    })
      .populate('assignedTo', 'username')
      .lean();

    if (!item) return res.status(404).json({ error: 'Item not found' });
    return res.json(item);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid item id' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
});

router.delete('/:id', authenticateJwt, adminOnly, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item id' });
    }
    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, deleted: false },
      { deleted: true },
      { new: true },
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    return res.json({ message: 'Item deleted', id: item._id });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid item id' });
    }
    return next(err);
  }
});

module.exports = router;
