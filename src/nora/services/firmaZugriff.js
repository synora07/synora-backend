// ============================================
// SYNORA - Nora: Zugriff nur auf die eigene Firma
// ============================================
// ladeFirma     haengt die Firma der eingeloggten Person an den
//               Request (req.firma, req.noraRolle). Ohne Firma: 403.
// nurMitAbo     laesst nur Firmen mit aktivem Abo (pilot, nora) durch.
// nurInhaber    nur fuer den Inhaber (Personen verwalten).
// firmaFilter   baut jeden Datenbank-Filter mit der eigenen firmaId.
//               Jede Route MUSS ihre Abfragen damit bauen.
// ============================================

'use strict';

const mongoose = require('mongoose');
const Firma = require('../models/Firma');
const { ABO_STUFEN } = require('../config');

async function ladeFirma(req, res, next) {
  // requireAuth laesst bei Datenbank-Ausfall einen Token ohne Nutzer
  // durch. Fuer Nora reicht das nicht - ohne Nutzer keine Firma.
  if (!req.user || !req.user._id || mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: 'Nora ist gerade nicht erreichbar. Bitte gleich nochmals versuchen.',
      code: 'DB_NICHT_BEREIT'
    });
  }

  try {
    const firma = await Firma.findOne({ 'mitglieder.userId': req.user._id });
    if (!firma) {
      return res.status(403).json({
        error: 'Dieses Konto gehoert zu keiner Firma mit Nora.',
        code: 'KEINE_FIRMA'
      });
    }
    const ich = firma.mitglieder.find((m) => String(m.userId) === String(req.user._id));
    req.firma = firma;
    req.noraRolle = ich ? ich.rolle : null;
    return next();
  } catch (e) {
    console.error('[nora] Firma laden:', e.message);
    return res.status(500).json({ error: 'Interner Fehler', code: 'FIRMA_FEHLER' });
  }
}

function aboAktiv(firma, jetzt = new Date()) {
  return !!(firma && firma.abo && ABO_STUFEN.includes(firma.abo.stufe) &&
    (!firma.abo.bis || new Date(firma.abo.bis) > jetzt));
}

function nurMitAbo(req, res, next) {
  if (!aboAktiv(req.firma)) {
    return res.status(402).json({
      error: 'Nora ist fuer diese Firma nicht freigeschaltet.',
      code: 'KEIN_ABO'
    });
  }
  return next();
}

function nurInhaber(req, res, next) {
  if (req.noraRolle !== 'inhaber') {
    return res.status(403).json({ error: 'Nur der Inhaber darf das.', code: 'NUR_INHABER' });
  }
  return next();
}

function firmaFilter(req, filter = {}) {
  if (!req || !req.firma || !req.firma._id) {
    throw new Error('NORA: firmaFilter ohne geladene Firma');
  }
  if (filter && Object.prototype.hasOwnProperty.call(filter, 'firmaId') &&
      String(filter.firmaId) !== String(req.firma._id)) {
    throw new Error('NORA: fremde firmaId im Filter');
  }
  return { ...filter, firmaId: req.firma._id };
}

module.exports = { ladeFirma, nurMitAbo, nurInhaber, firmaFilter, aboAktiv };
