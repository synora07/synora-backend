// ============================================
// SYNORA - Auswertung
// ============================================
// Bewusst NUR LESEN. Gezaehlt wird dort, wo es passiert:
// Suchen im Controller, Klicks in den Klick-Eintraegen.
//
// Eine offene Schreib-Route waere eine Einladung, deine wichtigste
// Zahl mit erfundenen Ereignissen zu fluten.
// ============================================
'use strict';

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Analytics = require('../models/Analytics');
const ProduktKlick = require('../models/ProduktKlick');
const { AbgelehnteSuche } = require('../models/GastZaehler');
const { requireAuth } = require('../middleware/auth');

// Geschaetzte SerpAPI-Kosten pro Suche in USD.
// Gratisstufe = 0. Bei einem bezahlten Plan hier den echten Wert setzen.
const SERPAPI_KOSTEN = Number(process.env.SERPAPI_KOSTEN_PRO_SUCHE || 0);

/** Datum als YYYY-MM-DD in Schweizer Zeit */
function heutigesDatum() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}

// ============================================
// ZUGRIFF
// Admin-Konto oder ein Token aus der .env.
// Das Token ist der einfache Weg, solange du keinen Admin angelegt hast.
// ============================================
function nurAdmin(req, res, next) {
  const token = process.env.ANALYTICS_TOKEN;
  if (token && (req.query.token === token || req.headers['x-analytics-token'] === token)) {
    return next();
  }

  return requireAuth(req, res, () => {
    const istAdmin = req.user && req.user.role === 'admin';
    if (!istAdmin) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    next();
  });
}

// ============================================
// GET /api/analytics/zahlen
// Deine vier Zahlen, ehrlich beschriftet
// ============================================
router.get('/zahlen', nurAdmin, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Keine Datenbank' });
    }

    const tage = Math.min(Number(req.query.tage) || 30, 365);
    const seit = new Date(Date.now() - tage * 24 * 60 * 60 * 1000);

    const [suchZahlen, klickZahlen, abgelehnt] = await Promise.all([
      // Suchen und Modellkosten
      Analytics.aggregate([
        { $match: { eventTyp: 'suche', timestamp: { $gte: seit } } },
        {
          $group: {
            _id: null,
            suchen: { $sum: 1 },
            ausCache: { $sum: { $cond: ['$metadata.ausCache', 1, 0] } },
            modellKosten: { $sum: { $ifNull: ['$ki.kosten', 0] } },
            dauerSchnitt: { $avg: '$dauer' },
            ohneErgebnis: { $sum: { $cond: ['$erfolg', 0, 1] } }
          }
        }
      ]),

      // Klicks - stehen schon in den Klick-Eintraegen
      ProduktKlick.aggregate([
        { $match: { erstelltAm: { $gte: seit } } },
        {
          $group: {
            _id: null,
            angezeigt: { $sum: 1 },
            klicks: { $sum: '$klicks' },
            mitKlick: { $sum: { $cond: [{ $gt: ['$klicks', 0] }, 1, 0] } }
          }
        }
      ]),

      // Abgelehnte Suchen nach Grund
      AbgelehnteSuche.aggregate([
        { $match: { zeitpunkt: { $gte: seit } } },
        { $group: { _id: '$grund', anzahl: { $sum: 1 } } },
        { $sort: { anzahl: -1 } }
      ])
    ]);

    const s = suchZahlen[0] || { suchen: 0, ausCache: 0, modellKosten: 0, dauerSchnitt: 0, ohneErgebnis: 0 };
    const k = klickZahlen[0] || { angezeigt: 0, klicks: 0, mitKlick: 0 };

    // Echte Suchen sind die, die wirklich etwas gekostet haben
    const bezahlteSuchen = s.suchen - s.ausCache;
    const serpKosten = bezahlteSuchen * SERPAPI_KOSTEN;
    const gesamtKosten = s.modellKosten + serpKosten;

    res.json({
      zeitraum: `${tage} Tage`,

      suchen: {
        gesamt: s.suchen,
        ausCache: s.ausCache,
        cacheQuote: s.suchen ? Math.round((s.ausCache / s.suchen) * 100) + '%' : '0%',
        ohneErgebnis: s.ohneErgebnis,
        dauerSchnittMs: Math.round(s.dauerSchnitt || 0)
      },

      klicks: {
        gesamt: k.klicks,
        produkteAngezeigt: k.angezeigt,
        klickQuote: s.suchen ? Math.round((k.mitKlick / s.suchen) * 100) + '%' : '0%'
      },

      kaeufe: {
        gesamt: null,
        hinweis: 'Kommt ausschliesslich von AWIN, 60-90 Tage verzoegert. Vor der ersten Abrechnung nicht messbar.'
      },

      kosten: {
        modelleUSD: Math.round(s.modellKosten * 10000) / 10000,
        serpApiUSD: Math.round(serpKosten * 10000) / 10000,
        gesamtUSD: Math.round(gesamtKosten * 10000) / 10000,
        proSucheUSD: s.suchen ? Math.round((gesamtKosten / s.suchen) * 100000) / 100000 : 0,
        proSucheRappen: s.suchen
          ? Math.round((gesamtKosten / s.suchen) * 90 * 100) / 100
          : 0,
        hinweis: SERPAPI_KOSTEN
          ? null
          : 'SERPAPI_KOSTEN_PRO_SUCHE ist nicht gesetzt - SerpAPI zaehlt mit 0'
      },

      abgelehnt: abgelehnt.map((x) => ({ grund: x._id, anzahl: x.anzahl })),

      stand: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/analytics/tag
// ============================================
router.get('/tag', nurAdmin, async (req, res, next) => {
  try {
    const datum = req.query.datum || heutigesDatum();
    res.json(await Analytics.getTagesStatistik(datum));
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/analytics/dashboard
// ============================================
router.get('/dashboard', nurAdmin, async (req, res, next) => {
  try {
    res.json(await Analytics.getDashboard());
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/analytics/top-shops
// Welche Shops werden wirklich geklickt
// ============================================
router.get('/top-shops', nurAdmin, async (req, res, next) => {
  try {
    const tage = Math.min(Number(req.query.tage) || 30, 365);
    const seit = new Date(Date.now() - tage * 24 * 60 * 60 * 1000);

    const shops = await ProduktKlick.aggregate([
      { $match: { erstelltAm: { $gte: seit }, klicks: { $gt: 0 }, 'gewaehlterShop.name': { $ne: null } } },
      {
        $group: {
          _id: '$gewaehlterShop.name',
          klicks: { $sum: '$klicks' },
          land: { $first: '$gewaehlterShop.land' }
        }
      },
      { $sort: { klicks: -1 } },
      { $limit: 20 }
    ]);

    res.json({ zeitraum: `${tage} Tage`, shops });
  } catch (error) {
    next(error);
  }
});

module.exports = router;