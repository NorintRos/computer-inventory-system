const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.type('html').send('<p>Computer Inventory System</p>');
});

module.exports = router;
