// ============================================
// SYNORA V2.0 - Server
// ============================================
// GEAENDERT: zwei Zeilen dazu, in ladeAlleRouten():
//
//     ladeRoute('preisalarm', '/api/preisalarm');   02.10.2026
//     ladeRoute('dashboard', '/api/dashboard');     03.10.2026
//
// Sonst ist diese Datei unveraendert.
// ============================================
'use strict';

// Muss ganz oben stehen, damit alle Module die Variablen sehen
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 5000;
const UMGEBUNG = process.env.NODE_ENV || 'development';

// ============================================
// UMGEBUNG PRUEFEN
// Lieber jetzt laut abbrechen als spaeter still falsch laufen
// ============================================
function pruefeUmgebung() {
  const fehler = [];
  const warnungen = [];

  const jwt = process.env.JWT_SECRET;
  if (!jwt) {
    fehler.push('JWT_SECRET fehlt');
  } else if (jwt.length < 32) {
    fehler.push('JWT_SECRET ist zu kurz (mindestens 32 Zeichen)');
  } else if (/test|secret-key|changeme/i.test(jwt)) {
    fehler.push('JWT_SECRET sieht nach einem Testwert aus - bitte ersetzen');
  }

  if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
    warnungen.push('MONGODB_URI fehlt - keine Datenbank, also keine Konten, Limits oder Logs');
  }

  for (const key of ['CLAUDE_API_KEY', 'OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'SERPAPI_KEY']) {
    if (!process.env[key]) warnungen.push(`${key} fehlt`);
  }

  // ============================================
  // PRODUKTION: ADRESSEN UND SCHALTER PRUEFEN
  // ============================================
  // EINGEBAUT AM 10.10.2026, nach einem echten Fund.
  //
  // API_BASE_URL fehlte in der .env. preisAlarmService.js und
  // chatController.js fallen dann auf
  //     http://localhost:5000
  // zurueck. Auf dem eigenen Rechner faellt das nicht auf, weil
  // dort wirklich ein Server auf 5000 laeuft. Beim Empfaenger
  // einer Alarmmail zeigt der Link auf SEINEN Rechner und
  // fuehrt ins Leere: keine Provision, kein gezaehlter Klick.
  // Und es beschwert sich niemand, weil niemand versteht, was
  // passiert ist.
  //
  // Inzwischen steht in der lokalen .env
  //     API_BASE_URL=http://localhost:5000
  // Lokal ist das richtig. Wird die Datei aber als Ganzes nach
  // Railway uebertragen - der uebliche Weg, dort Variablen zu
  // fuellen - steht der Satz oben weiter drin und ist dann
  // falsch. Genau diesen Fall faengt dieser Block ab.
  //
  // WARUM ABBRECHEN UND NICHT NUR WARNEN
  // Ein Server, der nicht startet, faellt in zwei Minuten auf
  // und ist in dreissig Sekunden behoben: Variable setzen, neu
  // deployen. Ein Server, der laeuft und stillschweigend
  // unbrauchbare Links verschickt, faellt wochenlang nicht auf.
  if (UMGEBUNG === 'production') {
    const LOKAL = /(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i;
    const AUS = (w) => !w || w === '0' || w === 'false' || w === 'nein';

    const basis = process.env.API_BASE_URL;
    if (!basis) {
      fehler.push('API_BASE_URL fehlt. Setze API_BASE_URL=https://api.synora.li');
    } else if (LOKAL.test(basis)) {
      fehler.push(
        `API_BASE_URL zeigt auf diesen Rechner ("${basis}"). Jeder Link in ` +
        'den Alarmmails und jeder "Zum Shop"-Knopf waere unbrauchbar. ' +
        'Setze API_BASE_URL=https://api.synora.li'
      );
    } else {
      if (/^http:\/\//i.test(basis)) {
        warnungen.push(`API_BASE_URL ohne https: ${basis}`);
      }
      if (basis.endsWith('/')) {
        warnungen.push('API_BASE_URL endet mit "/" - die Links bekommen davon einen doppelten Schraegstrich');
      }
    }

    // ABSPIELEN liefert aufgezeichnete SerpAPI-Antworten. In
    // Produktion waeren das erfundene Preise auf der Seite -
    // der eine Fehler, den SYNORA sich nicht erlauben darf.
    if (!AUS(process.env.ABSPIELEN)) {
      fehler.push(
        'ABSPIELEN ist eingeschaltet. Die Preise kaemen aus einer Aufzeichnung ' +
        'statt von SerpAPI. In Produktion nicht erlaubt - Variable entfernen.'
      );
    }

    const db = process.env.MONGODB_URI || process.env.MONGO_URI || '';
    if (db && LOKAL.test(db)) {
      fehler.push('MONGODB_URI zeigt auf diesen Rechner - dort gibt es in Produktion keine Datenbank');
    }

    if (process.env.TEST_TOKEN) {
      warnungen.push('TEST_TOKEN ist in Produktion gesetzt - vor dem Start entfernen');
    }

    // Derselbe Fehler kann in Variablen stecken, die ich nicht
    // kenne. ALLOWED_ORIGINS ist ausgenommen: dort gehoert
    // localhost legitim hinein, fuer die Entwicklung.
    const EGAL = new Set(['ALLOWED_ORIGINS', 'API_BASE_URL', 'MONGODB_URI', 'MONGO_URI']);
    for (const name of Object.keys(process.env)) {
      if (EGAL.has(name)) continue;
      if (name.startsWith('npm_') || name.startsWith('RAILWAY_')) continue;
      const wert = process.env[name];
      if (typeof wert === 'string' && LOKAL.test(wert)) {
        warnungen.push(`${name} enthaelt eine lokale Adresse: ${wert}`);
      }
    }
  } else if (!process.env.API_BASE_URL) {
    warnungen.push('API_BASE_URL fehlt - Links in Alarmmails zeigen vorerst auf http://localhost:5000');
  }


  warnungen.forEach((w) => console.warn(`[WARNUNG] ${w}`));

  if (fehler.length) {
    console.error('');
    console.error('SERVER NICHT GESTARTET:');
    fehler.forEach((f) => console.error(`  - ${f}`));
    console.error('');
    process.exit(1);
  }
}

// ============================================
// MIDDLEWARE
// ============================================

// Railway und Vercel sitzen als Proxy davor. Ohne diese Zeile sieht
// Express bei JEDEM Request dieselbe IP - deine IP-Limits und die
// Bot-Bremse waeren damit wirkungslos.
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());

// --- CORS nur fuer eigene Domains ---
const ERLAUBTE_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  'https://synora.li,https://www.synora.li,http://localhost:3000,http://localhost:5173'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Kein Origin: curl, Postman, Server-zu-Server. Erlaubt.
    if (!origin) return callback(null, true);
    if (ERLAUBTE_ORIGINS.includes(origin)) return callback(null, true);
    // Vercel-Vorschauen nur wenn ausdruecklich eingeschaltet
    if (
      process.env.ALLOW_VERCEL_PREVIEWS === 'true' &&
      /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS_BLOCKIERT:${origin}`));
  },
  credentials: true
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan(UMGEBUNG === 'production' ? 'combined' : 'dev'));

// ============================================
// ROUTEN
// Kritische Routen duerfen NICHT still ausfallen
// ============================================
const routenStatus = {};

function ladeRoute(name, pfad, kritisch = false) {
  try {
    const route = require(`./routes/${name}`);
    app.use(pfad, route);
    routenStatus[name] = 'geladen';
    console.log(`  [ok]   ${pfad}  ->  routes/${name}.js`);
  } catch (e) {
    routenStatus[name] = `FEHLER: ${e.message}`;
    console.error(`  [FEHLER] routes/${name}.js: ${e.message}`);
    if (e.stack) console.error(e.stack.split('\n').slice(1, 4).join('\n'));

    if (kritisch) {
      console.error('');
      console.error(`Route "${name}" ist kritisch. Server wird nicht gestartet.`);
      console.error('');
      process.exit(1);
    }
  }
}

function ladeAlleRouten() {
  // Schutz gegen Durchprobieren beim Login - muss VOR der Route stehen
  try {
    const { authBremse } = require('./middleware/botBremse');
    app.use('/api/auth', authBremse);
    console.log('Bot-Bremse fuer /api/auth aktiv');
  } catch (e) {
    console.warn('[WARNUNG] Bot-Bremse nicht geladen:', e.message);
  }

  console.log('Routen:');
  ladeRoute('auth', '/api/auth', true);
  ladeRoute('chat', '/api/chat', true);
  ladeRoute('productRoutes', '/api/products');
  ladeRoute('preferences', '/api/preferences');
  ladeRoute('analytics', '/api/analytics');
  ladeRoute('fehler', '/api/fehler');
  ladeRoute('conversation', '/api/conversation');
  ladeRoute('userProfile', '/api/user');
  ladeRoute('go', '/api/go');
  ladeRoute('shops', '/api/shops');

  // NEU am 02.10.2026: Preisalarm
  // Nicht kritisch - faellt er aus, laeuft die Suche weiter.
  ladeRoute('preisalarm', '/api/preisalarm');

  // NEU am 03.10.2026: Dashboard
  // Durch den ANALYTICS_TOKEN geschuetzt. Fehlt der Token, ist die
  // Route in Produktion gesperrt - nicht offen.
  ladeRoute('dashboard', '/api/dashboard');

  // NEU: Einstellungen und Rueckmeldungen
  // /api/einstellungen liefert Preise und Suchgrenzen an das
  // Frontend - aus denselben Objekten, die sie auch durchsetzen.
  // Ohne diese Zeile bleiben Premium-Seite und AGB-Preise leer.
  ladeRoute('einstellungen', '/api/einstellungen');
  ladeRoute('rueckmeldung', '/api');
}

// ============================================
// HEALTH & STATUS
// ============================================
function registriereStatusRouten() {
  app.get('/', (req, res) => {
    res.json({ message: 'SYNORA Backend API', status: 'running', version: '2.0.0' });
  });

  // Fuer Railway: antwortet immer schnell, ohne Datenbank
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Fuer dich: zeigt ehrlich, was laeuft und was nicht
  app.get('/api/status', (req, res) => {
    const dbVerbunden = mongoose.connection.readyState === 1;
    const routenKaputt = Object.entries(routenStatus)
      .filter(([, wert]) => wert !== 'geladen')
      .map(([name]) => name);

    res.status(dbVerbunden && routenKaputt.length === 0 ? 200 : 503).json({
      status: dbVerbunden && routenKaputt.length === 0 ? 'healthy' : 'degraded',
      umgebung: UMGEBUNG,
      uptime_sekunden: Math.floor(process.uptime()),
      mongodb: dbVerbunden ? 'connected' : 'disconnected',
      routen: routenStatus,
      routen_kaputt: routenKaputt,
      // nur ob gesetzt, niemals der Wert selbst
      keys_gesetzt: {
        claude: !!process.env.CLAUDE_API_KEY,
        openai: !!process.env.OPENAI_API_KEY,
        perplexity: !!process.env.PERPLEXITY_API_KEY,
        serpapi: !!process.env.SERPAPI_KEY
      }
    });
  });
}

// ============================================
// 404 & FEHLERBEHANDLUNG
// Muss NACH allen Routen registriert werden
// ============================================
function registriereFehlerbehandlung() {
  app.use((req, res) => {
    res.status(404).json({ error: 'Route nicht gefunden', path: req.path });
  });

  app.use((err, req, res, next) => {
    if (err && typeof err.message === 'string' && err.message.startsWith('CORS_BLOCKIERT:')) {
      const origin = err.message.split(':').slice(1).join(':');
      console.warn(`[CORS] blockiert: ${origin}`);
      return res.status(403).json({ error: 'Zugriff von dieser Domain nicht erlaubt' });
    }

    console.error('[FEHLER]', err && err.stack ? err.stack : err);

    // Details nur lokal, nie fuer den Nutzer in Produktion
    res.status(err.status || 500).json({
      error: 'Interner Server Fehler',
      detail: UMGEBUNG === 'production' ? undefined : err && err.message
    });
  });
}

// ============================================
// DATENBANK
// ============================================
async function verbindeDatenbank() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) return false;

  mongoose.connection.on('disconnected', () => console.warn('[DB] Verbindung verloren'));
  mongoose.connection.on('reconnected', () => console.log('[DB] wieder verbunden'));
  mongoose.connection.on('error', (e) => console.error('[DB] Fehler:', e.message));

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('[DB] verbunden');
    return true;
  } catch (e) {
    console.error('[DB] Verbindung fehlgeschlagen:', e.message);
    return false;
  }
}

// ============================================
// START
// ============================================
async function starte() {
  pruefeUmgebung();

  const dbOk = await verbindeDatenbank();
  if (!dbOk) {
    console.warn('');
    console.warn('==========================================');
    console.warn('OHNE DATENBANK: Konten, Tageslimits, Analytics,');
    console.warn('Fehlerlog und Chatverlauf funktionieren NICHT.');
    console.warn('==========================================');
    console.warn('');
  }

  ladeAlleRouten();
  registriereStatusRouten();
  registriereFehlerbehandlung();

  const server = app.listen(PORT, () => {
    console.log('');
    console.log('==========================================');
    console.log(`SYNORA V2.0 Backend  |  ${UMGEBUNG}`);
    console.log(`Port ${PORT}  |  DB ${dbOk ? 'ok' : 'FEHLT'}`);
    console.log(`CORS erlaubt: ${ERLAUBTE_ORIGINS.join(', ')}`);
    console.log('==========================================');
    console.log('');
  });

  // Railway schickt SIGTERM beim Neu-Deployen
  const beenden = async (signal) => {
    console.log(`\n[${signal}] Server wird beendet...`);
    server.close(async () => {
      await mongoose.connection.close().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => beenden('SIGTERM'));
  process.on('SIGINT', () => beenden('SIGINT'));

  process.on('unhandledRejection', (grund) => {
    console.error('[UNHANDLED REJECTION]', grund);
  });
}

starte();

module.exports = app;