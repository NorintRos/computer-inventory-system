const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.type('html').send('<p>Items UI not implemented — use /api/items</p>');
});

module.exports = router;
