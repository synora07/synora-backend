// ============================================
// SYNORA - Anforderungen lesen und pruefen
// ============================================
// Bisher wurde nur das Budget wirklich verstanden. Alles andere -
// Zweck, Marke, Eigenschaften - ging als Fliesstext ans Modell und
// wurde nirgends geprueft. Sagt jemand "kabellos" und bekommt drei
// Kabelkopfhoerer, faellt das niemandem auf.
//
// Hier passiert dreierlei:
//   1. Anforderungen aus der Anfrage herausziehen
//   2. Sie dem Modell ausdruecklich vorlegen, nicht nur als Fliesstext
//   3. Hinterher pruefen, ob sie erfuellt sind - und wenn nicht,
//      es sagen statt zu schweigen
//
// Wichtig zur Ehrlichkeit: Wenn eine Eigenschaft im Produkttitel
// nicht vorkommt, heisst das NICHT, dass das Produkt sie nicht hat.
// Es heisst nur, dass wir es nicht belegen koennen. Genau so wird
// es auch formuliert.
// ============================================

'use strict';

// ============================================
// EIGENSCHAFTEN
// Links steht, was der Nutzer sagt. Rechts, woran man es
// in Produktdaten erkennen koennte.
// ============================================

const EIGENSCHAFTEN = {
  geraeuschunterdrueckung: {
    gesagt: ['anc', 'geräuschunterdrückung', 'geraeuschunterdrueckung', 'noise cancel',
             'noise cancelling', 'noise-cancelling', 'laerm', 'lärm unterdrück'],
    erkennbar: ['anc', 'noise cancel', 'geräuschunterdrück', 'geraeuschunterdrueck', 'nc)'],
    klartext: 'Geräuschunterdrückung'
  },
  kabellos: {
    gesagt: ['kabellos', 'wireless', 'bluetooth', 'ohne kabel', 'funk'],
    erkennbar: ['wireless', 'kabellos', 'bluetooth', 'true wireless', 'tws'],
    klartext: 'kabellos'
  },
  kabelgebunden: {
    gesagt: ['mit kabel', 'kabelgebunden', 'klinke', '3.5 mm', '3,5 mm', 'jack'],
    erkennbar: ['kabelgebunden', 'wired', 'klinke', '3.5'],
    klartext: 'kabelgebunden'
  },
  wasserdicht: {
    gesagt: ['wasserdicht', 'waterproof', 'spritzwasser', 'schweissfest', 'regenfest'],
    erkennbar: ['ipx', 'ip5', 'ip6', 'ip7', 'wasserdicht', 'waterproof', 'spritzwasser'],
    klartext: 'wasserdicht'
  },
  ueberOhr: {
    gesagt: ['over-ear', 'over ear', 'ueber ohr', 'über ohr', 'bügelkopfhörer', 'buegelkopfhoerer'],
    erkennbar: ['over-ear', 'over ear', 'bügel', 'buegel'],
    klartext: 'Over-Ear'
  },
  aufOhr: {
    gesagt: ['on-ear', 'on ear', 'auf dem ohr', 'auf ohr'],
    erkennbar: ['on-ear', 'on ear', 'ohraufliegend', 'supraaural'],
    klartext: 'On-Ear'
  },
  imOhr: {
    gesagt: ['in-ear', 'in ear', 'ohrstöpsel', 'ohrstoepsel', 'earbuds', 'stöpsel'],
    erkennbar: ['in-ear', 'in ear', 'earbud', 'intra-auricul'],
    klartext: 'In-Ear'
  },
  langerAkku: {
    gesagt: ['lange akkulaufzeit', 'langer akku', 'viel akku', 'ausdauernd', 'lange laufzeit'],
    erkennbar: ['h akku', 'stunden', 'mah', '60h', '40h', '30h'],
    klartext: 'lange Akkulaufzeit'
  },
  leicht: {
    gesagt: ['leicht', 'leichtgewicht', 'nicht schwer'],
    erkennbar: ['leicht', 'lightweight', ' g)', 'gramm'],
    klartext: 'leicht'
  },
  gebraucht: {
    gesagt: ['gebraucht', 'refurbished', 'occasion', 'second hand', 'generalüberholt'],
    erkennbar: ['refurbished', 'gebraucht', 'occasion', 'generalüberholt'],
    klartext: 'gebraucht oder generalüberholt'
  },
  neu: {
    gesagt: ['nur neu', 'neuware', 'nicht gebraucht', 'originalverpackt'],
    erkennbar: [],
    klartext: 'Neuware'
  }
};

// ============================================
// ZWECK
// Was der Nutzer damit vorhat. Wird NICHT automatisch in
// Eigenschaften uebersetzt - "zum Pendeln" heisst nicht
// zwingend ANC. Das Modell soll das entscheiden, nicht ich.
// ============================================

function zweckLesen(text) {
  const treffer = String(text || '').match(
    /\b(?:zum|zur|für|fuer|fürs|fuers|als|beim)\s+([a-zäöüß][\wäöüß\s-]{2,40})/i
  );
  if (!treffer) return null;

  const zweck = treffer[1]
    .replace(/\s+(bis|unter|max|maximal|ab)\b.*$/i, '')
    .trim();

  return zweck.length >= 3 ? zweck : null;
}

// ============================================
// EIGENSCHAFTEN LESEN
// ============================================

function normal(t) {
  return String(t || '').toLowerCase();
}

function eigenschaftenLesen(text) {
  const t = normal(text);
  const gefunden = [];

  for (const [schluessel, daten] of Object.entries(EIGENSCHAFTEN)) {
    if (daten.gesagt.some((w) => t.includes(w))) {
      gefunden.push({ schluessel, klartext: daten.klartext });
    }
  }

  // Widerspruch: kabellos und kabelgebunden zugleich -> beides verwerfen,
  // lieber nichts behaupten als das Falsche
  const hatKabellos = gefunden.some((e) => e.schluessel === 'kabellos');
  const hatKabel = gefunden.some((e) => e.schluessel === 'kabelgebunden');
  if (hatKabellos && hatKabel) {
    return gefunden.filter((e) => e.schluessel !== 'kabellos' && e.schluessel !== 'kabelgebunden');
  }

  return gefunden;
}

// ============================================
// MARKE
// Keine gepflegte Markenliste - die veraltet.
// Stattdessen: Marken aus den echten Treffern lesen und schauen,
// ob der Nutzer eine davon genannt hat.
// ============================================

// Woerter, die am Titelanfang stehen, aber keine Marke sind
const KEINE_MARKE = new Set([
  'der', 'die', 'das', 'ein', 'eine', 'neu', 'neue', 'set', 'pack',
  'kabellose', 'kabelloser', 'kabelloses', 'bluetooth', 'wireless',
  'kopfhörer', 'kopfhoerer', 'laptop', 'notebook', 'handy', 'smartphone',
  'for', 'fuer', 'für', 'mit', 'ohne', 'und', 'oder', 'pro', 'max', 'plus'
]);

/** Markennamen aus Produkttiteln sammeln */
function markenAusTreffern(produkte) {
  const marken = new Set();

  for (const p of produkte || []) {
    const titel = String(p.title || p.name || '').trim();
    if (!titel) continue;

    // Erste ein bis zwei Woerter sind fast immer die Marke
    const woerter = titel.split(/[\s,|\-–]+/).filter(Boolean);
    for (const w of woerter.slice(0, 1)) {
      const sauber = w.replace(/[^\wäöüßÄÖÜ.&']/g, '');
      if (sauber.length < 2) continue;
      if (KEINE_MARKE.has(sauber.toLowerCase())) continue;
      if (/^\d+$/.test(sauber)) continue;
      marken.add(sauber);
    }
  }

  return [...marken];
}

/**
 * Hat der Nutzer eine Marke genannt, die es in den Treffern gibt?
 * @returns {string|null} die Marke, wie sie im Treffer steht
 */
function markeErkennen(text, produkte) {
  const t = normal(text);
  if (!t) return null;

  const marken = markenAusTreffern(produkte);

  // Laengste zuerst, damit "Sony Alpha" vor "Sony" gewinnt
  marken.sort((a, b) => b.length - a.length);

  for (const marke of marken) {
    const m = marke.toLowerCase();
    if (m.length < 3) continue;
    // Ganzes Wort, damit "on" nicht in "Kopfhoerer" trifft
    const muster = new RegExp(`(^|[^a-z0-9äöüß])${m.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c)}([^a-z0-9äöüß]|$)`, 'i');
    if (muster.test(t)) return marke;
  }

  return null;
}

// ============================================
// ALLES ZUSAMMEN
// ============================================

/**
 * @param {string} nachricht - was der Nutzer geschrieben hat
 * @param {Array} produkte - Suchtreffer (fuer die Markenerkennung)
 */
function lesen(nachricht, produkte = []) {
  return {
    zweck: zweckLesen(nachricht),
    eigenschaften: eigenschaftenLesen(nachricht),
    marke: markeErkennen(nachricht, produkte)
  };
}

// ============================================
// PRUEFEN
// ============================================

function textVonProdukt(p) {
  // Das Produktwissen gehoert dazu - die Bauform steht oft nur dort
  // und nicht im Titel.
  return normal([
    p.title, p.name,
    Array.isArray(p.extensions) ? p.extensions.join(' ') : '',
    p.wissenText || '',
    p.delivery, p.badge
  ].filter(Boolean).join(' '));
}

// Eigenschaften, die einander ausschliessen. Wer Over-Ear will und
// On-Ear bekommt, hat nicht "keinen Beleg" - er hat das Falsche.
const SCHLIESST_AUS = {
  ueberOhr: ['imOhr', 'aufOhr'],
  imOhr: ['ueberOhr', 'aufOhr'],
  aufOhr: ['ueberOhr', 'imOhr'],
  kabellos: ['kabelgebunden'],
  kabelgebunden: ['kabellos']
};

/** Steht in den Daten eine Eigenschaft, die der gewuenschten widerspricht? */
function widerspruch(schluessel, produkt) {
  const gegenteile = SCHLIESST_AUS[schluessel];
  if (!gegenteile) return null;

  const t = textVonProdukt(produkt);
  for (const g of gegenteile) {
    const daten = EIGENSCHAFTEN[g];
    if (daten && daten.erkennbar.some((w) => t.includes(w))) return daten.klartext;
  }
  return null;
}

/**
 * Wurden die Anforderungen erfuellt?
 *
 * Bei der Marke ist die Aussage hart: steht der Markenname nicht im
 * Titel, ist es nicht diese Marke.
 *
 * Bei Eigenschaften ist sie weich: steht "ANC" nicht im Titel, KANN
 * das Produkt trotzdem ANC haben. Darum sagen wir nur, dass es sich
 * aus den Daten nicht belegen laesst - nicht, dass es fehlt.
 */
function pruefen(anforderungen, empfehlungen) {
  const hinweise = [];
  if (!anforderungen || !Array.isArray(empfehlungen) || !empfehlungen.length) {
    return hinweise;
  }

  // ---------- Marke ----------
  if (anforderungen.marke) {
    const m = anforderungen.marke.toLowerCase();
    const passende = empfehlungen.filter((p) => textVonProdukt(p).includes(m));

    if (!passende.length) {
      hinweise.push({
        art: 'marke',
        hart: true,
        text: `Du hast ${anforderungen.marke} genannt. In deinem Budget habe ich dazu nichts Passendes gefunden - die Vorschläge sind von anderen Herstellern.`
      });
    } else if (passende.length < empfehlungen.length) {
      hinweise.push({
        art: 'marke',
        hart: false,
        text: `Nicht alle Vorschläge sind von ${anforderungen.marke}. Dort, wo es nicht passte, habe ich Alternativen genommen.`
      });
    }
  }

  // ---------- Eigenschaften ----------
  for (const e of anforderungen.eigenschaften || []) {
    const daten = EIGENSCHAFTEN[e.schluessel];
    if (!daten || !daten.erkennbar.length) continue;

    const belegt = empfehlungen.filter((p) => {
      const t = textVonProdukt(p);
      return daten.erkennbar.some((w) => t.includes(w));
    });

    if (belegt.length) continue;

    // Widerspricht ein Vorschlag sogar? Das ist mehr als eine Luecke.
    const falsche = empfehlungen
      .map((p) => ({ p, statt: widerspruch(e.schluessel, p) }))
      .filter((x) => x.statt);

    if (falsche.length) {
      const namen = falsche
        .map((x) => `${String(x.p.name || x.p.title || 'Ein Vorschlag').slice(0, 40)} ist ${x.statt}`)
        .join(', ');
      hinweise.push({
        art: 'eigenschaft',
        hart: true,
        text: `Du wolltest ${daten.klartext}. Das trifft hier nicht zu: ${namen}. In deinem Budget habe ich nichts Passenderes gefunden.`
      });
    } else {
      hinweise.push({
        art: 'eigenschaft',
        hart: false,
        text: `Du hast "${daten.klartext}" verlangt. Bei keinem der Vorschläge steht das ausdrücklich in den Produktdaten – prüf das bitte im Shop, bevor du kaufst.`
      });
    }
  }

  return hinweise;
}

/** Fuer den Prompt: kurz und klar, was verlangt wurde */
function alsText(anforderungen) {
  if (!anforderungen) return null;
  const teile = [];

  if (anforderungen.marke) teile.push(`Marke: ${anforderungen.marke}`);
  if (anforderungen.zweck) teile.push(`Zweck: ${anforderungen.zweck}`);
  if (anforderungen.eigenschaften?.length) {
    teile.push(`Eigenschaften: ${anforderungen.eigenschaften.map((e) => e.klartext).join(', ')}`);
  }

  return teile.length ? teile.join(' | ') : null;
}

module.exports = {
  lesen,
  pruefen,
  alsText,
  zweckLesen,
  eigenschaftenLesen,
  markeErkennen,
  markenAusTreffern,
  EIGENSCHAFTEN
};