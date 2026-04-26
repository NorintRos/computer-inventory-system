const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Item = require('../../models/Item');
const { authenticateJwt, authenticateJwtOrApiKey } = require('../../middleware/auth');
const { adminOnly } = require('../../middleware/rbac');

const router = express.Router();

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
