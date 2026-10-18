// ============================================
// SYNORA - Shop-Bewertung und Lernen aus Fehlern
// ============================================
// Zwei Aufgaben:
//
// 1. Deine Shop-Datenbank nutzbar machen. Bisher wurde davon nur die
//    Sperrliste abgefragt - die Qualitaetsstufen von 1'800 Shops lagen
//    brach. Jetzt sieht das Modell bei jedem Produkt, mit wem es zu
//    tun hat, und ein unbekannter Shop wird als solcher benannt.
//
// 2. Aus gemeldeten Fehlern lernen. Was drei verschiedene Leute
//    gemeldet haben, wird nicht mehr empfohlen - fuer alle Nutzer,
//    nicht nur fuer den Melder (Grundsatz 5).
// ============================================
'use strict';

const mongoose = require('mongoose');

let shopDb = null;
try {
  shopDb = require('./shopDatabasePart3');
} catch (e) {
  console.warn('[shops] Shop-Datenbank nicht geladen:', e.message);
}

let register = null;
try {
  register = require('./shopRegister');
} catch (e) {
  console.warn('[shops] Shop-Register nicht geladen:', e.message);
}

let FehlerLog = null;
try {
  FehlerLog = require('../models/FehlerLog');
} catch (e) {
  console.warn('[shops] FehlerLog nicht geladen:', e.message);
}

// ============================================
// SCHWELLEN - hier aendern, sonst nirgends
// ============================================
// Gezaehlt werden VERSCHIEDENE Melder, nicht Meldungen. Sonst koennte
// eine Person mit zehn Klicks ein Produkt aus dem Verkehr ziehen.
const MELDER_FUER_PRODUKT_SPERRE = 2;
const MELDER_FUER_SHOP_ABWERTUNG = 3;
const MELDER_FUER_SHOP_SPERRE = 8;
const ZEITRAUM_TAGE = 90;

// Die Fehlerliste alle 5 Minuten neu laden, nicht bei jeder Suche
const LISTE_GUELTIG_MS = 5 * 60 * 1000;

const QUALITAET_REIHE = ['niedrig', 'mittel', 'gut', 'hoch', 'premium'];

// ============================================
// SHOP ZUORDNEN
// SerpAPI liefert Namen wie "Amazon.de - Amazon.de-Seller" oder
// "digitec.ch". Die alte Suche fand davon nur die Haelfte - und
// ordnete "on" faelschlich Conrad zu, weil conrad.ch ein "on" enthaelt.
// ============================================

/** Aus einem SerpAPI-Namen die brauchbaren Teile holen */
function zerlegeQuelle(quelle) {
  const roh = String(quelle || '').toLowerCase().trim();
  if (!roh) return { voll: '', teile: [], domain: null };

  // "Amazon.de - Amazon.de-Seller" -> "amazon.de"
  const ersterTeil = roh.split(/\s+[-|–]\s+/)[0].trim();

  // Domain erkennen, falls vorhanden
  const domainTreffer = ersterTeil.match(/([a-z0-9-]+\.[a-z]{2,6})/);
  const domain = domainTreffer ? domainTreffer[1] : null;

  return { voll: roh, erster: ersterTeil, domain };
}

/**
 * Shop in der Datenbank finden.
 * Nur exakte Treffer auf Name oder Domain - kein Teilstring-Raten.
 */
function shopFinden(quelle) {
  if (!shopDb || !shopDb.ALLE_SHOPS) return null;

  const { voll, erster, domain } = zerlegeQuelle(quelle);
  if (!voll) return null;

  const kandidaten = [];
  for (const hauptKat of Object.values(shopDb.ALLE_SHOPS)) {
    for (const unterKat of Object.values(hauptKat)) {
      if (Array.isArray(unterKat)) kandidaten.push(...unterKat);
    }
  }

  const sauber = (s) => String(s || '').toLowerCase().trim();

  // 1. Domain gegen Shop-URL - der zuverlaessigste Weg
  if (domain) {
    const treffer = kandidaten.find((s) => {
      const url = sauber(s.url);
      return url === domain || url.startsWith(domain + '/');
    });
    if (treffer) return treffer;
  }

  // 2. Name exakt
  const nachName = kandidaten.find((s) => sauber(s.name) === erster || sauber(s.name) === voll);
  if (nachName) return nachName;

  // 3. Name ohne Laenderkuerzel: "Amazon DE" <-> "amazon"
  // "MediaMarkt Schweiz" soll "MediaMarkt CH" finden
  const ohneLand = erster.replace(/\s+(ch|de|at|eu|int|uk|us|schweiz|suisse|svizzera|deutschland)$/i, '').trim();
  if (ohneLand.length >= 4) {
    const treffer = kandidaten.find((s) => {
      const n = sauber(s.name).replace(/\s+(ch|de|at|eu|int|uk|us|schweiz|suisse|svizzera|deutschland)$/i, '').trim();
      return n === ohneLand;
    });
    if (treffer) return treffer;
  }

  return null;
}

// ============================================
// TRIFFT DIESE MELDUNG DIESEN SHOP?
// ============================================
// NEU am 03.10.2026.
//
// Vorher stand hier unten zweimal diese Zeile:
//
//     quelleKlein.includes(s) || s.includes(quelleKlein)
//
// Das ist genau das Teilstring-Raten, das weiter oben in
// shopFinden() schon einmal behoben wurde - der Kommentar in
// Zeile 59 beschreibt es selbst: "ordnete on faelschlich Conrad
// zu, weil conrad.ch ein on enthaelt".
//
// Gemessen am 03.10.2026, mit zwei gesperrten Shops in der Liste:
//
//     ""      -> gesperrt   (jeder leere String steckt in jedem)
//     "ch"    -> gesperrt
//     "shop"  -> gesperrt   (steckt in "billigshop.com")
//
// Jeder Fehltreffer loescht ein sauberes Produkt aus der Antwort,
// ohne dass irgendwo ein Fehler erscheint. Und "On" ist eine
// Schweizer Laufschuhmarke - die Kategorie hast du.
//
// Jetzt wird verglichen, nicht geraten: ganzer Name, erster Teil
// vor dem Bindestrich, oder Domain. Alle drei exakt.
function shopTrifft(quelle, liste) {
  if (!liste || !liste.size) return false;

  const a = zerlegeQuelle(quelle);
  if (!a.voll || a.voll.length < 3) return false;

  for (const eintrag of liste) {
    const b = zerlegeQuelle(eintrag);
    if (!b.voll || b.voll.length < 3) continue;

    if (a.voll === b.voll) return true;
    if (a.erster && b.erster && a.erster === b.erster) return true;
    if (a.domain && b.domain && a.domain === b.domain) return true;
  }
  return false;
}

// ============================================
// GEMELDETE PROBLEME
// ============================================

let listeCache = { stand: 0, produkte: new Set(), shopsGesperrt: new Set(), shopsAbgewertet: new Set() };

/**
 * Laedt, was gemeldet wurde. Gezaehlt werden verschiedene Melder.
 */
async function gemeldeteProbleme(erzwingen = false) {
  if (!erzwingen && Date.now() - listeCache.stand < LISTE_GUELTIG_MS) {
    return listeCache;
  }

  if (!FehlerLog || mongoose.connection.readyState !== 1) return listeCache;

  try {
    const seit = new Date(Date.now() - ZEITRAUM_TAGE * 24 * 60 * 60 * 1000);

    const [nachProdukt, nachShop] = await Promise.all([
      FehlerLog.aggregate([
        { $match: { erstelltAm: { $gte: seit } } },
        {
          $group: {
            _id: '$empfohlenesProdukt.name',
            melder: { $addToSet: { $ifNull: ['$ipHash', '$userId'] } }
          }
        },
        { $project: { anzahl: { $size: '$melder' } } },
        { $match: { anzahl: { $gte: MELDER_FUER_PRODUKT_SPERRE } } }
      ]),

      FehlerLog.aggregate([
        { $match: { erstelltAm: { $gte: seit } } },
        {
          $group: {
            _id: '$empfohlenerShop',
            melder: { $addToSet: { $ifNull: ['$ipHash', '$userId'] } },
            faelschungen: { $sum: { $cond: [{ $eq: ['$fehlerTyp', 'fake'] }, 1, 0] } }
          }
        },
        { $project: { anzahl: { $size: '$melder' }, faelschungen: 1 } },
        { $match: { anzahl: { $gte: MELDER_FUER_SHOP_ABWERTUNG } } }
      ])
    ]);

    const produkte = new Set(nachProdukt.map((p) => String(p._id || '').toLowerCase()).filter(Boolean));
    const gesperrt = new Set();
    const abgewertet = new Set();

    for (const s of nachShop) {
      const name = String(s._id || '').toLowerCase();
      if (!name) continue;
      if (s.anzahl >= MELDER_FUER_SHOP_SPERRE || s.faelschungen >= 2) gesperrt.add(name);
      else abgewertet.add(name);
    }

    listeCache = { stand: Date.now(), produkte, shopsGesperrt: gesperrt, shopsAbgewertet: abgewertet };

    if (produkte.size || gesperrt.size || abgewertet.size) {
      console.log(
        `[lernen] ${produkte.size} Produkte gesperrt, ${gesperrt.size} Shops gesperrt, ${abgewertet.size} abgewertet`
      );
    }
  } catch (e) {
    console.error('[lernen] Laden fehlgeschlagen:', e.message);
  }

  return listeCache;
}

// ============================================
// PRODUKTE ANREICHERN UND FILTERN
// ============================================

function qualitaetSenken(stufe) {
  const i = QUALITAET_REIHE.indexOf(stufe);
  if (i <= 0) return QUALITAET_REIHE[0];
  return QUALITAET_REIHE[i - 1];
}

/**
 * Haengt jedem Produkt an, was ueber seinen Shop bekannt ist,
 * und entfernt, was gemeldet wurde.
 *
 * @returns {{produkte:Array, entfernt:Array}}
 */
async function anreichernUndFiltern(produkte, kategorie = null) {
  const probleme = await gemeldeteProbleme();

  // Gesehene Shops merken - laeuft nebenher, die Antwort wartet nicht
  if (register) {
    register.merken(produkte, kategorie).catch(() => {});
  }

  // Was schon im Register steht, auf einmal nachschlagen
  let ausRegister = new Map();
  if (register) {
    try {
      ausRegister = await register.vieleHolen((produkte || []).map((p) => p.source || p.shop));
    } catch (e) {
      console.error('[shops] Register-Abfrage fehlgeschlagen:', e.message);
    }
  }

  const behalten = [];
  const entfernt = [];

  for (const p of produkte || []) {
    const quelle = p.source || p.shop || '';
    const produktName = String(p.title || p.name || '').toLowerCase();

    // 1. Gemeldetes Produkt - kommt nicht wieder
    if (produktName && probleme.produkte.has(produktName)) {
      entfernt.push({ titel: p.title, grund: 'mehrfach als fehlerhaft gemeldet' });
      continue;
    }

    // 2. Gesperrter Shop
    const shopGesperrt = shopTrifft(quelle, probleme.shopsGesperrt);
    if (shopGesperrt) {
      entfernt.push({ titel: p.title, grund: `Shop ${quelle} mehrfach gemeldet` });
      continue;
    }

    // 3. Shop nachschlagen: erst die feste Datenbank, dann das Register
    let shop = shopFinden(quelle);
    let ausListe = null;

    if (!shop && register) {
      const teile = register.zerlegen(quelle);
      const eintrag = teile ? ausRegister.get(teile.kennung) : null;

      if (eintrag) {
        ausListe = eintrag;
        // Gesperrte Shops sind gesperrt - auch die aus dem Register
        if (eintrag.gesperrt) {
          entfernt.push({ titel: p.title, grund: `Shop ${quelle} gesperrt: ${eintrag.gesperrtGrund || 'ohne Grund'}` });
          continue;
        }
        // Nur als bekannt zaehlen, wenn du ihn auch bewertet hast
        if (eintrag.qualitaet) {
          shop = {
            name: eintrag.name || quelle,
            url: eintrag.domain,
            land: eintrag.land,
            qualitaet: eintrag.qualitaet,
            versand: eintrag.versand
          };
        }
      }
    }

    let qualitaet = shop ? shop.qualitaet : null;

    const shopAbgewertet = shopTrifft(quelle, probleme.shopsAbgewertet);
    if (qualitaet && shopAbgewertet) qualitaet = qualitaetSenken(qualitaet);

    p.shopInfo = {
      bekannt: !!shop,
      name: shop ? shop.name : quelle,
      land: shop ? shop.land : null,
      qualitaet,
      qualitaetScore: shop && shopDb ? shopDb.getShopQualityScore({ qualitaet }) : null,
      versand: shop ? shop.versand : null,
      abgewertet: shopAbgewertet,
      // Im Register erfasst, aber von dir noch nicht bewertet
      imRegister: !!ausListe,
      malGesehen: ausListe ? ausListe.gesehen : null
    };

    behalten.push(p);
  }

  return { produkte: behalten, entfernt };
}

/** Nach einer neuen Meldung sofort wirksam werden lassen */
function listeNeuLaden() {
  listeCache.stand = 0;
}

module.exports = {
  shopFinden,
  zerlegeQuelle,
  anreichernUndFiltern,
  gemeldeteProbleme,
  listeNeuLaden,
  MELDER_FUER_PRODUKT_SPERRE,
  MELDER_FUER_SHOP_ABWERTUNG,
  MELDER_FUER_SHOP_SPERRE
};