// ============================================
// SYNORA V2.0 - CHAT CONTROLLER
// Hauptlogik für Suchanfragen und Empfehlungen
// ============================================

'use strict';

// ==========================================
// IMPORTS
// ==========================================

const { asyncHandler, AppError, ValidationError } = require('../middleware/errorHandler');

// Lazy-loaded Services
let serpApiService, consensusService, shopDatabase;
let ChatHistory, UserPreferences, FehlerLog, Analytics;

const getServices = () => {
  if (!serpApiService) serpApiService = require('../services/serpApiService');
  if (!consensusService) consensusService = require('../services/consensusService');
  if (!shopDatabase) shopDatabase = require('../services/shopDatabasePart3');
  return { serpApiService, consensusService, shopDatabase };
};

const getModels = () => {
  if (!ChatHistory) ChatHistory = require('../models/ChatHistory');
  if (!UserPreferences) UserPreferences = require('../models/UserPreferences');
  if (!FehlerLog) FehlerLog = require('../models/FehlerLog');
  if (!Analytics) Analytics = require('../models/Analytics');
  return { ChatHistory, UserPreferences, FehlerLog, Analytics };
};

// ==========================================
// HILFSFUNKTIONEN
// ==========================================

/**
 * Generiert Session-ID für Gäste
 */
function generiereSessionId() {
  return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Extrahiert Kategorie aus Anfrage
 */
function extrahiereKategorie(anfrage) {
  const anfrageLC = anfrage.toLowerCase();
  
  // Elektronik
  if (/smartphone|handy|iphone|samsung galaxy|pixel/i.test(anfrageLC)) return 'smartphones';
  if (/laptop|notebook|macbook|thinkpad/i.test(anfrageLC)) return 'laptops';
  if (/monitor|bildschirm|display/i.test(anfrageLC)) return 'monitore';
  if (/tv|fernseher|oled|qled/i.test(anfrageLC)) return 'tv';
  if (/kopfhörer|headphone|airpods|earbuds|lautsprecher/i.test(anfrageLC)) return 'audio';
  if (/gaming|playstation|xbox|nintendo|controller/i.test(anfrageLC)) return 'gaming';
  if (/kamera|foto|objektiv|canon|nikon|sony alpha/i.test(anfrageLC)) return 'foto';
  if (/smart ?home|hue|alexa|google home/i.test(anfrageLC)) return 'smarthome';
  if (/staubsauger|kaffeemaschine|küche/i.test(anfrageLC)) return 'haushalt';
  if (/smartwatch|fitness ?tracker|garmin/i.test(anfrageLC)) return 'wearables';
  if (/router|nas|netzwerk|switch/i.test(anfrageLC)) return 'netzwerk';
  if (/gpu|grafikkarte|cpu|prozessor|ram|ssd|mainboard/i.test(anfrageLC)) return 'komponenten';
  
  // Kosmetik
  if (/parfum|duft|eau de/i.test(anfrageLC)) return 'parfuem';
  if (/hautpflege|creme|serum|moisturizer/i.test(anfrageLC)) return 'hautpflege';
  if (/makeup|lippenstift|mascara|foundation/i.test(anfrageLC)) return 'makeup';
  if (/shampoo|haarpflege|conditioner/i.test(anfrageLC)) return 'haarpflege';
  
  // Kleidung
  if (/kleid|bluse|rock|damen/i.test(anfrageLC)) return 'damen';
  if (/hemd|anzug|herren/i.test(anfrageLC)) return 'herren';
  if (/sneaker|schuhe|boots|sandalen/i.test(anfrageLC)) return 'schuhe';
  if (/sportbekleidung|laufschuhe|fitness/i.test(anfrageLC)) return 'sport';
  
  // Fallback
  return 'allgemein';
}

/**
 * Filtert Produkte nach Shop-Qualität
 */
function filtereProdukte(produkte, personalisierung = null) {
  const services = getServices();
  
  return produkte.filter(p => {
    const shopName = (p.shop || p.source || '').toLowerCase();
    
    // Blacklist prüfen
    if (services.shopDatabase.isBlacklisted(shopName)) {
      return false;
    }
    
    // Personalisierung: Problem-Shops vermeiden
    if (personalisierung?.aktiv && personalisierung.shopMalus?.[shopName] > 15) {
      return false;
    }
    
    return true;
  });
}

/**
 * Sortiert Produkte mit Personalisierung
 */
function sortiereProdukte(produkte, personalisierung = null) {
  if (!personalisierung?.aktiv) {
    return produkte;
  }
  
  return produkte.map(p => {
    let bonus = 0;
    const shopName = (p.shop || p.source || '').toLowerCase();
    
    // Shop-Bonus
    if (personalisierung.shopBonus?.[shopName]) {
      bonus += personalisierung.shopBonus[shopName];
    }
    
    // Marken-Bonus
    const produktName = (p.name || p.title || '').toLowerCase();
    for (const marke of (personalisierung.markenBonus || [])) {
      if (produktName.includes(marke.marke.toLowerCase())) {
        bonus += marke.score;
      }
    }
    
    return { ...p, personalisierungsBonus: bonus };
  }).sort((a, b) => b.personalisierungsBonus - a.personalisierungsBonus);
}

// ==========================================
// CONTROLLER FUNKTIONEN
// ==========================================

/**
 * Hauptsuche: Produkte suchen und Empfehlungen generieren
 * 
 * POST /api/chat/search
 */
const sucheProdukte = asyncHandler(async (req, res) => {
  const services = getServices();
  const models = getModels();
  
  const { anfrage, sessionId } = req.body;
  const userId = req.user?.id || null;
  const userSessionId = sessionId || generiereSessionId();
  
  // Validierung
  if (!anfrage || typeof anfrage !== 'string' || anfrage.trim().length < 2) {
    throw new ValidationError('Bitte gib eine Suchanfrage ein (mind. 2 Zeichen)');
  }
  
  const startZeit = Date.now();
  
  // 1. Konversation erstellen/finden
  let chat = await models.ChatHistory.getAktive(userSessionId, userId);
  
  if (!chat) {
    chat = await models.ChatHistory.neueKonversation(userSessionId, userId);
  }
  
  // User-Nachricht speichern
  await chat.addNachricht('user', anfrage.trim(), 'text');
  
  // 2. Kategorie erkennen
  const kategorie = extrahiereKategorie(anfrage);
  chat.kategorie = kategorie;
  
  // 3. Personalisierung laden (falls User eingeloggt)
  let personalisierung = { aktiv: false };
  
  if (userId) {
    try {
      const prefs = await models.UserPreferences.getOrCreate(userId);
      personalisierung = prefs.getPersonalisierungFuerEmpfehlung();
      
      // Suchbegriff registrieren
      await prefs.suchbegriffRegistrieren(anfrage);
      await prefs.kategorieInteresseErhoehen(kategorie, 'suche');
    } catch (error) {
      console.warn('Personalisierung laden fehlgeschlagen:', error.message);
    }
  }
  
  // 4. Produkte suchen (SerpAPI)
  console.log(`🔍 Suche: "${anfrage}" (Kategorie: ${kategorie})`);
  
  const suchErgebnis = await services.serpApiService.sucheProdukte(anfrage, {
    land: req.user?.settings?.country || 'CH',
    maxErgebnisse: 30
  });
  
  if (!suchErgebnis.erfolg || !suchErgebnis.produkte?.length) {
    await chat.addNachricht('assistant', 
      'Leider habe ich keine passenden Produkte gefunden. Versuche es mit anderen Suchbegriffen!',
      'text'
    );
    
    return res.json({
      erfolg: false,
      nachricht: 'Keine Produkte gefunden',
      sessionId: userSessionId,
      chatId: chat._id
    });
  }
  
  // 5. Produkte filtern (Blacklist, Problem-Shops)
  const gefilterteProdukte = filtereProdukte(suchErgebnis.produkte, personalisierung);
  
  if (gefilterteProdukte.length === 0) {
    await chat.addNachricht('assistant',
      'Die gefundenen Produkte kommen leider von Shops, die ich nicht empfehlen kann. Probier eine andere Suche!',
      'text'
    );
    
    return res.json({
      erfolg: false,
      nachricht: 'Keine vertrauenswürdigen Shops gefunden',
      sessionId: userSessionId,
      chatId: chat._id
    });
  }
  
  // 6. Mit Personalisierung sortieren
  const sortierteProdukte = sortiereProdukte(gefilterteProdukte, personalisierung);
  
  // 7. Consensus-Empfehlungen holen (3 KIs)
  console.log(`🤖 Starte Consensus für ${sortierteProdukte.length} Produkte...`);
  
  const consensusErgebnis = await services.consensusService.getConsensusEmpfehlungen(
    anfrage,
    sortierteProdukte,
    {
      land: req.user?.settings?.country || 'CH',
      waehrung: req.user?.settings?.currency || 'CHF',
      personalisierung
    }
  );
  
  // 8. Empfehlungen speichern
  if (consensusErgebnis.erfolg && consensusErgebnis.produkte?.length > 0) {
    await chat.setEmpfehlungen(consensusErgebnis.produkte, kategorie);
    
    // Antwort-Nachricht
    const antwortText = generiereAntwort(anfrage, consensusErgebnis, personalisierung);
    await chat.addNachricht('assistant', antwortText, 'empfehlung');
  } else {
    await chat.addNachricht('assistant',
      'Hmm, die KIs konnten sich nicht einigen. Hier sind trotzdem einige Vorschläge:',
      'text'
    );
    
    // Fallback: Erste 6 Produkte ohne Consensus
    const fallbackProdukte = sortierteProdukte.slice(0, 6).map((p, i) => ({
      rang: i + 1,
      name: p.name || p.title,
      preis: p.preis || p.price,
      shop: p.shop || p.source,
      url: p.url || p.link,
      bild: p.bild || p.thumbnail,
      synoraScore: 50,
      consensus: false,
      hinweis: '⚠️ Ohne KI-Consensus'
    }));
    
    await chat.setEmpfehlungen(fallbackProdukte, kategorie);
  }
  
  await chat.save();
  
  // 9. Analytics tracken
  try {
    await models.Analytics.trackSuche(
      anfrage,
      consensusErgebnis.produkte || [],
      Date.now() - startZeit,
      userId,
      userSessionId
    );
  } catch (error) {
    // Analytics-Fehler ignorieren
  }
  
  // 10. Response
  return res.json({
    erfolg: true,
    sessionId: userSessionId,
    chatId: chat._id,
    kategorie,
    produkte: consensusErgebnis.produkte || [],
    stats: {
      gefunden: suchErgebnis.produkte.length,
      gefiltert: gefilterteProdukte.length,
      empfohlen: consensusErgebnis.produkte?.length || 0,
      consensusErreicht: consensusErgebnis.consensusErreicht,
      dauerMs: Date.now() - startZeit
    },
    kiStatus: consensusErgebnis.kiStatus,
    personalisiert: personalisierung.aktiv
  });
});

/**
 * Generiert natürliche Antwort
 */
function generiereAntwort(anfrage, consensusErgebnis, personalisierung) {
  const anzahl = consensusErgebnis.produkte?.length || 0;
  const topProdukt = consensusErgebnis.produkte?.[0];
  
  let antwort = '';
  
  // Begrüssung
  if (consensusErgebnis.consensusErreicht) {
    antwort = `Ich habe ${anzahl} Produkte gefunden, bei denen sich meine 3 KI-Berater einig sind! 🎯\n\n`;
  } else {
    antwort = `Hier sind ${anzahl} Empfehlungen für dich:\n\n`;
  }
  
  // Top-Empfehlung
  if (topProdukt) {
    antwort += `**Meine Top-Empfehlung:** ${topProdukt.name}\n`;
    antwort += `• Preis: ${topProdukt.preis} CHF bei ${topProdukt.shop}\n`;
    antwort += `• SYNORA Score: ${topProdukt.synoraScore}/100\n`;
    
    if (topProdukt.gruende?.length > 0) {
      antwort += `• Warum: ${topProdukt.gruende.slice(0, 2).join(', ')}\n`;
    }
    
    if (topProdukt.nachteile?.length > 0) {
      antwort += `• Beachte: ${topProdukt.nachteile[0]}\n`;
    }
  }
  
  // Personalisierung-Hinweis
  if (personalisierung?.aktiv) {
    antwort += `\n✨ *Diese Empfehlungen sind auf deine Vorlieben abgestimmt.*`;
  }
  
  return antwort;
}

/**
 * Klick auf Produkt registrieren
 * 
 * POST /api/chat/click
 */
const produktKlick = asyncHandler(async (req, res) => {
  const models = getModels();
  
  const { chatId, produktIndex } = req.body;
  
  if (!chatId) {
    throw new ValidationError('Chat-ID fehlt');
  }
  
  const chat = await models.ChatHistory.findById(chatId);
  
  if (!chat) {
    throw new AppError('Chat nicht gefunden', 404);
  }
  
  // Klick registrieren
  await chat.produktGeklickt(produktIndex);
  
  // Analytics
  const produkt = chat.empfehlungen?.[produktIndex];
  if (produkt) {
    try {
      await models.Analytics.trackKlick(
        produkt,
        produktIndex,
        req.user?.id,
        chat.sessionId
      );
    } catch (error) {
      // Ignorieren
    }
  }
  
  res.json({
    erfolg: true,
    message: 'Klick registriert'
  });
});

/**
 * Bestellung bestätigen
 * 
 * POST /api/chat/confirm-purchase
 */
const bestellungBestaetigen = asyncHandler(async (req, res) => {
  const models = getModels();
  
  const { chatId, produktIndex } = req.body;
  
  if (!chatId) {
    throw new ValidationError('Chat-ID fehlt');
  }
  
  const chat = await models.ChatHistory.findById(chatId);
  
  if (!chat) {
    throw new AppError('Chat nicht gefunden', 404);
  }
  
  // Kauf registrieren
  await chat.kaufRegistrieren(produktIndex);
  await chat.kaufBestaetigen();
  
  // Personalisierung updaten
  if (req.user?.id && produktIndex !== undefined) {
    try {
      const produkt = chat.empfehlungen?.[produktIndex];
      if (produkt) {
        const prefs = await models.UserPreferences.getOrCreate(req.user.id);
        await prefs.updateShopScore(produkt.shopName, 5, 'gekauft');
        await prefs.kategorieInteresseErhoehen(chat.kategorie, 'kauf');
      }
    } catch (error) {
      console.warn('Personalisierung Update fehlgeschlagen:', error.message);
    }
  }
  
  res.json({
    erfolg: true,
    message: 'Bestellung bestätigt! Danke für dein Feedback.'
  });
});

/**
 * Fehler melden
 * 
 * POST /api/chat/report-error
 */
const fehlerMelden = asyncHandler(async (req, res) => {
  const models = getModels();
  
  const { chatId, produktIndex, fehlerTyp, beschreibung } = req.body;
  
  if (!chatId || produktIndex === undefined || !fehlerTyp) {
    throw new ValidationError('Pflichtfelder fehlen');
  }
  
  const chat = await models.ChatHistory.findById(chatId);
  
  if (!chat) {
    throw new AppError('Chat nicht gefunden', 404);
  }
  
  const produkt = chat.empfehlungen?.[produktIndex];
  
  if (!produkt) {
    throw new AppError('Produkt nicht gefunden', 404);
  }
  
  // Fehler melden
  const fehler = await models.FehlerLog.fehlerMelden({
    userId: req.user?.id,
    sessionId: chat.sessionId,
    suchanfrage: chat.suchanfrage,
    kategorie: chat.kategorie,
    empfohlenesProdukt: {
      name: produkt.produktName,
      preis: produkt.preis,
      produktUrl: produkt.produktUrl,
      synoraScore: produkt.synoraScore
    },
    empfohlenerShop: produkt.shopName,
    shopUrl: produkt.shopUrl,
    fehlerTyp,
    fehlerBeschreibung: beschreibung,
    userAgent: req.headers['user-agent']
  });
  
  // Produkt als gemeldet markieren
  if (chat.empfehlungen[produktIndex]) {
    chat.empfehlungen[produktIndex].userAktion = 'gemeldet';
    await chat.save();
  }
  
  res.json({
    erfolg: true,
    message: 'Danke für deine Meldung! Ich lerne daraus.',
    gelernt: fehler.gelernteAktion
  });
});

/**
 * Chat-Historie abrufen
 * 
 * GET /api/chat/history
 */
const getHistorie = asyncHandler(async (req, res) => {
  const models = getModels();
  
  if (!req.user?.id) {
    throw new AppError('Login erforderlich', 401);
  }
  
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  
  const historie = await models.ChatHistory.getHistorie(req.user.id, limit);
  
  res.json({
    erfolg: true,
    chats: historie
  });
});

/**
 * Einzelnen Chat abrufen
 * 
 * GET /api/chat/:id
 */
const getChat = asyncHandler(async (req, res) => {
  const models = getModels();
  
  const chat = await models.ChatHistory.findById(req.params.id);
  
  if (!chat) {
    throw new AppError('Chat nicht gefunden', 404);
  }
  
  // Berechtigung prüfen
  if (chat.userId && chat.userId.toString() !== req.user?.id) {
    throw new AppError('Kein Zugriff auf diesen Chat', 403);
  }
  
  res.json({
    erfolg: true,
    chat
  });
});

/**
 * Feedback verarbeiten (Bestellfrage/Zufriedenheit)
 * 
 * POST /api/chat/:id/feedback
 */
const feedbackVerarbeiten = asyncHandler(async (req, res) => {
  const models = getModels();
  
  const { typ, antwort, details } = req.body;
  
  if (!typ || !antwort) {
    throw new ValidationError('Typ und Antwort erforderlich');
  }
  
  const chat = await models.ChatHistory.findById(req.params.id);
  
  if (!chat) {
    throw new AppError('Chat nicht gefunden', 404);
  }
  
  await chat.feedbackVerarbeiten(typ, antwort, details);
  
  res.json({
    erfolg: true,
    message: 'Danke für dein Feedback!'
  });
});

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  sucheProdukte,
  produktKlick,
  bestellungBestaetigen,
  fehlerMelden,
  getHistorie,
  getChat,
  feedbackVerarbeiten
};