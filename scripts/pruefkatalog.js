// ============================================
// SYNORA - Pruefkatalog
// ============================================
// Aufruf:  node scripts/pruefkatalog.js
//          node scripts/pruefkatalog.js budget          (nur diese Gruppe)
//          node scripts/pruefkatalog.js --vorrat 150    (Kern + 150 aus dem Vorrat)
//          node scripts/pruefkatalog.js --lang          (Antworten mitdrucken)
//          node scripts/pruefkatalog.js --zufall        (andere Vorratsfragen ziehen)
//          node scripts/pruefkatalog.js --notbremse 0   (Notbremse ausschalten)
//
// Laeuft alle Fragen gegen deinen laufenden Server und prueft, was
// sich pruefen laesst. Am Ende steht eine Zahl: "17 von 20 richtig".
//
// DAS IST DAS TRAINING. Die Modelle selbst kannst du nicht
// umtrainieren - aber du kannst messen, verbessern und wieder
// messen. Ohne diese Zahl weisst du nie, ob eine Aenderung geholfen
// oder geschadet hat.
//
// KOSTEN: Beim ersten Durchlauf zahlst du SerpAPI. Danach setzt du
// ABSPIELEN=1 in die .env, und jeder weitere Durchlauf ist gratis.
//
// ============================================
// NEU: NOTBREMSE UND DIAGNOSE
// ============================================
// Beobachtet am 28./29.09., dreimal dasselbe Muster: der Lauf
// beginnt sauber, ab einer Frage (einmal vorrat-120, einmal
// vorrat-545) kommen NUR noch 0 Produkte, und zwar bis zum Ende.
// Es erholt sich nie. Das sieht nicht nach schlechten Suchbegriffen
// aus, sondern nach etwas, das mitten im Lauf abreisst - Verdacht:
// die MongoDB-Verbindung.
//
// Drei Dinge dagegen:
//
// 1. GESUNDHEIT VORHER. Bevor eine einzige Frage laeuft, wird der
//    Server gefragt, ob es ihm gut geht. Ist die Datenbank schon
//    weg, faengt der Lauf gar nicht erst an.
//
// 2. NOTBREMSE. Kommen 8 Fragen hintereinander mit 0 Produkten
//    zurueck, wird abgebrochen. Sonst laeuft die Maschine stundenlang
//    weiter und schreibt Muell - im schlimmsten Fall auf dein
//    SerpAPI-Guthaben.
//
// 3. GRUND NOTIEREN. Bisher stand bei jedem Ausfall nur "0 Produkte
//    statt 3". Das verschweigt, WARUM. Jetzt werden HTTP-Status und
//    Fehlermeldung des Servers mitgedruckt, und beim Abbruch wird
//    die Gesundheit nochmal geprueft - damit steht schwarz auf
//    weiss, ob die Datenbank schuld war.
// ============================================

'use strict';

require('dotenv').config();
const fragen = require('./pruefkatalogFragen');

// ---------- Vorrat ----------
// Der grosse Fragenvorrat wird NICHT vollstaendig gelaufen - 1400
// Fragen kosten mehrere tausend SerpAPI-Abfragen. Stattdessen eine
// Stichprobe.
let vorrat = [];
try {
  vorrat = require('./pruefkatalogVorrat');
} catch (e) {
  // Kein Vorrat vorhanden - dann eben nur die Kernfragen
}

// ============================================
// DER AUFGEZEICHNETE FRAGENSATZ
// ============================================
// Genau diese 150 Vorratsfragen liefen am 27./28.09. einmal live
// gegen SerpAPI. Nur fuer sie liegen Aufnahmen vor - und nur sie
// laufen darum im Abspiel-Modus gratis.
//
// Zwei Gruende, warum der Satz fest ist:
//
// 1. MESSEN. Zieht der Katalog jedes Mal andere Fragen, vergleichst
//    du nach einer Reparatur 84 Prozent auf Fragensatz A mit
//    irgendeiner Zahl auf Fragensatz B. Das sagt nichts darueber,
//    ob die Reparatur geholfen hat.
//
// 2. KOSTEN. Jede neue Frage kostet rund drei SerpAPI-Abfragen.
//
// Mit --zufall werden stattdessen neue Fragen gezogen. Das erweitert
// die Abdeckung, kostet aber Guthaben und ist nicht mit dem letzten
// Lauf vergleichbar.

const AUFGEZEICHNET = [
  'vorrat-757', 'vorrat-505', 'vorrat-189', 'vorrat-247', 'vorrat-144',
  'vorrat-1393', 'vorrat-1117', 'vorrat-1226', 'vorrat-1293', 'vorrat-891',
  'vorrat-415', 'vorrat-737', 'vorrat-437', 'vorrat-265', 'vorrat-120',
  'vorrat-290', 'vorrat-1208', 'vorrat-1072', 'vorrat-98', 'vorrat-385',
  'vorrat-486', 'vorrat-133', 'vorrat-155', 'vorrat-687', 'vorrat-801',
  'vorrat-901', 'vorrat-802', 'vorrat-1187', 'vorrat-430', 'vorrat-1304',
  'vorrat-734', 'vorrat-1165', 'vorrat-283', 'vorrat-36', 'vorrat-9',
  'vorrat-185', 'vorrat-1087', 'vorrat-676', 'vorrat-521', 'vorrat-761',
  'vorrat-378', 'vorrat-1177', 'vorrat-771', 'vorrat-1204', 'vorrat-481',
  'vorrat-1273', 'vorrat-663', 'vorrat-220', 'vorrat-1122', 'vorrat-674',
  'vorrat-794', 'vorrat-1158', 'vorrat-878', 'vorrat-1262', 'vorrat-216',
  'vorrat-1184', 'vorrat-41', 'vorrat-1329', 'vorrat-673', 'vorrat-123',
  'vorrat-738', 'vorrat-991', 'vorrat-308', 'vorrat-630', 'vorrat-1113',
  'vorrat-718', 'vorrat-595', 'vorrat-817', 'vorrat-849', 'vorrat-545',
  'vorrat-299', 'vorrat-160', 'vorrat-908', 'vorrat-187', 'vorrat-780',
  'vorrat-389', 'vorrat-169', 'vorrat-644', 'vorrat-554', 'vorrat-937',
  'vorrat-482', 'vorrat-282', 'vorrat-465', 'vorrat-384', 'vorrat-954',
  'vorrat-175', 'vorrat-140', 'vorrat-729', 'vorrat-877', 'vorrat-689',
  'vorrat-1244', 'vorrat-474', 'vorrat-1041', 'vorrat-760', 'vorrat-1044',
  'vorrat-755', 'vorrat-357', 'vorrat-733', 'vorrat-450', 'vorrat-14',
  'vorrat-499', 'vorrat-1334', 'vorrat-324', 'vorrat-412', 'vorrat-706',
  'vorrat-67', 'vorrat-408', 'vorrat-1127', 'vorrat-1199', 'vorrat-463',
  'vorrat-655', 'vorrat-720', 'vorrat-459', 'vorrat-1020', 'vorrat-1394',
  'vorrat-237', 'vorrat-1153', 'vorrat-134', 'vorrat-1050', 'vorrat-234',
  'vorrat-947', 'vorrat-593', 'vorrat-535', 'vorrat-11', 'vorrat-1119',
  'vorrat-424', 'vorrat-608', 'vorrat-741', 'vorrat-525', 'vorrat-68',
  'vorrat-746', 'vorrat-633', 'vorrat-941', 'vorrat-833', 'vorrat-1129',
  'vorrat-907', 'vorrat-373', 'vorrat-31', 'vorrat-871', 'vorrat-273',
  'vorrat-364', 'vorrat-925', 'vorrat-790', 'vorrat-896', 'vorrat-355',
  'vorrat-325', 'vorrat-875', 'vorrat-409', 'vorrat-1341', 'vorrat-1254'
];

const ZUFALL = process.argv.includes('--zufall');

function stichprobe(liste, anzahl) {
  const nachId = new Map(liste.map((f) => [f.id, f]));

  if (!ZUFALL) {
    const gewaehlt = AUFGEZEICHNET
      .slice(0, anzahl)
      .map((id) => nachId.get(id))
      .filter(Boolean);

    // Reichen die Aufnahmen nicht, wird mit dem festen Zufall
    // aufgefuellt - der Rest kostet dann SerpAPI.
    if (gewaehlt.length >= anzahl) return gewaehlt;

    const drin = new Set(gewaehlt.map((f) => f.id));
    const rest = gemischt(liste.filter((f) => !drin.has(f.id)));
    return [...gewaehlt, ...rest.slice(0, anzahl - gewaehlt.length)];
  }

  return gemischt(liste).slice(0, anzahl);
}

/** Mischen mit festem Startwert, damit auch das wiederholbar ist */
function gemischt(liste) {
  const kopie = [...liste];
  let samen = 20260928;
  const fest = () => {
    samen = (samen * 1103515245 + 12345) % 2147483648;
    return samen / 2147483648;
  };
  const wuerfeln = ZUFALL ? Math.random : fest;

  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(wuerfeln() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
}

const ADRESSE = process.env.PRUEFKATALOG_URL || 'http://localhost:5000';

// process.argv[0] ist Node selbst, [1] das Skript - erst ab [2]
// kommen die eigenen Angaben. Ohne slice(2) wurde der Node-Pfad
// als Filter gelesen.
const EIGENE = process.argv.slice(2);

// Die Zahl nach --vorrat ist ein WERT, kein Gruppenname.
// Beobachtet am 27.09.: "--vorrat 150" wurde so gelesen, dass "150"
// als Gruppenfilter galt. Es gibt keine Gruppe "150", also fielen
// alle Kernfragen weg und uebrig blieb nur die Stichprobe.
const MIT_WERT = new Set(['--vorrat', '--notbremse']);
const NUR = EIGENE.find((a, i) => {
  if (a.startsWith('--')) return false;
  const davor = EIGENE[i - 1];
  return !(davor && MIT_WERT.has(davor));
});

const LANG = EIGENE.includes('--lang');

// --vorrat 50  ->  zusaetzlich 50 Fragen aus dem Vorrat
const VORRAT_INDEX = EIGENE.indexOf('--vorrat');
const VORRAT_ANZAHL = VORRAT_INDEX >= 0 ? Number(EIGENE[VORRAT_INDEX + 1]) || 50 : 0;

const ZEITGRENZE_MS = 30000;   // langsamer als das ist zu langsam

// --notbremse 8   ->  nach 8 Fragen ohne Produkte abbrechen
// --notbremse 0   ->  Notbremse aus (alter Zustand)
// Achtung: "--notbremse" steht oben in MIT_WERT. Sonst wuerde die
// Zahl dahinter als Gruppenname gelesen - genau der Fehler, der uns
// bei "--vorrat 150" einen ganzen Lauf gekostet hat.
const BREMSE_INDEX = EIGENE.indexOf('--notbremse');
const BREMSE_WERT = BREMSE_INDEX >= 0 ? Number(EIGENE[BREMSE_INDEX + 1]) : 8;
const NOTBREMSE = Number.isFinite(BREMSE_WERT) ? BREMSE_WERT : 8;

// ============================================
// GEHT ES DEM SERVER GUT?
// ============================================
// Der Pfad ist nicht ueberall gleich, darum werden mehrere
// versucht. Antwortet keiner, ist das kein Abbruchgrund - dann
// wissen wir es eben nicht und sagen das auch.

const GESUNDHEIT_PFADE = ['/api/health', '/health', '/api/status', '/api/gesundheit'];

async function gesundheit() {
  for (const pfad of GESUNDHEIT_PFADE) {
    try {
      const steuerung = new AbortController();
      const uhr = setTimeout(() => steuerung.abort(), 5000);
      const antwort = await fetch(ADRESSE + pfad, { signal: steuerung.signal });
      clearTimeout(uhr);
      if (antwort.status === 404) continue;
      const daten = await antwort.json().catch(() => ({}));
      return { pfad, status: antwort.status, daten };
    } catch (_) {
      // naechsten Pfad versuchen
    }
  }
  return null;
}

/** Sucht in der Health-Antwort nach allem, was nach Datenbank klingt */
function datenbankZustand(daten) {
  const treffer = [];
  const suchen = (o, weg = '') => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      const name = weg ? `${weg}.${k}` : k;
      if (/mongo|db|datenbank|database/i.test(k) && typeof v !== 'object') {
        treffer.push(`${name}: ${v}`);
      }
      if (v && typeof v === 'object') suchen(v, name);
    }
  };
  suchen(daten);
  return treffer;
}

// ============================================
// EINE FRAGE STELLEN
// ============================================

async function fragen_(text, verlauf = []) {
  const start = Date.now();

  const antwort = await fetch(`${ADRESSE}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-synora-client': 'pruefkatalog',
      // Ueberspringt das Tageslimit - wirkt nur lokal, siehe limits.js
      'x-synora-test': process.env.TEST_TOKEN || ''
    },
    body: JSON.stringify({ message: text, conversationHistory: verlauf })
  });

  const daten = await antwort.json().catch(() => ({}));
  return { daten, dauerMs: Date.now() - start, status: antwort.status };
}

/**
 * Was der Server ausser "0 Produkte" noch verraten hat.
 * Bisher ging genau das verloren - darum wussten wir bei 32
 * Ausfaellen nicht, ob es 32 schlechte Suchbegriffe waren oder
 * einmal eine abgerissene Verbindung.
 */
function grundDahinter(r) {
  if (!r) return 'keine Antwort vom Server';
  const teile = [];
  if (r.status && r.status !== 200) teile.push(`HTTP ${r.status}`);
  const d = r.daten || {};
  const meldung = d.error || d.fehler || d.message || d.grund;
  if (meldung) teile.push(String(meldung).slice(0, 120));
  return teile.join(' | ');
}

// ============================================
// PRUEFUNGEN
// ============================================
// Jede gibt null zurueck, wenn alles stimmt, sonst den Fehler.

function preisZahl(text) {
  const t = String(text || '').replace(/['’\s]/g, '').replace(/,/g, '.');
  const m = t.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

const PRUEFUNGEN = {
  antwortDa: (f, r) => (r.daten.response ? null : 'keine Antwort'),

  dreiProdukte: (f, r) => {
    // Endet der Durchlauf bei einer Rueckfrage, gibt es
    // richtigerweise keine Produkte - das ist kein Fehler.
    if (f.erwarteRueckfrage || r.daten.istRueckfrage) return null;
    const n = (r.daten.products || []).length;
    if (n === 3) return null;
    // Bei 0 Produkten den Grund mitnehmen, falls der Server einen
    // genannt hat - sonst steht am Ende 32x dieselbe nichtssagende
    // Zeile und man weiss immer noch nicht, was los war.
    const grund = n === 0 ? grundDahinter(r) : '';
    return grund ? `${n} Produkte statt 3  [${grund}]` : `${n} Produkte statt 3`;
  },

  budgetGehalten: (f, r) => {
    if (!f.budget) return null;
    const drueber = (r.daten.products || []).filter((p) => {
      const preis = preisZahl(p.price);
      return preis !== null && preis > f.budget;
    });
    return drueber.length
      ? `${drueber.length} Produkte ueber Budget: ${drueber.map((p) => p.price).join(', ')}`
      : null;
  },

  jederNachteil: (f, r) => {
    const ohne = (r.daten.products || []).filter((p) => !(p.nachteile || []).length);
    return ohne.length ? `${ohne.length} Produkte ohne Nachteil` : null;
  },

  keineIds: (f, r) => {
    // NUR den sichtbaren Text pruefen. Das Feld "id" enthaelt
    // absichtlich p_01 und ist fuer den Nutzer unsichtbar - die
    // ganze Antwort zu durchsuchen gab falschen Alarm.
    const sichtbar = [
      r.daten.response,
      ...(r.daten.products || []).flatMap((p) => [
        p.name,
        ...(p.whyItFits || []),
        ...(p.nachteile || [])
      ])
    ].filter(Boolean).join(' ');

    return /\bp_\d{1,3}\b/.test(sichtbar) ? 'Produkt-IDs im sichtbaren Text' : null;
  },

  echteUmlaute: (f, r) => {
    const text = String(r.daten.response || '');
    const schlecht = text.match(/\b\w*(fuer|ueber|koennen|muessen|waehlen|qualitaet)\w*\b/i);
    return schlecht ? `ASCII statt Umlaut: "${schlecht[0]}"` : null;
  },

  rueckfrageWieErwartet: (f, r) => {
    if (f.erwarteRueckfrage === undefined) return null;
    const kam = !!r.daten.istRueckfrage;
    if (kam === f.erwarteRueckfrage) return null;
    return f.erwarteRueckfrage ? 'keine Rueckfrage gestellt' : 'unnoetige Rueckfrage';
  },

  schweizerShop: (f, r) => {
    if (f.erwarteRueckfrage) return null;
    const produkte = r.daten.products || [];
    if (!produkte.length) return null;
    const ch = produkte.filter((p) => /\.ch|schweiz|suisse/i.test(p.shopName || ''));
    return ch.length ? null : 'kein einziger Schweizer Shop';
  },

  zweckImText: (f, r) => {
    if (!f.erwartetImText) return null;
    const text = JSON.stringify(r.daten).toLowerCase();
    return f.erwartetImText.some((w) => text.includes(w))
      ? null
      : `Zweck kommt nicht vor (erwartet: ${f.erwartetImText.slice(0, 3).join(', ')})`;
  },

  markeBeachtet: (f, r) => {
    if (!f.markeVerlangt) return null;
    const text = JSON.stringify(r.daten).toLowerCase();
    // Entweder die Marke ist dabei, ODER SYNORA sagt, dass sie fehlt
    const dabei = (r.daten.products || []).some((p) =>
      String(p.name || '').toLowerCase().includes(f.markeVerlangt)
    );
    const benannt = text.includes(f.markeVerlangt) && /nicht gefunden|nichts passendes|anderen hersteller/i.test(text);
    return dabei || benannt ? null : `Marke ${f.markeVerlangt} weder geliefert noch erwaehnt`;
  },

  schnellGenug: (f, r) =>
    r.dauerMs > ZEITGRENZE_MS ? `${Math.round(r.dauerMs / 1000)}s - zu langsam` : null
};

// ============================================
// DURCHLAUF
// ============================================

async function eineFrage(f) {
  const fehler = [];
  let ergebnis;

  try {
    ergebnis = await fragen_(f.frage);

    // ---------- Rueckfrage beantworten ----------
    // Sonst misst der Katalog nur den ersten Schritt. Vorbereitete
    // Antworten haben Vorrang; sonst nimmt er die erste Option
    // jeder Frage - so wie es ein Nutzer auch tun wuerde.
    if (ergebnis.daten.istRueckfrage && !f.erwarteRueckfrage) {
      let antwort = f.antworten ? f.antworten.join('; ') : null;

      if (!antwort && Array.isArray(ergebnis.daten.fragen)) {
        antwort = ergebnis.daten.fragen
          .map((q) => (q.optionen || []).find((o) => !/egal/i.test(o)))
          .filter(Boolean)
          .join('; ');
      }

      if (!antwort && Array.isArray(ergebnis.daten.modelOptions)) {
        antwort = ergebnis.daten.modelOptions.find((o) => !/egal/i.test(o));
      }

      if (antwort) {
        const verlauf = [
          { role: 'user', content: f.frage },
          { role: 'assistant', content: ergebnis.daten.response, istRueckfrage: true }
        ];
        ergebnis = await fragen_(antwort, verlauf);
        ergebnis.beantwortet = antwort;
      }
    }
  } catch (e) {
    return { f, fehler: [`Anfrage fehlgeschlagen: ${e.message}`], ergebnis: null };
  }

  for (const [name, pruefung] of Object.entries(PRUEFUNGEN)) {
    try {
      const problem = pruefung(f, ergebnis);
      if (problem) fehler.push(`${name}: ${problem}`);
    } catch (e) {
      fehler.push(`${name}: Pruefung selbst fehlgeschlagen (${e.message})`);
    }
  }

  return { f, fehler, ergebnis };
}

async function main() {
  let liste = NUR ? fragen.filter((f) => f.id.startsWith(NUR)) : fragen;

  if (VORRAT_ANZAHL > 0 && vorrat.length) {
    const gezogen = stichprobe(vorrat, VORRAT_ANZAHL);
    liste = [...liste, ...gezogen];
    console.log(
      `\nStichprobe: ${gezogen.length} von ${vorrat.length} Vorratsfragen dazu` +
      (ZUFALL ? '  (--zufall: neue Auswahl, kostet SerpAPI)' : '  (fester Fragensatz)')
    );
  }

  if (!liste.length) {
    console.error(`Keine Fragen mit "${NUR}" gefunden.`);
    process.exit(1);
  }

  console.log(`\nPruefkatalog: ${liste.length} Fragen gegen ${ADRESSE}`);
  if (!process.env.TEST_TOKEN) {
    console.log('ACHTUNG: TEST_TOKEN fehlt in der .env - nach drei Fragen greift das Gastlimit');
  }
  if (process.env.ABSPIELEN === '1') console.log('Abspiel-Modus: keine SerpAPI-Kosten');
  else console.log('ACHTUNG: kein Abspiel-Modus - das kostet SerpAPI-Abfragen');

  // ---------- Gesundheit vorher ----------
  const vorher = await gesundheit();
  if (!vorher) {
    console.log('Gesundheit: kein Health-Pfad gefunden - wird nicht ueberwacht');
  } else {
    const db = datenbankZustand(vorher.daten);
    console.log(`Gesundheit: ${vorher.pfad} -> HTTP ${vorher.status}` + (db.length ? `  (${db.join(', ')})` : ''));
  }
  console.log(NOTBREMSE > 0
    ? `Notbremse: Abbruch nach ${NOTBREMSE} Fragen ohne Produkte\n`
    : 'Notbremse: aus\n');

  const ergebnisse = [];
  let seriePleite = 0;      // wie viele Fragen hintereinander ohne Produkte
  let ersteDerSerie = null; // wo die Serie begonnen hat
  let abgebrochen = false;

  for (const f of liste) {
    process.stdout.write(`  ${f.id.padEnd(14)} ${f.frage.slice(0, 44).padEnd(46)}`);
    const r = await eineFrage(f);
    ergebnisse.push(r);
    console.log(r.fehler.length ? `FEHLER (${r.fehler.length})` : 'ok');
    if (r.ergebnis && r.ergebnis.beantwortet) {
      console.log(`                 (Rueckfrage beantwortet mit: ${r.ergebnis.beantwortet})`);
    }
    for (const e of r.fehler) console.log(`                 - ${e}`);

    if (LANG && r.ergebnis && r.ergebnis.daten.response) {
      console.log(`                 > ${r.ergebnis.daten.response.slice(0, 200).replace(/\n/g, ' ')}`);
    }

    // ---------- Notbremse ----------
    // Gezaehlt wird nur, was wirklich nach Ausfall aussieht: keine
    // Antwort, oder eine Antwort ohne Produkte, obwohl Produkte
    // erwartet waren. Eine Rueckfrage ist KEIN Ausfall.
    const daten = r.ergebnis ? r.ergebnis.daten : null;
    const warRueckfrage = !!(daten && daten.istRueckfrage) || !!f.erwarteRueckfrage;
    const ohneProdukte = !r.ergebnis || (!warRueckfrage && !(daten.products || []).length);

    if (ohneProdukte) {
      if (seriePleite === 0) ersteDerSerie = f.id;
      seriePleite += 1;
    } else {
      seriePleite = 0;
      ersteDerSerie = null;
    }

    if (NOTBREMSE > 0 && seriePleite >= NOTBREMSE) {
      abgebrochen = true;
      console.log('\n----------------------------------------');
      console.log(`  NOTBREMSE nach ${seriePleite} Fragen ohne Produkte`);
      console.log(`  Erste betroffene Frage: ${ersteDerSerie}`);
      console.log(`  Letzte gelaufene Frage: ${f.id}`);
      console.log(`  Letzter Grund vom Server: ${grundDahinter(r.ergebnis) || '(keiner genannt)'}`);

      const nachher = await gesundheit();
      if (!nachher) {
        console.log('  Gesundheit jetzt: Server antwortet auf keinem Health-Pfad mehr');
      } else {
        const db = datenbankZustand(nachher.daten);
        console.log(`  Gesundheit jetzt: HTTP ${nachher.status}` + (db.length ? `  (${db.join(', ')})` : ''));
      }

      console.log('');
      console.log('  Was jetzt zu tun ist:');
      console.log('   1. Ins Server-Fenster schauen. Steht dort');
      console.log('      "[DB] Verbindung verloren", ist es die Datenbank,');
      console.log('      nicht die Suche.');
      console.log('   2. Server neu starten und denselben Lauf wiederholen.');
      console.log('      Bricht er an derselben Frage ab, liegt es an der');
      console.log('      Frage. Bricht er woanders ab, laeuft etwas voll.');
      console.log('----------------------------------------');
      break;
    }
  }

  // ---------- Zusammenfassung ----------
  const gut = ergebnisse.filter((r) => !r.fehler.length).length;
  const prozent = Math.round((gut / ergebnisse.length) * 100);

  console.log('\n========================================');
  console.log(`  ${gut} von ${ergebnisse.length} richtig  (${prozent} Prozent)`);
  if (abgebrochen) {
    console.log(`  ABGEBROCHEN - ${liste.length - ergebnisse.length} Fragen nicht gelaufen`);
    console.log('  Diese Zahl ist NICHT mit einem vollen Lauf vergleichbar.');
  }
  console.log('========================================');

  // Welche Pruefung faellt am haeufigsten durch?
  const zaehler = {};
  for (const r of ergebnisse) {
    for (const e of r.fehler) {
      const name = e.split(':')[0];
      zaehler[name] = (zaehler[name] || 0) + 1;
    }
  }

  // Nach Schwierigkeit aufschluesseln - so siehst du, ob SYNORA
  // nur bei den einfachen Faellen gut ist.
  const nachStufe = {};
  for (const r of ergebnisse) {
    const stufe = r.f.schwierigkeit || 'kern';
    nachStufe[stufe] = nachStufe[stufe] || { gut: 0, gesamt: 0 };
    nachStufe[stufe].gesamt += 1;
    if (!r.fehler.length) nachStufe[stufe].gut += 1;
  }

  if (Object.keys(nachStufe).length > 1) {
    console.log('\nNach Schwierigkeit:');
    for (const [stufe, z] of Object.entries(nachStufe)) {
      const p = Math.round((z.gut / z.gesamt) * 100);
      console.log(`  ${stufe.padEnd(10)} ${String(z.gut).padStart(3)} von ${String(z.gesamt).padStart(3)}  (${p} Prozent)`);
    }
  }

  const sortiert = Object.entries(zaehler).sort((a, b) => b[1] - a[1]);
  if (sortiert.length) {
    console.log('\nHaeufigste Probleme:');
    for (const [name, n] of sortiert) console.log(`  ${String(n).padStart(3)}x  ${name}`);
    console.log('\nDas oberste zuerst beheben - dort holst du am meisten.');
  }

  console.log('');
  process.exit(gut === ergebnisse.length ? 0 : 1);
}

main().catch((e) => {
  console.error('Abgebrochen:', e.message);
  console.error('Laeuft der Server auf ' + ADRESSE + ' ?');
  process.exit(1);
});