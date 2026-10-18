// ============================================
// SYNORA - ProduktKlick
// ============================================
// Speichert pro empfohlenem Produkt den Google-Token, damit beim
// Klick die echte Haendlerliste nachgeladen werden kann.
// Gleichzeitig das Klick-Protokoll fuer die Messung.
// ============================================
'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');

// 30 Tage aufbewahren, danach loescht MongoDB automatisch
const AUFBEWAHRUNG_TAGE = 30;

const produktKlickSchema = new mongoose.Schema({
  // Kurze ID fuer die URL: /api/go/aB3xK9Qz
  kurzId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Google-Token, um die Haendlerliste nachzuladen
  token: { type: String, required: true },
  googleProduktId: { type: String, default: null },

  // Was dem Nutzer angezeigt wurde - fuer die spaetere Auswertung
  produktName: { type: String, default: '' },
  angezeigterPreis: { type: String, default: '' },
  angezeigterPreisWert: { type: Number, default: null },
  angezeigterShop: { type: String, default: '' },

  // Kontext der Suche
  // sucheId verbindet alle Produkte EINER Suche - damit eine spaetere
  // Fehlermeldung zeigen kann, was damals empfohlen wurde.
  sucheId: { type: String, default: null, index: true },
  suchanfrage: { type: String, default: '' },
  budget: { type: Number, default: null },
  rang: { type: Number, default: null },
  nutzer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Was beim Klick wirklich passiert ist
  klicks: { type: Number, default: 0 },
  ersterKlick: { type: Date, default: null },
  letzterKlick: { type: Date, default: null },
  gewaehlterShop: {
    name: { type: String, default: null },
    url: { type: String, default: null },
    preis: { type: Number, default: null },
    land: { type: String, default: null },
    endpreisVollstaendig: { type: Boolean, default: false }
  },

  erstelltAm: { type: Date, default: Date.now }
});

// MongoDB raeumt alte Eintraege selbst auf
produktKlickSchema.index({ erstelltAm: 1 }, { expireAfterSeconds: AUFBEWAHRUNG_TAGE * 24 * 60 * 60 });

/** Kurze, URL-sichere ID erzeugen */
produktKlickSchema.statics.neueKurzId = function () {
  return crypto.randomBytes(6).toString('base64url');
};

module.exports = mongoose.models.ProduktKlick
  || mongoose.model('ProduktKlick', produktKlickSchema);