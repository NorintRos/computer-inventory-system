const express = require('express');
const { requireAuth } = require('../../middleware/uiAuth');

const router = express.Router();

router.use(requireAuth);

router.get('/checkout', (req, res) => {
  res.render('transactions/stub', {
    title: 'Check out',
    message:
      'Web UI for check-out is not built yet. Another team member can wire this form to POST /api/transactions/checkout (multipart, JWT).',
    apiPath: '/api/transactions/checkout',
  });
});

router.get('/checkin', (req, res) => {
  res.render('transactions/stub', {
    title: 'Check in',
    message:
      'Web UI for check-in is not built yet. Wire this to POST /api/transactions/checkin (multipart, JWT).',
    apiPath: '/api/transactions/checkin',
  });
});

router.get('/', (req, res) => {
  res.render('transactions/stub', {
    title: 'Transactions',
    message: 'Use Check out / Check in above, or the transactions API.',
    apiPath: '/api/transactions',
  });
});

module.exports = router;
