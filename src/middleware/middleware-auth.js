// ============================================
// SYNORA V2.0 - AUTH MIDDLEWARE
// Token-Verifizierung & User-Loading
// Sicher und sturzfrei
// ============================================

'use strict';

const jwt = require('jsonwebtoken');
const { safeGet } = require('../utils/helpers');

// ==========================================
// USER MODEL - LAZY LOADING
// ==========================================

let _UserModel = null;

function getUserModel() {
  if (!_UserModel) {
    try {
      _UserModel = require('../models/User');
    } catch (error) {
      console.warn('⚠️ User Model nicht verfügbar:', error.message);
      _UserModel = null;
    }
  }
  return _UserModel;
}

// ==========================================
// JWT SECRET
// ==========================================

/**
 * Holt JWT Secret sicher
 * @returns {string}
 */
function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  
  // In Production MUSS Secret gesetzt sein
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ FATAL: JWT_SECRET nicht gesetzt in Production!');
    throw new Error('JWT_SECRET muss in Production gesetzt sein');
  }
  
  // Development Fallback
  console.warn('⚠️ Verwende Default JWT_SECRET (nur für Development!)');
  return 'synora-dev-secret-CHANGE-IN-PRODUCTION-12345';
}

// ==========================================
// TOKEN EXTRAKTION
// ==========================================

/**
 * Extrahiert Token aus Request
 * Prüft: Authorization Header, Query, Cookie
 * 
 * @param {Request} req - Express Request
 * @returns {string|null}
 */
function extractToken(req) {
  try {
    // 1. Authorization Header (Bearer Token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token && token !== 'null' && token !== 'undefined') {
        return token;
      }
    }
    
    // 2. Query Parameter (für Downloads etc.)
    if (req.query && req.query.token) {
      const token = req.query.token.trim();
      if (token && token !== 'null' && token !== 'undefined') {
        return token;
      }
    }
    
    // 3. Cookie
    if (req.cookies && req.cookies.token) {
      const token = req.cookies.token.trim();
      if (token && token !== 'null' && token !== 'undefined') {
        return token;
      }
    }
    
    // 4. Body (für spezielle Fälle)
    if (req.body && req.body.token) {
      const token = req.body.token.trim();
      if (token && token !== 'null' && token !== 'undefined') {
        return token;
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('extractToken Fehler:', error.message);
    return null;
  }
}

// ==========================================
// MIDDLEWARE: REQUIRE AUTH
// ==========================================

/**
 * Middleware: Authentifizierung ERFORDERLICH
 * Request wird abgelehnt wenn nicht eingeloggt
 */
async function requireAuth(req, res, next) {
  try {
    // Token extrahieren
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Nicht autorisiert - Bitte einloggen',
        code: 'NO_TOKEN'
      });
    }
    
    // Token verifizieren
    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (jwtError) {
      // Spezifische JWT Fehler
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Session abgelaufen - Bitte erneut einloggen',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Ungültiger Token',
          code: 'INVALID_TOKEN'
        });
      }
      
      return res.status(401).json({
        success: false,
        error: 'Token-Fehler',
        code: 'TOKEN_ERROR'
      });
    }
    
    // User ID prüfen
    const userId = decoded.id || decoded.userId || decoded._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Ungültiger Token - Keine User ID',
        code: 'NO_USER_ID'
      });
    }
    
    // User laden (wenn Model verfügbar)
    const UserModel = getUserModel();
    
    if (UserModel) {
      try {
        const user = await UserModel.findById(userId).select('-password');
        
        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'User nicht gefunden',
            code: 'USER_NOT_FOUND'
          });
        }
        
        // Prüfen ob User aktiv
        if (user.isActive === false) {
          return res.status(401).json({
            success: false,
            error: 'Account deaktiviert',
            code: 'USER_INACTIVE'
          });
        }
        
        req.user = user;
        req.userId = user._id;
        
      } catch (dbError) {
        console.error('requireAuth DB Fehler:', dbError.message);
        
        // Fallback: Nur Token-Daten verwenden
        req.user = { 
          _id: userId, 
          id: userId,
          fromToken: true 
        };
        req.userId = userId;
      }
    } else {
      // Kein User Model - nur Token-Daten
      req.user = { 
        _id: userId, 
        id: userId,
        fromToken: true 
      };
      req.userId = userId;
    }
    
    next();
    
  } catch (error) {
    console.error('requireAuth Fehler:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Authentifizierungs-Fehler',
      code: 'AUTH_ERROR'
    });
  }
}

// ==========================================
// MIDDLEWARE: OPTIONAL AUTH
// ==========================================

/**
 * Middleware: Authentifizierung OPTIONAL
 * Request wird auch ohne Login akzeptiert
 * User wird geladen wenn Token vorhanden
 */
async function optionalAuth(req, res, next) {
  try {
    // Token extrahieren
    const token = extractToken(req);
    
    // Kein Token = Gast-Modus (OK!)
    if (!token) {
      req.user = null;
      req.userId = null;
      req.isGuest = true;
      return next();
    }
    
    // Token verifizieren
    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (jwtError) {
      // Ungültiger Token = Gast-Modus (kein Fehler!)
      console.warn('optionalAuth: Ungültiger Token, Gast-Modus');
      req.user = null;
      req.userId = null;
      req.isGuest = true;
      return next();
    }
    
    // User ID holen
    const userId = decoded.id || decoded.userId || decoded._id;
    
    if (!userId) {
      req.user = null;
      req.userId = null;
      req.isGuest = true;
      return next();
    }
    
    // User laden (wenn möglich)
    const UserModel = getUserModel();
    
    if (UserModel) {
      try {
        const user = await UserModel.findById(userId).select('-password');
        
        if (user && user.isActive !== false) {
          req.user = user;
          req.userId = user._id;
          req.isGuest = false;
        } else {
          req.user = null;
          req.userId = null;
          req.isGuest = true;
        }
        
      } catch (dbError) {
        // DB Fehler = Fallback zu Token-Daten
        req.user = { 
          _id: userId, 
          id: userId,
          fromToken: true 
        };
        req.userId = userId;
        req.isGuest = false;
      }
    } else {
      // Kein User Model - Token-Daten verwenden
      req.user = { 
        _id: userId, 
        id: userId,
        fromToken: true 
      };
      req.userId = userId;
      req.isGuest = false;
    }
    
    next();
    
  } catch (error) {
    // Bei JEDEM Fehler: Gast-Modus (Server läuft weiter!)
    console.error('optionalAuth Fehler:', error.message);
    req.user = null;
    req.userId = null;
    req.isGuest = true;
    next();
  }
}

// ==========================================
// MIDDLEWARE: ADMIN ONLY
// ==========================================

/**
 * Middleware: Nur für Admins
 * Muss NACH requireAuth verwendet werden
 */
function adminOnly(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Nicht autorisiert',
        code: 'NO_AUTH'
      });
    }
    
    const role = safeGet(req.user, 'role', 'user');
    
    if (role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Keine Berechtigung - Admin erforderlich',
        code: 'NOT_ADMIN'
      });
    }
    
    next();
    
  } catch (error) {
    console.error('adminOnly Fehler:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Berechtigungs-Fehler',
      code: 'PERMISSION_ERROR'
    });
  }
}

// ==========================================
// TOKEN GENERIERUNG
// ==========================================

/**
 * Generiert JWT Token
 * 
 * @param {string} userId - User ID
 * @param {Object} options - Optionen
 * @returns {string}
 */
function generateToken(userId, options = {}) {
  try {
    const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || '30d';
    
    const payload = {
      id: userId.toString(),
      iat: Math.floor(Date.now() / 1000)
    };
    
    // Zusätzliche Daten
    if (options.email) {
      payload.email = options.email;
    }
    
    if (options.role) {
      payload.role = options.role;
    }
    
    return jwt.sign(payload, getJwtSecret(), { expiresIn });
    
  } catch (error) {
    console.error('generateToken Fehler:', error.message);
    throw new Error('Token konnte nicht erstellt werden');
  }
}

/**
 * Token verifizieren (für externe Nutzung)
 * 
 * @param {string} token - JWT Token
 * @returns {Object|null}
 */
function verifyToken(token) {
  try {
    if (!token) {
      return null;
    }
    
    return jwt.verify(token, getJwtSecret());
    
  } catch (error) {
    return null;
  }
}

/**
 * Token dekodieren ohne Verifizierung
 * 
 * @param {string} token - JWT Token
 * @returns {Object|null}
 */
function decodeToken(token) {
  try {
    if (!token) {
      return null;
    }
    
    return jwt.decode(token);
    
  } catch (error) {
    return null;
  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Middleware
  requireAuth,
  optionalAuth,
  adminOnly,
  
  // Token Funktionen
  generateToken,
  verifyToken,
  decodeToken,
  extractToken,
  
  // Helpers
  getJwtSecret,
  getUserModel
};