const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const app = require('../server');
const User = require('../models/User');

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

});

afterAll(async () => {
  await User.deleteMany({ username: { $in: ['testadmin', 'testtech', 'disableduser'] } });
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
