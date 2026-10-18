// ============================================
// SYNORA - haengt den Partnerlink in go.js ein
// ============================================
//   node scripts/partnerlinkEintragen.js
//
// Aendert zwei Stellen in src/routes/go.js:
//
//   1. Oben: partnerlink laden (defensiv, wie Kostenbremse
//      und Blacklist in derselben Datei)
//   2. Unten: die Weiterleitung durch den Partnerlink schicken
//
// Legt vorher eine Sicherung an und prueft danach mit
// node --check, ob die Datei noch gueltig ist. Ist sie es nicht,
// wird die Sicherung automatisch zurueckgespielt.
//
// Zweimal laufen lassen ist harmlos.
// ============================================
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ZIEL = path.join(__dirname, '..', 'src', 'routes', 'go.js');

// Einmal lesen, bevor die Zeilenenden bestimmt werden.
let _roh = null;
function vorherRoh() {
  if (_roh === null) _roh = fs.existsSync(ZIEL) ? fs.readFileSync(ZIEL, 'utf8') : '';
  return _roh;
}
const MARKE = 'PARTNERLINK - NEU am 12.10.2026';

const ANKER_OBEN = "const FRONTEND = process.env.FRONTEND_URL || 'https://synora.li';";

// ============================================
// ZEILENENDEN - DER FEHLER VOM 12.10.2026
// ============================================
// Die erste Fassung suchte nach einem zweizeiligen Text mit \n
// dazwischen. Auf Windows stehen in Dateien aber \r\n. Die
// einzeilige Stelle wurde gefunden, die zweizeilige nicht - und
// das Skript brach ab (richtigerweise, ohne etwas zu aendern).
//
// Jetzt wird erst nachgesehen, womit DIESE Datei arbeitet, und
// alles Eingefuegte bekommt dieselben Zeilenenden. Sonst haette
// die Datei danach beide Sorten gemischt.
const NL = vorherRoh().includes('\r\n') ? '\r\n' : '\n';

function ankerUnten() {
  return '      // Hier kommt spaeter der AWIN-Link statt der direkten URL' + NL +
         '      return res.redirect(302, gewaehlt.store.link);';
}

const BLOCK_OBEN = `// ============================================
// PARTNERLINK - NEU am 12.10.2026
// ============================================
// Bis heute ging die Weiterleitung direkt zum Shop. Der Klick
// wurde gezaehlt, der Kauf fand statt - und SYNORA bekam nichts,
// weil im Link keine Partnerkennung stand.
//
// Geladen wird wie die Kostenbremse weiter oben: faellt die
// Datei aus, laeuft SYNORA weiter und leitet unveraendert
// weiter. Ein Besucher muss beim Shop ankommen, auch wenn an der
// Provision etwas nicht stimmt.
let partnerLink = (url) => url;
try {
  partnerLink = require('../services/partnerlink');
} catch (e) {
  console.warn('[go] partnerlink nicht geladen - Links gehen ohne Provision raus:', e.message);
}

`;

const BLOCK_UNTEN =
  '      // ============================================\n' +
  '      // HIER WIRD AUS DEM KLICK GELD - ODER AUCH NICHT\n' +
  '      // ============================================\n' +
  '      // partnerLink() gibt entweder einen Trackinglink des\n' +
  '      // Netzwerks zurueck oder die unveraenderte Shop-URL.\n' +
  '      // Welcher Fall eintritt, haengt allein an der Tabelle in\n' +
  '      // src/services/partnerlink.js - hier ist nichts mehr zu\n' +
  '      // aendern, wenn ein neues Programm dazukommt.\n' +
  '      const ziel = partnerLink(gewaehlt.store.link, gewaehlt.store.name);\n' +
  '      return res.redirect(302, ziel);';

function raus(text, code) { console.log(text); process.exit(code); }

if (!fs.existsSync(ZIEL)) {
  raus('\nsrc/routes/go.js nicht gefunden.\nBitte aus dem Backend-Ordner starten.\n', 1);
}

const vorher = vorherRoh();

if (vorher.includes(MARKE)) {
  raus('\nDer Partnerlink ist schon eingetragen. Nichts zu tun.\n', 0);
}

// ---------- Beide Stellen muessen eindeutig sein ----------
const n1 = vorher.split(ANKER_OBEN).length - 1;
const n2 = vorher.split(ankerUnten()).length - 1;

if (n1 !== 1 || n2 !== 1) {
  raus(
    '\nIch finde die Stellen nicht eindeutig.\n' +
    `  Stelle 1 (FRONTEND-Zeile):     ${n1}x gefunden, erwartet 1\n` +
    `  Stelle 2 (Weiterleitung):      ${n2}x gefunden, erwartet 1\n\n` +
    'Deine go.js sieht anders aus als die, die ich gesehen habe.\n' +
    'Schick sie mir, dann mache ich es von Hand.\n', 1
  );
}

// ---------- Sicherung ZUERST ----------
const stempel = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const sicherung = `${ZIEL}.vorher-${stempel}`;
fs.writeFileSync(sicherung, vorher, 'utf8');
console.log('\nSicherung angelegt:\n  ' + path.basename(sicherung));

// ---------- Einsetzen ----------
let neu = vorher.replace(ANKER_OBEN, BLOCK_OBEN.split('\n').join(NL) + ANKER_OBEN);
neu = neu.replace(ankerUnten(), BLOCK_UNTEN.split('\n').join(NL));
fs.writeFileSync(ZIEL, neu, 'utf8');

// ---------- Noch gueltiges JavaScript? ----------
try {
  execFileSync(process.execPath, ['--check', ZIEL], { stdio: 'pipe' });
} catch (e) {
  fs.writeFileSync(ZIEL, vorher, 'utf8');
  raus(
    '\nFEHLER: Die Datei waere danach kaputt gewesen.\n  ' +
    String(e.stderr || e.message).split('\n').slice(0, 3).join('\n  ') +
    '\n\nDeine alte go.js ist wiederhergestellt. Es hat sich nichts geaendert.\n', 1
  );
}

console.log('Beide Stellen geaendert. Datei ist gueltiges JavaScript.');

const zeilen = neu.split(/\r?\n/);
const treffer = zeilen.findIndex((z) => z.includes('const ziel = partnerLink('));
console.log('\n' + '-'.repeat(58));
for (let i = Math.max(0, treffer - 2); i <= treffer + 1 && i < zeilen.length; i++) {
  console.log(String(i + 1).padStart(4) + ' | ' + zeilen[i]);
}
console.log('-'.repeat(58));

console.log(
  '\nAb jetzt laeuft jeder "Zum Shop"-Klick ueber partnerLink().\n' +
  'Solange die Tabelle in src/services/partnerlink.js leer ist,\n' +
  'aendert sich fuer den Besucher nichts - er landet wie bisher\n' +
  'direkt beim Shop.\n\n' +
  'Im Serverlog siehst du jetzt bei jedem Klick eine Zeile wie\n' +
  '  [partnerlink] ohne Provision: digitec.ch\n' +
  'Das ist deine Liste, bei welchem Programm sich eine Bewerbung\n' +
  'am meisten lohnt.\n'
);