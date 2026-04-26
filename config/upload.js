const multer = require('multer');
const getGridFSBucket = require('./gridfs');

const upload = multer({ storage: multer.memoryStorage() });

async function saveToGridFS(file) {
  const bucket = getGridFSBucket();
  const filename = `${Date.now()}-${file.originalname}`;
  const stream = bucket.openUploadStream(filename, { contentType: file.mimetype });
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(stream.id));
    stream.on('error', reject);
    stream.end(file.buffer);
  });
}

module.exports = { upload, saveToGridFS };
