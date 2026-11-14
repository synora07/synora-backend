// ============================================
// SYNORA - Nora: Limits, Kostenbremse, Reserve pro Aufgabe
// ============================================
// Alle Zahlen kommen aus Railway-Variablen. Fehlt eine Variable,
// gilt der Wert, der am 14.11.2026 abgemacht wurde
// (claude/nora-gewerbe-analyse.md, Teil 14).
//
// Die Preisseite zeigt nur zwei davon: Pruefungen und Experten-
// pruefungen. Die anderen gelten als faire Nutzung. Die Kosten-
// bremse pro Firma schuetzt den Gewinn, auch wenn eine Schaetzung
// unten nicht stimmt.
// ============================================

'use strict';

function zahl(name, vorgabe, minimum = 0) {
  const roh = process.env[name];
  if (roh === undefined || roh === null || String(roh).trim() === '') return vorgabe;
  const n = Number(roh);
  if (!Number.isFinite(n) || n < minimum) {
    console.warn(`[nora] ${name}="${roh}" ist ungueltig - nehme ${vorgabe}`);
    return vorgabe;
  }
  return n;
}

// Wie viel eine Firma pro Monat darf.
const LIMITS = Object.freeze({
  pruefungen: zahl('NORA_PRUEFUNGEN', 200, 0),
  experten: zahl('NORA_EXPERTEN', 50, 0),       // Teil der Pruefungen
  offerten: zahl('NORA_OFFERTEN', 150, 0),
  dokumente: zahl('NORA_DOKUMENTE', 500, 0),
  fotos: zahl('NORA_FOTOS', 100, 0),
  preise: zahl('NORA_PREISE', 300, 0),
  artefakte: zahl('NORA_ARTEFAKTE', 100, 0),
  akten: zahl('NORA_AKTEN', 150, 0)
});

const ZAEHLER = Object.freeze(Object.keys(LIMITS));

// Personen pro Firma (der Inhaber zaehlt mit).
const PERSONEN = zahl('NORA_PERSONEN', 3, 1);

// Kostenbremse pro Firma und Monat, in Franken.
const BREMSE_CHF = zahl('NORA_BREMSE_CHF', 120, 0);

// Jede Aufgabe belastet einen oder mehrere Zaehler und reserviert
// vorab hoechstens so viel Geld. Nach der Arbeit wird die Reserve
// auf die echten Kosten korrigiert (verbrauch.abrechnen).
// Die Reserve liegt bewusst ueber der Schaetzung aus Teil 8, damit
// die Bremse auch bei einem teuren Durchlauf haelt.
const AUFGABEN = Object.freeze({
  pruefung: Object.freeze({ zaehler: ['pruefungen'], reserveChf: 0.40 }),
  expertenpruefung: Object.freeze({ zaehler: ['pruefungen', 'experten'], reserveChf: 0.60 }),
  offerte: Object.freeze({ zaehler: ['offerten'], reserveChf: 0.08 }),
  dokument: Object.freeze({ zaehler: ['dokumente'], reserveChf: 0.02 }),
  foto: Object.freeze({ zaehler: ['fotos'], reserveChf: 0.02 }),
  preis: Object.freeze({ zaehler: ['preise'], reserveChf: 0.02 }),
  artefakt: Object.freeze({ zaehler: ['artefakte'], reserveChf: 0.15 }),
  akte: Object.freeze({ zaehler: ['akten'], reserveChf: 0.15 })
});

// Abo-Stufen, mit denen eine Firma Nora nutzen darf.
const ABO_STUFEN = Object.freeze(['pilot', 'nora']);

// Ab welchem Anteil Nora einen Hinweis zeigt.
const WARNUNG_AB = 0.8;

module.exports = { LIMITS, ZAEHLER, PERSONEN, BREMSE_CHF, AUFGABEN, ABO_STUFEN, WARNUNG_AB, zahl };
