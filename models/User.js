const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['Admin', 'User'], default: 'User' },
    status: { type: String, enum: ['Enabled', 'Disabled'], default: 'Enabled' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('User', userSchema);
