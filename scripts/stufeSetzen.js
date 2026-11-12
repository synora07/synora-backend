// ============================================
// SYNORA - Kunden freischalten (Kiara Plus) und zurueckstellen
// ============================================
// Die ersten Tage laeuft die Freischaltung von Hand, mit Absicht:
// Ein Stripe-Webhook, an einem Abend ohne Test gebaut, ist genau die
// Luecke, ueber die jeder dem Server "bezahlt" melden kann.
//
// Ablauf:
//   1. Stripe schickt dir eine Mail: neues Abo, mit der Mailadresse.
//   2. Du tippst:  node scripts/stufeSetzen.js kunde@mail.ch kiara_plus
//   3. Fertig. Die naechste Suche des Kunden hat 55 statt 3.
//
// Kuendigt jemand (Stripe meldet das auch per Mail), am Ende des
// bezahlten Monats:
//      node scripts/stufeSetzen.js kunde@mail.ch kiara
//
// Alle Zahler anzeigen:
//      node scripts/stufeSetzen.js --liste
//
// Aendert NUR das Feld "stufe" eines einzigen Kontos. Sonst nichts.
// ============================================

'use strict';

const path = require('path');
try { require('dotenv').config(); } catch (_) {}
const mongoose = require('mongoose');

const ERLAUBT = ['kiara', 'kiara_plus', 'nora'];

function hilfe() {
  console.log('');
  console.log('Aufruf:');
  console.log('  node scripts/stufeSetzen.js kunde@mail.ch kiara_plus   freischalten');
  console.log('  node scripts/stufeSetzen.js kunde@mail.ch kiara        zurueck auf gratis');
  console.log('  node scripts/stufeSetzen.js --liste                    alle Zahler zeigen');
  console.log('');
}

(async () => {
  const [a, b] = process.argv.slice(2);
  const liste = a === '--liste';
  const email = liste ? null : String(a || '').trim().toLowerCase();
  const stufe = liste ? null : String(b || '').trim().toLowerCase();

  if (!liste) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.log('\nKeine gueltige Mailadresse.'); hilfe(); process.exit(1); }
    if (!ERLAUBT.includes(stufe)) { console.log(`\nStufe muss eine von diesen sein: ${ERLAUBT.join(', ')}`); hilfe(); process.exit(1); }
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) { console.log('\nMONGODB_URI fehlt in der .env.\n'); process.exit(1); }

  const mod = require(path.join(__dirname, '..', 'src', 'models', 'User.js'));
  const User = mod && mod.modelName ? mod : (mod && mod.User) || mod;

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

    if (liste) {
      const zahler = await User.find({ stufe: { $in: ['kiara_plus', 'nora'] } })
        .select('email stufe stufeGeaendert').sort({ stufeGeaendert: -1 }).lean();
      console.log('');
      console.log(`Zahler: ${zahler.length}`);
      for (const z of zahler) {
        const seit = z.stufeGeaendert ? new Date(z.stufeGeaendert).toLocaleString('de-CH') : '-';
        console.log(`  ${String(z.stufe).padEnd(11)} ${z.email.padEnd(36)} seit ${seit}`);
      }
      console.log('');
      return;
    }

    const nutzer = await User.findOne({ email }).select('email stufe').lean();
    if (!nutzer) {
      console.log(`\nKein Konto mit ${email} gefunden.`);
      console.log('Hat sich die Person bei synora.li mit derselben Mailadresse registriert');
      console.log('wie bei Stripe? Wenn nicht: kurz nachfragen, dann mit der richtigen Adresse.\n');
      process.exitCode = 1;
      return;
    }

    const vorher = nutzer.stufe || 'kiara';
    if (vorher === stufe) {
      console.log(`\n${email} ist schon ${stufe}. Nichts geaendert.\n`);
      return;
    }

    const r = await User.updateOne(
      { _id: nutzer._id },
      { $set: { stufe, stufeGeaendert: new Date() } },
      { runValidators: true }
    );
    const nachher = await User.findById(nutzer._id).select('stufe').lean();

    console.log('');
    if (r.modifiedCount === 1 && nachher && nachher.stufe === stufe) {
      console.log(`OK  ${email}:  ${vorher}  ->  ${stufe}`);
      if (stufe !== 'kiara') console.log('    Die naechste Suche gilt schon mit der neuen Grenze.');
    } else {
      console.log(`NICHT GEAENDERT. Bitte die Ausgabe schicken. (modifiziert: ${r.modifiedCount})`);
      process.exitCode = 1;
    }
    console.log('');
  } catch (e) {
    console.log('\nFehler: ' + e.message + '\n');
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
})();
