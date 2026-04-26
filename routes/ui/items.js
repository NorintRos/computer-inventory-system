const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Item = require('../../models/Item');
const User = require('../../models/User');
const { requireAuth, requireAdmin } = require('../../middleware/uiAuth');

const router = express.Router();

const CATEGORIES = ['Laptop', 'Desktop', 'Server', 'Monitor', 'Keyboard', 'Mouse', 'Printer', 'Other'];
const STATUSES = ['Available', 'In-Use', 'Maintenance', 'Retired'];

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const filter = { deleted: false };
    const { status, category, brand, q } = req.query;
    if (status && STATUSES.includes(status)) filter.status = status;
    if (category && CATEGORIES.includes(category)) filter.category = category;
    if (brand && String(brand).trim()) filter.brand = new RegExp(String(brand).trim(), 'i');

    if (q && String(q).trim()) {
      const term = String(q).trim();
      filter.$or = [
        { itemId: new RegExp(term, 'i') },
        { serialNumber: new RegExp(term, 'i') },
        { model: new RegExp(term, 'i') },
        { brand: new RegExp(term, 'i') },
      ];
    }

    const items = await Item.find(filter)
      .populate('assignedTo', 'username')
      .sort({ updatedAt: -1 })
      .lean();

    res.render('items/index', {
      title: 'Inventory',
      items,
      filters: { status: status || '', category: category || '', brand: brand || '', q: q || '' },
      categories: CATEGORIES,
      statuses: STATUSES,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/new', async (req, res, next) => {
  try {
    res.render('items/form', {
      title: 'Add item',
      item: null,
      categories: CATEGORIES,
      statuses: STATUSES,
      users: [],
      isNew: true,
    });
  } catch (err) {
    next(err);
  }
});

const createValidation = [
  body('itemId').trim().notEmpty().withMessage('Asset / item ID is required'),
  body('serialNumber').trim().notEmpty().withMessage('Serial number is required'),
  body('model').trim().notEmpty().withMessage('Model is required'),
  body('brand').trim().notEmpty().withMessage('Brand is required'),
  body('category').isIn(CATEGORIES).withMessage('Invalid category'),
  body('dateAcquired').isISO8601().withMessage('Enter a valid acquisition date'),
];

router.post('/', createValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map((e) => e.msg).join(' '));
    return res.redirect('/items/new');
  }
  try {
    const { itemId, serialNumber, model, brand, category, dateAcquired } = req.body;
    await Item.create({ itemId, serialNumber, model, brand, category, dateAcquired });
    req.flash('success', 'Item created.');
    return res.redirect('/items');
  } catch (err) {
    if (err.code === 11000) {
      req.flash('error', 'Item ID or serial number already exists.');
      return res.redirect('/items/new');
    }
    if (err.name === 'ValidationError') {
      req.flash('error', err.message);
      return res.redirect('/items/new');
    }
    return next(err);
  }
});

async function loadUsers() {
  return User.find({ status: 'Enabled' }).select('username role').sort({ username: 1 }).lean();
}

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next();
    }
    const item = await Item.findOne({ _id: req.params.id, deleted: false })
      .populate('assignedTo', 'username')
      .lean();
    if (!item) {
      req.flash('error', 'Item not found.');
      return res.redirect('/items');
    }
    const users = await loadUsers();
    const dateStr = item.dateAcquired ? new Date(item.dateAcquired).toISOString().slice(0, 10) : '';
    const selectedAssignee = item.assignedTo ? String(item.assignedTo._id) : '';
    res.render('items/form', {
      title: `Edit — ${item.itemId}`,
      item: { ...item, dateAcquired: dateStr },
      categories: CATEGORIES,
      statuses: STATUSES,
      users,
      selectedAssignee,
      isNew: false,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      req.flash('error', 'Invalid item.');
      return res.redirect('/items');
    }

    const update = {
      serialNumber: req.body.serialNumber,
      model: req.body.model,
      brand: req.body.brand,
      category: req.body.category,
      status: req.body.status,
      dateAcquired: req.body.dateAcquired,
    };

    const assign = req.body.assignedTo;
    if (assign && mongoose.isValidObjectId(assign)) {
      update.assignedTo = assign;
    } else {
      update.assignedTo = null;
    }

    if (!CATEGORIES.includes(update.category)) {
      req.flash('error', 'Invalid category.');
      return res.redirect(`/items/${req.params.id}`);
    }
    if (!STATUSES.includes(update.status)) {
      req.flash('error', 'Invalid status.');
      return res.redirect(`/items/${req.params.id}`);
    }

    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, deleted: false },
      update,
      { new: true, runValidators: true },
    );

    if (!item) {
      req.flash('error', 'Item not found.');
      return res.redirect('/items');
    }
    req.flash('success', 'Item updated.');
    return res.redirect(`/items/${req.params.id}`);
  } catch (err) {
    if (err.code === 11000) {
      req.flash('error', 'Serial number already in use.');
      return res.redirect(`/items/${req.params.id}`);
    }
    if (err.name === 'ValidationError') {
      req.flash('error', err.message);
      return res.redirect(`/items/${req.params.id}`);
    }
    return next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      req.flash('error', 'Invalid item.');
      return res.redirect('/items');
    }
    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, deleted: false },
      { deleted: true },
      { new: true },
    );
    if (!item) {
      req.flash('error', 'Item not found.');
      return res.redirect('/items');
    }
    req.flash('success', 'Item removed from inventory.');
    return res.redirect('/items');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
