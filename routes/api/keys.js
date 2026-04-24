const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const ApiKey = require('../../models/ApiKey');
const { authenticateJwt } = require('../../middleware/auth');
const { hashLookup } = require('../../middleware/apiKey');

const router = express.Router();

router.use(authenticateJwt);

router.post(
  '/',
  body('label').optional().trim().isLength({ max: 120 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const label = req.body.label?.length ? req.body.label : 'API Key';
      const rawKey = `cis_${crypto.randomBytes(24).toString('base64url')}`;
      const lookupHash = hashLookup(rawKey);
      const hashedKey = await bcrypt.hash(rawKey, 10);

      const doc = await ApiKey.create({
        lookupHash,
        hashedKey,
        label,
        createdBy: req.user._id,
        active: true,
      });

      return res.status(201).json({
        id: doc._id,
        label: doc.label,
        key: rawKey,
        createdAt: doc.createdAt,
        message: 'Store this key securely; it is shown only once.',
      });
    } catch (err) {
      return next(err);
    }
  },
);

router.get('/', async (req, res, next) => {
  try {
    const filter =
      req.user.role === 'Admin'
        ? { active: true }
        : { active: true, createdBy: req.user._id };

    const keys = await ApiKey.find(filter)
      .sort({ createdAt: -1 })
      .select('label createdBy active createdAt updatedAt')
      .populate('createdBy', 'username');

    return res.json({ keys });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid key id' });
    }

    const key = await ApiKey.findById(id);
    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const ownerId = key.createdBy.toString();
    const isAdmin = req.user.role === 'Admin';
    if (!isAdmin && ownerId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    key.active = false;
    await key.save();
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
