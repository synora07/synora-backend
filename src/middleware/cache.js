// ============================================
// SYNORA - Cache System
// Schnellere Antworten, weniger Last
// ============================================

class SynoraCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000;  // Max 1000 Einträge
    this.defaultTTL = 5 * 60 * 1000;  // 5 Minuten
    
    // Cleanup alle 5 Minuten
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
    
    console.log('[CACHE] Cache System initialized');
  }
  
  // ============================================
  // SET - Speichern mit TTL
  // ============================================
  set(key, value, ttl = this.defaultTTL) {
    // Wenn Cache voll, älteste löschen
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl,
      created: Date.now()
    });
  }
  
  // ============================================
  // GET - Abrufen (null wenn abgelaufen)
  // ============================================
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  // ============================================
  // HAS - Prüfen ob vorhanden & gültig
  // ============================================
  has(key) {
    return this.get(key) !== null;
  }
  
  // ============================================
  // DELETE
  // ============================================
  delete(key) {
    this.cache.delete(key);
  }
  
  // ============================================
  // CLEANUP - Abgelaufene löschen
  // ============================================
  cleanup() {
    const now = Date.now();
    let deleted = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    if (deleted > 0) {
      console.log(`[CACHE] Cleaned up ${deleted} expired entries`);
    }
  }
  
  // ============================================
  // STATS
  // ============================================
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }
  
  // ============================================
  // CLEAR ALL
  // ============================================
  clear() {
    this.cache.clear();
    console.log('[CACHE] Cache cleared');
  }
}

// ============================================
// SEARCH CACHE - Für ähnliche Suchen
// ============================================
class SearchCache extends SynoraCache {
  constructor() {
    super();
    this.defaultTTL = 10 * 60 * 1000;  // 10 Minuten für Suchen
  }
  
  // Normalisiert Suchbegriff für besseres Caching
  normalizeQuery(query) {
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\säöü]/g, '');
  }
  
  // Cache Key erstellen
  createKey(query, category) {
    const normalized = this.normalizeQuery(query);
    return `search:${category || 'all'}:${normalized}`;
  }
  
  // Suche cachen
  cacheSearch(query, category, results) {
    const key = this.createKey(query, category);
    this.set(key, results);
    console.log(`[CACHE] Cached search: "${query}"`);
  }
  
  // Gecachte Suche holen
  getCachedSearch(query, category) {
    const key = this.createKey(query, category);
    const cached = this.get(key);
    if (cached) {
      console.log(`[CACHE] Cache HIT: "${query}"`);
    }
    return cached;
  }
}

// ============================================
// SINGLETON INSTANCES
// ============================================
const generalCache = new SynoraCache();
const searchCache = new SearchCache();

module.exports = {
  generalCache,
  searchCache,
  SynoraCache,
  SearchCache
};