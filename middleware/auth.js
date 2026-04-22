const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  // 1. Check Authorization header first
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    [, token] = authHeader.split(' ');
  }

  // 2. Fall back to httpOnly cookie
  if (!token && req.cookies) {
    token = req.cookies[process.env.COOKIE_NAME];
  }

  // 3. No token found
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // 4. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 5. Check user exists and is enabled
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (user.status === 'Disabled') {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    // 6. Attach user to request
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = auth;
