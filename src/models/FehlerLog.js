// ============================================
// SYNORA V2.0 - FEHLERLOG MODEL
// Das Fehler-Lernsystem
// SYNORA lernt aus Fehlern und verbessert sich
// ============================================

'use strict';

const mongoose = require('mongoose');

// ==========================================
// FEHLER-TYPEN DEFINITION
// ==========================================

const FEHLER_TYPEN = {
  qualitaet: {
    name: 'Qualitätsproblem',
    beschreibung: 'Produkt hat schlechte Qualität',
    shopScoreAenderung: -10,
    schwere: 'mittel'
  },
  fake: {
    name: 'Fälschung',
    beschreibung: 'Produkt ist eine Fälschung',
    shopScoreAenderung: -20,
    schwere: 'schwer'
  },
  lieferung: {
    name: 'Lieferproblem',
    beschreibung: 'Produkt nie angekommen oder zu spät',
    shopScoreAenderung: -5,
    schwere: 'leicht'
  },
  preis: {
    name: 'Preisproblem',
    beschreibung: 'Preis war anders als angezeigt',
    shopScoreAenderung: -5,
    schwere: 'leicht'
  },
  falschesProdukt: {
    name: 'Falsches Produkt',
    beschreibung: 'Anderes Produkt erhalten als bestellt',
    shopScoreAenderung: -15,
    schwere: 'schwer'
  },
  beschreibung: {
    name: 'Beschreibung falsch',
    beschreibung: 'Produktbeschreibung stimmte nicht',
    shopScoreAenderung: -5,
    schwere: 'leicht'
  },
  kundenservice: {
    name: 'Kundenservice',
    beschreibung: 'Schlechter Kundenservice',
    shopScoreAenderung: -3,
    schwere: 'leicht'
  },
  falscheEmpfehlung: {
    name: 'Falsche Empfehlung',
    beschreibung: 'Produkt passte nicht zu Anfrage',
    shopScoreAenderung: 0,
    schwere: 'leicht'
  },
  technisch: {
    name: 'Technisches Problem',
    beschreibung: 'Produkt funktioniert nicht',
    shopScoreAenderung: -8,
    schwere: 'mittel'
  },
  sonstiges: {
    name: 'Sonstiges',
    beschreibung: 'Anderes Problem',
    shopScoreAenderung: -2,
    schwere: 'leicht'
  }
};

// ==========================================
// SCHEMA DEFINITION
// ==========================================

const fehlerLogSchema = new mongoose.Schema({
  
  // ==========================================
  // REFERENZEN
  // ==========================================
  
  // User der den Fehler gemeldet hat (optional für Gäste)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  
  // Session ID für Gäste
  sessionId: {
    type: String,
    default: null
  },
  
  // ==========================================
  // DIE SUCHANFRAGE
  // ==========================================
  
  // Original Suchanfrage
  suchanfrage: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  
  // Kategorie der Suche
  kategorie: {
    type: String,
    trim: true,
    lowercase: true
  },
  
  // ==========================================
  // DAS EMPFOHLENE PRODUKT
  // ==========================================
  
  empfohlenesProdukt: {
    name: {
      type: String,
      required: true
    },
    preis: Number,
    waehrung: {
      type: String,
      default: 'CHF'
    },
    produktUrl: String,
    bildUrl: String,
    synoraScore: Number
  },
  
  // ==========================================
  // DER EMPFOHLENE SHOP
  // ==========================================
  
  empfohlenerShop: {
    type: String,
    required: true,
    index: true
  },
  
  shopUrl: String,
  
  // ==========================================
  // DAS PROBLEM
  // ==========================================
  
  // Fehler-Typ
  fehlerTyp: {
    type: String,
    enum: Object.keys(FEHLER_TYPEN),
    required: true,
    index: true
  },
  
  // Schwere
  schwere: {
    type: String,
    enum: ['leicht', 'mittel', 'schwer'],
    default: 'mittel'
  },
  
  // Beschreibung vom User
  fehlerBeschreibung: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  
  // ==========================================
  // ANALYSE & LERNEN
  // ==========================================
  
  // Hat SYNORA gelernt?
  gelernt: {
    type: Boolean,
    default: false
  },
  
  // Was wurde gelernt?
  gelernteAktion: {
    // Shop Score Änderung
    shopScoreAenderung: {
      type: Number,
      default: 0
    },
    
    // Produkt auf Blacklist?
    produktBlacklist: {
      type: Boolean,
      default: false
    },
    
    // Shop auf Blacklist?
    shopBlacklist: {
      type: Boolean,
      default: false
    },
    
    // Warnung für Kategorie
    kategorieWarnung: String,
    
    // Muster erkannt
    musterErkannt: String,
    
    // Ähnliche Fehler
    aehnlicheFehlerCount: {
      type: Number,
      default: 0
    }
  },
  
  // ==========================================
  // MUSTER-ERKENNUNG
  // ==========================================
  
  // Ist Teil eines Musters?
  istMuster: {
    type: Boolean,
    default: false
  },
  
  // Muster ID (gruppiert ähnliche Fehler)
  musterId: String,
  
  // Tags für Analyse
  tags: [String],
  
  // ==========================================
  // STATUS
  // ==========================================
  
  status: {
    type: String,
    enum: ['neu', 'analysiert', 'gelernt', 'ignoriert'],
    default: 'neu',
    index: true
  },
  
  // Von Admin bearbeitet?
  bearbeitetVon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  bearbeitetAm: Date,
  
  // Admin Notizen
  adminNotizen: String,
  
  // ==========================================
  // METADATA
  // ==========================================
  
  erstelltAm: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true
  },
  
  aktualisiertAm: {
    type: Date,
    default: Date.now
  },
  
  // User Agent für Debugging
  userAgent: String,
  
  // IP (anonymisiert)
  ipHash: String
  
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==========================================
// INDEXES
// ==========================================

fehlerLogSchema.index({ empfohlenerShop: 1, fehlerTyp: 1 });
fehlerLogSchema.index({ kategorie: 1, fehlerTyp: 1 });
fehlerLogSchema.index({ erstelltAm: -1 });
fehlerLogSchema.index({ gelernt: 1, status: 1 });
fehlerLogSchema.index({ musterId: 1 });

// ==========================================
// VIRTUALS
// ==========================================

// Fehler-Info
fehlerLogSchema.virtual('fehlerInfo').get(function() {
  return FEHLER_TYPEN[this.fehlerTyp] || FEHLER_TYPEN.sonstiges;
});

// Alter in Tagen
fehlerLogSchema.virtual('alterInTagen').get(function() {
  const diff = Date.now() - this.erstelltAm.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// ==========================================
// PRE-SAVE MIDDLEWARE
// ==========================================

fehlerLogSchema.pre('save', function(next) {
  this.aktualisiertAm = new Date();
  
  // Schwere automatisch setzen
  const fehlerInfo = FEHLER_TYPEN[this.fehlerTyp];
  if (fehlerInfo && !this.schwere) {
    this.schwere = fehlerInfo.schwere;
  }
  
  next();
});

// ==========================================
// INSTANCE METHODS
// ==========================================

/**
 * Fehler analysieren und lernen
 */
fehlerLogSchema.methods.analysierenUndLernen = async function() {
  try {
    if (this.gelernt) {
      return this.gelernteAktion;
    }
    
    const fehlerInfo = FEHLER_TYPEN[this.fehlerTyp] || FEHLER_TYPEN.sonstiges;
    
    // Ähnliche Fehler zählen
    const aehnlicheFehler = await this.constructor.countDocuments({
      empfohlenerShop: this.empfohlenerShop,
      fehlerTyp: this.fehlerTyp,
      _id: { $ne: this._id },
      erstelltAm: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Letzte 90 Tage
    });
    
    // Gelernte Aktionen bestimmen
    this.gelernteAktion = {
      shopScoreAenderung: fehlerInfo.shopScoreAenderung,
      aehnlicheFehlerCount: aehnlicheFehler
    };
    
    // Bei vielen ähnlichen Fehlern: Muster erkannt!
    if (aehnlicheFehler >= 3) {
      this.istMuster = true;
      this.musterId = `${this.empfohlenerShop}-${this.fehlerTyp}`;
      this.gelernteAktion.musterErkannt = `Shop "${this.empfohlenerShop}" hat wiederholt Probleme mit "${fehlerInfo.name}"`;
      
      // Bei 5+ Fehlern: Stärkere Strafe
      if (aehnlicheFehler >= 5) {
        this.gelernteAktion.shopScoreAenderung = fehlerInfo.shopScoreAenderung * 2;
      }
      
      // Bei 10+ Fehlern: Shop-Warnung
      if (aehnlicheFehler >= 10 && this.fehlerTyp !== 'sonstiges') {
        this.gelernteAktion.kategorieWarnung = 
          `⚠️ Vorsicht bei "${this.empfohlenerShop}": ${aehnlicheFehler}+ Beschwerden wegen ${fehlerInfo.name}`;
      }
    }
    
    // Bei Fakes: Sofort Blacklist-Kandidat
    if (this.fehlerTyp === 'fake') {
      if (aehnlicheFehler >= 2) {
        this.gelernteAktion.shopBlacklist = true;
        this.gelernteAktion.musterErkannt = `⛔ Shop "${this.empfohlenerShop}" verkauft Fälschungen - BLACKLIST`;
      }
      this.gelernteAktion.produktBlacklist = true;
    }
    
    // Tags setzen
    this.tags = [
      this.fehlerTyp,
      this.schwere,
      this.kategorie,
      this.empfohlenerShop.toLowerCase()
    ].filter(Boolean);
    
    // Status aktualisieren
    this.gelernt = true;
    this.status = 'gelernt';
    
    await this.save();
    
    // User Preferences aktualisieren (wenn User vorhanden)
    if (this.userId) {
      try {
        const UserPreferences = require('./UserPreferences');
        const prefs = await UserPreferences.getOrCreate(this.userId);
        await prefs.updateShopScore(
          this.empfohlenerShop, 
          this.gelernteAktion.shopScoreAenderung,
          'fehler'
        );
      } catch (error) {
        console.error('Preferences Update Fehler:', error.message);
      }
    }
    
    return this.gelernteAktion;
    
  } catch (error) {
    console.error('analysierenUndLernen Fehler:', error.message);
    throw error;
  }
};

// ==========================================
// STATIC METHODS
// ==========================================

/**
 * Neuen Fehler melden
 */
fehlerLogSchema.statics.fehlerMelden = async function(daten) {
  try {
    // Validierung
    if (!daten.suchanfrage || !daten.empfohlenesProdukt || !daten.empfohlenerShop || !daten.fehlerTyp) {
      throw new Error('Pflichtfelder fehlen');
    }
    
    // Fehler erstellen
    const fehler = new this({
      userId: daten.userId || null,
      sessionId: daten.sessionId || null,
      suchanfrage: daten.suchanfrage,
      kategorie: daten.kategorie,
      empfohlenesProdukt: daten.empfohlenesProdukt,
      empfohlenerShop: daten.empfohlenerShop,
      shopUrl: daten.shopUrl,
      fehlerTyp: daten.fehlerTyp,
      fehlerBeschreibung: daten.fehlerBeschreibung,
      userAgent: daten.userAgent,
      ipHash: daten.ipHash
    });
    
    await fehler.save();
    
    // Sofort analysieren
    await fehler.analysierenUndLernen();
    
    console.log(`📝 Fehler gemeldet: ${daten.fehlerTyp} bei ${daten.empfohlenerShop}`);
    
    return fehler;
    
  } catch (error) {
    console.error('fehlerMelden Fehler:', error.message);
    throw error;
  }
};

/**
 * Shop-Warnungen holen
 * 
 * @param {string} shopName - Shop Name
 * @returns {Object|null}
 */
fehlerLogSchema.statics.getShopWarnungen = async function(shopName) {
  try {
    // Fehler der letzten 90 Tage
    const seitDatum = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    const fehler = await this.aggregate([
      {
        $match: {
          empfohlenerShop: shopName,
          erstelltAm: { $gte: seitDatum }
        }
      },
      {
        $group: {
          _id: '$fehlerTyp',
          count: { $sum: 1 },
          letzter: { $max: '$erstelltAm' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    if (fehler.length === 0) {
      return null;
    }
    
    const gesamt = fehler.reduce((sum, f) => sum + f.count, 0);
    
    // Warnungen generieren
    const warnungen = [];
    
    for (const f of fehler) {
      const info = FEHLER_TYPEN[f._id];
      if (f.count >= 3) {
        warnungen.push({
          typ: f._id,
          name: info?.name || f._id,
          anzahl: f.count,
          schwere: info?.schwere || 'mittel'
        });
      }
    }
    
    return {
      shop: shopName,
      gesamtFehler: gesamt,
      warnungen,
      sollVermeiden: gesamt >= 10 || fehler.some(f => f._id === 'fake' && f.count >= 2),
      zusammenfassung: warnungen.length > 0
        ? `${gesamt} Beschwerden (${warnungen.map(w => w.name).join(', ')})`
        : null
    };
    
  } catch (error) {
    console.error('getShopWarnungen Fehler:', error.message);
    return null;
  }
};

/**
 * Muster für Kategorie erkennen
 * 
 * @param {string} kategorie - Kategorie
 * @returns {Array}
 */
fehlerLogSchema.statics.getMusterFuerKategorie = async function(kategorie) {
  try {
    const seitDatum = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    const muster = await this.aggregate([
      {
        $match: {
          kategorie: kategorie.toLowerCase(),
          erstelltAm: { $gte: seitDatum }
        }
      },
      {
        $group: {
          _id: {
            shop: '$empfohlenerShop',
            typ: '$fehlerTyp'
          },
          count: { $sum: 1 },
          beispiele: { 
            $push: { 
              produkt: '$empfohlenesProdukt.name',
              beschreibung: '$fehlerBeschreibung'
            }
          }
        }
      },
      {
        $match: {
          count: { $gte: 2 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);
    
    return muster.map(m => ({
      shop: m._id.shop,
      fehlerTyp: m._id.typ,
      anzahl: m.count,
      warnung: `${m._id.shop} hat ${m.count}x ${FEHLER_TYPEN[m._id.typ]?.name || m._id.typ} Probleme`,
      beispiele: m.beispiele.slice(0, 3)
    }));
    
  } catch (error) {
    console.error('getMusterFuerKategorie Fehler:', error.message);
    return [];
  }
};

/**
 * Shops mit Problemen für Empfehlungs-Filterung
 * 
 * @returns {Object} { vermeiden: [...], warnen: [...] }
 */
fehlerLogSchema.statics.getProblematischeShops = async function() {
  try {
    const seitDatum = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    const shops = await this.aggregate([
      {
        $match: {
          erstelltAm: { $gte: seitDatum }
        }
      },
      {
        $group: {
          _id: '$empfohlenerShop',
          gesamt: { $sum: 1 },
          fakes: {
            $sum: { $cond: [{ $eq: ['$fehlerTyp', 'fake'] }, 1, 0] }
          },
          schwer: {
            $sum: { $cond: [{ $eq: ['$schwere', 'schwer'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { gesamt: -1 }
      }
    ]);
    
    const vermeiden = [];
    const warnen = [];
    
    for (const shop of shops) {
      // Vermeiden: 10+ Fehler ODER 2+ Fakes
      if (shop.gesamt >= 10 || shop.fakes >= 2) {
        vermeiden.push(shop._id);
      }
      // Warnen: 5+ Fehler ODER 3+ schwere
      else if (shop.gesamt >= 5 || shop.schwer >= 3) {
        warnen.push(shop._id);
      }
    }
    
    return { vermeiden, warnen };
    
  } catch (error) {
    console.error('getProblematischeShops Fehler:', error.message);
    return { vermeiden: [], warnen: [] };
  }
};

/**
 * Statistiken für Dashboard
 */
fehlerLogSchema.statics.getStatistiken = async function() {
  try {
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    
    const gestern = new Date(heute);
    gestern.setDate(gestern.getDate() - 1);
    
    const letzteWoche = new Date(heute);
    letzteWoche.setDate(letzteWoche.getDate() - 7);
    
    const [gesamt, heuteCount, wocheCount, nachTyp] = await Promise.all([
      this.countDocuments(),
      this.countDocuments({ erstelltAm: { $gte: heute } }),
      this.countDocuments({ erstelltAm: { $gte: letzteWoche } }),
      this.aggregate([
        {
          $group: {
            _id: '$fehlerTyp',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ])
    ]);
    
    return {
      gesamt,
      heute: heuteCount,
      woche: wocheCount,
      nachTyp: nachTyp.map(t => ({
        typ: t._id,
        name: FEHLER_TYPEN[t._id]?.name || t._id,
        count: t.count
      })),
      topProbleme: nachTyp.slice(0, 3).map(t => FEHLER_TYPEN[t._id]?.name || t._id)
    };
    
  } catch (error) {
    console.error('getStatistiken Fehler:', error.message);
    return { gesamt: 0, heute: 0, woche: 0, nachTyp: [], topProbleme: [] };
  }
};

// ==========================================
// MODEL ERSTELLEN & EXPORTIEREN
// ==========================================

const FehlerLog = mongoose.model('FehlerLog', fehlerLogSchema);

// Fehler-Typen auch exportieren
FehlerLog.FEHLER_TYPEN = FEHLER_TYPEN;

module.exports = FehlerLog;