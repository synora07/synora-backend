// ============================================
// SYNORA - Tippfehler verzeihen
// ============================================
// GEFUNDEN am 08.11.2026 mit dem eigenen Pruefwerkzeug
// (node scripts/sucheNachschauen.js --letzte):
//
//   getippt:     ich brauche ien monitor
//   Kategorie:   elektronik.monitore
//   Rueckfrage:  passend
//   Ergebnisse:  CHF 150 / 185 / 157.75   <- brauchbar
//
//   getippt:     ich brauche eine moniror
//   Kategorie:   -
//   Rueckfrage:  allgemein
//   Ergebnisse:  CHF 77.95 / 55.90 / 76.95  <- Zubehoer statt Monitor
//
// Ein Buchstabe falsch, und Nora weiss nicht mehr, wovon der Kunde
// redet. Keine Kategorie heisst: keine passende Rueckfrage, keine
// Preisspanne zum Vergleich, keine Kategorie-Logik.
//
// In 40 echten Anfragen standen diese Schreibweisen:
//   playstiaion, playstaion, kopfhoehrer, ien monitor, moniror, spieln
//
// Tippfehler sind bei SYNORA nicht die Ausnahme, sie sind der Normalfall.
// Eine Suchhilfe, die nur bei richtiger Schreibweise funktioniert, ist
// keine Suchhilfe.
//
// Gepruefter Stand VOR dieser Aenderung:
//   monitor      -> elektronik.monitore
//   moniror      -> null
//   kopfhoerer   -> elektronik.audio
//   kopfhoehrer  -> null
//   playstation  -> elektronik.gaming
//   playstaion   -> null
//   playstiaion  -> null
//   laptop       -> elektronik.laptops
//
// ============================================
// WAS DAZUKOMMT
// ============================================
// Der genaue Vergleich bleibt unveraendert und laeuft wie bisher ZUERST.
// Findet er nichts, kommt ein zweiter Lauf: jedes Wort der Anfrage wird
// mit der Begriffsliste verglichen und ein bis zwei falsche Buchstaben
// werden verziehen.
//
//   moniror      ~ monitor       1 Zeichen
//   kopfhohrer   ~ kopfhorer     1 Zeichen
//   playstaion   ~ playstation   1 Zeichen
//   playstiaion  ~ playstation   2 Zeichen
//
// ============================================
// DIE VIER BREMSEN GEGEN FALSCHE TREFFER
// ============================================
// Ein toleranter Vergleich kann auch daneben greifen. "fisch" und
// "tisch" sind einen Buchstaben auseinander. Darum vier Bremsen:
//
// 1. MINDESTLAENGE 6
//    Zuerst stand hier 5. Die Probe hat gezeigt, dass das zu wenig ist:
//
//      stahl  ->  moebel.wohnen      (weil "stuhl" ein Zeichen entfernt ist)
//
//    Bei fuenf Buchstaben ist ein Fehler ein Fuenftel des Wortes - zu
//    wenig Substanz zum Vergleichen. "fisch"/"tisch", "maus"/"haus",
//    "hacke"/"jacke" liegen alle einen Buchstaben auseinander.
//    Mit 6 sind diese Paare gesperrt, und alle vier echten Tippfehler
//    bleiben trotzdem drin (moniror hat 7).
//
// 2. DER ERSTE BUCHSTABE MUSS STIMMEN
//    Beim Tippen schaut man auf den ersten Buchstaben, dort passieren
//    Fehler am seltensten.
//
// 3. TOLERANZ NACH LAENGE
//    6 bis 7 Zeichen: 1 Fehler.  Ab 8 Zeichen: 2 Fehler.
//    Bei kurzen Woertern ist ein Buchstabe ein grosser Teil des Wortes,
//    bei langen nicht.
//
// 4. BEI GLEICHSTAND LIEBER NICHTS
//    Passen zwei verschiedene Kategorien gleich gut, wird null
//    zurueckgegeben. Raten ist schlimmer als zugeben, dass man es
//    nicht weiss (Regel 2: keine Behauptung ohne Belege).
//
// Zusaetzlich wird der kleinste Abstand genommen, nicht der erste
// Treffer. Und jeder verziehene Tippfehler landet im Log:
//
//   [kategorie] "moniror" ~ "monitor" (1 Zeichen) -> elektronik.monitore
//
// So steht in Railway nachlesbar, was Nora geraten hat. Raten im
// Verborgenen gibt es nicht.
//
// ============================================
// WIE DAS SKRIPT ARBEITET
// ============================================
//   - Es AENDERT KEINE BESTEHENDE ZEILE. Es haengt nur an.
//     Darum kann es auch nichts kaputt machen, was heute geht.
//   - Erst eine Sicherung, dann die Aenderung
//   - Zeilenenden bleiben, wie sie waren
//   - Die Gegenprobe prueft nicht Text, sondern VERHALTEN: sie laedt
//     die geaenderte Datei und testet 17 Faelle. Stimmt einer nicht,
//     wird die Sicherung automatisch zurueckgespielt.
//
// Aufruf im Ordner synora-backend-main:
//   node tippfehler.js
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const ZIEL = path.join('src', 'services', 'shopKategorien.js');
const MARKE = 'TOLERANTER VERGLEICH';

// ============================================
// Der Block, der angehaengt wird
// ============================================

const ANBAU = `

// ============================================
// TOLERANTER VERGLEICH  (angebaut am 08.11.2026)
// ============================================
// Der genaue Vergleich oben bleibt unveraendert und laeuft zuerst.
// Findet er nichts, wird hier ein bis zwei falsche Buchstaben verziehen.
//
// Warum ueberhaupt: in 40 echten Anfragen standen "playstiaion",
// "playstaion", "kopfhoehrer", "moniror", "ien monitor". Ein Buchstabe
// falsch, und die Kategorie war leer - damit keine passende Rueckfrage
// und keine Preisspanne zum Vergleich.
//
// Vier Bremsen gegen falsche Treffer:
//   1. erst ab 6 Buchstaben           ("stahl" trifft nicht "stuhl")
//   2. der erste Buchstabe muss stimmen ("fisch" trifft nicht "tisch")
//   3. 6-7 Zeichen: 1 Fehler, ab 8: 2 Fehler
//   4. bei Gleichstand zwischen zwei Kategorien: null statt raten
//
// Die 6 ist nicht geraten. Mit 5 ergab die Probe "stahl" -> moebel.wohnen,
// weil "stuhl" ein Zeichen entfernt ist. Mit 6 sind stahl/stuhl,
// fisch/tisch, maus/haus, hacke/jacke gesperrt - und alle echten
// Tippfehler aus dem Protokoll bleiben drin, der kuerzeste hat 7.

const TOLERANZ_MINDESTLAENGE = 6;

// Begriffe, die der tolerante Vergleich nicht anfassen darf. Bleibt
// vorerst leer. Zeigt die Selbstpruefung beim Einbau Paare an, die
// wirklich verwechselt werden koennen, kommen sie hier herein.
const TOLERANZ_AUSGENOMMEN = new Set([]);

function toleranzFuer(laenge) {
  if (laenge < TOLERANZ_MINDESTLAENGE) return 0;
  if (laenge <= 7) return 1;
  return 2;
}

// Nur einzelne Woerter. Mehrwortbegriffe wie "gaming monitor" bleiben
// dem genauen Vergleich, dort waere Raten zu unsicher.
const TOLERANZ_BEGRIFFE = [...BEGRIFF_ZU_KATEGORIE.keys()].filter(
  (b) => b.length >= TOLERANZ_MINDESTLAENGE
    && !/[^a-z0-9]/.test(b)
    && !TOLERANZ_AUSGENOMMEN.has(b)
);

// Levenshtein-Abstand mit Obergrenze: wie viele Buchstaben muessen
// eingefuegt, geloescht oder getauscht werden, um aus a b zu machen.
// Wird die Grenze ueberschritten, bricht die Rechnung ab und gibt null
// zurueck - das spart bei einigen hundert Begriffen fast alle Arbeit.
function abstand(a, b, grenze) {
  const n = a.length;
  const m = b.length;
  if (Math.abs(n - m) > grenze) return null;
  if (n === 0) return m <= grenze ? m : null;
  if (m === 0) return n <= grenze ? n : null;

  let vorher = new Array(m + 1);
  let jetzt = new Array(m + 1);
  for (let j = 0; j <= m; j++) vorher[j] = j;

  for (let i = 1; i <= n; i++) {
    jetzt[0] = i;
    let kleinster = jetzt[0];
    for (let j = 1; j <= m; j++) {
      const kosten = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      jetzt[j] = Math.min(vorher[j] + 1, jetzt[j - 1] + 1, vorher[j - 1] + kosten);
      if (jetzt[j] < kleinster) kleinster = jetzt[j];
    }
    // Keine Zelle dieser Zeile liegt noch unter der Grenze: es kann
    // nicht mehr besser werden.
    if (kleinster > grenze) return null;
    const tausch = vorher;
    vorher = jetzt;
    jetzt = tausch;
  }

  const d = vorher[m];
  return d <= grenze ? d : null;
}

// Sucht die Kategorie zu einem Text, bei dem der genaue Vergleich
// nichts gefunden hat. Gibt null zurueck, wenn nichts sicher passt.
function kategorieRaten(text) {
  if (!text) return null;
  const s = normalisiere(text);

  let beste = null;          // die Kategorie
  let besterBegriff = null;  // das richtig geschriebene Wort, fuer das Log
  let bestesWort = null;     // das falsch geschriebene Wort, fuer das Log
  let besterAbstand = 99;
  let gleichstand = false;

  const woerter = s.split(/[^a-z0-9]+/).filter((w) => w.length >= TOLERANZ_MINDESTLAENGE);

  for (const wort of woerter) {
    for (const begriff of TOLERANZ_BEGRIFFE) {
      // Bremse 2: der erste Buchstabe muss stimmen.
      if (wort.charCodeAt(0) !== begriff.charCodeAt(0)) continue;

      const erlaubt = toleranzFuer(Math.max(wort.length, begriff.length));
      if (erlaubt === 0) continue;

      const d = abstand(wort, begriff, erlaubt);
      if (d === null) continue;

      const kategorie = BEGRIFF_ZU_KATEGORIE.get(begriff);

      if (d < besterAbstand) {
        besterAbstand = d;
        beste = kategorie;
        besterBegriff = begriff;
        bestesWort = wort;
        gleichstand = false;
      } else if (d === besterAbstand && kategorie !== beste) {
        // Bremse 4: zwei verschiedene Kategorien passen gleich gut.
        gleichstand = true;
      }
    }
  }

  if (gleichstand) {
    console.log(\`[kategorie] "\${bestesWort}" passt auf mehrere Kategorien gleich gut - keine gewaehlt\`);
    return null;
  }
  if (!beste) return null;

  console.log(\`[kategorie] "\${bestesWort}" ~ "\${besterBegriff}" (\${besterAbstand} Zeichen) -> \${beste}\`);
  return beste;
}

// Der genaue Vergleich zuerst, der tolerante nur als Rueckfallebene.
// So kann die Aenderung nichts verschlechtern, was heute schon geht:
// wo bisher eine Kategorie herauskam, kommt dieselbe heraus.
const kategorieGenau = module.exports.kategorieErkennen;

module.exports.kategorieErkennen = function kategorieErkennenTolerant(text) {
  const genau = kategorieGenau(text);
  if (genau) return genau;
  return kategorieRaten(text);
};

module.exports.kategorieGenau = kategorieGenau;
module.exports.kategorieRaten = kategorieRaten;
module.exports.abstand = abstand;
`;

// ============================================
// Die Gegenprobe: 17 Faelle, geprueft am Verhalten
// ============================================

const MUSS_NEU_TREFFEN = [
  ['ich brauche eine moniror', 'elektronik.monitore'],
  ['kopfhöhrer bis 100 fr', 'elektronik.audio'],
  ['playstaion', 'elektronik.gaming'],
  ['playstiaion', 'elektronik.gaming']
];

const MUSS_GLEICH_BLEIBEN = [
  ['ich brauche einen monitor', 'elektronik.monitore'],
  ['ich brauche ien monitor', 'elektronik.monitore'],
  ['kopfhörer bis 100 fr', 'elektronik.audio'],
  ['playstation', 'elektronik.gaming'],
  ['laptop', 'elektronik.laptops']
];

// Hier darf NICHTS herauskommen. Entweder weil es kein Produkt ist,
// oder weil es nah an einem Begriff liegt, aber etwas anderes meint.
//
// Die erste Gruppe sind die Verwechslungen, die bei Mindestlaenge 5
// in der Probe wirklich aufgetreten sind. Sie bleiben als Wache
// stehen: wird die Toleranz je gelockert, faellt es hier auf.
const MUSS_LEER_BLEIBEN = [
  'stahl',                      // nicht stuhl
  'fisch',                      // nicht tisch
  'hacke',                      // nicht jacke
  'rampe',                      // nicht lampe
  'kessel',                     // nicht sessel
  'hallo',
  'ich weiss nicht',
  'danke dir',
  'guten tag zusammen',
  'wie teuer ist das',
  'ja genau das',
  'nein lieber etwas anderes',
  'zeig mir einfach alles',
  'bitte schnell liefern',
  'gibt es garantie darauf'
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
  while (i !== -1) {
    n++;
    i = heuhaufen.indexOf(nadel, i + nadel.length);
  }
  return n;
}

function main() {
  console.log('');
  console.log('SYNORA - Tippfehler verzeihen');
  console.log('=============================');
  console.log('');

  if (!fs.existsSync(ZIEL)) {
    console.log(`ABBRUCH: ${ZIEL} nicht gefunden.`);
    console.log('Bist du im Ordner synora-backend-main?');
    process.exit(1);
  }

  const roh = fs.readFileSync(ZIEL, 'utf8');
  const hatCRLF = roh.includes('\r\n');

  console.log(`Datei:        ${ZIEL}`);
  console.log(`Groesse:      ${roh.length} Zeichen`);
  console.log(`Zeilenenden:  ${hatCRLF ? 'CRLF (Windows)' : 'LF'}`);
  console.log('');

  if (roh.includes(MARKE)) {
    console.log('Der tolerante Vergleich ist bereits eingebaut.');
    console.log('Es wird nichts geaendert.');
    process.exit(0);
  }

  // ---------- Pruefung vorher ----------
  console.log('Pruefung:');
  let allesOk = true;

  for (const pflicht of ['module.exports', 'BEGRIFF_ZU_KATEGORIE', 'function normalisiere']) {
    const n = zaehlen(roh, pflicht);
    if (n >= 1) {
      console.log(`  OK      ${pflicht} ist vorhanden`);
    } else {
      console.log(`  FEHLER  ${pflicht} nicht gefunden`);
      allesOk = false;
    }
  }

  // Der Anbau ueberschreibt module.exports.kategorieErkennen. Das setzt
  // voraus, dass die Datei diese Funktion ueberhaupt ausliefert.
  const ziel = path.resolve(ZIEL);
  let vorher = null;
  try {
    vorher = require(ziel);
  } catch (e) {
    console.log(`  FEHLER  Datei laesst sich nicht laden: ${e.message}`);
    allesOk = false;
  }
  if (vorher && typeof vorher.kategorieErkennen === 'function') {
    console.log('  OK      kategorieErkennen wird ausgeliefert');
  } else if (vorher) {
    console.log('  FEHLER  kategorieErkennen wird nicht ausgeliefert');
    allesOk = false;
  }

  console.log('');
  if (!allesOk) {
    console.log('ABBRUCH. Es wurde NICHTS geaendert.');
    console.log('Schick die Ausgabe weiter, dann wird das Skript angepasst.');
    process.exit(1);
  }

  // ---------- Selbstpruefung der Begriffsliste ----------
  // Bevor etwas eingebaut wird: welche Begriffe DEINER Liste liegen so
  // nah beieinander, dass der tolerante Vergleich sie verwechseln
  // koennte? Nicht geschaetzt, sondern durchgerechnet.
  //
  // Verwechselbar heisst: gleicher erster Buchstabe, verschiedene
  // Kategorie, und innerhalb der erlaubten Toleranz.
  const MINDESTLAENGE = 6;
  function toleranz(l) { return l < MINDESTLAENGE ? 0 : (l <= 7 ? 1 : 2); }
  function lev(a, b) {
    const n = a.length, m = b.length;
    const d = [];
    for (let i = 0; i <= n; i++) d[i] = [i];
    for (let j = 0; j <= m; j++) d[0][j] = j;
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1,
          d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[n][m];
  }

  const einzeln = [...vorher.BEGRIFF_ZU_KATEGORIE.keys()].filter(
    (b) => b.length >= MINDESTLAENGE && !/[^a-z0-9]/.test(b)
  );
  const paare = [];
  for (let i = 0; i < einzeln.length; i++) {
    for (let j = i + 1; j < einzeln.length; j++) {
      const a = einzeln[i], b = einzeln[j];
      if (a[0] !== b[0]) continue;
      const ka = vorher.BEGRIFF_ZU_KATEGORIE.get(a);
      const kb = vorher.BEGRIFF_ZU_KATEGORIE.get(b);
      if (ka === kb) continue;              // gleiche Kategorie, egal
      const erlaubt = toleranz(Math.max(a.length, b.length));
      if (erlaubt === 0) continue;
      const d = lev(a, b);
      if (d <= erlaubt) paare.push([a, b, d, ka, kb]);
    }
  }

  console.log('');
  console.log(`Selbstpruefung der Begriffsliste (${einzeln.length} Einzelwoerter ab ${MINDESTLAENGE} Zeichen):`);
  if (paare.length === 0) {
    console.log('  OK      Kein Begriffspaar kann verwechselt werden.');
  } else {
    console.log(`  ACHTUNG ${paare.length} Paar(e) liegen innerhalb der Toleranz:`);
    for (const [a, b, d, ka, kb] of paare) {
      console.log(`          "${a}" ~ "${b}" (${d})  ${ka} / ${kb}`);
    }
    console.log('');
    console.log('  Das ist kein Grund zum Abbrechen: eine falsche Kategorie');
    console.log('  kostet eine unpassende Rueckfrage und eine falsche');
    console.log('  Preisspanne - nie einen falschen Preis. Preise kommen');
    console.log('  weiter nur von SerpAPI (Regel 1).');
    console.log('  Schick die Liste weiter, dann werden diese Paare');
    console.log('  einzeln ausgenommen.');
  }

  // ---------- Stand vorher festhalten ----------
  // Damit die Gegenprobe beweisen kann, dass sich nur das Gewollte
  // geaendert hat, und nicht irgendetwas anderes mit.
  const standVorher = new Map();
  for (const [text] of [...MUSS_NEU_TREFFEN, ...MUSS_GLEICH_BLEIBEN]) {
    standVorher.set(text, vorher.kategorieErkennen(text) || null);
  }

  // ---------- Sicherung, dann anbauen ----------
  const sicherung = `${ZIEL}.sicherung-${zeitstempel()}`;
  fs.copyFileSync(ZIEL, sicherung);
  console.log(`Sicherung:    ${sicherung}`);

  let anbau = ANBAU;
  if (hatCRLF) anbau = anbau.replace(/\n/g, '\r\n');
  fs.appendFileSync(ZIEL, anbau, 'utf8');

  // ---------- Gegenprobe am Verhalten ----------
  // Nicht "steht der Text in der Datei", sondern "macht die Datei das
  // Richtige". Dazu wird sie in einem eigenen Node-Lauf geladen, weil
  // require() in diesem Lauf die alte Fassung gespeichert hat.
  console.log('');
  const anzahlFaelle = MUSS_NEU_TREFFEN.length + MUSS_GLEICH_BLEIBEN.length + MUSS_LEER_BLEIBEN.length;
  console.log(`Gegenprobe (${anzahlFaelle} Faelle, in einem eigenen Lauf):`);

  // Die Pruefdatei liegt im Temp-Ordner, nicht im Projekt. So kann sie
  // nie aus Versehen bei git landen. shopKategorien.js wird mit
  // vollem Pfad geladen, der Ort der Pruefdatei ist also gleichgueltig.
  const pruefdatei = path.join(require('os').tmpdir(), `synora-pruefung-${Date.now()}.js`);
  const auftrag = {
    datei: path.resolve(ZIEL),
    neu: MUSS_NEU_TREFFEN,
    gleich: MUSS_GLEICH_BLEIBEN,
    leer: MUSS_LEER_BLEIBEN
  };

  fs.writeFileSync(
    pruefdatei,
    [
      "'use strict';",
      `const auftrag = ${JSON.stringify(auftrag)};`,
      'const k = require(auftrag.datei);',
      'const raus = [];',
      'const still = console.log;',
      'console.log = () => {};',   // das [kategorie]-Log stoert hier nur
      'for (const [text, erwartet] of auftrag.neu) raus.push(["neu", text, erwartet, k.kategorieErkennen(text) || null]);',
      'for (const [text, erwartet] of auftrag.gleich) raus.push(["gleich", text, erwartet, k.kategorieErkennen(text) || null]);',
      'for (const text of auftrag.leer) raus.push(["leer", text, null, k.kategorieErkennen(text) || null]);',
      'console.log = still;',
      "console.log('###' + JSON.stringify(raus));"
    ].join('\n'),
    'utf8'
  );

  let ergebnis = null;
  let ladefehler = null;
  try {
    const { execFileSync } = require('child_process');
    const ausgabe = execFileSync(process.execPath, [pruefdatei], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const zeile = String(ausgabe).split('###')[1];
    ergebnis = JSON.parse(String(zeile).trim());
  } catch (e) {
    ladefehler = (e.stderr ? String(e.stderr) : '') || e.message;
  } finally {
    try { fs.unlinkSync(pruefdatei); } catch (_) {}
  }

  function zurueckspielen(grund) {
    fs.copyFileSync(sicherung, ZIEL);
    console.log('');
    console.log(`ABBRUCH: ${grund}`);
    console.log('Die alte Fassung ist zurueckgespielt. Die Datei ist wieder');
    console.log('genau so, wie sie vorher war.');
    console.log('');
    console.log(`Die Sicherung bleibt liegen: ${sicherung}`);
    process.exit(1);
  }

  if (!ergebnis) {
    console.log('');
    console.log(ladefehler || 'Die Pruefung hat nichts zurueckgegeben.');
    zurueckspielen('die geaenderte Datei laesst sich nicht laden.');
  }

  let ok = true;
  let neuGetroffen = 0;

  for (const [art, text, erwartet, bekommen] of ergebnis) {
    const kurz = text.length > 26 ? text.slice(0, 25) + '…' : text;

    if (art === 'leer') {
      const gut = bekommen === null;
      console.log(`  ${gut ? 'OK     ' : 'FEHLER '} ${kurz.padEnd(26)} -> ${bekommen === null ? 'nichts (richtig)' : bekommen + '  <- falscher Treffer!'}`);
      if (!gut) ok = false;
      continue;
    }

    const gut = bekommen === erwartet;
    if (art === 'neu') {
      const war = standVorher.get(text);
      const hinweis = war === null ? 'vorher: nichts' : `vorher: ${war}`;
      console.log(`  ${gut ? 'NEU    ' : 'FEHLER '} ${kurz.padEnd(26)} -> ${bekommen || 'nichts'}   (${hinweis})`);
      if (gut) neuGetroffen++;
    } else {
      console.log(`  ${gut ? 'OK     ' : 'FEHLER '} ${kurz.padEnd(26)} -> ${bekommen || 'nichts'}   (unveraendert erwartet: ${erwartet})`);
    }
    if (!gut) ok = false;
  }

  if (!ok) zurueckspielen('die Gegenprobe ist nicht sauber.');

  const neu = fs.readFileSync(ZIEL, 'utf8');
  const auf = zaehlen(neu, '{');
  const zu = zaehlen(neu, '}');
  console.log(`  ${auf === zu ? 'OK     ' : 'ACHTUNG'} geschweifte Klammern: ${auf} auf, ${zu} zu`);
  if (auf !== zu) zurueckspielen('die Klammern stimmen nicht.');

  console.log('');
  console.log(`FERTIG. ${neuGetroffen} Tippfehler werden jetzt verstanden,`);
  console.log('und kein einziger Fall ist schlechter geworden.');
  console.log('');
  console.log('Nachschauen kannst du es so:');
  console.log('  node -e "const k=require(\'./src/services/shopKategorien\'); console.log(k.kategorieErkennen(\'moniror\'))"');
  console.log('');
  console.log('Naechster Schritt: hochladen, dann baut Railway neu.');
  console.log('');
}

main();
