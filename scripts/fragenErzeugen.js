// ============================================
// SYNORA - Fragen erzeugen
// ============================================
// Aufruf:  node scripts/fragenErzeugen.js
//          node scripts/fragenErzeugen.js 1400
//
// Setzt aus Bausteinen einen grossen Fragenvorrat zusammen:
// Produktart mal Schreibweise mal Schwierigkeit mal Budget.
// Schreibt scripts/pruefkatalogVorrat.js.
//
// WOZU: Die 84 Kernfragen pruefen die bekannten Faelle. Der Vorrat
// prueft die Breite - Kategorien, Schreibweisen und Formulierungen,
// an die wir beim Bauen nicht gedacht haben.
//
// ACHTUNG KOSTEN: Jede Frage kostet beim ERSTEN Durchlauf bis zu
// vier SerpAPI-Abfragen. Darum laeuft der Katalog nur eine
// Stichprobe daraus - siehe --zufall im Pruefkatalog.
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const ZIEL = Number(process.argv[2]) || 1400;

// ============================================
// BAUSTEINE
// ============================================

// Produktarten mit passenden Zwecken und einem sinnvollen
// Preisbereich. Ohne den Bereich kaemen Fragen wie "Katzenstreu
// bis 2000 Franken" heraus.
const PRODUKTE = [
  // elektronik
  { was: 'Kopfhörer', von: 40, bis: 400, zwecke: ['zum Pendeln', 'zum Sport', 'fürs Büro', 'zum Telefonieren', 'zum Gamen'], marken: ['Sony', 'JBL', 'Bose'] },
  { was: 'Laptop', von: 400, bis: 2500, zwecke: ['für die Schule', 'fürs Büro', 'zum Gamen', 'für Videobearbeitung', 'für die Uni'], marken: ['Lenovo', 'HP', 'Apple'] },
  { was: 'Smartphone', von: 200, bis: 1400, zwecke: ['für die Kamera', 'für lange Akkulaufzeit', 'für meine Mutter'], marken: ['Samsung', 'Apple', 'Xiaomi'] },
  { was: 'Fernseher', von: 300, bis: 2000, zwecke: ['fürs Wohnzimmer', 'für Sport', 'für die Küche'], marken: ['LG', 'Samsung', 'Philips'] },
  { was: 'Monitor', von: 150, bis: 900, zwecke: ['fürs Homeoffice', 'zum Gamen', 'für Bildbearbeitung'], marken: ['Dell', 'LG', 'Asus'] },
  { was: 'Tastatur', von: 30, bis: 300, zwecke: ['für langes Schreiben', 'zum Gamen'], marken: ['Logitech', 'Cherry'] },
  { was: 'Maus', von: 20, bis: 200, zwecke: ['fürs Büro', 'zum Gamen', 'für kleine Hände'], marken: ['Logitech'] },
  { was: 'Drucker', von: 80, bis: 600, zwecke: ['fürs Homeoffice', 'für Fotos', 'für die Familie'], marken: ['Brother', 'Canon', 'HP'] },
  { was: 'Tablet', von: 150, bis: 1200, zwecke: ['für die Schule', 'zum Zeichnen', 'für unterwegs'], marken: ['Apple', 'Samsung'] },
  { was: 'Kamera', von: 200, bis: 2500, zwecke: ['für Einsteiger', 'für Reisen', 'für Videos'], marken: ['Canon', 'Nikon', 'Sony'] },
  { was: 'Bluetooth-Lautsprecher', von: 40, bis: 400, zwecke: ['für draussen', 'fürs Bad', 'für Partys'], marken: ['JBL', 'Bose'] },
  { was: 'Smartwatch', von: 80, bis: 800, zwecke: ['zum Laufen', 'für den Schlaf', 'für Benachrichtigungen'], marken: ['Garmin', 'Apple', 'Samsung'] },

  // haushalt
  { was: 'Waschmaschine', von: 500, bis: 2000, zwecke: ['für zwei Personen', 'für eine Familie', 'für wenig Platz'], marken: ['Bosch', 'Miele', 'Siemens'] },
  { was: 'Geschirrspüler', von: 400, bis: 1800, zwecke: ['für die Familie', 'für wenig Platz'], marken: ['Bosch', 'Miele'] },
  { was: 'Kaffeemaschine', von: 60, bis: 1500, zwecke: ['für Espresso', 'fürs Büro', 'für Milchschaum'], marken: ['DeLonghi', 'Jura', 'Nespresso'] },
  { was: 'Staubsauger', von: 60, bis: 800, zwecke: ['für Tierhaare', 'für Teppiche', 'für wenig Platz'], marken: ['Dyson', 'Miele'] },
  { was: 'Mikrowelle', von: 60, bis: 500, zwecke: ['für die Küche', 'zum Auftauen'], marken: ['Sharp', 'Bosch'] },
  { was: 'Wasserkocher', von: 20, bis: 150, zwecke: ['für Tee', 'mit Temperaturwahl'], marken: ['Bosch', 'Philips'] },
  { was: 'Luftbefeuchter', von: 40, bis: 300, zwecke: ['fürs Schlafzimmer', 'fürs Kinderzimmer'], marken: [] },
  { was: 'Kochtopfset', von: 60, bis: 500, zwecke: ['für Induktion', 'für die Familie'], marken: ['WMF', 'Fissler'] },

  // moebel
  { was: 'Matratze 140x200', von: 200, bis: 1500, zwecke: ['für Rückenschläfer', 'bei Rückenschmerzen', 'für zwei Personen'], marken: [] },
  { was: 'Bürostuhl', von: 100, bis: 900, zwecke: ['für langes Sitzen', 'bei Rückenschmerzen', 'fürs Homeoffice'], marken: [] },
  { was: 'Schreibtisch', von: 100, bis: 900, zwecke: ['fürs Homeoffice', 'für zwei Bildschirme', 'höhenverstellbar'], marken: [] },
  { was: 'Sofa', von: 400, bis: 3000, zwecke: ['für kleine Wohnungen', 'mit Schlaffunktion'], marken: [] },
  { was: 'Bettwäsche 160x210', von: 30, bis: 200, zwecke: ['für den Sommer', 'aus Baumwolle'], marken: [] },

  // mode
  { was: 'Winterjacke', von: 80, bis: 600, zwecke: ['für Damen', 'für Herren', 'zum Wandern', 'für die Stadt'], marken: ['Mammut', 'Jack Wolfskin'] },
  { was: 'Laufschuhe', von: 70, bis: 350, zwecke: ['für Asphalt', 'für Trail', 'für breite Füsse', 'für Anfänger'], marken: ['Nike', 'Asics', 'Brooks'] },
  { was: 'Wanderschuhe', von: 100, bis: 450, zwecke: ['für Tageswanderungen', 'für Hochtouren'], marken: ['Lowa', 'Meindl'] },
  { was: 'Rucksack', von: 40, bis: 400, zwecke: ['für die Uni', 'zum Wandern', 'für Schulkinder', 'für Reisen'], marken: ['Deuter', 'Ortlieb'] },
  { was: 'Sonnenbrille', von: 30, bis: 400, zwecke: ['zum Velofahren', 'für den Alltag'], marken: ['Ray-Ban', 'Oakley'] },

  // sport und draussen
  { was: 'Velo', von: 300, bis: 3000, zwecke: ['zum Pendeln', 'für die Stadt', 'für Touren'], marken: ['Scott', 'Cube'] },
  { was: 'Kinderfahrrad 20 Zoll', von: 150, bis: 700, zwecke: ['für Anfänger', 'für die Schule'], marken: [] },
  { was: 'Fahrradhelm', von: 40, bis: 300, zwecke: ['für Kinder', 'zum Pendeln'], marken: ['Abus', 'Giro'] },
  { was: 'Schlafsack', von: 50, bis: 500, zwecke: ['für Camping im Sommer', 'für kalte Nächte'], marken: ['Mammut', 'Deuter'] },
  { was: 'Hantelset', von: 50, bis: 500, zwecke: ['für zu Hause', 'für Anfänger'], marken: [] },

  // werkzeug und garten
  { was: 'Akkuschrauber', von: 50, bis: 400, zwecke: ['für zu Hause', 'für die Werkstatt'], marken: ['Bosch', 'Makita'] },
  { was: 'Bohrhammer', von: 100, bis: 700, zwecke: ['für Beton', 'für gelegentliche Arbeiten'], marken: ['Bosch', 'Hilti'] },
  { was: 'Rasenmäher', von: 150, bis: 1200, zwecke: ['für kleinen Garten', 'für grosse Flächen'], marken: ['Gardena', 'Husqvarna'] },
  { was: 'Heckenschere', von: 50, bis: 400, zwecke: ['für den Garten', 'mit Akku'], marken: ['Bosch', 'Stihl'] },
  { was: 'Werkzeugkoffer', von: 60, bis: 400, zwecke: ['für zu Hause', 'für die Grundausstattung'], marken: [] },

  // kind, tier, koerper
  { was: 'Kinderwagen', von: 300, bis: 1500, zwecke: ['für Neugeborene', 'für unebene Wege'], marken: ['Bugaboo', 'Joie'] },
  { was: 'Autositz', von: 150, bis: 800, zwecke: ['für Babys', 'ab drei Jahren'], marken: ['Maxi-Cosi', 'Britax'] },
  { was: 'Hundefutter', von: 30, bis: 200, zwecke: ['für grosse Hunde', 'bei empfindlichem Magen', 'für Welpen'], marken: [] },
  { was: 'Katzenstreu', von: 15, bis: 100, zwecke: ['ohne Staub', 'klumpend'], marken: [] },
  { was: 'Elektrische Zahnbürste', von: 40, bis: 350, zwecke: ['für empfindliches Zahnfleisch', 'für Kinder'], marken: ['Oral-B', 'Philips'] },
  { was: 'Gesichtscreme', von: 15, bis: 150, zwecke: ['für trockene Haut', 'für empfindliche Haut'], marken: ['Nivea', 'La Roche-Posay'] }
];

// ============================================
// SCHREIBWEISEN
// ============================================
// So schreiben echte Leute - nicht wie in einem Lehrbuch.

const SCHREIBWEISEN = [
  { name: 'knapp', bau: (p, b, z) => `${p} bis ${b} Franken` },
  { name: 'normal', bau: (p, b, z) => `${p} ${z} bis ${b} Franken` },
  { name: 'chf', bau: (p, b, z) => `${p} ${z} unter ${b} CHF` },
  { name: 'kurz', bau: (p, b, z) => `${p} max ${b}.-` },
  { name: 'klein', bau: (p, b, z) => `${p.toLowerCase()} ${z} für ca ${b} fr` },
  { name: 'suche', bau: (p, b, z) => `Suche ${p} ${z}, Budget etwa ${b} Franken` },
  { name: 'brauche', bau: (p, b, z) => `Ich brauche ${p} ${z}, nicht mehr als ${b}` },
  { name: 'umgang', bau: (p, b, z) => `hab was gesucht ${z}, so ${b} stutz` },
  { name: 'frage', bau: (p, b, z) => `Was für ${p} ${z} bekomme ich für ${b} Franken?` },
  { name: 'ohneBudget', bau: (p, b, z) => `${p} ${z}` },
  { name: 'apostroph', bau: (p, b, z) => `${p} ${z} bis ${b >= 1000 ? String(b).replace(/(\d)(\d{3})$/, "$1'$2") : b} Franken` },
  { name: 'marke', bau: (p, b, z, m) => (m ? `${m} ${p} bis ${b} Franken` : `${p} bis ${b} Franken`) }
];

// Tippfehler, wie sie wirklich vorkommen
function vertippen(text) {
  const regeln = [
    [/ö/g, 'öh'], [/ü/g, 'ue'], [/ä/g, 'ae'],
    [/ss/g, 's'], [/tt/g, 't'], [/ck/g, 'k']
  ];
  const regel = regeln[Math.floor(Math.random() * regeln.length)];
  return text.replace(regel[0], regel[1]);
}

// ============================================
// ERZEUGEN
// ============================================

function budgetWaehlen(p) {
  // Meist ein sinnvolles Budget, manchmal absichtlich zu knapp -
  // dann muss SYNORA ehrlich sagen, dass es nicht reicht.
  const spanne = p.bis - p.von;
  const knapp = Math.random() < 0.12;
  const roh = knapp ? p.von * 0.5 : p.von + Math.random() * spanne;

  // Auf glatte Zahlen runden, so wie Menschen sie nennen
  if (roh < 100) return Math.round(roh / 10) * 10;
  if (roh < 1000) return Math.round(roh / 50) * 50;
  return Math.round(roh / 100) * 100;
}

function erzeugen(anzahl) {
  const fragen = [];
  const gesehen = new Set();
  let nummer = 0;

  while (fragen.length < anzahl) {
    nummer += 1;
    if (nummer > anzahl * 20) break;   // Notbremse

    const p = PRODUKTE[Math.floor(Math.random() * PRODUKTE.length)];
    const s = SCHREIBWEISEN[Math.floor(Math.random() * SCHREIBWEISEN.length)];
    const zweck = p.zwecke[Math.floor(Math.random() * p.zwecke.length)];
    const marke = p.marken.length ? p.marken[Math.floor(Math.random() * p.marken.length)] : null;
    const budget = budgetWaehlen(p);

    let text = s.bau(p.was, budget, zweck, marke);

    // Jede zwanzigste Frage mit Tippfehler
    const mitFehler = Math.random() < 0.05;
    if (mitFehler) text = vertippen(text);

    if (gesehen.has(text)) continue;
    gesehen.add(text);

    const eintrag = {
      id: `vorrat-${fragen.length + 1}`,
      frage: text,
      schwierigkeit: s.name === 'knapp' || s.name === 'normal' ? 'einfach'
        : s.name === 'umgang' || s.name === 'frage' || mitFehler ? 'schwer'
          : 'mittel'
    };

    // Budget nur pruefen, wenn es auch in der Frage steht
    if (s.name !== 'ohneBudget' && !mitFehler) eintrag.budget = budget;
    if (s.name === 'marke' && marke) eintrag.markeVerlangt = marke.toLowerCase();

    fragen.push(eintrag);
  }

  return fragen;
}

// ============================================
// SCHREIBEN
// ============================================

const fragen = erzeugen(ZIEL);

const kopf = `// ============================================
// SYNORA - Fragenvorrat (erzeugt)
// ============================================
// ${fragen.length} Fragen, erzeugt am ${new Date().toISOString().slice(0, 10)}
// mit scripts/fragenErzeugen.js
//
// NICHT von Hand bearbeiten - beim naechsten Erzeugen wird die
// Datei ueberschrieben. Gute Faelle gehoeren nach
// pruefkatalogFragen.js, dort bleiben sie erhalten.
//
// ACHTUNG KOSTEN: Alle auf einmal aufzunehmen kostet mehrere
// tausend SerpAPI-Abfragen. Der Pruefkatalog laeuft darum nur
// eine Stichprobe:
//   node scripts/pruefkatalog.js --vorrat 50
// ============================================

'use strict';

module.exports = `;

fs.writeFileSync(
  path.join(__dirname, 'pruefkatalogVorrat.js'),
  kopf + JSON.stringify(fragen, null, 2) + ';\n',
  'utf8'
);

// ---------- Zusammenfassung ----------
const nachSchwierigkeit = {};
for (const f of fragen) {
  nachSchwierigkeit[f.schwierigkeit] = (nachSchwierigkeit[f.schwierigkeit] || 0) + 1;
}

console.log(`\n${fragen.length} Fragen geschrieben nach scripts/pruefkatalogVorrat.js\n`);
for (const [stufe, n] of Object.entries(nachSchwierigkeit)) {
  console.log(`  ${stufe.padEnd(10)} ${n}`);
}
console.log(`\n  mit Budget      ${fragen.filter((f) => f.budget).length}`);
console.log(`  mit Marke       ${fragen.filter((f) => f.markeVerlangt).length}`);
console.log('\nBeispiele:');
for (const f of fragen.slice(0, 8)) console.log(`  ${f.frage}`);
console.log('');