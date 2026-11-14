// ============================================
// SYNORA - Nora: Prueflauf fuer Baustein N0
// ============================================
// Prueft gegen eine ECHTE MongoDB, ob die Grundlage haelt:
//
//   - keine Abfrage ohne firmaId
//   - eine Person gehoert hoechstens zu einer Firma
//   - Limits halten auch bei vielen gleichzeitigen Anfragen
//   - Kostenbremse haelt auch bei vielen gleichzeitigen Anfragen
//   - Firma A sieht nie die Daten von Firma B (ueber die echten Wege)
//   - Personen-Limit, Rollen, Freischalten, Stoppen
//
// SICHER: Der Lauf benutzt eine EIGENE Datenbank namens
// "synora_nora_probe" auf deinem Cluster - nicht die echte. Er prueft
// den Namen, bevor er irgendetwas schreibt, und loescht diese eine
// Datenbank am Anfang und am Ende. Echte Daten werden nicht beruehrt.
// Er benutzt kleine Test-Limits (20 Pruefungen, 5 Experten, CHF 10)
// und einen eigenen Zufalls-Schluessel fuer die Logins.
//
// Aufruf im Ordner synora-backend-main:
//   node scripts/noraProbe.js
// ============================================

'use strict';

const path = require('path');
const crypto = require('crypto');
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (_) {}

// Test-Werte - NACH dotenv setzen, damit sie gewinnen.
process.env.NORA_PRUEFUNGEN = '20';
process.env.NORA_EXPERTEN = '5';
process.env.NORA_BREMSE_CHF = '10';
process.env.NORA_PERSONEN = '3';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

const PROBE_DB = 'synora_nora_probe';
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');

const wurzel = path.join(__dirname, '..');
const User = require(path.join(wurzel, 'src', 'models', 'User.js'));
const Firma = require(path.join(wurzel, 'src', 'nora', 'models', 'Firma.js'));
const Verbrauch = require(path.join(wurzel, 'src', 'nora', 'models', 'Verbrauch.js'));
const verbrauch = require(path.join(wurzel, 'src', 'nora', 'services', 'verbrauch.js'));
const { freischalten, stoppen, liste } = require(path.join(wurzel, 'src', 'nora', 'services', 'freischalten.js'));
const noraRouten = require(path.join(wurzel, 'src', 'routes', 'nora.js'));

let gut = 0;
let schlecht = 0;
function pruefe(name, bedingung, info = '') {
  if (bedingung) { gut++; console.log(`  OK      ${name}`); }
  else { schlecht++; console.log(`  FEHLER  ${name}${info ? '   (' + info + ')' : ''}`); }
}
async function wirdAbgelehnt(versprechen) {
  try { await versprechen; return false; } catch (_) { return true; }
}
async function fehlerCode(funktion) {
  try { await funktion(); return null; } catch (e) { return e.code || e.message; }
}

async function datenbankLeeren() {
  if (mongoose.connection.db.databaseName !== PROBE_DB) {
    throw new Error(`Sicherheitsstopp: verbunden mit "${mongoose.connection.db.databaseName}" statt "${PROBE_DB}"`);
  }
  await mongoose.connection.db.dropDatabase();
}

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) { console.log('\nMONGODB_URI fehlt in der .env.\n'); process.exit(1); }
  if (typeof fetch !== 'function') { console.log('\nDieser Prueflauf braucht Node 18 oder neuer (node -v).\n'); process.exit(1); }

  let server = null;
  console.log('');
  console.log('SYNORA - Nora Prueflauf N0');
  console.log('==========================');
  console.log(`Datenbank: ${PROBE_DB} (eigene Pruef-Datenbank, nicht die echte)`);

  try {
    await mongoose.connect(uri, { dbName: PROBE_DB, serverSelectionTimeoutMS: 15000 });
    await datenbankLeeren();
    await User.syncIndexes();
    await Firma.syncIndexes();
    await Verbrauch.syncIndexes();

    // ---------- Personen ----------
    const mail = (n) => `${n}@nora-probe.synora.li`;
    const namen = ['a1', 'a2', 'b1', 'b2', 'b3', 'c1', 'x', 'p1', 'p2', 'p3', 'p4', 'p5'];
    const u = {};
    for (const n of namen) {
      u[n] = await User.create({ email: mail(n), password: 'Probe-Passwort-2026!x' });
    }
    const token = (n) => jwt.sign({ userId: u[n]._id, email: u[n].email }, process.env.JWT_SECRET, { expiresIn: '10m' });

    // ---------- 1. Firmenpflicht ----------
    console.log('\n1. Keine Abfrage ohne firmaId');
    const fremd = new mongoose.Types.ObjectId();
    pruefe('find({}) wird abgelehnt', await wirdAbgelehnt(Verbrauch.find({})));
    pruefe('firmaId mit $exists wird abgelehnt', await wirdAbgelehnt(Verbrauch.findOne({ firmaId: { $exists: true } })));
    pruefe('firmaId mit $in wird abgelehnt', await wirdAbgelehnt(Verbrauch.find({ firmaId: { $in: [fremd] } })));
    pruefe('countDocuments ohne firmaId wird abgelehnt', await wirdAbgelehnt(Verbrauch.countDocuments({ monat: '2026-11' })));
    pruefe('firmaId aendern wird abgelehnt', await wirdAbgelehnt(Verbrauch.updateOne({ firmaId: fremd }, { $set: { firmaId: new mongoose.Types.ObjectId() } })));
    pruefe('Aggregation ohne $match firmaId wird abgelehnt', await wirdAbgelehnt(Verbrauch.aggregate([{ $match: {} }])));
    pruefe('find mit eigener firmaId geht', !(await wirdAbgelehnt(Verbrauch.find({ firmaId: fremd }))));

    // ---------- 2. Firmen anlegen ----------
    console.log('\n2. Freischalten');
    const fa = await freischalten({ email: mail('a1'), name: 'Probe A AG', stufe: 'pilot' });
    pruefe('Firma A neu angelegt (pilot)', fa.neu && fa.firma.abo.stufe === 'pilot');
    const fb = await freischalten({ email: mail('b1'), name: 'Probe B GmbH', stufe: 'nora' });
    const fc = await freischalten({ email: mail('c1'), name: 'Probe C', stufe: 'nora' });
    pruefe('Firma B und C angelegt', fb.neu && fc.neu);
    const fa2 = await freischalten({ email: mail('a1'), name: '', stufe: 'nora' });
    pruefe('Firma A: pilot -> nora, keine zweite Firma', !fa2.neu && fa2.vorher === 'pilot' && fa2.firma.abo.stufe === 'nora' && fa2.firma.name === 'Probe A AG');
    pruefe('unbekannte Mail -> KONTO_FEHLT', (await fehlerCode(() => freischalten({ email: mail('gibtsnicht'), name: 'X AG', stufe: 'nora' }))) === 'KONTO_FEHLT');
    pruefe('falsche Stufe -> STUFE_UNGUELTIG', (await fehlerCode(() => freischalten({ email: mail('a1'), name: 'X', stufe: 'gold' }))) === 'STUFE_UNGUELTIG');
    const doppelt = await fehlerCode(() => Firma.create({ name: 'Doppelt AG', mitglieder: [{ userId: u.a1._id, rolle: 'inhaber' }] }));
    pruefe('dieselbe Person in zweiter Firma -> abgelehnt', doppelt === 11000, String(doppelt));
    const A = fa.firma._id;
    const B = fb.firma._id;
    const C = fc.firma._id;

    // ---------- 3. Limits unter Last ----------
    console.log('\n3. Limits bei vielen gleichzeitigen Anfragen');
    const r3 = await Promise.all(Array.from({ length: 60 }, () => verbrauch.reservieren(A, 'pruefung')));
    const ok3 = r3.filter((r) => r.ok);
    pruefe('60 gleichzeitig, Limit 20 -> genau 20 durch', ok3.length === 20, `${ok3.length} durch`);
    pruefe('die anderen 40 mit Grund LIMIT', r3.filter((r) => !r.ok && r.grund === 'LIMIT').length === 40);
    let sA = await verbrauch.stand(A);
    pruefe('Zaehler A steht auf 20', sA.zaehler.pruefungen.verbraucht === 20);

    const r4 = await Promise.all(Array.from({ length: 10 }, () => verbrauch.reservieren(B, 'expertenpruefung')));
    pruefe('10 Expertenpruefungen, Limit 5 -> genau 5', r4.filter((r) => r.ok).length === 5);
    const r4b = await Promise.all(Array.from({ length: 10 }, () => verbrauch.reservieren(B, 'pruefung')));
    pruefe('danach 10 normale Pruefungen -> alle durch', r4b.filter((r) => r.ok).length === 10);
    let sB = await verbrauch.stand(B);
    pruefe('Firma B: 15 Pruefungen, davon 5 Experten', sB.zaehler.pruefungen.verbraucht === 15 && sB.zaehler.experten.verbraucht === 5);

    // ---------- 4. Kostenbremse unter Last ----------
    console.log('\n4. Kostenbremse bei vielen gleichzeitigen Anfragen');
    const r5 = await Promise.all(Array.from({ length: 100 }, () => verbrauch.reservieren(C, 'akte')));
    const ok5 = r5.filter((r) => r.ok).length;
    pruefe('100 gleichzeitig, Bremse CHF 10, je 0.15 -> genau 66 durch', ok5 === 66, `${ok5} durch`);
    pruefe('die anderen mit Grund BREMSE', r5.filter((r) => !r.ok && r.grund === 'BREMSE').length === 34);
    const sC = await verbrauch.stand(C, { intern: true });
    pruefe('Kosten C = CHF 9.90, nie ueber 10', Math.abs(sC.kostenChf - 9.9) < 1e-9, String(sC.kostenChf));

    // ---------- 5. Zurueckgeben und Abrechnen ----------
    console.log('\n5. Zurueckgeben und Abrechnen');
    const eine = ok3[0];
    pruefe('Reservierung einer fremden Firma -> abgelehnt', await wirdAbgelehnt(verbrauch.zurueckgeben(B, eine)));
    pruefe('gescheiterte Aufgabe zurueckgeben', await verbrauch.zurueckgeben(A, eine));
    pruefe('zweimal zurueckgeben -> abgelehnt', await wirdAbgelehnt(verbrauch.zurueckgeben(A, eine)));
    sA = await verbrauch.stand(A, { intern: true });
    pruefe('Zaehler A wieder 19, Kosten 19 x 0.40', sA.zaehler.pruefungen.verbraucht === 19 && Math.abs(sA.kostenChf - 7.6) < 1e-9, `${sA.zaehler.pruefungen.verbraucht} / ${sA.kostenChf}`);
    const neu = await verbrauch.reservieren(A, 'pruefung');
    await verbrauch.abrechnen(A, neu, 0.31);
    sA = await verbrauch.stand(A, { intern: true });
    pruefe('Abrechnen: Reserve 0.40 auf echte 0.31 korrigiert', Math.abs(sA.kostenChf - 7.91) < 1e-9, String(sA.kostenChf));
    pruefe('zweimal abrechnen -> abgelehnt', await wirdAbgelehnt(verbrauch.abrechnen(A, neu, 0.31)));

    // ---------- 6. Monate ----------
    console.log('\n6. Neuer Monat, neue Limits');
    const spaeter = await verbrauch.reservieren(A, 'pruefung', { jetzt: new Date('2030-01-15T12:00:00Z') });
    pruefe('im Januar 2030 wieder frei', spaeter.ok && spaeter.monat === '2030-01' && spaeter.stand.zaehler.pruefungen.verbraucht === 1);
    pruefe('Monatswechsel nach Schweizer Zeit (30.11. 23:30 UTC = Dezember)', verbrauch.monatJetzt(new Date('2026-11-30T23:30:00Z')) === '2026-12');

    // ---------- 7. Die echten Wege ----------
    console.log('\n7. Wege unter /api/nora - jede Firma sieht nur sich');
    const app = express();
    app.use(express.json());
    app.use('/api/nora', noraRouten);
    server = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
    const basis = `http://127.0.0.1:${server.address().port}/api/nora`;
    async function ruf(methode, weg, wer, body) {
      const kopf = { 'content-type': 'application/json' };
      if (wer) kopf.authorization = `Bearer ${token(wer)}`;
      const antwort = await fetch(basis + weg, { method: methode, headers: kopf, body: body ? JSON.stringify(body) : undefined });
      let daten = null;
      try { daten = await antwort.json(); } catch (_) {}
      return { status: antwort.status, daten: daten || {} };
    }

    pruefe('ohne Login -> 401', (await ruf('GET', '/firma')).status === 401);
    const ohneFirma = await ruf('GET', '/firma', 'x');
    pruefe('Konto ohne Firma -> 403 KEINE_FIRMA', ohneFirma.status === 403 && ohneFirma.daten.code === 'KEINE_FIRMA');
    const gA = await ruf('GET', '/firma', 'a1');
    pruefe('a1 sieht Firma A, als Inhaber, Abo aktiv', gA.status === 200 && gA.daten.firma.name === 'Probe A AG' && gA.daten.firma.rolle === 'inhaber' && gA.daten.firma.abo.aktiv === true);
    const vA = await ruf('GET', '/verbrauch', 'a1');
    const vB = await ruf('GET', '/verbrauch', 'b1');
    pruefe('a1 sieht den Verbrauch von A (20 Pruefungen, 0 Experten)', vA.daten.zaehler && vA.daten.zaehler.pruefungen.verbraucht === 20 && vA.daten.zaehler.experten.verbraucht === 0);
    pruefe('b1 sieht den Verbrauch von B (15 Pruefungen, 5 Experten)', vB.daten.zaehler && vB.daten.zaehler.pruefungen.verbraucht === 15 && vB.daten.zaehler.experten.verbraucht === 5);
    pruefe('Kunden sehen keine Kosten', vA.daten.kostenChf === undefined && vB.daten.kostenChf === undefined);

    pruefe('b1 nimmt a2 auf -> 201', (await ruf('POST', '/mitglieder', 'b1', { email: mail('a2') })).status === 201);
    const andere = await ruf('POST', '/mitglieder', 'a1', { email: mail('a2') });
    pruefe('a1 will a2 auch -> 409 ANDERE_FIRMA', andere.status === 409 && andere.daten.code === 'ANDERE_FIRMA', `${andere.status} ${andere.daten.code}`);
    const keinInhaber = await ruf('POST', '/mitglieder', 'a2', { email: mail('b2') });
    pruefe('Mitarbeiter a2 darf niemanden aufnehmen -> 403', keinInhaber.status === 403 && keinInhaber.daten.code === 'NUR_INHABER');
    const gA2 = await ruf('GET', '/firma', 'a2');
    pruefe('a2 sieht jetzt Firma B, als Mitarbeiter', gA2.daten.firma && gA2.daten.firma.name === 'Probe B GmbH' && gA2.daten.firma.rolle === 'mitarbeiter');
    pruefe('b1 nimmt b2 auf -> 3 Personen', (await ruf('POST', '/mitglieder', 'b1', { email: mail('b2') })).daten.personen === 3);
    const zuViele = await ruf('POST', '/mitglieder', 'b1', { email: mail('b3') });
    pruefe('vierte Person -> 409 PERSONEN_LIMIT', zuViele.status === 409 && zuViele.daten.code === 'PERSONEN_LIMIT');
    pruefe('unbekannte Mail -> 404 KONTO_FEHLT', (await ruf('POST', '/mitglieder', 'b1', { email: mail('niemand') })).daten.code === 'KONTO_FEHLT');
    pruefe('kaputte Mail -> 400', (await ruf('POST', '/mitglieder', 'b1', { email: 'kein-mail' })).status === 400);
    pruefe('Inhaber kann nicht entfernt werden', (await ruf('DELETE', `/mitglieder/${u.b1._id}`, 'b1')).status === 404);
    pruefe('a1 kann a2 (Firma B) nicht entfernen', (await ruf('DELETE', `/mitglieder/${u.a2._id}`, 'a1')).status === 404);
    const bNachVersuch = await Firma.findById(B).lean();
    pruefe('nach beiden Versuchen: b1 und a2 noch in Firma B',
      ['b1', 'a2'].every((n) => bNachVersuch.mitglieder.some((m) => String(m.userId) === String(u[n]._id))));
    pruefe('b1 entfernt a2', (await ruf('DELETE', `/mitglieder/${u.a2._id}`, 'b1')).status === 200);
    pruefe('a2 hat danach keine Firma mehr', (await ruf('GET', '/firma', 'a2')).daten.code === 'KEINE_FIRMA');

    const gleichzeitig = await Promise.all(['p1', 'p2', 'p3', 'p4', 'p5'].map((n) => ruf('POST', '/mitglieder', 'b1', { email: mail(n) })));
    pruefe('5 gleichzeitig, 1 Platz frei -> genau 1 aufgenommen', gleichzeitig.filter((r) => r.status === 201).length === 1);
    const fB = await Firma.findById(B).lean();
    pruefe('Firma B hat genau 3 Personen', fB.mitglieder.length === 3);
    pruefe('kein Weg, um ein Abo zu setzen', (await ruf('PATCH', '/firma', 'b1', { abo: { stufe: 'nora' } })).status === 404);

    // ---------- 8. Stoppen und Liste ----------
    console.log('\n8. Abo stoppen und Liste');
    await stoppen({ email: mail('c1') });
    const gC = await ruf('GET', '/firma', 'c1');
    pruefe('Firma C: Abo beendet, Daten bleiben', gC.status === 200 && gC.daten.firma.abo.aktiv === false);
    const l = await liste();
    pruefe('Liste zeigt A und B, nicht C', l.length === 2 && l.some((f) => f.name === 'Probe A AG') && l.some((f) => f.name === 'Probe B GmbH'));
  } catch (e) {
    schlecht++;
    console.log('');
    console.log(`ABBRUCH: ${e.message}`);
    if (/not authorized|Unauthorized/i.test(e.message)) {
      console.log('Dein Atlas-Datenbanknutzer darf die Pruef-Datenbank nicht anlegen.');
      console.log('Bitte diese Meldung schicken - dann loesen wir das anders.');
    }
  } finally {
    if (server) await new Promise((ok) => server.close(ok));
    try { if (mongoose.connection.readyState === 1) await datenbankLeeren(); } catch (_) {}
    await mongoose.connection.close().catch(() => {});
  }

  console.log('');
  console.log('==========================');
  console.log(`  ${gut} OK, ${schlecht} FEHLER`);
  console.log(schlecht === 0
    ? '  Grundlage N0 haelt. Pruef-Datenbank wieder geloescht.'
    : '  Bitte die ganze Ausgabe schicken.');
  console.log('');
  process.exit(schlecht === 0 ? 0 : 1);
})();
