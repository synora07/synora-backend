// ============================================
// SYNORA - Shop-Register durchsehen
// ============================================
// Deine Arbeitsliste. Shops sammeln sich automatisch aus echten
// Suchen an - hier siehst du, welche am haeufigsten auftauchen und
// noch keine Qualitaetsstufe haben.
//
// Die haeufigsten zuerst: dort bringt eine Bewertung am meisten.
// Zwanzig Minuten in dieser Liste sind mehr wert als hundert Stunden
// Shops abtippen, die nie jemand sucht.
// ============================================
'use strict';

const express = require('express');
const router = express.Router();

const register = require('../services/shopRegister');
const { requireAuth } = require('../middleware/auth');

const QUALITAET = ['premium', 'hoch', 'gut', 'mittel', 'niedrig'];
const PREIS = ['luxus', 'hoch', 'mittel', 'guenstig', 'budget'];
const VERSAND = ['schnell', 'mittel', 'langsam', 'digital'];

// Zugang wie bei der Auswertung: Token aus der .env oder Admin-Konto
function nurAdmin(req, res, next) {
  const token = process.env.ANALYTICS_TOKEN;
  if (token && (req.query.token === token || req.headers['x-analytics-token'] === token)) {
    return next();
  }

  return requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    next();
  });
}

// ============================================
// GET /api/shops/offen
// Noch nicht bewertete Shops, haeufigste zuerst
// ============================================
router.get('/offen', nurAdmin, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const liste = await register.offene(limit);

    res.json({
      anzahl: liste.length,
      hinweis: 'Haeufigste zuerst. Bewerten mit PATCH /api/shops/:kennung',
      moeglicheWerte: { qualitaet: QUALITAET, preis: PREIS, versand: VERSAND },
      shops: liste
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/shops/statistik
// ============================================
router.get('/statistik', nurAdmin, async (req, res, next) => {
  try {
    res.json(await register.statistik());
  } catch (error) {
    next(error);
  }
});

// ============================================
// PATCH /api/shops/:kennung
// Body: { qualitaet, preis, versand, notiz, gesperrt, gesperrtGrund }
// ============================================
router.patch('/:kennung', nurAdmin, async (req, res, next) => {
  try {
    const { qualitaet, preis, versand, notiz, gesperrt, gesperrtGrund } = req.body || {};

    if (qualitaet !== undefined && qualitaet !== null && !QUALITAET.includes(qualitaet)) {
      return res.status(400).json({ error: 'Ungueltige Qualitaetsstufe', moeglich: QUALITAET });
    }
    if (preis !== undefined && preis !== null && !PREIS.includes(preis)) {
      return res.status(400).json({ error: 'Ungueltige Preisstufe', moeglich: PREIS });
    }
    if (versand !== undefined && versand !== null && !VERSAND.includes(versand)) {
      return res.status(400).json({ error: 'Ungueltige Versandstufe', moeglich: VERSAND });
    }

    const eintrag = await register.bewerten(req.params.kennung, {
      qualitaet, preis, versand, notiz, gesperrt, gesperrtGrund
    });

    if (!eintrag) {
      return res.status(404).json({ error: 'Shop nicht gefunden oder nichts zu aendern' });
    }

    res.json({ success: true, shop: eintrag });
  } catch (error) {
    next(error);
  }
});

module.exports = router;