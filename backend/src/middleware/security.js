const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

// Configuration CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  optionsSuccessStatus: 200
};

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limite chaque IP à 100 requêtes par windowMs
});

// Middleware CORS configuré
const corsMiddleware = cors(corsOptions);

module.exports = {
  corsMiddleware, 
  limiter,
  helmet
};