const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { guestLimit, optionalAuth } = require('../middleware/guestLimit');
const chatController = require('../controllers/chatController');

// ============================================
// CHAT ROUTES
// ============================================

// Send message - MIT GUEST LIMIT
// 1. optionalAuth: Prüft Token (wenn vorhanden)
// 2. guestLimit: Wenn kein User → max 3 Suchen
router.post('/', optionalAuth, guestLimit, chatController.sendMessage);

// Get chat history - MIT AUTH (nur für eingeloggte User)
router.get('/history', auth, chatController.getChatHistory);

// Delete chat history - MIT AUTH
router.delete('/history/:id?', auth, chatController.deleteChatHistory);

// Get preferences - MIT AUTH
router.get('/preferences', auth, chatController.getPreferences);

// Save preferences - MIT AUTH
router.post('/preferences', auth, chatController.savePreferences);

// ============================================
// GUEST INFO ROUTE (Optional - für Frontend)
// ============================================
router.get('/guest-status', optionalAuth, (req, res) => {
  if (req.user) {
    // Eingeloggt → unbegrenzt
    return res.json({
      isLoggedIn: true,
      unlimited: true,
      user: {
        email: req.user.email,
        name: req.user.name || req.user.firstname
      }
    });
  }
  
  // Guest → Status zurückgeben
  // Hinweis: Hier könnten wir auch den aktuellen Stand abrufen
  res.json({
    isLoggedIn: false,
    unlimited: false,
    freeSearches: 3,
    message: 'Du hast 3 kostenlose Suchen. Registriere dich für unbegrenzten Zugang!'
  });
});

module.exports = router;
