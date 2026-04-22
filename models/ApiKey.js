const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema(
  {
    hashedKey: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('ApiKey', apiKeySchema);
