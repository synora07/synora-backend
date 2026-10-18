// ============================================
// SYNORA - Rueckfragen
// ============================================
// "Kopfhoerer bis 200 Franken" sagt fast nichts. In-Ear oder
// Over-Ear? Zum Sport oder fuers Buero? Ohne diese Angabe raet
// SYNORA - und Raten war der Grund, warum vorher drei billige
// Ohrhoerer herauskamen.
//
// Regeln, damit es nicht nervt:
//   - Hoechstens EINE Frage pro Suche
//   - Hoechstens EINE Frage im ganzen Gespraech
//   - Nur fragen, wenn wirklich zu wenig da ist
//   - Immer eine Antwort "ist mir egal" anbieten
//   - Bei der Rueckfrage wird NICHT gesucht (spart einen
//     SerpAPI-Aufruf, und bei 250 im Monat zaehlt das)
//
// Die Fragen stehen im Code, nicht im Modell. Das kostet nichts,
// ist vorhersehbar und faellt nicht aus.
// ============================================

'use strict';

let kategorien = null;
try {
  kategorien = require('./shopKategorien');
} catch (e) {
  console.warn('[rueckfrage] Kategorien nicht geladen:', e.message);
}

const EGAL = 'Ist mir egal – zeig mir einfach etwas';

// ============================================
// FRAGEN JE HAUPTKATEGORIE
// Je eine Frage, die den Vorschlag wirklich veraendert.
// Nicht: "Welche Farbe?" - das aendert nichts an der Eignung.
// ============================================

const FRAGEN = {
  'elektronik.audio': {

    frage: 'Wofür brauchst du sie hauptsächlich?',
    optionen: ['Unterwegs in Bahn und Bus', 'Zum Sport', 'Zu Hause oder im Büro', 'Zum Telefonieren']
  },
  'elektronik.laptops': {
    frage: 'Was machst du damit hauptsächlich?',
    optionen: ['Büro, Internet, Videos', 'Studium und Schule', 'Gaming', 'Bild- oder Videobearbeitung']
  },
  'elektronik.smartphones': {
    frage: 'Was ist dir am wichtigsten?',
    optionen: ['Gute Kamera', 'Lange Akkulaufzeit', 'Möglichst günstig', 'Leistung für Spiele']
  },
  'elektronik.monitore': {
    frage: 'Wofür nutzt du den Bildschirm?',
    optionen: ['Büroarbeit', 'Gaming', 'Bild- und Videobearbeitung', 'Einfach ein zweiter Bildschirm']
  },
  'elektronik.tv': {
    frage: 'Wie gross soll er sein?',
    optionen: ['Bis 43 Zoll', '50 bis 55 Zoll', '65 Zoll oder grösser', 'Weiss ich noch nicht']
  },
  'elektronik.gaming': {
    frage: 'Worum geht es dir?',
    optionen: ['Konsole', 'Gaming-PC', 'Zubehör wie Maus oder Tastatur', 'Ein Spiel']
  },
  'elektronik.haushaltsgeraete': {
    frage: 'Was ist dir wichtiger?',
    optionen: ['Möglichst günstig', 'Wenig Strom verbrauchen', 'Lange halten', 'Leise sein']
  },
  'elektronik.foto': {
    frage: 'Wie fotografierst du?',
    optionen: ['Einsteiger, einfach loslegen', 'Schon Erfahrung', 'Für Videos', 'Unterwegs und leicht']
  },
  'mode.schuhe': {
    frage: 'Wofür brauchst du sie?',
    optionen: ['Alltag', 'Sport und Laufen', 'Arbeit', 'Besondere Anlässe']
  },
  'sport_outdoor.laufen': {
    frage: 'Wo läufst du meistens?',
    optionen: ['Auf Asphalt', 'Im Gelände', 'Auf dem Laufband', 'Gemischt']
  },
  'bau_werkzeug.elektrowerkzeug': {
    frage: 'Wie oft brauchst du es?',
    optionen: ['Ab und zu zu Hause', 'Regelmässig', 'Beruflich, täglich', 'Einmalig für ein Projekt']
  },
  'auto_motorrad.reifen': {
    frage: 'Welche Grösse brauchst du?',
    optionen: ['Weiss ich, sage ich gleich', 'Steht in meinem Fahrzeugausweis', 'Brauche Hilfe beim Finden']
  },
  'moebel_wohnen.matratzen': {
    frage: 'Wie schläfst du?',
    optionen: ['Auf dem Rücken', 'Auf der Seite', 'Auf dem Bauch', 'Gemischt']
  },
  'industrie_b2b.bauteile': {
    frage: 'Für wen ist die Bestellung?',
    optionen: ['Privat, Einzelstücke', 'Firma, kleine Menge', 'Firma, grössere Menge']
  }
};

// Wenn die Unterkategorie keine eigene Frage hat, greift die
// Hauptkategorie
// ============================================
// ZUSATZFRAGEN
// ============================================
// Eine Frage reicht bei den grossen Kategorien nicht. "Kopfhoerer"
// sagt nichts ueber Bauform und Eigenschaften. Diese Fragen kommen
// ZUSAMMEN mit der ersten - drei Fragen nacheinander vertreiben die
// Leute, drei Fragen in einem Block nicht.
//
// Fuer alle anderen Kategorien erstellt SYNORA die Fragen selbst
// (fragenService.js) und legt sie in der Datenbank ab.

const ZUSATZ = {
  'elektronik.audio': [
    {
      frage: 'Welche Bauform?',
      optionen: ['In-Ear, klein im Ohr', 'Over-Ear, ums Ohr', 'On-Ear, auf dem Ohr', 'Egal'],
      mehrfach: false
    },
    {
      frage: 'Was ist dir sonst wichtig?',
      optionen: ['Geräuschunterdrückung', 'Lange Akkulaufzeit', 'Wasserfest', 'Gutes Mikrofon'],
      mehrfach: true
    }
  ],
  'elektronik.laptops': [
    {
      frage: 'Welche Grösse?',
      optionen: ['13 Zoll, gut tragbar', '15 Zoll, ausgewogen', '17 Zoll, viel Bildschirm', 'Egal'],
      mehrfach: false
    },
    {
      frage: 'Was ist dir sonst wichtig?',
      optionen: ['Lange Akkulaufzeit', 'Viel Speicher', 'Leicht', 'Guter Bildschirm'],
      mehrfach: true
    }
  ],
  'elektronik.smartphones': [
    {
      frage: 'Welches System?',
      optionen: ['Android', 'iPhone', 'Egal'],
      mehrfach: false
    },
    {
      frage: 'Welche Grösse?',
      optionen: ['Kompakt, passt in die Hand', 'Gross, viel Bildschirm', 'Egal'],
      mehrfach: false
    }
  ],
  'mode.schuhe': [
    {
      frage: 'Welche Grösse brauchst du?',
      optionen: ['Sage ich gleich', 'Muss ich nachschauen'],
      mehrfach: false
    }
  ],
  'sport_outdoor.laufen': [
    {
      frage: 'Was ist dir wichtig?',
      optionen: ['Dämpfung', 'Leicht', 'Wasserdicht', 'Lange Haltbarkeit'],
      mehrfach: true
    }
  ]
};

/**
 * Egal ob eine Frage oder mehrere - hier kommt immer eine Liste
 * heraus. So muss der Rest des Codes nur eine Form kennen.
 */
function alsBlock(eintrag, pfad) {
  if (!eintrag) return [];
  const erste = Array.isArray(eintrag)
    ? eintrag
    : [{ frage: eintrag.frage, optionen: eintrag.optionen, mehrfach: !!eintrag.mehrfach }];

  const zusatz = (pfad && ZUSATZ[pfad]) || [];
  return [...erste, ...zusatz];
}

const FRAGEN_HAUPT = {
  elektronik: {
    frage: 'Wofür brauchst du es hauptsächlich?',
    optionen: ['Privat zu Hause', 'Für die Arbeit', 'Unterwegs', 'Als Geschenk']
  },
  mode: {
    frage: 'Für welchen Anlass?',
    optionen: ['Alltag', 'Arbeit', 'Sport', 'Besonderer Anlass']
  },
  sport_outdoor: {
    frage: 'Wie oft machst du das?',
    optionen: ['Anfänger, ab und zu', 'Regelmässig', 'Sehr oft, ernsthaft']
  },
  garten: {
    frage: 'Wie gross ist deine Fläche?',
    optionen: ['Balkon oder klein', 'Normaler Garten', 'Grosses Grundstück']
  },
  baby_kind: {
    frage: 'Für welches Alter?',
    optionen: ['Neugeboren', 'Bis 1 Jahr', '1 bis 3 Jahre', 'Älter als 3']
  }
};

const FRAGE_ALLGEMEIN = {
  frage: 'Damit ich nicht raten muss: Wofür brauchst du es?',
  optionen: ['Für mich selbst', 'Als Geschenk', 'Für die Arbeit']
};

// ============================================
// EIGENE FRAGEN ERKENNEN
// ============================================
// Sich auf eine Markierung aus dem Frontend zu verlassen war ein
// Fehler: kommt sie nicht mit, fragt SYNORA endlos weiter und
// sucht am Ende nach "Ist mir egal". Darum erkennt SYNORA seine
// eigenen Fragen am Text - das funktioniert unabhaengig davon,
// was das Frontend mitschickt.

const ALLE_FRAGEN = (() => {
  const texte = new Set();
  for (const v of Object.values(FRAGEN)) texte.add(v.frage);
  for (const v of Object.values(FRAGEN_HAUPT)) texte.add(v.frage);
  texte.add(FRAGE_ALLGEMEIN.frage);
  return texte;
})();

function istUnsereFrage(text) {
  if (!text) return false;
  const t = String(text).trim();
  return ALLE_FRAGEN.has(t);
}

// ============================================
// ENTSCHEIDEN
// ============================================

/** Hat SYNORA in diesem Gespraech schon gefragt? */
function schonGefragt(verlauf) {
  if (!Array.isArray(verlauf)) return false;
  return verlauf.some(
    (m) =>
      m &&
      m.role === 'assistant' &&
      (m.istRueckfrage || m.rueckfrage || istUnsereFrage(m.content))
  );
}

/** Will der Nutzer keine Fragen? */
function willKeineFragen(text) {
  const t = String(text || '').toLowerCase();
  return /\b(egal|einfach|schnell|irgendwas|keine ahnung|zeig mir|weiss nicht|weiß nicht)\b/.test(t);
}

/**
 * Reicht das, was der Nutzer gesagt hat?
 *
 * Genug ist es, wenn mindestens ZWEI von diesen vorliegen:
 * Budget, Zweck, Eigenschaft, Marke.
 * Eines allein - etwa nur ein Budget - reicht nicht.
 */
function genugAngaben(anforderungen, budget) {
  let punkte = 0;
  if (budget) punkte += 1;
  if (anforderungen?.zweck) punkte += 1;
  if (anforderungen?.eigenschaften?.length) punkte += 1;
  if (anforderungen?.marke) punkte += 1;
  return punkte >= 2;
}

/**
 * Soll SYNORA nachfragen?
 * @returns {{frage:string, optionen:string[]}|null}
 */
function pruefen({ nachricht, anforderungen, budget, verlauf }) {
  if (schonGefragt(verlauf)) return null;
  if (willKeineFragen(nachricht)) return null;
  if (genugAngaben(anforderungen, budget)) return null;

  // Sehr lange Anfragen enthalten meist genug Zusammenhang,
  // auch wenn die Stichwoerter nicht greifen
  const woerter = String(nachricht || '').trim().split(/\s+/).length;
  if (woerter > 12) return null;

  const pfad = kategorien ? kategorien.kategorieErkennen(nachricht) : null;
  const haupt = pfad ? pfad.split('.')[0] : null;

  const vorlage =
    (pfad && FRAGEN[pfad]) ||
    (haupt && FRAGEN_HAUPT[haupt]) ||
    FRAGE_ALLGEMEIN;

  const block = alsBlock(vorlage, pfad);
  if (!block.length) return null;

  // Nur der ersten Frage wird "ist mir egal" angehaengt - bei den
  // uebrigen kann der Nutzer einfach nichts auswaehlen.
  block[0] = { ...block[0], optionen: [...block[0].optionen, EGAL] };

  return {
    fragen: block,
    // Die erste Frage einzeln, damit alte Aufrufe nicht brechen
    frage: block[0].frage,
    optionen: block[0].optionen,
    kategorie: pfad || haupt || null
  };
}

// ============================================
// ANTWORT ZUSAMMENFUEHREN
// ============================================
// Tippt jemand "Unterwegs in Bahn und Bus", darf SYNORA nicht
// danach suchen. Die Antwort muss mit der urspruenglichen Frage
// zusammengefuegt werden.

/**
 * War die letzte Nachricht von SYNORA eine Rueckfrage?
 *
 * Wichtig: Die Antwort ist Zusammenhang fuer das MODELL, nicht fuer
 * Google. "Kopfhoerer - Zu Hause oder im Buero" ist kein Suchbegriff,
 * damit findet Google nichts. Darum kommen zwei Dinge zurueck:
 *
 *   text        - geht ans Modell, enthaelt alles
 *   suchbegriff - geht an Google, nur der Produktbegriff
 *
 * @returns {{text:string, suchbegriff:string|null}}
 */
function zusammenfuehren(nachricht, verlauf) {
  if (!Array.isArray(verlauf) || verlauf.length < 2) {
    return { text: nachricht, suchbegriff: null };
  }

  // Letzte Nachricht von SYNORA
  let letzteAssistent = null;
  for (let i = verlauf.length - 1; i >= 0; i--) {
    if (verlauf[i]?.role === 'assistant') { letzteAssistent = verlauf[i]; break; }
  }

  const warRueckfrage =
    letzteAssistent &&
    (letzteAssistent.istRueckfrage ||
      letzteAssistent.rueckfrage ||
      istUnsereFrage(letzteAssistent.content));
  if (!warRueckfrage) return { text: nachricht, suchbegriff: null };

  // Die Anfrage davor
  let vorherige = null;
  let nachAssistent = false;
  for (let i = verlauf.length - 1; i >= 0; i--) {
    const m = verlauf[i];
    if (m?.role === 'assistant') { nachAssistent = true; continue; }
    if (nachAssistent && m?.role === 'user' && m.content !== nachricht) {
      vorherige = m.content;
      break;
    }
  }

  if (!vorherige) return { text: nachricht, suchbegriff: null };

  // "Ist mir egal" bringt keinen Zusammenhang dazu.
  //
  // GEAENDERT am 03.10.2026: hier stand .includes('egal') ohne
  // Wortgrenze. Damit wurden auch "Fuer mein REGAL", "LEGAL und
  // sicher" oder "unangemessen" als "egal" gelesen - und die
  // Antwort des Nutzers wurde weggeworfen, obwohl sie den Zweck
  // genannt hat.
  //
  // Zehn Zeilen weiter oben, in willKeineFragen(), stand die
  // richtige Fassung mit \b...\b schon drin. Hier war sie vergessen.
  if (/\begal\b/i.test(String(nachricht))) {
    return { text: vorherige, suchbegriff: vorherige };
  }

  // Das Modell bekommt beides, Google nur den Produktbegriff
  return {
    text: `${vorherige} (${nachricht})`,
    suchbegriff: vorherige
  };
}

module.exports = {
  pruefen,
  alsBlock,
  ZUSATZ,
  istUnsereFrage,
  zusammenfuehren,
  schonGefragt,
  genugAngaben,
  willKeineFragen,
  EGAL
};