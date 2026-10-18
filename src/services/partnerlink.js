// ============================================
// SYNORA - aus einer Shop-URL einen Partnerlink machen
// ============================================
// EINGEBAUT AM 12.10.2026
//
// WAS DAS LOEST
// In go.js stand bisher:
//
//     // Hier kommt spaeter der AWIN-Link statt der direkten URL
//     return res.redirect(302, gewaehlt.store.link);
//
// Der Nutzer wurde also direkt zum Shop geschickt. Der Klick
// wurde gezaehlt, der Kauf fand statt - und SYNORA bekam nichts,
// weil im Link keine Partnerkennung stand. Dieselbe Luecke gab
// es bei den Preisalarm-Mails, dort ist sie seit dem 10.10.
// geschlossen.
//
// WARUM JETZT UND NICHT SPAETER
// Die Haendlernummern (awinmid) gibt es erst, wenn ein
// Partnerprogramm dich angenommen hat. Das dauert und liegt nach
// dem Code-Freeze vom 19.10. Darum steht die Mechanik jetzt
// schon - fertig und geprueft. Spaeter ist das Eintragen eines
// Haendlers EINE ZEILE in der Tabelle unten, kein neuer Code.
//
// ============================================
// SO TRAEGST DU EINEN HAENDLER EIN
// ============================================
// Sobald dich ein Programm angenommen hat:
//
//   1. Die Haendlernummer steht in der Adresszeile der
//      Profilseite:  ui.awin.com/merchant-profile/14040
//      -> 14040 ist die Nummer.
//
//   2. Unten bei PARTNER eine Zeile dazu, Kommentarzeichen weg.
//
//   3. Server neu starten. Fertig.
//
// Pruefen kannst du es mit:  node scripts/partnerlinkPruefen.js
// ============================================
'use strict';

// ============================================
// DEINE PUBLISHER-NUMMER
// ============================================
// Steht oben rechts in deinem Awin-Konto: SYNORA (2754082).
//
// Sie steht NICHT hier im Code, sondern in der .env. Nicht weil
// sie geheim waere - sie steht in jedem Link, den ein Besucher
// sieht - sondern damit du sie an einer Stelle aenderst, falls
// du je ein zweites Konto fuehrst.
//
// In die .env eintragen:
//     AWIN_AFFID=2754082
//
// Fehlt sie, gibt diese Datei einfach die unveraenderte Shop-URL
// zurueck. Lieber ein Link ohne Provision als ein kaputter Link.
const AWIN_AFFID = (process.env.AWIN_AFFID || '').trim();

// ============================================
// DIE HAENDLERTABELLE
// ============================================
// Schluessel ist die Domain OHNE www. Passt auch auf
// Unterdomains: "mediamarkt.ch" trifft auch
// "shop.mediamarkt.ch".
//
// netz:  'awin' oder 'adtraction'
// mid:   bei Awin die Haendlernummer (awinmid)
// ziel:  bei Adtraction die fertige Trackinglink-Vorlage
//
// ALLES AUSKOMMENTIERT, WEIL NOCH KEIN PROGRAMM ZUGESAGT HAT.
// Eine Nummer hier einzutragen, bei der du nicht angenommen
// bist, bringt keine Provision und kann als Missbrauch gewertet
// werden. Erst die Zusage, dann die Zeile.
const PARTNER = {
  // ---- Awin: eintragen, sobald die Zusage da ist ----
  // 'mediamarkt.ch':  { netz: 'awin', mid: 14040 },
  // 'conrad.ch':      { netz: 'awin', mid: 11467 },
  // 'samsung.com':    { netz: 'awin', mid: 31367 },
  // 'fnac.ch':        { netz: 'awin', mid: 22577 },
  // 'jelmoli-shop.ch':{ netz: 'awin', mid: 13726 },

  // ---- Adtraction: Linkvorlage aus deren "Create link" ----
  // Dort bekommst du einen fertigen Link. Den Teil VOR der
  // Ziel-URL hier eintragen, die Ziel-URL haengt SYNORA an.
  // 'fust.ch': { netz: 'adtraction', ziel: 'https://track.adtraction.com/t/t?a=0000000000&as=0000000000&t=2&tk=1&url=' }
};

// ============================================
// Domain aus einer URL holen
// ============================================
function domainAus(url) {
  try {
    const host = new URL(String(url)).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch (_) {
    return '';
  }
}

// ============================================
// Den passenden Eintrag finden
// ============================================
// Erst exakt, dann als Endung - damit "shop.mediamarkt.ch" auf
// den Eintrag "mediamarkt.ch" trifft, aber "nichtmediamarkt.ch"
// NICHT. Darum der Punkt vor der Domain.
function eintragFuer(domain) {
  if (!domain) return null;
  if (PARTNER[domain]) return PARTNER[domain];

  for (const schluessel of Object.keys(PARTNER)) {
    if (domain.endsWith('.' + schluessel)) return PARTNER[schluessel];
  }
  return null;
}

// ============================================
// DIE EINE FUNKTION, DIE GO.JS AUFRUFT
// ============================================
// Gibt IMMER eine brauchbare URL zurueck:
//
//   - Haendler in der Tabelle und alles gesetzt -> Partnerlink
//   - sonst                                     -> die Original-URL
//
// Nie null, nie ein Fehler. Ein Besucher, der auf "Zum Shop"
// drueckt, muss beim Shop landen - auch wenn an der Provision
// etwas nicht stimmt. Geld zu verlieren ist aergerlich; einen
// Nutzer ins Leere zu schicken ist schlimmer.
function partnerLink(zielUrl, shopName) {
  if (!zielUrl || typeof zielUrl !== 'string') return zielUrl;

  const domain = domainAus(zielUrl);
  const eintrag = eintragFuer(domain);

  if (!eintrag) {
    // Kein Programm fuer diesen Shop. Das ist der Normalfall und
    // kein Fehler - SYNORA zeigt ausdruecklich auch Haendler ohne
    // Partnerprogramm, und das steht so im Impressum.
    //
    // Protokolliert wird es trotzdem: Wenn in deinem Log immer
    // derselbe Shop auftaucht, weisst du, bei welchem Programm
    // sich eine Bewerbung am meisten lohnt.
    if (domain) console.log(`[partnerlink] ohne Provision: ${domain}${shopName ? ' (' + shopName + ')' : ''}`);
    return zielUrl;
  }

  if (eintrag.netz === 'awin') {
    if (!AWIN_AFFID) {
      console.warn(`[partnerlink] ${domain} steht in der Tabelle, aber AWIN_AFFID fehlt in der .env - Link geht ohne Provision raus`);
      return zielUrl;
    }
    if (!eintrag.mid) {
      console.warn(`[partnerlink] ${domain}: Eintrag ohne mid - Link geht ohne Provision raus`);
      return zielUrl;
    }
    return 'https://www.awin1.com/cread.php'
      + `?awinmid=${encodeURIComponent(String(eintrag.mid))}`
      + `&awinaffid=${encodeURIComponent(AWIN_AFFID)}`
      + `&ued=${encodeURIComponent(zielUrl)}`;
  }

  if (eintrag.netz === 'adtraction') {
    if (!eintrag.ziel) {
      console.warn(`[partnerlink] ${domain}: Adtraction-Eintrag ohne Vorlage - Link geht ohne Provision raus`);
      return zielUrl;
    }
    return eintrag.ziel + encodeURIComponent(zielUrl);
  }

  console.warn(`[partnerlink] ${domain}: unbekanntes Netzwerk "${eintrag.netz}"`);
  return zielUrl;
}

// ============================================
// Fuer die Pruefung und fuer das Dashboard
// ============================================
function istPartner(zielUrl) {
  return !!eintragFuer(domainAus(zielUrl));
}

function partnerListe() {
  return Object.keys(PARTNER).map((d) => ({ domain: d, ...PARTNER[d] }));
}

module.exports = partnerLink;
module.exports.partnerLink = partnerLink;
module.exports.istPartner = istPartner;
module.exports.partnerListe = partnerListe;
module.exports.domainAus = domainAus;
module.exports._PARTNER = PARTNER;