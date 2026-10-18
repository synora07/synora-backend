// ============================================
// SYNORA - Shop-Register-Dienst
// ============================================
// Lernt Shops aus echten Suchen. Laeuft im Hintergrund und
// verzoegert keine Antwort.
// ============================================
'use strict';

const mongoose = require('mongoose');
const ShopEintrag = require('../models/ShopEintrag');

let kategorien = null;
try {
  kategorien = require('./shopKategorien');
} catch (e) {
  console.warn('[register] Kategorien nicht geladen:', e.message);
}

/**
 * Aus einem SerpAPI-Namen Domain und Anzeigename holen.
 * SerpAPI liefert "Amazon.de - Amazon.de-Seller", "digitec.ch"
 * oder auch nur "ART Computer" ohne jede Domain.
 */
function zerlegen(quelle) {
  const roh = String(quelle || '').trim();
  if (!roh) return null;

  const ersterTeil = roh.split(/\s+[-|–]\s+/)[0].trim();
  const treffer = ersterTeil.toLowerCase().match(/([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,6})/);
  const domain = treffer ? treffer[1] : null;

  // Ohne Domain dient der Name als Kennung
  const kennung = domain || ersterTeil.toLowerCase().replace(/\s+/g, '-');
  if (!kennung) return null;

  return { kennung, domain, name: ersterTeil };
}

/**
 * Gesehene Shops merken. Ein Aufruf pro Suche, nicht pro Produkt.
 *
 * @param {Array} produkte - Suchergebnisse mit source/shop
 * @param {string} kategorie - z.B. "elektronik.audio", optional
 */
async function merken(produkte, kategorie = null) {
  if (mongoose.connection.readyState !== 1) return 0;
  if (!Array.isArray(produkte) || !produkte.length) return 0;

  const gesehen = new Map();

  for (const p of produkte) {
    const teile = zerlegen(p.source || p.shop);
    if (!teile) continue;
    if (!gesehen.has(teile.kennung)) gesehen.set(teile.kennung, teile);
  }

  if (!gesehen.size) return 0;

  const jetzt = new Date();
  const operationen = [];

  for (const t of gesehen.values()) {
    const land = ShopEintrag.landAusDomain(t.domain);

    const setzen = { letzteSichtung: jetzt, name: t.name };
    if (land) setzen.land = land;
    if (t.domain) setzen.domain = t.domain;

    operationen.push({
      updateOne: {
        filter: { kennung: t.kennung },
        update: {
          $setOnInsert: {
            kennung: t.kennung,
            ersteSichtung: jetzt,
            quelle: 'automatisch',
            qualitaet: null
          },
          $set: setzen,
          $inc: { gesehen: 1 },
          ...(kategorie ? { $addToSet: { kategorien: kategorie } } : {})
        },
        upsert: true
      }
    });
  }

  try {
    await ShopEintrag.bulkWrite(operationen, { ordered: false });
    return operationen.length;
  } catch (e) {
    console.error('[register] Merken fehlgeschlagen:', e.message);
    return 0;
  }
}

/**
 * Mehrere Shops auf einmal nachschlagen.
 * @returns {Map} kennung -> Eintrag
 */
async function vieleHolen(quellen) {
  const karte = new Map();
  if (mongoose.connection.readyState !== 1) return karte;

  const kennungen = [];
  for (const q of quellen || []) {
    const t = zerlegen(q);
    if (t) kennungen.push(t.kennung);
  }
  if (!kennungen.length) return karte;

  try {
    const eintraege = await ShopEintrag.find({ kennung: { $in: kennungen } }).lean();
    for (const e of eintraege) karte.set(e.kennung, e);
  } catch (e) {
    console.error('[register] Nachschlagen fehlgeschlagen:', e.message);
  }

  return karte;
}

/**
 * Deine Durchsicht-Liste: haeufigste noch unbewertete Shops zuerst.
 * Das sind die, bei denen eine Bewertung am meisten bringt.
 */
async function offene(limit = 50) {
  if (mongoose.connection.readyState !== 1) return [];

  return await ShopEintrag.find({ qualitaet: null, gesperrt: false })
    .sort({ gesehen: -1 })
    .limit(Math.min(limit, 200))
    .select('kennung domain name land kategorien gesehen letzteSichtung erreichbar')
    .lean();
}

/** Einen Shop bewerten - von dir, nicht geraten */
async function bewerten(kennung, werte = {}) {
  if (mongoose.connection.readyState !== 1) return null;

  const erlaubt = {};
  if (werte.qualitaet !== undefined) erlaubt.qualitaet = werte.qualitaet;
  if (werte.preis !== undefined) erlaubt.preis = werte.preis;
  if (werte.versand !== undefined) erlaubt.versand = werte.versand;
  if (werte.notiz !== undefined) erlaubt.notiz = String(werte.notiz).slice(0, 500);
  if (werte.gesperrt !== undefined) {
    erlaubt.gesperrt = !!werte.gesperrt;
    erlaubt.gesperrtGrund = String(werte.gesperrtGrund || '').slice(0, 300);
  }

  if (!Object.keys(erlaubt).length) return null;
  erlaubt.quelle = 'manuell';

  return await ShopEintrag.findOneAndUpdate(
    { kennung: String(kennung).toLowerCase() },
    { $set: erlaubt },
    { new: true }
  ).lean();
}

/** Zahlen fuer die Uebersicht */
async function statistik() {
  if (mongoose.connection.readyState !== 1) return null;

  const [gesamt, bewertet, gesperrt, nachLand] = await Promise.all([
    ShopEintrag.estimatedDocumentCount(),
    ShopEintrag.countDocuments({ qualitaet: { $ne: null } }),
    ShopEintrag.countDocuments({ gesperrt: true }),
    ShopEintrag.aggregate([
      { $group: { _id: '$land', anzahl: { $sum: 1 } } },
      { $sort: { anzahl: -1 } },
      { $limit: 15 }
    ])
  ]);

  return {
    gesamt,
    bewertet,
    unbewertet: gesamt - bewertet,
    gesperrt,
    nachLand: nachLand.map((l) => ({ land: l._id || 'unbekannt', anzahl: l.anzahl }))
  };
}

module.exports = {
  zerlegen,
  merken,
  vieleHolen,
  offene,
  bewerten,
  statistik,
  kategorieErkennen: kategorien ? kategorien.kategorieErkennen : () => null
};