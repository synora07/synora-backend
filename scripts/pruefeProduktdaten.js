// ============================================
// SYNORA - Was liefert die SerpAPI-Produktseite?
// ============================================
// Aufruf:  node scripts/pruefeProduktdaten.js "Sony WH-CH520"
//
// Kostet ZWEI SerpAPI-Abfragen: einmal suchen, einmal die
// Produktseite holen. Zeigt danach, welche Felder wirklich
// zurueckkommen - damit wir die Auswertung auf echte Feldnamen
// bauen statt auf geratene.
// ============================================

'use strict';

require('dotenv').config();
const axios = require('axios');

const BEGRIFF = process.argv[2] || 'Sony WH-CH520';
const KEY = process.env.SERPAPI_KEY;

function zeile(t) { console.log(t); }

async function suchen() {
  const r = await axios.get('https://serpapi.com/search', {
    params: {
      api_key: KEY,
      engine: 'google_shopping',
      q: BEGRIFF,
      gl: 'ch',
      hl: 'de',
      num: 5
    },
    timeout: 25000
  });
  return r.data.shopping_results || [];
}

async function produktSeite(token) {
  const r = await axios.get('https://serpapi.com/search', {
    params: {
      api_key: KEY,
      engine: 'google_immersive_product',
      page_token: token,
      gl: 'ch',
      hl: 'de'
    },
    timeout: 25000
  });
  return r.data || {};
}

/** Zeigt Aufbau statt Inhalt - kurz und lesbar */
function struktur(wert, tiefe = 0) {
  const einzug = '  '.repeat(tiefe + 1);
  if (Array.isArray(wert)) {
    if (!wert.length) return '[] (leer)';
    const erstes = wert[0];
    if (typeof erstes === 'object' && erstes !== null) {
      return `[${wert.length} Eintraege] Felder: ${Object.keys(erstes).join(', ')}`;
    }
    return `[${wert.length}] z.B. ${String(erstes).slice(0, 60)}`;
  }
  if (typeof wert === 'object' && wert !== null) {
    return `{ ${Object.keys(wert).join(', ')} }`;
  }
  return String(wert).slice(0, 80);
}

(async () => {
  if (!KEY) { zeile('SERPAPI_KEY fehlt in der .env'); process.exit(1); }

  zeile(`\nSuche: "${BEGRIFF}"\n`);

  const treffer = await suchen();
  if (!treffer.length) { zeile('Keine Treffer.'); process.exit(0); }

  zeile('--- Was die normale Suche liefert ---');
  zeile('Felder pro Produkt: ' + Object.keys(treffer[0]).join(', '));
  zeile('');

  const mitToken = treffer.find((p) => p.immersive_product_page_token);
  if (!mitToken) {
    zeile('Kein Produkt hat einen immersive_product_page_token.');
    zeile('Dann liefert SerpAPI zu diesen Treffern keine Produktseite.');
    process.exit(0);
  }

  zeile(`Produktseite wird geholt fuer: ${mitToken.title}`);
  zeile('');

  const daten = await produktSeite(mitToken.immersive_product_page_token);

  zeile('--- Oberste Ebene ---');
  for (const k of Object.keys(daten)) {
    if (k === 'search_metadata' || k === 'search_parameters') continue;
    zeile(`  ${k}: ${struktur(daten[k])}`);
  }

  const pr = daten.product_results;
  if (pr) {
    zeile('');
    zeile('--- product_results im Detail ---');
    for (const k of Object.keys(pr)) {
      zeile(`  ${k}: ${struktur(pr[k], 1)}`);
    }

    // Die drei Felder, auf die es uns ankommt
    zeile('');
    zeile('--- Fuer uns entscheidend ---');
    const kandidaten = ['specifications', 'specs', 'highlights', 'features',
                        'description', 'rating', 'reviews', 'reviews_results'];
    for (const k of kandidaten) {
      if (pr[k] !== undefined) {
        zeile(`  ${k} VORHANDEN: ${JSON.stringify(pr[k]).slice(0, 300)}`);
      }
    }
  }

  zeile('');
})().catch((e) => {
  console.error('Fehler:', e.response ? JSON.stringify(e.response.data).slice(0, 300) : e.message);
  process.exit(1);
});