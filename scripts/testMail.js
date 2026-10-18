// ============================================
// SYNORA - Mailversand pruefen
// ============================================
// Verschickt EINE echte Mail ueber genau den Weg, den der
// Preisalarm spaeter benutzt - nicht ueber einen Nachbau.
//
// Das ist der Punkt: ein Test, der seinen eigenen Code testet,
// beweist nichts. Darum laeuft hier benachrichtigung.js, dieselbe
// Datei, die um 4 Uhr morgens die Alarmmails verschickt.
//
// Aufruf:
//   node scripts/testMail.js                    an dich selbst
//   node scripts/testMail.js name@beispiel.ch   an eine Adresse
//   node scripts/testMail.js --nurpruefen       nichts verschicken
//
// Kostet nichts. Brevo gibt dir 300 Mails am Tag gratis.
// ============================================
'use strict';

require('dotenv').config();

const ARG = process.argv.slice(2);
const NUR_PRUEFEN = ARG.includes('--nurpruefen');
const ZIEL = ARG.find((a) => a.includes('@')) || null;

function titel(t) {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + t);
  console.log('='.repeat(60) + '\n');
}

// ============================================
// PLATZHALTER ERKENNEN
// ============================================
// NEU am 03.10.2026, nachdem genau das passiert ist: in der .env
// stand woertlich
//
//     SMTP_USER=<dein Login von Brevo>
//
// Die Pruefung sagte "[ok] gesetzt", weil etwas dastand. Brevo sagte
// "535 Authentication failed". Eine Pruefung, die einen Platzhalter
// fuer einen Wert haelt, ist schlimmer als keine.
// ACHTUNG: "SYNORA <hallo@synora.li>" ist das RICHTIGE Format fuer
// einen Absender und darf nicht als Platzhalter gelten. Spitze
// Klammern allein genuegen also nicht - entscheidend ist, ob eine
// Mailadresse darin steht.
function istPlatzhalter(wert) {
  const s = String(wert || '').trim();
  if (!s) return false;

  // Ganz in spitzen Klammern und ohne Mailadresse darin -> Beispieltext
  if (/^<[^@]*>$/.test(s)) return true;

  // Typische Beispielwoerter am Anfang
  if (/^(dein|deine|hier|xxx|todo|changeme|beispiel|<)/i.test(s) && !s.includes('@')) return true;

  return false;
}

let platzhalterGefunden = 0;

function zeile(name, wert, ok) {
  if (ok !== undefined && istPlatzhalter(wert)) {
    platzhalterGefunden++;
    console.log('  [PLATZHALTER] ' + String(name).padEnd(14) + String(wert)
      + '   <- hier fehlt der echte Wert');
    return;
  }
  const zeichen = ok === true ? '[ok]  ' : ok === false ? '[FEHLT]' : '      ';
  console.log('  ' + zeichen + ' ' + String(name).padEnd(18) + (wert || ''));
}

/** Passwoerter nie im Klartext ausgeben */
function verdeckt(wert) {
  if (!wert) return '';
  const s = String(wert);
  if (s.length <= 6) return '*'.repeat(s.length);
  return s.slice(0, 3) + '*'.repeat(Math.min(12, s.length - 6)) + s.slice(-3);
}

(async () => {
  titel('EINSTELLUNGEN');

  const anbieter = process.env.MAIL_ANBIETER || 'aus';
  const absender = process.env.MAIL_ABSENDER || '';

  zeile('MAIL_ANBIETER', anbieter, anbieter !== 'aus');
  zeile('MAIL_ABSENDER', absender, !!absender);

  if (anbieter === 'smtp') {
    zeile('SMTP_HOST', process.env.SMTP_HOST, !!process.env.SMTP_HOST);
    zeile('SMTP_PORT', process.env.SMTP_PORT, !!process.env.SMTP_PORT);
    zeile('SMTP_USER', process.env.SMTP_USER, !!process.env.SMTP_USER);
    zeile('SMTP_PASS', verdeckt(process.env.SMTP_PASS), !!process.env.SMTP_PASS);
  } else if (anbieter === 'resend' || anbieter === 'brevo') {
    zeile('MAIL_API_KEY', verdeckt(process.env.MAIL_API_KEY), !!process.env.MAIL_API_KEY);
  }

  // ---------- Nodemailer ----------
  if (anbieter === 'smtp') {
    try {
      require('nodemailer');
      zeile('nodemailer', 'installiert', true);
    } catch (e) {
      zeile('nodemailer', 'FEHLT - npm i nodemailer', false);
    }
  }

  // ---------- Was der Dienst selbst sagt ----------
  let dienst;
  try {
    dienst = require('../src/services/benachrichtigung');
  } catch (e) {
    console.log('\n  benachrichtigung.js nicht ladbar: ' + e.message + '\n');
    process.exit(1);
  }

  console.log('');
  zeile('Dienst meldet', dienst.EINGERICHTET.mail ? 'bereit' : 'NICHT eingerichtet', dienst.EINGERICHTET.mail);

  // ---------- Urteil ----------
  if (anbieter === 'aus') {
    titel('MAIL IST AUS');
    console.log('  MAIL_ANBIETER=aus bedeutet: es wird NICHTS verschickt.');
    console.log('  Mails landen nur im Log. Das ist zum Entwickeln richtig -');
    console.log('  aber der Preisalarm kann so niemanden benachrichtigen.\n');
    console.log('  So schaltest du ihn ein, mit einem Gratis-Konto bei Brevo:\n');
    console.log('      MAIL_ANBIETER=smtp');
    console.log('      SMTP_HOST=smtp-relay.brevo.com');
    console.log('      SMTP_PORT=587');
    console.log('      SMTP_USER=<dein Brevo-Login>');
    console.log('      SMTP_PASS=<dein Brevo-SMTP-Schluessel>');
    console.log('');
    process.exit(1);
  }

  if (platzhalterGefunden) {
    titel('PLATZHALTER STATT WERTE');
    console.log(`  ${platzhalterGefunden} Zeile(n) enthalten noch den Beispieltext`);
    console.log('  statt der echten Angaben. Der Mailserver weist das ab -');
    console.log('  meist mit "535 Authentication failed".\n');
    console.log('  Die echten Werte stehen bei Brevo unter SMTP & API,');
    console.log('  Reiter SMTP:\n');
    console.log('      SMTP_USER   etwa 9a1b2c001@smtp-brevo.com');
    console.log('                  (NICHT deine Mailadresse)');
    console.log('      SMTP_PASS   der Schluessel von "Generate a new SMTP key"');
    console.log('                  (NICHT dein Brevo-Passwort)\n');
    process.exit(1);
  }

  if (!dienst.EINGERICHTET.mail) {
    titel('UNVOLLSTAENDIG');
    console.log('  Der Anbieter ist gesetzt, aber es fehlen Angaben.');
    console.log('  Die Zeilen mit [FEHLT] oben ausfuellen.\n');
    process.exit(1);
  }

  if (NUR_PRUEFEN) {
    titel('ALLES GESETZT');
    console.log('  Es wurde nichts verschickt (--nurpruefen).');
    console.log('  Ohne diesen Schalter geht eine echte Mail raus.\n');
    return;
  }

  // ---------- Empfaenger ----------
  const an = ZIEL || (absender.match(/<([^>]+)>/) || [])[1] || absender;
  if (!an || !an.includes('@')) {
    titel('KEIN EMPFAENGER');
    console.log('  Keine Adresse gefunden. So geht es:\n');
    console.log('      node scripts/testMail.js deine@adresse.ch\n');
    process.exit(1);
  }

  // ---------- Echte Mail, echter Weg ----------
  titel('MAIL WIRD VERSCHICKT');
  console.log('  An: ' + an);
  console.log('  Ueber: ' + anbieter + '\n');

  // Genau der Text, den ein Nutzer beim Preisalarm bekaeme -
  // damit du siehst, was wirklich ankommt, nicht "Test 123".
  const beispiel = dienst.alarmText({
    produktName: 'Sony WH-1000XM5 Kopfhoerer',
    alt: 329.95,
    neu: 279.00,
    shop: 'Interdiscount',
    link: (process.env.API_BASE_URL || 'http://localhost:5000') + '/api/go/beispiel'
  });

  const start = Date.now();
  let ergebnis;
  try {
    ergebnis = await dienst.mailSenden({
      an,
      betreff: '[SYNORA Test] ' + (beispiel.betreff || 'Preisalarm'),
      text: (beispiel.text || 'Testmail von SYNORA.')
        + '\n\n---\nDiese Mail stammt aus scripts/testMail.js. '
        + 'Wenn sie angekommen ist, funktioniert dein Preisalarm.',
      html: beispiel.html || null
    });
  } catch (e) {
    ergebnis = { ok: false, grund: e.message };
  }
  const dauer = Date.now() - start;

  // ---------- Ergebnis ----------
  // ACHTUNG, hier lag am 03.10.2026 ein Fehler in DIESEM Skript:
  // mailSenden() meldet den Fehler im Feld "grund". Gelesen wurde
  // "fehler" und "error" - beide leer. Das Skript zeigte darum
  // "kein Grund gemeldet", obwohl zwei Zeilen darueber im Log stand
  // "535 Authentication failed". Der Hinweis zum Beheben kam
  // deshalb auch nicht.
  const geklappt = ergebnis === true
    || (ergebnis && ergebnis.ok !== false && !ergebnis.grund && !ergebnis.fehler);

  if (geklappt) {
    titel('VERSCHICKT');
    console.log(`  In ${(dauer / 1000).toFixed(1)} Sekunden an ${an}.\n`);
    console.log('  Schau jetzt in dein Postfach - auch im Spam-Ordner.');
    console.log('  Die erste Mail eines neuen Absenders landet oft dort.\n');
    console.log('  Kommt sie an, ist der Preisalarm vollstaendig:');
    console.log('      node scripts/preisalarmPruefen.js\n');
    return;
  }

  titel('NICHT VERSCHICKT');
  const text = String(
    (ergebnis && (ergebnis.grund || ergebnis.fehler || ergebnis.error)) || 'kein Grund gemeldet'
  );
  console.log('  ' + text + '\n');

  // Die haeufigsten Brevo-Fehler im Klartext
  if (/auth|535|credential|password/i.test(text)) {
    console.log('  Das sieht nach falschen Zugangsdaten aus.');
    console.log('  SMTP_USER ist bei Brevo NICHT deine Mailadresse, sondern');
    console.log('  etwas wie 9a1b2c@smtp-brevo.com. Und SMTP_PASS ist der');
    console.log('  erzeugte SMTP-Schluessel, nicht dein Kontopasswort.');
  } else if (/sender|from|not verified|550/i.test(text)) {
    console.log('  Brevo nimmt den Absender nicht an. Im Konto unter');
    console.log('  "Senders" muss die Adresse aus MAIL_ABSENDER bestaetigt');
    console.log('  sein. Am Anfang am besten deine eigene Mailadresse -');
    console.log('  hallo@synora.li geht erst mit DNS-Eintraegen.');
  } else if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|getaddrinfo/i.test(text)) {
    console.log('  Keine Verbindung zum Mailserver. Pruef SMTP_HOST und');
    console.log('  SMTP_PORT. Bei Brevo: smtp-relay.brevo.com, Port 587.');
  }
  console.log('');
  process.exitCode = 1;
})();