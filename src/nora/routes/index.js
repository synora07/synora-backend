// ============================================
// SYNORA - Nora: Wege unter /api/nora
// ============================================
// Baustein N0 (14.11.2026): Firma, Personen, Verbrauch.
//
// Jeder Weg hier verlangt Login UND eine Firma. Es gibt bewusst
// keinen Weg, der eine Firma anlegt oder ein Abo setzt - das macht
// nur der Server (scripts/noraFreischalten.js).
// ============================================

'use strict';

const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../../middleware/auth');
const User = require('../../models/User');
const Firma = require('../models/Firma');
const verbrauch = require('../services/verbrauch');
const { ladeFirma, nurInhaber, aboAktiv } = require('../services/firmaZugriff');
const { PERSONEN } = require('../config');

const router = express.Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.use(requireAuth, ladeFirma);

// Firma, Abo, Personen
router.get('/firma', async (req, res) => {
  try {
    const f = req.firma;
    const ids = f.mitglieder.map((m) => m.userId);
    const nutzer = await User.find({ _id: { $in: ids } }).select('email firstname lastname').lean();
    const proId = new Map(nutzer.map((u) => [String(u._id), u]));
    res.json({
      firma: {
        name: f.name,
        rolle: req.noraRolle,
        abo: {
          stufe: f.abo ? f.abo.stufe : null,
          seit: f.abo ? f.abo.seit : null,
          aktiv: aboAktiv(f)
        },
        personenLimit: PERSONEN,
        mitglieder: f.mitglieder.map((m) => {
          const u = proId.get(String(m.userId)) || {};
          return {
            userId: String(m.userId),
            email: u.email || null,
            name: [u.firstname, u.lastname].filter(Boolean).join(' ') || null,
            rolle: m.rolle,
            seit: m.seit
          };
        })
      }
    });
  } catch (e) {
    console.error('[nora] GET /firma:', e.message);
    res.status(500).json({ error: 'Interner Fehler', code: 'FIRMA_FEHLER' });
  }
});

// Verbrauch dieses Monats (ohne Kosten - die sind intern)
router.get('/verbrauch', async (req, res) => {
  try {
    res.json(await verbrauch.stand(req.firma._id));
  } catch (e) {
    console.error('[nora] GET /verbrauch:', e.message);
    res.status(500).json({ error: 'Interner Fehler', code: 'VERBRAUCH_FEHLER' });
  }
});

// Person hinzufuegen (nur Inhaber). Die Person braucht ein SYNORA-Konto.
router.post('/mitglieder', nurInhaber, async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) {
    return res.status(400).json({ error: 'Bitte eine gueltige Mailadresse angeben.', code: 'MAIL_UNGUELTIG' });
  }
  try {
    const nutzer = await User.findOne({ email }).select('_id').lean();
    if (!nutzer) {
      return res.status(404).json({
        error: 'Diese Person braucht zuerst ein SYNORA-Konto mit dieser Mailadresse.',
        code: 'KONTO_FEHLT'
      });
    }
    if (req.firma.mitglieder.some((m) => String(m.userId) === String(nutzer._id))) {
      return res.status(409).json({ error: 'Diese Person gehoert schon zur Firma.', code: 'SCHON_MITGLIED' });
    }

    // Atomar: nur wenn noch Platz ist und die Person nicht schon drin steht.
    const neu = await Firma.findOneAndUpdate(
      {
        _id: req.firma._id,
        [`mitglieder.${PERSONEN - 1}`]: { $exists: false },
        'mitglieder.userId': { $ne: nutzer._id }
      },
      { $push: { mitglieder: { userId: nutzer._id, rolle: 'mitarbeiter', seit: new Date() } } },
      { new: true }
    );
    if (!neu) {
      return res.status(409).json({
        error: `Mehr als ${PERSONEN} Personen sind im Abo nicht enthalten.`,
        code: 'PERSONEN_LIMIT'
      });
    }
    return res.status(201).json({ ok: true, personen: neu.mitglieder.length });
  } catch (e) {
    if (e && e.code === 11000) {
      return res.status(409).json({ error: 'Diese Person gehoert schon zu einer anderen Firma.', code: 'ANDERE_FIRMA' });
    }
    console.error('[nora] POST /mitglieder:', e.message);
    return res.status(500).json({ error: 'Interner Fehler', code: 'MITGLIED_FEHLER' });
  }
});

// Person entfernen (nur Inhaber, nie den Inhaber selbst)
router.delete('/mitglieder/:userId', nurInhaber, async (req, res) => {
  const id = String(req.params.userId || '');
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Ungueltige Person', code: 'ID_UNGUELTIG' });
  }
  try {
    const userId = new mongoose.Types.ObjectId(id);
    // Die Bedingung steht im Filter: Die Person muss Mitarbeiter DIESER
    // Firma sein. modifiedCount allein taugt nicht - timestamps setzt
    // updatedAt bei jedem Update, auch wenn $pull nichts entfernt.
    const r = await Firma.updateOne(
      { _id: req.firma._id, mitglieder: { $elemMatch: { userId, rolle: 'mitarbeiter' } } },
      { $pull: { mitglieder: { userId, rolle: 'mitarbeiter' } } }
    );
    if (r.matchedCount !== 1) {
      return res.status(404).json({ error: 'Diese Person ist nicht Mitarbeiter dieser Firma.', code: 'NICHT_GEFUNDEN' });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('[nora] DELETE /mitglieder:', e.message);
    return res.status(500).json({ error: 'Interner Fehler', code: 'MITGLIED_FEHLER' });
  }
});

module.exports = router;
