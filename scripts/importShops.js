// ==========================================
// SYNORA - COMPLETE SHOP DATABASE IMPORT
// scripts/importShops.js
// 
// Kategorien:
// - Fashion (Kleider): 7 Subkategorien
// - Elektronik: 9 Subkategorien  
// - Kosmetik: 12 Subkategorien
// 
// Länder: CH, DE, US, IN
// Total: ~1'700+ Shops
// ==========================================

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

// Import Shop Model
const Shop = require('../models/Shop');

// Import Shop Data
const { FASHION_SHOPS } = require('./data/fashionShops');
const { ELEKTRONIK_SHOPS } = require('./data/elektronikShops');
const { KOSMETIK_SHOPS } = require('./data/kosmetikShops');

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI nicht gefunden in .env!');
  console.log('   Bitte erstelle eine .env Datei mit:');
  console.log('   MONGODB_URI=mongodb+srv://...');
  process.exit(1);
}

// Combine all shop data
const ALL_SHOPS = {
  fashion: FASHION_SHOPS,
  elektronik: ELEKTRONIK_SHOPS,
  kosmetik: KOSMETIK_SHOPS
};

// Helper function to convert compact array format to object
function convertToShopObject(arr, country, mainCategory, subCategory) {
  return {
    name: arr[0],
    domain: arr[1],
    country: country,
    mainCategory: mainCategory,
    subCategory: subCategory,
    note: arr[2] || '',
    isActive: true
  };
}

// Main import function
async function importAllShops() {
  console.log('═'.repeat(60));
  console.log('  SYNORA - SHOP DATABASE IMPORT');
  console.log('═'.repeat(60));
  console.log();
  
  try {
    // Connect to MongoDB
    console.log('🔗 Verbinde mit MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Verbunden mit MongoDB!\n');

    // Get existing count
    const existingCount = await Shop.countDocuments();
    console.log(`📊 Bestehende Shops in Datenbank: ${existingCount}\n`);

    // Ask for confirmation if shops exist
    if (existingCount > 0) {
      console.log('⚠️  Es existieren bereits Shops. Neue werden hinzugefügt,');
      console.log('   Duplikate werden übersprungen.\n');
    }

    // Statistics
    let totalProcessed = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    const categoryStats = {};

    // Process each main category
    for (const [mainCategory, subCategories] of Object.entries(ALL_SHOPS)) {
      console.log(`\n📦 ${mainCategory.toUpperCase()}`);
      console.log('─'.repeat(50));

      categoryStats[mainCategory] = { inserted: 0, skipped: 0 };

      for (const [subCategory, countries] of Object.entries(subCategories)) {
        let categoryInserted = 0;
        let categorySkipped = 0;

        for (const [country, shops] of Object.entries(countries)) {
          for (const shopArr of shops) {
            totalProcessed++;
            
            const shopData = convertToShopObject(shopArr, country, mainCategory, subCategory);
            
            try {
              // Try to insert (will fail if duplicate)
              await Shop.create(shopData);
              totalInserted++;
              categoryInserted++;
              categoryStats[mainCategory].inserted++;
            } catch (error) {
              if (error.code === 11000) {
                // Duplicate - skip
                totalSkipped++;
                categorySkipped++;
                categoryStats[mainCategory].skipped++;
              } else {
                console.error(`  ❌ Error: ${shopData.name} - ${error.message}`);
                totalErrors++;
              }
            }
          }
        }

        const status = categoryInserted > 0 ? '✅' : '⏭️';
        console.log(`  ${status} ${subCategory}: +${categoryInserted} neu (${categorySkipped} übersprungen)`);
      }
    }

    // Final statistics
    console.log('\n' + '═'.repeat(60));
    console.log('  📊 IMPORT ABGESCHLOSSEN!');
    console.log('═'.repeat(60));
    console.log(`  Verarbeitet:     ${totalProcessed}`);
    console.log(`  ✅ Eingefügt:     ${totalInserted}`);
    console.log(`  ⏭️  Übersprungen:  ${totalSkipped} (Duplikate)`);
    console.log(`  ❌ Fehler:        ${totalErrors}`);
    
    // Get final count
    const finalCount = await Shop.countDocuments();
    console.log(`\n  📊 Total Shops in Datenbank: ${finalCount}`);

    // Category breakdown
    console.log('\n' + '─'.repeat(60));
    console.log('  KATEGORIE ÜBERSICHT:');
    console.log('─'.repeat(60));
    
    for (const [cat, stats] of Object.entries(categoryStats)) {
      console.log(`  ${cat.toUpperCase()}: +${stats.inserted} neu, ${stats.skipped} übersprungen`);
    }

    // Detailed category stats from DB
    console.log('\n' + '─'.repeat(60));
    console.log('  DETAILLIERTE STATISTIK:');
    console.log('─'.repeat(60));
    
    const dbCategoryStats = await Shop.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: { main: '$mainCategory', sub: '$subCategory' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.main': 1, '_id.sub': 1 } }
    ]);

    let currentMain = '';
    for (const stat of dbCategoryStats) {
      if (stat._id.main !== currentMain) {
        currentMain = stat._id.main;
        console.log(`\n  ${currentMain.toUpperCase()}`);
      }
      console.log(`    └─ ${stat._id.sub}: ${stat.count} shops`);
    }

    // Country breakdown
    console.log('\n' + '─'.repeat(60));
    console.log('  LÄNDER ÜBERSICHT:');
    console.log('─'.repeat(60));
    
    const countryStats = await Shop.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$country',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    for (const stat of countryStats) {
      const flag = {
        'CH': '🇨🇭',
        'DE': '🇩🇪',
        'US': '🇺🇸',
        'IN': '🇮🇳'
      }[stat._id] || '🏳️';
      console.log(`  ${flag} ${stat._id}: ${stat.count} shops`);
    }

    console.log('\n' + '═'.repeat(60));
    console.log('  ✅ SYNORA Shop Datenbank ist bereit!');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('\n❌ Import fehlgeschlagen:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 MongoDB Verbindung geschlossen');
  }
}

// Run import
console.log();
importAllShops();