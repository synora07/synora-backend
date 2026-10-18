// ============================================
// SYNORA - Preisverlauf
// ============================================
// Wird bei jeder Suche nebenbei mitgeschrieben. Kostet keinen
// einzigen zusaetzlichen API-Aufruf, weil die Preise ohnehin
// schon geholt wurden.
//
// Grundlage fuer:
//   - Preisverlauf (Premium)
//   - Preisalarm (Premium)
//   - Schein-Rabatt-Erkennung: war der durchgestrichene Preis je echt?
// ============================================
'use strict';

const mongoose = require('mongoose');

const preisVerlaufSchema = new mongoose.Schema({
  // Google-Produkt-ID - bleibt ueber Suchen hinweg gleich
  googleProduktId: { type: String, required: true, index: true },
  produktName: { type: String, default: '' },
  shop: { type: String, default: '', index: true },

  datum: { type: String, required: true }, // YYYY-MM-DD, Schweizer Zeit

  // Mehrere Suchen am selben Tag: Spanne statt nur der letzte Wert
  preisMin: { type: Number, required: true },
  preisMax: { type: Number, required: true },
  preisZuletzt: { type: Number, required: true },
  waehrung: { type: String, default: 'CHF' },

  // Was der Shop an diesem Tag als Originalpreis behauptet hat
  behaupteterAltpreis: { type: Number, default: null },

  messungen: { type: Number, default: 1 },
  ersteMessung: { type: Date, default: Date.now },
  letzteMessung: { type: Date, default: Date.now }
});

// Ein Eintrag pro Produkt, Shop und Tag
preisVerlaufSchema.index(
  { googleProduktId: 1, shop: 1, datum: 1 },
  { unique: true }
);

// Fuer die Abfrage "Verlauf der letzten 90 Tage"
preisVerlaufSchema.index({ googleProduktId: 1, datum: -1 });

// Preisverlauf ist langfristig wertvoll - 400 Tage aufbewahren
preisVerlaufSchema.index({ ersteMessung: 1 }, { expireAfterSeconds: 400 * 24 * 60 * 60 });

module.exports = mongoose.models.PreisVerlauf
  || mongoose.model('PreisVerlauf', preisVerlaufSchema);