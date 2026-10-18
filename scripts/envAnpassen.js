// ============================================
// SYNORA - passt drei Zeilen in der .env an
// ============================================
//   node scripts/envAnpassen.js
//
// WAS SICH AENDERT
//   SUCHEN_PREMIUM   ->  65     (15 pro Woche, in Monate gerechnet)
//   SUCHEN_PLUS      ->  aus    (nur falls die Zeile fehlt)
//   PREMIUM_VERKAUF  ->  false  (nur falls die Zeile fehlt)
//
// WAS SICH NICHT AENDERT
//   Alles andere. MONGODB_URI, JWT_SECRET, die API-Schluessel,
//   SMTP_PASS - nichts davon wird angefasst.
//
// WARUM EIN SKRIPT UND KEINE FERTIGE DATEI
// Weil am 12.10. schon einmal API_BASE_URL aus der .env
// verschwunden ist, als sie von Hand bearbeitet wurde. Ein
// Skript, das nur drei Zeilen kennt, kann nichts anderes
// verlieren.
//
// Vorher wird eine Sicherung angelegt. Zweimal laufen lassen ist
// harmlos.
// ============================================
'use strict';

const fs = require('fs');
const path = require('path');

const ZIEL = path.join(__dirname, '..', '.env');

if (!fs.existsSync(ZIEL)) {
  console.log('\n.env nicht gefunden. Bitte aus dem Backend-Ordner starten.\n');
  process.exit(1);
}

const vorher = fs.readFileSync(ZIEL, 'utf8');
const NL = vorher.includes('\r\n') ? '\r\n' : '\n';
const zeilen = vorher.split(/\r?\n/);

const protokoll = [];

// ---------- 1. SUCHEN_PREMIUM auf 65 ----------
let gefundenPremium = false;
for (let i = 0; i < zeilen.length; i++) {
  const m = zeilen[i].match(/^(\s*SUCHEN_PREMIUM\s*=\s*)(.*)$/);
  if (!m) continue;
  gefundenPremium = true;
  const alt = m[2].trim();
  if (alt === '65') {
    protokoll.push('SUCHEN_PREMIUM steht schon auf 65');
  } else {
    zeilen[i] = m[1] + '65';
    protokoll.push(`SUCHEN_PREMIUM: ${alt} -> 65`);
  }
  break;
}
if (!gefundenPremium) {
  zeilen.push('SUCHEN_PREMIUM=65');
  protokoll.push('SUCHEN_PREMIUM=65 neu angelegt');
}

// ---------- 2. und 3. nur anlegen, wenn sie fehlen ----------
function ergaenze(name, wert, begruendung) {
  const da = zeilen.some((z) => new RegExp('^\\s*' + name + '\\s*=').test(z));
  if (da) {
    protokoll.push(`${name} war schon da - unveraendert gelassen`);
    return;
  }
  zeilen.push('');
  zeilen.push('# ' + begruendung);
  zeilen.push(`${name}=${wert}`);
  protokoll.push(`${name}=${wert} neu angelegt`);
}

ergaenze('SUCHEN_PLUS', 'aus',
  'Premium Plus: unbegrenzt. ACHTUNG - hier 0 einzutragen hiesse NULL Suchen.');

ergaenze('PREMIUM_VERKAUF', 'false',
  'false = kein Kaufknopf auf der Preisseite. War bisher nur die Vorgabe aus stufen.js.');

const neu = zeilen.join(NL);

if (neu === vorher) {
  console.log('\nNichts zu aendern - alles steht schon richtig.\n');
  process.exit(0);
}

// ---------- Sicherung ZUERST ----------
const stempel = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const sicherung = `${ZIEL}.vorher-${stempel}`;
fs.writeFileSync(sicherung, vorher, 'utf8');
fs.writeFileSync(ZIEL, neu, 'utf8');

console.log('\nSicherung angelegt:\n  ' + path.basename(sicherung) + '\n');
console.log('Geaendert:');
for (const p of protokoll) console.log('  ' + p);

// ---------- Gegenprobe: ist sonst nichts verschwunden? ----------
const namenVon = (text) => new Set(
  text.split(/\r?\n/)
    .map((z) => (z.match(/^\s*([A-Z0-9_]+)\s*=/) || [])[1])
    .filter(Boolean)
);

const alt = namenVon(vorher);
const jetzt = namenVon(neu);
const verloren = [...alt].filter((n) => !jetzt.has(n));

console.log('\nEintraege vorher: ' + alt.size + '   nachher: ' + jetzt.size);
if (verloren.length) {
  fs.writeFileSync(ZIEL, vorher, 'utf8');
  console.log('\nFEHLER: Diese Eintraege waeren verschwunden: ' + verloren.join(', '));
  console.log('Die alte .env ist wiederhergestellt. Es hat sich nichts geaendert.\n');
  process.exit(1);
}
console.log('Kein Eintrag verloren.');

console.log('\nJetzt:  npm start');
console.log('Im Log muss stehen:  premium 65/monat\n');