// ============================================
// SYNORA - Produktwissen sammeln  (wissenService.js)
// ============================================
// ACHTUNG ZUM DATEINAMEN: Diese Datei hiess frueher
// produktWissen.js - fast gleich wie das Modell Produktwissen.js.
// Windows unterscheidet Gross- und Kleinschreibung bei Dateinamen
// NICHT, also ueberschrieb die eine die andere. Darum jetzt
// eindeutig: wissenService.js fuer den Dienst,
// models/Produktwissen.js fuer das Datenmodell.
// ============================================
// Holt zu einem Produkt zusammen, was Google nicht liefert:
// Bauform, Verbindung, Akkulaufzeit, bekannte Maengel, Bewertungen
// aus anderen Quellen als nur dem einen Shop.
//
// Aufbau als Quellenliste, damit spaeter weitere dazukommen, ohne
// dass der Rest geaendert werden muss. Heute: Perplexity. Geplant:
// Haendlerseiten und die SerpAPI-Produktseite.
//
// KOSTENREGEL: Jedes Produkt wird nur EINMAL nachgeschlagen. Beim
// zweiten Nutzer kommt alles aus der Datenbank. Ohne diese Regel
// waere Stufe 2 das teuerste Stueck der ganzen Kette.
// ============================================

'use strict';

const Produktwissen = require('../models/Produktwissen');

// Nach so vielen Tagen wird ein Produkt neu nachgeschlagen.
// Maengel zeigen sich erst mit der Zeit, darum nicht fuer immer.
const HALTBAR_TAGE = 180;

// Mehr als so viele neue Produkte pro Suche schlagen wir nicht nach.
// Sonst kostet eine einzige Suche zwoelf Abfragen.
const MAX_NEU_PRO_SUCHE = 3;

// ============================================
// SCHLUESSEL
// ============================================
// "Sony WH-CH520 Kopfhörer" bei Galaxus und "Sony WH-CH520
// Wireless Bluetooth" bei Brack sind dasselbe Produkt. Damit sie
// denselben Eintrag treffen, wird der Name eingedampft.

// Auch Bauform-Woerter raus: "SONY WH-CH520 | Over-Ear | Schwarz"
// und "Sony WH-CH520 Kopfhoerer" sind dasselbe Produkt und muessen
// denselben Schluessel bekommen, sonst wird zweimal nachgeschlagen.
const FUELLWOERTER =
  /\b(kopfhörer|kopfhoerer|headphones?|wireless|bluetooth|over|on|in|ear|earbuds?|schwarz|weiss|weiß|black|white|blau|rot|grau|true|neu|original|de|ch|stk)\b/gi;

function schluesselBauen(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[|,–—\-_/()\[\]]/g, ' ')
    .replace(FUELLWOERTER, ' ')
    .replace(/[^a-z0-9äöüß ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 5)          // Marke + Modell reichen
    .join('-');
}

// ============================================
// QUELLEN
// ============================================
// Jede Quelle liefert dieselbe Form zurueck:
//   { eigenschaften: [], bewertungen: [], maengel: [], haltbarkeit }
// Faellt eine aus, machen die anderen weiter.

const quellen = [];

/** Quelle anmelden. Reihenfolge = Reihenfolge der Abfrage. */
function quelleAnmelden(name, funktion) {
  quellen.push({ name, funktion });
}

// ============================================
// QUELLE: SerpAPI-Produktseite
// ============================================
// Geprueft am 23.09.: liefert about_the_product.features (technische
// Daten), ratings (Sterneverteilung) und user_reviews (echte
// Bewertungstexte). Genau das, was der Suchliste fehlt.
//
// KEINE Preise von hier - die kommen aus der normalen Suche.

const axios = require('axios');

/** Aus einem Merkmalstext ableiten, worum es geht */
function merkmalErkennen(text) {
  const t = String(text).toLowerCase();
  if (/\b(over[- ]?ear|on[- ]?ear|in[- ]?ear|earbud)\b/.test(t)) return 'bauform';
  if (/\b(bluetooth|kabellos|wireless|kabelgebunden|klinke|usb-c)\b/.test(t)) return 'verbindung';
  if (/\b\d+\s*(h|std|stunden|hours)\b/.test(t)) return 'akkulaufzeit';
  if (/\b(anc|noise cancel|geräuschunterdrück|geraeuschunterdrueck)\b/.test(t)) return 'geraeuschunterdrueckung';
  if (/\bip[x]?\d/.test(t)) return 'schutzart';
  if (/\b\d+\s*(g|gramm|kg)\b/.test(t)) return 'gewicht';
  if (/\b(garantie|jahre?)\b/.test(t)) return 'garantie';
  return 'merkmal';
}

async function vonSerpapi(name, kategorie, produkt) {
  const token =
    (produkt && (produkt.immersive_product_page_token || produkt.immersiveToken || produkt.produktToken)) || null;

  if (!token) return null;               // ohne Token keine Produktseite
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return null;

  // Abspiel-Modus: nichts Neues holen. Bereits gespeichertes Wissen
  // kommt weiterhin aus der Datenbank.
  if (process.env.ABSPIELEN === '1' || process.env.ABSPIELEN === 'true') return null;

  const antwort = await axios.get('https://serpapi.com/search', {
    params: {
      api_key: apiKey,
      engine: 'google_immersive_product',
      page_token: token,
      gl: 'ch',
      hl: 'de'
    },
    timeout: 20000
  });

  const pr = (antwort.data && antwort.data.product_results) || null;
  if (!pr) return null;

  // ---------- Technische Daten ----------
  const eigenschaften = [];
  const features = (pr.about_the_product && pr.about_the_product.features) || [];
  for (const f of Array.isArray(features) ? features : []) {
    const text = typeof f === 'string' ? f : f && (f.text || f.value || f.name);
    if (!text) continue;
    eigenschaften.push({
      merkmal: merkmalErkennen(text),
      wert: String(text).slice(0, 200),
      sicher: true                        // steht so beim Haendler
    });
  }

  // ---------- Preise anderer Haendler ----------
  // Der wichtigste Schutz vor Faelschungen: Wenn alle anderen
  // Shops 180 Franken verlangen und einer 64, stimmt etwas nicht.
  // Beobachtet am 23.09.: "Apple AirPods 4" fuer CHF 64 bei einem
  // unbekannten Shop landete auf Platz 1.
  const preise = [];
  for (const s of Array.isArray(pr.stores) ? pr.stores : []) {
    const p = Number(s.extracted_price ?? s.extracted_total);
    if (Number.isFinite(p) && p > 0) preise.push(p);
  }

  let preisSpanne = null;
  if (preise.length >= 2) {
    preise.sort((a, b) => a - b);
    const mitte = preise[Math.floor(preise.length / 2)];
    preisSpanne = { min: preise[0], mittel: mitte, max: preise[preise.length - 1], anzahl: preise.length };
    eigenschaften.push({
      merkmal: 'preis_andere_shops',
      wert: `${preise.length} Shops verlangen ${preise[0]} bis ${preise[preise.length - 1]} (Mitte ${mitte})`,
      sicher: true
    });
  }

  // ---------- Bewertungen ----------
  const bewertungen = [];
  if (pr.reviews) {
    bewertungen.push({
      quelle: 'google_produktseite',
      anzahl: Number(pr.reviews) || null,
      schnitt: Number(pr.rating) || null
    });
  }

  // ---------- Sterneverteilung ----------
  // Wichtiger als der Schnitt: Wie viele Leute sind unzufrieden?
  // 8 Prozent Ein-Stern-Bewertungen sagen mehr als "4.5 Sterne".
  let unzufrieden = null;
  if (Array.isArray(pr.ratings) && pr.ratings.length) {
    let gesamt = 0;
    let schlecht = 0;
    for (const r of pr.ratings) {
      const menge = Number(r.amount) || 0;
      gesamt += menge;
      if (Number(r.stars) <= 2) schlecht += menge;
    }
    if (gesamt > 0) {
      unzufrieden = Math.round((schlecht / gesamt) * 100);
      eigenschaften.push({
        merkmal: 'unzufriedene_kaeufer',
        wert: `${unzufrieden} Prozent geben 1 oder 2 Sterne (${schlecht} von ${gesamt})`,
        sicher: true
      });
    }
  }

  // ---------- Kritik aus echten Bewertungen ----------
  const maengel = [];
  for (const r of Array.isArray(pr.user_reviews) ? pr.user_reviews : []) {
    const note = Number(r.rating);
    if (!Number.isFinite(note) || note > 3) continue;   // nur Kritik
    const text = String(r.text || r.title || '').trim();
    if (text.length < 20) continue;
    maengel.push({
      was: text.slice(0, 300),
      wieOft: 'einzelne Bewertung',
      quelle: r.source ? `Bewertung bei ${r.source}` : 'Kundenbewertung'
    });
  }

  return {
    anzeigeName: pr.title || name,
    marke: pr.brand || null,
    eigenschaften,
    bewertungen,
    maengel,
    preisSpanne
  };
}

quelleAnmelden('serpapi_produktseite', vonSerpapi);

// ---------- Perplexity ----------
// Der Auftrag ist eng: KEINE Preise, KEINE Verfuegbarkeit. Das
// kommt nach Regel 1 ausschliesslich von SerpAPI. Perplexity macht
// das, worin es stark ist: lesen, was andere berichten.
try {
  const perplexity = require('./perplexityService');

  if (perplexity && typeof perplexity.produktWissen === 'function') {
    quelleAnmelden('perplexity', (name, kategorie) =>
      perplexity.produktWissen(name, kategorie)
    );
  } else {
    console.warn('[wissen] perplexityService hat noch keine produktWissen() - Quelle inaktiv');
  }
} catch (e) {
  console.warn('[wissen] perplexityService nicht geladen:', e.message);
}

// ============================================
// ZUSAMMENFUEHREN
// ============================================

function zusammenfuehren(bestehend, neu, quellenName) {
  const eintrag = bestehend || {
    eigenschaften: [],
    bewertungen: [],
    maengel: [],
    quellen: []
  };

  const merkmale = new Set(eintrag.eigenschaften.map((e) => e.merkmal));
  for (const e of neu.eigenschaften || []) {
    if (!e.merkmal || !e.wert) continue;
    if (merkmale.has(e.merkmal)) continue;   // erste Quelle gewinnt
    eintrag.eigenschaften.push({ ...e, quelle: e.quelle || quellenName });
    merkmale.add(e.merkmal);
  }

  const bekannt = new Set(eintrag.bewertungen.map((b) => b.quelle));
  for (const b of neu.bewertungen || []) {
    if (!b.quelle || bekannt.has(b.quelle)) continue;
    eintrag.bewertungen.push({ ...b, stand: new Date() });
  }

  const maengelTexte = new Set(eintrag.maengel.map((m) => String(m.was).toLowerCase()));
  for (const m of neu.maengel || []) {
    if (!m.was) continue;
    const t = String(m.was).toLowerCase();
    if (maengelTexte.has(t)) continue;
    eintrag.maengel.push({ ...m, quelle: m.quelle || quellenName });
    maengelTexte.add(t);
  }

  if (neu.anzeigeName && !eintrag.anzeigeName) eintrag.anzeigeName = neu.anzeigeName;
  if (neu.marke && !eintrag.marke) eintrag.marke = neu.marke;
  if (neu.preisSpanne && !eintrag.preisSpanne) eintrag.preisSpanne = neu.preisSpanne;

  if (neu.haltbarkeit && !eintrag.haltbarkeit) {
    eintrag.haltbarkeit = { ...neu.haltbarkeit, quelle: quellenName };
  }

  return eintrag;
}

// ============================================
// HOLEN
// ============================================

function istFrisch(eintrag) {
  if (!eintrag || !eintrag.aktualisiert) return false;
  const tage = (Date.now() - new Date(eintrag.aktualisiert).getTime()) / (1000 * 60 * 60 * 24);
  return tage < HALTBAR_TAGE;
}

/**
 * Wissen zu einem Produkt. Erst aus der Datenbank, nur bei Bedarf
 * von aussen.
 */
async function zuProdukt(name, kategorie, { darfHolen = true, produkt = null } = {}) {
  const schluessel = schluesselBauen(name);
  if (!schluessel) return null;

  let eintrag = null;
  try {
    eintrag = await Produktwissen.findOne({ schluessel });
  } catch (e) {
    console.warn('[wissen] Datenbank nicht erreichbar:', e.message);
    return null;
  }

  if (eintrag) {
    Produktwissen.updateOne({ schluessel }, { $inc: { gesehen: 1 } }).catch(() => {});
    if (istFrisch(eintrag)) return eintrag;
  }

  if (!darfHolen || !quellen.length) return eintrag;

  // ---------- Von aussen holen ----------
  let gesammelt = eintrag ? eintrag.toObject() : null;

  for (const q of quellen) {
    try {
      const ergebnis = await q.funktion(name, kategorie, produkt);
      if (!ergebnis) continue;
      gesammelt = zusammenfuehren(gesammelt, ergebnis, q.name);
      gesammelt.quellen = gesammelt.quellen || [];
      gesammelt.quellen.push({ name: q.name, geholt: new Date(), erfolg: true });
    } catch (e) {
      console.warn(`[wissen] Quelle ${q.name} fehlgeschlagen:`, e.message);
      if (gesammelt) {
        gesammelt.quellen = gesammelt.quellen || [];
        gesammelt.quellen.push({ name: q.name, geholt: new Date(), erfolg: false, hinweis: e.message });
      }
    }
  }

  if (!gesammelt) return null;

  gesammelt.schluessel = schluessel;
  gesammelt.anzeigeName = gesammelt.anzeigeName || name;
  gesammelt.kategorie = gesammelt.kategorie || kategorie || null;
  gesammelt.aktualisiert = new Date();

  // ---------- _id raus, bevor es ins Update geht ----------
  // NEU am 03.10.2026.
  //
  // Weiter oben steht:  let gesammelt = eintrag.toObject();
  // Damit traegt gesammelt die _id des bestehenden Eintrags mit sich.
  // MongoDB nimmt _id in einem Update nicht an - es ist unveraenderlich.
  //
  // Der Fehler landet im catch darunter und erscheint nur als
  // Warnung. Das Wissen wurde dann GEHOLT (und bezahlt), aber nie
  // gespeichert. Beim naechsten Mal wird es wieder geholt, wieder
  // bezahlt, wieder nicht gespeichert.
  //
  // Betroffen ist jeder Eintrag, der aufgefrischt wird: aelter als
  // 180 Tage, oder ohne gesetztes "aktualisiert". Heute faellt es
  // nicht auf, weil dein Wissen aus dem September stammt. Im Maerz
  // waere es eine stille Dauerrechnung.
  delete gesammelt._id;
  delete gesammelt.__v;

  try {
    await Produktwissen.findOneAndUpdate({ schluessel }, gesammelt, { upsert: true, new: true });
  } catch (e) {
    console.warn('[wissen] nicht gespeichert:', e.message);
  }

  return gesammelt;
}

/**
 * Wissen zu mehreren Produkten. Bekannte kommen sofort, fuer
 * unbekannte wird hoechstens MAX_NEU_PRO_SUCHE mal nachgeschlagen -
 * die uebrigen bleiben ohne Zusatzwissen, statt die Suche zu
 * verteuern und zu verlangsamen.
 */
async function zuListe(produkte, kategorie) {
  const ergebnis = new Map();
  const fehlen = [];

  // ---------- Erst alles, was wir schon kennen ----------
  for (const p of produkte || []) {
    const name = p.title || p.name;
    if (!name) continue;

    const bekannt = await zuProdukt(name, kategorie, { darfHolen: false });
    if (bekannt && istFrisch(bekannt)) {
      ergebnis.set(p.id, bekannt);
    } else if (fehlen.length < MAX_NEU_PRO_SUCHE) {
      fehlen.push({ p, name });
    }
  }

  if (!fehlen.length) return ergebnis;

  // ---------- Fehlende GLEICHZEITIG holen ----------
  // Nacheinander waren das am 24.09. bis zu 60 Sekunden: drei
  // Abfragen mal zwanzig Sekunden Zeitgrenze. Gleichzeitig dauert
  // es so lang wie die langsamste einzelne.
  const geholt = await Promise.allSettled(
    fehlen.map(({ p, name }) => zuProdukt(name, kategorie, { darfHolen: true, produkt: p }))
  );

  let anzahl = 0;
  geholt.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      ergebnis.set(fehlen[i].p.id, r.value);
      anzahl += 1;
    } else if (r.status === 'rejected') {
      console.warn('[wissen] nicht geholt:', r.reason && r.reason.message);
    }
  });

  if (anzahl) console.log(`[wissen] ${anzahl} Produkte neu nachgeschlagen (gleichzeitig)`);
  return ergebnis;
}

// Diese Merkmale zuerst - sie entscheiden ueber die Empfehlung.
// Der Rest ist nett, aber nicht wichtig genug fuer den Prompt.
const WICHTIGE_MERKMALE = [
  'bauform', 'verbindung', 'akkulaufzeit', 'geraeuschunterdrueckung',
  'schutzart', 'gewicht', 'unzufriedene_kaeufer', 'preis_andere_shops'
];

const MAX_ZEILEN = 8;
const MAX_MANGEL_LAENGE = 160;

/**
 * Fuer den Prompt: kurz und mit Quelle.
 *
 * WARUM GEKUERZT: Am 24.09. lief eine Suche 86 Sekunden und beide
 * Modelle stiegen aus. Grund: 11 Produkte mit vollem Wissen machten
 * die Anfrage zu gross. Mehr Daten sind nicht automatisch besser -
 * eine Antwort, die nie ankommt, nuetzt niemandem.
 */
function alsText(wissen) {
  if (!wissen) return null;
  const zeilen = [];

  // Wichtige Merkmale zuerst, dann der Rest
  const eig = [...(wissen.eigenschaften || [])].sort((a, b) => {
    const ia = WICHTIGE_MERKMALE.indexOf(a.merkmal);
    const ib = WICHTIGE_MERKMALE.indexOf(b.merkmal);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  for (const e of eig) {
    if (zeilen.length >= MAX_ZEILEN - 2) break;   // Platz fuer Bewertung und Mangel lassen
    zeilen.push(`${e.merkmal}: ${String(e.wert).slice(0, 120)}`);
  }

  const b = (wissen.bewertungen || [])[0];
  if (b && b.anzahl) zeilen.push(`${b.quelle}: ${b.schnitt || '?'} aus ${b.anzahl} Bewertungen`);

  // Nur EIN Mangel - der erste ist der aussagekraeftigste
  const m = (wissen.maengel || [])[0];
  if (m) zeilen.push(`Kundenkritik: ${String(m.was).slice(0, MAX_MANGEL_LAENGE)}`);

  if (wissen.haltbarkeit && wissen.haltbarkeit.hinweis && zeilen.length < MAX_ZEILEN) {
    zeilen.push(`Haltbarkeit: ${String(wissen.haltbarkeit.hinweis).slice(0, 120)}`);
  }

  return zeilen.length ? zeilen.slice(0, MAX_ZEILEN).join('\n') : null;
}

/**
 * Ist dieser Preis verdaechtig weit unter dem, was andere Shops
 * verlangen? Unter der Haelfte des mittleren Preises ist bei
 * Markenware ein deutliches Warnzeichen.
 *
 * @returns {string|null} Warnung im Klartext
 */
function preisVerdaechtig(produkt, wissen) {
  const spanne = wissen && wissen.preisSpanne;
  if (!spanne || !spanne.mittel || spanne.anzahl < 2) return null;

  const preis = typeof produkt.priceValue === 'number' ? produkt.priceValue : null;
  if (!preis || preis <= 0) return null;

  const anteil = preis / spanne.mittel;
  if (anteil >= 0.5) return null;

  return `Dieses Angebot kostet ${preis} Franken, andere Shops verlangen um ${spanne.mittel}. `
    + 'Das ist ungewoehnlich weit darunter - bei Markenware ein Hinweis auf Faelschung '
    + 'oder darauf, dass nicht das vollstaendige Produkt geliefert wird.';
}

module.exports = {
  zuProdukt,
  preisVerdaechtig,
  zuListe,
  alsText,
  schluesselBauen,
  quelleAnmelden,
  HALTBAR_TAGE,
  MAX_NEU_PRO_SUCHE
};