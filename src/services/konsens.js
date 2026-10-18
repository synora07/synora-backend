// ============================================
// SYNORA - Stufe 4 und 5: Konsens
// ============================================
// Bisher entschied ein einziges Modell. Die Folgen haben wir
// gemessen: erfundene Bewertungszahlen, "kabelgebunden" bei einem
// Bluetooth-Geraet, ein Over-Ear-Kopfhoerer als Sport-Empfehlung.
// Die Faktenpruefung faengt Zahlen und Eigenschaften - aber ein
// falsches URTEIL faengt sie nicht.
//
// Darum bewerten jetzt zwei Modelle unabhaengig voneinander,
// blind, mit GENAU demselben Auftrag. Verschiedene Prompts waeren
// kein Konsens, sondern zwei verschiedene Fragen.
//
// Sind sie sich bei Platz 1 einig, ist das ein starkes Zeichen.
// Sind sie es nicht, sagt SYNORA das - statt eine Sicherheit
// vorzutaeuschen, die es nicht gibt.
// ============================================

'use strict';

const axios = require('axios');
const claudeService = require('./claudeService');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
// ============================================
// Zwei Stufen, zwei Modellpaare
// ============================================
// Die Kostenbremse rechnet mit zwei Preisen: 4 Rappen fuer
// Gratis-Nutzer, 14 fuer Premium. Bisher bekamen aber ALLE
// dasselbe Modell - die teure Stufe war nur ein Preisschild.
//
// Jetzt entscheidet die Stufe, welches Modellpaar laeuft:
//
//   guenstig   -> MODELL_SCHNELL  +  OPENAI_MODELL_SCHNELL
//   qualitaet  -> MODELL_STARK    +  OPENAI_MODELL_STARK
//
// ALLE VIER stehen heute auf dem guenstigen Modell. Das ist
// Absicht: so aendert sich erst einmal nichts. Setzt du eines der
// starken Modelle in der .env hoch, bekommen ab dann NUR Premium-
// Nutzer das teure Modell - und die Abrechnung stimmt weiterhin.
//
// Vorher waere beim Hochsetzen von CLAUDE_MODEL_STARK jeder Nutzer
// auf dem teuren Modell gelandet, waehrend Gratis-Nutzer weiter mit
// 4 Rappen verbucht wurden. Die Bremse haette um den Faktor 3.5 zu
// billig gerechnet.
const OPENAI_MODELL_SCHNELL = process.env.OPENAI_MODELL_SCHNELL || 'gpt-4o-mini';
const OPENAI_MODELL_STARK = process.env.OPENAI_MODELL_STARK || 'gpt-4o-mini';

// Alter Name, damit nichts bricht, was ihn noch importiert.
const OPENAI_MODELL = OPENAI_MODELL_SCHNELL;

function modellePaar(stufe) {
  const stark = stufe === 'qualitaet';
  return {
    claude: stark ? claudeService.MODELL_STARK : claudeService.MODELL_SCHNELL,
    openai: stark ? OPENAI_MODELL_STARK : OPENAI_MODELL_SCHNELL
  };
}
const ZEITGRENZE = 30000;

// ============================================
// OPENAI MIT DEMSELBEN AUFTRAG
// ============================================

function kostenOpenAi(usage) {
  if (!usage) return 0;
  // gpt-4o-mini, Stand 09/2026: grobe Schaetzung in USD je 1M Tokens
  const EIN = 0.15 / 1e6;
  const AUS = 0.60 / 1e6;
  return (usage.prompt_tokens || 0) * EIN + (usage.completion_tokens || 0) * AUS;
}

async function vonOpenAi(userPrompt, modell = OPENAI_MODELL_SCHNELL) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { success: false, error: 'OPENAI_API_KEY fehlt' };

  const start = Date.now();

  const antwort = await axios.post(
    OPENAI_URL,
    {
      model: modell,
      max_tokens: 1500,
      temperature: 0.3,
      messages: [
        { role: 'system', content: claudeService.SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: ZEITGRENZE
    }
  );

  const text = antwort.data?.choices?.[0]?.message?.content || '';

  // Die Auswertung von claudeService erwartet Anthropics Form.
  // Wir bauen sie nach, damit beide Antworten identisch
  // ausgewertet werden - sonst unterscheiden sich die Ergebnisse
  // wegen der Auswertung und nicht wegen des Urteils.
  const gedeutet = claudeService.parseClaudeResponse({ content: [{ text }] });

  return {
    success: !!(gedeutet.empfehlungen && gedeutet.empfehlungen.length),
    empfehlungen: gedeutet.empfehlungen || [],
    zusammenfassung: gedeutet.zusammenfassung || '',
    metrics: { kosten: kostenOpenAi(antwort.data?.usage), dauerMs: Date.now() - start }
  };
}

// ============================================
// VERGLEICHEN
// ============================================

function ids(bewertung) {
  return (bewertung?.empfehlungen || []).map((e) => e.produkt_id).filter(Boolean);
}

/**
 * Was sagen die Modelle zusammen?
 *
 * Regel: Platz 1 nur, wenn beide ihn in den ersten drei haben.
 * Sonst ist es kein gemeinsames Urteil, sondern eine Meinung.
 */
function zusammenfuehren(a, b) {
  const listeA = ids(a);
  const listeB = ids(b);

  // Faellt eines aus, entscheidet das andere allein
  if (!listeA.length || !listeB.length) {
    const alleine = listeA.length ? a : b;
    return {
      bewertung: alleine,
      einstimmigTop1: false,
      alleineEntschieden: true,
      uneinigkeit: ['Nur ein Modell hat geantwortet'],
      hinweis: null
    };
  }

  const einig = listeA[0] === listeB[0];

  if (einig) {
    return {
      bewertung: a,                 // gleiche Spitze, Claude schreibt den Text
      einstimmigTop1: true,
      alleineEntschieden: false,
      uneinigkeit: [],
      hinweis: null
    };
  }

  // ---------- Uneinig ----------
  // Wir nehmen das Produkt, das bei BEIDEN zusammen am besten
  // steht - nicht einfach das erste gemeinsame.
  //
  // Beispiel: Modell A sagt [p_08, p_09, p_12], Modell B sagt
  // [p_09, p_03, p_08]. p_08 steht auf Platz 1 und 3 (zusammen 4),
  // p_09 auf Platz 2 und 1 (zusammen 3). Also gewinnt p_09 - es
  // ueberzeugt beide, waehrend p_08 nur einem gefaellt.
  let gemeinsam = null;
  let besteSumme = Infinity;
  for (const id of listeA) {
    const platzB = listeB.indexOf(id);
    if (platzB === -1) continue;
    const summe = listeA.indexOf(id) + platzB;
    if (summe < besteSumme) { besteSumme = summe; gemeinsam = id; }
  }

  let bewertung = a;
  if (gemeinsam && gemeinsam !== listeA[0]) {
    const sortiert = [...a.empfehlungen].sort((x, y) => {
      if (x.produkt_id === gemeinsam) return -1;
      if (y.produkt_id === gemeinsam) return 1;
      return 0;
    });

    // ---------- Der Text muss zur Reihenfolge passen ----------
    // Die Zusammenfassung stammt von Modell A und nennt dessen
    // Favoriten beim Namen. Schieben wir ein anderes Produkt nach
    // vorn, stuende dort "ich empfehle X", waehrend Y auf Platz 1
    // liegt. Ein Widerspruch im eigenen Text ist schlimmer als eine
    // fehlende Zusammenfassung - der Nutzer merkt ihn sofort und
    // glaubt danach keinem Satz mehr.
    //
    // Darum faellt sie hier weg. Der Controller setzt dann seinen
    // neutralen Satz ein, und der Hinweis unten erklaert, warum die
    // Reihenfolge so ist.
    bewertung = { ...a, empfehlungen: sortiert, zusammenfassung: '' };
  }

  return {
    bewertung,
    einstimmigTop1: false,
    alleineEntschieden: false,
    uneinigkeit: [`Platz 1: ein Modell ${listeA[0]}, das andere ${listeB[0]}`],
    hinweis: gemeinsam
      ? 'Meine beiden Prüfungen sind sich bei der besten Wahl nicht einig. Ich zeige dir das Produkt, das beide überzeugt hat – schau dir die Alternativen trotzdem an.'
      : 'Meine beiden Prüfungen kommen zu unterschiedlichen Ergebnissen. Nimm meine Reihenfolge hier mit Vorsicht.'
  };
}

// ============================================
// HAUPTFUNKTION
// ============================================

/**
 * Beide Modelle parallel. Parallel, damit die Wartezeit nicht
 * steigt - nacheinander waeren es zwei volle Aufrufe hintereinander.
 */
async function bewerten({ query, produkte, kontext, personalisierung, stufe = 'guenstig' }) {
  const userPrompt = claudeService.buildUserPrompt(query, produkte, personalisierung, kontext);
  const modelle = modellePaar(stufe);

  const [claudeErgebnis, openaiErgebnis] = await Promise.allSettled([
    claudeService.getProductRecommendation({ query, produkte, kontext, personalisierung, modell: modelle.claude }),
    vonOpenAi(userPrompt, modelle.openai)
  ]);

  const a = claudeErgebnis.status === 'fulfilled' ? claudeErgebnis.value : { success: false, empfehlungen: [] };
  const b = openaiErgebnis.status === 'fulfilled' ? openaiErgebnis.value : { success: false, empfehlungen: [] };

  if (openaiErgebnis.status === 'rejected') {
    console.warn('[konsens] OpenAI ausgefallen:', openaiErgebnis.reason?.message);
  }

  const ergebnis = zusammenfuehren(a, b);

  console.log(
    `[konsens] (${stufe}) Claude: ${ids(a).join(',') || 'nichts'} | OpenAI: ${ids(b).join(',') || 'nichts'} | ` +
      (ergebnis.einstimmigTop1 ? 'EINIG' : ergebnis.alleineEntschieden ? 'allein entschieden' : 'UNEINIG')
  );

  return {
    ...ergebnis,
    einzeln: [
      { modell: modelle.claude, rangliste: ids(a), kosten: a.metrics?.kosten || 0, dauerMs: a.metrics?.dauerMs || null, fehler: a.success ? null : (a.error || 'keine Antwort') },
      { modell: modelle.openai, rangliste: ids(b), kosten: b.metrics?.kosten || 0, dauerMs: b.metrics?.dauerMs || null, fehler: b.success ? null : (b.error || 'keine Antwort') }
    ]
  };
}

module.exports = {
  bewerten,
  zusammenfuehren,
  vonOpenAi,
  modellePaar,
  OPENAI_MODELL,
  OPENAI_MODELL_SCHNELL,
  OPENAI_MODELL_STARK
};