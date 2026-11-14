// ============================================
// SYNORA - Nora: Firmenpflicht fuer jede Abfrage
// ============================================
// Nora speichert Offerten, Preise und Konditionen fremder Firmen.
// Die Preise einer Firma duerfen NIE bei einer anderen auftauchen.
//
// Dieses Plugin haengt an jedem Nora-Modell mit firmaId und lehnt
// jede Abfrage ab, die keine eindeutige firmaId enthaelt:
//
//   erlaubt      { firmaId: <ObjectId> }   oder 24-stellige Hex-Zeichenkette
//   abgelehnt    {}  |  { firmaId: { $exists: true } }  |  { firmaId: { $in: [...] } }
//
// Ausserdem darf kein Update die firmaId aendern, und jede
// Aggregation muss mit { $match: { firmaId: <ObjectId> } } beginnen.
//
// NICHT benutzen: Model.bulkWrite() und Model.collection.* - die
// laufen an Mongoose vorbei und damit an diesem Schutz.
// ============================================

'use strict';

const mongoose = require('mongoose');

const ABFRAGEN = [
  'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace',
  'updateOne', 'updateMany', 'replaceOne', 'deleteOne', 'deleteMany',
  'countDocuments', 'distinct'
];

const MIT_UPDATE = new Set(['findOneAndUpdate', 'findOneAndReplace', 'updateOne', 'updateMany', 'replaceOne']);

function istEindeutigeFirma(wert) {
  if (wert instanceof mongoose.Types.ObjectId) return true;
  if (typeof wert === 'string' && /^[0-9a-fA-F]{24}$/.test(wert)) return true;
  return false;
}

function filterHatFirma(filter) {
  return !!(filter && Object.prototype.hasOwnProperty.call(filter, 'firmaId') && istEindeutigeFirma(filter.firmaId));
}

function updateBeruehrtFirma(update) {
  if (!update || typeof update !== 'object') return false;
  if (Array.isArray(update)) return true; // Pipeline-Updates sind hier nicht vorgesehen
  for (const [schluessel, wert] of Object.entries(update)) {
    if (schluessel === 'firmaId') return true;
    if (schluessel.startsWith('$') && wert && typeof wert === 'object' &&
        Object.prototype.hasOwnProperty.call(wert, 'firmaId')) return true;
  }
  return false;
}

function firmaPflicht(schema) {
  schema.pre(ABFRAGEN, function () {
    const art = this.op;
    if (!filterHatFirma(this.getFilter())) {
      throw new Error(`NORA: ${art} ohne eindeutige firmaId verweigert`);
    }
    if (MIT_UPDATE.has(art) && updateBeruehrtFirma(this.getUpdate())) {
      throw new Error(`NORA: ${art} darf die firmaId nicht aendern`);
    }
  });

  schema.pre('aggregate', function () {
    const erste = this.pipeline()[0];
    if (!erste || !erste.$match || !filterHatFirma(erste.$match)) {
      throw new Error('NORA: Aggregation muss mit $match auf eine firmaId beginnen');
    }
  });
}

module.exports = { firmaPflicht, filterHatFirma, istEindeutigeFirma, updateBeruehrtFirma };
