// ============================================
// SYNORA - Absender reparieren
// ============================================
// GEFUNDEN am 03.11.2026 in Brevo: Als Absender war
// "Synora <synorach@gmail.com>" eingetragen, mit Warnzeichen bei
// DKIM und DMARC.
//
// Solche Mails kommen NIE an. Google verbietet per DMARC, dass
// Dritte in seinem Namen versenden - Brevo nimmt die Mail an, der
// Empfaenger wirft sie stillschweigend weg. Kein Fehler im Log,
// keine Bounce-Mail, einfach nichts. Genau das Verhalten, das seit
// Wochen zu sehen war.
//
// In benachrichtigung.js steht heute:
//
//   const MAIL_ABSENDER = process.env.MAIL_ABSENDER
//                       || 'SYNORA <hallo@synora.li>';
//
// Der Wert aus Railway wird also BLIND uebernommen. Steht dort eine
// Gmail-Adresse, versendet SYNORA als Gmail.
//
// Dieses Skript baut eine Pruefung ein: Alles, was nicht auf
// @synora.li endet, wird durch info@synora.li ersetzt - mit einer
// Warnung im Log, damit es nicht still passiert.
//
// Die Domain synora.li ist seit dem 03.11.2026 bei Brevo
// authentifiziert (Brevo-Code, DKIM 1, DKIM 2, DMARC - alle gruen),
// also darf jede Adresse darauf versenden.
//
// NEBENWIRKUNG, die du kennen musst: Der bisherige Standardwert war
// hallo@synora.li. Dieses Postfach gibt es nicht mehr - am
// 23.10.2026 wurde ueberall auf info@synora.li umgestellt. Auch
// deshalb ist die Aenderung richtig.
//
// ============================================
// WIE DAS SKRIPT ARBEITET
// ============================================
//   - Erst eine Sicherung, dann die Aenderung
//   - ALLES ODER NICHTS: Passt die Stelle nicht genau einmal,
//     wird NICHTS geaendert
//   - Zeilenenden bleiben, wie sie waren
//   - Zum Schluss eine Gegenprobe
//
// Aufruf im Ordner synora-backend-main:
//   node absenderReparieren.js
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const DATEINAME = 'benachrichtigung.js';

const ALT =
  `const MAIL_ABSENDER = process.env.MAIL_ABSENDER || 'SYNORA <hallo@synora.li>';`;

const NEU =
`// ============================================
// ABSENDER - GEPRUEFT, NICHT BLIND UEBERNOMMEN
// ============================================
// GEFUNDEN am 03.11.2026: In Brevo war als Absender eine
// @gmail.com-Adresse eingetragen. Solche Mails kommen NIE an.
// Google verbietet per DMARC, dass Dritte in seinem Namen
// versenden - Brevo nimmt die Mail an, der Empfaenger wirft sie
// stillschweigend weg. Kein Fehler, keine Bounce-Mail, nichts.
//
// Darum wird der Wert hier geprueft statt uebernommen. Alles, was
// nicht auf @synora.li endet, wird ersetzt. Die Domain ist seit
// dem 03.11.2026 bei Brevo authentifiziert (DKIM + DMARC), jede
// Adresse darauf darf versenden.
//
// Der frueherer Standardwert war hallo@synora.li - dieses Postfach
// gibt es seit dem 23.10.2026 nicht mehr.
const STANDARD_ABSENDER = 'SYNORA <info@synora.li>';

function absenderPruefen(roh) {
  const wert = String(roh || '').trim();
  if (!wert) return STANDARD_ABSENDER;

  // Adresse aus "Name <adresse>" holen, sonst den ganzen Wert
  const teile = wert.match(/^\\s*(.*?)\\s*<([^>]+)>\\s*$/);
  const adresse = (teile ? teile[2] : wert).trim().toLowerCase();

  if (adresse.endsWith('@synora.li')) return wert;

  console.warn(
    \`[mail] MAIL_ABSENDER "\${adresse}" liegt nicht auf synora.li und \` +
    \`ist ueber Brevo nicht zustellbar. Es wird \${STANDARD_ABSENDER} \` +
    \`verwendet. Bitte die Variable in Railway korrigieren.\`
  );
  return STANDARD_ABSENDER;
}

const MAIL_ABSENDER = absenderPruefen(process.env.MAIL_ABSENDER);`;

// Nach der Aenderung muss das in der Datei stehen
const MUSS_DA_SEIN = [
  'function absenderPruefen(roh)',
  "const STANDARD_ABSENDER = 'SYNORA <info@synora.li>';",
  'const MAIL_ABSENDER = absenderPruefen(process.env.MAIL_ABSENDER);'
];

// ... und das nicht mehr
const MUSS_WEG = [ALT];

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

function dateiSuchen(start) {
  const treffer = [];
  (function gehen(ordner) {
    let eintraege;
    try {
      eintraege = fs.readdirSync(ordner, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const e of eintraege) {
      const voll = path.join(ordner, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        gehen(voll);
      } else if (e.name === DATEINAME) {
        treffer.push(voll);
      }
    }
  })(start);
  return treffer;
}

function main() {
  console.log('');
  console.log('SYNORA - Absender reparieren');
  console.log('============================');
  console.log('');

  const treffer = dateiSuchen('.');

  if (treffer.length === 0) {
    console.log(`ABBRUCH: ${DATEINAME} nicht gefunden.`);
    console.log('Bist du im Ordner synora-backend-main?');
    process.exit(1);
  }
  if (treffer.length > 1) {
    console.log(`ABBRUCH: ${DATEINAME} mehrfach gefunden:`);
    for (const t of treffer) console.log('  ' + t);
    console.log('Es wurde NICHTS geaendert. Bitte melden.');
    process.exit(1);
  }

  const ZIEL = treffer[0];
  const roh = fs.readFileSync(ZIEL, 'utf8');
  const hatCRLF = roh.includes('\r\n');
  let txt = roh.replace(/\r\n/g, '\n');

  console.log(`Datei:        ${ZIEL}`);
  console.log(`Groesse:      ${roh.length} Zeichen`);
  console.log(`Zeilenenden:  ${hatCRLF ? 'CRLF (Windows)' : 'LF'}`);
  console.log('');

  // ---------- Schon repariert? ----------
  if (txt.includes('function absenderPruefen(roh)')) {
    console.log('Die Datei ist bereits repariert - die Pruefung steht drin.');
    console.log('Es wird nichts geaendert.');
    process.exit(0);
  }

  // ---------- ERST PRUEFEN, DANN AENDERN ----------
  const anzahl = zaehlen(txt, ALT);
  console.log('Pruefung:');
  if (anzahl === 1) {
    console.log('  OK      Die Absender-Zeile steht genau einmal in der Datei');
  } else {
    console.log(`  FEHLER  Die Absender-Zeile wurde ${anzahl} mal gefunden, erwartet: 1`);
    console.log('');
    console.log('ABBRUCH. Es wurde NICHTS geaendert.');
    console.log('Gesucht wurde genau diese Zeile:');
    console.log('  ' + ALT);
    process.exit(1);
  }
  console.log('');

  // ---------- Sicherung ----------
  const sicherung = `${ZIEL}.sicherung-${zeitstempel()}`;
  fs.copyFileSync(ZIEL, sicherung);
  console.log(`Sicherung:    ${sicherung}`);

  // ---------- Aendern ----------
  txt = txt.replace(ALT, NEU);
  if (hatCRLF) txt = txt.replace(/\n/g, '\r\n');
  fs.writeFileSync(ZIEL, txt, 'utf8');

  // ---------- Gegenprobe ----------
  const neu = fs.readFileSync(ZIEL, 'utf8');
  console.log('');
  console.log('Gegenprobe:');

  let ok = true;
  for (const s of MUSS_DA_SEIN) {
    const da = neu.includes(s);
    console.log(`  ${da ? 'OK     ' : 'FEHLT  '} ${s.slice(0, 60)}`);
    if (!da) ok = false;
  }
  for (const s of MUSS_WEG) {
    const weg = !neu.includes(s);
    console.log(`  ${weg ? 'OK     ' : 'NOCH DA'} alte Zeile ist verschwunden`);
    if (!weg) ok = false;
  }

  const auf = zaehlen(neu, '{');
  const zu = zaehlen(neu, '}');
  console.log(`  ${auf === zu ? 'OK     ' : 'ACHTUNG'} geschweifte Klammern: ${auf} auf, ${zu} zu`);
  if (auf !== zu) ok = false;

  console.log('');
  if (ok) {
    console.log('FERTIG. Der Absender wird jetzt geprueft.');
    console.log('');
    console.log('Naechster Schritt:  node scripts\\testMail.js');
  } else {
    console.log('ACHTUNG: Die Gegenprobe ist nicht sauber.');
    console.log(`Die alte Fassung liegt hier: ${sicherung}`);
    process.exit(1);
  }
  console.log('');
}

main();
