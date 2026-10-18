// ============================================
// SYNORA - Preferences Routes
// ============================================
'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');

// ============================================
// GET PREFERENCES - GET /api/preferences
// ============================================
router.get('/', requireAuth, async (req, res, next) => {
  try {
    // TODO: aus UserPreferences laden - Model liegt bereit, wird noch nicht genutzt
    res.json({
      preferences: {
        favoriteShops: [],
        favoriteBrands: [],
        budgetLevel: 'mittel',
        categories: []
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SAVE PREFERENCES - POST /api/preferences
// ============================================
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { preferences } = req.body;
    // TODO: in UserPreferences speichern - aktuell geht nichts in die Datenbank
    console.log('[preferences] Speichern angefragt von', req.user.email);
    res.json({ success: true, message: 'Gespeichert' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// LEARN FROM SEARCH - POST /api/preferences/learn/search
// ============================================
router.post('/learn/search', requireAuth, async (req, res, next) => {
  try {
    const { query, category, budget } = req.body;
    // TODO: in UserPreferences/userlernen schreiben
    console.log(`[lernen] Suche "${query}"`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ============================================
// LEARN FROM PRODUCT - POST /api/preferences/learn/product
// ============================================
router.post('/learn/product', requireAuth, async (req, res, next) => {
  try {
    const { name, category, price, brand } = req.body;
    // TODO: in UserPreferences/userlernen schreiben
    console.log(`[lernen] Produkt "${name}"`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ============================================
// LEARN FROM SHOP - POST /api/preferences/learn/shop
// ============================================
router.post('/learn/shop', requireAuth, async (req, res, next) => {
  try {
    const { shopName } = req.body;
    // TODO: in UserPreferences/userlernen schreiben
    console.log(`[lernen] Shop "${shopName}"`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;