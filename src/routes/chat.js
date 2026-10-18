// ============================================
// SYNORA - Chat Routes
// ============================================
// GEAENDERT am 02.10.2026: tageslimit -> suchLimit
//
// Die alte Regel war: 3 Suchen ohne Konto pro Tag, 15 mit Konto.
// Die neue steht in middleware/suchLimit.js:
//
//   ohne Konto    0   - ein Konto ist Pflicht
//   mit Konto     5   pro Monat
//   Premium      15   pro Monat
//
// WICHTIG: tageslimit und suchLimit duerfen NICHT beide hier
// stehen. Beide setzen req.limit, beide zaehlen dieselbe Suche -
// das zweite ueberschreibt das erste, und am Ende gilt eine Zahl,
// die niemand erwartet hat.
'use strict';

const express = require('express');
const router = express.Router();

const { optionalAuth, requireAuth } = require('../middleware/auth');
const suchLimit = require('../middleware/suchLimit');
const { sucheBremse } = require('../middleware/botBremse');

// Bewusst ohne try/catch: faellt der Controller aus, darf der Server
// nicht starten. Ein leeres Ergebnis sieht fuer den Nutzer aus wie
// "nichts gefunden" - er wartet, bekommt nichts und geht.
const chatController = require('../controllers/chatController');

// ============================================
// CHAT / SUCHE - POST /api/chat
//
// Reihenfolge ist wichtig und kostet in dieser Folge am wenigsten:
// 1. optionalAuth  - wer ist da
// 2. sucheBremse   - zu schnell? kostet nichts, bricht sofort ab
// 3. suchLimit     - Kontingent aufgebraucht? eine Datenbankabfrage
// 4. Controller    - erst hier wird echtes Geld ausgegeben
//
// Die Franken-Wand (services/kostenbremse.js) sitzt noch eine Stufe
// tiefer, im Controller selbst: direkt vor dem SerpAPI-Aufruf. Eine
// Rueckfrage und ein Treffer aus dem Cache kosten nichts und werden
// darum von ihr nicht gebremst.
// ============================================
router.post('/', optionalAuth, sucheBremse, suchLimit, async (req, res, next) => {
  try {
    return await chatController.sendMessage(req, res, next);
  } catch (e) {
    next(e);
  }
});

// ============================================
// GUEST STATUS - GET /api/chat/guest-status
// Nur lesen, nie blockieren, nie mitzaehlen
//
// Die Zahlen kommen aus DERSELBEN Quelle wie die Sperre. Vorher
// las diese Route req.user.limitStatus() - ein anderes Feld, eine
// andere Rechnung. Das Frontend haette dem Nutzer etwas anderes
// angezeigt, als beim naechsten Klick wirklich gilt.
// ============================================
router.get('/guest-status', optionalAuth, async (req, res) => {
  let stand;
  try {
    stand = await suchLimit.stand(req);
  } catch (e) {
    console.error('[chat] guest-status:', e.message);
    stand = { typ: req.istEingeloggt ? 'konto' : 'gast', limit: null, verbleibend: null };
  }

  const antwort = {
    isLoggedIn: !!req.istEingeloggt,
    premium: !!(req.user && req.user.premium),
    typ: stand.typ,
    limit: stand.limit,
    verbleibend: stand.verbleibend
  };

  if (req.istEingeloggt && req.user) {
    antwort.user = { email: req.user.email };
    antwort.message =
      stand.typ === 'premium'
        ? `Du hast ${suchLimit.STUFEN.premium.grenze} Suchen im Monat.`
        : `Du hast ${suchLimit.STUFEN.konto.grenze} Suchen im Monat. Mit Premium sind es ${suchLimit.STUFEN.premium.grenze}, für CHF 7.`;
  } else if (suchLimit.STUFEN.gast.grenze === 0) {
    // Das Frontend kann daran erkennen, dass es direkt die
    // Registrierung zeigen soll statt eines Suchfeldes.
    antwort.kontoNoetig = true;
    antwort.message = `Für SYNORA brauchst du ein kostenloses Konto. Damit bekommst du ${suchLimit.STUFEN.konto.grenze} Suchen im Monat – ohne Zahlungsdaten.`;
  } else {
    antwort.message = `Du hast ${suchLimit.STUFEN.gast.grenze} kostenlose Suchen pro Tag. Mit Konto sind es ${suchLimit.STUFEN.konto.grenze} im Monat.`;
  }

  res.json(antwort);
});

// ============================================
// HISTORY - GET /api/chat/history
// ============================================
router.get('/history', requireAuth, async (req, res) => {
  // TODO: aus dem ChatHistory-Model lesen
  res.json({ history: [] });
});

module.exports = router;