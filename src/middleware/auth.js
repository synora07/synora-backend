// ============================================
// SYNORA - Auth Middleware
// Ersetzt die vier kopierten Token-Pruefungen in
// chat.js, conversation.js, preferences.js, userProfile.js
// ============================================
'use strict';

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

let User;
try {
  User = require('../models/User');
} catch (e) {
  console.warn('[auth] User-Model nicht gefunden:', e.message);
}

// ============================================
// HILFSFUNKTIONEN
// ============================================

/** Holt den Token aus dem Authorization-Header. Gibt null zurueck, wenn keiner da ist. */
function leseToken(req) {
  const header = req.header('Authorization') || req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Prueft den Token und laedt den Nutzer aus der Datenbank.
 * Wirft nie. Gibt immer ein Ergebnisobjekt zurueck.
 */
async function pruefeToken(token) {
  if (!token) {
    return { ok: false, code: 'TOKEN_FEHLT' };
  }

  if (!process.env.JWT_SECRET) {
    // Kein stiller Rueckfall auf einen Standardwert - das waere unsicher
    console.error('[auth] JWT_SECRET fehlt - Token koennen nicht geprueft werden');
    return { ok: false, code: 'SERVER_FEHLKONFIGURIERT' };
  }

  let daten;
  try {
    daten = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      // Frontend kann darauf reagieren und zum Login schicken
      return { ok: false, code: 'TOKEN_ABGELAUFEN' };
    }
    return { ok: false, code: 'TOKEN_UNGUELTIG' };
  }

  const id = daten.userId || daten.id || daten._id;

  // Ohne Datenbank arbeiten wir nur mit dem Token-Inhalt weiter,
  // damit die App nicht komplett steht.
  if (!User || mongoose.connection.readyState !== 1) {
    return { ok: true, nutzer: null, tokenDaten: daten, nurToken: true };
  }

  let nutzer;
  try {
    nutzer = await User.findById(id).select('-password');
  } catch (e) {
    console.error('[auth] Datenbankfehler beim Laden des Nutzers:', e.message);
    return { ok: true, nutzer: null, tokenDaten: daten, nurToken: true };
  }

  if (!nutzer) {
    // Token gueltig, Konto aber geloescht
    return { ok: false, code: 'KONTO_NICHT_GEFUNDEN' };
  }

  return { ok: true, nutzer, tokenDaten: daten, nurToken: false };
}

/** Haengt das Ergebnis einheitlich an den Request. */
function setzeRequest(req, ergebnis) {
  req.user = ergebnis && ergebnis.ok ? ergebnis.nutzer : null;
  req.tokenDaten = ergebnis && ergebnis.ok ? ergebnis.tokenDaten : null;
  req.istEingeloggt = !!(ergebnis && ergebnis.ok);
  req.authNurToken = !!(ergebnis && ergebnis.nurToken);
}

// ============================================
// MIDDLEWARE: LOGIN ERFORDERLICH
// Fuer /api/chat/history, /api/preferences, /api/user
// ============================================
async function requireAuth(req, res, next) {
  const ergebnis = await pruefeToken(leseToken(req));

  if (!ergebnis.ok) {
    const meldungen = {
      TOKEN_FEHLT: 'Nicht eingeloggt',
      TOKEN_ABGELAUFEN: 'Sitzung abgelaufen - bitte neu anmelden',
      TOKEN_UNGUELTIG: 'Token ungueltig',
      KONTO_NICHT_GEFUNDEN: 'Konto nicht gefunden',
      SERVER_FEHLKONFIGURIERT: 'Server-Konfigurationsfehler'
    };
    const status = ergebnis.code === 'SERVER_FEHLKONFIGURIERT' ? 500 : 401;
    setzeRequest(req, null);
    return res.status(status).json({
      error: meldungen[ergebnis.code] || 'Nicht eingeloggt',
      code: ergebnis.code
    });
  }

  setzeRequest(req, ergebnis);
  next();
}

// ============================================
// MIDDLEWARE: LOGIN OPTIONAL
// Fuer /api/chat - Gaeste duerfen suchen
// Blockiert nie, setzt nur req.user wenn moeglich
// ============================================
async function optionalAuth(req, res, next) {
  const token = leseToken(req);

  if (!token) {
    setzeRequest(req, null);
    return next();
  }

  const ergebnis = await pruefeToken(token);
  setzeRequest(req, ergebnis.ok ? ergebnis : null);
  next();
}

// ============================================
// MIDDLEWARE: NUR ADMIN
// ============================================
async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    const istAdmin = req.user && (req.user.rolle === 'admin' || req.user.role === 'admin');
    if (!istAdmin) {
      return res.status(403).json({ error: 'Keine Berechtigung', code: 'KEIN_ADMIN' });
    }
    next();
  });
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireAdmin,
  // Hilfsfunktionen, falls du sie woanders brauchst
  leseToken,
  pruefeToken
};