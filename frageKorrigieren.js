// ============================================
// SYNORA - Verlauf: die richtige Frage anzeigen
// ============================================
// GEFUNDEN am 08.11.2026, direkt nach dem Einbau des Verlaufs.
// In der Seitenleiste stand:
//
//   Für die Arbeit              08.11.
//   Ist mir egal - zeig mi...   08.11.
//   Gaming                      07.11.
//   Büroarbeit                  07.11.
//
// Das sind nicht die Fragen, das sind die Knoepfe, die bei der
// Rueckfrage gedrueckt wurden.
//
// Im Protokoll stehen zwei Felder:
//
//   anfrage.roh           "Fuer die Arbeit"            <- letzte Nachricht
//   anfrage.vollstaendig  "monitor (Fuer die Arbeit)"  <- die ganze Frage
//
// Der Handler nahm "roh" zuerst. Falsch herum.
//
// Richtig: vollstaendig, dann begriff, dann roh.
//   - vollstaendig hat die ganze Frage inklusive Rueckfrage-Antwort
//   - begriff ist der reine Suchbegriff, falls vollstaendig fehlt
//   - roh ist der letzte Ausweg
//
// Bei einer Suche OHNE Rueckfrage sind roh und vollstaendig gleich,
// es aendert sich dort also nichts.
//
// Aufruf im Ordner synora-backend-main:
//   node frageKorrigieren.js
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const ZIEL = path.join('src', 'routes', 'chat.js');

const ALT =
`      frage: (e.anfrage && (e.anfrage.roh || e.anfrage.vollstaendig)) || '',`;

const NEU =
`      // vollstaendig zuerst: bei einer Rueckfrage steht in "roh" nur
      // die Antwort auf den Knopf ("Fuer die Arbeit"), in
      // "vollstaendig" die ganze Frage ("monitor (Fuer die Arbeit)").
      frage: (e.anfrage && (e.anfrage.vollstaendig || e.anfrage.begriff || e.anfrage.roh)) || '',`;

const MUSS_DA_SEIN = ['e.anfrage.vollstaendig || e.anfrage.begriff || e.anfrage.roh'];
const MUSS_WEG = ["e.anfrage.roh || e.anfrage.vollstaendig"];

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
  console.log('SYNORA - Verlauf: die richtige Frage anzeigen');
  console.log('=============================================');
  console.log('');

  if (!fs.existsSync(ZIEL)) {
    console.log(`ABBRUCH: ${ZIEL} nicht gefunden.`);
    console.log('Bist du im Ordner synora-backend-main?');
    process.exit(1);
  }

  const roh = fs.readFileSync(ZIEL, 'utf8');
  const hatCRLF = roh.includes('\r\n');
  let txt = roh.replace(/\r\n/g, '\n');

  console.log(`Datei:        ${ZIEL}`);
  console.log(`Zeilenenden:  ${hatCRLF ? 'CRLF (Windows)' : 'LF'}`);
  console.log('');

  if (txt.includes('e.anfrage.vollstaendig || e.anfrage.begriff')) {
    console.log('Bereits korrigiert. Es wird nichts geaendert.');
    process.exit(0);
  }

  const n = zaehlen(txt, ALT);
  console.log('Pruefung:');
  if (n === 1) {
    console.log('  OK      Die Zeile steht genau einmal in der Datei');
  } else {
    console.log(`  FEHLER  ${n} mal gefunden, erwartet: 1`);
    console.log('');
    console.log('ABBRUCH. Es wurde NICHTS geaendert.');
    process.exit(1);
  }
  console.log('');

  const sicherung = `${ZIEL}.sicherung-${zeitstempel()}`;
  fs.copyFileSync(ZIEL, sicherung);
  console.log(`Sicherung:    ${sicherung}`);

  txt = txt.replace(ALT, NEU);
  if (hatCRLF) txt = txt.replace(/\n/g, '\r\n');
  fs.writeFileSync(ZIEL, txt, 'utf8');

  const neu = fs.readFileSync(ZIEL, 'utf8');
  console.log('');
  console.log('Gegenprobe:');
  let ok = true;
  for (const s of MUSS_DA_SEIN) {
    const da = neu.includes(s);
    console.log(`  ${da ? 'OK     ' : 'FEHLT  '} ${s}`);
    if (!da) ok = false;
  }
  for (const s of MUSS_WEG) {
    const weg = !neu.includes(s);
    console.log(`  ${weg ? 'OK     ' : 'NOCH DA'} die alte Reihenfolge ist weg`);
    if (!weg) ok = false;
  }
  const auf = zaehlen(neu, '{');
  const zu = zaehlen(neu, '}');
  console.log(`  ${auf === zu ? 'OK     ' : 'ACHTUNG'} geschweifte Klammern: ${auf} auf, ${zu} zu`);
  if (auf !== zu) ok = false;

  console.log('');
  if (ok) {
    console.log('FERTIG. Im Verlauf steht jetzt die ganze Frage.');
  } else {
    console.log('ACHTUNG: Gegenprobe nicht sauber.');
    console.log(`Alte Fassung: ${sicherung}`);
    process.exit(1);
  }
  console.log('');
}

main();
