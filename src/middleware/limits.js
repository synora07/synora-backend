// ============================================
// SYNORA - Tageslimits
// ============================================
// Zwei Grundsaetze:
//
// 1. Gezaehlt wird ERST NACH einer erfolgreichen Suche.
//    Faellt SerpAPI aus, verliert der Nutzer keine Suche.
//
// 2. Jede Ablehnung wird mit Grund protokolliert, damit du siehst,
//    ob echte Nutzer ans Limit stossen oder nur Skripte.
// ============================================
'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const { GastZaehler, AbgelehnteSuche } = require('../models/GastZaehler');

// ============================================
// LIMITS - hier aendern, sonst nirgends
// ============================================
const LIMIT_GAST = 3;
const LIMIT_ANGEMELDET = 15;
const LIMIT_PREMIUM = 50; // faire Nutzung, steht so in den AGB

// Netz darunter: Wer keine Browser-Kennung mitschickt (Skripte), waere
// sonst bei jeder Anfrage ein neuer Gast. Pro IP gilt deshalb zusaetzlich
// eine Obergrenze, hoch genug fuer einen Haushalt oder ein Buero.
const LIMIT_GAST_PRO_IP = 10;

const CLIENT_HEADER = 'x-synora-client';

/** Datum als YYYY-MM-DD in Schweizer Zeit */
function heutigesDatum() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}

/** Mitternacht Schweizer Zeit, als Hinweis fuer das Frontend */
function naechsterReset() {
  const jetzt = new Date();
  const morgen = new Date(jetzt);
  morgen.setUTCDate(morgen.getUTCDate() + 1);
  morgen.setUTCHours(22, 0, 0, 0); // grob Mitternacht CH, reicht als Anzeige
  return morgen.toISOString();
}

// ============================================
// KENNUNG FUER GAESTE
// IP allein reicht nicht: in einer Firma oder WG teilen sich mehrere
// Leute dieselbe IP. Deshalb IP + eine Kennung aus dem Browser.
// Das Frontend schickt sie im Header x-synora-client.
// ============================================
function leseIp(req) {
  const weitergeleitet = req.headers['x-forwarded-for'];
  if (weitergeleitet) return String(weitergeleitet).split(',')[0].trim();
  return req.ip || (req.socket && req.socket.remoteAddress) || 'unbekannt';
}

function baueKennung(req) {
  const ip = leseIp(req);
  let browserKennung = req.headers[CLIENT_HEADER];

  let neuVergeben = false;
  if (!browserKennung || String(browserKennung).length < 8) {
    browserKennung = crypto.randomBytes(12).toString('base64url');
    neuVergeben = true;
  }

  // Gehasht speichern - die IP liegt nie im Klartext in der Datenbank
  const hash = (wert) => crypto.createHash('sha256').update(wert).digest('hex').slice(0, 32);

  return {
    kennung: 'b:' + hash(ip + '|' + browserKennung), // pro Browser
    ipKennung: 'i:' + hash(ip),                      // pro IP
    browserKennung,
    neuVergeben
  };
}

// ============================================
// ABLEHNUNG PROTOKOLLIEREN
// ============================================
async function protokolliereAblehnung(daten) {
  try {
    if (mongoose.connection.readyState !== 1) return;
    await AbgelehnteSuche.create(daten);
  } catch (e) {
    console.error('[limit] Ablehnung nicht protokolliert:', e.message);
  }
}

// ============================================
// MIDDLEWARE
// Muss NACH optionalAuth laufen, damit req.user gesetzt ist.
// Prueft nur - gezaehlt wird spaeter ueber req.limit.verbuchen()
// ============================================
// ============================================
// TESTZUGANG
// ============================================
// Der Pruefkatalog braucht mehr als drei Suchen. Darum ein
// Schluessel, der das Tageslimit ueberspringt.
//
// SICHERHEIT: Wirkt NUR, wenn TEST_TOKEN in der .env steht UND
// NODE_ENV nicht auf production. Auf dem Server ist der Zugang
// damit tot, selbst wenn jemand den Schluessel kennt.
function istTestzugang(req) {
  if (process.env.NODE_ENV === 'production') return false;

  const erwartet = process.env.TEST_TOKEN;
  if (!erwartet || erwartet.length < 8) return false;

  return req.get('x-synora-test') === erwartet;
}

async function tageslimit(req, res, next) {
  if (istTestzugang(req)) {
    req.limit = { verbleibend: 999, limit: 999, verbuchen: async () => ({ verbleibend: 999 }) };
    return next();
  }

  try {
    // ---------- Eingeloggt ----------
    if (req.user) {
      const status = req.user.limitStatus
        ? req.user.limitStatus()
        : { erlaubt: true, verbleibend: LIMIT_ANGEMELDET, limit: LIMIT_ANGEMELDET };

      if (!status.erlaubt) {
        await protokolliereAblehnung({
          grund: req.user.premium ? 'tageslimit_premium' : 'tageslimit_nutzer',
          typ: 'nutzer',
          nutzer: req.user._id,
          anfrage: (req.body && req.body.message) || '',
          limit: status.limit
        });

        return res.status(429).json({
          error: 'tageslimit_erreicht',
          message: req.user.premium
            ? `Du hast heute ${status.limit} Suchen gemacht. Das ist die Grenze der fairen Nutzung. Morgen geht es weiter.`
            : `Du hast deine ${status.limit} Suchen für heute gebraucht. Morgen wieder, oder mit Premium mehr.`,
          limit: status.limit,
          verbleibend: 0,
          zuruecksetzung: naechsterReset(),
          premiumHinweis: !req.user.premium
        });
      }

      req.limit = {
        typ: 'nutzer',
        limit: status.limit,
        verbleibend: status.verbleibend,
        verbuchen: async () => {
          try {
            return await req.user.sucheVerbuchen();
          } catch (e) {
            console.error('[limit] Verbuchen fehlgeschlagen:', e.message);
            return null;
          }
        }
      };

      return next();
    }

    // ---------- Gast ----------
    const { kennung, ipKennung, browserKennung, neuVergeben } = baueKennung(req);

    // Damit das Frontend die Kennung speichern kann
    res.set('X-Synora-Client', browserKennung);
    res.set('Access-Control-Expose-Headers', 'X-Synora-Client');

    if (mongoose.connection.readyState !== 1) {
      // Ohne Datenbank kein Zaehlen - lieber durchlassen als blockieren
      console.warn('[limit] Keine Datenbank, Gast-Limit uebersprungen');
      req.limit = { typ: 'gast', limit: LIMIT_GAST, verbleibend: LIMIT_GAST, verbuchen: async () => null };
      return next();
    }

    const heute = heutigesDatum();

    // Beide Zaehler holen: pro Browser und pro IP
    const [eintrag, ipEintrag] = await Promise.all([
      GastZaehler.findOneAndUpdate(
        { kennung },
        { $setOnInsert: { kennung, datum: heute, suchen_heute: 0 } },
        { upsert: true, new: true }
      ),
      GastZaehler.findOneAndUpdate(
        { kennung: ipKennung },
        { $setOnInsert: { kennung: ipKennung, datum: heute, suchen_heute: 0 } },
        { upsert: true, new: true }
      )
    ]);

    const verbraucht = eintrag.datum === heute ? eintrag.suchen_heute : 0;
    const verbrauchtIp = ipEintrag.datum === heute ? ipEintrag.suchen_heute : 0;

    // Netz zuerst: eine IP, die ueber der Obergrenze liegt, kommt nicht
    // weiter - auch nicht mit frischer Browser-Kennung
    if (verbrauchtIp >= LIMIT_GAST_PRO_IP) {
      await GastZaehler.updateOne(
        { kennung: ipKennung },
        { $inc: { abgelehnt_gesamt: 1 }, $set: { letzteAblehnung: new Date(), zuletztGesehen: new Date() } }
      );

      await protokolliereAblehnung({
        grund: 'tageslimit_ip',
        typ: 'gast',
        kennung: ipKennung,
        anfrage: (req.body && req.body.message) || '',
        limit: LIMIT_GAST_PRO_IP
      });

      return res.status(429).json({
        error: 'registrierung_noetig',
        message: `Aus deinem Netzwerk wurden heute schon ${LIMIT_GAST_PRO_IP} Suchen ohne Konto gemacht. Mit einem kostenlosen Konto suchst du weiter.`,
        limit: LIMIT_GAST_PRO_IP,
        verbleibend: 0,
        zuruecksetzung: naechsterReset(),
        registrierungHinweis: true
      });
    }

    if (verbraucht >= LIMIT_GAST) {
      await GastZaehler.updateOne(
        { kennung },
        { $inc: { abgelehnt_gesamt: 1 }, $set: { letzteAblehnung: new Date(), zuletztGesehen: new Date() } }
      );

      await protokolliereAblehnung({
        grund: 'tageslimit_gast',
        typ: 'gast',
        kennung,
        anfrage: (req.body && req.body.message) || '',
        limit: LIMIT_GAST
      });

      return res.status(429).json({
        error: 'registrierung_noetig',
        message: `Du hast deine ${LIMIT_GAST} kostenlosen Suchen für heute gebraucht. Mit einem kostenlosen Konto bekommst du ${LIMIT_ANGEMELDET} pro Tag.`,
        limit: LIMIT_GAST,
        verbleibend: 0,
        zuruecksetzung: naechsterReset(),
        registrierungHinweis: true
      });
    }

    req.limit = {
      typ: 'gast',
      limit: LIMIT_GAST,
      verbleibend: Math.min(LIMIT_GAST - verbraucht, LIMIT_GAST_PRO_IP - verbrauchtIp),
      neuerBesucher: neuVergeben,
      verbuchen: async () => {
        try {
          const neuesDatum = heutigesDatum();

          const hochzaehlen = (k, alterTag) =>
            GastZaehler.updateOne(
              { kennung: k },
              alterTag !== neuesDatum
                ? { $set: { datum: neuesDatum, suchen_heute: 1, zuletztGesehen: new Date() } }
                : { $inc: { suchen_heute: 1 }, $set: { zuletztGesehen: new Date() } }
            );

          await Promise.all([
            hochzaehlen(kennung, eintrag.datum),
            hochzaehlen(ipKennung, ipEintrag.datum)
          ]);

          const zuruecksetzen = eintrag.datum !== neuesDatum;
          const jetztVerbraucht = zuruecksetzen ? 1 : verbraucht + 1;
          return {
            erlaubt: true,
            verbleibend: Math.max(0, LIMIT_GAST - jetztVerbraucht),
            limit: LIMIT_GAST
          };
        } catch (e) {
          console.error('[limit] Gast-Zaehler nicht gespeichert:', e.message);
          return null;
        }
      }
    };

    next();
  } catch (error) {
    // Ein Fehler im Limit darf die Suche nie blockieren
    console.error('[limit] Fehler:', error.message);
    req.limit = { typ: 'unbekannt', limit: null, verbleibend: null, verbuchen: async () => null };
    next();
  }
}

module.exports = {
  istTestzugang,
  tageslimit,
  LIMIT_GAST,
  LIMIT_GAST_PRO_IP,
  LIMIT_ANGEMELDET,
  LIMIT_PREMIUM,
  heutigesDatum,
  naechsterReset
};