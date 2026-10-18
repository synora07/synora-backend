// ============================================
// SYNORA V2.0 - SERPAPI SERVICE
// Google Shopping Produktsuche
// ============================================

'use strict';

const axios = require('axios');
const { isBlacklisted } = require('./shopDatabasePart3');

// ==========================================
// KONFIGURATION
// ==========================================

const SERPAPI_CONFIG = {
  apiUrl: 'https://serpapi.com/search',
  timeout: 20000,
  maxRetries: 2,
  defaultParams: {
    engine: 'google_shopping',
    hl: 'de', // Sprache Deutsch
    gl: 'ch', // Land Schweiz (default)
    num: 20   // Anzahl Ergebnisse
  }
};

// ==========================================
// HAUPTFUNKTIONEN
// ==========================================

/**
 * Produkte suchen
 * 
 * @param {string} query - Suchbegriff
 * @param {Object} options - Optionen
 * @returns {Promise<Object>} Suchergebnisse
 */
async function searchProducts(query, options = {}) {
  const startTime = Date.now();
  
  try {
    // API Key prüfen
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      console.error('❌ SERPAPI_KEY nicht konfiguriert');
      return createErrorResponse('API nicht konfiguriert');
    }
    
    // Parameter zusammenstellen
    const params = buildSearchParams(query, options, apiKey);
    
    // API Call
    const response = await callSerpAPI(params);
    
    // Ergebnisse verarbeiten
    const products = processSearchResults(response);
    
    // Blacklist filtern
    const filteredProducts = filterBlacklistedShops(products);
    
    // Metriken
    const endTime = Date.now();
    
    return {
      success: true,
      query,
      total: filteredProducts.length,
      gefiltert: products.length - filteredProducts.length,
      produkte: filteredProducts,
      searchInfo: {
        engine: 'google_shopping',
        land: params.gl,
        sprache: params.hl,
        antwortzeit: endTime - startTime
      }
    };
    
  } catch (error) {
    console.error('SerpAPI Fehler:', error.message);
    
    return {
      success: false,
      error: error.message,
      query,
      produkte: [],
      searchInfo: {
        antwortzeit: Date.now() - startTime,
        fehler: true
      }
    };
  }
}

/**
 * Such-Parameter zusammenstellen
 */
function buildSearchParams(query, options, apiKey) {
  const {
    land = 'CH',
    minPreis = null,
    maxPreis = null,
    sortierung = null, // 'preis_aufsteigend', 'preis_absteigend', 'bewertung'
    anzahl = 20,
    seite = 1
  } = options;
  
  // Basis-Parameter
  const params = {
    ...SERPAPI_CONFIG.defaultParams,
    api_key: apiKey,
    q: query,
    num: Math.min(anzahl, 40)
  };
  
  // Land anpassen
  if (land === 'DE') {
    params.gl = 'de';
    params.location = 'Germany';
  } else if (land === 'AT') {
    params.gl = 'at';
    params.location = 'Austria';
  } else {
    params.gl = 'ch';
    params.location = 'Switzerland';
  }
  
  // Preisfilter
  if (minPreis) params.min_price = minPreis;
  if (maxPreis) params.max_price = maxPreis;
  
  // Pagination
  if (seite > 1) {
    params.start = (seite - 1) * params.num;
  }
  
  return params;
}

/**
 * SerpAPI aufrufen
 */
async function callSerpAPI(params, retryCount = 0) {
  try {
    const response = await axios.get(SERPAPI_CONFIG.apiUrl, {
      params,
      timeout: SERPAPI_CONFIG.timeout
    });
    
    return response.data;
    
  } catch (error) {
    // Retry bei bestimmten Fehlern
    if (retryCount < SERPAPI_CONFIG.maxRetries) {
      const isRetryable = 
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.response?.status >= 500;
      
      if (isRetryable) {
        console.log(`SerpAPI Retry ${retryCount + 1}/${SERPAPI_CONFIG.maxRetries}...`);
        await sleep(1000 * (retryCount + 1));
        return callSerpAPI(params, retryCount + 1);
      }
    }
    
    // Fehler Details
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error || error.message;
      
      if (status === 401) {
        throw new Error('SerpAPI: Ungültiger API Key');
      } else if (status === 429) {
        throw new Error('SerpAPI: Rate Limit erreicht');
      }
      
      throw new Error(`SerpAPI Fehler (${status}): ${message}`);
    }
    
    throw error;
  }
}

/**
 * Suchergebnisse verarbeiten
 */
function processSearchResults(response) {
  const results = [];
  
  // Shopping Results
  if (response.shopping_results && Array.isArray(response.shopping_results)) {
    for (const item of response.shopping_results) {
      const product = {
        id: item.product_id || generateId(),
        title: item.title || '',
        name: item.title || '',
        price: extractPrice(item.price || item.extracted_price),
        priceValue: item.extracted_price || parsePrice(item.price),
        currency: extractCurrency(item.price),
        source: item.source || '',
        shop: item.source || '',
        link: item.link || '',
        productLink: item.product_link || item.link || '',
        thumbnail: item.thumbnail || '',
        rating: item.rating || null,
        reviews: item.reviews || null,
        delivery: item.delivery || null,
        badge: item.badge || null, // z.B. "Bestseller"
        extensions: item.extensions || [],
        position: item.position || 0,
        immersive_product_page_token: item.immersive_product_page_token || null,
        product_id: item.product_id || null
      };
      
      // Zusätzliche Infos extrahieren
      if (item.extensions) {
        product.eigenschaften = item.extensions;
      }
      
      results.push(product);
    }
  }
  
  // Inline Shopping Results (manchmal andere Struktur)
  if (response.inline_shopping_results && Array.isArray(response.inline_shopping_results)) {
    for (const item of response.inline_shopping_results) {
      results.push({
        id: generateId(),
        title: item.title || '',
        name: item.title || '',
        price: extractPrice(item.price),
        priceValue: parsePrice(item.price),
        currency: extractCurrency(item.price),
        source: item.source || '',
        shop: item.source || '',
        link: item.link || '',
        thumbnail: item.thumbnail || '',
        rating: item.rating || null,
        isInline: true
      });
    }
  }
  
  return results;
}

/**
 * Blacklisted Shops filtern
 */
function filterBlacklistedShops(products) {
  return products.filter(product => {
    const shop = product.source || product.shop || '';
    
    if (isBlacklisted(shop)) {
      console.log(`🚫 Gefiltert: ${product.title?.substring(0, 30)}... von ${shop}`);
      return false;
    }
    
    return true;
  });
}

/**
 * Preis extrahieren
 */
function extractPrice(priceString) {
  if (!priceString) return null;
  
  // Bereits formatiert zurückgeben
  if (typeof priceString === 'string') {
    return priceString;
  }
  
  // Zahl formatieren
  if (typeof priceString === 'number') {
    return `CHF ${priceString.toFixed(2)}`;
  }
  
  return null;
}

/**
 * Preis als Zahl parsen
 *
 * GEAENDERT am 03.10.2026. Die alte Fassung war:
 *
 *     const match = String(priceString).match(/[\d.,]+/);
 *     const cleaned = match[0].replace(/,/g, '.');
 *     return parseFloat(cleaned);
 *
 * Gemessen, vier von sechs Preisen falsch:
 *
 *     "CHF 1,299.00"  ->     1.299   statt 1299
 *     "CHF 1'299.00"  ->         1   statt 1299
 *     "CHF 2,499.00"  ->     2.499   statt 2499
 *     "EUR 1.299,00"  ->     1.299   statt 1299
 *
 * Zwei Ursachen. Der Apostroph der Schweizer Schreibweise ist nicht
 * in [\d.,], also brach der Treffer nach der ersten Ziffer ab. Und
 * das Tausendertrennzeichen wurde zum Dezimalpunkt gemacht.
 *
 * Folge: ein Laptop fuer 1299 Franken kostete im System 1.30. Der
 * rutscht durch jede Budgetgrenze und steht als guenstigstes
 * Angebot ganz oben. Die Budgetwand hatte hier ein Loch.
 *
 * Diese Funktion greift vor allem bei inline_shopping_results -
 * dort liefert SerpAPI kein extracted_price.
 *
 * Neue Regel: das LETZTE Trennzeichen entscheidet. Steht danach
 * genau zwei Ziffern (oder eine), ist es das Dezimaltrennzeichen;
 * alles davor sind Tausender. Steht danach drei Ziffern, war es
 * ein Tausendertrennzeichen und es gibt keine Nachkommastellen.
 */
function parsePrice(priceString) {
  if (!priceString) return null;
  if (typeof priceString === 'number') return Number.isFinite(priceString) ? priceString : null;

  // Apostroph gehoert dazu: Schweizer Schreibweise 1'299.00
  const match = String(priceString).match(/\d[\d.,'’’\s]*\d|\d/);
  if (!match) return null;

  let roh = match[0].replace(/[\s'’’]/g, '');
  if (!roh) return null;

  const letzterPunkt = roh.lastIndexOf('.');
  const letztesKomma = roh.lastIndexOf(',');
  const trenner = Math.max(letzterPunkt, letztesKomma);

  let zahl;
  if (trenner === -1) {
    zahl = Number(roh);
  } else {
    const nachkomma = roh.length - trenner - 1;
    if (nachkomma === 3) {
      // "1.299" oder "1,299" -> Tausendertrennung, keine Rappen
      zahl = Number(roh.replace(/[.,]/g, ''));
    } else {
      // Letztes Zeichen trennt die Rappen ab, alles davor sind Tausender
      const ganz = roh.slice(0, trenner).replace(/[.,]/g, '');
      const rest = roh.slice(trenner + 1);
      zahl = Number(`${ganz}.${rest}`);
    }
  }

  return Number.isFinite(zahl) ? zahl : null;
}

/**
 * Währung extrahieren
 */
function extractCurrency(priceString) {
  if (!priceString) return 'CHF';
  
  const str = String(priceString).toUpperCase();
  
  if (str.includes('CHF') || str.includes('FR.')) return 'CHF';
  if (str.includes('EUR') || str.includes('€')) return 'EUR';
  if (str.includes('USD') || str.includes('$')) return 'USD';
  
  return 'CHF'; // Default
}

/**
 * ID generieren
 */
function generateId() {
  return 'sp_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Sleep Helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Error Response
 */
function createErrorResponse(message) {
  return {
    success: false,
    error: message,
    query: '',
    produkte: [],
    total: 0
  };
}

// ==========================================
// ZUSÄTZLICHE FUNKTIONEN
// ==========================================

/**
 * Produkt-Details abrufen
 */
async function getProductDetails(productId, shop) {
  try {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return { success: false, error: 'API nicht konfiguriert' };
    }
    
    const response = await axios.get(SERPAPI_CONFIG.apiUrl, {
      params: {
        api_key: apiKey,
        engine: 'google_product',
        product_id: productId,
        hl: 'de',
        gl: 'ch'
      },
      timeout: SERPAPI_CONFIG.timeout
    });
    
    const data = response.data;
    
    return {
      success: true,
      produkt: {
        id: productId,
        title: data.product_results?.title || '',
        description: data.product_results?.description || '',
        prices: data.product_results?.prices || [],
        rating: data.product_results?.rating || null,
        reviews: data.product_results?.reviews || null,
        specifications: data.product_results?.specifications || [],
        images: data.product_results?.media || []
      },
      sellers: data.sellers_results?.online_sellers || []
    };
    
  } catch (error) {
    console.error('getProductDetails Fehler:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Preisvergleich für ein Produkt
 */
async function comparePrices(query, options = {}) {
  try {
    // Suche in CH
    const chResults = await searchProducts(query, { ...options, land: 'CH' });
    
    // Suche in DE
    const deResults = await searchProducts(query, { ...options, land: 'DE' });
    
    // Zusammenführen und nach Preis sortieren
    const allProducts = [
      ...chResults.produkte.map(p => ({ ...p, land: 'CH' })),
      ...deResults.produkte.map(p => ({ ...p, land: 'DE' }))
    ].sort((a, b) => (a.priceValue || 999999) - (b.priceValue || 999999));
    
    return {
      success: true,
      query,
      guenstigster: allProducts[0] || null,
      teuerster: allProducts[allProducts.length - 1] || null,
      preisSpanne: {
        min: allProducts[0]?.priceValue || null,
        max: allProducts[allProducts.length - 1]?.priceValue || null
      },
      schweiz: chResults.produkte.length,
      deutschland: deResults.produkte.length,
      alleProdukte: allProducts
    };
    
  } catch (error) {
    console.error('comparePrices Fehler:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Ähnliche Produkte finden
 */
async function findSimilarProducts(productName, options = {}) {
  try {
    // Keywords aus Produktname extrahieren
    const keywords = productName
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
      .slice(0, 5)
      .join(' ');
    
    return await searchProducts(keywords, options);
    
  } catch (error) {
    console.error('findSimilarProducts Fehler:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Health Check
 */
async function healthCheck() {
  try {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return { healthy: false, reason: 'API Key nicht konfiguriert' };
    }
    
    // Test-Suche
    const response = await axios.get(SERPAPI_CONFIG.apiUrl, {
      params: {
        api_key: apiKey,
        engine: 'google_shopping',
        q: 'test',
        num: 1,
        gl: 'ch',
        hl: 'de'
      },
      timeout: 10000
    });
    
    return { 
      healthy: true,
      credits: response.data?.search_metadata?.credits_remaining || 'unbekannt'
    };
    
  } catch (error) {
    return { 
      healthy: false, 
      reason: error.message 
    };
  }
}

/**
 * API Guthaben prüfen
 */
async function checkCredits() {
  try {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return { success: false, error: 'API nicht konfiguriert' };
    }
    
    const response = await axios.get('https://serpapi.com/account', {
      params: { api_key: apiKey },
      timeout: 10000
    });
    
    return {
      success: true,
      credits: response.data
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  searchProducts,
  getProductDetails,
  comparePrices,
  findSimilarProducts,
  healthCheck,
  checkCredits,
  
  SERPAPI_CONFIG
};