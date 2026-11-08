// ============================================
// SYNORA - Marktplatz-Angebote sperren
// ============================================
// GEFUNDEN am 08.11.2026 bei einer Monitor-Suche:
//
//   1. Dell U2417H Monitor   CHF 35.07   bei eBay - simkat22
//   2. HP V22v G5            CHF 39.00   bei MediaMarkt Schweiz
//   3. HP Monitor OMEN 32c   CHF 21.92   bei eBay - martmonincov-0
//
// Ein OMEN 32c ist ein 32-Zoll-Gaming-Monitor und kostet rund 300
// Franken. Fuer 21.92 gibt es ihn nicht. Das sind falsch zugeordnete
// Angebote, Zubehoer oder Betrug.
//
// Und SYNORA hat aktiv dazu geraten:
//   "Wenn du mehr Bildschirmflaeche willst und ein Risiko bei der
//    Rueckgabe akzeptierst, lohnt sich der HP OMEN 32c fuer unter
//    22 CHF."
//
// Auf derselben Seite steht rechts: "Preise und Verfuegbarkeit kommen
// aus Abfragen bei diesen Haendlern: Digitec, Galaxus, Interdiscount,
// MediaMarkt Schweiz, Microspot, Brack." eBay steht da nicht.
//
// ============================================
// DIE ZWEI URSACHEN
// ============================================
// 1. shopStufe() erkennt eBay nur zufaellig.
//    Kennt die Shop-Datenbank ein Land, wird eBay zu Stufe 5 und darf
//    auffuellen. Bei "eBay Schweiz" macht istSchweiz() sogar Stufe 2
//    daraus - dann steht der Fremde ganz oben.
//
// 2. kandidatenWaehlen() sortiert Stufe 6 nur nach hinten.
//    Stufe 5 (echter Auslandsshop) und Stufe 6 (kein erkennbares Land)
//    werden gleich behandelt. Bei weniger als 6 Schweizer Treffern
//    fuellen beide auf. Der Kommentar "lieber ein Treffer aus
//    Deutschland als gar keiner" stimmt fuer Stufe 5. Fuer Stufe 6
//    stimmt er nicht.
//
// ============================================
// DIE ZWEI REGELN
// ============================================
// 1. eBay ist IMMER Stufe 6 - vor allen anderen Pruefungen.
//    Hinter dem Angebot steht ein Fremder, kein Shop: keine Adresse,
//    keine Garantie, kein Rueckgaberecht.
//
// 2. Stufe 6 fuellt NIE auf.
//    Lieber zwei Vorschlaege als drei, von denen einer ein Fremder
//    ohne Adresse ist. Stufe 5 darf weiter auffuellen - ein echter
//    deutscher Shop ist eine echte Moeglichkeit.
//
// ============================================
// Aufruf im Ordner synora-backend-main:
//   node marktplatzSperren.js
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const ZIEL = path.join('src', 'controllers', 'chatController.js');

const AENDERUNGEN = [
  {
    was: '1/2  eBay ist immer Stufe 6',
    alt:
`function shopStufe(p) {
  const quelle = String(p.source || p.shop || '').toLowerCase();
  const qualitaet = p.shopInfo ? p.shopInfo.qualitaet : null;
  const schweiz = istSchweiz(p);
`,
    neu:
`function shopStufe(p) {
  const quelle = String(p.source || p.shop || '').toLowerCase();
  const qualitaet = p.shopInfo ? p.shopInfo.qualitaet : null;
  const schweiz = istSchweiz(p);

  // ---------- Marktplaetze: immer Stufe 6 ----------
  // GEFUNDEN am 08.11.2026: Bei einer Monitor-Suche standen auf Platz
  // 1 und 3 eBay-Verkaeufer mit CHF 35.07 und CHF 21.92 - fuer Geraete,
  // die rund 300 Franken kosten.
  //
  // Diese Pruefung steht VOR allen anderen. Sonst macht istSchweiz()
  // aus "eBay Schweiz" eine Stufe 2 und der Fremde steht ganz oben,
  // oder die Shop-Datenbank kennt ein Land und es wird Stufe 5.
  //
  // Hinter so einem Angebot steht kein Shop, sondern eine Privatperson:
  // keine Adresse, keine Garantie, kein Rueckgaberecht. Das passt nicht
  // zu einer Seite, die "Preise aus Schweizer Shops" verspricht.
  if (/\\bebay\\b/.test(quelle)) return 6;
`
  },

  {
    was: '2/2  Stufe 6 fuellt nicht auf',
    alt:
`  const schweizer = alle.filter((p) => shopStufe(p) <= 2);
  const ausland = alle.filter((p) => shopStufe(p) > 2);`,
    neu:
`  const schweizer = alle.filter((p) => shopStufe(p) <= 2);

  // ---------- Stufe 6 fuellt NICHT auf ----------
  // Bisher standen Stufe 5 und 6 zusammen in "ausland". Der Kommentar
  // oben sagt "lieber ein Treffer aus Deutschland als gar keiner" -
  // das stimmt fuer Stufe 5, einen echten Shop mit Adresse.
  //
  // Stufe 6 heisst: kein erkennbares Land, kein Shop, eine Privatperson.
  // Lieber zwei Vorschlaege als drei, von denen einer ein Fremder ohne
  // Adresse ist.
  const ausland = alle.filter((p) => {
    const stufe = shopStufe(p);
    return stufe > 2 && stufe < 6;
  });

  const unbekannt = alle.filter((p) => shopStufe(p) === 6);
  if (unbekannt.length) {
    console.log(\`[auswahl] \${unbekannt.length} Angebote ohne erkennbaren Shop aussortiert (Stufe 6)\`);
  }`
  }
];

const MUSS_DA_SEIN = [
  'Marktplaetze: immer Stufe 6',
  'return stufe > 2 && stufe < 6;',
  'ohne erkennbaren Shop aussortiert'
];

const MUSS_WEG = ['const ausland = alle.filter((p) => shopStufe(p) > 2);'];

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
  console.log('SYNORA - Marktplatz-Angebote sperren');
  console.log('====================================');
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
  console.log(`Groesse:      ${roh.length} Zeichen`);
  console.log(`Zeilenenden:  ${hatCRLF ? 'CRLF (Windows)' : 'LF'}`);
  console.log('');

  if (txt.includes('Marktplaetze: immer Stufe 6')) {
    console.log('Die Datei ist bereits gesperrt. Es wird nichts geaendert.');
    process.exit(0);
  }

  console.log('Pruefung:');
  let allesOk = true;
  for (const a of AENDERUNGEN) {
    const n = zaehlen(txt, a.alt);
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

  const sicherung = `${ZIEL}.sicherung-${zeitstempel()}`;
  fs.copyFileSync(ZIEL, sicherung);
  console.log(`Sicherung:    ${sicherung}`);

  for (const a of AENDERUNGEN) txt = txt.replace(a.alt, a.neu);

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
    console.log(`  ${weg ? 'OK     ' : 'NOCH DA'} die alte Auswahl-Zeile ist ersetzt`);
    if (!weg) ok = false;
  }

  const auf = zaehlen(neu, '{');
  const zu = zaehlen(neu, '}');
  console.log(`  ${auf === zu ? 'OK     ' : 'ACHTUNG'} geschweifte Klammern: ${auf} auf, ${zu} zu`);
  if (auf !== zu) ok = false;

  console.log('');
  if (ok) {
    console.log('FERTIG. eBay-Angebote kommen nicht mehr in die Vorschlaege.');
    console.log('');
    console.log('Naechster Schritt: hochladen, dann baut Railway neu.');
  } else {
    console.log('ACHTUNG: Die Gegenprobe ist nicht sauber.');
    console.log(`Die alte Fassung liegt hier: ${sicherung}`);
    process.exit(1);
  }
  console.log('');
}

main();
