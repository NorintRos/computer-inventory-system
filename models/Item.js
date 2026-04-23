const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    sku: { type: String, index: true },
    category: String,
    status: { type: String, default: 'Available' },
    quantity: { type: Number, default: 1 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Item', itemSchema);
