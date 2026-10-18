// ============================================
// SYNORA - Produktwissen (Stufe 2, breit)
// ============================================
// Das Datenmodell. NICHT verwechseln mit services/wissenService.js,
// der das Wissen sammelt. Diese Datei beschreibt nur, wie es in der
// Datenbank abgelegt wird.
//
// DER KNIFF: Eigenschaften aendern sich nicht. Ein Kopfhoerer hat
// in drei Monaten dieselbe Bauform. Nur der Preis aendert sich.
// Darum wird jedes Produkt EINMAL nachgeschlagen und dauerhaft
// gespeichert. Der naechste Nutzer bekommt es gratis, und die
// Datenbank waechst mit - wie das Shop-Register.
// ============================================

'use strict';

const mongoose = require('mongoose');

const QuelleSchema = new mongoose.Schema(
  {
    name: String,
    geholt: Date,
    erfolg: Boolean,
    hinweis: String
  },
  { _id: false }
);

const ProduktwissenSchema = new mongoose.Schema({
  // Schluessel: normalisierter Produktname. Derselbe Kopfhoerer
  // heisst bei jedem Shop leicht anders, darum normalisiert.
  schluessel: { type: String, unique: true, index: true },
  anzeigeName: String,
  marke: String,
  kategorie: String,

  // Jedes Feld traegt seine Quelle mit. Ohne Quelle keine Aussage.
  eigenschaften: [
    {
      _id: false,
      merkmal: String,
      wert: String,
      quelle: String,
      sicher: Boolean
    }
  ],

  bewertungen: [
    {
      _id: false,
      quelle: String,
      anzahl: Number,
      schnitt: Number,
      stand: Date
    }
  ],

  // Das Herzstueck fuer echte Nachteile
  maengel: [
    {
      _id: false,
      was: String,
      wieOft: String,
      quelle: String
    }
  ],

  // Schutz vor Faelschungen: was andere Shops verlangen
  preisSpanne: {
    min: Number,
    mittel: Number,
    max: Number,
    anzahl: Number
  },

  haltbarkeit: {
    hinweis: String,
    quelle: String
  },

  quellen: [QuelleSchema],
  aktualisiert: { type: Date, default: Date.now },
  gesehen: { type: Number, default: 1 }
});

ProduktwissenSchema.index({ aktualisiert: 1 });
ProduktwissenSchema.index({ kategorie: 1, gesehen: -1 });

module.exports =
  mongoose.models.Produktwissen || mongoose.model('Produktwissen', ProduktwissenSchema);