// ============================================
// SYNORA V2.0 - Chat Controller
// ============================================
//
// Aenderungen gegenueber V1:
// 1. Kein Raten mehr ueber Produktnamen. Jedes Produkt bekommt eine ID,
//    Claude gibt IDs zurueck, der Controller schlaegt nach.
//    -> behebt fehlende Bilder, fehlende Preise und tote Shop-Links
// 2. Budget wird ausgelesen und als harter Filter angewendet
//    -> "Budget ist eine Wand" gilt jetzt auch im Code
// 3. Jedes Feld, das ins Frontend geht, ist garantiert Text
//    -> behebt [object Object]
// 4. Kein erfundener Begruendungstext mehr, wenn die KI ausfaellt
// ============================================

'use strict';

const crypto = require('crypto');
const claudeService = require('../services/claudeService');
const serpApiService = require('../services/serpApiService');
const ProduktKlick = require('../models/ProduktKlick');
const cache = require('../services/cacheService');
const preisVerlauf = require('../services/preisVerlaufService');
const Analytics = require('../models/Analytics');
const shopBewertung = require('../services/shopBewertung');
const shopKategorien = require('../services/shopKategorien');
const anforderungen = require('../services/anforderungen');
const rueckfrage = require('../services/rueckfrage');
const rueckfrageSchlau = require('../services/rueckfrageSchlau');
const mitschrieb = require('../services/mitschrieb');
const faktenpruefung = require('../services/faktenpruefung');
const produktWissen = require('../services/wissenService');
const konsens = require('../services/konsens');
const kostenbremse = require('../services/kostenbremse');

// Basis-URL dieses Servers - die Klick-Links muessen absolut sein,
// weil das Frontend auf einer anderen Domain liegt.
const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

// ============================================
// TEXT-HILFEN
// Nichts, was das Frontend rendert, darf ein Objekt sein.
// ============================================

const TEXT_KEYS = ['text', 'value', 'wert', 'grund', 'reason', 'begruendung', 'beschreibung', 'name', 'titel'];

function toText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : fallback;
  if (typeof value === 'boolean') return value ? 'ja' : 'nein';
  if (Array.isArray(value)) {
    const teile = value.map((v) => toText(v, '')).filter(Boolean);
    return teile.length ? teile.join(' ') : fallback;
  }
  if (typeof value === 'object') {
    for (const key of TEXT_KEYS) {
      if (key in value) {
        const t = toText(value[key], '');
        if (t) return t;
      }
    }
    return fallback;
  }
  return fallback;
}

function toList(value, max = 3) {
  if (!value) return [];
  const roh = Array.isArray(value) ? value : [value];
  return roh
    .map((e) => toText(e, ''))
    .map((s) => s.replace(/^[-•*\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, max);
}

function ohneIds(text) {
  // 1. IDs in Klammern sind Beiwerk: "Sennheiser HD 25 (p_10)" -> weg
  let t = text.replace(/\s*\(\s*p_\d{1,3}(?:\s*[\/,]\s*p_\d{1,3})*\s*\)/gi, '');

  // 2. Steht eine ID frei im Satz, wird sie als Wort benutzt:
  //    "Nur p_10 und p_06 stammen von Amazon". Loescht man nur die ID,
  //    bleibt "Nur und stammen von Amazon" - Unsinn. Solche Saetze
  //    sagen dem Nutzer ohnehin nichts, also ganz raus.
  t = t
    .split(/(?<=[.!?])\s+/)
    .filter((satz) => !/\bp_\d{1,3}\b/i.test(satz))
    .join(' ');

  return t.replace(/\s+([,.;:!?])/g, '$1').replace(/ {2,}/g, ' ');
}

/**
 * Produkt-IDs durch die echten Namen ersetzen.
 *
 * Besser als loeschen: "Guenstiger als p_02" wird zu "Guenstiger
 * als JLAB Go Air Pop". Vorher flog der ganze Satz raus - und bei
 * der Zusammenfassung blieb dadurch gar nichts uebrig.
 */
function idsErsetzen(text, nachId) {
  if (!text || !nachId) return text;
  return String(text).replace(/\bp_(\d{1,3})\b/gi, (treffer) => {
    const p = nachId.get(treffer.toLowerCase()) || nachId.get(treffer);
    if (!p) return treffer;
    const name = String(p.title || p.name || '').split(/[|,–]/)[0].trim();
    return name || treffer;
  });
}

function cleanText(text) {
  // Produkt-IDs raus. Die Regel steht im Prompt, aber das Modell
  // haelt sich nicht zuverlaessig daran - also hier abfangen.
  return ohneIds(toText(text, ''))
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .trim();
}

// ============================================
// WAEHRUNGSWOERTER
// ============================================
// Eine Liste fuer beide Zwecke: das Budget erkennen UND die
// Preisangabe aus dem Suchbegriff entfernen. Frueher standen zwei
// verschiedene Listen im Code, und "stutz" fehlte in beiden.
//
// Gemessen am 28.09. im Pruefkatalog:
//   "hab was gesucht zum Gamen, so 60 stutz"
//       -> kein Budget erkannt -> keine Wand -> CHF 146 durchgelassen
//   "hab was gesucht fuer kleine Haende, so 80 stutz"
//       -> dasselbe, CHF 167 durchgelassen
//
// "Stutz" ist im Schweizer Alltag das normale Wort fuer Franken.
// Wer so schreibt, meint ein Budget - und Regel 4 sagt, dass
// nichts darueber gezeigt wird.
const WAEHRUNG = "(?:chf|franken|franke|fr\\b\\.?|st(?:u|\u00fc|ue)tz(?:li)?|eur|euro|\u20ac)";

// ============================================
// BUDGET AUS DER ANFRAGE LESEN
// Provisorium, bis Stufe 1 (Absicht verstehen) gebaut ist.
// Erkennt: "bis 1000", "unter CHF 500", "max. 200.-", "1'500 Franken"
// ============================================
function extrahiereBudget(text) {
  if (!text) return null;
  const s = String(text).toLowerCase();

  // Die Muster werden aus WAEHRUNG gebaut, damit ein neues
  // Waehrungswort nur an EINER Stelle nachgetragen werden muss.
  const muster = [
    // "bis 200", "unter CHF 500", "max. 200.-", "nicht mehr als 80 Stutz"
    new RegExp("(?:bis|unter|max(?:imal)?\\.?|hoechstens|h\u00f6chstens|nicht mehr als)\\s*" + WAEHRUNG + "?\\s*([\\d'\u2019.,]+)", "i"),
    // "50 Franken", "60 stutz", "1200 fr", "1'500.-"
    new RegExp("([\\d'\u2019.,]+)\\s*(?:" + WAEHRUNG + "|\\.-)", "i"),
    // "Budget etwa 160"
    /budget[^\d]{0,15}([\d'’.,]+)/i
  ];

  for (const m of muster) {
    const treffer = s.match(m);
    if (!treffer) continue;

    const zahl = zuZahl(treffer[1]);
    if (zahl && zahl >= 5 && zahl <= 100000) return zahl;
  }

  return null;
}

function zuZahl(roh) {
  if (!roh) return null;
  const sauber = String(roh).replace(/['’\s]/g, '');
  const letztesKomma = sauber.lastIndexOf(',');
  const letzterPunkt = sauber.lastIndexOf('.');

  let normalisiert;
  if (letztesKomma > letzterPunkt) {
    normalisiert = sauber.replace(/\./g, '').replace(',', '.');
  } else if (letzterPunkt > letztesKomma) {
    normalisiert = sauber.replace(/,/g, '');
  } else {
    normalisiert = sauber;
  }

  const zahl = Number.parseFloat(normalisiert);
  return Number.isFinite(zahl) ? zahl : null;
}

// ============================================
// SUCHBEGRIFF AUS DER ANFRAGE BAUEN
// Google Shopping sucht woertlich. "Kopfhoerer bis 200 Franken"
// findet nichts, "Kopfhoerer" findet 40 Produkte.
// Provisorium, bis Stufe 1 (Absicht verstehen) gebaut ist.
// ============================================

function sucheBegriff(text) {
  if (!text) return '';
  let s = String(text);

  // Budget- und Preisangaben entfernen
  s = s.replace(new RegExp("\\b(?:bis|unter|max(?:imal)?\\b\\.?|hoechstens|h\u00f6chstens|nicht mehr als)\\s*" + WAEHRUNG + "?\\s*[\\d'\u2019.,]+\\s*(?:" + WAEHRUNG + "|\\.-|-)?", "gi"), ' ');
  s = s.replace(new RegExp("\\bbudget\\b[^\\w]*[\\d'\u2019.,]*\\s*" + WAEHRUNG + "?", "gi"), ' ');
  s = s.replace(new RegExp("[\\d'\u2019.,]+\\s*(?:" + WAEHRUNG + "|\\.-)", "gi"), ' ');

  // ---------- Umgangssprache entfernen ----------
  // Gemessen am 28.09.: "hab was gesucht fuer grosse Hunde, so 50
  // stutz" ging als Suchbegriff "hab was gesucht fuer grosse Hunde
  // so" an Google. Damit findet Google kaum Schweizer Haendler,
  // sondern irgendwelche Treffer - beide Fragen dieser Bauart
  // scheiterten an "kein einziger Schweizer Shop".
  //
  // So reden echte Nutzer aber. Der Begriff muss das aushalten.
  s = s.replace(/\b(?:ich\s+)?(?:hab(?:e)?|haette|h\u00e4tte)\s+(?:mal\s+)?(?:was|etwas)\s+gesucht\b/gi, ' ');
  s = s.replace(/\bwas\s+f(?:\u00fc|ue)r\b/gi, ' ');
  s = s.replace(/\bbekomm(?:e|t)?\s+ich\b/gi, ' ');
  s = s.replace(/\b(?:so|ca|etwa|circa|ungef(?:\u00e4|ae)hr|rund|vielleicht)\b/gi, ' ');

  // Hoefliche Einleitungen entfernen
  s = s.replace(/\b(?:ich (?:suche|brauche|moechte|m\u00f6chte|haette|h\u00e4tte)(?:\s+gerne)?|suche|brauche|zeig(?:e)?\s+mir|finde(?:st)?\s+(?:du\s+)?mir|hilf\s+mir|empfiehl\s+mir)\b/gi, ' ');
  s = s.replace(/\b(?:einen|eine|einem|einer|ein|der|die|das|den|dem|bitte|gerne|einfach|guenstig|g\u00fcnstig|gute[rns]?)\b/gi, ' ');

  s = s.replace(/[?!.,;]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Haengende Verhaeltniswoerter am Ende abschneiden. Nach dem
  // Entfernen der Preisangabe blieb sonst "Buerostuhl fuer langes
  // Sitzen fuer" stehen - Google sucht das woertlich mit.
  let vorher;
  do {
    vorher = s;
    s = s.replace(/\s+(?:f(?:\u00fc|ue)r|zum|zur|bei|beim|mit|ohne|als|von|in|auf|und|oder)\s*$/i, '').trim();
  } while (s !== vorher);

  return s || String(text).trim();
}

// ============================================
// STUFE 3 - HARTE FILTER (kein Modell, reiner Code)
// ============================================
/**
 * Kandidaten ueber die Preisspanne verteilen.
 *
 * Warum das noetig ist: Google sortiert bei einem allgemeinen Begriff
 * die billigen Treffer nach oben. Nahmen wir einfach Position 1-12,
 * deckten die Kandidaten bei 200 CHF Budget nur bis etwa 80 CHF ab -
 * alles darueber sah das Modell nie. Wer 200 sagt und drei Produkte
 * unter 80 bekommt, hat keine Wahl getroffen, sondern eine
 * vorgesetzt bekommen.
 *
 * Das heisst NICHT "teurer ist besser". Guenstige Produkte bleiben
 * in der Auswahl. Das Modell soll nur ueber die ganze Spanne
 * entscheiden koennen statt nur ueber das untere Viertel.
 */
/**
 * Kuerzeren Suchbegriff bauen, wenn der erste nichts findet.
 *
 * Der Zweck ("zum Pendeln", "fuer Studenten") ist fuer die Bewertung
 * wertvoll, fuer Google Shopping oft toedlich: "Kopfhoerer zum
 * Pendeln" gibt null Treffer, "Kopfhoerer" gibt vierzig.
 *
 * Der Zweck geht dabei nicht verloren - er steht weiter in der
 * Nachricht, die das Modell zu sehen bekommt. Nur Google bekommt
 * die kurze Fassung.
 */
/**
 * SerpAPI-Suche mit einer Wiederholung bei Zeitueberschreitung.
 *
 * SerpAPI ist manchmal langsam und antwortet nicht in 20 Sekunden.
 * Beim zweiten Versuch klappt es meist, weil das Ergebnis dort
 * inzwischen fertig ist. Andere Fehler (falscher Schluessel, kein
 * Guthaben) werden NICHT wiederholt - das braechte nichts.
 */
// Fehler, bei denen gar keine Verbindung besteht. Da hilft kein
// Wiederholen - lieber sofort ehrlich sein als den Nutzer 70
// Sekunden warten lassen.
const KEIN_INTERNET = /ENOTFOUND|ENETUNREACH|EAI_AGAIN|ECONNREFUSED/i;

async function sucheMitWiederholung(suchbegriff, optionen) {
  // Abspiel-Modus: keine neuen Abfragen. Was nicht gespeichert ist,
  // bleibt leer - so merkst du sofort, wenn eine Testfrage noch
  // nicht aufgenommen wurde.
  if (cache.abspielen && cache.abspielen()) {
    console.warn(`[abspielen] Keine SerpAPI-Abfrage fuer "${suchbegriff}" - nicht aufgenommen`);
    return { success: false, error: 'abspiel_modus', produkte: [], abfragen: 0 };
  }

  const erster = await serpApiService.searchProducts(suchbegriff, optionen);

  const fehlertext = String(erster.error || '');

  if (!erster.success && KEIN_INTERNET.test(fehlertext)) {
    console.warn('[suche] Keine Verbindung zu SerpAPI - kein zweiter Versuch');
    return { ...erster, keinInternet: true, abfragen: 1 };
  }

  const istZeitueberschreitung =
    !erster.success && /timeout|zeitueberschreitung|ETIMEDOUT|ECONNRESET/i.test(fehlertext);

  if (!istZeitueberschreitung) return { ...erster, abfragen: 1 };

  console.log('[suche] Zeitueberschreitung - zweiter Versuch mit demselben Begriff');
  const zweiter = await serpApiService.searchProducts(suchbegriff, optionen);

  if (zweiter.success) console.log('[suche] Zweiter Versuch erfolgreich');
  else console.warn('[suche] Auch der zweite Versuch scheiterte:', zweiter.error);

  // Zwei bezahlte Abfragen. Das muss nach oben gemeldet werden,
  // sonst zahlt die Kostenbremse nur eine.
  return { ...zweiter, abfragen: 2 };
}

function begriffKuerzen(begriff) {
  if (!begriff) return null;

  // Zweckangaben abschneiden
  let kurz = begriff
    // Alles ab Gedankenstrich oder Klammer weg - das ist Zusammenhang,
    // kein Suchbegriff
    .replace(/\s*[—–(].*$/, '')
    .replace(/\s+(zum|zur|fuer|für|als|beim|bei|mit|ohne|damit)\s+.*$/i, '')
    .trim();

  // Immer noch lang? Dann die ersten zwei Woerter
  const woerter = kurz.split(/\s+/).filter(Boolean);
  if (woerter.length > 2) kurz = woerter.slice(0, 2).join(' ');

  // Nur zurueckgeben, wenn sich wirklich etwas geaendert hat
  if (!kurz || kurz.toLowerCase() === begriff.toLowerCase()) return null;
  return kurz;
}

/**
 * Ist das ein Schweizer Shop?
 * Erst die Shop-Datenbank, dann die Domain, dann der Name.
 */
function istSchweiz(p) {
  if (p.shopInfo && p.shopInfo.land) return p.shopInfo.land === 'CH';
  const quelle = String(p.source || p.shop || '').toLowerCase();
  if (/\.ch\b/.test(quelle)) return true;
  if (/\b(schweiz|suisse|svizzera)\b/.test(quelle)) return true;
  if (/\b(ch)\s*$/.test(quelle)) return true;  // "Teufel CH"
  return false;
}

/**
 * Rangfolge der Shops - gilt fuer ALLE Kategorien.
 *
 *   1  Guter Schweizer Shop   (Land CH, bewertet premium/hoch/gut)
 *   2  Schweizer Shop, noch nicht bewertet
 *   3  Amazon
 *   4  Schweizer Shop, von dir schwach bewertet (mittel/niedrig)
 *   5  Anderer Auslandsshop
 *   6  Unbekannt, ohne erkennbares Land (z.B. eBay-Einzelverkaeufer)
 *
 * "Gut" kommt aus der Shop-Datenbank und aus deinen Bewertungen im
 * Register. Bewertest du einen Shop, rueckt er von selbst nach oben.
 * Keine Liste pro Kategorie noetig.
 */
const GUTE_STUFEN = ['premium', 'hoch', 'gut'];
const SCHWACHE_STUFEN = ['mittel', 'niedrig'];

function shopStufe(p) {
  const quelle = String(p.source || p.shop || '').toLowerCase();
  const qualitaet = p.shopInfo ? p.shopInfo.qualitaet : null;
  const schweiz = istSchweiz(p);

  if (schweiz && GUTE_STUFEN.includes(qualitaet)) return 1;
  if (schweiz && SCHWACHE_STUFEN.includes(qualitaet)) return 4;
  if (schweiz) return 2;
  if (/amazon/.test(quelle)) return 3;
  if (p.shopInfo && p.shopInfo.land) return 5;
  return 6;
}

// Ab so vielen Schweizer Treffern kommen auslaendische gar nicht
// erst in die Auswahl. Darunter duerfen sie auffuellen - lieber ein
// Treffer aus Deutschland als gar keiner.
const GENUG_SCHWEIZER = 6;

function kandidatenWaehlen(alle, budget, anzahl = 12) {
  // ---------- Regel: Schweizer Shops gewinnen ----------
  // Bis Zoll und Mehrwertsteuer eingerechnet werden, ist ein Kauf im
  // Ausland fuer Schweizer Kunden oft teurer als er aussieht, und die
  // Rueckgabe ist aufwendiger. Das stand bisher nur als Bitte im
  // Prompt - das Modell nahm trotzdem Amazon.de, wegen der vielen
  // Bewertungen. Darum hier im Code.
  // Nur Stufe 1 und 2 zaehlen als Schweizer Vorrang. Einen Schweizer
  // Shop, den du selbst schwach bewertet hast, stellt die Rangfolge
  // bewusst hinter Amazon.
  const schweizer = alle.filter((p) => shopStufe(p) <= 2);
  const ausland = alle.filter((p) => shopStufe(p) > 2);

  // Genug Schweizer: nur die. Sonst fuellt das Ausland auf -
  // Amazon zuerst, dann der Rest.
  const auslandSortiert = [...ausland].sort((a, b) => shopStufe(a) - shopStufe(b));
  const produkte = schweizer.length >= GENUG_SCHWEIZER
    ? schweizer
    : [...schweizer, ...auslandSortiert];

  if (schweizer.length < GENUG_SCHWEIZER && ausland.length) {
    console.log(`[auswahl] Nur ${schweizer.length} Schweizer Treffer - Ausland fuellt auf`);
  } else if (ausland.length) {
    console.log(`[auswahl] ${ausland.length} auslaendische Treffer ausgelassen, ${schweizer.length} Schweizer reichen`);
  }

  if (!budget || produkte.length <= anzahl) return produkte.slice(0, anzahl);

  const preis = (p) => (typeof p.priceValue === 'number' ? p.priceValue : null);
  const mitPreis = produkte.filter((p) => preis(p) !== null);
  const ohnePreis = produkte.filter((p) => preis(p) === null);

  if (mitPreis.length <= anzahl) return produkte.slice(0, anzahl);

  // Drei Baender, gemessen am Budget - nicht an den gefundenen Preisen,
  // sonst verschiebt sich alles wieder nach unten
  const baender = [
    { name: 'oben',  von: budget * 0.65, bis: budget,        plaetze: 5 },
    { name: 'mitte', von: budget * 0.30, bis: budget * 0.65, plaetze: 4 },
    { name: 'unten', von: 0,             bis: budget * 0.30, plaetze: 3 }
  ];

  const gewaehlt = [];
  const rest = [];

  for (const band of baender) {
    // Innerhalb des Bandes bleibt Googles Reihenfolge = Relevanz
    const drin = mitPreis
      .filter((p) => preis(p) > band.von && preis(p) <= band.bis)
      // Nach Shop-Rangfolge, bei Gleichstand bleibt Googles Reihenfolge
      .sort((a, b) => shopStufe(a) - shopStufe(b));
    gewaehlt.push(...drin.slice(0, band.plaetze));
    rest.push(...drin.slice(band.plaetze));
  }

  // Leere Baender mit dem Rest auffuellen, damit nie Plaetze verfallen
  for (const p of [...rest, ...ohnePreis]) {
    if (gewaehlt.length >= anzahl) break;
    if (!gewaehlt.includes(p)) gewaehlt.push(p);
  }

  // Teuerste zuerst waere auch eine Wertung - darum nach Preis aufsteigend,
  // damit die Reihenfolge nichts suggeriert
  return gewaehlt.slice(0, anzahl).sort((a, b) => (preis(a) || 0) - (preis(b) || 0));
}

// Treffer, die kein eigenstaendiges Produkt sind. Google liefert bei
// "Kopfhoerer" auch Einzelohrhoerer, Ohrpolster und Ersatzteile -
// die sollen das Modell gar nicht erst erreichen.
const KEIN_PRODUKT = [
  /ersatzteil/i, /\bersatz[-\s]/i, /replacement/i,
  /\beinzel(n|ner|nes)?\b/i, /einzelohr/i,
  /right or left/i, /left or right/i, /links oder rechts/i,
  /\bnur (links|rechts)\b/i, /\b(linker|rechter) ohrh/i,
  /\b(left|right) earbud/i,
  /ohrpolster/i, /ear ?pads?\b/i,
  /schutzh(ü|ue)lle/i, /\bh(ü|ue)lle f(ü|ue)r\b/i, /\bcase f(ü|ue)r\b/i, /\bcase for\b/i
];

/**
 * Preis als Zahl - aus dem Zahlenwert oder notfalls aus dem Text.
 * Schweizer Preise schreiben Tausender mit Apostroph: CHF 1'049.00.
 */
function preisAusText(text) {
  // Apostroph und Leerzeichen sind Tausendertrenner, nicht Komma
  const sauber = String(text || '').replace(/['’\u2019\s]/g, '').replace(',', '.');
  const treffer = sauber.match(/(\d+(?:\.\d{1,2})?)/);
  if (!treffer) return null;
  const zahl = Number(treffer[1]);
  return Number.isFinite(zahl) && zahl > 0 ? zahl : null;
}

function preisSicher(p) {
  const ausText = preisAusText(p.price);
  const gemeldet =
    typeof p.priceValue === 'number' && Number.isFinite(p.priceValue) && p.priceValue > 0
      ? p.priceValue
      : null;

  if (gemeldet === null) return ausText;
  if (ausText === null) return gemeldet;

  // ---------- Widerspruch? Der Text gewinnt. ----------
  // Beobachtet am 25.09.: SerpAPI meldete fuer "CHF 1'049.00" den
  // Wert 1 - der Schweizer Apostroph bricht ihre Zahlenerkennung.
  // Die Matratze rutschte damit durch ein Budget von 500.
  //
  // Der Text ist massgeblich, weil der Nutzer genau ihn sieht.
  // Steht dort 1'049, ist das der Preis - egal was mitgeliefert wird.
  const abweichung = Math.abs(ausText - gemeldet) / Math.max(ausText, gemeldet);
  if (abweichung > 0.02) {
    console.warn(`[preis] Widerspruch bei "${p.title || p.name}": Text ${ausText}, gemeldet ${gemeldet} - Text gilt`);
    return ausText;
  }

  return gemeldet;
}

function harteFilter(produkte, budget) {
  const behalten = [];
  const abgelehnt = [];

  for (const p of produkte) {
    const preis = preisSicher(p);

    if (budget) {
      // KEIN PREIS, KEINE EMPFEHLUNG.
      // Beobachtet am 25.09.: Bei "Matratze bis 500 Franken" kamen
      // Matratzen fuer 1049 und 1574 durch, weil ihr Preis nicht
      // als Zahl vorlag und der Filter sie durchwinkte. Genau
      // umgekehrt ist richtig: Was sich nicht pruefen laesst, darf
      // bei gesetztem Budget nicht empfohlen werden.
      if (preis === null) {
        abgelehnt.push({ titel: p.title || p.name, grund: 'Preis nicht lesbar, Budget nicht pruefbar' });
        continue;
      }

      if (preis > budget) {
        abgelehnt.push({ titel: p.title || p.name, grund: `ueber Budget (${preis} > ${budget})` });
        continue;
      }
    }

    const titel = String(p.title || p.name || '');
    if (KEIN_PRODUKT.some((muster) => muster.test(titel))) {
      abgelehnt.push({ titel, grund: 'Einzelteil oder Zubehoer, kein eigenstaendiges Produkt' });
      continue;
    }

    behalten.push(p);
  }

  return { behalten, abgelehnt };
}

// ============================================
// AUSGABE FUER DAS FRONTEND
// Feldnamen bleiben wie bisher, damit das Frontend nichts merkt
// ============================================
function baueProdukt(quelle, extras = {}) {
  const preisText = toText(quelle.price, '');

  return {
    // Die interne ID wandert mit, damit der Mitschrieb das Ergebnis
    // den Kandidaten zuordnen kann. Das Frontend zeigt sie nicht an.
    id: quelle.id || null,
    name: toText(quelle.title || quelle.name, 'Produkt'),
    shopName: toText(quelle.source || quelle.shop, 'Shop'),
    shopUrl: toText(quelle.link || quelle.productLink, ''),
    imageUrl: toText(quelle.thumbnail, '') || null,
    price: preisText || null,
    priceValue: typeof quelle.priceValue === 'number' ? quelle.priceValue : null,
    currency: toText(quelle.currency, 'CHF'),
    score: extras.score !== undefined ? extras.score : null,
    reason: toText(extras.reason, ''),
    whyItFits: toList(extras.whyItFits, 3),
    nachteile: toList(extras.nachteile, 2),
    fuerWen: toText(extras.fuerWen, ''),
    bewertetVonKi: !!extras.bewertetVonKi,
    badges: extras.score >= 85 ? ['TOP'] : []
  };
}

// ============================================
// KLICK-ZIELE SPEICHERN
// Der Google-Token ist mehrere tausend Zeichen lang und kann nicht
// in den Link. Er wird gespeichert, der Nutzer bekommt eine kurze ID.
// Beim Klick holt /api/go/:kurzId damit den echten Haendler-Link.
// ============================================
async function baueKlickLinks(produkte, quellen, kontext) {
  const eintraege = [];

  for (let i = 0; i < produkte.length; i++) {
    const q = quellen[i];
    const token = q && q.immersive_product_page_token;
    if (!token) continue; // ohne Token bleibt der urspruengliche Link stehen

    eintraege.push({
      index: i,
      doc: {
        kurzId: ProduktKlick.neueKurzId(),
        token,
        googleProduktId: q.product_id || null,
        produktName: produkte[i].name,
        angezeigterPreis: produkte[i].price || '',
        angezeigterPreisWert: produkte[i].priceValue,
        angezeigterShop: produkte[i].shopName,
        sucheId: kontext.sucheId || null,
        suchanfrage: kontext.anfrage || '',
        budget: kontext.budget || null,
        rang: i + 1,
        nutzer: kontext.nutzerId || null
      }
    });
  }

  if (!eintraege.length) return;

  try {
    await ProduktKlick.insertMany(eintraege.map((e) => e.doc), { ordered: false });
    for (const e of eintraege) {
      produkte[e.index].shopUrl = API_BASE + '/api/go/' + e.doc.kurzId;
      produkte[e.index].ueberSynora = true;
    }
    console.log('[chat] ' + eintraege.length + ' Klick-Ziele gespeichert');
  } catch (err) {
    // Kein Abbruch: der Nutzer bekommt dann den urspruenglichen Link
    console.error('[chat] Klick-Ziele nicht gespeichert:', err.message);
  }
}

// ============================================
// HAUPT-HANDLER
// ============================================
// ============================================
// Wer sucht hier, und von wo
// ============================================
// ACHTUNG BEI RAILWAY: hinter einem Proxy ist req.ip die Adresse des
// Proxys - fuer ALLE Nutzer dieselbe. Dann wuerde das IP-Limit nach
// drei Suchen jeden aussperren. Darum gehoert in die server.js EINE
// Zeile:
//
//     app.set('trust proxy', 1);
//
// Ist sie gesetzt, liefert req.ip bereits die richtige Adresse, und
// wir nehmen die.
//
// Ist sie NICHT gesetzt, lesen wir x-forwarded-for selbst - aber von
// RECHTS. Der letzte Eintrag stammt vom eigenen Proxy; alles davor
// hat der Besucher selbst geschickt und kann frei erfunden sein.
// Gemessen: mit dem LINKEN Eintrag kamen 622 Suchen von einem
// einzigen Rechner durch, statt der erlaubten 3.
function nutzerIp(req) {
  try {
    if (req.app && typeof req.app.get === 'function' && req.app.get('trust proxy')) {
      if (req.ip) return req.ip;
    }
  } catch (_) { /* kein Express-App-Objekt */ }

  const weiter = req.headers['x-forwarded-for'];
  if (typeof weiter === 'string' && weiter.trim()) {
    const teile = weiter.split(',').map((s) => s.trim()).filter(Boolean);
    if (teile.length) return teile.at(-1);
  }

  return req.ip || req.connection?.remoteAddress || null;
}

// Premium gibt es noch nicht. Sobald es das gibt, ist das hier die
// EINE Zeile, die angepasst werden muss - sonst nichts.
function istPremium(req) {
  return !!(req.user && (req.user.istPremium || req.user.premium || req.user.plan === 'premium'));
}

const sendMessage = async (req, res) => {
  const start = Date.now();
  // Vor dem try, damit der catch-Block den Mitschrieb auch sieht
  let protokoll = null;

  try {
    const { message } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Nachricht fehlt' });
    }

    // ---------- Erst zusammenfuehren, DANN auswerten ----------
    // Antwortet jemand auf eine Rueckfrage, steht in "message" nur die
    // Antwort ("Zum Sport"). Budget und Produkt stecken in der Nachricht
    // davor. Wurde das Budget aus "message" gelesen, fiel es nach jeder
    // Rueckfrage weg - und mit ihm die harte Budgetwand.
    const verlauf = Array.isArray(req.body.conversationHistory) ? req.body.conversationHistory : [];
    const zusammengefuehrt = rueckfrage.zusammenfuehren(message, verlauf);
    const vollstaendig = zusammengefuehrt.text;

    // Budget aus der VOLLSTAENDIGEN Anfrage
    const budget = extrahiereBudget(vollstaendig);

    // Google bekommt nur den Produktbegriff - "Kopfhoerer (Zu Hause
    // oder im Buero)" findet nichts
    let begriff = sucheBegriff(zusammengefuehrt.suchbegriff || message);

    console.log(`\n[suche] "${message}"`);
    if (vollstaendig !== message) {
      console.log(`[rueckfrage] Fuer das Modell: "${vollstaendig}"`);
    }
    console.log(`[suche] Begriff an Google: "${begriff}" | Budget: ${budget || 'keines erkannt'}`);

    // ---------- Stufe 7: Mitschrieb beginnen ----------
    protokoll = mitschrieb.neu(null).nutzer(req).anfrage({
      roh: message,
      vollstaendig,
      begriff,
      budget,
      kategorie: shopKategorien.kategorieErkennen(vollstaendig)
    });
    if (vollstaendig !== message) protokoll.rueckfrageBeantwortet(message);

    const anforderung = anforderungen.lesen(vollstaendig, []);

    const frage = await rueckfrageSchlau.pruefenSchlau({
      nachricht: vollstaendig,
      anforderungen: anforderung,
      budget,
      verlauf
    });

    if (frage && frage.fertig && frage.suchbegriff) {
      begriff = sucheBegriff(frage.suchbegriff);
      console.log(`[suche] Begriff nach Bestaetigung: "${begriff}"`);

      // ---------- Den NEUEN Begriff auch ins Protokoll ----------
      // GEAENDERT am 03.10.2026.
      //
      // Das Protokoll wurde oben mit dem Begriff VOR der Bestaetigung
      // angelegt. Bestaetigt der Nutzer eine Vermutung, sucht SYNORA
      // ab hier mit einem ganz anderen Begriff:
      //
      //   vorher:  "Kopfhörer für meinen Vater er hört schlecht ..."
      //   nachher: "TV-Funk-Kopfhörer"
      //
      // Gesucht wurde mit dem zweiten, aufgeschrieben der erste. Jede
      // Auswertung, die auf anfrage.begriff schaut, zeigt damit einen
      // Begriff, der nie an Google ging - und meldet Fehler, die
      // keine sind. Genau das ist am 03.10. passiert.
      //
      // Alle Felder noch einmal setzen, damit es auch dann stimmt,
      // wenn anfrage() ersetzt statt ergaenzt.
      try {
        protokoll.anfrage({
          roh: message,
          vollstaendig,
          begriff,
          budget,
          kategorie: shopKategorien.kategorieErkennen(vollstaendig)
        });
      } catch (e) {
        console.error('[mitschrieb] Begriff nicht aktualisiert:', e.message);
      }
    }

    if (frage && !frage.fertig) {
      console.log(`[rueckfrage] "${frage.frage}"`);
      protokoll.rueckfrageGestellt(frage.frage).speichern();
      // Keine Suche, kein SerpAPI-Aufruf, und das Tageslimit
      // wird nicht belastet - gezaehlt wird erst nach einer
      // echten Suche, weiter unten.
      return res.json({
        response: frage.fragen.length > 1
          ? 'Damit ich dir das Richtige zeige, drei kurze Fragen:'
          : frage.frage,
        products: [],
        // Neue Form: mehrere Fragen auf einmal
        fragen: frage.fragen,
        // Alte Form fuer den Fall, dass das Frontend noch nicht
        // umgestellt ist - dann kommt wenigstens die erste Frage
        modelOptions: frage.optionen,
        istRueckfrage: true,
        isLoggedIn: !!req.istEingeloggt
      });
    }

    const cacheSchluessel = cache.schluesselBauen(begriff, budget, 'CH');

    // Eigener Schluessel fuer die Bewertung, mit Fingerabdruck der
    // Regeln. Aenderst du den Prompt, ist der alte Cache automatisch
    // ungueltig - statt 24 Stunden lang alte Bewertungen zu liefern.
    const regelStand = typeof claudeService.promptVersion === 'function' ? claudeService.promptVersion() : 'v0';
    // Die Produkte haengen nur vom Suchbegriff ab - "Kopfhoerer" liefert
    // bei Google dasselbe, egal wofuer. Die BEWERTUNG haengt aber vom
    // Zweck ab. Vorher teilten sich Telefonieren, Sport und Buero eine
    // gespeicherte Bewertung, und wer zuerst suchte, bestimmte fuer alle.
    const absicht = crypto
      .createHash('sha1')
      .update(String(vollstaendig).toLowerCase().replace(/\s+/g, ' ').trim())
      .digest('hex')
      .slice(0, 10);
    const bewertungSchluessel = `${cacheSchluessel}-${regelStand}-${absicht}`;
    // Der Fingerabdruck der Kandidaten kommt weiter unten dazu -
    // erst dort steht fest, welche Produkte es in die Auswahl
    // geschafft haben.

    // Eine ID fuer diese Suche. Sie verbindet Empfehlung, Klick und
    // spaetere Fehlermeldung miteinander.
    const sucheId = crypto.randomBytes(8).toString('base64url');

    // --------------------------------------
    // STUFE 2: Produkte beschaffen
    // --------------------------------------
    let gefunden = [];
    let keineVerbindung = false;
    let produkteAusCache = false;
    let sucheFehler = null; // Zeitueberschreitung o.ae. - nicht dasselbe wie "nichts gefunden"

    const gecachteProdukte = await cache.holen('produkte', cacheSchluessel);
    if (Array.isArray(gecachteProdukte) && gecachteProdukte.length) {
      gefunden = gecachteProdukte;
      produkteAusCache = true;
    } else {
      // ---------- Kostenbremse ----------
      // ERST HIER, nicht frueher. Eine Rueckfrage kostet nichts, und
      // ein Treffer aus dem Cache kostet auch nichts - beides darf
      // die Bremse nicht blockieren. Gefragt wird genau an der
      // Stelle, an der gleich echtes Geld ausgegeben wird.
      //
      // darfSuchen() BUCHT die erste Abfrage gleich mit. Gibt es
      // weiter unten einen zweiten Versuch mit gekuerztem Begriff,
      // wird der mit nachbuchen() ergaenzt.
      const premium = istPremium(req);
      // Gast = gar kein Konto. Das IP-Limit der Kostenbremse gilt
      // nur fuer diese - angemeldete Nutzer werden ueber ihr Konto
      // gezaehlt, nicht ueber ihre Adresse.
      const gast = !(req.user && req.user._id);
      const ip = nutzerIp(req);

      // Im Abspiel-Modus wird NICHTS bei SerpAPI abgefragt - also
      // darf auch nichts abgerechnet werden. Sonst haette ein Lauf
      // des Pruefkatalogs mit 150 Fragen das Budget belastet, ohne
      // einen Rappen auszugeben, und im schlimmsten Fall mitten im
      // Lauf den Deckel gerissen.
      const abspielModus = typeof cache.abspielen === 'function' && cache.abspielen();

      // Stuerzt die Bremse selbst ab, wird NICHT gesucht. Lieber
      // eine ehrliche Meldung als eine Suche, von der niemand
      // weiss, ob sie bezahlt werden kann. Ein Absturz der Bremse
      // darf aber auch nicht die ganze Anfrage mit 500 beenden.
      let darf = { erlaubt: true, stufe: kostenbremse.stufeFuer(premium) };
      if (!abspielModus) {
        try {
          darf = await kostenbremse.darfSuchen({ istPremium: premium, istGast: gast, ip });
        } catch (e) {
          console.error('[kosten] Bremse selbst fehlgeschlagen:', e.message);
          darf = {
            erlaubt: false,
            grund: 'bremse-defekt',
            meldung: 'SYNORA ist gerade nicht erreichbar. Bitte versuche es in ein paar Minuten nochmal.'
          };
        }
      }

      if (!darf.erlaubt) {
        try {
          console.warn(`[kosten] Suche abgelehnt (${darf.grund}) - ${await kostenbremse.bericht()}`);
        } catch (_) {
          console.warn(`[kosten] Suche abgelehnt (${darf.grund})`);
        }
        // Zwei getrennte Versuche: gibt es notiz() nicht, soll der
        // Mitschrieb trotzdem gespeichert werden.
        try { protokoll.notiz(`Kostenbremse: ${darf.grund}`); } catch (_) {}
        try { protokoll.speichern(); } catch (_) {}

        return res.json({
          response: darf.meldung,
          products: [],
          istKostenGrenze: true,
          grund: darf.grund,
          isLoggedIn: !!req.istEingeloggt
        });
      }

      // Jede bezahlte Abfrage wird hier hochgezaehlt - auch die, die
      // nichts findet. Eine erfolglose Suche kostet genauso viel.
      // Die ERSTE ist durch darfSuchen() schon gebucht; gezaehlt
      // wird hier, was sucheMitWiederholung wirklich abgesetzt hat
      // (bei einer Zeitueberschreitung sind das zwei).
      let bezahlteSuchen = 0;

      try {
        // Nur die Google-Suche bekommt den gekuerzten Begriff.
        // Claude bekommt weiter die volle Nachricht, sonst geht der Zweck verloren.
        const ergebnis = await sucheMitWiederholung(begriff, {
          land: 'CH',
          anzahl: 20,
          maxPreis: budget || null
        });

        bezahlteSuchen += Number.isFinite(ergebnis.abfragen) ? ergebnis.abfragen : 1;

        if (ergebnis.success && Array.isArray(ergebnis.produkte)) {
          gefunden = ergebnis.produkte;

          // Leere Ergebnisse NICHT speichern. Sonst liefert der Cache
          // eine halbe Stunde lang nichts, obwohl eine neue Suche
          // vielleicht Treffer haette.
          if (gefunden.length) await cache.speichern('produkte', cacheSchluessel, gefunden, { begriff, budget });

          // Preise mitschreiben - kostet keinen zusaetzlichen Aufruf.
          // Laeuft nebenher, die Antwort wartet nicht darauf.
          preisVerlauf
            .schreiben(gefunden)
            .then((n) => n && console.log(`[preise] ${n} Preise mitgeschrieben`))
            .catch(() => {});
        } else {
          sucheFehler = ergebnis.error || 'unbekannt';
          if (ergebnis.keinInternet) keineVerbindung = true;
          console.warn('[suche] SerpAPI ohne Ergebnis:', sucheFehler);
        }

        // Nichts gefunden, aber auch kein Fehler? Dann war der Begriff
        // zu eng. Einmal kuerzer versuchen - das kostet eine SerpAPI-
        // Abfrage, aber eine leere Antwort kostet einen Nutzer.
        if (!gefunden.length && !sucheFehler) {
          const kurz = begriffKuerzen(begriff);
          if (kurz) {
            console.log(`[suche] Zweiter Versuch mit kuerzerem Begriff: "${kurz}"`);
            try {
              bezahlteSuchen += 1;
              const zweiter = await serpApiService.searchProducts(kurz, {
                land: 'CH',
                anzahl: 40,
                maxPreis: budget || null
              });
              if (zweiter.success && zweiter.produkte?.length) {
                gefunden = zweiter.produkte;
                console.log(`[suche] Zweiter Versuch: ${gefunden.length} Treffer`);
                await cache.speichern('produkte', cacheSchluessel, gefunden, { begriff: kurz, budget });
              }
            } catch (e) {
              console.error('[suche] Zweiter Versuch fehlgeschlagen:', e.message);
            }
          }
        }
      } catch (err) {
        sucheFehler = err.message;
        console.error('[suche] SerpAPI Fehler:', err.message);
      }

      // ---------- Nachbuchen ----------
      // Ausserhalb des try, damit auch eine abgestuerzte Suche
      // bezahlt wird. Das Geld ist weg, egal wie es ausging.
      // Gebucht wird nur, was ueber die erste Abfrage hinausgeht -
      // die hat darfSuchen() bereits verbucht.
      try {
        const zusaetzlich = abspielModus ? 0 : bezahlteSuchen - 1;
        if (zusaetzlich > 0) {
          const gebucht = await kostenbremse.nachbuchen({
            istPremium: premium,
            zusaetzlich
          });
          if (gebucht.gebucht) {
            console.log(
              `[kosten] ${bezahlteSuchen} Abfragen ${darf.stufe} | ` +
              `heute CHF ${gebucht.tagChf.toFixed(2)} | Monat CHF ${gebucht.monatChf.toFixed(2)}`
            );
          }
        } else if (darf.tagChf !== undefined) {
          console.log(
            `[kosten] 1 Abfrage ${darf.stufe} | ` +
            `heute CHF ${darf.tagChf.toFixed(2)} | Monat CHF ${darf.monatChf.toFixed(2)}`
          );
        }
      } catch (e) {
        console.error('[kosten] Nachbuchen fehlgeschlagen:', e.message);
      }
    }

    if (!gefunden.length) {
      // Unterscheiden: hat die Suche nicht geantwortet, oder gibt es
      // wirklich nichts? Fuer den Nutzer ist das ein grosser Unterschied.
      const technischesProblem = !!sucheFehler;

      // Eine fehlende Aufnahme ist KEIN technisches Problem - sie
      // betrifft nur das Testen. Ohne diese Unterscheidung meldet der
      // Abspielmodus "Meine Produktsuche antwortet gerade nicht", und
      // man sucht den Fehler bei SerpAPI statt bei den Aufnahmen.
      const abspielLuecke = sucheFehler === 'abspiel_modus';

      Analytics.track('suche_fehlgeschlagen', {
        userId: req.user ? req.user._id : null,
        sessionId: sucheId,
        suchanfrage: message,
        dauer: Date.now() - start,
        anzahl: 0,
        erfolg: false,
        fehler: technischesProblem ? { nachricht: String(sucheFehler).slice(0, 300) } : null,
        metadata: { budget: budget || null, begriff, technischesProblem }
      });

      // ---------- Mitschrieb: AUCH wenn nichts gefunden wurde ----------
      // GEAENDERT am 03.10.2026. Hier fehlte das Speichern.
      //
      // Was das gekostet hat: der Pruefkatalog meldete "0 Produkte
      // statt 3", und im Protokoll stand zu dieser Suche NICHTS -
      // nicht einmal ein leerer Eintrag. Eine Suche, die spurlos
      // verschwindet, ist nicht zu untersuchen. Wir haben zuerst die
      // Aufnahmen verdaechtigt, dann die Bot-Bremse, dann das
      // Suchlimit - alles falsch, weil die eine Zeile fehlte, die
      // gesagt haette, was wirklich passiert ist.
      //
      // Regel dahinter: JEDER Ausgang dieser Funktion schreibt das
      // Protokoll. Ein leeres Ergebnis ist ein Ergebnis.
      try {
        protokoll.treffer({
          gesamt: 0, nachFilter: 0, ueberBudget: 0,
          aussortiert: 0, schweizer: 0, ausland: 0
        });
        protokoll.fehler(
          abspielLuecke ? 'keine Aufnahme fuer diesen Begriff'
            : technischesProblem ? String(sucheFehler).slice(0, 200)
            : 'nichts gefunden'
        );
        protokoll.speichern();
      } catch (e) {
        console.error('[mitschrieb] leeres Ergebnis nicht gespeichert:', e.message);
      }

      return res.json({
        response: keineVerbindung
          ? 'Ich komme gerade nicht ins Internet und kann deshalb keine Preise abrufen. Sobald die Verbindung wieder steht, geht es weiter.'
          : abspielLuecke
          ? `Abspielmodus: zu "${begriff}" gibt es keine Aufnahme. Diese Meldung erscheint nur beim Testen - mit "node scripts/aufnahmeLuecken.js" siehst du alle Luecken.`
          : technischesProblem
          ? 'Meine Produktsuche antwortet gerade nicht. Das liegt nicht an deiner Anfrage - versuch es in einer Minute nochmal.'
          : `Ich habe zu "${message}" nichts gefunden. Sag mir mehr zum Zweck oder zum Budget, dann suche ich gezielter.`,
        products: [],
        technischesProblem: technischesProblem && !abspielLuecke,
        abspielLuecke: abspielLuecke || undefined,
        isLoggedIn: !!req.istEingeloggt
      });
    }

    // --------------------------------------
    // STUFE 3: harte Filter
    // --------------------------------------
    const { behalten, abgelehnt } = harteFilter(gefunden, budget);
    if (abgelehnt.length) {
      console.log(`[filter] ${abgelehnt.length} Produkte ueber Budget entfernt`);
    }

    if (!behalten.length) {
      Analytics.track('suche_fehlgeschlagen', {
        userId: req.user ? req.user._id : null,
        sessionId: sucheId,
        suchanfrage: message,
        dauer: Date.now() - start,
        anzahl: 0,
        erfolg: false,
        metadata: { budget: budget || null, begriff, grund: 'alles ueber Budget' }
      });

      // Mitschrieb auch hier - siehe oben, jeder Ausgang speichert
      try {
        protokoll.treffer({
          gesamt: gefunden.length, nachFilter: 0,
          ueberBudget: abgelehnt.length, aussortiert: 0,
          schweizer: 0, ausland: 0
        });
        protokoll.fehler('alle Produkte ueber Budget oder hart gefiltert');
        protokoll.speichern();
      } catch (e) {
        console.error('[mitschrieb] Budgetausgang nicht gespeichert:', e.message);
      }

      return res.json({
        response: budget
          ? `Fuer ${budget} CHF finde ich nichts, das passt. Entweder das Budget etwas erhoehen oder eine Anforderung streichen - sag mir, was dir wichtiger ist.`
          : `Ich habe zu "${message}" nichts Passendes gefunden.`,
        products: [],
        ausgeschlossen: abgelehnt.length,
        isLoggedIn: !!req.istEingeloggt
      });
    }

    // Shop-Datenbank anwenden und aus gemeldeten Fehlern lernen.
    // Was mehrfach gemeldet wurde, kommt hier gar nicht erst weiter.
    const { produkte: geprueft, entfernt: gelernt } =
      await shopBewertung.anreichernUndFiltern(behalten, shopKategorien.kategorieErkennen(message));

    if (gelernt.length) {
      console.log(`[lernen] ${gelernt.length} entfernt: ${gelernt.map((e) => e.grund).join(', ')}`);
    }

    if (!geprueft.length) {
      // Mitschrieb auch hier - siehe oben, jeder Ausgang speichert
      try {
        protokoll.treffer({
          gesamt: gefunden.length, nachFilter: behalten.length,
          ueberBudget: abgelehnt.length, aussortiert: gelernt.length,
          schweizer: 0, ausland: 0
        });
        protokoll.fehler('nur mehrfach als fehlerhaft gemeldete Angebote');
        protokoll.speichern();
      } catch (e) {
        console.error('[mitschrieb] Shopausgang nicht gespeichert:', e.message);
      }

      return res.json({
        response:
          'Zu deiner Anfrage habe ich nur Angebote gefunden, die schon mehrfach als fehlerhaft gemeldet wurden. Die zeige ich dir nicht. Sag mir mehr zum Zweck, dann suche ich anders.',
        products: [],
        isLoggedIn: !!req.istEingeloggt
      });
    }

    // IDs vergeben - ab hier wird nur noch nachgeschlagen, nie geraten
    // ---------- Dasselbe Produkt nur einmal ----------
    // Beobachtet am 22.09.: "JLAB Go Air Pop" landete auf Platz 1
    // fuer 29.95 und auf Platz 2 fuer 43.70 - derselbe Kopfhoerer,
    // zwei Shops. Der Nutzer bekommt dann keine drei Moeglichkeiten.
    // Wir behalten je Produkt den besten Shop, bei gleicher Stufe
    // den guenstigeren Preis.
    const nachProdukt = new Map();
    for (const p of geprueft) {
      const schluessel = produktWissen.schluesselBauen(p.title || p.name);
      if (!schluessel) continue;

      const bisher = nachProdukt.get(schluessel);
      if (!bisher) { nachProdukt.set(schluessel, p); continue; }

      const stufeNeu = shopStufe(p);
      const stufeAlt = shopStufe(bisher);
      const preisNeu = typeof p.priceValue === 'number' ? p.priceValue : Infinity;
      const preisAlt = typeof bisher.priceValue === 'number' ? bisher.priceValue : Infinity;

      const besser = stufeNeu < stufeAlt || (stufeNeu === stufeAlt && preisNeu < preisAlt);
      if (besser) nachProdukt.set(schluessel, p);
    }

    const ohneDoppelte = [...nachProdukt.values()];
    if (ohneDoppelte.length < geprueft.length) {
      console.log(`[auswahl] ${geprueft.length - ohneDoppelte.length} doppelte Produkte zusammengefasst`);
    }

    const kandidaten = kandidatenWaehlen(ohneDoppelte, budget, 12);

    protokoll.treffer({
      gesamt: gefunden.length,
      nachFilter: geprueft.length,
      ueberBudget: abgelehnt.filter((a) => /Budget/i.test(a.grund)).length,
      aussortiert: abgelehnt.filter((a) => !/Budget/i.test(a.grund)).length,
      schweizer: geprueft.filter((p) => shopStufe(p) <= 2).length,
      ausland: geprueft.filter((p) => shopStufe(p) > 2).length
    });
    // Kandidaten werden weiter unten mitgeschrieben - erst NACH der
    // ID-Vergabe. Vorher stehen dort Googles lange Zahlen statt p_08,
    // und die Rangliste des Modells passt zu keinem Kandidaten.

    if (budget && kandidaten.length) {
      const preise = kandidaten.map((p) => p.priceValue).filter((x) => typeof x === 'number');
      if (preise.length) {
        console.log(
          `[auswahl] ${kandidaten.length} Kandidaten von ${Math.min(...preise)} bis ${Math.max(...preise)} CHF (Budget ${budget})`
        );
      }
    }

    // Die Shop-Stufe wandert mit in den Prompt. Gemessen am 28.09.:
    // "ademas.ch" (unbekannt) stand vor "digitec.ch" auf Platz 1,
    // und bei drei Fragen war kein einziger Schweizer Shop dabei.
    // Die Rangfolge stand bisher nur als Bitte im Regeltext - das
    // Modell sah die Stufe gar nicht. Jetzt steht sie bei jedem
    // Produkt als Zahl.
    const mitId = kandidaten.map((p, i) => ({
      ...p,
      id: 'p_' + String(i + 1).padStart(2, '0'),
      shopStufe: shopStufe(p)
    }));
    const nachId = new Map(mitId.map((p) => [p.id, p]));

    // Jetzt mit den richtigen IDs (p_01, p_02, ...)
    protokoll.kandidaten(mitId, shopStufe);

    // ---------- Cache an die Kandidaten binden ----------
    // Beobachtet am 23.09.: Eine 22 Stunden alte Bewertung verwies
    // auf Produkte, die es nach dem Zusammenfassen der Doppelten
    // nicht mehr gab. Der Nutzer bekam EIN Produkt statt drei.
    // Aendert sich die Kandidatenliste, ist die alte Bewertung
    // wertlos - also gehoert sie in den Schluessel.
    const kandidatenAbdruck = crypto
      .createHash('sha1')
      .update(mitId.map((p) => String(p.title || p.name || '')).join('|'))
      .digest('hex')
      .slice(0, 8);
    const bewertungSchluesselGenau = `${bewertungSchluessel}-${kandidatenAbdruck}`;

    // ---------- Produktwissen (Stufe 2, breit) ----------
    // Google Shopping liefert nur Name, Preis, Shop und Sterne.
    // Bauform, Akkulaufzeit, Sterneverteilung und echte
    // Bewertungstexte kommen von der SerpAPI-Produktseite - einmal
    // pro Produkt, danach aus der Datenbank.
    try {
      const wissen = await produktWissen.zuListe(mitId, shopKategorien.kategorieErkennen(vollstaendig));
      let mitWissen = 0;
      for (const p of mitId) {
        const w = wissen.get(p.id);
        if (!w) continue;
        p.wissen = w;
        p.wissenText = produktWissen.alsText(w);   // Faktenpruefung liest das mit
        if (p.wissenText) mitWissen += 1;
      }
      if (mitWissen) console.log(`[wissen] ${mitWissen} von ${mitId.length} Produkten mit Zusatzdaten`);
    } catch (e) {
      // Ohne Zusatzwissen laeuft die Suche weiter, nur duenner
      console.warn('[wissen] nicht verfuegbar:', e.message);
    }

    // --------------------------------------
    // STUFE 4: bewerten
    // --------------------------------------
    let bewertung = null;
    let konsensHinweis = null; // steht da, wenn die Modelle uneinig waren
    let bewertungAusCache = false;

    // Gespeicherte Bewertung ueber die Google-Produkt-ID wieder zuordnen.
    // So passen die Begruendungen auch zu frisch geholten Preisen.
    const gecachteBewertung = await cache.holen('bewertung', bewertungSchluesselGenau);
    if (gecachteBewertung && Array.isArray(gecachteBewertung.empfehlungen)) {
      const nachGoogleId = new Map(
        mitId.filter((p) => p.product_id).map((p) => [String(p.product_id), p.id])
      );

      const umgesetzt = [];
      for (const e of gecachteBewertung.empfehlungen) {
        const produktId = nachGoogleId.get(String(e.google_id));
        if (!produktId) continue;
        umgesetzt.push({
          produkt_id: produktId,
          gruende: e.gruende,
          nachteile: e.nachteile,
          fuerWen: e.fuerWen,
          synoraScore: e.synoraScore
        });
      }

      // Nur nutzen, wenn die Produkte heute noch da sind
      if (umgesetzt.length) {
        bewertung = {
          success: true,
          empfehlungen: umgesetzt,
          zusammenfassung: gecachteBewertung.zusammenfassung,
          warnung: gecachteBewertung.warnung || null,
          metrics: { kosten: 0, ausCache: true }
        };
        bewertungAusCache = true;
        console.log(`[bewertung] aus Cache | ${umgesetzt.length} Empfehlungen | 0 USD`);
      }
    }

    if (!bewertung) {
      const bewertungStart = Date.now();
      // ---------- Stufe 4 und 5: zwei Modelle, dann Konsens ----------
      // Beide bekommen GENAU denselben Auftrag und laufen gleichzeitig.
      // Sind sie sich bei Platz 1 einig, ist das ein starkes Zeichen.
      // Sind sie es nicht, erfaehrt der Nutzer davon.
      // Die Stufe entscheidet, welche Modelle bewerten. Premium
      // bekommt das starke Paar, Gratis das guenstige - und die
      // Kostenbremse rechnet mit genau diesen zwei Preisen.
      const bewertungsStufe = kostenbremse.stufeFuer(istPremium(req));

      const urteil = await konsens.bewerten({
        // Vollstaendige Anfrage: Produkt UND Antwort auf die Rueckfrage.
        query: vollstaendig,
        produkte: mitId,
        kontext: { land: 'CH', budget, waehrung: 'CHF' },
        stufe: bewertungsStufe
      });

      // ---------- Modellkosten bei einem Cache-Treffer ----------
      // Kamen die Produkte aus dem Cache, hat die Kostenbremse
      // vorhin NICHTS gebucht - es floss ja kein Geld an SerpAPI.
      // Die Bewertung hier kostet aber trotzdem: zwei Modelle
      // laufen. Das lief bisher an der Bremse vorbei.
      if (produkteAusCache && !(typeof cache.abspielen === 'function' && cache.abspielen())) {
        try {
          await kostenbremse.bewertungBuchen({ istPremium: istPremium(req) });
        } catch (e) {
          console.error('[kosten] Bewertung nicht verbucht:', e.message);
        }
      }

      bewertung = urteil.bewertung || { success: false, empfehlungen: [] };
      konsensHinweis = urteil.hinweis || null;

      // Jede Bewertung einzeln mitschreiben - so siehst du spaeter,
      // welches Modell wie oft danebenliegt.
      for (const e of urteil.einzeln) protokoll.bewertung(e);

      protokoll.konsens({
        einstimmigTop1: urteil.einstimmigTop1,
        runden: 1,
        uneinigkeit: urteil.uneinigkeit
      });

      console.log(
        `[bewertung] ${bewertung.success ? 'ok' : 'Fehler'} | ` +
          `${(bewertung.empfehlungen || []).length} Empfehlungen | ` +
          `${bewertung.metrics ? bewertung.metrics.kosten : '?'} USD`
      );

      // Mit der Google-ID speichern, nicht mit p_01 - die aendert sich
      // bei jeder Suche, die Google-ID bleibt.
      if (bewertung.success && (bewertung.empfehlungen || []).length) {
        const nachInterneId = new Map(mitId.map((p) => [p.id, p]));
        const zuSpeichern = bewertung.empfehlungen
          .map((e) => {
            const quelle = nachInterneId.get(e.produkt_id);
            return {
              google_id: quelle && quelle.product_id ? String(quelle.product_id) : null,
              gruende: e.gruende,
              nachteile: e.nachteile,
              fuerWen: e.fuerWen,
              synoraScore: e.synoraScore
            };
          })
          .filter((e) => e.google_id);

        if (zuSpeichern.length) {
          await cache.speichern(
            'bewertung',
            bewertungSchluesselGenau,
            {
              zusammenfassung: bewertung.zusammenfassung,
              warnung: bewertung.warnung || null,
              empfehlungen: zuSpeichern
            },
            { begriff, budget }
          );
        }
      }
    }

    // --------------------------------------
    // STUFE 6: Antwort zusammenbauen
    // --------------------------------------
    const produkte = [];
    const quellen = []; // gleiche Reihenfolge wie produkte
    const gestrichen = []; // was die Faktenpruefung entfernt hat
    const verdaechtig = new Map(); // Produkte mit Faelschungsverdacht
    let antwortText;

    if (bewertung.success && bewertung.empfehlungen.length) {
      antwortText = cleanText(idsErsetzen(bewertung.zusammenfassung, nachId)) || 'Das wuerde ich dir empfehlen:';

      if (bewertung.warnung) {
        antwortText += '\n\n' + cleanText(bewertung.warnung);
      }

      for (const emp of bewertung.empfehlungen) {
        // Nachschlagen statt suchen - das ist der eigentliche Fix
        const quelle = nachId.get(emp.produkt_id);
        if (!quelle) continue;

        quellen.push(quelle);
        // ---------- Faktenpruefung ----------
        // Erfundene Bewertungszahlen, falsche Bauformen und
        // "kabelgebunden" bei Bluetooth-Geraeten fliegen hier raus,
        // bevor der Nutzer sie sieht.
        // cleanText entfernt auch Produkt-IDs. Lief bisher nur ueber
        // die Zusammenfassung - darum standen "Guenstiger als p_02"
        // und "teurer als p_03" in den Begruendungen.
        const vorteilePruefung = faktenpruefung.saetzePruefen(
          toList(emp.gruende, 3).map((t) => cleanText(idsErsetzen(t, nachId))).filter(Boolean), quelle
        );
        const nachteilePruefung = faktenpruefung.saetzePruefen(
          toList(emp.nachteile, 2).map((t) => cleanText(idsErsetzen(t, nachId))).filter(Boolean), quelle
        );

        for (const e of [...vorteilePruefung.entfernt, ...nachteilePruefung.entfernt]) {
          console.warn(`[fakten] gestrichen bei ${quelle.id}: ${e.grund}`);
          gestrichen.push({ produkt: quelle.id, grund: e.grund, satz: e.satz });
        }

        // ---------- Grundsatz 2: nie ohne Nachteil ----------
        // Streicht die Pruefung alle Nachteile weg, darf die Karte
        // nicht einfach makellos dastehen. Dann sagen wir ehrlich,
        // dass die Datenlage zu duenn ist - das ist selbst eine
        // nuetzliche Information fuer den Nutzer.
        let nachteileFertig = nachteilePruefung.behalten;

        // ---------- Faelschungsverdacht ----------
        // Der Code entscheidet, nicht das Modell. Ein Angebot weit
        // unter allen anderen Shops ist bei Markenware ein Warnzeichen,
        // und das muss der Nutzer sehen - ganz oben, nicht als
        // dritter Punkt.
        const preisWarnung = produktWissen.preisVerdaechtig(quelle, quelle.wissen);
        verdaechtig.set(quelle.id, !!preisWarnung);
        if (preisWarnung) {
          nachteileFertig = [preisWarnung, ...nachteileFertig];
          console.warn(`[preis] Verdacht bei ${quelle.id}: ${quelle.priceValue} statt ~${quelle.wissen.preisSpanne.mittel}`);
          gestrichen.push({ produkt: quelle.id, grund: 'Preis weit unter anderen Shops', satz: preisWarnung });
        }
        if (!nachteileFertig.length) {
          nachteileFertig = [
            'Zu diesem Produkt stehen zu wenige gesicherte Angaben zur Verfügung, um einen belegbaren Nachteil zu nennen – prüf die Angaben im Shop.'
          ];
          console.warn(`[fakten] ${quelle.id}: kein belegbarer Nachteil uebrig`);
        }

        produkte.push(
          baueProdukt(quelle, {
            score: typeof emp.synoraScore === 'number' ? emp.synoraScore : null,
            reason: toList(emp.gruende, 1)[0] || '',
            whyItFits: vorteilePruefung.behalten,
            nachteile: nachteileFertig,
            fuerWen: emp.fuerWen,
            bewertetVonKi: true
          })
        );
      }
    }

    // Notfallpfad: KI nicht verfuegbar. Ehrlich benennen statt
    // erfundene Begruendungen anzuzeigen.
    if (!produkte.length) {
      antwortText =
        'Meine Bewertung laeuft gerade nicht. Damit du trotzdem weiterkommst, hier die Suchtreffer - ungeprueft und ohne Empfehlung von mir.';

      for (const p of mitId.slice(0, 3)) {
        quellen.push(p);
        produkte.push(baueProdukt(p, { bewertetVonKi: false }));
      }
    }

    await baueKlickLinks(produkte, quellen, {
      anfrage: message,
      budget,
      sucheId,
      nutzerId: req.user ? req.user._id : null
    });

    // Erst JETZT zaehlen - nach einer erfolgreichen Suche.
    // Faellt ein Dienst aus, verliert der Nutzer keine Suche.
    let limitInfo = null;
    if (req.limit && typeof req.limit.verbuchen === 'function') {
      const nachher = await req.limit.verbuchen();
      limitInfo = {
        typ: req.limit.typ,
        limit: nachher && nachher.limit !== undefined ? nachher.limit : req.limit.limit,
        verbleibend: nachher ? nachher.verbleibend : req.limit.verbleibend
      };
      if (limitInfo.limit === Infinity) limitInfo.limit = null;
      if (limitInfo.verbleibend === Infinity) limitInfo.verbleibend = null;
    }

    // Zahlen erfassen, wo sie entstehen. Laeuft nebenher.
    Analytics.track('suche', {
      userId: req.user ? req.user._id : null,
      sessionId: sucheId,
      suchanfrage: message,
      dauer: Date.now() - start,
      anzahl: produkte.length,
      erfolg: produkte.length > 0,
      ki: bewertungAusCache
        ? { provider: null, kosten: 0 }
        : {
            provider: 'claude',
            model: bewertung.metrics ? bewertung.metrics.model : null,
            tokensInput: bewertung.metrics ? bewertung.metrics.tokensInput : 0,
            tokensOutput: bewertung.metrics ? bewertung.metrics.tokensOutput : 0,
            kosten: bewertung.metrics ? bewertung.metrics.kosten : 0,
            antwortzeit: bewertung.metrics ? bewertung.metrics.antwortzeit : 0
          },
      metadata: {
        budget: budget || null,
        begriff,
        ausCache: produkteAusCache && bewertungAusCache,
        ausgeschlossen: abgelehnt.length
      }
    });

    console.log(`[fertig] ${produkte.length} Produkte in ${Date.now() - start} ms` + (produkteAusCache || bewertungAusCache ? ` | Cache: ${produkteAusCache ? 'Produkte' : ''}${produkteAusCache && bewertungAusCache ? '+' : ''}${bewertungAusCache ? 'Bewertung' : ''}` : ''));

    // ---------- Verdaechtige nie auf Platz 1 ----------
    // Ein Angebot mit Faelschungsverdacht darf erscheinen - der
    // Nutzer soll selbst entscheiden koennen. Aber es darf nicht
    // die Empfehlung sein. Beobachtet am 23.09.: "Apple AirPods 4"
    // fuer CHF 64 bei einem unbekannten Shop stand auf Platz 1.
    if (produkte.length > 1 && verdaechtig.get(produkte[0].id)) {
      // Das erste SAUBERE Produkt nach vorn holen. Das Verdaechtige
      // nur nach hinten zu schieben reicht nicht - dann steht
      // womoeglich das naechste verdaechtige vorn.
      const sauber = produkte.findIndex((p) => !verdaechtig.get(p.id));
      if (sauber > 0) {
        const [hoch] = produkte.splice(sauber, 1);
        produkte.unshift(hoch);
        console.warn(`[preis] ${hoch.id} auf Platz 1 gezogen, verdaechtige Angebote nach hinten`);
      } else {
        console.warn('[preis] Alle Produkte verdaechtig - Reihenfolge unveraendert');
      }
    }

    // ---------- Wurde erfuellt, was der Nutzer wollte? ----------
    // Der Fragenblock liefert klare Angaben: "Over-Ear", "wasserfest".
    // Wird das nicht erfuellt, muss SYNORA das sagen - nicht
    // behaupten, es sei "wie gefordert". Beobachtet am 24.09.:
    // Nutzer waehlte Over-Ear, bekam On-Ear mit dem Satz
    // "On-Ear Bauform wie gefordert".
    try {
      const gewuenscht = anforderungen.lesen(vollstaendig, quellen);
      const hinweise = anforderungen.pruefen(gewuenscht, quellen);

      for (const h of hinweise) {
        console.log(`[anforderung] ${h.hart ? 'nicht erfuellt' : 'unklar'}: ${h.text.slice(0, 80)}`);
      }

      if (hinweise.length && antwortText) {
        // Harte Hinweise zuerst - die sind wichtiger
        const sortiert = [...hinweise].sort((a, b) => Number(b.hart) - Number(a.hart));
        antwortText += '\n\n' + sortiert.map((h) => h.text).join(' ');
      }
    } catch (e) {
      console.warn('[anforderung] Pruefung fehlgeschlagen:', e.message);
    }

    // ---------- Uneinigkeit benennen ----------
    // Lieber ehrlich unsicher als falsch sicher.
    if (konsensHinweis && antwortText) {
      antwortText += '\n\n' + konsensHinweis;
    }

    // ---------- Zusammenfassung pruefen ----------
    // Sie gehoert zu keinem einzelnen Produkt, darum: eine genannte
    // Bewertungszahl muss zu IRGENDEINEM der Empfohlenen passen.
    if (antwortText && quellen.length) {
      const zPruefung = faktenpruefung.zusammenfassungPruefen(antwortText, quellen);
      for (const e of zPruefung.entfernt) {
        console.warn(`[fakten] Satz aus der Zusammenfassung gestrichen: ${e.grund}`);
        gestrichen.push({ produkt: null, grund: e.grund, satz: e.satz });
      }
      if (zPruefung.text) antwortText = zPruefung.text;
    }

    if (gestrichen.length) {
      console.warn(`[fakten] ${gestrichen.length} Aussagen entfernt`);
    }

    // ---------- Stufe 7: Mitschrieb abschliessen ----------
    // Ohne await: der Nutzer wartet nicht auf den Mitschrieb.
    protokoll.daten.sucheId = sucheId;
    protokoll
      .gestrichen(gestrichen)
      .ergebnis(produkte)
      .cache('produkte', produkteAusCache)
      .cache('bewertung', bewertungAusCache)
      .regelStand(regelStand)
      .speichern();

    res.json({
      response: antwortText,
      products: produkte,
      budget: budget || null,
      sucheId,
      ausgeschlossen: abgelehnt.length,
      ausGelernt: gelernt.length,
      ausCache: { produkte: produkteAusCache, bewertung: bewertungAusCache },
      limit: limitInfo,
      isLoggedIn: !!req.istEingeloggt
    });
  } catch (error) {
    console.error('[chat] Fehler:', error.message);
    try {
      if (protokoll) protokoll.fehler(error.message).speichern();
    } catch (e) { /* Mitschrieb darf nie stoeren */ }
    console.error(error.stack);

    res.status(500).json({
      error: 'Es gab einen Fehler. Bitte versuche es erneut.',
      response: 'Es gab einen Fehler. Bitte versuche es erneut.',
      products: [],
      isLoggedIn: !!req.istEingeloggt
    });
  }
};

module.exports = {
  sendMessage,
  // Fuer die Tests von aussen erreichbar
  extrahiereBudget,
  sucheBegriff,
  harteFilter,
  kandidatenWaehlen,
  istSchweiz,
  shopStufe,
  begriffKuerzen,
  toText,
  toList
};