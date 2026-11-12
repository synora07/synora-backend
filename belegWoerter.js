// ============================================
// SYNORA - Woerter mit Belegpflicht fuer alle Warenwelten
// ============================================
// GEFUNDEN am 09.11.2026 mit dem Pruefstand:
//
//   offen Kosmetik  Parfuemfrei, ideal bei Allergien  KOMMT UNGEPRUEFT DURCH
//   offen Kosmetik  Vegan und ohne Tierversuche       KOMMT UNGEPRUEFT DURCH
//   offen Kleidung  Wasserabweisend ...               KOMMT UNGEPRUEFT DURCH
//   offen Moebel    Massivholz, kein Furnier          KOMMT UNGEPRUEFT DURCH
//
// BELEGPFLICHTIG in faktenpruefung.js gilt nur fuer Kopfhoerer. Bei
// Kosmetik, Kleidung und Moebel entscheiden aber gerade solche Woerter
// den Kauf - und sie koennen falsch sein, ohne dass es jemand merkt.
//
// ============================================
// WAS DAZUKOMMT
// ============================================
// Eine neue Pruefung, pruefeWoerter, mit eigener Liste. BELEGPFLICHTIG
// bleibt unangetastet - die Kopfhoerer-Pruefung verhaelt sich genau
// wie vorher.
//
//   KOSMETIK  parfuemfrei, vegan, ohne Tierversuche, dermatologisch
//             getestet, hypoallergen, nicht komedogen, Naturkosmetik,
//             silikon-, paraben-, sulfat-, alkoholfrei, ohne Mikroplastik
//   KLEIDUNG  wasserabweisend, atmungsaktiv, Bio-Baumwolle, Merino,
//             Kaschmir, Seide, Daunen, Leder, maschinenwaschbar
//   MOEBEL    Massivholz, FSC, PEFC, hoehenverstellbar, ausziehbar,
//             abnehmbarer Bezug
//   UEBERALL  Swiss Made
//
// Deutsch, Englisch und Franzoesisch - Schweizer Shops nutzen alle
// drei. "Parfuemfrei" ist also auch mit "fragrance free" oder "sans
// parfum" in den Daten belegt.
//
// ============================================
// DIE FALLEN
// ============================================
// Kunstleder, PU-Leder, veganes Leder, Lederoptik  -> kein Leder
// Kunstdaune, Daunenoptik, "down alternative"     -> keine Daunen
// seidenmatt, seidig, Kunstseide                  -> keine Seide
// massiver Stahlrahmen, Eiche furniert            -> kein Massivholz
// FSC und PEFC                                    -> belegen sich nicht
// "Duvet" heisst in der Schweiz Bettdecke - darum NICHT als Daune.
//
// "Ob sie vegan ist, ist nicht angegeben" bleibt stehen - der Satz
// behauptet nichts. Mit "..., wahrscheinlich aber schon" fliegt er.
//
// ============================================
// VORAUSSETZUNG
// ============================================
// zahlenBelegt.js muss eingespielt sein (seit 09.11., Commit 06e4224).
//
// ============================================
// Aufruf im Ordner synora-backend-main:
//   node belegWoerter.js
// danach:
//   node scripts/pruefstand.js
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ZIEL = path.join('src', 'services', 'faktenpruefung.js');
const MARKE = 'WOERTER_BELEG';

// Namen, die der Block neu anlegt. Gibt es einen davon schon, wuerde
// die Datei nicht mehr laden - darum wird vorher geprueft.
const NEUE_NAMEN = [
  'WOERTER_BELEG',
  'WORT_KEINE_ANGABE',
  'WORT_VERMUTUNG',
  'WORT_OB',
  'WORT_WENDE',
  'wortOffenGelassen',
  'pruefeWoerter'
];

const BLOCK = String.raw`// ============================================
// WOERTER MIT BELEGPFLICHT  (angebaut 09.11.2026)
// ============================================
// BELEGPFLICHTIG oben gilt fuer Kopfhoerer. Kiara verkauft aber auch
// Kosmetik, Kleidung und Moebel - und dort entscheiden Woerter den
// Kauf, keine Zahlen:
//
//   KOSMETIK  parfuemfrei, vegan, ohne Tierversuche, silikonfrei
//   KLEIDUNG  wasserabweisend, Merino, Daunen, echtes Leder
//   MOEBEL    Massivholz, hoehenverstellbar, ausziehbar
//
// Jedes dieser Woerter ist eine Behauptung. Steht sie nicht in den
// Produktdaten, fliegt der Satz raus - wie bei den Kopfhoerern.
//
// Die Muster kennen Deutsch, Englisch und Franzoesisch, weil
// Schweizer Shops alle drei verwenden. Umlaute stehen als \u00fc
// usw. im Muster, damit die Datei reines ASCII bleibt.
//
// FALLEN, die bewusst ausgeschlossen sind:
//   Kunstleder, PU-Leder, Lederoptik   sind kein Leder
//   Kunstdaune, Daunenoptik            sind keine Daunen
//   seidenmatt, seidig, Kunstseide     sind keine Seide
//   massiver Stahlrahmen               ist kein Massivholz
//   Duvet                              heisst in der Schweiz Bettdecke,
//                                      nicht Daune - darum NICHT drin
//
// Ein Satz wie "Ob sie vegan ist, ist nicht angegeben" bleibt stehen.
// Er behauptet nichts, er sagt ehrlich, was fehlt. Kommt aber eine
// Vermutung dazu ("... wahrscheinlich aber schon"), fliegt er.

const WOERTER_BELEG = [
  // ---------- KOSMETIK ----------
  {
    name: 'parfuemfrei',
    muster: /(parf(?:\u00fc|ue|u)m[- ]?frei|duft(?:stoff)?[- ]?frei|ohne (?:zugesetzte[mnrs]? )?(?:parf(?:\u00fc|ue|u)m|duftstoff)|unparf(?:\u00fc|ue|u)miert|fragrance[- ]free|perfume[- ]free|sans parfum|non parfum\u00e9)/i
  },
  {
    name: 'vegan',
    behauptet: /(?<![a-z\u00df-\u00ff])v[e\u00e9]gan/i,
    beleg: /((?<![a-z\u00df-\u00ff])v[e\u00e9]gan|v-label)/i
  },
  {
    name: 'ohne Tierversuche',
    muster: /(ohne tierversuche|tierversuchsfrei|frei von tierversuchen|cruelty[- ]free|not tested on animals|non test\u00e9 sur les animaux|sans cruaut\u00e9|leaping bunny)/i
  },
  { name: 'dermatologisch getestet', muster: /dermatolog/i },
  { name: 'hypoallergen', muster: /hypoallerg/i },
  {
    name: 'nicht komedogen',
    muster: /(nicht[- ]komedogen|non[- ]?comedogen|non[- ]?com\u00e9dog\u00e8ne|nicht porenverstopfend)/i
  },
  {
    name: 'Naturkosmetik',
    muster: /(naturkosmetik|natrue|bdih|ecocert|cosmos[- ](?:organic|natural))/i
  },
  { name: 'silikonfrei', muster: /(silikon[- ]?frei|ohne silikone?|silicone[- ]free|sans silicones?)/i },
  { name: 'parabenfrei', muster: /(paraben[- ]?frei|ohne parabene?|parabens?[- ]free|sans parab[e\u00e8]nes?)/i },
  { name: 'sulfatfrei', muster: /(sulfat[- ]?frei|ohne sulfate?|sulfates?[- ]free|sans sulfates?)/i },
  { name: 'alkoholfrei', muster: /(alkohol[- ]?frei|ohne alkohol|alcohol[- ]free|sans alcool)/i },
  {
    name: 'ohne Mikroplastik',
    muster: /(mikroplastik[- ]?frei|ohne mikroplastik|microplastics?[- ]free|sans microplastiques?)/i
  },

  // ---------- KLEIDUNG ----------
  {
    // "wasserdicht" ist staerker und belegt darum auch "wasserabweisend".
    // Umgekehrt nicht - das prueft der Eintrag "wasserdicht" oben.
    name: 'wasserabweisend',
    behauptet: /(wasser[- ]?abweisend|water[- ]?repellent|d\u00e9perlant|(?<![a-z])dwr(?![a-z]))/i,
    beleg: /(wasser[- ]?abweisend|water[- ]?repellent|d\u00e9perlant|(?<![a-z])dwr(?![a-z])|wasserdicht|waterproof|imperm\u00e9able|gore[- ]?tex|impr(?:\u00e4|ae)gniert)/i
  },
  { name: 'atmungsaktiv', muster: /(atmungsaktiv|breathable|respirant)/i },
  {
    name: 'Bio-Baumwolle',
    behauptet: /(bio[- ]?baumwolle|organic cotton|coton bio|baumwolle aus (?:kontrolliert )?biologischem anbau|(?<![a-z])gots(?![a-z]))/i,
    beleg: /(bio[- ]?baumwolle|organic cotton|coton bio|baumwolle aus (?:kontrolliert )?biologischem anbau|(?<![a-z])gots(?![a-z])|(?<![a-z])kba(?![a-z]))/i
  },
  { name: 'Merino', muster: /merino/i },
  { name: 'Kaschmir', muster: /(kaschmir|cashmere|cachemire)/i },
  {
    name: 'Seide',
    behauptet: /((?<![a-z\u00df-\u00ff])seiden?(?![a-z\u00df-\u00ff])|(?<![a-z])silk(?![a-z])|(?<![a-z\u00df-\u00ff])soie(?![a-z\u00df-\u00ff]))/i,
    beleg: /((?<!kunst[- ]?)seide(?!n?(?:matt|glanz|weich|optik|[- ]?look))|(?<![a-z])silk(?!y)|(?<![a-z\u00df-\u00ff])soie(?![a-z\u00df-\u00ff]))/i
  },
  {
    name: 'Daunen',
    muster: /((?<!kunst[- ]?)daune(?!n?[- ]?(?:optik|imitat|\u00e4hnlich|aehnlich|alternative|ersatz))|(?<!button[- ])(?<![a-z])down(?![- ]?alternative)(?![a-z]))/i
  },
  {
    // Echtes Leder. Kunstleder, PU-Leder, veganes Leder, Lederoptik und
    // Lederimitat sind KEIN Leder - weder als Behauptung noch als Beleg.
    // "kein echtes Leder" und "ohne Leder" sind keine Behauptung.
    name: 'Leder',
    muster: /((?<!(?:kunst|pu|\u00f6ko|oeko|veganes|vegan|synthetik|kunststoff)[- ]?)(?<!(?:ohne|kein(?:e[mnrs]?)?|nicht aus)(?: echte[mnrs]?)? )(?<![a-z\u00df-\u00ff])(?:echt|rinds|glatt|wild|nubuk|velours|nappa|lamm|ziegen|vollnarben)?leder(?!optik|[- ]?look|imitat|faser|pflege|\u00e4hnlich|aehnlich)|(?<!(?:faux|pu|vegan|synthetic|artificial|imitation|bonded|eco|no|not|non)[- ]?)(?<![a-z])leather(?!ette)|(?<!simili[- ]?)(?<![a-z])cuir(?![a-z]))/i
  },
  {
    name: 'maschinenwaschbar',
    behauptet: /(maschinen[- ]?waschbar|waschmaschinen[- ]?(?:fest|geeignet|tauglich)|in der (?:wasch)?maschine waschbar|machine[- ]washable|lavable en machine)/i,
    beleg: /(maschinen[- ]?waschbar|waschmaschinen[- ]?(?:fest|geeignet|tauglich)|in der (?:wasch)?maschine waschbar|machine[- ]washable|lavable en machine|maschinenw(?:\u00e4|ae)sche|schonwaschgang|(?:30|40|60|95)\s*\u00b0\s*c?\s*(?:w(?:\u00e4|ae)sche|waschen|wash))/i
  },

  // ---------- MOEBEL ----------
  {
    // Massiv nur mit Holz. "massiver Stahlrahmen" ist kein Massivholz,
    // "Eiche furniert" auch nicht.
    name: 'Massivholz',
    muster: /(massivholz|vollholz|bois massif|solid (?:wood|oak|beech|pine|walnut|ash|acacia|teak|mango|birch|cherry)|massiv(?:e[mnrs]?)?[- ](?:(?:wild)?eiche|(?:kern)?buche|kiefer|fichte|nussbaum|ahorn|esche|akazie|teak|mango|birke|kirsch|l(?:\u00e4|ae)rche|zirbe|arve|sheesham|palisander|holz)|(?:(?:wild)?eiche|(?:kern)?buche|kiefer|fichte|nussbaum|ahorn|esche|akazie|teak|mango|birke|kirsch(?:baum)?|l(?:\u00e4|ae)rche|zirbe|arve|sheesham|palisander|holz)[- ]massiv)/i
  },
  // FSC und PEFC sind zwei verschiedene Siegel - das eine belegt das
  // andere nicht.
  { name: 'FSC', muster: /(?<![a-z])fsc(?![a-z])/i },
  { name: 'PEFC', muster: /(?<![a-z])pefc(?![a-z])/i },
  {
    // Gilt auch fuer Monitore - "hoehenverstellbarer Standfuss" ist dort
    // eine haeufige falsche Behauptung.
    name: 'hoehenverstellbar',
    muster: /(h(?:\u00f6|oe)hen?[- ]?(?:verstellbar|einstellbar|verstellung|einstellung)|height[- ]adjust|r\u00e9glable en hauteur)/i
  },
  { name: 'ausziehbar', muster: /(ausziehbar|ausziehtisch|ausziehfunktion|extendable|extensible|(?:\u00e0|a) rallonges?)/i },
  {
    name: 'abnehmbarer Bezug',
    muster: /((?:abnehmbar|abziehbar|waschbar)e[mnrs]? (?:bezug|bez\u00fcge|bezuege)|bez(?:ug|\u00fcge|uege) (?:ist |sind )?(?:abnehmbar|abziehbar|waschbar)|removable cover|washable cover|housse (?:amovible|lavable)|d\u00e9houssable)/i
  },

  // ---------- UEBERALL ----------
  {
    name: 'Swiss Made',
    muster: /(swiss made|made in switzerland|hergestellt in der schweiz|in der schweiz (?:hergestellt|produziert|gefertigt)|schweizer (?:produktion|herstellung|fabrikat)|fabriqu\u00e9 en suisse)/i
  }
];

// Ein Satz, der offen sagt, dass etwas NICHT angegeben ist ...
const WORT_KEINE_ANGABE = /(nicht angegeben|keine angaben?|steht nicht|nicht ersichtlich|nicht belegt|nicht bekannt|unbekannt|unklar|nicht vermerkt|nicht aufgef(?:\u00fc|ue)hrt|fehl(?:t|en) (?:in den )?(?:daten|angaben?))/i;
// ... aber trotzdem vermutet, behauptet doch etwas.
const WORT_VERMUTUNG = /(?<![a-z\u00df-\u00ff])(wahrscheinlich|vermutlich|d(?:\u00fc|ue)rfte|eher|meist(?:ens)?|typischerweise|in der regel|oft|wohl|bestimmt|sicherlich|normalerweise)(?![a-z\u00df-\u00ff])/i;
const WORT_OB = /(?<![a-z\u00df-\u00ff])ob(?![a-z\u00df-\u00ff])/gi;
const WORT_WENDE = /(aber|sondern|jedoch|allerdings|[;:])/i;

/**
 * "Ob sie vegan ist, ist nicht angegeben" - die Behauptung steht in
 * einem ob-Satz, und der Satz sagt, dass die Angabe fehlt. Kein
 * "aber" dazwischen, keine Vermutung im Satz.
 */
function wortOffenGelassen(satz, stelle) {
  if (!WORT_KEINE_ANGABE.test(satz) || WORT_VERMUTUNG.test(satz)) return false;
  const davor = satz.slice(0, stelle);
  let letztesOb = -1;
  let m;
  WORT_OB.lastIndex = 0;
  while ((m = WORT_OB.exec(davor)) !== null) letztesOb = m.index;
  if (letztesOb === -1) return false;
  return !WORT_WENDE.test(davor.slice(letztesOb));
}

function pruefeWoerter(satz, p) {
  const daten = produktText(p);
  for (const e of WOERTER_BELEG) {
    const behauptet = e.behauptet || e.muster;
    const beleg = e.beleg || e.muster;
    const m = behauptet.exec(satz);
    if (!m) continue;
    if (beleg.test(daten)) continue;
    if (wortOffenGelassen(satz, m.index)) continue;
    return '"' + e.name + '" behauptet, steht aber nicht in den Produktdaten';
  }
  return null;
}

const PRUEFUNGEN = [pruefeAnzahl, pruefeSterne, pruefeBauform, pruefeBelegt, pruefeShop, pruefeZahlen, pruefeWoerter];`;

const AENDERUNGEN = [
  {
    was: '1/1  Wort-Pruefung einhaengen',
    alt: 'const PRUEFUNGEN = [pruefeAnzahl, pruefeSterne, pruefeBauform, pruefeBelegt, pruefeShop, pruefeZahlen];',
    neu: BLOCK
  }
];

const MUSS_DA_SEIN = [
  'const WOERTER_BELEG = [',
  'function pruefeWoerter(satz, p)',
  'pruefeZahlen, pruefeWoerter];'
];

// ============================================
// PROBE - Saetze aus vier Warenwelten
// ============================================
// [Satz, soll gestrichen werden]  oder
// [Satz, soll gestrichen werden, eigene Produktdaten]
const LEER = { title: 'Testprodukt', wissenText: 'Farbe schwarz', rating: 4.0, reviews: 50 };

const WELTEN = [
  {
    name: 'KOSMETIK    Daten: parfuemfrei, nicht komedogen, dermatologisch, vegan',
    produkt: {
      title: 'Gesichtscreme Sensitive 50 ml',
      wissenText: 'Parfuemfrei\nNicht komedogen\nDermatologisch getestet\nVegan',
      rating: 4.4,
      reviews: 120
    },
    faelle: [
      ['Parfuemfrei, gut bei Allergien', false],
      ['Ohne Duftstoffe, gut bei empfindlicher Haut', false],
      ['Vegan', false],
      ['Dermatologisch getestet', false],
      ['Nicht komedogen, verstopft keine Poren', false],
      ['Ohne Tierversuche hergestellt', true],
      ['Silikonfrei und ohne Parabene', true],
      ['Hypoallergen', true],
      ['Zertifizierte Naturkosmetik', true],
      ['Ob sie ohne Tierversuche hergestellt wird, ist nicht angegeben', false],
      ['Ob sie ohne Tierversuche hergestellt wird, ist nicht angegeben, wahrscheinlich aber schon', true],
      ['Ob sie alkoholfrei ist, ist unklar, aber sie ist sulfatfrei', true]
    ]
  },
  {
    name: 'KLEIDUNG    Regenjacke, Daten: wasserabweisend, atmungsaktiv, Kunstdaune',
    produkt: {
      title: 'Regenjacke Herren',
      wissenText: 'Wasserabweisend (DWR-Beschichtung)\nAtmungsaktiv\nObermaterial Polyamid\nFuellung Kunstdaune',
      rating: 4.2,
      reviews: 64
    },
    faelle: [
      ['Wasserabweisend, haelt leichtem Regen stand', false],
      ['Atmungsaktiv', false],
      ['Daunenfuellung haelt warm', true],
      ['Mit Kunstdaunen gefuellt, auch nass noch warm', false],
      ['Aus Bio-Baumwolle', true],
      ['Innen Merinowolle', true],
      ['Maschinenwaschbar', true]
    ]
  },
  {
    name: 'SCHUHE      Sneaker, Daten: Kunstleder (PU-Leder)',
    produkt: {
      title: 'Sneaker Damen weiss',
      wissenText: 'Obermaterial Kunstleder (PU-Leder)\nSohle Gummi',
      rating: 4.1,
      reviews: 77
    },
    faelle: [
      ['Aus Leder, wird mit der Zeit schoener', true],
      ['Echtleder', true],
      ['Kunstleder, pflegeleicht', false],
      ['Lederoptik, wirkt hochwertig', false],
      ['Kein echtes Leder, sondern PU', false],
      ['Aus echtem Leder', false, 'Obermaterial Rindsleder']
    ]
  },
  {
    name: 'MOEBEL      Esstisch, Daten: Wildeiche massiv, ausziehbar, FSC',
    produkt: {
      title: 'Esstisch Wildeiche massiv 180 cm ausziehbar',
      wissenText: 'Material Wildeiche massiv, geoelt\nFSC-zertifiziert',
      rating: 4.6,
      reviews: 45
    },
    faelle: [
      ['Massivholz, kein Furnier', false],
      ['Aus massiver Eiche', false],
      ['Ausziehbar fuer Gaeste', false],
      ['FSC-zertifiziertes Holz', false],
      ['Hoehenverstellbar', true],
      ['Swiss Made', true],
      ['Massivholz, kein Furnier', true, 'Gestell massiver Stahlrahmen\nPlatte MDF, Eiche furniert'],
      ['Stabiler, massiver Stahlrahmen', false, 'Gestell massiver Stahlrahmen\nPlatte MDF, Eiche furniert']
    ]
  },
  {
    name: 'SPRACHEN    Beleg steht auf Englisch oder Franzoesisch',
    produkt: LEER,
    faelle: [
      ['Parfümfrei', false, 'Fragrance free formula'],
      ['Höhenverstellbar', false, 'Height-adjustable stand'],
      ['Massivholz', false, 'Top: solid oak'],
      ['Aus Leder', false, 'Cuir véritable'],
      ['Aus Leder', true, 'Upper: faux leather'],
      ['Daunenfüllung', true, 'Down alternative fill'],
      ['Aus reiner Seide', true, 'Kunstseide (Viskose)'],
      ['Wasserabweisend', false, 'Gore-Tex Membran'],
      ['FSC-Holz', true, 'Nur PEFC']
    ]
  },
  {
    name: 'ELEKTRONIK  Monitor ohne Hoehenverstellung',
    produkt: {
      title: 'Philips Monitor 27E1N1800AE/00 27 Zoll',
      wissenText: 'Bildschirmdiagonale 27 Zoll\nBildwiederholrate 75 Hz\nAnschluesse HDMI, USB-C',
      rating: 4.5,
      reviews: 692
    },
    faelle: [
      ['Hoehenverstellbarer Standfuss', true],
      ['27 Zoll Diagonale, gut fuer zwei Fenster', false],
      ['Kein Download noetig', false]
    ]
  },
  {
    // Darf NIE gestrichen werden: Saetze ohne Behauptung.
    name: 'FEHLALARM   normale Saetze - duerfen nie gestrichen werden',
    produkt: LEER,
    faelle: [
      ['Guter Allrounder fuer den Alltag', false],
      ['Bequemer Schnitt, faellt normal aus', false],
      ['Einfach aufzubauen, auch allein', false],
      ['Wirkt hochwertig verarbeitet', false],
      ['Zieht schnell ein und fettet nicht', false],
      ['Fuer empfindliche Haut gedacht', false],
      ['Sehr massiv gebaut', false],
      ['Seidiger Glanz nach dem Waschen', false],
      ['Fuer den Winter eher zu duenn', false],
      ['Im Zweifel lieber eine Nummer groesser nehmen', false]
    ]
  }
];

// ============================================

function zeitstempel() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}-${z(d.getMinutes())}`;
}

function zaehlen(heuhaufen, nadel) {
  let n = 0;
  let i = heuhaufen.indexOf(nadel);
  while (i !== -1) { n++; i = heuhaufen.indexOf(nadel, i + nadel.length); }
  return n;
}

function main() {
  console.log('');
  console.log('SYNORA - Woerter mit Belegpflicht fuer alle Warenwelten');
  console.log('=======================================================');
  console.log('');

  if (!fs.existsSync(ZIEL)) {
    console.log(`ABBRUCH: ${ZIEL} nicht gefunden.`);
    console.log('Bitte im Ordner synora-backend-main ausfuehren.');
    process.exit(1);
  }

  const roh = fs.readFileSync(ZIEL, 'utf8');
  const hatCRLF = roh.includes('\r\n');
  let txt = roh.replace(/\r\n/g, '\n');

  console.log(`Datei:   ${ZIEL}`);
  console.log(`         ${roh.length} Zeichen, ${hatCRLF ? 'CRLF' : 'LF'}`);
  console.log('');

  if (txt.includes(MARKE)) {
    console.log('Bereits eingebaut. Es wird nichts geaendert.');
    process.exit(0);
  }

  if (!txt.includes('ZAHL_MIT_EINHEIT')) {
    console.log('ABBRUCH: zahlenBelegt.js ist noch nicht eingespielt.');
    console.log('Erst "node zahlenBelegt.js", dann dieses Skript.');
    console.log('Es wurde NICHTS geaendert.');
    process.exit(1);
  }

  console.log('Pruefung:');
  let allesOk = true;
  for (const name of NEUE_NAMEN) {
    if (new RegExp('\\b' + name + '\\b').test(txt)) {
      console.log(`  FEHLER  der Name ${name} existiert schon in der Datei`);
      allesOk = false;
    }
  }
  for (const a of AENDERUNGEN) {
    const n = zaehlen(txt, a.alt);
    if (n === 1) {
      console.log(`  OK      ${a.was}`);
    } else {
      console.log(`  FEHLER  ${a.was}  (${n} mal gefunden, erwartet: 1)`);
      allesOk = false;
    }
  }
  console.log('');

  if (!allesOk) {
    console.log('ABBRUCH. Es wurde NICHTS geaendert.');
    process.exit(1);
  }

  const sicherung = `${ZIEL}.sicherung-${zeitstempel()}`;
  fs.copyFileSync(ZIEL, sicherung);
  console.log(`Sicherung:  ${sicherung}`);

  for (const a of AENDERUNGEN) txt = txt.replace(a.alt, () => a.neu);
  if (hatCRLF) txt = txt.replace(/\n/g, '\r\n');
  fs.writeFileSync(ZIEL, txt, 'utf8');

  function zurueckspielen(grund) {
    fs.copyFileSync(sicherung, ZIEL);
    console.log('');
    console.log(`ABBRUCH: ${grund}`);
    console.log('Die alte Fassung ist zurueckgespielt.');
    process.exit(1);
  }

  const neu = fs.readFileSync(ZIEL, 'utf8');
  console.log('');
  console.log('Gegenprobe:');
  let ok = true;
  for (const s of MUSS_DA_SEIN) {
    const da = neu.includes(s);
    console.log(`  ${da ? 'OK     ' : 'FEHLT  '} ${s}`);
    if (!da) ok = false;
  }
  if (!ok) zurueckspielen('die Gegenprobe ist nicht sauber.');

  let syntaxOk = false;
  let fehler = '';
  try {
    execFileSync(process.execPath, ['--check', path.resolve(ZIEL)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    syntaxOk = true;
  } catch (e) {
    fehler = (e.stderr ? String(e.stderr) : '') || e.message;
  }
  console.log(`  ${syntaxOk ? 'OK     ' : 'FEHLER '} die Datei ist syntaktisch in Ordnung`);
  if (!syntaxOk) {
    console.log('');
    console.log(fehler);
    zurueckspielen('die geaenderte Datei hat einen Schreibfehler.');
  }

  // ---------- Verhalten an echten Saetzen ----------
  // In einem eigenen Prozess, damit die neue Datei frisch geladen wird.
  console.log('');
  console.log('Probe ueber alle Warenwelten:');

  const auftrag = [];
  for (const w of WELTEN) {
    for (const f of w.faelle) {
      const produkt = f[2] ? { title: 'Produkt', wissenText: f[2] } : w.produkt;
      auftrag.push({ produkt, satz: f[0] });
    }
  }

  const pruefdatei = path.join(require('os').tmpdir(), `synora-woerter-${Date.now()}.js`);
  fs.writeFileSync(
    pruefdatei,
    [
      "'use strict';",
      `const f = require(${JSON.stringify(path.resolve(ZIEL))});`,
      `const auftrag = ${JSON.stringify(auftrag)};`,
      'const raus = auftrag.map((a) => {',
      '  const r = f.saetzePruefen([a.satz], a.produkt) || {};',
      '  const weg = Array.isArray(r.entfernt) ? r.entfernt : (Array.isArray(r.gestrichen) ? r.gestrichen : []);',
      '  const e = weg.find((x) => x && x.satz === a.satz);',
      '  return [!!e, e ? e.grund : null];',
      '});',
      "console.log('###' + JSON.stringify(raus));"
    ].join('\n'),
    'utf8'
  );

  let ergebnis = null;
  try {
    const ausgabe = execFileSync(process.execPath, [pruefdatei], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    ergebnis = JSON.parse(String(ausgabe).split('###')[1].trim());
  } catch (e) {
    console.log('  (Probe nicht moeglich)');
    console.log('  ' + (((e.stderr ? String(e.stderr) : '') || e.message).split('\n')[0]));
  } finally {
    try { fs.unlinkSync(pruefdatei); } catch (_) {}
  }

  if (!ergebnis) zurueckspielen('die Probe konnte nicht laufen.');

  let falsch = 0;
  let k = 0;
  for (const w of WELTEN) {
    console.log('');
    console.log(`  ${w.name}`);
    for (const f of w.faelle) {
      const [gestrichen, grund] = ergebnis[k++];
      const soll = f[1];
      const gut = gestrichen === soll;
      if (!gut) falsch += 1;
      const text = f[2] ? `${f[0]}  | Daten: ${f[2].split('\n')[0]}` : f[0];
      const kurz = text.length > 58 ? text.slice(0, 57) + '…' : text;
      console.log(`    ${gut ? 'OK    ' : 'FEHLER'} ${gestrichen ? 'WEG   ' : 'bleibt'} ${kurz}`);
      if (!gut && grund) console.log(`                   ${grund}`);
    }
  }

  if (falsch) {
    console.log('');
    console.log(`  ${falsch} Fall/Faelle weichen ab.`);
    zurueckspielen('die Probe hat nicht das erwartete Ergebnis geliefert.');
  }

  console.log('');
  console.log(`FERTIG. ${k} von ${k} Faellen wie erwartet.`);
  console.log('');
  console.log('AUCH DIESER EINGRIFF ENTFERNT TEXT. Nach den naechsten');
  console.log('zwanzig Suchen:');
  console.log('');
  console.log('  node scripts/sucheNachschauen.js --lauf');
  console.log('');
  console.log('Taucht dort oft "... behauptet, steht aber nicht in den');
  console.log('Produktdaten" bei Angaben auf, die offensichtlich stimmen,');
  console.log('steht die Regel zu scharf - dann melden, nicht selbst lockern.');
  console.log('');
  console.log('Naechster Schritt: node scripts/pruefstand.js');
  console.log('');
}

main();
