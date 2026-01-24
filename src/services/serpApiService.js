// SYNORA - SerpAPI Service für echte Produktbilder
// ⭐ FIXED: Nutzt direkte Google Shopping Produkt-Links

const axios = require('axios');

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const SERPAPI_URL = 'https://serpapi.com/search';

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
        num: limit * 2  // Get more results to filter
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
        return item.thumbnail && item.title && (item.price || item.extracted_price);
      })
      .slice(0, limit)
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
        
        // ⭐ WICHTIG: Nutze den ORIGINALEN Google Shopping Produkt-Link!
        // item.link = Direkt zur Google Shopping Produkt-Seite (mit Kaufen-Button)
        // item.product_link = Manchmal direkt zum Shop
        const productLink = item.product_link || item.link;
        
        console.log(`  📦 ${productName.substring(0, 40)}...`);
        console.log(`     🏪 Shop: ${shopName}`);
        console.log(`     🔗 Link: ${productLink ? productLink.substring(0, 60) + '...' : 'N/A'}`);

        return {
          name: productName,
          title: productName,
          imageUrl: item.thumbnail,
          image: item.thumbnail,
          price: price,
          source: shopName,
          // ⭐ DIREKT zum Google Shopping Produkt (nicht Suche!)
          link: productLink,
          url: productLink,
          productLink: productLink,
          // Zusätzliche Infos
          rating: item.rating || null,
          reviews: item.reviews || null,
          position: item.position || index + 1,
          // Original-Daten für Debugging
          originalData: {
            googleShoppingLink: item.link,
            shopProductLink: item.product_link,
            serpApiPosition: item.position
          }
        };
      });

    if (products.length > 0) {
      console.log(`✅ Found ${products.length} valid products with direct Google Shopping links`);
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