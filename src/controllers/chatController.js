// SYNORA Backend - Chat Controller
// ⭐ VERTRAUEN = NUR RICHTIGE PRODUKTE ZEIGEN!
// ============================================

const { analyzeUserIntent, generateProductResponse, analyzeProductValidity, generateFeedbackResponse } = require('../services/claudeService');
const { searchRealProducts } = require('../services/serpApiService');
const { ELEKTRONIK_SHOPS } = require('../data/elektronikShops');
const { FASHION_SHOPS } = require('../data/fashionShops');
const { KOSMETIK_SHOPS } = require('../data/kosmetikShops');

// Perplexity optional laden
let perplexityService = null;
try {
  perplexityService = require('../services/perplexityService');
  console.log('✅ Perplexity Service geladen');
} catch (e) {
  console.log('⚠️ Perplexity Service nicht verfügbar');
}

// ============================================
// TEXT UTILITIES
// ============================================
function cleanMarkdown(text) {
  if (!text) return '';
  let cleaned = text;
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  cleaned = cleaned.replace(/^#{1,6}\s*/gm, '');
  return cleaned.trim();
}

// ============================================
// CATEGORY & SHOP HELPERS
// ============================================
function getShopsForCategory(category, subcategory) {
  const combined = ((category || '') + ' ' + (subcategory || '')).toLowerCase();
  
  if (['fashion', 'mode', 'kleidung', 'jacke', 'hose', 'schuhe'].some(kw => combined.includes(kw))) {
    return { shopsData: FASHION_SHOPS };
  }
  if (['kosmetik', 'beauty', 'makeup', 'parfüm'].some(kw => combined.includes(kw))) {
    return { shopsData: KOSMETIK_SHOPS };
  }
  return { shopsData: ELEKTRONIK_SHOPS };
}

function selectTopShops(shopsResult, count) {
  const allShops = [];
  const data = shopsResult.shopsData;
  
  function extract(d) {
    if (Array.isArray(d)) {
      d.forEach(item => {
        if (Array.isArray(item)) {
          allShops.push({ name: item[0], url: item[1], currency: 'CHF' });
        }
      });
    } else if (typeof d === 'object') {
      Object.keys(d).forEach(key => {
        if (key === 'CH' && Array.isArray(d[key])) {
          d[key].forEach(shop => {
            if (Array.isArray(shop)) {
              allShops.push({ name: shop[0], url: shop[1], currency: 'CHF' });
            }
          });
        }
      });
    }
  }
  
  extract(data);
  return allShops.slice(0, count || 6);
}

function buildGoogleShoppingUrl(productName) {
  return 'https://www.google.ch/search?q=' + encodeURIComponent(productName) + '&tbm=shop&gl=ch';
}

function isValidPrice(price) {
  if (!price) return false;
  const num = parseFloat(String(price).replace(/[^\d.,]/g, '').replace(',', '.'));
  return !isNaN(num) && num >= 2;
}

// ============================================
// PRODUCT GENERATION MIT VALIDIERUNG
// ============================================
async function generateProducts(intent, foundProducts, validationResults) {
  const products = [];
  
  if (!foundProducts || foundProducts.length === 0) {
    return products;
  }
  
  foundProducts.forEach((product, idx) => {
    // Prüfe ob Produkt als "passend" markiert wurde
    const validation = validationResults.find(v => v.index === idx);
    const isMatch = validation ? validation.isMatch : true;
    
    const hasValidPrice = isValidPrice(product.price);
    
    // SYNORA SCORE berechnen
    let score = 70;
    if (isMatch) score += 15;  // Passt zur Anfrage
    if (product.isTrustedCH) score += 5;  // Schweizer Shop
    if (hasValidPrice && intent.budget) {
      const price = parseFloat(String(product.price).replace(/[^\d.]/g, ''));
      if (price <= intent.budget) score += 5;  // Im Budget
    }
    score = Math.min(95, Math.max(50, score + Math.floor(Math.random() * 5)));
    
    products.push({
      name: product.name || product.title || 'Produkt',
      shopName: product.source || product.shopName || 'Shop',
      shopUrl: product.link || product.shopUrl || buildGoogleShoppingUrl(product.name),
      imageUrl: product.imageUrl || product.image,
      price: hasValidPrice ? product.price : 'Preis auf Anfrage',
      score: score,
      reason: validation ? validation.reason : 'Produkt gefunden',
      isMatch: isMatch,
      badges: [],
      currency: 'CHF'
    });
  });
  
  // Sortiere: Passende zuerst, dann nach Score
  products.sort((a, b) => {
    if (a.isMatch && !b.isMatch) return -1;
    if (!a.isMatch && b.isMatch) return 1;
    return b.score - a.score;
  });
  
  // Badges vergeben
  let matchRank = 0;
  products.forEach((p, idx) => {
    if (p.isMatch) {
      matchRank++;
      if (matchRank === 1) p.badges.push('BESTSELLER');
      if (p.score >= 85) p.badges.push('TOP');
    }
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

    console.log('\n🎯 ===== NEUE ANFRAGE =====');
    console.log('📩 User:', message);

    // ============================================
    // SCHICHT 1: INTENT ANALYSE
    // ============================================
    console.log('\n📊 SCHICHT 1: Intent-Analyse...');
    const intent = await analyzeUserIntent(message, conversationHistory || []);
    console.log('✅ Keywords:', intent.keywords);
    console.log('   MustHave:', JSON.stringify(intent.mustHave || {}));
    console.log('   MustNotHave:', JSON.stringify(intent.mustNotHave || {}));

    // Feedback handling
    if (intent.isFeedback && intent.feedbackType === 'confirmation') {
      return res.json({
        response: 'Super Wahl! 🎉 Klicke auf den Shop-Link um das Produkt zu kaufen.',
        products: [],
        guestInfo: req.guestInfo || null,
        isLoggedIn: !!req.user
      });
    }

    // Follow-up questions
    if (intent.needsFollowUp && intent.follow_up_questions && intent.follow_up_questions.length > 0) {
      return res.json({
        response: cleanMarkdown(intent.follow_up_questions.join('\n\n')),
        products: [],
        needsFollowUp: true,
        guestInfo: req.guestInfo || null,
        isLoggedIn: !!req.user
      });
    }

    // ============================================
    // SCHICHT 1: PRODUKTE SUCHEN
    // ============================================
    console.log('\n📸 SCHICHT 1: Produkte suchen...');
    
    let searchQuery = intent.keywords || message;
    if (intent.budget) {
      searchQuery += ' unter ' + intent.budget + ' CHF';
    }
    // Füge MustHave zu Suche hinzu
    if (intent.mustHave && intent.mustHave.os === 'Windows') {
      searchQuery += ' Windows';
    }
    if (intent.mustHave && intent.mustHave.gpu === 'dedicated') {
      searchQuery += ' GTX RTX Gaming';
    }
    
    console.log('🔍 Query:', searchQuery);
    
    let foundProducts = await searchRealProducts(searchQuery, 8);
    const totalChecked = foundProducts ? foundProducts.length : 0;
    
    if (!foundProducts) foundProducts = [];
    console.log('✅ Gefunden:', foundProducts.length, 'Produkte');

    // ============================================
    // SCHICHT 2: PERPLEXITY REALITY CHECK (optional)
    // ============================================
    let verifiedProducts = foundProducts;
    
    if (perplexityService && process.env.PERPLEXITY_API_KEY && foundProducts.length > 0) {
      console.log('\n🔍 SCHICHT 2: Perplexity Reality Check...');
      try {
        const verifications = await Promise.all(
          foundProducts.slice(0, 5).map(async (product) => {
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
          })
        );
        
        verifiedProducts = verifications.filter(p => {
          if (!p.verification.exists || !p.verification.available) {
            console.log('   ❌ Nicht verfügbar:', p.name);
            return false;
          }
          return true;
        });
        
        console.log('✅ Perplexity:', verifiedProducts.length, 'verifiziert');
      } catch (err) {
        console.log('⚠️ Perplexity Fehler:', err.message);
        verifiedProducts = foundProducts;
      }
    }

    // ============================================
    // SCHICHT 3: SYNORA AI - STRENGE VALIDIERUNG
    // ============================================
    console.log('\n🧠 SCHICHT 3: SYNORA Strenge Validierung...');
    
    const validationResults = await analyzeProductValidity(message, verifiedProducts, intent);
    
    const matchingCount = validationResults.filter(v => v.isMatch).length;
    const notMatchingCount = validationResults.filter(v => !v.isMatch).length;
    
    console.log('✅ Validierung:', matchingCount, 'passen,', notMatchingCount, 'passen NICHT');

    // ============================================
    // PRODUKTE GENERIEREN
    // ============================================
    let allProducts = await generateProducts(intent, verifiedProducts, validationResults);
    
    // NUR passende Produkte zeigen!
    let productsToShow = allProducts.filter(p => p.isMatch);
    
    // Maximal 3 zeigen
    productsToShow = productsToShow.slice(0, 3);
    
    console.log('✅ Zeige:', productsToShow.length, 'passende Produkte');

    // ============================================
    // SCHICHT 4: CLAUDE RESPONSE
    // ============================================
    console.log('\n💬 SCHICHT 4: Claude Response...');
    
    const aiResponseData = await generateProductResponse(
      message,
      productsToShow,
      conversationHistory || [],
      totalChecked,
      { matching: matchingCount, notMatching: notMatchingCount }
    );
    
    let aiResponse = typeof aiResponseData === 'object' ? aiResponseData.text : aiResponseData;
    let productReasons = aiResponseData.productReasons || null;
    
    // Text säubern
    aiResponse = cleanMarkdown(aiResponse);

    // Produkt-Gründe mergen
    if (productReasons && Array.isArray(productReasons)) {
      productsToShow = productsToShow.map((product, idx) => {
        const reasonData = productReasons.find(r => r.index === idx);
        if (reasonData && reasonData.reasons) {
          return { ...product, whyItFits: reasonData.reasons };
        }
        return product;
      });
    }
    
    console.log('\n🎉 ===== ERFOLGREICH =====\n');

    // ============================================
    // RESPONSE
    // ============================================
    res.json({
      response: aiResponse,
      products: productsToShow,
      intent: intent,
      verification: {
        totalChecked: totalChecked,
        matching: matchingCount,
        notMatching: notMatchingCount
      },
      guestInfo: req.guestInfo || null,
      isLoggedIn: !!req.user
    });

  } catch (error) {
    console.error('\n❌ FEHLER:', error.message);
    console.error(error.stack);
    
    res.status(500).json({
      error: 'Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.',
      guestInfo: req.guestInfo || null,
      isLoggedIn: !!req.user
    });
  }
};

// Other handlers
const getChatHistory = async (req, res) => { res.json({ history: [] }); };
const deleteChatHistory = async (req, res) => { res.json({ message: 'Deleted' }); };
const getPreferences = async (req, res) => { res.json({ preferences: {} }); };
const savePreferences = async (req, res) => { res.json({ message: 'Saved' }); };

module.exports = {
  sendMessage,
  getChatHistory,
  deleteChatHistory,
  getPreferences,
  savePreferences
};
