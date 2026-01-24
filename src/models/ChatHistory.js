const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  response: {
    type: String,
    required: true
  },
  products: [{
    name: String,
    price: Number,
    currency: String,
    originalPrice: Number,
    url: String,
    imageUrl: String,
    source: String,
    rating: Number,
    reviewCount: Number,
    synoraScore: Number,
    confidence: {
      level: String,
      score: Number,
      badge: String
    },
    specs: Object,
    reasoning: {
      whyGood: String,
      whyNot: String,
      tradeOffs: [String]
    },
    verified: Boolean,
    lastVerified: Date
  }],
  intent: Object,
  preferences: Object,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ChatHistory', chatHistorySchema);