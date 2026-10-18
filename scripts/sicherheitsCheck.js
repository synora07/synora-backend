// ============================================
// SYNORA - Sicherheits- und Aufraeumpruefung
// ============================================
// Aufruf:  node scripts/sicherheitsCheck.js
//
// Sucht vier Dinge, die vor dem 19. Oktober weg muessen:
//
//   1. SCHLUESSEL IM KLARTEXT. In server-simple.js standen vier
//      API-Schluessel, das DB-Passwort und das JWT-Geheimnis offen
//      im Code. Solange solche Dateien existieren, ist das Erneuern
//      der Schluessel sinnlos - beim naechsten Push sind die neuen
//      wieder drin.
//
//   2. TOTE DATEIEN. middleware/auth.js und middleware-auth.js
//      nebeneinander: eine wird benutzt, die andere nicht, und
//      niemand weiss welche. Dieses Skript geht vom Startpunkt aus
//      alle require() durch und sagt, welche Datei niemand aufruft.
//
//   3. DOPPELTE MONGOOSE-INDIZES. Daher die Warnung beim Start:
//      "Duplicate schema index on {email:1}".
//
//   4. .env AM FALSCHEN ORT. Steht sie in Git, ist alles darin
//      oeffentlich - auch nach dem Loeschen, denn Git vergisst nicht.
//
// WICHTIG: Dieses Skript druckt NIEMALS einen gefundenen Schluessel
// aus. Nur Datei und Zeile. Ein Sicherheitswerkzeug, das Geheimnisse
// in die Konsole schreibt, ist keines - und diese Konsole landet
// erfahrungsgemaess wieder in einem Chat.
//
// KOSTET NICHTS. Kein Server, keine API, kein Guthaben.
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');

const WURZEL = path.resolve(__dirname, '..');

const UEBERSPRINGEN = new Set([
  'node_modules', '.git', 'build', 'dist', 'coverage',
  '.next', '.vercel', 'aufnahmen', 'uploads'
]);

// ============================================
// Dateien einsammeln
// ============================================

function alleDateien(ordner, gesammelt = []) {
  let eintraege;
  try {
    eintraege = fs.readdirSync(ordner, { withFileTypes: true });
  } catch (_) {
    return gesammelt;
  }

  for (const e of eintraege) {
    if (UEBERSPRINGEN.has(e.name)) continue;
    const voll = path.join(ordner, e.name);
    if (e.isDirectory()) alleDateien(voll, gesammelt);
    else gesammelt.push(voll);
  }
  return gesammelt;
}

const relativ = (p) => path.relative(WURZEL, p).split(path.sep).join('/');

// ============================================
// 1. SCHLUESSEL IM KLARTEXT
// ============================================
// Jedes Muster steht fuer einen Anbieter. Zusaetzlich ein
// allgemeines Muster fuer alles, was aussieht wie
// GEHEIMNIS = "langer-zeichensalat".

const SCHLUESSEL_MUSTER = [
  { name: 'Anthropic (Claude)',  regex: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'OpenAI',              regex: /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/ },
  { name: 'Perplexity',          regex: /pplx-[A-Za-z0-9]{20,}/ },
  { name: 'SerpAPI',             regex: /\b[a-f0-9]{64}\b/ },
  { name: 'MongoDB mit Passwort', regex: /mongodb(?:\+srv)?:\/\/[^:\s'"]+:[^@\s'"]+@/ },
  { name: 'Google / Firebase',   regex: /AIza[A-Za-z0-9_-]{30,}/ },
  { name: 'Stripe',              regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/ }
];

// GEHEIMNIS = "..."  oder  "GEHEIMNIS": "..."   (JSON)
// Die Anfuehrungszeichen um den Namen sind neu: in der Fuzz-Messung
// blieben genau die 50 JSON-Zeilen von 340 unentdeckt, weil das
// schliessende Anfuehrungszeichen das Muster brach.
const ALLGEMEIN = /['"`]?\b([A-Z_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWORT|PWD)[A-Z_]*)\b['"`]?\s*[:=]\s*['"`]([^'"`\n]{16,})['"`]/;

// Was KEIN Fund ist: Platzhalter und Beispiele.
//
// ACHTUNG, hier lag ein blinder Fleck: frueher stand hier auch
// /process\.env\./. Damit war
//
//     const KEY = process.env.ANTHROPIC_API_KEY || "sk-ant-api03-...";
//
// unsichtbar - und genau so landet ein echter Schluessel am
// haeufigsten in Git. Ebenso reichte ein Kommentar mit "example"
// auf derselben Zeile, um vier echte Schluessel zu verstecken.
//
// Jetzt wird nur noch der GEFUNDENE WERT auf Platzhalter geprueft,
// nicht die ganze Zeile.
const PLATZHALTER = /^(?:dein|your|my)?[-_ ]?(?:schluessel|key|token|secret)?$|xxx+|^<[^>]+>$|\.\.\.|example|placeholder|changeme|^\s*$/i;

function schluesselSuchen(dateien) {
  const funde = [];

  for (const datei of dateien) {
    // .env.local, .env.production usw. enden NICHT auf ".env" -
    // sie fielen frueher durch den Filter und wurden nie geprueft.
    const istEnvDatei = /(^|\/)\.env(\.|$)/.test(relativ(datei));
    if (!istEnvDatei && !/\.(js|jsx|ts|tsx|json|env|yml|yaml|md|txt|sh|ps1)$/i.test(datei)) continue;
    if (/package-lock\.json$/.test(datei)) continue;

    let inhalt;
    try {
      inhalt = fs.readFileSync(datei, 'utf8');
    } catch (_) { continue; }

    const zeilen = inhalt.split('\n');
    const istEnv = istEnvDatei;

    zeilen.forEach((zeile, i) => {
      // Sehr lange Zeilen (minifizierte Bundles, eingebettetes
      // base64) haben die Regex-Maschine zum Absturz gebracht:
      // "Maximum call stack size exceeded" ab etwa 5.6 Millionen
      // Zeichen - und riss den ganzen Lauf mit, sodass die
      // Abschnitte 2 bis 4 nie liefen.
      if (zeile.length > 200000) return;

      try {
        // Anbietermuster gelten IMMER. "sk-ant-..." ist kein
        // Platzhalter, egal was sonst auf der Zeile steht.
        for (const m of SCHLUESSEL_MUSTER) {
          if (m.regex.test(zeile)) {
            funde.push({ datei: relativ(datei), zeile: i + 1, was: m.name, istEnv });
            return;
          }
        }

        const a = zeile.match(ALLGEMEIN);
        if (a && !PLATZHALTER.test(a[2])) {
          funde.push({ datei: relativ(datei), zeile: i + 1, was: a[1], istEnv });
        }
      } catch (e) {
        console.warn(`   (Zeile ${i + 1} in ${relativ(datei)} uebersprungen: ${e.message})`);
      }
    });
  }

  return funde;
}

// ============================================
// 2. TOTE DATEIEN
// ============================================
// Vom Startpunkt aus jedem require('./...') folgen. Was dabei nie
// erreicht wird, ruft niemand auf.

function startpunkte() {
  const punkte = [];
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(WURZEL, 'package.json'), 'utf8'));
    if (pkg.main) punkte.push(pkg.main);
    for (const befehl of Object.values(pkg.scripts || {})) {
      const m = String(befehl).match(/(?:node|nodemon)\s+([\w./-]+\.js)/);
      if (m) punkte.push(m[1]);
    }
  } catch (_) { /* kein package.json */ }

  for (const name of ['server.js', 'index.js', 'app.js', 'src/server.js', 'src/index.js', 'src/app.js']) {
    if (fs.existsSync(path.join(WURZEL, name))) punkte.push(name);
  }

  return [...new Set(punkte)]
    .map((p) => path.resolve(WURZEL, p))
    .filter((p) => fs.existsSync(p));
}

function aufloesen(vonDatei, ziel) {
  const basis = path.resolve(path.dirname(vonDatei), ziel);

  const kandidaten = [basis, basis + '.js', basis + '.json', path.join(basis, 'index.js')];

  // Ein Ordner mit eigener package.json wird ueber deren "main"
  // aufgeloest. Ohne das fiel ein ganzer Unterbau als "tot" auf.
  const eigenesPaket = path.join(basis, 'package.json');
  try {
    if (fs.existsSync(eigenesPaket)) {
      const haupt = JSON.parse(fs.readFileSync(eigenesPaket, 'utf8')).main;
      if (haupt) kandidaten.push(path.resolve(basis, haupt), path.resolve(basis, haupt) + '.js');
    }
  } catch (_) { /* kaputte package.json - dann eben ohne */ }

  return kandidaten.find((k) => {
    try { return fs.existsSync(k) && fs.statSync(k).isFile(); } catch (_) { return false; }
  }) || null;
}

function erreichbare(start) {
  const gesehen = new Set();
  const warteschlange = [...start];

  while (warteschlange.length) {
    const datei = warteschlange.pop();
    if (gesehen.has(datei)) continue;
    gesehen.add(datei);

    let inhalt;
    try { inhalt = fs.readFileSync(datei, 'utf8'); } catch (_) { continue; }

    // require('./x') und import ... from './x'
    // Backtick mit aufgenommen: require(`./src/services/x`) wurde
    // frueher nicht erkannt, und die Datei dahinter erschien als
    // "ruft niemand auf" - inklusive perplexityService.js selbst.
    const muster = /(?:require\(\s*|from\s+)['"`](\.[^'"`${}]+)['"`]/g;
    let treffer;
    while ((treffer = muster.exec(inhalt))) {
      const ziel = aufloesen(datei, treffer[1]);
      if (ziel && !gesehen.has(ziel)) warteschlange.push(ziel);
    }
  }
  return gesehen;
}

// ============================================
// 3. DOPPELTE MONGOOSE-INDIZES
// ============================================
// Zwei Wege, denselben Index anzulegen:
//   email: { type: String, unique: true }      <- legt einen an
//   schema.index({ email: 1 })                 <- legt nochmal einen an
// Beides zusammen gibt die Warnung beim Serverstart.

function indexPruefen(dateien) {
  const funde = [];

  for (const datei of dateien) {
    if (!/\.js$/.test(datei)) continue;
    let inhalt;
    try { inhalt = fs.readFileSync(datei, 'utf8'); } catch (_) { continue; }
    if (!/mongoose|Schema/.test(inhalt)) continue;

    // Felder mit unique/index im Feld selbst
    const imFeld = new Set();
    const feldMuster = /(\w+)\s*:\s*\{[^{}]*\b(?:unique|index)\s*:\s*true[^{}]*\}/g;
    let t;
    while ((t = feldMuster.exec(inhalt))) imFeld.add(t[1]);

    // Felder in einem separaten .index({ feld: 1 })
    //
    // NUR Einzelfeld-Indizes. Ein Verbundindex .index({email:1,
    // stadt:1}) ist ein ANDERER Index und keine Dublette - der
    // Falschalarm dafuer hat beim Testen einen sauberen Fall
    // angezeigt.
    const separat = new Set();
    const indexMuster = /\.index\(\s*\{([^}]*)\}/g;
    while ((t = indexMuster.exec(inhalt))) {
      const felder = t[1].split(',').map((x) => x.trim()).filter(Boolean);
      if (felder.length !== 1) continue;
      const name = felder[0].match(/^['"`]?(\w+)['"`]?\s*:/);
      if (name) separat.add(name[1]);
    }

    for (const feld of imFeld) {
      if (separat.has(feld)) {
        funde.push({ datei: relativ(datei), feld });
      }
    }
  }

  return funde;
}

// ============================================
// 4. .env AM FALSCHEN ORT
// ============================================

function envPruefen() {
  const probleme = [];

  const gitignore = path.join(WURZEL, '.gitignore');
  if (!fs.existsSync(gitignore)) {
    probleme.push('Es gibt gar keine .gitignore');
  } else {
    const inhalt = fs.readFileSync(gitignore, 'utf8');
    const deckt = /^\s*\.env\*?\s*$/m.test(inhalt);
    const decktAlle = /^\s*\.env\*/m.test(inhalt) || /^\s*\.env\.\*/m.test(inhalt);

    if (!deckt && !decktAlle) {
      probleme.push('.gitignore enthaelt keinen Eintrag fuer .env');
    } else if (!decktAlle) {
      // Ein blosses ".env" ignoriert NICHT .env.local oder
      // .env.production. Gemessen: beide lagen in Git, und das
      // Werkzeug meldete "In Ordnung".
      const weitere = fs.readdirSync(WURZEL)
        .filter((n) => /^\.env\..+/.test(n));
      if (weitere.length) {
        probleme.push(
          `.gitignore deckt nur ".env" ab, aber es gibt auch ${weitere.join(', ')} - ` +
          'dafuer braucht es die Zeile ".env*"'
        );
      }
    }
  }

  // Liegt eine .env-Datei trotzdem in Git? Dann nuetzt die
  // .gitignore nichts mehr - Git vergisst nicht.
  try {
    const { execSync } = require('child_process');
    const inGit = execSync('git ls-files -- ".env" ".env.*"', {
      cwd: WURZEL, stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
    if (inGit) {
      for (const datei of inGit.split('\n').filter(Boolean)) {
        probleme.push(`${datei} liegt IN GIT - alle Schluessel darin gelten als oeffentlich`);
      }
    }
  } catch (_) { /* kein Git, oder git fehlt */ }

  return probleme;
}

// ============================================
// AUSGABE
// ============================================

function main() {
  // Sich selbst ausnehmen. Dieses Skript enthaelt Beispielmuster
  // ("email: { unique: true }") und Schluessel-Regexe - es wuerde
  // sich sonst selbst anzeigen. Beim ersten Testlauf ist genau das
  // passiert.
  const dateien = alleDateien(WURZEL).filter((d) => d !== __filename);

  console.log(`\nGeprueft: ${dateien.length} Dateien unter ${relativ(WURZEL) || '.'}\n`);

  let schwer = 0;

  // ---------- 1 ----------
  const funde = schluesselSuchen(dateien);
  const imCode = funde.filter((f) => !f.istEnv);
  const inEnv = funde.filter((f) => f.istEnv);

  console.log('1. SCHLUESSEL IM KLARTEXT');
  if (!imCode.length) {
    console.log('   Nichts im Code gefunden.');
  } else {
    schwer += imCode.length;
    const nachDatei = {};
    for (const f of imCode) (nachDatei[f.datei] = nachDatei[f.datei] || []).push(f);
    for (const [datei, liste] of Object.entries(nachDatei)) {
      console.log(`   ${datei}`);
      for (const f of liste) console.log(`      Zeile ${String(f.zeile).padStart(4)}  ${f.was}`);
    }
    console.log('\n   REIHENFOLGE - die ist wichtig:');
    console.log('     a) Diese Dateien loeschen oder bereinigen');
    console.log('     b) ERST DANN die Schluessel beim Anbieter neu erzeugen');
    console.log('     c) Die neuen NUR in die .env, nie in eine .js');
    console.log('   Andersherum ist es umsonst: die neuen landen wieder im Code.');
  }
  if (inEnv.length) {
    console.log(`   (${inEnv.length} Treffer in .env-Dateien - dort gehoeren sie hin)`);
  }

  // ---------- 2 ----------
  console.log('\n2. TOTE DATEIEN');
  const start = startpunkte();
  if (!start.length) {
    console.log('   Kein Startpunkt gefunden - uebersprungen.');
  } else {
    console.log(`   Startpunkt: ${start.map(relativ).join(', ')}`);
    const lebend = erreichbare(start);

    const tot = dateien
      .filter((d) => /\.js$/.test(d))
      .filter((d) => !lebend.has(d))
      .filter((d) => !/(^|\/)(scripts|tests?|__tests__)\//.test(relativ(d)))
      .filter((d) => !/\.(test|spec)\.js$/.test(d))
      .filter((d) => !/^(client|frontend)\//.test(relativ(d)));

    if (!tot.length) {
      console.log('   Alle Dateien werden erreicht.');
    } else {
      console.log(`   ${tot.length} Datei(en) ruft niemand auf:`);
      for (const d of tot) console.log('      ' + relativ(d));
      console.log('\n   Vor dem Loeschen: kurz reinschauen. Manches wird zur');
      console.log('   Laufzeit geladen und faellt hier faelschlich auf.');
    }
  }

  // ---------- 3 ----------
  console.log('\n3. DOPPELTE MONGOOSE-INDIZES');
  const indizes = indexPruefen(dateien);
  if (!indizes.length) {
    console.log('   Keine gefunden.');
  } else {
    for (const i of indizes) {
      console.log(`   ${i.datei}: Feld "${i.feld}" ist doppelt indiziert`);
    }
    console.log('\n   Einen von beiden entfernen. Ueblich: das separate');
    console.log('   .index({...}) stehen lassen, das unique:true im Feld');
    console.log('   nur dann, wenn es wirklich eindeutig sein muss.');
  }

  // ---------- 4 ----------
  console.log('\n4. .env');
  const envProbleme = envPruefen();
  if (!envProbleme.length) {
    console.log('   In Ordnung.');
  } else {
    schwer += envProbleme.length;
    for (const p of envProbleme) console.log('   ' + p);
  }

  // ---------- Schluss ----------
  console.log('\n========================================');
  if (schwer) {
    console.log(`  ${schwer} Punkt(e), die vor dem Start weg muessen`);
  } else {
    console.log('  Nichts Schweres gefunden');
  }
  console.log('========================================\n');

  process.exit(schwer ? 1 : 0);
}

main();