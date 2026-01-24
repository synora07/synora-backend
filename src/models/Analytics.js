// ============================================
// SYNORA - Analytics Model
// Speichert alle User-Aktivitäten
// ============================================

const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema({
  // ============================================
  // USER INFO
  // ============================================
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null  // null = nicht eingeloggt
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  
  // ============================================
  // EVENT INFO
  // ============================================
  eventType: {
    type: String,
    required: true,
    enum: [
      'page_view',        // Seite besucht
      'search',           // Produkt gesucht
      'product_click',    // Produkt angeklickt
      'shop_click',       // Shop-Link geklickt
      'login',            // User eingeloggt
      'logout',           // User ausgeloggt
      'register',         // User registriert
      'chat_message',     // Chat-Nachricht gesendet
      'filter_used',      // Filter verwendet
      'session_start',    // Session gestartet
      'session_end'       // Session beendet
    ],
    index: true
  },
  
  // ============================================
  // SEARCH DATA
  // ============================================
  searchQuery: {
    type: String,
    default: null
  },
  searchCategory: {
    type: String,
    enum: ['electronics', 'fashion', 'cosmetics', 'all', null],
    default: null
  },
  searchResultsCount: {
    type: Number,
    default: null
  },
  
  // ============================================
  // PRODUCT DATA
  // ============================================
  productId: {
    type: String,
    default: null
  },
  productName: {
    type: String,
    default: null
  },
  productPrice: {
    type: String,
    default: null
  },
  productShop: {
    type: String,
    default: null
  },
  productCategory: {
    type: String,
    default: null
  },
  productScore: {
    type: Number,
    default: null
  },
  productPosition: {
    type: Number,  // Position in der Liste (1, 2, 3...)
    default: null
  },
  
  // ============================================
  // SHOP DATA
  // ============================================
  shopName: {
    type: String,
    default: null
  },
  shopUrl: {
    type: String,
    default: null
  },
  shopCountry: {
    type: String,
    default: null
  },
  
  // ============================================
  // PAGE DATA
  // ============================================
  pageUrl: {
    type: String,
    default: null
  },
  pageName: {
    type: String,
    default: null
  },
  referrer: {
    type: String,
    default: null
  },
  
  // ============================================
  // DEVICE INFO
  // ============================================
  device: {
    type: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown'
    },
    browser: {
      type: String,
      default: null
    },
    os: {
      type: String,
      default: null
    },
    screenWidth: {
      type: Number,
      default: null
    },
    screenHeight: {
      type: Number,
      default: null
    }
  },
  
  // ============================================
  // LOCATION INFO
  // ============================================
  location: {
    country: {
      type: String,
      default: null
    },
    region: {
      type: String,
      default: null
    },
    city: {
      type: String,
      default: null
    },
    ip: {
      type: String,
      default: null
    }
  },
  
  // ============================================
  // SESSION INFO
  // ============================================
  sessionDuration: {
    type: Number,  // in Sekunden
    default: null
  },
  actionsInSession: {
    type: Number,
    default: 0
  },
  
  // ============================================
  // EXTRA DATA
  // ============================================
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // ============================================
  // TIMESTAMPS
  // ============================================
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true  // createdAt, updatedAt
});

// ============================================
// INDEXES für schnelle Abfragen
// ============================================
AnalyticsSchema.index({ userId: 1, timestamp: -1 });
AnalyticsSchema.index({ eventType: 1, timestamp: -1 });
AnalyticsSchema.index({ searchQuery: 'text' });
AnalyticsSchema.index({ 'location.country': 1 });
AnalyticsSchema.index({ productShop: 1 });

module.exports = mongoose.model('Analytics', AnalyticsSchema);