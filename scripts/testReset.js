// ============================================
// SYNORA - Zaehler fuers Testen zuruecksetzen
// ============================================
// Aufruf:  node scripts/testReset.js
//          node scripts/testReset.js --cache
//
// Setzt die Tageslimits zurueck, damit du weitertesten kannst.
// Mit --cache wird zusaetzlich der Suchcache geleert - noetig,
// wenn du Regeln geaendert hast und die alte Bewertung nicht
// mehr sehen willst.
//
// NUR ZUM ENTWICKELN. Auf dem Server hat dieses Skript nichts
// verloren - deshalb bricht es ab, wenn NODE_ENV auf production
// steht.
// ============================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const AUCH_CACHE = process.argv.includes('--cache');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Abbruch: Dieses Skript ist nur zum Entwickeln gedacht.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI fehlt in der .env');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  // ---------- Gastzaehler ----------
  const gaeste = await db.collection('gastzaehlers').deleteMany({});
  console.log(`Gastzaehler geleert:       ${gaeste.deletedCount}`);

  // ---------- Konten ----------
  const konten = await db.collection('users').updateMany({}, { $set: { suchen_heute: 0 } });
  console.log(`Konten zurueckgesetzt:     ${konten.modifiedCount}`);

  // ---------- Cache, nur auf Wunsch ----------
  if (AUCH_CACHE) {
    const cache = await db.collection('suchcaches').deleteMany({});
    console.log(`Suchcache geleert:         ${cache.deletedCount}`);
  } else {
    console.log('Suchcache behalten         (mit --cache auch leeren)');
  }

  console.log('\nBereit zum Testen.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Fehlgeschlagen:', e.message);
  console.error('Bei Verbindungsfehlern einfach nochmal ausfuehren.');
  process.exit(1);
});