// ============================================
// SYNORA - Shop-Register
// ============================================
// Die mitwachsende Shop-Datenbank.
//
// Warum nicht von Hand gepflegt:
// 3'600 Eintraege von Hand zu schreiben dauert hundert Stunden, und
// nach einem Jahr stimmt ein Teil davon nicht mehr. Das Warenhaus
// Jelmoli steht seit ueber einem Jahr geschlossen in der alten Liste.
//
// Stattdessen: Jeder Shop, der in einer ECHTEN Suche auftaucht, wird
// hier automatisch angelegt. Kein erfundener Shop, keine Karteileiche.
// Du vergibst nur noch die Qualitaetsstufe - oder laesst es, dann
// bleibt der Shop "unbekannt" und SYNORA sagt das dem Nutzer.
// ============================================
'use strict';

const mongoose = require('mongoose');

const shopEintragSchema = new mongoose.Schema({
  // Domain wenn vorhanden, sonst der normalisierte Name
  kennung: { type: String, required: true, unique: true, index: true },

  domain: { type: String, default: null, index: true },
  name: { type: String, default: '' },
  land: { type: String, default: null, index: true },

  // Wo der Shop aufgetaucht ist, z.B. "elektronik.audio"
  kategorien: { type: [String], default: [] },

  // ==========================================
  // BEWERTUNG - von dir vergeben, nicht geraten
  // ==========================================
  qualitaet: {
    type: String,
    enum: ['premium', 'hoch', 'gut', 'mittel', 'niedrig', null],
    default: null
  },
  preis: {
    type: String,
    enum: ['luxus', 'hoch', 'mittel', 'guenstig', 'budget', null],
    default: null
  },
  versand: {
    type: String,
    enum: ['schnell', 'mittel', 'langsam', 'digital', null],
    default: null
  },
  notiz: { type: String, default: '' },

  // Woher die Bewertung stammt
  quelle: {
    type: String,
    enum: ['automatisch', 'manuell', 'statisch'],
    default: 'automatisch'
  },

  // ==========================================
  // NUTZUNG
  // ==========================================
  gesehen: { type: Number, default: 1 },
  ersteSichtung: { type: Date, default: Date.now },
  letzteSichtung: { type: Date, default: Date.now },

  // ==========================================
  // ZUSTAND
  // ==========================================
  // Vom Pruefskript gesetzt: antwortet die Domain noch?
  erreichbar: { type: Boolean, default: null },
  letztePruefung: { type: Date, default: null },

  gemeldet: { type: Number, default: 0 },
  gesperrt: { type: Boolean, default: false },
  gesperrtGrund: { type: String, default: '' }
});

// Fuer deine Durchsicht: haeufigste unbewertete Shops zuerst
shopEintragSchema.index({ qualitaet: 1, gesehen: -1 });
shopEintragSchema.index({ letzteSichtung: -1 });

// ============================================
// LAND AUS DER DOMAIN
// ============================================
const ENDUNG_ZU_LAND = {
  ch: 'CH', li: 'LI', de: 'DE', at: 'AT', fr: 'FR', it: 'IT',
  nl: 'NL', be: 'BE', es: 'ES', pt: 'PT', dk: 'DK', se: 'SE',
  no: 'NO', fi: 'FI', pl: 'PL', cz: 'CZ', uk: 'UK', ie: 'IE',
  us: 'US', ca: 'CA', cn: 'CN', jp: 'JP', kr: 'KR', eu: 'EU'
};

shopEintragSchema.statics.landAusDomain = function (domain) {
  if (!domain) return null;
  const teile = String(domain).toLowerCase().split('.');
  const letzte = teile[teile.length - 1];
  const vorletzte = teile[teile.length - 2];

  // co.uk, com.au und aehnliche
  if ((letzte === 'uk' || letzte === 'au' || letzte === 'br') && vorletzte) {
    return ENDUNG_ZU_LAND[letzte] || letzte.toUpperCase();
  }

  if (ENDUNG_ZU_LAND[letzte]) return ENDUNG_ZU_LAND[letzte];
  if (['com', 'net', 'org', 'io', 'shop', 'store'].includes(letzte)) return 'INT';

  return null;
};

module.exports = mongoose.models.ShopEintrag
  || mongoose.model('ShopEintrag', shopEintragSchema);