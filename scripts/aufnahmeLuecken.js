// ============================================
// SYNORA - Luecken in den Aufnahmen finden
// ============================================
// Beantwortet eine einzige Frage, aber die genau:
//
//   Welche Suchen wurden gestellt, ohne dass es dafuer eine
//   Aufnahme gibt?
//
// Im Abspielmodus liefert so eine Suche null Produkte. Der
// Pruefkatalog meldet dann "0 Produkte statt 3" - und das sieht
// aus wie ein Fehler im Code, obwohl nur die Aufnahme fehlt.
// Dieses Script unterscheidet die beiden Faelle.
//
// Ausserdem ist die Luecken-Liste genau die Einkaufsliste fuer
// den Tag, an dem wieder SerpAPI-Guthaben da ist: nur diese
// Begriffe muessen echt aufgenommen werden.
//
// Aufruf:
//   node scripts/aufnahmeLuecken.js              letzte 2 Stunden
//   node scripts/aufnahmeLuecken.js --stunden 24
//   node scripts/aufnahmeLuecken.js --alle       alle Protokolle
//
// Veraendert nichts.
// ============================================
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const ARG = process.argv.slice(2);
const ALLE = ARG.includes('--alle');
const S_INDEX = ARG.indexOf('--stunden');
const STUNDEN = S_INDEX >= 0 ? Math.max(1, Number(ARG[S_INDEX + 1]) || 2) : 2;

function titel(t) {
  console.log('\n' + '='.repeat(64));
  console.log('  ' + t);
  console.log('='.repeat(64));
}

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('\nMONGODB_URI fehlt in der .env.\n');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

    const SuchProtokoll = require('../src/models/SuchProtokoll');
    const Aufnahme = require('../src/models/Aufnahme');
    const cache = require('../src/services/cacheService');

    const filter = { 'anfrage.begriff': { $exists: true, $nin: [null, ''] } };
    if (!ALLE) filter.zeit = { $gte: new Date(Date.now() - STUNDEN * 3600 * 1000) };

    const protokolle = await SuchProtokoll.find(
      filter,
      'anfrage kandidaten rueckfrage zeit'
    ).sort({ zeit: -1 }).lean();

    titel(ALLE
      ? 'LUECKEN - alle Protokolle'
      : `LUECKEN - Suchen der letzten ${STUNDEN} Stunden`);

    if (!protokolle.length) {
      console.log('\n  Keine Suchen in diesem Zeitraum.');
      console.log('  Mit --stunden 24 oder --alle weiter zurueckschauen.\n');
      return;
    }

    // Je Begriff und Budget nur einmal schauen.
    //
    // ACHTUNG, hier steckte am 03.10.2026 ein Fehler drin:
    // Endet ein Durchlauf bei einer RUECKFRAGE, gibt es richtigerweise
    // keine Produkte - der Nutzer wurde ja erst etwas gefragt. Die
    // erste Fassung dieses Scripts hat solche Durchlaeufe als
    // "ECHTER FEHLER" gemeldet. Bei Pavinashs Lauf waren damit 2 von
    // 4 Meldungen falsch. Ein Werkzeug, das Fehler erfindet, ist
    // schlimmer als keins.
    //
    // Erkennbar ist der Fall daran, dass eine Frage gestellt, aber
    // keine Antwort mitgeschrieben wurde. Wurde geantwortet und
    // danach trotzdem nichts geliefert, ist es ein echter Fehler.
    //
    // Pro Begriff gewinnt der Durchlauf mit den MEISTEN Kandidaten:
    // derselbe Begriff taucht einmal als Rueckfrage und einmal als
    // fertige Suche auf, und die fertige zaehlt.
    const gesehen = new Map();
    for (const p of protokolle) {
      const begriff = p.anfrage.begriff;
      const budget = p.anfrage.budget ?? null;
      const schluessel = cache.schluesselBauen(begriff, budget, 'CH');

      const rf = p.rueckfrage || {};
      const nurRueckfrage = !!rf.gestellt && !rf.antwort;
      const gefunden = p.kandidaten ? p.kandidaten.length : 0;

      const vorher = gesehen.get(schluessel);
      if (!vorher) {
        gesehen.set(schluessel, {
          schluessel, begriff, budget, gefunden,
          nurRueckfrage,
          echteDurchlaeufe: nurRueckfrage ? 0 : 1,
          zeit: p.zeit,
          anzahlSuchen: 1
        });
        continue;
      }

      vorher.anzahlSuchen++;
      if (!nurRueckfrage) vorher.echteDurchlaeufe++;
      // Der ergiebigste Durchlauf zaehlt
      if (gefunden > vorher.gefunden) {
        vorher.gefunden = gefunden;
        vorher.nurRueckfrage = nurRueckfrage;
      } else if (!nurRueckfrage) {
        vorher.nurRueckfrage = false;
      }
    }

    // In einem Rutsch nachschlagen statt einzeln
    const schluessel = [...gesehen.keys()];
    const vorhanden = await Aufnahme.find(
      { schluessel: { $in: schluessel } },
      'schluessel anzahl quelle'
    ).lean();
    const nachSchluessel = new Map(vorhanden.map((a) => [a.schluessel, a]));

    const treffer = [];
    const luecken = [];
    for (const e of gesehen.values()) {
      const a = nachSchluessel.get(e.schluessel);
      if (a) treffer.push({ ...e, aufnahme: a });
      else luecken.push(e);
    }

    console.log(`\n  ${protokolle.length} Suchen, davon ${gesehen.size} verschiedene.\n`);
    console.log(`     ${String(treffer.length).padStart(4)}  mit Aufnahme`);
    console.log(`     ${String(luecken.length).padStart(4)}  OHNE Aufnahme  <- liefern im Abspielmodus nichts`);

    if (luecken.length) {
      console.log('\n  ' + '-'.repeat(60));
      console.log('  DIESE SUCHEN HABEN KEINE AUFNAHME');
      console.log('  ' + '-'.repeat(60));
      console.log('');
      console.log('  BEGRIFF                                   BUDGET   MAL');
      console.log('  ' + '-'.repeat(60));
      for (const l of luecken.slice(0, 40)) {
        console.log('  ' + String(l.begriff).slice(0, 40).padEnd(42)
          + String(l.budget ?? '-').padStart(6)
          + String(l.anzahlSuchen).padStart(6));
      }
      if (luecken.length > 40) console.log(`  ... und ${luecken.length - 40} weitere`);

      console.log('');
      console.log('  Das ist KEIN Fehler im Code. Im Abspielmodus gibt es');
      console.log('  zu diesen Begriffen nichts zu spielen, also kommen');
      console.log('  null Produkte zurueck - und der Pruefkatalog meldet');
      console.log('  "0 Produkte statt 3".');
      console.log('');
      console.log('  Zwei Wege:');
      console.log('    - Fragen stellen, zu denen es Aufnahmen gibt');
      console.log('      (node scripts/aufnahmeZeigen.js zeigt sie)');
      console.log('    - oder diese Begriffe echt aufnehmen, sobald');
      console.log('      wieder SerpAPI-Guthaben da ist:');
      console.log('          AUFNEHMEN=1  ABSPIELEN=0');
    }

    if (treffer.length) {
      console.log('\n  ' + '-'.repeat(60));
      console.log('  MIT AUFNAHME - hier zaehlt das Ergebnis wirklich');
      console.log('  ' + '-'.repeat(60));
      console.log('');
      console.log('  BEGRIFF                               BUDGET  AUFGEN.  GELIEFERT');
      console.log('  ' + '-'.repeat(62));
      for (const t of treffer.slice(0, 25)) {
        let hinweis = '';
        if (t.gefunden === 0 && t.nurRueckfrage) hinweis = '  (nur Rueckfrage, in Ordnung)';
        else if (t.gefunden === 0) hinweis = '  <- ECHTER FEHLER';
        console.log('  ' + String(t.begriff).slice(0, 36).padEnd(38)
          + String(t.budget ?? '-').padStart(6)
          + String(t.aufnahme.anzahl).padStart(9)
          + String(t.gefunden).padStart(11)
          + hinweis);
      }
      if (treffer.length > 25) console.log(`  ... und ${treffer.length - 25} weitere`);

      const echteFehler = treffer.filter((t) => t.gefunden === 0 && !t.nurRueckfrage);
      const nurGefragt = treffer.filter((t) => t.gefunden === 0 && t.nurRueckfrage);

      console.log('');
      if (nurGefragt.length) {
        console.log(`  ${nurGefragt.length} Durchlaeufe endeten bei einer Rueckfrage. Dass dort`);
        console.log('  keine Produkte stehen, ist richtig - es wurde ja erst');
        console.log('  nachgefragt. Das sind KEINE Fehler.');
        console.log('');
      }
      if (echteFehler.length) {
        console.log(`  ACHTUNG: ${echteFehler.length} Suchen hatten eine Aufnahme, wurden bis zum`);
        console.log('  Ende durchlaufen und haben trotzdem nichts geliefert.');
        console.log('  DAS sind echte Fehler - dort hat ein Filter, das Budget');
        console.log('  oder die Faktenpruefung alles weggeworfen.');
        console.log('');
        console.log('  Welche Stufe es war, zeigt dir:');
        for (const f of echteFehler.slice(0, 5)) {
          console.log(`      node scripts/sucheNachschauen.js "${String(f.begriff).slice(0, 40)}"`);
        }
      } else {
        console.log('  Jede vollstaendig durchlaufene Suche hat Produkte');
        console.log('  geliefert. Die Kette von der Aufnahme bis zur Antwort haelt.');
      }
    }

    console.log('');
  } catch (e) {
    console.error('\nFehler:', e.message, '\n');
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
})();