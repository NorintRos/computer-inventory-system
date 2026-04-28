const express = require('express');
const mongoose = require('mongoose');
const { param } = require('express-validator');
const { authenticateJwt } = require('../../middleware/auth');
const getGridFSBucket = require('../../config/gridfs');
const { validateRequest, sendApiError } = require('../../middleware/validateRequest');

const router = express.Router();

router.get(
  '/:id',
  authenticateJwt,
  [param('id').isMongoId().withMessage('Invalid file id')],
  validateRequest,
  async (req, res, next) => {
    try {
      const fileId = new mongoose.Types.ObjectId(req.params.id);
      const bucket = getGridFSBucket();

      const files = await mongoose.connection.db
        .collection('uploads.files')
        .find({ _id: fileId })
        .toArray();

      if (!files.length) return sendApiError(res, 404, 'File not found');

      res.set('Content-Type', files[0].contentType || 'application/octet-stream');
      res.set('Content-Disposition', `inline; filename="${files[0].filename}"`);
      bucket.openDownloadStream(fileId).pipe(res);
    } catch (err) {
      return next(err);
    }
  },
);

module.exports = router;
