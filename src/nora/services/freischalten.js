// ============================================
// SYNORA - Nora: Firmen freischalten (nur Server)
// ============================================
// Wird von scripts/noraFreischalten.js benutzt und vom Prueflauf
// getestet. Keine Route ruft das auf: Das Abo setzt nur der Server.
// ============================================

'use strict';

const User = require('../../models/User');
const Firma = require('../models/Firma');
const verbrauch = require('./verbrauch');
const { ABO_STUFEN } = require('../config');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fehler(code, text) {
  const e = new Error(text);
  e.code = code;
  return e;
}

async function nutzerPerMail(email) {
  const mail = String(email || '').trim().toLowerCase();
  if (!EMAIL.test(mail)) throw fehler('MAIL_UNGUELTIG', `Keine gueltige Mailadresse: ${email}`);
  const nutzer = await User.findOne({ email: mail }).select('email').lean();
  if (!nutzer) {
    throw fehler('KONTO_FEHLT', `Kein SYNORA-Konto mit ${mail}. Die Person muss sich zuerst auf synora.li registrieren.`);
  }
  return nutzer;
}

/**
 * Legt die Firma an (falls noetig) und setzt das Abo.
 * Gibt { firma, neu, vorher } zurueck.
 */
async function freischalten({ email, name, stufe, jetzt = new Date() }) {
  if (!ABO_STUFEN.includes(stufe)) {
    throw fehler('STUFE_UNGUELTIG', `Stufe muss eine von diesen sein: ${ABO_STUFEN.join(', ')}`);
  }
  const nutzer = await nutzerPerMail(email);
  const vorhanden = await Firma.findOne({ 'mitglieder.userId': nutzer._id });

  if (vorhanden) {
    const ich = vorhanden.mitglieder.find((m) => String(m.userId) === String(nutzer._id));
    if (!ich || ich.rolle !== 'inhaber') {
      throw fehler('NICHT_INHABER', `${nutzer.email} ist Mitarbeiter bei "${vorhanden.name}", nicht Inhaber.`);
    }
    const vorher = vorhanden.abo && vorhanden.abo.stufe ? vorhanden.abo.stufe : null;
    vorhanden.abo = { stufe, seit: vorher === stufe && vorhanden.abo.seit ? vorhanden.abo.seit : jetzt, bis: null };
    if (name && String(name).trim().length >= 2) vorhanden.name = String(name).trim();
    await vorhanden.save();
    return { firma: vorhanden, neu: false, vorher };
  }

  const firmenName = String(name || '').trim();
  if (firmenName.length < 2) throw fehler('NAME_FEHLT', 'Fuer eine neue Firma braucht es einen Namen (mindestens 2 Zeichen).');

  const firma = new Firma({
    name: firmenName,
    mitglieder: [{ userId: nutzer._id, rolle: 'inhaber', seit: jetzt }],
    abo: { stufe, seit: jetzt, bis: null }
  });
  await firma.save();
  return { firma, neu: true, vorher: null };
}

/** Beendet das Abo. Die Firma und ihre Daten bleiben bestehen. */
async function stoppen({ email }) {
  const nutzer = await nutzerPerMail(email);
  const firma = await Firma.findOne({ 'mitglieder.userId': nutzer._id });
  if (!firma) throw fehler('KEINE_FIRMA', `${nutzer.email} gehoert zu keiner Firma.`);
  const ich = firma.mitglieder.find((m) => String(m.userId) === String(nutzer._id));
  if (!ich || ich.rolle !== 'inhaber') throw fehler('NICHT_INHABER', `${nutzer.email} ist nicht Inhaber von "${firma.name}".`);
  const vorher = firma.abo ? firma.abo.stufe : null;
  firma.abo = { stufe: null, seit: firma.abo ? firma.abo.seit : null, bis: null };
  await firma.save();
  return { firma, vorher };
}

/** Alle Firmen mit Abo, mit Verbrauch dieses Monats (intern, mit Kosten). */
async function liste({ jetzt = new Date() } = {}) {
  const firmen = await Firma.find({ 'abo.stufe': { $in: [...ABO_STUFEN] } }).sort({ createdAt: 1 }).lean();
  const ergebnis = [];
  for (const f of firmen) {
    const inhaber = f.mitglieder.find((m) => m.rolle === 'inhaber');
    const u = inhaber ? await User.findById(inhaber.userId).select('email').lean() : null;
    const s = await verbrauch.stand(f._id, { intern: true, jetzt });
    ergebnis.push({
      name: f.name,
      inhaber: u ? u.email : '-',
      personen: f.mitglieder.length,
      stufe: f.abo.stufe,
      seit: f.abo.seit,
      pruefungen: s.zaehler.pruefungen,
      experten: s.zaehler.experten,
      kostenChf: s.kostenChf
    });
  }
  return ergebnis;
}

module.exports = { freischalten, stoppen, liste };
