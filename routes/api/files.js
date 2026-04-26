const express = require('express');
const mongoose = require('mongoose');
const { authenticateJwt } = require('../../middleware/auth');
const getGridFSBucket = require('../../config/gridfs');

const router = express.Router();

router.get('/:id', authenticateJwt, async (req, res, next) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const bucket = getGridFSBucket();

    const files = await mongoose.connection.db
      .collection('uploads.files')
      .find({ _id: fileId })
      .toArray();

    if (!files.length) return res.status(404).json({ error: 'File not found' });

    res.set('Content-Type', files[0].contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${files[0].filename}"`);
    bucket.openDownloadStream(fileId).pipe(res);
  } catch (err) {
    if (err.name === 'BSONError' || err.message?.includes('must be a string of 24 hex characters')) {
      return res.status(400).json({ error: 'Invalid file id' });
    }
    return next(err);
  }
});

module.exports = router;
