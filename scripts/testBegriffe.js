// ============================================
// SYNORA - Budget und Suchbegriff pruefen
// ============================================
// Aufruf:  node scripts/testBegriffe.js
//
// Prueft die zwei Stellen, die JEDE Suche durchlaufen muss, bevor
// Geld ausgegeben wird:
//
//   extrahiereBudget()  -> die Wand. Wird sie nicht erkannt, gibt es
//                          keine, und Regel 4 ist gebrochen.
//   sucheBegriff()      -> was Google zu sehen bekommt. Steht dort
//                          "hab was gesucht fuer grosse Hunde so",
//                          findet Google keine Schweizer Haendler.
//
// KOSTET NICHTS: kein Server, keine SerpAPI, keine Modelle. Laeuft
// in einer Sekunde. Darum nach jeder Aenderung an diesen beiden
// Funktionen zuerst hier messen - der Pruefkatalog kostet Guthaben.
// ============================================

'use strict';

const { extrahiereBudget, sucheBegriff } = require('../src/controllers/chatController');

// erwartetesBudget: null heisst "es darf keines erkannt werden"
// erwarteterBegriff: was an Google gehen soll
const FAELLE = [
  // ---------- Schweizer Umgangssprache ----------
  // Gemessen am 28.09.: "stutz" war unbekannt, also keine Budgetwand.
  { text: 'hab was gesucht zum Gamen, so 60 stutz',            budget: 60,   begriff: 'zum Gamen' },
  { text: 'hab was gesucht für grosse Hunde, so 50 stutz',     budget: 50,   begriff: 'für grosse Hunde' },
  { text: 'hab was gesucht für kleine Hände, so 80 stutz',     budget: 80,   begriff: 'für kleine Hände' },
  { text: 'hab was gesucht bei Rückenschmerzen, so 500 stutz', budget: 500,  begriff: 'bei Rückenschmerzen' },

  // ---------- Frageform ----------
  // Gemessen am 28.09.: "... bekomme ich für 500 Franken" liess ein
  // haengendes "für" im Suchbegriff stehen.
  { text: 'Was für Bürostuhl für langes Sitzen bekomme ich für 500 Franken', budget: 500,  begriff: 'Bürostuhl für langes Sitzen' },
  { text: 'Was für Velo zum Pendeln bekomme ich für 1500 Franken',           budget: 1500, begriff: 'Velo zum Pendeln' },

  // ---------- Uebliche Schreibweisen ----------
  { text: 'Kopfhörer bis 100 Franken',                     budget: 100,  begriff: 'Kopfhörer' },
  { text: 'Kaffeemaschine unter 200 CHF',                  budget: 200,  begriff: 'Kaffeemaschine' },
  { text: 'Akkuschrauber max 300.-',                       budget: 300,  begriff: 'Akkuschrauber' },
  { text: 'Tastatur max 20.-',                             budget: 20,   begriff: 'Tastatur' },
  { text: 'Suche Kamera für Einsteiger, Budget etwa 160 Franken', budget: 160, begriff: 'Kamera für Einsteiger' },
  { text: 'rasenmäher für kleinen Garten für ca 1200 fr',   budget: 1200, begriff: 'rasenmäher für kleinen Garten' },
  { text: "Smartphone für lange Akkulaufzeit bis 1'100 Franken", budget: 1100, begriff: 'Smartphone für lange Akkulaufzeit' },
  { text: 'Ich brauche Werkzeugkoffer für zu Hause, nicht mehr als 200 Franken', budget: 200, begriff: 'Werkzeugkoffer für zu Hause' },

  // ---------- Marke bleibt stehen ----------
  { text: 'Sony Kopfhörer bis 150 Franken',                budget: 150,  begriff: 'Sony Kopfhörer' },
  { text: 'WMF Kochtopfset bis 200 Franken',               budget: 200,  begriff: 'WMF Kochtopfset' },
  { text: 'Dyson Staubsauger bis 200 Franken',             budget: 200,  begriff: 'Dyson Staubsauger' },

  // ---------- Ohne Budget ----------
  { text: 'Kopfhörer',                                     budget: null, begriff: 'Kopfhörer' },
  { text: 'Laptop',                                        budget: null, begriff: 'Laptop' },
  { text: 'Katzenstreu klumpend',                          budget: null, begriff: 'Katzenstreu klumpend' },
  { text: 'Staubsauger für Tierhaare',                     budget: null, begriff: 'Staubsauger für Tierhaare' },

  // ---------- Masse duerfen NICHT als Budget gelesen werden ----------
  { text: 'Matratze 140x200 bis 500 Franken',              budget: 500,  begriff: 'Matratze 140x200' },
  { text: 'Kinderfahrrad 20 Zoll bis 400 Franken',         budget: 400,  begriff: 'Kinderfahrrad 20 Zoll' },

  // ---------- Tippfehler ----------
  { text: 'kopfhöhrer bis 100 fr',                         budget: 100,  begriff: 'kopfhöhrer' }
];

let gut = 0;
const fehler = [];

for (const f of FAELLE) {
  const budgetIst = extrahiereBudget(f.text);
  const begriffIst = sucheBegriff(f.text);

  const budgetOk = budgetIst === f.budget;
  const begriffOk = begriffIst.toLowerCase() === f.begriff.toLowerCase();

  if (budgetOk && begriffOk) {
    gut += 1;
    continue;
  }

  fehler.push({ f, budgetIst, begriffIst, budgetOk, begriffOk });
}

console.log('');
for (const e of fehler) {
  console.log(`FEHLER  ${e.f.text}`);
  if (!e.budgetOk) console.log(`        Budget:   ${e.budgetIst}  (erwartet ${e.f.budget})`);
  if (!e.begriffOk) console.log(`        Begriff:  "${e.begriffIst}"  (erwartet "${e.f.begriff}")`);
}

console.log('\n========================================');
console.log(`  ${gut} von ${FAELLE.length} richtig`);
console.log('========================================\n');

if (gut < FAELLE.length) {
  console.log('Diese Pruefung kostet nichts. Erst wenn sie sauber ist,');
  console.log('lohnt sich ein Lauf des Pruefkatalogs.\n');
}

process.exit(gut === FAELLE.length ? 0 : 1);