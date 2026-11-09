// ============================================
// SYNORA - Preisverdacht: wirkt ab der ersten Suche
// ============================================
// GEFUNDEN am 08.11.2026 bei einer Monitor-Suche:
//
//   HP Monitor OMEN 32c   CHF 21.92
//
// Ein 32-Zoll-Gaming-Monitor fuer 21.92. SYNORA hat aktiv dazu
// geraten: "lohnt sich der HP OMEN 32c fuer unter 22 CHF".
//
// Es GIBT bereits eine Preispruefung - wissenService.js:473. Sie hat
// nicht angeschlagen, und am 09.11.2026 war klar warum:
//
//   if (!spanne || !spanne.mittel || spanne.anzahl < 2) return null;
//
// Sie braucht eine GESPEICHERTE Preisspanne fuer genau dieses Produkt,
// aus mindestens zwei Shops. Die kommt aus dem Produktwissen, das pro
// Produkt einmal von der SerpAPI-Produktseite geholt wird. Sieht
// SYNORA ein Produkt zum ersten Mal, ist die Spanne leer und die
// Pruefung gibt sofort null zurueck.
//
// Jede Erstsuche war damit ungeschuetzt. Und eine Erstsuche war es.
//
// ============================================
// DIE DATEN SIND LAENGST DA
// ============================================
// Bei jeder Suche kommen rund vierzig Angebote zurueck. Darunter sind
// oft mehrere fuer dasselbe Geraet. Ein OMEN 32c fuer CHF 310 bei
// Digitec und derselbe fuer CHF 21.92 woanders - dieser Vergleich
// braucht kein gespeichertes Wissen. Er steht in den vierzig Treffern
// dieser einen Suche.
//
// Und das Werkzeug zum Gruppieren gibt es auch schon:
// schluesselBauen() erkennt denselben Artikel ueber verschiedene
// Shop-Schreibweisen hinweg (chatController.js:1134 benutzt es).
//
// Also: dieselbe Logik, dieselbe 50-Prozent-Grenze, nur eine zweite
// Datenquelle. Kein zusaetzlicher Abruf, keine Kosten, wirkt sofort.
//
// Gespeichertes Wissen bleibt staerker und wird zuerst genommen - es
// kennt die Preise ueber Wochen, nicht nur die dieser Minute.
//
// ============================================
// DER ZWEITE TEIL: DAS MODELL MUSS ES WISSEN
// ============================================
// Heute wird die Warnung NACHTRAEGLICH vor die Nachteile gesetzt -
// das Modell hat seinen Text da laengst geschrieben. Darum konnte es
// "lohnt sich fuer unter 22 CHF" schreiben, waehrend darunter eine
// Faelschungswarnung stand. Warnung und Empfehlung im selben Produkt,
// und der Kunde glaubt dem freundlicheren Satz.
//
// Darum bekommt das Modell den Verdacht jetzt VORHER, als Angabe
// neben SHOP-STUFE:
//
//   SHOP-STUFE: 2 (1 ist am besten, 6 am schlechtesten)
//   PREIS-VERDACHT: ja - weit unter allen anderen Angeboten
//
// Dasselbe Vorgehen wie bei den Bewertungszahlen heute Mittag: der
// Code urteilt, das Modell formuliert.
//
// ============================================
// ENTSCHIEDEN AM 09.11.2026: WARNEN, NICHT AUSSORTIEREN
// ============================================
// Das Angebot bleibt in der Empfehlung, die Warnung steht als erster
// DAGEGEN-Punkt. Begruendung: SYNORA beraet, sie bevormundet nicht,
// und ein echtes Schnaeppchen soll nicht verschwinden.
//
// Das macht den Lebendvergleich auch sicher einzufuehren. Er kann
// danebengreifen - wenn zwei Angebote denselben Namen tragen, aber
// eines ein Standfuss ist. Bei "aussortieren" waere das ein
// verlorenes Produkt. Bei "warnen" ist es ein ueberfluessiger Satz.
//
// ============================================
// WAS DIESES SKRIPT NICHT ANFASST
// ============================================
// Die Preiswarnung landet weiterhin in der Liste "gestrichen"
// (chatController.js:1410), obwohl dort nichts gestrichen, sondern
// etwas hinzugefuegt wurde. Das verfaelscht die Messlatte im
// Pruefblatt ("gestrichen: 0"). Das ist ein eigener, kleiner Eingriff
// und braucht erst einen Blick in scripts/sucheNachschauen.js.
//
// ============================================
// Aufruf im Ordner synora-backend-main:
//   node preisVerdacht.js
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const WISSEN = path.join('src', 'services', 'wissenService.js');
const CONTROLLER = path.join('src', 'controllers', 'chatController.js');
const CLAUDE = path.join('src', 'services', 'claudeService.js');
const MARKE = 'PREIS-VERDACHT';

const AENDERUNGEN = [
  // ------------------------------------------------------------
  {
    datei: WISSEN,
    was: '1/4  Lebendvergleich und gemeinsame Pruefung',
    alt:
`function preisVerdaechtig(produkt, wissen) {
  const spanne = wissen && wissen.preisSpanne;
  if (!spanne || !spanne.mittel || spanne.anzahl < 2) return null;

  const preis = typeof produkt.priceValue === 'number' ? produkt.priceValue : null;
  if (!preis || preis <= 0) return null;

  const anteil = preis / spanne.mittel;
  if (anteil >= 0.5) return null;

  return \`Dieses Angebot kostet \${preis} Franken, andere Shops verlangen um \${spanne.mittel}. \`
    + 'Das ist ungewoehnlich weit darunter - bei Markenware ein Hinweis auf Faelschung '
    + 'oder darauf, dass nicht das vollstaendige Produkt geliefert wird.';
}`,
    neu:
`function preisVerdaechtig(produkt, wissen) {
  return preisVerdaechtigGegen(produkt, wissen && wissen.preisSpanne);
}

/**
 * Dieselbe Pruefung, aber gegen eine beliebige Preisspanne - egal ob
 * sie aus der Datenbank kommt oder aus der laufenden Suche.
 *
 * Angebaut am 09.11.2026. Vorher nahm preisVerdaechtig die Spanne nur
 * aus dem gespeicherten Produktwissen. Das gibt es bei einem Produkt,
 * das SYNORA zum ersten Mal sieht, noch nicht - und genau so ein
 * Erstfall war der OMEN 32c fuer CHF 21.92.
 *
 * @returns {string|null} Warnung im Klartext
 */
function preisVerdaechtigGegen(produkt, spanne) {
  if (!spanne || !spanne.mittel || spanne.anzahl < 2) return null;

  const preis = typeof produkt.priceValue === 'number' ? produkt.priceValue : null;
  if (!preis || preis <= 0) return null;

  const anteil = preis / spanne.mittel;
  if (anteil >= 0.5) return null;

  const gerundet = Math.round(spanne.mittel);
  return \`Dieses Angebot kostet \${preis} Franken, andere Shops verlangen um \${gerundet}. \`
    + 'Das ist ungewoehnlich weit darunter - bei Markenware ein Hinweis auf Faelschung '
    + 'oder darauf, dass nicht das vollstaendige Produkt geliefert wird.';
}

/**
 * Baut Preisspannen aus den Angeboten EINER laufenden Suche.
 *
 * Google liefert pro Suche rund vierzig Treffer, darunter oft mehrere
 * fuer dasselbe Geraet bei verschiedenen Shops. Daraus laesst sich
 * eine Spanne bilden, ohne irgendetwas nachzuschlagen.
 *
 * Gruppiert wird ueber schluesselBauen() - dieselbe Normalisierung,
 * mit der auch das Produktwissen denselben Artikel ueber verschiedene
 * Shop-Schreibweisen hinweg wiedererkennt.
 *
 * Genommen wird der MEDIAN, nicht der Durchschnitt. Ein einzelner
 * Ausreisser nach unten - also genau der Faelschungsverdacht - wuerde
 * den Durchschnitt mit nach unten ziehen und sich dadurch selbst
 * unverdaechtig machen. Der Median tut das nicht.
 *
 * Mindestens zwei Angebote pro Gruppe, dieselbe Huerde wie beim
 * gespeicherten Wissen.
 *
 * @returns {Map<string, {mittel:number, anzahl:number, woher:string}>}
 */
function preisgruppenBauen(produkte) {
  const nachSchluessel = new Map();

  for (const p of Array.isArray(produkte) ? produkte : []) {
    const preis = typeof p.priceValue === 'number' ? p.priceValue : null;
    if (!preis || preis <= 0) continue;
    const s = schluesselBauen(p.title || p.name || '');
    if (!s) continue;
    if (!nachSchluessel.has(s)) nachSchluessel.set(s, []);
    nachSchluessel.get(s).push(preis);
  }

  const spannen = new Map();
  for (const [s, preise] of nachSchluessel) {
    if (preise.length < 2) continue;
    const sortiert = preise.slice().sort((a, b) => a - b);
    const mitte = Math.floor(sortiert.length / 2);
    const median = sortiert.length % 2
      ? sortiert[mitte]
      : (sortiert[mitte - 1] + sortiert[mitte]) / 2;
    spannen.set(s, { mittel: median, anzahl: preise.length, woher: 'laufende Suche' });
  }

  return spannen;
}`
  },

  // ------------------------------------------------------------
  {
    datei: WISSEN,
    was: '2/4  Die neuen Funktionen ausliefern',
    alt:
`module.exports = {
  zuProdukt,
  preisVerdaechtig,`,
    neu:
`module.exports = {
  zuProdukt,
  preisVerdaechtig,
  preisVerdaechtigGegen,   // angebaut 09.11.2026
  preisgruppenBauen,       // angebaut 09.11.2026`
  },

  // ------------------------------------------------------------
  {
    datei: CONTROLLER,
    was: '3/4  Spanne waehlen und Verdacht setzen',
    alt:
`      if (mitWissen) console.log(\`[wissen] \${mitWissen} von \${mitId.length} Produkten mit Zusatzdaten\`);
    } catch (e) {
      // Ohne Zusatzwissen laeuft die Suche weiter, nur duenner
      console.warn('[wissen] nicht verfuegbar:', e.message);
    }`,
    neu:
`      if (mitWissen) console.log(\`[wissen] \${mitWissen} von \${mitId.length} Produkten mit Zusatzdaten\`);
    } catch (e) {
      // Ohne Zusatzwissen laeuft die Suche weiter, nur duenner
      console.warn('[wissen] nicht verfuegbar:', e.message);
    }

    // ---------- Preisverdacht (angebaut 09.11.2026) ----------
    // Bis hierher konnte ein Faelschungsverdacht nur entstehen, wenn
    // zu dem Produkt schon eine gespeicherte Preisspanne vorlag. Bei
    // einem Produkt, das SYNORA zum ersten Mal sieht, gab es keine -
    // und genau so ein Erstfall war der OMEN 32c fuer CHF 21.92 am
    // 08.11.2026.
    //
    // Die vierzig Treffer dieser Suche enthalten aber oft mehrere
    // Angebote fuer dasselbe Geraet. Daraus laesst sich sofort eine
    // Spanne bilden, ohne Abruf und ohne Kosten.
    //
    // Gespeichertes Wissen bleibt staerker: es kennt die Preise ueber
    // Wochen, nicht nur die dieser Minute.
    try {
      const liveSpannen = produktWissen.preisgruppenBauen(mitId);
      let verdachtZahl = 0;

      for (const p of mitId) {
        const gespeichert = p.wissen && p.wissen.preisSpanne;
        const brauchbar = gespeichert && gespeichert.mittel && gespeichert.anzahl >= 2;

        p.preisSpanne = brauchbar
          ? gespeichert
          : (liveSpannen.get(produktWissen.schluesselBauen(p.title || p.name || '')) || null);

        p.preisVerdacht = !!produktWissen.preisVerdaechtigGegen(p, p.preisSpanne);
        if (p.preisVerdacht) {
          verdachtZahl += 1;
          console.warn(\`[preis] Verdacht: \${p.title} fuer \${p.priceValue}, \`
            + \`ueblich um \${Math.round(p.preisSpanne.mittel)} (\${p.preisSpanne.woher || 'gespeichert'})\`);
        }
      }

      if (verdachtZahl) console.log(\`[preis] \${verdachtZahl} Angebot(e) mit Preisverdacht\`);
    } catch (e) {
      // Faellt der Vergleich aus, laeuft die Suche weiter - nur ohne
      // Verdachtspruefung. Er darf nie eine Suche verhindern.
      console.warn('[preis] Vergleich nicht moeglich:', e.message);
    }`
  },

  // ------------------------------------------------------------
  {
    datei: CLAUDE,
    was: '4/4  Das Modell erfaehrt den Verdacht VOR der Bewertung',
    alt:
`    if (typeof p.shopStufe === 'number') {
      prompt += \`   SHOP-STUFE: \${p.shopStufe} (1 ist am besten, 6 am schlechtesten)\\n\`;
    }`,
    neu:
`    if (typeof p.shopStufe === 'number') {
      prompt += \`   SHOP-STUFE: \${p.shopStufe} (1 ist am besten, 6 am schlechtesten)\\n\`;
    }

    // ---------- Preisverdacht (angebaut 09.11.2026) ----------
    // Bis heute stand die Faelschungswarnung erst NACH der Bewertung
    // in den Nachteilen - das Modell hatte seinen Text da laengst
    // geschrieben. Darum konnte es am 08.11.2026 formulieren:
    // "lohnt sich der HP OMEN 32c fuer unter 22 CHF", waehrend
    // darunter eine Faelschungswarnung stand.
    //
    // Jetzt steht der Verdacht in den Daten, bevor das Modell urteilt.
    // Gleiches Vorgehen wie bei SHOP-STUFE: der Code entscheidet, das
    // Modell formuliert.
    if (p.preisVerdacht) {
      prompt += \`   PREIS-VERDACHT: ja - dieses Angebot liegt weit unter allen anderen\\n\`;
      prompt += \`   Empfiehl es nicht wegen des Preises. Der niedrige Preis ist hier\\n\`;
      prompt += \`   kein Vorteil, sondern ein Warnzeichen.\\n\`;
    }`
  }
];

const MUSS_DA_SEIN = [
  [WISSEN, 'function preisVerdaechtigGegen(produkt, spanne)'],
  [WISSEN, 'function preisgruppenBauen(produkte)'],
  [WISSEN, 'preisVerdaechtigGegen,   // angebaut 09.11.2026'],
  [WISSEN, 'preisgruppenBauen,       // angebaut 09.11.2026'],
  [CONTROLLER, 'produktWissen.preisgruppenBauen(mitId)'],
  [CONTROLLER, 'p.preisVerdacht = !!produktWissen.preisVerdaechtigGegen(p, p.preisSpanne);'],
  [CLAUDE, 'PREIS-VERDACHT: ja - dieses Angebot liegt weit unter allen anderen']
];

// ============================================

function zeitstempel() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}-${z(d.getMinutes())}`;
}

function zaehlen(heuhaufen, nadel) {
  let n = 0;
  let i = heuhaufen.indexOf(nadel);
  while (i !== -1) { n++; i = heuhaufen.indexOf(nadel, i + nadel.length); }
  return n;
}

function main() {
  console.log('');
  console.log('SYNORA - Preisverdacht ab der ersten Suche');
  console.log('==========================================');
  console.log('');

  const dateien = [WISSEN, CONTROLLER, CLAUDE];

  for (const d of dateien) {
    if (!fs.existsSync(d)) {
      console.log(`ABBRUCH: ${d} nicht gefunden.`);
      console.log('Bist du im Ordner synora-backend-main?');
      process.exit(1);
    }
  }

  const stand = new Map();
  for (const d of dateien) {
    const roh = fs.readFileSync(d, 'utf8');
    stand.set(d, { roh, hatCRLF: roh.includes('\r\n'), txt: roh.replace(/\r\n/g, '\n') });
    console.log(`${d}`);
    console.log(`   ${roh.length} Zeichen, ${roh.includes('\r\n') ? 'CRLF' : 'LF'}`);
  }
  console.log('');

  if (stand.get(CLAUDE).txt.includes(MARKE)) {
    console.log('Bereits eingebaut. Es wird nichts geaendert.');
    process.exit(0);
  }

  // ---------- Pruefung ----------
  console.log('Pruefung:');
  let allesOk = true;
  for (const a of AENDERUNGEN) {
    const n = zaehlen(stand.get(a.datei).txt, a.alt);
    if (n === 1) {
      console.log(`  OK      ${a.was}`);
    } else {
      console.log(`  FEHLER  ${a.was}  (${n} mal gefunden, erwartet: 1)`);
      allesOk = false;
    }
  }
  console.log('');

  if (!allesOk) {
    console.log('ABBRUCH. Es wurde NICHTS geaendert, in keiner der drei Dateien.');
    console.log('Schick die Ausgabe weiter, dann wird das Skript angepasst.');
    process.exit(1);
  }

  // ---------- Sicherungen ----------
  const sicherungen = new Map();
  for (const d of dateien) {
    const s = `${d}.sicherung-${zeitstempel()}`;
    fs.copyFileSync(d, s);
    sicherungen.set(d, s);
    console.log(`Sicherung:  ${s}`);
  }

  for (const d of dateien) {
    let txt = stand.get(d).txt;
    for (const a of AENDERUNGEN) if (a.datei === d) txt = txt.replace(a.alt, a.neu);
    if (stand.get(d).hatCRLF) txt = txt.replace(/\n/g, '\r\n');
    fs.writeFileSync(d, txt, 'utf8');
  }

  function zurueckspielen(grund) {
    for (const d of dateien) fs.copyFileSync(sicherungen.get(d), d);
    console.log('');
    console.log(`ABBRUCH: ${grund}`);
    console.log('ALLE DREI Dateien sind zurueckgespielt und wieder genau so,');
    console.log('wie sie vorher waren.');
    process.exit(1);
  }

  // ---------- Gegenprobe ----------
  console.log('');
  console.log('Gegenprobe:');
  let ok = true;

  for (const [d, s] of MUSS_DA_SEIN) {
    const da = fs.readFileSync(d, 'utf8').includes(s);
    const kurz = s.length > 52 ? s.slice(0, 51) + '…' : s;
    console.log(`  ${da ? 'OK     ' : 'FEHLT  '} ${kurz}`);
    if (!da) ok = false;
  }

  if (!ok) zurueckspielen('die Gegenprobe ist nicht sauber.');

  // ---------- Schreibweise ----------
  // node --check fuehrt nichts aus - wichtig, weil diese Dateien beim
  // Laden Umgebungsvariablen und Schluessel erwarten wuerden.
  const { execFileSync } = require('child_process');
  for (const d of dateien) {
    let gut = false;
    let fehler = '';
    try {
      execFileSync(process.execPath, ['--check', path.resolve(d)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      gut = true;
    } catch (e) {
      fehler = (e.stderr ? String(e.stderr) : '') || e.message;
    }
    console.log(`  ${gut ? 'OK     ' : 'FEHLER '} ${path.basename(d)} ist syntaktisch in Ordnung`);
    if (!gut) {
      console.log('');
      console.log(fehler);
      zurueckspielen(`${path.basename(d)} hat einen Schreibfehler.`);
    }
  }

  // ---------- Verhalten ----------
  // Die Preisgruppen lassen sich echt rechnen: wissenService.js laedt
  // ohne Schluessel und ohne Datenbank.
  console.log('');
  console.log('Probe mit erfundenen Angeboten (so wie am 08.11.):');
  const pruefdatei = path.join(require('os').tmpdir(), `synora-preis-${Date.now()}.js`);
  fs.writeFileSync(
    pruefdatei,
    [
      "'use strict';",
      `const w = require(${JSON.stringify(path.resolve(WISSEN))});`,
      'const angebote = [',
      "  { title: 'HP Monitor OMEN 32c', priceValue: 310 },",
      "  { title: 'HP OMEN 32c Monitor',  priceValue: 299 },",
      "  { title: 'HP Monitor OMEN 32c',  priceValue: 21.92 },",
      "  { title: 'Philips 27E1N1800AE',  priceValue: 150 },",
      "  { title: 'Philips 27E1N1800AE',  priceValue: 159 }",
      '];',
      'const spannen = w.preisgruppenBauen(angebote);',
      'const raus = angebote.map((a) => {',
      '  const s = spannen.get(w.schluesselBauen(a.title));',
      '  return [a.title, a.priceValue, s ? s.mittel : null, !!w.preisVerdaechtigGegen(a, s)];',
      '});',
      "console.log('###' + JSON.stringify(raus));"
    ].join('\n'),
    'utf8'
  );

  let zeilen = null;
  try {
    const ausgabe = execFileSync(process.execPath, [pruefdatei], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    zeilen = JSON.parse(String(ausgabe).split('###')[1].trim());
  } catch (e) {
    console.log('  (Probe nicht moeglich: ' + ((e.stderr ? String(e.stderr) : '') || e.message).split('\n')[0] + ')');
  } finally {
    try { fs.unlinkSync(pruefdatei); } catch (_) {}
  }

  if (zeilen) {
    for (const [titel, preis, mittel, verdacht] of zeilen) {
      const t = titel.length > 24 ? titel.slice(0, 23) + '…' : titel;
      console.log(`  ${verdacht ? 'VERDACHT' : '   ok   '} ${t.padEnd(25)} ${String(preis).padStart(7)}   ueblich ${mittel === null ? '-' : mittel}`);
    }
    const treffer = zeilen.filter((z) => z[3]).length;
    if (treffer !== 1) {
      console.log('');
      console.log(`  ACHTUNG: erwartet war genau 1 Verdacht, gefunden ${treffer}.`);
      zurueckspielen('die Probe hat nicht das erwartete Ergebnis geliefert.');
    }
  }

  console.log('');
  console.log('FERTIG. Der Preisverdacht wirkt jetzt ab der ersten Suche.');
  console.log('');
  console.log('In den Railway-Logs steht ab jetzt bei einem Fund:');
  console.log('  [preis] Verdacht: <Produkt> fuer <Preis>, ueblich um <Median> (laufende Suche)');
  console.log('');
  console.log('Naechster Schritt: hochladen, dann baut Railway neu.');
  console.log('');
}

main();
