// ============================================
// SYNORA - Aufnahmen aus Suchprotokollen nachbauen
// ============================================
// Baut aus den gespeicherten Suchprotokollen Aufnahmen, mit denen
// der Pruefkatalog laufen kann - ohne SerpAPI-Guthaben.
//
// WAS DAS IST UND WAS NICHT
// -------------------------
// Eine nachgebaute Aufnahme ist ein Pruefstand, keine Aufnahme.
// Im Protokoll stehen nur die 12 bereits gefilterten Kandidaten,
// mit sechs Feldern. Was SerpAPI wirklich geliefert hat - 20 bis 40
// Produkte mit Links, Bildern, Lieferzeiten - ist nicht gespeichert.
//
// Damit pruefbar:
//   - Regel 1: erfindet ein Modell Preise oder Verfuegbarkeiten?
//   - hat jedes Produkt einen echten Nachteil?
//   - Rueckfragen, Budgetgrenzen, Konsens der Modelle
//
// Damit NICHT pruefbar:
//   - Links zum Shop (/api/go), Bilder, Lieferangaben
//   - die Filterstufen selbst - die Kandidaten sind schon gefiltert
//
// Darum werden die Aufnahmen als quelle="rekonstruiert" markiert.
// Eine echte Aufnahme ueberschreibt sie spaeter automatisch; eine
// nachgebaute ueberschreibt NIE eine echte.
//
// Aufruf:
//   node scripts/aufnahmeNachbauen.js             nur zeigen
//   node scripts/aufnahmeNachbauen.js --schreiben wirklich anlegen
//   node scripts/aufnahmeNachbauen.js --schreiben --min 3
//
// Ohne --schreiben wird NICHTS veraendert.
// ============================================
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const ARG = process.argv.slice(2);
const SCHREIBEN = ARG.includes('--schreiben');

// Weniger als so viele Produkte ergeben keine sinnvolle Testfrage:
// das Modell soll aus mehreren auswaehlen, nicht eins durchwinken.
const MIN_INDEX = ARG.indexOf('--min');
const MIN_PRODUKTE = MIN_INDEX >= 0 ? Math.max(1, Number(ARG[MIN_INDEX + 1]) || 3) : 3;

function titel(t) {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + t);
  console.log('='.repeat(60));
}

/**
 * Einen Protokoll-Kandidaten in die Form bringen, die der
 * Controller erwartet.
 *
 * Die Feldnamen sind im Protokoll anders als in der Suche:
 *     Protokoll        Suche
 *     titel        ->  title
 *     preis        ->  priceValue
 *     shop         ->  source
 *     id (p_01)    ->  (unbrauchbar, siehe unten)
 *
 * product_id wird neu gebildet. Die echte Google-ID ist im
 * Protokoll durch p_01, p_02 ... ersetzt worden - die wird bei
 * jeder Suche neu vergeben und gehoert keinem Produkt dauerhaft.
 * Eine stabile Ersatz-ID aus Name und Shop ist ehrlicher: sie
 * bleibt ueber Durchlaeufe gleich, und sie ist erkennbar keine
 * Google-ID.
 */
/**
 * shopInfo aus dem Protokoll zurueckrechnen.
 *
 * WARUM DAS SEIN MUSS
 * -------------------
 * shopInfo setzt normalerweise serpApiService aus der Shop-
 * Datenbank. Beim Abspielen laeuft serpApiService aber gar nicht -
 * die Produkte kommen fertig aus der Aufnahme. Ohne shopInfo faellt
 * istSchweiz() auf das Erraten am Shopnamen zurueck:
 *
 *     "Notino.ch"  -> erkannt, endet auf .ch
 *     "Galaxus"    -> NICHT erkannt -> Stufe 6 statt Stufe 1
 *
 * Gemessen am 03.10.2026: ein Schweizer Shop ohne .ch im Namen
 * landete auf Stufe 6. Damit waere beim Pruefen "Schweizer Shops
 * gewinnen" kaputt erschienen, obwohl die Regel stimmt - nur die
 * Testdaten waren falsch. Ein Fehler, den es gar nicht gibt, ist
 * teurer als einer, den man sieht.
 *
 * Das Protokoll hat land und shopStufe mitgeschrieben. Aus beidem
 * laesst sich shopInfo exakt zurueckrechnen - umgekehrt zu
 * shopStufe() in chatController.js:
 *
 *     1 = CH + gute Bewertung      4 = CH + schwache Bewertung
 *     2 = CH, nicht bewertet       5 = Ausland, Shop bekannt
 *     3 = Amazon                   6 = Shop unbekannt
 *
 * Geraten wird nichts: stand im Protokoll keine Stufe, bleibt
 * shopInfo leer und der Shop gilt als unbekannt.
 */
function shopInfoBauen(k) {
  const land = k.land || null;
  const stufe = typeof k.shopStufe === 'number' ? k.shopStufe : null;

  if (stufe === 6) return null;          // war unbekannt, bleibt unbekannt
  if (!land && stufe === null) return null;

  const info = {};
  if (land) info.land = land;
  if (stufe === 1) info.qualitaet = 'gut';       // aus GUTE_STUFEN
  else if (stufe === 4) info.qualitaet = 'mittel'; // aus SCHWACHE_STUFEN

  return Object.keys(info).length ? info : null;
}

function umbauen(k, begriff) {
  const name = k.titel || k.title || '';
  const shop = k.shop || k.source || '';
  const preis = typeof k.preis === 'number' ? k.preis
    : (typeof k.priceValue === 'number' ? k.priceValue : null);

  if (!name || preis === null || preis <= 0) return null;

  const kennung = 'rb_' + Buffer.from(`${name}|${shop}`)
    .toString('base64url').slice(0, 20);

  const p = {
    product_id: kennung,
    title: name,
    priceValue: preis,
    price: `CHF ${preis.toFixed(2)}`,
    source: shop,
    currency: 'CHF',

    // Kein Link und kein Bild - die stehen nicht im Protokoll.
    // Bewusst gar nicht gesetzt statt leer: so faellt beim Testen
    // auf, dass hier etwas fehlt, statt dass ein leerer Link wie
    // ein kaputter aussieht.
    rekonstruiert: true,
    ausProtokollVon: begriff
  };

  const info = shopInfoBauen(k);
  if (info) p.shopInfo = info;
  if (k.land) p.land = k.land;

  return p;
}

async function laufen() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('\nMONGODB_URI fehlt in der .env.\n');
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  const SuchProtokoll = require('../src/models/SuchProtokoll');
  const cache = require('../src/services/cacheService');

  titel('AUFNAHMEN AUS SUCHPROTOKOLLEN NACHBAUEN');

  // Neueste zuerst: bei gleichem Begriff und Budget gewinnt die
  // juengste Messung. Aeltere Preise sind nicht falsch, aber die
  // neueren sind naeher an dem, was der Nutzer heute saehe.
  const protokolle = await SuchProtokoll.find(
    {
      'anfrage.begriff': { $exists: true, $nin: [null, ''] },
      'kandidaten.0': { $exists: true }
    },
    'anfrage kandidaten zeit'
  ).sort({ zeit: -1 }).lean();

  console.log(`\n  ${protokolle.length} brauchbare Protokolle gefunden.`);

  if (!protokolle.length) {
    console.log('\n  Nichts nachzubauen. Es bleibt beim Aufnehmen mit');
    console.log('  echtem Guthaben:  AUFNEHMEN=1 und ABSPIELEN=0.\n');
    return;
  }

  const gesehen = new Set();
  const fertig = [];
  let uebersprungenDoppelt = 0;
  let uebersprungenZuWenig = 0;
  let verworfeneProdukte = 0;

  for (const p of protokolle) {
    const begriff = p.anfrage.begriff;
    const budget = p.anfrage.budget ?? null;

    // Genau derselbe Schluessel, mit dem die Suche spaeter fragt.
    // Steht und faellt damit, dass schluesselBauen unveraendert ist.
    const schluessel = cache.schluesselBauen(begriff, budget, 'CH');

    if (gesehen.has(schluessel)) { uebersprungenDoppelt++; continue; }
    gesehen.add(schluessel);

    const produkte = [];
    for (const k of p.kandidaten) {
      const umgebaut = umbauen(k, begriff);
      if (umgebaut) produkte.push(umgebaut);
      else verworfeneProdukte++;
    }

    if (produkte.length < MIN_PRODUKTE) { uebersprungenZuWenig++; continue; }

    fertig.push({ schluessel, begriff, budget, produkte, zeit: p.zeit });
  }

  console.log(`  ${fertig.length} verschiedene Suchen nachbaubar.`);
  if (uebersprungenDoppelt) console.log(`  ${uebersprungenDoppelt} doppelt (gleicher Begriff und Budget) - juengste genommen.`);
  if (uebersprungenZuWenig) console.log(`  ${uebersprungenZuWenig} verworfen: weniger als ${MIN_PRODUKTE} brauchbare Produkte.`);
  if (verworfeneProdukte) console.log(`  ${verworfeneProdukte} einzelne Produkte ohne Name oder Preis weggelassen.`);

  if (!fertig.length) {
    console.log('\n  Am Ende bleibt nichts uebrig. Die Protokolle sind zu duenn.');
    console.log('  Es bleibt beim Aufnehmen mit echtem Guthaben.\n');
    return;
  }

  // ---------- Vorschau ----------
  console.log('\n  Die ersten zehn:\n');
  console.log('  BEGRIFF                         BUDGET  PRODUKTE');
  console.log('  ' + '-'.repeat(52));
  for (const f of fertig.slice(0, 10)) {
    console.log('  ' + String(f.begriff).slice(0, 30).padEnd(32)
      + String(f.budget ?? '-').padStart(6)
      + String(f.produkte.length).padStart(10));
  }

  const summe = fertig.reduce((s, f) => s + f.produkte.length, 0);
  console.log(`\n  Zusammen ${summe} Produkte in ${fertig.length} Aufnahmen.`);

  // ---------- Was fehlt ----------
  console.log('\n  Was diesen Aufnahmen fehlt:\n');
  console.log('    - kein Link zum Shop  -> /api/go nicht pruefbar');
  console.log('    - kein Produktbild    -> Darstellung nicht pruefbar');
  console.log('    - Kandidaten sind schon gefiltert und auf 12 gekuerzt');
  console.log('      -> die Filterstufen laufen beim Abspielen ins Leere');
  console.log('');
  console.log('  Pruefbar bleibt das Wichtigste: Regel 1, die Nachteile,');
  console.log('  die Rueckfragen, die Budgetgrenze und der Konsens.');

  if (!SCHREIBEN) {
    console.log('\n' + '-'.repeat(60));
    console.log('  NICHTS GESCHRIEBEN - das war nur die Vorschau.');
    console.log('');
    console.log('  Wenn das passt:');
    console.log('      node scripts/aufnahmeNachbauen.js --schreiben');
    console.log('-'.repeat(60) + '\n');
    return;
  }

  // ---------- Schreiben ----------
  titel('SCHREIBEN');
  console.log('');

  let neu = 0, uebersprungen = 0, fehler = 0;

  for (const f of fertig) {
    try {
      const ok = await cache.aufnahmeSchreiben(f.schluessel, f.produkte, {
        begriff: f.begriff,
        budget: f.budget,
        land: 'CH',
        quelle: 'rekonstruiert'
      });
      if (ok) neu++;
      else uebersprungen++; // es gab schon eine ECHTE Aufnahme
    } catch (e) {
      fehler++;
      console.error(`  [Fehler] "${f.begriff}": ${e.message}`);
    }
  }

  console.log(`  ${neu} Aufnahmen angelegt.`);
  if (uebersprungen) console.log(`  ${uebersprungen} uebersprungen - dort gab es schon eine echte Aufnahme.`);
  if (fehler) console.log(`  ${fehler} fehlgeschlagen.`);

  console.log('\n  Jetzt in der .env:');
  console.log('      ABSPIELEN=1');
  console.log('      AUFNEHMEN=0');
  console.log('');
  console.log('  Dann Server neu starten und pruefen:');
  console.log('      node scripts/aufnahmeZeigen.js');
  console.log('      node scripts/pruefkatalog.js');
  console.log('');
  console.log('  Denk daran: in den Ergebnissen fehlen die Shop-Links.');
  console.log('  Das ist kein Fehler im Frontend, das sind die Daten.\n');
}

laufen()
  .catch((e) => {
    console.error('\nFehler:', e.message, '\n');
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close().catch(() => {}));