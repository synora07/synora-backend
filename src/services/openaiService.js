// ============================================
// SYNORA - OpenAI Service (ChatGPT)
// Teil des 3-KI-Consensus Systems
// ============================================

const axios = require('axios');

// ==========================================
// KONFIGURATION
// ==========================================

const OPENAI_CONFIG = {
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini', // Günstig und schnell
  maxTokens: 1500,
  timeout: 30000,
  maxRetries: 2
};

// Kosten pro 1000 Tokens (USD)
const TOKEN_KOSTEN = {
  input: 0.00015,
  output: 0.0006
};

// ==========================================
// SYSTEM PROMPT
// ==========================================

const SYSTEM_PROMPT = `Du bist ein Shopping-Assistent für die Schweiz.

DEINE AUFGABE:
- Analysiere Produkte und wähle die besten aus
- Sei EHRLICH über Vor- und Nachteile
- Bevorzuge Schweizer Shops (Digitec, Galaxus, Brack)
- Warne vor unseriösen Shops

WICHTIG:
- NIEMALS empfehlen: Temu, Wish, Shein, AliExpress
- Gaming = Windows + dedizierte GPU (kein Chromebook!)
- Budget beachten!

ANTWORT FORMAT (NUR JSON):
{
  "produkte": [
    {
      "rang": 1,
      "name": "Produktname",
      "preis": 299.00,
      "shop": "Digitec",
      "gruende": ["Grund 1", "Grund 2"],
      "nachteile": ["Nachteil 1"]
    }
  ]
}`;

// ==========================================
// HAUPTFUNKTIONEN
// ==========================================

/**
 * Empfehlungen von ChatGPT holen
 */
async function getEmpfehlungen(promptData, produkte) {
  const startZeit = Date.now();
  
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('⚠️ OPENAI_API_KEY nicht konfiguriert');
      return { produkte: [], error: 'API nicht konfiguriert' };
    }
    
    // Produkte als Text formatieren
    const produktListe = produkte.slice(0, 12).map((p, i) => 
      `${i + 1}. ${p.name || p.title} - ${p.price || p.preis} CHF (${p.source || p.shop})`
    ).join('\n');
    
    const userPrompt = `
Suchanfrage: "${promptData.anfrage}"

Gefundene Produkte:
${produktListe}

Wähle die besten 6 Produkte aus. Antworte NUR mit JSON.`;

    const response = await callOpenAI(apiKey, userPrompt);
    
    // JSON parsen
    const parsed = parseResponse(response);
    
    console.log(`✅ OpenAI: ${parsed.produkte?.length || 0} Produkte (${Date.now() - startZeit}ms)`);
    
    return {
      produkte: parsed.produkte || [],
      rohAntwort: response,
      dauerMs: Date.now() - startZeit
    };
    
  } catch (error) {
    console.error('❌ OpenAI Fehler:', error.message);
    return { 
      produkte: [], 
      error: error.message,
      dauerMs: Date.now() - startZeit
    };
  }
}

/**
 * OpenAI API aufrufen
 */
async function callOpenAI(apiKey, userPrompt, retryCount = 0) {
  try {
    const response = await axios.post(
      OPENAI_CONFIG.apiUrl,
      {
        model: OPENAI_CONFIG.model,
        max_tokens: OPENAI_CONFIG.maxTokens,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: OPENAI_CONFIG.timeout
      }
    );
    
    return response.data.choices[0].message.content;
    
  } catch (error) {
    // Retry bei temporären Fehlern
    if (retryCount < OPENAI_CONFIG.maxRetries) {
      const isRetryable = 
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.response?.status === 429 ||
        error.response?.status >= 500;
      
      if (isRetryable) {
        console.log(`OpenAI Retry ${retryCount + 1}/${OPENAI_CONFIG.maxRetries}...`);
        await sleep(1000 * (retryCount + 1));
        return callOpenAI(apiKey, userPrompt, retryCount + 1);
      }
    }
    
    // Fehler Details
    if (error.response) {
      const status = error.response.status;
      if (status === 401) throw new Error('OpenAI: Ungültiger API Key');
      if (status === 429) throw new Error('OpenAI: Rate Limit erreicht');
      if (status === 400) throw new Error('OpenAI: Ungültige Anfrage');
      throw new Error(`OpenAI Fehler (${status})`);
    }
    
    throw error;
  }
}

/**
 * Response parsen
 */
function parseResponse(text) {
  try {
    // JSON aus Text extrahieren
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { produkte: [] };
  } catch (error) {
    console.error('OpenAI Parse Fehler:', error.message);
    return { produkte: [] };
  }
}

/**
 * Sleep Helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Health Check
 */
async function healthCheck() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { healthy: false, reason: 'API Key fehlt' };
    }
    
    // Minimaler Test
    await axios.post(
      OPENAI_CONFIG.apiUrl,
      {
        model: OPENAI_CONFIG.model,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Hi' }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 10000
      }
    );
    
    return { healthy: true, model: OPENAI_CONFIG.model };
    
  } catch (error) {
    return { healthy: false, reason: error.message };
  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  getEmpfehlungen,
  healthCheck,
  OPENAI_CONFIG,
  TOKEN_KOSTEN
};