const Merchant = require('../models/Merchant');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class AuthController {
  // Inscription d'un marchand
  async register(req, res) {
    try {
      const { company_name, email, password, phone, webhook_url } = req.body;

      //  VALIDATION DES CHAMPS OBLIGATOIRES
      if (!company_name || !email || !password || !phone) {
        return res.status(400).json({
          success: false,
          message: 'Champs manquants: company_name, email, password, phone requis'
        });
      }

      // Validation du format email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Format d\'email invalide'
        });
      }

      // Validation de la longueur du mot de passe
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Le mot de passe doit contenir au moins 6 caractères'
        });
      }

      // Validation du format du téléphone (basique)
      const phoneRegex = /^[0-9+-\s()]{8,20}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          success: false,
          message: 'Format de téléphone invalide'
        });
      }

      // Vérifier si le marchand existe déjà par email ou nom d'entreprise
      const existingMerchant = await Merchant.findOne({ 
        $or: [
          { email: email.toLowerCase().trim() },
          { company_name: company_name.trim() }
        ]
      });

      if (existingMerchant) {
        const message = existingMerchant.email === email.toLowerCase() 
          ? 'Un marchand avec cet email existe déjà' 
          : 'Un marchand avec ce nom d\'entreprise existe déjà';
        
        return res.status(400).json({
          success: false,
          message
        });
      }

      // Créer le marchand avec données nettoyées
      const merchant = new Merchant({
        company_name: company_name.trim(),
        email: email.toLowerCase().trim(),
        password: password,
        phone: phone.trim(),
        webhook_url: webhook_url ? webhook_url.trim() : ''
      });

      // Générer une clé API sécurisée
      merchant.api_key = `pk_${crypto.randomBytes(24).toString('hex')}`;

      await merchant.save();

      // Ne pas renvoyer le mot de passe dans la réponse
      const merchantResponse = {
        id: merchant._id,
        company_name: merchant.company_name,
        email: merchant.email,
        phone: merchant.phone,
        webhook_url: merchant.webhook_url,
        api_key: merchant.api_key,
        is_active: merchant.is_active,
        created_at: merchant.createdAt
      };

      res.status(201).json({
        success: true,
        message: 'Marchand inscrit avec succès',
        data: {
          merchant: merchantResponse
        }
      });

    } catch (error) {
      console.error('Erreur inscription:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Connexion d'un marchand
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validation des champs requis
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email et mot de passe requis'
        });
      }

      // Vérifier si le marchand existe
      const merchant = await Merchant.findOne({ 
        email: email.toLowerCase().trim() 
      });

      if (!merchant) {
        return res.status(400).json({
          success: false,
          message: 'Email ou mot de passe incorrect'
        });
      }

      // Vérifier si le compte est actif
      if (!merchant.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Compte désactivé. Contactez l\'administrateur.'
        });
      }

      // Vérifier le mot de passe
      const isPasswordValid = await bcrypt.compare(password, merchant.password);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Email ou mot de passe incorrect'
        });
      }

      // Générer un token JWT sécurisé
      const token = jwt.sign(
        { 
          merchantId: merchant._id,
          email: merchant.email
        },
        process.env.JWT_SECRET || 'votre_super_secret_jwt_tres_securise_ici',
        { expiresIn: '24h' }
      );

      // Données du marchand à renvoyer (sans informations sensibles)
      const merchantResponse = {
        id: merchant._id,
        company_name: merchant.company_name,
        email: merchant.email,
        phone: merchant.phone,
        webhook_url: merchant.webhook_url,
        api_key: merchant.api_key,
        is_active: merchant.is_active
      };

      res.status(200).json({
        success: true,
        message: 'Connexion réussie',
        data: {
          merchant: merchantResponse,
          token,
          expires_in: '24h'
        }
      });

    } catch (error) {
      console.error('Erreur connexion:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // NOUVELLE MÉTHODE : Récupérer le profil (optionnelle mais utile)
  async getProfile(req, res) {
    try {
      const merchant = await Merchant.findById(req.merchantId).select('-password');
      
      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: 'Marchand non trouvé'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          merchant
        }
      });

    } catch (error) {
      console.error('Erreur récupération profil:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // NOUVELLE MÉTHODE : Régénérer la clé API (optionnelle mais utile)
  async regenerateApiKey(req, res) {
    try {
      const merchant = await Merchant.findById(req.merchantId);
      
      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: 'Marchand non trouvé'
        });
      }

      // Générer une nouvelle clé API
      const newApiKey = `pk_${crypto.randomBytes(24).toString('hex')}`;
      merchant.api_key = newApiKey;
      
      await merchant.save();

      res.status(200).json({
        success: true,
        message: 'Clé API régénérée avec succès',
        data: {
          new_api_key: newApiKey
        }
      });

    } catch (error) {
      console.error(' Erreur régénération clé API:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new AuthController();