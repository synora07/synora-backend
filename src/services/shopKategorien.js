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