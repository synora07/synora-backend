// ============================================
// SYNORA - Kostenbremse
// ============================================
// Der harte Deckel. Nicht ein Alarm - eine Wand.
//
// WARUM
//
// Im Launch-Plan steht: "CHF-500-Risikolimit und Alarmgrenzen fuer
// Kosten sind im Blick." Im Blick behalten ist keine Bremse. Ein
// Alarm weckt dich um drei Uhr morgens, wenn das Geld schon weg ist.
// Diese Datei schaltet die Suche ab, BEVOR die Grenze faellt.
//
// ZWEI PREISSTUFEN
//
//   guenstig    Claude Haiku, GPT-5 mini, Perplexity Sonar
//               ca. 3-4 Rappen je Suche    -> Gratis-Nutzer
//   qualitaet   Claude Sonnet, Perplexity Sonar Pro
//               ca. 12-14 Rappen je Suche  -> Premium
//
// Darum wird nicht in Suchen gezaehlt, sondern in FRANKEN. Eine
// Premium-Suche kostet das Vierfache einer Gratis-Suche.
//
// ERST BUCHEN, DANN PRUEFEN
//
// Die naheliegende Reihenfolge - Stand lesen, rechnen, freigeben -
// haelt unter Last nicht. Laufen 200 Suchen gleichzeitig, lesen alle
// denselben Stand und kommen alle durch. Gemessen: bei 500
// gleichzeitigen Anfragen wurde ein Deckel von CHF 25 um CHF 70
// ueberschritten. An Black Friday ist genau das der wahrscheinliche
// Fall.
//
// Darum bucht diese Datei den Betrag ZUERST (ein atomares $inc in
// MongoDB) und schaut sich das Ergebnis danach an. Ist der Deckel
// damit gerissen, wird der Betrag sofort zurueckgebucht und die
// Suche abgelehnt. So kann sich keine zweite Anfrage dazwischen
// schieben - die Datenbank zaehlt, nicht wir.
//
// WAS PASSIERT, WENN DIE DATENBANK WEG IST
//
//   Datenbank da   -> echter Zaehler, ueberlebt jeden Neustart
//   Datenbank weg  -> Notbudget von CHF 5, danach zu
//
// Das Notbudget ist zusaetzlich durch den Rest unter Tages- und
// Monatsdeckel begrenzt. Und es gibt es NUR, wenn dieser Prozess
// den Tagesstand schon einmal gelesen hat.
//
// WICHTIG, WEIL ES DEN BETRIEB BETRIFFT: Startet der Container neu,
// WAEHREND die Datenbank weg ist, weiss die Bremse nicht, wie viel
// heute schon ausgegeben wurde - und gibt dann gar nichts frei. Die
// Suche antwortet "gerade nicht erreichbar", bis die Datenbank
// wieder da ist. Das ist Absicht: in diesem Moment gibt es ohnehin
// keine Anmeldung und keinen Verlauf. Die Alternative waere, bei
// jedem Neustart CHF 5 neu zu verschenken - bei einem Absturz in
// Schleife beliebig oft.
//
// Das im Notbetrieb ausgegebene Geld wird NICHT vergessen: sobald
// die Datenbank zurueck ist, wird es nachgetragen. Sonst bekaeme
// eine flatternde Verbindung - aus, an, aus, an - bei jedem
// Wiederanlauf ein frisches Notbudget. Gemessen wurden so CHF 49
// bei einem Tagesdeckel von CHF 25, und der Zaehler stand auf null.
//
// EINSTELLUNGEN (.env)
//
//   KOSTEN_MONAT_CHF=500        dein Risikolimit
//   KOSTEN_TAG_CHF=25           damit es nicht an einem Tag weggeht
//   KOSTEN_NOTFALL_CHF=5        wenn die Datenbank nicht erreichbar ist
//   KOSTEN_GUENSTIG=0.04        Franken je Gratis-Suche
//   KOSTEN_QUALITAET=0.14       Franken je Premium-Suche
//   GAST_SUCHEN_PRO_IP=3        gegen das private Fenster
//
// Eine LEERE Zeile (KOSTEN_GUENSTIG= ohne Wert) gilt als nicht
// gesetzt. Frueher wurde daraus die Zahl 0, und ein Preis von 0
// bedeutet: der Deckel schliesst nie. Gemessen: 100'000 Suchen
// ohne eine einzige Sperre.
// ============================================

'use strict';

// ============================================
// Einstellungen lesen
// ============================================

function zahl(name, vorgabe, minimum) {
  const roh = process.env[name];
  if (roh === undefined || String(roh).trim() === '') return vorgabe;
  const wert = Number(roh);
  if (!Number.isFinite(wert) || wert < minimum) {
    console.warn(`[kosten] ${name}="${roh}" ist unbrauchbar - es gilt ${vorgabe}`);
    return vorgabe;
  }
  return wert;
}

// Grenzen und Preise muessen groesser als null sein.
const MINI = 1e-9;

const GRENZE_MONAT   = zahl('KOSTEN_MONAT_CHF', 500, MINI);
const GRENZE_TAG     = zahl('KOSTEN_TAG_CHF', 25, MINI);
const GRENZE_NOTFALL = zahl('KOSTEN_NOTFALL_CHF', 5, MINI);

const PREIS = {
  guenstig:  zahl('KOSTEN_GUENSTIG', 0.04, MINI),
  qualitaet: zahl('KOSTEN_QUALITAET', 0.14, MINI)
};

// ============================================
// Was die Modelle allein kosten
// ============================================
// Die Preise oben sind der GANZE Weg: SerpAPI plus Modelle.
//
// Es gibt aber einen Fall, in dem nur die Modelle laufen: die
// Produkte kommen aus dem Cache, die Bewertung ist aber neu (weil
// ein anderer Nutzer dasselbe Produkt fuer einen anderen Zweck
// sucht). Dann wird kein Rappen an SerpAPI bezahlt, wohl aber an
// Claude und OpenAI - und genau das lief bisher an der Bremse
// vorbei, weil sie nur bei einem Cache-Fehlschlag gefragt wurde.
//
// Gemessen am 28.09.: von rund 9 Rappen je Suche entfiel etwa 1
// Rappen auf die Modelle, der Rest auf SerpAPI.
const LLM_PREIS = {
  guenstig:  zahl('KOSTEN_LLM_GUENSTIG', 0.01, MINI),
  qualitaet: zahl('KOSTEN_LLM_QUALITAET', 0.04, MINI)
};

// 0 ist hier erlaubt und heisst "IP-Limit aus".
const GAST_PRO_IP = zahl('GAST_SUCHEN_PRO_IP', 3, 0);

// Damit im Log steht, womit wirklich gerechnet wird - und nicht,
// was in der .env zu stehen scheint.
console.log(
  `[kosten] Deckel: Tag CHF ${GRENZE_TAG} | Monat CHF ${GRENZE_MONAT} | Notfall CHF ${GRENZE_NOTFALL} | ` +
  `Preise: guenstig ${PREIS.guenstig} / qualitaet ${PREIS.qualitaet} | ` +
  `nur Modelle: ${LLM_PREIS.guenstig} / ${LLM_PREIS.qualitaet} | Gast pro IP: ${GAST_PRO_IP || 'aus'}`
);

// ============================================
// Zeitraeume
// ============================================
// Schweizer Zeit, nicht UTC - sonst springt der Tageszaehler um
// 01:00 oder 02:00 statt um Mitternacht.
//
// sv-SE liefert das Datum in der Form 2026-09-30. Auf einem Node
// ohne vollstaendiges ICU faellt das still auf ein US-Format
// zurueck, und dann wuerde slice(0,7) jeden Tag einen neuen "Monat"
// erzeugen - der Monatsdeckel waere wirkungslos. Darum wird das
// Format beim Start einmal geprueft.

const DATUM_CH = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Zurich',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const FORMAT_OK = /^\d{4}-\d{2}-\d{2}$/.test(DATUM_CH.format(new Date()));
if (!FORMAT_OK) {
  console.error('[kosten] ACHTUNG: Dieses Node kann kein sv-SE Datum bilden.');
  console.error('[kosten] Es wird auf UTC ausgewichen. Der Tageswechsel liegt dann nicht um Mitternacht.');
}

function schluessel(jetzt = new Date()) {
  const tag = FORMAT_OK ? DATUM_CH.format(jetzt) : jetzt.toISOString().slice(0, 10);
  return { tag, monat: tag.slice(0, 7) };
}

// ============================================
// Speicher
// ============================================
// Mongoose wird nur benutzt, wenn die App ohnehin schon verbunden
// ist. Diese Datei baut KEINE eigene Verbindung auf.

let Zaehler = null;

function modell() {
  if (Zaehler) return Zaehler;
  let mongoose;
  try {
    mongoose = require('mongoose');
  } catch (_) {
    return null;
  }

  if (mongoose.models.Kostenzaehler) {
    Zaehler = mongoose.models.Kostenzaehler;
    return Zaehler;
  }

  const schema = new mongoose.Schema({
    _id: String,               // "2026-09-30" oder "2026-09"
    art: String,               // "tag" | "monat"
    chf: { type: Number, default: 0 },
    suchen: { type: Number, default: 0 },
    guenstig: { type: Number, default: 0 },
    qualitaet: { type: Number, default: 0 },
    geaendert: { type: Date, default: Date.now }
  }, { versionKey: false });

  Zaehler = mongoose.model('Kostenzaehler', schema);
  return Zaehler;
}

function verbunden() {
  try {
    return require('mongoose').connection.readyState === 1;
  } catch (_) {
    return false;
  }
}

// Notzaehler: was ausgegeben wurde, waehrend die Datenbank weg war.
// Wird beim naechsten erfolgreichen Schreiben nachgetragen, nicht
// vergessen. Getrennt nach Stufe, damit auch die Suchzahlen im
// Zaehler stimmen und nicht alles der Stufe zugeschlagen wird, die
// zufaellig als erste wieder durchkommt.
function leererNotfall() {
  return {
    guenstig:  { chf: 0, suchen: 0 },
    qualitaet: { chf: 0, suchen: 0 },
    seit: null
  };
}

let notfall = leererNotfall();

function notfallSumme() {
  return notfall.guenstig.chf + notfall.qualitaet.chf;
}

// ============================================
// IP-Zaehler fuer Gaeste
// ============================================
// Nur im Arbeitsspeicher: das ist Missbrauchsschutz, kein
// Geldzaehler. Ein Neustart setzt ihn zurueck - verkraftbar, weil
// der Franken-Deckel darueber liegt und der weiterzaehlt.

const IP_MAX_EINTRAEGE = 100000;
const proIp = new Map();
let ipTag = schluessel().tag;

function ipAufraeumen() {
  const heute = schluessel().tag;
  if (heute !== ipTag) {
    proIp.clear();
    ipTag = heute;
  }
  // Notbremse gegen unbegrenztes Wachstum im Container.
  if (proIp.size > IP_MAX_EINTRAEGE) {
    console.warn(`[kosten] IP-Liste bei ${proIp.size} Eintraegen - wird geleert`);
    proIp.clear();
  }
}

function ipZaehlen(ip) {
  ipAufraeumen();
  if (!ip) return 0;
  return proIp.get(ip) || 0;
}

function ipHochzaehlen(ip) {
  if (!ip) return;
  ipAufraeumen();
  proIp.set(ip, (proIp.get(ip) || 0) + 1);
}

function ipRunterzaehlen(ip) {
  if (!ip) return;
  const jetzt = proIp.get(ip) || 0;
  if (jetzt <= 1) proIp.delete(ip);
  else proIp.set(ip, jetzt - 1);
}

// ============================================
// Welche Stufe fuer wen
// ============================================

function stufeFuer(istPremium) {
  return istPremium ? 'qualitaet' : 'guenstig';
}

function preisFuer(istPremium) {
  return PREIS[stufeFuer(istPremium)];
}

// ============================================
// Buchen
// ============================================
// Ein einziges atomares $inc auf Tag und Monat. Der Rueckgabewert
// ist der Stand NACH dem Buchen - darauf wird entschieden.

// Der zuletzt bekannte Stand. Wird bei jeder Buchung mitgefuehrt,
// damit die Bremse auch dann noch weiss, wo sie steht, wenn die
// Datenbank ausfaellt.
let letzterStand = { tag: 0, monat: 0, tagSchluessel: null, monatSchluessel: null };

// Tag und Monat NACHEINANDER, nicht gleichzeitig.
//
// Mit Promise.all konnte das eine Dokument geschrieben sein und das
// andere scheitern. Dann warf buchen(), obwohl schon Geld gezaehlt
// war - und der Aufrufer legte denselben Betrag noch einmal in den
// Notzaehler. Gemessen: CHF 0.42 statt CHF 0.28 fuer zwei Suchen,
// und Tag und Monat liefen dauerhaft auseinander.
//
// Jetzt wird der Tag gebucht, dann der Monat. Scheitert der Monat,
// wird der Tag sofort wieder zurueckgenommen, und erst dann
// geworfen. Beide oder keiner.
async function buchen(M, betrag, stufe, wieViele, s = schluessel()) {
  const zuwachs = {
    $inc: { chf: betrag, suchen: wieViele, [stufe]: wieViele },
    $set: { geaendert: new Date() }
  };

  const tag = await M.findByIdAndUpdate(
    s.tag, { ...zuwachs, $setOnInsert: { art: 'tag' } }, { upsert: true, new: true }
  ).lean();

  let monat;
  try {
    monat = await M.findByIdAndUpdate(
      s.monat, { ...zuwachs, $setOnInsert: { art: 'monat' } }, { upsert: true, new: true }
    ).lean();
  } catch (e) {
    try {
      await M.findByIdAndUpdate(
        s.tag,
        { $inc: { chf: -betrag, suchen: -wieViele, [stufe]: -wieViele } },
        { new: true }
      ).lean();
    } catch (_) {
      console.error('[kosten] Tag konnte nach Monatsfehler nicht zurueckgenommen werden');
    }
    throw e;
  }

  letzterStand = {
    tag: tag.chf,
    monat: monat.chf,
    tagSchluessel: s.tag,
    monatSchluessel: s.monat
  };
  return { tag, monat, schluessel: s };
}

/**
 * Was im Notbetrieb hoechstens noch ausgegeben werden darf.
 * Nicht einfach das Notbudget: wenn der Tagesdeckel schon fast
 * voll ist, ist auch im Notbetrieb Schluss. Sonst bekaeme eine
 * flatternde Verbindung - aus, an, aus, an - bei jedem Wiederanlauf
 * ein frisches Notbudget. Gemessen wurden so CHF 49 bei einem
 * Tagesdeckel von CHF 25.
 */
function notBudget() {
  const s = schluessel();

  // Noch nie erfolgreich gebucht - wir wissen NICHT, wie viel heute
  // schon ausgegeben wurde. Das passiert, wenn der Container neu
  // startet, waehrend die Datenbank weg ist.
  //
  // Frueher bekam dieser Fall das volle Notbudget. Gemessen: der
  // Tag stand in der Datenbank auf CHF 24.86, der frische Prozess
  // gab trotzdem CHF 4.90 frei - CHF 29.76 bei einem Deckel von 25.
  // Ein Absturz in Schleife haette das beliebig oft wiederholt.
  //
  // Ohne bekannten Stand wird darum nichts freigegeben. In genau
  // diesem Moment ist ohnehin weder Anmeldung noch Verlauf
  // verfuegbar - die Seite ist nicht halb kaputt, sondern ganz.
  if (letzterStand.tagSchluessel === null) {
    return { chf: 0, grund: 'notfall' };
  }

  // Nach Mitternacht ist der alte Tageswert wertlos, nach dem
  // Monatswechsel der alte Monatswert.
  const tagBekannt = letzterStand.tagSchluessel === s.tag ? letzterStand.tag : 0;
  const monatBekannt = letzterStand.monatSchluessel === s.monat ? letzterStand.monat : 0;

  const restTag = Math.max(0, GRENZE_TAG - tagBekannt);
  const restMonat = Math.max(0, GRENZE_MONAT - monatBekannt);

  if (restMonat <= restTag && restMonat < GRENZE_NOTFALL) return { chf: restMonat, grund: 'monat' };
  if (restTag < GRENZE_NOTFALL) return { chf: restTag, grund: 'tag' };
  return { chf: GRENZE_NOTFALL, grund: 'notfall' };
}

// ============================================
// Stand lesen (nur fuers Log, nicht fuer Entscheidungen)
// ============================================

async function stand() {
  const M = modell();

  if (!M || !verbunden()) {
    return { erreichbar: false, notfall: { chf: notfallSumme(), grenze: GRENZE_NOTFALL } };
  }

  const s = schluessel();
  try {
    const [tag, monat] = await Promise.all([
      M.findById(s.tag).lean(),
      M.findById(s.monat).lean()
    ]);
    return {
      erreichbar: true,
      tag:   { chf: tag ? tag.chf : 0,     grenze: GRENZE_TAG,   suchen: tag ? tag.suchen : 0 },
      monat: { chf: monat ? monat.chf : 0, grenze: GRENZE_MONAT, suchen: monat ? monat.suchen : 0 }
    };
  } catch (_) {
    return { erreichbar: false, notfall: { chf: notfallSumme(), grenze: GRENZE_NOTFALL } };
  }
}

// ============================================
// Notbetrieb
// ============================================

const MELDUNG = {
  notfall: 'SYNORA ist gerade nicht erreichbar. Wir arbeiten daran – bitte versuche es in ein paar Minuten nochmal.',
  tag: 'SYNORA hat heute sein Suchbudget aufgebraucht. Morgen früh geht es weiter.',
  monat: 'SYNORA hat sein Monatsbudget für Suchen erreicht. Ab dem 1. des nächsten Monats geht es weiter.'
};

function notbetrieb(istPremium, preis, ip, ipBelegt) {
  if (!notfall.seit) notfall.seit = Date.now();

  const budget = notBudget();

  if (notfallSumme() + preis > budget.chf) {
    if (ipBelegt) ipRunterzaehlen(ip);
    return {
      erlaubt: false,
      grund: budget.grund,
      meldung: MELDUNG[budget.grund]
    };
  }

  const stufe = stufeFuer(istPremium);
  notfall[stufe].chf += preis;
  notfall[stufe].suchen += 1;

  return { erlaubt: true, stufe, preis, notbetrieb: true };
}

// ============================================
// DARF GESUCHT WERDEN?
// ============================================
// Wird VOR der Suche gefragt und bucht den Preis EINER Abfrage
// gleich mit. Gibt es einen zweiten Versuch mit gekuerztem Begriff,
// wird der mit nachbuchen() ergaenzt.
//
// Reihenfolge:
//   1. IP-Limit fuer Gaeste  (kostet nichts, gilt auch im Notbetrieb)
//   2. Datenbank weg?        -> Notbudget
//   3. buchen, dann Monat und Tag pruefen, notfalls zurueckbuchen

async function darfSuchen({ istPremium = false, istGast = false, ip = null } = {}) {
  const premium = !!istPremium;
  const gast = !!istGast;
  const stufe = stufeFuer(premium);
  const preis = PREIS[stufe];

  // ---------- 1. IP ----------
  // Bewusst VOR allem anderen. Frueher stand diese Pruefung hinter
  // dem Notbetrieb - und fiel damit genau dann aus, wenn das System
  // angeschlagen war. Gemessen: 124 Suchen von einer einzigen IP
  // statt der erlaubten 3.
  //
  // Und der Platz wird SOFORT belegt, nicht erst nach der Buchung.
  // Sonst lesen zehn gleichzeitige Anfragen derselben IP alle die
  // Null und kommen alle durch. Gemessen: 625 Suchen von einer
  // einzigen IP, bis der Tagesdeckel sie stoppte. Wird die Anfrage
  // spaeter doch abgelehnt, wird der Platz wieder freigegeben.
  //
  // NUR FUER GAESTE. Frueher galt das Limit fuer alle, die nicht
  // Premium sind - also auch fuer angemeldete Gratis-Nutzer. Die
  // haben 5 Suchen im Monat, waeren aber nach 3 Suchen am selben
  // Tag von derselben IP gesperrt worden. Ein angemeldeter Nutzer
  // wird ueber sein Konto gezaehlt (suchLimit.js), nicht ueber
  // seine Adresse.
  let ipBelegt = false;
  if (gast && GAST_PRO_IP > 0) {
    if (ipZaehlen(ip) >= GAST_PRO_IP) {
      return {
        erlaubt: false,
        grund: 'ip',
        meldung: 'Du hast die kostenlosen Suchen für heute aufgebraucht. Mit einem Konto bekommst du mehr.'
      };
    }
    ipHochzaehlen(ip);
    ipBelegt = true;
  }

  const abgelehnt = (grund) => {
    if (ipBelegt) ipRunterzaehlen(ip);
    return { erlaubt: false, grund, meldung: MELDUNG[grund] };
  };

  const M = modell();

  // ---------- 2. Datenbank weg ----------
  if (!M || !verbunden()) {
    return notbetrieb(premium, preis, ip, ipBelegt);
  }

  // ---------- 3. Rueckstand zuerst, dann buchen, dann pruefen ----------
  // Der Rueckstand muss VOR der Pruefung im Zaehler stehen. Stand er
  // danach drin, sah die Pruefung einen zu niedrigen Wert und liess
  // eine Suche zu viel durch - gemessen 6 Rappen ueber dem Deckel.
  await rueckstandNachtragen(M);

  let nachher;
  try {
    nachher = await buchen(M, preis, stufe, 1);
  } catch (e) {
    // readyState kann "verbunden" melden, waehrend die Abfrage
    // scheitert. Auch das ist Notbetrieb - eine Bremse, die bei
    // jedem Datenbankfehler aufgeht, ist keine.
    console.error('[kosten] Buchung fehlgeschlagen:', e.message);
    return notbetrieb(premium, preis, ip, ipBelegt);
  }

  if (nachher.monat.chf > GRENZE_MONAT) {
    await zurueckbuchen(M, preis, stufe, 1, nachher.schluessel);
    return abgelehnt('monat');
  }

  if (nachher.tag.chf > GRENZE_TAG) {
    await zurueckbuchen(M, preis, stufe, 1, nachher.schluessel);
    return abgelehnt('tag');
  }

  warnen(nachher.tag.chf, nachher.monat.chf);

  return {
    erlaubt: true,
    stufe,
    preis,
    tagChf: nachher.tag.chf,
    monatChf: nachher.monat.chf
  };
}

// Mit DENSELBEN Schluesseln zurueckbuchen, mit denen gebucht wurde.
// Faellt Mitternacht genau dazwischen, bildete buchen() sonst neue
// Schluessel: das Plus blieb auf dem alten Tag stehen, das Minus
// landete auf dem neuen - der neue Tag startete mit CHF -0.14 und
// damit einem zu lockeren Deckel.
async function zurueckbuchen(M, betrag, stufe, wieViele, s) {
  try {
    await buchen(M, -betrag, stufe, -wieViele, s);
  } catch (e) {
    console.error('[kosten] Rueckbuchung fehlgeschlagen:', e.message);
  }
}

// ============================================
// Rueckstand aus dem Notbetrieb nachtragen
// ============================================

async function rueckstandNachtragen(M) {
  if (notfallSumme() <= 0) {
    notfall.seit = null;
    return;
  }

  // ERST HERAUSNEHMEN, DANN BUCHEN.
  //
  // Vorher wurde notfall erst NACH dem await geleert. Kamen zwei
  // Anfragen gleichzeitig, lasen beide denselben Rueckstand und
  // buchten ihn beide voll. Gemessen: bei 200 gleichzeitigen
  // Anfragen standen CHF 980 im Zaehler, obwohl CHF 4.90 ausgegeben
  // worden waren - und SYNORA haette sich damit selbst bis zum
  // Monatsende abgeschaltet.
  //
  // JavaScript laeuft in einem Faden: alles bis zum ersten await
  // gehoert uns allein. Darum wird der Rueckstand hier synchron
  // herausgenommen, bevor irgendein await kommt. Scheitert das
  // Buchen, wandert zurueck, was nicht durchkam.
  const offen = {
    guenstig: notfall.guenstig,
    qualitaet: notfall.qualitaet
  };
  const summe = offen.guenstig.chf + offen.qualitaet.chf;
  const suchen = offen.guenstig.suchen + offen.qualitaet.suchen;
  notfall = leererNotfall();

  try {
    for (const stufe of ['guenstig', 'qualitaet']) {
      const o = offen[stufe];
      if (o.chf > 0 || o.suchen > 0) {
        await buchen(M, o.chf, stufe, o.suchen);
        offen[stufe] = { chf: 0, suchen: 0 };   // diese Stufe ist durch
      }
    }
    console.log(`[kosten] Notbetrieb nachgetragen: CHF ${summe.toFixed(2)} aus ${suchen} Suchen`);
  } catch (e) {
    // Nur das zuruecklegen, was NICHT gebucht wurde.
    for (const stufe of ['guenstig', 'qualitaet']) {
      notfall[stufe].chf += offen[stufe].chf;
      notfall[stufe].suchen += offen[stufe].suchen;
    }
    if (notfallSumme() > 0) notfall.seit = notfall.seit || Date.now();
    console.error('[kosten] Nachtragen fehlgeschlagen:', e.message);
  }
}

// ============================================
// NACHBUCHEN
// ============================================
// Fuer jede Abfrage, die ueber die eine hinausgeht, die darfSuchen
// schon gebucht hat - zum Beispiel den zweiten Versuch mit
// gekuerztem Suchbegriff.

async function nachbuchen({ istPremium = false, zusaetzlich = 0, echteKosten = null } = {}) {
  const premium = !!istPremium;
  const stufe = stufeFuer(premium);

  // Nach oben geklemmt. Eine einzelne Anfrage loest hoechstens eine
  // Handvoll Abfragen aus; alles darueber ist ein Fehler im
  // Aufrufer und duerfte nicht den ganzen Monatsdeckel verbrennen.
  const MAX_ZUSAETZLICH = 10;
  const roh = Number.isFinite(zusaetzlich) && zusaetzlich > 0 ? Math.round(zusaetzlich) : 0;
  const wieViele = Math.min(roh, MAX_ZUSAETZLICH);
  if (roh > MAX_ZUSAETZLICH) {
    console.warn(`[kosten] nachbuchen(${roh}) ist unplausibel - es werden ${MAX_ZUSAETZLICH} gebucht`);
  }

  const MAX_BETRAG = PREIS[stufe] * MAX_ZUSAETZLICH;
  const betrag = Number.isFinite(echteKosten) && echteKosten > 0
    ? Math.min(echteKosten, MAX_BETRAG)
    : PREIS[stufe] * wieViele;

  if (betrag <= 0) return { gebucht: false, nichts: true };

  const M = modell();
  if (!M || !verbunden()) {
    notfall[stufe].chf += betrag;
    notfall[stufe].suchen += wieViele;
    return { gebucht: false, notbetrieb: true, chf: notfallSumme() };
  }

  try {
    const nachher = await buchen(M, betrag, stufe, wieViele);
    warnen(nachher.tag.chf, nachher.monat.chf);
    return { gebucht: true, tagChf: nachher.tag.chf, monatChf: nachher.monat.chf };
  } catch (e) {
    notfall[stufe].chf += betrag;
    notfall[stufe].suchen += wieViele;
    console.error('[kosten] Nachbuchen fehlgeschlagen:', e.message);
    return { gebucht: false, chf: notfallSumme() };
  }
}

// ============================================
// Warnen, bevor die Wand kommt
// ============================================

let gewarnt = { tag: 0, monat: 0 };

function warnen(tagChf, monatChf) {
  for (const [name, wert, grenze] of [['tag', tagChf, GRENZE_TAG], ['monat', monatChf, GRENZE_MONAT]]) {
    const anteil = wert / grenze;

    if (anteil < 0.5) {
      gewarnt[name] = 0;   // neuer Tag oder Monat
      continue;
    }

    // Nur die HOECHSTE ueberschrittene Marke melden. Sonst standen
    // bei einem Sprung von 40 auf 95 Prozent drei Zeilen
    // untereinander im Log.
    const erreicht = [0.9, 0.75, 0.5].find((m) => anteil >= m);
    if (erreicht && gewarnt[name] < erreicht) {
      gewarnt[name] = erreicht;
      console.warn(
        `[kosten] ${name.toUpperCase()}: CHF ${wert.toFixed(2)} von ${grenze} ` +
        `(${Math.round(anteil * 100)} Prozent)`
      );
    }
  }
}

// ============================================
// Eine Zeile fuer das Log
// ============================================

async function bericht() {
  const s = await stand();
  if (!s.erreichbar) {
    return `[kosten] Datenbank nicht erreichbar - Notbetrieb, CHF ${notfallSumme().toFixed(2)} von ${notBudget().chf.toFixed(2)}`;
  }
  const offen = notfallSumme() > 0 ? ` | Notbetrieb offen: CHF ${notfallSumme().toFixed(2)}` : '';
  return (
    `[kosten] heute CHF ${s.tag.chf.toFixed(2)}/${GRENZE_TAG} (${s.tag.suchen} Suchen) | ` +
    `Monat CHF ${s.monat.chf.toFixed(2)}/${GRENZE_MONAT} (${s.monat.suchen} Suchen)${offen}`
  );
}

/**
 * Nur die Modellkosten verbuchen - fuer den Fall, dass die
 * Produkte aus dem Cache kamen und trotzdem neu bewertet wurde.
 * Geprueft wird hier nicht: der Betrag ist klein, und die naechste
 * Anfrage laeuft ohnehin wieder gegen den Deckel.
 */
async function bewertungBuchen({ istPremium = false } = {}) {
  const stufe = stufeFuer(!!istPremium);
  return nachbuchen({ istPremium, zusaetzlich: 1, echteKosten: LLM_PREIS[stufe] });
}

module.exports = {
  darfSuchen,
  nachbuchen,
  bewertungBuchen,
  stand,
  bericht,
  stufeFuer,
  preisFuer,
  GRENZEN: { tag: GRENZE_TAG, monat: GRENZE_MONAT, notfall: GRENZE_NOTFALL },
  PREIS,
  LLM_PREIS
};