// ============================================
// SYNORA - Error Handler
// Fängt alle Fehler ab - App crasht nie
// ============================================

// ============================================
// ASYNC ERROR WRAPPER
// Fängt Fehler in async Funktionen
// ============================================
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
const globalErrorHandler = (err, req, res, next) => {
  console.error('==========================================');
  console.error('[ERROR]', new Date().toISOString());
  console.error('Path:', req.path);
  console.error('Method:', req.method);
  console.error('Error:', err.message);
  console.error('Stack:', err.stack?.slice(0, 500));
  console.error('==========================================');
  
  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validierungsfehler',
      details: err.message
    });
  }
  
  // Mongoose Duplicate Key
  if (err.code === 11000) {
    return res.status(400).json({
      error: 'Daten bereits vorhanden',
      details: 'Diese Daten existieren bereits'
    });
  }
  
  // JWT Error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Ungültiger Token',
      details: 'Bitte erneut einloggen'
    });
  }
  
  // Rate Limit Error
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Zu viele Anfragen',
      details: 'Bitte warte einen Moment'
    });
  }
  
  // Claude API Error
  if (err.message?.includes('Claude') || err.message?.includes('API')) {
    return res.status(503).json({
      error: 'KI-Service vorübergehend nicht verfügbar',
      details: 'Bitte versuche es in wenigen Sekunden erneut'
    });
  }
  
  // Default Error
  res.status(err.status || 500).json({
    error: 'Ein Fehler ist aufgetreten',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Bitte versuche es erneut'
  });
};

// ============================================
// NOT FOUND HANDLER
// ============================================
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Nicht gefunden',
    path: req.path
  });
};

// ============================================
// UNCAUGHT EXCEPTION HANDLER
// Verhindert Server-Crash
// ============================================
const setupProcessHandlers = () => {
  process.on('uncaughtException', (err) => {
    console.error('==========================================');
    console.error('[UNCAUGHT EXCEPTION]', new Date().toISOString());
    console.error(err.message);
    console.error(err.stack);
    console.error('==========================================');
    // Server läuft weiter!
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('==========================================');
    console.error('[UNHANDLED REJECTION]', new Date().toISOString());
    console.error('Reason:', reason);
    console.error('==========================================');
    // Server läuft weiter!
  });
  
  console.log('[ERROR HANDLER] Process handlers installed');
};

module.exports = {
  asyncHandler,
  globalErrorHandler,
  notFoundHandler,
  setupProcessHandlers
};