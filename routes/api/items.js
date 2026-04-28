const express = require('express');
const { body, param, query } = require('express-validator');
const Item = require('../../models/Item');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const { authenticateJwt, authenticateJwtOrApiKey } = require('../../middleware/auth');
const { adminOnly } = require('../../middleware/rbac');
const { validateRequest, sendApiError } = require('../../middleware/validateRequest');

const router = express.Router();

const buildFileLink = (documentId) => {
  if (!documentId) return null;
  return `/api/files/${documentId.toString()}`;
};

router.get(
  '/',
  authenticateJwtOrApiKey,
  [
    query('status')
      .optional()
      .isIn(['Available', 'In-Use', 'Maintenance', 'Retired'])
      .withMessage('Invalid status filter'),
    query('category')
      .optional()
      .isIn(['Laptop', 'Desktop', 'Server', 'Monitor', 'Keyboard', 'Mouse', 'Printer', 'Other'])
      .withMessage('Invalid category filter'),
    query('brand')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 120 })
      .withMessage('Invalid brand filter'),
  ],
  validateRequest,
  async (req, res, next) => {
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
  },
);

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
router.get(
  '/reports/user-audit/:userId',
  authenticateJwt,
  [param('userId').isMongoId().withMessage('Invalid user id')],
  validateRequest,
  async (req, res, next) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select('username role status').lean();
      if (!user) return sendApiError(res, 404, 'User not found');

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
  },
);

// GET /api/items/:id/history — chronological transaction history for an item
router.get(
  '/:id/history',
  authenticateJwt,
  [param('id').isMongoId().withMessage('Invalid item id')],
  validateRequest,
  async (req, res, next) => {
    try {
      const item = await Item.findOne({ _id: req.params.id, deleted: false })
        .select('itemId model brand category status assignedTo')
        .populate('assignedTo', 'username role status')
        .lean();

      if (!item) return sendApiError(res, 404, 'Item not found');

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
  },
);

router.get(
  '/:id',
  authenticateJwt,
  [param('id').isMongoId().withMessage('Invalid item id')],
  validateRequest,
  async (req, res, next) => {
    try {
      const item = await Item.findOne({ _id: req.params.id, deleted: false })
        .populate('assignedTo', 'username')
        .lean();
      if (!item) return sendApiError(res, 404, 'Item not found');
      return res.json(item);
    } catch (err) {
      return next(err);
    }
  },
);

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

router.post('/', authenticateJwt, itemCreateValidation, validateRequest, async (req, res, next) => {
  try {
    const { itemId, serialNumber, model, brand, category, dateAcquired } = req.body;
    const item = await Item.create({ itemId, serialNumber, model, brand, category, dateAcquired });
    return res.status(201).json(item);
  } catch (err) {
    if (err.code === 11000) {
      return sendApiError(res, 400, 'itemId or serialNumber already exists');
    }
    if (err.name === 'ValidationError') {
      return sendApiError(res, 400, err.message);
    }
    return next(err);
  }
});

router.put(
  '/:id',
  authenticateJwt,
  [
    param('id').isMongoId().withMessage('Invalid item id'),
    body('serialNumber').optional().trim().notEmpty().withMessage('serialNumber cannot be empty'),
    body('model').optional().trim().notEmpty().withMessage('model cannot be empty'),
    body('brand').optional().trim().notEmpty().withMessage('brand cannot be empty'),
    body('category')
      .optional()
      .isIn(['Laptop', 'Desktop', 'Server', 'Monitor', 'Keyboard', 'Mouse', 'Printer', 'Other'])
      .withMessage('Invalid category'),
    body('status')
      .optional()
      .isIn(['Available', 'In-Use', 'Maintenance', 'Retired'])
      .withMessage('Invalid status'),
    body('dateAcquired').optional().isISO8601().withMessage('dateAcquired must be a valid date'),
    body('assignedTo')
      .optional({ values: 'falsy' })
      .isMongoId()
      .withMessage('Invalid assignedTo user id'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const update = { ...req.body };
      delete update.itemId;
      delete update.deleted;

      const item = await Item.findOneAndUpdate({ _id: req.params.id, deleted: false }, update, {
        new: true,
        runValidators: true,
      })
        .populate('assignedTo', 'username')
        .lean();

      if (!item) return sendApiError(res, 404, 'Item not found');
      return res.json(item);
    } catch (err) {
      if (err.name === 'ValidationError') {
        return sendApiError(res, 400, err.message);
      }
      return next(err);
    }
  },
);

router.delete(
  '/:id',
  authenticateJwt,
  adminOnly,
  [param('id').isMongoId().withMessage('Invalid item id')],
  validateRequest,
  async (req, res, next) => {
    try {
      const item = await Item.findOneAndUpdate(
        { _id: req.params.id, deleted: false },
        { deleted: true },
        { new: true },
      );
      if (!item) return sendApiError(res, 404, 'Item not found');
      return res.json({ message: 'Item deleted', id: item._id });
    } catch (err) {
      return next(err);
    }
  },
);

module.exports = router;
