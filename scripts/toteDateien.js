// ============================================
// SYNORA - tote Dateien finden
// ============================================
// Sagt dir, welche Dateien von NIEMANDEM eingebunden werden.
//
// Nicht geraten, sondern nachgerechnet: Das Skript geht von den
// Einstiegspunkten aus (src/server.js und jedes Skript in
// scripts/) und folgt jedem require. Was dabei nie erreicht wird,
// ist tot.
//
// Der Unterschied zu "kommt der Name irgendwo vor" ist wichtig:
// Eine Datei, die nur von einer anderen toten Datei eingebunden
// wird, ist selbst auch tot. Eine blosse Textsuche wuerde sie
// faelschlich als lebendig melden.
//
// WARUM DAS VOR DEM CODE-FREEZE ZAEHLT
// Doppelte Dateien sind kein Sicherheitsproblem. Aber du aenderst
// irgendwann die falsche und suchst eine Stunde, warum sich nichts
// tut. Am 03.10.2026 ist genau das passiert - mit einem Skript,
// das noch in der alten Fassung lief.
//
// Aufruf:
//   node scripts/toteDateien.js
//   node scripts/toteDateien.js --liste    nur die Pfade, ohne Text
//
// Loescht nichts. Zeigt nur.
// ============================================
'use strict';

const fs = require('fs');
const path = require('path');

const WURZEL = path.resolve(__dirname, '..');
const NUR_LISTE = process.argv.includes('--liste');

// ============================================
// ALLE DATEIEN SAMMELN
// ============================================
const UEBERSPRINGEN = new Set(['node_modules', '.git', '.vscode', 'recht', 'pruefungen']);

function alleDateien(ordner, gefunden = []) {
  let eintraege;
  try {
    eintraege = fs.readdirSync(ordner, { withFileTypes: true });
  } catch (_) {
    return gefunden;
  }

  for (const e of eintraege) {
    if (e.name.startsWith('.')) continue;
    const voll = path.join(ordner, e.name);
    if (e.isDirectory()) {
      if (UEBERSPRINGEN.has(e.name)) continue;
      alleDateien(voll, gefunden);
    } else if (e.name.endsWith('.js')) {
      gefunden.push(voll);
    }
  }
  return gefunden;
}

// ============================================
// REQUIRES AUS EINER DATEI LESEN
// ============================================
// Nur die eigenen Dateien zaehlen - Pakete aus node_modules
// interessieren hier nicht.
function requiresVon(datei) {
  let text;
  try {
    text = fs.readFileSync(datei, 'utf8');
  } catch (_) {
    return [];
  }

  // Zeilen, die mit // beginnen, zaehlen nicht: ein auskommentiertes
  // require haelt keine Datei am Leben.
  const ohneKommentare = text
    .split('\n')
    .filter((z) => !z.trim().startsWith('//'))
    .join('\n');

  const ziele = [];
  const ordnerGanz = [];

  const muster = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  let treffer;
  while ((treffer = muster.exec(ohneKommentare)) !== null) {
    const ziel = treffer[1];
    if (!ziel.startsWith('.')) continue;          // Paket, nicht unsere Datei

    // ============================================
    // DYNAMISCHE REQUIRES - behoben am 04.10.2026
    // ============================================
    // In server.js steht:
    //
    //     const route = require(`./routes/${name}`);
    //
    // Der Dateiname entsteht erst zur Laufzeit. Die erste Fassung
    // dieses Skripts hat "./routes/${name}" woertlich als Pfad
    // genommen, nichts gefunden - und damit JEDE Route als tot
    // gemeldet. Mit allem, was Routen einbinden: chat.js,
    // dashboard.js, go.js, suchLimit.js und ein Dutzend mehr.
    //
    // Ein Werkzeug, das zum Loeschen lebendiger Dateien raet, ist
    // gefaehrlicher als gar keins.
    //
    // Jetzt gilt: Steht ${ im Pfad, kann JEDE Datei im betroffenen
    // Ordner gemeint sein. Also zaehlen sie alle als erreichbar.
    // Lieber eine tote Datei uebersehen als eine lebendige
    // zum Loeschen vorschlagen.
    if (ziel.includes('${')) {
      const statisch = ziel.slice(0, ziel.indexOf('${'));
      const ordner = path.resolve(path.dirname(datei), statisch);
      ordnerGanz.push(ordner);
      continue;
    }

    ziele.push(path.resolve(path.dirname(datei), ziel));
  }

  return { ziele, ordnerGanz };
}

/** "./foo" kann foo.js, foo/index.js oder foo.json meinen */
function aufloesen(pfadOhneEndung, alle) {
  const kandidaten = [
    pfadOhneEndung,
    pfadOhneEndung + '.js',
    path.join(pfadOhneEndung, 'index.js')
  ];
  for (const k of kandidaten) {
    if (alle.has(k)) return k;
  }
  return null;
}

// ============================================
// VON DEN EINSTIEGEN AUS DURCHLAUFEN
// ============================================
function lauf() {
  const dateien = alleDateien(WURZEL);
  const alle = new Set(dateien);

  // Einstiegspunkte: der Server und jedes Skript. Skripte werden
  // von Hand aufgerufen, nicht eingebunden - sie sind von Natur aus
  // Wurzeln und nie "tot".
  const einstiege = [];
  const server = path.join(WURZEL, 'src', 'server.js');
  if (alle.has(server)) einstiege.push(server);

  for (const d of dateien) {
    if (path.dirname(d) === path.join(WURZEL, 'scripts')) einstiege.push(d);
    if (path.dirname(d) === path.join(WURZEL, 'scripts', 'data')) einstiege.push(d);
  }

  // Erreichbarkeit ausrechnen
  const erreicht = new Set();
  const offen = [...einstiege];
  const kaputteZiele = [];

  const dynamischeOrdner = new Set();

  while (offen.length) {
    const jetzt = offen.pop();
    if (erreicht.has(jetzt)) continue;
    erreicht.add(jetzt);

    const { ziele, ordnerGanz } = requiresVon(jetzt);

    // Dynamisches require: der ganze Ordner zaehlt als erreichbar
    for (const ordner of ordnerGanz) {
      dynamischeOrdner.add(path.relative(WURZEL, ordner));
      for (const d of dateien) {
        if (path.dirname(d) === ordner && !erreicht.has(d)) offen.push(d);
      }
    }

    for (const rohZiel of ziele) {
      const ziel = aufloesen(rohZiel, alle);
      if (!ziel) {
        // Relativ anzeigen, nicht als voller Systempfad - der ist
        // auf dem Bildschirm unlesbar und sagt nichts mehr.
        kaputteZiele.push({ von: jetzt, ziel: path.relative(path.dirname(jetzt), rohZiel) });
        continue;
      }
      if (!erreicht.has(ziel)) offen.push(ziel);
    }
  }

  const tot = dateien.filter((d) => !erreicht.has(d));

  // ---------- Nur die Pfade ----------
  if (NUR_LISTE) {
    tot.forEach((d) => console.log(path.relative(WURZEL, d)));
    return;
  }

  // ---------- Bericht ----------
  console.log('\n' + '='.repeat(64));
  console.log('  TOTE DATEIEN');
  console.log('='.repeat(64) + '\n');

  console.log(`  ${String(dateien.length).padStart(4)}  Dateien insgesamt`);
  console.log(`  ${String(einstiege.length).padStart(4)}  Einstiegspunkte (server.js + scripts/)`);
  console.log(`  ${String(erreicht.size).padStart(4)}  davon erreichbar`);
  console.log(`  ${String(tot.length).padStart(4)}  NIE eingebunden\n`);

  if (dynamischeOrdner.size) {
    console.log('  Dynamisch geladen, darum komplett als lebendig gezaehlt:');
    for (const o of [...dynamischeOrdner].sort()) console.log('      ' + o + path.sep);
    console.log('');
  }

  if (!tot.length) {
    console.log('  Jede Datei wird von irgendwo gebraucht. Nichts zu tun.\n');
  } else {
    // Nach Ordner gruppieren, das liest sich besser
    const nachOrdner = new Map();
    for (const d of tot) {
      const rel = path.relative(WURZEL, d);
      const ordner = path.dirname(rel);
      if (!nachOrdner.has(ordner)) nachOrdner.set(ordner, []);
      nachOrdner.get(ordner).push(path.basename(rel));
    }

    for (const [ordner, namen] of [...nachOrdner].sort()) {
      console.log('  ' + ordner + path.sep);
      for (const n of namen.sort()) {
        let groesse = '';
        try {
          const kb = fs.statSync(path.join(WURZEL, ordner, n)).size / 1024;
          groesse = kb.toFixed(1) + ' KB';
        } catch (_) { /* egal */ }
        console.log('      ' + n.padEnd(34) + groesse);
      }
      console.log('');
    }

    console.log('  ' + '-'.repeat(60));
    console.log('  Diese Dateien werden von keinem Einstiegspunkt aus erreicht.');
    console.log('  Sie koennen weg - aber PRUEF SIE VORHER EINZELN:');
    console.log('');
    console.log('    - Steht dort Code, den du noch brauchst?');
    console.log('    - Stehen dort API-Schluessel im Klartext?');
    console.log('      (dann VOR dem Loeschen notieren, welche - die');
    console.log('       muessen danach neu erzeugt werden)');
    console.log('');
    console.log('  Zum Sichern statt Loeschen:');
    console.log('      mkdir alt');
    console.log('      Move-Item <datei> alt\\');
    console.log('');
    console.log('  Laeuft danach "npm start" und der Pruefkatalog durch,');
    console.log('  war die Datei wirklich tot.');
  }

  // ---------- Kaputte requires ----------
  if (kaputteZiele.length) {
    console.log('\n' + '='.repeat(64));
    console.log('  REQUIRES INS LEERE');
    console.log('='.repeat(64) + '\n');
    console.log('  Diese Zeilen binden eine Datei ein, die es nicht gibt.');
    console.log('  Je nachdem, wie der Code damit umgeht, faellt das erst');
    console.log('  im Betrieb auf.\n');
    for (const k of kaputteZiele.slice(0, 20)) {
      console.log('  ' + path.relative(WURZEL, k.von));
      console.log('      sucht: ' + k.ziel);
    }
    if (kaputteZiele.length > 20) {
      console.log(`  ... und ${kaputteZiele.length - 20} weitere`);
    }
  }

  console.log('');
}

lauf();