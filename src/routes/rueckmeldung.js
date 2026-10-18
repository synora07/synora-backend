// ============================================
// SYNORA - Feedback und gemeldete Kaeufe
// ============================================
//   POST /api/feedback       Feedback abgeben (auch ohne Konto)
//   POST /api/kauf-melden    Kauf melden (Konto noetig)
//   GET  /api/feedback/liste       nur mit ANALYTICS_TOKEN
//   GET  /api/kauf-melden/liste    nur mit ANALYTICS_TOKEN
//
// Beide Listen sind durch denselben Token geschuetzt wie das
// Dashboard. Was Nutzer melden, geht niemanden ausser dir etwas
// an.
// ============================================
'use strict';

const express = require('express');
const router = express.Router();

// optionalAuth: setzt req.user, wenn jemand angemeldet ist, laesst
// aber auch Gaeste durch. requireAuth verlangt die Anmeldung.
let optionalAuth = (req, res, next) => next();
let requireAuth = (req, res, next) => res.status(401).json({ error: 'Nicht angemeldet' });
try {
  const auth = require('../middleware/auth');
  if (auth.optionalAuth) optionalAuth = auth.optionalAuth;
  if (auth.requireAuth) requireAuth = auth.requireAuth;
} catch (e) {
  console.warn('[rueckmeldung] middleware/auth nicht ladbar:', e.message);
}

function text(wert, max) {
  return String(wert === undefined || wert === null ? '' : wert).trim().slice(0, max);
}

function tokenStimmt(req) {
  const erwartet = process.env.ANALYTICS_TOKEN || '';
  const gegeben = String(req.query.token || req.get('x-analytics-token') || '');
  return !!erwartet && gegeben === erwartet;
}

// ============================================
// EINFACHE BREMSE
// ============================================
// Ohne Bremse kann jemand das Formular tausendfach abschicken
// und die Datenbank fluten. Gezaehlt wird je IP.
//
// Im Speicher, nicht in der Datenbank: Das kostet keine Abfrage
// und reicht fuer diesen Zweck. Nach einem Neustart ist der
// Zaehler weg - das ist hier verschmerzbar.
const ZAEHLER = new Map();
const MAX_PRO_STUNDE = 8;
const STUNDE = 60 * 60 * 1000;

function zuVielGeschickt(req) {
  const ip = String(req.ip || 'unbekannt');
  const jetzt = Date.now();

  if (ZAEHLER.size > 5000) {
    for (const [k, v] of ZAEHLER) if (jetzt - v.seit > STUNDE) ZAEHLER.delete(k);
  }

  const e = ZAEHLER.get(ip);
  if (!e || jetzt - e.seit > STUNDE) { ZAEHLER.set(ip, { anzahl: 1, seit: jetzt }); return false; }
  e.anzahl += 1;
  return e.anzahl > MAX_PRO_STUNDE;
}

// ============================================
// FEEDBACK ABGEBEN
// ============================================
router.post('/feedback', optionalAuth, async (req, res) => {
  if (zuVielGeschickt(req)) {
    return res.status(429).json({ error: 'Zu viele Meldungen. Versuch es in einer Stunde nochmal.' });
  }

  const nachricht = text(req.body && req.body.nachricht, 2000);
  if (nachricht.length < 3) {
    return res.status(400).json({ error: 'Schreib bitte kurz, was passiert ist.' });
  }

  try {
    const Feedback = require('../models/Feedback');
    const erlaubt = Feedback.ARTEN || [];
    const art = erlaubt.includes(req.body && req.body.art) ? req.body.art : 'sonstiges';

    await Feedback.create({
      art,
      nachricht,
      seite: text(req.body && req.body.seite, 120),
      nutzer: (req.user && req.user._id) || null
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('[feedback] nicht gespeichert:', e.message);
    return res.status(500).json({ error: 'Das hat gerade nicht geklappt.' });
  }
});

// ============================================
// KAUF MELDEN
// ============================================
router.post('/kauf-melden', requireAuth, async (req, res) => {
  if (zuVielGeschickt(req)) {
    return res.status(429).json({ error: 'Zu viele Meldungen. Versuch es in einer Stunde nochmal.' });
  }

  const shop = text(req.body && req.body.shop, 80);
  const bestellnummer = text(req.body && req.body.bestellnummer, 60);
  const betrag = Number(req.body && req.body.betrag);
  const datum = new Date(req.body && req.body.datum);

  if (!shop) return res.status(400).json({ error: 'In welchem Shop hast du gekauft?' });
  if (!bestellnummer) return res.status(400).json({ error: 'Die Bestellnummer fehlt.' });
  if (!Number.isFinite(betrag) || betrag <= 0) {
    return res.status(400).json({ error: 'Der Betrag sieht nicht richtig aus.' });
  }
  if (isNaN(datum.getTime())) {
    return res.status(400).json({ error: 'Das Datum sieht nicht richtig aus.' });
  }

  // Ein Kauf in der Zukunft ist keiner. Ein Tag Spielraum, weil
  // Zeitzonen sonst ehrliche Meldungen vom selben Tag abweisen.
  const morgen = new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (datum > morgen) {
    return res.status(400).json({ error: 'Das Datum liegt in der Zukunft.' });
  }

  try {
    const KaufMeldung = require('../models/KaufMeldung');

    await KaufMeldung.create({
      nutzer: req.user._id,
      shop,
      betrag,
      bestellnummer,
      datum
    });

    return res.json({ ok: true });
  } catch (e) {
    // 11000 = dieselbe Bestellnummer beim selben Shop gibt es
    // schon. Fuer den Nutzer ist das kein Serverfehler, sondern
    // eine Auskunft.
    if (e && e.code === 11000) {
      return res.status(409).json({ error: 'Diese Bestellung wurde schon gemeldet.' });
    }
    console.error('[kauf-melden] nicht gespeichert:', e.message);
    return res.status(500).json({ error: 'Das hat gerade nicht geklappt.' });
  }
});

// ============================================
// LISTEN FUER DICH
// ============================================
router.get('/feedback/liste', async (req, res) => {
  if (!tokenStimmt(req)) return res.status(404).json({ error: 'Nicht gefunden' });
  try {
    const Feedback = require('../models/Feedback');
    const nurOffene = String(req.query.offen || '') === '1';
    const liste = await Feedback.find(nurOffene ? { erledigt: false } : {})
      .sort({ erstelltAm: -1 }).limit(200).lean();
    return res.json({ anzahl: liste.length, liste });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.get('/kauf-melden/liste', async (req, res) => {
  if (!tokenStimmt(req)) return res.status(404).json({ error: 'Nicht gefunden' });
  try {
    const KaufMeldung = require('../models/KaufMeldung');
    const nurOffene = String(req.query.offen || '') === '1';
    const liste = await KaufMeldung.find(nurOffene ? { zustand: 'offen' } : {})
      .populate('nutzer', 'email')
      .sort({ erstelltAm: -1 }).limit(200).lean();
    return res.json({ anzahl: liste.length, liste });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
