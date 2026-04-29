const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const app = require('../server');
const User = require('../models/User');
const Item = require('../models/Item');
const Transaction = require('../models/Transaction');

let adminToken;
let testUser;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  await User.deleteMany({ username: { $in: ['txadmin', 'txuser'] } });
  await Item.deleteMany({ itemId: { $regex: /^TX-/ } });

  const adminHash = await bcrypt.hash('adminpass', 10);
  await User.create({ username: 'txadmin', password: adminHash, role: 'Admin', status: 'Enabled' });

  const userHash = await bcrypt.hash('userpass', 10);
  testUser = await User.create({
    username: 'txuser',
    password: userHash,
    role: 'Technician',
    status: 'Enabled',
  });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'txadmin', password: 'adminpass' });
  adminToken = loginRes.body.token;
});

afterAll(async () => {
  await User.deleteMany({ username: { $in: ['txadmin', 'txuser'] } });
  await Item.deleteMany({ itemId: { $regex: /^TX-/ } });
  await Transaction.deleteMany({ notes: { $regex: /^tx-test/ } });
});

describe('POST /api/transactions/checkout', () => {
  let availableItem;
  let maintenanceItem;
  let retiredItem;

  beforeAll(async () => {
    [availableItem, maintenanceItem, retiredItem] = await Item.create([
      {
        itemId: 'TX-001',
        serialNumber: 'TXSN-001',
        model: 'Checkout Target',
        brand: 'TestBrand',
        category: 'Laptop',
        dateAcquired: '2024-01-01',
        status: 'Available',
      },
      {
        itemId: 'TX-002',
        serialNumber: 'TXSN-002',
        model: 'Maintenance Item',
        brand: 'TestBrand',
        category: 'Laptop',
        dateAcquired: '2024-01-01',
        status: 'Maintenance',
      },
      {
        itemId: 'TX-003',
        serialNumber: 'TXSN-003',
        model: 'Retired Item',
        brand: 'TestBrand',
        category: 'Laptop',
        dateAcquired: '2024-01-01',
        status: 'Retired',
      },
    ]);
  });

  it('sets item status to In-Use and assigns it to the user', async () => {
    const res = await request(app)
      .post('/api/transactions/checkout')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('itemId', availableItem._id.toString())
      .field('userId', testUser._id.toString())
      .field('notes', 'tx-test-checkout');

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('checkout');

    const updated = await Item.findById(availableItem._id);
    expect(updated.status).toBe('In-Use');
    expect(updated.assignedTo.toString()).toBe(testUser._id.toString());
  });

  it('returns 400 when item status is Maintenance', async () => {
    const res = await request(app)
      .post('/api/transactions/checkout')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('itemId', maintenanceItem._id.toString())
      .field('userId', testUser._id.toString());

    expect(res.status).toBe(400);
  });

  it('returns 400 when item status is Retired', async () => {
    const res = await request(app)
      .post('/api/transactions/checkout')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('itemId', retiredItem._id.toString())
      .field('userId', testUser._id.toString());

    expect(res.status).toBe(400);
  });
});

describe('POST /api/transactions/checkin', () => {
  let inUseItem;

  beforeAll(async () => {
    inUseItem = await Item.create({
      itemId: 'TX-004',
      serialNumber: 'TXSN-004',
      model: 'Checkin Target',
      brand: 'TestBrand',
      category: 'Laptop',
      dateAcquired: '2024-01-01',
      status: 'In-Use',
      assignedTo: testUser._id,
    });
  });

  it('sets item status back to Available and clears assignedTo', async () => {
    const res = await request(app)
      .post('/api/transactions/checkin')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('itemId', inUseItem._id.toString())
      .field('notes', 'tx-test-checkin');

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('checkin');

    const updated = await Item.findById(inUseItem._id);
    expect(updated.status).toBe('Available');
    expect(updated.assignedTo).toBeNull();
  });

  it('returns 400 when item is In-Use but has no assignedTo', async () => {
    const orphanItem = await Item.create({
      itemId: 'TX-ORPHAN-001',
      serialNumber: 'TXSN-ORPHAN-001',
      model: 'Orphan Checkin Target',
      brand: 'TestBrand',
      category: 'Laptop',
      dateAcquired: '2024-01-01',
      status: 'In-Use',
      assignedTo: null,
    });

    const res = await request(app)
      .post('/api/transactions/checkin')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('itemId', orphanItem._id.toString())
      .field('notes', 'tx-test-orphan-checkin');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no assigned user/i);

    await Item.findByIdAndDelete(orphanItem._id);
  });
});

describe('File upload on checkout', () => {
  let uploadItem;

  beforeAll(async () => {
    uploadItem = await Item.create({
      itemId: 'TX-005',
      serialNumber: 'TXSN-005',
      model: 'Upload Target',
      brand: 'TestBrand',
      category: 'Laptop',
      dateAcquired: '2024-01-01',
      status: 'Available',
    });
  });

  it('stores a non-null documentId on the transaction when a file is attached', async () => {
    const res = await request(app)
      .post('/api/transactions/checkout')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('itemId', uploadItem._id.toString())
      .field('userId', testUser._id.toString())
      .field('notes', 'tx-test-upload')
      .attach('document', Buffer.from('mock pdf content'), {
        filename: 'receipt.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body.documentId).not.toBeNull();
    expect(mongoose.isValidObjectId(String(res.body.documentId))).toBe(true);
  });
});
