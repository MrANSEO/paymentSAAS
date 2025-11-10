// ✅ CORRECTION : src/middleware/validation.js
const { body, validationResult } = require('express-validator');

// ✅ CORRECTION : Validation pour /payments/initiate
const validateInitiatePayment = [
  // Montant : entier ≥ 10000 FCFA (minimum MeSomb)
  body('amount')
    .isInt({ min: 10000 })
    .withMessage('Le montant doit être un entier d\'au moins 10000 FCFA'),

  // ✅ CORRECTION : Numéro de téléphone camerounais avec ou sans +
  body('customer_phone')
    .matches(/^\+?237[0-9]{9}$/)
    .withMessage('Le numéro doit être un numéro camerounais valide (format: 237XXXXXXXXX ou +237XXXXXXXXX)')
    .customSanitizer(value => {
      // Normaliser : enlever le + si présent => on garde toujours "237XXXXXXXXX"
      return String(value || '').replace(/^\+/, '');
    }),

  // Opérateur : uniquement ORANGE ou MTN
  body('operator')
    .isIn(['ORANGE', 'MTN'])
    .withMessage('Opérateur doit être ORANGE ou MTN'),

  // merchant_id : doit être une chaîne non vide
  body('merchant_id')
    .isString()
    .notEmpty()
    .withMessage('merchant_id est requis')
];

// ✅ CORRECTION : Validation pour l'inscription marchand
const validateRegister = [
  body('company_name')
    .notEmpty()
    .withMessage('Nom de l\'entreprise requis')
    .trim(),

  body('email')
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Mot de passe ≥ 6 caractères'),

  // ✅ CORRECTION : Téléphone marchand avec format flexible
  body('phone')
    .matches(/^\+?237[0-9]{9}$/)
    .withMessage('Téléphone marchand : numéro camerounais valide requis (format: 237XXXXXXXXX ou +237XXXXXXXXX)')
    .customSanitizer(value => {
      // Normaliser : enlever le + si présent
      return String(value || '').replace(/^\+/, '');
    }),

  // Webhook URL optionnel mais doit être valide si fourni
  body('webhook_url')
    .optional()
    .isURL()
    .withMessage('URL du webhook invalide')
];

// Middleware central pour retourner les erreurs de validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ Erreurs de validation:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array({ onlyFirstError: true }) // Une seule erreur par champ
    });
  }
  next();
};

module.exports = {
  validateInitiatePayment,
  validateRegister,
  handleValidationErrors
};