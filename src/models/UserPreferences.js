// ============================================
// SYNORA V2.0 - USER PREFERENCES MODEL
// Personalisierung & Präferenzen
// Aktiviert nach 7 bestätigten Bestellungen
// ============================================

'use strict';

const mongoose = require('mongoose');

// ==========================================
// SUB-SCHEMAS
// ==========================================

// Shop-Bewertung Schema
const shopBewertungSchema = new mongoose.Schema({
  shopName: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    default: 0,
    min: -100,
    max: 100
  },
  grund: {
    type: String,
    enum: ['favorit', 'gekauft', 'problem', 'fehler', 'manuell'],
    default: 'manuell'
  },
  letztesUpdate: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Marken-Präferenz Schema
const markenPraeferenzSchema = new mongoose.Schema({
  marke: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    default: 0,
    min: -50,
    max: 50
  },
  kategorie: String,
  letztesUpdate: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Kategorie-Interesse Schema
const kategorieInteresseSchema = new mongoose.Schema({
  kategorie: {
    type: String,
    required: true
  },
  interesse: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  suchanfragen: {
    type: Number,
    default: 0
  },
  kaeufe: {
    type: Number,
    default: 0
  }
}, { _id: false });

// Preis-Präferenz Schema
const preisPraeferenzSchema = new mongoose.Schema({
  kategorie: {
    type: String,
    required: true
  },
  minPreis: {
    type: Number,
    default: 0
  },
  maxPreis: {
    type: Number,
    default: 10000
  },
  durchschnitt: {
    type: Number,
    default: 0
  }
}, { _id: false });

// ==========================================
// HAUPT-SCHEMA
// ==========================================

const userPreferencesSchema = new mongoose.Schema({
  
  // ==========================================
  // REFERENZ
  // ==========================================
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // ==========================================
  // PERSONALISIERUNG STATUS
  // ==========================================
  
  // Erst aktiv nach 7 bestätigten Bestellungen
  istAktiv: {
    type: Boolean,
    default: false
  },
  
  // Anzahl Datenpunkte (je mehr, desto besser)
  datenpunkte: {
    type: Number,
    default: 0
  },
  
  // ==========================================
  // SHOP PRÄFERENZEN
  // ==========================================
  
  // Lieblings-Shops (+10 pro Shop)
  lieblingsShops: [shopBewertungSchema],
  
  // Problem-Shops (-20 pro Shop)
  problemShops: [shopBewertungSchema],
  
  // Alle Shop-Bewertungen (Score-basiert)
  shopScores: {
    type: Map,
    of: Number,
    default: new Map()
  },
  
  // ==========================================
  // MARKEN PRÄFERENZEN
  // ==========================================
  
  // Lieblings-Marken (+10 pro Marke)
  lieblingsMarken: [markenPraeferenzSchema],
  
  // Gemiedene Marken
  gemiedeneMarken: [markenPraeferenzSchema],
  
  // ==========================================
  // KATEGORIE INTERESSEN
  // ==========================================
  
  kategorieInteressen: [kategorieInteresseSchema],
  
  // ==========================================
  // PREIS PRÄFERENZEN
  // ==========================================
  
  preisPraeferenzen: [preisPraeferenzSchema],
  
  // Generelles Budget-Level
  budgetLevel: {
    type: String,
    enum: ['budget', 'mittel', 'premium', 'luxus', 'unbekannt'],
    default: 'unbekannt'
  },
  
  // ==========================================
  // QUALITÄTS PRÄFERENZEN
  // ==========================================
  
  qualitaetsPrioritaet: {
    type: String,
    enum: ['preis', 'balance', 'qualitaet'],
    default: 'balance'
  },
  
  // Wichtigkeit verschiedener Faktoren (0-100)
  wichtigkeit: {
    preis: { type: Number, default: 50, min: 0, max: 100 },
    qualitaet: { type: Number, default: 50, min: 0, max: 100 },
    lieferzeit: { type: Number, default: 50, min: 0, max: 100 },
    bewertungen: { type: Number, default: 50, min: 0, max: 100 },
    nachhaltigkeit: { type: Number, default: 30, min: 0, max: 100 },
    schweizHerkunft: { type: Number, default: 40, min: 0, max: 100 }
  },
  
  // ==========================================
  // SUCH-HISTORIE (anonymisiert)
  // ==========================================
  
  letzteKategorien: [{
    kategorie: String,
    datum: { type: Date, default: Date.now }
  }],
  
  // Häufige Suchbegriffe (für bessere Vorschläge)
  haeufigeSuchbegriffe: [{
    begriff: String,
    anzahl: { type: Number, default: 1 },
    letzteNutzung: { type: Date, default: Date.now }
  }],
  
  // ==========================================
  // FEEDBACK HISTORIE
  // ==========================================
  
  feedbackCount: {
    positiv: { type: Number, default: 0 },
    negativ: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 }
  },
  
  // ==========================================
  // METADATA
  // ==========================================
  
  erstelltAm: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  
  aktualisiertAm: {
    type: Date,
    default: Date.now
  },
  
  letzteAktivitaet: {
    type: Date,
    default: Date.now
  }
  
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==========================================
// INDEXES
// ==========================================

userPreferencesSchema.index({ userId: 1 }, { unique: true });
userPreferencesSchema.index({ istAktiv: 1 });

// ==========================================
// VIRTUALS
// ==========================================

// Personalisierungs-Qualität (0-100)
userPreferencesSchema.virtual('personalisierungsQualitaet').get(function() {
  // Basierend auf Datenpunkten
  const maxPunkte = 100;
  const qualitaet = Math.min(100, (this.datenpunkte / maxPunkte) * 100);
  return Math.round(qualitaet);
});

// Top 3 Lieblings-Shops
userPreferencesSchema.virtual('topShops').get(function() {
  return (this.lieblingsShops || [])
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.shopName);
});

// Top 3 Lieblings-Marken
userPreferencesSchema.virtual('topMarken').get(function() {
  return (this.lieblingsMarken || [])
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(m => m.marke);
});

// ==========================================
// PRE-SAVE MIDDLEWARE
// ==========================================

userPreferencesSchema.pre('save', function(next) {
  this.aktualisiertAm = new Date();
  next();
});

// ==========================================
// INSTANCE METHODS
// ==========================================

/**
 * Shop-Score aktualisieren
 * 
 * @param {string} shopName - Name des Shops
 * @param {number} aenderung - Score-Änderung (+/-)
 * @param {string} grund - Grund für Änderung
 */
userPreferencesSchema.methods.updateShopScore = async function(shopName, aenderung, grund = 'manuell') {
  try {
    if (!shopName || typeof aenderung !== 'number') {
      return;
    }
    
    // Aktuellen Score holen
    const aktuellerScore = this.shopScores.get(shopName) || 0;
    const neuerScore = Math.max(-100, Math.min(100, aktuellerScore + aenderung));
    
    // Score speichern
    this.shopScores.set(shopName, neuerScore);
    
    // In Listen aktualisieren
    if (neuerScore >= 10) {
      // Zu Lieblings-Shops hinzufügen
      const existiert = this.lieblingsShops.find(s => s.shopName === shopName);
      if (existiert) {
        existiert.score = neuerScore;
        existiert.letztesUpdate = new Date();
      } else {
        this.lieblingsShops.push({
          shopName,
          score: neuerScore,
          grund,
          letztesUpdate: new Date()
        });
      }
      
      // Aus Problem-Shops entfernen
      this.problemShops = this.problemShops.filter(s => s.shopName !== shopName);
      
    } else if (neuerScore <= -10) {
      // Zu Problem-Shops hinzufügen
      const existiert = this.problemShops.find(s => s.shopName === shopName);
      if (existiert) {
        existiert.score = neuerScore;
        existiert.letztesUpdate = new Date();
      } else {
        this.problemShops.push({
          shopName,
          score: neuerScore,
          grund,
          letztesUpdate: new Date()
        });
      }
      
      // Aus Lieblings-Shops entfernen
      this.lieblingsShops = this.lieblingsShops.filter(s => s.shopName !== shopName);
    }
    
    // Datenpunkt zählen
    this.datenpunkte = (this.datenpunkte || 0) + 1;
    this.letzteAktivitaet = new Date();
    
    await this.save();
    
    return neuerScore;
    
  } catch (error) {
    console.error('updateShopScore Fehler:', error.message);
    throw error;
  }
};

/**
 * Marken-Präferenz aktualisieren
 * 
 * @param {string} marke - Markenname
 * @param {number} aenderung - Score-Änderung
 * @param {string} kategorie - Produktkategorie
 */
userPreferencesSchema.methods.updateMarkenPraeferenz = async function(marke, aenderung, kategorie = null) {
  try {
    if (!marke || typeof aenderung !== 'number') {
      return;
    }
    
    // Bestehende Präferenz finden
    let praeferenz = this.lieblingsMarken.find(m => m.marke === marke);
    
    if (praeferenz) {
      praeferenz.score = Math.max(-50, Math.min(50, praeferenz.score + aenderung));
      praeferenz.letztesUpdate = new Date();
    } else {
      this.lieblingsMarken.push({
        marke,
        score: Math.max(-50, Math.min(50, aenderung)),
        kategorie,
        letztesUpdate: new Date()
      });
    }
    
    // Negative Marken in gemiedeneMarken verschieben
    this.lieblingsMarken = this.lieblingsMarken.filter(m => {
      if (m.score < 0) {
        const existiert = this.gemiedeneMarken.find(gm => gm.marke === m.marke);
        if (!existiert) {
          this.gemiedeneMarken.push(m);
        }
        return false;
      }
      return true;
    });
    
    this.datenpunkte = (this.datenpunkte || 0) + 1;
    this.letzteAktivitaet = new Date();
    
    await this.save();
    
  } catch (error) {
    console.error('updateMarkenPraeferenz Fehler:', error.message);
    throw error;
  }
};

/**
 * Kategorie-Interesse erhöhen
 * 
 * @param {string} kategorie - Kategorie
 * @param {string} typ - 'suche' oder 'kauf'
 */
userPreferencesSchema.methods.kategorieInteresseErhoehen = async function(kategorie, typ = 'suche') {
  try {
    if (!kategorie) return;
    
    let interesse = this.kategorieInteressen.find(k => k.kategorie === kategorie);
    
    if (!interesse) {
      interesse = {
        kategorie,
        interesse: 0,
        suchanfragen: 0,
        kaeufe: 0
      };
      this.kategorieInteressen.push(interesse);
    }
    
    if (typ === 'suche') {
      interesse.suchanfragen = (interesse.suchanfragen || 0) + 1;
      interesse.interesse = Math.min(100, (interesse.interesse || 0) + 2);
    } else if (typ === 'kauf') {
      interesse.kaeufe = (interesse.kaeufe || 0) + 1;
      interesse.interesse = Math.min(100, (interesse.interesse || 0) + 10);
    }
    
    // Letzte Kategorien aktualisieren (max 10)
    this.letzteKategorien = this.letzteKategorien || [];
    this.letzteKategorien.unshift({ kategorie, datum: new Date() });
    this.letzteKategorien = this.letzteKategorien.slice(0, 10);
    
    this.datenpunkte = (this.datenpunkte || 0) + 1;
    this.letzteAktivitaet = new Date();
    
    await this.save();
    
  } catch (error) {
    console.error('kategorieInteresseErhoehen Fehler:', error.message);
  }
};

/**
 * Suchbegriff registrieren
 * 
 * @param {string} begriff - Suchbegriff
 */
userPreferencesSchema.methods.suchbegriffRegistrieren = async function(begriff) {
  try {
    if (!begriff || begriff.length < 2) return;
    
    const normalisiert = begriff.toLowerCase().trim();
    
    this.haeufigeSuchbegriffe = this.haeufigeSuchbegriffe || [];
    
    let eintrag = this.haeufigeSuchbegriffe.find(s => s.begriff === normalisiert);
    
    if (eintrag) {
      eintrag.anzahl = (eintrag.anzahl || 0) + 1;
      eintrag.letzteNutzung = new Date();
    } else {
      this.haeufigeSuchbegriffe.push({
        begriff: normalisiert,
        anzahl: 1,
        letzteNutzung: new Date()
      });
    }
    
    // Max 50 Begriffe behalten
    this.haeufigeSuchbegriffe = this.haeufigeSuchbegriffe
      .sort((a, b) => b.anzahl - a.anzahl)
      .slice(0, 50);
    
    this.letzteAktivitaet = new Date();
    
    await this.save();
    
  } catch (error) {
    console.error('suchbegriffRegistrieren Fehler:', error.message);
  }
};

/**
 * Personalisierung für Empfehlungen holen
 * 
 * @returns {Object} Personalisierungs-Daten
 */
userPreferencesSchema.methods.getPersonalisierungFuerEmpfehlung = function() {
  // Wenn nicht aktiv, leere Personalisierung
  if (!this.istAktiv) {
    return {
      aktiv: false,
      shopBonus: {},
      shopMalus: {},
      markenBonus: [],
      markenMalus: [],
      kategorien: [],
      wichtigkeit: this.wichtigkeit
    };
  }
  
  // Shop Boni/Mali aus Map
  const shopBonus = {};
  const shopMalus = {};
  
  for (const [shop, score] of this.shopScores) {
    if (score > 0) {
      shopBonus[shop] = score;
    } else if (score < 0) {
      shopMalus[shop] = Math.abs(score);
    }
  }
  
  return {
    aktiv: true,
    qualitaet: this.personalisierungsQualitaet,
    shopBonus,
    shopMalus,
    topShops: this.topShops,
    markenBonus: this.lieblingsMarken
      .filter(m => m.score > 0)
      .map(m => ({ marke: m.marke, score: m.score })),
    markenMalus: this.gemiedeneMarken
      .map(m => ({ marke: m.marke, score: Math.abs(m.score) })),
    topMarken: this.topMarken,
    kategorien: this.kategorieInteressen
      .sort((a, b) => b.interesse - a.interesse)
      .slice(0, 5)
      .map(k => k.kategorie),
    budgetLevel: this.budgetLevel,
    wichtigkeit: this.wichtigkeit
  };
};

// ==========================================
// STATIC METHODS
// ==========================================

/**
 * Preferences für User holen oder erstellen
 * 
 * @param {string} userId - User ID
 * @returns {Promise<UserPreferences>}
 */
userPreferencesSchema.statics.getOrCreate = async function(userId) {
  try {
    let prefs = await this.findOne({ userId });
    
    if (!prefs) {
      prefs = await this.create({ userId });
    }
    
    return prefs;
    
  } catch (error) {
    console.error('getOrCreate Fehler:', error.message);
    
    // Bei Duplicate-Error: erneut suchen
    if (error.code === 11000) {
      return await this.findOne({ userId });
    }
    
    throw error;
  }
};

/**
 * Personalisierung aktivieren
 * 
 * @param {string} userId - User ID
 */
userPreferencesSchema.statics.aktivieren = async function(userId) {
  try {
    const prefs = await this.getOrCreate(userId);
    prefs.istAktiv = true;
    await prefs.save();
    return prefs;
  } catch (error) {
    console.error('aktivieren Fehler:', error.message);
    throw error;
  }
};

// ==========================================
// MODEL ERSTELLEN & EXPORTIEREN
// ==========================================

const UserPreferences = mongoose.model('UserPreferences', userPreferencesSchema);

module.exports = UserPreferences;