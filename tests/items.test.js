const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const app = require('../server');
const User = require('../models/User');
const Item = require('../models/Item');
const ApiKey = require('../models/ApiKey');
const Transaction = require('../models/Transaction');

let adminToken;
let techToken;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  await User.deleteMany({ username: { $in: ['itemsadmin', 'itemstech'] } });
  await Item.deleteMany({ itemId: { $regex: /^TEST-ITEM-/ } });
  await ApiKey.deleteMany({ label: { $regex: /^items-test-/ } });

  const adminHash = await bcrypt.hash('adminpass', 10);
  await User.create({ username: 'itemsadmin', password: adminHash, role: 'Admin', status: 'Enabled' });

  const techHash = await bcrypt.hash('techpass', 10);
  await User.create({ username: 'itemstech', password: techHash, role: 'Technician', status: 'Enabled' });

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'itemsadmin', password: 'adminpass' });
  adminToken = adminLogin.body.token;

  const techLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'itemstech', password: 'techpass' });
  techToken = techLogin.body.token;
});

afterAll(async () => {
  const items = await Item.find({ itemId: { $regex: /^TEST-ITEM-/ } }).select('_id').lean();
  const itemIds = items.map((i) => i._id);
  await Transaction.deleteMany({ item: { $in: itemIds } });
  await User.deleteMany({ username: { $in: ['itemsadmin', 'itemstech'] } });
  await Item.deleteMany({ itemId: { $regex: /^TEST-ITEM-/ } });
  await ApiKey.deleteMany({ label: { $regex: /^items-test-/ } });
});

describe('POST /api/items', () => {
  it('creates an item and returns 201', async () => {
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        itemId: 'TEST-ITEM-001',
        serialNumber: 'ITSN-001',
        model: 'ThinkPad X1',
        brand: 'Lenovo',
        category: 'Laptop',
        dateAcquired: '2024-01-15',
      });

    expect(res.status).toBe(201);
    expect(res.body.itemId).toBe('TEST-ITEM-001');
    expect(res.body.status).toBe('Available');
    expect(res.body.deleted).toBe(false);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ itemId: 'TEST-ITEM-BAD' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

describe('GET /api/items', () => {
  it('returns only non-deleted items', async () => {
    await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        itemId: 'TEST-ITEM-002',
        serialNumber: 'ITSN-002',
        model: 'Latitude 7420',
        brand: 'Dell',
        category: 'Laptop',
        dateAcquired: '2024-02-10',
      });

    const listRes = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${adminToken}`);
    const target = listRes.body.items.find((i) => i.itemId === 'TEST-ITEM-002');
    expect(target).toBeDefined();

    await request(app)
      .delete(`/api/items/${target._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const afterRes = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${adminToken}`);
    const gone = afterRes.body.items.find((i) => i.itemId === 'TEST-ITEM-002');
    expect(gone).toBeUndefined();
  });

  it('works with a valid API key', async () => {
    const keyRes = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'items-test-apikey' });
    expect(keyRes.status).toBe(201);

    const res = await request(app)
      .get('/api/items')
      .set('x-api-key', keyRes.body.key);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});

describe('DELETE /api/items/:id', () => {
  it('soft-deletes (document remains in DB with deleted: true)', async () => {
    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        itemId: 'TEST-ITEM-003',
        serialNumber: 'ITSN-003',
        model: 'MacBook Pro',
        brand: 'Apple',
        category: 'Laptop',
        dateAcquired: '2024-03-01',
      });
    const itemId = createRes.body._id;

    const delRes = await request(app)
      .delete(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);

    const inDb = await Item.findById(itemId);
    expect(inDb).not.toBeNull();
    expect(inDb.deleted).toBe(true);
  });

  it('returns 403 when a non-admin tries to delete', async () => {
    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        itemId: 'TEST-ITEM-004',
        serialNumber: 'ITSN-004',
        model: 'OptiPlex 7090',
        brand: 'Dell',
        category: 'Desktop',
        dateAcquired: '2024-04-01',
      });
    const itemId = createRes.body._id;

    const res = await request(app)
      .delete(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${techToken}`);
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/items/:id', () => {
  let item;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        itemId: 'TEST-ITEM-PUT-001',
        serialNumber: 'ITSN-PUT-001',
        model: 'Original Model',
        brand: 'Lenovo',
        category: 'Laptop',
        dateAcquired: '2024-01-01',
      });
    item = res.body;
  });

  it('updates allowed fields and returns 200', async () => {
    const res = await request(app)
      .put(`/api/items/${item._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ model: 'Updated Model', status: 'Maintenance' });

    expect(res.status).toBe(200);
    expect(res.body.model).toBe('Updated Model');
    expect(res.body.status).toBe('Maintenance');
  });

  it('ignores attempts to change itemId', async () => {
    const res = await request(app)
      .put(`/api/items/${item._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ itemId: 'SHOULD-NOT-CHANGE', brand: 'Dell' });

    expect(res.status).toBe(200);
    expect(res.body.itemId).toBe('TEST-ITEM-PUT-001');
    expect(res.body.brand).toBe('Dell');
  });
});

describe('GET /api/items/:id/history', () => {
  let histItem;

  beforeAll(async () => {
    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        itemId: 'TEST-ITEM-HIST-001',
        serialNumber: 'ITSN-HIST-001',
        model: 'History Target',
        brand: 'TestBrand',
        category: 'Laptop',
        dateAcquired: '2024-01-01',
      });
    histItem = createRes.body;

    const techUser = await User.findOne({ username: 'itemstech' });
    await request(app)
      .post('/api/transactions/checkout')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('itemId', histItem._id)
      .field('userId', techUser._id.toString())
      .field('notes', 'tx-test-history');
  });

  it('returns transaction log with populated user info', async () => {
    const res = await request(app)
      .get(`/api/items/${histItem._id}/history`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.history)).toBe(true);
    expect(res.body.history.length).toBeGreaterThan(0);
    expect(res.body.history[0].type).toBe('checkout');
    expect(res.body.history[0].assignee.username).toBe('itemstech');
  });

  it('returns 404 for a non-existent item', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/items/${fakeId}/history`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
