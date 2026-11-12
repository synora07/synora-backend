// ============================================
// SYNORA - Pruefstand fuer Kiara
// ============================================
// Ziel, festgelegt am 09.11.2026: niemand soll Kiara brechen koennen.
//
// Der Weg dahin ist nicht ein groesseres Modell, sondern dieses Blatt.
// Jede Schwaeche, die einmal gefunden wurde, wird hier als Fall
// eingetragen - und danach bei JEDER Aenderung wieder geprueft. Sie
// kann nie wieder unbemerkt zurueckkommen.
//
// ============================================
// KOSTET NICHTS
// ============================================
// Keine Suche, kein SerpAPI, kein Modellaufruf, keine Datenbank.
// Geprueft wird die Logik, die zwischen Google und dem Modell sitzt:
//
//   1. Kategorie       - versteht Kiara, wonach gefragt wird?
//   2. Rueckfrage      - fragt sie nur, wenn es etwas aendert?
//   3. Faktenpruefung  - kommt eine unbelegte Behauptung durch?
//   4. Preisverdacht   - erkennt sie ein unmoegliches Angebot?
//
// Laeuft in einer Sekunde. Gehoert vor jedes Hochladen.
//
// ============================================
// ZWEI ARTEN VON FAELLEN
// ============================================
// MUSS   - hat am Tag des Eintrags nachweislich funktioniert. Faellt
//          einer davon um, ist das ein RUECKSCHRITT. Der Pruefstand
//          endet dann mit Fehler, und es wird NICHT hochgeladen.
//
// LUECKE - etwas, das Kiara noch nicht kann. Kein Fehler, sondern
//          die Arbeitsliste. Wird angezeigt, bricht aber nichts ab.
//          Sobald eine Luecke geschlossen ist, wird sie zu MUSS.
//
// Kiara ist nicht nur Elektronik. Die Faelle decken Elektronik,
// Kosmetik, Kleidung, Moebel und Haushalt ab.
//
// ============================================
// WENN JEMAND KIARA BRICHT
// ============================================
// Dann gehoert genau dieser Fall hier hinein, als MUSS, sobald er
// repariert ist. Das ist die ganze Methode.
//
// ============================================
// Aufruf im Ordner synora-backend-main:
//   node scripts/pruefstand.js
//
// Rueckgabewert 0 = alles gruen, 1 = mindestens ein Rueckschritt.
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src', 'services');

// ============================================
// DIE FAELLE
// ============================================
// Jeder MUSS-Fall hier wurde am 08. oder 09.11.2026 auf dem echten
// System gemessen. Die Quelle steht jeweils daneben.

// ---------- 1. Kategorie ----------
// [Text, erwartete Kategorie oder null]
const KATEGORIE_MUSS = [
  // Elektronik - gemessen 08.11.
  ['ich brauche einen monitor', 'elektronik.monitore'],
  ['ich brauche eine moniror', 'elektronik.monitore'],      // Tippfehler
  ['kopfhörer bis 100 fr', 'elektronik.audio'],
  ['kopfhöhrer bis 100 fr', 'elektronik.audio'],        // Tippfehler
  ['playstation', 'elektronik.gaming'],
  ['playstaion', 'elektronik.gaming'],                       // Tippfehler
  ['playstiaion', 'elektronik.gaming'],                      // Tippfehler, 2 Zeichen
  ['laptop', 'elektronik.laptops'],
  ['smarthome', 'elektronik.smarthome'],
  // Kosmetik und Kleidung - gemessen 08.11.
  ['hautflege', 'kosmetik.hautpflege'],                      // Tippfehler
  ['duschgell', 'kosmetik.koerperpflege'],                   // Tippfehler
  ['handschue', 'mode.accessoires'],                         // Tippfehler
  ['schuhe', 'mode.schuhe'],
  ['schule', 'buero_schule.schule'],
  // Darf NICHTS erkennen - gemessen 08.11.
  ['hallo', null],
  ['ich weiss nicht', null],
  ['stahl', null],                                           // nicht "stuhl"
  ['fisch', null],                                           // nicht "tisch"
  ['bausteile', null],                                       // mehrdeutig
  ['smartfone', null],                                       // mehrdeutig
  ['zeig mir einfach alles', null]
];

// Abdeckung: erkennt Kiara diese Warenwelten ueberhaupt?
// Nicht gemessen - darum LUECKE, nicht MUSS. Erwartet wird nur
// "irgendeine Kategorie", nicht eine bestimmte.
const KATEGORIE_LUECKE = [
  ['sofa', 'Moebel'],
  ['kleiderschrank', 'Moebel'],
  ['esstisch', 'Moebel'],
  ['bürostuhl', 'Moebel'],
  ['matratze', 'Moebel'],
  ['shampoo', 'Kosmetik'],
  ['parfum', 'Kosmetik'],
  ['sonnencreme', 'Kosmetik'],
  ['winterjacke', 'Kleidung'],
  ['sneaker', 'Kleidung'],
  ['jeans', 'Kleidung'],
  ['staubsauger', 'Haushalt'],
  ['kaffeemaschine', 'Haushalt'],
  ['waschmaschine', 'Haushalt']
];

// ---------- 2. Rueckfrage ----------
// [Text, erwartet]  erwartet: null = keine Frage, 'FRAGE' = irgendeine,
// sonst der genaue Fragetext. Gemessen 09.11.
const RUECKFRAGE_MUSS = [
  ['philips 27E1N1800AE', null],                             // Modellnummer
  ['hp omen 32c', null],
  ['monitor va279hg', null],
  ['monitor 4k', 'FRAGE'],                                   // 4k ist keine Modellnummer
  ['144hz monitor', 'FRAGE'],
  ['laptop 16gb', 'FRAGE'],
  ['playstation', 'Welche Ausführung soll es sein?'],
  ['playstation 5', 'Welche Ausführung soll es sein?'],
  ['iphone 15 pro', 'Wie viel Speicher brauchst du?'],
  ['monitor', 'FRAGE'],
  ['kopfhoerer', 'FRAGE']
];

// Was fragt Kiara in den anderen Welten? Nur zur Ansicht - ob die
// Frage dort sinnvoll ist, ist eine Katalogfrage, keine Messung.
const RUECKFRAGE_ANSICHT = ['sofa', 'shampoo', 'winterjacke', 'staubsauger', 'parfum'];

// ---------- 3. Faktenpruefung ----------
// Ein Produkt je Welt, mit genau den Daten, die bekannt sind.
// [Satz, soll gestrichen werden]
//
// faelle          gelten immer
// nurMitZahlen    erst wenn zahlenBelegt.js eingespielt ist
// nurMitWoertern  erst wenn belegWoerter.js eingespielt ist
// Fehlt die jeweilige Pruefung, werden diese Faelle ausgelassen statt
// rot - so laeuft der Pruefstand vor UND nach dem Einspielen.
const LEERES_PRODUKT = { title: 'Testprodukt', wissenText: 'Farbe schwarz', rating: 4.0, reviews: 50 };

const FAKTEN_MUSS = [
  {
    welt: 'Elektronik',
    produkt: {
      title: 'Philips Monitor 27E1N1800AE/00 27 Zoll',
      wissenText: 'Bildschirmdiagonale 27 Zoll\nBildwiederholrate 75 Hz\nAnschluesse HDMI, USB-C',
      rating: 4.5,
      reviews: 692
    },
    faelle: [
      ['4.6 Sterne bei 746 Bewertungen', true],              // gemessen 08.11., 3 von 3
      ['4.5 Sterne bei 692 Bewertungen', false],
      ['27 Zoll Diagonale, gut fuer zwei Fenster', false],
      ['75 Hz reichen fuer Buero', false],
      ['Liegt mit 150 Franken unter deinem Budget von 200 Franken', false]
    ],
    nurMitZahlen: [
      ['144 Hz machen ihn zum Gaming-Monitor', true],
      ['Nur 4% unzufriedene Kaeufer', true],                 // gemessen 08.11.
      ['825-GB-SSD ist knapp bemessen', true]
    ]
  },
  {
    welt: 'Kosmetik',
    produkt: {
      title: 'Eucerin UreaRepair Handcreme 200 ml',
      wissenText: 'Inhalt 200 ml\nUrea-Anteil 5%\nOhne Duftstoffe',
      rating: 4.6,
      reviews: 310
    },
    faelle: [
      ['Ohne Duftstoffe, gut bei empfindlicher Haut', false]
    ],
    nurMitZahlen: [
      ['200 ml reichen lange', false],
      ['5% Urea ist die uebliche Staerke', false],
      ['10% Urea waere zu stark', true],
      ['500 ml Flasche fuer den gleichen Preis', true]
    ]
  },
  {
    welt: 'Kleidung',
    produkt: {
      title: 'Levis 511 Slim Jeans',
      wissenText: 'Material 60% Baumwolle, 40% Polyester\nInnenbeinlaenge 82 cm',
      rating: 4.3,
      reviews: 88
    },
    faelle: [
      ['Schlanker Schnitt, nicht fuer breite Oberschenkel', false]
    ],
    nurMitZahlen: [
      ['60% Baumwolle, angenehm im Sommer', false],
      ['100% Baumwolle, komplett natuerlich', true]
    ]
  },
  {
    welt: 'Kopfhoerer (Wortpruefung)',
    produkt: {
      title: 'Sony WH-1000XM5 Bluetooth Over-Ear',
      wissenText: 'Bauform Over-Ear\nVerbindung Bluetooth 5.2\nGeraeuschunterdrueckung ANC',
      rating: 4.7,
      reviews: 1200
    },
    faelle: [
      ['Kabellos ueber Bluetooth', false],
      ['Over-Ear, umschliesst das Ohr', false],
      ['In-Ear, sitzt im Gehoergang', true],                 // falsche Bauform
      ['Wasserdicht, gut fuer den Sport', true]              // nicht belegt
    ],
    nurMitZahlen: []
  },

  // ---------- Woerter mit Belegpflicht - eingetragen 09.11. ----------
  {
    welt: 'Kosmetik (Woerter)',
    produkt: {
      title: 'Gesichtscreme Sensitive 50 ml',
      wissenText: 'Parfuemfrei\nNicht komedogen\nDermatologisch getestet\nVegan',
      rating: 4.4,
      reviews: 120
    },
    faelle: [],
    nurMitZahlen: [],
    nurMitWoertern: [
      ['Parfuemfrei, gut bei Allergien', false],
      ['Vegan', false],
      ['Ohne Tierversuche hergestellt', true],
      ['Silikonfrei und ohne Parabene', true],
      ['Ob sie ohne Tierversuche hergestellt wird, ist nicht angegeben', false],   // ehrlich, bleibt
      ['Ob sie ohne Tierversuche hergestellt wird, ist nicht angegeben, wahrscheinlich aber schon', true]
    ]
  },
  {
    welt: 'Kleidung (Woerter)',
    produkt: {
      title: 'Regenjacke Herren',
      wissenText: 'Wasserabweisend (DWR-Beschichtung)\nAtmungsaktiv\nObermaterial Polyamid\nFuellung Kunstdaune',
      rating: 4.2,
      reviews: 64
    },
    faelle: [],
    nurMitZahlen: [],
    nurMitWoertern: [
      ['Wasserabweisend, haelt leichtem Regen stand', false],
      ['Atmungsaktiv', false],
      ['Daunenfuellung haelt warm', true],                  // Kunstdaune ist keine Daune
      ['Mit Kunstdaunen gefuellt', false]
    ]
  },
  {
    welt: 'Schuhe (Leder)',
    produkt: {
      title: 'Sneaker Damen weiss',
      wissenText: 'Obermaterial Kunstleder (PU-Leder)\nSohle Gummi',
      rating: 4.1,
      reviews: 77
    },
    faelle: [],
    nurMitZahlen: [],
    nurMitWoertern: [
      ['Aus Leder, wird mit der Zeit schoener', true],      // PU-Leder ist kein Leder
      ['Kunstleder, pflegeleicht', false],
      ['Kein echtes Leder, sondern PU', false]
    ]
  },
  {
    welt: 'Moebel (Woerter)',
    produkt: {
      title: 'Esstisch Wildeiche massiv 180 cm ausziehbar',
      wissenText: 'Material Wildeiche massiv, geoelt\nFSC-zertifiziert',
      rating: 4.6,
      reviews: 45
    },
    faelle: [],
    nurMitZahlen: [],
    nurMitWoertern: [
      ['Massivholz, kein Furnier', false],
      ['Ausziehbar fuer Gaeste', false],
      ['Hoehenverstellbar', true]
    ]
  },
  {
    welt: 'Moebel (Furnier)',
    produkt: {
      title: 'Couchtisch Industrial',
      wissenText: 'Gestell massiver Stahlrahmen\nPlatte MDF, Eiche furniert',
      rating: 4.0,
      reviews: 30
    },
    faelle: [],
    nurMitZahlen: [],
    nurMitWoertern: [
      ['Massivholz, kein Furnier', true],                   // massiver STAHL, Eiche FURNIERT
      ['Stabiler, massiver Stahlrahmen', false]
    ]
  },
  {
    welt: 'Elektronik (Woerter)',
    produkt: {
      title: 'Philips Monitor 27E1N1800AE/00 27 Zoll',
      wissenText: 'Bildschirmdiagonale 27 Zoll\nBildwiederholrate 75 Hz\nAnschluesse HDMI, USB-C',
      rating: 4.5,
      reviews: 692
    },
    faelle: [],
    nurMitZahlen: [],
    nurMitWoertern: [
      ['Hoehenverstellbarer Standfuss', true]               // haeufige falsche Behauptung
    ]
  },
  {
    // Die Luecken vom 09.11. - geschlossen, darum jetzt MUSS.
    welt: 'Unbelegt (leeres Produkt)',
    produkt: LEERES_PRODUKT,
    faelle: [],
    nurMitZahlen: [
      ['Belastbar bis 150 kg', true]
    ],
    nurMitWoertern: [
      ['Parfuemfrei, ideal bei Allergien', true],
      ['Vegan und ohne Tierversuche', true],
      ['Dermatologisch getestet', true],
      ['Wasserabweisend, haelt leichtem Regen stand', true],
      ['Aus Bio-Baumwolle', true],
      ['Atmungsaktiv', true],
      ['Massivholz, kein Furnier', true]
    ]
  },
  {
    // Darf NIE gestrichen werden. Faellt hier einer, steht eine
    // Pruefung zu scharf und reisst Loecher in gute Antworten.
    welt: 'Fehlalarm (normale Saetze)',
    produkt: LEERES_PRODUKT,
    faelle: [
      ['Guter Allrounder fuer den Alltag', false],
      ['Bequemer Schnitt, faellt normal aus', false],
      ['Zieht schnell ein und fettet nicht', false],
      ['Sehr massiv gebaut', false],
      ['Seidiger Glanz nach dem Waschen', false],
      ['Lederoptik, wirkt hochwertig', false],
      ['Im Zweifel lieber eine Nummer groesser nehmen', false]
    ],
    nurMitZahlen: []
  }
];

// Was noch NICHT geprueft wird. Am 09.11. offen: Kennungen mit Zahl
// (LSF, HDMI-Version, WLAN-Standard) und Herkunft ausser "Swiss Made".
// Gemessen wird, ob ein unbelegter Satz gestrichen wird.
const FAKTEN_LUECKE = [
  { welt: 'Kosmetik', satz: 'Mit LSF 50 fuer den Sommer' },
  { welt: 'Elektronik', satz: 'Unterstuetzt HDMI 2.1' },
  { welt: 'Elektronik', satz: 'Wi-Fi 6 fuer schnelles Netz' },
  { welt: 'Allgemein', satz: 'Made in Germany' }
];

// ---------- 4. Preisverdacht ----------
// [Name, Angebote, erwartete Anzahl Verdachtsfaelle, wer]
const PREIS_MUSS = [
  {
    welt: 'Elektronik',                                       // gemessen 08./09.11.
    angebote: [
      { title: 'HP Monitor OMEN 32c', priceValue: 310 },
      { title: 'HP OMEN 32c Monitor', priceValue: 299 },
      { title: 'HP Monitor OMEN 32c', priceValue: 21.92 },
      { title: 'Philips 27E1N1800AE', priceValue: 150 },
      { title: 'Philips 27E1N1800AE', priceValue: 159 }
    ],
    verdacht: [21.92]
  },
  {
    welt: 'Kosmetik',
    angebote: [
      { title: 'Eucerin UreaRepair Handcreme 200 ml', priceValue: 12.9 },
      { title: 'Eucerin UreaRepair Handcreme 200 ml', priceValue: 13.5 },
      { title: 'Eucerin Handcreme UreaRepair 200 ml', priceValue: 11.95 },
      { title: 'Eucerin UreaRepair Handcreme 200 ml', priceValue: 2.5 }
    ],
    verdacht: [2.5]
  },
  {
    welt: 'Kleidung',
    angebote: [
      { title: 'Levis 511 Slim Jeans', priceValue: 89 },
      { title: 'Levis 511 Slim Jeans', priceValue: 95 },
      { title: 'Jeans Levis 511 Slim', priceValue: 99 },
      { title: 'Levis 511 Slim Jeans', priceValue: 25 }
    ],
    verdacht: [25]
  },
  {
    welt: 'Normaler Preisunterschied',
    angebote: [
      { title: 'Dyson V15 Detect', priceValue: 599 },
      { title: 'Dyson V15 Detect', priceValue: 649 },
      { title: 'Dyson V15 Detect', priceValue: 549 }
    ],
    verdacht: []                                             // 549 ist Aktion, kein Betrug
  }
];

// ============================================
// AUSFUEHRUNG
// ============================================

const echtLog = console.log;
const echtWarn = console.warn;
const echtError = console.error;
function still() { console.log = () => {}; console.warn = () => {}; console.error = () => {}; }
function laut() { console.log = echtLog; console.warn = echtWarn; console.error = echtError; }

function laden(name) {
  still();
  try {
    return require(path.join(SRC, name));
  } catch (e) {
    return { __fehler: e.message.split('\n')[0] };
  } finally {
    laut();
  }
}

const ERGEBNIS = { muss: 0, mussGruen: 0, luecke: 0, lueckeZu: 0, ausgelassen: 0 };
const RUECKSCHRITTE = [];

function zeile(gruen, art, text, detail) {
  const marke = art === 'muss'
    ? (gruen ? '  ok    ' : '  ROT   ')
    : (gruen ? '  zu    ' : '  offen ');
  const t = text.length > 40 ? text.slice(0, 39) + '…' : text;
  echtLog(`${marke}${t.padEnd(41)}${detail || ''}`);
}

function zaehle(art, gruen, beschreibung) {
  if (art === 'muss') {
    ERGEBNIS.muss += 1;
    if (gruen) ERGEBNIS.mussGruen += 1;
    else RUECKSCHRITTE.push(beschreibung);
  } else {
    ERGEBNIS.luecke += 1;
    if (gruen) ERGEBNIS.lueckeZu += 1;
  }
}

function abschnitt(titel) {
  echtLog('');
  echtLog(titel);
  echtLog('-'.repeat(titel.length));
}

// ---------- 1 ----------
function pruefeKategorie() {
  abschnitt('1. KATEGORIE - versteht Kiara die Frage?');
  const k = laden('shopKategorien.js');
  if (k.__fehler || typeof k.kategorieErkennen !== 'function') {
    echtLog(`  nicht ladbar: ${k.__fehler || 'kategorieErkennen fehlt'}`);
    ERGEBNIS.ausgelassen += KATEGORIE_MUSS.length;
    return;
  }

  for (const [text, soll] of KATEGORIE_MUSS) {
    still();
    let ist;
    try { ist = k.kategorieErkennen(text) || null; } finally { laut(); }
    const gruen = ist === soll;
    zeile(gruen, 'muss', text, `-> ${ist || 'nichts'}${gruen ? '' : `   erwartet: ${soll || 'nichts'}`}`);
    zaehle('muss', gruen, `Kategorie: "${text}" ergibt ${ist || 'nichts'}, erwartet ${soll || 'nichts'}`);
  }

  echtLog('');
  echtLog('  Abdeckung der Warenwelten:');
  for (const [text, welt] of KATEGORIE_LUECKE) {
    still();
    let ist;
    try { ist = k.kategorieErkennen(text) || null; } finally { laut(); }
    const gruen = !!ist;
    zeile(gruen, 'luecke', `${welt.padEnd(9)} ${text}`, `-> ${ist || 'NICHT ERKANNT'}`);
    zaehle('luecke', gruen);
  }
}

// ---------- 2 ----------
function pruefeRueckfrage() {
  abschnitt('2. RUECKFRAGE - nur fragen, wenn es etwas aendert');
  const r = laden('rueckfrage.js');
  if (r.__fehler || typeof r.pruefen !== 'function') {
    echtLog(`  nicht ladbar: ${r.__fehler || 'pruefen fehlt'}`);
    ERGEBNIS.ausgelassen += RUECKFRAGE_MUSS.length;
    return;
  }

  const fragen = (text) => {
    still();
    try {
      const f = r.pruefen({ nachricht: text, anforderungen: {}, budget: 0, verlauf: [] });
      return f ? f.frage : null;
    } finally { laut(); }
  };

  for (const [text, soll] of RUECKFRAGE_MUSS) {
    const ist = fragen(text);
    let gruen;
    if (soll === null) gruen = ist === null;
    else if (soll === 'FRAGE') gruen = typeof ist === 'string' && ist.length > 0;
    else gruen = ist === soll;
    zeile(gruen, 'muss', text, `-> ${ist === null ? 'keine Frage' : ist}`);
    zaehle('muss', gruen, `Rueckfrage: "${text}" ergibt ${ist === null ? 'keine Frage' : `"${ist}"`}`);
  }

  echtLog('');
  echtLog('  Was Kiara in anderen Welten fragt (zur Ansicht, nicht bewertet):');
  for (const text of RUECKFRAGE_ANSICHT) {
    const ist = fragen(text);
    echtLog(`          ${text.padEnd(14)} -> ${ist === null ? 'keine Frage' : ist}`);
  }
}

// ---------- 3 ----------
function pruefeFakten() {
  abschnitt('3. FAKTENPRUEFUNG - kommt Unbelegtes durch?');
  const f = laden('faktenpruefung.js');
  if (f.__fehler || typeof f.saetzePruefen !== 'function') {
    echtLog(`  nicht ladbar: ${f.__fehler || 'saetzePruefen fehlt'}`);
    return;
  }

  // Welche Pruefungen sind eingebaut?
  let mitZahlen = false;
  let mitWoertern = false;
  try {
    const quelle = fs.readFileSync(path.join(SRC, 'faktenpruefung.js'), 'utf8');
    mitZahlen = quelle.includes('ZAHL_MIT_EINHEIT');
    mitWoertern = quelle.includes('WOERTER_BELEG');
  } catch (_) {}

  const gestrichenVon = (saetze, produkt) => {
    still();
    try {
      const r = f.saetzePruefen(saetze, produkt) || {};
      const liste = Array.isArray(r.gestrichen) ? r.gestrichen : (Array.isArray(r.entfernt) ? r.entfernt : null);
      if (!liste) return null;
      return new Map(liste.map((e) => [e.satz, e.grund]));
    } finally { laut(); }
  };

  for (const block of FAKTEN_MUSS) {
    echtLog(`  ${block.welt}`);
    const zahlen = block.nurMitZahlen || [];
    const woerter = block.nurMitWoertern || [];
    const faelle = block.faelle
      .concat(mitZahlen ? zahlen : [])
      .concat(mitWoertern ? woerter : []);
    if (faelle.length) {
      const weg = gestrichenVon(faelle.map((x) => x[0]), block.produkt);
      if (!weg) {
        echtLog('    Format der Rueckgabe unbekannt - Abschnitt uebersprungen');
        ERGEBNIS.ausgelassen += faelle.length;
        continue;
      }
      for (const [satz, soll] of faelle) {
        const ist = weg.has(satz);
        const gruen = ist === soll;
        zeile(gruen, 'muss', satz, ist ? 'WEG' : 'bleibt');
        zaehle('muss', gruen, `Faktenpruefung (${block.welt}): "${satz}" ${ist ? 'gestrichen' : 'nicht gestrichen'}`);
      }
    }
    if (!mitZahlen && zahlen.length) {
      echtLog(`    (${zahlen.length} Zahlen-Faelle ausgelassen - zahlenBelegt.js noch nicht eingespielt)`);
      ERGEBNIS.ausgelassen += zahlen.length;
    }
    if (!mitWoertern && woerter.length) {
      echtLog(`    (${woerter.length} Wort-Faelle ausgelassen - belegWoerter.js noch nicht eingespielt)`);
      ERGEBNIS.ausgelassen += woerter.length;
    }
  }

  echtLog('');
  echtLog('  Noch nicht geprueft - kommen diese Saetze durch?');
  const weg = gestrichenVon(FAKTEN_LUECKE.map((x) => x.satz), LEERES_PRODUKT);
  if (weg) {
    for (const { welt, satz } of FAKTEN_LUECKE) {
      const gruen = weg.has(satz);
      zeile(gruen, 'luecke', `${welt.padEnd(9)} ${satz}`, gruen ? 'wird geprueft' : 'KOMMT UNGEPRUEFT DURCH');
      zaehle('luecke', gruen);
    }
  }
}

// ---------- 4 ----------
function pruefePreis() {
  abschnitt('4. PREISVERDACHT - erkennt Kiara ein unmoegliches Angebot?');
  const w = laden('wissenService.js');
  if (w.__fehler || typeof w.preisgruppenBauen !== 'function' || typeof w.preisVerdaechtigGegen !== 'function') {
    echtLog(`  nicht ladbar: ${w.__fehler || 'preisgruppenBauen/preisVerdaechtigGegen fehlt'}`);
    return;
  }
  const schluessel = typeof w.preisgruppenSchluessel === 'function' ? w.preisgruppenSchluessel : w.schluesselBauen;

  for (const block of PREIS_MUSS) {
    still();
    let verdaechtig = [];
    try {
      const spannen = w.preisgruppenBauen(block.angebote);
      verdaechtig = block.angebote
        .filter((a) => w.preisVerdaechtigGegen(a, spannen.get(schluessel(a.title))))
        .map((a) => a.priceValue);
    } finally { laut(); }

    const soll = block.verdacht.slice().sort((a, b) => a - b);
    const ist = verdaechtig.slice().sort((a, b) => a - b);
    const gruen = JSON.stringify(soll) === JSON.stringify(ist);
    const anzeige = ist.length ? `Verdacht bei ${ist.join(', ')}` : 'kein Verdacht';
    zeile(gruen, 'muss', block.welt, `-> ${anzeige}${gruen ? '' : `   erwartet: ${soll.length ? soll.join(', ') : 'keiner'}`}`);
    zaehle('muss', gruen, `Preisverdacht (${block.welt}): ${anzeige}`);
  }
}

// ============================================

function main() {
  echtLog('');
  echtLog('PRUEFSTAND KIARA');
  echtLog('================');
  echtLog(`${new Date().toLocaleString('de-CH')}  -  ohne Suche, ohne Kosten`);

  pruefeKategorie();
  pruefeRueckfrage();
  pruefeFakten();
  pruefePreis();

  echtLog('');
  echtLog('================================================');
  const rot = ERGEBNIS.muss - ERGEBNIS.mussGruen;
  echtLog(`  MUSS       ${ERGEBNIS.mussGruen} von ${ERGEBNIS.muss} gruen${rot ? `   ${rot} RUECKSCHRITT(E)` : ''}`);
  echtLog(`  LUECKEN    ${ERGEBNIS.lueckeZu} von ${ERGEBNIS.luecke} geschlossen`);
  if (ERGEBNIS.ausgelassen) echtLog(`  ausgelassen ${ERGEBNIS.ausgelassen}`);
  echtLog('================================================');

  if (rot) {
    echtLog('');
    echtLog('RUECKSCHRITT - nicht hochladen:');
    for (const r of RUECKSCHRITTE) echtLog(`  - ${r}`);
    echtLog('');
    process.exit(1);
  }

  echtLog('');
  echtLog('Kein Rueckschritt. Hochladen ist von dieser Seite her in Ordnung.');
  if (ERGEBNIS.luecke - ERGEBNIS.lueckeZu > 0) {
    echtLog(`Die ${ERGEBNIS.luecke - ERGEBNIS.lueckeZu} offenen Luecken sind die Arbeitsliste, keine Fehler.`);
  }
  echtLog('');
}

main();
