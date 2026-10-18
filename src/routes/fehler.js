// ============================================
// SYNORA - Fehler melden
// ============================================
// Grundsatz 7: Ein gemeldeter Fehler wird zugegeben, nicht erklaert.
// Und er wird fuer alle korrigiert, nicht nur fuer den Melder.
//
// Der Nutzer schickt nur die sucheId und einen Grund. Was damals
// empfohlen wurde, holt sich der Server selbst aus den Klick-Eintraegen.
// So bleibt der Knopf im Frontend ein Knopf.
// ============================================
'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const FehlerLog = require('../models/FehlerLog');
const ProduktKlick = require('../models/ProduktKlick');
const { optionalAuth } = require('../middleware/auth');

// ============================================
// AUSWAHL FUER DEN NUTZER
// Die IDs muessen zum Model passen, sonst wird die Meldung verworfen.
// ============================================
const TYPEN_ANZEIGE = [
  { id: 'falscheEmpfehlung', label: 'Das Produkt passt nicht zu meiner Anfrage' },
  { id: 'preis', label: 'Der Preis stimmt nicht' },
  { id: 'lieferung', label: 'Nicht lieferbar oder Lieferproblem' },
  { id: 'beschreibung', label: 'Die Beschreibung stimmt nicht' },
  { id: 'qualitaet', label: 'Schlechte Qualitaet' },
  { id: 'technisch', label: 'Funktioniert nicht' },
  { id: 'fake', label: 'Faelschung' },
  { id: 'kundenservice', label: 'Schlechter Kundenservice' },
  { id: 'falschesProdukt', label: 'Anderes Produkt erhalten' },
  { id: 'sonstiges', label: 'Etwas anderes' }
];

const ERLAUBTE_TYPEN = new Set(TYPEN_ANZEIGE.map((t) => t.id));

function ipHash(req) {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

// ============================================
// GET /api/fehler/typen
// ============================================
router.get('/typen', (req, res) => {
  res.json({ typen: TYPEN_ANZEIGE });
});

// ============================================
// POST /api/fehler/melden
//
// Erwartet: { sucheId, fehlerTyp, beschreibung?, rang? }
// rang = welches der drei Produkte gemeint ist (1, 2 oder 3).
// Ohne rang gilt die Meldung der ganzen Empfehlung.
// ============================================
router.post('/melden', optionalAuth, async (req, res, next) => {
  try {
    const { sucheId, fehlerTyp, beschreibung, rang } = req.body || {};

    if (!fehlerTyp || !ERLAUBTE_TYPEN.has(fehlerTyp)) {
      return res.status(400).json({
        error: 'Bitte einen Grund auswaehlen',
        erlaubteTypen: [...ERLAUBTE_TYPEN]
      });
    }

    if (!sucheId) {
      return res.status(400).json({ error: 'sucheId fehlt' });
    }

    // Was wurde bei dieser Suche empfohlen?
    const eintraege = await ProduktKlick.find({ sucheId }).sort({ rang: 1 });

    if (!eintraege.length) {
      // Aelter als 30 Tage oder erfundene ID
      return res.status(404).json({
        error: 'Zu dieser Suche liegt nichts mehr vor',
        hinweis: 'Meldungen sind 30 Tage lang moeglich'
      });
    }

    // Gemeintes Produkt: das angegebene oder das erste
    const gemeint = (rang && eintraege.find((e) => e.rang === Number(rang))) || eintraege[0];

    const gemeldet = await FehlerLog.create({
      userId: req.user ? req.user._id : null,
      sessionId: sucheId,

      suchanfrage: gemeint.suchanfrage || '(unbekannt)',

      empfohlenesProdukt: {
        name: gemeint.produktName || '(unbekannt)',
        preis: gemeint.angezeigterPreisWert,
        waehrung: 'CHF',
        produktUrl: gemeint.gewaehlterShop ? gemeint.gewaehlterShop.url : null
      },

      // Der Shop, zu dem wirklich weitergeleitet wurde - nicht der
      // angezeigte. Sonst bestrafst du den falschen.
      empfohlenerShop:
        (gemeint.gewaehlterShop && gemeint.gewaehlterShop.name)
        || gemeint.angezeigterShop
        || 'unbekannt',
      shopUrl: gemeint.gewaehlterShop ? gemeint.gewaehlterShop.url : null,

      fehlerTyp,
      fehlerBeschreibung: typeof beschreibung === 'string' ? beschreibung.slice(0, 2000) : '',

      userAgent: req.headers['user-agent'] || '',
      ipHash: ipHash(req)
    });

    // Muster erkennen. Das aendert heute noch keine Rangfolge, es
    // schreibt nur auf, was auffaellt - bewusst so, weil jeder ohne
    // Konto melden kann.
    let erkannt = null;
    try {
      erkannt = await gemeldet.analysierenUndLernen();
    } catch (e) {
      console.error('[fehler] Auswertung fehlgeschlagen:', e.message);
    }

    console.log(
      `[fehler] ${fehlerTyp} | "${gemeint.produktName}" bei ${gemeldet.empfohlenerShop}` +
        (erkannt && erkannt.aehnlicheFehlerCount ? ` | ${erkannt.aehnlicheFehlerCount} aehnliche` : '')
    );

    // Zugeben, nicht erklaeren.
    res.json({
      success: true,
      message: 'Das war falsch von mir. Danke, dass du es meldest - ich korrigiere es fuer alle.',
      gemeldet: {
        produkt: gemeint.produktName,
        shop: gemeldet.empfohlenerShop,
        grund: fehlerTyp
      }
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Meldung unvollstaendig', detail: error.message });
    }
    next(error);
  }
});

// ============================================
// GET /api/fehler/shop/:name
// ============================================
router.get('/shop/:name', async (req, res, next) => {
  try {
    const warnungen = await FehlerLog.getShopWarnungen(req.params.name);
    res.json(warnungen || { shop: req.params.name, gesamtFehler: 0, warnungen: [] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/fehler/statistik
// Deine Monatsauswertung: haeufen sich Fehler in einer Stufe?
// ============================================
router.get('/statistik', async (req, res, next) => {
  try {
    res.json(await FehlerLog.getStatistiken());
  } catch (error) {
    next(error);
  }
});

module.exports = router;