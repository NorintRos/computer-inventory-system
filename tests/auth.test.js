const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const app = require('../server');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const limiter = require('../middleware/rateLimiter');

beforeAll(async () => {
  // Wait for DB connection
  await new Promise((resolve) => {
    if (mongoose.connection.readyState === 1) {
      resolve();
      return;
    }
    mongoose.connection.once('connected', resolve);
  });

  // Clean up test users
  await User.deleteMany({ username: { $in: ['testadmin', 'testtech', 'disableduser'] } });

  // Create test admin
  const hash = await bcrypt.hash('adminpass', 10);
  await User.create({ username: 'testadmin', password: hash, role: 'Admin', status: 'Enabled' });

  // Create test technician
  const techHash = await bcrypt.hash('techpass', 10);
  await User.create({
    username: 'testtech',
    password: techHash,
    role: 'Technician',
    status: 'Enabled',
  });

  // Create disabled user
  const disabledHash = await bcrypt.hash('disabledpass', 10);
  await User.create({
    username: 'disableduser',
    password: disabledHash,
    role: 'Technician',
    status: 'Disabled',
  });

  // Drop apikeys collection to clear any stale indexes from prior schema versions,
  // then seed two API keys owned by testtech so we can verify the disable cascade.
  try {
    await mongoose.connection.collection('apikeys').drop();
  } catch (err) {
    // ns not found is fine — collection didn't exist yet
    if (err.codeName !== 'NamespaceNotFound') throw err;
  }
  const tech = await User.findOne({ username: 'testtech' });
  await ApiKey.create([
    {
      lookupHash: 'lookup-cascade-1',
      hashedKey: 'fakehash1',
      label: 'cascade-test-1',
      createdBy: tech._id,
      active: true,
    },
    {
      lookupHash: 'lookup-cascade-2',
      hashedKey: 'fakehash2',
      label: 'cascade-test-2',
      createdBy: tech._id,
      active: true,
    },
  ]);
});

afterAll(async () => {
  await User.deleteMany({ username: { $in: ['testadmin', 'testtech', 'disableduser'] } });
  await ApiKey.deleteMany({ label: { $in: ['cascade-test-1', 'cascade-test-2'] } });
  await mongoose.connection.close();
});

describe('POST /api/auth/login', () => {
  it('returns 200 and token with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'adminpass' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('testadmin');
    expect(res.body.user.role).toBe('Admin');
    expect(res.body.user.id).toBeDefined();
    // httpOnly cookie should be set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(new RegExp(process.env.COOKIE_NAME));
  });

  it('returns 401 with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('returns 403 for disabled user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'disableduser', password: 'disabledpass' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Account is disabled');
  });
});

describe('Protected routes', () => {
  it('returns 401 when no token provided', async () => {
    const res = await request(app).post('/api/users');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No token provided');
  });

  it('returns 403 when Technician hits Admin-only route', async () => {
    // Login as technician
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testtech', password: 'techpass' });

    const techToken = loginRes.body.token;

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${techToken}`)
      .send({ username: 'newuser', password: 'newpass' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Admin access required');
  });
});

describe('PATCH /api/users/:id/status cascade', () => {
  it('invalidates all API keys when disabling a user', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'adminpass' });
    const adminToken = loginRes.body.token;

    const tech = await User.findOne({ username: 'testtech' });

    const before = await ApiKey.find({ createdBy: tech._id });
    expect(before.length).toBe(2);
    expect(before.every((k) => k.active)).toBe(true);

    const res = await request(app)
      .patch(`/api/users/${tech._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Disabled' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Disabled');

    const after = await ApiKey.find({ createdBy: tech._id });
    expect(after.length).toBe(2);
    expect(after.every((k) => k.active === false)).toBe(true);

    // Restore for subsequent tests
    await User.findByIdAndUpdate(tech._id, { status: 'Enabled' });
  });
});

describe('auth middleware — status check at request time', () => {
  it('returns 403 when a valid token belongs to a user disabled after issuance', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testtech', password: 'techpass' });
    const techToken = loginRes.body.token;
    expect(loginRes.status).toBe(200);

    const tech = await User.findOne({ username: 'testtech' });
    await User.findByIdAndUpdate(tech._id, { status: 'Disabled' });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${techToken}`)
      .send({ username: 'x', password: 'y' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Account is disabled');

    await User.findByIdAndUpdate(tech._id, { status: 'Enabled' });
  });
});

describe('auth middleware — cookie fallback', () => {
  it('authenticates via httpOnly cookie when no Authorization header is set', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'adminpass' });

    const setCookie = loginRes.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieHeader = setCookie
      .map((c) => c.split(';')[0])
      .find((c) => c.startsWith(`${process.env.COOKIE_NAME}=`));
    expect(cookieHeader).toBeDefined();

    const res = await request(app)
      .post('/api/users')
      .set('Cookie', cookieHeader)
      .send({ username: 'cookie-test-user', password: 'pw12345' });

    expect(res.status).toBe(201);
    await User.deleteMany({ username: 'cookie-test-user' });
  });
});

describe('PATCH /api/users/:id/role', () => {
  it('Admin updates user role and returns 200 with updated role', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'adminpass' });
    const adminToken = loginRes.body.token;

    const tech = await User.findOne({ username: 'testtech' });

    const res = await request(app)
      .patch(`/api/users/${tech._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'Admin' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('Admin');
    expect(res.body.password).toBeUndefined();

    await User.findByIdAndUpdate(tech._id, { role: 'Technician' });
  });

  it('returns 403 when a Technician attempts a role change', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testtech', password: 'techpass' });
    const techToken = loginRes.body.token;

    const tech = await User.findOne({ username: 'testtech' });

    const res = await request(app)
      .patch(`/api/users/${tech._id}/role`)
      .set('Authorization', `Bearer ${techToken}`)
      .send({ role: 'Admin' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Admin access required');
  });

  it('returns 400 when the role value is not a valid enum', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'adminpass' });
    const adminToken = loginRes.body.token;

    const tech = await User.findOne({ username: 'testtech' });

    const res = await request(app)
      .patch(`/api/users/${tech._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'SuperUser' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent user ID', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'adminpass' });
    const adminToken = loginRes.body.token;

    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .patch(`/api/users/${fakeId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'Admin' });

    expect(res.status).toBe(404);
  });
});

describe('Rate limiter configuration', () => {
  it('has max set to 20 req/min per security spec', () => {
    expect(limiter.options.max).toBe(20);
  });
});
