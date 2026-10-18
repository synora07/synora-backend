// ============================================
// SYNORA V2.0 - RATE LIMITER MIDDLEWARE
// Schutz vor Überlastung und Missbrauch
// In-Memory Store (für Production: Redis verwenden)
// ============================================

'use strict';

// ==========================================
// IN-MEMORY STORE
// ==========================================

const requestStore = new Map();

// Cleanup alle 5 Minuten (alte Einträge entfernen)
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 Minuten

setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, data] of requestStore.entries()) {
    // Einträge älter als 10 Minuten löschen
    if (now - data.windowStart > 10 * 60 * 1000) {
      requestStore.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0 && process.env.NODE_ENV !== 'production') {
    console.log(`🧹 Rate Limiter: ${cleaned} alte Einträge gelöscht`);
  }
}, CLEANUP_INTERVAL);

// ==========================================
// RATE LIMITER FACTORY
// ==========================================

/**
 * Erstellt einen Rate Limiter
 * 
 * @param {Object} options - Konfiguration
 * @returns {Function} Express Middleware
 * 
 * @example
 * const limiter = createRateLimiter({
 *   windowMs: 60000,    // 1 Minute
 *   maxRequests: 30,    // Max 30 Requests pro Minute
 *   message: 'Zu viele Anfragen'
 * });
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 60000,            // 1 Minute
    maxRequests = 30,            // Max Requests pro Window
    message = 'Zu viele Anfragen. Bitte warte einen Moment.',
    statusCode = 429,
    headers = true,              // Rate Limit Headers senden
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    
    // Funktion um Key zu generieren (default: IP)
    keyGenerator = (req) => {
      return req.ip || 
             req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
             req.connection.remoteAddress ||
             'unknown';
    },
    
    // Funktion um Requests zu überspringen
    skip = () => false,
    
    // Callback wenn Limit erreicht
    onLimitReached = null,
    
    // Store Prefix (für verschiedene Limiter)
    prefix = 'rl'
  } = options;
  
  return (req, res, next) => {
    try {
      // Skip wenn Funktion true zurückgibt
      if (skip(req)) {
        return next();
      }
      
      // Key generieren
      const baseKey = keyGenerator(req);
      const key = `${prefix}:${baseKey}`;
      const now = Date.now();
      
      // Eintrag holen oder erstellen
      let record = requestStore.get(key);
      
      // Neues Window wenn nicht vorhanden oder abgelaufen
      if (!record || now - record.windowStart > windowMs) {
        record = {
          windowStart: now,
          count: 0,
          firstRequest: now
        };
      }
      
      // Request zählen
      record.count += 1;
      record.lastRequest = now;
      requestStore.set(key, record);
      
      // Verbleibende Requests
      const remaining = Math.max(0, maxRequests - record.count);
      const resetTime = new Date(record.windowStart + windowMs);
      
      // Headers setzen (wenn aktiviert)
      if (headers) {
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', resetTime.toISOString());
        res.setHeader('X-RateLimit-Window', windowMs);
      }
      
      // Limit erreicht?
      if (record.count > maxRequests) {
        // Callback aufrufen
        if (onLimitReached && typeof onLimitReached === 'function') {
          onLimitReached(req, res, key, record);
        }
        
        // Retry-After Header
        const retryAfter = Math.ceil((record.windowStart + windowMs - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        
        // Log (nur in Development)
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`⚠️ Rate Limit erreicht: ${key} (${record.count}/${maxRequests})`);
        }
        
        return res.status(statusCode).json({
          success: false,
          error: message,
          code: 'RATE_LIMITED',
          retryAfter: retryAfter,
          limit: maxRequests,
          remaining: 0,
          resetAt: resetTime.toISOString()
        });
      }
      
      // Erfolgreiche Requests überspringen?
      if (skipSuccessfulRequests) {
        res.on('finish', () => {
          if (res.statusCode < 400) {
            record.count = Math.max(0, record.count - 1);
            requestStore.set(key, record);
          }
        });
      }
      
      // Fehlgeschlagene Requests überspringen?
      if (skipFailedRequests) {
        res.on('finish', () => {
          if (res.statusCode >= 400) {
            record.count = Math.max(0, record.count - 1);
            requestStore.set(key, record);
          }
        });
      }
      
      next();
      
    } catch (error) {
      // Bei Fehlern im Rate Limiter: Request durchlassen
      console.error('Rate Limiter Fehler:', error.message);
      next();
    }
  };
}

// ==========================================
// VORDEFINIERTE LIMITER
// ==========================================

/**
 * Standard Limiter - Für allgemeine Endpoints
 * 60 Requests pro Minute
 */
const standardLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 60,
  prefix: 'std',
  message: 'Zu viele Anfragen. Bitte warte einen Moment.'
});

/**
 * Auth Limiter - Für Login/Register
 * 10 Requests pro 15 Minuten (streng!)
 */
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  maxRequests: 10,
  prefix: 'auth',
  message: 'Zu viele Login-Versuche. Bitte warte 15 Minuten.',
  onLimitReached: (req) => {
    console.warn(`🔒 Auth Rate Limit: ${req.ip} - ${req.path}`);
  }
});

/**
 * AI/Chat Limiter - Für KI-Anfragen (teuer!)
 * 15 Requests pro Minute
 */
const aiLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 15,
  prefix: 'ai',
  message: 'Zu viele Suchanfragen. Bitte warte einen Moment.',
  onLimitReached: (req) => {
    console.warn(`🤖 AI Rate Limit: ${req.ip}`);
  }
});

/**
 * Search Limiter - Für Produktsuche
 * 20 Requests pro Minute
 */
const searchLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 20,
  prefix: 'search',
  message: 'Zu viele Suchanfragen. Bitte warte einen Moment.'
});

/**
 * Upload Limiter - Für Uploads
 * 10 Requests pro 5 Minuten
 */
const uploadLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 10,
  prefix: 'upload',
  message: 'Zu viele Uploads. Bitte warte 5 Minuten.'
});

/**
 * Password Reset Limiter - Sehr streng
 * 3 Requests pro Stunde
 */
const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 Stunde
  maxRequests: 3,
  prefix: 'pwreset',
  message: 'Zu viele Passwort-Reset Anfragen. Bitte warte 1 Stunde.'
});

/**
 * API Limiter - Für externe API-Calls
 * 100 Requests pro Minute
 */
const apiLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 100,
  prefix: 'api',
  message: 'API Rate Limit erreicht.'
});

// ==========================================
// HELPER FUNKTIONEN
// ==========================================

/**
 * Holt aktuelle Rate Limit Stats für einen Key
 * 
 * @param {string} key - Der Key
 * @returns {Object|null}
 */
function getRateLimitStats(key) {
  const record = requestStore.get(key);
  
  if (!record) {
    return null;
  }
  
  const now = Date.now();
  
  return {
    count: record.count,
    windowStart: new Date(record.windowStart).toISOString(),
    firstRequest: new Date(record.firstRequest).toISOString(),
    lastRequest: new Date(record.lastRequest).toISOString(),
    age: now - record.windowStart
  };
}

/**
 * Setzt Rate Limit für einen Key zurück
 * 
 * @param {string} key - Der Key
 */
function resetRateLimit(key) {
  requestStore.delete(key);
}

/**
 * Setzt alle Rate Limits zurück
 */
function resetAllRateLimits() {
  requestStore.clear();
}

/**
 * Holt Anzahl aktiver Rate Limit Einträge
 * 
 * @returns {number}
 */
function getActiveRateLimitCount() {
  return requestStore.size;
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Factory
  createRateLimiter,
  
  // Vordefinierte Limiter
  standardLimiter,
  authLimiter,
  aiLimiter,
  searchLimiter,
  uploadLimiter,
  passwordResetLimiter,
  apiLimiter,
  
  // Helpers
  getRateLimitStats,
  resetRateLimit,
  resetAllRateLimits,
  getActiveRateLimitCount
};