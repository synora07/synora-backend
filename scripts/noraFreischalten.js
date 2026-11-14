// ============================================
// SYNORA - Nora: Firma freischalten, stoppen, auflisten
// ============================================
// Die ersten Wochen laeuft die Freischaltung von Hand, mit Absicht
// (wie bei Kiara Plus). Spaeter macht das der Stripe-Webhook.
//
// Der Inhaber muss zuerst ein SYNORA-Konto haben (synora.li).
//
// Freischalten (legt die Firma an, falls es sie noch nicht gibt):
//   node scripts/noraFreischalten.js inhaber@firma.ch "Muster AG" pilot
//   node scripts/noraFreischalten.js inhaber@firma.ch "Muster AG" nora
//
// Abo beenden (Firma und Daten bleiben):
//   node scripts/noraFreischalten.js --stopp inhaber@firma.ch
//
// Alle Firmen mit Abo und ihr Verbrauch diesen Monat:
//   node scripts/noraFreischalten.js --liste
// ============================================

'use strict';

const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (_) {}
const mongoose = require('mongoose');

function hilfe() {
  console.log('');
  console.log('Aufruf:');
  console.log('  node scripts/noraFreischalten.js inhaber@firma.ch "Muster AG" pilot');
  console.log('  node scripts/noraFreischalten.js inhaber@firma.ch "Muster AG" nora');
  console.log('  node scripts/noraFreischalten.js --stopp inhaber@firma.ch');
  console.log('  node scripts/noraFreischalten.js --liste');
  console.log('');
}

(async () => {
  const args = process.argv.slice(2);
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) { console.log('\nMONGODB_URI fehlt in der .env.\n'); process.exit(1); }
  if (!args.length) { hilfe(); process.exit(1); }

  const { freischalten, stoppen, liste } = require(path.join(__dirname, '..', 'src', 'nora', 'services', 'freischalten.js'));

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

    if (args[0] === '--liste') {
      const firmen = await liste();
      console.log('');
      console.log(`Firmen mit Nora: ${firmen.length}`);
      for (const f of firmen) {
        const p = f.pruefungen;
        const x = f.experten;
        console.log(`  ${f.stufe.padEnd(6)} ${f.name.padEnd(30)} ${f.inhaber.padEnd(32)} ${f.personen} Pers.  ` +
          `Pruefungen ${p.verbraucht}/${p.limit}  Experten ${x.verbraucht}/${x.limit}  Kosten CHF ${f.kostenChf.toFixed(2)}`);
      }
      console.log('');
      return;
    }

    if (args[0] === '--stopp') {
      const { firma, vorher } = await stoppen({ email: args[1] });
      console.log('');
      console.log(`OK  "${firma.name}": Abo ${vorher || '-'}  ->  beendet. Die Daten der Firma bleiben.`);
      console.log('');
      return;
    }

    const [email, name, stufe] = args;
    const { firma, neu, vorher } = await freischalten({ email, name, stufe: String(stufe || '').trim().toLowerCase() });
    console.log('');
    if (neu) console.log(`OK  Neue Firma "${firma.name}" angelegt, Inhaber ${String(email).toLowerCase()}, Abo: ${firma.abo.stufe}`);
    else console.log(`OK  "${firma.name}": Abo ${vorher || '-'}  ->  ${firma.abo.stufe}`);
    console.log('    Nora gilt ab der naechsten Anfrage.');
    console.log('');
  } catch (e) {
    console.log('');
    console.log(e.code ? `NICHT GEMACHT (${e.code}): ${e.message}` : `Fehler: ${e.message}`);
    console.log('');
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
})();
