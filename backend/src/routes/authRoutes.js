const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { validateInitiatePayment, handleValidationErrors } = require('../middleware/validation');

// ✅ Validation + traitement
router.post('/initiate', validateInitiatePayment, handleValidationErrors, paymentController.initiatePayment);

router.get('/status/:reference', paymentController.checkPaymentStatus);
router.get('/merchant/:merchant_id', paymentController.getMerchantTransactions);

module.exports = router;