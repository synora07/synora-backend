// SYNORA Backend - Claude AI Service
// ⭐ FIXED: Bessere Produkt-Passung, keine falschen Empfehlungen
// ============================================

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// ============================================
// ⭐ VERBESSERTER SYSTEM PROMPT
// ============================================

const SYNORA_SYSTEM_PROMPT = `Du bist SYNORA, ein KI-basierter Kaufberater für die Schweiz.

=============================================================
GOLDENE REGEL: RICHTIGE PRODUKTE EMPFEHLEN!
=============================================================

KRITISCH: Empfehle NUR Produkte die WIRKLICH zur Anfrage passen!

BEISPIELE WAS FALSCH IST:
❌ User fragt "Gaming Laptop" → Chromebook empfehlen (FALSCH - kann nicht gamen!)
❌ User fragt "GTA 5 spielen" → Chrome OS Gerät empfehlen (FALSCH - GTA 5 läuft nicht!)
❌ User fragt "Video schneiden" → Tablet empfehlen (FALSCH - zu schwach!)
❌ User fragt "iPhone" → Android empfehlen (FALSCH - anderes System!)

WENN KEIN PASSENDES PRODUKT GEFUNDEN:
→ Sage EHRLICH: "Für deine Anfrage habe ich leider keine passenden Produkte gefunden."
→ Erkläre WARUM: "GTA 5 braucht Windows + Gaming-GPU, Chromebooks haben das nicht."
→ Empfehle ALTERNATIVE: "Du brauchst mindestens: Gaming-Laptop mit GTX/RTX Grafik, 16GB RAM"

=============================================================
PRODUKT-PASSUNG PRÜFEN
=============================================================

VOR jeder Empfehlung prüfe:

1. BETRIEBSSYSTEM-MATCH:
   - Gaming/GTA/Steam → Windows MUSS sein (kein Chrome OS, kein macOS für die meisten Games)
   - iOS Apps → iPhone/iPad MUSS sein
   - Android Apps → Android Gerät MUSS sein

2. LEISTUNGS-MATCH:
   - Gaming → Dedizierte GPU (GTX/RTX/Radeon) MUSS sein
   - Video-Editing → 16GB+ RAM, SSD MUSS sein
   - Office → Alles OK

3. BUDGET-MATCH:
   - Gaming Laptop unter 500 CHF → UNREALISTISCH, sage es ehrlich!
   - iPhone neu unter 400 CHF → UNREALISTISCH, sage es ehrlich!

4. VERFÜGBARKEITS-MATCH:
   - Produkt existiert wirklich?
   - Preis realistisch?
   - Shop vertrauenswürdig?

=============================================================
ANTWORT-STRUKTUR
=============================================================

WENN PASSENDE PRODUKTE GEFUNDEN:

🔍 Geprüft: X Produkte → Y ausgeschlossen → Z passen perfekt

Kurz gesagt: [1-2 Sätze Zusammenfassung]

Warum diese?
• Grund 1
• Grund 2
• Grund 3

Warum nicht die anderen?
• [Produkt X]: zu teuer / zu schwach / passt nicht weil...

💬 Andere Option gewünscht? Sag mir: "günstiger", "andere Marke" oder was dir wichtig ist!

---

WENN KEINE PASSENDEN PRODUKTE:

🔍 Geprüft: X Produkte → Y ausgeschlossen → 0 passen perfekt

Kurz gesagt: Leider kann ich dir für [ANFRAGE] keine passenden Produkte empfehlen.

Das Problem:
• [Erkläre warum die gefundenen Produkte NICHT passen]
• Beispiel: "Chromebooks haben kein Windows, GTA 5 braucht aber Windows"

Meine ehrliche Empfehlung:
• Für [ANFRAGE] brauchst du mindestens: [REQUIREMENTS]
• Budget-Empfehlung: ab [MINIMUM] CHF

💬 Sag mir dein Budget und ich suche passende Alternativen!

=============================================================
JSON FORMAT FÜR INTENT-ANALYSE
=============================================================

{
  "category": "Elektronik",
  "subcategory": "Gaming",
  "keywords": "gaming laptop gtx rtx",
  "budget": 1000,
  "requirements": ["Windows", "Gaming-GPU", "16GB RAM"],
  "needsFollowUp": false,
  "isFeedback": false,
  "productRequirements": {
    "os": "Windows",
    "minRAM": 16,
    "needsGPU": true,
    "gpuType": "dedicated"
  }
}

=============================================================
FEEDBACK ERKENNEN
=============================================================

PREIS-FEEDBACK: "zu teuer", "günstiger", "max 500 CHF"
→ isFeedback: true, feedbackType: "price", needsNewSearch: true

MARKEN-FEEDBACK: "lieber Samsung", "kein Apple"
→ isFeedback: true, feedbackType: "brand", needsNewSearch: true

BESTÄTIGUNG: "das erste gefällt mir", "perfekt"
→ isFeedback: true, feedbackType: "confirmation", needsNewSearch: false

=============================================================
WICHTIG: SEI EHRLICH!
=============================================================

NIEMALS ein Produkt empfehlen das nicht passt, nur um etwas zu zeigen!
BESSER: "Ich habe nichts Passendes gefunden" als falsche Empfehlung!

Der User vertraut SYNORA. Dieses Vertrauen darf nicht missbraucht werden!
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
    
    messages.push({
      role: 'user',
      content: userMessage
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYNORA_SYSTEM_PROMPT + `

Analysiere die User-Nachricht und antworte NUR mit JSON:

{
  "category": "Elektronik",
  "subcategory": "...",
  "keywords": "suchbegriffe für google shopping",
  "budget": null oder Zahl,
  "requirements": ["Requirement 1", "Requirement 2"],
  "needsFollowUp": true/false,
  "follow_up_questions": ["Frage 1"],
  "modelOptions": ["Option 1", "Option 2"],
  "isFeedback": true/false,
  "feedbackType": "price" / "brand" / "confirmation" / null,
  "needsNewSearch": true/false,
  "productRequirements": {
    "os": "Windows" / "any" / "iOS" / "Android",
    "minRAM": null oder Zahl,
    "needsGPU": true/false,
    "gpuType": "dedicated" / "integrated" / "any"
  }
}

WICHTIG bei Gaming-Anfragen:
- "GTA 5", "Gaming", "Fortnite", etc. → os: "Windows", needsGPU: true, gpuType: "dedicated"
- Chromebooks können NICHT gamen! → Nicht empfehlen!
`,
      messages: messages
    });

    const responseText = message.content[0].text;
    console.log('📝 Claude Response:', responseText.substring(0, 200) + '...');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const intent = JSON.parse(jsonMatch[0]);
      console.log('✅ Intent parsed:', intent.keywords, intent.productRequirements);
      return intent;
    }

    // Fallback
    return {
      category: 'Elektronik',
      subcategory: 'Allgemein',
      keywords: userMessage,
      budget: null,
      requirements: [],
      needsFollowUp: true,
      follow_up_questions: ['Was genau suchst du?'],
      isFeedback: false,
      productRequirements: { os: 'any', needsGPU: false }
    };

  } catch (error) {
    console.error('❌ Claude API Error:', error);
    throw error;
  }
}

// ============================================
// ⭐ GENERATE PRODUCT RESPONSE - VERBESSERT
// ============================================

async function generateProductResponse(userMessage, products, conversationHistory = [], totalChecked = 0, perplexityStats = {}) {
  try {
    console.log('💬 Generating response...');

    const systemPrompt = `Du bist SYNORA. Generiere eine EHRLICHE Antwort.

REGELN:
1. Prüfe ob die Produkte WIRKLICH zur Anfrage passen
2. Wenn nicht → Sage es ehrlich und erkläre warum
3. Nutze KEINE Markdown-Formatierung (kein **text**, kein *text*)
4. Schreibe normalen, sauberen Text
5. Kurz und prägnant - keine langen Textwände

BEISPIEL für NICHT passende Produkte:

User fragt: "Gaming Laptop für GTA 5"
Produkte gefunden: Chromebooks

RICHTIGE ANTWORT:
"🔍 Geprüft: 6 Produkte → 6 ausgeschlossen → 0 passen perfekt

Kurz gesagt: Leider kann ich dir für GTA 5 keine der gefundenen Produkte empfehlen.

Das Problem:
• Die gefundenen Chromebooks haben Chrome OS, nicht Windows
• GTA 5 braucht Windows + dedizierte Gaming-Grafikkarte
• Chromebooks sind nur für Webbrowsing und Office geeignet

Meine ehrliche Empfehlung:
• Für GTA 5 brauchst du mindestens: Windows Laptop mit GTX 1650 oder besser, 16GB RAM
• Budget-Empfehlung: ab 800-1000 CHF für Einstiegs-Gaming

💬 Sag mir dein Budget und ich suche einen richtigen Gaming-Laptop!"

---

WICHTIG: Am Ende füge JSON mit Produkt-Gründen hinzu (aber nur wenn Produkte wirklich passen):

\`\`\`json
{
  "productReasons": [
    {"index": 0, "reasons": ["Grund 1", "Grund 2", "Grund 3"]},
    {"index": 1, "reasons": ["Grund 1", "Grund 2", "Grund 3"]}
  ],
  "productsMatch": true
}
\`\`\`

Wenn Produkte NICHT passen, setze "productsMatch": false
`;

    const productsText = products.map((p, i) => 
      `${i+1}. ${p.name || p.title} - ${p.price} - Shop: ${p.shopName || p.source}`
    ).join('\n');

    const excludedCount = perplexityStats.excluded || 0;
    const verifiedCount = perplexityStats.verified || 0;

    const messages = [];
    
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.slice(-4).forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }
    
    messages.push({
      role: 'user',
      content: `User fragte: "${userMessage}"

Gefundene Produkte (${products.length}):
${productsText}

Stats: ${totalChecked} geprüft, ${excludedCount} ausgeschlossen

WICHTIG: Prüfe ob diese Produkte WIRKLICH zur Anfrage "${userMessage}" passen!
- Wenn User "Gaming" oder Spiele wie "GTA 5" will → braucht Windows + Gaming-GPU
- Chromebooks können NICHT gamen!
- Sei EHRLICH wenn nichts passt!

Generiere die Antwort (ohne Markdown-Formatierung wie ** oder *):`
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages
    });

    const fullResponse = message.content[0].text;
    
    // Extract JSON
    let productReasons = null;
    let productsMatch = true;
    
    const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        productReasons = jsonData.productReasons || null;
        productsMatch = jsonData.productsMatch !== false;
        console.log('✅ Products match:', productsMatch);
      } catch (e) {
        console.log('⚠️ Could not parse JSON');
      }
    }
    
    // Clean response (remove JSON block)
    let cleanResponse = fullResponse.replace(/```json[\s\S]*?```/g, '').trim();
    
    // Remove any remaining markdown
    cleanResponse = cleanResponse.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleanResponse = cleanResponse.replace(/\*([^*]+)\*/g, '$1');
    cleanResponse = cleanResponse.replace(/__([^_]+)__/g, '$1');
    cleanResponse = cleanResponse.replace(/_([^_]+)_/g, '$1');
    
    return {
      text: cleanResponse,
      productReasons: productsMatch ? productReasons : null,
      productsMatch: productsMatch
    };

  } catch (error) {
    console.error('❌ Claude API Error:', error);
    throw error;
  }
}

// ============================================
// GENERATE FEEDBACK RESPONSE
// ============================================

async function generateFeedbackResponse(feedbackType, adjustments, originalQuery, newProducts) {
  const feedbackMessages = {
    price: {
      cheaper: "Verstanden! Hier sind günstigere Optionen:",
      expensive: "Klar, hier sind hochwertigere Alternativen:"
    },
    brand: "Andere Marke? Kein Problem! Hier sind Alternativen:",
    alternatives: "Hier sind weitere Optionen:",
    confirmation: "Super Wahl!",
    rejection: "Kein Problem! Was genau suchst du?"
  };

  let intro = feedbackMessages[feedbackType] || "Hier sind angepasste Empfehlungen:";
  
  if (feedbackType === 'price') {
    intro = adjustments && adjustments.includes('budget_decrease') 
      ? feedbackMessages.price.cheaper 
      : feedbackMessages.price.expensive;
  }

  return intro;
}

// ============================================
// ⭐ ANALYZE PRODUCT VALIDITY - VERBESSERT
// ============================================

async function analyzeProductValidity(userQuery, products) {
  try {
    console.log('🔍 Analyzing product validity...');

    if (!products || !Array.isArray(products) || products.length === 0) {
      return [];
    }

    const systemPrompt = `Du bist ein strenger Produkt-Prüfer für SYNORA.

USER SUCHT: "${userQuery}"

DEINE AUFGABE: Prüfe ob jedes Produkt WIRKLICH zur Anfrage passt!

STRENGE REGELN:

1. GAMING-ANFRAGEN (GTA, Fortnite, Gaming, Spielen, etc.):
   - Chromebook → isMainProduct: FALSE (Chrome OS kann keine PC-Spiele!)
   - Tablet → isMainProduct: FALSE (zu schwach für Gaming!)
   - Laptop ohne dedizierte GPU → isMainProduct: FALSE
   - NUR Gaming-Laptops mit GTX/RTX/Radeon → isMainProduct: TRUE

2. ZUBEHÖR vs HAUPTPRODUKT:
   - Laptop-Tasche wenn User "Laptop" sucht → isMainProduct: FALSE
   - Handy-Hülle wenn User "Smartphone" sucht → isMainProduct: FALSE

3. FALSCHES BETRIEBSSYSTEM:
   - User will iPhone → Android Gerät → isMainProduct: FALSE
   - User will Windows → Chromebook → isMainProduct: FALSE

Antworte NUR mit JSON Array:
[
  {"index": 0, "isMainProduct": true, "reason": "Gaming-Laptop mit RTX 3060"},
  {"index": 1, "isMainProduct": false, "reason": "Chromebook - kann nicht gamen!"}
]`;

    const productsText = products.map((p, i) => 
      `${i}. ${p.title || p.name || 'Unbekannt'} - ${p.price || '?'} - ${p.source || 'Shop'}`
    ).join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Prüfe diese Produkte STRENG:\n\n${productsText}`
      }]
    });

    const responseText = message.content[0].text;
    
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const results = JSON.parse(jsonMatch[0]);
      console.log('✅ Validity check:', results.filter(r => r.isMainProduct).length, 'von', results.length, 'passen');
      return results;
    }

    // Fallback
    return products.map((p, idx) => ({
      index: idx,
      isMainProduct: true,
      reason: 'Nicht geprüft'
    }));

  } catch (error) {
    console.error('❌ Validity check error:', error.message);
    return products.map((p, idx) => ({
      index: idx,
      isMainProduct: true,
      reason: 'Fehler bei Prüfung'
    }));
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  analyzeUserIntent,
  generateProductResponse,
  generateFeedbackResponse,
  analyzeProductValidity,
  SYNORA_SYSTEM_PROMPT
};
