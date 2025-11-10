// src/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  // Log détaillé en mode développement
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Erreur non gérée:', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method
    });
  }

  // Définir le code de statut (par défaut 500)
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Erreur serveur interne',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;