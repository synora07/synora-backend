// ==========================================
// SYNORA - Product Search Routes
// /api/products/search
// ==========================================

const express = require('express');
const router = express.Router();
const { searchProducts, searchWithAnalysis } = require('../services/productSearchService');

/**
 * GET /api/products/search
 * Sucht Produkte basierend auf Query
 * 
 * Query Parameters:
 * - q: Suchanfrage (required)
 * - country: Ländercode (optional, default: ch)
 * - limit: Anzahl Ergebnisse (optional, default: 3)
 */
router.get('/search', async (req, res) => {
  try {
    const { q, country = 'ch', limit = 3 } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Suchanfrage (q) ist erforderlich'
      });
    }

    console.log(`\n🛒 SYNORA Produktsuche: "${q}"`);

    const result = await searchWithAnalysis(q.trim(), country, parseInt(limit));

    res.json(result);

  } catch (error) {
    console.error('❌ Search Route Error:', error);
    res.status(500).json({
      success: false,
      error: 'Produktsuche fehlgeschlagen',
      message: error.message
    });
  }
});

/**
 * POST /api/products/search
 * Sucht Produkte mit erweiterten Optionen
 */
router.post('/search', async (req, res) => {
  try {
    const { query, country = 'ch', limit = 3, preferences = {} } = req.body;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Suchanfrage ist erforderlich'
      });
    }

    console.log(`\n🛒 SYNORA Produktsuche (POST): "${query}"`);

    const result = await searchWithAnalysis(query.trim(), country, preferences);

    res.json(result);

  } catch (error) {
    console.error('❌ Search Route Error:', error);
    res.status(500).json({
      success: false,
      error: 'Produktsuche fehlgeschlagen',
      message: error.message
    });
  }
});

/**
 * GET /api/products/test
 * Test-Endpoint um zu prüfen ob API funktioniert
 */
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Test-Suche wird ausgeführt...');
    
    const result = await searchProducts('iPhone 15', 'ch', 2);
    
    res.json({
      success: true,
      message: 'SerpAPI funktioniert!',
      testResults: result.length,
      products: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'API Test fehlgeschlagen',
      message: error.message
    });
  }
});

module.exports = router;