// ============================================
// SYNORA - Feedback
// ============================================
// Aus deinen Notizen: "Wenn ein Kunde eine falsche Empfehlung
// meldet, soll SYNORA das anerkennen und den Fehler bei anderen
// Kunden nicht wiederholen."
//
// Das hier ist der Eingang dafuer.
//
// WAS NICHT GESPEICHERT WIRD
// Keine IP-Adresse, kein Browser-Kennzeichen. Wer angemeldet
// ist, wird verknuepft, damit du nachfragen kannst - wer nicht,
// bleibt anonym. Datensparsamkeit nach DSG und DSGVO.
// ============================================
'use strict';

const mongoose = require('mongoose');

const ARTEN = ['falschesProdukt', 'falscherPreis', 'fehler', 'wunsch', 'sonstiges'];

const feedbackSchema = new mongoose.Schema({
  art: { type: String, enum: ARTEN, default: 'sonstiges', index: true },

  nachricht: { type: String, required: true, maxlength: 2000, trim: true },

  // Welche Seite der Nutzer offen hatte. Hilft beim
  // Nachvollziehen und sagt nichts ueber die Person.
  seite: { type: String, default: '', maxlength: 120 },

  // Null bei nicht angemeldeten Besuchern - das ist in Ordnung.
  // Lieber anonymes Feedback als gar keines.
  nutzer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

  erstelltAm: { type: Date, default: Date.now, index: true },

  // Dein Arbeitsstand, nicht der des Nutzers.
  erledigt: { type: Boolean, default: false, index: true },
  notiz: { type: String, default: '', maxlength: 1000 }
});

feedbackSchema.index({ erledigt: 1, erstelltAm: -1 });

module.exports = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
module.exports.ARTEN = ARTEN;
