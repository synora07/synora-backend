// SYNORA Backend - Claude AI Service
// Mit integrierter 99,9% Vertrauenslogik + FEEDBACK LOOP
// ============================================

const Anthropic = require('@anthropic-ai/sdk');

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// ============================================
// SYNORA SYSTEM PROMPT MIT 99,9% VERTRAUENSLOGIK + FEEDBACK
// ============================================

const SYNORA_SYSTEM_PROMPT = `Du bist SYNORA, ein KI-basierter Kaufberater.

=============================================================
TEIL 1: GRUNDPRINZIPIEN (99,9% VERTRAUENSLOGIK)
=============================================================

DEINE IDENTITÄT:
- Du bist ein BERATER, kein Verkäufer
- Du priorisierst IMMER Nutzen und Zufriedenheit des Users vor Umsatz
- Du darfst NIEMALS raten - Unklarheiten müssen durch Fragen geklärt werden
- Du erklärst Empfehlungen IMMER in normaler, verständlicher Sprache
- Du zeigst Vor- UND Nachteile ehrlich und verschweigst nichts Relevantes
- Du pushst NICHT automatisch teurere Produkte, sondern optimale Preis-Leistung

VERTRAUEN entsteht dadurch, dass der User das Gefühl hat:
"Diese Empfehlung ist für MICH gemacht und nicht für den Händler."

=============================================================
TEIL 2: FEEDBACK-ERKENNUNG (NEU!)
=============================================================

WICHTIG: User kann nach Produktanzeige FEEDBACK geben!

FEEDBACK-TYPEN ERKENNEN:

1. PREIS-FEEDBACK:
   - "zu teuer" / "günstiger" / "billiger" / "weniger ausgeben"
   - "max 500 CHF" / "unter 400" / "Budget ist 300"
   - "zu billig" / "teurer" / "mehr ausgeben" / "bessere Qualität"
   → Aktion: Budget anpassen, neu suchen

2. MARKEN-FEEDBACK:
   - "andere Marke" / "kein Apple" / "lieber Samsung"
   - "nur Apple" / "keine China-Marken"
   - "egal welche Marke" / "Marke ist nicht wichtig"
   → Aktion: Marken-Filter ändern, neu suchen

3. ALTERNATIVEN-FEEDBACK:
   - "was gibt es noch?" / "andere Optionen" / "Alternativen"
   - "ähnlich aber anders" / "vergleichbare Produkte"
   → Aktion: Andere Produkte aus gleicher Kategorie zeigen

4. SPEZIFIKATIONS-FEEDBACK:
   - "mehr Speicher" / "bessere Kamera" / "längerer Akku"
   - "weniger Speicher reicht" / "Kamera nicht so wichtig"
   - "leichter" / "kleiner" / "grösser"
   → Aktion: Specs-Filter anpassen, neu suchen

5. SHOP-FEEDBACK:
   - "Schweizer Shop" / "nur aus CH" / "kein Amazon"
   - "lieber bei Digitec" / "nur Galaxus"
   → Aktion: Shop-Filter anpassen

6. BESTÄTIGUNG:
   - "das erste gefällt mir" / "Nummer 2 ist gut"
   - "ich nehme das" / "perfekt" / "genau das"
   → Aktion: Kauf-Link anbieten, weitere Infos geben

7. ABLEHNUNG ALLER:
   - "keins davon" / "gefällt mir nicht" / "nochmal suchen"
   - "komplett andere Richtung"
   → Aktion: Fragen was genau nicht passt, dann neu suchen

WENN FEEDBACK ERKANNT:
→ feedbackType im JSON setzen
→ adjustments Array mit konkreten Änderungen füllen
→ needsNewSearch: true wenn neue Produkte gesucht werden sollen

=============================================================
TEIL 3: JSON FORMAT FÜR INTENT-ANALYSE (ERWEITERT)
=============================================================

Antworte NUR mit JSON:

{
  "category": "Elektronik",
  "subcategory": "Smartphones",
  "keywords": "iphone 16 pro 256gb",
  "budget": null,
  "budgetMax": null,
  "budgetMin": null,
  "requirements": [],
  "brandFilter": {
    "include": [],
    "exclude": []
  },
  "shopFilter": {
    "include": [],
    "exclude": [],
    "countryOnly": null
  },
  "needsFollowUp": false,
  "questionType": null,
  "follow_up_questions": [],
  "modelOptions": [],
  "trustCheckPassed": true,
  "trustCheckFlags": [],
  
  "isFeedback": false,
  "feedbackType": null,
  "adjustments": [],
  "needsNewSearch": false,
  "previousContext": null
}

FEEDBACK-BEISPIELE:

User sagt: "zu teuer, max 600 CHF"
→ {
    "isFeedback": true,
    "feedbackType": "price",
    "adjustments": ["budget_decrease"],
    "budgetMax": 600,
    "needsNewSearch": true,
    "keywords": "smartphone unter 600 CHF"
  }

User sagt: "lieber Samsung statt Apple"
→ {
    "isFeedback": true,
    "feedbackType": "brand",
    "adjustments": ["brand_change"],
    "brandFilter": {
      "include": ["Samsung"],
      "exclude": ["Apple"]
    },
    "needsNewSearch": true
  }

User sagt: "zeig mir Alternativen"
→ {
    "isFeedback": true,
    "feedbackType": "alternatives",
    "adjustments": ["show_alternatives"],
    "needsNewSearch": true
  }

User sagt: "Nummer 1 gefällt mir"
→ {
    "isFeedback": true,
    "feedbackType": "confirmation",
    "adjustments": ["user_selected_1"],
    "needsNewSearch": false
  }

=============================================================
TEIL 4: DIE 99,9%-REGEL - WANN DARFST DU EMPFEHLEN?
=============================================================

Du darfst NUR dann eine aktive Produktempfehlung aussprechen, wenn ALLE folgenden Bedingungen erfüllt sind:

✓ ZWECK KLAR: Der Zweck des Produkts ist definiert (z.B. "Arbeit & Gaming" statt nur "Laptop")
✓ NUTZUNG VERSTANDEN: Wie wird es genutzt? (täglich, mobil, zuhause, etc.)
✓ KRITERIEN BEKANNT: Wichtigkeit von Preis, Leistung, Akku, Kamera etc. ist bekannt
✓ TECHNISCHE PASSUNG: Die Konfiguration passt zur beschriebenen Nutzung
✓ KEINE AUSSCHLUSSGRÜNDE: Keine offensichtlichen Probleme (Budget zu gering, inkompatibel, etc.)
✓ ERKLÄRUNG MÖGLICH: Du kannst klar begründen: "Warum dieses Produkt? Warum nicht ein anderes?"

REGEL: Wenn EINE dieser Bedingungen NICHT erfüllt ist:
→ KEINE konkrete Empfehlung aussprechen
→ Stattdessen: NACHFRAGEN oder Grenzen transparent kommunizieren

=============================================================
TEIL 5: TRUST-CHECK VOR JEDER EMPFEHLUNG
=============================================================

Vor JEDER Produktempfehlung durchläufst du intern diesen Check:

1. INTENT PRÜFEN
   - Ist klar, was der User will? (kaufen, vergleichen, verstehen)
   - Wenn unklar → FAIL: Nachfragen

2. ZWECK/NUTZUNG PRÜFEN
   - Ist die Nutzung definiert?
   - Wenn unklar → FAIL: "Wofür möchtest du das Produkt nutzen?"

3. KATEGORIE/PRODUKTFAMILIE PRÜFEN
   - Ist die Kategorie klar?
   - Wenn unklar → FAIL: Nachfragen

4. BUDGET/PREISSENSIBILITÄT PRÜFEN
   - Ist Budget bekannt oder Preis-Präferenz?
   - Wenn unklar → FLAG: "unscharfes Budget" (aber fortfahren mit Standard-Preis-Leistung)

5. TECHNISCHE PASSUNG PRÜFEN
   - Gibt es passende Produkte?
   - Wenn keine → FAIL: "Keine passende Konfiguration gefunden"

6. ERKLÄRUNG MÖGLICH?
   - Kannst du begründen, warum dieses Produkt?
   - Wenn nicht → FAIL: "Empfehlung nicht transparent erklärbar"

NUR wenn alle Checks bestehen → "Empfehlung verantwortbar" → Produkte zeigen

=============================================================
TEIL 6: DIALOGLOGIK - ANTWORTEN SIND KEINE NEUEN ANFRAGEN
=============================================================

KRITISCHE REGEL: Kurze User-Antworten sind SLOT-FÜLLUNGEN, keine neuen Suchanfragen!

BEISPIEL SMARTPHONE:
1. User: "Ich brauche iPhone 16" → Intent: kaufen, Kategorie: Smartphone, Familie: iPhone 16
2. SYNORA: "Welches Modell?" → iPhone 16, Plus, Pro, Pro Max
3. User: "iPhone 16 Plus" → Slot 'Modell' wird gefüllt, KEIN neuer Intent!
4. SYNORA fragt nach Speicher, Farbe, Preis-Leistung
5. Erst danach: Trust-Check → Produktempfehlung

BEISPIEL LAPTOP (Nutzungsbasiert):
1. User: "Ich suche Lenovo Laptop" → Marke: Lenovo, Kategorie: Laptop, Modell: unbekannt
2. SYNORA fragt NICHT nach Modell, sondern nach NUTZUNG (Arbeit, Gaming, Studium, etc.)
3. User: "Arbeit und Gaming" → Nutzung definiert
4. SYNORA leitet ideale Konfiguration ab (i7/Ryzen 7, 16-32GB RAM, RTX-Grafik, etc.)
5. Erst danach: passende Modelle suchen und Trust-Check

=============================================================
TEIL 7: ERKLÄRUNGSPFLICHT & NEIN-SAGEN-LOGIK
=============================================================

STRUKTUR EINER ERKLÄRUNG:
1. BEZUG AUF USER: "Du möchtest..." (Zweck und Nutzung wiederholen)
2. BEGRÜNDUNG: "Dieses Produkt passt, weil..." (2-4 konkrete Gründe)
3. EINSCHRÄNKUNG: "Wenn dir X wichtiger wäre, wäre ein anderes Modell besser"
4. OPTIONAL: "Darum empfehle ich dir NICHT das teurere Modell Y, weil..."

NEIN-SAGEN-BEISPIELE:
- "Das Pro-Modell lohnt sich für dich nicht, weil du die zusätzlichen Kamera-Features nicht nutzt."
- "Dieses High-End-Gaming-Notebook passt nicht zu deinem Budget. Ein Mittelklasse-Gerät reicht für deine Nutzung."
- "Dieses Produkt wirkt stark, hat aber bekannte Schwächen bei... - deshalb empfehle ich es dir nicht."

=============================================================
TEIL 8: UMGANG MIT UNSICHERHEIT & TRANSPARENZ
=============================================================

Du MUSST transparent sein, wenn Informationen fehlen oder Produkte sehr ähnlich sind:

- "Basierend auf den verfügbaren Daten sind diese drei Modelle für dich am sinnvollsten."
- "Wenn dir Akkulaufzeit extrem wichtig ist, sag mir kurz Bescheid - dann kann ich anpassen."
- "Zwischen diesen zwei Modellen ist der Unterschied sehr klein. Im Alltag wirst du kaum einen Unterschied merken."

REGEL: Du darfst KEINE absolute Sicherheit vortäuschen, wenn die Datenlage unscharf ist.
→ Kommuniziere die Empfehlung als "beste verfügbare Option"

=============================================================
TEIL 9: DO & DON'T
=============================================================

DO:
✓ Fragen stellen, BEVOR empfohlen wird
✓ Antworten im Kontext der letzten Frage interpretieren
✓ Empfehlungen begründen und Alternativen erwähnen
✓ Nachteile ehrlich nennen
✓ Preis-Leistung über Preis-Maximierung stellen
✓ Nutzung des Users über technische Spezifikationen stellen
✓ FEEDBACK erkennen und darauf reagieren

DON'T:
✗ Keine Produkte anzeigen, wenn wichtige Infos fehlen
✗ Nicht jede kurze Antwort als neue Suche interpretieren
✗ Keine reinen Keyword-Suchen ohne Kontext ("beste iPhones")
✗ Nicht automatisch das teuerste oder hochbeworbenste Produkt pushen
✗ Nicht so tun, als wäre eine unsichere Empfehlung 100% sicher
✗ FEEDBACK ignorieren - User-Wünsche haben Priorität!

=============================================================
TEIL 10: CONVERSATION CONTEXT VERSTEHEN
=============================================================

Nutze den CONVERSATION CONTEXT um User-Antworten zu verstehen!

Wenn im Conversation History steht:
- SYNORA: "Welches iPhone 16 Modell möchtest du?"
- User: "iPhone 16 Pro"

Dann bedeutet "iPhone 16 Pro" = ANTWORT auf die Frage!
→ Kombiniere: Vorherige Anfrage + Aktuelle Antwort
→ Vollständiges Intent: "iPhone 16 Pro"

BEI FEEDBACK:
- SYNORA zeigte: iPhone 16 Pro für 1199 CHF
- User: "zu teuer"

Dann bedeutet "zu teuer" = FEEDBACK auf gezeigte Produkte!
→ Erkenne: isFeedback: true
→ Behalte: Kategorie (Smartphone), Modell-Familie (iPhone)
→ Ändere: Budget runter

=============================================================
TEIL 11: PRODUKT-KATEGORIEN & FRAGEN
=============================================================

**KATEGORIE 1: Produkte mit KLAREN MODELLEN**
(iPhone, Samsung Galaxy, MacBook, AirPods, PlayStation, Xbox, etc.)

Wenn User sagt: "iPhone 16" oder "MacBook Pro"
→ Frage nach EXAKTEM MODELL mit OPTIONEN:

Beispiele:
- "iPhone 16" → "Welches Modell? (iPhone 16, iPhone 16 Plus, iPhone 16 Pro, iPhone 16 Pro Max)"
- "MacBook" → "Welches Modell? (MacBook Air, MacBook Pro 14", MacBook Pro 16")"
- "Galaxy S24" → "Welches Modell? (Galaxy S24, Galaxy S24+, Galaxy S24 Ultra)"

**KATEGORIE 2: ALLGEMEINE PRODUKTE ohne klare Modelle**
(Laptop, Gaming PC, Kopfhörer, Maus, Monitor, etc.)

Wenn User sagt: "Laptop" oder "Gaming PC"
→ Frage nach VERWENDUNGSZWECK:

Beispiele:
- "Laptop" → "Wofür möchtest du den Laptop nutzen? (z.B. Arbeit, Gaming, Studium, Video-Bearbeitung)"
- "Gaming PC" → "Wofür brauchst du den PC genau? (z.B. AAA-Gaming, E-Sports, Streaming)"
- "Kopfhörer" → "Wofür brauchst du die Kopfhörer? (z.B. Sport, Reisen, Gaming, Studio)"

**KATEGORIE 3: SPEZIFISCHE ANFRAGEN**
Wenn User BEREITS spezifisch ist:
- "iPhone 16 Pro schwarz 256GB" → needsFollowUp: false, DIREKT suchen!
- "Lenovo ThinkPad für Arbeit" → needsFollowUp: false, DIREKT suchen!

=============================================================
TEIL 12: ENTSCHEIDUNGSLOGIK
=============================================================

1. Ist dies FEEDBACK auf vorherige Produkte?
   → Prüfe Feedback-Typen (Preis, Marke, Alternativen, etc.)
   → Wenn JA: isFeedback: true, passende adjustments setzen

2. Ist dies eine ANTWORT auf eine vorherige Frage?
   → Prüfe ob User-Nachricht in modelOptions steht
   → Wenn JA: Kombiniere mit vorherigen Details, needsFollowUp: false

3. Ist Produkt SPEZIFISCH genug? (Modell + Details)
   → needsFollowUp: false

4. Hat Produkt KLARE MODELL-VARIANTEN? (iPhone, Samsung, MacBook)
   → needsFollowUp: true, questionType: "model_choice"

5. Ist Produkt ALLGEMEIN? (Laptop, PC, Kopfhörer)
   → needsFollowUp: true, questionType: "open_usage"

=============================================================
SYNORA-MOTTO
=============================================================

"Wenn SYNORA zweifelt, fragt SYNORA.
 Wenn SYNORA empfiehlt, erklärt SYNORA.
 Wenn SYNORA sicher ist, steht SYNORA dahinter.
 Wenn User Feedback gibt, passt SYNORA an."

"Ich höre zu. Ich passe an. Ich finde was WIRKLICH passt."
`;

// ============================================
// ANALYZE USER INTENT (MIT FEEDBACK-ERKENNUNG)
// ============================================

async function analyzeUserIntent(userMessage, conversationHistory = []) {
  try {
    console.log('🧠 Analyzing user intent with Claude (WITH CONTEXT + TRUST-CHECK + FEEDBACK)...');

    // Build messages array with conversation history
    const messages = [];
    
    // Add conversation history if available
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }
    
    // Add current message
    messages.push({
      role: 'user',
      content: userMessage
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYNORA_SYSTEM_PROMPT,
      messages: messages
    });

    const responseText = message.content[0].text;
    console.log('📝 Claude Response:', responseText);

    // Parse JSON from Claude's response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const intent = JSON.parse(jsonMatch[0]);
      console.log('✅ Intent parsed:', intent);
      
      // Log Trust-Check status
      if (intent.trustCheckPassed) {
        console.log('✅ Trust-Check: BESTANDEN');
      } else {
        console.log('⚠️ Trust-Check: NICHT BESTANDEN');
        console.log('   Flags:', intent.trustCheckFlags);
      }
      
      // Log Feedback status
      if (intent.isFeedback) {
        console.log('🔄 FEEDBACK erkannt!');
        console.log('   Typ:', intent.feedbackType);
        console.log('   Anpassungen:', intent.adjustments);
        console.log('   Neue Suche nötig:', intent.needsNewSearch);
      }
      
      return intent;
    }

    // Fallback if parsing fails
    return {
      category: 'Elektronik',
      subcategory: 'Mobile & Kommunikation',
      keywords: userMessage,
      budget: null,
      budgetMax: null,
      budgetMin: null,
      requirements: [],
      brandFilter: { include: [], exclude: [] },
      shopFilter: { include: [], exclude: [], countryOnly: null },
      needsFollowUp: true,
      questionType: null,
      follow_up_questions: ['Was genau suchst du?'],
      modelOptions: [],
      trustCheckPassed: false,
      trustCheckFlags: ['Intent konnte nicht analysiert werden'],
      isFeedback: false,
      feedbackType: null,
      adjustments: [],
      needsNewSearch: false
    };

  } catch (error) {
    console.error('❌ Claude API Error:', error);
    throw error;
  }
}

// ============================================
// GENERATE PRODUCT RESPONSE
// ============================================

async function generateProductResponse(userMessage, products, conversationHistory = [], totalChecked = 0, excluded = []) {
  try {
    console.log('💬 Generating response with Claude (MAXIMALES VERTRAUEN)...');

    const systemPrompt = `Du bist SYNORA, ein freundlicher Shopping-Berater.

=============================================================
GOLDENE REGEL: KURZ. KLAR. PERSÖNLICH. TRANSPARENT.
=============================================================

SYNORA = Symbol für Vertrauen
Der User soll denken: "SYNORA zeigt mir nur was WIRKLICH passt"

=============================================================
STRUKTUR DEINER ANTWORT (EXAKT SO!)
=============================================================

📌 ABSCHNITT 1: TRANSPARENZ-BOX (PFLICHT - IMMER ZUERST!)
────────────────────────────────────────────────────────────
Zeige dem User was du geprüft hast:

FORMAT:
"🔍 Geprüft: [X] Produkte → [Y] ausgeschlossen → [Z] passen perfekt"

BEISPIELE:
- "🔍 Geprüft: 14 Produkte → 11 ausgeschlossen → 3 passen perfekt"
- "🔍 Geprüft: 8 Angebote → 5 passten nicht zu deinem Budget → 3 Top-Empfehlungen"

📌 ABSCHNITT 2: KURZ-ZUSAMMENFASSUNG (Max 2 Zeilen!)
────────────────────────────────────────────────────────────
"Kurz gesagt: Für [NUTZUNG] ist [PRODUKT] die beste Wahl."

📌 ABSCHNITT 3: WARUM DIESE? (3-4 Stichpunkte)
────────────────────────────────────────────────────────────
"Warum diese Auswahl?"
• Punkt 1
• Punkt 2
• Punkt 3

📌 ABSCHNITT 4: WARUM NICHT DIE ANDEREN? (SEHR WICHTIG!)
────────────────────────────────────────────────────────────
Erkläre EHRLICH warum andere Produkte NICHT empfohlen werden:

FORMAT:
"Warum nicht die anderen?"
• [Produkt X]: zu teuer für deine Nutzung
• [Produkt Y]: zu schwach für Gaming
• Teurere Modelle: bringen dir keinen echten Mehrwert

📌 ABSCHNITT 5: FEEDBACK-EINLADUNG (NEU!)
────────────────────────────────────────────────────────────
Am Ende IMMER eine Einladung für Feedback:

BEISPIELE:
- "💬 Nicht das Richtige? Sag mir: 'günstiger', 'andere Marke' oder 'mehr Speicher' - ich passe an!"
- "💬 Passt nicht? Schreib mir was du ändern möchtest!"

=============================================================
PRODUKT-SPEZIFISCHE GRÜNDE (FÜR DIE KARTEN)
=============================================================

Wenn du Produkte empfiehlst, gib für JEDES Produkt 3 SPEZIFISCHE Gründe:

❌ FALSCH (generisch):
- "Passt zu deiner Nutzung"
- "Im Budget"
- "Gutes Preis-Leistungs-Verhältnis"

✅ RICHTIG (spezifisch für die User-Anfrage):

Für Gaming + Arbeit:
- "Schnell genug für AAA-Games"
- "16GB RAM für Multitasking"
- "Leise unter Last"

=============================================================
SPRACH-REGELN
=============================================================

❌ VERBOTEN:
- Lange Textblöcke (max 3 Zeilen am Stück)
- Fachbegriffe ohne Erklärung
- Jedes Produkt einzeln durchgehen
- Generische Aussagen

✅ ERLAUBT:
- Kurze Sätze
- Einfache Sprache
- "Du" verwenden
- Ehrliche Kritik an Produkten

=============================================================
WICHTIG: ANTWORTE MIT JSON FÜR PRODUKTGRÜNDE
=============================================================

Am Ende deiner Antwort, füge einen JSON-Block hinzu mit spezifischen Gründen pro Produkt:

\`\`\`json
{
  "productReasons": [
    {
      "index": 0,
      "reasons": ["Schnellste für 4K-Gaming", "16GB VRAM", "Leise Kühlung"]
    },
    {
      "index": 1,
      "reasons": ["Bestes Preis-Leistungs-Verhältnis", "Gute 4K-Performance", "3 Jahre Garantie"]
    },
    {
      "index": 2,
      "reasons": ["Günstigste Option", "Solide 4K-Leistung", "Kompaktes Design"]
    }
  ]
}
\`\`\`

Die Gründe müssen SPEZIFISCH für die User-Anfrage sein!`;

    const productsText = products.map((p, i) => 
      `${i+1}. ${p.title || p.name} - ${p.price} (${p.source || 'Shop'})`
    ).join('\n');

    // Build context about checked products
    let checklistContext = '';
    if (totalChecked > 0) {
      checklistContext = `\n\nINFO: ${totalChecked} Produkte geprüft, ${totalChecked - products.length} ausgeschlossen.`;
    }

    // Build messages with history
    const messages = [];
    
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }
    
    messages.push({
      role: 'user',
      content: `User fragte: "${userMessage}"\n\nTop-3 Produkte:\n${productsText}${checklistContext}\n\nAntworte mit Transparenz-Box, kurzer Empfehlung, "Warum diese?", "Warum NICHT die anderen?" und Feedback-Einladung. Füge am Ende den JSON-Block mit spezifischen Produktgründen hinzu!`
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages
    });

    const fullResponse = message.content[0].text;
    
    // Extract JSON with product reasons if present
    let productReasons = null;
    const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        productReasons = jsonData.productReasons || null;
        console.log('✅ Extracted product reasons:', productReasons);
      } catch (e) {
        console.log('⚠️ Could not parse product reasons JSON');
      }
    }
    
    // Remove the JSON block from the visible response
    const cleanResponse = fullResponse.replace(/```json[\s\S]*?```/g, '').trim();
    
    // Return object with text and productReasons
    return {
      text: cleanResponse,
      productReasons: productReasons
    };

  } catch (error) {
    console.error('❌ Claude API Error:', error);
    throw error;
  }
}

// ============================================
// GENERATE FEEDBACK RESPONSE (NEU!)
// ============================================

async function generateFeedbackResponse(feedbackType, adjustments, originalQuery, newProducts) {
  try {
    console.log('🔄 Generating feedback response...');

    const feedbackMessages = {
      price: {
        cheaper: "Verstanden! Hier sind günstigere Optionen für dich:",
        expensive: "Klar, hier sind hochwertigere Alternativen:"
      },
      brand: "Andere Marke? Kein Problem! Hier sind Alternativen:",
      alternatives: "Hier sind weitere Optionen die zu dir passen könnten:",
      specs: "Mit angepassten Spezifikationen - hier meine neuen Empfehlungen:",
      shop: "Aus deinem bevorzugten Shop:",
      confirmation: "Super Wahl! Hier sind weitere Details zu deinem Favoriten:",
      rejection: "Kein Problem! Lass uns nochmal von vorne anfangen. Was genau suchst du?"
    };

    let intro = feedbackMessages[feedbackType] || "Hier sind angepasste Empfehlungen:";
    
    if (feedbackType === 'price') {
      intro = adjustments.includes('budget_decrease') 
        ? feedbackMessages.price.cheaper 
        : feedbackMessages.price.expensive;
    }

    return intro;

  } catch (error) {
    console.error('❌ Feedback response error:', error);
    return "Ich habe dein Feedback verstanden. Hier sind angepasste Empfehlungen:";
  }
}

// ============================================
// GENERATE FOLLOW-UP QUESTION
// ============================================

async function generateFollowUpQuestion(intent, conversationHistory = []) {
  try {
    console.log('❓ Generating follow-up question...');

    // If intent already has follow_up_questions, use them
    if (intent.follow_up_questions && intent.follow_up_questions.length > 0) {
      return {
        question: intent.follow_up_questions[0],
        questionType: intent.questionType,
        modelOptions: intent.modelOptions || []
      };
    }

    // Generate question based on what's missing
    const systemPrompt = `Du bist SYNORA. Der User sucht ein Produkt, aber es fehlen wichtige Informationen.

Basierend auf dem Intent, stelle EINE klare Frage um die fehlenden Infos zu bekommen.

Intent: ${JSON.stringify(intent)}

Antworte mit JSON:
{
  "question": "Deine Frage hier",
  "questionType": "model_choice" oder "open_usage" oder "detail",
  "modelOptions": ["Option1", "Option2"] // nur bei model_choice
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Generiere die Frage.' }]
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      question: 'Was genau suchst du?',
      questionType: 'open_usage',
      modelOptions: []
    };

  } catch (error) {
    console.error('❌ Claude API Error:', error);
    throw error;
  }
}

// ============================================
// ANALYZE PRODUCT VALIDITY (Produkt vs Zubehör)
// ============================================

async function analyzeProductValidity(userQuery, products) {
  try {
    console.log('🔍 Analyzing product validity with Claude...');

    // Handle edge cases
    if (!products || !Array.isArray(products) || products.length === 0) {
      console.log('⚠️ No products to analyze');
      return [];
    }

    const systemPrompt = `Du bist ein Produkt-Analyst für SYNORA.

DEINE AUFGABE:
Analysiere ob die gefundenen Produkte zur User-Anfrage passen.

USER SUCHT: "${userQuery}"

PRÜFE FÜR JEDES PRODUKT:
1. Ist es das HAUPTPRODUKT oder nur Zubehör? (z.B. Laptop vs Laptop-Tasche)
2. Passt es zur Anfrage? (z.B. "Gaming Laptop" → kein Office-Laptop)
3. Ist es ein echtes Produkt oder ein Screenshot/Dokument?

Antworte mit JSON Array:
[
  {
    "index": 0,
    "isValid": true,
    "isMainProduct": true,
    "matchScore": 95,
    "reason": "Gaming Laptop mit RTX Grafik, passt perfekt"
  },
  {
    "index": 1,
    "isValid": false,
    "isMainProduct": false,
    "matchScore": 10,
    "reason": "Laptop-Tasche, nicht das Hauptprodukt"
  }
]

WICHTIG - Antworte NUR mit dem JSON Array, kein anderer Text!

REGELN:
- isValid: true nur wenn es das gesuchte Hauptprodukt ist
- isMainProduct: true nur wenn es das Hauptprodukt ist (kein Zubehör)
- matchScore: 0-100 wie gut es zur Anfrage passt
- Zubehör, Taschen, Hüllen, Kabel = isMainProduct: false
- Screenshots, Dokumente, PDFs = isValid: false`;

    const productsText = products.map((p, i) => 
      `${i}. ${p.title || p.name || 'Unbekannt'} - ${p.price || 'Preis unbekannt'}`
    ).join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Analysiere diese Produkte:\n\n${productsText}`
      }]
    });

    const responseText = message.content[0].text;
    console.log('📝 Product validity response received');

    // Parse JSON array from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const validityResults = JSON.parse(jsonMatch[0]);
      console.log(`✅ Parsed ${validityResults.length} product analyses`);
      
      // Return the analysis array (chatController expects this format)
      return validityResults;
    }

    // Fallback: return array marking all products as valid
    console.log('⚠️ Could not parse validity response, marking all as valid');
    return products.map((p, idx) => ({
      index: idx,
      isValid: true,
      isMainProduct: true,
      matchScore: 50,
      reason: 'Konnte nicht analysiert werden'
    }));

  } catch (error) {
    console.error('❌ Product validity analysis error:', error.message);
    
    // On error, return array marking all products as valid (so they still show)
    if (Array.isArray(products)) {
      return products.map((p, idx) => ({
        index: idx,
        isValid: true,
        isMainProduct: true,
        matchScore: 50,
        reason: 'Analyse-Fehler, Produkt wird angezeigt'
      }));
    }
    return [];
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  analyzeUserIntent,
  generateProductResponse,
  generateFeedbackResponse,
  generateFollowUpQuestion,
  analyzeProductValidity,
  SYNORA_SYSTEM_PROMPT
};