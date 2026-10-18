// ============================================
// SYNORA V2.0 - HELPER FUNKTIONEN
// Wiederverwendbare Utilities
// Alle Funktionen sind sicher und stürzen nie ab
// ============================================

'use strict';

// ==========================================
// SICHERE OBJEKT-ZUGRIFFE
// ==========================================

/**
 * Sicherer Property-Zugriff (wie lodash.get)
 * Stürzt NIEMALS ab, gibt immer einen Wert zurück
 * 
 * @param {Object} obj - Das Objekt
 * @param {string} path - Der Pfad (z.B. 'user.profile.name' oder 'items[0].id')
 * @param {*} defaultValue - Fallback-Wert wenn nicht gefunden
 * @returns {*} Der Wert oder defaultValue
 * 
 * @example
 * safeGet(user, 'profile.name', 'Unbekannt')
 * safeGet(data, 'items[0].price', 0)
 */
function safeGet(obj, path, defaultValue = null) {
  try {
    // Null/Undefined Check
    if (obj === null || obj === undefined) {
      return defaultValue;
    }
    
    if (!path || typeof path !== 'string') {
      return defaultValue;
    }
    
    // Pfad in Keys aufteilen (unterstützt sowohl . als auch [])
    const keys = path
      .replace(/\[(\d+)\]/g, '.$1')  // [0] zu .0
      .split('.')
      .filter(key => key !== '');
    
    // Durch Pfad navigieren
    let result = obj;
    
    for (const key of keys) {
      if (result === null || result === undefined) {
        return defaultValue;
      }
      
      result = result[key];
    }
    
    // Undefined zu defaultValue
    return result !== undefined ? result : defaultValue;
    
  } catch (error) {
    // Bei JEDEM Fehler: defaultValue zurückgeben
    return defaultValue;
  }
}

/**
 * Sicheres Property-Setzen
 * Erstellt Pfad falls nicht vorhanden
 * 
 * @param {Object} obj - Das Objekt
 * @param {string} path - Der Pfad
 * @param {*} value - Der Wert
 * @returns {Object} Das modifizierte Objekt
 */
function safeSet(obj, path, value) {
  try {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    if (!path || typeof path !== 'string') {
      return obj;
    }
    
    const keys = path
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .filter(key => key !== '');
    
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      
      if (current[key] === undefined || current[key] === null) {
        // Nächster Key eine Zahl? Array erstellen, sonst Objekt
        const nextKey = keys[i + 1];
        current[key] = /^\d+$/.test(nextKey) ? [] : {};
      }
      
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    
    return obj;
    
  } catch (error) {
    return obj;
  }
}

// ==========================================
// ASYNC HELPERS
// ==========================================

/**
 * Promise mit Timeout
 * Verhindert dass Promises ewig hängen
 * 
 * @param {Promise} promise - Das Promise
 * @param {number} ms - Timeout in Millisekunden
 * @param {*} fallbackValue - Wert bei Timeout
 * @returns {Promise} Ergebnis oder fallbackValue
 * 
 * @example
 * const result = await withTimeout(apiCall(), 5000, null);
 */
async function withTimeout(promise, ms, fallbackValue = null) {
  let timeoutId;
  
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`⏱️ Timeout nach ${ms}ms erreicht`);
      resolve(fallbackValue);
    }, ms);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
    
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('withTimeout Fehler:', error.message);
    return fallbackValue;
  }
}

/**
 * Retry-Wrapper für fehleranfällige Funktionen
 * 
 * @param {Function} fn - Async Funktion
 * @param {number} retries - Anzahl Versuche
 * @param {number} delay - Verzögerung zwischen Versuchen (ms)
 * @param {*} fallbackValue - Wert wenn alle Versuche fehlschlagen
 * @returns {Promise} Ergebnis oder fallbackValue
 */
async function withRetry(fn, retries = 3, delay = 1000, fallbackValue = null) {
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
      
    } catch (error) {
      lastError = error;
      console.warn(`Retry ${attempt}/${retries} fehlgeschlagen:`, error.message);
      
      if (attempt < retries) {
        // Exponentielles Backoff
        await sleep(delay * attempt);
      }
    }
  }
  
  console.error(`Alle ${retries} Versuche fehlgeschlagen:`, lastError?.message);
  return fallbackValue;
}

/**
 * Sleep Funktion
 * 
 * @param {number} ms - Millisekunden
 * @returns {Promise}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================
// STRING HELPERS
// ==========================================

/**
 * String zu URL-sicherem Slug
 * 
 * @param {string} str - Input String
 * @returns {string} Slug
 */
function slugify(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  return str
    .toLowerCase()
    .trim()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Sanitize String (XSS Prevention)
 * 
 * @param {string} str - Input String
 * @returns {string} Sicherer String
 */
function sanitize(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * String kürzen mit ...
 * 
 * @param {string} str - Input String
 * @param {number} maxLength - Maximale Länge
 * @returns {string} Gekürzter String
 */
function truncate(str, maxLength = 100) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  if (str.length <= maxLength) {
    return str;
  }
  
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Ersten Buchstaben gross
 * 
 * @param {string} str - Input String
 * @returns {string}
 */
function capitalize(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ==========================================
// VALIDIERUNG
// ==========================================

/**
 * Validiere Email
 * 
 * @param {string} email - Email-Adresse
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
}

/**
 * Validiere URL
 * 
 * @param {string} url - URL
 * @returns {boolean}
 */
function isValidUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Prüft ob Wert leer ist
 * 
 * @param {*} value - Der Wert
 * @returns {boolean}
 */
function isEmpty(value) {
  if (value === null || value === undefined) {
    return true;
  }
  
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  
  return false;
}

// ==========================================
// FORMATIERUNG
// ==========================================

/**
 * Preis formatieren (CHF)
 * 
 * @param {number} price - Preis
 * @param {string} currency - Währung
 * @returns {string}
 */
function formatPrice(price, currency = 'CHF') {
  if (typeof price !== 'number' || isNaN(price)) {
    return 'N/A';
  }
  
  // Schweizer Format: 1'234.50
  const formatted = price
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  
  return `${currency} ${formatted}`;
}

/**
 * Datum formatieren
 * 
 * @param {Date|string} date - Datum
 * @param {string} format - Format ('short', 'long', 'time')
 * @returns {string}
 */
function formatDate(date, format = 'short') {
  try {
    const d = new Date(date);
    
    if (isNaN(d.getTime())) {
      return 'Ungültiges Datum';
    }
    
    const options = {
      short: { day: '2-digit', month: '2-digit', year: 'numeric' },
      long: { day: 'numeric', month: 'long', year: 'numeric' },
      time: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    };
    
    return d.toLocaleDateString('de-CH', options[format] || options.short);
    
  } catch (error) {
    return 'Ungültiges Datum';
  }
}

/**
 * Zahl formatieren
 * 
 * @param {number} num - Zahl
 * @param {number} decimals - Dezimalstellen
 * @returns {string}
 */
function formatNumber(num, decimals = 0) {
  if (typeof num !== 'number' || isNaN(num)) {
    return '0';
  }
  
  return num
    .toFixed(decimals)
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// ==========================================
// OBJEKT HELPERS
// ==========================================

/**
 * Deep Clone eines Objekts
 * 
 * @param {Object} obj - Objekt zum Klonen
 * @returns {Object}
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (error) {
    console.error('deepClone Fehler:', error.message);
    return obj;
  }
}

/**
 * Objekte zusammenführen (deep merge)
 * 
 * @param {Object} target - Ziel-Objekt
 * @param {Object} source - Quell-Objekt
 * @returns {Object}
 */
function deepMerge(target, source) {
  try {
    if (!source || typeof source !== 'object') {
      return target;
    }
    
    if (!target || typeof target !== 'object') {
      return source;
    }
    
    const result = { ...target };
    
    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('deepMerge Fehler:', error.message);
    return target;
  }
}

/**
 * Nur bestimmte Keys aus Objekt
 * 
 * @param {Object} obj - Das Objekt
 * @param {string[]} keys - Die Keys
 * @returns {Object}
 */
function pick(obj, keys) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(keys)) {
    return {};
  }
  
  const result = {};
  
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  
  return result;
}

/**
 * Keys aus Objekt entfernen
 * 
 * @param {Object} obj - Das Objekt
 * @param {string[]} keys - Die Keys
 * @returns {Object}
 */
function omit(obj, keys) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(keys)) {
    return obj;
  }
  
  const result = { ...obj };
  
  for (const key of keys) {
    delete result[key];
  }
  
  return result;
}

// ==========================================
// ARRAY HELPERS
// ==========================================

/**
 * Eindeutige Werte (unique)
 * 
 * @param {Array} arr - Das Array
 * @param {string} key - Optional: Key für Objekt-Arrays
 * @returns {Array}
 */
function unique(arr, key = null) {
  if (!Array.isArray(arr)) {
    return [];
  }
  
  if (!key) {
    return [...new Set(arr)];
  }
  
  const seen = new Set();
  return arr.filter(item => {
    const value = safeGet(item, key);
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

/**
 * Array in Chunks aufteilen
 * 
 * @param {Array} arr - Das Array
 * @param {number} size - Chunk-Grösse
 * @returns {Array[]}
 */
function chunk(arr, size) {
  if (!Array.isArray(arr) || size < 1) {
    return [];
  }
  
  const result = [];
  
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  
  return result;
}

/**
 * Zufälliges Element aus Array
 * 
 * @param {Array} arr - Das Array
 * @returns {*}
 */
function randomElement(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return null;
  }
  
  return arr[Math.floor(Math.random() * arr.length)];
}

// ==========================================
// ID GENERATION
// ==========================================

/**
 * Generiere zufällige ID
 * 
 * @param {number} length - Länge der ID
 * @returns {string}
 */
function generateId(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Generiere UUID v4
 * 
 * @returns {string}
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ==========================================
// FEHLER HELPERS
// ==========================================

/**
 * Sichere Funktion ausführen
 * Fängt alle Fehler ab
 * 
 * @param {Function} fn - Die Funktion
 * @param {*} fallback - Fallback bei Fehler
 * @returns {*}
 */
function safeExecute(fn, fallback = null) {
  try {
    return fn();
  } catch (error) {
    console.error('safeExecute Fehler:', error.message);
    return fallback;
  }
}

/**
 * Sichere async Funktion ausführen
 * 
 * @param {Function} fn - Die async Funktion
 * @param {*} fallback - Fallback bei Fehler
 * @returns {Promise}
 */
async function safeExecuteAsync(fn, fallback = null) {
  try {
    return await fn();
  } catch (error) {
    console.error('safeExecuteAsync Fehler:', error.message);
    return fallback;
  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Sichere Zugriffe
  safeGet,
  safeSet,
  
  // Async Helpers
  withTimeout,
  withRetry,
  sleep,
  
  // String Helpers
  slugify,
  sanitize,
  truncate,
  capitalize,
  
  // Validierung
  isValidEmail,
  isValidUrl,
  isEmpty,
  
  // Formatierung
  formatPrice,
  formatDate,
  formatNumber,
  
  // Objekt Helpers
  deepClone,
  deepMerge,
  pick,
  omit,
  
  // Array Helpers
  unique,
  chunk,
  randomElement,
  
  // ID Generation
  generateId,
  generateUUID,
  
  // Fehler Helpers
  safeExecute,
  safeExecuteAsync
};