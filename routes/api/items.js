const express = require('express');
const Item = require('../../models/Item');
const { authenticateJwtOrApiKey } = require('../../middleware/auth');

const router = express.Router();

router.get('/', authenticateJwtOrApiKey, async (req, res, next) => {
  try {
    const items = await Item.find().sort({ updatedAt: -1 }).lean();
    return res.json({ items });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
