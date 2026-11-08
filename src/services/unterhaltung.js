// ============================================
// SYNORA - Unterhaltungen speichern
// ============================================
// Wird aus routes/chat.js aufgerufen, einmal pro Anfrage.
//
// Grundsatz wie beim Mitschrieb: Das Speichern darf NIE eine Suche
// kaputt machen. Jeder Fehler wird geschluckt und geloggt. Lieber ein
// fehlender Verlaufseintrag als ein Nutzer, der eine Fehlermeldung
// sieht statt seiner Produkte.
// ============================================

'use strict';

const mongoose = require('mongoose');
const Unterhaltung = require('../models/Unterhaltung');

// 60 Nachrichten sind 30 Wechsel. Laenger wird kein Einkaufsgespraech,
// und so waechst kein Eintrag unbegrenzt.
const MAX_NACHRICHTEN = 60;
const MAX_TITEL = 80;

/** Aus der ersten Frage einen Titel machen. */
function titelAus(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  if (!t) return 'Ohne Titel';
  return t.length > MAX_TITEL ? t.slice(0, MAX_TITEL - 1) + '…' : t;
}

/**
 * Die Nummer des Gespraechs bestimmen - VOR dem Controller, damit sie
 * mit der Antwort zurueckgehen kann.
 *
 * Es wird hier noch nichts in die Datenbank geschrieben. Erst wenn
 * wirklich eine Antwort da ist, legt anhaengen() den Eintrag an.
 * Sonst entstuenden leere Gespraeche, sobald jemand die Seite nur
 * oeffnet.
 */
function nummerBestimmen(req) {
  const gewuenscht = req.body && req.body.chatId;
  if (gewuenscht && mongoose.Types.ObjectId.isValid(String(gewuenscht))) {
    return new mongoose.Types.ObjectId(String(gewuenscht));
  }
  return new mongoose.Types.ObjectId();
}

/**
 * Frage und Antwort an das Gespraech haengen. Legt es beim ersten Mal
 * an.
 *
 * Absichtlich ohne await aufrufbar - eine Suche darf nie auf das
 * Speichern warten.
 */
async function anhaengen({ nutzerId, chatId, frage, antwort }) {
  if (!nutzerId || !chatId) return;

  try {
    const jetzt = new Date();
    const neue = [];

    const gefragt = String(frage || '').trim();
    if (gefragt) neue.push({ wer: 'nutzer', text: gefragt, zeit: jetzt });

    if (antwort) {
      neue.push({
        wer: 'synora',
        text: String(antwort.response || antwort.message || ''),
        zeit: jetzt,
        daten: antwort
      });
    }

    if (!neue.length) return;

    // Der Filter enthaelt nutzerId: Eine fremde chatId trifft nichts
    // und kann darum auch nichts ueberschreiben.
    await Unterhaltung.findOneAndUpdate(
      { _id: chatId, nutzerId },
      {
        $setOnInsert: { nutzerId, erstellt: jetzt, titel: titelAus(gefragt) },
        $set: { zuletzt: jetzt },
        $push: { nachrichten: { $each: neue, $slice: -MAX_NACHRICHTEN } }
      },
      { upsert: true }
    );
  } catch (e) {
    console.warn('[unterhaltung] nicht gespeichert:', e.message);
  }
}

module.exports = { nummerBestimmen, anhaengen, titelAus };
