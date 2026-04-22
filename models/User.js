const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['Admin', 'Technician'],
      default: 'Technician',
    },
    status: {
      type: String,
      enum: ['Enabled', 'Disabled'],
      default: 'Enabled',
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('User', userSchema);
