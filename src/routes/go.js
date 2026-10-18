// ============================================
// SYNORA - Klick-Weiterleitung
// GET /api/go/:kurzId
// ============================================
// Der Nutzer klickt auf ein Produkt. Erst in diesem Moment wird die
// echte Haendlerliste geholt, der beste Shop gewaehlt und weitergeleitet.
//
// Warum erst beim Klick und nicht schon bei der Suche:
// nicht jeder klickt. So zahlst du im Schnitt weniger als einen
// zusaetzlichen SerpAPI-Aufruf pro Suche statt drei.
//
// Hier wird spaeter der AWIN-Link eingesetzt - an genau einer Stelle.
// ============================================
'use strict';

const express = require('express');
const axios = require('axios');
const router = express.Router();

const ProduktKlick = require('../models/ProduktKlick');

// Blacklist aus der Shop-Datenbank, defensiv geladen
let isBlacklisted = () => false;
try {
  const db = require('../services/shopDatabasePart3');
  if (typeof db.isBlacklisted === 'function') isBlacklisted = db.isBlacklisted;
} catch (e) {
  console.warn('[go] Blacklist nicht geladen:', e.message);
}

// ============================================
// KOSTENBREMSE - NEU am 03.10.2026
// ============================================
// Vorher lief diese Route an der Kostenbremse vorbei. Jeder Klick
// loeste eine SerpAPI-Abfrage aus, die nirgends verbucht wurde:
//
//   - Im Dashboard stand CHF 0.00, waehrend Guthaben abfloss.
//   - Derselbe Link zehnmal geklickt waren zehn Abfragen.
//   - Am Black Friday wird am meisten geklickt.
//
// Die Franken-Wand stand um die Suche herum. Die Tuer daneben war
// offen. Jetzt nicht mehr.
let kostenbremse = null;
try {
  kostenbremse = require('../services/kostenbremse');
} catch (e) {
  console.warn('[go] Kostenbremse nicht geladen:', e.message);
}

// ============================================
// HAENDLERLISTE KURZ MERKEN
// ============================================
// Wer zurueck und wieder vor geht, klickt denselben Link mehrmals.
// Ohne Gedaechtnis kostet das jedes Mal. 30 Minuten ist dieselbe
// Haltbarkeit wie beim Produktcache - danach koennen sich Preise
// bewegt haben.
//
// Im Arbeitsspeicher, nicht in der Datenbank: es geht um Minuten,
// und ein Neustart darf das ruhig vergessen. Laeuft SYNORA spaeter
// auf mehreren Instanzen, hat jede ihren eigenen - das kostet
// hoechstens eine Abfrage mehr, nie eine falsche Antwort.
const GEMERKT = new Map();
const MERK_MS = 30 * 60 * 1000;
const MERK_MAX = 500;

function ausGedaechtnis(kurzId) {
  const e = GEMERKT.get(kurzId);
  if (!e) return null;
  if (Date.now() - e.zeit > MERK_MS) {
    GEMERKT.delete(kurzId);
    return null;
  }
  return e.gewaehlt;
}

function insGedaechtnis(kurzId, gewaehlt) {
  // Aelteste zuerst raus, damit der Speicher nicht unbegrenzt waechst
  if (GEMERKT.size >= MERK_MAX) {
    const aeltester = GEMERKT.keys().next().value;
    if (aeltester !== undefined) GEMERKT.delete(aeltester);
  }
  GEMERKT.set(kurzId, { gewaehlt, zeit: Date.now() });
}

// ============================================
// PARTNERLINK - NEU am 12.10.2026
// ============================================
// Bis heute ging die Weiterleitung direkt zum Shop. Der Klick
// wurde gezaehlt, der Kauf fand statt - und SYNORA bekam nichts,
// weil im Link keine Partnerkennung stand.
//
// Geladen wird wie die Kostenbremse weiter oben: faellt die
// Datei aus, laeuft SYNORA weiter und leitet unveraendert
// weiter. Ein Besucher muss beim Shop ankommen, auch wenn an der
// Provision etwas nicht stimmt.
let partnerLink = (url) => url;
try {
  partnerLink = require('../services/partnerlink');
} catch (e) {
  console.warn('[go] partnerlink nicht geladen - Links gehen ohne Provision raus:', e.message);
}

const FRONTEND = process.env.FRONTEND_URL || 'https://synora.li';

// Ein Schweizer Shop darf bis zu diesem Anteil teurer sein und gewinnt
// trotzdem - wegen Lieferzeit, Rueckgabe und Garantie.
const CH_BONUS = 0.08; // 8 Prozent

// Solange Zoll und Einfuhr-MwSt nicht gerechnet sind, kennen wir den
// Endpreis auslaendischer Shops NICHT. Dann gewinnt immer der
// Schweizer Shop - beim ihm stimmt der angezeigte Preis.
// Auf false setzen, sobald berechneEndpreis() Zoll und MwSt liefert.
const NUR_CH_BIS_ZOLL_GERECHNET = true;

// ============================================
// LAND AUS DER URL BESTIMMEN
// ============================================
function landAusUrl(url, name) {
  const text = String(url || name || '').toLowerCase();

  if (/\.ch(\/|$|\?)/.test(text) || /\.ch"/.test(text) || text.includes('.ch/')) return 'CH';
  if (text.includes('.de/') || /\.de(\/|$|\?)/.test(text)) return 'DE';
  if (text.includes('.at/')) return 'AT';
  if (text.includes('.fr/')) return 'FR';
  if (text.includes('.it/')) return 'IT';
  if (text.includes('.co.uk')) return 'UK';
  if (text.includes('.com/')) return 'INT';
  return 'UNBEKANNT';
}

// ============================================
// ENDPREIS
// ============================================
// ACHTUNG: Zoll und Einfuhr-MwSt sind noch NICHT berechnet.
// Solange `vollstaendig` false ist, darf im Frontend nie
// "Endpreis" stehen, sondern nur "Preis beim Shop".
// ============================================
function berechneEndpreis(store) {
  const basis =
    typeof store.extracted_price === 'number'
      ? store.extracted_price
      : typeof store.extracted_total === 'number'
        ? store.extracted_total
        : null;

  let versand = 0;
  const versandText = String(store.shipping || '').toLowerCase();
  if (versandText && !/gratis|free|kostenlos|0\.00/.test(versandText)) {
    const treffer = versandText.match(/[\d.,]+/);
    if (treffer) {
      const zahl = Number.parseFloat(treffer[0].replace(',', '.'));
      if (Number.isFinite(zahl)) versand = zahl;
    }
  }

  const land = landAusUrl(store.link, store.name);
  const inland = land === 'CH';

  return {
    basis,
    versand,
    zoll: null,   // TODO: Schweizer Zollregeln, separat recherchieren
    mwst: null,   // TODO: Einfuhr-MwSt
    land,
    summe: basis === null ? null : Math.round((basis + versand) * 100) / 100,
    // Nur bei Schweizer Shops ist der Preis schon der Endpreis
    vollstaendig: inland && basis !== null
  };
}

// ============================================
// SHOP AUSWAEHLEN
// Nicht der niedrigste Produktpreis gewinnt, sondern der
// niedrigste Preis in die Schweiz. Bei aehnlichem Preis
// gewinnt der Schweizer Shop.
// ============================================
function waehleShop(stores) {
  const kandidaten = [];

  for (const s of stores || []) {
    if (!s || !s.link) continue;
    if (isBlacklisted(s.name || '')) continue;

    const preis = berechneEndpreis(s);
    if (preis.summe === null) continue;

    kandidaten.push({ store: s, preis });
  }

  if (!kandidaten.length) return null;

  kandidaten.sort((a, b) => a.preis.summe - b.preis.summe);
  const guenstigster = kandidaten[0];

  // Guenstigster Schweizer Shop (Liste ist bereits sortiert)
  const schweizer = kandidaten.find((k) => k.preis.land === 'CH');
  if (!schweizer) return guenstigster;
  if (schweizer === guenstigster) return schweizer;

  // Ohne Zollberechnung ist der auslaendische Preis nur der halbe Preis.
  // Dann nehmen wir den, bei dem wir den Endpreis kennen.
  if (NUR_CH_BIS_ZOLL_GERECHNET) return schweizer;

  const aufschlag = (schweizer.preis.summe - guenstigster.preis.summe) / guenstigster.preis.summe;
  return aufschlag <= CH_BONUS ? schweizer : guenstigster;
}

// ============================================
// HAENDLERLISTE HOLEN
// ============================================
async function holeHaendler(token) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error('SERPAPI_KEY fehlt');

  const antwort = await axios.get('https://serpapi.com/search', {
    params: {
      api_key: apiKey,
      engine: 'google_immersive_product',
      page_token: token,
      gl: 'ch',
      hl: 'de'
    },
    timeout: 15000
  });

  return (antwort.data
    && antwort.data.product_results
    && antwort.data.product_results.stores) || [];
}

// ============================================
// GET /api/go/:kurzId
// ============================================
router.get('/:kurzId', async (req, res) => {
  const { kurzId } = req.params;

  try {
    const eintrag = await ProduktKlick.findOne({ kurzId });

    if (!eintrag) {
      // Link ist aelter als 30 Tage oder erfunden
      return res.redirect(302, `${FRONTEND}/?hinweis=link-abgelaufen`);
    }

    // ---------- 1. Schon gemerkt? Dann kostet es nichts ----------
    let gewaehlt = ausGedaechtnis(kurzId);
    let ausSpeicher = !!gewaehlt;

    // ---------- 2. Sonst: darf das Geld kosten? ----------
    if (!gewaehlt) {
      let darf = { erlaubt: true };
      if (kostenbremse) {
        try {
          // istGast: false ist wichtig. Ein Klick ist keine Suche,
          // und auf dieser Route laeuft keine Anmeldung - ohne das
          // wuerde die Gast-IP-Grenze ehrliche Klicks abweisen.
          //
          // Verbucht wird der Preis einer guenstigen Suche. Ein
          // Klick ist genau EINE SerpAPI-Abfrage und damit etwas
          // billiger - lieber grosszuegig rechnen als zu knapp.
          darf = await kostenbremse.darfSuchen({ istPremium: false, istGast: false });
        } catch (e) {
          // Stuerzt die Bremse ab, wird NICHT eingekauft. Eine
          // Weiterleitung ohne frische Haendlerliste ist besser als
          // eine Ausgabe, von der niemand weiss, ob sie gedeckt ist.
          console.error('[go] Kostenbremse gestoert:', e.message);
          darf = { erlaubt: false, grund: 'bremse_gestoert' };
        }
      }

      if (darf.erlaubt) {
        try {
          const haendler = await holeHaendler(eintrag.token);
          gewaehlt = waehleShop(haendler);
          if (gewaehlt) insGedaechtnis(kurzId, gewaehlt);
          console.log(`[go] ${kurzId}: ${haendler.length} Haendler, gewaehlt: ${gewaehlt ? gewaehlt.store.name : 'keiner'}`);
        } catch (e) {
          console.error('[go] Haendlerliste fehlgeschlagen:', e.message);
        }
      } else {
        // ---------- 3. Kein Budget: auf das zurueckgreifen, was
        // beim letzten Klick schon ermittelt wurde ----------
        console.warn(`[go] ${kurzId}: keine Abfrage (${darf.grund || 'Deckel erreicht'})`);
        const alt = eintrag.gewaehlterShop;
        if (alt && alt.url) {
          gewaehlt = {
            store: { name: alt.name, link: alt.url },
            preis: {
              summe: alt.preis,
              land: alt.land,
              vollstaendig: alt.endpreisVollstaendig
            }
          };
          ausSpeicher = true;
          console.log(`[go] ${kurzId}: nutze den Shop vom letzten Mal (${alt.name})`);
        }
      }
    } else {
      console.log(`[go] ${kurzId}: aus dem Gedaechtnis (${gewaehlt.store.name}) - keine Abfrage noetig`);
    }

    // Klick zaehlen - auch wenn die Weiterleitung scheitert.
    // Das ist eine deiner vier Messzahlen.
    eintrag.klicks += 1;
    eintrag.letzterKlick = new Date();
    if (!eintrag.ersterKlick) eintrag.ersterKlick = eintrag.letzterKlick;

    // Nur bei einer FRISCHEN Abfrage neu schreiben. Kam der Shop aus
    // dem Gedaechtnis oder aus dem letzten Eintrag, steht dasselbe
    // schon da - und ein alter Preis soll nicht so aussehen, als
    // waere er gerade gemessen worden.
    if (gewaehlt && !ausSpeicher) {
      eintrag.gewaehlterShop = {
        name: gewaehlt.store.name || null,
        url: gewaehlt.store.link || null,
        preis: gewaehlt.preis.summe,
        land: gewaehlt.preis.land,
        endpreisVollstaendig: gewaehlt.preis.vollstaendig
      };
    }

    await eintrag.save().catch((e) => console.error('[go] Speichern fehlgeschlagen:', e.message));

    if (gewaehlt && gewaehlt.store.link) {
      // ============================================
      // HIER WIRD AUS DEM KLICK GELD - ODER AUCH NICHT
      // ============================================
      // partnerLink() gibt entweder einen Trackinglink des
      // Netzwerks zurueck oder die unveraenderte Shop-URL.
      // Welcher Fall eintritt, haengt allein an der Tabelle in
      // src/services/partnerlink.js - hier ist nichts mehr zu
      // aendern, wenn ein neues Programm dazukommt.
      const ziel = partnerLink(gewaehlt.store.link, gewaehlt.store.name);
      return res.redirect(302, ziel);
    }

    // Kein Haendler gefunden: ehrlich zurueck zur Seite,
    // statt den Nutzer auf eine Google-Seite abzuschieben
    return res.redirect(302, `${FRONTEND}/?hinweis=kein-shop-gefunden`);
  } catch (error) {
    console.error('[go] Fehler:', error.message);
    return res.redirect(302, `${FRONTEND}/?hinweis=fehler`);
  }
});

module.exports = router;
module.exports.waehleShop = waehleShop;
module.exports.berechneEndpreis = berechneEndpreis;
module.exports.landAusUrl = landAusUrl;