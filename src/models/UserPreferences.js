// ============================================
// SYNORA - User Preferences Model
// Lernt von jedem User wie ChatGPT/Claude
// ============================================

const mongoose = require('mongoose');

const UserPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // ============================================
  // LIEBLINGS-KATEGORIEN
  // ============================================
  categories: {
    electronics: { score: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
    fashion: { score: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
    cosmetics: { score: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
    gaming: { score: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
    home: { score: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
    sports: { score: { type: Number, default: 0 }, count: { type: Number, default: 0 } }
  },
  favoriteCategory: String,
  
  // ============================================
  // BUDGET (gelernt)
  // ============================================
  budget: {
    avgMin: { type: Number, default: 0 },
    avgMax: { type: Number, default: 500 },
    currency: { type: String, default: 'CHF' },
    range: { type: String, default: 'medium' }, // budget, medium, premium, luxury
    dataPoints: { type: Number, default: 0 }
  },
  
  // ============================================
  // LIEBLINGS-SHOPS
  // ============================================
  shops: [{
    name: String,
    clicks: { type: Number, default: 1 },
    lastClick: Date
  }],
  
  // ============================================
  // LIEBLINGS-MARKEN
  // ============================================
  brands: [{
    name: String,
    clicks: { type: Number, default: 1 },
    category: String
  }],
  
  // ============================================
  // SUCH-HISTORIE (letzte 50)
  // ============================================
  searches: [{
    query: String,
    category: String,
    budget: { min: Number, max: Number },
    timestamp: { type: Date, default: Date.now }
  }],
  
  // ============================================
  // KEYWORDS (oft gesucht)
  // ============================================
  keywords: [{
    word: String,
    count: { type: Number, default: 1 }
  }],
  
  // ============================================
  // PRODUKT-INTERESSEN
  // ============================================
  products: [{
    name: String,
    category: String,
    price: Number,
    clicks: { type: Number, default: 1 },
    lastSeen: Date
  }],
  
  // ============================================
  // USER-STIL
  // ============================================
  style: {
    prefersCheap: { type: Boolean, default: false },
    prefersQuality: { type: Boolean, default: false },
    prefersBrands: { type: Boolean, default: false },
    prefersLocal: { type: Boolean, default: false }
  },
  
  // ============================================
  // STATISTIKEN
  // ============================================
  stats: {
    totalSearches: { type: Number, default: 0 },
    totalClicks: { type: Number, default: 0 },
    totalShopClicks: { type: Number, default: 0 },
    firstSeen: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now }
  }
  
}, { timestamps: true });

// ============================================
// METHODS
// ============================================

// Suche speichern und lernen
UserPreferencesSchema.methods.learnFromSearch = function(query, category, budget) {
  // Suche speichern
  this.searches.unshift({ query, category, budget, timestamp: new Date() });
  if (this.searches.length > 50) this.searches = this.searches.slice(0, 50);
  
  // Kategorie-Score erhöhen
  if (category && this.categories[category]) {
    this.categories[category].score += 1;
    this.categories[category].count += 1;
    this.updateFavoriteCategory();
  }
  
  // Budget lernen
  if (budget?.max) {
    this.learnBudget(budget.min || 0, budget.max);
  }
  
  // Keywords extrahieren
  query.toLowerCase().split(/\s+/).forEach(word => {
    if (word.length > 3) {
      const existing = this.keywords.find(k => k.word === word);
      if (existing) existing.count += 1;
      else this.keywords.push({ word, count: 1 });
    }
  });
  this.keywords.sort((a, b) => b.count - a.count);
  if (this.keywords.length > 50) this.keywords = this.keywords.slice(0, 50);
  
  this.stats.totalSearches += 1;
  this.stats.lastActive = new Date();
};

// Budget lernen
UserPreferencesSchema.methods.learnBudget = function(min, max) {
  const dp = this.budget.dataPoints;
  this.budget.avgMin = Math.round(((this.budget.avgMin * dp) + min) / (dp + 1));
  this.budget.avgMax = Math.round(((this.budget.avgMax * dp) + max) / (dp + 1));
  this.budget.dataPoints += 1;
  
  const avg = (this.budget.avgMin + this.budget.avgMax) / 2;
  if (avg < 100) this.budget.range = 'budget';
  else if (avg < 500) this.budget.range = 'medium';
  else if (avg < 1500) this.budget.range = 'premium';
  else this.budget.range = 'luxury';
};

// Shop-Klick speichern
UserPreferencesSchema.methods.learnFromShopClick = function(shopName) {
  const existing = this.shops.find(s => s.name.toLowerCase() === shopName.toLowerCase());
  if (existing) {
    existing.clicks += 1;
    existing.lastClick = new Date();
  } else {
    this.shops.push({ name: shopName, clicks: 1, lastClick: new Date() });
  }
  this.shops.sort((a, b) => b.clicks - a.clicks);
  if (this.shops.length > 20) this.shops = this.shops.slice(0, 20);
  
  this.stats.totalShopClicks += 1;
  this.stats.lastActive = new Date();
};

// Produkt-Klick speichern
UserPreferencesSchema.methods.learnFromProductClick = function(name, category, price, brand) {
  const existing = this.products.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.clicks += 1;
    existing.lastSeen = new Date();
  } else {
    this.products.unshift({ name, category, price, clicks: 1, lastSeen: new Date() });
  }
  if (this.products.length > 30) this.products = this.products.slice(0, 30);
  
  // Marke lernen
  if (brand) {
    const existingBrand = this.brands.find(b => b.name.toLowerCase() === brand.toLowerCase());
    if (existingBrand) existingBrand.clicks += 1;
    else this.brands.push({ name: brand, clicks: 1, category });
    this.brands.sort((a, b) => b.clicks - a.clicks);
    if (this.brands.length > 20) this.brands = this.brands.slice(0, 20);
  }
  
  // Kategorie erhöhen
  if (category && this.categories[category]) {
    this.categories[category].score += 2;
    this.updateFavoriteCategory();
  }
  
  // Preis → Budget lernen
  if (price) this.learnBudget(price * 0.5, price * 1.5);
  
  this.stats.totalClicks += 1;
  this.stats.lastActive = new Date();
};

// Favorite Category updaten
UserPreferencesSchema.methods.updateFavoriteCategory = function() {
  let top = null, topScore = 0;
  for (const [cat, data] of Object.entries(this.categories)) {
    if (data.score > topScore) { topScore = data.score; top = cat; }
  }
  this.favoriteCategory = top;
};

// Profil für KI generieren
UserPreferencesSchema.methods.getAIProfile = function() {
  return {
    favoriteCategory: this.favoriteCategory,
    budgetRange: this.budget.range,
    avgBudget: { min: this.budget.avgMin, max: this.budget.avgMax, currency: this.budget.currency },
    topShops: this.shops.slice(0, 5).map(s => s.name),
    topBrands: this.brands.slice(0, 5).map(b => b.name),
    topKeywords: this.keywords.slice(0, 10).map(k => k.word),
    recentSearches: this.searches.slice(0, 5).map(s => s.query),
    totalSearches: this.stats.totalSearches,
    isNewUser: this.stats.totalSearches < 5
  };
};

module.exports = mongoose.model('UserPreferences', UserPreferencesSchema);