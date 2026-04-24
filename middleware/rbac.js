const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
};

module.exports = { adminOnly };
