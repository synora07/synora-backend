// ============================================
// SYNORA - Erfundene Angaben entfernen
// ============================================
// GEFUNDEN am 08.11.2026 mit befund.js.
//
// In src/services/productSearchService.js, ab Zeile 145:
//
//   verified: true,                                    <- nie geprueft
//   lastVerified: new Date().toISOString(),            <- "geprueft: jetzt"
//   // Bewertung (simuliert)
//   rating: (4.0 + Math.random() * 0.9).toFixed(1),    <- gewuerfelt
//   reviewCount: Math.floor(100 + Math.random() * 900) <- gewuerfelt
//
// Vier erfundene Angaben. Die schwerste ist verified: true - ein
// Pruefsiegel, das nie etwas geprueft hat, mit Zeitstempel dazu.
//
// ============================================
// ES ERREICHT HEUTE NIEMANDEN
// ============================================
// Geprueft, bevor das hier geschrieben wurde:
//
//   - productRoutes.js laedt den Dienst (Zeile 9 und 14) und ruft ihn
//     NIE auf. Die Suchroute benutzt nur serpApiService.searchRealProducts.
//   - elektronikShops.js nennt ihn zweimal, beide Male in einem
//     Kommentar (Zeile 3 und 835).
//   - Sonst niemand.
//
// Also toter Code. Kein Besucher hat je eine gewuerfelte Bewertung
// gesehen. Das ist wichtig fuer die Einordnung: das hier ist
// Aufraeumarbeit, kein Notfall.
//
// ============================================
// WARUM TROTZDEM RAUS
// ============================================
// 1. Das Repository ist OEFFENTLICH. Jeder, der synora07/synora-backend
//    aufmacht, findet Math.random() direkt neben verified: true - bei
//    einer Seite, die mit Ehrlichkeit wirbt. Das ist schwer zu erklaeren.
//
// 2. Toter Code, der Daten erfindet, ist eine geladene Waffe.
//    Irgendwann haengt jemand die Route wieder an, oder ein Agent
//    greift darauf zu. Dann ist es live, und niemand erinnert sich.
//
// 3. Regel 2 lautet: keine Behauptung ohne Belege. Solange diese vier
//    Zeilen dastehen, ist das eine Absichtserklaerung und kein Grundsatz.
//
// Richtig macht es serpApiService.js:205 - null, wenn nichts da ist.
//
// ============================================
// WIE DAS SKRIPT ARBEITET
// ============================================
//   - Zwei Dateien, drei Stellen. ALLES ODER NICHTS: passt eine Stelle
//     nicht genau einmal, wird KEINE der beiden Dateien angefasst.
//   - Erst Sicherungen, dann die Aenderung
//   - Zeilenenden bleiben, wie sie waren
//   - Die Gegenprobe laedt beide Dateien in einem eigenen Node-Lauf.
//     Scheitert sie, werden BEIDE Sicherungen zurueckgespielt.
//   - Sie zaehlt ausserdem, wie viele Math.random() noch im Dienst
//     stehen, und zeigt sie an. Nicht jedes davon ist falsch - aber
//     du sollst wissen, was noch da ist.
//
// Aufruf im Ordner synora-backend-main:
//   node erfundenesRaus.js
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const DIENST = path.join('src', 'services', 'productSearchService.js');
const ROUTE = path.join('src', 'routes', 'productRoutes.js');
const MARKE = 'entfernt am 08.11.2026';

const AENDERUNGEN = [
  {
    datei: DIENST,
    was: '1/3  Pruefsiegel ohne Pruefung',
    alt:
`        // SYNORA Features
        verified: true,
        lastVerified: new Date().toISOString(),`,
    neu:
`        // SYNORA Features
        // verified und lastVerified entfernt am 08.11.2026.
        // Hier wurde nie etwas geprueft. Ein Pruefsiegel ohne Pruefung
        // ist eine Behauptung ohne Beleg - genau das, was Regel 2
        // verbietet. Der Zeitstempel behauptete obendrein, die Pruefung
        // sei gerade passiert.
        verified: false,
        lastVerified: null,`
  },

  {
    datei: DIENST,
    was: '2/3  Gewuerfelte Sterne und Bewertungszahlen',
    alt:
`        // Bewertung (simuliert)
        rating: (4.0 + Math.random() * 0.9).toFixed(1),
        reviewCount: Math.floor(100 + Math.random() * 900)`,
    neu:
`        // Bewertung: es gibt hier keine.
        //
        // Bis zum 08.11.2026 standen hier zwei Math.random()-Aufrufe:
        //   rating:      eine Zufallszahl zwischen 4.0 und 4.9
        //   reviewCount: eine Zufallszahl zwischen 100 und 1000
        //
        // Der Kommentar daneben sagte "(simuliert)" - es war also
        // bekannt. Ausgeliefert wurde es nie, weil productRoutes.js
        // diesen Dienst zwar laedt, aber nie aufruft.
        //
        // Richtig macht es serpApiService.js:205 - null, wenn nichts
        // da ist. Eine fehlende Angabe ist ehrlich. Eine erfundene
        // Angabe ist es nie, auch nicht als Platzhalter.
        rating: null,
        reviewCount: null`
  },

  {
    datei: ROUTE,
    was: '3/3  Toten Ladevorgang entfernen',
    alt:
`// Services laden
let serpApiService, productSearchService;
try {
  serpApiService = require('../services/serpApiService');
} catch (e) {}
try {
  productSearchService = require('../services/productSearchService');
} catch (e) {}`,
    neu:
`// Services laden
let serpApiService;
try {
  serpApiService = require('../services/serpApiService');
} catch (e) {}

// productSearchService wurde hier geladen und in diesen 75 Zeilen nie
// aufgerufen - entfernt am 08.11.2026. Die Suche unten benutzt
// ausschliesslich serpApiService.searchRealProducts, und das ist
// richtig so: nur dort kommen Preise und Bewertungen aus echten Daten.`
  }
];

// Was nach der Aenderung in den Dateien stehen MUSS
const MUSS_DA_SEIN = [
  [DIENST, 'rating: null'],
  [DIENST, 'reviewCount: null'],
  [DIENST, 'verified: false'],
  [ROUTE, 'let serpApiService;']
];

// Was NICHT mehr dastehen darf
const MUSS_WEG = [
  [DIENST, 'Math.random() * 0.9'],
  [DIENST, 'Math.random() * 900'],
  [DIENST, 'verified: true'],
  // Geprueft wird der LADEBEFEHL, nicht das Wort. Der Kommentar, der
  // die Entfernung erklaert, nennt den Namen weiterhin - das ist die
  // Dokumentation und soll so bleiben.
  [ROUTE, "require('../services/productSearchService')"],
  [ROUTE, 'let serpApiService, productSearchService;']
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
  while (i !== -1) {
    n++;
    i = heuhaufen.indexOf(nadel, i + nadel.length);
  }
  return n;
}

function main() {
  console.log('');
  console.log('SYNORA - Erfundene Angaben entfernen');
  console.log('====================================');
  console.log('');

  const dateien = [DIENST, ROUTE];

  for (const d of dateien) {
    if (!fs.existsSync(d)) {
      console.log(`ABBRUCH: ${d} nicht gefunden.`);
      console.log('Bist du im Ordner synora-backend-main?');
      process.exit(1);
    }
  }

  // ---------- einlesen ----------
  const stand = new Map();
  for (const d of dateien) {
    const roh = fs.readFileSync(d, 'utf8');
    stand.set(d, { roh, hatCRLF: roh.includes('\r\n'), txt: roh.replace(/\r\n/g, '\n') });
    console.log(`${d}`);
    console.log(`   ${roh.length} Zeichen, ${roh.includes('\r\n') ? 'CRLF (Windows)' : 'LF'}`);
  }
  console.log('');

  if (stand.get(DIENST).txt.includes(MARKE)) {
    console.log('Bereits aufgeraeumt. Es wird nichts geaendert.');
    process.exit(0);
  }

  // ---------- Pruefung ----------
  console.log('Pruefung:');
  let allesOk = true;
  for (const a of AENDERUNGEN) {
    const n = zaehlen(stand.get(a.datei).txt, a.alt);
    if (n === 1) {
      console.log(`  OK      ${a.was}`);
    } else {
      console.log(`  FEHLER  ${a.was}  (${n} mal gefunden, erwartet: 1)`);
      allesOk = false;
    }
  }
  console.log('');

  if (!allesOk) {
    console.log('ABBRUCH. Es wurde NICHTS geaendert, in keiner der beiden Dateien.');
    console.log('Schick die Ausgabe weiter, dann wird das Skript angepasst.');
    process.exit(1);
  }

  // ---------- Sicherungen ----------
  const sicherungen = new Map();
  for (const d of dateien) {
    const s = `${d}.sicherung-${zeitstempel()}`;
    fs.copyFileSync(d, s);
    sicherungen.set(d, s);
    console.log(`Sicherung:  ${s}`);
  }

  // ---------- aendern ----------
  for (const d of dateien) {
    let txt = stand.get(d).txt;
    for (const a of AENDERUNGEN) {
      if (a.datei === d) txt = txt.replace(a.alt, a.neu);
    }
    if (stand.get(d).hatCRLF) txt = txt.replace(/\n/g, '\r\n');
    fs.writeFileSync(d, txt, 'utf8');
  }

  function zurueckspielen(grund) {
    for (const d of dateien) fs.copyFileSync(sicherungen.get(d), d);
    console.log('');
    console.log(`ABBRUCH: ${grund}`);
    console.log('BEIDE Dateien sind zurueckgespielt und wieder genau so,');
    console.log('wie sie vorher waren.');
    process.exit(1);
  }

  // ---------- Gegenprobe: Text ----------
  console.log('');
  console.log('Gegenprobe:');
  let ok = true;

  for (const [d, s] of MUSS_DA_SEIN) {
    const da = fs.readFileSync(d, 'utf8').includes(s);
    console.log(`  ${da ? 'OK     ' : 'FEHLT  '} ${s}`);
    if (!da) ok = false;
  }
  for (const [d, s] of MUSS_WEG) {
    const weg = !fs.readFileSync(d, 'utf8').includes(s);
    console.log(`  ${weg ? 'OK     ' : 'NOCH DA'} "${s}" ist verschwunden`);
    if (!weg) ok = false;
  }
  for (const d of dateien) {
    const t = fs.readFileSync(d, 'utf8');
    const auf = zaehlen(t, '{');
    const zu = zaehlen(t, '}');
    console.log(`  ${auf === zu ? 'OK     ' : 'ACHTUNG'} ${path.basename(d)}: ${auf} Klammern auf, ${zu} zu`);
    if (auf !== zu) ok = false;
  }

  if (!ok) zurueckspielen('die Gegenprobe ist nicht sauber.');

  // ---------- Gegenprobe: laden beide Dateien noch? ----------
  const pruefdatei = path.join(require('os').tmpdir(), `synora-pruefung-${Date.now()}.js`);
  fs.writeFileSync(
    pruefdatei,
    [
      "'use strict';",
      `require(${JSON.stringify(path.resolve(DIENST))});`,
      `require(${JSON.stringify(path.resolve(ROUTE))});`,
      "console.log('###geladen');"
    ].join('\n'),
    'utf8'
  );

  let geladen = false;
  let fehler = '';
  try {
    const { execFileSync } = require('child_process');
    const ausgabe = execFileSync(process.execPath, [pruefdatei], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    geladen = String(ausgabe).includes('###geladen');
  } catch (e) {
    fehler = (e.stderr ? String(e.stderr) : '') || e.message;
  } finally {
    try { fs.unlinkSync(pruefdatei); } catch (_) {}
  }

  console.log(`  ${geladen ? 'OK     ' : 'FEHLER '} beide Dateien lassen sich laden`);
  if (!geladen) {
    console.log('');
    console.log(fehler);
    zurueckspielen('eine der Dateien laesst sich nicht mehr laden.');
  }

  // ---------- Was bleibt ----------
  const rest = [];
  const zeilen = fs.readFileSync(DIENST, 'utf8').replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i].trim();
    // Kommentarzeilen ueberspringen: der Hinweis oben erwaehnt
    // Math.random, ist aber kein Aufruf.
    if (z.startsWith('//') || z.startsWith('*')) continue;
    if (z.includes('Math.random')) rest.push(`${i + 1}: ${z}`);
  }

  console.log('');
  console.log('FERTIG. Vier erfundene Angaben sind weg.');
  console.log('');
  if (rest.length === 0) {
    console.log('In productSearchService.js steht kein Math.random() mehr.');
  } else {
    console.log(`ACHTUNG: In productSearchService.js stehen noch ${rest.length} Math.random():`);
    for (const r of rest) console.log(`  ${r}`);
    console.log('');
    console.log('Nicht jedes davon muss falsch sein - Zufall fuer eine Reihenfolge');
    console.log('ist etwas anderes als Zufall fuer eine Bewertung. Schau sie dir an,');
    console.log('oder schick die Zeilen weiter.');
  }
  console.log('');
  console.log('Naechster Schritt: hochladen, dann baut Railway neu.');
  console.log('');
}

main();
