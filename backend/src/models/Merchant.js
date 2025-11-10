const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const merchantSchema = new mongoose.Schema({
  company_name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    required: true
  },
  webhook_url: {
    type: String
  },
  is_active: {
    type: Boolean,
    default: true
  },
  api_key: {
    type: String,
    unique: true
  }
}, {
  timestamps: true
});

// Hash password avant sauvegarde
merchantSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Générer API Key
merchantSchema.methods.generateApiKey = function() {
  this.api_key = require('crypto').randomBytes(32).toString('hex');
};

module.exports = mongoose.model('Merchant', merchantSchema);