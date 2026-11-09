// ============================================
// SYNORA - Jede Zahl mit Einheit braucht einen Beleg
// ============================================
// GEFUNDEN am 09.11.2026 beim Lesen von faktenpruefung.js.
//
// Es gibt fuenf Pruefungen:
//
//   PRUEFUNGEN = [pruefeAnzahl, pruefeSterne, pruefeBauform,
//                 pruefeBelegt, pruefeShop]
//
// Davon sehen sich genau zwei eine Zahl an: die Bewertungsanzahl und
// die Sterne. Alles andere ist wortbasiert.
//
// Und BELEGPFLICHTIG - die Liste der Eigenschaften, die einen Beleg
// brauchen - enthaelt SIEBEN handgeschriebene Paare, und alle sieben
// sind fuer Kopfhoerer:
//
//   kabelgebunden, kabellos, Over-Ear, On-Ear, In-Ear,
//   Geraeuschunterdrueckung, wasserdicht
//
// Fuer Monitore steht dort nichts. Keine Aufloesung, keine
// Bildwiederholrate, kein Panel. Fuer Laptops nichts, fuer Handys
// nichts. VON 110 KATEGORIEN IST EINE ABGEDECKT.
//
// ============================================
// WAS DADURCH DURCHKOMMT
// ============================================
// Am 08.11.2026 stand in einem gestrichenen Satz:
//
//   "4.6 Sterne bei 746 Bewertungen, nur 4% unzufriedene Kaeufer"
//
// Gestrichen wurde er wegen der BEWERTUNGSANZAHL. Die 4% daneben hat
// niemand geprueft - der Satz flog nur zufaellig mit raus. Haette das
// Modell die Anzahl richtig gehabt, waere die Prozentzahl ungeprueft
// beim Kunden gelandet.
//
// Genauso kaemen durch: "825 GB SSD", "12 Stunden Akku",
// "144 Hz", "16 GB RAM", "2 Jahre Garantie" - erfunden oder nicht.
//
// So kommt man nie hinterher. Jede neue Kategorie braeuchte ein
// Dutzend neuer Paare, von Hand, fuer immer.
//
// ============================================
// DIE REGEL, DIE ALLE ERSETZT
// ============================================
//   Jede Zahl, die eine EINHEIT traegt, muss in den gelieferten
//   Daten dieses Produkts stehen. Steht sie nicht da, fliegt der
//   Satz raus.
//
// Prozent, GB, TB, Zoll, Stunden, Hertz, Kerne, Jahre, Kilogramm,
// mAh, Lumen, DPI - auf einen Schlag, ohne je wieder eine Liste zu
// pflegen.
//
// Und sie sichert Regel M vom selben Tag ab: das Modell bekommt die
// Bewertungsanzahl gar nicht mehr geliefert. Jede Anzahl, die es
// trotzdem schreibt, kann also nicht belegt sein.
//
// ============================================
// WARUM NUR ZAHLEN MIT EINHEIT
// ============================================
// "Jede Zahl" waere zu scharf. Dann fiele auch das hier:
//
//   "Liegt mit 150 Franken unter deinem Budget von 200 Franken"
//
// Die 200 sind das Budget des Nutzers, kein Produktdatum - der Satz
// ist richtig und wuerde trotzdem gestrichen. Loecher zu reissen, wo
// nichts falsch war, macht die Antwort nicht besser.
//
// Darum nur Zahlen mit Einheit. Das sind genau die, mit denen
// technische Behauptungen aufgestellt werden. Preise, Budgets,
// Modellnummern und einfache Zaehlungen ("3 von 10 Kaeufern")
// bleiben unangetastet.
//
// Geprueft an zwoelf Saetzen, bevor dieses Skript geschrieben wurde:
//
//   4%                 -> geprueft
//   825-GB-SSD         -> geprueft (auch mit Bindestrich)
//   12 Stunden Akku    -> geprueft
//   27 Zoll, 4K        -> geprueft
//   144 Hz             -> geprueft
//   16 GB, 1 TB        -> geprueft
//   150 Franken        -> nicht angefasst
//   rund 300 CHF       -> nicht angefasst
//   27E1N1800AE        -> nicht angefasst
//   3 von 10 Kaeufern  -> nicht angefasst
//
// ============================================
// DIESER EINGRIFF ENTFERNT TEXT
// ============================================
// Anders als alles bisher Heutige. Zu scharf eingestellt reisst er
// Loecher in Antworten, die in Ordnung waren. Darum:
//
//   - erlaubt sind alle Zahlen aus produktText (Titel, Name,
//     Extensions, Produktwissen)
//   - dazu p.rating und p.reviews, die nicht im Text stehen
//   - 4.0 und 4 gelten als dieselbe Zahl
//
// Und jeder Streich landet im Protokoll, wie die anderen auch. Nach
// zwanzig echten Suchen sieht man im Pruefwerkzeug, ob er zu scharf
// steht.
//
// ============================================
// Aufruf im Ordner synora-backend-main:
//   node zahlenBelegt.js
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const ZIEL = path.join('src', 'services', 'faktenpruefung.js');
const MARKE = 'ZAHL_MIT_EINHEIT';

const AENDERUNGEN = [
  {
    was: '1/1  Zahl-mit-Einheit-Pruefung einhaengen',
    alt: `const PRUEFUNGEN = [pruefeAnzahl, pruefeSterne, pruefeBauform, pruefeBelegt, pruefeShop];`,
    neu:
`// ============================================
// ZAHLEN MIT EINHEIT  (angebaut 09.11.2026)
// ============================================
// BELEGPFLICHTIG oben deckt sieben Eigenschaften ab, und alle sieben
// sind fuer Kopfhoerer. Fuer Monitore, Laptops und Handys steht dort
// nichts - von 110 Kategorien ist eine abgedeckt.
//
// Am 08.11.2026 stand in einem Satz "nur 4% unzufriedene Kaeufer".
// Gestrichen wurde er wegen der Bewertungsanzahl daneben; die
// Prozentzahl hat niemand geprueft. Dasselbe gilt fuer "825 GB SSD",
// "12 Stunden Akku" oder "144 Hz".
//
// Statt die Liste endlos zu verlaengern, eine Regel fuer alle:
// Traegt eine Zahl eine Einheit, muss sie in den Produktdaten stehen.
//
// NUR Zahlen mit Einheit. "Liegt mit 150 Franken unter deinem Budget
// von 200" waere sonst auch betroffen - die 200 sind das Budget des
// Nutzers, kein Produktdatum, und der Satz ist richtig.

// Die Einheiten decken alle Warenwelten ab, nicht nur Elektronik.
// Kiara verkauft auch Kosmetik und Kleidung - dort sind ml, g und
// Prozent die Angaben, auf die es ankommt:
//
//   KOSMETIK   200 ml Flasche, 5% Urea, 250 g Tiegel
//   KLEIDUNG   60% Baumwolle, 320 g, 82 cm Innenbeinlaenge
//   HAUSHALT   1800 W Leistung
//
// Laengere Einheiten stehen vor kuerzeren, damit "16 gb" nicht als
// "16 g" gelesen wird. Das (?![a-z]) am Ende sorgt dafuer, dass
// "5 Wochen" nicht als "5 W" durchgeht.
const ZAHL_MIT_EINHEIT = /(\\d+(?:[.,]\\d+)?)[\\s-]*(prozent|zoll|kerne|kern|stunden|stunde|minuten|minute|monaten|monate|monat|jahren|jahre|jahr|liter|lumen|karat|nits|khz|ghz|mhz|mah|wh|hz|fps|bit|dpi|ppi|std|gb|tb|mb|kb|ml|mg|cm|mm|kg|g|l|w|v|%|"|k)(?![a-z])/gi;

function alleZahlen(text) {
  return (String(text || '').match(/\\d+(?:[.,]\\d+)?/g) || []).map((z) => z.replace(',', '.'));
}

/**
 * Jede Zahl mit Einheit muss in den Produktdaten stehen.
 *
 * Erlaubt sind alle Zahlen aus produktText - also Titel, Name,
 * Extensions und das Produktwissen - dazu Sterne und
 * Bewertungsanzahl, die nicht im Text stehen, aber am Produkt
 * haengen.
 */
function pruefeZahlen(satz, p) {
  const erlaubt = new Set(alleZahlen(produktText(p)));
  if (p && p.rating !== undefined && p.rating !== null) erlaubt.add(String(p.rating).replace(',', '.'));
  if (p && p.reviews !== undefined && p.reviews !== null) erlaubt.add(String(p.reviews).replace(',', '.'));

  // 4.0 und 4 sind dieselbe Zahl - sonst streicht die Pruefung eine
  // richtige Angabe nur wegen der Schreibweise.
  const alsZahlen = [...erlaubt].map(Number).filter(Number.isFinite);

  ZAHL_MIT_EINHEIT.lastIndex = 0;
  let treffer;
  while ((treffer = ZAHL_MIT_EINHEIT.exec(satz)) !== null) {
    const roh = treffer[1].replace(',', '.');
    if (erlaubt.has(roh)) continue;
    const zahl = Number(roh);
    if (Number.isFinite(zahl) && alsZahlen.some((e) => e === zahl)) continue;
    return \`"\${treffer[0].trim()}" steht nicht in den Produktdaten\`;
  }
  return null;
}

const PRUEFUNGEN = [pruefeAnzahl, pruefeSterne, pruefeBauform, pruefeBelegt, pruefeShop, pruefeZahlen];`
  }
];

const MUSS_DA_SEIN = [
  'const ZAHL_MIT_EINHEIT =',
  'function pruefeZahlen(satz, p)',
  'pruefeShop, pruefeZahlen];'
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
  console.log('SYNORA - Jede Zahl mit Einheit braucht einen Beleg');
  console.log('==================================================');
  console.log('');

  if (!fs.existsSync(ZIEL)) {
    console.log(`ABBRUCH: ${ZIEL} nicht gefunden.`);
    process.exit(1);
  }

  const roh = fs.readFileSync(ZIEL, 'utf8');
  const hatCRLF = roh.includes('\r\n');
  let txt = roh.replace(/\r\n/g, '\n');

  console.log(`Datei:   ${ZIEL}`);
  console.log(`         ${roh.length} Zeichen, ${hatCRLF ? 'CRLF' : 'LF'}`);
  console.log('');

  if (txt.includes(MARKE)) {
    console.log('Bereits eingebaut. Es wird nichts geaendert.');
    process.exit(0);
  }

  console.log('Pruefung:');
  let allesOk = true;
  for (const a of AENDERUNGEN) {
    const n = zaehlen(txt, a.alt);
    if (n === 1) {
      console.log(`  OK      ${a.was}`);
    } else {
      console.log(`  FEHLER  ${a.was}  (${n} mal gefunden, erwartet: 1)`);
      allesOk = false;
    }
  }
  console.log('');

  if (!allesOk) {
    console.log('ABBRUCH. Es wurde NICHTS geaendert.');
    process.exit(1);
  }

  const sicherung = `${ZIEL}.sicherung-${zeitstempel()}`;
  fs.copyFileSync(ZIEL, sicherung);
  console.log(`Sicherung:  ${sicherung}`);

  for (const a of AENDERUNGEN) txt = txt.replace(a.alt, a.neu);
  if (hatCRLF) txt = txt.replace(/\n/g, '\r\n');
  fs.writeFileSync(ZIEL, txt, 'utf8');

  function zurueckspielen(grund) {
    fs.copyFileSync(sicherung, ZIEL);
    console.log('');
    console.log(`ABBRUCH: ${grund}`);
    console.log('Die alte Fassung ist zurueckgespielt.');
    process.exit(1);
  }

  const neu = fs.readFileSync(ZIEL, 'utf8');
  console.log('');
  console.log('Gegenprobe:');
  let ok = true;
  for (const s of MUSS_DA_SEIN) {
    const da = neu.includes(s);
    console.log(`  ${da ? 'OK     ' : 'FEHLT  '} ${s}`);
    if (!da) ok = false;
  }
  if (!ok) zurueckspielen('die Gegenprobe ist nicht sauber.');

  const { execFileSync } = require('child_process');
  let syntaxOk = false;
  let fehler = '';
  try {
    execFileSync(process.execPath, ['--check', path.resolve(ZIEL)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    syntaxOk = true;
  } catch (e) {
    fehler = (e.stderr ? String(e.stderr) : '') || e.message;
  }
  console.log(`  ${syntaxOk ? 'OK     ' : 'FEHLER '} die Datei ist syntaktisch in Ordnung`);
  if (!syntaxOk) {
    console.log('');
    console.log(fehler);
    zurueckspielen('die geaenderte Datei hat einen Schreibfehler.');
  }

  // ---------- Verhalten an echten Saetzen ----------
  console.log('');
  console.log('Probe ueber drei Warenwelten - Kiara ist nicht nur Elektronik:');

  // Ein Produkt je Welt, mit genau den Daten, die wirklich bekannt sind.
  const WELTEN = [
    {
      name: 'ELEKTRONIK  Monitor, Daten nennen 27 Zoll und 75 Hz',
      produkt: {
        title: 'Philips Monitor 27E1N1800AE/00 27 Zoll',
        wissenText: 'Bildschirmdiagonale 27 Zoll\nBildwiederholrate 75 Hz\nAnschluesse HDMI, USB-C',
        rating: 4.5,
        reviews: 692
      },
      faelle: [
        ['27 Zoll Diagonale, gut fuer zwei Fenster nebeneinander', false],
        ['75 Hz reichen fuer Buero, nicht fuer schnelle Spiele', false],
        ['144 Hz machen ihn zum Gaming-Monitor', true],
        ['Nur 4% unzufriedene Kaeufer', true],
        ['825-GB-SSD ist knapp bemessen', true],
        ['Liegt mit 150 Franken unter deinem Budget von 200 Franken', false],
        ['4.5 Sterne bei 692 Bewertungen', false]
      ]
    },
    {
      name: 'KOSMETIK    Creme, Daten nennen 200 ml und 5% Urea',
      produkt: {
        title: 'Eucerin UreaRepair Handcreme 200 ml',
        wissenText: 'Inhalt 200 ml\nUrea-Anteil 5%\nOhne Duftstoffe',
        rating: 4.6,
        reviews: 310
      },
      faelle: [
        ['200 ml reichen bei taeglichem Gebrauch lange', false],
        ['5% Urea ist die uebliche Staerke fuer trockene Haut', false],
        ['10% Urea waere fuer dich zu stark', true],
        ['500 ml Flasche fuer den gleichen Preis', true],
        ['Ohne Duftstoffe, gut bei empfindlicher Haut', false]
      ]
    },
    {
      name: 'KLEIDUNG    Hose, Daten nennen 60% Baumwolle und 82 cm',
      produkt: {
        title: 'Levis 511 Slim Jeans',
        wissenText: 'Material 60% Baumwolle, 40% Polyester\nInnenbeinlaenge 82 cm',
        rating: 4.3,
        reviews: 88
      },
      faelle: [
        ['60% Baumwolle, angenehm im Sommer', false],
        ['82 cm Innenbeinlaenge passen bei 180 cm Koerpergroesse', true],
        ['100% Baumwolle, komplett natuerlich', true],
        ['Schlanker Schnitt, nicht fuer breite Oberschenkel', false]
      ]
    }
  ];

  const pruefdatei = path.join(require('os').tmpdir(), `synora-zahlen-${Date.now()}.js`);
  const auftrag = WELTEN.map((w) => ({ produkt: w.produkt, saetze: w.faelle.map((f) => f[0]) }));
  fs.writeFileSync(
    pruefdatei,
    [
      "'use strict';",
      `const f = require(${JSON.stringify(path.resolve(ZIEL))});`,
      `const auftrag = ${JSON.stringify(auftrag)};`,
      'const raus = auftrag.map((a) => {',
      '  const r = f.saetzePruefen(a.saetze, a.produkt) || {};',
      // saetzePruefen liefert { behalten, entfernt } - so steht es in
      // faktenpruefung.js:242. In der ersten Fassung dieses Skripts
      // stand hier r.gestrichen; das gibt es nicht, die Probe fand
      // darum nie etwas und rollte am 09.11. eine korrekte Aenderung
      // zurueck. Beide Namen werden gelesen, falls sich das je aendert.
      '  const weg = Array.isArray(r.entfernt) ? r.entfernt : (Array.isArray(r.gestrichen) ? r.gestrichen : []);',
      '  const nach = new Map(weg.map((e) => [e.satz, e.grund]));',
      '  return a.saetze.map((s) => [s, nach.has(s), nach.get(s) || null]);',
      '});',
      "console.log('###' + JSON.stringify(raus));"
    ].join('\n'),
    'utf8'
  );

  let gruppen = null;
  try {
    const ausgabe = execFileSync(process.execPath, [pruefdatei], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    gruppen = JSON.parse(String(ausgabe).split('###')[1].trim());
  } catch (e) {
    console.log('  (Probe nicht moeglich)');
    console.log('  ' + (((e.stderr ? String(e.stderr) : '') || e.message).split('\n')[0]));
  } finally {
    try { fs.unlinkSync(pruefdatei); } catch (_) {}
  }

  if (gruppen) {
    let falsch = 0;
    for (let g = 0; g < gruppen.length; g++) {
      console.log('');
      console.log(`  ${WELTEN[g].name}`);
      for (let i = 0; i < gruppen[g].length; i++) {
        const [satz, gestrichen, grund] = gruppen[g][i];
        const soll = WELTEN[g].faelle[i][1];
        const gut = gestrichen === soll;
        if (!gut) falsch += 1;
        const kurz = satz.length > 46 ? satz.slice(0, 45) + '…' : satz;
        console.log(`    ${gut ? 'OK    ' : 'FEHLER'} ${gestrichen ? 'WEG   ' : 'bleibt'} ${kurz}`);
        if (gestrichen && grund) console.log(`                   ${grund}`);
      }
    }
    if (falsch) {
      console.log('');
      console.log(`  ${falsch} Fall/Faelle weichen ab.`);
      zurueckspielen('die Probe hat nicht das erwartete Ergebnis geliefert.');
    }
  }

  console.log('');
  console.log('FERTIG. Jede Zahl mit Einheit braucht ab jetzt einen Beleg.');
  console.log('');
  console.log('DIESER EINGRIFF ENTFERNT TEXT - als einziger von heute.');
  console.log('Steht er zu scharf, fehlen in Antworten Saetze, die in');
  console.log('Ordnung waren. Nach den naechsten zwanzig Suchen:');
  console.log('');
  console.log('  node scripts/sucheNachschauen.js --lauf');
  console.log('');
  console.log('Unter "Faktenpruefung" stehen die Gruende. Taucht dort');
  console.log('haeufig "steht nicht in den Produktdaten" bei Angaben auf,');
  console.log('die offensichtlich stimmen, ist die Regel zu scharf -');
  console.log('dann melden, nicht selbst lockern.');
  console.log('');
  console.log('Naechster Schritt: hochladen, dann baut Railway neu.');
  console.log('');
}

main();
