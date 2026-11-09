// ============================================
// SYNORA - Konto auf Premium setzen
// ============================================
// GRUND, am 08.11.2026:
// Nach der Tippfehler-Reparatur sollte sie live geprueft werden. Die
// Suche brach ab mit:
//
//   "Du hast deine 5 Suchen diesen Monat gebraucht."
//
// Der Betreiber kann sein eigenes Produkt nicht pruefen. Das haelt bei
// jeder weiteren Aenderung auf.
//
// ============================================
// WARUM NICHT ANDERS
// ============================================
// TEST_TOKEN waere der naheliegende Weg - und ist bewusst versperrt:
//
//   limits.js:106   if (process.env.NODE_ENV === 'production') return false;
//   server.js:117   'TEST_TOKEN ist in Produktion gesetzt - vor dem Start entfernen'
//
// Das ist richtig gebaut und bleibt so. Wer diese Sperre oeffnet,
// schenkt jedem, der den Token je zu sehen bekommt, unbegrenzte Suchen.
//
// SUCHEN_KONTO in Railway hochsetzen waere der zweite Gedanke - und
// trifft ALLE. Bei 250 SerpAPI-Abfragen im Monat waere das Kontingent
// nach ein paar Besuchern leer. Die Grenze schuetzt nicht die Nutzer,
// sie schuetzt das Budget.
//
// Bleibt der ehrliche Weg: das eigene Konto auf Premium. Das ist keine
// Umgehung, das ist die Wahrheit - der Betreiber hat Premium.
//
// Premium heisst nach suchLimit.js:96 fuenfzehn Suchen im Monat. Nicht
// unbegrenzt. Geh trotzdem sparsam damit um: jede Suche kostet eine
// SerpAPI-Abfrage von 250 im Monat, ausser sie kommt aus dem Cache.
//
// ============================================
// WAS DAS WERKZEUG TUT
// ============================================
//   - liest die Zugangsdaten aus der .env, zeigt sie NIE an
//   - sucht das Konto zur angegebenen E-Mail
//   - zeigt den Stand VORHER
//   - setzt die Premium-Felder, die es im Datenmodell wirklich gibt
//   - zeigt den Stand NACHHER
//
// Es aendert genau ein Konto und sonst nichts. Kein Loeschen.
//
// ============================================
// AUFRUF
// ============================================
// Im Ordner synora-backend-main, E-Mail als Angabe dahinter:
//
//   node premiumSetzen.js deine@mail.ch
//
// Wieder abschalten:
//
//   node premiumSetzen.js deine@mail.ch --aus
//
// Nur nachschauen, ohne etwas zu aendern:
//
//   node premiumSetzen.js deine@mail.ch --nurschauen
// ============================================

'use strict';

const path = require('path');

// ---------- .env laden ----------
try {
  require('dotenv').config();
} catch (e) {
  console.log('');
  console.log('ABBRUCH: dotenv laesst sich nicht laden.');
  console.log('Bist du im Ordner synora-backend-main?');
  process.exit(1);
}

const EMAIL = (process.argv[2] || '').trim();
const AUS = process.argv.includes('--aus');
const NUR_SCHAUEN = process.argv.includes('--nurschauen');

// Die drei Felder, die suchLimit.js:206 abfragt.
const FELDER = ['istPremium', 'premium', 'plan'];

function zeigeStand(doc, titel) {
  console.log(`  ${titel}`);
  let etwas = false;
  for (const f of FELDER) {
    if (doc[f] !== undefined) {
      console.log(`    ${f.padEnd(12)} = ${JSON.stringify(doc[f])}`);
      etwas = true;
    }
  }
  if (!etwas) console.log('    (keines der Premium-Felder ist gesetzt)');
}

async function main() {
  console.log('');
  console.log('SYNORA - Konto auf Premium setzen');
  console.log('=================================');
  console.log('');

  if (!EMAIL || EMAIL.startsWith('--')) {
    console.log('ABBRUCH: Es fehlt die E-Mail.');
    console.log('');
    console.log('So geht es:');
    console.log('  node premiumSetzen.js deine@mail.ch');
    console.log('  node premiumSetzen.js deine@mail.ch --aus');
    console.log('  node premiumSetzen.js deine@mail.ch --nurschauen');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
  if (!uri) {
    console.log('ABBRUCH: In der .env steht keine MONGODB_URI.');
    console.log('Gesucht wurde nach: MONGODB_URI, MONGO_URI, DATABASE_URL');
    process.exit(1);
  }

  let mongoose;
  try {
    mongoose = require('mongoose');
  } catch (e) {
    console.log('ABBRUCH: mongoose laesst sich nicht laden.');
    process.exit(1);
  }

  // ---------- Verbinden ----------
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  } catch (e) {
    console.log(`ABBRUCH: Keine Verbindung zur Datenbank. ${e.message}`);
    process.exit(1);
  }

  // Der Name der Datenbank, damit du siehst, WO geaendert wird.
  // Die Zugangsdaten selbst werden nie ausgegeben.
  console.log(`Datenbank:    ${mongoose.connection.name}`);
  console.log(`Konto:        ${EMAIL}`);
  console.log('');

  // ---------- Datenmodell laden ----------
  let User;
  try {
    User = require(path.resolve('src', 'models', 'User.js'));
  } catch (e) {
    console.log(`ABBRUCH: src/models/User.js laesst sich nicht laden. ${e.message}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // Welche der drei Felder kennt das Datenmodell ueberhaupt? Felder, die
  // es nicht gibt, wuerde Mongoose beim Speichern stillschweigend
  // verwerfen - dann waere die Ausgabe eine Luege.
  const vorhanden = FELDER.filter((f) => !!User.schema.path(f));
  console.log(`Das Datenmodell kennt: ${vorhanden.length ? vorhanden.join(', ') : '(keines der drei Felder!)'}`);

  if (!vorhanden.length) {
    console.log('');
    console.log('ABBRUCH: Keines der drei Felder aus suchLimit.js:206 steht im');
    console.log('Datenmodell. Premium laesst sich so nicht setzen - schick');
    console.log('diese Ausgabe weiter, dann sehen wir uns User.js an.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log('');

  // ---------- Konto suchen ----------
  const nutzer = await User.findOne({ email: EMAIL });
  if (!nutzer) {
    console.log(`ABBRUCH: Kein Konto mit der E-Mail ${EMAIL} gefunden.`);
    console.log('Achte auf Gross- und Kleinschreibung.');
    await mongoose.disconnect();
    process.exit(1);
  }

  zeigeStand(nutzer, 'VORHER:');
  console.log('');

  if (NUR_SCHAUEN) {
    console.log('--nurschauen: es wurde nichts geaendert.');
    await mongoose.disconnect();
    return;
  }

  // ---------- Setzen ----------
  for (const f of vorhanden) {
    if (f === 'plan') nutzer.plan = AUS ? 'frei' : 'premium';
    else nutzer[f] = !AUS;
  }
  await nutzer.save();

  // Frisch aus der Datenbank lesen, nicht aus dem Arbeitsspeicher -
  // sonst zeigt die Gegenprobe nur, was wir hineingeschrieben haben
  // wollten, und nicht, was wirklich drinsteht.
  const neu = await User.findOne({ email: EMAIL });
  zeigeStand(neu, 'NACHHER:');
  console.log('');

  // ---------- Gegenprobe ----------
  let ok = true;
  for (const f of vorhanden) {
    const soll = f === 'plan' ? (AUS ? 'frei' : 'premium') : !AUS;
    if (neu[f] !== soll) {
      console.log(`  FEHLER  ${f} steht auf ${JSON.stringify(neu[f])}, erwartet war ${JSON.stringify(soll)}`);
      ok = false;
    }
  }

  if (ok) {
    console.log(AUS
      ? 'FERTIG. Das Konto ist wieder ein normales Konto.'
      : 'FERTIG. Das Konto hat jetzt Premium: 15 Suchen im Monat.');
    if (!AUS) {
      console.log('');
      console.log('Zum Zurueckdrehen:');
      console.log(`  node premiumSetzen.js ${EMAIL} --aus`);
      console.log('');
      console.log('Geh sparsam damit um: jede Suche kostet eine SerpAPI-Abfrage');
      console.log('von 250 im Monat, ausser sie kommt aus dem Cache.');
    }
  } else {
    console.log('ACHTUNG: Die Gegenprobe stimmt nicht. Schick die Ausgabe weiter.');
  }

  console.log('');
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.log('');
  console.log(`ABBRUCH durch einen Fehler: ${e.message}`);
  try { await require('mongoose').disconnect(); } catch (_) {}
  process.exit(1);
});
