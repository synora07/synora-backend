// ============================================
// SYNORA - Nora: Limits und Kostenbremse pro Firma
// ============================================
// Ablauf fuer jede kostenpflichtige Aufgabe:
//
//   1. reservieren(firmaId, 'pruefung')   -> Zaehler +1, Reserve gebucht
//      { ok: false, grund: 'LIMIT' | 'BREMSE' }  -> Aufgabe NICHT starten
//   2. Arbeit machen (Modelle, Perplexity, SerpApi ...)
//   3a. geklappt:   abrechnen(firmaId, reservierung, echteKostenChf)
//   3b. gescheitert: zurueckgeben(firmaId, reservierung)
//
// WARUM IN EINEM SCHRITT
//
// Lesen, rechnen, schreiben haelt unter Last nicht: 50 gleichzeitige
// Anfragen lesen denselben Stand und kommen alle durch. Darum steckt
// die Pruefung IM Update: MongoDB erhoeht den Zaehler nur, wenn er
// danach noch unter dem Limit und die Kosten unter der Bremse liegen.
// Ein einzelnes Dokument wird von MongoDB atomar geaendert - eine
// zweite Anfrage kann sich nicht dazwischenschieben.
// ============================================

'use strict';

const Verbrauch = require('../models/Verbrauch');
const { LIMITS, ZAEHLER, BREMSE_CHF, AUFGABEN, WARNUNG_AB } = require('../config');

const MIKRO = 1e6;

function zuMikro(chf) {
  const n = Number(chf);
  if (!Number.isFinite(n)) throw new Error(`NORA: ungueltiger Betrag ${chf}`);
  return Math.round(n * MIKRO);
}

/** Monat nach Schweizer Zeit, z. B. "2026-11". */
function monatJetzt(jetzt = new Date()) {
  const teile = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit'
  }).formatToParts(jetzt);
  const jahr = teile.find((t) => t.type === 'year').value;
  const monat = teile.find((t) => t.type === 'month').value;
  return `${jahr}-${monat}`;
}

// Alle Zaehler ausdruecklich auf 0. Wichtig: Ein fehlendes Feld wuerde
// die Bedingung "$lte Limit" in MongoDB NICHT erfuellen.
const LEERER_MONAT = Object.freeze(ZAEHLER.reduce((o, name) => {
  o[`zaehler.${name}`] = 0;
  return o;
}, { kostenMikro: 0 }));

/** Legt das Monatsdokument an, falls es fehlt. Zwei gleichzeitige Aufrufe sind kein Problem. */
async function sicherstellen(firmaId, monat) {
  try {
    await Verbrauch.updateOne(
      { firmaId, monat },
      { $setOnInsert: { ...LEERER_MONAT } },
      { upsert: true }
    );
  } catch (e) {
    if (e && e.code === 11000) return; // der andere Aufruf war schneller
    throw e;
  }
}

/** Stand fuer die Anzeige. Kosten nur, wenn intern === true. */
function standAus(doc, { intern = false } = {}) {
  const z = (doc && doc.zaehler) || {};
  const zaehler = {};
  for (const name of ZAEHLER) {
    const verbraucht = Number(z[name] || 0);
    const limit = LIMITS[name];
    const anteil = limit > 0 ? verbraucht / limit : 1;
    zaehler[name] = {
      verbraucht,
      limit,
      rest: Math.max(0, limit - verbraucht),
      prozent: Math.min(100, Math.round(anteil * 100)),
      warnung: anteil >= WARNUNG_AB
    };
  }
  const stand = { monat: doc ? doc.monat : null, zaehler };
  if (intern) {
    stand.kostenChf = Number(((doc && doc.kostenMikro) || 0) / MIKRO);
    stand.bremseChf = BREMSE_CHF;
  }
  return stand;
}

async function reservieren(firmaId, aufgabe, { menge = 1, jetzt = new Date() } = {}) {
  const def = AUFGABEN[aufgabe];
  if (!def) throw new Error(`NORA: unbekannte Aufgabe "${aufgabe}"`);
  if (!Number.isInteger(menge) || menge < 1 || menge > 1000) {
    throw new Error(`NORA: ungueltige Menge ${menge}`);
  }

  const monat = monatJetzt(jetzt);
  const reserveMikro = zuMikro(def.reserveChf * menge);
  const bremseMikro = zuMikro(BREMSE_CHF);

  const filter = { firmaId, monat, kostenMikro: { $lte: bremseMikro - reserveMikro } };
  const plus = { kostenMikro: reserveMikro };
  for (const name of def.zaehler) {
    filter[`zaehler.${name}`] = { $lte: LIMITS[name] - menge };
    plus[`zaehler.${name}`] = menge;
  }

  await sicherstellen(firmaId, monat);
  const doc = await Verbrauch.findOneAndUpdate(filter, { $inc: plus }, { new: true }).lean();

  if (doc) {
    return { ok: true, firmaId: String(firmaId), aufgabe, menge, monat, reserveMikro, stand: standAus(doc) };
  }

  // Abgelehnt - nur noch fuer die Meldung herausfinden, warum.
  const jetztDoc = await Verbrauch.findOne({ firmaId, monat }).lean();
  const z = (jetztDoc && jetztDoc.zaehler) || {};
  const voll = def.zaehler.filter((name) => Number(z[name] || 0) + menge > LIMITS[name]);
  return {
    ok: false,
    grund: voll.length ? 'LIMIT' : 'BREMSE',
    zaehler: voll,
    aufgabe,
    monat,
    stand: standAus(jetztDoc)
  };
}

/** Korrigiert die Reserve auf die echten Kosten. Gibt die Differenz in Franken zurueck. */
async function abrechnen(firmaId, reservierung, echteKostenChf) {
  pruefeReservierung(firmaId, reservierung);
  const diff = zuMikro(echteKostenChf) - reservierung.reserveMikro;
  if (diff === 0) { reservierung.erledigt = true; return 0; }

  const filter = { firmaId, monat: reservierung.monat };
  if (diff < 0) filter.kostenMikro = { $gte: -diff }; // nie unter null

  const r = await Verbrauch.updateOne(filter, { $inc: { kostenMikro: diff } });
  reservierung.erledigt = true;
  if (diff > 0) {
    console.warn(`[nora] Firma ${firmaId}: ${reservierung.aufgabe} kostete CHF ${(diff / MIKRO).toFixed(4)} mehr als reserviert - Reserve in config.js pruefen`);
  }
  return r.modifiedCount === 1 ? diff / MIKRO : 0;
}

/** Gibt Zaehler und Reserve zurueck, wenn die Aufgabe gescheitert ist. */
async function zurueckgeben(firmaId, reservierung) {
  pruefeReservierung(firmaId, reservierung);
  const def = AUFGABEN[reservierung.aufgabe];
  const filter = { firmaId, monat: reservierung.monat, kostenMikro: { $gte: reservierung.reserveMikro } };
  const minus = { kostenMikro: -reservierung.reserveMikro };
  for (const name of def.zaehler) {
    filter[`zaehler.${name}`] = { $gte: reservierung.menge };
    minus[`zaehler.${name}`] = -reservierung.menge;
  }
  const r = await Verbrauch.updateOne(filter, { $inc: minus });
  reservierung.erledigt = true;
  return r.modifiedCount === 1;
}

function pruefeReservierung(firmaId, reservierung) {
  if (!reservierung || !reservierung.ok || !AUFGABEN[reservierung.aufgabe]) {
    throw new Error('NORA: ungueltige Reservierung');
  }
  if (reservierung.erledigt) {
    throw new Error('NORA: Reservierung wurde schon abgerechnet oder zurueckgegeben');
  }
  if (String(reservierung.firmaId) !== String(firmaId)) {
    throw new Error('NORA: Reservierung gehoert zu einer anderen Firma');
  }
}

async function stand(firmaId, { intern = false, jetzt = new Date() } = {}) {
  const monat = monatJetzt(jetzt);
  const doc = await Verbrauch.findOne({ firmaId, monat }).lean();
  const s = standAus(doc, { intern });
  s.monat = monat;
  return s;
}

module.exports = { reservieren, abrechnen, zurueckgeben, stand, monatJetzt, zuMikro, standAus };
