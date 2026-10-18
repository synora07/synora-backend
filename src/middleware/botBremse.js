// ============================================
// SYNORA - Bot-Bremse
// ============================================
// Das Tageslimit schuetzt dein Guthaben ueber den Tag.
// Die Bot-Bremse schuetzt es in der Minute: ohne sie kann jemand
// 10 Suchen in 10 Sekunden abfeuern und dabei echtes Geld verbrennen.
//
// Reihenfolge in der Route: optionalAuth -> botBremse -> tageslimit
// Erst wissen wer da ist, dann die billige Pruefung, dann die teure.
// ============================================
'use strict';

const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { AbgelehnteSuche } = require('../models/GastZaehler');

// ============================================
// EINSTELLUNGEN - hier aendern, sonst nirgends
// ============================================
const SUCHE_FENSTER_MS = 2 * 60 * 1000; // 2 Minuten
const SUCHE_MAX = 5;                    // 5 Suchen in diesem Fenster

const AUTH_FENSTER_MS = 15 * 60 * 1000; // 15 Minuten
const AUTH_MAX = 10;                    // 10 Login-Versuche

const GLOBAL_FENSTER_MS = 60 * 1000;    // 1 Minute
const GLOBAL_MAX = 120;                 // alle Anfragen zusammen

// express-rate-limit ab 7.5 bringt einen Helfer, der IPv6-Adressen
// richtig zusammenfasst. Aeltere Versionen haben ihn nicht.
let ipSchluessel;
try {
  ipSchluessel = require('express-rate-limit').ipKeyGenerator;
} catch (e) {
  ipSchluessel = null;
}

/**
 * Eingeloggte werden pro Konto gezaehlt, Gaeste pro IP.
 * Sonst teilen sich alle Nutzer hinter einem Firmenanschluss ein Limit.
 */
function schluessel(req) {
  if (req.user && req.user._id) return 'u:' + String(req.user._id);
  const ip = req.ip || 'unbekannt';
  return 'i:' + (ipSchluessel ? ipSchluessel(ip) : ip);
}

async function protokolliere(req) {
  try {
    if (mongoose.connection.readyState !== 1) return;
    await AbgelehnteSuche.create({
      grund: 'bot_bremse',
      typ: req.user ? 'nutzer' : 'gast',
      nutzer: req.user ? req.user._id : null,
      kennung: req.user ? null : String(req.ip || ''),
      anfrage: (req.body && req.body.message) || '',
      limit: SUCHE_MAX
    });
  } catch (e) {
    console.error('[bot] Protokoll fehlgeschlagen:', e.message);
  }
}

// ============================================
// SUCHE - die teure Route
// ============================================
// ============================================
// TESTZUGANG
// ============================================
// Der Pruefkatalog macht 21 Suchen hintereinander - die Bremse
// erlaubt fuenf in zwei Minuten. Ohne Ausnahme laesst sich der
// Katalog nicht durchlaufen.
//
// SICHERHEIT: wie beim Tageslimit. Nur mit TEST_TOKEN aus der .env
// UND nur ausserhalb von production. Auf dem Server wirkungslos.
function istTestzugang(req) {
  if (process.env.NODE_ENV === 'production') return false;
  const erwartet = process.env.TEST_TOKEN;
  if (!erwartet || erwartet.length < 8) return false;
  return req.get('x-synora-test') === erwartet;
}

const sucheBremse = rateLimit({
  windowMs: SUCHE_FENSTER_MS,
  max: SUCHE_MAX,
  skip: istTestzugang,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: schluessel,
  handler: async (req, res) => {
    console.warn(`[bot] Zu schnell: ${schluessel(req)}`);
    await protokolliere(req);

    res.status(429).json({
      error: 'zu_schnell',
      message: 'Das ging mir zu schnell. Warte kurz, dann suche ich weiter.',
      erneutInSekunden: Math.ceil(SUCHE_FENSTER_MS / 1000)
    });
  }
});

// ============================================
// ANMELDUNG - Schutz gegen Durchprobieren
// ============================================
const authBremse = rateLimit({
  windowMs: AUTH_FENSTER_MS,
  max: AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  // Immer nach IP - beim Login gibt es noch kein Konto
  keyGenerator: (req) => {
    const ip = req.ip || 'unbekannt';
    return 'a:' + (ipSchluessel ? ipSchluessel(ip) : ip);
  },
  skipSuccessfulRequests: true, // nur Fehlversuche zaehlen
  handler: (req, res) => {
    console.warn(`[bot] Zu viele Anmeldeversuche von ${req.ip}`);
    res.status(429).json({
      error: 'zu_viele_versuche',
      message: 'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.',
      erneutInSekunden: Math.ceil(AUTH_FENSTER_MS / 1000)
    });
  }
});

// ============================================
// ALLES ANDERE - grobes Netz gegen Dauerfeuer
// ============================================
const globalBremse = rateLimit({
  windowMs: GLOBAL_FENSTER_MS,
  max: GLOBAL_MAX,
  skip: istTestzugang,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'zu_viele_anfragen',
      message: 'Zu viele Anfragen. Bitte warte einen Moment.'
    });
  }
});

module.exports = {
  istTestzugang,
  sucheBremse,
  authBremse,
  globalBremse,
  SUCHE_MAX,
  SUCHE_FENSTER_MS
};