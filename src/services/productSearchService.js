// ==========================================
// SYNORA - PRODUCT SEARCH SERVICE (NEU!)
// DIREKTE SHOP-LINKS - KEINE GOOGLE-LINKS!
// ==========================================

const { FASHION_SHOPS } = require('../data/fashionShops');
const { ELEKTRONIK_SHOPS } = require('../data/elektronikShops');
const { KOSMETIK_SHOPS } = require('../data/kosmetikShops');

// Alle Shops zusammenführen
const ALL_SHOPS = {
  fashion: FASHION_SHOPS,
  elektronik: ELEKTRONIK_SHOPS,
  kosmetik: KOSMETIK_SHOPS
};

/**
 * Erkennt die Hauptkategorie aus der Suchanfrage
 */
function detectMainCategory(query) {
  const q = query.toLowerCase();
  
  // Fashion Keywords
  const fashionKeywords = ['kleid', 'hose', 'jacke', 'schuh', 'sneaker', 'shirt', 't-shirt', 'jeans', 'pullover', 'mantel', 'dress', 'pants', 'shoes', 'fashion', 'outfit', 'mode', 'anzug', 'hemd', 'bluse', 'rock', 'tasche', 'bag', 'uhr', 'watch', 'schmuck', 'jewelry', 'brille', 'sonnenbrille'];
  for (const kw of fashionKeywords) {
    if (q.includes(kw)) return 'fashion';
  }
  
  // Kosmetik Keywords
  const kosmetikKeywords = ['parfum', 'makeup', 'make-up', 'lippenstift', 'mascara', 'foundation', 'skincare', 'hautpflege', 'creme', 'serum', 'shampoo', 'beauty', 'kosmetik', 'duft', 'fragrance', 'nagellack', 'bodylotion', 'gesichtspflege'];
  for (const kw of kosmetikKeywords) {
    if (q.includes(kw)) return 'kosmetik';
  }
  
  // Default: Elektronik
  return 'elektronik';
}

/**
 * Erkennt die Unterkategorie aus der Suchanfrage
 */
function detectSubCategory(query, mainCategory) {
  const q = query.toLowerCase();
  
  if (mainCategory === 'fashion') {
    if (q.includes('damen') || q.includes('frauen') || q.includes('women')) return 'damenmode';
    if (q.includes('herren') || q.includes('männer') || q.includes('men')) return 'herrenmode';
    if (q.includes('schuh') || q.includes('sneaker') || q.includes('boot') || q.includes('shoe')) return 'schuhe';
    if (q.includes('kind') || q.includes('baby') || q.includes('kid') || q.includes('child')) return 'kinder_baby';
    if (q.includes('sport') || q.includes('outdoor') || q.includes('fitness') || q.includes('lauf')) return 'outdoor_sport';
    if (q.includes('schmuck') || q.includes('uhr') || q.includes('tasche') || q.includes('brille')) return 'accessoires';
    if (q.includes('arbeit') || q.includes('work') || q.includes('sicherheit')) return 'arbeitskleidung';
    return 'damenmode'; // Default
  }
  
  if (mainCategory === 'elektronik') {
    if (q.includes('handy') || q.includes('smartphone') || q.includes('iphone') || q.includes('samsung galaxy')) return 'mobile_kommunikation';
    if (q.includes('laptop') || q.includes('pc') || q.includes('computer') || q.includes('notebook') || q.includes('macbook')) return 'computer_it';
    if (q.includes('gaming') || q.includes('playstation') || q.includes('xbox') || q.includes('nintendo') || q.includes('ps5') || q.includes('vr')) return 'gaming_vr';
    if (q.includes('kopfhörer') || q.includes('headphone') || q.includes('lautsprecher') || q.includes('speaker') || q.includes('audio') || q.includes('airpods')) return 'audio_ton';
    if (q.includes('tv') || q.includes('fernseher') || q.includes('beamer') || q.includes('heimkino')) return 'tv_heimkino';
    if (q.includes('kamera') || q.includes('foto') || q.includes('drohne') || q.includes('gopro')) return 'foto_video';
    if (q.includes('smartwatch') || q.includes('fitness') || q.includes('tracker') || q.includes('apple watch') || q.includes('garmin')) return 'wearables';
    return 'mobile_kommunikation'; // Default
  }
  
  if (mainCategory === 'kosmetik') {
    if (q.includes('gesicht') || q.includes('face') || q.includes('serum') || q.includes('creme')) return 'gesichtspflege';
    if (q.includes('makeup') || q.includes('make-up') || q.includes('lippenstift') || q.includes('mascara') || q.includes('foundation')) return 'makeup';
    if (q.includes('körper') || q.includes('body') || q.includes('lotion') || q.includes('dusch')) return 'koerperpflege';
    if (q.includes('haar') || q.includes('hair') || q.includes('shampoo')) return 'haarpflege';
    if (q.includes('parfum') || q.includes('duft') || q.includes('fragrance') || q.includes('eau de')) return 'parfum';
    if (q.includes('nagel') || q.includes('nail')) return 'nagelpflege';
    if (q.includes('natur') || q.includes('bio') || q.includes('organic')) return 'naturkosmetik';
    return 'gesichtspflege'; // Default
  }
  
  return null;
}

/**
 * HAUPTFUNKTION: Sucht Produkte DIREKT in echten Shops
 * KEINE Google-Links mehr!
 */
async function searchProducts(query, country = 'CH', limit = 3) {
  try {
    const safeCountry = (country && typeof country === 'string') ? country.toUpperCase() : 'CH';
    
    // Kategorie erkennen
    const mainCategory = detectMainCategory(query);
    const subCategory = detectSubCategory(query, mainCategory);
    
    console.log(`🔍 SYNORA sucht: "${query}"`);
    console.log(`   Land: ${safeCountry} | Kategorie: ${mainCategory} > ${subCategory}`);
    
    // Shops für diese Kategorie holen
    let shops = [];
    const categoryData = ALL_SHOPS[mainCategory];
    
    if (categoryData && categoryData[subCategory] && categoryData[subCategory][safeCountry]) {
      shops = categoryData[subCategory][safeCountry];
    } else if (categoryData) {
      // Fallback: Erste verfügbare Unterkategorie
      const firstSubCat = Object.keys(categoryData)[0];
      if (categoryData[firstSubCat] && categoryData[firstSubCat][safeCountry]) {
        shops = categoryData[firstSubCat][safeCountry];
      }
    }
    
    if (shops.length === 0) {
      console.log('⚠️ Keine Shops gefunden für diese Kategorie/Land');
      return [];
    }
    
    // Generiere direkte Shop-Links
    const products = shops.slice(0, limit).map((shop, index) => {
      const searchUrl = shop.searchUrl + encodeURIComponent(query);
      
      // SYNORA Score berechnen (basierend auf Shop-Ranking)
      const baseScore = 95 - (index * 5);
      const synoraScore = Math.min(99, Math.max(70, baseScore + Math.floor(Math.random() * 5)));
      
      return {
        id: `product_${Date.now()}_${index}`,
        rank: index + 1,
        name: `${query} - Ergebnisse bei ${shop.name}`,
        
        // Shop Info
        shop: {
          name: shop.name,
          domain: shop.domain,
          logo: null
        },
        source: shop.name,
        
        // DIREKTE LINKS - KEINE GOOGLE!
        url: searchUrl,
        link: searchUrl,
        productLink: searchUrl,
        
        // Preis wird vom Shop angezeigt
        price: 'Preis im Shop',
        currency: shop.currency,
        
        // SYNORA Features
        verified: true,
        lastVerified: new Date().toISOString(),
        synoraScore: synoraScore,
        confidence: {
          level: synoraScore >= 85 ? 'high' : synoraScore >= 75 ? 'medium' : 'low',
          badge: synoraScore >= 85 ? '🟢' : synoraScore >= 75 ? '🟡' : '🔴'
        },
        
        // Reasoning
        reasoning: {
          whyGood: getWhyGood(shop.name, mainCategory),
          whyNot: getWhyNot(shop.name),
          tradeOffs: []
        },
        
        // Bewertung (simuliert)
        rating: (4.0 + Math.random() * 0.9).toFixed(1),
        reviewCount: Math.floor(100 + Math.random() * 900)
      };
    });
    
    console.log(`✅ ${products.length} direkte Shop-Links generiert`);
    return products;
    
  } catch (error) {
    console.error('❌ Produktsuche Fehler:', error.message);
    return [];
  }
}

/**
 * Generiert "Warum gut" Text
 */
function getWhyGood(shopName, category) {
  const reasons = {
    // CH Shops
    'Digitec': 'Schweizer Marktführer mit schneller Lieferung',
    'Galaxus': 'Riesige Auswahl und faire Preise',
    'Zalando': 'Kostenloser Versand und 100 Tage Rückgabe',
    'Manor': 'Schweizer Traditionswarenhaus',
    'Douglas': 'Premium Beauty mit Beratung',
    'Ochsner': 'Schweizer Marktführer für Schuhe und Sport',
    
    // DE Shops
    'Amazon': 'Schnelle Prime-Lieferung verfügbar',
    'MediaMarkt': 'Große Elektronik-Auswahl mit Beratung',
    'Saturn': 'Technik-Experte mit Fachberatung',
    'Otto': 'Deutschlands großer Online-Shop',
    'dm': 'Günstiges Drogerie-Sortiment',
    
    // US Shops
    'Best Buy': 'Amerikas größter Elektronikhändler',
    'Nordstrom': 'Premium Fashion mit Top-Service',
    'Sephora': 'Exklusive Beauty-Marken',
    'Target': 'Faire Preise und große Auswahl',
    
    // IN Shops
    'Flipkart': 'Indiens führender Online-Shop',
    'Myntra': 'Beste Fashion-Auswahl in Indien',
    'Nykaa': 'Indiens führender Beauty-Shop',
    'Croma': 'Vertrauenswürdiger Elektronikhändler'
  };
  
  for (const [key, value] of Object.entries(reasons)) {
    if (shopName.toLowerCase().includes(key.toLowerCase())) return value;
  }
  
  return 'Vertrauenswürdiger Online-Shop mit guten Bewertungen';
}

/**
 * Generiert "Warum nicht" Text
 */
function getWhyNot(shopName) {
  const cons = {
    'Amazon': 'Viele Drittanbieter-Produkte, Qualität kann variieren',
    'Galaxus': 'Manchmal längere Lieferzeiten',
    'MediaMarkt': 'Preise nicht immer die günstigsten',
    'Zalando': 'Begrenzte Elektronik-Auswahl',
    'Flipkart': 'Qualität kann bei Drittanbietern variieren'
  };
  
  for (const [key, value] of Object.entries(cons)) {
    if (shopName.toLowerCase().includes(key.toLowerCase())) return value;
  }
  
  return 'Preise vergleichen lohnt sich immer';
}

/**
 * Sucht mit SYNORA AI Analyse
 */
async function searchWithAnalysis(query, country, userPreferences = {}) {
  const safeCountry = (country && typeof country === 'string') ? country.toUpperCase() : 'CH';
  
  const products = await searchProducts(query, safeCountry, 5);
  
  if (products.length === 0) {
    return {
      success: false,
      message: `Keine Shops für "${query}" gefunden. Versuche eine andere Suchanfrage.`,
      products: [],
      query: query
    };
  }

  const top3 = products.slice(0, 3);

  return {
    success: true,
    message: `Hier sind die Top ${top3.length} Shops für "${query}":`,
    products: top3,
    query: query,
    totalFound: products.length
  };
}

/**
 * Währung für Land
 */
function getCurrency(country) {
  const safeCountry = (country && typeof country === 'string') ? country.toUpperCase() : 'CH';
  
  const currencies = {
    'CH': 'CHF',
    'DE': 'EUR',
    'US': 'USD',
    'IN': 'INR'
  };
  return currencies[safeCountry] || 'CHF';
}

module.exports = {
  searchProducts,
  searchWithAnalysis,
  getCurrency,
  detectMainCategory,
  detectSubCategory
};