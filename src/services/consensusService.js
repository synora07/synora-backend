// ============================================
// SYNORA V2.0 - CONSENSUS SERVICE
// 3-KI-Voting System: Claude + ChatGPT + Perplexity
// Mind. 2 von 3 Stimmen für Empfehlung
// ============================================

'use strict';

// ==========================================
// IMPORTS
// ==========================================

let claudeService, openaiService, perplexityService, Analytics;

// Lazy Loading um zirkuläre Dependencies zu vermeiden
const getServices = () => {
  if (!claudeService) claudeService = require('./claudeService');
  if (!openaiService) openaiService = require('./openaiService');
  if (!perplexityService) perplexityService = require('./perplexityService');
  return { claudeService, openaiService, perplexityService };
};

const getAnalytics = () => {
  if (!Analytics) {
    try {
      Analytics = require('../models/Analytics');
    } catch (error) {
      Analytics = { trackConsensus: () => {} };
    }
  }
  return Analytics;
};

// ==========================================
// KONFIGURATION
// ==========================================

const CONFIG = {
  // Minimum Stimmen für Konsens
  minVotes: 2,
  
  // Timeout pro KI (in ms)
  kiTimeout: 30000,
  
  // Parallel oder sequenziell?
  parallelAusfuehrung: true,
  
  // Gewichtung der KIs (optional)
  gewichtung: {
    claude: 1.2,     // Claude leicht bevorzugt (als Hauptsystem)
    chatgpt: 1.0,
    perplexity: 1.0
  },
  
  // Fallback wenn KI nicht antwortet
  fallbackAktiv: true
};

// ==========================================
// HILFSFUNKTIONEN
// ==========================================

/**
 * Promise mit Timeout
 */
function mitTimeout(promise, ms, fallbackWert = null) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), ms)
  );
  
  return Promise.race([promise, timeout]).catch(() => fallbackWert);
}

/**
 * Produkte normalisieren für Vergleich
 */
function normalisiereProdukt(produkt) {
  if (!produkt) return null;
  
  return {
    name: (produkt.name || produkt.title || '').toLowerCase().trim(),
    preis: parseFloat(produkt.preis || produkt.price) || 0,
    shop: (produkt.shop || produkt.source || '').toLowerCase().trim()
  };
}

/**
 * Ähnlichkeit zwischen zwei Produkten berechnen
 */
function produktAehnlichkeit(p1, p2) {
  if (!p1 || !p2) return 0;
  
  const n1 = normalisiereProdukt(p1);
  const n2 = normalisiereProdukt(p2);
  
  let score = 0;
  
  // Gleicher Shop = 30%
  if (n1.shop === n2.shop) score += 0.3;
  
  // Ähnlicher Name = bis zu 50%
  const nameWords1 = n1.name.split(/\s+/);
  const nameWords2 = n2.name.split(/\s+/);
  const gemeinsam = nameWords1.filter(w => nameWords2.includes(w)).length;
  const maxWords = Math.max(nameWords1.length, nameWords2.length);
  if (maxWords > 0) {
    score += (gemeinsam / maxWords) * 0.5;
  }
  
  // Ähnlicher Preis (±10%) = 20%
  if (n1.preis > 0 && n2.preis > 0) {
    const diff = Math.abs(n1.preis - n2.preis);
    const avg = (n1.preis + n2.preis) / 2;
    if (diff / avg <= 0.1) score += 0.2;
  }
  
  return score;
}

/**
 * Findet übereinstimmende Produkte zwischen KI-Ergebnissen
 */
function findeUebereinstimmungen(ergebnisse) {
  const { claude, chatgpt, perplexity } = ergebnisse;
  
  // Alle Produkte sammeln
  const alleProdukte = [];
  
  if (claude && Array.isArray(claude)) {
    claude.forEach((p, i) => alleProdukte.push({ ...p, quelle: 'claude', rang: i + 1 }));
  }
  
  if (chatgpt && Array.isArray(chatgpt)) {
    chatgpt.forEach((p, i) => alleProdukte.push({ ...p, quelle: 'chatgpt', rang: i + 1 }));
  }
  
  if (perplexity && Array.isArray(perplexity)) {
    perplexity.forEach((p, i) => alleProdukte.push({ ...p, quelle: 'perplexity', rang: i + 1 }));
  }
  
  // Gruppiere ähnliche Produkte
  const gruppen = [];
  const zugewiesen = new Set();
  
  for (let i = 0; i < alleProdukte.length; i++) {
    if (zugewiesen.has(i)) continue;
    
    const gruppe = {
      produkte: [alleProdukte[i]],
      quellen: new Set([alleProdukte[i].quelle])
    };
    zugewiesen.add(i);
    
    for (let j = i + 1; j < alleProdukte.length; j++) {
      if (zugewiesen.has(j)) continue;
      
      // Prüfe ob ähnlich genug
      if (produktAehnlichkeit(alleProdukte[i], alleProdukte[j]) >= 0.5) {
        gruppe.produkte.push(alleProdukte[j]);
        gruppe.quellen.add(alleProdukte[j].quelle);
        zugewiesen.add(j);
      }
    }
    
    gruppen.push(gruppe);
  }
  
  return gruppen;
}

// ==========================================
// HAUPT-FUNKTIONEN
// ==========================================

/**
 * Holt Empfehlungen von allen 3 KIs
 * 
 * @param {string} anfrage - Suchanfrage
 * @param {Array} produkte - Gefundene Produkte (von SerpAPI)
 * @param {Object} kontext - Zusätzlicher Kontext
 * @returns {Object} KI-Ergebnisse
 */
async function holeAlleKIEmpfehlungen(anfrage, produkte, kontext = {}) {
  const services = getServices();
  const startZeit = Date.now();
  
  try {
    // Prompt vorbereiten
    const prompt = erstelleEmpfehlungsPrompt(anfrage, produkte, kontext);
    
    // Alle KIs parallel abfragen
    const [claudeResult, chatgptResult, perplexityResult] = await Promise.allSettled([
      mitTimeout(
        services.claudeService.getEmpfehlungen(prompt, produkte),
        CONFIG.kiTimeout,
        { error: 'timeout', produkte: [] }
      ),
      mitTimeout(
        services.openaiService.getEmpfehlungen(prompt, produkte),
        CONFIG.kiTimeout,
        { error: 'timeout', produkte: [] }
      ),
      mitTimeout(
        services.perplexityService.getEmpfehlungen(prompt, produkte),
        CONFIG.kiTimeout,
        { error: 'timeout', produkte: [] }
      )
    ]);
    
    // Ergebnisse extrahieren
    const ergebnisse = {
      claude: claudeResult.status === 'fulfilled' ? claudeResult.value : null,
      chatgpt: chatgptResult.status === 'fulfilled' ? chatgptResult.value : null,
      perplexity: perplexityResult.status === 'fulfilled' ? perplexityResult.value : null,
      dauerMs: Date.now() - startZeit
    };
    
    // Status zählen
    ergebnisse.erfolgreich = [
      ergebnisse.claude?.produkte?.length > 0,
      ergebnisse.chatgpt?.produkte?.length > 0,
      ergebnisse.perplexity?.produkte?.length > 0
    ].filter(Boolean).length;
    
    return ergebnisse;
    
  } catch (error) {
    console.error('holeAlleKIEmpfehlungen Fehler:', error.message);
    
    return {
      claude: null,
      chatgpt: null,
      perplexity: null,
      error: error.message,
      dauerMs: Date.now() - startZeit,
      erfolgreich: 0
    };
  }
}

/**
 * Erstellt Empfehlungs-Prompt für KIs
 */
function erstelleEmpfehlungsPrompt(anfrage, produkte, kontext = {}) {
  const produktListe = produkte.slice(0, 15).map((p, i) => 
    `${i + 1}. ${p.name || p.title} - ${p.preis || p.price} CHF (${p.shop || p.source})`
  ).join('\n');
  
  return {
    anfrage,
    produkte: produktListe,
    kontext: {
      land: kontext.land || 'CH',
      waehrung: kontext.waehrung || 'CHF',
      maxProdukte: 6,
      prioritaeten: kontext.prioritaeten || ['qualität', 'preis-leistung', 'vertrauen']
    },
    instruktionen: `
Du bist ein Einkaufsberater für die Schweiz.

AUFGABE:
Wähle die besten 6 Produkte aus dieser Liste für die Anfrage: "${anfrage}"

KRITERIEN (in dieser Reihenfolge):
1. Passt zum Bedarf des Nutzers
2. Vertrauenswürdiger Shop
3. Gutes Preis-Leistungs-Verhältnis
4. Qualität des Produkts

ANTWORT FORMAT:
Gib genau 6 Produkte zurück mit dieser Struktur:
{
  "produkte": [
    {
      "rang": 1,
      "name": "Produktname",
      "preis": 123.45,
      "shop": "Shopname",
      "gruende": ["Grund 1", "Grund 2"],
      "nachteile": ["Nachteil 1"] // WICHTIG: Auch Nachteile nennen!
    }
  ]
}

WICHTIG:
- Sei EHRLICH über Vor- UND Nachteile
- Nenne nur Produkte aus der Liste
- Schweizer Shops bevorzugen (digitec.ch, galaxus.ch, brack.ch)
`
  };
}

/**
 * Führt Consensus-Voting durch
 * 
 * @param {Object} kiErgebnisse - Ergebnisse von allen KIs
 * @returns {Object} Consensus-Ergebnis
 */
async function fuehreConsensusVotingDurch(kiErgebnisse) {
  const startZeit = Date.now();
  
  try {
    // Extrahiere Produkt-Arrays
    const ergebnisse = {
      claude: kiErgebnisse.claude?.produkte || [],
      chatgpt: kiErgebnisse.chatgpt?.produkte || [],
      perplexity: kiErgebnisse.perplexity?.produkte || []
    };
    
    // Finde Übereinstimmungen
    const gruppen = findeUebereinstimmungen(ergebnisse);
    
    // Sortiere nach Anzahl Stimmen
    const mitConsensus = gruppen
      .filter(g => g.quellen.size >= CONFIG.minVotes)
      .sort((a, b) => {
        // Erst nach Stimmenanzahl
        if (b.quellen.size !== a.quellen.size) {
          return b.quellen.size - a.quellen.size;
        }
        // Dann nach durchschnittlichem Rang
        const avgRangA = a.produkte.reduce((sum, p) => sum + p.rang, 0) / a.produkte.length;
        const avgRangB = b.produkte.reduce((sum, p) => sum + p.rang, 0) / b.produkte.length;
        return avgRangA - avgRangB;
      });
    
    // Top 6 mit Consensus extrahieren
    const finalProdukte = mitConsensus.slice(0, 6).map((gruppe, index) => {
      // Bestes Produkt aus Gruppe wählen (niedrigster Rang)
      const bestes = gruppe.produkte.sort((a, b) => a.rang - b.rang)[0];
      
      return {
        rang: index + 1,
        name: bestes.name || bestes.title,
        preis: bestes.preis || bestes.price,
        shop: bestes.shop || bestes.source,
        url: bestes.url || bestes.link,
        bild: bestes.bild || bestes.thumbnail,
        gruende: bestes.gruende || bestes.reasons || [],
        nachteile: bestes.nachteile || [],
        
        // Voting-Info
        kiVotes: {
          claude: gruppe.quellen.has('claude'),
          chatgpt: gruppe.quellen.has('chatgpt'),
          perplexity: gruppe.quellen.has('perplexity')
        },
        stimmen: gruppe.quellen.size,
        consensus: gruppe.quellen.size >= CONFIG.minVotes
      };
    });
    
    // Falls zu wenige Produkte mit Consensus: Auffüllen
    if (finalProdukte.length < 6 && CONFIG.fallbackAktiv) {
      const ohneConsensus = gruppen
        .filter(g => g.quellen.size < CONFIG.minVotes)
        .sort((a, b) => {
          const avgRangA = a.produkte.reduce((sum, p) => sum + p.rang, 0) / a.produkte.length;
          const avgRangB = b.produkte.reduce((sum, p) => sum + p.rang, 0) / b.produkte.length;
          return avgRangA - avgRangB;
        });
      
      let position = finalProdukte.length + 1;
      
      for (const gruppe of ohneConsensus) {
        if (finalProdukte.length >= 6) break;
        
        const bestes = gruppe.produkte.sort((a, b) => a.rang - b.rang)[0];
        
        finalProdukte.push({
          rang: position++,
          name: bestes.name || bestes.title,
          preis: bestes.preis || bestes.price,
          shop: bestes.shop || bestes.source,
          url: bestes.url || bestes.link,
          bild: bestes.bild || bestes.thumbnail,
          gruende: bestes.gruende || [],
          nachteile: bestes.nachteile || [],
          kiVotes: {
            claude: gruppe.quellen.has('claude'),
            chatgpt: gruppe.quellen.has('chatgpt'),
            perplexity: gruppe.quellen.has('perplexity')
          },
          stimmen: gruppe.quellen.size,
          consensus: false,
          hinweis: '⚠️ Nicht alle KIs einig'
        });
      }
    }
    
    // Statistiken
    const stats = {
      produkteMitConsensus: mitConsensus.length,
      produkteOhneConsensus: gruppen.length - mitConsensus.length,
      claudeProdukte: ergebnisse.claude.length,
      chatgptProdukte: ergebnisse.chatgpt.length,
      perplexityProdukte: ergebnisse.perplexity.length,
      dauerMs: Date.now() - startZeit
    };
    
    // Analytics tracken
    try {
      const AnalyticsModel = getAnalytics();
      await AnalyticsModel.trackConsensus({
        claude: ergebnisse.claude.length > 0,
        chatgpt: ergebnisse.chatgpt.length > 0,
        perplexity: ergebnisse.perplexity.length > 0
      }, mitConsensus.length > 0, finalProdukte[0]?.name || null);
    } catch (error) {
      // Analytics-Fehler ignorieren
    }
    
    return {
      erfolg: finalProdukte.length > 0,
      produkte: finalProdukte,
      stats,
      consensusErreicht: mitConsensus.length > 0
    };
    
  } catch (error) {
    console.error('fuehreConsensusVotingDurch Fehler:', error.message);
    
    return {
      erfolg: false,
      produkte: [],
      error: error.message,
      consensusErreicht: false
    };
  }
}

/**
 * Hauptfunktion: Kompletter Consensus-Prozess
 * 
 * @param {string} anfrage - Suchanfrage
 * @param {Array} produkte - Gefundene Produkte
 * @param {Object} optionen - Optionen
 * @returns {Object} Finale Empfehlungen mit Consensus
 */
async function getConsensusEmpfehlungen(anfrage, produkte, optionen = {}) {
  const startZeit = Date.now();
  
  try {
    // Validierung
    if (!anfrage || typeof anfrage !== 'string') {
      throw new Error('Anfrage ist erforderlich');
    }
    
    if (!produkte || !Array.isArray(produkte) || produkte.length === 0) {
      throw new Error('Keine Produkte zum Bewerten');
    }
    
    console.log(`🤖 Starte Consensus für "${anfrage}" mit ${produkte.length} Produkten...`);
    
    // 1. KI-Empfehlungen holen
    const kiErgebnisse = await holeAlleKIEmpfehlungen(anfrage, produkte, optionen);
    
    console.log(`   → Claude: ${kiErgebnisse.claude?.produkte?.length || 0} Produkte`);
    console.log(`   → ChatGPT: ${kiErgebnisse.chatgpt?.produkte?.length || 0} Produkte`);
    console.log(`   → Perplexity: ${kiErgebnisse.perplexity?.produkte?.length || 0} Produkte`);
    
    // 2. Consensus-Voting
    const consensus = await fuehreConsensusVotingDurch(kiErgebnisse);
    
    console.log(`✅ Consensus: ${consensus.produkte.length} Produkte (${consensus.stats.produkteMitConsensus} mit Konsens)`);
    
    // 3. SYNORA Score berechnen
    const mitScore = consensus.produkte.map(p => ({
      ...p,
      synoraScore: berechneSynoraScore(p)
    }));
    
    return {
      erfolg: true,
      produkte: mitScore,
      stats: {
        ...consensus.stats,
        gesamtDauerMs: Date.now() - startZeit,
        kiDauerMs: kiErgebnisse.dauerMs,
        consensusDauerMs: consensus.stats.dauerMs
      },
      consensusErreicht: consensus.consensusErreicht,
      kiStatus: {
        claude: kiErgebnisse.claude?.produkte?.length > 0,
        chatgpt: kiErgebnisse.chatgpt?.produkte?.length > 0,
        perplexity: kiErgebnisse.perplexity?.produkte?.length > 0
      }
    };
    
  } catch (error) {
    console.error('getConsensusEmpfehlungen Fehler:', error.message);
    
    return {
      erfolg: false,
      produkte: [],
      error: error.message,
      stats: {
        gesamtDauerMs: Date.now() - startZeit
      },
      consensusErreicht: false
    };
  }
}

/**
 * Berechnet SYNORA Score für ein Produkt
 */
function berechneSynoraScore(produkt) {
  let score = 50; // Basis
  
  // Consensus-Bonus (bis +30)
  if (produkt.consensus) {
    score += produkt.stimmen * 10;
  }
  
  // Rang-Bonus (bis +20)
  if (produkt.rang <= 2) score += 20;
  else if (produkt.rang <= 4) score += 10;
  else score += 5;
  
  // Shop-Bonus für Schweizer Top-Shops
  const topShops = ['digitec', 'galaxus', 'brack', 'interdiscount', 'fust'];
  const shopLower = (produkt.shop || '').toLowerCase();
  if (topShops.some(s => shopLower.includes(s))) {
    score += 10;
  }
  
  // Begrenzen auf 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Fallback wenn nur eine KI antwortet
 */
async function fallbackEinzelneKI(anfrage, produkte, kiName = 'claude') {
  const services = getServices();
  
  try {
    let result;
    
    switch (kiName) {
      case 'claude':
        result = await services.claudeService.getEmpfehlungen(
          erstelleEmpfehlungsPrompt(anfrage, produkte),
          produkte
        );
        break;
      case 'chatgpt':
        result = await services.openaiService.getEmpfehlungen(
          erstelleEmpfehlungsPrompt(anfrage, produkte),
          produkte
        );
        break;
      case 'perplexity':
        result = await services.perplexityService.getEmpfehlungen(
          erstelleEmpfehlungsPrompt(anfrage, produkte),
          produkte
        );
        break;
      default:
        result = await services.claudeService.getEmpfehlungen(
          erstelleEmpfehlungsPrompt(anfrage, produkte),
          produkte
        );
    }
    
    if (!result || !result.produkte) {
      return { erfolg: false, produkte: [] };
    }
    
    // Produkte formatieren
    const formatiert = result.produkte.slice(0, 6).map((p, i) => ({
      rang: i + 1,
      name: p.name,
      preis: p.preis,
      shop: p.shop,
      url: p.url,
      bild: p.bild,
      gruende: p.gruende || [],
      nachteile: p.nachteile || [],
      kiVotes: {
        [kiName]: true
      },
      stimmen: 1,
      consensus: false,
      hinweis: `⚠️ Nur ${kiName.charAt(0).toUpperCase() + kiName.slice(1)} verfügbar`,
      synoraScore: 50 + (6 - i) * 5
    }));
    
    return {
      erfolg: true,
      produkte: formatiert,
      fallback: true,
      kiVerwendet: kiName
    };
    
  } catch (error) {
    console.error('fallbackEinzelneKI Fehler:', error.message);
    return { erfolg: false, produkte: [], error: error.message };
  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Haupt-Funktionen
  getConsensusEmpfehlungen,
  holeAlleKIEmpfehlungen,
  fuehreConsensusVotingDurch,
  
  // Hilfsfunktionen
  berechneSynoraScore,
  fallbackEinzelneKI,
  erstelleEmpfehlungsPrompt,
  
  // Für Tests
  produktAehnlichkeit,
  findeUebereinstimmungen,
  normalisiereProdukt,
  
  // Konfiguration
  CONFIG
};