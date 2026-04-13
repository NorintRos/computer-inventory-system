require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const hash = await bcrypt.hash('admin123', 10);
  await User.findOneAndUpdate(
    { username: 'admin' },
    { username: 'admin', password: hash, role: 'Admin', status: 'Enabled' },
    { upsert: true, new: true },
  );
  console.log('Admin seeded: admin / admin123');
  process.exit(0);
};

seed();
