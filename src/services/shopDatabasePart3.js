// ============================================
// SYNORA V2.0 - SHOP DATABASE FUNKTIONEN
// Such-, Filter- und Score-Funktionen
// ============================================

'use strict';

const { BLACKLIST, ALIEXPRESS_BEDINGUNGEN, QUALITAETS_LEVEL, PREIS_LEVEL, ELEKTRONIK_SHOPS } = require('./shopDatabase');
const { KOSMETIK_SHOPS, KLEIDUNG_SHOPS } = require('./shopDatabasePart2');

// ==========================================
// ALLE SHOPS KOMBINIEREN
// ==========================================

const ALLE_SHOPS = {
  elektronik: ELEKTRONIK_SHOPS,
  kosmetik: KOSMETIK_SHOPS,
  kleidung: KLEIDUNG_SHOPS
};

// ==========================================
// KATEGORIE MAPPING
// ==========================================

const KATEGORIE_MAPPING = {
  // Elektronik
  'smartphone': 'elektronik.smartphones',
  'smartphones': 'elektronik.smartphones',
  'handy': 'elektronik.smartphones',
  'handys': 'elektronik.smartphones',
  'iphone': 'elektronik.smartphones',
  'samsung galaxy': 'elektronik.smartphones',
  'tablet': 'elektronik.smartphones',
  'ipad': 'elektronik.smartphones',
  
  'laptop': 'elektronik.laptops',
  'laptops': 'elektronik.laptops',
  'notebook': 'elektronik.laptops',
  'macbook': 'elektronik.laptops',
  'gaming laptop': 'elektronik.laptops',
  
  'pc': 'elektronik.komponenten',
  'computer': 'elektronik.komponenten',
  'komponenten': 'elektronik.komponenten',
  'grafikkarte': 'elektronik.komponenten',
  'gpu': 'elektronik.komponenten',
  'cpu': 'elektronik.komponenten',
  'prozessor': 'elektronik.komponenten',
  'ram': 'elektronik.komponenten',
  'ssd': 'elektronik.komponenten',
  'mainboard': 'elektronik.komponenten',
  'netzteil': 'elektronik.komponenten',
  'gehäuse': 'elektronik.komponenten',
  
  'monitor': 'elektronik.monitore',
  'monitore': 'elektronik.monitore',
  'bildschirm': 'elektronik.monitore',
  'display': 'elektronik.monitore',
  
  'tv': 'elektronik.tv',
  'fernseher': 'elektronik.tv',
  'television': 'elektronik.tv',
  'oled': 'elektronik.tv',
  'qled': 'elektronik.tv',
  'heimkino': 'elektronik.tv',
  
  'kopfhörer': 'elektronik.audio',
  'kopfhoerer': 'elektronik.audio',
  'headphones': 'elektronik.audio',
  'lautsprecher': 'elektronik.audio',
  'audio': 'elektronik.audio',
  'hifi': 'elektronik.audio',
  'soundbar': 'elektronik.audio',
  
  'gaming': 'elektronik.gaming',
  'playstation': 'elektronik.gaming',
  'ps5': 'elektronik.gaming',
  'xbox': 'elektronik.gaming',
  'nintendo': 'elektronik.gaming',
  'switch': 'elektronik.gaming',
  'gaming pc': 'elektronik.gaming',
  'gaming maus': 'elektronik.gaming',
  'gaming tastatur': 'elektronik.gaming',
  
  'kamera': 'elektronik.foto',
  'kameras': 'elektronik.foto',
  'foto': 'elektronik.foto',
  'fotografie': 'elektronik.foto',
  'objektiv': 'elektronik.foto',
  'drohne': 'elektronik.foto',
  'gopro': 'elektronik.foto',
  
  'smarthome': 'elektronik.smarthome',
  'smart home': 'elektronik.smarthome',
  'alexa': 'elektronik.smarthome',
  'google home': 'elektronik.smarthome',
  'philips hue': 'elektronik.smarthome',
  
  'haushalt': 'elektronik.haushalt',
  'haushaltsgeräte': 'elektronik.haushalt',
  'staubsauger': 'elektronik.haushalt',
  'waschmaschine': 'elektronik.haushalt',
  'kühlschrank': 'elektronik.haushalt',
  'kaffeemaschine': 'elektronik.haushalt',
  
  'smartwatch': 'elektronik.wearables',
  'wearable': 'elektronik.wearables',
  'fitness tracker': 'elektronik.wearables',
  'apple watch': 'elektronik.wearables',
  
  'router': 'elektronik.netzwerk',
  'netzwerk': 'elektronik.netzwerk',
  'wifi': 'elektronik.netzwerk',
  'nas': 'elektronik.netzwerk',
  
  // Kosmetik
  'parfüm': 'kosmetik.parfuem',
  'parfum': 'kosmetik.parfuem',
  'parfuem': 'kosmetik.parfuem',
  'duft': 'kosmetik.parfuem',
  'eau de parfum': 'kosmetik.parfuem',
  'eau de toilette': 'kosmetik.parfuem',
  
  'hautpflege': 'kosmetik.hautpflege',
  'skincare': 'kosmetik.hautpflege',
  'creme': 'kosmetik.hautpflege',
  'serum': 'kosmetik.hautpflege',
  'gesichtspflege': 'kosmetik.hautpflege',
  
  'makeup': 'kosmetik.makeup',
  'make-up': 'kosmetik.makeup',
  'lippenstift': 'kosmetik.makeup',
  'mascara': 'kosmetik.makeup',
  'foundation': 'kosmetik.makeup',
  'lidschatten': 'kosmetik.makeup',
  
  'haarpflege': 'kosmetik.haarpflege',
  'shampoo': 'kosmetik.haarpflege',
  'conditioner': 'kosmetik.haarpflege',
  'haarfarbe': 'kosmetik.haarpflege',
  
  'drogerie': 'kosmetik.drogerie',
  'körperpflege': 'kosmetik.drogerie',
  
  'männerpflege': 'kosmetik.maennerpflege',
  'rasur': 'kosmetik.maennerpflege',
  'bart': 'kosmetik.maennerpflege',
  'aftershave': 'kosmetik.maennerpflege',
  
  // Kleidung
  'damenmode': 'kleidung.damen',
  'damen': 'kleidung.damen',
  'frauen': 'kleidung.damen',
  'kleid': 'kleidung.damen',
  'bluse': 'kleidung.damen',
  
  'herrenmode': 'kleidung.herren',
  'herren': 'kleidung.herren',
  'männer': 'kleidung.herren',
  'anzug': 'kleidung.herren',
  'hemd': 'kleidung.herren',
  
  'sportbekleidung': 'kleidung.sport',
  'sportkleidung': 'kleidung.sport',
  'trainingsanzug': 'kleidung.sport',
  'laufschuhe': 'kleidung.sport',
  
  'schuhe': 'kleidung.schuhe',
  'sneaker': 'kleidung.schuhe',
  'stiefel': 'kleidung.schuhe',
  'sandalen': 'kleidung.schuhe',
  
  'accessoires': 'kleidung.accessoires',
  'schmuck': 'kleidung.accessoires',
  'uhren': 'kleidung.accessoires',
  'taschen': 'kleidung.accessoires',
  'handtasche': 'kleidung.accessoires',
  
  'kindermode': 'kleidung.kinder',
  'kinderbekleidung': 'kleidung.kinder',
  'babykleidung': 'kleidung.kinder'
};

// ==========================================
// HILFSFUNKTIONEN
// ==========================================

/**
 * Prüft ob ein Shop auf der Blacklist ist
 * 
 * @param {string} shopName - Name des Shops
 * @returns {boolean}
 */
function isBlacklisted(shopName) {
  if (!shopName) return false;
  
  const normalized = shopName.toLowerCase().trim();
  
  return BLACKLIST.some(blocked => {
    return normalized.includes(blocked) || blocked.includes(normalized);
  });
}

/**
 * Prüft AliExpress Bedingungen
 * 
 * @param {Object} seller - Verkäufer-Daten
 * @returns {Object} { erlaubt: boolean, grund: string }
 */
function checkAliExpressBedingungen(seller) {
  if (!seller) {
    return { erlaubt: false, grund: 'Keine Verkäufer-Daten' };
  }
  
  const checks = [];
  
  // Sterne prüfen
  if (seller.rating && seller.rating >= ALIEXPRESS_BEDINGUNGEN.minSterne) {
    checks.push('sterne');
  }
  
  // Bestellungen prüfen
  if (seller.orders && seller.orders >= ALIEXPRESS_BEDINGUNGEN.minBestellungen) {
    checks.push('bestellungen');
  }
  
  // Käuferschutz prüfen
  if (seller.buyerProtection || seller.kaeferschutz) {
    checks.push('käuferschutz');
  }
  
  // Alle Bedingungen erfüllt?
  const erfuellt = checks.length >= 2; // Mindestens 2 von 3
  
  return {
    erlaubt: erfuellt,
    checks,
    grund: erfuellt 
      ? 'AliExpress Bedingungen erfüllt' 
      : `Nur ${checks.length}/3 Bedingungen erfüllt`
  };
}

/**
 * Qualitäts-Score für einen Shop berechnen
 * 
 * @param {Object} shop - Shop-Objekt
 * @returns {number} Score 0-100
 */
function getShopQualityScore(shop) {
  if (!shop) return 0;
  
  const levelInfo = QUALITAETS_LEVEL[shop.qualitaet];
  if (!levelInfo) return 50; // Default
  
  return levelInfo.score;
}

/**
 * Preis-Faktor für einen Shop
 * 
 * @param {Object} shop - Shop-Objekt
 * @returns {number} Faktor (0.6 - 1.5)
 */
function getShopPriceFactor(shop) {
  if (!shop) return 1.0;
  
  const levelInfo = PREIS_LEVEL[shop.preis];
  if (!levelInfo) return 1.0;
  
  return levelInfo.faktor;
}

/**
 * Kategorie-Pfad aus Suchbegriff ermitteln
 * 
 * @param {string} query - Suchbegriff
 * @returns {string|null} Kategorie-Pfad (z.B. 'elektronik.smartphones')
 */
function detectCategory(query) {
  if (!query) return null;
  
  const normalized = query.toLowerCase().trim();
  
  // Direkte Übereinstimmung
  if (KATEGORIE_MAPPING[normalized]) {
    return KATEGORIE_MAPPING[normalized];
  }
  
  // Teilübereinstimmung
  for (const [keyword, category] of Object.entries(KATEGORIE_MAPPING)) {
    if (normalized.includes(keyword) || keyword.includes(normalized)) {
      return category;
    }
  }
  
  return null;
}

/**
 * Shops für eine Kategorie holen
 * 
 * @param {string} categoryPath - Pfad wie 'elektronik.smartphones'
 * @returns {Array} Liste von Shops
 */
function getShopsForCategory(categoryPath) {
  if (!categoryPath) return [];
  
  try {
    const [hauptKategorie, unterKategorie] = categoryPath.split('.');
    
    if (!hauptKategorie || !ALLE_SHOPS[hauptKategorie]) {
      return [];
    }
    
    const kategorieShops = ALLE_SHOPS[hauptKategorie];
    
    if (unterKategorie && kategorieShops[unterKategorie]) {
      return kategorieShops[unterKategorie];
    }
    
    // Wenn keine Unterkategorie: Alle Shops der Hauptkategorie
    const alleShops = [];
    for (const subCat of Object.values(kategorieShops)) {
      if (Array.isArray(subCat)) {
        alleShops.push(...subCat);
      }
    }
    
    return alleShops;
    
  } catch (error) {
    console.error('getShopsForCategory Fehler:', error.message);
    return [];
  }
}

/**
 * Shops suchen
 * 
 * @param {string} query - Suchbegriff
 * @param {Object} options - Optionen
 * @returns {Array} Gefilterte Shops
 */
function searchShops(query, options = {}) {
  try {
    const {
      land = null,           // 'CH', 'DE', oder null für alle
      minQualitaet = null,   // 'premium', 'hoch', 'gut', 'mittel', 'niedrig'
      maxPreis = null,       // 'luxus', 'hoch', 'mittel', 'guenstig', 'budget'
      limit = 20,
      sortBy = 'qualitaet'   // 'qualitaet', 'preis', 'name'
    } = options;
    
    // Kategorie ermitteln
    const categoryPath = detectCategory(query);
    
    let shops = [];
    
    if (categoryPath) {
      shops = getShopsForCategory(categoryPath);
    } else {
      // Alle Shops durchsuchen
      for (const hauptKat of Object.values(ALLE_SHOPS)) {
        for (const unterKat of Object.values(hauptKat)) {
          if (Array.isArray(unterKat)) {
            shops.push(...unterKat);
          }
        }
      }
    }
    
    // Blacklist filtern
    shops = shops.filter(shop => !isBlacklisted(shop.name));
    
    // Nach Land filtern
    if (land) {
      shops = shops.filter(shop => 
        shop.land === land || shop.land === 'INT'
      );
    }
    
    // Nach Qualität filtern
    if (minQualitaet) {
      const qualitaetsReihenfolge = ['premium', 'hoch', 'gut', 'mittel', 'niedrig'];
      const minIndex = qualitaetsReihenfolge.indexOf(minQualitaet);
      
      shops = shops.filter(shop => {
        const shopIndex = qualitaetsReihenfolge.indexOf(shop.qualitaet);
        return shopIndex <= minIndex;
      });
    }
    
    // Nach Preis filtern
    if (maxPreis) {
      const preisReihenfolge = ['budget', 'guenstig', 'mittel', 'hoch', 'luxus'];
      const maxIndex = preisReihenfolge.indexOf(maxPreis);
      
      shops = shops.filter(shop => {
        const shopIndex = preisReihenfolge.indexOf(shop.preis);
        return shopIndex <= maxIndex;
      });
    }
    
    // Sortieren
    shops.sort((a, b) => {
      if (sortBy === 'qualitaet') {
        return getShopQualityScore(b) - getShopQualityScore(a);
      } else if (sortBy === 'preis') {
        return getShopPriceFactor(a) - getShopPriceFactor(b);
      } else {
        return a.name.localeCompare(b.name);
      }
    });
    
    // Duplikate entfernen (nach URL)
    const seenUrls = new Set();
    shops = shops.filter(shop => {
      if (seenUrls.has(shop.url)) {
        return false;
      }
      seenUrls.add(shop.url);
      return true;
    });
    
    // Limit
    return shops.slice(0, limit);
    
  } catch (error) {
    console.error('searchShops Fehler:', error.message);
    return [];
  }
}

/**
 * Shop nach Name oder URL finden
 * 
 * @param {string} identifier - Name oder URL
 * @returns {Object|null} Shop oder null
 */
function findShop(identifier) {
  if (!identifier) return null;
  
  const normalized = identifier.toLowerCase().trim();
  
  try {
    for (const hauptKat of Object.values(ALLE_SHOPS)) {
      for (const unterKat of Object.values(hauptKat)) {
        if (Array.isArray(unterKat)) {
          const found = unterKat.find(shop => 
            shop.name.toLowerCase() === normalized ||
            shop.url.toLowerCase() === normalized ||
            shop.url.toLowerCase().includes(normalized)
          );
          
          if (found) {
            return found;
          }
        }
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('findShop Fehler:', error.message);
    return null;
  }
}

/**
 * Shop-Score für Ranking berechnen
 * 
 * @param {Object} shop - Shop-Objekt
 * @param {Object} personalisierung - User-Personalisierung
 * @returns {number} Score 0-100
 */
function calculateShopScore(shop, personalisierung = null) {
  if (!shop) return 0;
  
  let score = getShopQualityScore(shop);
  
  // Personalisierung anwenden
  if (personalisierung && personalisierung.aktiv) {
    // Shop-Bonus
    if (personalisierung.shopBonus && personalisierung.shopBonus[shop.name]) {
      score += personalisierung.shopBonus[shop.name];
    }
    
    // Shop-Malus
    if (personalisierung.shopMalus && personalisierung.shopMalus[shop.name]) {
      score -= personalisierung.shopMalus[shop.name];
    }
    
    // Schweizer Shop Bonus (wenn wichtig für User)
    if (personalisierung.wichtigkeit?.schweizHerkunft > 50 && shop.land === 'CH') {
      score += 5;
    }
  }
  
  // Schneller Versand Bonus
  if (shop.versand === 'schnell') {
    score += 3;
  }
  
  // Score begrenzen
  return Math.max(0, Math.min(100, score));
}

/**
 * Beste Shops für Produktsuche empfehlen
 * 
 * @param {string} query - Produktsuche
 * @param {Object} options - Optionen
 * @returns {Array} Empfohlene Shops mit Score
 */
function recommendShops(query, options = {}) {
  const {
    land = 'CH',
    personalisierung = null,
    limit = 10
  } = options;
  
  try {
    // Shops suchen
    const shops = searchShops(query, { 
      land, 
      limit: limit * 2 // Mehr holen für bessere Auswahl
    });
    
    // Scores berechnen
    const scoredShops = shops.map(shop => ({
      ...shop,
      score: calculateShopScore(shop, personalisierung),
      istFavorit: personalisierung?.topShops?.includes(shop.name) || false,
      hatWarnung: personalisierung?.shopMalus?.[shop.name] > 10 || false
    }));
    
    // Nach Score sortieren
    scoredShops.sort((a, b) => {
      // Favoriten zuerst
      if (a.istFavorit && !b.istFavorit) return -1;
      if (!a.istFavorit && b.istFavorit) return 1;
      
      // Dann nach Score
      return b.score - a.score;
    });
    
    return scoredShops.slice(0, limit);
    
  } catch (error) {
    console.error('recommendShops Fehler:', error.message);
    return [];
  }
}

/**
 * Shop-Statistiken
 * 
 * @returns {Object} Statistiken
 */
function getShopStatistics() {
  let total = 0;
  const byCategory = {};
  const byCountry = {};
  const byQuality = {};
  
  for (const [hauptKat, unterKats] of Object.entries(ALLE_SHOPS)) {
    byCategory[hauptKat] = 0;
    
    for (const [unterKat, shops] of Object.entries(unterKats)) {
      if (Array.isArray(shops)) {
        byCategory[hauptKat] += shops.length;
        total += shops.length;
        
        for (const shop of shops) {
          // Nach Land
          byCountry[shop.land] = (byCountry[shop.land] || 0) + 1;
          
          // Nach Qualität
          byQuality[shop.qualitaet] = (byQuality[shop.qualitaet] || 0) + 1;
        }
      }
    }
  }
  
  return {
    total,
    byCategory,
    byCountry,
    byQuality,
    blacklistCount: BLACKLIST.length
  };
}

/**
 * Alle Kategorien auflisten
 * 
 * @returns {Object} Kategorien mit Unterkategorien
 */
function listCategories() {
  const categories = {};
  
  for (const [hauptKat, unterKats] of Object.entries(ALLE_SHOPS)) {
    categories[hauptKat] = Object.keys(unterKats);
  }
  
  return categories;
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Konstanten
  BLACKLIST,
  ALIEXPRESS_BEDINGUNGEN,
  QUALITAETS_LEVEL,
  PREIS_LEVEL,
  ALLE_SHOPS,
  KATEGORIE_MAPPING,
  
  // Funktionen
  isBlacklisted,
  checkAliExpressBedingungen,
  getShopQualityScore,
  getShopPriceFactor,
  detectCategory,
  getShopsForCategory,
  searchShops,
  findShop,
  calculateShopScore,
  recommendShops,
  getShopStatistics,
  listCategories
};