// ============================================
// SYNORA - eine Suche Schritt fuer Schritt nachschauen
// ============================================
// Zeigt, was auf dem Weg von den gefundenen Produkten bis zur
// Antwort passiert ist - und an welcher Stufe etwas verloren ging.
//
// Dafuer braucht es keinen Serverlauf und keine API-Abfrage: alles
// steht im Suchprotokoll, das bei jeder Suche ohnehin geschrieben
// wird.
//
// Aufruf:
//   node scripts/sucheNachschauen.js "Kopfhörer für meinen Vater"
//   node scripts/sucheNachschauen.js --letzte
//   node scripts/sucheNachschauen.js --leer        nur leer gebliebene
//
// Veraendert nichts.
// ============================================
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const ARG = process.argv.slice(2);
const LETZTE = ARG.includes('--letzte');
const NUR_LEER = ARG.includes('--leer');
const ALLE = ARG.includes('--alle');
const LAUF = ARG.includes('--lauf');
const L_INDEX = ARG.indexOf('--lauf');
const LAUF_ANZAHL = L_INDEX >= 0 ? Math.max(5, Number(ARG[L_INDEX + 1]) || 40) : 40;
const SUCHTEXT = ARG
  .filter((a, i) => !a.startsWith('--') && !(L_INDEX >= 0 && i === L_INDEX + 1 && /^\d+$/.test(a)))
  .join(' ').trim();

function trenner(zeichen = '=') {
  console.log(zeichen.repeat(64));
}

function kopf(t) {
  console.log('');
  trenner();
  console.log('  ' + t);
  trenner();
}

/** Eine Stufe der Trichter-Anzeige */
function stufe(name, wert, davor) {
  const n = typeof wert === 'number' ? wert : 0;
  const balkenBreite = Math.min(28, n);
  const balken = n > 0 ? '#'.repeat(Math.max(1, balkenBreite)) : '';
  let verlust = '';
  if (typeof davor === 'number' && davor > n) {
    verlust = `   -${davor - n}`;
  }
  console.log('  ' + String(name).padEnd(26) + String(n).padStart(4) + '  ' + balken + verlust);
  return n;
}

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('\nMONGODB_URI fehlt in der .env.\n');
    process.exit(1);
  }

  if (!SUCHTEXT && !LETZTE && !NUR_LEER && !LAUF) {
    console.log('\n  Was soll ich nachschauen?\n');
    console.log('    node scripts/sucheNachschauen.js "Kopfhörer für meinen Vater"');
    console.log('    node scripts/sucheNachschauen.js --lauf       der letzte Durchlauf, kompakt');
    console.log('    node scripts/sucheNachschauen.js --letzte');
    console.log('    node scripts/sucheNachschauen.js --leer\n');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const SuchProtokoll = require('../src/models/SuchProtokoll');

    // ============================================
    // --lauf : alles der Reihe nach, eine Zeile je Anfrage
    // ============================================
    // Dafuer gebaut, nachzuvollziehen, was ein ganzer Katalogdurchlauf
    // getan hat - und vor allem, welche Anfrage KEIN Protokoll
    // geschrieben hat. Eine fehlende Zeile ist hier der Befund.
    if (LAUF) {
      const zeilen = (await SuchProtokoll.find({}, 'anfrage rueckfrage kandidaten ergebnis zeit dauerMs fehler')
        .sort({ zeit: -1 }).limit(LAUF_ANZAHL).lean()).reverse();

      kopf(`DIE LETZTEN ${zeilen.length} ANFRAGEN, DER REIHE NACH`);
      console.log('');
      console.log('  ZEIT      GETIPPT                              RF  KAND  ERG');
      console.log('  ' + '-'.repeat(62));

      for (const p of zeilen) {
        const a = p.anfrage || {};
        const rf = p.rueckfrage || {};
        const zeit = p.zeit
          ? new Date(p.zeit).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '--------';
        // RF: "?" = nur gefragt, "!" = gefragt und beantwortet, "-" = keine
        const rfZeichen = !rf.gestellt ? '-' : (rf.antwort ? '!' : '?');
        const kand = (p.kandidaten || []).length;
        const erg = (p.ergebnis || []).length;

        let merker = '';
        if (p.fehler) merker = '  FEHLER: ' + String(p.fehler).slice(0, 30);
        else if (rfZeichen !== '?' && kand > 0 && erg === 0) merker = '  <- Produkte da, Antwort leer';
        else if (rfZeichen !== '?' && kand === 0) merker = '  <- nichts gefunden';

        console.log('  ' + zeit + '  '
          + String(a.roh || a.begriff || '-').slice(0, 34).padEnd(36)
          + rfZeichen.padStart(2)
          + String(kand).padStart(6)
          + String(erg).padStart(5)
          + merker);
      }

      console.log('');
      console.log('  RF:  -  keine Rueckfrage');
      console.log('       ?  nachgefragt, hier endete der Durchlauf (richtig so)');
      console.log('       !  nachgefragt UND beantwortet - dieser Durchlauf zaehlt');
      console.log('');
      console.log('  Steht nach einem "?" keine Zeile mit "!", hat die Antwort');
      console.log('  des Nutzers GAR KEIN Protokoll erzeugt. Dann ist die');
      console.log('  Anfrage nie im Controller angekommen - z.B. von einer');
      console.log('  Grenze abgewiesen, bevor ueberhaupt gesucht wurde.');
      console.log('');
      return;
    }

    let filter = {};
    if (SUCHTEXT) {
      // Punkte, Klammern usw. im Suchtext nicht als Regex deuten
      const sicher = SUCHTEXT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // WICHTIG: auch in "vollstaendig" suchen.
      //
      // Eine Frage mit Rueckfrage erzeugt ZWEI Protokolle:
      //   1. die Frage        -> roh = "Kopfhörer für meinen Vater..."
      //   2. die Antwort      -> roh = "Ja, genau"
      //
      // Im zweiten steht der urspruengliche Text nur noch in
      // vollstaendig. Die erste Fassung dieses Scripts hat deshalb
      // bei genau den Faellen, die man untersuchen will, nur die
      // Rueckfrage gezeigt und den eigentlichen Durchlauf nie
      // gefunden. Gemessen am 03.10.2026.
      filter = {
        $or: [
          { 'anfrage.begriff': { $regex: sicher, $options: 'i' } },
          { 'anfrage.roh': { $regex: sicher, $options: 'i' } },
          { 'anfrage.vollstaendig': { $regex: sicher, $options: 'i' } }
        ]
      };
    }
    if (NUR_LEER) {
      filter['ergebnis.0'] = { $exists: false };
      filter['rueckfrage.antwort'] = { $nin: [null, ''] }; // nicht nur nachgefragt
    }

    // Mehrere zeigen, damit die ganze Kette sichtbar wird: Frage,
    // Rueckfrage, Antwort. Aelteste zuerst, damit man sie in der
    // Reihenfolge liest, in der sie passiert sind.
    const ANZAHL = ALLE ? 20 : (NUR_LEER ? 5 : 4);
    const treffer = (await SuchProtokoll.find(filter)
      .sort({ zeit: -1 }).limit(ANZAHL).lean()).reverse();

    if (!treffer.length) {
      console.log('\n  Nichts gefunden.');
      console.log('  Suchprotokolle loeschen sich nach 180 Tagen von selbst.\n');
      return;
    }

    let nummer = 0;
    for (const p of treffer) {
      nummer++;
      const a = p.anfrage || {};
      kopf(treffer.length > 1
        ? `DURCHLAUF ${nummer} VON ${treffer.length}: ${a.begriff || a.roh || '(ohne Begriff)'}`
        : `SUCHE: ${a.begriff || a.roh || '(ohne Begriff)'}`);

      console.log('');
      console.log(`  getippt:     ${a.roh || '-'}`);
      if (a.vollstaendig && a.vollstaendig !== a.roh) {
        console.log(`  vollstaendig: ${a.vollstaendig}`);
      }
      const woerter = String(a.begriff || '').split(/\s+/).filter(Boolean);
      console.log(`  an Google:   ${a.begriff || '-'}`
        + (woerter.length >= 6 ? `   (${woerter.length} Woerter)` : ''));
      console.log(`  Budget:      ${a.budget ?? 'keins'}`);
      console.log(`  Kategorie:   ${a.kategorie || '-'}`);
      console.log(`  Zeit:        ${p.zeit ? new Date(p.zeit).toLocaleString('de-CH') : '-'}`);
      console.log(`  Dauer:       ${p.dauerMs ? (p.dauerMs / 1000).toFixed(1) + ' s' : '-'}`);
      if (p.ausCache) {
        console.log(`  aus Cache:   Produkte ${p.ausCache.produkte ? 'ja' : 'nein'}`
          + `, Bewertung ${p.ausCache.bewertung ? 'ja' : 'nein'}`);
      }

      // ---------- Rueckfrage ----------
      const rf = p.rueckfrage || {};
      if (rf.gestellt) {
        console.log('');
        console.log('  --- Rueckfrage ---');
        console.log(`  gefragt:     ${rf.frage || '-'}`);
        console.log(`  geantwortet: ${rf.antwort || '(nicht beantwortet - hier endete der Durchlauf)'}`);
        if (!rf.antwort) {
          console.log('');
          console.log('  Dieser Durchlauf endete bei der Rueckfrage. Dass keine');
          console.log('  Produkte folgen, ist richtig - es wurde erst nachgefragt.');
          trenner('-');
          continue;
        }
      }

      // ---------- Der Trichter ----------
      const t = p.treffer || {};
      console.log('');
      console.log('  --- Wo die Produkte geblieben sind ---');
      console.log('');
      const g = stufe('gefunden', t.gesamt);
      const nf = stufe('nach Filter', t.nachFilter, g);
      const kand = stufe('Kandidaten', (p.kandidaten || []).length, nf);
      const erg = stufe('im Ergebnis', (p.ergebnis || []).length, kand);

      if (t.ueberBudget || t.aussortiert) {
        console.log('');
        if (t.ueberBudget) console.log(`      davon ueber Budget:  ${t.ueberBudget}`);
        if (t.aussortiert) console.log(`      davon aussortiert:   ${t.aussortiert}`);
      }

      // Lange Begriffe nur ANMERKEN, nicht verurteilen.
      // Am 03.10.2026 hatte ich vermutet, ein Begriff aus zehn
      // Woertern sei der Grund fuer leere Ergebnisse. Das Protokoll
      // vom 28.09. hat das widerlegt: derselbe Zehn-Wort-Satz
      // lieferte 40 Treffer. Die Zahl bleibt interessant, aber sie
      // ist kein Urteil - darum steht sie hier bei den Zahlen und
      // nicht als Warnung oben.
      if (woerter.length >= 6 && g > 0) {
        console.log('');
        console.log(`      Hinweis: ${woerter.length} Woerter im Begriff, ${g} Treffer.`);
      }
      if (typeof t.schweizer === 'number') {
        console.log(`      Schweizer Shops:     ${t.schweizer}`);
        console.log(`      auslaendische:       ${t.ausland ?? 0}`);
      }

      // ---------- Wer hat zugeschlagen? ----------
      console.log('');
      console.log('  --- Urteil ---');
      console.log('');
      if (p.fehler) {
        console.log(`  Die Suche ist mit einem Fehler geendet:`);
        console.log(`      ${p.fehler}`);
      } else if (g === 0) {
        console.log('  Es wurden gar keine Produkte gefunden.');
        console.log('  Im Abspielmodus heisst das: zu diesem Begriff gibt es');
        console.log('  keine Aufnahme. Pruefen mit:');
        console.log('      node scripts/aufnahmeLuecken.js --alle');
      } else if (nf === 0) {
        console.log(`  Der FILTER hat alle ${g} Produkte verworfen.`);
        if (t.ueberBudget) console.log(`  ${t.ueberBudget} davon wegen des Budgets.`);
        if (t.aussortiert) console.log(`  ${t.aussortiert} davon als Zubehoer oder Einzelteil.`);
      } else if (kand === 0) {
        console.log(`  Die KANDIDATENWAHL hat alle ${nf} uebrigen verworfen.`);
      } else if (erg === 0) {
        console.log(`  Die Produkte waren da - ${kand} Kandidaten gingen an die`);
        console.log('  Modelle - aber am Ende stand keines in der Antwort.');
        console.log('  Es lag also an der BEWERTUNG oder der FAKTENPRUEFUNG.');
      } else {
        console.log(`  ${erg} Produkte in der Antwort. Die Kette hat gehalten.`);
      }

      // ---------- Die Modelle ----------
      const bew = p.bewertungen || [];
      if (bew.length) {
        console.log('');
        console.log('  --- Die Modelle einzeln ---');
        console.log('');
        for (const b of bew) {
          const rang = (b.rangliste || []).length;
          // Modellnamen sind laenger als gedacht:
          // "claude-haiku-4-5-20251001" sind 25 Zeichen und sind in
          // die naechste Spalte gelaufen. Lieber abschneiden.
          const name = String(b.modell || '?');
          const zeile = '  ' + (name.length > 24 ? name.slice(0, 23) + '…' : name).padEnd(26)
            + (b.fehler ? 'FEHLER' : `${rang} bewertet`).padEnd(14)
            + (b.dauerMs ? (b.dauerMs / 1000).toFixed(1) + 's' : '');
          console.log(zeile);
          if (b.fehler) console.log(`      -> ${String(b.fehler).slice(0, 100)}`);
        }
      } else if (p.ausCache && p.ausCache.bewertung) {
        // Das ist KEIN Ausfall. Kam die Bewertung aus dem Cache,
        // liefen die Modelle gar nicht - darum steht hier nichts.
        // Die erste Fassung meldete "Kein Modell hat geantwortet",
        // was nach einem Fehler klingt. Es ist das Gegenteil: es war
        // der guenstigste Durchlauf von allen.
        console.log('');
        console.log('  Die Bewertung kam aus dem Cache - die Modelle liefen');
        console.log('  gar nicht erst. Deshalb steht hier nichts, und deshalb');
        console.log('  hat dieser Durchlauf nichts gekostet.');
      } else {
        console.log('');
        console.log('  Kein Modell hat geantwortet - es gibt keine Bewertungen.');
      }

      // ---------- Faktenpruefung ----------
      const gestrichen = p.gestrichen || [];
      console.log('');
      console.log('  --- Faktenpruefung ---');
      console.log('');
      if (!gestrichen.length) {
        console.log('  Nichts gestrichen. Kein Modell hat etwas erfunden.');
      } else {
        console.log(`  ${gestrichen.length} Aussagen entfernt:`);
        console.log('');
        for (const s of gestrichen.slice(0, 10)) {
          console.log(`    [${s.grund || '?'}]  ${s.produkt || '-'}`);
          if (s.satz) console.log(`        "${String(s.satz).slice(0, 90)}"`);
        }
        if (gestrichen.length > 10) console.log(`    ... und ${gestrichen.length - 10} weitere`);
        console.log('');
        console.log('  Das ist Regel 1 bei der Arbeit: entfernte Aussagen sind');
        console.log('  ein gutes Zeichen, keine Panne. Sie zeigen, dass die');
        console.log('  Pruefung greift, bevor der Nutzer etwas Falsches liest.');
      }

      // ---------- Konsens ----------
      const k = p.konsens || {};
      if (k.runden || typeof k.einstimmigTop1 === 'boolean') {
        console.log('');
        console.log('  --- Konsens ---');
        console.log('');
        console.log(`  einstimmig auf Platz 1:  ${k.einstimmigTop1 ? 'ja' : 'nein'}`);
        if (k.runden) console.log(`  Runden:                  ${k.runden}`);
        if (k.uneinigkeit && k.uneinigkeit.length) {
          console.log(`  uneinig bei:             ${k.uneinigkeit.slice(0, 5).join(', ')}`);
        }
      }

      // ---------- Was der Nutzer sah ----------
      if ((p.ergebnis || []).length) {
        console.log('');
        console.log('  --- Was der Nutzer gesehen hat ---');
        console.log('');
        for (const e of p.ergebnis) {
          console.log(`    ${String(e.titel || '-').slice(0, 44).padEnd(46)}`
            + String(e.preis ?? '-').padStart(8) + '  ' + (e.shop || '-'));
        }
      }

      console.log('');
      trenner('-');
    }

    console.log('');
  } catch (e) {
    console.error('\nFehler:', e.message, '\n');
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
})();