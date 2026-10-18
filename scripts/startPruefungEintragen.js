// ============================================
// SYNORA - traegt die Startpruefung in server.js ein
// ============================================
// WARUM ES DIESES SKRIPT GIBT
//
// Die Pruefung gehoert in eine Funktion, die es in deiner
// server.js schon gibt: pruefeUmgebung(). Die prueft heute
// JWT_SECRET, die Datenbank und die vier API-Schluessel.
//
// Ich koennte dir server.js komplett neu schreiben. Mache ich
// aber nicht: meine Kopie ist vom 3. Oktober und kennt die
// Zeilen fuer /api/einstellungen und /api noch nicht, die du
// inzwischen drin hast. Ich wuerde dir also etwas wegnehmen,
// was gerade erst funktioniert.
//
// Darum dieses Skript. Es faesst nur die eine Stelle an, legt
// vorher eine Sicherung an und prueft danach, ob die Datei noch
// gueltiges JavaScript ist. Ist sie es nicht, holt es die
// Sicherung automatisch zurueck.
//
// ============================================
// SO BENUTZT DU ES
// ============================================
//   node scripts/startPruefungEintragen.js
//
// Zweimal laufen lassen ist harmlos - beim zweiten Mal sagt es
// nur, dass schon alles drin ist.
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ZIEL = path.join(__dirname, '..', 'src', 'server.js');

// Woran ich erkenne, dass der Block schon drin ist.
const MARKE = 'PRODUKTION: ADRESSEN UND SCHALTER PRUEFEN';

// Die Zeile, VOR die der Block kommt. Sie steht am Ende von
// pruefeUmgebung(), direkt bevor die Warnungen ausgegeben und
// die Fehler ausgewertet werden - also genau dort, wo meine
// Ergaenzungen noch in beide Listen schreiben koennen.
const ANKER = 'warnungen.forEach';

const BLOCK = `  // ============================================
  // PRODUKTION: ADRESSEN UND SCHALTER PRUEFEN
  // ============================================
  // EINGEBAUT AM 10.10.2026, nach einem echten Fund.
  //
  // API_BASE_URL fehlte in der .env. preisAlarmService.js und
  // chatController.js fallen dann auf
  //     http://localhost:5000
  // zurueck. Auf dem eigenen Rechner faellt das nicht auf, weil
  // dort wirklich ein Server auf 5000 laeuft. Beim Empfaenger
  // einer Alarmmail zeigt der Link auf SEINEN Rechner und
  // fuehrt ins Leere: keine Provision, kein gezaehlter Klick.
  // Und es beschwert sich niemand, weil niemand versteht, was
  // passiert ist.
  //
  // Inzwischen steht in der lokalen .env
  //     API_BASE_URL=http://localhost:5000
  // Lokal ist das richtig. Wird die Datei aber als Ganzes nach
  // Railway uebertragen - der uebliche Weg, dort Variablen zu
  // fuellen - steht der Satz oben weiter drin und ist dann
  // falsch. Genau diesen Fall faengt dieser Block ab.
  //
  // WARUM ABBRECHEN UND NICHT NUR WARNEN
  // Ein Server, der nicht startet, faellt in zwei Minuten auf
  // und ist in dreissig Sekunden behoben: Variable setzen, neu
  // deployen. Ein Server, der laeuft und stillschweigend
  // unbrauchbare Links verschickt, faellt wochenlang nicht auf.
  if (UMGEBUNG === 'production') {
    const LOKAL = /(localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|\\[::1\\])/i;
    const AUS = (w) => !w || w === '0' || w === 'false' || w === 'nein';

    const basis = process.env.API_BASE_URL;
    if (!basis) {
      fehler.push('API_BASE_URL fehlt. Setze API_BASE_URL=https://api.synora.li');
    } else if (LOKAL.test(basis)) {
      fehler.push(
        \`API_BASE_URL zeigt auf diesen Rechner ("\${basis}"). Jeder Link in \` +
        'den Alarmmails und jeder "Zum Shop"-Knopf waere unbrauchbar. ' +
        'Setze API_BASE_URL=https://api.synora.li'
      );
    } else {
      if (/^http:\\/\\//i.test(basis)) {
        warnungen.push(\`API_BASE_URL ohne https: \${basis}\`);
      }
      if (basis.endsWith('/')) {
        warnungen.push('API_BASE_URL endet mit "/" - die Links bekommen davon einen doppelten Schraegstrich');
      }
    }

    // ABSPIELEN liefert aufgezeichnete SerpAPI-Antworten. In
    // Produktion waeren das erfundene Preise auf der Seite -
    // der eine Fehler, den SYNORA sich nicht erlauben darf.
    if (!AUS(process.env.ABSPIELEN)) {
      fehler.push(
        'ABSPIELEN ist eingeschaltet. Die Preise kaemen aus einer Aufzeichnung ' +
        'statt von SerpAPI. In Produktion nicht erlaubt - Variable entfernen.'
      );
    }

    const db = process.env.MONGODB_URI || process.env.MONGO_URI || '';
    if (db && LOKAL.test(db)) {
      fehler.push('MONGODB_URI zeigt auf diesen Rechner - dort gibt es in Produktion keine Datenbank');
    }

    if (process.env.TEST_TOKEN) {
      warnungen.push('TEST_TOKEN ist in Produktion gesetzt - vor dem Start entfernen');
    }

    // Derselbe Fehler kann in Variablen stecken, die ich nicht
    // kenne. ALLOWED_ORIGINS ist ausgenommen: dort gehoert
    // localhost legitim hinein, fuer die Entwicklung.
    const EGAL = new Set(['ALLOWED_ORIGINS', 'API_BASE_URL', 'MONGODB_URI', 'MONGO_URI']);
    for (const name of Object.keys(process.env)) {
      if (EGAL.has(name)) continue;
      if (name.startsWith('npm_') || name.startsWith('RAILWAY_')) continue;
      const wert = process.env[name];
      if (typeof wert === 'string' && LOKAL.test(wert)) {
        warnungen.push(\`\${name} enthaelt eine lokale Adresse: \${wert}\`);
      }
    }
  } else if (!process.env.API_BASE_URL) {
    warnungen.push('API_BASE_URL fehlt - Links in Alarmmails zeigen vorerst auf http://localhost:5000');
  }

`;

function raus(text, code) {
  console.log(text);
  process.exit(code);
}

// ---------- 1. Da? ----------
if (!fs.existsSync(ZIEL)) {
  raus(
    '\nsrc/server.js nicht gefunden.\n' +
    'Bitte aus dem Backend-Ordner starten:\n' +
    '  node scripts/startPruefungEintragen.js\n', 1
  );
}

const vorher = fs.readFileSync(ZIEL, 'utf8');

// ---------- 2. Schon drin? ----------
if (vorher.includes(MARKE)) {
  raus('\nDie Startpruefung ist schon eingetragen. Nichts zu tun.\n', 0);
}

// ---------- 3. Passt die Datei zu dem, was ich erwarte? ----------
const zeilen = vorher.split('\n');
const treffer = [];
zeilen.forEach((z, i) => { if (z.includes(ANKER)) treffer.push(i); });

if (treffer.length !== 1) {
  raus(
    '\nIch finde die Stelle nicht eindeutig.\n' +
    `  Gesucht: eine Zeile mit "${ANKER}"\n` +
    `  Gefunden: ${treffer.length}\n\n` +
    'Deine server.js sieht anders aus als meine Kopie. Ich rate hier\n' +
    'nicht - schick mir src/server.js, dann schreibe ich sie dir\n' +
    'komplett und richtig.\n', 1
  );
}

if (!/function pruefeUmgebung\s*\(/.test(vorher)) {
  raus(
    '\nDie Funktion pruefeUmgebung() fehlt in deiner server.js.\n' +
    'Schick mir die Datei, dann baue ich es passend ein.\n', 1
  );
}

// ---------- 4. Sicherung ZUERST ----------
const stempel = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const sicherung = `${ZIEL}.vorher-${stempel}`;
fs.writeFileSync(sicherung, vorher, 'utf8');
console.log('\nSicherung angelegt:');
console.log('  ' + path.basename(sicherung));

// ---------- 5. Einsetzen ----------
const stelle = treffer[0];
const neu = [...zeilen.slice(0, stelle), ...BLOCK.split('\n'), ...zeilen.slice(stelle)].join('\n');
fs.writeFileSync(ZIEL, neu, 'utf8');

// ---------- 6. Ist es noch gueltiges JavaScript? ----------
// Ohne diese Pruefung wuerde ein Tippfehler von mir deinen
// Server beim naechsten Start gar nicht mehr hochkommen lassen.
try {
  execFileSync(process.execPath, ['--check', ZIEL], { stdio: 'pipe' });
} catch (e) {
  fs.writeFileSync(ZIEL, vorher, 'utf8');
  raus(
    '\nFEHLER: Die Datei waere danach kaputt gewesen.\n' +
    '  ' + String(e.stderr || e.message).split('\n').slice(0, 3).join('\n  ') + '\n\n' +
    'Ich habe deine alte server.js wiederhergestellt. Es hat sich\n' +
    'nichts geaendert. Schick mir src/server.js.\n', 1
  );
}

// ---------- 7. Zeigen, was jetzt dort steht ----------
console.log('Eingetragen in pruefeUmgebung(), ab Zeile ' + (stelle + 1) + '.');
console.log('Die Datei ist noch gueltiges JavaScript (node --check).');

const jetzt = fs.readFileSync(ZIEL, 'utf8').split('\n');
console.log('\n' + '-'.repeat(58));
for (let i = stelle + 20; i < stelle + 30 && i < jetzt.length; i++) {
  console.log(String(i + 1).padStart(4) + ' | ' + jetzt[i]);
}
console.log('-'.repeat(58));

console.log(
  '\nAb jetzt startet das Backend in Produktion nicht mehr, wenn\n' +
  'API_BASE_URL fehlt oder auf localhost zeigt - und auch nicht,\n' +
  'wenn ABSPIELEN noch an ist.\n\n' +
  'Lokal aendert sich nichts: der Block laeuft nur bei\n' +
  'NODE_ENV=production.\n'
);