// ============================================
// SYNORA - Faktenpruefung
// ============================================
// Das Modell erfindet Zahlen und Eigenschaften. Beobachtet am
// 22.09.: derselbe Marshall Major V hatte in zwei Suchen kurz
// hintereinander "2271 Bewertungen" und "1074 Bewertungen", und
// ein Bluetooth-Kopfhoerer wurde als "kabelgebunden" verkauft.
//
// Regeln im Prompt haben das nicht verhindert. Zahlen und Bauformen
// lassen sich aber gegen die echten Daten pruefen, und genau das
// passiert hier: Jede Aussage, die den Produktdaten widerspricht
// oder sich nicht belegen laesst, wird entfernt, bevor der Nutzer
// sie sieht.
//
// Grundsatz: Im Zweifel streichen. Eine Begruendung weniger ist
// besser als eine erfundene Zahl.
// ============================================

'use strict';

// ============================================
// ZAHLEN
// ============================================

/** "1'074" oder "1.074" oder "1074" -> 1074 */
function zuGanzzahl(roh) {
  const sauber = String(roh).replace(/['’\s.]/g, '').replace(/,/g, '');
  const n = Number.parseInt(sauber, 10);
  return Number.isFinite(n) ? n : null;
}

/** "4.7" oder "4,7" -> 4.7 */
function zuKomma(roh) {
  const n = Number.parseFloat(String(roh).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function produktText(p) {
  // WICHTIG: Das Produktwissen gehoert dazu. Steht die Bauform nur
  // in den Herstellerangaben und nicht im Titel, waere sie sonst
  // "nicht belegt" - und die Pruefung wuerde eine richtige Aussage
  // streichen.
  return String(
    [
      p.title,
      p.name,
      Array.isArray(p.extensions) ? p.extensions.join(' ') : '',
      p.wissenText || ''
    ]
      .filter(Boolean)
      .join(' ')
  ).toLowerCase();
}

// ============================================
// EINZELPRUEFUNGEN
// Jede gibt null zurueck, wenn alles in Ordnung ist,
// sonst den Grund fuers Streichen.
// ============================================

/** Bewertungszahl muss zur echten Zahl passen */
function pruefeAnzahl(satz, p) {
  const treffer = satz.match(/([\d'’.,]+)\s*(?:Bewertungen|Rezensionen|Reviews)/i);
  if (!treffer) return null;

  const behauptet = zuGanzzahl(treffer[1]);
  if (behauptet === null) return null;

  const echt = typeof p.reviews === 'number' ? p.reviews : zuGanzzahl(p.reviews);

  if (echt === null) return `Bewertungszahl ${behauptet} behauptet, aber zu diesem Produkt liegen keine Bewertungsdaten vor`;
  if (behauptet !== echt) return `Bewertungszahl falsch: ${behauptet} behauptet, ${echt} in den Daten`;
  return null;
}

/** Sternebewertung muss zur echten passen */
function pruefeSterne(satz, p) {
  const treffer = satz.match(/([\d]+[.,][\d]+|[1-5])\s*[- ]?Sterne?n?\b/i);
  if (!treffer) return null;

  const behauptet = zuKomma(treffer[1]);
  if (behauptet === null) return null;

  const echt = typeof p.rating === 'number' ? p.rating : zuKomma(p.rating);

  if (echt === null) return `Sternebewertung ${behauptet} behauptet, aber keine Bewertungsdaten vorhanden`;
  if (Math.abs(behauptet - echt) > 0.05) return `Sterne falsch: ${behauptet} behauptet, ${echt} in den Daten`;
  return null;
}

// ============================================
// BELEGPFLICHTIGE EIGENSCHAFTEN
// ============================================
// Wichtige Voreinstellung: IM ZWEIFEL STREICHEN.
//
// Frueher wurde nur gestrichen, was den Daten widersprach. Steht im
// Titel aber nur "Sony WH-CH520 Kopfhoerer", laesst sich nichts
// vergleichen - und "kabelgebunden" blieb stehen, obwohl es ein
// Bluetooth-Geraet ist.
//
// Darum gilt jetzt: Wer eine dieser Eigenschaften behauptet, braucht
// einen Beleg in Titel oder Produktdaten. Kein Beleg, kein Satz.
//
// Das macht die Karten kuerzer. Das ist gewollt.

// Deutsche Endungen: "kabelgebunden" wird zu "kabelgebundenes",
// "wasserdicht" zu "wasserdichte". Eine Wortgrenze direkt nach dem
// Stamm passt dann nicht mehr - genau daran ist "Kabelgebundenes
// Modell" am 22.09. durchgerutscht. Darum: Endung erlauben.
const E = '(?:e|es|er|en|em|s)?';

// ============================================
// "funk" - GEAENDERT am 03.10.2026
// ============================================
// Hier stand im Beleg-Muster nur `funk`, ohne irgendeine Begrenzung
// nach hinten. Gemeint war "Funkkopfhoerer". Getroffen wurde auch:
//
//     "Kabelkopfhoerer mit Klinke, viele FUNKTIONEN"  -> belegt
//     "Mikrofon-FUNKTION, 3.5mm"                      -> belegt
//     "FUNKTIONIERT mit Kabel"                        -> belegt
//
// Drei von fuenf Testfaellen falsch, gemessen am 03.10.2026. Und
// "Funktion" ist ungefaehr das haeufigste Wort in deutschen
// Produktbeschreibungen.
//
// Folge: bei einem KABELGEBUNDENEN Kopfhoerer durfte das Modell
// "kabellos" behaupten, und die Pruefung liess es durch. Das ist
// genau die Sorte Fehler, gegen die diese Datei gebaut wurde.
//
// Die Ausnahme schliesst die -tion-Woerter aus (Funktion,
// funktioniert, Funktionsumfang) und "funkeln". Alles andere -
// Funkkopfhoerer, Funkverbindung, Funktastatur, "per Funk" -
// zaehlt weiterhin als Beleg.
const FUNK = 'funk(?!tion|eln)';

const BELEGPFLICHTIG = [
  {
    name: 'kabelgebunden',
    behauptet: new RegExp(`\\b(kabelgebunden${E}|mit kabel|kabelverbindung|per kabel|kabel-)`, 'i'),
    beleg: new RegExp(`\\b(kabelgebunden${E}|wired|klinke|3[.,]5\\s*mm|aux|klinkenstecker)`, 'i')
  },
  {
    name: 'kabellos',
    behauptet: new RegExp(`\\b(kabellos${E}|wireless|bluetooth|true wireless)`, 'i'),
    beleg: new RegExp(`\\b(bluetooth|wireless|kabellos${E}|tws|${FUNK}|bt\\s*5)`, 'i')
  },
  {
    name: 'Over-Ear',
    behauptet: /\bover[- ]?ear\b/i,
    beleg: /\b(over[- ]?ear|ohrumschliessend|circumaural)\b/i
  },
  {
    name: 'On-Ear',
    behauptet: /\bon[- ]?ear\b/i,
    beleg: /\b(on[- ]?ear|ohraufliegend|supraaural)\b/i
  },
  {
    name: 'In-Ear',
    behauptet: /\bin[- ]?ear\b/i,
    beleg: /\b(in[- ]?ear|earbud|intra[- ]?auricul|ohrstoepsel|ohrstöpsel)\b/i
  },
  {
    name: 'Geraeuschunterdrueckung',
    behauptet: /\b(anc|active noise|geräuschunterdrück|geraeuschunterdrueck|noise cancel)\b/i,
    beleg: /\b(anc|noise cancel|geräuschunterdrück|geraeuschunterdrueck|nc\b)/i
  },
  {
    name: 'wasserdicht',
    behauptet: new RegExp(`\\b(wasserdicht${E}|waterproof|spritzwassergeschützt${E}|schweissfest${E})`, 'i'),
    beleg: new RegExp(`\\b(ipx[0-9]|ip[5-8][0-9]?|wasserdicht${E}|waterproof)`, 'i')
  }
];

/**
 * Behauptet der Satz eine Eigenschaft, die in den Daten nicht
 * belegt ist? Dann raus.
 */
function pruefeBelegt(satz, p) {
  const daten = produktText(p);

  for (const e of BELEGPFLICHTIG) {
    if (!e.behauptet.test(satz)) continue;
    if (e.beleg.test(daten)) continue;
    return `"${e.name}" behauptet, steht aber nicht in den Produktdaten`;
  }
  return null;
}

/** Zusaetzlich: zwei Bauformen zugleich sind immer falsch */
function pruefeBauform(satz, p) {
  const daten = produktText(p);
  const formen = [
    { name: 'Over-Ear', muster: /\bover[- ]?ear\b/i },
    { name: 'On-Ear', muster: /\bon[- ]?ear\b/i },
    { name: 'In-Ear', muster: /\b(in[- ]?ear|earbud)\b/i }
  ];

  const imSatz = formen.filter((f) => f.muster.test(satz));
  const inDaten = formen.filter((f) => f.muster.test(daten));

  if (imSatz.length && inDaten.length) {
    const passt = imSatz.some((s) => inDaten.some((d) => d.name === s.name));
    if (!passt) {
      return `Bauform falsch: ${imSatz[0].name} behauptet, die Daten sagen ${inDaten[0].name}`;
    }
  }
  return null;
}

/**
 * Nennt der Satz einen Shop, der nicht der Shop dieses Produkts ist?
 *
 * Beobachtet am 22.09.: Bei einem Produkt von coop.ch stand als
 * Nachteil "Shop ist mir nicht bekannt (Apfelkiste.ch)" - das war
 * der Shop eines anderen Produkts. Fuer den Nutzer ist so ein
 * Nachteil schlimmer als keiner, weil er den falschen Shop meidet.
 */
function pruefeShop(satz, p) {
  const eigener = String(p.source || p.shop || '').toLowerCase();

  // Shopnamen erkennen: etwas.ch, etwas.de, etwas.com
  const genannt = satz.match(/\b([a-z0-9äöü-]{3,}\.(ch|de|com|fr|at))\b/i);
  if (!genannt) return null;

  const shopImSatz = genannt[1].toLowerCase();
  const kern = shopImSatz.replace(/\.(ch|de|com|fr|at)$/, '');

  if (eigener.includes(kern)) return null;          // passt
  if (kern.length < 4) return null;                 // zu kurz, zu unsicher

  return `nennt den Shop ${genannt[1]}, das Produkt kommt aber von ${p.source || p.shop || 'unbekannt'}`;
}

const PRUEFUNGEN = [pruefeAnzahl, pruefeSterne, pruefeBauform, pruefeBelegt, pruefeShop];

// ============================================
// ANWENDEN
// ============================================

/**
 * Prueft die Saetze zu EINEM Produkt.
 * @returns {{behalten: string[], entfernt: Array<{satz:string, grund:string}>}}
 */
function saetzePruefen(saetze, produkt) {
  const behalten = [];
  const entfernt = [];

  for (const satz of saetze || []) {
    let grund = null;
    for (const pruefung of PRUEFUNGEN) {
      grund = pruefung(satz, produkt);
      if (grund) break;
    }
    if (grund) entfernt.push({ satz, grund });
    else behalten.push(satz);
  }

  return { behalten, entfernt };
}

/**
 * Prueft die Zusammenfassung. Sie gehoert zu keinem einzelnen
 * Produkt, darum gilt: Eine genannte Bewertungszahl muss zu
 * IRGENDEINEM der empfohlenen Produkte passen.
 */
function zusammenfassungPruefen(text, produkte) {
  if (!text) return { text, entfernt: [] };

  const echteZahlen = new Set();
  const echteSterne = new Set();
  for (const p of produkte || []) {
    const r = typeof p.reviews === 'number' ? p.reviews : zuGanzzahl(p.reviews);
    if (r !== null) echteZahlen.add(r);
    const s = typeof p.rating === 'number' ? p.rating : zuKomma(p.rating);
    if (s !== null) echteSterne.add(s);
  }

  const entfernt = [];
  const saetze = String(text).split(/(?<=[.!?])\s+/);

  const behalten = saetze.filter((satz) => {
    const anzahl = satz.match(/([\d'’.,]+)\s*(?:Bewertungen|Rezensionen)/i);
    if (anzahl) {
      const n = zuGanzzahl(anzahl[1]);
      if (n !== null && !echteZahlen.has(n)) {
        entfernt.push({ satz, grund: `Bewertungszahl ${n} gehoert zu keinem der Produkte` });
        return false;
      }
    }
    const sterne = satz.match(/([\d]+[.,][\d]+)\s*[- ]?Sterne/i);
    if (sterne) {
      const s = zuKomma(sterne[1]);
      if (s !== null && ![...echteSterne].some((e) => Math.abs(e - s) <= 0.05)) {
        entfernt.push({ satz, grund: `Sternewert ${s} gehoert zu keinem der Produkte` });
        return false;
      }
    }
    // Eigenschaften: "Alle drei sind Over-Ear mit Kabelverbindung"
    // darf nicht stehen bleiben, wenn es in keinem Produkt belegt ist.
    // Sonst widerspricht die Zusammenfassung den eigenen Karten.
    for (const e of BELEGPFLICHTIG) {
      if (!e.behauptet.test(satz)) continue;

      const belegtBei = (produkte || []).filter((p) => e.beleg.test(produktText(p)));
      const sagtAlle = /\b(alle|alle drei|jedes|saemtliche|sämtliche)\b/i.test(satz);

      const reichtNicht = sagtAlle
        ? belegtBei.length < (produkte || []).length
        : belegtBei.length === 0;

      if (reichtNicht) {
        entfernt.push({
          satz,
          grund: sagtAlle
            ? `"${e.name}" fuer alle behauptet, belegt nur bei ${belegtBei.length} von ${(produkte || []).length}`
            : `"${e.name}" behauptet, bei keinem Produkt belegt`
        });
        return false;
      }
    }

    return true;
  });

  return { text: behalten.join(' ').trim(), entfernt };
}

module.exports = {
  saetzePruefen,
  zusammenfassungPruefen,
  // fuer Tests
  pruefeAnzahl,
  pruefeSterne,
  pruefeBelegt,
  pruefeShop,
  pruefeBauform
};