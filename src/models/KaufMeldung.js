// ============================================
// SYNORA - gemeldeter Kauf
// ============================================
// Fuer deine Aktion: Die ersten 1000 Nutzer, die ueber SYNORA
// fuer mehr als CHF 300 kaufen, bekommen ein Jahr Premium.
//
// WARUM DER NUTZER DAS SELBST MELDET
// SYNORA weiss nicht, ob jemand gekauft hat. Die Rueckmeldung
// vom Affiliate-Programm kommt Wochen spaeter, und eine
// Zulassung gibt es noch nicht. Also meldet der Nutzer, und du
// prueefst von Hand.
//
// MISSBRAUCH
// Jemand kann falsche Angaben machen. Darum:
//   - je Bestellnummer und Shop nur EINE Meldung (Index unten)
//   - Pruefung von Hand, bevor Premium freigeschaltet wird
//   - die Bestellnummer bleibt gespeichert, damit du sie
//     spaeter gegen den Affiliate-Bericht halten kannst
// ============================================
'use strict';

const mongoose = require('mongoose');

const ZUSTAENDE = ['offen', 'bestaetigt', 'abgelehnt'];

const kaufMeldungSchema = new mongoose.Schema({
  nutzer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  shop: { type: String, required: true, trim: true, maxlength: 80 },
  betrag: { type: Number, required: true, min: 0 },
  bestellnummer: { type: String, required: true, trim: true, maxlength: 60 },
  datum: { type: Date, required: true },

  zustand: { type: String, enum: ZUSTAENDE, default: 'offen', index: true },
  notiz: { type: String, default: '', maxlength: 500 },

  erstelltAm: { type: Date, default: Date.now },
  geprueftAm: { type: Date, default: null },

  // Wurde Premium dafuer schon vergeben? Verhindert, dass
  // dieselbe Meldung zweimal belohnt wird.
  praemieVergeben: { type: Boolean, default: false }
});

// Dieselbe Bestellnummer beim selben Shop nur einmal. Ohne das
// koennte jemand eine echte Bestellung zehnmal melden.
kaufMeldungSchema.index({ shop: 1, bestellnummer: 1 }, { unique: true });

// Fuer deine Liste im Dashboard: offene zuerst, neueste oben.
kaufMeldungSchema.index({ zustand: 1, erstelltAm: -1 });

module.exports = mongoose.models.KaufMeldung || mongoose.model('KaufMeldung', kaufMeldungSchema);
module.exports.ZUSTAENDE = ZUSTAENDE;
