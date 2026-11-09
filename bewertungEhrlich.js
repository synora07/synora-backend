// ============================================
// SYNORA - Bewertungszahlen: Urteil statt Ziffern
// ============================================
// GEMESSEN am 08.11.2026 mit scripts/sucheNachschauen.js --lauf:
//
//   behauptet 746 Bewertungen   ->  in den Daten 692
//   behauptet  95 Bewertungen   ->  in den Daten 121
//   behauptet 262 Bewertungen   ->  in den Daten  87
//
// Drei von drei. Die Faktenpruefung hat alle drei gestrichen - der
// Besucher bekam also eine Antwort mit Loechern.
//
// ============================================
// ES IST KEIN LUEGEN, ES IST ABSCHREIBEN
// ============================================
// Die erste Vermutung war, die Anweisung verbiete das Erfinden nicht.
// Falsch. Sie verbietet es vierfach:
//
//    78: Du erfindest nie ein ...
//   102: ... sie nicht und erfindest sie nicht.
//   133: M) BEWERTUNGSZAHLEN EHRLICH EINORDNEN.
//   357: NUR was hier steht, darfst du behaupten
//
// Und das Modell hatte die richtigen Zahlen vorliegen. Es bekam
// "aus 692 Bewertungen" und schrieb 746.
//
// Sprachmodelle koennen nicht abschreiben. Eine Zahl ist fuer sie kein
// Wert, sondern eine Zeichenfolge, die beim Formulieren neu entsteht.
// Ein fuenftes Verbot aendert daran nichts - es sind schon vier da.
//
// Verstaerkend wirkte Regel M selbst. Sie enthielt drei Beispiele, und
// in allen drei standen Ziffern: 50, 500, 31. Die Regel hat dem Modell
// die Satzform "X Bewertungen" vorgefuehrt und nie verboten, die Zahl
// selbst hinzuschreiben.
//
// ============================================
// DIE LOESUNG: DAS MODELL BEKOMMT DIE ZAHL NICHT MEHR
// ============================================
// Was man nicht hat, kann man nicht verfaelschen.
//
// Statt der Anzahl bekommt das Modell ein fertiges Urteil:
//
//   BEWERTUNGS-BASIS: ZU WENIG   (unter 50)
//   BEWERTUNGS-BASIS: MITTEL     (50 bis 499)
//   BEWERTUNGS-BASIS: BELASTBAR  (ab 500)
//
// Die Grenzen 50 und 500 sind nicht neu - sie standen schon in der
// alten Regel M. Neu ist nur, dass der Code sie ausrechnet statt das
// Modell. Dasselbe Vorgehen wie bei SHOP-STUFE zwanzig Zeilen weiter
// oben, wo im Kommentar schon steht:
//
//   "Zahl hinzuschreiben ist wirksamer als jede Bitte im Regeltext:
//    das Modell kann sie vergleichen, statt sie zu erraten."
//
// Das Prinzip war beim Bau der Shop-Stufen schon verstanden, nur nicht
// auf die Bewertungen angewandt.
//
// ============================================
// DER ZWEITE FEHLER, ZEILE 367
// ============================================
//   if (p.rating && p.reviews) prompt += ` aus ${p.reviews} Bewertungen`;
//
// Fehlt die Sternezahl, faellt die Bewertungsanzahl stillschweigend mit
// weg - auch wenn sie vorhanden ist. Das Modell musste dann ueber
// Bewertungszahlen urteilen, OHNE eine zu kennen. Das ist keine
// Verfuehrung mehr, das ist eine Aufforderung zum Erfinden.
//
// Jetzt sind beide Angaben voneinander unabhaengig.
//
// ============================================
// WAS BEWUSST NICHT GEAENDERT WIRD
// ============================================
// Die Sternezahl (STERNE: 4.5) bekommt das Modell weiterhin als Zahl.
// Es braucht sie, um Produkte zu vergleichen - genau wie die
// Shop-Stufe. Regel M verbietet nur, sie in den Text zu schreiben.
//
// Grund: verfaelscht wurden in der Messung ausschliesslich
// Bewertungs-ANZAHLEN, keine Sternezahlen. Repariert wird, was belegt
// kaputt ist, nicht was man befuerchtet. Zeigen die naechsten 20 Suchen
// auch falsche Sternezahlen, wird die Regel erweitert.
//
// ============================================
// DER CACHE ERLEDIGT SICH SELBST
// ============================================
// claudeService.js:56 haengt den Bewertungs-Cache an einen SHA-Abdruck
// der Anweisung. Weil sich die Anweisung aendert, verfaellt der Cache
// von allein. Nichts zu tun.
//
// ============================================
// Aufruf im Ordner synora-backend-main:
//   node bewertungEhrlich.js
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const ZIEL = path.join('src', 'services', 'claudeService.js');
const MARKE = 'BEWERTUNGS-BASIS';

const AENDERUNGEN = [
  {
    was: '1/2  Regel M: Urteil in Worten, keine Ziffern',
    alt:
`M) BEWERTUNGSZAHLEN EHRLICH EINORDNEN.
   Unter 50 Bewertungen sagt der Durchschnitt wenig. Dann schreibst
   du "erst wenige Bewertungen, die Zahl sagt noch wenig aus" -
   NICHT "zeigt Zuverlaessigkeit". Ab etwa 500 Bewertungen darfst
   du von einem belastbaren Bild sprechen.
   Eine 5-Sterne-Wertung bei 31 Bewertungen ist kein Beweis.`,
    neu:
`M) BEWERTUNGEN IN WORTEN, NIE IN ZIFFERN.
   Du schreibst NIE eine Bewertungsanzahl - weder als Ziffer noch als
   ausgeschriebenes Zahlwort. Du bekommst die Anzahl auch gar nicht
   mehr geliefert. Stattdessen steht bei jedem Produkt, wo eine
   Anzahl bekannt ist, eine Zeile BEWERTUNGS-BASIS mit dem fertigen
   Urteil. Gib dieses Urteil in Worten wieder:
     ZU WENIG   -> "erst wenige Bewertungen, die Zahl sagt noch
                    wenig aus"
     MITTEL     -> "eine ordentliche Zahl von Bewertungen, aber
                    kein Beweis"
     BELASTBAR  -> "viele Bewertungen, das Bild ist belastbar"
   Bei ZU WENIG nie "zeigt Zuverlaessigkeit" oder etwas Aehnliches.
   Steht bei einem Produkt keine BEWERTUNGS-BASIS, sagst du zu
   dessen Bewertungen gar nichts - auch nicht, dass es keine gibt.`
  },

  {
    was: '2/2  Datenaufbau: Anzahl raus, Urteil rein',
    alt:
`    if (p.rating) prompt += \`   Bewertung: \${p.rating}\`;
    if (p.rating && p.reviews) prompt += \` aus \${p.reviews} Bewertungen\`;
    if (p.rating) prompt += \`\\n\`;`,
    neu:
`    // ---------- Bewertung ----------
    // GEAENDERT am 09.11.2026. Vorher standen hier drei Zeilen:
    //
    //   if (p.rating) prompt += \`   Bewertung: \${p.rating}\`;
    //   if (p.rating && p.reviews) prompt += \` aus \${p.reviews} Bewertungen\`;
    //   if (p.rating) prompt += \`\\n\`;
    //
    // Zwei Fehler darin:
    //
    // 1. Fehlte die Sternezahl, fiel die Anzahl stillschweigend mit
    //    weg - auch wenn sie da war. Das Modell musste dann ueber
    //    Bewertungszahlen urteilen, ohne eine zu kennen.
    //
    // 2. Das Modell bekam die blanke Anzahl und schrieb sie in den
    //    Satz - verfaelscht. Gemessen am 08.11.2026: 692 wurde zu 746,
    //    121 zu 95, 87 zu 262. Drei von drei.
    //
    // Jetzt sind beide Angaben unabhaengig, und die Anzahl wird gar
    // nicht mehr geliefert - nur das fertige Urteil. Was das Modell
    // nicht hat, kann es nicht verfaelschen.
    //
    // Die Grenzen 50 und 500 standen schon vorher in Regel M. Neu ist
    // nur, dass der Code sie ausrechnet statt das Modell.
    const sterne = p.rating === 0 || p.rating ? String(p.rating).trim() : '';
    const anzahl = Number(p.reviews);
    const anzahlBekannt = Number.isFinite(anzahl) && anzahl > 0;

    if (sterne) prompt += \`   STERNE: \${sterne} (zum Vergleichen, nicht zum Hinschreiben)\\n\`;
    if (anzahlBekannt) {
      const basis = anzahl < 50 ? 'ZU WENIG'
        : anzahl < 500 ? 'MITTEL'
        : 'BELASTBAR';
      prompt += \`   BEWERTUNGS-BASIS: \${basis}\\n\`;
    }`
  }
];

const MUSS_DA_SEIN = [
  'M) BEWERTUNGEN IN WORTEN, NIE IN ZIFFERN.',
  'BEWERTUNGS-BASIS: ${basis}',
  'const anzahlBekannt = Number.isFinite(anzahl) && anzahl > 0;',
  'zum Vergleichen, nicht zum Hinschreiben'
];

// Achtung bei der letzten Zeile: der neue Kommentar zitiert den alten
// Code absichtlich, damit nachvollziehbar bleibt, was dort stand. Darum
// wird nicht auf den Text geprueft, sondern auf die AKTIVE Zeile - also
// mit Zeilenumbruch und Einrueckung davor, ohne Kommentarzeichen.
const MUSS_WEG = [
  'M) BEWERTUNGSZAHLEN EHRLICH EINORDNEN.',
  'Eine 5-Sterne-Wertung bei 31 Bewertungen ist kein Beweis.',
  '\n    if (p.rating && p.reviews) prompt += ` aus ${p.reviews} Bewertungen`;'
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
  console.log('SYNORA - Bewertungszahlen: Urteil statt Ziffern');
  console.log('===============================================');
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

  if (txt.includes(MARKE)) {
    console.log('Bereits geaendert. Es wird nichts angefasst.');
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
    console.log('Schick die Ausgabe weiter, dann wird das Skript angepasst.');
    process.exit(1);
  }

  const sicherung = `${ZIEL}.sicherung-${zeitstempel()}`;
  fs.copyFileSync(ZIEL, sicherung);
  console.log(`Sicherung:    ${sicherung}`);

  for (const a of AENDERUNGEN) txt = txt.replace(a.alt, a.neu);
  if (hatCRLF) txt = txt.replace(/\n/g, '\r\n');
  fs.writeFileSync(ZIEL, txt, 'utf8');

  function zurueckspielen(grund) {
    fs.copyFileSync(sicherung, ZIEL);
    console.log('');
    console.log(`ABBRUCH: ${grund}`);
    console.log('Die alte Fassung ist zurueckgespielt. Die Datei ist wieder');
    console.log('genau so, wie sie vorher war.');
    process.exit(1);
  }

  // ---------- Gegenprobe: Text ----------
  const neu = fs.readFileSync(ZIEL, 'utf8');
  console.log('');
  console.log('Gegenprobe:');
  let ok = true;

  for (const s of MUSS_DA_SEIN) {
    const da = neu.includes(s);
    console.log(`  ${da ? 'OK     ' : 'FEHLT  '} ${s.length > 48 ? s.slice(0, 47) + '…' : s}`);
    if (!da) ok = false;
  }
  for (const s of MUSS_WEG) {
    const weg = !neu.includes(s);
    const zeigen = s.replace(/\n/g, '').trim();
    console.log(`  ${weg ? 'OK     ' : 'NOCH DA'} weg: ${zeigen.length > 42 ? zeigen.slice(0, 41) + '…' : zeigen}`);
    if (!weg) ok = false;
  }

  // ---------- Die entscheidende Pruefung ----------
  // node --check prueft die Schreibweise und fuehrt NICHTS aus. Das ist
  // hier wichtig: claudeService.js wuerde beim Laden Umgebungsvariablen
  // und einen API-Schluessel erwarten.
  //
  // Dies ist die EINZIGE harte Huerde. In der ersten Fassung stand hier
  // davor noch ein Klammerzaehler - der hat am 09.11.2026 faelschlich
  // angeschlagen und die Aenderung zurueckgerollt, obwohl sie in Ordnung
  // war. Grund: in dieser Datei steht die Anweisung an das Modell als
  // langer Text, und darin duerfen geschweifte Klammern einzeln
  // vorkommen. Ein stures Zaehlen aller Zeichen passt hier nicht.
  // node --check weiss es besser und ist das richtige Mass.
  let syntaxOk = false;
  let fehler = '';
  try {
    const { execFileSync } = require('child_process');
    execFileSync(process.execPath, ['--check', path.resolve(ZIEL)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    syntaxOk = true;
  } catch (e) {
    fehler = (e.stderr ? String(e.stderr) : '') || e.message;
  }

  console.log(`  ${syntaxOk ? 'OK     ' : 'FEHLER '} die Datei ist syntaktisch in Ordnung`);
  if (!syntaxOk) {
    console.log('');
    console.log(fehler);
    zurueckspielen('die geaenderte Datei hat einen Schreibfehler.');
  }

  // Nur zur Kenntnis, keine Huerde: wenn die Zahlen schon vorher
  // ungleich waren, liegt das an Klammern im Anweisungstext.
  const auf = zaehlen(neu, '{');
  const zu = zaehlen(neu, '}');
  const vorherAuf = zaehlen(roh, '{');
  const vorherZu = zaehlen(roh, '}');
  console.log(`  (Info)   geschweifte Klammern: vorher ${vorherAuf}/${vorherZu}, jetzt ${auf}/${zu}`);
  if (auf - zu !== vorherAuf - vorherZu) {
    console.log('  ACHTUNG  Das Verhaeltnis hat sich veraendert - das sollte nicht sein.');
    ok = false;
  }

  if (!ok) zurueckspielen('die Gegenprobe ist nicht sauber.');

  console.log('');
  console.log('FERTIG. Das Modell bekommt ab jetzt:');
  console.log('');
  console.log('   STERNE: 4.5 (zum Vergleichen, nicht zum Hinschreiben)');
  console.log('   BEWERTUNGS-BASIS: BELASTBAR');
  console.log('');
  console.log('statt "Bewertung: 4.5 aus 692 Bewertungen".');
  console.log('');
  console.log('Die Grenzen:   unter 50 = ZU WENIG');
  console.log('               50 - 499 = MITTEL');
  console.log('               ab 500   = BELASTBAR');
  console.log('');
  console.log('Der Bewertungs-Cache verfaellt von allein (claudeService.js:56).');
  console.log('');
  console.log('Naechster Schritt: hochladen, dann baut Railway neu.');
  console.log('Danach pruefen: node scripts/sucheNachschauen.js --letzte');
  console.log('In der Spalte "gestrichen" muss ab jetzt 0 stehen.');
  console.log('');
}

main();
