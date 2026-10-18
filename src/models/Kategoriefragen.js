// ============================================
// SYNORA - Fragen je Kategorie
// ============================================
// "Kopfhoerer" sagt zu wenig. In-Ear oder Over-Ear? Kabellos?
// Wofuer? Eine einzige Frage reicht nicht - aber drei Fragen
// nacheinander vertreiben die Leute. Also alle auf einmal.
//
// Von Hand sind das bei 110 Unterkategorien ueber 300 Fragen.
// Darum erstellt SYNORA sie selbst - EINMAL pro Kategorie - und
// speichert sie hier. Der erste Nutzer loest die Erstellung aus,
// alle danach bekommen sie gratis.
//
// Du kannst jede Frage nachtraeglich von Hand aendern; dann wird
// sie nicht mehr ueberschrieben (geprueft: true).
// ============================================

'use strict';

const mongoose = require('mongoose');

const FrageSchema = new mongoose.Schema(
  {
    frage: String,
    optionen: [String],
    // Mehrere Antworten erlaubt? Bei "Welche Eigenschaften sind dir
    // wichtig" ja, bei "Wofuer brauchst du es" nein.
    mehrfach: { type: Boolean, default: false }
  },
  { _id: false }
);

const KategoriefragenSchema = new mongoose.Schema({
  kategorie: { type: String, unique: true, index: true },
  fragen: [FrageSchema],

  // Von Hand geprueft? Dann nie automatisch ersetzen.
  geprueft: { type: Boolean, default: false },

  erstelltVon: String,          // 'hand' oder 'modell'
  erstellt: { type: Date, default: Date.now },
  genutzt: { type: Number, default: 0 }
});

module.exports =
  mongoose.models.Kategoriefragen || mongoose.model('Kategoriefragen', KategoriefragenSchema);