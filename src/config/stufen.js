// ============================================
// SYNORA - die drei Stufen an einer Stelle
// ============================================
// Quelle: "SYNORA - Premium: Stufen und Technik", Stand 02.10.2026
//
// WARUM DIESE DATEI EXISTIERT
//
// Am 04.10.2026 stand in der Design-Vorlage fuer die Startseite
// "3 kostenlose Suchen ohne Anmeldung" und "Unbegrenzt mit
// Account". Beides falsch. Nicht aus Schlamperei - sondern weil
// die Zahl an zwei Orten stand: in der .env, wo sie gilt, und im
// Frontend, wo sie angezeigt wird.
//
// Ab hier gibt es nur noch einen Ort. Das Frontend fragt
// GET /api/einstellungen und zeigt, was zurueckkommt. Es kennt
// keine eigene Zahl mehr und kann darum nichts Falsches
// versprechen.
//
// AUS DEM DOKUMENT, WORTWOERTLICH:
//   "Grenzen aus der Konfiguration lesen, nicht hartcodieren."
//
// ============================================
// ACHTUNG: ZWEI VERSCHIEDENE BEDEUTUNGEN VON 0
// ============================================
// Im Dokument steht "5 / 50 / 0 = unbegrenzt".
// In middleware/suchLimit.js gilt das GEGENTEIL: dort ist 0
// wirklich null, und wer unbegrenzt will, schreibt "aus".
//
// Das ist kein Zufall - in der ersten Fassung von suchLimit.js
// galt 0 als "Grenze aus", und damit haette SUCHEN_GAST=0 jedem
// Gast UNBEGRENZT viele Suchen gegeben. Genau verkehrt herum.
// Das wurde absichtlich geaendert.
//
// Darum gilt im Code weiterhin die suchLimit-Regel:
//     0     = null Suchen
//     "aus" = unbegrenzt
//
// Fuer Premium Plus steht in der .env also SUCHEN_PLUS=aus,
// nicht 0. Wer hier 0 eintraegt, sperrt seine teuerste Stufe aus.
// ============================================
'use strict';

function zahl(name, vorgabe) {
  const roh = process.env[name];
  if (roh === undefined || String(roh).trim() === '') return vorgabe;
  const n = Number(String(roh).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : vorgabe;
}

function grenze(name, vorgabe) {
  const roh = String(process.env[name] || '').trim().toLowerCase();
  if (roh === '') return vorgabe;
  if (roh === 'aus' || roh === 'unbegrenzt' || roh === 'off') return Infinity;
  const n = Number(roh);
  return Number.isFinite(n) && n >= 0 ? n : vorgabe;
}

function janein(name, vorgabe = false) {
  const roh = String(process.env[name] || '').trim().toLowerCase();
  if (roh === '') return vorgabe;
  return roh === 'true' || roh === '1' || roh === 'ja';
}

// ============================================
// DIE STUFEN
// ============================================
// Die Reihenfolge ist die Anzeigereihenfolge auf der Preisseite.
//
// REGEL AUS DEM DOKUMENT, die der Code einhalten muss:
//   "Jede Stufe kann MEHR als die darunter, nie weniger."
// Unten in pruefeStufen() wird das nachgerechnet, nicht geglaubt.
//
// ZWEITE REGEL, die wichtiger ist als alle Zahlen hier:
//   "Die Qualitaet ist auf allen Stufen gleich. Gekauft werden
//    nur Menge und Komfort, nie bessere Empfehlungen."
// Darum taucht in keiner Zeile unten ein Merkmal auf, das die
// EMPFEHLUNG verbessert. Mehr Suchen ja, bessere Treffer nie.

const STUFEN = [
  {
    schluessel: 'gratis',
    name: 'Gratis',
    preisMonat: 0,
    preisJahr: null,
    suchenProMonat: grenze('SUCHEN_KONTO', 5),
    alarme: zahl('PREISALARM_MAX_GRATIS', 0),
    kann: {
      dreiVorschlaege: true,
      nachteilJeProdukt: true,
      endpreisSchweiz: true,
      preisalarm: false,
      preisverlauf: false,
      merkliste: false,
      besitzWaechter: false,
      aktionenFrueher: false,
      personenImKonto: 1
    }
  },
  {
    schluessel: 'premium',
    name: 'Premium',
    preisMonat: zahl('PREMIUM_PREIS_MONAT', 7),
    preisJahr: zahl('PREMIUM_PREIS_JAHR', 79),
    suchenProMonat: grenze('SUCHEN_PREMIUM', 50),
    alarme: zahl('PREISALARM_MAX_PREMIUM', 3),
    empfohlen: true,           // die gruen hinterlegte Spalte
    kann: {
      dreiVorschlaege: true,
      nachteilJeProdukt: true,
      endpreisSchweiz: true,
      preisalarm: true,
      preisverlauf: true,
      merkliste: true,
      besitzWaechter: true,
      aktionenFrueher: false,
      personenImKonto: 1
    }
  },
  {
    schluessel: 'plus',
    name: 'Premium Plus',
    preisMonat: zahl('PLUS_PREIS_MONAT', 20),
    preisJahr: zahl('PLUS_PREIS_JAHR', 199),
    suchenProMonat: grenze('SUCHEN_PLUS', Infinity),
    alarme: zahl('PREISALARM_MAX_PLUS', Infinity),
    kann: {
      dreiVorschlaege: true,
      nachteilJeProdukt: true,
      endpreisSchweiz: true,
      preisalarm: true,
      preisverlauf: true,
      merkliste: true,
      besitzWaechter: true,
      aktionenFrueher: true,
      personenImKonto: zahl('PLUS_PERSONEN', 4)
    }
  }
];

// ============================================
// NACHRECHNEN STATT GLAUBEN
// ============================================
// "Keine hoehere Stufe, die irgendwo weniger kann als eine
// billigere" steht im Dokument unter "Was du nie machen darfst".
// Ein Satz in einem PDF haelt niemanden davon ab - eine Pruefung
// beim Start schon.
//
// Das ist leicht passiert: Jemand setzt PREISALARM_MAX_PREMIUM
// auf 10 und vergisst PREISALARM_MAX_PLUS. Dann kann die teure
// Stufe weniger als die billige, und das faellt erst auf, wenn
// sich ein zahlender Kunde beschwert.

function pruefeStufen() {
  const klagen = [];

  for (let i = 1; i < STUFEN.length; i++) {
    const unten = STUFEN[i - 1];
    const oben = STUFEN[i];

    if (oben.suchenProMonat < unten.suchenProMonat) {
      klagen.push(`${oben.name} hat ${oben.suchenProMonat} Suchen, ${unten.name} aber ${unten.suchenProMonat}`);
    }
    if (oben.alarme < unten.alarme) {
      klagen.push(`${oben.name} erlaubt ${oben.alarme} Preisalarme, ${unten.name} aber ${unten.alarme}`);
    }
    for (const merkmal of Object.keys(unten.kann)) {
      const u = unten.kann[merkmal];
      const o = oben.kann[merkmal];
      if (typeof u === 'boolean' && u === true && o !== true) {
        klagen.push(`${oben.name} kann "${merkmal}" nicht, ${unten.name} aber schon`);
      }
      if (typeof u === 'number' && typeof o === 'number' && o < u) {
        klagen.push(`${oben.name} erlaubt ${merkmal}=${o}, ${unten.name} aber ${u}`);
      }
    }
  }

  if (klagen.length) {
    console.error('');
    console.error('[stufen] ACHTUNG: Eine teurere Stufe kann weniger als eine billigere.');
    for (const k of klagen) console.error('[stufen]   ' + k);
    console.error('[stufen] Pruefe die PREISALARM_MAX_* und SUCHEN_* Zeilen in der .env.');
    console.error('');
  }

  return klagen;
}

// ============================================
// Fuer die Ausgabe nach aussen
// ============================================
// Infinity laesst sich nicht als JSON schreiben - JSON.stringify
// macht daraus null, und null heisst beim Empfaenger schnell
// "keine Angabe" statt "unbegrenzt". Darum ausdruecklich beides:
// Zahl null UND ein Flag.
function nachAussen(wert) {
  const unbegrenzt = wert === Infinity || wert === Number.POSITIVE_INFINITY;
  return { anzahl: unbegrenzt ? null : Number(wert), unbegrenzt };
}

function fuersFrontend() {
  return STUFEN.map((s) => ({
    schluessel: s.schluessel,
    name: s.name,
    empfohlen: !!s.empfohlen,
    preisMonat: s.preisMonat,
    preisJahr: s.preisJahr,
    suchen: nachAussen(s.suchenProMonat),
    alarme: nachAussen(s.alarme),
    kann: s.kann
  }));
}

module.exports = {
  STUFEN,
  pruefeStufen,
  fuersFrontend,
  nachAussen,
  // Wird Premium schon verkauft? Laut Dokument erst ab Juli 2027 -
  // bis dahin wird es verschenkt. Darum zeigt die Preisseite
  // keinen Kaufknopf, solange das hier false ist.
  verkaufAktiv: () => janein('PREMIUM_VERKAUF', false)
};
