// ============================================
// SYNORA - Rate Limiter & Crash Prevention
// Schützt vor Überlastung bei 200+ Usern
// ============================================

const rateLimit = require('express-rate-limit');

// ============================================
// 1. GLOBAL RATE LIMITER
// Max 100 Anfragen pro Minute pro IP
// ============================================
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 Minute
  max: 100,             // 100 Anfragen pro Minute
  message: {
    error: 'Zu viele Anfragen. Bitte warte einen Moment.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`[RATE LIMIT] IP ${req.ip} blocked - too many requests`);
    res.status(429).json({
      error: 'Zu viele Anfragen. Bitte warte einen Moment.',
      retryAfter: 60
    });
  }
});

// ============================================
// 2. CHAT/SEARCH RATE LIMITER (Strenger)
// Max 10 Suchen pro Minute pro IP
// ============================================
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 Minute
  max: 10,              // 10 Suchen pro Minute
  message: {
    error: 'Zu viele Suchanfragen. Bitte warte einen Moment.',
    retryAfter: 60
  },
  keyGenerator: (req) => {
    // Rate limit by user ID if logged in, otherwise by IP
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.userId;
      } catch (e) {}
    }
    return req.ip;
  },
  handler: (req, res) => {
    console.log(`[RATE LIMIT] Chat limit reached for ${req.ip}`);
    res.status(429).json({
      error: 'Du hast das Such-Limit erreicht. Bitte warte 1 Minute.',
      retryAfter: 60
    });
  }
});

// ============================================
// 3. AUTH RATE LIMITER (Sehr streng)
// Schutz vor Brute-Force
// ============================================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 Minuten
  max: 10,                    // 10 Login-Versuche
  message: {
    error: 'Zu viele Login-Versuche. Bitte warte 15 Minuten.',
    retryAfter: 900
  },
  handler: (req, res) => {
    console.log(`[RATE LIMIT] Auth limit reached for ${req.ip}`);
    res.status(429).json({
      error: 'Zu viele Login-Versuche. Bitte warte 15 Minuten.',
      retryAfter: 900
    });
  }
});

// ============================================
// 4. ANALYTICS RATE LIMITER (Locker)
// ============================================
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,  // 50 Events pro Minute
  message: { error: 'Analytics limit reached' }
});

module.exports = {
  globalLimiter,
  chatLimiter,
  authLimiter,
  analyticsLimiter
};