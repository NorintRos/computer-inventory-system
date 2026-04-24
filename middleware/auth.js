const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    [, token] = authHeader.split(' ');
  }
  if (!token && req.cookies) {
    token = req.cookies[process.env.COOKIE_NAME];
  }
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (user.status === 'Disabled') {
      return res.status(403).json({ error: 'Account is disabled' });
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = auth;
