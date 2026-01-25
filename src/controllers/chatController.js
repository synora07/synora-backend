// SYNORA Backend - Intelligent Chat Controller
// Mit Claude AI Integration, Perplexity Verification und echter Produktsuche
// ============================================
// NEUE 4-SCHICHTEN ARCHITEKTUR:
// 1. SYNORA System → Fakten-Layer (Shops, Preise, URLs)
// 2. Perplexity → Integrity & Reality Check
// 3. SYNORA AI → Entscheidung & Score (0-100)
// 4. Claude → Erklärung & Kommunikation
// ============================================

const { analyzeUserIntent, generateProductResponse, analyzeProductValidity, generateFeedbackResponse } = require('../services/claudeService');
const { searchRealProducts } = require('../services/serpApiService');
const perplexityService = require('../services/perplexityService'); // NEU: Perplexity
const { ELEKTRONIK_SHOPS } = require('../data/elektronikShops');
const { FASHION_SHOPS } = require('../data/fashionShops');
const { KOSMETIK_SHOPS } = require('../data/kosmetikShops');

// ============================================
// FEEDBACK SEARCH QUERY BUILDER
// ============================================
function buildFeedbackSearchQuery(intent, originalQuery) {
  let query = intent.keywords || originalQuery;
  
  // Apply budget filter
  if (intent.budgetMax) {
    query += ` unter ${intent.budgetMax} CHF`;
  }
  if (intent.budgetMin) {
    query += ` ab ${intent.budgetMin} CHF`;
  }
  
  // Apply brand filter
  if (intent.brandFilter) {
    if (intent.brandFilter.include && intent.brandFilter.include.length > 0) {
      query = `${intent.brandFilter.include[0]} ${query}`;
    }
    if (intent.brandFilter.exclude && intent.brandFilter.exclude.length > 0) {
      // Remove excluded brands from query
      intent.brandFilter.exclude.forEach(brand => {
        query = query.replace(new RegExp(brand, 'gi'), '').trim();
      });
    }
  }
  
  console.log(`🔄 Feedback-Query gebaut: "${query}"`);
  return query;
}

// Get shops based on category
function getShopsForCategory(category, subcategory) {
  let shopsData = ELEKTRONIK_SHOPS; // Default
  
  const categoryLower = (category || '').toLowerCase();
  const subcategoryLower = (subcategory || '').toLowerCase();
  const combined = `${categoryLower} ${subcategoryLower}`;
  
  // Fashion keywords
  const fashionKeywords = [
    'fashion', 'mode', 'kleidung', 'clothing', 'bekleidung',
    'jacke', 'jacket', 'mantel', 'coat', 'blazer', 'anzug', 'suit',
    'hose', 'pants', 'jeans', 'hemd', 'shirt', 'bluse', 'blouse',
    'kleid', 'dress', 'rock', 'skirt', 'pullover', 'sweater',
    'schuhe', 'shoes', 'sneaker', 'stiefel', 'boots',
    't-shirt', 'hoodie', 'sweatshirt', 'sportbekleidung',
    'herren', 'damen', 'kinder', 'baby',
    'accessoires', 'gürtel', 'belt', 'tasche', 'bag',
    'winterjacke', 'regenjacke', 'sommerjacke'
  ];
  
  // Kosmetik keywords
  const kosmetikKeywords = [
    'kosmetik', 'cosmetic', 'beauty', 'makeup', 'make-up',
    'parfüm', 'parfum', 'perfume', 'duft', 'fragrance',
    'hautpflege', 'skincare', 'creme', 'cream', 'lotion',
    'shampoo', 'conditioner', 'haarpflege', 'haircare',
    'lippenstift', 'lipstick', 'mascara', 'foundation',
    'nagellack', 'nail polish', 'serum', 'gesichtspflege'
  ];
  
  // Check for fashion
  if (fashionKeywords.some(keyword => combined.includes(keyword))) {
    console.log('👗 Kategorie erkannt: FASHION');
    shopsData = FASHION_SHOPS;
  }
  // Check for kosmetik
  else if (kosmetikKeywords.some(keyword => combined.includes(keyword))) {
    console.log('💄 Kategorie erkannt: KOSMETIK');
    shopsData = KOSMETIK_SHOPS;
  }
  // Default: Elektronik
  else {
    console.log('💻 Kategorie erkannt: ELEKTRONIK');
    shopsData = ELEKTRONIK_SHOPS;
  }

  // Return the data along with the detected subcategory for better shop selection
  return { shopsData, detectedSubcategory: subcategoryLower };
}

// Select top shops from available countries - handles ALL shop data structures
function selectTopShops(shopsResult, count = 3, userQuery = '') {
  const { shopsData, detectedSubcategory } = shopsResult;
  const allShops = [];
  const queryLower = userQuery.toLowerCase();
  
  // DIY/Components keywords for specialized electronics shops
  const diyKeywords = [
    'kondensator', 'capacitor', 'widerstand', 'resistor', 'led', 'leds',
    'ic', 'ics', 'chip', 'mikrocontroller', 'microcontroller', 'arduino',
    'raspberry', 'löt', 'solder', 'platine', 'pcb', 'breadboard',
    'transistor', 'diode', 'spule', 'inductor', 'smd', 'diy',
    'elektronik & diy', 'komponenten', 'bauteile', 'schaltung'
  ];
  
  const isDIYQuery = diyKeywords.some(kw => 
    queryLower.includes(kw) || (detectedSubcategory && detectedSubcategory.includes(kw))
  );
  
  if (isDIYQuery) {
    console.log('🔧 DIY/Komponenten erkannt - suche spezialisierte Shops');
  }
  
  // DIY/Components specialized shops to prioritize
  const diyShopNames = [
    'distrelec', 'conrad', 'farnell', 'reichelt', 'mouser', 'rs components',
    'tme', 'digi-key', 'digikey', 'arduino', 'adafruit', 'sparkfun',
    'pollin', 'elv', 'voelkner', 'pi shop', 'microspot'
  ];
  
  // Helper function to extract shops from any structure
  function extractShops(data, path = '') {
    if (!data) return;
    
    if (Array.isArray(data)) {
      data.forEach(item => {
        if (Array.isArray(item)) {
          allShops.push({
            name: item[0],
            url: item[1],
            searchUrl: `https://${item[1]}/search?q=`,
            description: item[2] || '',
            currency: 'CHF'
          });
        } else if (typeof item === 'object' && item.name) {
          allShops.push(item);
        }
      });
      return;
    }
    
    if (typeof data === 'object') {
      for (const key of Object.keys(data)) {
        // ⭐ TESTPHASE: Nur CH (Schweiz) Shops!
        if (key === 'CH') {
          const shops = data[key];
          if (Array.isArray(shops)) {
            shops.forEach(shop => {
              if (Array.isArray(shop)) {
                allShops.push({
                  name: shop[0],
                  url: shop[1],
                  searchUrl: `https://${shop[1]}/search?q=`,
                  description: shop[2] || '',
                  currency: 'CHF',
                  country: 'CH'
                });
              } else if (typeof shop === 'object' && shop.name) {
                allShops.push({ ...shop, country: 'CH' });
              }
            });
          }
        } 
        // ⭐ TESTPHASE: DE, US, IN werden ÜBERSPRUNGEN
        else if (['DE', 'US', 'IN'].includes(key)) {
          // Skip these countries in test phase
          continue;
        }
        else {
          extractShops(data[key], key);
        }
      }
    }
  }
  
  extractShops(shopsData);
  
  // Remove duplicates
  const uniqueShops = [];
  const seenNames = new Set();
  for (const shop of allShops) {
    if (!seenNames.has(shop.name)) {
      seenNames.add(shop.name);
      uniqueShops.push(shop);
    }
  }
  
  // Prioritize shops (⭐ TESTPHASE: Alle sind CH)
  let prioritized;
  if (isDIYQuery) {
    const diyShops = uniqueShops.filter(s => 
      diyShopNames.some(diy => s.name.toLowerCase().includes(diy))
    );
    const otherShops = uniqueShops.filter(s => 
      !diyShopNames.some(diy => s.name.toLowerCase().includes(diy))
    );
    
    prioritized = [...diyShops, ...otherShops];
    console.log(`🔧 DIY-Shops priorisiert: ${diyShops.map(s => s.name).slice(0, 5).join(', ')}`);
  } else {
    prioritized = uniqueShops;
  }

  console.log(`✅ ${prioritized.length} Schweizer Shops extrahiert (🇨🇭 TESTPHASE: nur CH)`);
  return prioritized.slice(0, count);
}

// Helper: Build Google Shopping URL (Fallback wenn kein direkter Link)
// ⭐ TESTPHASE: Nur Schweiz (google.ch)
function buildGoogleShoppingUrl(productName) {
  const encodedProduct = encodeURIComponent(productName);
  return `https://www.google.ch/search?q=${encodedProduct}&tbm=shop&gl=ch`;
}

// Helper: Check if price is valid
function isValidPrice(price) {
  if (!price) return false;
  
  const priceStr = String(price).trim();
  
  // Invalid prices
  if (priceStr === '' || priceStr === '1' || priceStr === '0') return false;
  if (priceStr.toLowerCase() === 'null' || priceStr.toLowerCase() === 'undefined') return false;
  
  // Extract number from price string
  const numericPrice = parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.'));
  
  // Price should be at least 2 (to filter out "1" errors)
  if (isNaN(numericPrice) || numericPrice < 2) return false;
  
  return true;
}

// Helper: Format price or show "Preis auf Anfrage"
function formatPrice(price, currency = 'CHF') {
  if (!isValidPrice(price)) {
    return 'Preis auf Anfrage';
  }
  return price;
}

// Generate product recommendations with real images
async function generateProducts(intent, selectedShops, userMessage, realProducts = null) {
  const keywords = intent.keywords || userMessage;
  const shopsToUse = selectedShops.slice(0, 3);
  
  let products = [];
  
  if (realProducts && realProducts.length > 0) {
    products = realProducts.slice(0, 3).map((product, index) => {
      const shop = shopsToUse[index] || shopsToUse[0];
      
      // Check if price is valid
      const hasValidPrice = isValidPrice(product.price);
      const displayPrice = formatPrice(product.price, shop?.currency || 'CHF');
      
      // ============================================
      // SYNORA SCORE BERECHNUNG (realistisch!)
      // ============================================
      
      // Basis-Score: 75 (nicht 85!)
      let score = 75;
      
      // +5 für Schweizer Shop
      if (shop && shop.country === 'CH') {
        score += 5;
      }
      
      // +/- für Preis-Passung
      if (intent.budget && hasValidPrice && product.price) {
        const price = parseFloat(String(product.price).replace(/[^\d.]/g, ''));
        if (price <= intent.budget * 0.5) score += 8;      // Sehr günstig
        else if (price <= intent.budget * 0.7) score += 5; // Günstig
        else if (price <= intent.budget) score += 2;       // Im Budget
        else if (price <= intent.budget * 1.2) score -= 3; // Leicht drüber
        else score -= 8;                                    // Deutlich drüber
      }
      
      // +3 für bekannte/vertrauenswürdige Shops
      const trustedShops = ['digitec', 'galaxus', 'interdiscount', 'mediamarkt', 'fust', 'brack'];
      const shopNameLower = (product.source || '').toLowerCase();
      if (trustedShops.some(s => shopNameLower.includes(s))) {
        score += 3;
      }
      
      // -5 für eBay, Ricardo (Gebraucht-Risiko)
      const riskyShops = ['ebay', 'ricardo', 'tutti', 'anibis'];
      if (riskyShops.some(s => shopNameLower.includes(s))) {
        score -= 5;
      }
      
      // +2 für Perplexity-verifiziert
      if (product.realityScore && product.realityScore >= 80) {
        score += 2;
      }
      
      // -3 wenn kein gültiger Preis
      if (!hasValidPrice) {
        score -= 3;
        console.log(`⚠️ Preis ungültig für "${product.name}"`);
      }
      
      // Kleine Variation für Unterscheidung (-2 bis +2)
      score += Math.floor(Math.random() * 5) - 2;
      
      // Score begrenzen: 60-98 (nie 100 - das wäre "perfekt")
      score = Math.max(60, Math.min(98, score));
      
      console.log(`📊 SYNORA Score für "${(product.name || '').substring(0, 30)}...": ${score}`);

      // Generate reason
      let reason = 'Hervorragendes Produkt mit ausgezeichneten Bewertungen';
      if (intent.requirements && intent.requirements.length > 0) {
        reason = `Erfüllt deine Anforderungen: ${intent.requirements.join(', ')}`;
      }
      if (intent.budget) {
        reason += `. Budget-freundlich unter ${intent.budget} CHF`;
      }
      
      // ⭐ NEU: Perplexity Verification Info hinzufügen
      if (product.verification) {
        if (product.verification.rating) {
          reason += `. Bewertung: ${product.verification.rating}`;
        }
      }

      return {
        name: product.name || product.title || `${intent.subcategory || 'Produkt'} Empfehlung`,
        shopName: product.source || shop?.name || 'Shop',
        // ⭐ DIREKT zum Produkt! SerpAPI Link verwenden, Google Shopping nur als Fallback
        shopUrl: product.link || product.url || buildGoogleShoppingUrl(product.name || product.title),
        imageUrl: product.imageUrl || product.image || `https://picsum.photos/seed/${index}/400/300`,
        price: displayPrice, // ⭐ Formatted price or "Preis auf Anfrage"
        originalPrice: isValidPrice(product.originalPrice) ? product.originalPrice : null,
        hasValidPrice: hasValidPrice, // ⭐ Flag for frontend
        score: score,
        reason: reason,
        badges: [],
        currency: shop?.currency || 'CHF',
        // ⭐ NEU: Verification Data
        verified: product.verification ? true : false,
        realityScore: product.realityScore || null,
        verificationWarnings: product.verification?.warnings || []
      };
    });
  } else {
    // Fallback: Create placeholder products
    products = shopsToUse.map((shop, index) => {
      // Fallback score: 70-85 (niedriger weil weniger Info)
      let score = 70 + Math.floor(Math.random() * 15);
      if (shop.country === 'CH') score += 3;
      score = Math.min(85, score); // Max 85 für Fallback

      let reason = 'Produkt gefunden - Details im Shop prüfen';
      if (intent.requirements && intent.requirements.length > 0) {
        reason = `Möglicherweise passend: ${intent.requirements.join(', ')}`;
      }

      return {
        name: `${intent.subcategory || 'Produkt'} Empfehlung`,
        shopName: shop.name,
        // Fallback: Google Shopping wenn kein direkter Link
        shopUrl: buildGoogleShoppingUrl(keywords),
        imageUrl: `https://picsum.photos/seed/${shop.name}-${index}/400/300`,
        price: 'Preis auf Anfrage',
        originalPrice: null,
        score: score,
        reason: reason,
        badges: [],
        currency: shop.currency || 'CHF',
        verified: false,
        realityScore: null,
        verificationWarnings: []
      };
    });
  }
  
  // Sort by score
  products.sort((a, b) => b.score - a.score);
  
  // Assign badges based on score and position
  products = products.map((product, index) => {
    const badges = [];
    
    // Score-basierte Badges
    if (product.score >= 90) badges.push('TOP');           // Sehr gut
    else if (product.score >= 80) badges.push('HIGH');     // Gut
    
    // Verifizierung Badge
    if (product.verified) badges.push('VERIFIED');
    
    // Position Badge (nur für #1)
    if (index === 0) badges.push('BESTSELLER');
    
    return { ...product, badges };
  });
  
  console.log(`📊 Produkte nach Score sortiert: ${products.map(p => `${p.score}${p.verified ? '✓' : ''}`).join(', ')}`);
  
  return products;
}

// ============================================
// MAIN CHAT HANDLER
// ============================================
const sendMessage = async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Nachricht fehlt' });
    }

    // ⭐ NEU: Guest/User Info loggen
    if (req.user) {
      console.log(`\n🔐 User: ${req.user.email || req.user.id}`);
    } else if (req.guestInfo) {
      console.log(`\n👤 Guest: Suche ${req.guestInfo.searchesUsed}/${req.guestInfo.searchesLimit}`);
    }

    console.log('\n🎯 ===== NEUE CHAT-ANFRAGE =====');
    console.log('📩 Nachricht:', message);
    console.log('📚 History:', conversationHistory ? `${conversationHistory.length} messages` : 'None');

    // ============================================
    // SCHICHT 1: SYNORA SYSTEM - Intent Analyse
    // ============================================
    console.log('\n📊 SCHICHT 1: SYNORA System - Intent-Analyse...');
    const intent = await analyzeUserIntent(message, conversationHistory || []);
    console.log('✅ Intent:', intent);

    // ============================================
    // FEEDBACK-ERKENNUNG (NEU!)
    // ============================================
    let searchQuery = intent.keywords || message;
    let feedbackIntro = null;
    
    if (intent.isFeedback) {
      console.log('\n🔄 FEEDBACK ERKANNT!');
      console.log('   Typ:', intent.feedbackType);
      console.log('   Anpassungen:', intent.adjustments);
      
      // Handle confirmation (user selected a product)
      if (intent.feedbackType === 'confirmation') {
        const confirmResponse = "Super Wahl! 🎉 Du kannst direkt auf den Shop-Link klicken um das Produkt zu kaufen. Brauchst du noch weitere Infos?";
        return res.json({
          response: confirmResponse,
          products: [],
          intent: intent,
          isFeedbackResponse: true,
          // ⭐ NEU: Guest Info
          guestInfo: req.guestInfo || null,
          isLoggedIn: !!req.user
        });
      }
      
      // Handle rejection (user doesn't like any product)
      if (intent.feedbackType === 'rejection' && !intent.needsNewSearch) {
        const rejectResponse = "Kein Problem! 💬 Was genau hat nicht gepasst? Sag mir:\n• 'günstiger' - für niedrigeres Budget\n• 'andere Marke' - z.B. Samsung statt Apple\n• 'bessere Kamera' - andere Prioritäten\n\nOder beschreib einfach was du suchst!";
        return res.json({
          response: rejectResponse,
          products: [],
          intent: intent,
          isFeedbackResponse: true,
          needsFollowUp: true,
          // ⭐ NEU: Guest Info
          guestInfo: req.guestInfo || null,
          isLoggedIn: !!req.user
        });
      }
      
      // Build new search query based on feedback
      if (intent.needsNewSearch) {
        searchQuery = buildFeedbackSearchQuery(intent, message);
        feedbackIntro = await generateFeedbackResponse(
          intent.feedbackType, 
          intent.adjustments, 
          message, 
          null
        );
        console.log('🔍 Neue Suche mit Query:', searchQuery);
      }
    }

    // Check if follow-up needed
    if (intent.needsFollowUp && intent.follow_up_questions && intent.follow_up_questions.length > 0) {
      console.log('🤔 Follow-Up Fragen nötig');
      
      const questionType = intent.questionType || 'open_usage';
      let quickReplies = null;
      
      if (questionType === 'model_choice' && intent.modelOptions && intent.modelOptions.length > 0) {
        quickReplies = intent.modelOptions;
      } else if (questionType === 'detail_questions' && intent.detailOptions) {
        quickReplies = [];
        if (intent.detailOptions.storage) quickReplies.push(...intent.detailOptions.storage);
        if (intent.detailOptions.priority) quickReplies.push(...intent.detailOptions.priority);
      }
      
      const followUpResponse = `${intent.follow_up_questions.join('\n\n')}

${quickReplies ? 'Wähle oder schreib mir deine Antwort! 💬' : 'Schreib mir einfach was du brauchst! 💬'}`;

      return res.json({
        response: followUpResponse,
        products: [],
        intent: intent,
        needsFollowUp: true,
        quickReplies: quickReplies,
        // ⭐ NEU: Guest Info
        guestInfo: req.guestInfo || null,
        isLoggedIn: !!req.user
      });
    }

    // ============================================
    // SCHICHT 1 (cont.): Shop-Auswahl
    // ============================================
    console.log('\n🏪 SCHICHT 1: Shop-Auswahl...');
    const shopsResult = getShopsForCategory(intent.category, intent.subcategory);
    const shops = selectTopShops(shopsResult, 6, message);
    console.log(`✅ ${shops.length} Top-Shops ausgewählt`);

    // ============================================
    // SCHICHT 1 (cont.): Produkte suchen (SerpAPI)
    // ============================================
    console.log('\n📸 SCHICHT 1: Echte Produktbilder suchen (SerpAPI)...');
    
    // Use feedback query if available, otherwise build from intent
    let finalSearchQuery;
    if (intent.isFeedback && intent.needsNewSearch) {
      finalSearchQuery = searchQuery; // Already built from feedback
    } else {
      finalSearchQuery = `${intent.keywords || message} ${intent.budget ? 'unter ' + intent.budget + ' CHF' : ''}`.trim();
    }
    
    console.log('🔍 Suchquery:', finalSearchQuery);
    
    let foundProducts = await searchRealProducts(finalSearchQuery, 6); // Get more for filtering
    let totalChecked = foundProducts ? foundProducts.length : 0;
    
    if (!foundProducts || foundProducts.length === 0) {
      console.log('⚠️ Keine Produkte gefunden');
      foundProducts = [];
    } else {
      console.log(`✅ ${foundProducts.length} Produkte gefunden`);
    }

    // ============================================
    // SCHICHT 2: PERPLEXITY - Reality Check ⭐ NEU!
    // ============================================
    console.log('\n🔍 SCHICHT 2: Perplexity - Integrity & Reality Check...');
    
    let verifiedProducts = foundProducts;
    let perplexityStats = { checked: 0, verified: 0, excluded: 0 };
    
    if (foundProducts.length > 0 && process.env.PERPLEXITY_API_KEY) {
      try {
        console.log(`🔎 Verifiziere ${foundProducts.length} Produkte mit Perplexity...`);
        
        // Verify each product
        const verificationsPromises = foundProducts.slice(0, 5).map(async (product) => {
          const verification = await perplexityService.verifyProduct({
            name: product.name || product.title,
            shop: product.source,
            price: product.price
          });
          
          return {
            ...product,
            verification,
            realityScore: perplexityService.calculateRealityScore(verification)
          };
        });
        
        const verifiedResults = await Promise.all(verificationsPromises);
        perplexityStats.checked = verifiedResults.length;
        
        // Filter: Keep only products that exist and are available
        verifiedProducts = verifiedResults.filter(p => {
          if (!p.verification.exists) {
            console.log(`❌ Perplexity: "${p.name}" existiert nicht`);
            perplexityStats.excluded++;
            return false;
          }
          if (!p.verification.available) {
            console.log(`❌ Perplexity: "${p.name}" nicht verfügbar`);
            perplexityStats.excluded++;
            return false;
          }
          if (p.realityScore < 50) {
            console.log(`⚠️ Perplexity: "${p.name}" Reality Score zu niedrig (${p.realityScore})`);
            perplexityStats.excluded++;
            return false;
          }
          
          console.log(`✅ Perplexity: "${p.name}" verifiziert (Score: ${p.realityScore})`);
          perplexityStats.verified++;
          return true;
        });
        
        console.log(`\n📊 Perplexity Stats: ${perplexityStats.checked} geprüft, ${perplexityStats.verified} verifiziert, ${perplexityStats.excluded} ausgeschlossen`);
        
      } catch (perplexityError) {
        console.error('⚠️ Perplexity Fehler:', perplexityError.message);
        console.log('→ Fahre ohne Perplexity-Verifizierung fort');
        verifiedProducts = foundProducts;
      }
    } else {
      if (!process.env.PERPLEXITY_API_KEY) {
        console.log('⚠️ PERPLEXITY_API_KEY nicht konfiguriert - überspringe Reality Check');
      }
    }

    // ============================================
    // SCHICHT 3: SYNORA AI - Scoring & Filterung
    // ============================================
    console.log('\n🧠 SCHICHT 3: SYNORA AI - Scoring & Filterung...');
    
    // First: Claude filters accessories
    console.log('🔍 Claude Produkt-Analyse (Produkt vs Zubehör)...');
    const productAnalysis = await analyzeProductValidity(message, verifiedProducts);
    
    // Filter accessories
    const mainProducts = verifiedProducts.filter((product, idx) => {
      const analysis = productAnalysis.find(a => a.index === idx);
      if (analysis && !analysis.isMainProduct) {
        console.log(`❌ Zubehör gefiltert: ${product.name}`);
        return false;
      }
      return true;
    });
    
    console.log(`✅ ${mainProducts.length} Hauptprodukte nach Claude-Analyse`);
    
    // Generate final products with scores
    const products = await generateProducts(intent, shops, message, mainProducts.length > 0 ? mainProducts : verifiedProducts);
    console.log(`✅ ${products.length} Produkte mit SYNORA Score generiert`);

    // ============================================
    // SCHICHT 4: CLAUDE - Erklärung & Kommunikation
    // ============================================
    console.log('\n💬 SCHICHT 4: Claude - Erklärung & Kommunikation...');
    
    // Include Perplexity stats in response generation
    const aiResponseData = await generateProductResponse(
      message, 
      products, 
      conversationHistory || [],
      totalChecked,
      perplexityStats
    );
    
    let aiResponse;
    let productReasons = null;

    if (typeof aiResponseData === 'object' && aiResponseData.text) {
      aiResponse = aiResponseData.text;
      productReasons = aiResponseData.productReasons || null;
    } else {
      aiResponse = aiResponseData;
    }
    
    // ⭐ Add feedback intro if this was a feedback-triggered search
    if (feedbackIntro) {
      aiResponse = `${feedbackIntro}\n\n${aiResponse}`;
      console.log('✅ Feedback-Intro hinzugefügt');
    }

    // Merge product reasons
    let finalProducts = products;
    if (productReasons && Array.isArray(productReasons)) {
      finalProducts = products.map((product, idx) => {
        const reasonData = productReasons.find(r => r.index === idx);
        if (reasonData && reasonData.reasons) {
          return { ...product, whyItFits: reasonData.reasons };
        }
        return product;
      });
    }
    
    console.log('✅ Antwort generiert');
    console.log('\n🎉 ===== ANFRAGE ERFOLGREICH =====\n');

    // ============================================
    // RESPONSE
    // ============================================
    res.json({
      response: aiResponse,
      products: finalProducts,
      productReasons: productReasons,
      intent: intent,
      // Feedback info
      isFeedbackResponse: intent.isFeedback || false,
      feedbackType: intent.feedbackType || null,
      // Perplexity Stats für Frontend
      verification: {
        totalChecked: totalChecked,
        perplexityVerified: perplexityStats.verified,
        perplexityExcluded: perplexityStats.excluded,
        layer: 'Perplexity Reality Check'
      },
      // ⭐ NEU: Guest Info (für Frontend)
      guestInfo: req.guestInfo || null,
      isLoggedIn: !!req.user
    });

  } catch (error) {
    console.error('\n❌ ===== FEHLER =====');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Entschuldigung, es gab einen Fehler bei der Verarbeitung deiner Anfrage.',
      message: error.message,
      // ⭐ NEU: Guest Info auch bei Fehler
      guestInfo: req.guestInfo || null,
      isLoggedIn: !!req.user
    });
  }
};

// ============================================
// OTHER HANDLERS
// ============================================

const getChatHistory = async (req, res) => {
  try {
    res.json({ history: [] });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
};

const deleteChatHistory = async (req, res) => {
  try {
    res.json({ message: 'Chat history deleted' });
  } catch (error) {
    console.error('Delete history error:', error);
    res.status(500).json({ error: 'Failed to delete history' });
  }
};

const getPreferences = async (req, res) => {
  try {
    res.json({ preferences: {} });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
};

const savePreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    res.json({ message: 'Preferences saved', preferences });
  } catch (error) {
    console.error('Save preferences error:', error);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
};

module.exports = {
  sendMessage,
  getChatHistory,
  deleteChatHistory,
  getPreferences,
  savePreferences
};
