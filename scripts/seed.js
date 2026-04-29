const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Item = require('../models/Item');
const Transaction = require('../models/Transaction');

const daysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};

const yearsAgo = (years, extraDays = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() - extraDays);
  return d;
};

async function upsertUser({ username, password, role, status = 'Enabled' }) {
  const hash = await bcrypt.hash(password, 10);
  return User.findOneAndUpdate(
    { username },
    { username, password: hash, role, status },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
}

async function upsertItem(item) {
  return Item.findOneAndUpdate(
    { itemId: item.itemId },
    { ...item, deleted: false },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
}

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
  const [admin, technician, helpdesk, disabledUser] = await Promise.all([
    upsertUser({ username: 'admin', password: 'admin123', role: 'Admin' }),
    upsertUser({ username: 'demo_tech', password: 'demo123', role: 'Technician' }),
    upsertUser({ username: 'demo_helpdesk', password: 'demo123', role: 'Technician' }),
    upsertUser({
      username: 'demo_disabled',
      password: 'demo123',
      role: 'Technician',
      status: 'Disabled',
    }),
  ]);

  const demoItems = [
    {
      itemId: 'DEMO-LAP-001',
      serialNumber: 'SN-DEMO-LAP-001',
      model: 'Latitude 7440',
      brand: 'Dell',
      category: 'Laptop',
      status: 'In-Use',
      assignedTo: technician._id,
      dateAcquired: yearsAgo(1, 42),
    },
    {
      itemId: 'DEMO-LAP-002',
      serialNumber: 'SN-DEMO-LAP-002',
      model: 'ThinkPad T14 Gen 4',
      brand: 'Lenovo',
      category: 'Laptop',
      status: 'Available',
      assignedTo: null,
      dateAcquired: yearsAgo(0, 190),
    },
    {
      itemId: 'DEMO-DESK-001',
      serialNumber: 'SN-DEMO-DESK-001',
      model: 'OptiPlex 7010',
      brand: 'Dell',
      category: 'Desktop',
      status: 'In-Use',
      assignedTo: helpdesk._id,
      dateAcquired: yearsAgo(2, 15),
    },
    {
      itemId: 'DEMO-MON-001',
      serialNumber: 'SN-DEMO-MON-001',
      model: 'UltraSharp U2723QE',
      brand: 'Dell',
      category: 'Monitor',
      status: 'Available',
      assignedTo: null,
      dateAcquired: yearsAgo(0, 80),
    },
    {
      itemId: 'DEMO-SRV-001',
      serialNumber: 'SN-DEMO-SRV-001',
      model: 'PowerEdge R550',
      brand: 'Dell',
      category: 'Server',
      status: 'Maintenance',
      assignedTo: null,
      dateAcquired: yearsAgo(4, 12),
    },
    {
      itemId: 'DEMO-PRN-001',
      serialNumber: 'SN-DEMO-PRN-001',
      model: 'LaserJet Pro M404dn',
      brand: 'HP',
      category: 'Printer',
      status: 'Retired',
      assignedTo: null,
      dateAcquired: yearsAgo(6, 30),
    },
    {
      itemId: 'DEMO-KBD-001',
      serialNumber: 'SN-DEMO-KBD-001',
      model: 'MX Keys Business',
      brand: 'Logitech',
      category: 'Keyboard',
      status: 'Available',
      assignedTo: null,
      dateAcquired: yearsAgo(0, 35),
    },
    {
      itemId: 'DEMO-MOU-001',
      serialNumber: 'SN-DEMO-MOU-001',
      model: 'MX Master 3S',
      brand: 'Logitech',
      category: 'Mouse',
      status: 'Available',
      assignedTo: null,
      dateAcquired: yearsAgo(0, 35),
    },
  ];

  const items = await Promise.all(demoItems.map(upsertItem));
  const itemById = new Map(items.map((item) => [item.itemId, item]));

  const demoItemIds = items.map((item) => item._id);
  await Transaction.deleteMany({ item: { $in: demoItemIds } });

  await Transaction.insertMany(
    [
      {
        item: itemById.get('DEMO-LAP-001')._id,
        user: technician._id,
        type: 'checkout',
        performedBy: admin._id,
        notes: 'Demo checkout: laptop assigned for field support rotation.',
        createdAt: daysAgo(21),
        updatedAt: daysAgo(21),
      },
      {
        item: itemById.get('DEMO-DESK-001')._id,
        user: helpdesk._id,
        type: 'checkout',
        performedBy: admin._id,
        notes: 'Demo checkout: desktop assigned to helpdesk station.',
        createdAt: daysAgo(14),
        updatedAt: daysAgo(14),
      },
      {
        item: itemById.get('DEMO-LAP-002')._id,
        user: technician._id,
        type: 'checkout',
        performedBy: admin._id,
        notes: 'Demo lifecycle: device checked out for onboarding.',
        createdAt: daysAgo(9),
        updatedAt: daysAgo(9),
      },
      {
        item: itemById.get('DEMO-LAP-002')._id,
        user: technician._id,
        type: 'checkin',
        performedBy: admin._id,
        notes: 'Demo lifecycle: returned after onboarding session.',
        createdAt: daysAgo(3),
        updatedAt: daysAgo(3),
      },
      {
        item: itemById.get('DEMO-SRV-001')._id,
        user: disabledUser._id,
        type: 'checkout',
        performedBy: admin._id,
        notes: 'Demo audit trail: historical assignment before maintenance review.',
        createdAt: daysAgo(120),
        updatedAt: daysAgo(120),
      },
      {
        item: itemById.get('DEMO-SRV-001')._id,
        user: disabledUser._id,
        type: 'checkin',
        performedBy: admin._id,
        notes: 'Demo audit trail: server returned and moved into maintenance.',
        createdAt: daysAgo(96),
        updatedAt: daysAgo(96),
      },
    ],
    { timestamps: false },
  );

  console.log('Admin seeded: admin / admin123');
  console.log('Demo users seeded: demo_tech / demo123, demo_helpdesk / demo123');
  console.log(`Demo inventory seeded: ${items.length} assets and 6 history events`);
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
