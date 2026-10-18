// ============================================
// SYNORA - Such-Cache
// ============================================
// Zwei Stufen mit unterschiedlicher Haltbarkeit:
//
//   produkte  - 30 Minuten. Preise bewegen sich in einer halben
//               Stunde kaum. Spart den SerpAPI-Aufruf.
//   bewertung - 24 Stunden. Welches Produkt zu welchem Zweck passt,
//               aendert sich nicht ueber Nacht. Spart den Modellaufruf.
//
// In der Datenbank statt im Speicher, damit der Cache ein Deployment
// ueberlebt und alle Instanzen denselben sehen.
// ============================================
'use strict';

const mongoose = require('mongoose');

const cacheSchema = new mongoose.Schema({
  schluessel: { type: String, required: true, index: true },
  typ: { type: String, required: true, enum: ['produkte', 'bewertung'] },

  daten: { type: mongoose.Schema.Types.Mixed, required: true },

  // Wofuer der Eintrag gilt - hilft beim Nachschauen in Compass
  begriff: { type: String, default: '' },
  budget: { type: Number, default: null },

  treffer: { type: Number, default: 0 },
  erstelltAm: { type: Date, default: Date.now },
  ablaufAm: { type: Date, required: true }
});

// Ein Eintrag pro Schluessel und Typ
cacheSchema.index({ schluessel: 1, typ: 1 }, { unique: true });

// expireAfterSeconds: 0 heisst: loeschen, sobald ablaufAm erreicht ist.
// So kann jeder Eintrag seine eigene Haltbarkeit haben.
cacheSchema.index({ ablaufAm: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.SuchCache
  || mongoose.model('SuchCache', cacheSchema);