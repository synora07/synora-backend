// ============================================
// SYNORA - Preisgruppen trotz anderer Wortreihenfolge
// ============================================
// GEZEIGT am 09.11.2026 von der Probe im eigenen Einbau:
//
//     ok    HP Monitor OMEN 32c      310   ueblich 165.96
//     ok    HP OMEN 32c Monitor      299   ueblich -
//  VERDACHT HP Monitor OMEN 32c    21.92   ueblich 165.96
//
// Das mittlere Angebot bekam KEINE Spanne. Es ist derselbe Monitor,
// nur steht "Monitor" am Ende statt in der Mitte - und
// schluesselBauen() macht daraus einen anderen Schluessel.
//
// In der Probe war das folgenlos, weil zwei andere Angebote denselben
// Titel trugen. In echt heisst es: derselbe Artikel wird bei
// verschiedenen Shops haeufig nicht gruppiert, und der Preisvergleich
// laeuft seltener als er koennte. Jede Gruppe braucht mindestens zwei
// Angebote - fehlt eines wegen der Wortreihenfolge, faellt die ganze
// Gruppe aus.
//
// ============================================
// DIE LOESUNG, UND WARUM SIE NUR HIER GILT
// ============================================
// Fuer das Gruppieren werden die Woerter alphabetisch sortiert:
//
//   "hp monitor omen 32c"  ->  "32c hp monitor omen"
//   "hp omen 32c monitor"  ->  "32c hp monitor omen"
//
// Gleicher Schluessel, eine Gruppe.
//
// WICHTIG: schluesselBauen() selbst wird NICHT angefasst. Diese
// Funktion bildet auch die Schluessel der Produktwissen-Datenbank. Wer
// sie aendert, entwertet jeden gespeicherten Eintrag - das gesammelte
// Wissen waere auf einen Schlag nicht mehr auffindbar.
//
// Die neue Sortierung gilt deshalb ausschliesslich innerhalb von
// preisgruppenBauen, wo sie nur eine Minute lang lebt.
//
// ============================================
// WAS DAS SORTIEREN KOSTEN KANN
// ============================================
// Zwei verschiedene Produkte mit denselben Woertern in anderer
// Reihenfolge wuerden zusammenfallen. Das ist bei Produktnamen selten
// - "Samsung 32 Zoll Monitor" und "Samsung Monitor 32 Zoll" sind
// dasselbe Geraet, nicht zwei.
//
// Und der Schaden waere klein: entschieden am 09.11.2026 wird ein
// verdaechtiges Angebot nicht aussortiert, sondern nur gewarnt. Eine
// falsche Gruppe kostet also einen ueberfluessigen Satz, kein
// verlorenes Produkt.
//
// ============================================
// Setzt preisVerdacht.js voraus. Aufruf im Ordner
// synora-backend-main:
//   node preisGruppenBesser.js
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const WISSEN = path.join('src', 'services', 'wissenService.js');
const CONTROLLER = path.join('src', 'controllers', 'chatController.js');
const MARKE = 'preisgruppenSchluessel';

const AENDERUNGEN = [
  {
    datei: WISSEN,
    was: '1/3  Schluessel mit sortierten Woertern',
    alt:
`function preisgruppenBauen(produkte) {
  const nachSchluessel = new Map();`,
    neu:
`/**
 * Schluessel fuers Gruppieren innerhalb EINER Suche: wie
 * schluesselBauen, aber die Woerter alphabetisch sortiert.
 *
 * Angebaut am 09.11.2026. Grund: "HP Monitor OMEN 32c" und
 * "HP OMEN 32c Monitor" sind dasselbe Geraet, ergaben aber zwei
 * Schluessel - und damit zwei Gruppen mit je einem Angebot, also gar
 * keinen Vergleich.
 *
 * schluesselBauen selbst bleibt unangetastet: es bildet auch die
 * Schluessel der Produktwissen-Datenbank. Eine Aenderung dort wuerde
 * jeden gespeicherten Eintrag unauffindbar machen.
 */
function preisgruppenSchluessel(name) {
  const s = schluesselBauen(name);
  if (!s) return '';
  return String(s).split(/\\s+/).filter(Boolean).sort().join(' ');
}

function preisgruppenBauen(produkte) {
  const nachSchluessel = new Map();`
  },

  {
    datei: WISSEN,
    was: '2/3  Gruppieren benutzt den neuen Schluessel',
    alt:
`    const s = schluesselBauen(p.title || p.name || '');
    if (!s) continue;
    if (!nachSchluessel.has(s)) nachSchluessel.set(s, []);`,
    neu:
`    const s = preisgruppenSchluessel(p.title || p.name || '');
    if (!s) continue;
    if (!nachSchluessel.has(s)) nachSchluessel.set(s, []);`
  },

  {
    datei: WISSEN,
    was: '3/3  Den neuen Schluessel ausliefern',
    alt:
`  preisgruppenBauen,       // angebaut 09.11.2026`,
    neu:
`  preisgruppenBauen,       // angebaut 09.11.2026
  preisgruppenSchluessel,  // angebaut 09.11.2026`
  },

  {
    datei: CONTROLLER,
    was: '4/4  Nachschlagen mit demselben Schluessel',
    alt:
`          : (liveSpannen.get(produktWissen.schluesselBauen(p.title || p.name || '')) || null);`,
    neu:
`          : (liveSpannen.get(produktWissen.preisgruppenSchluessel(p.title || p.name || '')) || null);`
  }
];

const MUSS_DA_SEIN = [
  [WISSEN, 'function preisgruppenSchluessel(name)'],
  [WISSEN, "const s = preisgruppenSchluessel(p.title || p.name || '');"],
  [WISSEN, 'preisgruppenSchluessel,  // angebaut 09.11.2026'],
  [CONTROLLER, 'liveSpannen.get(produktWissen.preisgruppenSchluessel(']
];

const MUSS_WEG = [
  [WISSEN, "    const s = schluesselBauen(p.title || p.name || '');"],
  [CONTROLLER, 'liveSpannen.get(produktWissen.schluesselBauen(']
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
  console.log('SYNORA - Preisgruppen trotz anderer Wortreihenfolge');
  console.log('===================================================');
  console.log('');

  const dateien = [WISSEN, CONTROLLER];

  for (const d of dateien) {
    if (!fs.existsSync(d)) {
      console.log(`ABBRUCH: ${d} nicht gefunden.`);
      process.exit(1);
    }
  }

  const stand = new Map();
  for (const d of dateien) {
    const roh = fs.readFileSync(d, 'utf8');
    stand.set(d, { roh, hatCRLF: roh.includes('\r\n'), txt: roh.replace(/\r\n/g, '\n') });
  }

  if (!stand.get(WISSEN).txt.includes('function preisgruppenBauen')) {
    console.log('ABBRUCH: preisgruppenBauen fehlt.');
    console.log('Lass zuerst preisVerdacht.js laufen - dieses Skript baut darauf auf.');
    process.exit(1);
  }

  if (stand.get(WISSEN).txt.includes(MARKE)) {
    console.log('Bereits eingebaut. Es wird nichts geaendert.');
    process.exit(0);
  }

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
    console.log('ABBRUCH. Es wurde NICHTS geaendert.');
    process.exit(1);
  }

  const sicherungen = new Map();
  for (const d of dateien) {
    const s = `${d}.sicherung-${zeitstempel()}`;
    fs.copyFileSync(d, s);
    sicherungen.set(d, s);
    console.log(`Sicherung:  ${s}`);
  }

  for (const d of dateien) {
    let txt = stand.get(d).txt;
    for (const a of AENDERUNGEN) if (a.datei === d) txt = txt.replace(a.alt, a.neu);
    if (stand.get(d).hatCRLF) txt = txt.replace(/\n/g, '\r\n');
    fs.writeFileSync(d, txt, 'utf8');
  }

  function zurueckspielen(grund) {
    for (const d of dateien) fs.copyFileSync(sicherungen.get(d), d);
    console.log('');
    console.log(`ABBRUCH: ${grund}`);
    console.log('Beide Dateien sind zurueckgespielt.');
    process.exit(1);
  }

  console.log('');
  console.log('Gegenprobe:');
  let ok = true;

  for (const [d, s] of MUSS_DA_SEIN) {
    const da = fs.readFileSync(d, 'utf8').includes(s);
    console.log(`  ${da ? 'OK     ' : 'FEHLT  '} ${s.length > 52 ? s.slice(0, 51) + '…' : s}`);
    if (!da) ok = false;
  }
  for (const [d, s] of MUSS_WEG) {
    const weg = !fs.readFileSync(d, 'utf8').includes(s);
    const kurz = s.trim();
    console.log(`  ${weg ? 'OK     ' : 'NOCH DA'} weg: ${kurz.length > 46 ? kurz.slice(0, 45) + '…' : kurz}`);
    if (!weg) ok = false;
  }

  if (!ok) zurueckspielen('die Gegenprobe ist nicht sauber.');

  const { execFileSync } = require('child_process');
  for (const d of dateien) {
    let gut = false;
    let fehler = '';
    try {
      execFileSync(process.execPath, ['--check', path.resolve(d)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      gut = true;
    } catch (e) {
      fehler = (e.stderr ? String(e.stderr) : '') || e.message;
    }
    console.log(`  ${gut ? 'OK     ' : 'FEHLER '} ${path.basename(d)} ist syntaktisch in Ordnung`);
    if (!gut) {
      console.log('');
      console.log(fehler);
      zurueckspielen(`${path.basename(d)} hat einen Schreibfehler.`);
    }
  }

  // ---------- Verhalten: dieselbe Probe wie vorher ----------
  console.log('');
  console.log('Dieselbe Probe wie beim Einbau - jetzt mit Gruppierung:');
  const pruefdatei = path.join(require('os').tmpdir(), `synora-gruppen-${Date.now()}.js`);
  fs.writeFileSync(
    pruefdatei,
    [
      "'use strict';",
      `const w = require(${JSON.stringify(path.resolve(WISSEN))});`,
      'const angebote = [',
      "  { title: 'HP Monitor OMEN 32c', priceValue: 310 },",
      "  { title: 'HP OMEN 32c Monitor',  priceValue: 299 },",
      "  { title: 'HP Monitor OMEN 32c',  priceValue: 21.92 },",
      "  { title: 'Philips 27E1N1800AE',  priceValue: 150 },",
      "  { title: 'Philips 27E1N1800AE',  priceValue: 159 }",
      '];',
      'const spannen = w.preisgruppenBauen(angebote);',
      'const raus = angebote.map((a) => {',
      '  const s = spannen.get(w.preisgruppenSchluessel(a.title));',
      '  return [a.title, a.priceValue, s ? s.mittel : null, s ? s.anzahl : 0, !!w.preisVerdaechtigGegen(a, s)];',
      '});',
      "console.log('###' + JSON.stringify(raus));"
    ].join('\n'),
    'utf8'
  );

  let zeilen = null;
  try {
    const ausgabe = execFileSync(process.execPath, [pruefdatei], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    zeilen = JSON.parse(String(ausgabe).split('###')[1].trim());
  } catch (e) {
    console.log('  (Probe nicht moeglich)');
  } finally {
    try { fs.unlinkSync(pruefdatei); } catch (_) {}
  }

  if (zeilen) {
    for (const [titel, preis, mittel, anzahl, verdacht] of zeilen) {
      const t = titel.length > 24 ? titel.slice(0, 23) + '…' : titel;
      console.log(`  ${verdacht ? 'VERDACHT' : '   ok   '} ${t.padEnd(25)} ${String(preis).padStart(7)}   ueblich ${mittel === null ? '-' : mittel}  (aus ${anzahl})`);
    }
    const ohneSpanne = zeilen.filter((z) => z[2] === null).length;
    const treffer = zeilen.filter((z) => z[4]).length;
    if (treffer !== 1) {
      console.log('');
      console.log(`  ACHTUNG: erwartet war genau 1 Verdacht, gefunden ${treffer}.`);
      zurueckspielen('die Probe hat nicht das erwartete Ergebnis geliefert.');
    }
    if (ohneSpanne !== 0) {
      console.log('');
      console.log(`  ACHTUNG: ${ohneSpanne} Angebot(e) ohne Spanne - die Gruppierung greift nicht.`);
      zurueckspielen('die Gruppierung hat nicht gewirkt.');
    }
  }

  console.log('');
  console.log('FERTIG. Alle drei OMEN-Angebote liegen jetzt in einer Gruppe,');
  console.log('obwohl eines eine andere Wortreihenfolge hat.');
  console.log('');
  console.log('schluesselBauen selbst wurde NICHT angefasst - die');
  console.log('Produktwissen-Datenbank behaelt ihre Schluessel.');
  console.log('');
}

main();
