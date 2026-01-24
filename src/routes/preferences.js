// ============================================
// SYNORA - Preferences Routes
// API für User-Präferenzen lernen
// ============================================

const express = require('express');
const router = express.Router();
const UserPreferences = require('../models/UserPreferences');
const jwt = require('jsonwebtoken');

// ============================================
// HELPER: User ID aus Token
// ============================================
const getUserId = (req) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded.userId;
    }
  } catch (e) {}
  return null;
};

// ============================================
// HELPER: Get or Create Preferences
// ============================================
const getOrCreate = async (userId) => {
  let prefs = await UserPreferences.findOne({ userId });
  if (!prefs) {
    prefs = new UserPreferences({ userId });
    await prefs.save();
  }
  return prefs;
};

// ============================================
// POST /api/preferences/learn/search
// Lernt von Suche
// ============================================
router.post('/learn/search', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.json({ success: false, error: 'Not logged in' });
    
    const { query, category, budget } = req.body;
    const prefs = await getOrCreate(userId);
    
    prefs.learnFromSearch(query, category, budget);
    await prefs.save();
    
    console.log(`[LEARN] Search: "${query}" | User: ${userId}`);
    res.json({ success: true });
  } catch (e) {
    console.error('Learn search error:', e);
    res.status(500).json({ success: false });
  }
});

// ============================================
// POST /api/preferences/learn/product
// Lernt von Produkt-Klick
// ============================================
router.post('/learn/product', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.json({ success: false });
    
    const { name, category, price, brand } = req.body;
    const prefs = await getOrCreate(userId);
    
    prefs.learnFromProductClick(name, category, price, brand);
    await prefs.save();
    
    console.log(`[LEARN] Product: "${name}" | User: ${userId}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// POST /api/preferences/learn/shop
// Lernt von Shop-Klick
// ============================================
router.post('/learn/shop', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.json({ success: false });
    
    const { shopName } = req.body;
    const prefs = await getOrCreate(userId);
    
    prefs.learnFromShopClick(shopName);
    await prefs.save();
    
    console.log(`[LEARN] Shop: "${shopName}" | User: ${userId}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// GET /api/preferences/profile
// Holt User-Profil für KI
// ============================================
router.get('/profile', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.json({ success: false, profile: null });
    
    const prefs = await UserPreferences.findOne({ userId });
    if (!prefs) return res.json({ success: true, profile: null, isNewUser: true });
    
    res.json({ success: true, profile: prefs.getAIProfile() });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// GET /api/preferences/full
// Holt alle User-Präferenzen
// ============================================
router.get('/full', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not logged in' });
    
    const prefs = await UserPreferences.findOne({ userId });
    res.json({ success: true, preferences: prefs });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// DELETE /api/preferences
// Löscht alle Präferenzen (GDPR)
// ============================================
router.delete('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not logged in' });
    
    await UserPreferences.deleteOne({ userId });
    console.log(`[DELETE] Preferences deleted for User: ${userId}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;