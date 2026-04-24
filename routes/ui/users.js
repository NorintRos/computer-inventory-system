const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.type('html').send('<p>Users UI not implemented</p>');
});

module.exports = router;
