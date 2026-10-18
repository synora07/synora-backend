// ============================================
// SYNORA V2.0 - ERROR HANDLER MIDDLEWARE
// Zentrale Fehlerbehandlung
// Keine Fehler werden durchgelassen
// ============================================

'use strict';

// ==========================================
// CUSTOM ERROR KLASSE
// ==========================================

/**
 * Custom Error mit Status Code und Code
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'ERROR') {
    super(message);
    
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Bekannter Fehler
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error
 */
class ValidationError extends AppError {
  constructor(message, fields = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.fields = fields;
  }
}

/**
 * Not Found Error
 */
class NotFoundError extends AppError {
  constructor(message = 'Nicht gefunden') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * Unauthorized Error
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Nicht autorisiert') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * Forbidden Error
 */
class ForbiddenError extends AppError {
  constructor(message = 'Keine Berechtigung') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Conflict Error (z.B. Duplicate)
 */
class ConflictError extends AppError {
  constructor(message = 'Konflikt') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * Rate Limit Error
 */
class RateLimitError extends AppError {
  constructor(message = 'Zu viele Anfragen', retryAfter = 60) {
    super(message, 429, 'RATE_LIMITED');
    this.retryAfter = retryAfter;
  }
}

// ==========================================
// ASYNC HANDLER WRAPPER
// ==========================================

/**
 * Wrapped async Handler - fängt Fehler automatisch
 * 
 * @param {Function} fn - Async Route Handler
 * @returns {Function}
 * 
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await User.find();
 *   res.json(users);
 * }));
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ==========================================
// ERROR HANDLER MIDDLEWARE
// ==========================================

/**
 * Zentrale Error Handler Middleware
 * Muss als LETZTE Middleware registriert werden
 */
function errorHandler(err, req, res, next) {
  // Wenn Response bereits gesendet, weitergeben
  if (res.headersSent) {
    return next(err);
  }
  
  // Standard Werte
  let statusCode = 500;
  let message = 'Interner Server-Fehler';
  let code = 'INTERNAL_ERROR';
  let details = null;
  
  // ==========================================
  // FEHLERTYPEN ERKENNEN
  // ==========================================
  
  // Custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    
    if (err instanceof ValidationError) {
      details = { fields: err.fields };
    }
    
    if (err instanceof RateLimitError) {
      res.setHeader('Retry-After', err.retryAfter);
    }
  }
  
  // Mongoose Validation Error
  else if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    
    const fields = {};
    for (const [field, error] of Object.entries(err.errors)) {
      fields[field] = error.message;
    }
    
    message = Object.values(fields).join(', ');
    details = { fields };
  }
  
  // Mongoose CastError (ungültige ID)
  else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Ungültige ${err.path}: ${err.value}`;
  }
  
  // Mongoose Duplicate Key Error
  else if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE';
    
    const field = Object.keys(err.keyValue || {})[0] || 'Feld';
    const value = err.keyValue ? err.keyValue[field] : 'Wert';
    message = `${field} "${value}" existiert bereits`;
  }
  
  // JWT Errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Ungültiger Token';
  }
  
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token abgelaufen';
  }
  
  // Syntax Error (z.B. ungültiges JSON)
  else if (err instanceof SyntaxError && err.status === 400) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Ungültiges JSON Format';
  }
  
  // Payload Too Large
  else if (err.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Anfrage zu gross';
  }
  
  // Standard Error mit statusCode
  else if (err.statusCode) {
    statusCode = err.statusCode;
    message = err.message || message;
    code = err.code || code;
  }
  
  // Standard Error mit status
  else if (err.status) {
    statusCode = err.status;
    message = err.message || message;
    code = err.code || code;
  }
  
  // Unbekannter Error
  else if (err.message) {
    message = err.message;
  }
  
  // ==========================================
  // LOGGING
  // ==========================================
  
  // Nur Server-Fehler (5xx) ausführlich loggen
  if (statusCode >= 500) {
    console.error('');
    console.error('╔════════════════════════════════════════╗');
    console.error('║  ❌ SERVER ERROR                       ║');
    console.error('╚════════════════════════════════════════╝');
    console.error('Zeit:', new Date().toISOString());
    console.error('Pfad:', req.method, req.path);
    console.error('Fehler:', err.message);
    
    if (process.env.NODE_ENV !== 'production') {
      console.error('Stack:', err.stack);
    }
    
    console.error('');
  } else if (process.env.NODE_ENV !== 'production') {
    // Client-Fehler nur in Development loggen
    console.warn(`⚠️ ${statusCode} ${code}: ${message} (${req.method} ${req.path})`);
  }
  
  // ==========================================
  // RESPONSE
  // ==========================================
  
  const response = {
    success: false,
    error: message,
    code: code
  };
  
  // Details hinzufügen (wenn vorhanden)
  if (details) {
    response.details = details;
  }
  
  // Stack nur in Development
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }
  
  res.status(statusCode).json(response);
}

// ==========================================
// NOT FOUND HANDLER
// ==========================================

/**
 * 404 Handler für unbekannte Routen
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'Endpoint nicht gefunden',
    code: 'NOT_FOUND',
    path: req.path,
    method: req.method,
    hint: 'Prüfe die URL und HTTP-Methode'
  });
}

// ==========================================
// HELPER FUNKTIONEN
// ==========================================

/**
 * Wirft AppError wenn Bedingung nicht erfüllt
 * 
 * @param {boolean} condition - Die Bedingung
 * @param {string} message - Fehlermeldung
 * @param {number} statusCode - HTTP Status Code
 * @param {string} code - Error Code
 */
function assertOr(condition, message, statusCode = 400, code = 'ASSERTION_FAILED') {
  if (!condition) {
    throw new AppError(message, statusCode, code);
  }
}

/**
 * Wirft NotFoundError wenn Wert nicht existiert
 * 
 * @param {*} value - Der Wert
 * @param {string} message - Fehlermeldung
 */
function assertFound(value, message = 'Nicht gefunden') {
  if (!value) {
    throw new NotFoundError(message);
  }
  return value;
}

/**
 * Wirft ValidationError wenn Validierung fehlschlägt
 * 
 * @param {Object} fields - Felder mit Fehlern
 * @param {string} message - Fehlermeldung
 */
function assertValid(fields, message = 'Validierung fehlgeschlagen') {
  const errors = Object.entries(fields)
    .filter(([key, value]) => value !== null && value !== undefined)
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  
  if (Object.keys(errors).length > 0) {
    throw new ValidationError(message, errors);
  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Error Klassen
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  
  // Middleware
  asyncHandler,
  errorHandler,
  notFoundHandler,
  
  // Helpers
  assertOr,
  assertFound,
  assertValid
};