// src/controllers/paymentController.js
const Transaction = require('../models/Transaction');
const MeSombService = require('../services/mesombOfficialService');
const NotificationService = require('../services/notificationService');
const { v4: uuidv4 } = require('uuid');

class PaymentController {
  async initiatePayment(req, res) {
    try {
      const { amount, customer_phone, operator, merchant_id, metadata } = req.body;

      // ✅ Validation déjà gérée par middleware (express-validator)

      const reference = `TX-${uuidv4().substring(0, 8).toUpperCase()}`;
      const transaction = new Transaction({
        reference,
        amount,
        customer_phone,
        operator,
        merchant_id,
        metadata: metadata || {},
        status: 'PENDING' // 🔑 Toujours PENDING au début
      });
      await transaction.save();

      console.log(`💰 Paiement initié: ${reference}`);
      await NotificationService.sendPaymentConfirmation(customer_phone, amount, reference);

      // Appel MeSomb pour initier le paiement
      const paymentResult = await MeSombService.makePayment(amount, customer_phone, operator);

      if (!paymentResult.success) {
        // Échec d'initiation (ex: clés invalides, service non activé)
        await Transaction.findByIdAndUpdate(transaction._id, {
          status: 'FAILED',
          metadata: { ...metadata, error: paymentResult.error }
        });
        await NotificationService.sendPaymentFailure(customer_phone, amount, reference, paymentResult.error);
        return res.status(400).json({ success: false, message: 'Échec MeSomb', error: paymentResult.error });
      }

      // ✅ On sauvegarde l'ID MeSomb, mais PAS le statut
      await Transaction.findByIdAndUpdate(transaction._id, {
        mesomb_transaction_id: paymentResult.data.transactionId
      });

      res.status(200).json({
        success: true,
        message: 'Paiement initié – confirmez sur votre téléphone',
        data: {
          reference,
          transaction_id: paymentResult.data.transactionId,
          status: 'PENDING'
        }
      });
    } catch (error) {
      console.error('❌ Erreur paiement:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  // 🔒 Lecture seule du statut (ne PAS appeler MeSomb ici)
  async checkPaymentStatus(req, res) {
    try {
      const { reference } = req.params;
      const transaction = await Transaction.findOne({ reference });
      if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction introuvable' });
      }

      // 🚫 SUPPRESSION du polling vers MeSomb
      // Le statut est mis à jour UNIQUEMENT par le webhook

      res.status(200).json({
        success: true,
        data: {
          reference: transaction.reference,
          amount: transaction.amount,
          status: transaction.status, // ← État stocké en base (venant du webhook)
          operator: transaction.operator,
          created_at: transaction.createdAt
        }
      });
    } catch (error) {
      console.error('❌ Erreur statut:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  async getMerchantTransactions(req, res) {
    try {
      const { merchant_id } = req.params;
      const transactions = await Transaction.find({ merchant_id })
        .sort({ createdAt: -1 })
        .limit(20);
      res.json({ success: true, data: { transactions } });
    } catch (error) {
      console.error('❌ Erreur historique marchand:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
}

module.exports = new PaymentController();