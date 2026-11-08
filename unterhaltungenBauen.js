// ============================================
// SYNORA - Unterhaltungen (Noras Gedaechtnis, richtig gebaut)
// ============================================
// Der erste Anlauf am 08.11.2026 las den Verlauf aus dem
// Suchprotokoll. Das war der kurze Weg und der falsche: Das
// Suchprotokoll ist ein technisches Logbuch - eine Zeile pro Suche,
// fuer Auswertung und Fehlersuche, und es loescht sich nach 180 Tagen.
//
// In der Seitenleiste stand darum:
//
//   Für die Arbeit              08.11.
//   Ist mir egal - zeig mi...   08.11.
//
// Also einzelne Textfetzen statt Gespraeche.
//
// Ein Chat-Verlauf ist etwas anderes: EIN Eintrag pro Unterhaltung,
// mit allen Nachrichten darin. Das wird hier gebaut.
//
// ============================================
// DIE ZWEI ENTSCHEIDUNGEN
// ============================================
// 1. GESPEICHERT WIRD DIE ANTWORT, UNVERAENDERT.
//    Nicht Titel und Preis herausklauben, sondern genau das, was der
//    Server geschickt hat. Dann ist Wiederoeffnen kein Nachbauen,
//    sondern ein Abspielen: Bilder, DAFUER/DAGEGEN und Shop-Links
//    sehen aus wie beim ersten Mal.
//
// 2. chatController.js WIRD NICHT ANGEFASST.
//    Dort gibt es fuenf Ausgaenge (Rueckfrage, nichts gefunden, ueber
//    Budget, gemeldete Angebote, normales Ergebnis). Fuenf Stellen
//    aendern heisst fuenf Stellen, an denen etwas schiefgehen kann.
//    Stattdessen haengt sich das Speichern EINMAL an der Route ein
//    und faengt alle fuenf gemeinsam ab.
//
// ============================================
// WAS DAS SKRIPT MACHT
// ============================================
//   A) legt src/models/Unterhaltung.js an       (neue Datei)
//   B) legt src/services/unterhaltung.js an     (neue Datei)
//   C) aendert src/routes/chat.js               (mit Sicherung)
//
// ALLES ODER NICHTS: Passt in chat.js etwas nicht, wird gar nichts
// geschrieben - auch die neuen Dateien nicht.
//
// Aufruf im Ordner synora-backend-main:
//   node unterhaltungenBauen.js
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const CHAT_JS = path.join('src', 'routes', 'chat.js');
const MODELL = path.join('src', 'models', 'Unterhaltung.js');
const DIENST = path.join('src', 'services', 'unterhaltung.js');

// ============================================
// A) Das Model
// ============================================

const MODELL_INHALT = `// ============================================
// SYNORA - Unterhaltung
// ============================================
// Ein Eintrag pro Gespraech, nicht pro Suche. Das Suchprotokoll
// (models/SuchProtokoll.js) bleibt daneben bestehen - das ist das
// technische Logbuch fuer Auswertungen und loescht sich nach 180
// Tagen. Hier liegt, was der Nutzer sieht, und das bleibt.
//
// In "daten" steht die komplette Antwort des Servers, unveraendert.
// Dadurch laesst sich ein Gespraech spaeter abspielen statt
// nachbauen - mit Bildern, Begruendungen und Shop-Links.
// ============================================

'use strict';

const mongoose = require('mongoose');

const NachrichtSchema = new mongoose.Schema(
  {
    wer: { type: String, enum: ['nutzer', 'synora'], required: true },
    text: { type: String, default: '' },
    zeit: { type: Date, default: Date.now },
    daten: mongoose.Schema.Types.Mixed   // nur bei 'synora'
  },
  { _id: false }
);

const UnterhaltungSchema = new mongoose.Schema({
  nutzerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  titel: { type: String, default: '' },     // die erste Frage, gekuerzt
  erstellt: { type: Date, default: Date.now },
  zuletzt: { type: Date, default: Date.now },
  nachrichten: { type: [NachrichtSchema], default: [] }
});

// Fuer die Seitenleiste: die eigenen Gespraeche, neueste zuerst
UnterhaltungSchema.index({ nutzerId: 1, zuletzt: -1 });

// ABSICHTLICH OHNE TTL: Das hier gehoert dem Nutzer. Es verschwindet,
// wenn er es loescht - nicht nach 180 Tagen von selbst.

module.exports =
  mongoose.models.Unterhaltung || mongoose.model('Unterhaltung', UnterhaltungSchema);
`;

// ============================================
// B) Der Dienst
// ============================================

const DIENST_INHALT = `// ============================================
// SYNORA - Unterhaltungen speichern
// ============================================
// Wird aus routes/chat.js aufgerufen, einmal pro Anfrage.
//
// Grundsatz wie beim Mitschrieb: Das Speichern darf NIE eine Suche
// kaputt machen. Jeder Fehler wird geschluckt und geloggt. Lieber ein
// fehlender Verlaufseintrag als ein Nutzer, der eine Fehlermeldung
// sieht statt seiner Produkte.
// ============================================

'use strict';

const mongoose = require('mongoose');
const Unterhaltung = require('../models/Unterhaltung');

// 60 Nachrichten sind 30 Wechsel. Laenger wird kein Einkaufsgespraech,
// und so waechst kein Eintrag unbegrenzt.
const MAX_NACHRICHTEN = 60;
const MAX_TITEL = 80;

/** Aus der ersten Frage einen Titel machen. */
function titelAus(text) {
  const t = String(text || '').trim().replace(/\\s+/g, ' ');
  if (!t) return 'Ohne Titel';
  return t.length > MAX_TITEL ? t.slice(0, MAX_TITEL - 1) + '…' : t;
}

/**
 * Die Nummer des Gespraechs bestimmen - VOR dem Controller, damit sie
 * mit der Antwort zurueckgehen kann.
 *
 * Es wird hier noch nichts in die Datenbank geschrieben. Erst wenn
 * wirklich eine Antwort da ist, legt anhaengen() den Eintrag an.
 * Sonst entstuenden leere Gespraeche, sobald jemand die Seite nur
 * oeffnet.
 */
function nummerBestimmen(req) {
  const gewuenscht = req.body && req.body.chatId;
  if (gewuenscht && mongoose.Types.ObjectId.isValid(String(gewuenscht))) {
    return new mongoose.Types.ObjectId(String(gewuenscht));
  }
  return new mongoose.Types.ObjectId();
}

/**
 * Frage und Antwort an das Gespraech haengen. Legt es beim ersten Mal
 * an.
 *
 * Absichtlich ohne await aufrufbar - eine Suche darf nie auf das
 * Speichern warten.
 */
async function anhaengen({ nutzerId, chatId, frage, antwort }) {
  if (!nutzerId || !chatId) return;

  try {
    const jetzt = new Date();
    const neue = [];

    const gefragt = String(frage || '').trim();
    if (gefragt) neue.push({ wer: 'nutzer', text: gefragt, zeit: jetzt });

    if (antwort) {
      neue.push({
        wer: 'synora',
        text: String(antwort.response || antwort.message || ''),
        zeit: jetzt,
        daten: antwort
      });
    }

    if (!neue.length) return;

    // Der Filter enthaelt nutzerId: Eine fremde chatId trifft nichts
    // und kann darum auch nichts ueberschreiben.
    await Unterhaltung.findOneAndUpdate(
      { _id: chatId, nutzerId },
      {
        $setOnInsert: { nutzerId, erstellt: jetzt, titel: titelAus(gefragt) },
        $set: { zuletzt: jetzt },
        $push: { nachrichten: { $each: neue, $slice: -MAX_NACHRICHTEN } }
      },
      { upsert: true }
    );
  } catch (e) {
    console.warn('[unterhaltung] nicht gespeichert:', e.message);
  }
}

module.exports = { nummerBestimmen, anhaengen, titelAus };
`;

// ============================================
// C) Die Aenderungen an chat.js
// ============================================

const ALT_ROUTE =
`router.post('/', optionalAuth, sucheBremse, suchLimit, async (req, res, next) => {
  try {
    return await chatController.sendMessage(req, res, next);
  } catch (e) {
    next(e);
  }
});`;

const NEU_ROUTE =
`const unterhaltung = require('../services/unterhaltung');

router.post('/', optionalAuth, sucheBremse, suchLimit, async (req, res, next) => {
  try {
    // ---------- Gespraech mitschreiben ----------
    // Die Nummer wird VOR dem Controller bestimmt, damit sie mit der
    // Antwort zurueckgehen kann - das Frontend schickt sie bei der
    // naechsten Nachricht wieder mit, und alles landet im selben Chat.
    //
    // Das Abfangen von res.json faengt ALLE Ausgaenge des Controllers
    // ab: Rueckfrage, nichts gefunden, ueber Budget, gemeldete
    // Angebote und das normale Ergebnis. Darum muss chatController.js
    // nicht an fuenf Stellen geaendert werden.
    const nutzerId = req.user && (req.user._id || req.user.id);
    if (nutzerId) {
      const chatId = unterhaltung.nummerBestimmen(req);
      const frage = req.body && req.body.message;
      const urspruenglich = res.json.bind(res);

      res.json = (daten) => {
        const mitNummer =
          daten && typeof daten === 'object' && !Array.isArray(daten)
            ? { ...daten, chatId: String(chatId) }
            : daten;

        // Bewusst ohne await: die Antwort darf nicht auf die
        // Datenbank warten.
        unterhaltung.anhaengen({ nutzerId, chatId, frage, antwort: mitNummer });

        return urspruenglich(mitNummer);
      };
    }

    return await chatController.sendMessage(req, res, next);
  } catch (e) {
    next(e);
  }
});`;

const MUSS_DA_SEIN = [
  "require('../services/unterhaltung')",
  'unterhaltung.nummerBestimmen(req)',
  'unterhaltung.anhaengen(',
  "router.get('/history', requireAuth",
  "router.get('/history/:id', requireAuth",
  "router.delete('/history/:id', requireAuth"
];

// ============================================
// Die neuen Leserouten - ersetzen die alte /history
// ============================================

const NEUE_ROUTEN = `// ============================================
// VERLAUF - GET /api/chat/history
// ============================================
// Nur die Liste: Nummer, Titel, Zeitpunkt, Anzahl Nachrichten.
// Die Nachrichten selbst kommen erst beim Oeffnen - sonst zieht die
// Seitenleiste bei jedem Laden alle Produktdaten mit.
// ============================================
router.get('/history', requireAuth, async (req, res) => {
  try {
    const nutzerId = req.user && (req.user._id || req.user.id);
    if (!nutzerId) return res.json({ history: [] });

    const anzahl = Math.min(Math.max(Number(req.query.anzahl) || 30, 1), 100);

    const liste = await Unterhaltung.find({ nutzerId }, 'titel zuletzt erstellt nachrichten')
      .sort({ zuletzt: -1 })
      .limit(anzahl)
      .lean();

    res.json({
      history: liste.map((u) => ({
        id: String(u._id),
        titel: u.titel || 'Ohne Titel',
        zeit: u.zuletzt || u.erstellt,
        anzahl: (u.nachrichten || []).length
      }))
    });
  } catch (e) {
    // Ein kaputter Verlauf darf die Seite nicht kaputt machen.
    console.warn('[history] Liste nicht gelesen:', e.message);
    res.json({ history: [] });
  }
});

// ============================================
// EIN GESPRAECH - GET /api/chat/history/:id
// ============================================
// Liefert die Nachrichten so zurueck, wie sie gesendet wurden. Das
// Frontend spielt sie ab, statt sie nachzubauen.
// ============================================
router.get('/history/:id', requireAuth, async (req, res) => {
  try {
    const nutzerId = req.user && (req.user._id || req.user.id);
    if (!nutzerId) return res.status(404).json({ fehler: 'Nicht gefunden' });

    const u = await Unterhaltung.findOne({ _id: req.params.id, nutzerId }).lean();
    if (!u) return res.status(404).json({ fehler: 'Nicht gefunden' });

    res.json({
      id: String(u._id),
      titel: u.titel || 'Ohne Titel',
      zeit: u.zuletzt || u.erstellt,
      nachrichten: (u.nachrichten || []).map((n) => ({
        wer: n.wer,
        text: n.text || '',
        zeit: n.zeit,
        daten: n.daten || null
      }))
    });
  } catch (e) {
    console.warn('[history] Gespraech nicht gelesen:', e.message);
    res.status(404).json({ fehler: 'Nicht gefunden' });
  }
});

// ============================================
// LOESCHEN - DELETE /api/chat/history/:id
// ============================================
// Der Verlauf gehoert dem Nutzer. Er muss ihn wieder loswerden
// koennen, ohne jemanden zu fragen.
// ============================================
router.delete('/history/:id', requireAuth, async (req, res) => {
  try {
    const nutzerId = req.user && (req.user._id || req.user.id);
    if (!nutzerId) return res.status(404).json({ fehler: 'Nicht gefunden' });

    const weg = await Unterhaltung.deleteOne({ _id: req.params.id, nutzerId });
    if (!weg.deletedCount) return res.status(404).json({ fehler: 'Nicht gefunden' });

    res.json({ ok: true });
  } catch (e) {
    console.warn('[history] nicht geloescht:', e.message);
    res.status(500).json({ fehler: 'Nicht geloescht' });
  }
});`;

// ============================================

function zeitstempel() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}-${z(d.getMinutes())}`;
}

function zaehlen(h, n) {
  let z = 0;
  let i = h.indexOf(n);
  while (i !== -1) { z++; i = h.indexOf(n, i + n.length); }
  return z;
}

/**
 * Den alten /history-Handler finden: von "router.get('/history'" bis
 * zur ersten Zeile, die genau "});" ist. Robuster als ein langer
 * Textvergleich, weil der Handler heute schon zweimal geaendert wurde.
 */
function altenHandlerFinden(txt) {
  const start = txt.indexOf("router.get('/history'");
  if (start === -1) return null;
  const ende = txt.indexOf('\n});', start);
  if (ende === -1) return null;
  return { von: start, bis: ende + '\n});'.length };
}

function main() {
  console.log('');
  console.log('SYNORA - Unterhaltungen bauen');
  console.log('=============================');
  console.log('');

  if (!fs.existsSync(CHAT_JS)) {
    console.log(`ABBRUCH: ${CHAT_JS} nicht gefunden.`);
    console.log('Bist du im Ordner synora-backend-main?');
    process.exit(1);
  }

  const roh = fs.readFileSync(CHAT_JS, 'utf8');
  const hatCRLF = roh.includes('\r\n');
  let txt = roh.replace(/\r\n/g, '\n');

  console.log(`Datei:        ${CHAT_JS}`);
  console.log(`Groesse:      ${roh.length} Zeichen`);
  console.log(`Zeilenenden:  ${hatCRLF ? 'CRLF (Windows)' : 'LF'}`);
  console.log('');

  if (txt.includes("require('../services/unterhaltung')")) {
    console.log('Bereits gebaut. Es wird nichts geaendert.');
    process.exit(0);
  }

  // ---------- Pruefen ----------
  console.log('Pruefung:');
  let ok = true;

  const nRoute = zaehlen(txt, ALT_ROUTE);
  if (nRoute === 1) {
    console.log('  OK      1/3  Die POST-Route steht genau einmal in der Datei');
  } else {
    console.log(`  FEHLER  1/3  POST-Route ${nRoute} mal gefunden, erwartet: 1`);
    ok = false;
  }

  const stelle = altenHandlerFinden(txt);
  if (stelle) {
    console.log('  OK      2/3  Der alte /history-Handler wurde gefunden');
  } else {
    console.log('  FEHLER  2/3  Der alte /history-Handler wurde nicht gefunden');
    ok = false;
  }

  const altSuchProtokoll = "const SuchProtokoll = require('../models/SuchProtokoll');\n";
  if (zaehlen(txt, altSuchProtokoll) === 1) {
    console.log('  OK      3/3  Die alte SuchProtokoll-Einbindung wurde gefunden');
  } else {
    console.log('  FEHLER  3/3  Die alte SuchProtokoll-Einbindung fehlt oder ist mehrfach da');
    ok = false;
  }

  console.log('');
  if (!ok) {
    console.log('ABBRUCH. Es wurde NICHTS geaendert, auch keine neuen Dateien.');
    process.exit(1);
  }

  // ---------- Sicherung ----------
  const sicherung = `${CHAT_JS}.sicherung-${zeitstempel()}`;
  fs.copyFileSync(CHAT_JS, sicherung);
  console.log(`Sicherung:    ${sicherung}`);

  // ---------- Neue Dateien ----------
  for (const [pfad, inhalt] of [[MODELL, MODELL_INHALT], [DIENST, DIENST_INHALT]]) {
    fs.mkdirSync(path.dirname(pfad), { recursive: true });
    fs.writeFileSync(pfad, hatCRLF ? inhalt.replace(/\n/g, '\r\n') : inhalt, 'utf8');
    console.log(`Angelegt:     ${pfad}`);
  }

  // ---------- chat.js aendern ----------
  // 1. Einbindung austauschen
  txt = txt.replace(altSuchProtokoll, "const Unterhaltung = require('../models/Unterhaltung');\n");

  // 2. Alten /history-Handler ersetzen (Stelle neu suchen, der Text hat sich verschoben)
  const s2 = altenHandlerFinden(txt);
  txt = txt.slice(0, s2.von) + NEUE_ROUTEN + txt.slice(s2.bis);

  // 3. POST-Route umhuellen
  txt = txt.replace(ALT_ROUTE, NEU_ROUTE);

  if (hatCRLF) txt = txt.replace(/\n/g, '\r\n');
  fs.writeFileSync(CHAT_JS, txt, 'utf8');

  // ---------- Gegenprobe ----------
  const neu = fs.readFileSync(CHAT_JS, 'utf8');
  console.log('');
  console.log('Gegenprobe:');

  let probeOk = true;
  for (const s of MUSS_DA_SEIN) {
    const da = neu.includes(s);
    console.log(`  ${da ? 'OK     ' : 'FEHLT  '} ${s}`);
    if (!da) probeOk = false;
  }

  const wegSuch = !neu.includes("require('../models/SuchProtokoll')");
  console.log(`  ${wegSuch ? 'OK     ' : 'NOCH DA'} die alte SuchProtokoll-Einbindung ist raus`);
  if (!wegSuch) probeOk = false;

  const auf = zaehlen(neu, '{');
  const zu = zaehlen(neu, '}');
  console.log(`  ${auf === zu ? 'OK     ' : 'ACHTUNG'} geschweifte Klammern: ${auf} auf, ${zu} zu`);
  if (auf !== zu) probeOk = false;

  console.log('');
  if (probeOk) {
    console.log('FERTIG. Das Backend speichert und liefert jetzt ganze Gespraeche.');
    console.log('');
    console.log('WICHTIG: Die alten Eintraege aus dem Suchprotokoll sind damit');
    console.log('aus der Seitenleiste verschwunden - sie waren nie Gespraeche.');
    console.log('Die Liste faengt bei null an und fuellt sich ab dem naechsten Chat.');
  } else {
    console.log('ACHTUNG: Die Gegenprobe ist nicht sauber.');
    console.log(`Die alte Fassung liegt hier: ${sicherung}`);
    process.exit(1);
  }
  console.log('');
}

main();
