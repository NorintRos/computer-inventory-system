const express = require('express');
const { authenticateJwt } = require('../../middleware/auth');

const router = express.Router();

router.get('/me', authenticateJwt, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      role: req.user.role,
      status: req.user.status,
    },
  });
});

module.exports = router;
