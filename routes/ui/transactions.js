const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.type('html').send('<p>Transactions UI not implemented — use /api/transactions</p>');
});

module.exports = router;
