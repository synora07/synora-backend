// ============================================
// SYNORA - Preisverlauf-Dienst
// ============================================
'use strict';

const mongoose = require('mongoose');
const PreisVerlauf = require('../models/PreisVerlauf');

/** Datum als YYYY-MM-DD in Schweizer Zeit */
function heutigesDatum() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}

/**
 * Preise aus einem Suchergebnis mitschreiben.
 * Wird nur mit FRISCHEN Daten aufgerufen - gecachte Preise duerfen
 * nicht als heutige Messung in den Verlauf, sonst faelschst du
 * deine eigene Datengrundlage.
 *
 * Laeuft im Hintergrund und blockiert die Antwort nicht.
 */
async function schreiben(produkte) {
  if (mongoose.connection.readyState !== 1) return 0;
  if (!Array.isArray(produkte) || !produkte.length) return 0;

  const datum = heutigesDatum();
  const jetzt = new Date();
  const operationen = [];
  const gesehen = new Set();

  for (const p of produkte) {
    const id = p.product_id ? String(p.product_id) : null;
    const preis = typeof p.priceValue === 'number' ? p.priceValue : null;
    if (!id || preis === null || preis <= 0) continue;

    const shop = String(p.source || p.shop || 'unbekannt');

    // Innerhalb einer Suche kann dasselbe Produkt doppelt vorkommen
    const kennung = id + '|' + shop;
    if (gesehen.has(kennung)) continue;
    gesehen.add(kennung);

    operationen.push({
      updateOne: {
        filter: { googleProduktId: id, shop, datum },
        update: {
          $setOnInsert: {
            googleProduktId: id,
            shop,
            datum,
            ersteMessung: jetzt,
            waehrung: p.currency || 'CHF'
          },
          $set: {
            produktName: p.title || p.name || '',
            preisZuletzt: preis,
            letzteMessung: jetzt
          },
          $min: { preisMin: preis },
          $max: { preisMax: preis },
          $inc: { messungen: 1 }
        },
        upsert: true
      }
    });
  }

  if (!operationen.length) return 0;

  try {
    await PreisVerlauf.bulkWrite(operationen, { ordered: false });
    return operationen.length;
  } catch (e) {
    // Darf die Suche nie stoppen
    console.error('[preise] Mitschrieb fehlgeschlagen:', e.message);
    return 0;
  }
}

/**
 * Verlauf eines Produkts holen.
 * @param {string} googleProduktId
 * @param {number} tage
 */
async function verlauf(googleProduktId, tage = 90) {
  if (mongoose.connection.readyState !== 1) return [];

  const grenze = new Date(Date.now() - tage * 24 * 60 * 60 * 1000);
  const grenzDatum = grenze.toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });

  return await PreisVerlauf.find(
    { googleProduktId: String(googleProduktId), datum: { $gte: grenzDatum } },
    'datum shop preisMin preisMax preisZuletzt waehrung'
  ).sort({ datum: 1 }).lean();
}

/**
 * Schein-Rabatt pruefen.
 *
 * Die Frage ist nicht "ist der Preis gerade tief", sondern:
 * War der durchgestrichene Preis in den letzten Wochen je echt?
 *
 * @returns {{genugDaten:boolean, echterRabatt:boolean|null, ...}}
 */
async function rabattPruefen(googleProduktId, aktuellerPreis, behaupteterAltpreis, tage = 60) {
  const eintraege = await verlauf(googleProduktId, tage);

  if (eintraege.length < 5) {
    // Ohne Datenbasis wird nichts behauptet - Versprechen 6
    return {
      genugDaten: false,
      echterRabatt: null,
      messtage: eintraege.length,
      hinweis: 'Noch zu wenig Preisdaten fuer ein Urteil'
    };
  }

  const hoechster = Math.max(...eintraege.map((e) => e.preisMax));
  const tiefster = Math.min(...eintraege.map((e) => e.preisMin));
  const schnitt =
    eintraege.reduce((s, e) => s + e.preisZuletzt, 0) / eintraege.length;

  const ergebnis = {
    genugDaten: true,
    messtage: eintraege.length,
    hoechster: Math.round(hoechster * 100) / 100,
    tiefster: Math.round(tiefster * 100) / 100,
    schnitt: Math.round(schnitt * 100) / 100,
    aktuell: aktuellerPreis,
    echterRabatt: null,
    hinweis: null
  };

  if (behaupteterAltpreis && behaupteterAltpreis > 0) {
    // Wurde der behauptete Altpreis je erreicht? 5 Prozent Toleranz.
    const jeErreicht = hoechster >= behaupteterAltpreis * 0.95;
    ergebnis.echterRabatt = jeErreicht;

    ergebnis.hinweis = jeErreicht
      ? `Der Rabatt stimmt: das Produkt kostete in den letzten ${tage} Tagen bis zu ${ergebnis.hoechster} CHF.`
      : `Vorsicht: der durchgestrichene Preis von ${behaupteterAltpreis} CHF wurde in den letzten ${tage} Tagen nie verlangt. Der hoechste gemessene Preis war ${ergebnis.hoechster} CHF.`;
  } else if (aktuellerPreis !== null && aktuellerPreis !== undefined) {
    // Kein Altpreis behauptet - dann einordnen, wo der Preis steht
    if (aktuellerPreis <= tiefster * 1.02) {
      ergebnis.hinweis = `So guenstig war das Produkt in den letzten ${tage} Tagen noch nie.`;
    } else if (aktuellerPreis >= hoechster * 0.98) {
      ergebnis.hinweis = `Der Preis ist gerade am oberen Ende der letzten ${tage} Tage.`;
    }
  }

  return ergebnis;
}

/** Zahlen fuer die Auswertung */
async function statistik() {
  if (mongoose.connection.readyState !== 1) return null;

  const [eintraege, produkte] = await Promise.all([
    PreisVerlauf.estimatedDocumentCount(),
    PreisVerlauf.distinct('googleProduktId')
  ]);

  return {
    eintraege,
    beobachteteProdukte: produkte.length,
    seit: await PreisVerlauf.findOne({}, 'datum').sort({ datum: 1 }).lean()
  };
}

module.exports = {
  schreiben,
  verlauf,
  rabattPruefen,
  statistik,
  heutigesDatum
};