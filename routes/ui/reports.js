const express = require('express');
const mongoose = require('mongoose');
const Item = require('../../models/Item');
const User = require('../../models/User');
const { requireAdmin } = require('../../middleware/uiAuth');

const router = express.Router();

router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const base = { deleted: false };
    const threshold = new Date();
    threshold.setFullYear(threshold.getFullYear() - 3);

    const [total, available, inUse, maintenance, retired, agingItems, users] = await Promise.all([
      Item.countDocuments(base),
      Item.countDocuments({ ...base, status: 'Available' }),
      Item.countDocuments({ ...base, status: 'In-Use' }),
      Item.countDocuments({ ...base, status: 'Maintenance' }),
      Item.countDocuments({ ...base, status: 'Retired' }),
      Item.find({ ...base, dateAcquired: { $lt: threshold } })
        .populate('assignedTo', 'username')
        .sort({ dateAcquired: 1 })
        .lean(),
      User.find().select('username role status').sort({ username: 1 }).lean(),
    ]);

    const selectedUserId = typeof req.query.userId === 'string' ? req.query.userId : '';
    let auditUser = null;
    let auditItems = [];

    if (selectedUserId) {
      if (!mongoose.isValidObjectId(selectedUserId)) {
        req.flash('error', 'Please select a valid user for audit.');
      } else {
        auditUser = await User.findById(selectedUserId).select('username role status').lean();
        if (!auditUser) {
          req.flash('error', 'User not found for audit search.');
        } else {
          auditItems = await Item.find({
            deleted: false,
            assignedTo: selectedUserId,
            status: 'In-Use',
          })
            .sort({ updatedAt: -1 })
            .lean();
        }
      }
    }

    res.render('reports/index', {
      title: 'Reports',
      summary: { total, available, inUse, maintenance, retired },
      aging: {
        threshold,
        count: agingItems.length,
        items: agingItems,
      },
      users,
      selectedUserId,
      audit: {
        user: auditUser,
        count: auditItems.length,
        items: auditItems,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
