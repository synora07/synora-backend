// ============================================
// SYNORA - Verlauf anschliessen (Noras Gedaechtnis, Teil 1)
// ============================================
// In src/routes/chat.js steht seit Monaten:
//
//   router.get('/history', requireAuth, async (req, res) => {
//     // TODO: aus dem ChatHistory-Model lesen
//     res.json({ history: [] });
//   });
//
// Darum ist der Chat-Verlauf leer und in der Seitenleiste steht "BALD".
//
// Das TODO ist aber gar nicht noetig: Die Daten liegen schon in der
// Datenbank. Bei JEDER Suche schreibt mitschrieb.js ein SuchProtokoll,
// und chatController.js ruft dabei .nutzer(req) auf - die nutzerId
// steht also drin (chatController.js, Zeile 689).
//
// Es fehlt nur das Lesen. Dieses Skript schreibt den Handler.
//
// ============================================
// EINE SACHE, DIE MAN WISSEN MUSS
// ============================================
// Eine Suche mit Rueckfrage erzeugt ZWEI Protokolle - eines fuer die
// gestellte Frage (ohne Ergebnis) und eines fuer die eigentliche Suche.
// Das steht so in sucheNachschauen.js, Zeile 137.
//
// Ohne Filter stuende jede Frage doppelt im Verlauf, eine davon leer.
// Darum werden nur Durchlaeufe mit mindestens einem Produkt gelesen:
//
//   { 'ergebnis.0': { $exists: true } }
//
// ============================================
// WIE DAS SKRIPT ARBEITET
// ============================================
//   - Erst eine Sicherung, dann die Aenderung
//   - ALLES ODER NICHTS: passt die Stelle nicht genau einmal,
//     wird NICHTS geaendert
//   - Zeilenenden bleiben, wie sie waren
//   - Zum Schluss eine Gegenprobe
//
// Aufruf im Ordner synora-backend-main:
//   node verlaufAnschliessen.js
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const DATEINAME = 'chat.js';
const ORDNER_HINWEIS = 'routes';   // es gibt mehrere chat.js - wir wollen die Route

const ALT =
`router.get('/history', requireAuth, async (req, res) => {
  // TODO: aus dem ChatHistory-Model lesen
  res.json({ history: [] });
});`;

const NEU =
`const SuchProtokoll = require('../models/SuchProtokoll');

/**
 * Der Verlauf kommt aus dem Suchprotokoll, das bei jeder Suche ohnehin
 * geschrieben wird (services/mitschrieb.js). Es braucht kein eigenes
 * Model: nutzerId steht schon drin, weil chatController.js beim
 * Anlegen .nutzer(req) aufruft.
 *
 * NUR DURCHLAEUFE MIT ERGEBNIS:
 * Eine Suche mit Rueckfrage erzeugt ZWEI Protokolle - eines fuer die
 * gestellte Frage (ohne Produkte) und eines fuer die eigentliche
 * Suche. Ohne diesen Filter stuende jede Frage doppelt im Verlauf,
 * eine davon leer.
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const nutzerId = req.user && (req.user._id || req.user.id);
    if (!nutzerId) return res.json({ history: [] });

    const anzahl = Math.min(Math.max(Number(req.query.anzahl) || 20, 1), 50);

    const eintraege = await SuchProtokoll.find(
      { nutzerId, 'ergebnis.0': { $exists: true } },
      'zeit anfrage ergebnis'
    )
      .sort({ zeit: -1 })
      .limit(anzahl)
      .lean();

    const history = eintraege.map((e) => ({
      id: String(e._id),
      zeit: e.zeit,
      frage: (e.anfrage && (e.anfrage.roh || e.anfrage.vollstaendig)) || '',
      kategorie: (e.anfrage && e.anfrage.kategorie) || null,
      budget: (e.anfrage && e.anfrage.budget) || null,
      produkte: (e.ergebnis || []).map((p) => ({
        titel: p.titel || '',
        preis: typeof p.preis === 'number' ? p.preis : null,
        shop: p.shop || '',
        score: typeof p.score === 'number' ? p.score : null
      }))
    }));

    res.json({ history });
  } catch (e) {
    // Ein kaputter Verlauf darf die Seite nicht kaputt machen.
    console.warn('[history] nicht gelesen:', e.message);
    res.json({ history: [] });
  }
});`;

const MUSS_DA_SEIN = [
  "require('../models/SuchProtokoll')",
  "'ergebnis.0': { $exists: true }",
  '.sort({ zeit: -1 })',
  'res.json({ history });'
];

const MUSS_WEG = ['// TODO: aus dem ChatHistory-Model lesen'];

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

function dateienSuchen(start, name) {
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
      } else if (e.name === name) {
        treffer.push(voll);
      }
    }
  })(start);
  return treffer;
}

function main() {
  console.log('');
  console.log('SYNORA - Verlauf anschliessen');
  console.log('=============================');
  console.log('');

  let treffer = dateienSuchen('.', DATEINAME);

  if (treffer.length > 1) {
    const enger = treffer.filter((t) => t.split(path.sep).includes(ORDNER_HINWEIS));
    if (enger.length === 1) treffer = enger;
  }

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

  if (txt.includes("'ergebnis.0': { $exists: true }")) {
    console.log('Die Datei ist bereits angeschlossen - der Handler steht drin.');
    console.log('Es wird nichts geaendert.');
    process.exit(0);
  }

  const anzahl = zaehlen(txt, ALT);
  console.log('Pruefung:');
  if (anzahl === 1) {
    console.log('  OK      Der leere /history-Handler steht genau einmal in der Datei');
  } else {
    console.log(`  FEHLER  Der Handler wurde ${anzahl} mal gefunden, erwartet: 1`);
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
    console.log(`  ${weg ? 'OK     ' : 'NOCH DA'} das TODO ist verschwunden`);
    if (!weg) ok = false;
  }

  const auf = zaehlen(neu, '{');
  const zu = zaehlen(neu, '}');
  console.log(`  ${auf === zu ? 'OK     ' : 'ACHTUNG'} geschweifte Klammern: ${auf} auf, ${zu} zu`);
  if (auf !== zu) ok = false;

  console.log('');
  if (ok) {
    console.log('FERTIG. Der Verlauf wird jetzt aus dem Suchprotokoll gelesen.');
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
