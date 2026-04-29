const mongoose = require('mongoose');

let bucket;

const getGridFSBucket = () => {
  if (!bucket) {
    const { db } = mongoose.connection;
    if (!db) {
      throw new Error('GridFS unavailable: MongoDB connection is not yet open');
    }
    bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' });
  }
  return bucket;
};

module.exports = getGridFSBucket;
