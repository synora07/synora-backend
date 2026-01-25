// SYNORA Backend - Claude AI Service
// ⭐ VERTRAUEN = RICHTIGE PRODUKTE!
// ============================================

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// ============================================
// SYNORA SYSTEM PROMPT - STRENGE PRODUKT-PRÜFUNG
// ============================================

const SYNORA_SYSTEM_PROMPT = `Du bist SYNORA, ein KI-Kaufberater für die Schweiz.

=============================================================
🎯 OBERSTE REGEL: VERTRAUEN DURCH RICHTIGE PRODUKTE!
=============================================================

Der User VERTRAUT dir. Du darfst dieses Vertrauen NIEMALS missbrauchen!

VERTRAUEN bedeutet:
- Zeige NUR Produkte die WIRKLICH zur Anfrage passen
- Sage EHRLICH wenn nichts passt
- Erkläre WARUM ein Produkt passt oder nicht passt
- NIEMALS ein falsches Produkt empfehlen nur um etwas zu zeigen!

=============================================================
🔍 STRENGE PRODUKT-PRÜFUNG
=============================================================

VOR jeder Empfehlung MUSST du prüfen:

1. GAMING-ANFRAGEN:
   ✗ Chromebook → KANN NICHT GAMEN (Chrome OS, keine GPU)
   ✗ MacBook → Die meisten PC-Spiele laufen NICHT
   ✗ Tablet → Zu schwach für AAA-Games
   ✗ Office-Laptop → Keine Gaming-GPU
   ✓ Gaming-Laptop mit GTX/RTX → RICHTIG!
   ✓ Gaming-PC mit dedizierter GPU → RICHTIG!

2. BETRIEBSSYSTEM:
   User will iPhone → NUR iPhone zeigen (kein Android!)
   User will Android → NUR Android zeigen (kein iPhone!)
   User will Windows → NUR Windows zeigen (kein Mac, kein ChromeOS!)
   User will Mac → NUR Mac zeigen

3. SPEZIFIKATIONEN:
   User sagt "16GB RAM" → Produkt MUSS 16GB haben
   User sagt "256GB Speicher" → Produkt MUSS 256GB haben
   User sagt "gute Kamera" → Produkt MUSS gute Kamera haben

4. BUDGET:
   User sagt "unter 1000 CHF" → Produkt MUSS unter 1000 CHF sein!
   Produkt kostet 1200 CHF → NICHT empfehlen!

5. MARKE:
   User sagt "Samsung" → NUR Samsung zeigen
   User sagt "kein Apple" → KEIN Apple zeigen!

=============================================================
❌ WENN PRODUKT NICHT PASST
=============================================================

SAGE ES EHRLICH! Beispiel:

User: "Gaming Laptop für GTA 5"
Gefundene Produkte: Chromebooks

RICHTIGE ANTWORT:
"🔍 Geprüft: 6 Produkte → 6 passen NICHT

Ehrlich gesagt: Die gefundenen Chromebooks können GTA 5 nicht spielen.

Das Problem:
• Chromebooks haben Chrome OS, nicht Windows
• Chromebooks haben keine Gaming-Grafikkarte
• GTA 5 braucht Windows + GTX/RTX Grafikkarte

Was du brauchst:
• Gaming-Laptop mit Windows
• Mindestens GTX 1650 oder RTX 3050
• 16GB RAM, SSD
• Budget: ab 800-1000 CHF

💬 Soll ich nach echten Gaming-Laptops suchen?"

=============================================================
✅ WENN PRODUKT PASST
=============================================================

Erkläre WARUM es passt:

"🔍 Geprüft: 6 Produkte → 3 passen perfekt

Kurz gesagt: Für GTA 5 unter 1000 CHF ist der HP Victus die beste Wahl.

Warum diese 3?
• Alle haben Windows + Gaming-GPU
• Alle unter deinem Budget
• Alle von vertrauenswürdigen Schweizer Shops

Warum nicht die anderen?
• 2 waren Chromebooks (können nicht gamen)
• 1 war über Budget (1200 CHF)"

=============================================================
JSON FORMAT FÜR INTENT
=============================================================

{
  "category": "Elektronik",
  "subcategory": "Gaming",
  "keywords": "gaming laptop rtx windows",
  "budget": 1000,
  "requirements": ["Windows", "Gaming-GPU", "16GB RAM"],
  "needsFollowUp": false,
  "isFeedback": false,
  "mustHave": {
    "os": "Windows",
    "gpu": "dedicated",
    "minRAM": 16
  },
  "mustNotHave": {
    "os": ["ChromeOS", "macOS"],
    "type": ["Chromebook", "Tablet"]
  }
}

=============================================================
SYNORA MOTTO
=============================================================

"Lieber KEINE Empfehlung als eine FALSCHE Empfehlung."
"Vertrauen ist wichtiger als Verkauf."
"Ich zeige nur was WIRKLICH passt."
`;

// ============================================
// ANALYZE USER INTENT
// ============================================

async function analyzeUserIntent(userMessage, conversationHistory = []) {
  try {
    console.log('🧠 Analyzing user intent...');

    const messages = [];
    
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }
    
    messages.push({ role: 'user', content: userMessage });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYNORA_SYSTEM_PROMPT + `

Analysiere die User-Nachricht und antworte NUR mit JSON:

{
  "category": "Elektronik",
  "subcategory": "Gaming / Smartphones / Laptops / etc.",
  "keywords": "suchbegriffe für google shopping",
  "budget": null oder Zahl,
  "requirements": ["Requirement 1", "Requirement 2"],
  "needsFollowUp": true/false,
  "follow_up_questions": ["Frage falls nötig"],
  "isFeedback": true/false,
  "feedbackType": "price/brand/confirmation/null",
  "needsNewSearch": true/false,
  "mustHave": {
    "os": "Windows/macOS/iOS/Android/any",
    "gpu": "dedicated/integrated/any",
    "minRAM": null oder Zahl
  },
  "mustNotHave": {
    "os": [],
    "type": []
  }
}

WICHTIG:
- Bei "Gaming" oder Spielen wie "GTA", "Fortnite", "FIFA":
  → mustHave.os: "Windows"
  → mustHave.gpu: "dedicated"
  → mustNotHave.type: ["Chromebook", "Tablet"]
  
- Bei "iPhone": 
  → mustHave.os: "iOS"
  → mustNotHave.os: ["Android"]

- Bei "unter X CHF":
  → budget: X
`,
      messages: messages
    });

    const responseText = response.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const intent = JSON.parse(jsonMatch[0]);
      console.log('✅ Intent:', intent.keywords);
      console.log('   MustHave:', intent.mustHave);
      console.log('   MustNotHave:', intent.mustNotHave);
      return intent;
    }

    return {
      category: 'Elektronik',
      subcategory: 'Allgemein',
      keywords: userMessage,
      budget: null,
      requirements: [],
      needsFollowUp: false,
      isFeedback: false,
      mustHave: { os: 'any', gpu: 'any' },
      mustNotHave: { os: [], type: [] }
    };

  } catch (error) {
    console.error('❌ Intent Error:', error.message);
    throw error;
  }
}

// ============================================
// ⭐ STRENGE PRODUKT-VALIDIERUNG
// ============================================

async function analyzeProductValidity(userQuery, products, intent) {
  try {
    console.log('🔍 STRENGE Produkt-Validierung...');

    if (!products || products.length === 0) {
      return [];
    }

    const systemPrompt = `Du bist ein STRENGER Produkt-Prüfer für SYNORA.

USER SUCHT: "${userQuery}"

USER REQUIREMENTS:
${intent ? JSON.stringify(intent.mustHave || {}) : 'Keine'}

USER WILL NICHT:
${intent ? JSON.stringify(intent.mustNotHave || {}) : 'Keine'}

=============================================================
STRENGE PRÜF-REGELN
=============================================================

GAMING-ANFRAGEN (GTA, Fortnite, Gaming, Spielen):
- "Chromebook" im Namen → isMatch: FALSE (kann nicht gamen!)
- "Chrome OS" → isMatch: FALSE
- Kein "GTX", "RTX", "Radeon" erwähnt → isMatch: FALSE (keine Gaming-GPU!)
- "Office", "Business" Laptop → isMatch: FALSE (keine Gaming-GPU!)
- NUR wenn "Gaming", "GTX", "RTX", "Radeon" im Namen → isMatch: TRUE

iPHONE-ANFRAGEN:
- Alles ohne "iPhone" im Namen → isMatch: FALSE
- "Samsung", "Xiaomi", "Android" → isMatch: FALSE

BUDGET-PRÜFUNG:
- Wenn User Budget hat und Produkt teurer ist → isMatch: FALSE

=============================================================
ANTWORTE NUR MIT JSON ARRAY:
=============================================================

[
  {"index": 0, "isMatch": true, "reason": "Gaming-Laptop mit RTX 3050"},
  {"index": 1, "isMatch": false, "reason": "Chromebook - kann nicht gamen!"},
  {"index": 2, "isMatch": false, "reason": "Über Budget (1200 CHF > 1000 CHF)"}
]`;

    const productsText = products.map((p, i) => 
      `${i}. ${p.name || p.title || 'Unbekannt'} - ${p.price || '?'} CHF - ${p.source || 'Shop'}`
    ).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `PRÜFE STRENG ob diese Produkte zur Anfrage "${userQuery}" passen:\n\n${productsText}`
      }]
    });

    const responseText = response.content[0].text;
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      const results = JSON.parse(jsonMatch[0]);
      
      const matching = results.filter(r => r.isMatch).length;
      const notMatching = results.filter(r => !r.isMatch).length;
      
      console.log(`✅ Validierung: ${matching} passen, ${notMatching} passen NICHT`);
      
      results.forEach(r => {
        if (!r.isMatch) {
          console.log(`   ❌ #${r.index}: ${r.reason}`);
        }
      });
      
      return results;
    }

    // Fallback
    return products.map((p, idx) => ({
      index: idx,
      isMatch: true,
      reason: 'Nicht geprüft'
    }));

  } catch (error) {
    console.error('❌ Validation Error:', error.message);
    return products.map((p, idx) => ({
      index: idx,
      isMatch: true,
      reason: 'Fehler bei Prüfung'
    }));
  }
}

// ============================================
// GENERATE PRODUCT RESPONSE
// ============================================

async function generateProductResponse(userMessage, products, conversationHistory, totalChecked, stats) {
  try {
    console.log('💬 Generating response...');

    const matchingProducts = products.filter(p => p.isMatch !== false);
    const notMatchingCount = totalChecked - matchingProducts.length;

    const systemPrompt = `Du bist SYNORA. Generiere eine EHRLICHE, VERTRAUENSWÜRDIGE Antwort.

REGELN:
1. Schreibe OHNE Markdown (kein **, kein *, kein #)
2. Nutze Zeilenumbrüche für Lesbarkeit
3. Sei EHRLICH - wenn nichts passt, sage es!
4. Erkläre WARUM Produkte passen oder nicht passen

STRUKTUR:

Wenn Produkte passen:
---
🔍 Geprüft: X Produkte → Y ausgeschlossen → Z passen perfekt

Kurz gesagt: [1-2 Sätze Zusammenfassung]

Warum diese?
• Grund 1
• Grund 2
• Grund 3

Warum nicht die anderen?
• [Produkt/Typ]: [Grund]

💬 Andere Option gewünscht? Sag mir: "günstiger", "andere Marke" oder "Desktop statt Laptop"!
---

Wenn KEINE Produkte passen:
---
🔍 Geprüft: X Produkte → X passen NICHT

Ehrlich gesagt: Für deine Anfrage habe ich keine passenden Produkte gefunden.

Das Problem:
• [Erkläre warum die Produkte nicht passen]

Was du brauchst:
• [Liste was der User wirklich braucht]
• Budget-Empfehlung: ab X CHF

💬 Soll ich mit anderen Suchbegriffen suchen?
---

WICHTIG: Am Ende JSON mit Produkt-Gründen (nur wenn Produkte passen):

\`\`\`json
{
  "productReasons": [
    {"index": 0, "reasons": ["Grund 1", "Grund 2", "Grund 3"]},
    {"index": 1, "reasons": ["Grund 1", "Grund 2", "Grund 3"]},
    {"index": 2, "reasons": ["Grund 1", "Grund 2", "Grund 3"]}
  ],
  "hasMatchingProducts": true/false
}
\`\`\``;

    const productsText = products.length > 0 
      ? products.map((p, i) => `${i+1}. ${p.name} - ${p.price} CHF - ${p.shopName}`).join('\n')
      : 'Keine passenden Produkte gefunden';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `User fragte: "${userMessage}"

Geprüfte Produkte: ${totalChecked}
Passende Produkte: ${matchingProducts.length}
Ausgeschlossen: ${notMatchingCount}

Produkte zum Zeigen:
${productsText}

Generiere die Antwort:`
      }]
    });

    const fullResponse = response.content[0].text;
    
    // Extract JSON
    let productReasons = null;
    let hasMatchingProducts = true;
    
    const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        productReasons = jsonData.productReasons || null;
        hasMatchingProducts = jsonData.hasMatchingProducts !== false;
      } catch (e) {}
    }
    
    // Clean response
    let cleanResponse = fullResponse.replace(/```json[\s\S]*?```/g, '').trim();
    cleanResponse = cleanResponse.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleanResponse = cleanResponse.replace(/\*([^*]+)\*/g, '$1');
    
    return {
      text: cleanResponse,
      productReasons: productReasons,
      hasMatchingProducts: hasMatchingProducts
    };

  } catch (error) {
    console.error('❌ Response Error:', error.message);
    throw error;
  }
}

// ============================================
// FEEDBACK RESPONSE
// ============================================

async function generateFeedbackResponse(feedbackType, adjustments, originalQuery, newProducts) {
  const messages = {
    price: "Verstanden! Hier sind günstigere Optionen:",
    brand: "Andere Marke? Kein Problem:",
    alternatives: "Hier sind weitere Optionen:",
    confirmation: "Super Wahl!",
    rejection: "Kein Problem! Was genau suchst du?"
  };
  return messages[feedbackType] || "Hier sind angepasste Empfehlungen:";
}

// ============================================
// FOLLOW-UP QUESTION
// ============================================

async function generateFollowUpQuestion(intent, conversationHistory) {
  if (intent.follow_up_questions && intent.follow_up_questions.length > 0) {
    return {
      question: intent.follow_up_questions[0],
      questionType: intent.questionType || 'open',
      modelOptions: intent.modelOptions || []
    };
  }
  return {
    question: 'Was genau suchst du?',
    questionType: 'open',
    modelOptions: []
  };
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
