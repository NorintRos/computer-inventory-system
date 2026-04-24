const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.type('html').send('<p>History UI not implemented</p>');
});

module.exports = router;
