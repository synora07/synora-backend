// ============================================
// SYNORA - Nora: Firma
// ============================================
// Eine Firma ist der Kunde von Nora. Ihr gehoeren die Personen,
// die Projekte, die Dokumente und das Gedaechtnis.
//
// Regeln:
//   - genau ein Inhaber, dazu Mitarbeiter bis NORA_PERSONEN
//   - eine Person gehoert hoechstens zu EINER Firma (eindeutiger Index)
//   - das Abo setzt NUR der Server (scripts/noraFreischalten.js,
//     spaeter der Stripe-Webhook) - keine Route nimmt es aus req.body
// ============================================

'use strict';

const mongoose = require('mongoose');

const mitgliedSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rolle: { type: String, enum: ['inhaber', 'mitarbeiter'], required: true },
  seit: { type: Date, default: Date.now }
}, { _id: false });

const firmaSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },

  mitglieder: {
    type: [mitgliedSchema],
    validate: [
      {
        validator: (liste) => Array.isArray(liste) && liste.length >= 1,
        message: 'Eine Firma braucht mindestens eine Person'
      },
      {
        validator: (liste) => Array.isArray(liste) && liste.filter((m) => m.rolle === 'inhaber').length === 1,
        message: 'Eine Firma hat genau einen Inhaber'
      },
      {
        validator: (liste) => {
          const ids = (liste || []).map((m) => String(m.userId));
          return new Set(ids).size === ids.length;
        },
        message: 'Eine Person steht doppelt in der Firma'
      }
    ]
  },

  abo: {
    stufe: { type: String, enum: ['pilot', 'nora', null], default: null },
    seit: { type: Date, default: null },
    bis: { type: Date, default: null }
  }
}, { collection: 'nora_firmen', timestamps: true });

// Eine Person gehoert hoechstens zu einer Firma.
firmaSchema.index(
  { 'mitglieder.userId': 1 },
  { unique: true, partialFilterExpression: { 'mitglieder.userId': { $exists: true } } }
);

module.exports = mongoose.models.NoraFirma || mongoose.model('NoraFirma', firmaSchema);
