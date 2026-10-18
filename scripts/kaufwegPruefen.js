// ============================================
// SYNORA - prueft den Kaufweg der Alarmmails
// ============================================
// WARUM ES DIESES SKRIPT GIBT
//
// Ich habe den Preisalarm so geaendert, dass seine Mails ueber
// /api/go gehen statt direkt zum Shop. Nur so gibt es Provision
// und eine Klickzaehlung.
//
// Dafuer muss der Alarm einen Eintrag in ProduktKlick anlegen.
// Diese Datei - src/models/ProduktKlick.js - hatte ich nie
// gesehen. Ich habe die Felder aus chatController.js
// abgeschrieben, wo dasselbe gemacht wird. Das ist ein guter
// Anhaltspunkt, aber kein Beweis.
//
// Deshalb dieses Skript: Es legt genau so einen Eintrag an, wie
// der Preisalarm es tun wird, und sagt dir, ob es klappt. Danach
// raeumt es ihn wieder weg.
//
// WARUM NICHT EINFACH ABWARTEN
// Weil der Fehler still waere. Geht das Anlegen schief, schickt
// der Alarm die Mail trotzdem - nur eben mit dem direkten Link,
// also ohne Provision. Alles saehe aus wie vorher, du haeltst
// es fuer repariert, und es kommt trotzdem kein Geld an.
//
// ============================================
// SO BENUTZT DU ES
// ============================================
//   node scripts/kaufwegPruefen.js
//
// Es schreibt EINEN Testeintrag in die Datenbank und loescht ihn
// sofort wieder. An deinen Daten aendert sich nichts.
// ============================================

require('dotenv').config();
const mongoose = require('mongoose');

const TESTNAME = '__TEST_KAUFWEG__ bitte ignorieren';

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('\nMONGODB_URI fehlt in der .env.\n');
    process.exit(1);
  }

  // ---------- 1. Gibt es das Modell ueberhaupt? ----------
  let ProduktKlick;
  try {
    ProduktKlick = require('../src/models/ProduktKlick');
  } catch (e) {
    console.error(
      '\nFEHLER: src/models/ProduktKlick.js nicht gefunden.\n' +
      '  ' + e.message + '\n\n' +
      'Ohne dieses Modell kann auch die SUCHE keine Klicks zaehlen.\n' +
      'Dann stimmt etwas Grundsaetzliches nicht.\n'
    );
    process.exit(1);
  }

  if (typeof ProduktKlick.neueKurzId !== 'function') {
    console.error(
      '\nFEHLER: ProduktKlick.neueKurzId() gibt es nicht.\n' +
      'Der Preisalarm und der Chat brauchen diese Funktion beide.\n'
    );
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('Datenbank verbunden.\n');

  const kurzId = ProduktKlick.neueKurzId();
  console.log('Lege einen Testeintrag an, genau wie der Preisalarm es tut:');
  console.log('  kurzId          ' + kurzId);

  // ---------- 2. Genau die Felder, die preisAlarmService schreibt ----------
  const eintrag = {
    kurzId,
    token: 'TESTTOKEN_ohne_funktion',
    googleProduktId: null,
    produktName: TESTNAME,
    angezeigterPreis: 'CHF 1',
    angezeigterPreisWert: 1,
    angezeigterShop: 'Testshop',
    sucheId: null,
    suchanfrage: '',
    budget: null,
    rang: 1,
    nutzer: null
  };

  let angelegt = null;
  try {
    angelegt = await ProduktKlick.create(eintrag);
  } catch (e) {
    console.error('\n' + '='.repeat(58));
    console.error('ES KLAPPT NICHT. Der Preisalarm wuerde hier scheitern.\n');
    console.error('  ' + e.message + '\n');

    if (e.errors) {
      console.error('Diese Felder macht das Modell Probleme:');
      for (const [feld, fehler] of Object.entries(e.errors)) {
        console.error(`  ${feld}: ${fehler.message}`);
      }
    }
    console.error(
      '\nSchick mir src/models/ProduktKlick.js, dann passe ich den\n' +
      'Preisalarm an die echten Feldnamen an.\n'
    );
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }

  console.log('  Eintrag angelegt\n');

  // ---------- 3. Laesst er sich wiederfinden? ----------
  const gefunden = await ProduktKlick.findOne({ kurzId });
  if (!gefunden) {
    console.error('FEHLER: Eintrag angelegt, aber nicht wiederzufinden.');
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
  console.log('  Wiedergefunden ueber kurzId');
  console.log('  Token kam an:  ' + (gefunden.token === eintrag.token ? 'ja' : 'NEIN'));

  // ---------- 4. Aufraeumen ----------
  await ProduktKlick.deleteOne({ _id: angelegt._id });
  const weg = !(await ProduktKlick.findOne({ kurzId }));
  console.log('  Testeintrag wieder geloescht: ' + (weg ? 'ja' : 'NEIN - bitte von Hand entfernen'));

  // ---------- 5. Wie sieht der Link aus? ----------
  const basis = process.env.API_BASE_URL || 'http://localhost:5000';
  console.log('\n' + '='.repeat(58));
  console.log('ES KLAPPT. Deine Alarmmails bekommen ab jetzt Links wie:\n');
  console.log('  ' + basis + '/api/go/' + kurzId + '\n');

  if (!process.env.API_BASE_URL) {
    console.log('ACHTUNG: API_BASE_URL fehlt in deiner .env.');
    console.log('Bis dahin steht "http://localhost:5000" in jeder Mail -');
    console.log('das fuehrt beim Empfaenger ins Leere, weil es SEIN');
    console.log('Rechner ist, nicht deiner.\n');
    console.log('Vor dem Start eintragen:');
    console.log('  API_BASE_URL=https://api.synora.li\n');
  }

  await mongoose.connection.close().catch(() => {});
}

main().catch(async (e) => {
  console.error('\nUnerwarteter Fehler: ' + e.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});