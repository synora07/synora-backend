// ============================================
// SYNORA - Auth Routes
// ============================================
//
// Aenderungen gegenueber V1:
// 1. Kein bcrypt.hash hier mehr - das macht ausschliesslich das Model.
//    Vorher wurde doppelt gehasht und der Login schlug immer fehl.
// 2. Beim Login wird das Passwort mit +password geladen,
//    sonst ist das Feld leer (select: false).
// 3. /me nutzt die zentrale Auth-Middleware.
// ============================================

'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const TOKEN_GUELTIG = '7d';

function baueToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_GUELTIG }
  );
}

// ============================================
// REGISTER - POST /api/auth/register
// ============================================
router.post('/register', async (req, res, next) => {
  try {
    const { firstname, lastname, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email und Passwort erforderlich' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
    }

    if (await User.emailExists(email)) {
      return res.status(409).json({ error: 'Email bereits registriert' });
    }

    // Klartext uebergeben - das Model hasht beim Speichern
    const neu = new User({
      firstname: firstname || '',
      lastname: lastname || '',
      email: String(email).toLowerCase().trim(),
      password,
      isEmailVerified: true // solange die Mail-Verifizierung nicht aktiv ist
    });

    await neu.save();

    // Direkt eingeloggt weiter - eine Huerde weniger
    const token = baueToken(neu);

    res.status(201).json({
      success: true,
      message: 'Registrierung erfolgreich',
      token,
      user: neu.toSafeObject()
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const erste = Object.values(error.errors)[0];
      return res.status(400).json({ error: erste ? erste.message : 'Ungueltige Eingabe' });
    }
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Email bereits registriert' });
    }
    next(error);
  }
});

// ============================================
// LOGIN - POST /api/auth/login
// ============================================
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email und Passwort erforderlich' });
    }

    // mitPasswort = true, sonst ist das Feld wegen select:false leer
    const user = await User.findByEmail(email, true);

    // Dieselbe Meldung fuer beide Faelle, damit niemand herausfinden
    // kann, welche Adressen registriert sind
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Email oder Passwort falsch' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Konto ist deaktiviert' });
    }

    await user.registerLogin();

    res.json({
      success: true,
      token: baueToken(user),
      user: user.toSafeObject()
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ME - GET /api/auth/me
// ============================================
router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});

// ============================================
// LOGOUT - POST /api/auth/logout
// ============================================
router.post('/logout', (req, res) => {
  // Tokens sind zustandslos - das Frontend loescht ihn aus dem localStorage
  res.json({ success: true, message: 'Ausgeloggt' });
});

module.exports = router;