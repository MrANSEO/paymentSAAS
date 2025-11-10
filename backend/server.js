// ✅ CORRECTION : server.js
require('dotenv').config();
const express = require('express');
const connectDB = require('./src/config/database');
const securityMiddleware = require('./src/middleware/security');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const webhookRoutes = require('./src/routes/webhookRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Connexion base de données
connectDB();
app.set('trust proxy', 1);

// Middleware de sécurité
app.use(securityMiddleware.helmet());
app.use(securityMiddleware.corsMiddleware);
app.use(securityMiddleware.limiter);

// ✅ CORRECTION : Raw body pour le webhook (AVANT le JSON global)
app.use(
  '/api/v1/webhooks/mesomb',
  express.raw({
    // accepter application/json même avec charset (ex: application/json; charset=utf-8)
    type: (req) => {
      const ct = (req.headers['content-type'] || '').toLowerCase();
      return ct.includes('application/json') || ct.includes('+json');
    },
    limit: '10mb',
    // conserver le buffer brut pour la vérification de signature
    verify: (req, res, buf /*, encoding */) => {
      req.rawBody = buf;
    }
  })
);

// Middleware pour parser le JSON (pour les autres routes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ✅ AJOUT : Logger des requêtes avec plus de détails
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  
  // Logger les headers importants (sauf pour /health)
  if (req.path !== '/health') {
    console.log('  Headers:', {
      'content-type': req.headers['content-type'],
      'x-api-key': req.headers['x-api-key'] ? '***' : undefined,
      'authorization': req.headers['authorization'] ? 'Bearer ***' : undefined
    });
  }
  
  next();
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

// Route santé
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API Payment SaaS MeSomb en fonctionnement',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    mongodb: 'Connecté',
    mesomb: {
      configured: !!(process.env.MESOMB_APP_KEY && process.env.MESOMB_API_KEY && process.env.MESOMB_SECRET_KEY),
      app_key: process.env.MESOMB_APP_KEY ? '✅ Configuré' : '❌ Manquant',
      api_key: process.env.MESOMB_API_KEY ? '✅ Configuré' : '❌ Manquant',
      secret_key: process.env.MESOMB_SECRET_KEY ? '✅ Configuré' : '❌ Manquant'
    }
  });
});

// ✅ AJOUT : Route de test pour vérifier le raw body
app.post('/test-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  console.log('📦 Test webhook:');
  console.log('  - Buffer:', req.body);
  console.log('  - String:', req.body.toString());
  console.log('  - Headers:', req.headers);
  res.json({ success: true, message: 'Test OK' });
});

// Middleware global d'erreurs
app.use((err, req, res, next) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ Erreur non gérée:', err.message);
  console.error('Stack:', err.stack);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'development' ? err.message : 'Erreur serveur interne';
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Serveur MeSomb Payment API démarré');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 Endpoints:`);
  console.log(`   - POST /api/v1/auth/register`);
  console.log(`   - POST /api/v1/auth/login`);
  console.log(`   - POST /api/v1/payments/initiate`);
  console.log(`   - GET  /api/v1/payments/status/:reference`);
  console.log(`   - POST /api/v1/webhooks/mesomb`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // ✅ Vérification des variables d'environnement au démarrage
  const missingVars = [];
  if (!process.env.MONGODB_URI) missingVars.push('MONGODB_URI');
  if (!process.env.JWT_SECRET) missingVars.push('JWT_SECRET');
  if (!process.env.MESOMB_APP_KEY) missingVars.push('MESOMB_APP_KEY');
  if (!process.env.MESOMB_API_KEY) missingVars.push('MESOMB_API_KEY');
  if (!process.env.MESOMB_SECRET_KEY) missingVars.push('MESOMB_SECRET_KEY');
  
  if (missingVars.length > 0) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('⚠️  ATTENTION : Variables manquantes dans .env:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } else {
    console.log('✅ Toutes les variables d\'environnement sont configurées');
  }
});

module.exports = app;