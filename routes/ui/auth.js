const express = require('express');

const router = express.Router();

router.get('/login', (req, res) => {
  res.type('html').send('<p>Use POST /api/auth/login</p>');
});

module.exports = router;
