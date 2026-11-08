// ============================================
// SYNORA - Unterhaltung
// ============================================
// Ein Eintrag pro Gespraech, nicht pro Suche. Das Suchprotokoll
// (models/SuchProtokoll.js) bleibt daneben bestehen - das ist das
// technische Logbuch fuer Auswertungen und loescht sich nach 180
// Tagen. Hier liegt, was der Nutzer sieht, und das bleibt.
//
// In "daten" steht die komplette Antwort des Servers, unveraendert.
// Dadurch laesst sich ein Gespraech spaeter abspielen statt
// nachbauen - mit Bildern, Begruendungen und Shop-Links.
// ============================================

'use strict';

const mongoose = require('mongoose');

const NachrichtSchema = new mongoose.Schema(
  {
    wer: { type: String, enum: ['nutzer', 'synora'], required: true },
    text: { type: String, default: '' },
    zeit: { type: Date, default: Date.now },
    daten: mongoose.Schema.Types.Mixed   // nur bei 'synora'
  },
  { _id: false }
);

const UnterhaltungSchema = new mongoose.Schema({
  nutzerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  titel: { type: String, default: '' },     // die erste Frage, gekuerzt
  erstellt: { type: Date, default: Date.now },
  zuletzt: { type: Date, default: Date.now },
  nachrichten: { type: [NachrichtSchema], default: [] }
});

// Fuer die Seitenleiste: die eigenen Gespraeche, neueste zuerst
UnterhaltungSchema.index({ nutzerId: 1, zuletzt: -1 });

// ABSICHTLICH OHNE TTL: Das hier gehoert dem Nutzer. Es verschwindet,
// wenn er es loescht - nicht nach 180 Tagen von selbst.

module.exports =
  mongoose.models.Unterhaltung || mongoose.model('Unterhaltung', UnterhaltungSchema);
