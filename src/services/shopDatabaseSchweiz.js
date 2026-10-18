// ============================================
// SYNORA - Shop-Datenbank: Schweizer Ergaenzungen
// ============================================
// Eigene Datei, damit die bestehenden drei Teile unangetastet bleiben.
//
// WICHTIG ZUM VERSTAENDNIS:
// Diese Shops tauchen nicht automatisch in deinen Suchergebnissen auf.
// Google Shopping listet Industrie-Distributoren praktisch nicht.
// Was dieser Eintrag bewirkt: Wenn so ein Shop doch einmal auftaucht,
// weiss SYNORA, wer das ist - statt ihn als "unbekannt" zu behandeln.
//
// Fuer echte Firmenanfragen ("3000 Widerstaende") braucht es spaeter
// die Schnittstellen der Distributoren selbst, weil Staffelpreise
// bei Google nirgends stehen.
// ============================================

'use strict';

// ==========================================
// INDUSTRIE & ELEKTRONIK-BAUTEILE
// Der Markt, in dem Firmen und Techniker einkaufen
// Domains geprueft im September 2026
// ==========================================

const INDUSTRIE_SHOPS = {

  // ------------------------------------------
  // BAUTEILE - die grossen Distributoren
  // ------------------------------------------
  bauteile: [
    { name: 'Distrelec', url: 'distrelec.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'schnell',
      spezialisierung: ['bauteile', 'messtechnik', 'b2b'], staffelpreise: true, geschaeftskunden: true },

    { name: 'Farnell Schweiz', url: 'ch.farnell.com', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell',
      spezialisierung: ['bauteile', 'halbleiter', 'b2b'], staffelpreise: true, geschaeftskunden: true },

    { name: 'Mouser Schweiz', url: 'mouser.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'mittel',
      spezialisierung: ['bauteile', 'halbleiter', 'b2b'], staffelpreise: true, geschaeftskunden: true },

    { name: 'DigiKey Schweiz', url: 'digikey.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'mittel',
      spezialisierung: ['bauteile', 'halbleiter', 'b2b'], staffelpreise: true, geschaeftskunden: true },

    { name: 'RS Components Schweiz', url: 'dech.rs-online.com', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'schnell',
      spezialisierung: ['bauteile', 'industrie', 'wartung', 'b2b'], staffelpreise: true, geschaeftskunden: true },

    { name: 'Simpex Electronic', url: 'simpex.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell',
      spezialisierung: ['bauteile', 'b2b'], staffelpreise: true, geschaeftskunden: true },

    { name: 'Conrad Business', url: 'conrad.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel',
      spezialisierung: ['bauteile', 'werkzeug', 'b2b'], staffelpreise: true, geschaeftskunden: true },

    { name: 'Bastelgarage', url: 'bastelgarage.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'schnell',
      spezialisierung: ['bastler', 'module', 'arduino'], staffelpreise: false, geschaeftskunden: false },

    // Deutschland - fuer den Preisvergleich ueber die Grenze
    { name: 'Reichelt', url: 'reichelt.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel',
      spezialisierung: ['bauteile', 'b2b'], staffelpreise: true, geschaeftskunden: true },

    { name: 'Buerklin Elektronik', url: 'buerklin.com', land: 'DE', qualitaet: 'premium', preis: 'mittel', versand: 'schnell',
      spezialisierung: ['bauteile', 'b2b'], staffelpreise: true, geschaeftskunden: true }
  ]
};

// ==========================================
// KORREKTUREN AN DER BESTEHENDEN DATENBANK
// ==========================================
//
// GEPRUEFT im September 2026:
//   Das Warenhaus Jelmoli an der Zuercher Bahnhofstrasse hat im
//   Februar 2025 endgueltig geschlossen. Der Online-Shop
//   jelmoli-shop.ch ist ein eigenstaendiges Unternehmen (Jelmoli
//   Versand AG) und laeuft weiter. Deine Eintraege zeigen aber auf
//   jelmoli.ch - das ist falsch.
//
// NOCH ZU PRUEFEN (mein Verdacht, nicht bestaetigt):
//   Schild und SportXX koennten nicht mehr eigenstaendig bestehen.
//   Bitte selbst nachschauen, bevor du sie loeschst.
// ==========================================

const KORREKTUREN = [
  {
    alt: 'jelmoli.ch',
    neu: 'jelmoli-shop.ch',
    neuerName: 'Jelmoli-Shop',
    grund: 'Warenhaus im Februar 2025 geschlossen; der Online-Shop ist eine eigene Firma und laeuft weiter',
    status: 'geprueft'
  },
  {
    alt: 'schild.ch',
    neu: null,
    grund: 'Modehaus Schild besteht vermutlich nicht mehr eigenstaendig - BITTE PRUEFEN',
    status: 'ungeprueft'
  },
  {
    alt: 'sportxx.ch',
    neu: null,
    grund: 'SportXX wurde vermutlich eingestellt - BITTE PRUEFEN',
    status: 'ungeprueft'
  }
];

// ==========================================
// ANWENDEN
// ==========================================

/**
 * Korrekturen auf eine Shop-Liste anwenden.
 * Nur geprueften Eintraegen wird gefolgt - alles andere bleibt stehen
 * und wird nur gemeldet. Lieber ein Shop zu viel als einer zu wenig,
 * solange du es nicht selbst nachgeschaut hast.
 */
function korrigiereShops(shops) {
  const gemeldet = [];

  const bearbeitet = shops.map((shop) => {
    const url = String(shop.url || '').toLowerCase();

    for (const k of KORREKTUREN) {
      if (!url.includes(k.alt)) continue;

      if (k.status !== 'geprueft') {
        gemeldet.push({ shop: shop.name, url: shop.url, hinweis: k.grund });
        return shop;
      }

      if (k.neu === null) return null; // geschlossen, raus

      return { ...shop, url: k.neu, name: k.neuerName || shop.name, korrigiert: true };
    }

    return shop;
  });

  return { shops: bearbeitet.filter(Boolean), zuPruefen: gemeldet };
}

/** Alle neuen Shops als flache Liste */
function alleIndustrieShops() {
  const liste = [];
  for (const gruppe of Object.values(INDUSTRIE_SHOPS)) {
    if (Array.isArray(gruppe)) liste.push(...gruppe);
  }
  return liste;
}

/** Shops, die Staffelpreise anbieten - Grundlage fuer die Firmenfunktion */
function shopsMitStaffelpreisen(land = null) {
  return alleIndustrieShops().filter(
    (s) => s.staffelpreise && (!land || s.land === land)
  );
}

module.exports = {
  INDUSTRIE_SHOPS,
  KORREKTUREN,
  korrigiereShops,
  alleIndustrieShops,
  shopsMitStaffelpreisen
};