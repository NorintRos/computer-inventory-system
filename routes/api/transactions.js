const express = require('express');
const { body } = require('express-validator');
const Item = require('../../models/Item');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const { authenticateJwt } = require('../../middleware/auth');
const { upload, saveToGridFS } = require('../../config/upload');
const { validateRequest, sendApiError } = require('../../middleware/validateRequest');

const router = express.Router();

router.use(authenticateJwt);

router.post(
  '/checkout',
  upload.single('document'),
  [
    body('itemId').isMongoId().withMessage('itemId must be a valid id'),
    body('userId').isMongoId().withMessage('userId must be a valid id'),
    body('notes').optional().isString().isLength({ max: 1000 }).withMessage('notes is too long'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { itemId, userId, notes } = req.body;

      const item = await Item.findOne({ _id: itemId, deleted: false });
      if (!item) return sendApiError(res, 404, 'Item not found');
      if (item.status !== 'Available') {
        return sendApiError(res, 400, `Item cannot be checked out (status: ${item.status})`);
      }

      const user = await User.findOne({ _id: userId, status: 'Enabled' });
      if (!user) return sendApiError(res, 404, 'User not found or disabled');

      const documentId = req.file ? await saveToGridFS(req.file) : null;

      const transaction = await Transaction.create({
        item: item._id,
        user: user._id,
        type: 'checkout',
        documentId,
        performedBy: req.user._id,
        notes: notes || '',
      });

      item.status = 'In-Use';
      item.assignedTo = user._id;
      await item.save();

      return res.status(201).json(transaction);
    } catch (err) {
      return next(err);
    }
  },
);

router.post(
  '/checkin',
  upload.single('document'),
  [
    body('itemId').isMongoId().withMessage('itemId must be a valid id'),
    body('notes').optional().isString().isLength({ max: 1000 }).withMessage('notes is too long'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { itemId, notes } = req.body;

      const item = await Item.findOne({ _id: itemId, deleted: false });
      if (!item) return sendApiError(res, 404, 'Item not found');
      if (item.status !== 'In-Use') {
        return sendApiError(res, 400, `Item is not checked out (status: ${item.status})`);
      }

      const documentId = req.file ? await saveToGridFS(req.file) : null;

      const transaction = await Transaction.create({
        item: item._id,
        user: item.assignedTo,
        type: 'checkin',
        documentId,
        performedBy: req.user._id,
        notes: notes || '',
      });

      item.status = 'Available';
      item.assignedTo = null;
      await item.save();

      return res.status(201).json(transaction);
    } catch (err) {
      return next(err);
    }
  },
);

module.exports = router;
