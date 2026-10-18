// ============================================
// SYNORA - prueft die Partnerlink-Umwandlung
// ============================================
//   node scripts/partnerlinkPruefen.js
//
// Aendert nichts. Legt nur Testeintraege IM SPEICHER an, prueft
// neun Faelle und raeumt wieder weg.
//
// WARUM ES DAS GIBT
// Ein falscher Partnerlink faellt nicht auf. Der Besucher landet
// beim Shop, kauft, alles sieht richtig aus - nur die Provision
// kommt nie an, und das merkst du erst nach Wochen beim Blick
// aufs Konto. Darum wird hier VORHER geprueft.
// ============================================
'use strict';

require('dotenv').config();

const pfad = require('path').join(__dirname, '..', 'src', 'services', 'partnerlink');
let partnerlink;
try {
  partnerlink = require(pfad);
} catch (e) {
  console.error('\nsrc/services/partnerlink.js nicht gefunden.\n  ' + e.message + '\n');
  process.exit(1);
}

const { _PARTNER, domainAus } = partnerlink;

// Testeintraege - NICHT deine echten
_PARTNER['mediamarkt.ch'] = { netz: 'awin', mid: 14040 };
_PARTNER['fust.ch'] = { netz: 'adtraction', ziel: 'https://track.adtraction.test/t?url=' };
_PARTNER['kaputt.ch'] = { netz: 'awin' };            // mid fehlt mit Absicht
_PARTNER['fremd.ch'] = { netz: 'irgendwas', mid: 1 }; // unbekanntes Netz

const AFFID = (process.env.AWIN_AFFID || '').trim();
let schlecht = 0;

function pruefe(name, ergebnis, erwartung) {
  const ok = typeof erwartung === 'function' ? erwartung(ergebnis) : ergebnis === erwartung;
  console.log(`${ok ? '  ok  ' : ' FEHL '} ${name}`);
  if (!ok) {
    console.log(`        bekommen:  ${ergebnis}`);
    if (typeof erwartung !== 'function') console.log(`        erwartet:  ${erwartung}`);
    schlecht++;
  }
}

console.log('\nAWIN_AFFID aus der .env: ' + (AFFID ? AFFID : 'FEHLT'));
console.log('='.repeat(62) + '\n');

const ZIEL = 'https://www.mediamarkt.ch/de/product/_handy-12345.html';

// ---------- 1. Shop ohne Programm bleibt unveraendert ----------
pruefe('Shop ohne Programm -> Original-URL',
  partnerlink('https://www.digitec.ch/de/s1/product/abc-999'),
  'https://www.digitec.ch/de/s1/product/abc-999');

// ---------- 2. Awin-Link wird gebaut ----------
if (AFFID) {
  const erwartet = 'https://www.awin1.com/cread.php?awinmid=14040&awinaffid='
    + encodeURIComponent(AFFID) + '&ued=' + encodeURIComponent(ZIEL);
  pruefe('Awin-Haendler -> cread.php-Link', partnerlink(ZIEL), erwartet);

  // ---------- 3. Die Ziel-URL muss unbeschaedigt ankommen ----------
  const gebaut = partnerlink(ZIEL);
  const zurueck = decodeURIComponent(new URL(gebaut).searchParams.get('ued') || '');
  pruefe('Ziel-URL kommt unveraendert wieder heraus', zurueck, ZIEL);

  // ---------- 4. Unterdomain trifft denselben Eintrag ----------
  pruefe('shop.mediamarkt.ch trifft mediamarkt.ch',
    partnerlink('https://shop.mediamarkt.ch/x'),
    (r) => r.startsWith('https://www.awin1.com/cread.php?awinmid=14040'));
} else {
  // ---------- 2b. Ohne AFFID: lieber direkt als kaputt ----------
  pruefe('Haendler in Tabelle, aber AWIN_AFFID fehlt -> Original-URL',
    partnerlink(ZIEL), ZIEL);
  console.log('        (Trag AWIN_AFFID=2754082 in die .env ein, dann');
  console.log('         pruefen sich hier drei weitere Faelle mit.)');
}

// ---------- 5. Aehnlicher Name darf NICHT treffen ----------
// Ohne den Punkt in der Pruefung wuerde "nichtmediamarkt.ch" auf
// "mediamarkt.ch" passen - und SYNORA haenge eine fremde
// Haendlernummer an einen fremden Shop.
pruefe('nichtmediamarkt.ch trifft NICHT',
  partnerlink('https://nichtmediamarkt.ch/x'),
  'https://nichtmediamarkt.ch/x');

// ---------- 6. Adtraction ----------
const adZiel = 'https://www.fust.ch/de/p/999';
pruefe('Adtraction-Haendler -> Vorlage + codierte Ziel-URL',
  partnerlink(adZiel),
  'https://track.adtraction.test/t?url=' + encodeURIComponent(adZiel));

// ---------- 7. Unvollstaendiger Eintrag faellt zurueck ----------
pruefe('Eintrag ohne mid -> Original-URL',
  partnerlink('https://kaputt.ch/p/1'), 'https://kaputt.ch/p/1');

// ---------- 8. Unbekanntes Netzwerk faellt zurueck ----------
pruefe('unbekanntes Netzwerk -> Original-URL',
  partnerlink('https://fremd.ch/p/1'), 'https://fremd.ch/p/1');

// ---------- 9. Unsinn stuerzt nicht ab ----------
pruefe('leere Eingabe', partnerlink(''), '');
pruefe('null', partnerlink(null), null);
pruefe('kein gueltiger Link', partnerlink('einfach text'), 'einfach text');
pruefe('domainAus bei Unsinn', domainAus('%%%'), '');

// Aufraeumen
for (const k of ['mediamarkt.ch', 'fust.ch', 'kaputt.ch', 'fremd.ch']) delete _PARTNER[k];

console.log('\n' + '='.repeat(62));
if (schlecht) {
  console.log(`${schlecht} Fall/Faelle falsch. NICHT ausliefern.\n`);
  process.exit(1);
}
console.log('Alle Faelle richtig.\n');
console.log('Deine echte Tabelle ist noch leer - das ist richtig so,');
console.log('solange kein Programm zugesagt hat. Jeder Link geht bis');
console.log('dahin unveraendert zum Shop, so wie bisher.\n');