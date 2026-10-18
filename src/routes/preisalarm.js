// ============================================
// SYNORA - Preisalarm Routes
// ============================================
// EINBAU: eine Zeile in src/server.js, zu den anderen ladeRoute:
//
//     ladeRoute('preisalarm', '/api/preisalarm');
//
// Alles hier verlangt ein Konto. Ein Preisalarm ohne Konto ergibt
// keinen Sinn - es gibt niemanden, den man benachrichtigen koennte.
//
// ENDPUNKTE
//
//   GET    /api/preisalarm              meine Alarme
//   POST   /api/preisalarm              Alarm anlegen
//   DELETE /api/preisalarm/:id          Alarm loeschen
//
//   GET    /api/preisalarm/push/schluessel   oeffentlicher VAPID-Schluessel
//   POST   /api/preisalarm/push             Geraet anmelden
//   DELETE /api/preisalarm/push             Geraet abmelden
// ============================================

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const preisAlarm = require('../services/preisAlarmService');
const PushAbo = require('../models/PushAbo');

// ============================================
// MEINE ALARME - GET /api/preisalarm
// ============================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const istPremium = !!req.user.premium;
    const alarme = await preisAlarm.liste(req.user._id);
    res.json({
      alarme,
      anzahl: alarme.length,
      maximum: preisAlarm.maxAlarme(istPremium),
      maximumPremium: preisAlarm.ALARME_PREMIUM,
      premium: istPremium,
      taktTage: preisAlarm.TAKT_TAGE
    });
  } catch (e) {
    console.error('[preisalarm] liste:', e.message);
    res.status(500).json({ error: 'Alarme konnten nicht geladen werden' });
  }
});

// ============================================
// ALARM ANLEGEN - POST /api/preisalarm
//
// Erwartet im Body das Produkt, so wie es aus der Suche kam:
//
//   {
//     "produkt": { "name": "...", "priceValue": 329, "produktId": "...",
//                  "imageUrl": "...", "suchbegriff": "..." },
//     "zielPreis": 250,            optional
//     "kanaele": ["email"]         optional
//   }
//
// Ohne zielPreis gilt: melden ab 5 Prozent Senkung.
// ============================================
router.post('/', requireAuth, async (req, res) => {
  const { produkt, zielPreis, kanaele } = req.body || {};

  const ergebnis = await preisAlarm.anlegen({
    nutzerId: req.user._id,
    istPremium: !!req.user.premium,
    produkt,
    zielPreis,
    kanaele: Array.isArray(kanaele) && kanaele.length ? kanaele : ['email']
  });

  if (!ergebnis.ok) {
    // 409 statt 500: das ist kein Serverfehler, sondern eine Regel.
    // premiumNoetig sagt dem Frontend, dass es den Premium-Hinweis
    // zeigen soll statt einer Fehlermeldung.
    return res.status(409).json({
      error: ergebnis.grund,
      premiumNoetig: !!ergebnis.premiumNoetig
    });
  }

  res.status(201).json({
    alarm: ergebnis.alarm,
    message: zielPreis
      ? `Wir melden uns, sobald der Preis auf CHF ${Number(zielPreis).toFixed(2)} oder tiefer fällt.`
      : 'Wir melden uns, sobald der Preis deutlich fällt. Geprüft wird wöchentlich.'
  });
});

// ============================================
// ALARM LOESCHEN - DELETE /api/preisalarm/:id
// ============================================
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const ergebnis = await preisAlarm.loeschen(req.user._id, req.params.id);
    if (!ergebnis.ok) return res.status(404).json({ error: 'Alarm nicht gefunden' });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'Ungültige Alarm-Nummer' });
  }
});

// ============================================
// PUSH: oeffentlicher Schluessel
// GET /api/preisalarm/push/schluessel
//
// Den braucht das Frontend, um das Geraet anzumelden. Der PRIVATE
// Schluessel bleibt auf dem Server und wird nie ausgeliefert.
// ============================================
router.get('/push/schluessel', (req, res) => {
  const schluessel = process.env.VAPID_PUBLIC || null;
  res.json({
    aktiv: String(process.env.PUSH_AKTIV || '').toLowerCase() === 'true' && !!schluessel,
    schluessel
  });
});

// ============================================
// PUSH: Geraet anmelden - POST /api/preisalarm/push
//
// Body ist das Objekt, das der Browser liefert:
//   { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } }
// ============================================
router.post('/push', requireAuth, async (req, res) => {
  const { endpoint, keys } = req.body || {};

  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ error: 'Anmeldung unvollständig' });
  }

  try {
    // Derselbe endpoint kann schon da sein, wenn der Nutzer die
    // Seite zweimal oeffnet. Dann nur auffrischen.
    await PushAbo.findOneAndUpdate(
      { endpoint },
      {
        $set: {
          nutzer: req.user._id,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
          geraet: String(req.headers['user-agent'] || '').slice(0, 120),
          fehlschlaege: 0
        },
        $setOnInsert: { erstellt: new Date() }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ ok: true });
  } catch (e) {
    console.error('[push] anmelden:', e.message);
    res.status(500).json({ error: 'Anmeldung fehlgeschlagen' });
  }
});

// ============================================
// PUSH: Geraet abmelden - DELETE /api/preisalarm/push
// ============================================
router.delete('/push', requireAuth, async (req, res) => {
  const { endpoint } = req.body || {};

  try {
    if (endpoint) {
      await PushAbo.deleteOne({ endpoint, nutzer: req.user._id });
    } else {
      // Ohne endpoint: alle Geraete dieses Nutzers abmelden.
      await PushAbo.deleteMany({ nutzer: req.user._id });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[push] abmelden:', e.message);
    res.status(500).json({ error: 'Abmeldung fehlgeschlagen' });
  }
});

module.exports = router;