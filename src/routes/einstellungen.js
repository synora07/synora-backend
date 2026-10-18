// ============================================
// SYNORA - Einstellungen fuer das Frontend
// ============================================
// GET /api/einstellungen   (oeffentlich, kein Konto noetig)
//
// WARUM ES DIESE ROUTE GIBT
//
// Am 04.10.2026 stand in der Design-Vorlage fuer die Startseite
// "3 kostenlose Suchen ohne Anmeldung" und "Unbegrenzt mit
// Account". Das Backend erlaubt null ohne Konto und fuenf mit
// Konto. Zwei Zahlen auf der wichtigsten Seite der Firma, beide
// falsch.
//
// So etwas passiert nicht aus Schlamperei. Es passiert, weil die
// Zahl an zwei Stellen steht: einmal dort, wo sie gilt, und
// einmal dort, wo sie angezeigt wird. Aendert jemand die eine,
// vergisst er die andere.
//
// Diese Route schliesst die Luecke: Das Frontend fragt die
// Zahlen hier ab, statt sie selbst zu kennen.
//
// SYNORA verkauft Ehrlichkeit. Eine Startseite, die bei den
// eigenen Grenzen schwindelt, zerstoert genau das Argument, das
// SYNORA von Google Shopping unterscheidet.
//
// WAS HIER NICHT HINEINGEHOERT
// Keine Schluessel, keine Kostensaetze, keine internen Grenzen.
// Die Route ist oeffentlich - alles hier kann jeder lesen.
// ============================================
'use strict';

const express = require('express');
const router = express.Router();

const stufen = require('../config/stufen');

// ============================================
// Was wirklich gilt, nicht was geplant ist
// ============================================
// Die Stufen-Tabelle sagt, was Premium KANN. Ob die Sperre im
// laufenden Server dieselben Zahlen anwendet, steht auf einem
// anderen Blatt: suchLimit.js liest die .env selbst.
//
// Darum werden hier beide gelesen und verglichen. Weichen sie
// ab, erfaehrt das Frontend die Zahl, die WIRKLICH gilt - und
// im Serverlog steht eine Warnung. Lieber eine unbequeme
// Wahrheit auf der Preisseite als ein Versprechen, das die
// Sperre nicht einhaelt.
function echteSuchgrenzen() {
  try {
    // middleware/, nicht services/ - geprueft an routes/chat.js,
    // das dieselbe Datei einbindet.
    const { STUFEN } = require('../middleware/suchLimit');
    if (!STUFEN) return null;
    return {
      gast: stufen.nachAussen(STUFEN.gast.grenze),
      konto: stufen.nachAussen(STUFEN.konto.grenze),
      premium: stufen.nachAussen(STUFEN.premium.grenze),
      periodeGast: STUFEN.gast.periode,
      periodeKonto: STUFEN.konto.periode
    };
  } catch (e) {
    console.warn('[einstellungen] Suchgrenzen nicht lesbar:', e.message);
    return null;
  }
}

router.get('/', (req, res) => {
  const liste = stufen.fuersFrontend();
  const echt = echteSuchgrenzen();

  // ---------- Abgleich ----------
  // Die Sperre kennt genau drei Stufen: gast, konto, premium.
  // "Premium Plus" gibt es dort NICHT - das Backend unterscheidet
  // heute nur istPremium ja/nein.
  //
  // Darum traegt jede Stufe ein Feld durchgesetzt:
  //   true   die Sperre wendet diese Zahl wirklich an
  //   false  die Zahl steht nur in der Tabelle
  //
  // Eine Stufe mit durchgesetzt:false gehoert nicht als
  // kaufbares Versprechen auf die Seite. Das Frontend kann sie
  // als "kommt bald" zeigen - aber nicht so, als gaebe es sie.
  const abweichungen = [];
  const vonDerSperre = echt ? { gratis: echt.konto, premium: echt.premium } : {};

  for (const s of liste) {
    const gilt = vonDerSperre[s.schluessel];

    if (!gilt) {
      s.durchgesetzt = false;
      continue;
    }

    s.durchgesetzt = true;

    if (s.suchen.anzahl !== gilt.anzahl || s.suchen.unbegrenzt !== gilt.unbegrenzt) {
      abweichungen.push(
        `${s.name}: Tabelle sagt ${s.suchen.unbegrenzt ? 'unbegrenzt' : s.suchen.anzahl},` +
        ` die Sperre erlaubt ${gilt.unbegrenzt ? 'unbegrenzt' : gilt.anzahl}`
      );
      // Die Sperre gewinnt. Angezeigt wird, was der Nutzer
      // wirklich bekommt - nicht, was geplant war.
      s.suchen = gilt;
      s.abweichung = true;
    }
  }

  const ohneSperre = liste.filter((s) => !s.durchgesetzt).map((s) => s.name);
  if (ohneSperre.length) {
    console.warn(`[einstellungen] Keine Sperre im Backend fuer: ${ohneSperre.join(', ')}.`);
    console.warn('[einstellungen] Diese Stufe(n) sind nur Anzeige, nicht durchgesetzt.');
  }

  if (abweichungen.length) {
    console.warn('[einstellungen] Preisseite und Sperre sind nicht gleich:');
    for (const a of abweichungen) console.warn('[einstellungen]   ' + a);
    console.warn('[einstellungen] Angezeigt wird die Sperre. Bitte .env angleichen.');
  }

  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    stufen: liste,

    // Ohne Konto: eigene Angabe, weil das keine kaufbare Stufe
    // ist, aber auf der Startseite steht.
    ohneKonto: echt ? echt.gast : null,

    // Laut "Premium: Stufen und Technik" wird Premium erst ab
    // Juli 2027 verkauft - bis dahin verschenkt. Das Frontend
    // zeigt darum keinen Kaufknopf, solange das false ist.
    verkaufAktiv: stufen.verkaufAktiv(),

    stand: new Date().toISOString()
  });
});

module.exports = router;
