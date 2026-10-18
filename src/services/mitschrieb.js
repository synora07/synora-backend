// ============================================
// SYNORA - Mitschrieb sammeln (Stufe 7)
// ============================================
// Der Controller sammelt waehrend der Suche Stueck fuer Stueck,
// am Ende wird einmal geschrieben.
//
// Grundsatz: Der Mitschrieb darf NIE eine Suche kaputt machen.
// Jeder Fehler beim Schreiben wird geschluckt und geloggt. Lieber
// ein fehlender Eintrag als ein Nutzer, der eine Fehlermeldung sieht.
// ============================================

'use strict';

const SuchProtokoll = require('../models/SuchProtokoll');

class Mitschrieb {
  constructor(sucheId) {
    this.daten = {
      sucheId,
      zeit: new Date(),
      nutzerTyp: 'gast',
      anfrage: {},
      rueckfrage: { gestellt: false },
      treffer: {},
      kandidaten: [],
      bewertungen: [],
      konsens: {},
      ergebnis: [],
      ausCache: { produkte: false, bewertung: false }
    };
    this.start = Date.now();
    // NEU am 03.10.2026, siehe speichern() unten
    this.gespeichert = false;
  }

  nutzer(req) {
    if (req.user) {
      this.daten.nutzerTyp = req.user.istPremium ? 'premium' : 'konto';
      this.daten.nutzerId = req.user._id || req.user.id || null;
    }
    return this;
  }

  anfrage({ roh, vollstaendig, begriff, budget, kategorie }) {
    this.daten.anfrage = { roh, vollstaendig, begriff, budget: budget || null, kategorie: kategorie || null };
    return this;
  }

  rueckfrageGestellt(frage) {
    this.daten.rueckfrage = { gestellt: true, frage };
    return this;
  }

  rueckfrageBeantwortet(antwort) {
    this.daten.rueckfrage.antwort = antwort;
    return this;
  }

  treffer(zahlen) {
    this.daten.treffer = { ...this.daten.treffer, ...zahlen };
    return this;
  }

  kandidaten(liste, stufeVon) {
    this.daten.kandidaten = (liste || []).map((p) => ({
      id: p.id,
      titel: String(p.title || p.name || '').slice(0, 200),
      preis: typeof p.priceValue === 'number' ? p.priceValue : null,
      shop: String(p.source || p.shop || '').slice(0, 100),
      shopStufe: typeof stufeVon === 'function' ? stufeVon(p) : null,
      land: p.shopInfo ? p.shopInfo.land : null
    }));
    return this;
  }

  /** Eine Bewertung eines Modells. Spaeter dreimal aufgerufen. */
  bewertung({ modell, rangliste, gruende, kosten, dauerMs, fehler }) {
    this.daten.bewertungen.push({
      modell,
      rangliste: rangliste || [],
      gruende: gruende || null,
      kosten: kosten || 0,
      dauerMs: dauerMs || null,
      fehler: fehler || null
    });
    return this;
  }

  /** Was die Faktenpruefung entfernt hat - zeigt, wie oft das Modell erfindet */
  gestrichen(liste) {
    this.daten.gestrichen = (liste || []).map((g) => ({
      produkt: g.produkt || null,
      grund: String(g.grund || '').slice(0, 200),
      satz: String(g.satz || '').slice(0, 300)
    }));
    return this;
  }

  konsens({ einstimmigTop1, runden, uneinigkeit }) {
    this.daten.konsens = {
      einstimmigTop1: !!einstimmigTop1,
      runden: runden || 1,
      uneinigkeit: uneinigkeit || []
    };
    return this;
  }

  ergebnis(produkte) {
    this.daten.ergebnis = (produkte || []).map((p) => ({
      id: p.id || null,
      titel: String(p.name || p.title || '').slice(0, 200),
      preis: typeof p.priceValue === 'number' ? p.priceValue : null,
      shop: String(p.shopName || p.source || '').slice(0, 100),
      score: typeof p.score === 'number' ? p.score : null
    }));
    return this;
  }

  cache(was, treffer) {
    this.daten.ausCache[was] = !!treffer;
    return this;
  }

  regelStand(fingerabdruck) {
    this.daten.regelStand = fingerabdruck;
    return this;
  }

  fehler(text) {
    this.daten.fehler = String(text || '').slice(0, 500);
    return this;
  }

  /**
   * Schreiben. Absichtlich ohne await im Controller aufrufbar -
   * eine Suche darf nie auf den Mitschrieb warten.
   *
   * NUR EINMAL. Neu am 03.10.2026.
   *
   * create() legt bei jedem Aufruf ein NEUES Dokument an. Ruft der
   * Controller auf zwei Wegen speichern(), steht dieselbe Suche
   * zweimal im Protokoll - mit zwei verschiedenen _id, beide
   * glaubhaft. Jede Auswertung zaehlt sie dann doppelt: Kosten,
   * Suchzahlen, der Trendbericht.
   *
   * Am 03.10.2026 sind drei weitere Aufrufstellen dazugekommen
   * (die Ausgaenge "nichts gefunden", "alles ueber Budget" und
   * "nur gemeldete Angebote"). Damit steigt die Wahrscheinlichkeit,
   * dass zwei Wege zusammenlaufen. Der Riegel hier kostet nichts
   * und macht das unmoeglich.
   */
  async speichern() {
    if (this.gespeichert) return;
    this.gespeichert = true;

    try {
      this.daten.dauerMs = Date.now() - this.start;
      this.daten.kostenUsd = this.daten.bewertungen.reduce((s, b) => s + (b.kosten || 0), 0);
      await SuchProtokoll.create(this.daten);
    } catch (e) {
      console.warn('[mitschrieb] nicht gespeichert:', e.message);
    }
  }
}

function neu(sucheId) {
  return new Mitschrieb(sucheId);
}

module.exports = { neu, Mitschrieb };