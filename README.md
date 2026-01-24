# 🛒 SYNORA Backend

> **AI-Powered Shopping Assistant - Backend API**

Production-ready Backend für 200+ gleichzeitige User.

---

## 📁 Ordnerstruktur

```
synora-backend/
├── middleware/
│   ├── rateLimiter.js       # Rate Limiting (Crash Prevention)
│   ├── errorHandler.js      # Global Error Handling
│   ├── cache.js             # Caching System
│   └── requestQueue.js      # Request Queue für Claude API
├── models/
│   ├── User.js              # User Model
│   ├── Shop.js              # Shop Database Model
│   ├── Analytics.js         # Analytics Tracking Model
│   └── UserPreferences.js   # User Präferenzen (Lern-System)
├── routes/
│   ├── auth.js              # Login, Register, Verify
│   ├── chat.js              # Claude AI Chat
│   ├── productRoutes.js     # Produkt-Suche
│   ├── analytics.js         # Analytics API
│   └── preferences.js       # User-Präferenzen API
├── scripts/
│   └── data/
│       ├── fashionShops.js  # Fashion Shops (~560)
│       ├── elektronikShops.js # Elektronik Shops (~540)
│       └── kosmetikShops.js # Kosmetik Shops (~720)
├── server.js                # Production Server
├── .env                     # Environment Variables
└── package.json
```

---

## ✨ Features

| Feature | Beschreibung |
|---------|--------------|
| 🔐 **Authentication** | Login, Register, Email-Verification, JWT |
| 🤖 **Claude AI** | Intelligente Produktempfehlungen |
| 📊 **Analytics** | Tracking wie ChatGPT/Claude |
| 🧠 **User Learning** | Lernt Präferenzen von jedem User |
| 🛡️ **Crash Prevention** | Rate Limiting, Error Handling |
| 📦 **Shop Database** | 1'820+ Shops in 4 Ländern |

---

## 📊 Shop Database

| Kategorie | Subkategorien | Shops |
|-----------|---------------|-------|
| **Fashion** | Damenmode, Herrenmode, Schuhe, etc. | ~560 |
| **Elektronik** | Mobile, Computer, Gaming, Audio, etc. | ~540 |
| **Kosmetik** | Gesicht, Makeup, Körper, Haare, etc. | ~720 |
| **TOTAL** | 28 Subkategorien | **~1'820** |

**Länder:** 🇨🇭 CH, 🇩🇪 DE, 🇺🇸 US, 🇮🇳 IN

---

## 🛡️ Crash Prevention

| Schutz | Beschreibung |
|--------|--------------|
| **Rate Limiting** | Max 10 Suchen/min pro User |
| **MongoDB Pool** | 50 Verbindungen (für 200 User) |
| **Error Handling** | App crasht nie |
| **Compression** | Schnellere Responses |
| **Helmet** | Security Headers |
| **Auto-Reconnect** | MongoDB reconnected automatisch |

---

## 🚀 Installation

### 1. Repository klonen
```bash
git clone https://github.com/your-repo/synora-backend.git
cd synora-backend
```

### 2. Dependencies installieren
```bash
npm install
```

### 3. .env Datei erstellen
```env
# MongoDB
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/synora

# JWT
JWT_SECRET=your-super-secret-key

# Claude AI
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Email (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Server
PORT=5000
NODE_ENV=production
```

### 4. Server starten
```bash
npm start
```

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| POST | `/api/auth/register` | Neuen User registrieren |
| POST | `/api/auth/login` | User einloggen |
| GET | `/api/auth/verify/:token` | Email verifizieren |

### Chat (Claude AI)
| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| POST | `/api/chat` | Produktsuche mit AI |

### Analytics
| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| POST | `/api/analytics/track` | Event tracken |
| POST | `/api/analytics/search` | Suche tracken |
| GET | `/api/analytics/stats` | Dashboard Stats |

### User Preferences
| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| POST | `/api/preferences/learn/search` | Von Suche lernen |
| POST | `/api/preferences/learn/product` | Von Klick lernen |
| GET | `/api/preferences/profile` | User-Profil für AI |

### Status
| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/` | Health Check |
| GET | `/api/status` | Server Status |

---

## 📊 Analytics Dashboard

```
http://localhost:5000/api/analytics/stats
```

Zeigt:
- Total Searches, Clicks, Users
- Top Suchbegriffe
- Top Produkte
- Top Shops
- Device-Verteilung
- Tägliche Aktivität

---

## 🧠 User Learning System

SYNORA lernt automatisch von jedem User:

| Was wird gelernt | Beispiel |
|------------------|----------|
| Lieblings-Kategorie | Electronics > Fashion |
| Budget-Range | 200-500 CHF |
| Top-Shops | Digitec, Galaxus |
| Top-Marken | Apple, Samsung |
| Keywords | "laptop", "gaming" |

```
http://localhost:5000/api/preferences/profile
```

---

## 🔧 Scripts

```bash
# Development
npm run dev

# Production
npm start

# Shops importieren
cd scripts
node importShops.js
```

---

## 📋 Erwartete Startup-Ausgabe

```
==========================================
🚀 SYNORA Production Server
==========================================
✅ Server running on port 5000
📍 http://localhost:5000
------------------------------------------
🛡️  Rate Limiting: ACTIVE
🔒 Helmet Security: ACTIVE
📦 Compression: ACTIVE
🧠 User Preferences: ACTIVE
📊 Analytics: ACTIVE
------------------------------------------
📊 Stats: http://localhost:5000/api/status
==========================================
```

---

## 🧪 Testing

### Server Status prüfen
```bash
curl http://localhost:5000/api/status
```

### Analytics Stats abrufen
```bash
curl http://localhost:5000/api/analytics/stats
```

---

## 📦 Dependencies

```json
{
  "express": "^4.18.x",
  "mongoose": "^7.x",
  "cors": "^2.8.x",
  "jsonwebtoken": "^9.x",
  "bcryptjs": "^2.4.x",
  "nodemailer": "^6.x",
  "express-rate-limit": "^7.x",
  "helmet": "^7.x",
  "compression": "^1.7.x",
  "@anthropic-ai/sdk": "^0.x"
}
```

---

## 🚀 Deployment

### Railway
```bash
railway login
railway init
railway up
```

### Environment Variables setzen nicht vergessen!

---

## 📄 Lizenz

MIT License - SYNORA © 2025

---

**SYNORA** - AI-Powered Shopping Assistant 🛒