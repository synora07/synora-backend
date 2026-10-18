// ============================================
// SYNORA - Stufe 7: Mitschrieb
// ============================================
// Jede Suche wird vollstaendig protokolliert. Das ist die Grundlage
// fuer drei Dinge:
//
//   1. Nachvollziehen, warum SYNORA etwas empfohlen hat. Ohne das
//      raetst du bei jeder Beschwerde.
//   2. Sehen, ob die drei Modelle sich einig waren - der Kern von
//      Stufe 4 und 5.
//   3. Der monatliche Trendbericht: wonach gesucht wird, welche
//      Budgets, was gesucht und nicht gekauft wird.
//
// Die Eintraege loeschen sich nach 180 Tagen von selbst. Fuer den
// Trendbericht werden vorher monatliche Zusammenfassungen gebildet -
// der Bericht braucht keine Einzelsuchen.
// ============================================

'use strict';

const mongoose = require('mongoose');

const BewertungSchema = new mongoose.Schema(
  {
    modell: String,           // z.B. "claude-haiku", "gpt-mini", "sonar"
    rangliste: [String],      // Produkt-IDs in der Reihenfolge des Modells
    gruende: mongoose.Schema.Types.Mixed,
    kosten: Number,
    dauerMs: Number,
    fehler: String            // falls das Modell nicht geantwortet hat
  },
  { _id: false }
);

const KandidatSchema = new mongoose.Schema(
  {
    id: String,
    titel: String,
    preis: Number,
    shop: String,
    shopStufe: Number,        // 1 = guter Schweizer Shop ... 6 = unbekannt
    land: String
  },
  { _id: false }
);

const SuchProtokollSchema = new mongoose.Schema({
  sucheId: { type: String, index: true },
  // Kein "index: true" hier - der TTL-Index weiter unten deckt das ab.
  // Beides zusammen gibt eine Mongoose-Warnung und kann das
  // automatische Loeschen nach 180 Tagen verhindern.
  zeit: { type: Date, default: Date.now },

  // Wer hat gesucht - keine Namen, nur die Art
  nutzerTyp: { type: String, enum: ['gast', 'konto', 'premium'], default: 'gast' },
  nutzerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // ---------- Was gefragt wurde ----------
  anfrage: {
    roh: String,              // genau wie getippt
    vollstaendig: String,     // mit Antwort auf die Rueckfrage
    begriff: String,          // was an Google ging
    budget: Number,
    kategorie: String
  },

  // ---------- Rueckfrage ----------
  rueckfrage: {
    gestellt: { type: Boolean, default: false },
    frage: String,
    antwort: String
  },

  // ---------- Was gefunden wurde ----------
  treffer: {
    gesamt: Number,
    nachFilter: Number,
    ueberBudget: Number,
    aussortiert: Number,      // Einzelteile, Zubehoer
    schweizer: Number,
    ausland: Number
  },

  kandidaten: [KandidatSchema],

  // ---------- Stufe 4: die Modelle, jedes fuer sich ----------
  bewertungen: [BewertungSchema],

  // ---------- Faktenpruefung: was entfernt wurde ----------
  // Die wichtigste Zahl fuer dich: wie oft erfindet das Modell etwas?
  gestrichen: [
    {
      _id: false,
      produkt: String,
      grund: String,
      satz: String
    }
  ],

  // ---------- Stufe 5: Konsens ----------
  konsens: {
    einstimmigTop1: Boolean,
    runden: Number,
    uneinigkeit: [String]     // wo die Modelle auseinanderlagen
  },

  // ---------- Was der Nutzer gesehen hat ----------
  ergebnis: [
    {
      _id: false,
      id: String,
      titel: String,
      preis: Number,
      shop: String,
      score: Number
    }
  ],

  // ---------- Technisches ----------
  ausCache: {
    produkte: Boolean,
    bewertung: Boolean
  },
  dauerMs: Number,
  kostenUsd: Number,
  regelStand: String,         // Fingerabdruck der Prompt-Regeln
  fehler: String
});

// Nach 180 Tagen loeschen sich Eintraege selbst
SuchProtokollSchema.index({ zeit: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

// Fuer den Trendbericht: schnell nach Kategorie und Monat filtern
SuchProtokollSchema.index({ 'anfrage.kategorie': 1, zeit: -1 });

module.exports =
  mongoose.models.SuchProtokoll || mongoose.model('SuchProtokoll', SuchProtokollSchema);