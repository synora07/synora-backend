// ============================================
// SYNORA - Preisalarme pruefen (Wochenlauf)
// ============================================
// Aufruf:  node scripts/preisalarmPruefen.js
//          node scripts/preisalarmPruefen.js --trocken
//
// --trocken laeuft ohne SerpAPI und ohne Mails. Es zeigt nur, WAS
// passieren wuerde: wie viele Alarme faellig sind, auf wie viele
// Abfragen sie sich buendeln und was das kosten wird. Damit kannst
// du den Lauf pruefen, ohne einen Rappen auszugeben.
//
// EINMAL PRO WOCHE, nicht taeglich. Ein Preis aendert sich nicht
// stuendlich, und taeglich kostet das Siebenfache.
//
// AUF RAILWAY einrichten als Cron:  0 7 * * 1
// (Montag morgens um sieben)
//
// LOKAL zum Ausprobieren einfach von Hand starten.
// ============================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const TROCKEN = process.argv.includes('--trocken');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI fehlt in der .env');
    process.exit(1);
  }

  if (TROCKEN) {
    // Nichts verschicken, nichts abfragen, nichts bezahlen.
    process.env.MAIL_ANBIETER = 'aus';
    process.env.PUSH_AKTIV = 'false';
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('[DB] verbunden');
  } catch (e) {
    console.error('[DB] Verbindung fehlgeschlagen:', e.message);
    process.exit(1);
  }

  const PreisAlarm = require('../src/models/PreisAlarm');
  const preisAlarm = require('../src/services/preisAlarmService');

  const start = Date.now();

  try {
    if (TROCKEN) {
      await trockenlauf(PreisAlarm, preisAlarm);
    } else {
      const bericht = await preisAlarm.pruefeAlle();
      zeigeBericht(bericht);
    }
  } catch (e) {
    console.error('Abgebrochen:', e.message);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }

  console.log(`\nDauer: ${Math.round((Date.now() - start) / 1000)} Sekunden`);
  await mongoose.connection.close().catch(() => {});
  process.exit(0);
}

// ============================================
// Trockenlauf: zeigen, was es kosten wuerde
// ============================================

async function trockenlauf(PreisAlarm, preisAlarm) {
  const grenze = new Date(Date.now() - preisAlarm.TAKT_TAGE * 86400000);

  const faellig = await PreisAlarm.find({
    aktiv: true,
    $or: [{ zuletztGeprueft: null }, { zuletztGeprueft: { $lt: grenze } }]
  }).lean();

  const produkte = new Set(faellig.map((a) => a.produktId));
  const preis = Number(process.env.KOSTEN_QUALITAET) || 0.14;

  console.log('\n========================================');
  console.log('  TROCKENLAUF - es wird nichts abgefragt');
  console.log('========================================');
  console.log(`  faellige Alarme:        ${faellig.length}`);
  console.log(`  verschiedene Produkte:  ${produkte.size}`);
  console.log(`  noetige Abfragen:       ${produkte.size}`);
  console.log(`  gespart durch Buendeln: ${faellig.length - produkte.size}`);
  console.log(`  Kosten:                 CHF ${(produkte.size * preis).toFixed(2)}`);

  if (faellig.length) {
    const ohneBuendeln = (faellig.length * preis).toFixed(2);
    console.log(`  ohne Buendelung waeren es CHF ${ohneBuendeln}`);
  }
  console.log('========================================');

  if (!faellig.length) {
    console.log('\n  Nichts faellig. Entweder gibt es noch keine Alarme,');
    console.log(`  oder alle wurden in den letzten ${preisAlarm.TAKT_TAGE} Tagen geprueft.`);
  }
}

function zeigeBericht(b) {
  console.log('\n========================================');
  if (b.fehler) {
    console.log('  ' + b.fehler);
  } else {
    console.log(`  ${b.produkte} Abfragen fuer ${b.alarme} Alarme`);
    console.log(`  ${b.gespart} Abfragen durch Buendelung gespart`);
    console.log(`  ${b.gemeldet} Nutzer benachrichtigt`);
    if (b.gestoppt) {
      console.log('');
      console.log(`  ACHTUNG: abgebrochen (${b.gestoppt})`);
      console.log('  Die Kostenbremse hat den Lauf gestoppt. Die restlichen');
      console.log('  Alarme werden beim naechsten Lauf geprueft.');
    }
  }
  console.log('========================================');
}

main().catch((e) => {
  console.error('Abgebrochen:', e.message);
  process.exit(1);
});