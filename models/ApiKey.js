const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema(
  {
    /** SHA-256 hex of raw key — indexed lookup; never returned from list endpoints */
    lookupHash: { type: String, required: true, unique: true, select: false },
    /** bcrypt hash of raw key */
    hashedKey: { type: String, required: true, select: false },
    label: { type: String, default: 'API Key' },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('ApiKey', apiKeySchema);
