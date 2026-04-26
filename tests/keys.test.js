const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const app = require('../server');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');

let adminToken;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  await User.deleteMany({ username: 'keysadmin' });
  await ApiKey.deleteMany({ label: { $regex: /^keys-test-/ } });

  const hash = await bcrypt.hash('adminpass', 10);
  await User.create({ username: 'keysadmin', password: hash, role: 'Admin', status: 'Enabled' });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'keysadmin', password: 'adminpass' });
  adminToken = loginRes.body.token;
});

afterAll(async () => {
  await User.deleteMany({ username: 'keysadmin' });
  await ApiKey.deleteMany({ label: { $regex: /^keys-test-/ } });
});

describe('POST /api/keys', () => {
  it('returns the raw key once in the response', async () => {
    const res = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'keys-test-generate' });

    expect(res.status).toBe(201);
    expect(res.body.key).toBeDefined();
    expect(typeof res.body.key).toBe('string');
    expect(res.body.label).toBe('keys-test-generate');
    expect(res.body.id).toBeDefined();
  });
});

describe('GET /api/keys', () => {
  it('does not include hashedKey or lookupHash in response', async () => {
    const res = await request(app)
      .get('/api/keys')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.keys)).toBe(true);
    res.body.keys.forEach((k) => {
      expect(k.hashedKey).toBeUndefined();
      expect(k.lookupHash).toBeUndefined();
    });
  });
});

describe('API key auth on GET /api/items', () => {
  it('grants access with a valid API key', async () => {
    const keyRes = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'keys-test-valid' });
    expect(keyRes.status).toBe(201);

    const res = await request(app)
      .get('/api/items')
      .set('x-api-key', keyRes.body.key);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('returns 401 with an invalid API key', async () => {
    const res = await request(app)
      .get('/api/items')
      .set('x-api-key', 'cis_totallyfakekey');

    expect(res.status).toBe(401);
  });

  it('returns 401 after the key is revoked', async () => {
    const keyRes = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'keys-test-revoke' });
    expect(keyRes.status).toBe(201);
    const { key: rawKey, id: keyId } = keyRes.body;

    const delRes = await request(app)
      .delete(`/api/keys/${keyId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(204);

    const res = await request(app)
      .get('/api/items')
      .set('x-api-key', rawKey);
    expect(res.status).toBe(401);
  });
});
