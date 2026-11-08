// ============================================
// SYNORA - Kategorien Schweiz
// ============================================
// Das Geruest. Hier stehen KEINE Shops drin.
//
// Warum getrennt: Kategorien aendern sich fast nie, Shops staendig.
// Die Shops wachsen aus echten Suchen in die Datenbank hinein
// (siehe models/ShopEintrag.js). So steht nie ein erfundener oder
// laengst geschlossener Shop in deinen Empfehlungen.
//
// Jede Unterkategorie hat Suchbegriffe. Daraus erkennt SYNORA,
// worum es bei einer Anfrage geht, und ordnet neue Shops richtig ein.
// ============================================

'use strict';

const KATEGORIEN = {

  elektronik: {
    name: 'Elektronik',
    unter: {
      smartphones: ['handy', 'smartphone', 'iphone', 'samsung galaxy', 'tablet', 'ipad', 'huelle', 'ladekabel'],
      laptops: ['laptop', 'notebook', 'macbook', 'ultrabook', 'convertible', 'chromebook'],
      komponenten: ['grafikkarte', 'gpu', 'prozessor', 'cpu', 'mainboard', 'arbeitsspeicher', 'ram', 'ssd', 'festplatte', 'netzteil', 'gehaeuse', 'luefter'],
      monitore: ['monitor', 'bildschirm', 'display', 'beamer', 'projektor'],
      tv: ['fernseher', 'tv', 'oled', 'qled', 'soundbar', 'heimkino', 'streaming box'],
      audio: ['kopfhoerer', 'lautsprecher', 'hifi', 'plattenspieler', 'verstaerker', 'mikrofon', 'bluetooth box'],
      gaming: ['playstation', 'ps5', 'xbox', 'nintendo', 'switch', 'gaming maus', 'gaming tastatur', 'headset', 'gaming stuhl'],
      foto: ['kamera', 'objektiv', 'stativ', 'drohne', 'actioncam', 'gopro', 'blitz'],
      smarthome: ['smart home', 'alexa', 'google home', 'philips hue', 'thermostat', 'ueberwachungskamera', 'tuerklingel'],
      haushaltsgeraete: ['waschmaschine', 'kuehlschrank', 'geschirrspueler', 'backofen', 'staubsauger', 'saugroboter', 'kaffeemaschine', 'mikrowelle'],
      wearables: ['smartwatch', 'fitness tracker', 'apple watch', 'garmin', 'pulsuhr'],
      netzwerk: ['router', 'wlan', 'mesh', 'switch netzwerk', 'nas', 'powerline']
    }
  },

  mode: {
    name: 'Mode und Kleidung',
    unter: {
      damen: ['damenmode', 'kleid', 'bluse', 'rock', 'damenhose', 'damenjacke'],
      herren: ['herrenmode', 'hemd', 'anzug', 'herrenhose', 'herrenjacke', 'krawatte'],
      kinder: ['kindermode', 'kinderkleidung', 'babykleidung', 'schulkleidung'],
      schuhe: ['schuhe', 'sneaker', 'stiefel', 'sandalen', 'halbschuhe', 'wanderschuhe'],
      accessoires: ['guertel', 'muetze', 'schal', 'handschuhe', 'sonnenbrille'],
      waesche: ['unterwaesche', 'bh', 'socken', 'pyjama', 'bademode'],
      taschen: ['handtasche', 'rucksack', 'koffer', 'reisetasche', 'geldboerse']
    }
  },

  kosmetik: {
    name: 'Kosmetik und Pflege',
    unter: {
      parfuem: ['parfuem', 'duft', 'eau de parfum', 'eau de toilette'],
      hautpflege: ['hautpflege', 'creme', 'serum', 'gesichtspflege', 'sonnencreme', 'reinigung gesicht'],
      makeup: ['makeup', 'lippenstift', 'mascara', 'foundation', 'lidschatten', 'nagellack'],
      haarpflege: ['shampoo', 'conditioner', 'haarkur', 'haarfarbe', 'haartrockner', 'glaetteisen'],
      koerperpflege: ['duschgel', 'bodylotion', 'deo', 'zahnpflege', 'rasierer'],
      maennerpflege: ['bartpflege', 'rasur', 'aftershave', 'herrenpflege']
    }
  },

  moebel_wohnen: {
    name: 'Moebel und Wohnen',
    unter: {
      moebel: ['sofa', 'bett', 'tisch', 'stuhl', 'schrank', 'regal', 'buerostuhl'],
      matratzen: ['matratze', 'lattenrost', 'kissen', 'duvet', 'bettdecke'],
      kueche: ['pfanne', 'topf', 'geschirr', 'besteck', 'messer', 'kuechenmaschine'],
      bad: ['badezimmer', 'handtuch', 'duschvorhang', 'badmoebel'],
      textilien: ['vorhang', 'teppich', 'bettwaesche', 'kissenbezug'],
      licht: ['lampe', 'leuchte', 'led', 'stehlampe', 'deckenleuchte'],
      deko: ['bilderrahmen', 'vase', 'kerzen', 'wandbild', 'spiegel']
    }
  },

  sport_outdoor: {
    name: 'Sport und Outdoor',
    unter: {
      fitness: ['hantel', 'yogamatte', 'fitnessgeraet', 'laufband', 'heimtrainer'],
      laufen: ['laufschuhe', 'laufbekleidung', 'laufuhr'],
      wintersport: ['ski', 'snowboard', 'skischuhe', 'skibekleidung', 'helm ski'],
      bergsport: ['wanderschuhe', 'klettern', 'rucksack wandern', 'trekking', 'steigeisen'],
      wassersport: ['schwimmen', 'taucherbrille', 'neoprenanzug', 'sup', 'kajak'],
      teamsport: ['fussball', 'basketball', 'volleyball', 'handball', 'tennis'],
      camping: ['zelt', 'schlafsack', 'campingkocher', 'isomatte', 'campingstuhl']
    }
  },

  lebensmittel: {
    name: 'Lebensmittel und Getraenke',
    unter: {
      supermarkt: ['lebensmittel', 'einkauf', 'grundnahrungsmittel'],
      getraenke: ['mineralwasser', 'softdrink', 'saft', 'bier'],
      wein: ['wein', 'rotwein', 'weisswein', 'champagner', 'whisky', 'spirituosen'],
      kaffee: ['kaffee', 'kaffeebohnen', 'kapseln', 'tee'],
      spezialitaeten: ['delikatessen', 'kaese', 'schokolade', 'gewuerze'],
      bio: ['bio lebensmittel', 'vegan', 'glutenfrei', 'regional']
    }
  },

  bau_werkzeug: {
    name: 'Bau und Werkzeug',
    unter: {
      handwerkzeug: ['schraubenzieher', 'zange', 'hammer', 'saege', 'werkzeugkoffer'],
      elektrowerkzeug: ['bohrmaschine', 'akkuschrauber', 'schleifer', 'stichsaege', 'kreissaege'],
      baumaterial: ['holz', 'platten', 'zement', 'daemmung', 'gipskarton'],
      sanitaer: ['wasserhahn', 'dusche', 'wc', 'lavabo', 'rohr'],
      elektroinstallation: ['kabel', 'steckdose', 'schalter', 'sicherung', 'verteiler'],
      farben: ['farbe', 'lack', 'pinsel', 'rolle', 'grundierung'],
      befestigung: ['schrauben', 'duebel', 'naegel', 'kleber']
    }
  },

  auto_motorrad: {
    name: 'Auto und Motorrad',
    unter: {
      autoteile: ['bremsbelaege', 'batterie auto', 'scheibenwischer', 'filter auto', 'zuendkerzen'],
      reifen: ['reifen', 'winterreifen', 'sommerreifen', 'felgen'],
      zubehoer: ['dachtraeger', 'anhaengerkupplung', 'kindersitz auto', 'navigation'],
      pflege: ['autopflege', 'politur', 'autoshampoo', 'frostschutz'],
      motorrad: ['motorradhelm', 'motorradbekleidung', 'motorradteile']
    }
  },

  velo: {
    name: 'Velo und E-Bike',
    unter: {
      velos: ['velo', 'fahrrad', 'mountainbike', 'rennvelo', 'citybike'],
      ebikes: ['e-bike', 'elektrovelo', 'pedelec'],
      teile: ['velohelm', 'velopumpe', 'kette velo', 'bremsen velo', 'schlauch velo'],
      bekleidung: ['velobekleidung', 'velohose', 'velohandschuhe']
    }
  },

  spielwaren: {
    name: 'Spielwaren',
    unter: {
      bausteine: ['lego', 'playmobil', 'bausteine'],
      brettspiele: ['brettspiel', 'gesellschaftsspiel', 'puzzle', 'kartenspiel'],
      puppen: ['puppe', 'kuscheltier', 'barbie'],
      draussen: ['trampolin', 'schaukel', 'sandkasten', 'rutschbahn'],
      modellbau: ['modellbau', 'modelleisenbahn', 'rc auto', 'rc drohne']
    }
  },

  buecher_medien: {
    name: 'Buecher und Medien',
    unter: {
      buecher: ['buch', 'roman', 'sachbuch', 'kinderbuch', 'fachbuch'],
      ebooks: ['ebook', 'e-reader', 'kindle', 'hoerbuch'],
      film_musik: ['dvd', 'blu-ray', 'vinyl', 'schallplatte', 'cd'],
      games: ['videospiel', 'konsolenspiel', 'pc spiel']
    }
  },

  garten: {
    name: 'Garten',
    unter: {
      pflanzen: ['pflanzen', 'samen', 'blumenerde', 'duenger', 'zimmerpflanze'],
      gartenmoebel: ['gartenmoebel', 'gartenstuhl', 'sonnenschirm', 'hollywoodschaukel'],
      gartengeraete: ['rasenmaeher', 'heckenschere', 'laubblaeser', 'gartenschlauch', 'maehroboter'],
      grill: ['grill', 'gasgrill', 'holzkohlegrill', 'smoker', 'grillzubehoer'],
      teich_pool: ['pool', 'teich', 'poolpumpe', 'poolzubehoer']
    }
  },

  tierbedarf: {
    name: 'Tierbedarf',
    unter: {
      hund: ['hundefutter', 'hundeleine', 'hundebett', 'hundespielzeug'],
      katze: ['katzenfutter', 'katzenstreu', 'kratzbaum', 'katzenklo'],
      kleintiere: ['kaninchen', 'meerschweinchen', 'hamster', 'nagerfutter'],
      aquaristik: ['aquarium', 'fischfutter', 'aquarienpumpe', 'terrarium'],
      pferd: ['reitsport', 'sattel', 'pferdefutter', 'reithelm']
    }
  },

  buero_schule: {
    name: 'Buero und Schule',
    unter: {
      bueromaterial: ['ordner', 'papier', 'stifte', 'klebeband', 'notizbuch'],
      drucker: ['drucker', 'toner', 'tintenpatrone', 'scanner', 'etikettendrucker'],
      bueromoebel: ['schreibtisch', 'buerostuhl', 'rollcontainer', 'stehpult'],
      schule: ['schulranzen', 'etui', 'taschenrechner', 'schulmaterial']
    }
  },

  baby_kind: {
    name: 'Baby und Kind',
    unter: {
      kinderwagen: ['kinderwagen', 'buggy', 'tragetuch'],
      autositze: ['kindersitz', 'babyschale', 'sitzerhoehung'],
      babyausstattung: ['windeln', 'babyflasche', 'wickeltisch', 'babyphone', 'hochstuhl'],
      kinderzimmer: ['kinderbett', 'kindermoebel', 'gitterbett']
    }
  },

  gesundheit_apotheke: {
    name: 'Gesundheit und Apotheke',
    unter: {
      medikamente: ['medikament', 'schmerzmittel', 'erkaeltung', 'apotheke'],
      nahrungsergaenzung: ['vitamine', 'magnesium', 'protein', 'nahrungsergaenzung'],
      medizinprodukte: ['blutdruckmessgeraet', 'fieberthermometer', 'verbandsmaterial', 'inhalator'],
      optik: ['brille', 'kontaktlinsen', 'lesebrille'],
      hoergeraete: ['hoergeraet', 'gehoerschutz']
    }
  },

  schmuck_uhren: {
    name: 'Schmuck und Uhren',
    unter: {
      uhren: ['armbanduhr', 'herrenuhr', 'damenuhr'],
      luxusuhren: ['luxusuhr', 'rolex', 'omega', 'chronograph'],
      schmuck: ['kette', 'ring', 'ohrringe', 'armband'],
      trauringe: ['trauring', 'ehering', 'verlobungsring']
    }
  },

  musik_instrumente: {
    name: 'Musik und Instrumente',
    unter: {
      saiteninstrumente: ['gitarre', 'e-gitarre', 'bass', 'geige', 'ukulele'],
      tasten: ['klavier', 'keyboard', 'digitalpiano', 'synthesizer'],
      schlagwerk: ['schlagzeug', 'cajon', 'percussion'],
      studio: ['audio interface', 'studiomonitor', 'mischpult', 'studiomikrofon'],
      dj: ['dj controller', 'plattenspieler dj', 'dj mixer'],
      noten: ['noten', 'notenstaender', 'musikbuch']
    }
  },

  industrie_b2b: {
    name: 'Industrie und Geschaeftskunden',
    unter: {
      bauteile: ['widerstand', 'kondensator', 'halbleiter', 'mikrocontroller', 'platine', 'stecker', 'relais', 'transistor'],
      automation: ['sps', 'frequenzumrichter', 'sensor', 'aktor', 'servomotor'],
      messtechnik: ['multimeter', 'oszilloskop', 'netzteil labor', 'messgeraet'],
      arbeitsschutz: ['arbeitshandschuhe', 'schutzbrille', 'arbeitsschuhe', 'helm arbeit', 'warnweste'],
      c_teile: ['normteile', 'dichtungen', 'lager', 'antriebstechnik'],
      werkstatt: ['werkstattwagen', 'hebebuehne', 'druckluft', 'schweissgeraet'],
      lager_logistik: ['regalsystem', 'palette', 'transportwagen', 'verpackung']
    }
  }
};

// ============================================
// SUCHBEGRIFF -> KATEGORIE
// Wird einmal beim Start aus KATEGORIEN aufgebaut, nicht von Hand
// gepflegt. Eine neue Unterkategorie oben genuegt.
// ============================================

/**
 * Vereinheitlicht Text fuer den Vergleich.
 * Wichtig wegen der deutschen Mehrzahl mit Umlaut:
 * "Widerstand" -> "Widerstaende". Ohne diese Angleichung wuerde
 * die Mehrzahl nie gefunden.
 */
function normalisiere(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
}

const BEGRIFF_ZU_KATEGORIE = (() => {
  const karte = new Map();
  for (const [haupt, daten] of Object.entries(KATEGORIEN)) {
    for (const [unter, begriffe] of Object.entries(daten.unter)) {
      for (const b of begriffe) {
        karte.set(normalisiere(b), `${haupt}.${unter}`);
      }
      karte.set(normalisiere(unter), `${haupt}.${unter}`);
    }
    karte.set(normalisiere(haupt), haupt);
  }
  return karte;
})();

/**
 * Kategorie aus einer Anfrage erkennen.
 * Laengere Begriffe zuerst, damit "gaming maus" nicht als "gaming"
 * durchgeht und "laufschuhe" nicht als "schuhe".
 */
function kategorieErkennen(text) {
  if (!text) return null;
  const s = normalisiere(text);

  // Laengere Begriffe zuerst: "gaming maus" vor "gaming",
  // "laufschuhe" vor "schuhe"
  const begriffe = [...BEGRIFF_ZU_KATEGORIE.keys()].sort((a, b) => b.length - a.length);

  for (const b of begriffe) {
    const sicher = b.replace(/[.*+?^${}()|[\]\\]/g, (t) => "\\" + t);
    // Ganzes Wort, mit erlaubter deutscher Mehrzahl-Endung.
    // Ohne Wortgrenze wuerde "on" in "Conrad" greifen.
    const muster = new RegExp("(^|[^a-z0-9])" + sicher + "(e|en|n|s|er|es)?([^a-z0-9]|$)");
    if (muster.test(s)) return BEGRIFF_ZU_KATEGORIE.get(b);
  }

  return null;
}

/** Alle Kategoriepfade als flache Liste */
function alleKategorien() {
  const liste = [];
  for (const [haupt, daten] of Object.entries(KATEGORIEN)) {
    for (const unter of Object.keys(daten.unter)) {
      liste.push(`${haupt}.${unter}`);
    }
  }
  return liste;
}

function zahlen() {
  const haupt = Object.keys(KATEGORIEN).length;
  let unter = 0;
  let begriffe = 0;
  for (const d of Object.values(KATEGORIEN)) {
    unter += Object.keys(d.unter).length;
    for (const b of Object.values(d.unter)) begriffe += b.length;
  }
  return { haupt, unter, begriffe };
}

module.exports = {
  KATEGORIEN,
  normalisiere,
  BEGRIFF_ZU_KATEGORIE,
  kategorieErkennen,
  alleKategorien,
  zahlen
};

// ============================================
// TOLERANTER VERGLEICH  (angebaut am 08.11.2026)
// ============================================
// Der genaue Vergleich oben bleibt unveraendert und laeuft zuerst.
// Findet er nichts, wird hier ein bis zwei falsche Buchstaben verziehen.
//
// Warum ueberhaupt: in 40 echten Anfragen standen "playstiaion",
// "playstaion", "kopfhoehrer", "moniror", "ien monitor". Ein Buchstabe
// falsch, und die Kategorie war leer - damit keine passende Rueckfrage
// und keine Preisspanne zum Vergleich.
//
// Vier Bremsen gegen falsche Treffer:
//   1. erst ab 6 Buchstaben           ("stahl" trifft nicht "stuhl")
//   2. der erste Buchstabe muss stimmen ("fisch" trifft nicht "tisch")
//   3. 6-7 Zeichen: 1 Fehler, ab 8: 2 Fehler
//   4. bei Gleichstand zwischen zwei Kategorien: null statt raten
//
// Die 6 ist nicht geraten. Mit 5 ergab die Probe "stahl" -> moebel.wohnen,
// weil "stuhl" ein Zeichen entfernt ist. Mit 6 sind stahl/stuhl,
// fisch/tisch, maus/haus, hacke/jacke gesperrt - und alle echten
// Tippfehler aus dem Protokoll bleiben drin, der kuerzeste hat 7.

const TOLERANZ_MINDESTLAENGE = 6;

// Begriffe, die der tolerante Vergleich nicht anfassen darf. Bleibt
// vorerst leer. Zeigt die Selbstpruefung beim Einbau Paare an, die
// wirklich verwechselt werden koennen, kommen sie hier herein.
const TOLERANZ_AUSGENOMMEN = new Set([]);

function toleranzFuer(laenge) {
  if (laenge < TOLERANZ_MINDESTLAENGE) return 0;
  if (laenge <= 7) return 1;
  return 2;
}

// Nur einzelne Woerter. Mehrwortbegriffe wie "gaming monitor" bleiben
// dem genauen Vergleich, dort waere Raten zu unsicher.
const TOLERANZ_BEGRIFFE = [...BEGRIFF_ZU_KATEGORIE.keys()].filter(
  (b) => b.length >= TOLERANZ_MINDESTLAENGE
    && !/[^a-z0-9]/.test(b)
    && !TOLERANZ_AUSGENOMMEN.has(b)
);

// Levenshtein-Abstand mit Obergrenze: wie viele Buchstaben muessen
// eingefuegt, geloescht oder getauscht werden, um aus a b zu machen.
// Wird die Grenze ueberschritten, bricht die Rechnung ab und gibt null
// zurueck - das spart bei einigen hundert Begriffen fast alle Arbeit.
function abstand(a, b, grenze) {
  const n = a.length;
  const m = b.length;
  if (Math.abs(n - m) > grenze) return null;
  if (n === 0) return m <= grenze ? m : null;
  if (m === 0) return n <= grenze ? n : null;

  let vorher = new Array(m + 1);
  let jetzt = new Array(m + 1);
  for (let j = 0; j <= m; j++) vorher[j] = j;

  for (let i = 1; i <= n; i++) {
    jetzt[0] = i;
    let kleinster = jetzt[0];
    for (let j = 1; j <= m; j++) {
      const kosten = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      jetzt[j] = Math.min(vorher[j] + 1, jetzt[j - 1] + 1, vorher[j - 1] + kosten);
      if (jetzt[j] < kleinster) kleinster = jetzt[j];
    }
    // Keine Zelle dieser Zeile liegt noch unter der Grenze: es kann
    // nicht mehr besser werden.
    if (kleinster > grenze) return null;
    const tausch = vorher;
    vorher = jetzt;
    jetzt = tausch;
  }

  const d = vorher[m];
  return d <= grenze ? d : null;
}

// Sucht die Kategorie zu einem Text, bei dem der genaue Vergleich
// nichts gefunden hat. Gibt null zurueck, wenn nichts sicher passt.
function kategorieRaten(text) {
  if (!text) return null;
  const s = normalisiere(text);

  let beste = null;          // die Kategorie
  let besterBegriff = null;  // das richtig geschriebene Wort, fuer das Log
  let bestesWort = null;     // das falsch geschriebene Wort, fuer das Log
  let besterAbstand = 99;
  let gleichstand = false;

  const woerter = s.split(/[^a-z0-9]+/).filter((w) => w.length >= TOLERANZ_MINDESTLAENGE);

  for (const wort of woerter) {
    for (const begriff of TOLERANZ_BEGRIFFE) {
      // Bremse 2: der erste Buchstabe muss stimmen.
      if (wort.charCodeAt(0) !== begriff.charCodeAt(0)) continue;

      const erlaubt = toleranzFuer(Math.max(wort.length, begriff.length));
      if (erlaubt === 0) continue;

      const d = abstand(wort, begriff, erlaubt);
      if (d === null) continue;

      const kategorie = BEGRIFF_ZU_KATEGORIE.get(begriff);

      if (d < besterAbstand) {
        besterAbstand = d;
        beste = kategorie;
        besterBegriff = begriff;
        bestesWort = wort;
        gleichstand = false;
      } else if (d === besterAbstand && kategorie !== beste) {
        // Bremse 4: zwei verschiedene Kategorien passen gleich gut.
        gleichstand = true;
      }
    }
  }

  if (gleichstand) {
    console.log(`[kategorie] "${bestesWort}" passt auf mehrere Kategorien gleich gut - keine gewaehlt`);
    return null;
  }
  if (!beste) return null;

  console.log(`[kategorie] "${bestesWort}" ~ "${besterBegriff}" (${besterAbstand} Zeichen) -> ${beste}`);
  return beste;
}

// Der genaue Vergleich zuerst, der tolerante nur als Rueckfallebene.
// So kann die Aenderung nichts verschlechtern, was heute schon geht:
// wo bisher eine Kategorie herauskam, kommt dieselbe heraus.
const kategorieGenau = module.exports.kategorieErkennen;

module.exports.kategorieErkennen = function kategorieErkennenTolerant(text) {
  const genau = kategorieGenau(text);
  if (genau) return genau;
  return kategorieRaten(text);
};

module.exports.kategorieGenau = kategorieGenau;
module.exports.kategorieRaten = kategorieRaten;
module.exports.abstand = abstand;
