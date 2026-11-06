// ============================================
// SYNORA - baut die Variablenliste fuer Railway
// ============================================
//   node scripts/railwayVariablen.js
//
// WAS ES TUT
// Liest deine .env, setzt die Produktionswerte richtig und legt
// die Datei .env.railway daneben. Deren Inhalt kommt in Railways
// Raw Editor.
//
// WAS ES NICHT TUT
// Es aendert deine .env nicht. Kein einziges Zeichen. Du kannst
// es zehnmal laufen lassen.
//
// WARUM NICHT EINFACH DIE .env KOPIEREN
// Weil vier Zeilen in Produktion anders lauten muessen und eine
// ganz verschwinden muss:
//
//   NODE_ENV          ->  production
//   API_BASE_URL      ->  https://api.synora.li
//   FRONTEND_URL      ->  https://synora.li
//   PRUEFKATALOG_URL  ->  https://api.synora.li
//   ABSPIELEN         ->  weg
//   AUFNEHMEN         ->  weg
//
// ABSPIELEN waere in Produktion der schlimmste Fall: Die Seite
// zeigte dann Preise aus einer Aufzeichnung vom letzten Monat.
// Echte Zahlen, die nicht mehr stimmen. Die Startpruefung in
// server.js laesst den Server damit gar nicht erst hoch - dieses
// Skript sorgt dafuer, dass es erst gar nicht so weit kommt.
//
// ANFUEHRUNGSZEICHEN - NACHGEBESSERT AM 18.10.2026
// Railways Raw Editor schreibt Werte selbst in doppelte
// Anfuehrungszeichen. Ohne sie koennte ein Wert mit Leerzeichen
// (MAIL_ABSENDER) oder mit einem # darin abgeschnitten werden -
// lautlos, ohne Fehlermeldung. Darum schreibt dieses Skript
// jetzt dasselbe Format wie Railway.
//
// GEHEIMNISSE
// Werte werden NIE auf den Bildschirm geschrieben. Nur Namen.
// Was in .env.railway landet, siehst du nur du.
// ============================================
'use strict';

const fs = require('fs');
const path = require('path');

const ORDNER = path.join(__dirname, '..');
const QUELLE = path.join(ORDNER, '.env');
const ZIEL = path.join(ORDNER, '.env.railway');

function raus(text, code) { console.log(text); process.exit(code); }

if (!fs.existsSync(QUELLE)) {
  raus('\n.env nicht gefunden in:\n  ' + ORDNER +
       '\n\nBitte aus dem Backend-Ordner starten:\n' +
       '  cd "C:\\Users\\KPavi\\OneDrive\\Desktop\\Projekt\\V2.0\\synora-backend-main"\n', 1);
}

// ---------- Lesen ----------
const roh = fs.readFileSync(QUELLE, 'utf8');
const zeilen = roh.split(/\r?\n/);

// Reihenfolge behalten, damit du die Liste wiedererkennst.
const namen = [];
const werte = new Map();
let doppelt = [];

const mitRaute = [];

// Ein Wert kann in der .env schon in Anfuehrungszeichen stehen.
// Die gehoeren zum Format, nicht zum Wert - sonst stuenden sie
// nachher doppelt da.
function schaelen(roh) {
  const w = roh.trim();
  if (w.length >= 2 && ((w[0] === '"' && w.endsWith('"')) || (w[0] === "'" && w.endsWith("'")))) {
    return w.slice(1, -1);
  }
  return w;
}

for (const zeile of zeilen) {
  const t = zeile.trim();
  if (!t || t.startsWith('#')) continue;
  const stelle = t.indexOf('=');
  if (stelle < 1) continue;                      // keine Zuweisung
  const name = t.slice(0, stelle).trim();
  const wert = schaelen(t.slice(stelle + 1));
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
  if (/\s#/.test(wert)) mitRaute.push(name);     // Kommentar hinter dem Wert?
  if (werte.has(name)) doppelt.push(name);
  else namen.push(name);
  werte.set(name, wert);                         // spaeterer Eintrag gewinnt, wie bei dotenv
}

const gelesen = namen.length;
if (gelesen === 0) raus('\nIn der .env steht kein einziger Eintrag. Das kann nicht stimmen.\n', 1);

// ---------- Produktionswerte ----------
const SETZEN = {
  NODE_ENV: 'production',
  API_BASE_URL: 'https://api.synora.li',
  FRONTEND_URL: 'https://synora.li',
  PRUEFKATALOG_URL: 'https://api.synora.li'
};
const WERFEN = ['ABSPIELEN', 'AUFNEHMEN'];

const bericht = { geaendert: [], angelegt: [], entfernt: [] };

for (const [name, neu] of Object.entries(SETZEN)) {
  const alt = werte.get(name);
  if (alt === undefined) {
    namen.push(name);
    werte.set(name, neu);
    bericht.angelegt.push(`${name}=${neu}`);
  } else if (alt !== neu) {
    werte.set(name, neu);
    bericht.geaendert.push(`${name}:  ${alt}  ->  ${neu}`);
  }
}

for (const name of WERFEN) {
  if (werte.has(name)) {
    werte.delete(name);
    const i = namen.indexOf(name);
    if (i !== -1) namen.splice(i, 1);
    bericht.entfernt.push(name);
  }
}

// ---------- Schreiben, im Format von Railway ----------
// Innen liegende " und \ muessen maskiert werden, sonst endet
// der Wert zu frueh. Welche Namen das betrifft, steht unten im
// Bericht - der Wert selbst natuerlich nicht.
const maskiert = [];
function inAnfuehrung(name, wert) {
  const w = String(wert);
  if (/["\\]/.test(w)) maskiert.push(name);
  return '"' + w.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

const ausgabe = namen.map((n) => `${n}=${inAnfuehrung(n, werte.get(n))}`).join('\n') + '\n';
fs.writeFileSync(ZIEL, ausgabe, 'utf8');

// ============================================
// BERICHT - Namen, niemals Werte
// ============================================
console.log('\n' + '='.repeat(60));
console.log('Gelesen aus .env:        ' + gelesen + ' Eintraege');
console.log('Geschrieben nach .env.railway: ' + namen.length + ' Eintraege');
console.log('='.repeat(60));

if (doppelt.length) {
  console.log('\nDoppelt in der .env (der letzte gilt, wie bei dotenv):');
  for (const n of [...new Set(doppelt)]) console.log('  ' + n);
}

if (bericht.geaendert.length) {
  console.log('\nGeaendert fuer Produktion:');
  for (const z of bericht.geaendert) console.log('  ' + z);
}
if (bericht.angelegt.length) {
  console.log('\nNeu angelegt:');
  for (const z of bericht.angelegt) console.log('  ' + z);
}
if (bericht.entfernt.length) {
  console.log('\nEntfernt (gehoert nicht in Produktion):');
  for (const z of bericht.entfernt) console.log('  ' + z);
}

// ---------- Gegenprobe 1: steht irgendwo noch dieser Rechner ----------
const LOKAL = /(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i;
const verdaechtig = namen.filter((n) => LOKAL.test(werte.get(n) || ''));
if (verdaechtig.length) {
  console.log('\nACHTUNG - diese Eintraege zeigen noch auf deinen Rechner:');
  for (const n of verdaechtig) console.log('  ' + n);
  console.log('  Auf Railway gibt es diesen Rechner nicht. Melde dich,');
  console.log('  bevor du das einfuegst.');
}

// ---------- Gegenprobe 2: ist alles da, was der Server braucht ----------
const PFLICHT = ['MONGODB_URI', 'JWT_SECRET', 'SERPAPI_KEY', 'API_BASE_URL', 'NODE_ENV'];
const fehlend = PFLICHT.filter((n) => !werte.has(n) || !String(werte.get(n)).trim());
if (fehlend.length) {
  console.log('\nFEHLT - ohne das startet der Server nicht:');
  for (const n of fehlend) console.log('  ' + n);
}

// ---------- Gegenprobe 3: leere Werte ----------
const leer = namen.filter((n) => !String(werte.get(n)).trim());
if (leer.length) {
  console.log('\nOhne Wert (meist harmlos, aber schau kurz hin):');
  for (const n of leer) console.log('  ' + n);
}

// ---------- Gegenprobe 4: Sonderzeichen ----------
if (maskiert.length) {
  console.log('\nEnthalten " oder \\ - sind maskiert worden, bitte nach dem');
  console.log('Einfuegen in Railway kurz nachschauen:');
  for (const n of maskiert) console.log('  ' + n);
}
if (mitRaute.length) {
  console.log('\nHinter dem Wert steht ein # - steht das als Kommentar da,');
  console.log('gehoert es nicht in den Wert:');
  for (const n of [...new Set(mitRaute)]) console.log('  ' + n);
}

console.log('\n' + '-'.repeat(60));
if (verdaechtig.length || fehlend.length || mitRaute.length) {
  console.log('Noch NICHT einfuegen. Erst die Punkte oben klaeren.');
} else {
  console.log('Sieht sauber aus.');
  console.log('\nNaechster Befehl - legt den Inhalt in die Zwischenablage:');
  console.log('  Get-Content .env.railway -Raw | Set-Clipboard');
}
console.log('-'.repeat(60) + '\n');
