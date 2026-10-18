// ============================================
// SYNORA - Product Routes
// ============================================

const express = require('express');
const router = express.Router();

// Services laden
let serpApiService, productSearchService;
try {
  serpApiService = require('../services/serpApiService');
} catch (e) {}
try {
  productSearchService = require('../services/productSearchService');
} catch (e) {}

// ============================================
// SEARCH PRODUCTS - GET /api/products/search
// ============================================
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 6 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Suchbegriff fehlt' });
    }

    let products = [];
    
    // SerpAPI verwenden
    if (serpApiService && serpApiService.searchRealProducts) {
      products = await serpApiService.searchRealProducts(q, parseInt(limit));
    }
    
    res.json({
      query: q,
      count: products?.length || 0,
      products: products || []
    });

  } catch (error) {
    console.error('Product Search Error:', error);
    res.status(500).json({ error: 'Suche fehlgeschlagen' });
  }
});

// ============================================
// GET PRODUCT BY ID - GET /api/products/:id
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Hier könnte man Produkt aus DB laden
    res.json({
      id,
      message: 'Produkt-Details nicht verfügbar'
    });

  } catch (error) {
    res.status(500).json({ error: 'Fehler' });
  }
});

// ============================================
// GET TRENDING - GET /api/products/trending
// ============================================
router.get('/trending', async (req, res) => {
  res.json({
    trending: [],
    message: 'Trending Produkte kommen bald'
  });
});

module.exports = router;