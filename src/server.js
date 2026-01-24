// ============================================
// SYNORA - Production Server
// Stabil für 200+ gleichzeitige User
// ============================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// Crash Prevention Modules
const { globalLimiter, chatLimiter, authLimiter, analyticsLimiter } = require('./middleware/rateLimiter');
const { globalErrorHandler, notFoundHandler, setupProcessHandlers } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// PROCESS ERROR HANDLERS (Verhindert Crash)
// ============================================
setupProcessHandlers();

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ============================================
// PERFORMANCE MIDDLEWARE
// ============================================
app.use(compression());  // Komprimiert Responses

// ============================================
// BASIC MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// GLOBAL RATE LIMITER
// ============================================
app.use(globalLimiter);

// ============================================
// REQUEST LOGGING
// ============================================
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.log(`[SLOW] ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  next();
});

// ============================================
// ROUTES WITH RATE LIMITERS
// ============================================
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/chat', chatLimiter, require('./routes/chat'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/analytics', analyticsLimiter, require('./routes/analytics'));
app.use('/api/preferences', require('./routes/preferences'));

// ============================================
// HEALTH CHECK
// ============================================
app.get('/', (req, res) => {
  res.json({ 
    message: 'SYNORA Backend API',
    status: 'running',
    version: '3.0.0 (Production)',
    features: ['auth', 'chat', 'products', 'analytics', 'preferences'],
    security: ['rate-limiting', 'helmet', 'compression', 'error-handling']
  });
});

// ============================================
// STATUS ENDPOINT (für Monitoring)
// ============================================
app.get('/api/status', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// ============================================
// 404 HANDLER
// ============================================
app.use(notFoundHandler);

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
app.use(globalErrorHandler);

// ============================================
// MONGODB CONNECTION (mit Retry)
// ============================================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 50,        // Max 50 Verbindungen (für 200 User)
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB connected (Pool: 50)');
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    return false;
  }
};

// Reconnect bei Verbindungsverlust
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected. Attempting reconnect...');
  setTimeout(connectDB, 5000);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err.message);
});

// ============================================
// START SERVER
// ============================================
const startServer = async () => {
  const connected = await connectDB();
  
  if (!connected) {
    console.log('⚠️ Starting without MongoDB. Retrying connection...');
    setTimeout(connectDB, 5000);
  }
  
  app.listen(PORT, () => {
    console.log('==========================================');
    console.log('🚀 SYNORA Production Server');
    console.log('==========================================');
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log('------------------------------------------');
    console.log('🛡️  Rate Limiting: ACTIVE');
    console.log('🔒 Helmet Security: ACTIVE');
    console.log('📦 Compression: ACTIVE');
    console.log('🧠 User Preferences: ACTIVE');
    console.log('📊 Analytics: ACTIVE');
    console.log('------------------------------------------');
    console.log('📊 Stats: http://localhost:' + PORT + '/api/status');
    console.log('==========================================');
  });
};

startServer();