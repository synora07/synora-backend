// ============================================
// SYNORA - Welcher Perplexity-Modellname gilt?
// ============================================
// Aufruf:  node scripts/testPerplexity.js
//
// Warum es dieses Skript gibt: In perplexityService.js stand
// "llama-3.1-sonar-large-128k-online". Perplexity hat diese Modelle
// abgeschaltet. Jeder Aufruf lief ins Leere, und beim Serverstart
// stand wochenlang:
//
//   [wissen] perplexityService hat noch keine produktWissen()
//
// Statt einen Namen zu RATEN - das hat uns schon zwei Durchlaeufe
// gekostet - fragen wir Perplexity selbst. Jeder Name bekommt eine
// winzige Anfrage (5 Tokens). Was antwortet, gilt.
//
// KOSTEN: ein paar Rappen. KEIN SerpAPI.
// ============================================

'use strict';

require('dotenv').config();
const axios = require('axios');

const KANDIDATEN = [
  'sonar',
  'sonar-pro',
  'sonar-reasoning',
  'sonar-reasoning-pro',
  'sonar-deep-research',
  // Der alte Name - zur Bestaetigung, dass er wirklich tot ist
  'llama-3.1-sonar-large-128k-online'
];

async function pruefen(modell, apiKey) {
  const start = Date.now();
  try {
    const antwort = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: modell,
        messages: [{ role: 'user', content: 'Antworte nur mit: ok' }],
        max_tokens: 5
      },
      {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        timeout: 20000
      }
    );

    const text = (antwort.data?.choices?.[0]?.message?.content || '').trim();
    return { modell, ok: true, dauer: Date.now() - start, text: text.slice(0, 40) };
  } catch (e) {
    const status = e.response?.status;
    const grund =
      e.response?.data?.error?.message ||
      e.response?.data?.detail ||
      e.message;
    return { modell, ok: false, status, grund: String(grund).slice(0, 120) };
  }
}

async function main() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    console.error('\nPERPLEXITY_API_KEY fehlt in der .env\n');
    process.exit(1);
  }

  console.log('\nPruefe Modellnamen bei Perplexity...\n');

  const gueltige = [];

  for (const m of KANDIDATEN) {
    process.stdout.write('  ' + m.padEnd(38));
    const r = await pruefen(m, apiKey);

    if (r.ok) {
      console.log(`ok   (${r.dauer} ms)`);
      gueltige.push(m);
    } else {
      console.log(`--   ${r.status || ''} ${r.grund}`);
    }
  }

  console.log('\n========================================');
  if (gueltige.length) {
    console.log('  Gueltige Modelle:');
    for (const m of gueltige) console.log('    ' + m);
    console.log('\n  Trag das erste davon in die .env ein:');
    console.log('    PERPLEXITY_MODELL=' + gueltige[0]);
  } else {
    console.log('  KEIN Modell hat geantwortet.');
    console.log('  Entweder ist kein Guthaben da oder der Schluessel stimmt nicht.');
    console.log('  Die Fehlergruende oben sagen, welches von beidem.');
  }
  console.log('========================================\n');
}

main().catch((e) => {
  console.error('Abgebrochen:', e.message);
  process.exit(1);
});