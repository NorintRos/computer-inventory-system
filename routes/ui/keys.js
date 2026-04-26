const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const ApiKey = require('../../models/ApiKey');
const { requireAdmin } = require('../../middleware/uiAuth');
const { hashLookup } = require('../../middleware/apiKey');

const router = express.Router();

router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const newApiKeyMessages = req.flash('newApiKey');
    const newApiKey = newApiKeyMessages && newApiKeyMessages[0] ? newApiKeyMessages[0] : null;

    const keys = await ApiKey.find({ active: true })
      .sort({ createdAt: -1 })
      .select('label createdBy active createdAt updatedAt')
      .populate('createdBy', 'username')
      .lean();

    res.render('keys/index', {
      title: 'API keys',
      keys,
      newApiKey,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const labelRaw = req.body.label && String(req.body.label).trim();
    const label = labelRaw && labelRaw.length ? labelRaw.slice(0, 120) : 'API Key';
    const rawKey = `cis_${crypto.randomBytes(24).toString('base64url')}`;
    const lookupHash = hashLookup(rawKey);
    const hashedKey = await bcrypt.hash(rawKey, 10);

    await ApiKey.create({
      lookupHash,
      hashedKey,
      label,
      createdBy: req.user._id,
      active: true,
    });

    req.flash('newApiKey', rawKey);
    req.flash('success', 'API key created. Copy it below — it will not be shown again.');
    return res.redirect('/keys');
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/revoke', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      req.flash('error', 'Invalid key.');
      return res.redirect('/keys');
    }
    const key = await ApiKey.findById(id);
    if (!key) {
      req.flash('error', 'API key not found.');
      return res.redirect('/keys');
    }
    key.active = false;
    await key.save();
    req.flash('success', 'API key revoked.');
    return res.redirect('/keys');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
