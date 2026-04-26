const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.type('html').send('<p>Keys UI not implemented — use /api/keys</p>');
});

module.exports = router;
