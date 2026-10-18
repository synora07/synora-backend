// ============================================
// SYNORA - Cache-Dienst
// ============================================
// GEAENDERT am 03.10.2026: Aufnahme und Cache sind getrennt.
//
// Was vorher falsch war
// ---------------------
// Der Abspielmodus las aus dem Cache und ignorierte dort das
// Ablaufdatum:
//
//     if (!(abspielen() && typ === 'produkte')) {
//       suche.ablaufAm = { $gt: new Date() };
//     }
//
// Das war eine Ebene zu hoch angesetzt. MongoDB loescht den Eintrag
// ueber den TTL-Index, sobald ablaufAm erreicht ist - die Zeile ist
// physisch weg. Man kann kein Ablaufdatum ueberspringen, wenn die
// Zeile gar nicht mehr existiert.
//
// Gemessen am 03.10.2026: suchcache 0 Eintraege, obwohl der
// Pruefkatalog gelaufen war.
//
// Was jetzt gilt
// --------------
//   Cache    (SuchCache)  - kurzlebig, spart Geld im Betrieb
//   Aufnahme (Aufnahme)   - dauerhaft, dient dem Pruefen
//
// ABSPIELEN=1 liest aus der Aufnahme. Der Cache bleibt unberuehrt
// und macht weiter seine eigene Arbeit.
// ============================================
'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const SuchCache = require('../models/SuchCache');
const Aufnahme = require('../models/Aufnahme');

// ============================================
// HALTBARKEIT - hier aendern, sonst nirgends
// Am Black Friday TTL_PRODUKTE auf 5 Minuten setzen.
// ============================================
const TTL_PRODUKTE = 30 * 60;        // 30 Minuten
const TTL_BEWERTUNG = 24 * 60 * 60;  // 24 Stunden

const AKTIV = process.env.CACHE_AKTIV !== 'false';

/**
 * Anfrage vereinheitlichen, damit "Kopfhoerer" und "kopfhörer  "
 * denselben Schluessel ergeben.
 */
function normalisieren(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Schluessel aus Begriff, Budget und Land.
 * Das Budget gehoert dazu: die Bewertung wurde fuer genau dieses
 * Budget erstellt und waere fuer ein anderes falsch.
 *
 * WICHTIG: Aufnahme und Cache benutzen denselben Schluessel. Wer
 * diese Funktion aendert, macht alle bestehenden Aufnahmen
 * unauffindbar - sie sind dann nicht geloescht, nur nicht mehr zu
 * finden. Nach einer Aenderung hier:
 *     node scripts/aufnahmeZeigen.js
 * und pruefen, ob die Zahl der Treffer noch stimmt.
 */
function schluesselBauen(begriff, budget, land = 'CH') {
  const roh = normalisieren(begriff) + '|' + (budget || 'kein') + '|' + land;
  return crypto.createHash('sha1').update(roh).digest('hex').slice(0, 24);
}

function verfuegbar() {
  return AKTIV && mongoose.connection.readyState === 1;
}

// ============================================
// ABSPIEL-MODUS
// ============================================
// Steht ABSPIELEN=1 in der .env, kommen die Produkte aus der
// Aufnahme statt von SerpAPI. Fuer den Pruefkatalog: einmal
// bezahlen, beliebig oft pruefen.
//
// Rechnung: 50 Fragen mal bis zu vier SerpAPI-Abfragen sind 200
// pro Durchlauf. Bei vier Durchlaeufen 800 - mehr als der halbe
// Monatsplan, nur fuers Pruefen.
//
// Die BEWERTUNG bleibt frisch und laeuft weiter ueber den normalen
// Cache. Genau sie wollen wir ja pruefen.
function abspielen() {
  return process.env.ABSPIELEN === '1' || process.env.ABSPIELEN === 'true';
}

// ============================================
// AUFNAHME-MODUS
// ============================================
// Steht AUFNEHMEN=1, wird jede ECHTE SerpAPI-Antwort zusaetzlich
// dauerhaft weggeschrieben. Danach laeuft derselbe Begriff im
// Abspielmodus beliebig oft ohne einen Rappen Kosten.
//
// Standard ist AUS. Gruende:
//   - In Produktion waechst die Sammlung sonst unbegrenzt, und auf
//     dem Atlas-Gratistarif hast du 512 MB.
//   - Du willst selbst bestimmen, welcher Durchlauf die Grundlage
//     deiner Tests wird. Eine Aufnahme von einem halb kaputten
//     Stand ist schlimmer als keine.
//
// Der uebliche Ablauf:
//   1. AUFNEHMEN=1, ABSPIELEN=0  -> einmal laufen, kostet Geld
//   2. AUFNEHMEN=0, ABSPIELEN=1  -> beliebig oft, kostet nichts
function aufnehmen() {
  return process.env.AUFNEHMEN === '1' || process.env.AUFNEHMEN === 'true';
}

/**
 * Aufnahme lesen. Nur fuer Produkte - Bewertungen sollen frisch sein.
 */
async function aufnahmeHolen(schluessel) {
  if (mongoose.connection.readyState !== 1) return null;

  try {
    const eintrag = await Aufnahme.findOne({ schluessel }).lean();
    if (!eintrag || !eintrag.daten) return null;

    // Mitzaehlen, ohne die Antwort zu bremsen
    Aufnahme.updateOne(
      { schluessel },
      { $inc: { abspielungen: 1 }, $set: { zuletztAbgespielt: new Date() } }
    ).catch(() => {});

    const anzahl = Array.isArray(eintrag.daten) ? eintrag.daten.length : 0;
    const hinweis = eintrag.quelle === 'rekonstruiert' ? ' [rekonstruiert]' : '';
    console.log(`[abspielen] Aufnahme "${eintrag.begriff}" - ${anzahl} Produkte${hinweis}`);

    return eintrag.daten;
  } catch (e) {
    console.error('[abspielen] Aufnahme lesen fehlgeschlagen:', e.message);
    return null;
  }
}

/**
 * Aufnahme schreiben. Ueberschreibt eine bestehende zum selben
 * Schluessel - die neuere Messung ist die bessere.
 *
 * Eine rekonstruierte Aufnahme wird NICHT von einer echten
 * ueberschrieben verhindert, sondern umgekehrt: echte Daten
 * verdraengen rekonstruierte. Andersherum waere es ein Rueckschritt.
 */
async function aufnahmeSchreiben(schluessel, daten, zusatz = {}) {
  if (mongoose.connection.readyState !== 1) return false;
  if (!Array.isArray(daten) || !daten.length) return false;

  const quelle = zusatz.quelle === 'rekonstruiert' ? 'rekonstruiert' : 'serpapi';

  try {
    // Eine echte Aufnahme darf eine rekonstruierte ersetzen.
    // Eine rekonstruierte darf eine echte NICHT ersetzen.
    if (quelle === 'rekonstruiert') {
      const vorhanden = await Aufnahme.findOne({ schluessel }, 'quelle').lean();
      if (vorhanden && vorhanden.quelle === 'serpapi') return false;
    }

    await Aufnahme.updateOne(
      { schluessel },
      {
        $set: {
          daten,
          anzahl: daten.length,
          begriff: zusatz.begriff || '',
          budget: zusatz.budget ?? null,
          land: zusatz.land || 'CH',
          quelle,
          aufgenommenAm: new Date()
        },
        $setOnInsert: { abspielungen: 0, zuletztAbgespielt: null }
      },
      { upsert: true }
    );
    return true;
  } catch (e) {
    // Eine fehlgeschlagene Aufnahme darf die Suche nie stoppen
    console.error('[aufnahme] Schreiben fehlgeschlagen:', e.message);
    return false;
  }
}

/**
 * Eintrag holen. Gibt null zurueck, wenn nichts da oder abgelaufen ist.
 *
 * Im Abspielmodus kommen PRODUKTE aus der Aufnahme. Findet sich dort
 * nichts, wird null zurueckgegeben - der Controller stellt dann
 * ebenfalls keine SerpAPI-Abfrage, sondern meldet
 * "nicht aufgenommen". So merkst du sofort, welche Testfrage fehlt,
 * statt still Geld auszugeben.
 */
async function holen(typ, schluessel) {
  if (!verfuegbar()) return null;

  if (abspielen() && typ === 'produkte') {
    return await aufnahmeHolen(schluessel);
  }

  try {
    const eintrag = await SuchCache.findOne({
      schluessel,
      typ,
      ablaufAm: { $gt: new Date() }
    });

    if (!eintrag) return null;

    // Zaehlen, wie oft der Cache wirklich greift - ohne zu warten
    SuchCache.updateOne({ _id: eintrag._id }, { $inc: { treffer: 1 } }).catch(() => {});

    const alterSekunden = Math.round((Date.now() - eintrag.erstelltAm.getTime()) / 1000);
    console.log(`[cache] Treffer ${typ} (${alterSekunden}s alt)`);

    return eintrag.daten;
  } catch (e) {
    console.error('[cache] Lesen fehlgeschlagen:', e.message);
    return null;
  }
}

/**
 * Eintrag speichern. Ueberschreibt einen bestehenden.
 *
 * Steht AUFNEHMEN=1, wandern Produkte zusaetzlich in die dauerhafte
 * Aufnahme. Der Cache bekommt seinen Eintrag unveraendert - beide
 * Ablagen haben verschiedene Aufgaben und verschiedene Haltbarkeit.
 */
async function speichern(typ, schluessel, daten, zusatz = {}) {
  if (!verfuegbar()) return;

  // Aufnahme zuerst anstossen, aber NICHT darauf warten: der Cache
  // ist fuer den naechsten Besucher wichtiger als die Aufnahme.
  if (typ === 'produkte' && aufnehmen()) {
    aufnahmeSchreiben(schluessel, daten, zusatz)
      .then((ok) => ok && console.log(`[aufnahme] "${zusatz.begriff || schluessel}" gespeichert`))
      .catch(() => {});
  }

  const sekunden = typ === 'produkte' ? TTL_PRODUKTE : TTL_BEWERTUNG;

  try {
    await SuchCache.updateOne(
      { schluessel, typ },
      {
        $set: {
          daten,
          begriff: zusatz.begriff || '',
          budget: zusatz.budget || null,
          erstelltAm: new Date(),
          ablaufAm: new Date(Date.now() + sekunden * 1000)
        },
        $setOnInsert: { treffer: 0 }
      },
      { upsert: true }
    );
  } catch (e) {
    // Ein Cache-Fehler darf die Suche nie stoppen
    console.error('[cache] Schreiben fehlgeschlagen:', e.message);
  }
}

/**
 * Cache leeren - fuer Tests und nach Prompt-Aenderungen.
 *
 * Ruehrt die AUFNAHMEN NICHT an. Das ist Absicht: sonst waere nach
 * jeder Prompt-Aenderung die Grundlage deiner Tests weg, und du
 * muesstest neu bezahlen. Aufnahmen loescht man ausdruecklich mit
 *     node scripts/aufnahmeZeigen.js --loeschen
 */
async function leeren(typ = null) {
  if (mongoose.connection.readyState !== 1) return 0;
  const filter = typ ? { typ } : {};
  const ergebnis = await SuchCache.deleteMany(filter);
  return ergebnis.deletedCount || 0;
}

/** Zahlen fuer die Auswertung */
async function statistik() {
  if (mongoose.connection.readyState !== 1) return null;

  const eintraege = await SuchCache.find({}, 'typ treffer').lean();
  const zusammen = { produkte: { anzahl: 0, treffer: 0 }, bewertung: { anzahl: 0, treffer: 0 } };

  for (const e of eintraege) {
    if (!zusammen[e.typ]) continue;
    zusammen[e.typ].anzahl += 1;
    zusammen[e.typ].treffer += e.treffer || 0;
  }

  // Aufnahmen mitzaehlen - sonst siehst du im Dashboard nicht,
  // ob der Abspielmodus ueberhaupt etwas zu spielen hat.
  try {
    const [gesamt, echt] = await Promise.all([
      Aufnahme.countDocuments({}),
      Aufnahme.countDocuments({ quelle: 'serpapi' })
    ]);
    zusammen.aufnahmen = { anzahl: gesamt, echt, rekonstruiert: gesamt - echt };
  } catch (_) {
    zusammen.aufnahmen = { anzahl: 0, echt: 0, rekonstruiert: 0 };
  }

  return zusammen;
}

module.exports = {
  abspielen,
  aufnehmen,
  schluesselBauen,
  normalisieren,
  holen,
  speichern,
  leeren,
  statistik,
  aufnahmeHolen,
  aufnahmeSchreiben,
  TTL_PRODUKTE,
  TTL_BEWERTUNG
};