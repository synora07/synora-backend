// ============================================
// SYNORA - Nora: Verbrauch pro Firma und Monat
// ============================================
// Ein Dokument pro Firma und Monat (Schweizer Zeit). Am Monatsanfang
// entsteht automatisch ein neues - so setzen sich die Limits zurueck,
// ohne dass jemand etwas loeschen muss.
//
// Kosten in Millionstel Franken (ganze Zahlen), damit sich beim
// Zusammenzaehlen keine Rundungsfehler aufsummieren.
// ============================================

'use strict';

const mongoose = require('mongoose');
const { firmaPflicht } = require('./firmaPflicht');

const zahlFeld = { type: Number, default: 0, min: 0 };

const verbrauchSchema = new mongoose.Schema({
  firmaId: { type: mongoose.Schema.Types.ObjectId, ref: 'NoraFirma', required: true, immutable: true },
  monat: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  zaehler: {
    pruefungen: zahlFeld,
    experten: zahlFeld,
    offerten: zahlFeld,
    dokumente: zahlFeld,
    fotos: zahlFeld,
    preise: zahlFeld,
    artefakte: zahlFeld,
    akten: zahlFeld
  },
  kostenMikro: { type: Number, default: 0, min: 0 }
}, { collection: 'nora_verbrauch', timestamps: true });

verbrauchSchema.index({ firmaId: 1, monat: 1 }, { unique: true });
verbrauchSchema.plugin(firmaPflicht);

module.exports = mongoose.models.NoraVerbrauch || mongoose.model('NoraVerbrauch', verbrauchSchema);
