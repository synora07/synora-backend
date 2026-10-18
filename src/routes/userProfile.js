// ============================================
// SYNORA - User Profile Routes
// ============================================
'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');

// ============================================
// GET PROFILE - GET /api/user/profile
// requireAuth hat den Nutzer bereits aus der Datenbank geladen
// ============================================
router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UPDATE PROFILE - PUT /api/user/profile
// ============================================
router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { firstname, lastname } = req.body;

    // Nur die Felder setzen, die wirklich mitgeschickt wurden
    const aenderungen = {};
    if (typeof firstname === 'string') aenderungen.firstname = firstname.trim();
    if (typeof lastname === 'string') aenderungen.lastname = lastname.trim();

    if (Object.keys(aenderungen).length === 0) {
      return res.status(400).json({ error: 'Keine Aenderungen uebermittelt' });
    }

    aenderungen.updatedAt = new Date();

    const aktualisiert = await User.findByIdAndUpdate(
      req.user._id,
      aenderungen,
      { new: true }
    ).select('-password');

    res.json({ success: true, message: 'Profil aktualisiert', user: aktualisiert });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET SETTINGS - GET /api/user/settings
// ============================================
router.get('/settings', requireAuth, async (req, res, next) => {
  try {
    // TODO: echte Einstellungen aus der Datenbank - das sind noch Festwerte
    res.json({
      settings: {
        language: 'de',
        currency: 'CHF',
        country: 'CH',
        emailNotifications: true
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UPDATE SETTINGS - PUT /api/user/settings
// ============================================
router.put('/settings', requireAuth, async (req, res, next) => {
  try {
    const { language, currency, country, emailNotifications } = req.body;
    // TODO: wirklich speichern - aktuell geht nichts in die Datenbank
    console.log('[settings] Speichern angefragt von', req.user.email);
    res.json({ success: true, message: 'Einstellungen gespeichert' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET STATS - GET /api/user/stats
// ============================================
router.get('/stats', requireAuth, async (req, res, next) => {
  try {
    // TODO: echte Zahlen aus Analytics - das sind noch Festwerte
    res.json({
      stats: {
        totalSearches: 0,
        totalClicks: 0,
        savedProducts: 0,
        memberSince: req.user.createdAt || null
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;