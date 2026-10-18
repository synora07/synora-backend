// ============================================
// SYNORA - Perplexity als Wissensquelle (Stufe 2)
// ============================================
// WAS DIESE DATEI DARF UND WAS NICHT
//
// Darf:   Was andere Kaeufer berichten. Bekannte Maengel.
//         Haltbarkeit. Technische Eigenschaften mit Quelle.
//
// Darf NICHT: Preise. Verfuegbarkeit. Shops. Lieferzeiten.
//         Das ist Regel 1 und die steht ueber allem: Preise und
//         Verfuegbarkeit kommen AUSSCHLIESSLICH von SerpAPI,
//         niemals von einem Sprachmodell. Ein Modell, das einen
//         Preis nennt, hat ihn geraten - und wir haften dafuer.
//
// WIE REGEL 1 DURCHGESETZT WIRD
//
// Nicht ueber den Prompt. Ein Modell haelt sich nicht immer an
// Anweisungen, und in der ersten Fassung dieser Datei stand im
// Prompt sogar ausdruecklich "Echte Preise von Online-Shops".
//
// Es wird JEDES Textfeld geprueft, bevor es weitergereicht wird.
// Eine erste Fassung des Filters prueft nur merkmal, wert, was und
// hinweis - und liess sechs Felder offen. Gemessen ist der Weg bis
// ganz nach vorn:
//
//   Modell liefert:  "quelle": "Digitec (Fr. 199.90, ab Lager)"
//   produktWissen.zusammenfuehren() uebernimmt es
//   alsText() baut daraus:
//     "Digitec (Fr. 199.90, ab Lager): 4.3 aus 412 Bewertungen"
//   und genau dieser Text geht in den Prompt fuer die Antwort.
//
// Ein erfundener Preis stand damit wortwoertlich in dem Text, aus
// dem die Nutzerantwort entsteht. Jetzt laufen ALLE Textfelder
// durch pruefeZeile(): anzeigeName, marke, merkmal, wert, quelle,
// was, wieOft, hinweis.
//
// Der Filter ist absichtlich zu streng. Er wirft auch "guenstig zu
// reparieren" und "Lagerung an trockenem Ort" weg, obwohl das keine
// Preise sind. Lieber ein Satz zu wenig als ein geratener Preis auf
// deiner Seite, fuer den du haftest.
//
// DEN MODELLNAMEN NICHT RATEN
//
// Unten steht "sonar" als Vorgabe, aber ungeprueft. Raten hat uns
// schon zwei Durchlaeufe gekostet, darum liegt daneben ein
// Messwerkzeug:
//
//      node scripts/testPerplexity.js
//
// Das fragt Perplexity selbst und sagt, was in die .env gehoert:
//
//      PERPLEXITY_MODELL=<was das Skript ausgibt>
// ============================================

'use strict';

const axios = require('axios');

const API_URL = 'https://api.perplexity.ai/chat/completions';
const API_KEY = process.env.PERPLEXITY_API_KEY;

// Vorgabe, aber nicht geprueft - siehe Kopf der Datei.
const MODELL = process.env.PERPLEXITY_MODELL || 'sonar';

// Eine leere oder unsinnige Zeile in der .env darf nicht zu NaN
// werden. Bei einem Zeitlimit von NaN kennt axios gar kein Limit
// mehr, und eine haengende Anfrage haelt den ganzen Durchlauf auf.
function zahl(name, vorgabe, minimum) {
  const roh = process.env[name];
  if (roh === undefined || String(roh).trim() === '') return vorgabe;
  const wert = Number(roh);
  if (!Number.isFinite(wert) || wert < minimum) {
    console.warn(`[perplexity] ${name}="${roh}" ist unbrauchbar - es gilt ${vorgabe}`);
    return vorgabe;
  }
  return wert;
}

const ZEITLIMIT_MS = zahl('PERPLEXITY_ZEITLIMIT_MS', 25000, 1000);
const CACHE_STUNDEN = zahl('PERPLEXITY_CACHE_STUNDEN', 24, 0);

if (!API_KEY) {
  console.warn('[perplexity] PERPLEXITY_API_KEY fehlt - die Wissensquelle bleibt stumm.');
}

// ============================================
// Cache - Guthaben ist knapp
// ============================================
// Dasselbe Produkt taucht im Pruefkatalog mehrfach auf.
//
// WICHTIG: auch ein LEERES Ergebnis wird gespeichert. Vorher wurde
// zwar null hineingeschrieben, beim Lesen aber als "nichts
// gefunden" behandelt - und genau die Produkte, zu denen Perplexity
// nichts weiss, wurden bei jedem Vorkommen neu bezahlt. Gemessen:
// fuenf gleiche Fragen, fuenf Abfragen statt einer.

const cache = new Map();

function ausCache(schluessel) {
  if (!cache.has(schluessel)) return undefined;   // gar nichts gespeichert
  const eintrag = cache.get(schluessel);
  if (Date.now() > eintrag.bis) {
    cache.delete(schluessel);
    return undefined;
  }
  return eintrag.wert;                            // darf null sein
}

function inCache(schluessel, wert) {
  if (CACHE_STUNDEN <= 0) return;
  cache.set(schluessel, { wert, bis: Date.now() + CACHE_STUNDEN * 3600 * 1000 });
}

// ============================================
// Der Filter - Regel 1 wird hier durchgesetzt
// ============================================
// Bewusst OHNE Wortgrenze am Anfang. Deutsche Komposita haben den
// Filter sonst umgangen: "Verkaufspreis", "Neupreis",
// "Lieferbarkeit", "Onlineverfuegbarkeit" - alle kamen durch, weil
// \bpreis\b nicht auf "Verkaufspreis" passt.

const PREIS_MUSTER = [
  /chf/i,
  /franken/i,
  /\bsfr\b/i,
  /\bfr\.?\s*\d/i,
  /\beuro?\b/i,
  /\busd\b/i,
  /\bgbp\b/i,
  /[€£$]/,
  /preis/i,                       // Preis, Verkaufspreis, Neupreis, Preisklasse
  /kostet|kostenpunkt/i,
  /marktwert/i,
  /rabatt/i,
  /angebot/i,
  /\buvp\b/i,
  /g(?:ue|ü)nstig/i,
  /teuer/i,
  // 299.-  299.–  1'299.—
  /\d[\d'’’.,\s]*[.,]\s*[-‐-―]/
];

const VERFUEGBARKEIT_MUSTER = [
  /lager/i,                       // Lager, ab Lager, Lagerbestand
  /verf(?:ue|ü)gbar/i,            // verfuegbar, Onlineverfuegbarkeit
  /lieferbar|lieferzeit|lieferung/i,
  /versand/i,
  /ausverkauft/i,
  /vergriffen/i,
  /restposten/i,
  /vorbestell/i,
  /erh(?:ae|ä)ltlich/i,
  /bestellbar/i,
  /vorr(?:ae|ä)tig/i
];

function kurz(text, max = 220) {
  // Nur echte Zeichenketten. Bei einem Objekt kam frueher
  // "[object Object]" im anzeigeName an.
  if (typeof text !== 'string' && typeof text !== 'number') return '';
  return String(text)
    .replace(/\[\d+\]/g, '')   // Quellenmarker von Perplexity: "30 Stunden [1]"
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * true = die Zeile ist sauber und darf durch.
 * Jedes Textfeld laeuft hier durch, nicht nur ein paar.
 */
function istSauber(text) {
  if (typeof text !== 'string' || !text.trim()) return false;
  for (const m of PREIS_MUSTER) if (m.test(text)) return false;
  for (const m of VERFUEGBARKEIT_MUSTER) if (m.test(text)) return false;
  return true;
}

/**
 * Kuerzen und pruefen in einem Schritt. Gibt den sauberen Text
 * zurueck oder null - und zaehlt mit, was verworfen wurde.
 */
function sauberesFeld(roh, max, zaehler) {
  const text = kurz(roh, max);
  if (!text) return null;
  if (!istSauber(text)) {
    zaehler.verworfen += 1;
    return null;
  }
  return text;
}

// ============================================
// Antwort einlesen
// ============================================

function jsonLesen(roh) {
  if (typeof roh !== 'string' || !roh.trim()) return null;

  let text = roh.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

  const von = text.indexOf('{');
  const bis = text.lastIndexOf('}');
  if (von === -1 || bis === -1 || bis <= von) return null;
  text = text.slice(von, bis + 1);

  try {
    return JSON.parse(text);
  } catch (_) {
    // Quellenmarker wie [1] entfernen. Trifft absichtlich nur
    // einzelne Zahlen ohne Leerzeichen - echte Zahlenlisten
    // ([1, 2]) bleiben unangetastet.
    try {
      return JSON.parse(text.replace(/\[\d+\]/g, ''));
    } catch (_) {
      return null;
    }
  }
}

// ============================================
// Der Prompt
// ============================================

const SYSTEM_PROMPT = `Du recherchierst Produktwissen fuer einen Schweizer Einkaufsberater.

WAS DU LIEFERST:
- Technische Eigenschaften, die belegbar sind
- Was Kaeufer in Tests und Rezensionen berichten
- Bekannte Schwaechen und haeufige Beschwerden
- Wie lange das Produkt erfahrungsgemaess haelt

WAS DU NIEMALS LIEFERST:
- Keine Preise, keine Preisspannen, keine Rabatte, keine Waehrungen
- Keine Verfuegbarkeit, keine Lieferzeiten, keine Shops
- Keine Kaufempfehlung

Das gilt fuer JEDES Feld, auch fuer Quellenangaben. Schreib
"Shop-Rezensionen", nicht "Digitec (Fr. 199.90)".

Preise und Verfuegbarkeit kommen aus einer anderen Quelle. Nennst du
sie, wird das ganze Feld verworfen.

REGELN:
- Nur, was du wirklich findest. Nichts ergaenzen, nichts schaetzen.
- Findest du zu einem Punkt nichts, gib eine leere Liste zurueck.
  Eine leere Liste ist eine richtige Antwort.
- Zu jedem Punkt die Quelle nennen (Testportal, Magazin, Shop-Rezensionen).
- Mangel nur nennen, wenn er mehrfach berichtet wird - nicht bei
  einer einzelnen Stimme.
- Antworte AUSSCHLIESSLICH mit JSON. Kein Text davor, keiner danach.

FORMAT:
{
  "anzeigeName": "Name wie er ueblich geschrieben wird",
  "marke": "Hersteller oder null",
  "eigenschaften": [
    { "merkmal": "Akkulaufzeit", "wert": "ca. 30 Stunden", "sicher": true, "quelle": "Herstellerangabe" }
  ],
  "bewertungen": [
    { "quelle": "Galaxus", "anzahl": 412, "schnitt": 4.3 }
  ],
  "maengel": [
    { "was": "Buegel bricht bei haeufigem Zusammenklappen", "wieOft": "mehrfach berichtet", "quelle": "Amazon-Rezensionen" }
  ],
  "haltbarkeit": { "hinweis": "Akku laesst nach ca. 3 Jahren nach", "quelle": "Langzeittest c't" }
}

"sicher": true nur bei Herstellerangabe oder Testbericht. Bei
Rezensionen false.`;

// ============================================
// WIEDERHOLEN BEI 429 - neu am 04.10.2026
// ============================================
// Bis heute galt ein 429 als endgueltig: die Anfrage wurde
// verworfen, das Produkt blieb ohne Wissen, und im Log stand
// "Zu viele Anfragen oder Guthaben leer". Dieser Satz war das
// eigentliche Problem - er raet, statt zu sagen, was Perplexity
// geantwortet hat. Darum sah es nach einem Geldproblem aus,
// obwohl Guthaben da ist.
//
// Ein 429 kommt schnell zurueck, nicht nach 25 Sekunden. Einmal
// kurz warten und es nochmal versuchen kostet darum fast nichts
// und rettet die meisten Faelle.
//
// WAS NICHT WIEDERHOLT WIRD
//   400/401  Modellname oder Schluessel falsch. Ein zweiter
//            Versuch aendert daran nichts.
//   Zeitlimit  Der teure Fall. Noch 25 Sekunden dranhaengen
//            laesst die ganze Suche haengen.
//
// Gewartet wird hoechstens WARTE_DECKEL_MS. Sagt Perplexity per
// Retry-After, es dauert laenger, geben wir auf - der Nutzer
// wartet sonst in einem Chat auf eine Nebensache.

const VERSUCHE_MAX = 3;
const WARTE_DECKEL_MS = 5000;

function schlafen(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Wie lange warten? Retry-After hat Vorrang, sonst 1s, 3s. */
function wartezeit(antwortKopf, versuch) {
  const roh = antwortKopf && (antwortKopf['retry-after'] || antwortKopf['Retry-After']);
  const vonServer = Number(roh) * 1000;
  if (Number.isFinite(vonServer) && vonServer > 0) return vonServer;

  // Zufallsanteil, damit die drei gleichzeitigen Anfragen nicht
  // alle im selben Moment wieder losrennen.
  return versuch * 1000 + Math.floor(Math.random() * 400);
}

async function anfrageSenden(koerper, sauber) {
  let letzterFehler = null;

  for (let versuch = 1; versuch <= VERSUCHE_MAX; versuch++) {
    try {
      return await axios.post(API_URL, koerper, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        timeout: ZEITLIMIT_MS
      });
    } catch (e) {
      letzterFehler = e;
      const status = e.response && e.response.status;
      const nochmal = status === 429 || (status >= 500 && status < 600);

      // Wie oft wirklich versucht wurde. Ohne diese Zahl meldet
      // der Aufrufer "nach 3 Versuchen", auch wenn nach dem
      // ersten aufgegeben wurde - und eine Meldung, die nicht
      // stimmt, schickt dich bei der Fehlersuche in die Irre.
      e.versuche = versuch;

      if (!nochmal || versuch === VERSUCHE_MAX) throw e;

      const warten = wartezeit(e.response && e.response.headers, versuch);
      if (warten > WARTE_DECKEL_MS) {
        console.warn(`[perplexity] ${status}: Perplexity bittet um ${Math.round(warten / 1000)}s Pause - zu lang, aufgegeben.`);
        throw e;
      }

      console.log(`[perplexity] ${status} bei "${sauber}" - warte ${warten}ms, Versuch ${versuch + 1}/${VERSUCHE_MAX}`);
      await schlafen(warten);
    }
  }

  throw letzterFehler;
}

// ============================================
// produktWissen - das, wonach wissenService.js sucht
// ============================================

async function produktWissen(name, kategorie) {
  if (!API_KEY) return null;
  if (typeof name !== 'string' || name.trim().length < 3) return null;

  const sauber = name.trim().slice(0, 140);
  const schluessel = `${sauber}|${kategorie || ''}`.toLowerCase();

  const gespeichert = ausCache(schluessel);
  if (gespeichert !== undefined) return gespeichert;

  const frage = kategorie
    ? `Produkt: "${sauber}" (Kategorie: ${kategorie})`
    : `Produkt: "${sauber}"`;

  try {
    const antwort = await anfrageSenden({
      model: MODELL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${frage}\n\nAntworte im vorgegebenen JSON-Format.` }
      ],
      temperature: 0.1,
      max_tokens: 900
    }, sauber);

    const roh = antwort && antwort.data && antwort.data.choices && antwort.data.choices[0]
      ? antwort.data.choices[0].message && antwort.data.choices[0].message.content
      : null;

    const daten = jsonLesen(roh);

    if (!daten || typeof daten !== 'object' || Array.isArray(daten)) {
      console.log(`[perplexity] "${sauber}": Antwort nicht lesbar`);
      inCache(schluessel, null);
      return null;
    }

    // Der Zaehler gehoert zu DIESEM Aufruf, nicht zum Modul. Ein
    // modulweiter Zaehler hat bei parallelen Anfragen die Zahlen
    // der einen Anfrage der anderen zugeschrieben.
    const zaehler = { verworfen: 0 };
    const ergebnis = aufraeumen(daten, zaehler);

    if (zaehler.verworfen > 0) {
      console.log(`[perplexity] "${sauber}": ${zaehler.verworfen} Feld(er) wegen Preis/Verfuegbarkeit verworfen`);
    }

    const leer =
      !ergebnis.eigenschaften.length &&
      !ergebnis.bewertungen.length &&
      !ergebnis.maengel.length &&
      !ergebnis.haltbarkeit;

    const wert = leer ? null : ergebnis;
    inCache(schluessel, wert);
    return wert;

  } catch (e) {
    const status = e.response && e.response.status;
    const grund = (e.response && e.response.data && e.response.data.error && e.response.data.error.message) || e.message;

    if (status === 400 && /model/i.test(String(grund))) {
      console.error(`[perplexity] Modellname "${MODELL}" wird abgelehnt.`);
      console.error('[perplexity] Fuehre aus: node scripts/testPerplexity.js');
      console.error('[perplexity] und trag das Ergebnis als PERPLEXITY_MODELL in die .env ein.');
    } else if (status === 401) {
      console.error('[perplexity] Schluessel abgelehnt (401). PERPLEXITY_API_KEY pruefen.');
    } else if (status === 429) {
      // ============================================
      // NICHT RATEN - ZEIGEN
      // ============================================
      // Hier stand bis zum 04.10.2026 "Zu viele Anfragen oder
      // Guthaben leer". Dieser Satz nennt zwei verschiedene
      // Ursachen und entscheidet sich fuer keine - obwohl
      // Perplexity im Fehlertext genau sagt, welche es ist.
      //
      // Folge: es sah nach einem Geldproblem aus, obwohl das
      // Guthaben da war. Eine Fehlermeldung, die raet, ist
      // schlimmer als keine - man sucht an der falschen Stelle.
      //
      // Jetzt steht hier, was Perplexity WIRKLICH geantwortet hat.
      const wieOft = e.versuche || 1;
      console.error(`[perplexity] 429 bei "${sauber}" - aufgegeben nach ${wieOft} Versuch${wieOft > 1 ? 'en' : ''}.`);
      console.error(`[perplexity] Perplexity sagt: ${kurz(grund, 160)}`);
      console.error('[perplexity] Steht dort "rate limit", ist es die Anfragerate - kein Geldproblem.');
    } else {
      console.error(`[perplexity] "${sauber}": ${status || ''} ${kurz(grund, 120)}`);
    }

    // Kein Cache bei Fehlern - beim naechsten Mal neu versuchen.
    return null;
  }
}

// ============================================
// Aufraeumen und filtern
// ============================================
// JEDES Textfeld laeuft durch sauberesFeld(). Auch quelle, wieOft,
// anzeigeName und marke - genau die waren das Leck.

function aufraeumen(daten, zaehler) {
  const eigenschaften = [];
  if (Array.isArray(daten.eigenschaften)) {
    for (const e of daten.eigenschaften.slice(0, 12)) {
      if (!e || typeof e !== 'object') continue;
      const merkmal = sauberesFeld(e.merkmal, 60, zaehler);
      const wert = sauberesFeld(e.wert, 120, zaehler);
      if (!merkmal || !wert) continue;
      eigenschaften.push({
        merkmal,
        wert,
        sicher: e.sicher === true,
        quelle: sauberesFeld(e.quelle, 80, zaehler)
      });
    }
  }

  const bewertungen = [];
  if (Array.isArray(daten.bewertungen)) {
    for (const b of daten.bewertungen.slice(0, 6)) {
      if (!b || typeof b !== 'object') continue;
      const quelle = sauberesFeld(b.quelle, 60, zaehler);
      const anzahl = Number(b.anzahl);
      const schnitt = Number(b.schnitt);
      if (!quelle) continue;
      if (!Number.isFinite(anzahl) || anzahl < 1) continue;
      if (!Number.isFinite(schnitt) || schnitt < 0 || schnitt > 5) continue;
      bewertungen.push({ quelle, anzahl: Math.round(anzahl), schnitt: Math.round(schnitt * 10) / 10 });
    }
  }

  const maengel = [];
  if (Array.isArray(daten.maengel)) {
    for (const m of daten.maengel.slice(0, 8)) {
      if (!m || typeof m !== 'object') continue;
      const was = sauberesFeld(m.was, 160, zaehler);
      if (!was) continue;
      maengel.push({
        was,
        wieOft: sauberesFeld(m.wieOft, 60, zaehler),
        quelle: sauberesFeld(m.quelle, 80, zaehler)
      });
    }
  }

  let haltbarkeit = null;
  if (daten.haltbarkeit && typeof daten.haltbarkeit === 'object' && !Array.isArray(daten.haltbarkeit)) {
    const hinweis = sauberesFeld(daten.haltbarkeit.hinweis, 160, zaehler);
    if (hinweis) {
      haltbarkeit = { hinweis, quelle: sauberesFeld(daten.haltbarkeit.quelle, 80, zaehler) };
    }
  }

  return {
    anzeigeName: sauberesFeld(daten.anzeigeName, 120, zaehler),
    marke: sauberesFeld(daten.marke, 60, zaehler),
    eigenschaften,
    bewertungen,
    maengel,
    haltbarkeit
    // preisSpanne gibt es hier absichtlich nicht. Regel 1.
  };
}

// ============================================
// healthCheck
// ============================================

async function healthCheck() {
  if (!API_KEY) {
    return { ok: false, modell: MODELL, grund: 'PERPLEXITY_API_KEY fehlt' };
  }
  try {
    await axios.post(
      API_URL,
      { model: MODELL, messages: [{ role: 'user', content: 'ok' }], max_tokens: 5 },
      { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` }, timeout: 15000 }
    );
    return { ok: true, modell: MODELL };
  } catch (e) {
    return {
      ok: false,
      modell: MODELL,
      status: e.response && e.response.status,
      grund: kurz((e.response && e.response.data && e.response.data.error && e.response.data.error.message) || e.message, 140)
    };
  }
}

// ============================================
// Alte Exporte - stillgelegt, nicht geloescht
// ============================================
// Diese vier Funktionen haben frueher nach Preisen und
// Verfuegbarkeit gefragt. Beides verstoesst gegen Regel 1. Sie
// bleiben als leere Huelle bestehen, damit alter Code, der sie noch
// aufruft, nicht abstuerzt - er bekommt nur nichts mehr zurueck.
// Taucht eine dieser Zeilen im Log auf, weisst du, wo noch
// aufzuraeumen ist.

function stillgelegt(name) {
  console.log(`[perplexity] ${name}() ist stillgelegt (Regel 1). Aufrufer pruefen.`);
  return null;
}

module.exports = {
  produktWissen,
  healthCheck,

  getProductRecommendation: async () => stillgelegt('getProductRecommendation'),
  verifyPrice:              async () => stillgelegt('verifyPrice'),
  findReviews:              async () => stillgelegt('findReviews'),
  findDeals:                async () => stillgelegt('findDeals')
};