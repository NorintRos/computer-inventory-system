const express = require('express');
const Item = require('../../models/Item');
const { requireAuth } = require('../../middleware/uiAuth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const base = { deleted: false };
    const [total, available, inUse, maintenance, retired] = await Promise.all([
      Item.countDocuments(base),
      Item.countDocuments({ ...base, status: 'Available' }),
      Item.countDocuments({ ...base, status: 'In-Use' }),
      Item.countDocuments({ ...base, status: 'Maintenance' }),
      Item.countDocuments({ ...base, status: 'Retired' }),
    ]);

    res.render('dashboard', {
      title: 'Dashboard',
      stats: { total, available, inUse, maintenance, retired },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
