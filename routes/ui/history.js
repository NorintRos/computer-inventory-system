const express = require('express');
const mongoose = require('mongoose');
const Item = require('../../models/Item');
const Transaction = require('../../models/Transaction');
const { requireAuth } = require('../../middleware/uiAuth');

const router = express.Router();

router.use(requireAuth);

function fileLink(documentId) {
  if (!documentId) return null;
  return `/api/files/${documentId.toString()}`;
}

router.get('/', async (req, res, next) => {
  try {
    const rawLimit = parseInt(String(req.query.limit || '75'), 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 75;
    const typeRaw = req.query.type;
    const filter = {};
    if (typeRaw === 'checkout' || typeRaw === 'checkin') {
      filter.type = typeRaw;
    }

    const transactions = await Transaction.find(filter)
      .populate('item', 'itemId model brand status deleted')
      .populate('user', 'username role')
      .populate('performedBy', 'username role')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const rows = transactions.map((trx) => ({
      id: String(trx._id),
      type: trx.type,
      createdAt: trx.createdAt,
      notes: trx.notes || '',
      notesPreview:
        trx.notes && String(trx.notes).length > 120
          ? `${String(trx.notes).slice(0, 120)}…`
          : trx.notes || '',
      documentLink: fileLink(trx.documentId),
      item: trx.item
        ? {
            id: String(trx.item._id),
            itemId: trx.item.itemId,
            model: trx.item.model,
            brand: trx.item.brand,
            deleted: Boolean(trx.item.deleted),
          }
        : null,
      assignee: trx.user ? { username: trx.user.username, role: trx.user.role } : null,
      performer: trx.performedBy
        ? { username: trx.performedBy.username, role: trx.performedBy.role }
        : null,
    }));

    res.render('history/index', {
      title: 'Activity history',
      rows,
      filters: { type: typeRaw === 'checkout' || typeRaw === 'checkin' ? typeRaw : '', limit },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      req.flash('error', 'Invalid item.');
      return res.redirect('/items');
    }

    const item = await Item.findOne({ _id: id, deleted: false })
      .select('itemId model brand category status assignedTo')
      .populate('assignedTo', 'username role status')
      .lean();

    if (!item) {
      req.flash('error', 'Item not found.');
      return res.redirect('/items');
    }

    const transactions = await Transaction.find({ item: id })
      .populate('user', 'username role status')
      .populate('performedBy', 'username role')
      .sort({ createdAt: 1 })
      .lean();

    const events = transactions.map((trx) => ({
      id: String(trx._id),
      type: trx.type,
      createdAt: trx.createdAt,
      notes: trx.notes || '',
      documentLink: fileLink(trx.documentId),
      assignee: trx.user
        ? { username: trx.user.username, role: trx.user.role, status: trx.user.status }
        : null,
      performer: trx.performedBy
        ? { username: trx.performedBy.username, role: trx.performedBy.role }
        : null,
    }));

    res.render('history/item', {
      title: `History — ${item.itemId}`,
      item,
      events,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
