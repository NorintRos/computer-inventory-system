const mongoose = require('mongoose');

require('../server');

beforeAll(async () => {
  await new Promise((resolve) => {
    if (mongoose.connection.readyState === 1) {
      resolve();
      return;
    }
    mongoose.connection.once('connected', resolve);
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('getGridFSBucket', () => {
  it('throws a descriptive error when called before MongoDB connects', () => {
    const originalDb = mongoose.connection.db;
    Object.defineProperty(mongoose.connection, 'db', {
      configurable: true,
      get: () => undefined,
    });

    let threw = false;
    try {
      jest.resetModules();
      // eslint-disable-next-line global-require
      const freshGet = require('../config/gridfs');
      freshGet();
    } catch (e) {
      threw = true;
      expect(e.message).toBe('GridFS unavailable: MongoDB connection is not yet open');
    } finally {
      Object.defineProperty(mongoose.connection, 'db', {
        configurable: true,
        get: () => originalDb,
      });
    }

    expect(threw).toBe(true);
  });
});
