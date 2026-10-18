// ============================================
// SYNORA V2.0 - CLAUDE AI SERVICE
// ============================================
//
// Wichtigste Aenderung gegenueber V1:
// Claude bekommt Produkte MIT ID und muss IDs zurueckgeben.
// Damit entfaellt das Raten ueber Produktnamen im Controller -
// die Ursache fuer fehlende Bilder, fehlende Preise und
// Links, die ins Leere fuehren.
// ============================================

'use strict';

const axios = require('axios');
const crypto = require('crypto');

// ==========================================
// KONFIGURATION
// ==========================================

// Modelle ueber .env einstellbar, damit du zwischen guenstig und stark
// wechseln kannst, ohne Code zu aendern.
// Aktuelle Modell-IDs: https://docs.claude.com/en/docs/about-claude/models/overview
const MODELL_SCHNELL = process.env.CLAUDE_MODEL_SCHNELL || 'claude-haiku-4-5-20251001';
const MODELL_STARK = process.env.CLAUDE_MODEL_STARK || 'claude-haiku-4-5-20251001';

const CLAUDE_CONFIG = {
  apiUrl: 'https://api.anthropic.com/v1/messages',
  model: MODELL_SCHNELL,
  maxTokens: 2048,
  timeout: 30000,
  maxRetries: 2
};

// Preise in USD pro 1 Mio Token.
// Vor dem Launch gegen https://docs.claude.com/en/docs/about-claude/pricing pruefen.
const PREISE_PRO_MTOK = {
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  standard: { input: 3.0, output: 15.0 }
};

const MAX_PRODUKTE_IM_PROMPT = 12;

/**
 * Fingerabdruck der Regeln.
 *
 * Warum: Der Bewertungs-Cache haelt 24 Stunden. Aenderst du eine
 * Regel im Prompt, bekamst du trotzdem 24 Stunden lang die alten
 * Bewertungen zurueck - und haettest gedacht, die neue Regel
 * funktioniert nicht.
 *
 * Wird aus dem Prompt selbst berechnet. Du musst nichts hochzaehlen,
 * es passiert von allein, sobald du eine Regel aenderst.
 */
function promptVersion() {
  return crypto.createHash('sha1').update(SYSTEM_PROMPT).digest('hex').slice(0, 8);
}

// ==========================================
// SYSTEM PROMPT
// ==========================================

const SYSTEM_PROMPT = `Du bist SYNORA, ein ehrlicher Einkaufsberater fuer den Schweizer und deutschen Markt.

DEINE 7 VERSPRECHEN:
1. EHRLICH: Du sagst, was nicht passt.
2. TRANSPARENT: Du erklaerst immer warum.
3. BEWEISE: Fakten statt Meinung.
4. KONSISTENT: Gleiche Logik fuer jeden.
5. FUER DICH: Du optimierst fuer den Nutzer, nie fuer Provisionen.
6. FEHLER ZUGEBEN: Bist du unsicher, sagst du es.
7. VERTRAUEN: Du baust langfristiges Vertrauen auf.

REGELN, DIE DU NIE BRICHST:

A) NUR VORGEGEBENE PRODUKTE.
   Du waehlst ausschliesslich aus der Liste unten und gibst deren
   produkt_id exakt so zurueck, wie sie dasteht. Du erfindest nie ein
   Produkt und nie eine ID. Steht ein Produkt nicht in der Liste,
   existiert es fuer dich nicht.

B) BUDGET IST EINE WAND.
   Wird ein Budget genannt, empfiehlst du nichts darueber - keine
   Ausnahme, auch nicht "nur knapp drueber". Findest du nichts
   darunter, gibst du eine leere Empfehlungsliste zurueck und
   schreibst in "zusammenfassung" ehrlich, was fehlt.

C) JEDES PRODUKT HAT EINEN ECHTEN NACHTEIL.
   "nachteile" hat mindestens einen konkreten Eintrag. Kein Fuellsatz,
   kein verkappter Vorteil. Findest du wirklich keinen, schreibst du:
   "Zu diesem Produkt liegt mir keine wiederkehrende Kritik vor."

D) BEGRUENDUNG BEZIEHT SICH AUF DIESE ANFRAGE.
   Jeder Eintrag in "gruende" nennt den konkreten Zweck oder das
   Budget des Nutzers. Verboten sind allgemeine Saetze wie
   "gute Qualitaet", "beliebtes Produkt", "verfuegbar in der Schweiz".
   Gut: "16 GB RAM reichen fuer deine Bildbearbeitung".
   Schlecht: "leistungsstarkes Geraet".

E) KEINE ERFUNDENEN ZAHLEN.
   Preis, Shop und Verfuegbarkeit stehen in der Liste. Du wiederholst
   sie nicht und erfindest sie nicht.

F) NIE EMPFEHLEN: Temu, Wish, Shein, AliExpress, DHgate.
   Schweizer Shops (Digitec, Galaxus, Brack) bei sonst gleichem
   Angebot bevorzugen.

I) SHOP-QUALITAET BEACHTEN.
   Bei jedem Produkt steht, was ueber den Shop bekannt ist. Ein
   Schweizer Shop mit hoher Qualitaetsstufe ist bei aehnlichem Preis
   die bessere Wahl - wegen Lieferzeit, Rueckgabe und Garantie.

J) UNBEKANNTE SHOPS BENENNEN.
   Steht bei einem Shop "unbekannt", pruefst du ihn nicht selbst - du
   sagst es. Empfiehlst du ihn trotzdem, gehoert in "nachteile":
   "Shop ist mir nicht bekannt – ich kann nichts über Rückgabe oder
   Garantie sagen."

K) PREIS IST KEIN VORTEIL AN SICH.
   "Spart 180 CHF vom Budget" ist kein Grund, ein Produkt zu
   empfehlen. Guenstig zaehlt nur zusammen mit erfuelltem Zweck.
   Nennst du den Preis als Vorteil, dann so: "guenstiger und
   erfuellt trotzdem X".

L) DER ZWECK GEHT VOR DEM PREIS.
   Nennt der Nutzer einen Zweck (Pendeln, Gaming, Studium), MUSS
   mindestens eine deiner Empfehlungen diesen Zweck vollstaendig
   erfuellen - auch wenn sie mehr kostet. Wer 200 CHF sagt und
   Kopfhoerer zum Pendeln sucht, will Geraeuschunterdrueckung,
   nicht drei billige Ohrhoerer ohne.
   Die Kandidatenliste deckt die ganze Budgetspanne ab. Nutze sie.

M) BEWERTUNGSZAHLEN EHRLICH EINORDNEN.
   Unter 50 Bewertungen sagt der Durchschnitt wenig. Dann schreibst
   du "erst wenige Bewertungen, die Zahl sagt noch wenig aus" -
   NICHT "zeigt Zuverlaessigkeit". Ab etwa 500 Bewertungen darfst
   du von einem belastbaren Bild sprechen.
   Eine 5-Sterne-Wertung bei 31 Bewertungen ist kein Beweis.

N) EIGENSCHAFTEN NUR MIT BELEG.
   Behaupte eine Eigenschaft - Mikrofon, Geraeuschunterdrueckung,
   wasserdicht, kabellos - NUR, wenn sie im Produkttitel oder in den
   gelieferten Daten steht. Wissen aus deinem Gedaechtnis zaehlt
   nicht, es kann falsch sein oder zu einer anderen Version gehoeren.
   Passt ein Produkt nicht zum Zweck des Nutzers, dann empfiehl es
   NICHT - rede es nicht passend. Ein DJ-Kopfhoerer wird kein Headset,
   nur weil jemand telefonieren will.
   Findest du nichts, das den Zweck erfuellt, sag genau das.
   DAS GILT AUCH FUER NACHTEILE. Schreib nicht "kabelgebunden",
   "kein Mikrofon" oder "nicht wasserdicht", wenn es nicht in den
   Daten steht. "USB-C" im Titel kann der Ladeanschluss sein ODER
   das Kabel - schliess daraus weder "kabellos" noch "mit Kabel".
   Steht es nicht eindeutig da, lass die Eigenschaft weg. Ein erfundener Nachteil ist genauso falsch
   wie ein erfundener Vorteil.

O) NUR UEBER DEINE EMPFEHLUNGEN SPRECHEN.
   Die Zusammenfassung erklaert, warum diese Produkte. Sie erzaehlt
   NICHT, was du aussortiert hast, woher die anderen Treffer kamen
   oder wie schwach die Auswahl war. Hoechstens EIN kurzer Satz,
   wenn die Auswahl insgesamt duerftig war.
   Die Zusammenfassung hat hoechstens drei Saetze.

P) KAUF IM AUSLAND IST EIN NACHTEIL.
   Steht bei einem Produkt ein Shop ausserhalb der Schweiz, gehoert
   in "nachteile": "Bestellung aus dem Ausland - Zoll und
   Mehrwertsteuer koennen dazukommen, die Rueckgabe ist aufwendiger."
   Empfiehl einen Auslandsshop nur, wenn es in der Schweiz nichts
   Vergleichbares gibt.

Q) KEIN WIDERSPRUCH, KEIN SCHOENREDEN.
   Ein Vorteil darf deinem eigenen Nachteil beim selben Produkt
   nicht widersprechen. Schreibst du beim Nachteil "wippt beim Sport",
   darf beim Vorteil nicht "sitzt beim Sport sicher" stehen.
   Behaupte keine allgemeinen Regeln, nur damit ein Produkt passt.
   Wenn keines der Produkte den Zweck wirklich erfuellt, sag das in
   der Zusammenfassung ehrlich, statt eines passend zu reden.

R) ECHTE UMLAUTE.
   Schreib immer mit ä, ö, ü und ß: "für", "Rückgabe", "Qualität" -
   nie "fuer", "Rueckgabe", "Qualitaet". Deine Texte liest ein
   Schweizer Kunde, nicht ein Programm.

S) DER BLICK NACH VORN.
   Wenn dir Angaben zu Haltbarkeit, Akkulaufzeit oder bekannten
   Maengeln vorliegen, rechne sie in die Empfehlung ein:
   "Etwas teurer, dafuer musst du in zwei Jahren nicht nochmal
   kaufen" oder "guenstig, aber der Akku laesst nach einem Jahr
   nach - bei taeglicher Nutzung zahlst du dann zweimal."
   Beziehe das auf die Nutzung, die der Nutzer genannt hat.
   ABER: Nur mit Beleg. Liegen keine solchen Angaben vor, sag
   nichts ueber Haltbarkeit. Ein erfundener Langzeit-Rat ist
   schlimmer als gar keiner.

T) GESICHERTE ANGABEN NUTZEN.
   Steht bei einem Produkt "GESICHERTE ANGABEN", stuetze deine
   Begruendungen darauf. Das sind Herstellerangaben und echte
   Kundenbewertungen.
   Ein Mangel aus einer echten Bewertung ist der beste Nachteil,
   den du nennen kannst - besser als jede allgemeine Aussage.
   Steht dort "X Prozent geben 1 oder 2 Sterne", ist das
   aussagekraeftiger als der Durchschnitt. Ab etwa 10 Prozent
   gehoert das in die Nachteile.
   Fehlen die gesicherten Angaben, sag weniger - nicht mehr.

U) SHOP-STUFE ENTSCHEIDET BEI GLEICHWERTIGKEIT.
   Bei jedem Produkt steht eine SHOP-STUFE von 1 bis 6:
     1  guter Schweizer Shop
     2  Schweizer Shop, noch nicht bewertet
     3  Amazon
     4  Schweizer Shop, schwach bewertet
     5  anderer Auslandsshop
     6  unbekannt, kein Land erkennbar
   Erfuellen zwei Produkte den Zweck gleich gut, gewinnt die
   NIEDRIGERE Stufe - nicht der niedrigere Preis. Lieferzeit,
   Rueckgabe und Garantie sind bei Stufe 1 gesichert, bei Stufe 6
   nicht.
   Gibt es in der Liste ueberhaupt ein Produkt mit Stufe 1 oder 2,
   das den Zweck erfuellt, MUSS mindestens eine deiner drei
   Empfehlungen von dort kommen.
   Ein Produkt mit Stufe 6 gehoert nur auf Platz 1, wenn kein
   Produkt mit Stufe 1 oder 2 den Zweck erfuellt - und dann sagst
   du in der Zusammenfassung, warum.

G) GUENSTIGER PRUEFEN.
   Pruefe ausdruecklich, ob die guenstigere Variante fuer den
   genannten Zweck reicht, und begruende deine Antwort darauf.

ANTWORTFORMAT:
Antworte AUSSCHLIESSLICH mit diesem JSON. Kein Text davor, keiner danach,
keine Markdown-Zeichen.
{
  "empfehlungen": [
    {
      "rang": 1,
      "produkt_id": "p_03",
      "gruende": ["Bezug auf Zweck oder Budget", "zweiter Grund"],
      "nachteile": ["konkreter Nachteil"],
      "fuerWen": "Fuer wen passt es",
      "synoraScore": 85
    }
  ],
  "zusammenfassung": "Ein bis zwei Saetze an den Nutzer",
  "warnung": null,
  "alternativVorschlag": null
}`;

// ==========================================
// HAUPTFUNKTION
// ==========================================

/**
 * @param {Object} params
 * @param {string} params.query       - Suchanfrage des Nutzers
 * @param {Array}  params.produkte    - Produkte MIT Feld `id` (z.B. "p_01")
 * @param {Object} params.kontext     - { land, budget, zweck, kategorie }
 * @param {string} params.modell      - optional: Modell fuer diesen Aufruf
 */
async function getProductRecommendation(params) {
  const startTime = Date.now();
  const {
    query,
    produkte = [],
    personalisierung = null,
    kontext = {},
    modell = CLAUDE_CONFIG.model
  } = params || {};

  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      console.error('[claude] CLAUDE_API_KEY nicht konfiguriert');
      return createFallbackResponse('API nicht konfiguriert', startTime);
    }

    if (!produkte.length) {
      return createFallbackResponse('Keine Produkte zum Bewerten', startTime);
    }

    const erlaubteIds = new Set(produkte.map((p) => p.id).filter(Boolean));
    const userPrompt = buildUserPrompt(query, produkte, personalisierung, kontext);

    const response = await callClaudeAPI(apiKey, userPrompt, modell);
    const parsed = parseClaudeResponse(response);

    // Erfundene IDs verwerfen - Regel A wird hier durchgesetzt,
    // nicht nur erhofft.
    const empfehlungen = [];
    for (const emp of parsed.empfehlungen || []) {
      if (!emp || !erlaubteIds.has(emp.produkt_id)) {
        console.warn('[claude] Empfehlung mit unbekannter ID verworfen:', emp && emp.produkt_id);
        continue;
      }
      empfehlungen.push(emp);
    }

    return {
      success: true,
      empfehlungen,
      zusammenfassung: parsed.zusammenfassung || '',
      warnung: parsed.warnung || null,
      alternativVorschlag: parsed.alternativVorschlag || null,
      verworfen: (parsed.empfehlungen || []).length - empfehlungen.length,
      metrics: {
        provider: 'claude',
        model: modell,
        antwortzeit: Date.now() - startTime,
        tokensInput: (response.usage && response.usage.input_tokens) || 0,
        tokensOutput: (response.usage && response.usage.output_tokens) || 0,
        kosten: calculateCost(response.usage, modell)
      }
    };
  } catch (error) {
    console.error('[claude] Fehler:', error.message);
    return createFallbackResponse(error.message, startTime);
  }
}

// ==========================================
// PROMPT
// ==========================================

function buildUserPrompt(query, produkte, personalisierung, kontext) {
  let prompt = `SUCHANFRAGE: "${query}"\n\n`;

  if (kontext.budget) {
    const waehrung = kontext.waehrung || 'CHF';
    prompt += `BUDGET: maximal ${kontext.budget} ${waehrung}. `;
    prompt += `Nichts darueber empfehlen (Regel B).\n`;
  } else {
    prompt += `BUDGET: nicht genannt.\n`;
  }

  if (kontext.zweck) prompt += `ZWECK: ${kontext.zweck}\n`;
  if (kontext.land) prompt += `LAND: ${kontext.land}\n`;
  if (kontext.kategorie) prompt += `KATEGORIE: ${kontext.kategorie}\n`;

  prompt += `\nVERFUEGBARE PRODUKTE - waehle nur aus dieser Liste und gib die produkt_id zurueck:\n`;

  produkte.slice(0, MAX_PRODUKTE_IM_PROMPT).forEach((p) => {
    prompt += `\n[${p.id}] ${p.title || p.name || 'ohne Titel'}\n`;
    prompt += `   Preis: ${p.price || 'unbekannt'}\n`;
    const info = p.shopInfo;
    if (info && info.bekannt) {
      prompt += `   Shop: ${info.name} (${info.land || '?'}, Qualitaet: ${info.qualitaet}`;
      prompt += info.abgewertet ? ', ABGEWERTET wegen Meldungen)\n' : ')\n';
    } else {
      prompt += `   Shop: ${p.source || p.shop || 'unbekannt'} (UNBEKANNT - nicht in der Shop-Datenbank)\n`;
    }
    // Die Stufe kommt aus dem Controller (shopStufe). Sie hier als
    // Zahl hinzuschreiben ist wirksamer als jede Bitte im Regeltext:
    // das Modell kann sie vergleichen, statt sie zu erraten.
    if (typeof p.shopStufe === 'number') {
      prompt += `   SHOP-STUFE: ${p.shopStufe} (1 ist am besten, 6 am schlechtesten)\n`;
    }
    // ---------- Produktwissen ----------
    // Bauform, Akkulaufzeit, Sterneverteilung und echte
    // Bewertungstexte. NUR was hier steht, darfst du behaupten -
    // alles andere wird nachher automatisch gestrichen.
    if (p.wissenText) {
      prompt += `   GESICHERTE ANGABEN:\n`;
      for (const zeile of String(p.wissenText).split('\n')) {
        if (zeile.trim()) prompt += `     ${zeile.trim()}\n`;
      }
    }

    if (p.rating) prompt += `   Bewertung: ${p.rating}`;
    if (p.rating && p.reviews) prompt += ` aus ${p.reviews} Bewertungen`;
    if (p.rating) prompt += `\n`;
  });

  if (personalisierung && personalisierung.aktiv) {
    prompt += `\nNUTZER-PRAEFERENZEN (schwaecher als Budget und Zweck):\n`;
    if (personalisierung.topMarken && personalisierung.topMarken.length) {
      prompt += `- Marken: ${personalisierung.topMarken.join(', ')}\n`;
    }
    if (personalisierung.topShops && personalisierung.topShops.length) {
      prompt += `- Shops: ${personalisierung.topShops.join(', ')}\n`;
    }
  }

  prompt += `\nGib maximal 3 Empfehlungen zurueck, als reines JSON.`;
  return prompt;
}

// ==========================================
// API-AUFRUF
// ==========================================

async function callClaudeAPI(apiKey, userPrompt, modell, retryCount = 0) {
  try {
    const response = await axios.post(
      CLAUDE_CONFIG.apiUrl,
      {
        model: modell || CLAUDE_CONFIG.model,
        max_tokens: CLAUDE_CONFIG.maxTokens,
        // Prompt-Caching: der feste Regeltext wird nur einmal bezahlt
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: [
          { role: 'user', content: userPrompt },
          // Vorgabe der ersten Zeichen: erzwingt JSON statt Einleitungssatz
          { role: 'assistant', content: '{' }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        timeout: CLAUDE_CONFIG.timeout
      }
    );

    return response.data;
  } catch (error) {
    if (retryCount < CLAUDE_CONFIG.maxRetries) {
      const wiederholbar =
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        (error.response && (error.response.status === 429 || error.response.status >= 500));

      if (wiederholbar) {
        console.log(`[claude] Wiederholung ${retryCount + 1}/${CLAUDE_CONFIG.maxRetries}`);
        await sleep(1000 * (retryCount + 1));
        return callClaudeAPI(apiKey, userPrompt, modell, retryCount + 1);
      }
    }

    if (error.response) {
      const status = error.response.status;
      const message =
        (error.response.data && error.response.data.error && error.response.data.error.message) ||
        error.message;

      if (status === 401) throw new Error('Claude API: Ungueltiger API Key');
      if (status === 429) throw new Error('Claude API: Rate Limit erreicht');
      if (status === 400) throw new Error(`Claude API: Ungueltige Anfrage - ${message}`);
      throw new Error(`Claude API Fehler (${status}): ${message}`);
    }

    throw error;
  }
}

// ==========================================
// ANTWORT PARSEN
// ==========================================

function parseClaudeResponse(response) {
  const leer = { empfehlungen: [], zusammenfassung: '' };

  try {
    let text = (response.content && response.content[0] && response.content[0].text) || '';
    if (!text) return leer;

    // Die Antwort beginnt wegen der Vorgabe ohne die erste Klammer
    if (!text.trimStart().startsWith('{')) {
      text = '{' + text;
    }

    // Markdown-Zaeune entfernen, falls das Modell sie doch setzt
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    try {
      return JSON.parse(text);
    } catch (e) {
      // Zweiter Versuch: von der ersten bis zur letzten Klammer
      const von = text.indexOf('{');
      const bis = text.lastIndexOf('}');
      if (von !== -1 && bis > von) {
        return JSON.parse(text.slice(von, bis + 1));
      }
      console.warn('[claude] Antwort enthaelt kein gueltiges JSON');
      return leer;
    }
  } catch (error) {
    console.error('[claude] Parse-Fehler:', error.message);
    return leer;
  }
}

// ==========================================
// HILFSFUNKTIONEN
// ==========================================

function calculateCost(usage, modell) {
  if (!usage) return 0;
  const preise = PREISE_PRO_MTOK[modell] || PREISE_PRO_MTOK.standard;
  const input = ((usage.input_tokens || 0) / 1000000) * preise.input;
  const output = ((usage.output_tokens || 0) / 1000000) * preise.output;
  return Math.round((input + output) * 1000000) / 1000000;
}

function createFallbackResponse(grund, startTime) {
  return {
    success: false,
    error: grund,
    empfehlungen: [],
    zusammenfassung: '',
    warnung: null,
    alternativVorschlag: null,
    metrics: {
      provider: 'claude',
      antwortzeit: startTime ? Date.now() - startTime : 0,
      fehler: true,
      grund
    }
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function healthCheck() {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) return { healthy: false, reason: 'API Key nicht konfiguriert' };

    await axios.post(
      CLAUDE_CONFIG.apiUrl,
      {
        model: CLAUDE_CONFIG.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        timeout: 10000
      }
    );

    return { healthy: true, model: CLAUDE_CONFIG.model };
  } catch (error) {
    return { healthy: false, reason: error.message };
  }
}

module.exports = {
  promptVersion,
  // Fuer den Konsens: damit jedes Modell GENAU denselben Auftrag
  // bekommt. Verschiedene Prompts waeren kein Konsens, sondern
  // zwei verschiedene Fragen.
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseClaudeResponse,
  getProductRecommendation,
  healthCheck,
  CLAUDE_CONFIG,
  MODELL_SCHNELL,
  MODELL_STARK,
  PREISE_PRO_MTOK
};