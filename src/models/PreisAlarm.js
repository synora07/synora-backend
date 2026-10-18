// ============================================
// SYNORA - Preisalarm (Modell)
// ============================================
// EIN ALARM JE NUTZER UND PRODUKT - ABER GEPRUEFT WIRD JE PRODUKT.
//
// Das ist die wichtigste Entscheidung an dieser Funktion, und sie
// laesst sich spaeter nur teuer aendern.
//
// Beobachten 500 Menschen dasselbe Handy, dann ist das EINE
// SerpAPI-Abfrage, nicht 500. Darum steht in jedem Alarm die
// "produktId" - die Google-Produktnummer, die bei allen 500
// dieselbe ist. Der Pruefer gruppiert danach.
//
// Was das ausmacht, in Zahlen:
//
//   ohne Buendelung   10 Alarme je Nutzer, taeglich geprueft
//                     = CHF 7.50 im Monat, bei CHF 6.50 Einnahme
//                     -> jeder Premium-Nutzer macht Verlust
//
//   mit Buendelung    je mehr Nutzer dasselbe beobachten, desto
//                     billiger wird es PRO NUTZER
//
// Dieselbe Funktion, zwei voellig verschiedene Unternehmen.
//
// WOCHENTAKT, NICHT TAGESTAKT
//
// Ein Preis aendert sich nicht stuendlich. Woechentlich kostet ein
// Siebtel und faellt dem Nutzer nicht auf.
// ============================================

'use strict';

const mongoose = require('mongoose');

const preisAlarmSchema = new mongoose.Schema({
  // ---------- Wer ----------
  nutzer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // ---------- Welches Produkt ----------
  // produktId ist der Schluessel, nach dem gebuendelt wird. Zwei
  // Nutzer mit derselben produktId kosten zusammen eine Abfrage.
  produktId: { type: String, required: true, index: true },

  // Zum Nachsuchen, falls die produktId einmal nicht mehr greift.
  produktName: { type: String, required: true },
  suchbegriff: { type: String, default: '' },
  bildUrl: { type: String, default: '' },

  // ---------- Preise ----------
  // startPreis: was das Produkt kostete, als der Alarm entstand.
  // zielPreis:  ab wann benachrichtigt wird. Ohne Angabe gilt
  //             "jede Senkung ab 5 Prozent".
  startPreis: { type: Number, required: true },
  zielPreis: { type: Number, default: null },
  letzterPreis: { type: Number, default: null },
  letzterShop: { type: String, default: '' },

  // ---------- Benachrichtigung ----------
  kanaele: {
    type: [String],
    default: ['email'],
    validate: {
      validator: (k) => k.every((x) => ['email', 'push'].includes(x)),
      message: 'Kanal muss email oder push sein'
    }
  },

  // ---------- Zustand ----------
  aktiv: { type: Boolean, default: true, index: true },
  zuletztGeprueft: { type: Date, default: null },
  zuletztGemeldet: { type: Date, default: null },
  wieOftGemeldet: { type: Number, default: 0 },

  erstellt: { type: Date, default: Date.now }
}, { versionKey: false });

// Ein Nutzer kann dasselbe Produkt nur einmal beobachten.
preisAlarmSchema.index({ nutzer: 1, produktId: 1 }, { unique: true });

// Der Pruefer holt sich die faelligen Alarme nach Produkt sortiert,
// damit er sie am Stueck buendeln kann.
preisAlarmSchema.index({ aktiv: 1, zuletztGeprueft: 1 });

/**
 * Ist dieser Preis ein Grund zu melden?
 * Ohne Zielpreis gilt eine Senkung von mindestens 5 Prozent
 * gegenueber dem Startpreis - sonst meldet SYNORA bei jedem
 * Rappen, und das liest nach drei Mails niemand mehr.
 */
preisAlarmSchema.methods.istTreffer = function (neuerPreis) {
  if (!Number.isFinite(neuerPreis) || neuerPreis <= 0) return false;

  if (Number.isFinite(this.zielPreis) && this.zielPreis > 0) {
    return neuerPreis <= this.zielPreis;
  }

  return neuerPreis <= this.startPreis * 0.95;
};

/**
 * Nicht zweimal dasselbe melden. Nach einer Meldung ist 14 Tage
 * Ruhe, ausser der Preis faellt nochmal deutlich.
 */
preisAlarmSchema.methods.darfMelden = function (neuerPreis, jetzt = new Date()) {
  if (!this.zuletztGemeldet) return true;

  const tage = (jetzt - this.zuletztGemeldet) / 86400000;
  if (tage >= 14) return true;

  // Frueher nur, wenn es nochmal 5 Prozent unter den zuletzt
  // gemeldeten Preis gegangen ist.
  return Number.isFinite(this.letzterPreis) && neuerPreis <= this.letzterPreis * 0.95;
};

module.exports = mongoose.models.PreisAlarm || mongoose.model('PreisAlarm', preisAlarmSchema);