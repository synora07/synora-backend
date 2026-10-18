// ============================================
// SYNORA - Aufnahme
// ============================================
// Eine Aufnahme ist KEIN Cache. Das ist der ganze Punkt dieser Datei.
//
//   Cache    spart Geld im Betrieb und MUSS sich selbst leeren,
//            sonst zeigt die Seite Preise von letzter Woche.
//   Aufnahme dient zum Pruefen und darf NIEMALS verschwinden,
//            sonst testest du jedes Mal gegen andere Daten.
//
// Beides lag bisher in derselben Sammlung (SuchCache). Dort steht:
//
//     cacheSchema.index({ ablaufAm: 1 }, { expireAfterSeconds: 0 });
//
// MongoDB hat die Aufnahmen damit nach 30 Minuten geloescht. Der
// Abspielmodus las danach eine leere Sammlung - gemessen am
// 03.10.2026: suchcache 0 Eintraege.
//
// Deshalb eine eigene Sammlung. Ohne TTL. Mit Absicht.
// ============================================
//
// ACHTUNG, WENN DU HIER ETWAS AENDERST:
// In dieser Datei steht bewusst KEIN expireAfterSeconds. Wer einen
// TTL-Index hinzufuegt, macht genau den Fehler rueckgaengig, den
// diese Datei behebt. Aufnahmen loescht man von Hand:
//
//     node scripts/aufnahmeZeigen.js --loeschen
//
// ============================================
'use strict';

const mongoose = require('mongoose');

const aufnahmeSchema = new mongoose.Schema({
  // Derselbe Schluessel wie im Cache: sha1(begriff|budget|land).
  // Dadurch findet der Abspielmodus die Aufnahme mit genau der
  // Rechnung, mit der die Suche sonst den Cache befragt.
  schluessel: { type: String, required: true, unique: true },

  // Nur zum Nachschauen in Compass - gesucht wird ueber schluessel
  begriff: { type: String, default: '', index: true },
  budget: { type: Number, default: null },
  land: { type: String, default: 'CH' },

  // Die Produktliste genau so, wie SerpAPI sie geliefert hat.
  // Ungefiltert, unsortiert, vollstaendig - damit beim Abspielen
  // auch die Filter durchlaufen und mitgeprueft werden.
  daten: { type: mongoose.Schema.Types.Mixed, required: true },
  anzahl: { type: Number, default: 0 },

  // serpapi       = echte Abfrage, voller Datensatz
  // rekonstruiert = aus Suchprotokollen nachgebaut, unvollstaendig
  //
  // Der Unterschied ist wichtig: eine rekonstruierte Aufnahme hat
  // keine Links und keine Bilder. Wer das verwechselt, sucht
  // stundenlang einen Fehler im Frontend, der keiner ist.
  quelle: { type: String, enum: ['serpapi', 'rekonstruiert'], default: 'serpapi' },

  aufgenommenAm: { type: Date, default: Date.now },
  abspielungen: { type: Number, default: 0 },
  zuletztAbgespielt: { type: Date, default: null }
});

// Schnell finden, was zu einem Begriff aufgenommen wurde
aufnahmeSchema.index({ begriff: 1, aufgenommenAm: -1 });

// Hier steht absichtlich kein TTL-Index. Siehe Kopf der Datei.

module.exports = mongoose.models.Aufnahme
  || mongoose.model('Aufnahme', aufnahmeSchema);