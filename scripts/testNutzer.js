// ============================================
// SYNORA - Mailadresse des Testnutzers aendern
// ============================================
// Dein einziges Konto hat die Adresse test@synora.li. Die Domain
// gehoert dir, aber ein Postfach gibt es dort nicht. Jede Testmail
// geht also raus und verschwindet - du siehst nie, was ein Nutzer
// wirklich bekommt.
//
// Dieses Skript setzt die Adresse auf eine, die du lesen kannst.
//
// Aufruf:
//   node scripts/testNutzer.js                      nur anzeigen
//   node scripts/testNutzer.js synorach@gmail.com   aendern
//
// Ohne Adresse wird nichts veraendert.
// ============================================
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const ZIEL = process.argv.slice(2).find((a) => a.includes('@')) || null;

function titel(t) {
  console.log('\n' + '='.repeat(58));
  console.log('  ' + t);
  console.log('='.repeat(58) + '\n');
}

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('\nMONGODB_URI fehlt in der .env.\n');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const User = require('../src/models/User');

    const nutzer = await User.find({}, 'email premium istPremium erstelltAm createdAt').lean();

    titel('KONTEN IN DER DATENBANK');

    if (!nutzer.length) {
      console.log('  Keine Konten vorhanden.\n');
      return;
    }

    for (const n of nutzer) {
      const premium = n.premium || n.istPremium ? 'Premium' : 'Gratis';
      console.log('  ' + String(n.email || '(ohne Adresse)').padEnd(32) + premium);
    }
    console.log('');

    if (!ZIEL) {
      console.log('  Es wurde nichts geaendert.\n');
      console.log('  Zum Aendern eine Adresse angeben, zum Beispiel:');
      console.log('      node scripts/testNutzer.js synorach@gmail.com\n');
      console.log('  Sinnvoll ist eine Adresse, die du lesen kannst -');
      console.log('  sonst siehst du bei keinem Test, was wirklich ankommt.\n');
      return;
    }

    if (nutzer.length > 1) {
      console.log('  Es gibt mehr als ein Konto. Dieses Skript aendert nur,');
      console.log('  wenn genau eines da ist - sonst waere nicht klar, welches.\n');
      console.log('  Von Hand aendern, zum Beispiel in MongoDB Compass.\n');
      return;
    }

    const alt = nutzer[0].email;
    if (alt === ZIEL) {
      console.log(`  Die Adresse ist schon ${ZIEL}. Nichts zu tun.\n`);
      return;
    }

    await User.updateOne({ _id: nutzer[0]._id }, { $set: { email: ZIEL } });

    titel('GEAENDERT');
    console.log(`  ${alt}`);
    console.log(`      ->  ${ZIEL}\n`);
    console.log('  Ab jetzt gehen Testmails dorthin. Probier es aus:');
    console.log('      node scripts/testPreisalarm.js\n');
    console.log('  Das schickt dir eine echte Preisalarm-Mail mit einem');
    console.log('  echten Produkt - genau die, die deine Nutzer bekommen.\n');

  } catch (e) {
    console.error('\nFehler:', e.message, '\n');
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
})();