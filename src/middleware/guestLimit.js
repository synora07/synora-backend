// ============================================
// GUEST LIMIT MIDDLEWARE
// Erlaubt 3 kostenlose Suchen ohne Registrierung
// ============================================

// In-Memory Store für Guest-Suchen (für Production: Redis verwenden!)
const guestSearches = new Map();

// Cleanup alte Einträge alle 24 Stunden
setInterval(() => {
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  for (const [ip, data] of guestSearches.entries()) {
    if (data.firstSearch < oneDayAgo) {
      guestSearches.delete(ip);
    }
  }
  console.log(`🧹 Guest-Cache bereinigt. Aktive IPs: ${guestSearches.size}`);
}, 60 * 60 * 1000); // Jede Stunde prüfen

// ============================================
// KONFIGURATION
// ============================================
const FREE_SEARCHES = 3;           // Anzahl kostenlose Suchen
const RESET_HOURS = 24;            // Reset nach X Stunden

// ============================================
// HELPER: Get Client IP
// ============================================
function getClientIP(req) {
  // Check various headers (für Proxies/Load Balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }
  
  return req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.ip || 
         'unknown';
}

// ============================================
// MIDDLEWARE: Guest Limit Check
// ============================================
const guestLimit = (req, res, next) => {
  // Wenn User eingeloggt ist → unbegrenzt
  if (req.user) {
    console.log(`✅ Eingeloggter User: ${req.user.email || req.user.id} → Unbegrenzte Suchen`);
    return next();
  }
  
  // Guest: IP-basiertes Tracking
  const clientIP = getClientIP(req);
  const now = Date.now();
  
  // Hole oder erstelle Guest-Daten
  let guestData = guestSearches.get(clientIP);
  
  if (!guestData) {
    // Neuer Guest
    guestData = {
      searches: 0,
      firstSearch: now,
      lastSearch: now
    };
    guestSearches.set(clientIP, guestData);
  }
  
  // Check: Reset nach 24 Stunden?
  const hoursSinceFirst = (now - guestData.firstSearch) / (1000 * 60 * 60);
  if (hoursSinceFirst >= RESET_HOURS) {
    // Reset!
    guestData = {
      searches: 0,
      firstSearch: now,
      lastSearch: now
    };
    guestSearches.set(clientIP, guestData);
    console.log(`🔄 Guest ${clientIP} - Counter zurückgesetzt (24h vergangen)`);
  }
  
  // Check: Limit erreicht?
  if (guestData.searches >= FREE_SEARCHES) {
    console.log(`🚫 Guest ${clientIP} - Limit erreicht (${guestData.searches}/${FREE_SEARCHES})`);
    
    return res.status(403).json({
      error: 'registration_required',
      message: 'Du hast deine 3 kostenlosen Suchen aufgebraucht. Registriere dich kostenlos für unbegrenzte Suchen!',
      searchesUsed: guestData.searches,
      searchesLimit: FREE_SEARCHES,
      action: 'register',
      // Info für Frontend
      showRegistrationModal: true
    });
  }
  
  // Suche erlaubt → Counter erhöhen
  guestData.searches++;
  guestData.lastSearch = now;
  guestSearches.set(clientIP, guestData);
  
  // Info an Request anhängen (für Response)
  req.guestInfo = {
    isGuest: true,
    searchesUsed: guestData.searches,
    searchesRemaining: FREE_SEARCHES - guestData.searches,
    searchesLimit: FREE_SEARCHES
  };
  
  console.log(`👤 Guest ${clientIP} - Suche ${guestData.searches}/${FREE_SEARCHES}`);
  
  next();
};

// ============================================
// MIDDLEWARE: Optional Auth (für kombinierte Nutzung)
// Prüft Token wenn vorhanden, aber blockiert nicht
// ============================================
const jwt = require('jsonwebtoken');

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        console.log(`🔐 Token verifiziert: ${decoded.email || decoded.id}`);
      } catch (tokenError) {
        // Token ungültig → als Guest behandeln
        console.log(`⚠️ Ungültiger Token → Guest-Modus`);
        req.user = null;
      }
    } else {
      // Kein Token → Guest
      req.user = null;
    }
    
    next();
  } catch (error) {
    // Bei Fehler → als Guest weitermachen
    req.user = null;
    next();
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  guestLimit,
  optionalAuth,
  FREE_SEARCHES,
  // Für Admin/Debug
  getGuestStats: () => ({
    activeGuests: guestSearches.size,
    data: Array.from(guestSearches.entries()).map(([ip, data]) => ({
      ip: ip.substring(0, 8) + '***', // Anonymisiert
      searches: data.searches,
      lastSearch: new Date(data.lastSearch).toISOString()
    }))
  })
};
