// ============================================
// SYNORA - Push-Anmeldung (Modell)
// ============================================
// Eine eigene Sammlung, bewusst NICHT im Nutzermodell.
//
// Drei Gruende:
//
// 1. Ein Mensch hat mehrere Geraete. Handy, Arbeitsrechner,
//    Laptop zu Hause - jedes meldet sich einzeln an.
// 2. Anmeldungen laufen staendig ab. Browser gewechselt, Erlaubnis
//    entzogen, Geraet neu aufgesetzt. Hier kann eine einzelne Zeile
//    verschwinden, ohne dass das Nutzerdokument angefasst wird.
// 3. Dein User.js bleibt, wie es ist. Keine Wanderung, kein Risiko
//    an der Stelle, an der Anmeldung und Passwort haengen.
//
// Was der Browser liefert, sieht so aus:
//
//   {
//     endpoint: "https://fcm.googleapis.com/fcm/send/...",
//     keys: { p256dh: "...", auth: "..." }
//   }
//
// Genau das wird hier abgelegt - mehr braucht web-push nicht.
// ============================================

'use strict';

const mongoose = require('mongoose');

const pushAboSchema = new mongoose.Schema({
  nutzer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Der endpoint ist eindeutig je Geraet und Browser.
  endpoint: { type: String, required: true, unique: true },

  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },

  // Nur zur Anzeige im Konto ("Chrome auf Windows"), damit der
  // Nutzer weiss, welches Geraet er abmeldet.
  geraet: { type: String, default: '' },

  erstellt: { type: Date, default: Date.now },
  zuletztBenutzt: { type: Date, default: null },

  // Zaehlt hoch, wenn der Push-Dienst das Abo ablehnt. Ab drei
  // Fehlschlaegen wird es geloescht - ein totes Abo soll nicht
  // ewig weiter angefunkt werden.
  fehlschlaege: { type: Number, default: 0 }
}, { versionKey: false });

module.exports = mongoose.models.PushAbo || mongoose.model('PushAbo', pushAboSchema);