const mongoose = require('mongoose');

let bucket;

const getGridFSBucket = () => {
  if (!bucket) {
    const { db } = mongoose.connection;
    bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' });
  }
  return bucket;
};

module.exports = getGridFSBucket;
