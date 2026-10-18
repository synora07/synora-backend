// ============================================
// SYNORA - Gast-Zaehler und Ablehnungs-Protokoll
// ============================================
// Zaehler liegen in der Datenbank, nicht im Arbeitsspeicher.
// Grund: Railway startet bei jedem Deployment neu. Ein Zaehler im
// Speicher waere danach auf null, und jeder haette wieder 3 Suchen.
// ============================================
'use strict';

const mongoose = require('mongoose');

// ============================================
// GAST-ZAEHLER
// Kennung = IP + Browser-Kennung (siehe middleware/limits.js)
// ============================================
const gastZaehlerSchema = new mongoose.Schema({
  kennung: { type: String, required: true, unique: true },

  suchen_heute: { type: Number, default: 0, min: 0 },
  datum: { type: String, default: null }, // YYYY-MM-DD, Schweizer Zeit

  // Wie oft dieser Gast schon abgewiesen wurde - zeigt dir, ob
  // echte Nutzer ans Limit stossen oder nur Skripte
  abgelehnt_gesamt: { type: Number, default: 0 },
  letzteAblehnung: { type: Date, default: null },

  erstelltAm: { type: Date, default: Date.now },
  zuletztGesehen: { type: Date, default: Date.now }
});

// Nach 7 Tagen ohne Aktivitaet loescht MongoDB den Eintrag
gastZaehlerSchema.index({ zuletztGesehen: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// ============================================
// ABGELEHNTE SUCHEN
// Jede Ablehnung mit Grund - Punkt 9 auf der v2.0-Liste
// ============================================
const abgelehnteSucheSchema = new mongoose.Schema({
  grund: {
    type: String,
    required: true,
    enum: ['tageslimit_gast', 'tageslimit_ip', 'tageslimit_nutzer', 'tageslimit_premium', 'bot_bremse']
  },
  typ: { type: String, enum: ['gast', 'nutzer'], required: true },
  nutzer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  kennung: { type: String, default: null },
  anfrage: { type: String, default: '' },
  limit: { type: Number, default: null },
  zeitpunkt: { type: Date, default: Date.now }
});

// 90 Tage aufbewahren - lang genug fuer die Monatsauswertung
abgelehnteSucheSchema.index({ zeitpunkt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = {
  GastZaehler: mongoose.models.GastZaehler
    || mongoose.model('GastZaehler', gastZaehlerSchema),
  AbgelehnteSuche: mongoose.models.AbgelehnteSuche
    || mongoose.model('AbgelehnteSuche', abgelehnteSucheSchema)
};