// ============================================================================
// ELEKTRONIKSHOPS.JS - HAUPTDATEI
// ============================================================================
// Kombiniert alle 3 Parts zu einer kompletten Elektronik-Datenbank
// Gesamt: 1440 Shops in 18 Kategorien
// ============================================================================

const electronicsPart1 = require('./elektronikShops_Part1');
const electronicsPart2 = require('./elektronikShops_Part2');
const electronicsPart3 = require('./elektronikShops_Part3');

// Kombiniere alle 3 Parts zu einem Objekt
const electronicsShops = Object.assign({}, electronicsPart1, electronicsPart2, electronicsPart3);

module.exports = electronicsShops;