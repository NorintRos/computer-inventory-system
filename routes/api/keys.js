const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { body, param } = require('express-validator');
const ApiKey = require('../../models/ApiKey');
const { authenticateJwt } = require('../../middleware/auth');
const { hashLookup } = require('../../middleware/apiKey');
const { validateRequest, sendApiError } = require('../../middleware/validateRequest');

const router = express.Router();

router.use(authenticateJwt);

router.post(
  '/',
  body('label').optional().trim().isLength({ max: 120 }),
  validateRequest,
  async (req, res, next) => {
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
      req.user.role === 'Admin' ? { active: true } : { active: true, createdBy: req.user._id };

    const keys = await ApiKey.find(filter)
      .sort({ createdAt: -1 })
      .select('label createdBy active createdAt updatedAt')
      .populate('createdBy', 'username');

    return res.json({ keys });
  } catch (err) {
    return next(err);
  }
});

router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid key id')],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const key = await ApiKey.findById(id);
      if (!key) {
        return sendApiError(res, 404, 'API key not found');
      }

      const ownerId = key.createdBy.toString();
      const isAdmin = req.user.role === 'Admin';
      if (!isAdmin && ownerId !== req.user._id.toString()) {
        return sendApiError(res, 403, 'Forbidden');
      }

      key.active = false;
      await key.save();
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  },
);

module.exports = router;
