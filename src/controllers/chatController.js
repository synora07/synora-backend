// SYNORA Backend - Intelligent Chat Controller
// ⭐ FIXED: Sauberer Text (kein Markdown), bessere Produktfilterung
// ============================================

const { analyzeUserIntent, generateProductResponse, analyzeProductValidity, generateFeedbackResponse } = require('../services/claudeService');
const { searchRealProducts } = require('../services/serpApiService');
const perplexityService = require('../services/perplexityService');
const { ELEKTRONIK_SHOPS } = require('../data/elektronikShops');
const { FASHION_SHOPS } = require('../data/fashionShops');
const { KOSMETIK_SHOPS } = require('../data/kosmetikShops');

// ============================================
// ⭐ TEXT UTILITIES - Markdown entfernen
// ============================================
function cleanMarkdown(text) {
  if (!text) return '';
  
  let cleaned = text;
  
  // **bold** → bold
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  
  // *italic* → italic  
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
  
  // __underline__ → underline
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  
  // _italic_ → italic
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');
  
  // code → code
  cleaned = cleaned.replace(/\`([^\`]+)\`/g, '$1');
  
  // [link](url) → link
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // ### Header → Header
  cleaned = cleaned.replace(/^#{1,6}\s*/gm, '');
  
  // Übermäßige Zeilenumbrüche
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
}

// ============================================
// FEEDBACK SEARCH QUERY BUILDER
// ============================================
function buildFeedbackSearchQuery(intent, originalQuery) {
  let query = intent.keywords || originalQuery;
  
  if (intent.budgetMax) {
    query += ' unter ' + intent.budgetMax + ' CHF';
  }
  if (intent.budgetMin) {
    query += ' ab ' + intent.budgetMin + ' CHF';
  }
  
  if (intent.brandFilter) {
    if (intent.brandFilter.include && intent.brandFilter.include.length > 0) {
      query = intent.brandFilter.include[0] + ' ' + query;
    }
  }
  
  console.log('🔄 Feedback-Query gebaut: "' + query + '"');
  return query;
}

// ============================================
// CATEGORY DETECTION
// ============================================
function getShopsForCategory(category, subcategory) {
  let shopsData = ELEKTRONIK_SHOPS;
  
  const categoryLower = (category || '').toLowerCase();
  const subcategoryLower = (subcategory || '').toLowerCase();
  const combined = categoryLower + ' ' + subcategoryLower;
  
  const fashionKeywords = [
    'fashion', 'mode', 'kleidung', 'clothing', 'bekleidung',
    'jacke', 'jacket', 'mantel', 'coat', 'hose', 'pants', 'jeans',
    'hemd', 'shirt', 'kleid', 'dress', 'schuhe', 'shoes', 'sneaker'
  ];
  
  const kosmetikKeywords = [
    'kosmetik', 'cosmetic', 'beauty', 'makeup', 'parfüm', 'perfume',
    'hautpflege', 'skincare', 'creme', 'shampoo', 'lippenstift'
  ];
  
  if (fashionKeywords.some(function(keyword) { return combined.includes(keyword); })) {
    console.log('👗 Kategorie: FASHION');
    shopsData = FASHION_SHOPS;
  } else if (kosmetikKeywords.some(function(keyword) { return combined.includes(keyword); })) {
    console.log('💄 Kategorie: KOSMETIK');
    shopsData = KOSMETIK_SHOPS;
  } else {
    console.log('💻 Kategorie: ELEKTRONIK');
  }

  return { shopsData: shopsData, detectedSubcategory: subcategoryLower };
}

// ============================================
// SHOP SELECTION
// ============================================
function selectTopShops(shopsResult, count, userQuery) {
  count = count || 3;
  var shopsData = shopsResult.shopsData;
  var allShops = [];
  
  function extractShops(data) {
    if (!data) return;
    
    if (Array.isArray(data)) {
      data.forEach(function(item) {
        if (Array.isArray(item)) {
          allShops.push({
            name: item[0],
            url: item[1],
            currency: 'CHF',
            country: 'CH'
          });
        } else if (typeof item === 'object' && item.name) {
          allShops.push(item);
        }
      });
      return;
    }
    
    if (typeof data === 'object') {
      Object.keys(data).forEach(function(key) {
        if (key === 'CH') {
          var shops = data[key];
          if (Array.isArray(shops)) {
            shops.forEach(function(shop) {
              if (Array.isArray(shop)) {
                allShops.push({
                  name: shop[0],
                  url: shop[1],
                  currency: 'CHF',
                  country: 'CH'
                });
              }
            });
          }
        } else if (['DE', 'US', 'IN'].indexOf(key) === -1) {
          extractShops(data[key]);
        }
      });
    }
  }
  
  extractShops(shopsData);
  
  // Remove duplicates
  var uniqueShops = [];
  var seenNames = {};
  allShops.forEach(function(shop) {
    if (!seenNames[shop.name]) {
      seenNames[shop.name] = true;
      uniqueShops.push(shop);
    }
  });
  
  console.log('✅ ' + uniqueShops.length + ' Schweizer Shops');
  return uniqueShops.slice(0, count);
}

// ============================================
// HELPERS
// ============================================
function buildGoogleShoppingUrl(productName) {
  return 'https://www.google.ch/search?q=' + encodeURIComponent(productName) + '&tbm=shop&gl=ch';
}

function isValidPrice(price) {
  if (!price) return false;
  var priceStr = String(price).trim();
  if (priceStr === '' || priceStr === '1' || priceStr === '0') return false;
  var numericPrice = parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.'));
  return !isNaN(numericPrice) && numericPrice >= 2;
}

function formatPrice(price, currency) {
  currency = currency || 'CHF';
  if (!isValidPrice(price)) return 'Preis auf Anfrage';
  return price;
}

// ============================================
// PRODUCT GENERATION
// ============================================
async function generateProducts(intent, selectedShops, userMessage, realProducts) {
  var shopsToUse = selectedShops.slice(0, 3);
  var products = [];
  
  if (realProducts && realProducts.length > 0) {
    products = realProducts.slice(0, 3).map(function(product, index) {
      var shop = shopsToUse[index] || shopsToUse[0];
      var hasValidPrice = isValidPrice(product.price);
      var displayPrice = formatPrice(product.price, 'CHF');
      
      // SYNORA SCORE
      var score = 75;
      
      if (product.isTrustedCH) score += 5;
      
      if (intent.budget && hasValidPrice && product.price) {
        var price = parseFloat(String(product.price).replace(/[^\d.]/g, ''));
        if (price <= intent.budget * 0.7) score += 5;
        else if (price <= intent.budget) score += 2;
        else if (price > intent.budget * 1.2) score -= 5;
      }
      
      if (product.realityScore && product.realityScore >= 80) score += 2;
      if (!hasValidPrice) score -= 3;
      
      score += Math.floor(Math.random() * 5) - 2;
      score = Math.max(60, Math.min(95, score));
      
      // Reason
      var reason = 'Gutes Produkt für deine Anforderungen';
      if (intent.requirements && intent.requirements.length > 0) {
        reason = 'Erfüllt: ' + intent.requirements.slice(0, 2).join(', ');
      }

      return {
        name: product.name || (intent.subcategory || 'Produkt') + ' Empfehlung',
        shopName: product.source || product.shopName || 'Shop',
        shopUrl: product.link || product.shopUrl || buildGoogleShoppingUrl(product.name),
        imageUrl: product.imageUrl || product.image,
        price: displayPrice,
        hasValidPrice: hasValidPrice,
        score: score,
        reason: reason,
        badges: [],
        currency: 'CHF',
        verified: product.verification ? true : false
      };
    });
  }
  
  // Sort by score
  products.sort(function(a, b) { return b.score - a.score; });
  
  // Add badges
  products = products.map(function(product, index) {
    var badges = [];
    if (product.score >= 90) badges.push('TOP');
    else if (product.score >= 80) badges.push('HIGH');
    if (product.verified) badges.push('VERIFIED');
    if (index === 0) badges.push('BESTSELLER');
    return Object.assign({}, product, { badges: badges });
  });
  
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

    if (req.user) {
      console.log('\n🔐 User: ' + (req.user.email || req.user.id));
    } else if (req.guestInfo) {
      console.log('\n👤 Guest: Suche ' + req.guestInfo.searchesUsed + '/' + req.guestInfo.searchesLimit);
    }

    console.log('\n🎯 ===== NEUE CHAT-ANFRAGE =====');
    console.log('📩 Nachricht:', message);

    // SCHICHT 1: Intent Analyse
    console.log('\n📊 SCHICHT 1: Intent-Analyse...');
    const intent = await analyzeUserIntent(message, conversationHistory || []);
    console.log('✅ Intent:', intent);

    // Feedback handling
    let searchQuery = intent.keywords || message;
    let feedbackIntro = null;
    
    if (intent.isFeedback) {
      console.log('\n🔄 FEEDBACK ERKANNT!');
      
      if (intent.feedbackType === 'confirmation') {
        return res.json({
          response: 'Super Wahl! 🎉 Klicke auf den Shop-Link um das Produkt zu kaufen.',
          products: [],
          intent: intent,
          guestInfo: req.guestInfo || null,
          isLoggedIn: !!req.user
        });
      }
      
      if (intent.feedbackType === 'rejection' && !intent.needsNewSearch) {
        return res.json({
          response: 'Kein Problem! Was hat nicht gepasst? Sag mir z.B. "günstiger", "andere Marke" oder beschreib was du suchst!',
          products: [],
          intent: intent,
          guestInfo: req.guestInfo || null,
          isLoggedIn: !!req.user
        });
      }
      
      if (intent.needsNewSearch) {
        searchQuery = buildFeedbackSearchQuery(intent, message);
        feedbackIntro = await generateFeedbackResponse(intent.feedbackType, intent.adjustments, message, null);
      }
    }

    // Follow-up questions
    if (intent.needsFollowUp && intent.follow_up_questions && intent.follow_up_questions.length > 0) {
      return res.json({
        response: cleanMarkdown(intent.follow_up_questions.join('\n\n')),
        products: [],
        intent: intent,
        needsFollowUp: true,
        guestInfo: req.guestInfo || null,
        isLoggedIn: !!req.user
      });
    }

    // SCHICHT 1: Shop-Auswahl
    console.log('\n🏪 Shop-Auswahl...');
    const shopsResult = getShopsForCategory(intent.category, intent.subcategory);
    const shops = selectTopShops(shopsResult, 6, message);

    // SCHICHT 1: Produkte suchen
    console.log('\n📸 Produkte suchen (SerpAPI)...');
    let finalSearchQuery = intent.isFeedback && intent.needsNewSearch 
      ? searchQuery 
      : (intent.keywords || message) + (intent.budget ? ' unter ' + intent.budget + ' CHF' : '');
    finalSearchQuery = finalSearchQuery.trim();
    
    console.log('🔍 Suchquery:', finalSearchQuery);
    
    let foundProducts = await searchRealProducts(finalSearchQuery, 6);
    let totalChecked = foundProducts ? foundProducts.length : 0;
    
    if (!foundProducts || foundProducts.length === 0) {
      console.log('⚠️ Keine Produkte gefunden');
      foundProducts = [];
    }

    // SCHICHT 2: Perplexity Reality Check
    let verifiedProducts = foundProducts;
    let perplexityStats = { checked: 0, verified: 0, excluded: 0 };
    
    if (foundProducts.length > 0 && process.env.PERPLEXITY_API_KEY) {
      try {
        console.log('\n🔍 SCHICHT 2: Perplexity Reality Check...');
        
        const verificationsPromises = foundProducts.slice(0, 5).map(async function(product) {
          const verification = await perplexityService.verifyProduct({
            name: product.name || product.title,
            shop: product.source,
            price: product.price
          });
          
          return Object.assign({}, product, {
            verification: verification,
            realityScore: perplexityService.calculateRealityScore(verification)
          });
        });
        
        const verifiedResults = await Promise.all(verificationsPromises);
        perplexityStats.checked = verifiedResults.length;
        
        verifiedProducts = verifiedResults.filter(function(p) {
          if (!p.verification.exists || !p.verification.available) {
            perplexityStats.excluded++;
            return false;
          }
          if (p.realityScore < 50) {
            perplexityStats.excluded++;
            return false;
          }
          perplexityStats.verified++;
          return true;
        });
        
        console.log('📊 Perplexity: ' + perplexityStats.verified + ' verifiziert, ' + perplexityStats.excluded + ' ausgeschlossen');
        
      } catch (perplexityError) {
        console.error('⚠️ Perplexity Fehler:', perplexityError.message);
        verifiedProducts = foundProducts;
      }
    }

    // SCHICHT 3: SYNORA Scoring
    console.log('\n🧠 SCHICHT 3: SYNORA Scoring...');
    
    const productAnalysis = await analyzeProductValidity(message, verifiedProducts);
    
    const mainProducts = verifiedProducts.filter(function(product, idx) {
      const analysis = productAnalysis.find(function(a) { return a.index === idx; });
      if (analysis && !analysis.isMainProduct) {
        console.log('❌ Zubehör gefiltert: ' + product.name);
        return false;
      }
      return true;
    });
    
    const products = await generateProducts(intent, shops, message, mainProducts.length > 0 ? mainProducts : verifiedProducts);
    console.log('✅ ' + products.length + ' Produkte generiert');

    // SCHICHT 4: Claude Response
    console.log('\n💬 SCHICHT 4: Claude Response...');
    
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
    
    // ⭐ MARKDOWN ENTFERNEN - Sauberer Text!
    aiResponse = cleanMarkdown(aiResponse);
    
    if (feedbackIntro) {
      aiResponse = cleanMarkdown(feedbackIntro) + '\n\n' + aiResponse;
    }

    // Merge product reasons
    let finalProducts = products;
    if (productReasons && Array.isArray(productReasons)) {
      finalProducts = products.map(function(product, idx) {
        const reasonData = productReasons.find(function(r) { return r.index === idx; });
        if (reasonData && reasonData.reasons) {
          return Object.assign({}, product, { whyItFits: reasonData.reasons });
        }
        return product;
      });
    }
    
    console.log('✅ Antwort generiert (Markdown entfernt)');
    console.log('\n🎉 ===== ANFRAGE ERFOLGREICH =====\n');

    // RESPONSE
    res.json({
      response: aiResponse,
      products: finalProducts,
      productReasons: productReasons,
      intent: intent,
      isFeedbackResponse: intent.isFeedback || false,
      verification: {
        totalChecked: totalChecked,
        perplexityVerified: perplexityStats.verified,
        perplexityExcluded: perplexityStats.excluded
      },
      guestInfo: req.guestInfo || null,
      isLoggedIn: !!req.user
    });

  } catch (error) {
    console.error('\n❌ FEHLER:', error.message);
    
    res.status(500).json({ 
      error: 'Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.',
      guestInfo: req.guestInfo || null,
      isLoggedIn: !!req.user
    });
  }
};

// Other handlers
const getChatHistory = async (req, res) => {
  res.json({ history: [] });
};

const deleteChatHistory = async (req, res) => {
  res.json({ message: 'Chat history deleted' });
};

const getPreferences = async (req, res) => {
  res.json({ preferences: {} });
};

const savePreferences = async (req, res) => {
  const { preferences } = req.body;
  res.json({ message: 'Preferences saved', preferences: preferences });
};

module.exports = {
  sendMessage,
  getChatHistory,
  deleteChatHistory,
  getPreferences,
  savePreferences
};
