// ============================================
// SYNORA - Perplexity Service
// Integrity & Reality Check Layer
// ============================================

const axios = require('axios');

class PerplexityService {
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY;
    this.baseURL = 'https://api.perplexity.ai';
    this.model = 'llama-3.1-sonar-small-128k-online'; // Mit Web-Suche
  }

  // ============================================
  // HAUPT-FUNKTION: Produkt verifizieren
  // ============================================
  async verifyProduct(product) {
    try {
      const query = `
        Verifiziere dieses Produkt:
        Name: ${product.name}
        Shop: ${product.shop || product.source}
        Preis: ${product.price}
        
        Antworte NUR im JSON Format:
        {
          "exists": true/false,
          "priceAccurate": true/false,
          "currentPrice": "aktueller Preis oder null",
          "available": true/false,
          "rating": "Bewertung falls gefunden oder null",
          "warnings": ["Liste von Warnungen falls vorhanden"]
        }
      `;

      const response = await this.query(query);
      
      try {
        // Versuche JSON aus Antwort zu extrahieren
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.log('[Perplexity] Could not parse JSON, using default');
      }

      // Default wenn Parsing fehlschlägt
      return {
        exists: true,
        priceAccurate: true,
        currentPrice: product.price,
        available: true,
        rating: null,
        warnings: []
      };

    } catch (error) {
      console.error('[Perplexity] Verify error:', error.message);
      return this.getDefaultVerification(product);
    }
  }

  // ============================================
  // Mehrere Produkte verifizieren
  // ============================================
  async verifyProducts(products) {
    const verified = [];
    
    for (const product of products) {
      const verification = await this.verifyProduct(product);
      verified.push({
        ...product,
        verification,
        realityScore: this.calculateRealityScore(verification)
      });
      
      // Kleine Pause um Rate Limits zu vermeiden
      await this.sleep(200);
    }
    
    // Filtere Produkte die nicht existieren oder nicht verfügbar sind
    return verified.filter(p => 
      p.verification.exists && 
      p.verification.available
    );
  }

  // ============================================
  // Preis-Check für ein Produkt
  // ============================================
  async checkPrice(productName, shopName, claimedPrice) {
    try {
      const query = `
        Was ist der aktuelle Preis für "${productName}" bei ${shopName}?
        Angeblicher Preis: ${claimedPrice}
        
        Antworte NUR im JSON Format:
        {
          "found": true/false,
          "currentPrice": "Preis oder null",
          "priceDifference": "Differenz in % oder 0",
          "lastChecked": "heute"
        }
      `;

      const response = await this.query(query);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return { found: false, currentPrice: null, priceDifference: 0 };
      
    } catch (error) {
      console.error('[Perplexity] Price check error:', error.message);
      return { found: false, currentPrice: claimedPrice, priceDifference: 0 };
    }
  }

  // ============================================
  // Shop-Verfügbarkeit prüfen
  // ============================================
  async checkShopAvailability(shopUrl, shopName) {
    try {
      const query = `
        Ist der Online-Shop "${shopName}" (${shopUrl}) aktuell erreichbar und aktiv?
        Gibt es bekannte Probleme mit diesem Shop?
        
        Antworte NUR im JSON Format:
        {
          "online": true/false,
          "trustworthy": true/false,
          "issues": ["Liste von Problemen falls vorhanden"],
          "lastChecked": "heute"
        }
      `;

      const response = await this.query(query);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return { online: true, trustworthy: true, issues: [] };
      
    } catch (error) {
      console.error('[Perplexity] Shop check error:', error.message);
      return { online: true, trustworthy: true, issues: [] };
    }
  }

  // ============================================
  // Produkt-Reviews holen
  // ============================================
  async getProductReviews(productName) {
    try {
      const query = `
        Finde echte Kundenbewertungen für "${productName}".
        
        Antworte NUR im JSON Format:
        {
          "averageRating": 4.2,
          "totalReviews": 150,
          "pros": ["Pro 1", "Pro 2"],
          "cons": ["Con 1", "Con 2"],
          "summary": "Kurze Zusammenfassung"
        }
      `;

      const response = await this.query(query);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return null;
      
    } catch (error) {
      console.error('[Perplexity] Reviews error:', error.message);
      return null;
    }
  }

  // ============================================
  // Markt-Recherche für Kategorie
  // ============================================
  async marketResearch(category, country, budget) {
    try {
      const query = `
        Was sind die besten ${category} Produkte in ${country} 
        mit einem Budget von ${budget}?
        
        Antworte NUR im JSON Format:
        {
          "topBrands": ["Marke1", "Marke2", "Marke3"],
          "priceRange": {"min": 100, "max": 500},
          "recommendations": ["Tipp1", "Tipp2"],
          "warnings": ["Warnung1"]
        }
      `;

      const response = await this.query(query);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return null;
      
    } catch (error) {
      console.error('[Perplexity] Market research error:', error.message);
      return null;
    }
  }

  // ============================================
  // Basis API-Anfrage an Perplexity
  // ============================================
  async query(prompt) {
    if (!this.apiKey) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Du bist ein Produkt-Verifizierer. Antworte IMMER nur im JSON Format. Keine Erklärungen, nur JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.1 // Niedrig für konsistente Antworten
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      return response.data.choices[0].message.content;
      
    } catch (error) {
      if (error.response?.status === 429) {
        console.log('[Perplexity] Rate limited, waiting...');
        await this.sleep(2000);
        return this.query(prompt); // Retry
      }
      throw error;
    }
  }

  // ============================================
  // Reality Score berechnen (0-100)
  // ============================================
  calculateRealityScore(verification) {
    let score = 100;
    
    if (!verification.exists) score -= 50;
    if (!verification.priceAccurate) score -= 20;
    if (!verification.available) score -= 30;
    if (verification.warnings?.length > 0) {
      score -= verification.warnings.length * 5;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  // ============================================
  // Default Verification (Fallback)
  // ============================================
  getDefaultVerification(product) {
    return {
      exists: true,
      priceAccurate: true,
      currentPrice: product.price,
      available: true,
      rating: null,
      warnings: ['Konnte nicht vollständig verifiziert werden'],
      realityScore: 70
    };
  }

  // ============================================
  // Helper: Sleep
  // ============================================
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new PerplexityService();