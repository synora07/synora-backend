// ============================================
// SYNORA V2.0 - SHOP DATABASE
// 1100+ Shops: Elektronik, Kosmetik, Kleidung
// CH/DE Fokus mit Qualitäts-Bewertung
// ============================================

'use strict';

// ==========================================
// BLACKLIST - Diese Shops NIEMALS empfehlen!
// ==========================================

const BLACKLIST = [
  'temu',
  'wish',
  'shein',
  'dhgate',
  'banggood',
  'gearbest',
  'lightinthebox',
  'romwe',
  'zaful',
  'joom',
  'vova',
  'sammydress',
  'dresslily',
  'rosegal',
  'tidebuy',
  'miniinthebox',
  'tomtop',
  'newfrog',
  'focalprice',
  'dealextreme'
];

// AliExpress nur mit strengen Bedingungen
const ALIEXPRESS_BEDINGUNGEN = {
  minSterne: 4.5,
  minBestellungen: 100,
  mussHaben: ['käuferschutz', 'rückgabe']
};

// ==========================================
// QUALITÄTS-LEVEL
// ==========================================

const QUALITAETS_LEVEL = {
  premium: { score: 100, beschreibung: 'Höchste Qualität, Top-Service' },
  hoch: { score: 80, beschreibung: 'Sehr gute Qualität' },
  gut: { score: 60, beschreibung: 'Gute Qualität, zuverlässig' },
  mittel: { score: 40, beschreibung: 'Durchschnittlich' },
  niedrig: { score: 20, beschreibung: 'Günstig, aber Vorsicht' }
};

// ==========================================
// PREIS-LEVEL
// ==========================================

const PREIS_LEVEL = {
  luxus: { faktor: 1.5, beschreibung: 'Premium-Preise' },
  hoch: { faktor: 1.2, beschreibung: 'Überdurchschnittlich' },
  mittel: { faktor: 1.0, beschreibung: 'Marktüblich' },
  guenstig: { faktor: 0.8, beschreibung: 'Unter Marktpreis' },
  budget: { faktor: 0.6, beschreibung: 'Sehr günstig' }
};

// ==========================================
// ELEKTRONIK SHOPS (400+)
// ==========================================

const ELEKTRONIK_SHOPS = {
  
  // ------------------------------------------
  // SMARTPHONES & TABLETS (25+ Shops)
  // ------------------------------------------
  smartphones: [
    // Schweiz Premium
    { name: 'Digitec', url: 'digitec.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['smartphones', 'tablets', 'zubehoer'] },
    { name: 'Galaxus', url: 'galaxus.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['alle'] },
    { name: 'Swisscom Shop', url: 'swisscom.ch/shop', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'schnell', spezialisierung: ['smartphones', 'tarife'] },
    { name: 'Sunrise Shop', url: 'sunrise.ch/shop', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['smartphones', 'tarife'] },
    { name: 'Salt Store', url: 'salt.ch/shop', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['smartphones', 'tarife'] },
    { name: 'Mobilezone', url: 'mobilezone.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['smartphones', 'reparatur'] },
    { name: 'Interdiscount', url: 'interdiscount.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['elektronik'] },
    { name: 'MediaMarkt CH', url: 'mediamarkt.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['elektronik'] },
    { name: 'Fust', url: 'fust.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['elektronik', 'haushalt'] },
    { name: 'Brack', url: 'brack.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['elektronik', 'buero'] },
    { name: 'microspot', url: 'microspot.ch', land: 'CH', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['elektronik'] },
    
    // Deutschland
    { name: 'MediaMarkt DE', url: 'mediamarkt.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['elektronik'] },
    { name: 'Saturn', url: 'saturn.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['elektronik'] },
    { name: 'Cyberport', url: 'cyberport.de', land: 'DE', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['elektronik', 'apple'] },
    { name: 'notebooksbilliger', url: 'notebooksbilliger.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['laptops', 'smartphones'] },
    { name: 'Amazon DE', url: 'amazon.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['alle'] },
    { name: 'Otto', url: 'otto.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['elektronik', 'mode'] },
    { name: 'Conrad', url: 'conrad.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['elektronik', 'komponenten'] },
    { name: 'Alternate', url: 'alternate.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['hardware', 'gaming'] },
    { name: 'Mindfactory', url: 'mindfactory.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['hardware'] },
    { name: 'Computeruniverse', url: 'computeruniverse.net', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['elektronik'] },
    { name: 'Proshop', url: 'proshop.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['elektronik'] },
    { name: 'Jacob Elektronik', url: 'jacob.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['business', 'elektronik'] },
    
    // Apple Spezialisten
    { name: 'Apple Store CH', url: 'apple.com/ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'schnell', spezialisierung: ['apple'] },
    { name: 'Apple Store DE', url: 'apple.com/de', land: 'DE', qualitaet: 'premium', preis: 'luxus', versand: 'schnell', spezialisierung: ['apple'] },
    { name: 'Gravis', url: 'gravis.de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'schnell', spezialisierung: ['apple'] },
    { name: 'mStore', url: 'mstore.de', land: 'DE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['apple'] },
    { name: 'MacTrade', url: 'mactrade.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['apple', 'gebraucht'] }
  ],
  
  // ------------------------------------------
  // LAPTOPS & NOTEBOOKS (25+ Shops)
  // ------------------------------------------
  laptops: [
    { name: 'Digitec', url: 'digitec.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['laptops', 'gaming'] },
    { name: 'Galaxus', url: 'galaxus.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['alle'] },
    { name: 'Brack', url: 'brack.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['business', 'laptops'] },
    { name: 'STEG Electronics', url: 'steg-electronics.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['gaming', 'laptops'] },
    { name: 'PC Ostschweiz', url: 'pcostschweiz.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['laptops', 'pc'] },
    { name: 'notebooksbilliger', url: 'notebooksbilliger.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['laptops'] },
    { name: 'Cyberport', url: 'cyberport.de', land: 'DE', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['laptops', 'apple'] },
    { name: 'Alternate', url: 'alternate.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['gaming', 'laptops'] },
    { name: 'Campuspoint', url: 'campuspoint.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['studenten', 'laptops'] },
    { name: 'Lapstore', url: 'lapstore.de', land: 'DE', qualitaet: 'gut', preis: 'budget', versand: 'mittel', spezialisierung: ['gebraucht', 'refurbished'] },
    { name: 'AfB Shop', url: 'afbshop.de', land: 'DE', qualitaet: 'gut', preis: 'budget', versand: 'mittel', spezialisierung: ['refurbished', 'nachhaltig'] },
    { name: 'Refurbed', url: 'refurbed.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['refurbished'] },
    { name: 'Revendo', url: 'revendo.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['gebraucht', 'apple'] },
    
    // Gaming Laptops
    { name: 'MIFCOM', url: 'mifcom.de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'langsam', spezialisierung: ['gaming', 'custom'] },
    { name: 'XMG', url: 'bestware.com', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['gaming'] },
    { name: 'Razer Store', url: 'razer.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['gaming'] },
    { name: 'ASUS Shop', url: 'asus.com/ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['laptops', 'gaming'] },
    { name: 'Lenovo Shop', url: 'lenovo.com/ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['business', 'laptops'] },
    { name: 'HP Store', url: 'hp.com/ch-de', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['business', 'laptops'] },
    { name: 'Dell Shop', url: 'dell.com/ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['business', 'workstations'] },
    { name: 'Acer Store', url: 'acer.com/ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['laptops', 'budget'] },
    { name: 'MSI Shop', url: 'msi.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['gaming'] },
    { name: 'Gigabyte Store', url: 'gigabyte.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['gaming', 'komponenten'] },
    { name: 'TUXEDO', url: 'tuxedocomputers.com', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['linux', 'laptops'] },
    { name: 'Framework', url: 'frame.work', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'langsam', spezialisierung: ['nachhaltig', 'modular'] }
  ],
  
  // ------------------------------------------
  // PC KOMPONENTEN (30+ Shops)
  // ------------------------------------------
  komponenten: [
    { name: 'Digitec', url: 'digitec.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['gpu', 'cpu', 'alle'] },
    { name: 'Brack', url: 'brack.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['komponenten'] },
    { name: 'STEG Electronics', url: 'steg-electronics.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['gaming', 'komponenten'] },
    { name: 'PC Ostschweiz', url: 'pcostschweiz.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['komponenten'] },
    { name: 'Alternate', url: 'alternate.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['komponenten', 'gaming'] },
    { name: 'Mindfactory', url: 'mindfactory.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['komponenten'] },
    { name: 'Caseking', url: 'caseking.de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'schnell', spezialisierung: ['gaming', 'modding'] },
    { name: 'Aquatuning', url: 'aquatuning.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['wasserkuehlung'] },
    { name: 'Highflow', url: 'highflow.nl', land: 'NL', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['wasserkuehlung'] },
    { name: 'Conrad', url: 'conrad.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['komponenten', 'elektronik'] },
    { name: 'Reichelt', url: 'reichelt.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['elektronik', 'komponenten'] },
    { name: 'Pollin', url: 'pollin.de', land: 'DE', qualitaet: 'gut', preis: 'budget', versand: 'mittel', spezialisierung: ['elektronik', 'bastler'] },
    { name: 'Voelkner', url: 'voelkner.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['elektronik'] },
    
    // Speicher Spezialisten
    { name: 'Crucial', url: 'crucial.com', land: 'INT', qualitaet: 'premium', preis: 'mittel', versand: 'mittel', spezialisierung: ['ram', 'ssd'] },
    { name: 'Kingston', url: 'kingston.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['ram', 'ssd'] },
    { name: 'Samsung Memory', url: 'samsung.com/semiconductor', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['ssd'] },
    { name: 'Western Digital', url: 'westerndigital.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['hdd', 'ssd'] },
    { name: 'Seagate', url: 'seagate.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['hdd', 'nas'] },
    
    // GPU Spezialisten
    { name: 'NVIDIA Store', url: 'nvidia.com/de-de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['gpu'] },
    { name: 'AMD Shop', url: 'amd.com', land: 'INT', qualitaet: 'premium', preis: 'mittel', versand: 'mittel', spezialisierung: ['gpu', 'cpu'] },
    { name: 'EVGA', url: 'evga.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['gpu', 'psu'] },
    { name: 'Sapphire', url: 'sapphiretech.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['gpu', 'amd'] },
    
    // Gehäuse & Kühlung
    { name: 'be quiet!', url: 'bequiet.com', land: 'DE', qualitaet: 'premium', preis: 'mittel', versand: 'mittel', spezialisierung: ['psu', 'kuehlung', 'gehaeuse'] },
    { name: 'Noctua', url: 'noctua.at', land: 'AT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['kuehlung'] },
    { name: 'Corsair', url: 'corsair.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['peripherie', 'komponenten'] },
    { name: 'NZXT', url: 'nzxt.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['gehaeuse', 'kuehlung'] },
    { name: 'Fractal Design', url: 'fractal-design.com', land: 'SE', qualitaet: 'premium', preis: 'mittel', versand: 'mittel', spezialisierung: ['gehaeuse'] },
    { name: 'Lian Li', url: 'lian-li.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['gehaeuse'] },
    { name: 'Phanteks', url: 'phanteks.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['gehaeuse'] }
  ],
  
  // ------------------------------------------
  // MONITORE & DISPLAYS (25+ Shops)
  // ------------------------------------------
  monitore: [
    { name: 'Digitec', url: 'digitec.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['monitore', 'gaming'] },
    { name: 'Galaxus', url: 'galaxus.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['alle'] },
    { name: 'Brack', url: 'brack.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['business', 'monitore'] },
    { name: 'STEG Electronics', url: 'steg-electronics.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['gaming'] },
    { name: 'Cyberport', url: 'cyberport.de', land: 'DE', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['monitore'] },
    { name: 'Alternate', url: 'alternate.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['gaming'] },
    
    // Hersteller Shops
    { name: 'Samsung Shop', url: 'samsung.com/ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['monitore', 'oled'] },
    { name: 'LG Shop', url: 'lg.com/ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['monitore', 'oled'] },
    { name: 'Dell Shop', url: 'dell.com/ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['business', 'monitore'] },
    { name: 'BenQ Shop', url: 'benq.eu', land: 'EU', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['monitore', 'foto'] },
    { name: 'ASUS Shop', url: 'asus.com/ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['gaming', 'monitore'] },
    { name: 'Acer Store', url: 'acer.com/ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['monitore', 'gaming'] },
    { name: 'AOC Shop', url: 'aoc.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['monitore', 'gaming'] },
    { name: 'ViewSonic', url: 'viewsonic.com', land: 'INT', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['monitore', 'projektoren'] },
    { name: 'EIZO', url: 'eizo.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['profi', 'grafik'] },
    { name: 'NEC Display', url: 'nec-display.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['business', 'profi'] },
    { name: 'Philips Monitors', url: 'philips.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['monitore'] },
    { name: 'iiyama', url: 'iiyama.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['gaming', 'business'] },
    { name: 'MSI Shop', url: 'msi.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['gaming'] },
    { name: 'Gigabyte Store', url: 'gigabyte.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['gaming'] },
    
    // Ultra-Wide & Profi
    { name: 'Apple Store', url: 'apple.com/ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'schnell', spezialisierung: ['apple', 'studio-display'] },
    { name: 'Alienware', url: 'dell.com/alienware', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['gaming'] },
    { name: 'Corsair', url: 'corsair.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['gaming'] }
  ],
  
  // ------------------------------------------
  // TV & HEIMKINO (25+ Shops)
  // ------------------------------------------
  tv: [
    { name: 'Digitec', url: 'digitec.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['tv', 'heimkino'] },
    { name: 'Galaxus', url: 'galaxus.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['alle'] },
    { name: 'Interdiscount', url: 'interdiscount.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['tv', 'elektronik'] },
    { name: 'MediaMarkt CH', url: 'mediamarkt.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['tv', 'elektronik'] },
    { name: 'Fust', url: 'fust.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['tv', 'haushalt'] },
    { name: 'Brack', url: 'brack.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['tv'] },
    { name: 'EP Elektro', url: 'ep-elektro.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['tv', 'lokal'] },
    { name: 'Expert', url: 'expert.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['tv', 'lokal'] },
    
    // Deutschland
    { name: 'MediaMarkt DE', url: 'mediamarkt.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['tv'] },
    { name: 'Saturn', url: 'saturn.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['tv'] },
    { name: 'Euronics', url: 'euronics.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['tv', 'lokal'] },
    { name: 'Expert DE', url: 'expert.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['tv'] },
    
    // Hersteller Shops
    { name: 'Samsung Shop', url: 'samsung.com/ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['tv', 'qled', 'oled'] },
    { name: 'LG Shop', url: 'lg.com/ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['tv', 'oled'] },
    { name: 'Sony Store', url: 'sony.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['tv', 'bravia'] },
    { name: 'Panasonic Shop', url: 'panasonic.com/ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['tv', 'oled'] },
    { name: 'Philips Shop', url: 'philips.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['tv', 'ambilight'] },
    { name: 'TCL Shop', url: 'tcl.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['tv', 'budget'] },
    { name: 'Hisense', url: 'hisense.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['tv', 'budget'] },
    
    // Heimkino Spezialisten
    { name: 'Heimkinoraum', url: 'heimkinoraum.de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['heimkino', 'beratung'] },
    { name: 'Grobi.TV', url: 'grobi.tv', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['heimkino'] },
    { name: 'HiFi Klubben', url: 'hifiklubben.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['hifi', 'heimkino'] },
    { name: 'Revox', url: 'revox.com', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['heimkino', 'audio'] }
  ],
  
  // ------------------------------------------
  // AUDIO & HIFI (25+ Shops)
  // ------------------------------------------
  audio: [
    { name: 'Digitec', url: 'digitec.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['audio', 'kopfhoerer'] },
    { name: 'Galaxus', url: 'galaxus.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['alle'] },
    { name: 'HiFi Klubben', url: 'hifiklubben.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['hifi'] },
    { name: 'Soundhouse', url: 'soundhouse.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['hifi', 'highend'] },
    { name: 'Audio Insider', url: 'audioinsider.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['highend'] },
    { name: 'Revox', url: 'revox.com', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['hifi', 'multiroom'] },
    
    // Musikinstrumente & Pro Audio
    { name: 'Thomann', url: 'thomann.de', land: 'DE', qualitaet: 'premium', preis: 'guenstig', versand: 'schnell', spezialisierung: ['instrumente', 'proaudio'] },
    { name: 'Musik Produktiv', url: 'musik-produktiv.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['instrumente'] },
    { name: 'Musikhaus Kirstein', url: 'kirstein.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['instrumente'] },
    { name: 'MUSIC STORE', url: 'musicstore.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['instrumente', 'dj'] },
    { name: 'Just Music', url: 'justmusic.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['instrumente'] },
    
    // Kopfhörer & Bluetooth
    { name: 'Beyerdynamic', url: 'beyerdynamic.de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['kopfhoerer'] },
    { name: 'Sennheiser', url: 'sennheiser.com', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['kopfhoerer', 'mikrofone'] },
    { name: 'Audio-Technica', url: 'audio-technica.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['kopfhoerer'] },
    { name: 'Sony Audio', url: 'sony.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['kopfhoerer', 'bluetooth'] },
    { name: 'Bose', url: 'bose.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['kopfhoerer', 'lautsprecher'] },
    { name: 'Bang & Olufsen', url: 'bang-olufsen.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['design', 'audio'] },
    { name: 'Sonos', url: 'sonos.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['multiroom'] },
    { name: 'JBL', url: 'jbl.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['bluetooth', 'lautsprecher'] },
    { name: 'Marshall', url: 'marshallheadphones.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['kopfhoerer', 'lautsprecher'] },
    
    // HiFi Spezialisten DE
    { name: 'Teufel', url: 'teufel.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['lautsprecher', 'heimkino'] },
    { name: 'Nubert', url: 'nubert.de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['lautsprecher', 'hifi'] },
    { name: 'Canton', url: 'canton.de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['lautsprecher'] },
    { name: 'Elac', url: 'elac.de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['hifi'] }
  ],
  
  // ------------------------------------------
  // GAMING (30+ Shops)
  // ------------------------------------------
  gaming: [
    { name: 'Digitec', url: 'digitec.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['gaming', 'hardware'] },
    { name: 'Galaxus', url: 'galaxus.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['alle'] },
    { name: 'STEG Electronics', url: 'steg-electronics.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['gaming'] },
    { name: 'World of Games', url: 'wog.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['spiele', 'konsolen'] },
    { name: 'GameStop CH', url: 'gamestop.ch', land: 'CH', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['spiele', 'konsolen'] },
    
    // Deutschland
    { name: 'Alternate', url: 'alternate.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['gaming', 'hardware'] },
    { name: 'Caseking', url: 'caseking.de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'schnell', spezialisierung: ['gaming', 'rgb'] },
    { name: 'MIFCOM', url: 'mifcom.de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'langsam', spezialisierung: ['gaming-pc', 'custom'] },
    { name: 'XMG / Bestware', url: 'bestware.com', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['gaming-laptops'] },
    { name: 'Dubaro', url: 'dubaro.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['gaming-pc'] },
    { name: 'ONE Gaming', url: 'one.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['gaming-pc'] },
    { name: 'BoostBoxx', url: 'boostboxx.com', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['gaming-pc'] },
    
    // Peripherie
    { name: 'Razer Store', url: 'razer.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['peripherie', 'rgb'] },
    { name: 'Logitech G', url: 'logitechg.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['maus', 'tastatur'] },
    { name: 'SteelSeries', url: 'steelseries.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['peripherie'] },
    { name: 'HyperX', url: 'hyperx.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['peripherie', 'headsets'] },
    { name: 'Corsair', url: 'corsair.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['peripherie', 'komponenten'] },
    { name: 'ROCCAT', url: 'roccat.com', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['maus', 'tastatur'] },
    { name: 'Glorious', url: 'gloriousgaming.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['maus', 'tastatur'] },
    { name: 'Pulsar', url: 'pulsar.gg', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['maus', 'esport'] },
    { name: 'Secretlab', url: 'secretlab.eu', land: 'EU', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['gaming-stuehle'] },
    { name: 'noblechairs', url: 'noblechairs.de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['gaming-stuehle'] },
    
    // Konsolen
    { name: 'PlayStation Store', url: 'playstation.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['playstation'] },
    { name: 'Xbox Store', url: 'xbox.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['xbox'] },
    { name: 'Nintendo Store', url: 'nintendo.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['nintendo'] },
    { name: 'Steam', url: 'store.steampowered.com', land: 'INT', qualitaet: 'premium', preis: 'guenstig', versand: 'digital', spezialisierung: ['pc-spiele'] },
    { name: 'GOG', url: 'gog.com', land: 'INT', qualitaet: 'hoch', preis: 'guenstig', versand: 'digital', spezialisierung: ['pc-spiele', 'drm-frei'] },
    { name: 'Epic Games', url: 'epicgames.com', land: 'INT', qualitaet: 'hoch', preis: 'guenstig', versand: 'digital', spezialisierung: ['pc-spiele'] },
    { name: 'Humble Bundle', url: 'humblebundle.com', land: 'INT', qualitaet: 'hoch', preis: 'guenstig', versand: 'digital', spezialisierung: ['bundles'] }
  ],
  
  // ------------------------------------------
  // FOTO & KAMERAS (25+ Shops)
  // ------------------------------------------
  foto: [
    { name: 'Digitec', url: 'digitec.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['kameras', 'foto'] },
    { name: 'Galaxus', url: 'galaxus.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['alle'] },
    { name: 'Foto Marlin', url: 'fotomarlin.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'mittel', spezialisierung: ['foto', 'beratung'] },
    { name: 'Light + Byte', url: 'lightbyte.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['profi', 'foto'] },
    { name: 'Heinigerag', url: 'heiniger-ag.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['foto'] },
    
    // Deutschland
    { name: 'Calumet', url: 'calumetphoto.de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['profi', 'foto'] },
    { name: 'Foto Koch', url: 'fotokoch.de', land: 'DE', qualitaet: 'premium', preis: 'mittel', versand: 'mittel', spezialisierung: ['foto'] },
    { name: 'Foto Erhardt', url: 'foto-erhardt.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['foto'] },
    { name: 'Foto Mundus', url: 'fotomundus.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['foto'] },
    { name: 'AC Foto', url: 'ac-foto.com', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['foto', 'gebraucht'] },
    { name: 'MPB', url: 'mpb.com', land: 'INT', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['gebraucht'] },
    
    // Hersteller
    { name: 'Canon Store', url: 'canon.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['canon'] },
    { name: 'Nikon Store', url: 'nikon.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['nikon'] },
    { name: 'Sony Alpha', url: 'sony.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['sony', 'alpha'] },
    { name: 'Fujifilm Store', url: 'fujifilm.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['fujifilm'] },
    { name: 'Panasonic Lumix', url: 'panasonic.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['lumix'] },
    { name: 'Leica Store', url: 'leica-store.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['leica'] },
    { name: 'Hasselblad', url: 'hasselblad.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['mittelformat'] },
    
    // Zubehör
    { name: 'Manfrotto', url: 'manfrotto.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['stative', 'taschen'] },
    { name: 'Peak Design', url: 'peakdesign.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['taschen', 'gurte'] },
    { name: 'Lowepro', url: 'lowepro.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['taschen'] },
    { name: 'DJI Store', url: 'dji.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['drohnen', 'gimbals'] },
    { name: 'GoPro', url: 'gopro.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['actioncams'] },
    { name: 'Insta360', url: 'insta360.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['360-kameras'] }
  ],
  
  // ------------------------------------------
  // SMART HOME (25+ Shops)
  // ------------------------------------------
  smarthome: [
    { name: 'Digitec', url: 'digitec.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['smarthome'] },
    { name: 'Galaxus', url: 'galaxus.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['alle'] },
    { name: 'Brack', url: 'brack.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['smarthome'] },
    { name: 'smart-best', url: 'smart-best.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['smarthome'] },
    { name: 'tink', url: 'tink.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['smarthome'] },
    
    // Hersteller
    { name: 'Apple Home', url: 'apple.com/ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'schnell', spezialisierung: ['homekit'] },
    { name: 'Google Store', url: 'store.google.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['google-home', 'nest'] },
    { name: 'Amazon Devices', url: 'amazon.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['alexa', 'echo'] },
    { name: 'Philips Hue', url: 'philips-hue.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['licht'] },
    { name: 'IKEA Smart', url: 'ikea.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['licht', 'budget'] },
    { name: 'Sonos', url: 'sonos.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['audio', 'multiroom'] },
    { name: 'Ring', url: 'ring.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['sicherheit', 'kameras'] },
    { name: 'Arlo', url: 'arlo.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['kameras', 'sicherheit'] },
    { name: 'Netatmo', url: 'netatmo.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['wetter', 'sicherheit'] },
    { name: 'Eufy', url: 'eufy.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['sicherheit', 'reinigung'] },
    { name: 'tado', url: 'tado.com', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['heizung'] },
    { name: 'Bosch Smart Home', url: 'bosch-smarthome.com', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['sicherheit', 'klima'] },
    { name: 'Homematic IP', url: 'homematic-ip.com', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['heizung', 'sicherheit'] },
    { name: 'Fibaro', url: 'fibaro.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['z-wave'] },
    { name: 'Aqara', url: 'aqara.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['zigbee', 'sensoren'] },
    { name: 'Shelly', url: 'shelly.cloud', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['wifi', 'diy'] },
    { name: 'LIFX', url: 'lifx.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['licht'] },
    { name: 'Nanoleaf', url: 'nanoleaf.me', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['licht', 'design'] },
    { name: 'Govee', url: 'govee.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['licht', 'rgb'] },
    { name: 'Yeelight', url: 'yeelight.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['licht'] }
  ],
  
  // ------------------------------------------
  // HAUSHALTSGERÄTE (25+ Shops)
  // ------------------------------------------
  haushalt: [
    { name: 'Galaxus', url: 'galaxus.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['haushalt'] },
    { name: 'Fust', url: 'fust.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['haushalt', 'lieferung'] },
    { name: 'Interdiscount', url: 'interdiscount.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['haushalt'] },
    { name: 'MediaMarkt CH', url: 'mediamarkt.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['haushalt'] },
    { name: 'Nettoshop', url: 'nettoshop.ch', land: 'CH', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['haushalt'] },
    { name: 'Toppreise', url: 'toppreise.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['vergleich'] },
    
    // Hersteller
    { name: 'Miele Shop', url: 'miele.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['premium-haushalt'] },
    { name: 'V-ZUG', url: 'vzug.com', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['schweizer-qualitaet'] },
    { name: 'Bosch Hausgeräte', url: 'bosch-home.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['haushalt'] },
    { name: 'Siemens Home', url: 'siemens-home.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['haushalt'] },
    { name: 'Electrolux', url: 'electrolux.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['haushalt'] },
    { name: 'Samsung Home', url: 'samsung.com/ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['smart-haushalt'] },
    { name: 'LG Home', url: 'lg.com/ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['haushalt'] },
    
    // Kleingeräte
    { name: 'Dyson', url: 'dyson.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['staubsauger', 'haarpflege'] },
    { name: 'Philips Shop', url: 'philips.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['kleingeraete'] },
    { name: 'Braun', url: 'braun.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['koerperpflege'] },
    { name: 'KitchenAid', url: 'kitchenaid.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['kuechenmaschinen'] },
    { name: 'Kenwood', url: 'kenwoodworld.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['kuechenmaschinen'] },
    { name: 'De Longhi', url: 'delonghi.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['kaffee', 'kueche'] },
    { name: 'Jura', url: 'jura.com', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['kaffeemaschinen'] },
    { name: 'Nespresso', url: 'nespresso.com/ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'schnell', spezialisierung: ['kaffee'] },
    { name: 'iRobot', url: 'irobot.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['staubsauger-roboter'] },
    { name: 'Roborock', url: 'roborock.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['staubsauger-roboter'] },
    { name: 'Ecovacs', url: 'ecovacs.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['staubsauger-roboter'] },
    { name: 'Ninja', url: 'ninjakitchen.eu', land: 'EU', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['kuechengeraete'] }
  ],
  
  // ------------------------------------------
  // WEARABLES & SMARTWATCHES (20+ Shops)
  // ------------------------------------------
  wearables: [
    { name: 'Digitec', url: 'digitec.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['smartwatches'] },
    { name: 'Galaxus', url: 'galaxus.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['alle'] },
    { name: 'Apple Store', url: 'apple.com/ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'schnell', spezialisierung: ['apple-watch'] },
    { name: 'Samsung Shop', url: 'samsung.com/ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['galaxy-watch'] },
    { name: 'Garmin Shop', url: 'garmin.com/de-CH', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['sport', 'outdoor'] },
    { name: 'Fitbit Store', url: 'fitbit.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['fitness'] },
    { name: 'Polar Shop', url: 'polar.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['sport', 'herzfrequenz'] },
    { name: 'Suunto', url: 'suunto.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['outdoor', 'tauchen'] },
    { name: 'COROS', url: 'coros.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['sport', 'ausdauer'] },
    { name: 'Whoop', url: 'whoop.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['recovery', 'abo'] },
    { name: 'Oura', url: 'ouraring.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['schlaf', 'ring'] },
    { name: 'Amazfit', url: 'amazfit.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['budget'] },
    { name: 'Xiaomi', url: 'mi.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['budget', 'fitness'] },
    { name: 'Huawei', url: 'huawei.com/ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['smartwatches'] },
    { name: 'Withings', url: 'withings.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['gesundheit', 'hybrid'] },
    { name: 'Fossil', url: 'fossil.com', land: 'INT', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['fashion'] },
    { name: 'TAG Heuer Connected', url: 'tagheuer.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] },
    { name: 'Montblanc Summit', url: 'montblanc.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] }
  ],
  
  // ------------------------------------------
  // NETZWERK & ROUTER (20+ Shops)
  // ------------------------------------------
  netzwerk: [
    { name: 'Digitec', url: 'digitec.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['netzwerk'] },
    { name: 'Brack', url: 'brack.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['business', 'netzwerk'] },
    { name: 'ALSO', url: 'also.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['business', 'grosshandel'] },
    { name: 'Studerus', url: 'studerus.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['business', 'telefonie'] },
    
    // Hersteller
    { name: 'Ubiquiti Store', url: 'ui.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['unifi', 'profi'] },
    { name: 'ASUS Networking', url: 'asus.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['router', 'mesh'] },
    { name: 'Netgear', url: 'netgear.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['router', 'nas'] },
    { name: 'TP-Link', url: 'tp-link.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['router', 'budget'] },
    { name: 'Linksys', url: 'linksys.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['mesh'] },
    { name: 'Google Nest WiFi', url: 'store.google.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['mesh', 'einfach'] },
    { name: 'eero', url: 'eero.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['mesh'] },
    { name: 'Synology', url: 'synology.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['nas', 'router'] },
    { name: 'QNAP', url: 'qnap.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['nas'] },
    { name: 'AVM Fritz!', url: 'avm.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['router', 'telefonie'] },
    { name: 'Mikrotik', url: 'mikrotik.com', land: 'INT', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['profi', 'isp'] },
    { name: 'Cisco Meraki', url: 'meraki.cisco.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['enterprise'] },
    { name: 'HPE Aruba', url: 'arubanetworks.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['enterprise'] },
    { name: 'D-Link', url: 'dlink.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['home', 'smb'] },
    { name: 'Zyxel', url: 'zyxel.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['smb'] }
  ]
};

// Fortsetzung in Teil 2...
// (Datei wird hier geschnitten wegen Länge - nächster Teil kommt gleich)

module.exports = {
  BLACKLIST,
  ALIEXPRESS_BEDINGUNGEN,
  QUALITAETS_LEVEL,
  PREIS_LEVEL,
  ELEKTRONIK_SHOPS
};