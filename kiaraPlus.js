// ============================================
// SYNORA - Kiara Plus: Stufe, Grenzen, Preisseite (Backend)
// ============================================
// Entschieden am 10. und 12.11.2026:
//
//   Kiara        gratis      3 Suchen im Monat
//   Kiara Plus   CHF 20     55 Suchen im Monat
//   Nora         CHF 75    250 Suchen, erst ab Februar - hier noch nicht
//
//   Regel: gleiche Empfehlung fuer alle. Gekauft werden Menge und
//   Komfort, nie bessere Empfehlungen. (So steht es seit Oktober in
//   config/stufen.js, und so bleibt es.)
//
// ============================================
// WAS GEAENDERT WIRD - 5 DATEIEN, ALLES ODER NICHTS
// ============================================
//
// 1. models/User.js
//    Neues Feld "stufe" (kiara | kiara_plus | nora), Vorgabe kiara.
//    Setzt NUR der Server - geprueft am 11.11.: die Profil-Route
//    uebernimmt nur Vor- und Nachname, nichts sonst aus der Anfrage.
//
// 2. middleware/suchLimit.js
//    "Premium" wurde an drei Feldern gesucht, die es nicht gibt
//    (istPremium, premium, plan). Jetzt: stufe. Dazu die Vorgaben
//    3 und 55 und der Text, den jemand am Limit liest.
//
// 3. controllers/chatController.js
//    Dieselbe Erkennung fuer die Kostenbremse.
//
// 4. routes/preisalarm.js
//    Hatte eine EIGENE Regel (req.user.premium). Ohne Aenderung haette
//    ein Kiara-Plus-Kunde 55 Suchen, aber keinen Preisalarm.
//
// 5. config/stufen.js  (das, was die Preisseite anzeigt)
//    Zwei Stufen statt drei. "Premium Plus fuer CHF 20, unbegrenzt"
//    faellt weg - sonst stuenden zwei Abos zu CHF 20 auf der Seite.
//    Haekchen NUR fuer das, was es gibt: Preisverlauf, Merkliste und
//    Besitz-Waechter sind nicht gebaut und stehen auf false.
//
// Der Verkauf selbst bleibt AUS, bis bei Railway PREMIUM_VERKAUF=true
// steht. Dieses Skript schaltet nichts ein.
//
// ============================================
// Aufruf im Ordner synora-backend-main:
//   node kiaraPlus.js
// ============================================

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MARKE = "enum: ['kiara', 'kiara_plus', 'nora']";
const IST_ZAHLER = "!!(req.user && (req.user.stufe === 'kiara_plus' || req.user.stufe === 'nora'))";
const ALT_PREMIUM = "!!(req.user && (req.user.istPremium || req.user.premium || req.user.plan === 'premium'))";

function finde(start, name) {
  const treffer = [];
  (function lauf(ordner) {
    for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(ordner, e.name);
      if (e.isDirectory()) lauf(p);
      else if (e.name === name) treffer.push(p);
    }
  })(start);
  return treffer;
}

const NEU_STUFEN = [
  'const STUFEN = [',
  '  // Stand 12.11.2026 (Pavinash): Kiara und Kiara Plus.',
  '  // Nora (CHF 75, 250 Suchen) kommt im Februar hierher - erst wenn sie',
  '  // mehr kann als mehr Suchen. Siehe claude/bauplan-kiara-stufen.md.',
  '  //',
  '  // HAEKCHEN NUR FUER DAS, WAS ES WIRKLICH GIBT. Preisverlauf, Merkliste',
  '  // und Besitz-Waechter sind noch nicht gebaut, darum false. Wer sie',
  '  // einschaltet, bevor sie funktionieren, verkauft etwas, das es nicht gibt.',
  '  {',
  "    schluessel: 'gratis',",
  "    name: 'Kiara',",
  '    preisMonat: 0,',
  '    preisJahr: null,',
  "    suchenProMonat: grenze('SUCHEN_KONTO', 3),",
  "    alarme: zahl('PREISALARM_MAX_GRATIS', 0),",
  '    kann: {',
  '      dreiVorschlaege: true,',
  '      nachteilJeProdukt: true,',
  '      endpreisSchweiz: true,',
  '      preisalarm: false,',
  '      preisverlauf: false,',
  '      merkliste: false,',
  '      besitzWaechter: false,',
  '      aktionenFrueher: false,',
  '      personenImKonto: 1',
  '    }',
  '  },',
  '  {',
  "    schluessel: 'premium',     // bleibt so - die Suchsperre kennt 'premium'",
  "    name: 'Kiara Plus',",
  "    preisMonat: zahl('PREMIUM_PREIS_MONAT', 20),",
  '    preisJahr: null,           // Jahresabo kommt spaeter, der Stripe-Link ist monatlich',
  "    suchenProMonat: grenze('SUCHEN_PREMIUM', 55),",
  "    alarme: zahl('PREISALARM_MAX_PREMIUM', 3),",
  '    empfohlen: true,',
  '    kann: {',
  '      dreiVorschlaege: true,',
  '      nachteilJeProdukt: true,',
  '      endpreisSchweiz: true,',
  '      preisalarm: true,',
  '      preisverlauf: false,',
  '      merkliste: false,',
  '      besitzWaechter: false,',
  '      aktionenFrueher: false,',
  '      personenImKonto: 1',
  '    }',
  '  }',
  '];'
].join('\n');

const AENDERUNGEN = [
  {
    datei: 'user',
    was: 'User.js       Feld "stufe"',
    art: 'nachZeile',
    zeile: 'bestaetigteBestellungen: { type: Number, default: 0, min: 0 },',
    einfuegen: [
      '',
      '// Abo-Stufe. Setzt NUR der Server: scripts/stufeSetzen.js, spaeter',
      '// der Stripe-Webhook. Keine Route darf sie aus req.body uebernehmen',
      '// (geprueft 11.11.2026: userProfile.js nimmt nur Vor- und Nachname).',
      "stufe: { type: String, enum: ['kiara', 'kiara_plus', 'nora'], default: 'kiara' },",
      'stufeGeaendert: { type: Date, default: null },'
    ]
  },
  {
    datei: 'limit',
    was: 'suchLimit.js  Premium = stufe',
    alt: 'return ' + ALT_PREMIUM + ';',
    neu: 'return ' + IST_ZAHLER + ';'
  },
  {
    datei: 'limit',
    was: 'suchLimit.js  Vorgabe Kiara 3',
    alt: "zahl('SUCHEN_KONTO', 5, 0)",
    neu: "zahl('SUCHEN_KONTO', 3, 0)"
  },
  {
    datei: 'limit',
    was: 'suchLimit.js  Vorgabe Kiara Plus 55',
    alt: "zahl('SUCHEN_PREMIUM', 15, 0)",
    neu: "zahl('SUCHEN_PREMIUM', 55, 0)"
  },
  {
    datei: 'limit',
    was: 'suchLimit.js  Text am Limit',
    alt: 'Mit Premium sind es 15 im Monat, f\u00fcr CHF 7.`',
    neu: 'Mit Kiara Plus sind es ${alsText(STUFEN.premium.grenze)} im Monat, f\u00fcr CHF ${Number(process.env.PREMIUM_PREIS_MONAT || 20)}.`'
  },
  {
    datei: 'chat',
    was: 'chatController Premium = stufe',
    alt: 'return ' + ALT_PREMIUM + ';',
    neu: 'return ' + IST_ZAHLER + ';'
  },
  {
    datei: 'alarm',
    was: 'preisalarm.js Premium = stufe',
    alt: 'const istPremium = !!req.user.premium;',
    neu: 'const istPremium = ' + IST_ZAHLER + ';'
  },
  {
    datei: 'stufen',
    was: 'stufen.js     Kiara + Kiara Plus',
    art: 'block',
    start: 'const STUFEN = [',
    ende: '\n];',
    neu: NEU_STUFEN
  },
  {
    datei: 'stufen',
    was: 'stufen.js     Hinweis zum Verkauf',
    alt: [
      '  // Wird Premium schon verkauft? Laut Dokument erst ab Juli 2027 -',
      '  // bis dahin wird es verschenkt. Darum zeigt die Preisseite',
      '  // keinen Kaufknopf, solange das hier false ist.'
    ].join('\n'),
    neu: [
      '  // Wird Kiara Plus verkauft? Entschieden am 10.11.2026: ja, sobald',
      '  // Stripe steht. Eingeschaltet wird bei Railway mit PREMIUM_VERKAUF=true.',
      '  // Solange das false ist, zeigt die Preisseite keinen Kaufknopf.'
    ].join('\n')
  }
];

const MUSS_DA = {
  user: [MARKE],
  limit: [IST_ZAHLER, "zahl('SUCHEN_KONTO', 3, 0)", "zahl('SUCHEN_PREMIUM', 55, 0)", 'Mit Kiara Plus sind es'],
  chat: [IST_ZAHLER],
  alarm: ['const istPremium = ' + IST_ZAHLER],
  stufen: ["name: 'Kiara',", "name: 'Kiara Plus',", "zahl('PREMIUM_PREIS_MONAT', 20)", 'PREMIUM_VERKAUF=true']
};
const MUSS_WEG = {
  limit: ["req.user.plan === 'premium'"],
  chat: ["req.user.plan === 'premium'"],
  alarm: ['!!req.user.premium;'],
  stufen: ["'Premium Plus'", "schluessel: 'plus'"]
};

// ============================================

function zeitstempel() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}-${z(d.getMinutes())}`;
}

function zaehlen(heu, nadel) {
  let n = 0;
  let i = heu.indexOf(nadel);
  while (i !== -1) { n++; i = heu.indexOf(nadel, i + nadel.length); }
  return n;
}

/** Aktive Codezeilen, ohne reine Kommentarzeilen */
function codeOhneKommentare(txt) {
  return txt.split('\n').filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z)).join('\n');
}

function main() {
  console.log('');
  console.log('SYNORA - Kiara Plus: Stufe, Grenzen, Preisseite');
  console.log('===============================================');
  console.log('');

  if (!fs.existsSync('src')) {
    console.log('ABBRUCH: Ordner src nicht gefunden. Bitte in synora-backend-main ausfuehren.');
    process.exit(1);
  }

  const alarmTreffer = finde('src', 'preisalarm.js');
  const PFADE = {
    user: path.join('src', 'models', 'User.js'),
    limit: path.join('src', 'middleware', 'suchLimit.js'),
    chat: path.join('src', 'controllers', 'chatController.js'),
    alarm: alarmTreffer.length === 1 ? alarmTreffer[0] : null,
    stufen: path.join('src', 'config', 'stufen.js')
  };

  if (!PFADE.alarm) {
    console.log(`ABBRUCH: preisalarm.js ${alarmTreffer.length} mal gefunden, erwartet: 1.`);
    for (const t of alarmTreffer) console.log('  ' + t);
    process.exit(1);
  }

  // ---------- lesen ----------
  const roh = {};
  const crlf = {};
  const txt = {};
  for (const [k, p] of Object.entries(PFADE)) {
    if (!fs.existsSync(p)) {
      console.log(`ABBRUCH: ${p} nicht gefunden. Es wurde NICHTS geaendert.`);
      process.exit(1);
    }
    roh[k] = fs.readFileSync(p, 'utf8');
    crlf[k] = roh[k].includes('\r\n');
    txt[k] = roh[k].replace(/\r\n/g, '\n');
    console.log(`  ${p.padEnd(40)} ${roh[k].length} Zeichen, ${crlf[k] ? 'CRLF' : 'LF'}`);
  }
  console.log('');

  if (txt.user.includes(MARKE)) {
    console.log('Bereits eingebaut. Es wird nichts geaendert.');
    process.exit(0);
  }
  if (/^\s*stufe\s*:/m.test(txt.user)) {
    console.log('ABBRUCH: User.js hat schon ein Feld "stufe" in anderer Form. Es wurde NICHTS geaendert.');
    process.exit(1);
  }

  // ---------- pruefen, ob jede Stelle genau einmal da ist ----------
  console.log('Pruefung:');
  let ok = true;
  for (const a of AENDERUNGEN) {
    let n;
    if (a.art === 'nachZeile') {
      n = txt[a.datei].split('\n').filter((z) => z.includes(a.zeile)).length;
    } else if (a.art === 'block') {
      n = zaehlen(txt[a.datei], a.start);
      if (n === 1 && txt[a.datei].indexOf(a.ende, txt[a.datei].indexOf(a.start)) === -1) n = 0;
    } else {
      n = zaehlen(txt[a.datei], a.alt);
    }
    const gut = n === 1;
    if (!gut) ok = false;
    console.log(`  ${gut ? 'OK    ' : 'FEHLER'}  ${a.was}${gut ? '' : `  (${n} mal gefunden, erwartet: 1)`}`);
  }
  console.log('');
  if (!ok) {
    console.log('ABBRUCH. Es wurde NICHTS geaendert.');
    process.exit(1);
  }

  // ---------- aendern (im Speicher) ----------
  for (const a of AENDERUNGEN) {
    const t = txt[a.datei];
    if (a.art === 'nachZeile') {
      const zeilen = t.split('\n');
      const i = zeilen.findIndex((z) => z.includes(a.zeile));
      const einzug = zeilen[i].match(/^\s*/)[0];
      const neu = a.einfuegen.map((z) => (z ? einzug + z : ''));
      zeilen.splice(i + 1, 0, ...neu);
      txt[a.datei] = zeilen.join('\n');
    } else if (a.art === 'block') {
      const s = t.indexOf(a.start);
      const e = t.indexOf(a.ende, s) + a.ende.length;
      txt[a.datei] = t.slice(0, s) + a.neu + t.slice(e);
    } else {
      txt[a.datei] = t.replace(a.alt, () => a.neu);
    }
  }

  // ---------- sichern, dann schreiben ----------
  const stempel = zeitstempel();
  const sicherungen = {};
  for (const [k, p] of Object.entries(PFADE)) {
    sicherungen[k] = `${p}.sicherung-${stempel}`;
    fs.copyFileSync(p, sicherungen[k]);
  }
  console.log('Sicherungen:');
  for (const s of Object.values(sicherungen)) console.log('  ' + s);

  function zurueck(grund) {
    for (const [k, p] of Object.entries(PFADE)) fs.copyFileSync(sicherungen[k], p);
    console.log('');
    console.log(`ABBRUCH: ${grund}`);
    console.log('Alle 5 Dateien sind auf die alte Fassung zurueckgespielt.');
    process.exit(1);
  }

  for (const [k, p] of Object.entries(PFADE)) {
    fs.writeFileSync(p, crlf[k] ? txt[k].replace(/\n/g, '\r\n') : txt[k], 'utf8');
  }

  // ---------- Gegenprobe ----------
  console.log('');
  console.log('Gegenprobe:');
  let sauber = true;
  for (const [k, p] of Object.entries(PFADE)) {
    const neu = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    for (const s of MUSS_DA[k] || []) {
      const da = neu.includes(s);
      if (!da) sauber = false;
      console.log(`  ${da ? 'OK     ' : 'FEHLT  '} ${path.basename(p)}: ${s.length > 60 ? s.slice(0, 59) + '\u2026' : s}`);
    }
    const code = codeOhneKommentare(neu);
    for (const s of MUSS_WEG[k] || []) {
      const weg = !code.includes(s);
      if (!weg) sauber = false;
      console.log(`  ${weg ? 'OK     ' : 'NOCH DA'} ${path.basename(p)}: weg ist ${s}`);
    }
    try {
      execFileSync(process.execPath, ['--check', path.resolve(p)], { stdio: ['ignore', 'pipe', 'pipe'] });
      console.log(`  OK      ${path.basename(p)} ist syntaktisch in Ordnung`);
    } catch (e) {
      console.log(`  FEHLER  ${path.basename(p)}: ${String(e.stderr || e.message).split('\n').slice(0, 4).join(' | ')}`);
      sauber = false;
    }
  }
  if (!sauber) zurueck('die Gegenprobe ist nicht sauber.');

  // ---------- Probe: Verhalten, in einem eigenen Prozess ----------
  console.log('');
  console.log('Probe:');
  const probe = path.join(require('os').tmpdir(), `synora-plus-${Date.now()}.js`);
  fs.writeFileSync(probe, [
    "'use strict';",
    'const r = [];',
    'const erwartet = (name, vorgabe) => (process.env[name] !== undefined && String(process.env[name]).trim() !== "" ? Number(process.env[name]) : vorgabe);',
    // stufen.js
    `const st = require(${JSON.stringify(path.resolve(PFADE.stufen))});`,
    'const f = st.fuersFrontend();',
    "r.push(['zwei Stufen auf der Preisseite', f.length === 2]);",
    "r.push(['Namen Kiara und Kiara Plus', f[0] && f[0].name === 'Kiara' && f[1] && f[1].name === 'Kiara Plus']);",
    "r.push(['Preis Kiara Plus CHF ' + (f[1] && f[1].preisMonat), f[1] && f[1].preisMonat === erwartet('PREMIUM_PREIS_MONAT', 20)]);",
    "r.push(['Suchen Kiara ' + (f[0] && f[0].suchen.anzahl), f[0] && f[0].suchen.anzahl === erwartet('SUCHEN_KONTO', 3)]);",
    "r.push(['Suchen Kiara Plus ' + (f[1] && f[1].suchen.anzahl), f[1] && f[1].suchen.anzahl === erwartet('SUCHEN_PREMIUM', 55)]);",
    "r.push(['kein Jahrespreis angezeigt', f[1] && f[1].preisJahr === null]);",
    "r.push(['keine Haekchen fuer Ungebautes', f[1] && f[1].kann.merkliste === false && f[1].kann.besitzWaechter === false && f[1].kann.preisverlauf === false]);",
    "r.push(['Preisalarm bei Kiara Plus', f[1] && f[1].kann.preisalarm === true]);",
    "r.push(['teurere Stufe kann nie weniger', st.pruefeStufen().length === 0]);",
    // User.js
    `const User = require(${JSON.stringify(path.resolve(PFADE.user))});`,
    "const u = new User({ email: 'probe@synora.li', password: 'x' });",
    "r.push(['neuer Nutzer ist Kiara', u.stufe === 'kiara']);",
    "u.stufe = 'gold';",
    'const e1 = u.validateSync();',
    "r.push(['erfundene Stufe wird abgelehnt', !!(e1 && e1.errors && e1.errors.stufe)]);",
    "u.stufe = 'kiara_plus';",
    'const e2 = u.validateSync();',
    "r.push(['kiara_plus ist erlaubt', !(e2 && e2.errors && e2.errors.stufe)]);",
    // suchLimit.js - weich: wenn es sich ohne Server nicht laden laesst, reicht die Textpruefung oben
    'let weich = null;',
    'try {',
    `  const sl = require(${JSON.stringify(path.resolve(PFADE.limit))});`,
    "  if (sl && sl.STUFEN) { r.push(['Suchsperre Kiara ' + sl.STUFEN.konto.grenze, sl.STUFEN.konto.grenze === erwartet('SUCHEN_KONTO', 3)]); r.push(['Suchsperre Kiara Plus ' + sl.STUFEN.premium.grenze, sl.STUFEN.premium.grenze === erwartet('SUCHEN_PREMIUM', 55)]); }",
    '} catch (e) { weich = e.message; }',
    "console.log('###' + JSON.stringify({ r, weich }));",
    'setTimeout(() => process.exit(0), 50);'
  ].join('\n'), 'utf8');

  let erg = null;
  try {
    const aus = execFileSync(process.execPath, [probe], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
    erg = JSON.parse(String(aus).split('###')[1].trim());
  } catch (e) {
    console.log('  Probe nicht moeglich: ' + String((e.stderr || e.message)).split('\n').slice(0, 3).join(' | '));
  } finally {
    try { fs.unlinkSync(probe); } catch (_) {}
  }
  if (!erg) zurueck('die Probe konnte nicht laufen.');

  let falsch = 0;
  for (const [was, gut] of erg.r) {
    if (!gut) falsch++;
    console.log(`  ${gut ? 'OK    ' : 'FEHLER'}  ${was}`);
  }
  if (erg.weich) console.log(`  (Suchsperre nur per Text geprueft - laesst sich ohne Server nicht laden: ${erg.weich.split('\n')[0]})`);
  if (falsch) zurueck(`${falsch} Probe(n) weichen ab.`);

  console.log('');
  console.log('FERTIG. Kiara Plus ist im Backend eingebaut - der Verkauf ist noch AUS.');
  console.log('');
  console.log('JETZT BEI RAILWAY (Backend -> Variables), drei Zeilen setzen:');
  console.log('');
  console.log('  SUCHEN_KONTO=3');
  console.log('  SUCHEN_PREMIUM=55');
  console.log('  PREMIUM_PREIS_MONAT=20');
  console.log('');
  console.log('PREMIUM_VERKAUF bleibt false, bis der Stripe-Link im Frontend steht.');
  console.log('');
  console.log('Kunden freischalten:  node scripts/stufeSetzen.js kunde@mail.ch kiara_plus');
  console.log('Alle Zahler zeigen:   node scripts/stufeSetzen.js --liste');
  console.log('');
}

main();
