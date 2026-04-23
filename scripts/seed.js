const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const seed = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri || typeof uri !== 'string') {
    console.error(
      'Missing MONGODB_URI. Create a .env file in the project root with:\n' +
        '  MONGODB_URI=mongodb+srv://... or mongodb://127.0.0.1:27017/yourdb\n' +
        'See README.md → Configure environment.',
    );
    process.exit(1);
  }
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
  });
  const hash = await bcrypt.hash('admin123', 10);
  await User.findOneAndUpdate(
    { username: 'admin' },
    { username: 'admin', password: hash, role: 'Admin', status: 'Enabled' },
    { upsert: true, new: true },
  );
  console.log('Admin seeded: admin / admin123');
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  if (/Server selection timed out|ECONNREFUSED|querySrv/i.test(String(err.message))) {
    console.error(
      '\nCould not reach MongoDB. If MONGODB_URI is mongodb://127.0.0.1:..., start MongoDB locally.\n' +
        'Or set MONGODB_URI in .env to your MongoDB Atlas connection string.',
    );
  }
  process.exit(1);
});
