// ============================================
// SYNORA - Rueckfragen bei Problembeschreibungen
// ============================================
// Zwei Wege fuehren zu SYNORA:
//
//   "Sony Kopfhoerer bis 150"          -> WUNSCH. Der Nutzer weiss,
//                                         was er will.
//   "Kopfhoerer fuer meinen Vater,     -> PROBLEM. Er weiss es nicht.
//    er hoert schlecht"
//
// Beim Problem sagt SYNORA zuerst, was es verstanden hat, und laesst
// sich bestaetigen:
//
//   "Ich vermute, dein Vater sitzt vor dem Fernseher und braucht
//    einen Kopfhoerer, bei dem er selbst lauter stellen kann."
//        Ja, genau  |  Fast - aber etwas anders  |  Nein, ganz anders
//
// "Ja, genau" -> sofort suchen. EIN Klick.
// Sonst       -> Detailfragen, die jetzt wissen, was falsch war.
//
// HARTE REGEL: In der Vermutung stehen NIE Fakten - kein Preis,
// keine Marke, keine Produktbehauptung. Nur die Deutung dessen, was
// der Nutzer selbst gesagt hat.
//
// KOSTEN: ein bis zwei kleine Modellaufrufe, zusammen unter einem
// halben Rappen. KEINE zusaetzliche SerpAPI-Suche.
// FAELLT DAS MODELL AUS, greifen die festen Fragen aus rueckfrage.js.
// ============================================

'use strict';

const axios = require('axios');
const basis = require('./rueckfrage');

const MODELL = process.env.RUECKFRAGE_MODELL || 'claude-haiku-4-5-20251001';

const JA = 'Ja, genau';
const FAST = 'Fast – aber etwas anders';
const NEIN = 'Nein, ganz anders';

// ============================================
// PROBLEM ERKENNEN
// ============================================
// Umlaute sind unzuverlaessig: Windows PowerShell schickt sie
// verstuemmelt, manche Clients ebenso. Beobachtet am 27.09.:
// "Kopfhoerer fuer meinen Vater" kam als "Kopfh?rer f?r meinen
// Vater" an, kein Muster griff, und SYNORA fiel auf die alte
// Standardfrage zurueck.
//
// Darum wird der Text zuerst vereinfacht: Umlaute werden zu ihrem
// Grundvokal, alles andere Nicht-Lateinische faellt weg. Aus "fuer"
// wird "fur", aus dem kaputten "f?r" wird "fr". Die Muster lassen
// den Vokal darum optional.

function vereinfachen(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ae/g, 'a')
    .replace(/ö/g, 'o').replace(/oe/g, 'o')
    .replace(/ü/g, 'u').replace(/ue/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PROBLEM_MARKER = [
  // Jemand anderes ist gemeint - der haeufigste Fall, ganz ohne Umlaute
  /\b(mein|meine|meinen|meiner|unser|unsere|unseren)\s+(vater|mutter|opa|oma|grossvater|grossmutter|onkel|tante|sohn|tochter|bruder|schwester|frau|mann|freund|freundin|chef|kollege|nachbar|kind)\b/,
  /\bfu?r\s+(mein|meine|meinen|meiner|unser|unsere|unseren)\b/,
  // Eine Faehigkeit fehlt
  /\b(er|sie)\s+(ho?rt|sieht|kann|hat|braucht|ist|wird)\b/,
  /\b(ho?rt|sieht)\s+schlecht\b/,
  /\bhat\s+(mu?he|probleme|schwierigkeiten|schmerzen)\b/,
  /\bkann\s+(nicht|kaum)\b/,
  // Der Nutzer weiss selbst nicht, was er sucht
  /\bich\s+brauche\s+(was|etwas|irgendwas)\b/,
  /\bdamit\s+ich\b/,
  /\bweiss?\s+nicht\s+(welche|welcher|welches|was)\b/,
  // Etwas stimmt mit dem Jetzigen nicht
  /\bzu\s+(laut|leise|klein|gross|schwer|eng|warm|kalt|hell|dunkel)\b/,
  /\bgeht\s+(immer\s+)?kaputt\b/,
  /\bha?lt\s+nicht\b/,
  /\bfunktioniert\s+nicht\b/
];

function istProblembeschreibung(text) {
  const t = vereinfachen(text);
  if (t.length < 10) return false;
  return PROBLEM_MARKER.some((r) => r.test(t));
}

// ============================================
// GEDAECHTNIS
// ============================================
// Ohne das fragt SYNORA endlos weiter - derselbe Fehler, den es
// frueher schon mit der Frontend-Markierung gab. Nur im Arbeits-
// speicher; nach einem Neustart greift wieder die Markierung aus
// dem Frontend. Begrenzt, damit nichts waechst.

const ERZEUGTE_FRAGEN = new Set();
const VERMUTUNGEN = new Map();   // Vermutungstext -> Suchbegriff

function merkeFrage(text) {
  if (!text) return;
  if (ERZEUGTE_FRAGEN.size > 500) ERZEUGTE_FRAGEN.clear();
  ERZEUGTE_FRAGEN.add(String(text).trim());
}

function merkeVermutung(text, suchbegriff) {
  if (!text) return;
  if (VERMUTUNGEN.size > 500) VERMUTUNGEN.clear();
  VERMUTUNGEN.set(String(text).trim(), suchbegriff || null);
  merkeFrage(text);
}

/**
 * Antwortet der Nutzer gerade auf eine Vermutung?
 *
 * Der ganze Verlauf wird durchsucht, nicht nur die letzte Nachricht:
 * Je nach Frontend steht die Vermutung im Antworttext oder im
 * Fragetext, und beides darf funktionieren.
 */
function antwortAufVermutung(verlauf) {
  if (!Array.isArray(verlauf)) return null;
  for (let i = verlauf.length - 1; i >= 0; i--) {
    const m = verlauf[i];
    if (!m || m.role !== 'assistant') continue;
    const text = String(m.content || '').trim();
    if (VERMUTUNGEN.has(text)) {
      return { vermutung: text, suchbegriff: VERMUTUNGEN.get(text) };
    }
  }
  return null;
}

function schonGefragtSchlau(verlauf) {
  if (basis.schonGefragt(verlauf)) return true;
  if (!Array.isArray(verlauf)) return false;
  return verlauf.some(
    (m) => m && m.role === 'assistant' && ERZEUGTE_FRAGEN.has(String(m.content || '').trim())
  );
}

/** Die urspruengliche Problembeschreibung aus dem Verlauf holen */
function ersteFrage(verlauf, ersatz) {
  if (!Array.isArray(verlauf)) return ersatz;
  for (const m of verlauf) {
    if (m && m.role === 'user' && String(m.content || '').trim().length > 10) {
      return m.content;
    }
  }
  return ersatz;
}

// ============================================
// DAS MODELL FRAGEN
// ============================================

const REGELN_GEMEINSAM = [
  '- In der Vermutung stehen KEINE Fakten: kein Preis, keine Marke,',
  '  keine Produktbehauptung. Nur die Deutung dessen, was der Nutzer',
  '  selbst gesagt hat.',
  '- Keine Diagnosen, keine gesundheitlichen Ratschlaege.',
  '- Der Suchbegriff nennt die Produktart, die das PROBLEM loest -',
  '  nicht zwingend die, die der Nutzer genannt hat. Wer schlecht',
  '  hoert und fernsehen will, braucht einen TV-Funkkopfhoerer.',
  '- Der Suchbegriff ist hoechstens vier Woerter lang, ohne Preise,',
  '  ohne Marken, ohne Zweckbeschreibung.',
  '- Antworte NUR mit JSON, ohne Text davor oder danach.'
];

const AUFTRAG_VERMUTUNG = [
  'Du hilfst einem Einkaufsberater fuer die Schweiz.',
  'Der Nutzer beschreibt ein Problem, kein fertiges Produkt.',
  '',
  'Deine Aufgabe:',
  '1. Sage in EINEM Satz, was du vermutest: wofuer er das Produkt',
  '   braucht und was die Loesung ist. Sprich ihn mit "du" an.',
  '2. Nenne den Suchbegriff fuer die Produktsuche.',
  '',
  'Regeln:',
  '- Die Vermutung ist konkret.',
  '  Gut:      "Ich vermute, dein Vater sitzt vor dem Fernseher und',
  '             braucht einen Kopfhoerer, bei dem er selbst lauter',
  '             stellen kann, ohne dass es fuer alle laut wird."',
  '  Wertlos:  "Ich vermute, du suchst etwas Passendes."',
  ...REGELN_GEMEINSAM,
  '',
  '{"vermutung":"...","suchbegriff":"..."}'
].join('\n');

const AUFTRAG_FRAGEN = [
  'Du hilfst einem Einkaufsberater fuer die Schweiz.',
  'Deine erste Vermutung war nicht richtig. Der Nutzer hat',
  'widersprochen.',
  '',
  'Deine Aufgabe:',
  '1. Stelle 2 bis 3 Fragen, die klaeren, was er wirklich braucht.',
  '2. Nenne den Suchbegriff fuer die Produktsuche.',
  '',
  'Regeln:',
  '- Frage nur, was die Empfehlung wirklich veraendert.',
  '- Keine Frage nach Farbe, Marke oder Aussehen.',
  '- Wiederhole nicht, was die Vermutung schon abgedeckt hat.',
  '- Jede Frage bekommt 3 bis 4 kurze Antwortmoeglichkeiten.',
  ...REGELN_GEMEINSAM,
  '',
  '{"fragen":[{"frage":"...","optionen":["...","...","..."],"mehrfach":false}],"suchbegriff":"..."}'
].join('\n');

async function modellRufen(auftrag, inhalt) {
  const key = process.env.CLAUDE_API_KEY;
  if (!key) return null;

  try {
    const antwort = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: MODELL,
        max_tokens: 700,
        system: auftrag,
        messages: [{ role: 'user', content: String(inhalt).slice(0, 900) }]
      },
      {
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 12000
      }
    );

    const text =
      (antwort && antwort.data && antwort.data.content && antwort.data.content[0] &&
        antwort.data.content[0].text) || '';
    const anfang = text.indexOf('{');
    const ende = text.lastIndexOf('}');
    if (anfang === -1 || ende <= anfang) return null;
    return JSON.parse(text.slice(anfang, ende + 1));
  } catch (e) {
    console.warn('[rueckfrage] Modell nicht erreichbar:', e.message);
    return null;
  }
}

/** Nie ungeprueft uebernehmen, was ein Modell liefert. */
function suchbegriffPruefen(wert) {
  const s = typeof wert === 'string' ? wert.trim() : '';
  if (s.length < 3 || s.length > 60) return null;
  if (/\d{2,}/.test(s)) return null;        // Preise haben hier nichts verloren
  if (s.split(/\s+/).length > 5) return null;
  return s;
}

function fragenPruefen(liste) {
  if (!Array.isArray(liste)) return [];
  const fragen = [];
  for (const f of liste.slice(0, 3)) {
    const frage = typeof f?.frage === 'string' ? f.frage.trim() : '';
    const optionen = Array.isArray(f?.optionen)
      ? f.optionen
          .filter((o) => typeof o === 'string' && o.trim())
          .map((o) => o.trim().slice(0, 60))
      : [];
    if (frage.length < 5 || frage.length > 120) continue;
    if (optionen.length < 2 || optionen.length > 5) continue;
    fragen.push({ frage, optionen, mehrfach: !!f.mehrfach });
  }
  return fragen;
}

// ============================================
// ENTSCHEIDEN
// ============================================

/**
 * @returns {Promise<null | {
 *   fragen: Array, frage: string|null, optionen: string[],
 *   vermutung: string|null, suchbegriff: string|null, fertig: boolean
 * }>}
 *
 * null          -> nicht fragen, alles laeuft wie bisher
 * fertig: false -> diese Fragen stellen
 * fertig: true  -> NICHT fragen, aber diesen Suchbegriff benutzen
 */
async function pruefenSchlau(eingabe) {
  const e = eingabe || {};

  // ---------- Stufe B: der Nutzer antwortet auf eine Vermutung ----------
  // Muss VOR schonGefragt stehen, sonst wird die zweite Runde
  // blockiert.
  const offen = antwortAufVermutung(e.verlauf);
  if (offen) {
    const antwort = String(e.nachricht || '').trim();

    // Der Controller fuehrt Frage und Antwort zusammen, BEVOR er
    // hierher kommt: aus "Ja, genau" wird
    // "Kopfhoerer fuer meinen Vater ... (Ja, genau)".
    // Beobachtet am 27.09.: Ein Vergleich auf Gleichheit traf darum
    // nie zu, und jede Bestaetigung landete faelschlich bei den
    // Detailfragen. Deshalb wird auf das Satzende geprueft.
    if (/\bja genau\s*$/.test(vereinfachen(antwort))) {
      console.log(`[rueckfrage] Vermutung bestaetigt | Suchbegriff: "${offen.suchbegriff || 'unveraendert'}"`);
      return {
        fragen: [],
        frage: null,
        optionen: [],
        vermutung: offen.vermutung,
        suchbegriff: offen.suchbegriff,
        fertig: true
      };
    }

    const original = ersteFrage(e.verlauf, e.nachricht);
    const roh = await modellRufen(
      AUFTRAG_FRAGEN,
      `Urspruengliche Anfrage: ${original}\nDeine Vermutung: ${offen.vermutung}\nAntwort des Nutzers: ${antwort}`
    );

    const fragen = fragenPruefen(roh && roh.fragen);
    if (!fragen.length) {
      console.log('[rueckfrage] Keine Detailfragen erzeugt - feste Fragen als Ersatz');
      return basis.pruefen({ ...e, nachricht: original, verlauf: [] });
    }

    const block = fragen.map((f, i) =>
      i === 0 ? { ...f, optionen: [...f.optionen, basis.EGAL] } : f
    );
    for (const f of block) merkeFrage(f.frage);

    const begriff = suchbegriffPruefen(roh && roh.suchbegriff) || offen.suchbegriff;
    console.log(`[rueckfrage] Vermutung widerlegt | ${block.length} Detailfragen | Suchbegriff: "${begriff || 'unveraendert'}"`);

    return {
      fragen: block,
      frage: block[0].frage,
      optionen: block[0].optionen,
      vermutung: null,
      suchbegriff: begriff,
      fertig: false
    };
  }

  // ---------- Stufe A: erster Kontakt ----------
  if (schonGefragtSchlau(e.verlauf)) return null;
  if (basis.willKeineFragen(e.nachricht)) return null;

  // Kein Problem erkannt: alles laeuft wie bisher.
  if (!istProblembeschreibung(e.nachricht)) return basis.pruefen(e);

  const roh = await modellRufen(AUFTRAG_VERMUTUNG, String(e.nachricht));
  const vermutung = typeof roh?.vermutung === 'string' ? roh.vermutung.trim() : '';
  const begriff = suchbegriffPruefen(roh && roh.suchbegriff);

  if (vermutung.length < 15 || vermutung.length > 250) {
    console.log('[rueckfrage] Problem erkannt, keine brauchbare Vermutung - feste Fragen');
    return basis.pruefen(e);
  }

  merkeVermutung(vermutung, begriff);
  console.log(`[rueckfrage] Vermutung gestellt | Suchbegriff: "${begriff || 'unveraendert'}"`);

  return {
    // Die Vermutung steht schon im Antworttext - hier nur die kurze
    // Bestaetigungsfrage, sonst steht derselbe Satz zweimal da.
    fragen: [{ frage: 'Stimmt das?', optionen: [JA, FAST, NEIN], mehrfach: false }],
    frage: vermutung,
    optionen: [JA, FAST, NEIN],
    vermutung,
    suchbegriff: begriff,
    fertig: false
  };
}

module.exports = {
  pruefenSchlau,
  schonGefragtSchlau,
  istProblembeschreibung,
  vereinfachen,
  JA,
  FAST,
  NEIN
};