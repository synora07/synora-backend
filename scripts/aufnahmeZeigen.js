// ============================================
// SYNORA - Aufnahmen zeigen und pruefen
// ============================================
// Beantwortet drei Fragen, ohne irgendetwas zu veraendern:
//
//   1. Was ist aufgenommen, und reicht es zum Abspielen?
//   2. Lassen sich aus den Suchprotokollen Aufnahmen nachbauen?
//   3. Welche Felder stehen dort wirklich drin?
//
// Aufruf:
//   node scripts/aufnahmeZeigen.js              nur anschauen
//   node scripts/aufnahmeZeigen.js --protokoll  Suchprotokoll genau
//   node scripts/aufnahmeZeigen.js --loeschen   ALLE Aufnahmen weg
//
// Standard ist lesen. Geloescht wird nur auf ausdrueckliche Ansage.
// ============================================
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const ARGUMENTE = process.argv.slice(2);
const NUR_PROTOKOLL = ARGUMENTE.includes('--protokoll');
const LOESCHEN = ARGUMENTE.includes('--loeschen');

function titel(text) {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + text);
  console.log('='.repeat(60));
}

function zahl(n) {
  return String(n).padStart(6, ' ');
}

async function verbinden() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('\nMONGODB_URI fehlt in der .env. Ohne Datenbank geht hier nichts.\n');
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

// ============================================
// 1. AUFNAHMEN
// ============================================
async function aufnahmen() {
  const Aufnahme = require('../src/models/Aufnahme');

  const gesamt = await Aufnahme.countDocuments({});
  const echt = await Aufnahme.countDocuments({ quelle: 'serpapi' });
  const nachgebaut = gesamt - echt;

  titel('AUFNAHMEN');

  if (!gesamt) {
    console.log('\n  Keine Aufnahmen vorhanden.\n');
    console.log('  Das heisst: ABSPIELEN=1 findet nichts, und jede Suche');
    console.log('  meldet "nicht aufgenommen". Es wird dabei KEINE');
    console.log('  SerpAPI-Abfrage gestellt - es kostet also nichts, es');
    console.log('  liefert nur auch nichts.\n');
    console.log('  So fuellst du sie:');
    console.log('    1. in der .env:  AUFNEHMEN=1  und  ABSPIELEN=0');
    console.log('    2. node scripts/pruefkatalog.js     (kostet echtes Geld)');
    console.log('    3. in der .env:  AUFNEHMEN=0  und  ABSPIELEN=1');
    console.log('    4. ab jetzt beliebig oft pruefen, gratis\n');
    return gesamt;
  }

  console.log(`\n  ${zahl(gesamt)}  Aufnahmen insgesamt`);
  console.log(`  ${zahl(echt)}  davon echt (volle SerpAPI-Daten)`);
  if (nachgebaut) {
    console.log(`  ${zahl(nachgebaut)}  davon rekonstruiert (ohne Links und Bilder)`);
  }

  const summe = await Aufnahme.aggregate([
    { $group: { _id: null, produkte: { $sum: '$anzahl' }, spiele: { $sum: '$abspielungen' } } }
  ]);
  if (summe[0]) {
    console.log(`  ${zahl(summe[0].produkte)}  Produkte darin`);
    console.log(`  ${zahl(summe[0].spiele)}  Abspielungen bisher`);
  }

  const neueste = await Aufnahme.find({}, 'begriff budget anzahl quelle abspielungen aufgenommenAm')
    .sort({ aufgenommenAm: -1 }).limit(10).lean();

  console.log('\n  Die zehn neuesten:\n');
  console.log('  BEGRIFF                        BUDGET  PRODUKTE  GESPIELT  QUELLE');
  console.log('  ' + '-'.repeat(70));
  for (const a of neueste) {
    const b = String(a.begriff || '(leer)').slice(0, 28).padEnd(30);
    const bu = String(a.budget ?? '-').padStart(6);
    const an = String(a.anzahl || 0).padStart(9);
    const sp = String(a.abspielungen || 0).padStart(9);
    console.log(`  ${b}${bu}${an}${sp}  ${a.quelle}`);
  }
  console.log('');

  return gesamt;
}

// ============================================
// 2. SUCHPROTOKOLLE - taugen sie als Ersatz?
// ============================================
async function protokolle() {
  const SuchProtokoll = require('../src/models/SuchProtokoll');

  titel('SUCHPROTOKOLLE - taugen sie zum Nachbauen?');

  const gesamt = await SuchProtokoll.countDocuments({});
  console.log(`\n  ${zahl(gesamt)}  Protokolle insgesamt`);

  if (!gesamt) {
    console.log('\n  Keine Protokolle. Nichts nachzubauen.\n');
    return;
  }

  const mitBegriff = await SuchProtokoll.countDocuments({
    'anfrage.begriff': { $exists: true, $nin: [null, ''] }
  });
  const mitKandidaten = await SuchProtokoll.countDocuments({
    'kandidaten.0': { $exists: true }
  });
  const brauchbar = await SuchProtokoll.countDocuments({
    'anfrage.begriff': { $exists: true, $nin: [null, ''] },
    'kandidaten.0': { $exists: true }
  });

  console.log(`  ${zahl(mitBegriff)}  davon mit Suchbegriff`);
  console.log(`  ${zahl(mitKandidaten)}  davon mit Produkten`);
  console.log(`  ${zahl(brauchbar)}  davon mit BEIDEM  <- nur die zaehlen`);

  const verschiedene = await SuchProtokoll.distinct('anfrage.begriff', {
    'anfrage.begriff': { $nin: [null, ''] },
    'kandidaten.0': { $exists: true }
  });
  console.log(`  ${zahl(verschiedene.length)}  verschiedene Begriffe darunter`);

  if (!brauchbar) {
    console.log('\n  Aus diesen Protokollen laesst sich nichts nachbauen.');
    console.log('  Es bleibt beim Aufnehmen mit echtem Guthaben.\n');
    return;
  }

  // ---------- Was steht WIRKLICH in einem Kandidaten? ----------
  const beispiel = await SuchProtokoll.findOne(
    { 'anfrage.begriff': { $nin: [null, ''] }, 'kandidaten.0': { $exists: true } },
    'anfrage kandidaten treffer zeit'
  ).sort({ zeit: -1 }).lean();

  console.log('\n  Ein echtes Beispiel:\n');
  console.log(`    Begriff:  ${beispiel.anfrage?.begriff}`);
  console.log(`    Budget:   ${beispiel.anfrage?.budget ?? '-'}`);
  console.log(`    Treffer:  gesamt ${beispiel.treffer?.gesamt ?? '?'}, `
    + `nach Filter ${beispiel.treffer?.nachFilter ?? '?'}, `
    + `aufgeschrieben ${beispiel.kandidaten.length}`);

  console.log('\n    Erster Kandidat, Feld fuer Feld:');
  const k = beispiel.kandidaten[0] || {};
  for (const [feld, wert] of Object.entries(k)) {
    const w = typeof wert === 'string' ? wert.slice(0, 50) : wert;
    console.log(`      ${String(feld).padEnd(14)} ${JSON.stringify(w)}`);
  }

  // ---------- Das ehrliche Urteil ----------
  console.log('\n  Was dabei fehlt:\n');
  const braucht = [
    ['product_id', 'echte Google-ID', k.id && !/^p_\d+$/.test(String(k.id))],
    ['link', 'Link zum Shop', !!(k.link || k.url)],
    ['thumbnail', 'Produktbild', !!(k.thumbnail || k.bild)],
    ['priceValue', 'Preis als Zahl', typeof k.preis === 'number' || typeof k.priceValue === 'number'],
    ['title', 'Produktname', !!(k.titel || k.title)],
    ['source', 'Shopname', !!(k.shop || k.source)]
  ];
  for (const [feld, zweck, da] of braucht) {
    console.log(`      [${da ? 'ja ' : 'NEIN'}]  ${String(feld).padEnd(12)} ${zweck}`);
  }

  const fehlend = braucht.filter(([, , da]) => !da).map(([f]) => f);

  console.log('\n  Urteil:\n');
  if (!fehlend.length) {
    console.log('    Die Protokolle enthalten alles. Nachbauen lohnt sich.');
  } else {
    console.log(`    Es fehlen: ${fehlend.join(', ')}`);
    console.log('');
    console.log('    Nachgebaute Aufnahmen koennen damit pruefen:');
    console.log('      - Regel 1: erfindet ein Modell Preise?');
    console.log('      - hat jedes Produkt einen echten Nachteil?');
    console.log('      - Rueckfragen, Budgetgrenzen, Konsens der Modelle');
    console.log('');
    console.log('    Sie koennen NICHT pruefen:');
    console.log('      - ob die Links zum Shop funktionieren');
    console.log('      - ob Bilder angezeigt werden');
    console.log('      - ob die Klickzaehlung (/api/go) stimmt');
    console.log('');
    console.log('    Ausserdem sind die Kandidaten bereits gefiltert und');
    console.log('    auf 12 gekuerzt. Die Filterstufen selbst laufen beim');
    console.log('    Abspielen also ins Leere - sie werden nicht geprueft.');
  }
  console.log('');
}

// ============================================
// 3. LOESCHEN
// ============================================
async function loeschen() {
  const Aufnahme = require('../src/models/Aufnahme');

  titel('AUFNAHMEN LOESCHEN');
  const anzahl = await Aufnahme.countDocuments({});

  if (!anzahl) {
    console.log('\n  Es gibt nichts zu loeschen.\n');
    return;
  }

  console.log(`\n  ${anzahl} Aufnahmen werden geloescht.`);
  console.log('  Echte Aufnahmen kosten SerpAPI-Guthaben, wenn du sie');
  console.log('  neu erstellen musst.\n');
  console.log('  Abbruch mit Strg+C - es bleiben 5 Sekunden.\n');

  await new Promise((r) => setTimeout(r, 5000));

  const ergebnis = await Aufnahme.deleteMany({});
  console.log(`  ${ergebnis.deletedCount} Aufnahmen geloescht.\n`);
}

// ============================================
(async () => {
  try {
    await verbinden();

    if (LOESCHEN) {
      await loeschen();
    } else if (NUR_PROTOKOLL) {
      await protokolle();
    } else {
      const n = await aufnahmen();
      await protokolle();

      titel('KURZ');
      console.log('');
      console.log(`  ABSPIELEN steht auf:  ${process.env.ABSPIELEN || '(aus)'}`);
      console.log(`  AUFNEHMEN steht auf:  ${process.env.AUFNEHMEN || '(aus)'}`);
      console.log('');
      if (!n && (process.env.ABSPIELEN === '1' || process.env.ABSPIELEN === 'true')) {
        console.log('  ACHTUNG: Abspielen ist an, aber es gibt keine Aufnahmen.');
        console.log('  Jede Suche liefert leer. Es kostet nichts, aber es');
        console.log('  bringt auch nichts.');
        console.log('');
      }
    }
  } catch (e) {
    console.error('\nFehler:', e.message, '\n');
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
})();