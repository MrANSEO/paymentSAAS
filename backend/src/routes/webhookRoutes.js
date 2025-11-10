const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Webhook MeSomb
router.post('/mesomb', webhookController.handleMeSombWebhook);

module.exports = router;