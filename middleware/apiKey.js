const crypto = require('crypto');
const bcrypt = require('bcrypt');
const ApiKey = require('../models/ApiKey');

function hashLookup(rawKey) {
  return crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

/**
 * Validates `x-api-key` header against stored keys.
 * Sets req.apiKey and req.user (creator, must be Enabled).
 */
async function validateApiKey(req, res, next) {
  const raw = req.headers['x-api-key'];
  if (!raw || typeof raw !== 'string') {
    return res.status(401).json({ error: 'API key required' });
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return res.status(401).json({ error: 'API key required' });
  }

  const lookupHash = hashLookup(trimmed);

  try {
    const doc = await ApiKey.findOne({ lookupHash, active: true })
      .select('+hashedKey +lookupHash')
      .populate('createdBy', 'username role status');

    if (!doc) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const match = await bcrypt.compare(trimmed, doc.hashedKey);
    if (!match) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const creator = doc.createdBy;
    if (!creator || creator.status !== 'Enabled') {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.apiKey = doc;
    req.user = creator;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  hashLookup,
  validateApiKey,
};
