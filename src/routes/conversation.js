// ============================================
// SYNORA - Conversation Routes
// ============================================
'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');

// ============================================
// GET ALL CONVERSATIONS - GET /api/conversation/list
// ============================================
router.get('/list', requireAuth, async (req, res, next) => {
  try {
    // TODO: aus ChatHistory laden - Model liegt bereit, wird noch nicht genutzt
    res.json({ conversations: [], total: 0 });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET SINGLE CONVERSATION - GET /api/conversation/:id
// ============================================
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    // TODO: aus ChatHistory laden und pruefen, ob sie dem Nutzer gehoert
    res.json({ id, messages: [], createdAt: new Date() });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DELETE CONVERSATION - DELETE /api/conversation/:id
// ============================================
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    // TODO: wirklich loeschen - und vorher pruefen, ob sie dem Nutzer gehoert
    console.log(`[conversation] Loeschen angefragt: ${id} von ${req.user._id}`);
    res.json({ success: true, message: 'Geloescht' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;