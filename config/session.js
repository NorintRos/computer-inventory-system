// eslint-disable-next-line no-unused-vars
const session = require('express-session');
const { MongoStore } = require('connect-mongo');

const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 8 },
};

module.exports = sessionConfig;
