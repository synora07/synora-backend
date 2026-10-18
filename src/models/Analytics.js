// ============================================
// SYNORA V2.0 - ANALYTICS MODEL
// Statistiken, Tracking, Metriken
// Für Dashboard und Optimierung
// ============================================

'use strict';

const mongoose = require('mongoose');

// ==========================================
// SCHEMA DEFINITION
// ==========================================

const analyticsSchema = new mongoose.Schema({
  
  // ==========================================
  // EVENT IDENTIFIKATION
  // ==========================================
  
  // Event-Typ
  eventTyp: {
    type: String,
    required: true,
    enum: [
      // Suche
      'suche',
      'suche_erfolgreich',
      'suche_fehlgeschlagen',
      
      // Empfehlungen
      'empfehlung_angezeigt',
      'empfehlung_geklickt',
      'empfehlung_gekauft',
      
      // User
      'user_registriert',
      'user_login',
      'user_logout',
      
      // Feedback
      'feedback_positiv',
      'feedback_negativ',
      'fehler_gemeldet',
      
      // KI
      'ki_anfrage_claude',
      'ki_anfrage_openai',
      'ki_anfrage_perplexity',
      'ki_consensus_erreicht',
      'ki_consensus_fehlgeschlagen',
      
      // System
      'api_fehler',
      'rate_limit',
      'session_start',
      'session_ende'
    ],
    index: true
  },
  
  // Event-Kategorie
  kategorie: {
    type: String,
    enum: ['suche', 'empfehlung', 'user', 'feedback', 'ki', 'system'],
    index: true
  },
  
  // ==========================================
  // REFERENZEN
  // ==========================================
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  
  sessionId: {
    type: String,
    index: true
  },
  
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatHistory',
    default: null
  },
  
  // ==========================================
  // EVENT DATEN
  // ==========================================
  
  // Suchanfrage (wenn relevant)
  suchanfrage: String,
  
  // Produkt-Kategorie
  produktKategorie: {
    type: String,
    lowercase: true
  },
  
  // Shop (wenn relevant)
  shop: String,
  
  // Produkt (wenn relevant)
  produkt: {
    name: String,
    preis: Number,
    synoraScore: Number
  },
  
  // ==========================================
  // METRIKEN
  // ==========================================
  
  // Dauer in Millisekunden
  dauer: {
    type: Number,
    default: 0
  },
  
  // Anzahl (z.B. Ergebnisse)
  anzahl: {
    type: Number,
    default: 1
  },
  
  // Wert (z.B. Preis, Score)
  wert: {
    type: Number,
    default: 0
  },
  
  // Erfolg?
  erfolg: {
    type: Boolean,
    default: true
  },
  
  // ==========================================
  // KI METRIKEN
  // ==========================================
  
  ki: {
    // Welche KI
    provider: {
      type: String,
      enum: ['claude', 'openai', 'perplexity', 'consensus', null]
    },
    
    // Tokens verbraucht
    tokensInput: Number,
    tokensOutput: Number,
    
    // Kosten (geschätzt)
    kosten: Number,
    
    // Antwortzeit
    antwortzeit: Number,
    
    // Model verwendet
    model: String
  },
  
  // ==========================================
  // CONSENSUS METRIKEN
  // ==========================================
  
  consensus: {
    // Wie viele KIs haben gestimmt?
    stimmen: {
      type: Number,
      min: 0,
      max: 3
    },
    
    // Welche haben zugestimmt?
    claude: Boolean,
    openai: Boolean,
    perplexity: Boolean,
    
    // Übereinstimmung (%)
    uebereinstimmung: Number
  },
  
  // ==========================================
  // FEHLER DETAILS
  // ==========================================
  
  fehler: {
    code: String,
    nachricht: String,
    stack: String
  },
  
  // ==========================================
  // METADATA
  // ==========================================
  
  // Zusätzliche Daten
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // User Agent
  userAgent: String,
  
  // IP (gehashed)
  ipHash: String,
  
  // Land
  land: {
    type: String,
    default: 'CH'
  },
  
  // Gerät
  geraet: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unbekannt'],
    default: 'unbekannt'
  },
  
  // ==========================================
  // TIMESTAMPS
  // ==========================================
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Datum (für Aggregation)
  datum: {
    type: String, // Format: YYYY-MM-DD
    index: true
  },
  
  // Stunde (für Aggregation)
  stunde: {
    type: Number,
    min: 0,
    max: 23
  }
  
}, {
  timestamps: false,
  toJSON: { virtuals: true }
});

// ==========================================
// INDEXES
// ==========================================

analyticsSchema.index({ eventTyp: 1, timestamp: -1 });
analyticsSchema.index({ kategorie: 1, datum: 1 });
analyticsSchema.index({ produktKategorie: 1, datum: 1 });
analyticsSchema.index({ shop: 1, datum: 1 });
analyticsSchema.index({ datum: 1, stunde: 1 });

// ==========================================
// PRE-SAVE MIDDLEWARE
// ==========================================

analyticsSchema.pre('save', function(next) {
  // Datum und Stunde automatisch setzen
  const date = this.timestamp || new Date();
  this.datum = date.toISOString().split('T')[0];
  this.stunde = date.getHours();
  
  // Kategorie automatisch setzen
  if (!this.kategorie) {
    if (this.eventTyp.startsWith('suche')) {
      this.kategorie = 'suche';
    } else if (this.eventTyp.startsWith('empfehlung')) {
      this.kategorie = 'empfehlung';
    } else if (this.eventTyp.startsWith('user')) {
      this.kategorie = 'user';
    } else if (this.eventTyp.startsWith('feedback') || this.eventTyp.startsWith('fehler')) {
      this.kategorie = 'feedback';
    } else if (this.eventTyp.startsWith('ki')) {
      this.kategorie = 'ki';
    } else {
      this.kategorie = 'system';
    }
  }
  
  next();
});

// ==========================================
// STATIC METHODS
// ==========================================

/**
 * Event tracken
 */
analyticsSchema.statics.track = async function(eventTyp, daten = {}) {
  try {
    const event = new this({
      eventTyp,
      ...daten,
      timestamp: new Date()
    });
    
    // Async speichern (nicht warten)
    event.save().catch(err => {
      console.error('Analytics Track Fehler:', err.message);
    });
    
    return event;
    
  } catch (error) {
    console.error('Analytics Track Fehler:', error.message);
    return null;
  }
};

/**
 * Suche tracken
 */
analyticsSchema.statics.trackSuche = async function(daten) {
  return this.track('suche', {
    suchanfrage: daten.query,
    produktKategorie: daten.kategorie,
    userId: daten.userId,
    sessionId: daten.sessionId,
    dauer: daten.dauer,
    anzahl: daten.ergebnisse,
    erfolg: daten.erfolg !== false
  });
};

/**
 * KI-Anfrage tracken
 */
analyticsSchema.statics.trackKI = async function(provider, daten) {
  return this.track(`ki_anfrage_${provider}`, {
    userId: daten.userId,
    sessionId: daten.sessionId,
    suchanfrage: daten.query,
    ki: {
      provider,
      tokensInput: daten.tokensInput,
      tokensOutput: daten.tokensOutput,
      kosten: daten.kosten,
      antwortzeit: daten.antwortzeit,
      model: daten.model
    },
    erfolg: daten.erfolg !== false,
    fehler: daten.fehler ? {
      code: daten.fehler.code,
      nachricht: daten.fehler.message
    } : null
  });
};

/**
 * Consensus tracken
 */
analyticsSchema.statics.trackConsensus = async function(daten) {
  const erfolg = daten.stimmen >= 2;
  
  return this.track(erfolg ? 'ki_consensus_erreicht' : 'ki_consensus_fehlgeschlagen', {
    userId: daten.userId,
    sessionId: daten.sessionId,
    suchanfrage: daten.query,
    consensus: {
      stimmen: daten.stimmen,
      claude: daten.claude,
      openai: daten.openai,
      perplexity: daten.perplexity,
      uebereinstimmung: daten.uebereinstimmung
    },
    erfolg
  });
};

/**
 * Empfehlung geklickt tracken
 */
analyticsSchema.statics.trackKlick = async function(daten) {
  return this.track('empfehlung_geklickt', {
    userId: daten.userId,
    sessionId: daten.sessionId,
    chatId: daten.chatId,
    shop: daten.shop,
    produkt: {
      name: daten.produktName,
      preis: daten.preis,
      synoraScore: daten.score
    },
    produktKategorie: daten.kategorie
  });
};

/**
 * Tages-Statistiken
 */
analyticsSchema.statics.getTagesStatistik = async function(datum = null) {
  try {
    const targetDatum = datum || new Date().toISOString().split('T')[0];
    
    const stats = await this.aggregate([
      {
        $match: { datum: targetDatum }
      },
      {
        $group: {
          _id: '$eventTyp',
          count: { $sum: 1 },
          erfolg: { $sum: { $cond: ['$erfolg', 1, 0] } },
          durchschnittDauer: { $avg: '$dauer' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // Gesamtzahlen berechnen
    const suchen = stats.find(s => s._id === 'suche')?.count || 0;
    const klicks = stats.find(s => s._id === 'empfehlung_geklickt')?.count || 0;
    const kaeufe = stats.find(s => s._id === 'empfehlung_gekauft')?.count || 0;
    const fehler = stats.filter(s => s._id.includes('fehler')).reduce((sum, s) => sum + s.count, 0);
    
    return {
      datum: targetDatum,
      events: stats,
      zusammenfassung: {
        suchen,
        klicks,
        kaeufe,
        fehler,
        konversionsrate: suchen > 0 ? ((klicks / suchen) * 100).toFixed(2) : 0,
        kaufrate: klicks > 0 ? ((kaeufe / klicks) * 100).toFixed(2) : 0
      }
    };
    
  } catch (error) {
    console.error('getTagesStatistik Fehler:', error.message);
    return null;
  }
};

/**
 * Wochen-Trend
 */
analyticsSchema.statics.getWochenTrend = async function() {
  try {
    const vor7Tagen = new Date();
    vor7Tagen.setDate(vor7Tagen.getDate() - 7);
    
    const trend = await this.aggregate([
      {
        $match: {
          timestamp: { $gte: vor7Tagen }
        }
      },
      {
        $group: {
          _id: {
            datum: '$datum',
            kategorie: '$kategorie'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.datum',
          kategorien: {
            $push: {
              kategorie: '$_id.kategorie',
              count: '$count'
            }
          },
          gesamt: { $sum: '$count' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    return trend;
    
  } catch (error) {
    console.error('getWochenTrend Fehler:', error.message);
    return [];
  }
};

/**
 * Top Kategorien
 */
analyticsSchema.statics.getTopKategorien = async function(tage = 30, limit = 10) {
  try {
    const seitDatum = new Date();
    seitDatum.setDate(seitDatum.getDate() - tage);
    
    const kategorien = await this.aggregate([
      {
        $match: {
          eventTyp: 'suche',
          produktKategorie: { $exists: true, $ne: null },
          timestamp: { $gte: seitDatum }
        }
      },
      {
        $group: {
          _id: '$produktKategorie',
          suchen: { $sum: 1 }
        }
      },
      {
        $sort: { suchen: -1 }
      },
      {
        $limit: limit
      }
    ]);
    
    return kategorien.map(k => ({
      kategorie: k._id,
      suchen: k.suchen
    }));
    
  } catch (error) {
    console.error('getTopKategorien Fehler:', error.message);
    return [];
  }
};

/**
 * Top Shops (nach Klicks)
 */
analyticsSchema.statics.getTopShops = async function(tage = 30, limit = 10) {
  try {
    const seitDatum = new Date();
    seitDatum.setDate(seitDatum.getDate() - tage);
    
    const shops = await this.aggregate([
      {
        $match: {
          eventTyp: 'empfehlung_geklickt',
          shop: { $exists: true, $ne: null },
          timestamp: { $gte: seitDatum }
        }
      },
      {
        $group: {
          _id: '$shop',
          klicks: { $sum: 1 }
        }
      },
      {
        $sort: { klicks: -1 }
      },
      {
        $limit: limit
      }
    ]);
    
    return shops.map(s => ({
      shop: s._id,
      klicks: s.klicks
    }));
    
  } catch (error) {
    console.error('getTopShops Fehler:', error.message);
    return [];
  }
};

/**
 * KI Kosten
 */
analyticsSchema.statics.getKIKosten = async function(tage = 30) {
  try {
    const seitDatum = new Date();
    seitDatum.setDate(seitDatum.getDate() - tage);
    
    const kosten = await this.aggregate([
      {
        $match: {
          kategorie: 'ki',
          timestamp: { $gte: seitDatum }
        }
      },
      {
        $group: {
          _id: '$ki.provider',
          anfragen: { $sum: 1 },
          tokens: { $sum: { $add: ['$ki.tokensInput', '$ki.tokensOutput'] } },
          kosten: { $sum: '$ki.kosten' },
          durchschnittAntwortzeit: { $avg: '$ki.antwortzeit' }
        }
      },
      {
        $sort: { kosten: -1 }
      }
    ]);
    
    const gesamt = kosten.reduce((sum, k) => sum + (k.kosten || 0), 0);
    
    return {
      nachProvider: kosten,
      gesamt,
      zeitraum: `${tage} Tage`
    };
    
  } catch (error) {
    console.error('getKIKosten Fehler:', error.message);
    return { nachProvider: [], gesamt: 0, zeitraum: `${tage} Tage` };
  }
};

/**
 * Dashboard Übersicht
 */
analyticsSchema.statics.getDashboard = async function() {
  try {
    const heute = new Date().toISOString().split('T')[0];
    const [tagesStats, wochenTrend, topKategorien, topShops, kiKosten] = await Promise.all([
      this.getTagesStatistik(heute),
      this.getWochenTrend(),
      this.getTopKategorien(7, 5),
      this.getTopShops(7, 5),
      this.getKIKosten(7)
    ]);
    
    return {
      heute: tagesStats,
      wochenTrend,
      topKategorien,
      topShops,
      kiKosten,
      generiert: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('getDashboard Fehler:', error.message);
    return null;
  }
};

// ==========================================
// MODEL ERSTELLEN & EXPORTIEREN
// ==========================================

const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics;