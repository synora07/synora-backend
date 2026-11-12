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

// ============================================
// ZAHLEN MIT EINHEIT  (angebaut 09.11.2026)
// ============================================
// BELEGPFLICHTIG oben deckt sieben Eigenschaften ab, und alle sieben
// sind fuer Kopfhoerer. Fuer Monitore, Laptops und Handys steht dort
// nichts - von 110 Kategorien ist eine abgedeckt.
//
// Am 08.11.2026 stand in einem Satz "nur 4% unzufriedene Kaeufer".
// Gestrichen wurde er wegen der Bewertungsanzahl daneben; die
// Prozentzahl hat niemand geprueft. Dasselbe gilt fuer "825 GB SSD",
// "12 Stunden Akku" oder "144 Hz".
//
// Statt die Liste endlos zu verlaengern, eine Regel fuer alle:
// Traegt eine Zahl eine Einheit, muss sie in den Produktdaten stehen.
//
// NUR Zahlen mit Einheit. "Liegt mit 150 Franken unter deinem Budget
// von 200" waere sonst auch betroffen - die 200 sind das Budget des
// Nutzers, kein Produktdatum, und der Satz ist richtig.

// Die Einheiten decken alle Warenwelten ab, nicht nur Elektronik.
// Kiara verkauft auch Kosmetik und Kleidung - dort sind ml, g und
// Prozent die Angaben, auf die es ankommt:
//
//   KOSMETIK   200 ml Flasche, 5% Urea, 250 g Tiegel
//   KLEIDUNG   60% Baumwolle, 320 g, 82 cm Innenbeinlaenge
//   HAUSHALT   1800 W Leistung
//
// Laengere Einheiten stehen vor kuerzeren, damit "16 gb" nicht als
// "16 g" gelesen wird. Das (?![a-z]) am Ende sorgt dafuer, dass
// "5 Wochen" nicht als "5 W" durchgeht.
const ZAHL_MIT_EINHEIT = /(\d+(?:[.,]\d+)?)[\s-]*(prozent|zoll|kerne|kern|stunden|stunde|minuten|minute|monaten|monate|monat|jahren|jahre|jahr|liter|lumen|karat|nits|khz|ghz|mhz|mah|wh|hz|fps|bit|dpi|ppi|std|gb|tb|mb|kb|ml|mg|cm|mm|kg|g|l|w|v|%|"|k)(?![a-z])/gi;

function alleZahlen(text) {
  return (String(text || '').match(/\d+(?:[.,]\d+)?/g) || []).map((z) => z.replace(',', '.'));
}

/**
 * Jede Zahl mit Einheit muss in den Produktdaten stehen.
 *
 * Erlaubt sind alle Zahlen aus produktText - also Titel, Name,
 * Extensions und das Produktwissen - dazu Sterne und
 * Bewertungsanzahl, die nicht im Text stehen, aber am Produkt
 * haengen.
 */
function pruefeZahlen(satz, p) {
  const erlaubt = new Set(alleZahlen(produktText(p)));
  if (p && p.rating !== undefined && p.rating !== null) erlaubt.add(String(p.rating).replace(',', '.'));
  if (p && p.reviews !== undefined && p.reviews !== null) erlaubt.add(String(p.reviews).replace(',', '.'));

  // 4.0 und 4 sind dieselbe Zahl - sonst streicht die Pruefung eine
  // richtige Angabe nur wegen der Schreibweise.
  const alsZahlen = [...erlaubt].map(Number).filter(Number.isFinite);

  ZAHL_MIT_EINHEIT.lastIndex = 0;
  let treffer;
  while ((treffer = ZAHL_MIT_EINHEIT.exec(satz)) !== null) {
    const roh = treffer[1].replace(',', '.');
    if (erlaubt.has(roh)) continue;
    const zahl = Number(roh);
    if (Number.isFinite(zahl) && alsZahlen.some((e) => e === zahl)) continue;
    return `"${treffer[0].trim()}" steht nicht in den Produktdaten`;
  }
  return null;
}

// ============================================
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

const PRUEFUNGEN = [pruefeAnzahl, pruefeSterne, pruefeBauform, pruefeBelegt, pruefeShop, pruefeZahlen, pruefeWoerter];

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