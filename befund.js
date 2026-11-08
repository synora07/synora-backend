// ============================================
// SYNORA - Befund: was muss als naechstes repariert werden
// ============================================
// Dieses Werkzeug AENDERT NICHTS. Es liest nur und berichtet.
// Es legt keine Datei an, es loescht keine, es schreibt in keine.
//
// Es liest ausschliesslich im Ordner src/. An .env fasst es nicht an,
// und es gibt auch keinen Wert einer Umgebungsvariable aus - nur Namen.
//
// Hintergrund: am 08.11.2026 hat
//   node scripts/sucheNachschauen.js --lauf
// vier Befunde geliefert:
//
//   1. Tippfehler brachen die Kategorie-Erkennung   -> repariert
//   2. 3 von 3 Bewertungszahlen waren erfunden      -> hier
//   3. Antwortzeit 19.1 s und 27.0 s                -> hier
//   4. Modelle uneins beim ersten Platz (1 von 2)   -> hier
//
// Fuer 2, 3 und 4 muss ich sehen, wie der Code heute arbeitet.
// Dieses Werkzeug zeigt genau die Stellen, um die es geht.
//
// Aufruf im Ordner synora-backend-main:
//   node befund.js
//
// Die Ausgabe ist lang. Schick sie ganz weiter.
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const WURZEL = 'src';
const MAX_TREFFER = 14;      // pro Suchbegriff, damit es lesbar bleibt
const MAX_ZEILE = 150;

// ============================================

function alleDateien(ordner, gesammelt) {
  const liste = gesammelt || [];
  let eintraege;
  try {
    eintraege = fs.readdirSync(ordner, { withFileTypes: true });
  } catch (_) {
    return liste;
  }
  for (const e of eintraege) {
    const p = path.join(ordner, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      alleDateien(p, liste);
    } else if (e.name.endsWith('.js') && !e.name.includes('.sicherung-')) {
      liste.push(p);
    }
  }
  return liste;
}

function suchen(dateien, muster) {
  const treffer = [];
  for (const d of dateien) {
    let text;
    try {
      text = fs.readFileSync(d, 'utf8');
    } catch (_) {
      continue;
    }
    const zeilen = text.replace(/\r\n/g, '\n').split('\n');
    for (let i = 0; i < zeilen.length; i++) {
      if (muster.test(zeilen[i])) {
        let z = zeilen[i].trim();
        if (z.length > MAX_ZEILE) z = z.slice(0, MAX_ZEILE - 1) + '…';
        treffer.push({ datei: d, nr: i + 1, text: z });
      }
    }
  }
  return treffer;
}

function abschnitt(nummer, titel, warum) {
  console.log('');
  console.log('============================================');
  console.log(`BEFUND ${nummer}: ${titel}`);
  console.log('============================================');
  if (warum) console.log(warum);
  console.log('');
}

function zeigen(treffer) {
  if (treffer.length === 0) {
    console.log('  (keine Fundstelle)');
    return;
  }
  const sichtbar = treffer.slice(0, MAX_TREFFER);
  for (const t of sichtbar) {
    console.log(`  ${t.datei}:${t.nr}`);
    console.log(`      ${t.text}`);
  }
  if (treffer.length > sichtbar.length) {
    console.log(`  ... und ${treffer.length - sichtbar.length} weitere`);
  }
}

// ============================================

function main() {
  console.log('');
  console.log('SYNORA - Befund (liest nur, aendert nichts)');
  console.log('===========================================');

  if (!fs.existsSync(WURZEL)) {
    console.log('');
    console.log(`ABBRUCH: Ordner ${WURZEL} nicht gefunden.`);
    console.log('Bist du im Ordner synora-backend-main?');
    process.exit(1);
  }

  const dateien = alleDateien(WURZEL);
  console.log(`Durchsucht: ${dateien.length} Dateien unter ${WURZEL}/`);

  // ---------- 1 ----------
  abschnitt(
    1,
    'Haben die Kategorien Preisgrenzen?',
    'Fuer eine Preispruefung ("ein OMEN 32c kostet keine 21.92") brauche\n' +
    'ich eine Vorstellung, was in einer Kategorie ueblich ist. Die Frage\n' +
    'ist, ob die schon irgendwo steht oder erst gebaut werden muss.'
  );
  try {
    const k = require(path.resolve(WURZEL, 'services', 'shopKategorien.js'));
    const namen = typeof k.alleKategorien === 'function' ? k.alleKategorien() : Object.keys(k.KATEGORIEN || {});
    console.log(`  Kategorien insgesamt: ${namen.length}`);
    console.log('');
    console.log('  Die ersten drei, komplett:');
    for (const n of namen.slice(0, 3)) {
      const inhalt = (typeof k.zahlen === 'function' ? k.zahlen(n) : null) || (k.KATEGORIEN || {})[n];
      console.log(`    ${n}`);
      console.log(`      ${JSON.stringify(inhalt)}`);
    }
    console.log('');
    console.log(`  Einzelbegriffe in der Liste: ${k.BEGRIFF_ZU_KATEGORIE ? k.BEGRIFF_ZU_KATEGORIE.size : '?'}`);
    console.log(`  Toleranter Vergleich eingebaut: ${typeof k.kategorieRaten === 'function' ? 'ja' : 'nein'}`);
  } catch (e) {
    console.log(`  Konnte shopKategorien.js nicht laden: ${e.message}`);
  }

  // ---------- 2 ----------
  abschnitt(
    2,
    'Wo bekommt das Modell seine Anweisungen?',
    'Das Modell hat in 3 von 3 Faellen Bewertungszahlen erfunden.\n' +
    'Die Faktenpruefung hat sie gestrichen - gut. Aber die Ursache liegt\n' +
    'davor: offenbar wird das Modell gebeten, etwas zu schreiben, wofuer\n' +
    'es keine Daten hat. Hier stehen die Stellen, an denen es Text\n' +
    'bekommt.'
  );
  zeigen(suchen(dateien, /\b(system|systemPrompt|anweisung|Anweisung|rolle:|role:)\b/));

  // ---------- 3 ----------
  abschnitt(
    3,
    'Die Faktenpruefung',
    'Sie funktioniert - 3 von 3 erfundenen Zahlen erkannt. Ich will\n' +
    'sehen, was sie prueft und was sie durchlaesst. Alles, was sie nicht\n' +
    'prueft, kann das Modell weiter unbemerkt erfinden.'
  );
  zeigen(suchen(dateien, /gestrichen|faktenPruefung|faktenpruefung|behauptung|Behauptung/));

  // ---------- 4 ----------
  abschnitt(
    4,
    'Welche Felder hat ein Produkt?',
    'Eine Preispruefung und eine Belegpflicht koennen nur mit Feldern\n' +
    'arbeiten, die wirklich da sind. Darum: was kommt von SerpAPI an?'
  );
  zeigen(suchen(dateien, /\b(reviews|rating|bewertungAnzahl|bewertungen|sterne)\b\s*[:=]/));

  // ---------- 5 ----------
  abschnitt(
    5,
    'Wo wird auf die Modelle gewartet?',
    'Antwortzeit 19.1 s und 27.0 s. Das Pflichtenheft sagt: erste\n' +
    'Zeichen unter 2 Sekunden. Entscheidend ist, ob die Modelle\n' +
    'nacheinander oder gleichzeitig gefragt werden.'
  );
  zeigen(suchen(dateien, /Promise\.all|Promise\.allSettled|await\s+\w*[mM]odell|await\s+frage|for\s*\(.*await/));

  // ---------- 6 ----------
  abschnitt(
    6,
    'Der Konsens zwischen den Modellen',
    'In 1 von 2 Laeufen waren die Modelle beim ersten Platz uneins.\n' +
    'Die Frage ist, was dann passiert: wird eines bevorzugt, wird\n' +
    'gemittelt, oder entscheidet der Zufall?'
  );
  zeigen(suchen(dateien, /konsens|Konsens|einstimmig|uneinig|mehrheit|Mehrheit/));

  console.log('');
  console.log('============================================');
  console.log('Ende. Es wurde nichts geaendert.');
  console.log('============================================');
  console.log('');
}

main();
