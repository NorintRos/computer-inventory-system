const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true, unique: true, trim: true },
    serialNumber: { type: String, required: true, unique: true, trim: true },
    model: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['Laptop', 'Desktop', 'Server', 'Monitor', 'Keyboard', 'Mouse', 'Printer', 'Other'],
    },
    status: {
      type: String,
      enum: ['Available', 'In-Use', 'Maintenance', 'Retired'],
      default: 'Available',
    },
    dateAcquired: { type: Date, required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Item', itemSchema);
