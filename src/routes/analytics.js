// ============================================
// SYNORA - Analytics Routes
// API Endpoints für User-Tracking
// ============================================

const express = require('express');
const router = express.Router();
const Analytics = require('../models/Analytics');
const jwt = require('jsonwebtoken');

// ============================================
// HELPER: User ID aus Token holen
// ============================================
const getUserId = (req) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded.userId;
    }
  } catch (e) {}
  return null;
};

// ============================================
// HELPER: Device Info erkennen
// ============================================
const parseUserAgent = (ua) => {
  ua = ua || '';
  
  // Device Type
  let type = 'desktop';
  if (/mobile/i.test(ua)) type = 'mobile';
  if (/tablet|ipad/i.test(ua)) type = 'tablet';
  
  // Browser
  let browser = 'unknown';
  if (/chrome/i.test(ua) && !/edge/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/edge/i.test(ua)) browser = 'Edge';
  
  // OS
  let os = 'unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad/i.test(ua)) os = 'iOS';
  
  return { type, browser, os };
};

// ============================================
// POST /api/analytics/track
// Haupt-Tracking Endpoint
// ============================================
router.post('/track', async (req, res) => {
  try {
    const {
      eventType,
      sessionId,
      searchQuery,
      searchCategory,
      searchResultsCount,
      productName,
      productPrice,
      productShop,
      productCategory,
      productScore,
      productPosition,
      shopName,
      shopUrl,
      pageUrl,
      pageName,
      screenWidth,
      screenHeight,
      metadata
    } = req.body;
    
    const userId = getUserId(req);
    const device = parseUserAgent(req.headers['user-agent']);
    device.screenWidth = screenWidth;
    device.screenHeight = screenHeight;
    
    // IP für Location (anonymisiert speichern)
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    
    const analytics = new Analytics({
      userId,
      sessionId: sessionId || `anon_${Date.now()}`,
      eventType,
      searchQuery,
      searchCategory,
      searchResultsCount,
      productName,
      productPrice,
      productShop,
      productCategory,
      productScore,
      productPosition,
      shopName,
      shopUrl,
      pageUrl,
      pageName,
      referrer: req.headers.referer,
      device,
      location: { ip },
      metadata
    });
    
    await analytics.save();
    
    res.json({ success: true, id: analytics._id });
    
  } catch (error) {
    console.error('Analytics track error:', error);
    res.status(500).json({ error: 'Tracking failed' });
  }
});

// ============================================
// POST /api/analytics/search
// Such-Event tracken
// ============================================
router.post('/search', async (req, res) => {
  try {
    const { sessionId, query, category, resultsCount, products } = req.body;
    const userId = getUserId(req);
    
    const analytics = new Analytics({
      userId,
      sessionId,
      eventType: 'search',
      searchQuery: query,
      searchCategory: category,
      searchResultsCount: resultsCount,
      device: parseUserAgent(req.headers['user-agent']),
      metadata: { topProducts: products?.slice(0, 3) }
    });
    
    await analytics.save();
    console.log(`📊 Search tracked: "${query}" (${resultsCount} results)`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Search tracking error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// ============================================
// POST /api/analytics/product-click
// Produkt-Klick tracken
// ============================================
router.post('/product-click', async (req, res) => {
  try {
    const { sessionId, product, position } = req.body;
    const userId = getUserId(req);
    
    const analytics = new Analytics({
      userId,
      sessionId,
      eventType: 'product_click',
      productName: product.name,
      productPrice: product.price,
      productShop: product.shopName || product.source,
      productCategory: product.category,
      productScore: product.score,
      productPosition: position,
      device: parseUserAgent(req.headers['user-agent'])
    });
    
    await analytics.save();
    console.log(`📊 Product click: ${product.name}`);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ============================================
// POST /api/analytics/shop-click
// Shop-Link Klick tracken (Affiliate)
// ============================================
router.post('/shop-click', async (req, res) => {
  try {
    const { sessionId, shopName, shopUrl, product } = req.body;
    const userId = getUserId(req);
    
    const analytics = new Analytics({
      userId,
      sessionId,
      eventType: 'shop_click',
      shopName,
      shopUrl,
      productName: product?.name,
      productPrice: product?.price,
      device: parseUserAgent(req.headers['user-agent'])
    });
    
    await analytics.save();
    console.log(`📊 Shop click: ${shopName}`);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ============================================
// GET /api/analytics/stats
// Dashboard Statistiken
// ============================================
router.get('/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);
    
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);
    
    // Gesamt-Statistiken
    const totalEvents = await Analytics.countDocuments();
    const totalSearches = await Analytics.countDocuments({ eventType: 'search' });
    const totalProductClicks = await Analytics.countDocuments({ eventType: 'product_click' });
    const totalShopClicks = await Analytics.countDocuments({ eventType: 'shop_click' });
    const uniqueUsers = await Analytics.distinct('userId').then(arr => arr.filter(Boolean).length);
    const uniqueSessions = await Analytics.distinct('sessionId').then(arr => arr.length);
    
    // Heute
    const todaySearches = await Analytics.countDocuments({ 
      eventType: 'search', 
      timestamp: { $gte: today } 
    });
    const todayShopClicks = await Analytics.countDocuments({ 
      eventType: 'shop_click', 
      timestamp: { $gte: today } 
    });
    
    // Top Suchen (letzte 30 Tage)
    const topSearches = await Analytics.aggregate([
      { $match: { eventType: 'search', timestamp: { $gte: last30Days } } },
      { $group: { _id: { $toLower: '$searchQuery' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);
    
    // Top Produkte (geklickt)
    const topProducts = await Analytics.aggregate([
      { $match: { eventType: 'product_click', timestamp: { $gte: last30Days } } },
      { $group: { _id: '$productName', count: { $sum: 1 }, shop: { $first: '$productShop' } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);
    
    // Top Shops (geklickt)
    const topShops = await Analytics.aggregate([
      { $match: { eventType: 'shop_click', timestamp: { $gte: last30Days } } },
      { $group: { _id: '$shopName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);
    
    // Nach Kategorie
    const byCategory = await Analytics.aggregate([
      { $match: { eventType: 'search', searchCategory: { $ne: null } } },
      { $group: { _id: '$searchCategory', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Nach Device
    const byDevice = await Analytics.aggregate([
      { $group: { _id: '$device.type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Aktivität letzte 7 Tage
    const dailyActivity = await Analytics.aggregate([
      { $match: { timestamp: { $gte: last7Days } } },
      { 
        $group: { 
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          searches: { $sum: { $cond: [{ $eq: ['$eventType', 'search'] }, 1, 0] } },
          productClicks: { $sum: { $cond: [{ $eq: ['$eventType', 'product_click'] }, 1, 0] } },
          shopClicks: { $sum: { $cond: [{ $eq: ['$eventType', 'shop_click'] }, 1, 0] } },
          total: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      success: true,
      stats: {
        overview: {
          totalEvents,
          totalSearches,
          totalProductClicks,
          totalShopClicks,
          uniqueUsers,
          uniqueSessions,
          todaySearches,
          todayShopClicks
        },
        topSearches: topSearches.map(s => ({ query: s._id, count: s.count })),
        topProducts: topProducts.map(p => ({ name: p._id, shop: p.shop, clicks: p.count })),
        topShops: topShops.map(s => ({ name: s._id, clicks: s.count })),
        byCategory,
        byDevice,
        dailyActivity
      }
    });
    
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============================================
// GET /api/analytics/searches
// Alle Suchen anzeigen
// ============================================
router.get('/searches', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    
    const searches = await Analytics.find({ eventType: 'search' })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('searchQuery searchCategory searchResultsCount timestamp userId sessionId');
    
    const total = await Analytics.countDocuments({ eventType: 'search' });
    
    res.json({
      success: true,
      data: searches,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ============================================
// GET /api/analytics/user/:userId
// User-spezifische Daten
// ============================================
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const activities = await Analytics.find({ userId })
      .sort({ timestamp: -1 })
      .limit(200);
    
    const searchCount = await Analytics.countDocuments({ userId, eventType: 'search' });
    const clickCount = await Analytics.countDocuments({ userId, eventType: 'product_click' });
    
    const topSearches = await Analytics.aggregate([
      { $match: { userId: new require('mongoose').Types.ObjectId(userId), eventType: 'search' } },
      { $group: { _id: '$searchQuery', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      success: true,
      user: {
        searchCount,
        clickCount,
        topSearches,
        recentActivity: activities
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ============================================
// GET /api/analytics/export
// Daten exportieren (CSV)
// ============================================
router.get('/export', async (req, res) => {
  try {
    const { startDate, endDate, eventType } = req.query;
    
    const query = {};
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    if (eventType) query.eventType = eventType;
    
    const data = await Analytics.find(query)
      .sort({ timestamp: -1 })
      .limit(10000)
      .lean();
    
    // CSV Format
    const headers = ['timestamp', 'eventType', 'userId', 'sessionId', 'searchQuery', 'productName', 'shopName', 'device'];
    const csv = [
      headers.join(','),
      ...data.map(row => [
        row.timestamp?.toISOString(),
        row.eventType,
        row.userId || '',
        row.sessionId,
        `"${(row.searchQuery || '').replace(/"/g, '""')}"`,
        `"${(row.productName || '').replace(/"/g, '""')}"`,
        row.shopName || '',
        row.device?.type || ''
      ].join(','))
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=synora-analytics.csv');
    res.send(csv);
    
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;