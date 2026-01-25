// SYNORA - SerpAPI Service für echte Produktbilder
// ⭐ FIXED: Bessere Links + Shop-Filter
const axios = require('axios');

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const SERPAPI_URL = 'https://serpapi.com/search';

// ⭐ Shops die ausgeschlossen werden (keine direkten Links oder unzuverlässig)
const EXCLUDED_SHOPS = [
  'ebay', 'ricardo', 'tutti', 'anibis', 'alibaba', 'aliexpress',
  'wish', 'temu', 'shein'
];

// ⭐ Vertrauenswürdige Schweizer Shops (priorisiert)
const TRUSTED_CH_SHOPS = [
  'digitec', 'galaxus', 'interdiscount', 'mediamarkt', 'fust', 
  'brack', 'microspot', 'manor', 'coop', 'migros', 'melectronics',
  'conrad', 'steg', 'pc-ostschweiz', 'techmania'
];

async function searchRealProducts(query, limit = 6) {
  if (!SERPAPI_KEY) {
    console.log('⚠️ SerpAPI Key nicht gesetzt');
    return null;
  }

  try {
    console.log(`🔍 Searching real products with SerpAPI: ${query}`);
    
    const response = await axios.get(SERPAPI_URL, {
      params: {
        engine: 'google_shopping',
        q: query,
        api_key: SERPAPI_KEY,
        gl: 'ch',  // Switzerland
        hl: 'de',  // German
        num: limit * 3  // Get more results to filter bad ones
      }
    });

    const results = response.data.shopping_results || [];
    
    if (results.length === 0) {
      console.log('⚠️ Keine Produkte gefunden');
      return null;
    }

    // Filter und formatiere die Ergebnisse
    const products = results
      .filter(item => {
        // Muss Bild, Name und Preis haben
        if (!item.thumbnail || !item.title || (!item.price && !item.extracted_price)) {
          return false;
        }
        
        // ⭐ EXCLUDED SHOPS FILTERN
        const shopLower = (item.source || '').toLowerCase();
        if (EXCLUDED_SHOPS.some(excluded => shopLower.includes(excluded))) {
          console.log(`   ❌ Shop ausgeschlossen: ${item.source}`);
          return false;
        }
        
        return true;
      })
      .map((item, index) => {
        // Preis extrahieren
        let price = null;
        if (item.extracted_price) {
          price = item.extracted_price;
        } else if (item.price) {
          const priceMatch = item.price.match(/[\d.,]+/);
          if (priceMatch) {
            price = parseFloat(priceMatch[0].replace(',', '.'));
          }
        }

        const shopName = item.source || 'Google Shopping';
        const productName = item.title || query;
        
        // ⭐ LINK-LOGIK VERBESSERT
        // Priorität: 1. product_link (direkt zum Shop) 2. link (Google Shopping)
        let productLink = null;
        
        // Versuche zuerst den direkten Shop-Link
        if (item.product_link && item.product_link.startsWith('http')) {
          productLink = item.product_link;
        }
        // Dann Google Shopping Link (führt zur Produktseite mit Kaufoptionen)
        else if (item.link && item.link.startsWith('http')) {
          productLink = item.link;
        }
        // Fallback: Google Shopping Suche für dieses Produkt
        else {
          productLink = `https://www.google.ch/search?tbm=shop&q=${encodeURIComponent(productName)}`;
        }
        
        // ⭐ Prüfe ob vertrauenswürdiger Schweizer Shop
        const shopLower = shopName.toLowerCase();
        const isTrustedCH = TRUSTED_CH_SHOPS.some(trusted => shopLower.includes(trusted));
        
        console.log(`  📦 ${productName.substring(0, 40)}...`);
        console.log(`     🏪 Shop: ${shopName} ${isTrustedCH ? '✅ CH' : ''}`);
        console.log(`     🔗 Link: ${productLink.substring(0, 60)}...`);

        return {
          name: productName,
          title: productName,
          imageUrl: item.thumbnail,
          image: item.thumbnail,
          price: price,
          priceFormatted: item.price || `CHF ${price}`,
          source: shopName,
          shopName: shopName,
          // ⭐ Funktionierender Link
          link: productLink,
          url: productLink,
          shopUrl: productLink,
          productLink: productLink,
          // Zusätzliche Infos
          rating: item.rating || null,
          reviews: item.reviews || null,
          position: item.position || index + 1,
          isTrustedCH: isTrustedCH,
          // Original-Daten für Debugging
          originalData: {
            googleShoppingLink: item.link,
            shopProductLink: item.product_link,
            serpApiPosition: item.position
          }
        };
      })
      // ⭐ Sortiere: Schweizer Shops zuerst
      .sort((a, b) => {
        if (a.isTrustedCH && !b.isTrustedCH) return -1;
        if (!a.isTrustedCH && b.isTrustedCH) return 1;
        return 0;
      })
      .slice(0, limit);

    if (products.length > 0) {
      console.log(`✅ Found ${products.length} valid products (${products.filter(p => p.isTrustedCH).length} from trusted CH shops)`);
    }

    return products.length > 0 ? products : null;

  } catch (error) {
    console.error('❌ SerpAPI Error:', error.message);
    return null;
  }
}

module.exports = {
  searchRealProducts
};
