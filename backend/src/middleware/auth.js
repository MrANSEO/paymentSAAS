const jwt = require('jsonwebtoken');
const Merchant = require('../models/Merchant');

// Vérifier le token JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'accès manquant'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.merchantId = decoded.merchantId;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Token invalide'
    });
  }
};

// Vérifier la clé API
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'Clé API manquante'
      });
    }

    const merchant = await Merchant.findOne({ api_key: apiKey });
    if (!merchant) {
      return res.status(403).json({
        success: false,
        message: 'Clé API invalide'
      });
    }

    req.merchant = merchant;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erreur d\'authentification'
    });
  }
};

module.exports = {
  authenticateToken,
  authenticateApiKey
};