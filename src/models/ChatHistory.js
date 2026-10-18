// ============================================
// SYNORA V2.0 - CHAT HISTORY MODEL
// Speichert Gespräche und Empfehlungen
// Für Dialog-System (24h/7d Nachfragen)
// ============================================

'use strict';

const mongoose = require('mongoose');

// ==========================================
// SUB-SCHEMAS
// ==========================================

// Einzelne Nachricht
const messageSchema = new mongoose.Schema({
  // Wer hat geschrieben?
  rolle: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  
  // Inhalt
  inhalt: {
    type: String,
    required: true,
    maxlength: 10000
  },
  
  // Zeitstempel
  timestamp: {
    type: Date,
    default: Date.now
  },
  
  // Typ der Nachricht
  typ: {
    type: String,
    enum: ['text', 'empfehlung', 'frage', 'feedback', 'system'],
    default: 'text'
  },
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { _id: false });

// Empfohlenes Produkt
const empfehlungSchema = new mongoose.Schema({
  // Produkt-Daten
  produktName: {
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
  
  // Shop
  shopName: {
    type: String,
    required: true
  },
  shopUrl: String,
  
  // SYNORA Score
  synoraScore: {
    type: Number,
    min: 0,
    max: 100
  },
  
  // Ranking Position
  position: {
    type: Number,
    min: 1
  },
  
  // Warum empfohlen?
  gruende: [String],
  
  // KI-Votes
  kiVotes: {
    claude: { type: Boolean, default: false },
    chatgpt: { type: Boolean, default: false },
    perplexity: { type: Boolean, default: false }
  },
  
  // Consensus erreicht?
  consensus: {
    type: Boolean,
    default: false
  },
  
  // User-Aktion
  userAktion: {
    type: String,
    enum: ['keine', 'geklickt', 'gekauft', 'abgelehnt', 'gemeldet'],
    default: 'keine'
  },
  
  aktionTimestamp: Date
  
}, { _id: true });

// ==========================================
// HAUPT-SCHEMA
// ==========================================

const chatHistorySchema = new mongoose.Schema({
  
  // ==========================================
  // REFERENZEN
  // ==========================================
  
  // User (null für Gäste)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  
  // Session ID für Gäste
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  
  // ==========================================
  // KONVERSATION
  // ==========================================
  
  // Alle Nachrichten
  nachrichten: [messageSchema],
  
  // Titel (automatisch generiert)
  titel: {
    type: String,
    default: 'Neue Konversation'
  },
  
  // Zusammenfassung
  zusammenfassung: String,
  
  // ==========================================
  // SUCHANFRAGE & EMPFEHLUNGEN
  // ==========================================
  
  // Original-Suchanfrage
  suchanfrage: String,
  
  // Kategorie
  kategorie: {
    type: String,
    lowercase: true
  },
  
  // Alle Empfehlungen
  empfehlungen: [empfehlungSchema],
  
  // ==========================================
  // DIALOG-SYSTEM
  // ==========================================
  
  // Status der Nachfragen
  dialogStatus: {
    // "Hast du bestellt?" - 24h nach Empfehlung
    bestellfrageGesendet: {
      type: Boolean,
      default: false
    },
    bestellfrageTimestamp: Date,
    bestellfrageAntwort: {
      type: String,
      enum: ['ja', 'nein', 'spaeter', 'keine'],
      default: 'keine'
    },
    
    // "Bist du zufrieden?" - 7d nach Bestellung
    zufriedenheitsfrageGesendet: {
      type: Boolean,
      default: false
    },
    zufriedenheitsfrageTimestamp: Date,
    zufriedenheitsfrageAntwort: {
      type: String,
      enum: ['zufrieden', 'neutral', 'unzufrieden', 'keine'],
      default: 'keine'
    },
    
    // Feedback Details
    feedbackDetails: String
  },
  
  // ==========================================
  // TRACKING
  // ==========================================
  
  // Welches Produkt wurde ausgewählt?
  ausgewaehltesProdukt: {
    produktIndex: Number,
    timestamp: Date
  },
  
  // Wurde bestellt?
  wurdeGekauft: {
    type: Boolean,
    default: false
  },
  kaufTimestamp: Date,
  kaufBestaetigt: {
    type: Boolean,
    default: false
  },
  
  // ==========================================
  // STATUS
  // ==========================================
  
  status: {
    type: String,
    enum: ['aktiv', 'abgeschlossen', 'archiviert'],
    default: 'aktiv'
  },
  
  // Ist Konversation abgeschlossen?
  istAbgeschlossen: {
    type: Boolean,
    default: false
  },
  
  // ==========================================
  // METADATA
  // ==========================================
  
  // Anzahl Nachrichten
  nachrichtenCount: {
    type: Number,
    default: 0
  },
  
  // Sprache
  sprache: {
    type: String,
    default: 'de'
  },
  
  // User Agent
  userAgent: String,
  
  // Timestamps
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

chatHistorySchema.index({ userId: 1, erstelltAm: -1 });
chatHistorySchema.index({ sessionId: 1, erstelltAm: -1 });
chatHistorySchema.index({ status: 1, letzteAktivitaet: -1 });
chatHistorySchema.index({ 'dialogStatus.bestellfrageGesendet': 1 });
chatHistorySchema.index({ 'dialogStatus.zufriedenheitsfrageGesendet': 1 });
chatHistorySchema.index({ kategorie: 1 });

// ==========================================
// VIRTUALS
// ==========================================

// Hat Empfehlungen?
chatHistorySchema.virtual('hatEmpfehlungen').get(function() {
  return this.empfehlungen && this.empfehlungen.length > 0;
});

// Alter in Stunden
chatHistorySchema.virtual('alterInStunden').get(function() {
  return Math.floor((Date.now() - this.erstelltAm.getTime()) / (1000 * 60 * 60));
});

// Sollte Bestellfrage stellen? (24h nach Empfehlung, noch nicht gefragt)
chatHistorySchema.virtual('sollBestellfrageStellen').get(function() {
  if (!this.hatEmpfehlungen) return false;
  if (this.dialogStatus.bestellfrageGesendet) return false;
  if (this.wurdeGekauft) return false;
  
  const stunden = this.alterInStunden;
  return stunden >= 24 && stunden < 72; // 24-72h nach Empfehlung
});

// Sollte Zufriedenheitsfrage stellen? (7d nach Kauf)
chatHistorySchema.virtual('sollZufriedenheitsfrageStellen').get(function() {
  if (!this.kaufBestaetigt) return false;
  if (this.dialogStatus.zufriedenheitsfrageGesendet) return false;
  
  if (!this.kaufTimestamp) return false;
  
  const tage = Math.floor((Date.now() - this.kaufTimestamp.getTime()) / (1000 * 60 * 60 * 24));
  return tage >= 7 && tage < 14; // 7-14 Tage nach Kauf
});

// ==========================================
// PRE-SAVE MIDDLEWARE
// ==========================================

chatHistorySchema.pre('save', function(next) {
  this.aktualisiertAm = new Date();
  this.nachrichtenCount = this.nachrichten.length;
  
  // Titel automatisch generieren
  if (this.suchanfrage && this.titel === 'Neue Konversation') {
    this.titel = this.suchanfrage.substring(0, 50);
    if (this.suchanfrage.length > 50) {
      this.titel += '...';
    }
  }
  
  next();
});

// ==========================================
// INSTANCE METHODS
// ==========================================

/**
 * Nachricht hinzufügen
 */
chatHistorySchema.methods.addNachricht = async function(rolle, inhalt, typ = 'text', metadata = {}) {
  try {
    this.nachrichten.push({
      rolle,
      inhalt,
      typ,
      timestamp: new Date(),
      metadata
    });
    
    this.letzteAktivitaet = new Date();
    
    // Bei User-Nachricht: Suchanfrage setzen (erste)
    if (rolle === 'user' && !this.suchanfrage) {
      this.suchanfrage = inhalt;
    }
    
    await this.save();
    return this.nachrichten[this.nachrichten.length - 1];
    
  } catch (error) {
    console.error('addNachricht Fehler:', error.message);
    throw error;
  }
};

/**
 * Empfehlungen setzen
 */
chatHistorySchema.methods.setEmpfehlungen = async function(empfehlungen, kategorie = null) {
  try {
    this.empfehlungen = empfehlungen.map((e, index) => ({
      produktName: e.name || e.produktName,
      preis: e.preis || e.price,
      waehrung: e.waehrung || 'CHF',
      produktUrl: e.url || e.produktUrl || e.link,
      bildUrl: e.bild || e.bildUrl || e.thumbnail,
      shopName: e.shop || e.shopName,
      shopUrl: e.shopUrl,
      synoraScore: e.synoraScore || e.score,
      position: index + 1,
      gruende: e.gruende || e.reasons || [],
      kiVotes: e.kiVotes || {},
      consensus: e.consensus || false,
      userAktion: 'keine'
    }));
    
    if (kategorie) {
      this.kategorie = kategorie.toLowerCase();
    }
    
    await this.save();
    return this.empfehlungen;
    
  } catch (error) {
    console.error('setEmpfehlungen Fehler:', error.message);
    throw error;
  }
};

/**
 * Produkt-Klick registrieren
 */
chatHistorySchema.methods.produktGeklickt = async function(produktIndex) {
  try {
    if (this.empfehlungen[produktIndex]) {
      this.empfehlungen[produktIndex].userAktion = 'geklickt';
      this.empfehlungen[produktIndex].aktionTimestamp = new Date();
      
      this.ausgewaehltesProdukt = {
        produktIndex,
        timestamp: new Date()
      };
      
      await this.save();
    }
  } catch (error) {
    console.error('produktGeklickt Fehler:', error.message);
  }
};

/**
 * Kauf registrieren
 */
chatHistorySchema.methods.kaufRegistrieren = async function(produktIndex = null) {
  try {
    this.wurdeGekauft = true;
    this.kaufTimestamp = new Date();
    
    if (produktIndex !== null && this.empfehlungen[produktIndex]) {
      this.empfehlungen[produktIndex].userAktion = 'gekauft';
      this.empfehlungen[produktIndex].aktionTimestamp = new Date();
    }
    
    await this.save();
    
  } catch (error) {
    console.error('kaufRegistrieren Fehler:', error.message);
  }
};

/**
 * Kauf bestätigen (für Personalisierung)
 */
chatHistorySchema.methods.kaufBestaetigen = async function() {
  try {
    this.kaufBestaetigt = true;
    
    // Dialog-Status aktualisieren
    this.dialogStatus.bestellfrageAntwort = 'ja';
    
    await this.save();
    
    // User-Bestellung zählen (für Personalisierung)
    if (this.userId) {
      try {
        const User = require('./User');
        const user = await User.findById(this.userId);
        if (user) {
          await user.bestellungBestaetigen();
        }
      } catch (error) {
        console.error('User Bestellung Update Fehler:', error.message);
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('kaufBestaetigen Fehler:', error.message);
    throw error;
  }
};

/**
 * Bestellfrage als gesendet markieren
 */
chatHistorySchema.methods.bestellfrageGesendet = async function() {
  try {
    this.dialogStatus.bestellfrageGesendet = true;
    this.dialogStatus.bestellfrageTimestamp = new Date();
    
    await this.addNachricht(
      'assistant',
      'Hast du eines der empfohlenen Produkte bestellt? 🛒',
      'frage',
      { frageTyp: 'bestellfrage' }
    );
    
    await this.save();
    
  } catch (error) {
    console.error('bestellfrageGesendet Fehler:', error.message);
  }
};

/**
 * Zufriedenheitsfrage als gesendet markieren
 */
chatHistorySchema.methods.zufriedenheitsfrageGesendet = async function() {
  try {
    this.dialogStatus.zufriedenheitsfrageGesendet = true;
    this.dialogStatus.zufriedenheitsfrageTimestamp = new Date();
    
    await this.addNachricht(
      'assistant',
      'Bist du mit deinem Kauf zufrieden? Dein Feedback hilft mir, besser zu werden! 😊',
      'frage',
      { frageTyp: 'zufriedenheitsfrage' }
    );
    
    await this.save();
    
  } catch (error) {
    console.error('zufriedenheitsfrageGesendet Fehler:', error.message);
  }
};

/**
 * Feedback verarbeiten
 */
chatHistorySchema.methods.feedbackVerarbeiten = async function(typ, antwort, details = null) {
  try {
    if (typ === 'bestellung') {
      this.dialogStatus.bestellfrageAntwort = antwort;
      
      if (antwort === 'ja') {
        this.wurdeGekauft = true;
        this.kaufTimestamp = new Date();
        this.kaufBestaetigt = true;
        
        // User-Bestellung zählen
        if (this.userId) {
          const User = require('./User');
          const user = await User.findById(this.userId);
          if (user) {
            await user.bestellungBestaetigen();
          }
        }
      }
      
    } else if (typ === 'zufriedenheit') {
      this.dialogStatus.zufriedenheitsfrageAntwort = antwort;
      this.dialogStatus.feedbackDetails = details;
      
      // Bei Unzufriedenheit: Fehler-System informieren
      if (antwort === 'unzufrieden' && details) {
        try {
          const FehlerLog = require('./FehlerLog');
          const ausgewaehltes = this.ausgewaehltesProdukt;
          
          if (ausgewaehltes && this.empfehlungen[ausgewaehltes.produktIndex]) {
            const produkt = this.empfehlungen[ausgewaehltes.produktIndex];
            
            await FehlerLog.fehlerMelden({
              userId: this.userId,
              sessionId: this.sessionId,
              suchanfrage: this.suchanfrage,
              kategorie: this.kategorie,
              empfohlenesProdukt: {
                name: produkt.produktName,
                preis: produkt.preis,
                produktUrl: produkt.produktUrl,
                synoraScore: produkt.synoraScore
              },
              empfohlenerShop: produkt.shopName,
              fehlerTyp: 'sonstiges', // User kann spezifizieren
              fehlerBeschreibung: details
            });
          }
        } catch (error) {
          console.error('Fehler-Meldung Fehler:', error.message);
        }
      }
    }
    
    await this.save();
    
  } catch (error) {
    console.error('feedbackVerarbeiten Fehler:', error.message);
    throw error;
  }
};

// ==========================================
// STATIC METHODS
// ==========================================

/**
 * Neue Konversation erstellen
 */
chatHistorySchema.statics.neueKonversation = async function(sessionId, userId = null) {
  try {
    const chat = new this({
      sessionId,
      userId,
      nachrichten: [],
      status: 'aktiv'
    });
    
    await chat.save();
    return chat;
    
  } catch (error) {
    console.error('neueKonversation Fehler:', error.message);
    throw error;
  }
};

/**
 * Aktive Konversation für Session finden
 */
chatHistorySchema.statics.getAktive = async function(sessionId, userId = null) {
  try {
    const query = { sessionId, status: 'aktiv' };
    
    if (userId) {
      query.userId = userId;
    }
    
    // Letzte aktive Konversation (max 24h alt)
    const seitDatum = new Date(Date.now() - 24 * 60 * 60 * 1000);
    query.letzteAktivitaet = { $gte: seitDatum };
    
    return await this.findOne(query).sort({ letzteAktivitaet: -1 });
    
  } catch (error) {
    console.error('getAktive Fehler:', error.message);
    return null;
  }
};

/**
 * Konversationen für Dialog-System (Nachfragen)
 */
chatHistorySchema.statics.getZuNachfragen = async function() {
  try {
    const jetzt = new Date();
    
    // Bestellfrage: 24-72h nach Empfehlung, noch nicht gefragt
    const bestellfrageKandidaten = await this.find({
      'empfehlungen.0': { $exists: true },
      'dialogStatus.bestellfrageGesendet': false,
      wurdeGekauft: false,
      erstelltAm: {
        $gte: new Date(jetzt - 72 * 60 * 60 * 1000),
        $lte: new Date(jetzt - 24 * 60 * 60 * 1000)
      }
    }).limit(50);
    
    // Zufriedenheitsfrage: 7-14d nach bestätigtem Kauf
    const zufriedenheitsKandidaten = await this.find({
      kaufBestaetigt: true,
      'dialogStatus.zufriedenheitsfrageGesendet': false,
      kaufTimestamp: {
        $gte: new Date(jetzt - 14 * 24 * 60 * 60 * 1000),
        $lte: new Date(jetzt - 7 * 24 * 60 * 60 * 1000)
      }
    }).limit(50);
    
    return {
      bestellfragen: bestellfrageKandidaten,
      zufriedenheitsfragen: zufriedenheitsKandidaten
    };
    
  } catch (error) {
    console.error('getZuNachfragen Fehler:', error.message);
    return { bestellfragen: [], zufriedenheitsfragen: [] };
  }
};

/**
 * Historie für User
 */
chatHistorySchema.statics.getHistorie = async function(userId, limit = 20) {
  try {
    return await this.find({ userId })
      .sort({ erstelltAm: -1 })
      .limit(limit)
      .select('titel suchanfrage kategorie erstelltAm hatEmpfehlungen wurdeGekauft');
      
  } catch (error) {
    console.error('getHistorie Fehler:', error.message);
    return [];
  }
};

// ==========================================
// MODEL ERSTELLEN & EXPORTIEREN
// ==========================================

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

module.exports = ChatHistory;