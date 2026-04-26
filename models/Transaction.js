const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['checkout', 'checkin'], required: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Transaction', transactionSchema);
