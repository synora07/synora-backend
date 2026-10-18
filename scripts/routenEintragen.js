// ============================================
// SYNORA - die zwei fehlenden Routen eintragen
// ============================================
// Traegt in src/server.js diese zwei Zeilen nach:
//
//     ladeRoute('einstellungen', '/api/einstellungen');
//     ladeRoute('rueckmeldung', '/api');
//
// WARUM EIN SKRIPT UND KEIN "MACH DAS VON HAND"
// Weil ich den Einfuegepunkt vorher gegen deine server.js
// geprueft habe und das Skript nichts tut, wenn etwas nicht
// passt. Von Hand uebersieht man leicht, dass die Zeile INNEN
// in die Funktion gehoert und nicht darunter.
//
// ============================================
// WAS ES SICHER MACHT
// ============================================
// 1. SICHERUNG ZUERST. Vor jeder Aenderung entsteht
//    src/server.js.sicherung-<zeit>. Geht etwas schief, kopierst
//    du die Datei einfach zurueck.
//
// 2. ZWEIMAL LAUFEN SCHADET NICHT. Stehen die Zeilen schon drin,
//    sagt das Skript das und aendert nichts.
//
// 3. ES SUCHT DAS LETZTE VORKOMMEN, NICHT DAS ERSTE.
//    Das ist kein Detail: Ganz oben in deiner server.js steht
//    in einem Kommentar die Zeile
//        //     ladeRoute('dashboard', '/api/dashboard');
//    Mein erster Versuch hat genau DA eingefuegt - mitten in
//    den Kommentarblock. Das Ergebnis war kaputter Code, den
//    node gar nicht mehr laden konnte. Gefunden am 08.10.2026,
//    weil ich es vor dem Verschicken an einer Kopie getestet
//    habe.
//
// 4. ES PRUEFT DAS ERGEBNIS. Nach dem Schreiben wird die Datei
//    einmal eingelesen. Ist sie kaputt, wird die Sicherung
//    automatisch zurueckgespielt.
//
// ============================================
// SO BENUTZT DU ES
// ============================================
// Die Datei nach  scripts/  legen, dann im Backend-Ordner:
//
//     node scripts/routenEintragen.js
//
// Danach den Server neu starten.
// ============================================

const fs = require('fs');
const path = require('path');

const SERVER = path.join(__dirname, '..', 'src', 'server.js');

// Nach dieser Zeile wird eingefuegt - sie ist die letzte
// ladeRoute-Zeile in deiner server.js.
const MARKE = "ladeRoute('dashboard', '/api/dashboard');";

const NEU = `

  // NEU: Einstellungen und Rueckmeldungen
  // /api/einstellungen liefert Preise und Suchgrenzen an das
  // Frontend - aus denselben Objekten, die sie auch durchsetzen.
  // Ohne diese Zeile bleiben Premium-Seite und AGB-Preise leer.
  ladeRoute('einstellungen', '/api/einstellungen');
  ladeRoute('rueckmeldung', '/api');`;

function raus(zeichen, text) {
  console.log(text);
  process.exit(zeichen);
}

// ---------- 1. Datei da? ----------
if (!fs.existsSync(SERVER)) {
  raus(1,
    'FEHLER: src/server.js nicht gefunden.\n' +
    'Gesucht an: ' + SERVER + '\n\n' +
    'Leg dieses Skript nach scripts/ und starte es aus dem\n' +
    'Backend-Ordner mit:  node scripts/routenEintragen.js'
  );
}

let inhalt = fs.readFileSync(SERVER, 'utf8');

// ---------- 2. Schon drin? ----------
if (inhalt.includes("ladeRoute('einstellungen'")) {
  raus(0,
    'Die Zeilen stehen schon in server.js. Nichts geaendert.\n\n' +
    'Kommt /api/einstellungen trotzdem als 404, fehlen die\n' +
    'Dateien selbst. Pruef:\n' +
    '  src/routes/einstellungen.js\n' +
    '  src/config/stufen.js'
  );
}

// ---------- 3. Einfuegepunkt finden ----------
// lastIndexOf, NICHT indexOf - siehe Begruendung oben.
const stelle = inhalt.lastIndexOf(MARKE);
if (stelle < 0) {
  raus(1,
    'FEHLER: Die Zeile\n' +
    '  ' + MARKE + '\n' +
    'steht nicht in deiner server.js. Dann sieht sie anders aus\n' +
    'als die Fassung, die ich kenne - ich aendere lieber nichts.\n\n' +
    'Schick mir die Datei, dann sag ich dir genau, wohin.'
  );
}

// ---------- 4. Sichern ----------
const stempel = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const sicherung = SERVER + '.sicherung-' + stempel;
fs.copyFileSync(SERVER, sicherung);

// ---------- 5. Einfuegen ----------
const ende = stelle + MARKE.length;
const neuerInhalt = inhalt.slice(0, ende) + NEU + inhalt.slice(ende);
fs.writeFileSync(SERVER, neuerInhalt, 'utf8');

// ---------- 6. Ergebnis pruefen ----------
// Laedt node die Datei noch? Wenn nicht, sofort zurueck.
try {
  // Nur die Syntax pruefen, nicht ausfuehren - sonst wuerde hier
  // ein zweiter Server starten.
  new (require('vm').Script)(
    require('module').wrap(fs.readFileSync(SERVER, 'utf8')),
    { filename: SERVER }
  );
} catch (e) {
  fs.copyFileSync(sicherung, SERVER);
  raus(1,
    'FEHLER: Nach dem Einfuegen war die Datei kaputt.\n' +
    'Die alte Fassung ist bereits zurueckgespielt - es ist nichts\n' +
    'verloren.\n\n' +
    'Meldung: ' + e.message
  );
}

console.log(
  'Fertig. Zwei Zeilen in src/server.js eingetragen.\n\n' +
  'Sicherung der alten Fassung:\n  ' + path.basename(sicherung) + '\n\n' +
  'Jetzt den Server neu starten (Strg+C, dann npm start).\n' +
  'In der Routenliste muessen danach stehen:\n' +
  '  [ok]   /api/einstellungen\n' +
  '  [ok]   /api'
);
