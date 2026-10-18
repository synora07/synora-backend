// ============================================
// SYNORA - Dashboard
// ============================================
// EINBAU: eine Zeile in src/server.js, zu den anderen ladeRoute:
//
//     ladeRoute('dashboard', '/api/dashboard');
//
// AUFRUF:
//
//   http://localhost:5000/api/dashboard?token=DEIN_ANALYTICS_TOKEN
//
// Oder mit Kopfzeile:  x-synora-analytics: DEIN_ANALYTICS_TOKEN
//
// Im Browser bekommst du eine Seite zum Anschauen, mit
// ?format=json die Zahlen als JSON.
//
// ============================================
// WAS DAS DASHBOARD EHRLICH KANN UND WAS NICHT
// ============================================
// Die Sammlungen, die ich selbst gebaut habe (Kosten, Suchgrenzen,
// Preisalarme), lese ich genau - ich kenne jedes Feld.
//
// Deine aelteren Sammlungen (Analytics, Suchprotokoll,
// Produktklick, Shops, Preisverlauf) kenne ich nicht im Detail.
// Davon zeige ich nur, WIE VIELE Eintraege es gibt und wann der
// letzte kam. Lieber eine ehrliche Zahl als eine ausgedachte
// Auswertung, die an deinen Feldern vorbeigeht.
//
// Schick mir eines dieser Modelle, und ich werte es richtig aus.
//
// SICHERHEIT: Diese Seite zeigt Geschaeftszahlen. Ohne gueltigen
// ANALYTICS_TOKEN kommt niemand hinein. Fehlt der Token in der
// .env, ist die Route in Produktion KOMPLETT gesperrt - nicht
// offen. Eine vergessene Einstellung darf keine Tuer sein.
// ============================================

'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const kostenbremse = require('../services/kostenbremse');
const suchLimit = require('../middleware/suchLimit');

const TOKEN = process.env.ANALYTICS_TOKEN || '';
const IST_PRODUKTION = process.env.NODE_ENV === 'production';

// ============================================
// Tuersteher
// ============================================

function pruefeToken(req, res, next) {
  if (!TOKEN) {
    if (IST_PRODUKTION) {
      // Kein Token gesetzt und Produktion: zu. Nicht offen.
      return res.status(404).json({ error: 'Nicht gefunden' });
    }
    console.warn('[dashboard] ANALYTICS_TOKEN fehlt - lokal offen, in Produktion gesperrt');
    return next();
  }

  const gegeben = req.headers['x-synora-analytics'] || req.query.token || '';
  if (typeof gegeben === 'string' && gegeben.length > 0 && gegeben === TOKEN) return next();

  // 404 statt 401: wer den Token nicht hat, soll nicht einmal
  // erfahren, dass es diese Seite gibt.
  return res.status(404).json({ error: 'Nicht gefunden' });
}

// ============================================
// Zeitraeume, Schweizer Zeit
// ============================================

const DATUM_CH = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit'
});

function tagSchluessel(d = new Date()) {
  const s = DATUM_CH.format(d);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : d.toISOString().slice(0, 10);
}

function letzteTage(anzahl) {
  const tage = [];
  for (let i = anzahl - 1; i >= 0; i--) {
    tage.push(tagSchluessel(new Date(Date.now() - i * 86400000)));
  }
  return tage;
}

// ============================================
// Lesen
// ============================================

function db() {
  return mongoose.connection.readyState === 1 ? mongoose.connection.db : null;
}

async function zaehle(name) {
  const d = db();
  if (!d) return null;
  try {
    return await d.collection(name).countDocuments();
  } catch (_) {
    return null;
  }
}

async function kosten() {
  const d = db();
  if (!d) return null;

  const heute = tagSchluessel();
  const monat = heute.slice(0, 7);
  const tage = letzteTage(7);

  try {
    const s = d.collection('kostenzaehlers');
    const [tagDoc, monatDoc, verlauf] = await Promise.all([
      s.findOne({ _id: heute }),
      s.findOne({ _id: monat }),
      s.find({ _id: { $in: tage } }).toArray()
    ]);

    const nachTag = new Map(verlauf.map((v) => [v._id, v]));

    return {
      heute: {
        chf: tagDoc ? tagDoc.chf : 0,
        grenze: kostenbremse.GRENZEN.tag,
        suchen: tagDoc ? tagDoc.suchen : 0,
        guenstig: tagDoc ? tagDoc.guenstig || 0 : 0,
        qualitaet: tagDoc ? tagDoc.qualitaet || 0 : 0
      },
      monat: {
        chf: monatDoc ? monatDoc.chf : 0,
        grenze: kostenbremse.GRENZEN.monat,
        suchen: monatDoc ? monatDoc.suchen : 0
      },
      verlauf: tage.map((t) => ({
        tag: t,
        chf: nachTag.has(t) ? nachTag.get(t).chf : 0,
        suchen: nachTag.has(t) ? nachTag.get(t).suchen : 0
      }))
    };
  } catch (e) {
    console.error('[dashboard] Kosten nicht lesbar:', e.message);
    return null;
  }
}

async function nutzung() {
  const d = db();
  if (!d) return null;

  const monat = tagSchluessel().slice(0, 7);

  try {
    const s = d.collection('suchzaehlers');

    // Alle Zaehler dieses Monats. Der Schluessel endet auf den
    // Zeitraum, darum reicht ein Praefix-Vergleich.
    const eintraege = await s.find({ _id: { $regex: `\\|${monat}` } }).toArray();

    const nachStufe = { gast: { konten: 0, suchen: 0 }, konto: { konten: 0, suchen: 0 }, premium: { konten: 0, suchen: 0 } };
    for (const e of eintraege) {
      const stufe = e.stufe && nachStufe[e.stufe] ? e.stufe : 'konto';
      nachStufe[stufe].konten += 1;
      nachStufe[stufe].suchen += e.suchen || 0;
    }

    const schnitt = (x) => (x.konten ? Math.round((x.suchen / x.konten) * 10) / 10 : 0);

    return {
      monat,
      gast: { ...nachStufe.gast, schnitt: schnitt(nachStufe.gast), grenze: suchLimit.STUFEN.gast.grenze },
      konto: { ...nachStufe.konto, schnitt: schnitt(nachStufe.konto), grenze: suchLimit.STUFEN.konto.grenze },
      premium: { ...nachStufe.premium, schnitt: schnitt(nachStufe.premium), grenze: suchLimit.STUFEN.premium.grenze }
    };
  } catch (e) {
    console.error('[dashboard] Nutzung nicht lesbar:', e.message);
    return null;
  }
}

async function alarme() {
  const d = db();
  if (!d) return null;
  try {
    const s = d.collection('preisalarms');
    const [gesamt, aktiv, produkte, gemeldet] = await Promise.all([
      s.countDocuments(),
      s.countDocuments({ aktiv: true }),
      s.distinct('produktId', { aktiv: true }),
      s.countDocuments({ zuletztGemeldet: { $ne: null } })
    ]);

    const einsparung = aktiv && produkte.length ? Math.round((1 - produkte.length / aktiv) * 100) : 0;

    return {
      gesamt,
      aktiv,
      verschiedeneProdukte: produkte.length,
      abfragenJeLauf: produkte.length,
      gespartProzent: einsparung,
      schonGemeldet: gemeldet
    };
  } catch (e) {
    return null;
  }
}

// ============================================
// ROUTE
// ============================================

router.get('/', pruefeToken, async (req, res) => {
  const verbunden = mongoose.connection.readyState === 1;

  const [k, n, a, zahlen] = await Promise.all([
    kosten(),
    nutzung(),
    alarme(),
    (async () => ({
      nutzer: await zaehle('users'),
      pushAnmeldungen: await zaehle('pushabos'),
      // Deine aelteren Sammlungen: nur die Anzahl, siehe Kopf.
      analytics: await zaehle('analytics'),
      suchprotokolle: await zaehle('suchprotokolls'),
      produktklicks: await zaehle('produktklicks'),
      abgelehnteSuchen: await zaehle('abgelehntesuches'),
      produktwissen: await zaehle('produktwissens'),
      shops: await zaehle('shopeintrags'),
      preisverlaeufe: await zaehle('preisverlaufs'),
      suchcache: await zaehle('suchcaches'),
      // Aufnahmen sind KEIN Cache - sie laufen nicht ab. Steht hier 0
      // und ABSPIELEN ist an, findet jede Suche nichts.
      aufnahmen: await zaehle('aufnahmes'),
      fehler: await zaehle('fehlerlogs')
    }))()
  ]);

  const daten = {
    stand: new Date().toISOString(),
    umgebung: process.env.NODE_ENV || 'development',
    datenbank: verbunden ? 'verbunden' : 'getrennt',
    abspielModus: process.env.ABSPIELEN === '1',
    kosten: k,
    nutzung: n,
    preisalarme: a,
    zahlen,
    hinweis: 'Analytics, Suchprotokolle, Produktklicks, Shops und Preisverlaeufe werden nur gezaehlt, nicht ausgewertet - die Modelle dazu kenne ich nicht.'
  };

  if (req.query.format === 'json') return res.json(daten);
  res.type('html').send(alsSeite(daten));
});

// ============================================
// Eine schlichte Seite zum Anschauen
// ============================================

function balken(wert, grenze) {
  if (!grenze) return 0;
  return Math.min(100, Math.round((wert / grenze) * 100));
}

function franken(x) {
  return 'CHF ' + Number(x || 0).toFixed(2);
}

function sicher(text) {
  return String(text).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function alsSeite(d) {
  const k = d.kosten;
  const n = d.nutzung;
  const a = d.preisalarme;

  // Abspielen ohne Aufnahmen ist die stillste Falle im ganzen System:
  // es kostet nichts, es stuerzt nicht ab, es liefert nur nie etwas.
  // Darum wird hier unterschieden statt pauschal gewarnt.
  const aufnahmen = d.zahlen ? d.zahlen.aufnahmen : null;
  let warnung = '';
  if (d.abspielModus && !aufnahmen) {
    warnung = '<p class="warn"><strong>ABSPIELEN ist an, aber es gibt keine Aufnahmen.</strong> '
      + 'Jede Suche liefert leer &ndash; f&uuml;r dich beim Pr&uuml;fen und f&uuml;r jeden Besucher. '
      + 'Es kostet nichts und bringt nichts. Aufnehmen mit <code>AUFNEHMEN=1</code>, '
      + 'pr&uuml;fen mit <code>node scripts/aufnahmeZeigen.js</code>.</p>';
  } else if (d.abspielModus) {
    warnung = `<p class="warn">ABSPIELEN ist eingeschaltet: Produkte kommen aus ${aufnahmen} `
      + 'gespeicherten Aufnahmen, nicht von SerpAPI. Es werden keine Abfragen bezahlt &ndash; '
      + 'Besucher sehen nur, was aufgenommen wurde.</p>';
  }

  const tagAnteil = k ? balken(k.heute.chf, k.heute.grenze) : 0;
  const monatAnteil = k ? balken(k.monat.chf, k.monat.grenze) : 0;

  const verlauf = k
    ? k.verlauf.map((v) =>
        `<tr><td>${sicher(v.tag)}</td><td class="r">${franken(v.chf)}</td><td class="r">${v.suchen}</td></tr>`
      ).join('')
    : '<tr><td colspan="3">keine Daten</td></tr>';

  const stufen = n
    ? ['gast', 'konto', 'premium'].map((s) => {
        const x = n[s];
        return `<tr><td>${s}</td><td class="r">${x.konten}</td><td class="r">${x.suchen}</td><td class="r">${x.schnitt}</td><td class="r">${x.grenze === Infinity ? 'unbegrenzt' : x.grenze}</td></tr>`;
      }).join('')
    : '<tr><td colspan="5">keine Daten</td></tr>';

  const zahlen = Object.entries(d.zahlen)
    .map(([name, wert]) => `<tr><td>${sicher(name)}</td><td class="r">${wert === null ? '&ndash;' : wert}</td></tr>`)
    .join('');

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SYNORA Dashboard</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; line-height: 1.5;
         max-width: 900px; margin-inline: auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 32px 0 8px; font-weight: 600; }
  .kopf { color: #666; font-size: 13px; margin-bottom: 24px; }
  .warn { background: #fff3cd; border: 1px solid #ffe08a; color: #664d03;
          padding: 10px 12px; border-radius: 6px; font-size: 14px; }
  .kachel { display: inline-block; min-width: 180px; margin: 0 16px 16px 0;
            padding: 12px 14px; border: 1px solid #ddd; border-radius: 8px; vertical-align: top; }
  .kachel .zahl { font-size: 24px; font-weight: 600; }
  .kachel .klein { font-size: 12px; color: #666; }
  .leiste { height: 6px; background: #eee; border-radius: 3px; margin-top: 8px; overflow: hidden; }
  .leiste i { display: block; height: 100%; background: #2563eb; }
  .leiste i.voll { background: #dc2626; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  th { font-weight: 600; color: #666; font-size: 12px; text-transform: uppercase; }
  td.r, th.r { text-align: right; }
  .fuss { margin-top: 32px; font-size: 12px; color: #666; }
  @media (prefers-color-scheme: dark) {
    .kachel { border-color: #333; } th, td { border-color: #222; }
    .leiste { background: #222; } .kopf, .kachel .klein, .fuss, th { color: #999; }
    .warn { background: #3a2f00; border-color: #665200; color: #ffe08a; }
  }
</style></head><body>

<h1>SYNORA Dashboard</h1>
<p class="kopf">${sicher(d.stand)} &middot; ${sicher(d.umgebung)} &middot; Datenbank ${sicher(d.datenbank)}</p>
${warnung}

<h2>Kosten</h2>
<div class="kachel">
  <div class="klein">heute</div>
  <div class="zahl">${k ? franken(k.heute.chf) : '&ndash;'}</div>
  <div class="klein">von ${k ? franken(k.heute.grenze) : '&ndash;'} &middot; ${k ? k.heute.suchen : 0} Suchen</div>
  <div class="leiste"><i class="${tagAnteil >= 90 ? 'voll' : ''}" style="width:${tagAnteil}%"></i></div>
</div>
<div class="kachel">
  <div class="klein">dieser Monat</div>
  <div class="zahl">${k ? franken(k.monat.chf) : '&ndash;'}</div>
  <div class="klein">von ${k ? franken(k.monat.grenze) : '&ndash;'} &middot; ${k ? k.monat.suchen : 0} Suchen</div>
  <div class="leiste"><i class="${monatAnteil >= 90 ? 'voll' : ''}" style="width:${monatAnteil}%"></i></div>
</div>
<div class="kachel">
  <div class="klein">heute nach Stufe</div>
  <div class="zahl">${k ? k.heute.guenstig : 0} / ${k ? k.heute.qualitaet : 0}</div>
  <div class="klein">g&uuml;nstig / Qualit&auml;t</div>
</div>

<h2>Letzte 7 Tage</h2>
<table><thead><tr><th>Tag</th><th class="r">Kosten</th><th class="r">Suchen</th></tr></thead>
<tbody>${verlauf}</tbody></table>

<h2>Nutzung ${n ? sicher(n.monat) : ''}</h2>
<table><thead><tr><th>Stufe</th><th class="r">Konten</th><th class="r">Suchen</th><th class="r">Schnitt</th><th class="r">Grenze</th></tr></thead>
<tbody>${stufen}</tbody></table>

<h2>Preisalarme</h2>
${a ? `<div class="kachel"><div class="klein">aktiv</div><div class="zahl">${a.aktiv}</div>
<div class="klein">${a.verschiedeneProdukte} verschiedene Produkte</div></div>
<div class="kachel"><div class="klein">Abfragen je Lauf</div><div class="zahl">${a.abfragenJeLauf}</div>
<div class="klein">${a.gespartProzent}% durch B&uuml;ndelung gespart</div></div>
<div class="kachel"><div class="klein">schon gemeldet</div><div class="zahl">${a.schonGemeldet}</div>
<div class="klein">Nutzer benachrichtigt</div></div>`
   : '<p>keine Daten</p>'}

<h2>Bestand</h2>
<table><thead><tr><th>Sammlung</th><th class="r">Eintr&auml;ge</th></tr></thead>
<tbody>${zahlen}</tbody></table>

<p class="fuss">${sicher(d.hinweis)}<br>
Zahlen als JSON: <code>?format=json</code></p>

</body></html>`;
}

module.exports = router;