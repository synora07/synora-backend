// ============================================
// SYNORA - Shops auf Erreichbarkeit pruefen
// ============================================
// Geht ueber alle Shop-Domains und schaut nach, ob sie noch
// antworten. Das Warenhaus Jelmoli stand ueber ein Jahr lang
// geschlossen in der Datenbank - so etwas findet dieses Skript.
//
// Aufruf:
//   node scripts/pruefeShops.js            nur das Register
//   node scripts/pruefeShops.js --alle     auch die feste Datenbank
//   node scripts/pruefeShops.js --schreiben Ergebnis ins Register schreiben
//
// Ohne --schreiben wird nichts veraendert, nur berichtet.
// ============================================

'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const ShopEintrag = require(path.join(WURZEL, 'src/models/ShopEintrag'));

const ZEITLIMIT_MS = 10000;
const GLEICHZEITIG = 5;      // nicht mehr, sonst sieht es aus wie ein Angriff
const PAUSE_MS = 300;

const argumente = process.argv.slice(2);
const AUCH_STATISCH = argumente.includes('--alle');
const SCHREIBEN = argumente.includes('--schreiben');

function warte(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Eine Domain pruefen.
 * Erst HEAD, das ist sparsam. Manche Server mögen HEAD nicht,
 * dann noch einmal mit GET.
 */
async function pruefeDomain(domain) {
  const adresse = domain.startsWith('http') ? domain : 'https://' + domain;

  for (const methode of ['HEAD', 'GET']) {
    const abbruch = new AbortController();
    const uhr = setTimeout(() => abbruch.abort(), ZEITLIMIT_MS);

    try {
      const antwort = await fetch(adresse, {
        method: methode,
        redirect: 'follow',
        signal: abbruch.signal,
        headers: {
          // Ehrlich sagen, wer anklopft
          'User-Agent': 'SYNORA-Shopcheck/1.0 (+https://synora.li)'
        }
      });

      clearTimeout(uhr);

      // 4xx heisst: Server da, Seite vielleicht nicht. Zaehlt als erreichbar.
      // 5xx heisst: Server hat ein Problem.
      if (antwort.status < 500) {
        return { erreichbar: true, status: antwort.status, ziel: antwort.url };
      }

      if (methode === 'GET') {
        return { erreichbar: false, status: antwort.status, grund: 'Serverfehler' };
      }
    } catch (e) {
      clearTimeout(uhr);
      if (methode === 'GET') {
        const grund = e.name === 'AbortError' ? 'Zeitueberschreitung' : e.message;
        return { erreichbar: false, status: null, grund };
      }
    }
  }

  return { erreichbar: false, status: null, grund: 'unbekannt' };
}

/** Mehrere pruefen, aber hoeflich */
async function pruefeListe(eintraege, beschriftung) {
  const ergebnisse = [];
  let fertig = 0;

  console.log(`\n${beschriftung}: ${eintraege.length} Domains\n`);

  for (let i = 0; i < eintraege.length; i += GLEICHZEITIG) {
    const gruppe = eintraege.slice(i, i + GLEICHZEITIG);

    const teil = await Promise.all(
      gruppe.map(async (e) => {
        const r = await pruefeDomain(e.domain);
        return { ...e, ...r };
      })
    );

    for (const r of teil) {
      fertig += 1;
      const zeichen = r.erreichbar ? 'ok  ' : 'TOT ';
      const zusatz = r.erreichbar
        ? (r.status >= 300 ? ` (${r.status})` : '')
        : ` <- ${r.grund}`;
      console.log(`  [${String(fertig).padStart(4)}/${eintraege.length}] ${zeichen} ${r.domain}${zusatz}`);
    }

    ergebnisse.push(...teil);
    if (i + GLEICHZEITIG < eintraege.length) await warte(PAUSE_MS);
  }

  return ergebnisse;
}

/** Domains aus der festen Shop-Datenbank sammeln */
function statischeDomains() {
  try {
    const db = require(path.join(WURZEL, 'src/services/shopDatabasePart3'));
    const gesehen = new Map();

    for (const hauptKat of Object.values(db.ALLE_SHOPS || {})) {
      for (const unterKat of Object.values(hauptKat)) {
        if (!Array.isArray(unterKat)) continue;
        for (const shop of unterKat) {
          if (!shop.url) continue;
          const domain = String(shop.url).toLowerCase().split('/')[0];
          if (!gesehen.has(domain)) gesehen.set(domain, { domain, name: shop.name });
        }
      }
    }

    return [...gesehen.values()];
  } catch (e) {
    console.warn('Feste Shop-Datenbank nicht ladbar:', e.message);
    return [];
  }
}

async function main() {
  const start = Date.now();

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI fehlt in der .env');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('Datenbank verbunden');

  // ---------- Register ----------
  const ausRegister = await ShopEintrag.find({ domain: { $ne: null } })
    .select('kennung domain name')
    .lean();

  const ergebnisRegister = ausRegister.length
    ? await pruefeListe(ausRegister, 'Register (automatisch gesammelt)')
    : [];

  if (!ausRegister.length) {
    console.log('\nRegister ist noch leer - es fuellt sich mit jeder Suche.');
  }

  // ---------- Feste Datenbank ----------
  let ergebnisStatisch = [];
  if (AUCH_STATISCH) {
    const domains = statischeDomains();
    if (domains.length) {
      console.log(`\nAchtung: ${domains.length} Domains aus der festen Datenbank.`);
      console.log(`Das dauert ungefaehr ${Math.ceil((domains.length / GLEICHZEITIG) * 1.5 / 60)} Minuten.`);
      ergebnisStatisch = await pruefeListe(domains, 'Feste Shop-Datenbank');
    }
  }

  // ---------- Ergebnis schreiben ----------
  if (SCHREIBEN && ergebnisRegister.length) {
    const jetzt = new Date();
    const operationen = ergebnisRegister.map((r) => ({
      updateOne: {
        filter: { kennung: r.kennung },
        update: { $set: { erreichbar: r.erreichbar, letztePruefung: jetzt } }
      }
    }));

    await ShopEintrag.bulkWrite(operationen, { ordered: false });
    console.log(`\n${operationen.length} Eintraege im Register aktualisiert.`);
  }

  // ---------- Bericht ----------
  const alle = [...ergebnisRegister, ...ergebnisStatisch];
  const tot = alle.filter((r) => !r.erreichbar);

  console.log('\n==========================================');
  console.log(`Geprueft: ${alle.length} | Erreichbar: ${alle.length - tot.length} | Tot: ${tot.length}`);
  console.log(`Dauer: ${Math.round((Date.now() - start) / 1000)} Sekunden`);
  console.log('==========================================');

  if (tot.length) {
    console.log('\nNICHT ERREICHBAR:\n');
    for (const t of tot) {
      console.log(`  ${t.domain.padEnd(34)} ${t.name || ''} <- ${t.grund}`);
    }
    console.log('\nHinweis: Eine einzelne Zeitueberschreitung heisst nicht');
    console.log('zwingend, dass der Shop weg ist. Lass das Skript ein');
    console.log('zweites Mal laufen, bevor du etwas loeschst.');
  } else if (alle.length) {
    console.log('\nAlle geprueften Domains antworten.');
  }

  if (!SCHREIBEN) {
    console.log('\n(Nichts veraendert. Mit --schreiben wird das Ergebnis gespeichert.)');
  }

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('Fehler:', e.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});