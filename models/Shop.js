// ==========================================
// SYNORA - Shop Model
// models/Shop.js
// ==========================================

const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  // Basic Info
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  domain: { 
    type: String, 
    required: true,
    trim: true,
    lowercase: true
  },
  
  // Location
  country: { 
    type: String, 
    required: true,
    uppercase: true,
    enum: ['CH', 'DE', 'US', 'IN', 'FR', 'IT', 'ES', 'NL', 'CA', 'BR', 'LK', 'JP', 'KR', 'ID', 'SG']
  },
  
  // Categories
  mainCategory: { 
    type: String, 
    required: true,
    lowercase: true,
    enum: ['fashion', 'elektronik', 'kosmetik']
  },
  subCategory: { 
    type: String, 
    required: true,
    lowercase: true
  },
  
  // Additional Info
  note: {
    type: String,
    trim: true
  },
  
  // Status
  isActive: { 
    type: Boolean, 
    default: true 
  },
  
  // Metadata
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Compound unique index (same domain can exist in different countries)
shopSchema.index({ domain: 1, country: 1 }, { unique: true });

// Additional indexes for faster queries
shopSchema.index({ mainCategory: 1, subCategory: 1 });
shopSchema.index({ country: 1 });
shopSchema.index({ isActive: 1 });

// Update timestamp on save
shopSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for full URL
shopSchema.virtual('url').get(function() {
  return `https://${this.domain}`;
});

// Instance method to get display info
shopSchema.methods.getDisplayInfo = function() {
  return {
    name: this.name,
    domain: this.domain,
    url: this.url,
    country: this.country,
    category: `${this.mainCategory} > ${this.subCategory}`,
    note: this.note
  };
};

// Static method to find shops by category
shopSchema.statics.findByCategory = function(mainCategory, subCategory, country) {
  const query = { isActive: true };
  if (mainCategory) query.mainCategory = mainCategory.toLowerCase();
  if (subCategory) query.subCategory = subCategory.toLowerCase();
  if (country) query.country = country.toUpperCase();
  return this.find(query).sort({ name: 1 });
};

// Static method to get category statistics
shopSchema.statics.getCategoryStats = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: { main: '$mainCategory', sub: '$subCategory' },
        count: { $sum: 1 },
        countries: { $addToSet: '$country' }
      }
    },
    { $sort: { '_id.main': 1, '_id.sub': 1 } }
  ]);
};

// Static method to get country statistics
shopSchema.statics.getCountryStats = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$country',
        count: { $sum: 1 },
        categories: { $addToSet: '$mainCategory' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

const Shop = mongoose.model('Shop', shopSchema);

module.exports = Shop;