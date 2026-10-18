// ============================================
// SYNORA - Preisalarm (Pruefer)
// ============================================
// HIER STECKT DIE BUENDELUNG.
//
// Faellige Alarme werden nach produktId gruppiert. Beobachten 500
// Menschen dasselbe Handy, ist das EINE SerpAPI-Abfrage, nicht 500.
// Danach bekommen alle 500 ihre Nachricht aus demselben Ergebnis.
//
// Ohne diese Gruppierung kostet ein Premium-Nutzer mit zehn
// taeglichen Alarmen CHF 7.50 im Monat - bei CHF 6.50 Einnahme.
// Mit ihr wird der Preisalarm BILLIGER, je mehr Leute ihn nutzen.
//
// DIE KOSTENBREMSE GILT AUCH HIER
//
// Jede Produktpruefung fragt vorher bei kostenbremse.darfSuchen()
// nach und wird dort gebucht. Ist der Monatsdeckel erreicht, hoert
// der Pruefer auf - er kann dein Budget nicht an dir vorbei leeren.
// Das ist wichtig, weil dieser Lauf im Hintergrund stattfindet und
// niemand zuschaut.
//
// AUFRUF (ein Mal pro Woche, z.B. Montag frueh):
//
//   node scripts/preisalarmPruefen.js
//
// oder aus dem Code:
//
//   const alarm = require('./services/preisAlarm');
//   await alarm.pruefeAlle();
// ============================================

'use strict';

const PreisAlarm = require('../models/PreisAlarm');
const PushAbo = require('../models/PushAbo');
const benachrichtigung = require('./benachrichtigung');
const kostenbremse = require('./kostenbremse');

// ============================================
// DER KAUFWEG - behoben am 10.10.2026
// ============================================
// Die Alarmmail verlinkte direkt zum Shop. Fuer den Nutzer sah
// das richtig aus, fuer dich war es ein Verlustgeschaeft:
//
//   - KEINE PROVISION. Der Haendler sieht einen Besucher, der
//     von irgendwo kommt. Nicht von SYNORA. Also zahlt er nichts.
//   - KEINE ZAEHLUNG. Du weisst nicht, ob ueberhaupt jemand auf
//     deine Alarmmails klickt.
//
// Die Suche macht es laengst richtig: Sie speichert das Klickziel
// und schickt den Nutzer ueber /api/go/<kurzId>. Dort wird der
// Klick gezaehlt und der Affiliate-Link aufgebaut.
//
// Die Alarmmail nimmt jetzt denselben Weg. Der Code dafuer ist
// bewusst dem aus chatController.js nachgebaut - zwei Wege, die
// dasselbe tun sollen, aber unterschiedlich aussehen, laufen
// irgendwann auseinander.
const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

const TAKT_TAGE = Number(process.env.PREISALARM_TAKT_TAGE) || 7;
const MAX_PRODUKTE_PRO_LAUF = Number(process.env.PREISALARM_MAX_PRODUKTE) || 500;

// ============================================
// Wie viele Alarme je Stufe
// ============================================
// Der Preisalarm ist laut Plan (Abschnitt 2.2) die
// Premium-Kernfunktion. Darum bekommt ein Gratis-Konto nur einen -
// genug, um zu sehen, wie es sich anfuehlt, wenn die Mail kommt.
//
// Die Rechnung dahinter:
//
//   Gratis-Konto   5 Suchen = CHF 0.18 im Monat, Einnahme CHF 0
//                  1 Alarm  = CHF 0.09 im Monat  -> vertretbar
//                 10 Alarme = CHF 0.60 im Monat  -> das Dreifache
//                             dessen, was der Nutzer ohnehin kostet
//
//   Premium        10 Alarme = CHF 0.60, bei CHF 6.50 Einnahme
//
// Eine Zeile in der .env aendert das, falls du es anders willst.
const ALARME_GRATIS = zahl('PREISALARM_MAX_GRATIS', 1);
const ALARME_PREMIUM = zahl('PREISALARM_MAX_PREMIUM', 10);

function zahl(name, vorgabe) {
  const roh = process.env[name];
  if (roh === undefined || String(roh).trim() === '') return vorgabe;
  const wert = Number(roh);
  return Number.isFinite(wert) && wert >= 0 ? wert : vorgabe;
}

function maxAlarme(istPremium) {
  return istPremium ? ALARME_PREMIUM : ALARME_GRATIS;
}

// ============================================
// Alarm anlegen, abfragen, loeschen
// ============================================

async function anlegen({ nutzerId, istPremium = false, produkt, zielPreis = null, kanaele = ['email'] }) {
  if (!nutzerId) return { ok: false, grund: 'nicht angemeldet' };
  if (!produkt || !produkt.name) return { ok: false, grund: 'Produkt fehlt' };

  const preis = Number(produkt.priceValue);
  if (!Number.isFinite(preis) || preis <= 0) {
    // Ohne lesbaren Preis gibt es nichts zu beobachten. Das ist
    // dieselbe Regel wie bei der Budgetwand: lieber gar nicht als
    // auf gut Glueck.
    return { ok: false, grund: 'Preis nicht lesbar' };
  }

  const grenze = maxAlarme(istPremium);

  if (grenze === 0) {
    return { ok: false, grund: 'Preisalarme gibt es mit Premium.', premiumNoetig: true };
  }

  const wieViele = await PreisAlarm.countDocuments({ nutzer: nutzerId, aktiv: true });

  // Ein bestehender Alarm auf dasselbe Produkt wird nur
  // aufgefrischt und zaehlt darum nicht als neuer.
  const produktIdPruef = produkt.produktId || produkt.googleProduktId || produkt.id || produkt.name;
  const schonDa = await PreisAlarm.countDocuments({ nutzer: nutzerId, produktId: produktIdPruef });

  if (!schonDa && wieViele >= grenze) {
    return istPremium
      ? { ok: false, grund: `Mehr als ${grenze} Preisalarme gehen nicht.` }
      : {
          ok: false,
          premiumNoetig: true,
          grund: grenze === 1
            ? `Mit einem Gratis-Konto geht ein Preisalarm. Mit Premium sind es ${ALARME_PREMIUM}, für CHF 7 im Monat.`
            : `Mit einem Gratis-Konto gehen ${grenze} Preisalarme. Mit Premium sind es ${ALARME_PREMIUM}.`
        };
  }

  // produktId ist der Schluessel, nach dem gebuendelt wird.
  const produktId = produkt.produktId || produkt.googleProduktId || produkt.id || produkt.name;

  try {
    const alarm = await PreisAlarm.findOneAndUpdate(
      { nutzer: nutzerId, produktId },
      {
        $set: {
          produktName: produkt.name,
          suchbegriff: produkt.suchbegriff || produkt.name,
          bildUrl: produkt.imageUrl || produkt.bildUrl || '',
          zielPreis: Number.isFinite(Number(zielPreis)) && Number(zielPreis) > 0 ? Number(zielPreis) : null,
          kanaele: kanaele.filter((k) => ['email', 'push'].includes(k)),
          aktiv: true
        },
        $setOnInsert: { startPreis: preis, erstellt: new Date() }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return { ok: true, alarm };
  } catch (e) {
    return { ok: false, grund: e.message };
  }
}

async function liste(nutzerId) {
  return PreisAlarm.find({ nutzer: nutzerId, aktiv: true }).sort({ erstellt: -1 }).lean();
}

async function loeschen(nutzerId, alarmId) {
  const r = await PreisAlarm.deleteOne({ _id: alarmId, nutzer: nutzerId });
  return { ok: r.deletedCount > 0 };
}

// ============================================
// DER PRUEFLAUF
// ============================================

/**
 * suchen: wird nur fuer Tests von aussen gesetzt. Sonst gilt
 *         serpApiService.searchProducts.
 */
async function pruefeAlle({ suchen = null, jetzt = new Date() } = {}) {
  const sucheFn = suchen || (await standardSuche());
  if (!sucheFn) {
    return { fehler: 'keine Suchfunktion verfuegbar' };
  }

  const grenze = new Date(jetzt.getTime() - TAKT_TAGE * 86400000);

  const faellig = await PreisAlarm.find({
    aktiv: true,
    $or: [{ zuletztGeprueft: null }, { zuletztGeprueft: { $lt: grenze } }]
  })
    .populate('nutzer', 'email premium')
    .lean(false);

  if (!faellig.length) {
    console.log('[preisalarm] nichts faellig');
    return { produkte: 0, alarme: 0, gemeldet: 0 };
  }

  // ---------- Buendeln ----------
  const nachProdukt = new Map();
  for (const a of faellig) {
    if (!nachProdukt.has(a.produktId)) nachProdukt.set(a.produktId, []);
    nachProdukt.get(a.produktId).push(a);
  }

  const produkte = [...nachProdukt.entries()].slice(0, MAX_PRODUKTE_PRO_LAUF);

  console.log(
    `[preisalarm] ${faellig.length} Alarme, ${nachProdukt.size} verschiedene Produkte` +
    ` -> ${produkte.length} Abfragen`
  );

  let gemeldet = 0;
  let geprueft = 0;
  let gestoppt = null;

  for (const [produktId, alarme] of produkte) {
    // ---------- Kostenbremse ----------
    // Auch ein Hintergrundlauf darf das Budget nicht leeren.
    const darf = await kostenbremse.darfSuchen({ istPremium: true, istGast: false, ip: null });
    if (!darf.erlaubt) {
      gestoppt = darf.grund;
      console.warn(`[preisalarm] gestoppt durch Kostenbremse (${darf.grund}) nach ${geprueft} Abfragen`);
      break;
    }

    const vorbild = alarme[0];
    let ergebnis = null;
    try {
      ergebnis = await sucheFn(vorbild.suchbegriff || vorbild.produktName, { land: 'CH', anzahl: 20 });
    } catch (e) {
      console.error(`[preisalarm] Suche fehlgeschlagen fuer "${vorbild.produktName}": ${e.message}`);
    }
    geprueft += 1;

    const treffer = bestesAngebot(ergebnis, produktId, vorbild.produktName);

    for (const a of alarme) {
      a.zuletztGeprueft = jetzt;

      if (treffer) {
        a.letzterPreis = treffer.preis;
        a.letzterShop = treffer.shop || '';

        if (a.istTreffer(treffer.preis) && a.darfMelden(treffer.preis, jetzt)) {
          const ok = await melden(a, treffer);
          if (ok) {
            a.zuletztGemeldet = jetzt;
            a.wieOftGemeldet = (a.wieOftGemeldet || 0) + 1;
            gemeldet += 1;
          }
        }
      }

      try { await a.save(); } catch (e) { console.error('[preisalarm] speichern:', e.message); }
    }
  }

  const bericht = {
    produkte: geprueft,
    alarme: faellig.length,
    gemeldet,
    gespart: faellig.length - geprueft,
    gestoppt
  };

  console.log(
    `[preisalarm] fertig: ${geprueft} Abfragen fuer ${faellig.length} Alarme ` +
    `(${bericht.gespart} durch Buendelung gespart), ${gemeldet} Meldungen`
  );

  return bericht;
}

// ============================================
// Hilfen
// ============================================

async function standardSuche() {
  try {
    const serpApi = require('./serpApiService');
    return (begriff, opt) => serpApi.searchProducts(begriff, opt);
  } catch (e) {
    console.error('[preisalarm] serpApiService nicht gefunden:', e.message);
    return null;
  }
}

/**
 * Das guenstigste Angebot zu diesem Produkt aus dem Suchergebnis.
 * Zuerst ueber die produktId - das ist eindeutig. Findet sich
 * nichts, wird ueber den Namen verglichen; dabei wird lieber nichts
 * gemeldet als das falsche Produkt.
 */
function bestesAngebot(ergebnis, produktId, produktName) {
  const liste = ergebnis && Array.isArray(ergebnis.produkte) ? ergebnis.produkte : [];
  if (!liste.length) return null;

  const preisVon = (p) => {
    const w = Number(p.priceValue);
    return Number.isFinite(w) && w > 0 ? w : null;
  };

  let passend = liste.filter(
    (p) => p.produktId === produktId || p.product_id === produktId || p.id === produktId
  );

  if (!passend.length) {
    const gesucht = String(produktName).toLowerCase().replace(/\s+/g, ' ').trim();
    passend = liste.filter((p) => {
      const name = String(p.name || '').toLowerCase();
      return name === gesucht || (gesucht.length > 10 && name.includes(gesucht));
    });
  }

  if (!passend.length) return null;

  let bestes = null;
  for (const p of passend) {
    const preis = preisVon(p);
    if (preis === null) continue;
    if (!bestes || preis < bestes.preis) {
      // ---------- GEAENDERT am 04.10.2026 ----------
      // Hier stand nur:
      //     shop: p.shopName || '',  link: p.shopUrl || ''
      //
      // shopName und shopUrl heissen die Felder im CONTROLLER,
      // also in dem, was das Frontend bekommt. Der Preisalarm
      // bekommt aber die Rohform von serpApiService - und dort
      // heissen dieselben Dinge source und link.
      //
      // Folge: shop und link waren bei JEDER Alarmmail leer. Der
      // Nutzer las "Sony kostet jetzt CHF 263.96" und erfuhr weder,
      // bei wem, noch wie er hinkommt. alarmText() laesst die
      // Zeile "Zum Angebot: ..." ganz weg, wenn kein Link da ist.
      //
      // Damit war die Premium-Kernfunktion ohne Kaufweg - und ohne
      // Kaufweg gibt es auch keine Affiliate-Einnahme.
      //
      // Jetzt werden beide Formen angenommen.
      bestes = {
        preis,
        shop: p.shopName || p.source || p.shop || '',
        link: p.shopUrl || p.link || p.productLink || '',

        // ---------- NEU am 10.10.2026 ----------
        // Dieses Token kommt von SerpAPI mit und ist der
        // Schluessel zum Affiliate-Link. Es lag hier immer
        // vor und wurde immer weggeworfen - darum ging jede
        // Alarmmail am Kaufweg vorbei.
        token: p.immersive_product_page_token || null,
        googleProduktId: p.product_id || p.produktId || p.id || null
      };
    }
  }
  return bestes;
}

// ============================================
// KLICKZIEL SPEICHERN UND KURZLINK BAUEN
// ============================================
// Nachgebaut aus baueKlickLinks() in chatController.js. Gibt
// die Adresse zurueck, die in die Mail gehoert.
//
// WENN ETWAS SCHIEFGEHT, GIBT ES DEN DIREKTEN LINK ZURUECK.
// Lieber ein Link ohne Provision als eine Mail ohne Kaufweg -
// der Nutzer soll zum Angebot kommen, auch wenn wir daran
// nichts verdienen.
//
// ABER: Das wird dann LAUT ins Log geschrieben. Ein stiller
// Rueckfall waere das Schlimmste - alles saehe aus wie vorher,
// du haeltst es fuer repariert, und es kommt trotzdem kein Geld
// an. Taucht "[preisalarm] KEIN KURZLINK" im Log auf, stimmt
// etwas nicht.
async function kaufweg(alarm, treffer) {
  // Ohne Token kann /api/go den Haendler nicht nachschlagen.
  // Das ist kein Fehler: Nicht jedes Angebot bei SerpAPI hat
  // eines. Dann bleibt der direkte Link, wie in der Suche auch.
  if (!treffer.token) {
    console.warn(
      `[preisalarm] KEIN KURZLINK fuer "${alarm.produktName}": ` +
      'das Angebot hat kein Google-Token. Der Link geht direkt ' +
      'zum Shop - ohne Provision.'
    );
    return treffer.link;
  }

  try {
    const ProduktKlick = require('../models/ProduktKlick');
    const kurzId = ProduktKlick.neueKurzId();

    await ProduktKlick.create({
      kurzId,
      token: treffer.token,
      googleProduktId: treffer.googleProduktId || alarm.produktId || null,
      produktName: alarm.produktName,
      angezeigterPreis: `CHF ${treffer.preis}`,
      angezeigterPreisWert: treffer.preis,
      angezeigterShop: treffer.shop || '',

      // Diese vier gehoeren zur Suche, nicht zum Alarm. In
      // chatController.js werden sie ebenfalls mit null belegt,
      // wenn sie fehlen - das Modell nimmt das also an.
      sucheId: null,
      suchanfrage: alarm.suchbegriff || '',
      budget: null,
      rang: 1,

      nutzer: nutzerId(alarm)
    });

    return `${API_BASE}/api/go/${kurzId}`;
  } catch (e) {
    console.error(
      `[preisalarm] KEIN KURZLINK fuer "${alarm.produktName}": ${e.message}\n` +
      '            Die Mail geht raus, aber ohne Provision. ' +
      'Pruef das Modell src/models/ProduktKlick.js.'
    );
    return treffer.link;
  }
}

// Der Nutzer steckt je nach Aufruf als Objekt oder als ID drin.
function nutzerId(alarm) {
  const n = alarm.nutzer;
  if (!n) return null;
  return n._id || n.id || n;
}

async function melden(alarm, treffer) {
  const nutzer = alarm.nutzer;
  if (!nutzer) return false;

  // Erst den Kaufweg bauen, dann die Mail. Andersherum stuende
  // in der Mail schon der direkte Link.
  const link = await kaufweg(alarm, treffer);

  // ============================================
  // WAS IN DIE MAIL GEHOERT - behoben am 04.10.2026
  // ============================================
  // bildUrl und zielPreis stehen seit Anfang an im Modell, wurden
  // hier aber nie weitergegeben. Die Mail hatte dadurch kein Bild,
  // obwohl das Bild in der Datenbank lag.
  //
  // Dazu: mailSenden() nimmt html entgegen, bekam es aber nie. Es
  // ging immer nur Nurtext raus. Jetzt gehen beide Fassungen mit -
  // HTML fuer die Darstellung, Nurtext fuer Postfaecher, die HTML
  // abgeschaltet haben, und fuer die Spamfilter.
  const inhalt = benachrichtigung.alarmText({
    produktName: alarm.produktName,
    alt: alarm.startPreis,
    neu: treffer.preis,
    shop: treffer.shop,
    link,
    bildUrl: alarm.bildUrl,
    zielPreis: alarm.zielPreis
  });

  // Ohne lesbaren Preis verschickt alarmText() nichts. Dann hier
  // auch nicht - sonst ginge eine Mail ohne Betreff und ohne
  // Inhalt raus, und zuletztGemeldet wuerde gesetzt, als waere
  // der Nutzer informiert worden.
  if (!inhalt.ok) {
    console.warn(`[preisalarm] "${alarm.produktName}" nicht gemeldet: ${inhalt.grund}`);
    return false;
  }

  const { betreff, text, html } = inhalt;

  let erfolg = false;

  if (alarm.kanaele.includes('email') && nutzer.email) {
    const r = await benachrichtigung.mailSenden({ an: nutzer.email, betreff, text, html });
    if (r.ok) erfolg = true;
  }

  if (alarm.kanaele.includes('push')) {
    let abos = [];
    try {
      abos = await PushAbo.find({ nutzer: nutzer._id }).lean();
    } catch (e) {
      console.error('[preisalarm] Push-Abos nicht gelesen:', e.message);
    }

    for (const eintrag of abos) {
      const r = await benachrichtigung.pushSenden({
        abo: { endpoint: eintrag.endpoint, keys: eintrag.keys },
        titel: betreff,
        text: `Jetzt ${benachrichtigung.franken(treffer.preis)}` + (treffer.shop ? ` bei ${treffer.shop}` : ''),
        url: treffer.link || 'https://synora.li'
      });

      if (r.ok && r.versendet) {
        erfolg = true;
        try {
          await PushAbo.updateOne(
            { _id: eintrag._id },
            { $set: { zuletztBenutzt: new Date(), fehlschlaege: 0 } }
          );
        } catch (_) { /* nicht wichtig genug zum Abbrechen */ }
        continue;
      }

      // Ein totes Abo soll nicht ewig weiter angefunkt werden.
      // Sagt der Push-Dienst "gibt es nicht mehr", sofort weg;
      // sonst erst nach dem dritten Fehlschlag.
      try {
        if (r.abgelaufen) {
          await PushAbo.deleteOne({ _id: eintrag._id });
          console.log('[push] abgelaufenes Abo entfernt');
        } else {
          const nach = await PushAbo.findByIdAndUpdate(
            eintrag._id, { $inc: { fehlschlaege: 1 } }, { new: true }
          ).lean();
          if (nach && nach.fehlschlaege >= 3) {
            await PushAbo.deleteOne({ _id: eintrag._id });
            console.log('[push] Abo nach 3 Fehlschlaegen entfernt');
          }
        }
      } catch (_) { /* nicht wichtig genug zum Abbrechen */ }
    }
  }

  return erfolg;
}

module.exports = {
  anlegen,
  liste,
  loeschen,
  pruefeAlle,
  bestesAngebot,
  TAKT_TAGE,
  maxAlarme,
  ALARME_GRATIS,
  ALARME_PREMIUM
};