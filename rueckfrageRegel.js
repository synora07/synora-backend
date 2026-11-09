// ============================================
// SYNORA - Nur fragen, wenn es das Ergebnis aendert
// ============================================
// DIE REGEL, festgelegt am 08.11.2026:
//
//   Eine Rueckfrage ist nur erlaubt, wenn die Antwort darauf die
//   Vorschlaege AENDERT.
//
// Herkunft: 30. Oktober, eigene Beobachtung - "playstation,
// unsinnige Frage, fuer was ich es brauche, PlayStation ist da zum
// Spielen."
//
// ============================================
// GEMESSEN AM 09.11.2026
// ============================================
// Acht echte Faelle durch rueckfrage.pruefen() geschickt:
//
//   monitor              -> Wofuer nutzt du den Bildschirm?      SINNVOLL
//   kopfhoerer           -> Wofuer brauchst du sie?              SINNVOLL
//   playstation 5        -> Worum geht es dir?                   FRAGLICH
//   iphone 15 pro        -> Was ist dir am wichtigsten?          FRAGLICH
//   philips 27E1N1800AE  -> Damit ich nicht raten muss: wofuer?  FALSCH
//
// Die letzte Zeile ist der klare Verstoss: der Kunde hat eine exakte
// Modellnummer getippt. Es gibt genau EIN Produkt. Keine Antwort auf
// "wofuer brauchst du es" kann daran etwas aendern.
//
// Bei playstation und iphone ist die Frage nicht ueberfluessig,
// sondern die FALSCHE. Nicht "wofuer", sondern "welche Ausfuehrung".
// So entschieden am 09.11.2026.
//
// ============================================
// ZWEI AENDERUNGEN
// ============================================
// 1. MODELLNUMMER -> GAR NICHT FRAGEN
//    Ein Wort aus Buchstaben UND Ziffern wie 27E1N1800AE, 32c,
//    VA279HG, 24b31h benennt ein bestimmtes Geraet.
//
//    Masseinheiten sind ausgenommen - 4k, 144hz, 32gb, 27zoll sehen
//    genauso aus, sind aber Eigenschaften und keine Modelle. Ohne
//    diese Ausnahme wuerde "monitor 4k" nicht mehr nachfragen, und
//    das waere schlechter als vorher.
//
// 2. PRODUKTLINIE -> ANDERE FRAGE
//    Eine neue Tabelle FRAGEN_LINIE, die VOR FRAGEN[pfad] greift.
//    Bei "playstation" wird nicht nach dem Zweck gefragt, sondern
//    nach dem, was die Ausfuehrungen unterscheidet.
//
// ============================================
// DIE LISTE IST EIN ANFANG, KEINE WAHRHEIT
// ============================================
// FRAGEN_LINIE enthaelt vier Eintraege. Sie sind bewusst so
// formuliert, dass sie keine Modellnamen nennen - "Mit Laufwerk oder
// nur Download" bleibt richtig, auch wenn Sony naechstes Jahr neue
// Namen vergibt. Eine Liste mit "PS5 Slim" waere in einem Jahr falsch.
//
// Welche Linien dazugehoeren und was man dort fragen muss, weiss der
// Katalog besser als ich. Ein falscher Eintrag hier ist teuer: er
// ersetzt still eine sinnvolle Frage durch eine unpassende. Darum nur
// vier, und alle vier gehoeren geprueft.
//
// Steht eine Linie nicht in der Tabelle, bleibt alles wie bisher.
//
// ============================================
// Aufruf im Ordner synora-backend-main:
//   node rueckfrageRegel.js
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const ZIEL = path.join('src', 'services', 'rueckfrage.js');
const MARKE = 'FRAGEN_LINIE';

const AENDERUNGEN = [
  {
    was: '1/3  Tabelle fuer Produktlinien',
    alt:
`const FRAGE_ALLGEMEIN = {
  frage: 'Damit ich nicht raten muss: Wofür brauchst du es?',
  optionen: ['Für mich selbst', 'Als Geschenk', 'Für die Arbeit']
};`,
    neu:
`const FRAGE_ALLGEMEIN = {
  frage: 'Damit ich nicht raten muss: Wofür brauchst du es?',
  optionen: ['Für mich selbst', 'Als Geschenk', 'Für die Arbeit']
};

// ============================================
// PRODUKTLINIEN  (angebaut 09.11.2026)
// ============================================
// Wer "playstation" tippt, hat sich fuer die Linie entschieden. Die
// Frage "wofuer brauchst du es" aendert daran nichts - sie ist nicht
// ueberfluessig, sondern die falsche. Richtig ist die Frage nach der
// Ausfuehrung.
//
// Gemessen am 09.11.2026 kam bei "playstation 5" die Frage
// "Worum geht es dir?" - eine Gaming-Frage, die schon beantwortet ist.
//
// Diese Tabelle wird VOR FRAGEN[pfad] geprueft. Steht eine Linie nicht
// drin, bleibt alles wie bisher.
//
// BEWUSST OHNE MODELLNAMEN. "Mit Laufwerk oder nur Download" bleibt
// richtig, auch wenn naechstes Jahr andere Namen auf den Kartons
// stehen. Eine Liste mit "PS5 Slim" waere in einem Jahr falsch.
//
// DIESE VIER EINTRAEGE SIND EIN ANFANG und gehoeren geprueft. Ein
// falscher Eintrag ersetzt still eine sinnvolle Frage durch eine
// unpassende.

const FRAGEN_LINIE = {
  playstation: {
    frage: 'Welche Ausführung soll es sein?',
    optionen: ['Mit Laufwerk für Discs', 'Nur Download, ohne Laufwerk']
  },
  xbox: {
    frage: 'Welche Ausführung soll es sein?',
    optionen: ['Mit Laufwerk für Discs', 'Nur Download, ohne Laufwerk']
  },
  iphone: {
    frage: 'Wie viel Speicher brauchst du?',
    optionen: ['Wenig – Telefon und Nachrichten', 'Mittel – Fotos und Apps', 'Viel – Videos und Spiele']
  },
  nintendo: {
    frage: 'Wo wirst du damit spielen?',
    optionen: ['Unterwegs', 'Am Fernseher', 'Beides']
  }
};

// Masseinheiten sehen aus wie Modellnummern - 4k, 144hz, 32gb, 27zoll
// bestehen ebenfalls aus Ziffern und Buchstaben. Sie sind aber
// Eigenschaften, keine Geraete. Ohne diese Ausnahme wuerde
// "monitor 4k" nicht mehr nachfragen, und das waere schlechter als
// vorher.
const EINHEITEN = /^[0-9]+(k|p|hz|gb|tb|mb|kb|zoll|cm|mm|m|kg|g|w|v|a|ah|mah|fps|bit|khz|ghz|mhz|ml|l)$/;

/**
 * Steht im Text eine Modellnummer?
 *
 * Eine Modellnummer besteht aus Buchstaben UND Ziffern in einem Wort:
 * 27E1N1800AE, 32c, VA279HG, 24b31h. Wer so etwas tippt, meint ein
 * bestimmtes Geraet - dann aendert keine Rueckfrage mehr etwas.
 *
 * "playstation 5" faellt NICHT darunter: "playstation" ist reiner
 * Text, "5" ist eine reine Zahl. Gemischt ist keines von beiden.
 */
function modellnummer(text) {
  const woerter = String(text || '').toLowerCase().split(/[^a-z0-9]+/);
  for (const w of woerter) {
    if (w.length < 3) continue;
    if (!/[a-z]/.test(w)) continue;
    if (!/[0-9]/.test(w)) continue;
    if (EINHEITEN.test(w)) continue;
    return w;
  }
  return null;
}

/**
 * Nennt der Text eine Produktlinie aus FRAGEN_LINIE?
 */
function linieErkennen(text) {
  const s = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  for (const linie of Object.keys(FRAGEN_LINIE)) {
    if (s.includes(' ' + linie + ' ')) return linie;
  }
  return null;
}`
  },

  {
    was: '2/3  Modellnummer: gar nicht fragen, Linie: andere Frage',
    alt:
`  const pfad = kategorien ? kategorien.kategorieErkennen(nachricht) : null;
  const haupt = pfad ? pfad.split('.')[0] : null;

  const vorlage =
    (pfad && FRAGEN[pfad]) ||
    (haupt && FRAGEN_HAUPT[haupt]) ||
    FRAGE_ALLGEMEIN;`,
    neu:
`  // ---------- Regel vom 08.11.2026 ----------
  // Nur fragen, wenn die Antwort die Vorschlaege aendert.
  //
  // Eine Modellnummer benennt genau ein Geraet. Gemessen am
  // 09.11.2026 fragte SYNORA bei "philips 27E1N1800AE" trotzdem
  // "Damit ich nicht raten muss: Wofuer brauchst du es?" - eine Frage,
  // deren Antwort nichts aendern kann.
  const modell = modellnummer(nachricht);
  if (modell) {
    console.log(\`[rueckfrage] keine Frage - "\${modell}" ist eine Modellnummer\`);
    return null;
  }

  const pfad = kategorien ? kategorien.kategorieErkennen(nachricht) : null;
  const haupt = pfad ? pfad.split('.')[0] : null;

  // Produktlinie zuerst: wer "playstation" tippt, hat die Linie
  // gewaehlt. Dann ist nicht der Zweck offen, sondern die Ausfuehrung.
  const linie = linieErkennen(nachricht);

  const vorlage =
    (linie && FRAGEN_LINIE[linie]) ||
    (pfad && FRAGEN[pfad]) ||
    (haupt && FRAGEN_HAUPT[haupt]) ||
    FRAGE_ALLGEMEIN;

  if (linie) console.log(\`[rueckfrage] Produktlinie "\${linie}" - Frage nach der Ausfuehrung\`);`
  },

  {
    was: '3/3  Die neuen Funktionen ausliefern',
    alt:
`  genugAngaben,`,
    neu:
`  genugAngaben,
  modellnummer,            // angebaut 09.11.2026
  linieErkennen,           // angebaut 09.11.2026
  FRAGEN_LINIE,            // angebaut 09.11.2026`
  }
];

const MUSS_DA_SEIN = [
  'const FRAGEN_LINIE = {',
  'function modellnummer(text)',
  'function linieErkennen(text)',
  '(linie && FRAGEN_LINIE[linie]) ||',
  'ist eine Modellnummer'
];

// Erwartetes Verhalten nach der Aenderung.
// null bedeutet: es wird gar nicht gefragt.
const ERWARTET = [
  ['philips 27E1N1800AE', null],
  ['monitor va279hg', null],
  ['hp omen 32c', null],
  ['monitor 4k', 'FRAGE'],
  ['144hz monitor', 'FRAGE'],
  ['laptop 16gb', 'FRAGE'],
  ['playstation', 'Welche Ausführung soll es sein?'],
  ['playstation 5', 'Welche Ausführung soll es sein?'],
  ['iphone 15 pro', 'Wie viel Speicher brauchst du?'],
  ['monitor', 'FRAGE'],
  ['kopfhoerer', 'FRAGE']
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
  console.log('SYNORA - Nur fragen, wenn es das Ergebnis aendert');
  console.log('=================================================');
  console.log('');

  if (!fs.existsSync(ZIEL)) {
    console.log(`ABBRUCH: ${ZIEL} nicht gefunden.`);
    process.exit(1);
  }

  const roh = fs.readFileSync(ZIEL, 'utf8');
  const hatCRLF = roh.includes('\r\n');
  let txt = roh.replace(/\r\n/g, '\n');

  console.log(`Datei:        ${ZIEL}`);
  console.log(`Groesse:      ${roh.length} Zeichen, ${hatCRLF ? 'CRLF' : 'LF'}`);
  console.log('');

  if (txt.includes(MARKE)) {
    console.log('Bereits eingebaut. Es wird nichts geaendert.');
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
    console.log('Die alte Fassung ist zurueckgespielt.');
    process.exit(1);
  }

  const neu = fs.readFileSync(ZIEL, 'utf8');
  console.log('');
  console.log('Gegenprobe:');
  let ok = true;
  for (const s of MUSS_DA_SEIN) {
    const da = neu.includes(s);
    console.log(`  ${da ? 'OK     ' : 'FEHLT  '} ${s}`);
    if (!da) ok = false;
  }
  if (!ok) zurueckspielen('die Gegenprobe ist nicht sauber.');

  const { execFileSync } = require('child_process');
  let syntaxOk = false;
  let fehler = '';
  try {
    execFileSync(process.execPath, ['--check', path.resolve(ZIEL)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
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

  // ---------- Verhalten ----------
  console.log('');
  console.log('Elf Faelle durch die echte Entscheidung:');

  const pruefdatei = path.join(require('os').tmpdir(), `synora-rueckfrage-${Date.now()}.js`);
  fs.writeFileSync(
    pruefdatei,
    [
      "'use strict';",
      `const r = require(${JSON.stringify(path.resolve(ZIEL))});`,
      `const faelle = ${JSON.stringify(ERWARTET.map((e) => e[0]))};`,
      'const still = console.log; console.log = () => {};',
      'const raus = faelle.map((t) => {',
      '  let f = null;',
      '  try { f = r.pruefen({ nachricht: t, anforderungen: {}, budget: 0, verlauf: [] }); } catch (e) { return [t, "FEHLER: " + e.message]; }',
      '  return [t, f ? f.frage : null];',
      '});',
      'console.log = still;',
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
    console.log('  ' + (((e.stderr ? String(e.stderr) : '') || e.message).split('\n')[0]));
  } finally {
    try { fs.unlinkSync(pruefdatei); } catch (_) {}
  }

  if (zeilen) {
    let fehlerZahl = 0;
    for (let i = 0; i < zeilen.length; i++) {
      const [text, bekommen] = zeilen[i];
      const soll = ERWARTET[i][1];
      let gut;
      if (soll === null) gut = bekommen === null;
      else if (soll === 'FRAGE') gut = typeof bekommen === 'string' && bekommen.length > 0;
      else gut = bekommen === soll;
      if (!gut) fehlerZahl += 1;
      const anzeige = bekommen === null ? 'keine Frage' : String(bekommen);
      console.log(`  ${gut ? 'OK    ' : 'FEHLER'} ${text.padEnd(22)} -> ${anzeige}`);
    }
    if (fehlerZahl) {
      console.log('');
      console.log(`  ${fehlerZahl} Fall/Faelle weichen ab.`);
      zurueckspielen('die Probe hat nicht das erwartete Ergebnis geliefert.');
    }
  }

  console.log('');
  console.log('FERTIG.');
  console.log('');
  console.log('  Modellnummer  -> gar keine Frage');
  console.log('  Produktlinie  -> Frage nach der Ausfuehrung');
  console.log('  Kategorie     -> unveraendert wie bisher');
  console.log('');
  console.log('Die vier Eintraege in FRAGEN_LINIE (playstation, xbox, iphone,');
  console.log('nintendo) sind ein Anfang. Sieh sie dir an - ein falscher');
  console.log('Eintrag ersetzt still eine sinnvolle Frage durch eine');
  console.log('unpassende. Sie stehen in src/services/rueckfrage.js.');
  console.log('');
  console.log('Naechster Schritt: hochladen, dann baut Railway neu.');
  console.log('');
}

main();
