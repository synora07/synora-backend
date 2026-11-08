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
const unterhaltung = require('../services/unterhaltung');

router.post('/', optionalAuth, sucheBremse, suchLimit, async (req, res, next) => {
  try {
    // ---------- Gespraech mitschreiben ----------
    // Die Nummer wird VOR dem Controller bestimmt, damit sie mit der
    // Antwort zurueckgehen kann - das Frontend schickt sie bei der
    // naechsten Nachricht wieder mit, und alles landet im selben Chat.
    //
    // Das Abfangen von res.json faengt ALLE Ausgaenge des Controllers
    // ab: Rueckfrage, nichts gefunden, ueber Budget, gemeldete
    // Angebote und das normale Ergebnis. Darum muss chatController.js
    // nicht an fuenf Stellen geaendert werden.
    const nutzerId = req.user && (req.user._id || req.user.id);
    if (nutzerId) {
      const chatId = unterhaltung.nummerBestimmen(req);
      const frage = req.body && req.body.message;
      const urspruenglich = res.json.bind(res);

      res.json = (daten) => {
        const mitNummer =
          daten && typeof daten === 'object' && !Array.isArray(daten)
            ? { ...daten, chatId: String(chatId) }
            : daten;

        // Bewusst ohne await: die Antwort darf nicht auf die
        // Datenbank warten.
        unterhaltung.anhaengen({ nutzerId, chatId, frage, antwort: mitNummer });

        return urspruenglich(mitNummer);
      };
    }

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
const Unterhaltung = require('../models/Unterhaltung');

/**
 * Der Verlauf kommt aus dem Suchprotokoll, das bei jeder Suche ohnehin
 * geschrieben wird (services/mitschrieb.js). Es braucht kein eigenes
 * Model: nutzerId steht schon drin, weil chatController.js beim
 * Anlegen .nutzer(req) aufruft.
 *
 * NUR DURCHLAEUFE MIT ERGEBNIS:
 * Eine Suche mit Rueckfrage erzeugt ZWEI Protokolle - eines fuer die
 * gestellte Frage (ohne Produkte) und eines fuer die eigentliche
 * Suche. Ohne diesen Filter stuende jede Frage doppelt im Verlauf,
 * eine davon leer.
 */
// ============================================
// VERLAUF - GET /api/chat/history
// ============================================
// Nur die Liste: Nummer, Titel, Zeitpunkt, Anzahl Nachrichten.
// Die Nachrichten selbst kommen erst beim Oeffnen - sonst zieht die
// Seitenleiste bei jedem Laden alle Produktdaten mit.
// ============================================
router.get('/history', requireAuth, async (req, res) => {
  try {
    const nutzerId = req.user && (req.user._id || req.user.id);
    if (!nutzerId) return res.json({ history: [] });

    const anzahl = Math.min(Math.max(Number(req.query.anzahl) || 30, 1), 100);

    const liste = await Unterhaltung.find({ nutzerId }, 'titel zuletzt erstellt nachrichten')
      .sort({ zuletzt: -1 })
      .limit(anzahl)
      .lean();

    res.json({
      history: liste.map((u) => ({
        id: String(u._id),
        titel: u.titel || 'Ohne Titel',
        zeit: u.zuletzt || u.erstellt,
        anzahl: (u.nachrichten || []).length
      }))
    });
  } catch (e) {
    // Ein kaputter Verlauf darf die Seite nicht kaputt machen.
    console.warn('[history] Liste nicht gelesen:', e.message);
    res.json({ history: [] });
  }
});

// ============================================
// EIN GESPRAECH - GET /api/chat/history/:id
// ============================================
// Liefert die Nachrichten so zurueck, wie sie gesendet wurden. Das
// Frontend spielt sie ab, statt sie nachzubauen.
// ============================================
router.get('/history/:id', requireAuth, async (req, res) => {
  try {
    const nutzerId = req.user && (req.user._id || req.user.id);
    if (!nutzerId) return res.status(404).json({ fehler: 'Nicht gefunden' });

    const u = await Unterhaltung.findOne({ _id: req.params.id, nutzerId }).lean();
    if (!u) return res.status(404).json({ fehler: 'Nicht gefunden' });

    res.json({
      id: String(u._id),
      titel: u.titel || 'Ohne Titel',
      zeit: u.zuletzt || u.erstellt,
      nachrichten: (u.nachrichten || []).map((n) => ({
        wer: n.wer,
        text: n.text || '',
        zeit: n.zeit,
        daten: n.daten || null
      }))
    });
  } catch (e) {
    console.warn('[history] Gespraech nicht gelesen:', e.message);
    res.status(404).json({ fehler: 'Nicht gefunden' });
  }
});

// ============================================
// LOESCHEN - DELETE /api/chat/history/:id
// ============================================
// Der Verlauf gehoert dem Nutzer. Er muss ihn wieder loswerden
// koennen, ohne jemanden zu fragen.
// ============================================
router.delete('/history/:id', requireAuth, async (req, res) => {
  try {
    const nutzerId = req.user && (req.user._id || req.user.id);
    if (!nutzerId) return res.status(404).json({ fehler: 'Nicht gefunden' });

    const weg = await Unterhaltung.deleteOne({ _id: req.params.id, nutzerId });
    if (!weg.deletedCount) return res.status(404).json({ fehler: 'Nicht gefunden' });

    res.json({ ok: true });
  } catch (e) {
    console.warn('[history] nicht geloescht:', e.message);
    res.status(500).json({ fehler: 'Nicht geloescht' });
  }
});

module.exports = router;