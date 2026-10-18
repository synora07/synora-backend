// ============================================
// SYNORA - Suchgrenzen je Nutzerstufe
// ============================================
// Entschieden am 30.09.2026:
//
//   ohne Konto   1 Suche pro Tag und IP
//   mit Konto    5 Suchen pro Monat
//   Premium     15 Suchen pro Monat   (CHF 7 / Monat, CHF 79 / Jahr)
//
// WARUM GENAU 15 BEI PREMIUM
//
// Von CHF 7 bleiben nach Stripe CHF 6.50. 15 Suchen zur
// Qualitaetsstufe kosten CHF 2.10 - das sind 32 Prozent im
// schlechtesten Fall, wenn jemand seine Grenze jeden Monat voll
// ausschoepft. Beim erwarteten Schnitt von 8 Suchen sind es 17
// Prozent. Verlust beginnt erst bei 46 Suchen; 15 ist nach allen
// Seiten sicher.
//
// Von den uebrigen CHF 4.40 traegt EIN zahlender Nutzer rund 24
// Gratis-Konten mit je 5 Suchen. Daraus folgt die Zahl, auf die es
// ankommt: die Gratis-Stufe traegt sich ab einer Umwandlungsquote
// von 4.1 Prozent selbst.
//
// WAS DIESE DATEI NICHT IST
//
// Sie ist keine Kostenbremse. Sie zaehlt SUCHEN je Nutzer, nicht
// FRANKEN je Tag. Die Franken-Wand steht in kostenbremse.js und
// gilt zusaetzlich - sie schuetzt dich davor, dass viele Nutzer
// innerhalb ihrer Grenzen zusammen dein Budget leeren.
//
// VERTRAG MIT DEM CONTROLLER
//
// chatController.js liest nach einer erfolgreichen Suche:
//
//     req.limit.verbuchen()  ->  { limit, verbleibend }
//     req.limit.typ          ->  "gast" | "konto" | "premium"
//
// Genau das setzt diese Datei. Sie ersetzt die bisherige
// limits.js - sofern die nichts tut, was hier fehlt. Schau einmal
// hinein, bevor du sie loeschst.
//
// EINBAU in server.js, NACH der Anmeldung und VOR der Chat-Route:
//
//     const suchLimit = require('./src/middleware/suchLimit');
//     app.use('/api/chat', suchLimit);
//
// EINSTELLUNGEN (.env)
//
//   SUCHEN_GAST=0             0 heisst: ohne Konto geht gar nichts
//   SUCHEN_KONTO=5
//   SUCHEN_PREMIUM=15
//
// 0 heisst WIRKLICH null Suchen, nicht "Grenze aus". Wer die
// Grenze abschalten will, schreibt "aus" statt einer Zahl. In der
// ersten Fassung galt 0 als "aus" - genau verkehrt herum, und
// damit haette SUCHEN_GAST=0 jedem Gast unbegrenzt viele Suchen
// gegeben statt keiner.
//   GAST_PERIODE=tag          tag | monat
//   KONTO_PERIODE=monat       tag | monat
//   TEST_TOKEN=...            hebt die Grenze auf - NIE in Produktion
// ============================================

'use strict';

// ============================================
// Einstellungen
// ============================================
// Eine leere Zeile in der .env (SUCHEN_KONTO= ohne Wert) darf nicht
// zur Zahl 0 werden - sonst kaeme niemand mehr durch.

function zahl(name, vorgabe, minimum) {
  const roh = process.env[name];
  if (roh === undefined || String(roh).trim() === '') return vorgabe;

  // "aus" oder "unbegrenzt" schaltet die Grenze ab. NICHT die 0 -
  // die bedeutet null Suchen.
  const wort = String(roh).trim().toLowerCase();
  if (wort === 'aus' || wort === 'unbegrenzt' || wort === 'off') return Infinity;

  const wert = Number(roh);
  if (!Number.isFinite(wert) || wert < minimum) {
    console.warn(`[limit] ${name}="${roh}" ist unbrauchbar - es gilt ${vorgabe}`);
    return vorgabe;
  }
  return wert;
}

function periode(name, vorgabe) {
  const roh = String(process.env[name] || '').trim().toLowerCase();
  return roh === 'tag' || roh === 'monat' ? roh : vorgabe;
}

const STUFEN = {
  gast:    { grenze: zahl('SUCHEN_GAST', 0, 0),     periode: periode('GAST_PERIODE', 'tag') },
  konto:   { grenze: zahl('SUCHEN_KONTO', 5, 0),    periode: periode('KONTO_PERIODE', 'monat') },
  premium: { grenze: zahl('SUCHEN_PREMIUM', 15, 0), periode: periode('KONTO_PERIODE', 'monat') }
};

const alsText = (g) => (g === Infinity ? 'unbegrenzt' : g);
console.log(
  `[limit] gast ${alsText(STUFEN.gast.grenze)}/${STUFEN.gast.periode} | ` +
  `konto ${alsText(STUFEN.konto.grenze)}/${STUFEN.konto.periode} | ` +
  `premium ${alsText(STUFEN.premium.grenze)}/${STUFEN.premium.periode}`
);
if (STUFEN.gast.grenze === 0) {
  console.log('[limit] Ohne Konto ist keine Suche moeglich - Registrierung ist Pflicht.');
}

// ============================================
// Zeitraum
// ============================================
// Schweizer Zeit. Sonst springt der Tageszaehler um 01:00 oder
// 02:00 statt um Mitternacht, und der Nutzer bekommt seine Gratis-
// Suche zur falschen Stunde.

const DATUM_CH = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Zurich',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const FORMAT_OK = /^\d{4}-\d{2}-\d{2}$/.test(DATUM_CH.format(new Date()));
if (!FORMAT_OK) {
  console.error('[limit] ACHTUNG: Dieses Node kann kein sv-SE Datum bilden - es wird auf UTC ausgewichen.');
}

function zeitraum(art, jetzt = new Date()) {
  const tag = FORMAT_OK ? DATUM_CH.format(jetzt) : jetzt.toISOString().slice(0, 10);
  return art === 'tag' ? tag : tag.slice(0, 7);
}

// ============================================
// Speicher
// ============================================
// Nutzt die Verbindung, die die App ohnehin schon hat. Diese Datei
// baut KEINE eigene auf.

let Zaehler = null;

function modell() {
  if (Zaehler) return Zaehler;
  let mongoose;
  try {
    mongoose = require('mongoose');
  } catch (_) {
    return null;
  }

  if (mongoose.models.Suchzaehler) {
    Zaehler = mongoose.models.Suchzaehler;
    return Zaehler;
  }

  const schema = new mongoose.Schema({
    _id: String,        // "u:64f1...|2026-10"  oder  "ip:1.2.3.4|2026-10-02"
    stufe: String,
    suchen: { type: Number, default: 0 },
    geaendert: { type: Date, default: Date.now }
  }, { versionKey: false });

  Zaehler = mongoose.model('Suchzaehler', schema);
  return Zaehler;
}

function verbunden() {
  try {
    return require('mongoose').connection.readyState === 1;
  } catch (_) {
    return false;
  }
}

// ============================================
// Wer ist das, und von wo
// ============================================

// ACHTUNG BEI RAILWAY: hinter einem Proxy ist req.ip die Adresse
// des Proxys - fuer ALLE dieselbe. In die server.js gehoert darum:
//
//     app.set('trust proxy', 1);
//
// Ist sie gesetzt, stimmt req.ip. Ist sie es nicht, lesen wir
// x-forwarded-for selbst - und zwar von RECHTS. Der letzte Eintrag
// stammt vom eigenen Proxy; alles davor kann der Besucher selbst
// geschickt haben und frei erfunden sein.
function nutzerIp(req) {
  try {
    if (req.app && typeof req.app.get === 'function' && req.app.get('trust proxy')) {
      if (req.ip) return req.ip;
    }
  } catch (_) { /* kein Express-App-Objekt */ }

  const weiter = req.headers && req.headers['x-forwarded-for'];
  if (typeof weiter === 'string' && weiter.trim()) {
    const teile = weiter.split(',').map((s) => s.trim()).filter(Boolean);
    if (teile.length) return teile.at(-1);
  }

  return req.ip || (req.connection && req.connection.remoteAddress) || null;
}

function istPremium(req) {
  // Premium gibt es noch nicht. Sobald es das gibt, ist das hier
  // die EINE Zeile, die angepasst werden muss.
  return !!(req.user && (req.user.istPremium || req.user.premium || req.user.plan === 'premium'));
}

function stufeVon(req) {
  if (req.user && req.user._id) return istPremium(req) ? 'premium' : 'konto';
  return 'gast';
}

function kennung(req, stufe) {
  if (stufe === 'gast') {
    const ip = nutzerIp(req);
    return ip ? `ip:${ip}` : 'ip:unbekannt';
  }
  return `u:${req.user._id}`;
}

// ============================================
// Testschluessel
// ============================================
// Hebt die Grenze auf, damit der Pruefkatalog 150 Fragen stellen
// kann. In Produktion wirkt er NIEMALS - sonst waere er ein
// oeffentlicher Hauptschluessel.

function istTestlauf(req) {
  if (process.env.NODE_ENV === 'production') return false;
  const token = process.env.TEST_TOKEN;
  if (!token) return false;
  const kopf = req.headers && req.headers['x-synora-test'];
  return typeof kopf === 'string' && kopf.length > 0 && kopf === token;
}

// ============================================
// Die Middleware
// ============================================

async function suchLimit(req, res, next) {
  // ---------- Testlauf ----------
  if (istTestlauf(req)) {
    req.limit = {
      typ: 'test',
      limit: Infinity,
      verbleibend: Infinity,
      verbuchen: async () => ({ limit: Infinity, verbleibend: Infinity })
    };
    return next();
  }

  const stufe = stufeVon(req);
  const { grenze, periode: art } = STUFEN[stufe];

  // Nur "unbegrenzt" hebt die Grenze auf. Eine 0 bedeutet null
  // Suchen und wird weiter unten gesperrt.
  if (grenze === Infinity) {
    req.limit = {
      typ: stufe,
      limit: Infinity,
      verbleibend: Infinity,
      verbuchen: async () => ({ limit: Infinity, verbleibend: Infinity })
    };
    return next();
  }

  // ---------- Grenze 0: gar keine Suche ----------
  // Kein Datenbankzugriff noetig - es gibt nichts zu zaehlen.
  if (grenze === 0) {
    return res.status(200).json({
      response: meldung(stufe, 0, art),
      products: [],
      limitErreicht: true,
      kontoNoetig: stufe === 'gast',
      limit: { typ: stufe, limit: 0, verbleibend: 0 },
      isLoggedIn: !!req.istEingeloggt
    });
  }

  const id = `${kennung(req, stufe)}|${zeitraum(art)}`;
  const M = modell();

  // ---------- Datenbank weg ----------
  // Hier wird NICHT blockiert. Die Franken-Wand in kostenbremse.js
  // faengt diesen Fall ab - die gibt bei unbekanntem Stand gar
  // nichts frei. Zwei Waende, die beide bei einem Datenbankfehler
  // zuschlagen, waeren eine zu viel.
  if (!M || !verbunden()) {
    console.warn('[limit] Datenbank nicht erreichbar - Suchgrenze wird nicht gezaehlt');
    req.limit = {
      typ: stufe,
      limit: grenze,
      verbleibend: grenze,
      verbuchen: async () => ({ limit: grenze, verbleibend: grenze })
    };
    return next();
  }

  let bisher = 0;
  try {
    const d = await M.findById(id).lean();
    bisher = d && Number.isFinite(d.suchen) ? d.suchen : 0;
  } catch (e) {
    console.error('[limit] Lesen fehlgeschlagen:', e.message);
  }

  // ---------- Grenze erreicht ----------
  if (bisher >= grenze) {
    const antwort = {
      response: meldung(stufe, grenze, art),
      products: [],
      limitErreicht: true,
      limit: { typ: stufe, limit: grenze, verbleibend: 0 },
      isLoggedIn: !!req.istEingeloggt
    };
    return res.status(200).json(antwort);
  }

  // ---------- Durch ----------
  req.limit = {
    typ: stufe,
    limit: grenze,
    verbleibend: grenze - bisher,

    // Wird vom Controller erst NACH einer erfolgreichen Suche
    // gerufen. Eine Rueckfrage, ein Treffer aus dem Cache ohne
    // Suche oder ein Fehler kosten den Nutzer nichts.
    //
    // Gezaehlt wird mit $inc, also atomar. Kommen zwei Anfragen
    // gleichzeitig durch, zaehlt die zweite trotzdem mit, und die
    // naechste wird gesperrt.
    verbuchen: async () => {
      try {
        const d = await M.findByIdAndUpdate(
          id,
          { $inc: { suchen: 1 }, $set: { geaendert: new Date() }, $setOnInsert: { stufe } },
          { upsert: true, new: true }
        ).lean();
        const jetzt = d && Number.isFinite(d.suchen) ? d.suchen : bisher + 1;
        return { limit: grenze, verbleibend: Math.max(0, grenze - jetzt) };
      } catch (e) {
        console.error('[limit] Zaehlen fehlgeschlagen:', e.message);
        return { limit: grenze, verbleibend: Math.max(0, grenze - bisher - 1) };
      }
    }
  };

  return next();
}

// ============================================
// Was der Nutzer liest
// ============================================
// Echte Umlaute - der Pruefkatalog schlaegt bei "fuer" Alarm, und
// zu Recht: das sieht nach kaputter Software aus.

function meldung(stufe, grenze, art) {
  const wann = art === 'tag' ? 'heute' : 'diesen Monat';

  if (stufe === 'gast') {
    if (grenze === 0) {
      return 'Für SYNORA brauchst du ein kostenloses Konto. Damit bekommst du 5 Suchen im Monat – ohne Zahlungsdaten.';
    }
    return grenze === 1
      ? 'Du hast deine kostenlose Suche für heute gebraucht. Mit einem kostenlosen Konto bekommst du 5 Suchen im Monat.'
      : `Du hast deine ${grenze} kostenlosen Suchen für heute gebraucht. Mit einem kostenlosen Konto bekommst du mehr.`;
  }

  if (stufe === 'konto') {
    return `Du hast deine ${grenze} Suchen ${wann} gebraucht. Mit Premium sind es 15 im Monat, für CHF 7.`;
  }

  return `Du hast deine ${grenze} Suchen ${wann} gebraucht. Ab dem 1. des nächsten Monats geht es weiter.`;
}

// ============================================
// Stand abfragen, ohne zu zaehlen
// ============================================
// Fuer GET /api/chat/guest-status: das Frontend will wissen, wie
// viele Suchen noch offen sind, ohne eine zu verbrauchen.
//
// WICHTIG: Diese Zahlen kommen aus DERSELBEN Quelle wie die Sperre.
// Die alte limitStatus()-Methode am Nutzer liest ein anderes Feld
// und wuerde etwas anderes melden als das, was wirklich gilt.

async function stand(req) {
  const stufe = stufeVon(req);
  const { grenze, periode: art } = STUFEN[stufe];

  if (grenze === Infinity) return { typ: stufe, limit: null, verbleibend: null };
  if (grenze === 0) return { typ: stufe, limit: 0, verbleibend: 0 };

  const M = modell();
  if (!M || !verbunden()) return { typ: stufe, limit: grenze, verbleibend: grenze };

  const id = `${kennung(req, stufe)}|${zeitraum(art)}`;
  try {
    const d = await M.findById(id).lean();
    const bisher = d && Number.isFinite(d.suchen) ? d.suchen : 0;
    return { typ: stufe, limit: grenze, verbleibend: Math.max(0, grenze - bisher) };
  } catch (_) {
    return { typ: stufe, limit: grenze, verbleibend: grenze };
  }
}

module.exports = suchLimit;

// Auch als benannte Felder, falls deine server.js die alte
// limits.js anders eingebunden hat (z.B. { limitPruefen }).
module.exports.suchLimit = suchLimit;
module.exports.limitPruefen = suchLimit;
module.exports.stand = stand;
module.exports.meldung = meldung;
module.exports.STUFEN = STUFEN;