// ============================================
// SYNORA - Preisalarm von Anfang bis Ende pruefen
// ============================================
// Laesst die ECHTE Kette laufen - buendeln, Treffer erkennen,
// Meldesperre, benachrichtigen - und ersetzt nur die eine Stelle,
// die Geld kostet: die SerpAPI-Abfrage.
//
// Moeglich ist das, weil pruefeAlle({ suchen }) eine eigene
// Suchfunktion annimmt. Statt SerpAPI liefert hier deine eigene
// Preisverlauf-Sammlung die Preise. Echte Produkte, echte Shops,
// echte Zahlen - nur eben aus der Datenbank statt von Google.
//
// WAS DAS KOSTET
//   SerpAPI:  nichts.
//   Modelle:  nichts.
//   Mail:     nichts (bei MAIL_ANBIETER=aus nur ein Logeintrag).
//   Aber: pruefeAlle fragt die Kostenbremse, und die BUCHT. Ein
//   Durchlauf mit einem Produkt verbucht rund CHF 0.14, obwohl
//   nichts ausgegeben wurde. Das Skript zeigt dir den Stand
//   vorher und nachher, damit du es einordnen kannst.
//
// Aufruf:
//   node scripts/testPreisalarm.js
//
// Der Testalarm wird am Ende IMMER wieder geloescht, auch wenn
// unterwegs etwas schiefgeht. Deine echten Alarme bleiben unberuehrt.
// ============================================
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

function titel(t) {
  console.log('\n' + '='.repeat(62));
  console.log('  ' + t);
  console.log('='.repeat(62) + '\n');
}

function stufe(name, ok, zusatz = '') {
  const z = ok === true ? '[ok]    ' : ok === false ? '[FEHLER]' : '[  --  ]';
  console.log('  ' + z + ' ' + String(name).padEnd(34) + zusatz);
}

function franken(n) {
  return 'CHF ' + Number(n).toFixed(2);
}

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('\nMONGODB_URI fehlt in der .env.\n');
    process.exit(1);
  }

  let testAlarmId = null;
  let PreisAlarm = null;

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

    PreisAlarm = require('../src/models/PreisAlarm');
    const PreisVerlauf = require('../src/models/PreisVerlauf');
    const Aufnahme = require('../src/models/Aufnahme');
    const dienst = require('../src/services/preisAlarmService');
    const kostenbremse = require('../src/services/kostenbremse');
    const benachrichtigung = require('../src/services/benachrichtigung');
    const User = require('../src/models/User');

    titel('VORBEREITUNG');

    // ---------- Keine echten Alarme stoeren ----------
    const echteAlarme = await PreisAlarm.countDocuments({ aktiv: true });
    stufe('bestehende aktive Alarme', null, String(echteAlarme));
    if (echteAlarme > 0) {
      console.log('\n  ACHTUNG: Es gibt schon aktive Alarme. pruefeAlle() nimmt');
      console.log('  sich ALLE faelligen vor, nicht nur den Testalarm. Das');
      console.log('  kostet dann echte SerpAPI-Abfragen fuer die anderen.');
      console.log('\n  Abbruch. Erst die echten Alarme deaktivieren.\n');
      return;
    }

    // ---------- Ein echtes Produkt aus deinen Daten ----------
    const produkt = await PreisVerlauf.findOne(
      { preisZuletzt: { $gt: 20 }, produktName: { $nin: [null, ''] } },
      'googleProduktId produktName shop preisMin preisMax preisZuletzt'
    ).sort({ letzteMessung: -1 }).lean();

    if (!produkt) {
      console.log('\n  Keine brauchbaren Preisverlaeufe gefunden.\n');
      return;
    }

    const altPreis = produkt.preisZuletzt;
    const neuPreis = Math.round(altPreis * 0.8 * 100) / 100;   // 20 Prozent guenstiger
    const zielPreis = Math.round(altPreis * 0.85 * 100) / 100; // liegt ueber neuPreis -> Treffer

    stufe('Produkt aus deinen Daten', true, produkt.produktName.slice(0, 40));
    stufe('Shop', true, produkt.shop);
    stufe('Preis damals', true, franken(altPreis));
    stufe('Preis im Test', true, franken(neuPreis) + '  (20 Prozent guenstiger)');
    stufe('Zielpreis im Test', true, franken(zielPreis));

    // ============================================
    // DAS PRODUKTBILD
    // ============================================
    // Die Mail zeigt ein Bild, wenn eines da ist. PreisVerlauf
    // speichert keines - das Bild steht nur in den Aufnahmen, weil
    // es von SerpAPI kommt (Feld thumbnail).
    //
    // WICHTIG: Es wird NUR das Bild zu GENAU DIESEM Produkt
    // genommen. Irgendein anderes Bild aus den Aufnahmen waere
    // bequemer, aber dann stuende in der Testmail ein Bild, das
    // nicht zum Produkt gehoert - und beim naechsten Mal glaubst
    // du der Mail nicht mehr.
    //
    // Die rekonstruierten Aufnahmen vom 04.10.2026 haben KEINE
    // Bilder: sie stammen aus den Protokollen, und dort steht kein
    // thumbnail. Erst der echte SerpAPI-Lauf bringt die Bilder mit.
    // Bis dahin bleibt diese Zeile leer - das ist richtig so und
    // kein Fehler.
    let bildUrl = '';
    try {
      const mitBild = await Aufnahme.findOne(
        {
          daten: {
            $elemMatch: {
              product_id: produkt.googleProduktId,
              thumbnail: { $nin: [null, ''] }
            }
          }
        },
        'daten'
      ).lean();

      if (mitBild && Array.isArray(mitBild.daten)) {
        const p = mitBild.daten.find(
          (x) => x && x.product_id === produkt.googleProduktId && x.thumbnail
        );
        if (p) bildUrl = String(p.thumbnail);
      }
    } catch (e) {
      console.log('  (Bildsuche uebersprungen: ' + e.message + ')');
    }

    if (bildUrl) {
      stufe('Produktbild gefunden', true, bildUrl.slice(0, 44) + '...');
    } else {
      stufe('Produktbild', null, 'keins - Aufnahmen sind rekonstruiert');
      console.log('           Die Mail kommt ohne Bild. Erwartet: die');
      console.log('           rekonstruierten Aufnahmen haben kein thumbnail.');
      console.log('           Mit dem echten SerpAPI-Lauf ist es da.');
    }

    // ---------- Nutzer ----------
    const nutzer = await User.findOne({}, 'email premium istPremium').lean();
    if (!nutzer) {
      console.log('\n  Kein Nutzer in der Datenbank. Ohne Konto kein Alarm.\n');
      return;
    }
    stufe('Nutzer', true, nutzer.email || '(ohne Mailadresse)');

    // ---------- Kostenstand vorher ----------
    const vorher = await kostenbremse.stand().catch(() => null);

    // ---------- Testalarm anlegen ----------
    const alarm = await PreisAlarm.create({
      nutzer: nutzer._id,
      produktId: produkt.googleProduktId,
      produktName: produkt.produktName,
      suchbegriff: produkt.produktName,
      bildUrl,
      startPreis: altPreis,
      zielPreis,
      kanaele: ['email'],
      aktiv: true,
      zuletztGeprueft: null
    });
    testAlarmId = alarm._id;
    stufe('Testalarm angelegt', true, String(testAlarmId).slice(-8));

    // ============================================
    // DER LAUF
    // ============================================
    titel('DIE ECHTE KETTE, NUR OHNE SERPAPI');

    const mailAus = (process.env.MAIL_ANBIETER || 'aus') === 'aus';
    console.log('  Mailversand: ' + (mailAus
      ? 'aus - die Mail wird nur ins Log geschrieben'
      : process.env.MAIL_ANBIETER + ' - es geht eine ECHTE Mail an ' + nutzer.email));
    console.log('');

    // Diese Funktion ersetzt SerpAPI. Sie liefert dieselbe Form:
    // { success, produkte: [...] } - mit deinen eigenen Daten drin.
    let sucheAufgerufen = 0;
    const sucheAusVerlauf = async (begriff) => {
      sucheAufgerufen += 1;
      return {
        success: true,
        produkte: [
          {
            product_id: produkt.googleProduktId,
            title: produkt.produktName,
            priceValue: neuPreis,
            price: franken(neuPreis),
            source: produkt.shop,
            shop: produkt.shop,
            link: 'https://beispiel.ch/testlauf',
            currency: 'CHF'
          }
        ]
      };
    };

    const bericht = await dienst.pruefeAlle({ suchen: sucheAusVerlauf });

    // ============================================
    // WAS PASSIERT IST
    // ============================================
    titel('ERGEBNIS');

    stufe('Alarme gefunden', bericht.alarme === 1, String(bericht.alarme));
    stufe('Abfragen gestellt', sucheAufgerufen === 1, String(sucheAufgerufen) + ' (gebuendelt)');
    stufe('durch Buendelung gespart', null, String(bericht.gespart || 0));

    const danach = await PreisAlarm.findById(testAlarmId).lean();

    stufe('Alarm wurde geprueft', !!danach.zuletztGeprueft);
    stufe('neuer Preis gemerkt', danach.letzterPreis === neuPreis,
      danach.letzterPreis ? franken(danach.letzterPreis) : 'nichts');
    stufe('Shop gemerkt', !!danach.letzterShop, danach.letzterShop || '');
    stufe('als Treffer erkannt', bericht.gemeldet === 1,
      bericht.gemeldet === 1 ? 'ja' : 'nein - kein Meldung ausgeloest');

    if (bericht.gestoppt) {
      stufe('von der Kostenbremse gestoppt', false, bericht.gestoppt);
    }

    // ---------- Kosten ----------
    const nachher = await kostenbremse.stand().catch(() => null);
    // stand() liefert tag/monat NUR, wenn die Datenbank erreichbar war -
    // sonst kommt { erreichbar: false, notfall: ... } zurueck.
    if (vorher && vorher.tag && nachher && nachher.tag) {
      const diff = Math.round((nachher.tag.chf - vorher.tag.chf) * 100) / 100;
      console.log('');
      console.log('  Kostenzaehler: ' + franken(vorher.tag.chf) + ' -> ' + franken(nachher.tag.chf)
        + '   (+' + diff.toFixed(2) + ')');
      console.log('  Verbucht, obwohl nichts ausgegeben wurde - der Testlauf');
      console.log('  geht absichtlich durch die echte Kostenbremse.');
    }

    // ---------- Urteil ----------
    titel('URTEIL');

    const kette = !!danach.zuletztGeprueft && danach.letzterPreis === neuPreis;

    if (kette && bericht.gemeldet === 1) {
      console.log('  Die ganze Kette haelt.\n');
      console.log('    Alarm faellig  ->  gebuendelt  ->  Preis geprueft  ->');
      console.log('    Treffer erkannt  ->  Meldung raus  ->  Alarm aktualisiert\n');
      if (mailAus) {
        console.log('  Die Mail wurde ins Log geschrieben, nicht verschickt');
        console.log('  (MAIL_ANBIETER=aus). Alles davor ist damit bewiesen.');
        console.log('  Was noch fehlt, ist allein der Versand:');
        console.log('      node scripts/testMail.js');
      } else {
        console.log('  Schau in dein Postfach - auch im Spam-Ordner.');
      }
    } else if (kette) {
      console.log('  Preisprüfung und Buendelung funktionieren.');
      console.log('  Die MELDUNG ist nicht rausgegangen.\n');
      if (!mailAus) {
        console.log('  Wahrscheinlich der Mailversand. Pruef ihn einzeln:');
        console.log('      node scripts/testMail.js\n');
        console.log('  Zum Gegentest ohne Mail: MAIL_ANBIETER=aus in der .env,');
        console.log('  dann laeuft die Kette bis zum Logeintrag durch.');
      }
    } else {
      console.log('  Die Kette haelt NICHT. Der Alarm wurde nicht richtig');
      console.log('  aktualisiert - das liegt vor der Benachrichtigung.');
    }
    console.log('');

  } catch (e) {
    console.error('\nFehler:', e.message);
    if (e.stack) console.error(e.stack.split('\n').slice(1, 4).join('\n'));
    process.exitCode = 1;
  } finally {
    // ---------- IMMER aufraeumen ----------
    // Auch nach einem Absturz. Ein Testalarm, der liegen bleibt,
    // kostet beim naechsten echten Lauf eine SerpAPI-Abfrage.
    if (testAlarmId && PreisAlarm) {
      try {
        await PreisAlarm.deleteOne({ _id: testAlarmId });
        console.log('  Testalarm wieder geloescht.\n');
      } catch (e) {
        console.error('  ACHTUNG: Testalarm konnte NICHT geloescht werden:', e.message);
        console.error('  Von Hand entfernen, _id: ' + testAlarmId + '\n');
      }
    }
    await mongoose.connection.close().catch(() => {});
  }
})();