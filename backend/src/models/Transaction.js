const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  reference: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'XAF'
  },
  customer_phone: {
    type: String,
    required: true
  },
  operator: {
    type: String,
    enum: ['ORANGE', 'MTN'],
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'REFUNDED'],
    default: 'PENDING'
  },
  mesomb_transaction_id: {
    type: String
  },
  merchant_id: {
    type: String,
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Index pour les recherches rapides
transactionSchema.index({ reference: 1 });
transactionSchema.index({ customer_phone: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);