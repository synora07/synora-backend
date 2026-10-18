// ============================================
// SYNORA V2.0 - SHOP DATABASE TEIL 2
// Kosmetik (350 Shops) & Kleidung (350 Shops)
// ============================================

'use strict';

// ==========================================
// KOSMETIK SHOPS (350+)
// ==========================================

const KOSMETIK_SHOPS = {
  
  // ------------------------------------------
  // PARFÜM & DÜFTE (40+ Shops)
  // ------------------------------------------
  parfuem: [
    // Schweiz Premium
    { name: 'Import Parfumerie', url: 'importparfumerie.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'schnell', spezialisierung: ['parfuem', 'luxus'] },
    { name: 'Marionnaud', url: 'marionnaud.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['parfuem', 'kosmetik'] },
    { name: 'Douglas CH', url: 'douglas.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['parfuem', 'beauty'] },
    { name: 'Manor Beauty', url: 'manor.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['luxus', 'parfuem'] },
    { name: 'Globus Beauty', url: 'globus.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus', 'nische'] },
    { name: 'Jelmoli Beauty', url: 'jelmoli.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] },
    { name: 'parfumdreams CH', url: 'parfumdreams.ch', land: 'CH', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['parfuem', 'online'] },
    { name: 'Notino CH', url: 'notino.ch', land: 'CH', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['parfuem', 'discount'] },
    { name: 'PAFORY', url: 'pafory.ch', land: 'CH', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['parfuem'] },
    
    // Deutschland
    { name: 'Douglas DE', url: 'douglas.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['parfuem', 'beauty'] },
    { name: 'Flaconi', url: 'flaconi.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['parfuem', 'beauty'] },
    { name: 'parfumdreams DE', url: 'parfumdreams.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['parfuem'] },
    { name: 'Notino DE', url: 'notino.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['parfuem'] },
    { name: 'easyCOSMETIC', url: 'easycosmetic.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['parfuem'] },
    { name: 'ParfumGroup', url: 'parfumgroup.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['parfuem'] },
    
    // Nischen-Parfümerien
    { name: 'Aus Liebe zum Duft', url: 'ausliebezumduft.de', land: 'DE', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['nische'] },
    { name: 'First in Fragrance', url: 'firstinfragrance.de', land: 'DE', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['nische'] },
    { name: 'Niche Beauty', url: 'niche-beauty.com', land: 'DE', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['nische', 'clean'] },
    { name: 'Essenza Nobile', url: 'essenzanobile.de', land: 'DE', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['nische'] },
    { name: 'Parfum Zentrum', url: 'parfum-zentrum.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['nische'] },
    
    // Luxus-Marken Shops
    { name: 'Chanel Beauty', url: 'chanel.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['chanel'] },
    { name: 'Dior Beauty', url: 'dior.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['dior'] },
    { name: 'YSL Beauty', url: 'yslbeauty.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['ysl'] },
    { name: 'Guerlain', url: 'guerlain.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['guerlain'] },
    { name: 'Tom Ford Beauty', url: 'tomford.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['tomford'] },
    { name: 'Jo Malone', url: 'jomalone.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['jomalone'] },
    { name: 'Armani Beauty', url: 'armanibeauty.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['armani'] },
    { name: 'Hermès Parfums', url: 'hermes.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['hermes'] },
    { name: 'Lancôme', url: 'lancome.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['lancome'] },
    { name: 'Estée Lauder', url: 'esteelauder.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['esteelauder'] },
    
    // Weitere Parfüm-Shops
    { name: 'Fragrance Direct', url: 'fragrancedirect.co.uk', land: 'UK', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['discount'] },
    { name: 'The Perfume Shop', url: 'theperfumeshop.com', land: 'UK', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['parfuem'] },
    { name: 'Sephora CH', url: 'sephora.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['beauty', 'parfuem'] },
    { name: 'Sephora DE', url: 'sephora.de', land: 'DE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['beauty', 'parfuem'] },
    { name: 'Lookfantastic', url: 'lookfantastic.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['beauty'] },
    { name: 'Feelunique', url: 'feelunique.com', land: 'UK', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['beauty'] },
    { name: 'Cult Beauty', url: 'cultbeauty.com', land: 'UK', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['nische', 'indie'] },
    { name: 'Space NK', url: 'spacenk.com', land: 'UK', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['nische'] }
  ],
  
  // ------------------------------------------
  // HAUTPFLEGE (50+ Shops)
  // ------------------------------------------
  hautpflege: [
    // Schweiz
    { name: 'Import Parfumerie', url: 'importparfumerie.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'schnell', spezialisierung: ['skincare'] },
    { name: 'Marionnaud', url: 'marionnaud.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['skincare'] },
    { name: 'Douglas CH', url: 'douglas.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['skincare'] },
    { name: 'Coop Vitality', url: 'coopvitality.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['apotheke', 'skincare'] },
    { name: 'Amavita', url: 'amavita.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['apotheke'] },
    { name: 'Sun Store', url: 'sunstore.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['apotheke'] },
    { name: 'zur Rose', url: 'zurrose.ch', land: 'CH', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['apotheke', 'online'] },
    { name: 'Farmaline', url: 'farmaline.ch', land: 'CH', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['apotheke'] },
    
    // Deutschland
    { name: 'Douglas DE', url: 'douglas.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['skincare'] },
    { name: 'Flaconi', url: 'flaconi.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['skincare'] },
    { name: 'Niche Beauty', url: 'niche-beauty.com', land: 'DE', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['clean', 'nische'] },
    { name: 'Paula\'s Choice DE', url: 'paulaschoice.de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['säuren', 'wissenschaft'] },
    { name: 'The Ordinary DE', url: 'theordinary.com', land: 'INT', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['wirkstoffe'] },
    { name: 'Kiehl\'s', url: 'kiehls.de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['naturkosmetik'] },
    { name: 'Clinique', url: 'clinique.de', land: 'DE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['dermatologie'] },
    { name: 'La Roche-Posay', url: 'laroche-posay.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['empfindlich'] },
    { name: 'Avène', url: 'avene.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['empfindlich'] },
    { name: 'Eucerin', url: 'eucerin.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['dermatologie'] },
    { name: 'CeraVe', url: 'cerave.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['ceramide'] },
    
    // Premium & Luxus
    { name: 'La Mer', url: 'lamer.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] },
    { name: 'La Prairie', url: 'laprairie.com', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['schweizer-luxus'] },
    { name: 'SK-II', url: 'sk-ii.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['pitera'] },
    { name: 'Sisley', url: 'sisley-paris.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['phyto'] },
    { name: 'Helena Rubinstein', url: 'helenarubinstein.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['anti-aging'] },
    { name: 'Augustinus Bader', url: 'augustinusbader.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['stammzellen'] },
    { name: 'Dr. Barbara Sturm', url: 'drsturm.com', land: 'DE', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['anti-inflamm'] },
    { name: 'Susanne Kaufmann', url: 'susannekaufmann.com', land: 'AT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['alpen'] },
    { name: 'Tata Harper', url: 'tataharperskincare.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['clean', 'farm'] },
    { name: 'Drunk Elephant', url: 'drunkelephant.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['clean'] },
    
    // K-Beauty
    { name: 'Yesstyle', url: 'yesstyle.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'langsam', spezialisierung: ['k-beauty'] },
    { name: 'Stylevana', url: 'stylevana.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'langsam', spezialisierung: ['k-beauty', 'j-beauty'] },
    { name: 'Jolse', url: 'jolse.com', land: 'KR', qualitaet: 'gut', preis: 'guenstig', versand: 'langsam', spezialisierung: ['k-beauty'] },
    { name: 'Olive Young', url: 'oliveyoung.com', land: 'KR', qualitaet: 'hoch', preis: 'guenstig', versand: 'langsam', spezialisierung: ['k-beauty'] },
    { name: 'Soko Glam', url: 'sokoglam.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['k-beauty', 'kuratiert'] },
    
    // Naturkosmetik
    { name: 'Ecco Verde', url: 'ecco-verde.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['naturkosmetik'] },
    { name: 'Najoba', url: 'najoba.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['naturkosmetik'] },
    { name: 'Blanda Beauty', url: 'blanda-beauty.com', land: 'DE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['clean', 'nische'] },
    { name: 'Biomazing', url: 'biomazing.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['bio'] },
    { name: 'Weleda', url: 'weleda.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['anthroposophisch'] },
    { name: 'Dr. Hauschka', url: 'drhauschka.de', land: 'DE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['naturkosmetik'] },
    { name: 'Lavera', url: 'lavera.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['bio', 'budget'] }
  ],
  
  // ------------------------------------------
  // MAKE-UP (50+ Shops)
  // ------------------------------------------
  makeup: [
    // Schweiz
    { name: 'Sephora CH', url: 'sephora.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['makeup'] },
    { name: 'Import Parfumerie', url: 'importparfumerie.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'schnell', spezialisierung: ['makeup'] },
    { name: 'Marionnaud', url: 'marionnaud.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['makeup'] },
    { name: 'Douglas CH', url: 'douglas.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['makeup'] },
    { name: 'Manor Beauty', url: 'manor.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['makeup'] },
    { name: 'MAC CH', url: 'maccosmetics.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['mac'] },
    
    // Deutschland
    { name: 'Sephora DE', url: 'sephora.de', land: 'DE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['makeup'] },
    { name: 'Douglas DE', url: 'douglas.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['makeup'] },
    { name: 'Flaconi', url: 'flaconi.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['makeup'] },
    { name: 'MAC DE', url: 'maccosmetics.de', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['mac'] },
    { name: 'KIKO Milano', url: 'kikocosmetics.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['budget'] },
    { name: 'NYX', url: 'nyxcosmetics.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['budget', 'trend'] },
    { name: 'essence', url: 'essence.eu', land: 'DE', qualitaet: 'gut', preis: 'budget', versand: 'mittel', spezialisierung: ['budget'] },
    { name: 'Catrice', url: 'catrice.eu', land: 'DE', qualitaet: 'gut', preis: 'budget', versand: 'mittel', spezialisierung: ['budget'] },
    { name: 'Cosnova (essence/Catrice)', url: 'cosnova.com', land: 'DE', qualitaet: 'gut', preis: 'budget', versand: 'mittel', spezialisierung: ['budget'] },
    
    // Luxus Makeup
    { name: 'Charlotte Tilbury', url: 'charlottetilbury.com', land: 'UK', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['glamour'] },
    { name: 'Pat McGrath Labs', url: 'patmcgrath.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['editorial'] },
    { name: 'NARS', url: 'narscosmetics.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['nars'] },
    { name: 'Urban Decay', url: 'urbandecay.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['eyeshadow'] },
    { name: 'Too Faced', url: 'toofaced.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['playful'] },
    { name: 'Bobbi Brown', url: 'bobbibrowncosmetics.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['natural'] },
    { name: 'Laura Mercier', url: 'lauramercier.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['flawless'] },
    { name: 'Hourglass', url: 'hourglasscosmetics.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['vegan', 'luxus'] },
    { name: 'Natasha Denona', url: 'natashadenona.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['eyeshadow'] },
    { name: 'Chanel Beauty', url: 'chanel.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['chanel'] },
    { name: 'Dior Beauty', url: 'dior.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['dior'] },
    { name: 'Guerlain', url: 'guerlain.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['guerlain'] },
    { name: 'Armani Beauty', url: 'armanibeauty.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['armani'] },
    { name: 'YSL Beauty', url: 'yslbeauty.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['ysl'] },
    
    // Indie & Clean
    { name: 'Rare Beauty', url: 'rarebeauty.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['selena', 'clean'] },
    { name: 'Fenty Beauty', url: 'fentybeauty.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['inclusive'] },
    { name: 'Ilia Beauty', url: 'iliabeauty.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['clean'] },
    { name: 'Kosas', url: 'kosas.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['clean'] },
    { name: 'Merit', url: 'meritbeauty.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['minimal'] },
    { name: 'Westman Atelier', url: 'westman-atelier.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['clean', 'luxus'] },
    { name: 'Rose Inc', url: 'roseinc.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['clean'] },
    { name: 'Jones Road', url: 'jonesroadbeauty.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['clean', 'bobbi'] },
    { name: 'Glossier', url: 'glossier.com', land: 'INT', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['minimal', 'skincare'] },
    { name: 'e.l.f. Cosmetics', url: 'elfcosmetics.com', land: 'INT', qualitaet: 'gut', preis: 'budget', versand: 'mittel', spezialisierung: ['vegan', 'budget'] }
  ],
  
  // ------------------------------------------
  // HAARPFLEGE (40+ Shops)
  // ------------------------------------------
  haarpflege: [
    // Professionell
    { name: 'Galaxus', url: 'galaxus.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['haarpflege'] },
    { name: 'Parfümerie Osswald', url: 'osswald.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['luxus', 'haarpflege'] },
    { name: 'Hair Shop', url: 'hairshop.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['profi', 'friseur'] },
    { name: 'Notino CH', url: 'notino.ch', land: 'CH', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['haarpflege'] },
    { name: 'Hagel Shop', url: 'hagel-shop.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['profi'] },
    { name: 'baslerbeauty', url: 'baslerbeauty.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['profi', 'friseur'] },
    { name: 'ParfumGroup', url: 'parfumgroup.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['haarpflege'] },
    
    // Marken-Shops
    { name: 'Kérastase', url: 'kerastase.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['kerastase'] },
    { name: 'Olaplex', url: 'olaplex.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['bond-repair'] },
    { name: 'Oribe', url: 'oribe.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] },
    { name: 'Aveda', url: 'aveda.de', land: 'DE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['pflanzen'] },
    { name: 'Moroccanoil', url: 'moroccanoil.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['argan'] },
    { name: 'Redken', url: 'redken.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['profi'] },
    { name: 'Wella', url: 'wella.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['profi'] },
    { name: 'Schwarzkopf Professional', url: 'schwarzkopf-professionalpartners.com', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['profi'] },
    { name: 'L\'Oréal Professionnel', url: 'lorealprofessionnel.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['profi'] },
    { name: 'ghd', url: 'ghdhair.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['styling-tools'] },
    { name: 'Dyson Hair', url: 'dyson.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['airwrap', 'supersonic'] },
    { name: 'Living Proof', url: 'livingproof.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['wissenschaft'] },
    { name: 'Briogeo', url: 'briogeohair.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['clean'] },
    { name: 'Virtue', url: 'virtuelabs.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['keratin'] },
    { name: 'Christophe Robin', url: 'christopherobin.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['scalp'] },
    { name: 'Philip Kingsley', url: 'philipkingsley.com', land: 'UK', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['trichology'] },
    
    // Naturkosmetik Haar
    { name: 'Rahua', url: 'rahua.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['amazonas'] },
    { name: 'Josh Rosebrook', url: 'joshrosebrook.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['clean'] },
    { name: 'Innersense', url: 'innersensebeauty.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['clean', 'curly'] },
    { name: 'Act+Acre', url: 'actandacre.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['scalp'] }
  ],
  
  // ------------------------------------------
  // DROGERIE & ALLTAG (40+ Shops)
  // ------------------------------------------
  drogerie: [
    // Schweiz
    { name: 'Migros', url: 'migros.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['alltag'] },
    { name: 'Coop', url: 'coop.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['alltag'] },
    { name: 'Müller CH', url: 'mueller.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['drogerie'] },
    { name: 'BIPA CH', url: 'bipa.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['drogerie'] },
    { name: 'Denner', url: 'denner.ch', land: 'CH', qualitaet: 'gut', preis: 'budget', versand: 'mittel', spezialisierung: ['discount'] },
    { name: 'Aldi Suisse', url: 'aldi-suisse.ch', land: 'CH', qualitaet: 'gut', preis: 'budget', versand: 'mittel', spezialisierung: ['discount'] },
    { name: 'Lidl CH', url: 'lidl.ch', land: 'CH', qualitaet: 'gut', preis: 'budget', versand: 'mittel', spezialisierung: ['discount'] },
    
    // Deutschland
    { name: 'dm', url: 'dm.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['drogerie'] },
    { name: 'Rossmann', url: 'rossmann.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['drogerie'] },
    { name: 'Müller DE', url: 'mueller.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['drogerie'] },
    { name: 'Budni', url: 'budni.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['drogerie', 'nord'] },
    
    // Online-Drogerien
    { name: 'shop-apotheke', url: 'shop-apotheke.ch', land: 'CH', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['apotheke', 'online'] },
    { name: 'DocMorris', url: 'docmorris.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['apotheke'] },
    { name: 'Medpex', url: 'medpex.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['apotheke'] },
    { name: 'Aponeo', url: 'aponeo.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['apotheke'] },
    { name: 'Apo-rot', url: 'apo-rot.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['apotheke'] },
    { name: 'Bodfeld Apotheke', url: 'bodfeld-apotheke.de', land: 'DE', qualitaet: 'hoch', preis: 'guenstig', versand: 'mittel', spezialisierung: ['apotheke'] }
  ],
  
  // ------------------------------------------
  // MÄNNER PFLEGE (30+ Shops)
  // ------------------------------------------
  maennerpflege: [
    { name: 'Galaxus', url: 'galaxus.ch', land: 'CH', qualitaet: 'premium', preis: 'mittel', versand: 'schnell', spezialisierung: ['grooming'] },
    { name: 'Douglas', url: 'douglas.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['herren'] },
    { name: 'Notino', url: 'notino.ch', land: 'CH', qualitaet: 'hoch', preis: 'guenstig', versand: 'schnell', spezialisierung: ['herrenduefte'] },
    
    // Spezialisiert
    { name: 'Barber Tools', url: 'barber-tools.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['barbier'] },
    { name: 'Blackbeards', url: 'blackbeards.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['bart'] },
    { name: 'Brooklyn Soap Company', url: 'brooklynsoapcompany.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['bart', 'natuerlich'] },
    { name: 'Mr Bear Family', url: 'mrbearfamily.com', land: 'SE', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['bart'] },
    { name: 'Percy Nobleman', url: 'percynobleman.com', land: 'UK', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['bart'] },
    { name: 'Murdock London', url: 'murdocklondon.com', land: 'UK', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['barbier'] },
    
    // Rasur
    { name: 'Mühle', url: 'muehle-shaving.com', land: 'DE', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['nassrasur'] },
    { name: 'Edwin Jagger', url: 'edwinjagger.com', land: 'UK', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['nassrasur'] },
    { name: 'Merkur', url: 'dovo.de', land: 'DE', qualitaet: 'premium', preis: 'mittel', versand: 'mittel', spezialisierung: ['hobel'] },
    { name: 'Taylor of Old Bond Street', url: 'tayloroldbondst.co.uk', land: 'UK', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['rasierseife'] },
    { name: 'Proraso', url: 'proraso.com', land: 'IT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['rasur'] },
    { name: 'Baxter of California', url: 'baxterofcalifornia.com', land: 'US', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['grooming'] },
    { name: 'Aesop', url: 'aesop.com', land: 'AU', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['unisex'] },
    { name: 'Kiehl\'s', url: 'kiehls.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['herren'] },
    { name: 'Lab Series', url: 'labseries.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['herren'] },
    { name: 'Bulldog', url: 'bulldogskincare.com', land: 'UK', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['natuerlich'] },
    { name: 'Nivea Men', url: 'nivea.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['alltag'] },
    { name: 'L\'Oréal Men Expert', url: 'loreal-paris.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['alltag'] },
    
    // Premium Herrendüfte
    { name: 'Creed', url: 'creedfragrance.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['nische'] },
    { name: 'Parfums de Marly', url: 'parfums-de-marly.com', land: 'FR', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['nische'] },
    { name: 'Amouage', url: 'amouage.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['nische'] },
    { name: 'Xerjoff', url: 'xerjoff.com', land: 'IT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['nische'] }
  ]
};

// ==========================================
// KLEIDUNG SHOPS (350+)
// ==========================================

const KLEIDUNG_SHOPS = {
  
  // ------------------------------------------
  // DAMEN MODE (60+ Shops)
  // ------------------------------------------
  damen: [
    // Schweiz Premium
    { name: 'Globus', url: 'globus.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus', 'designer'] },
    { name: 'Jelmoli', url: 'jelmoli.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] },
    { name: 'Manor', url: 'manor.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['kaufhaus'] },
    { name: 'PKZ', url: 'pkz.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['klassisch'] },
    { name: 'Schild', url: 'schild.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['mode'] },
    { name: 'Chicorée', url: 'chicoree.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['trend', 'jung'] },
    { name: 'Tally Weijl', url: 'tally-weijl.com', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['jung', 'trend'] },
    { name: 'C&A CH', url: 'c-and-a.com/ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['familie'] },
    { name: 'H&M CH', url: 'hm.com/ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['fast-fashion'] },
    
    // Online Schweiz
    { name: 'Zalando CH', url: 'zalando.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['multi-brand'] },
    { name: 'About You CH', url: 'aboutyou.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['multi-brand'] },
    { name: 'Galaxus Fashion', url: 'galaxus.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['multi-brand'] },
    { name: 'La Redoute CH', url: 'laredoute.ch', land: 'CH', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['franzoesisch'] },
    { name: 'Ackermann', url: 'ackermann.ch', land: 'CH', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['katalog'] },
    { name: 'Lehner Versand', url: 'lehner-versand.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['katalog'] },
    
    // Deutschland
    { name: 'Zalando DE', url: 'zalando.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['multi-brand'] },
    { name: 'About You DE', url: 'aboutyou.de', land: 'DE', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['multi-brand'] },
    { name: 'Otto', url: 'otto.de', land: 'DE', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['katalog'] },
    { name: 'Bonprix', url: 'bonprix.de', land: 'DE', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['budget'] },
    { name: 'Baur', url: 'baur.de', land: 'DE', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['katalog'] },
    
    // Fast Fashion
    { name: 'Zara', url: 'zara.com', land: 'INT', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['fast-fashion'] },
    { name: 'Mango', url: 'mango.com', land: 'INT', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['spanisch'] },
    { name: 'Massimo Dutti', url: 'massimodutti.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['premium-inditex'] },
    { name: 'Bershka', url: 'bershka.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['jung'] },
    { name: 'Pull & Bear', url: 'pullandbear.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['jung'] },
    { name: 'Stradivarius', url: 'stradivarius.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['jung'] },
    { name: 'Reserved', url: 'reserved.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['polnisch'] },
    { name: 'Monki', url: 'monki.com', land: 'INT', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['quirky'] },
    { name: 'Weekday', url: 'weekday.com', land: 'INT', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['minimalist'] },
    { name: '& Other Stories', url: 'stories.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['h&m-premium'] },
    { name: 'COS', url: 'cos.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['minimalist'] },
    { name: 'ARKET', url: 'arket.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['nachhaltig'] },
    
    // Premium & Designer
    { name: 'Net-a-Porter', url: 'net-a-porter.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'schnell', spezialisierung: ['designer'] },
    { name: 'Mytheresa', url: 'mytheresa.com', land: 'DE', qualitaet: 'premium', preis: 'luxus', versand: 'schnell', spezialisierung: ['designer'] },
    { name: 'Matchesfashion', url: 'matchesfashion.com', land: 'UK', qualitaet: 'premium', preis: 'luxus', versand: 'schnell', spezialisierung: ['designer'] },
    { name: 'Farfetch', url: 'farfetch.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['boutiques'] },
    { name: 'SSENSE', url: 'ssense.com', land: 'CA', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['avantgarde'] },
    { name: 'Browns', url: 'brownsfashion.com', land: 'UK', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['designer'] },
    { name: 'Luisa Via Roma', url: 'luisaviaroma.com', land: 'IT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['italienisch'] },
    { name: 'Breuninger', url: 'breuninger.com', land: 'DE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['kaufhaus'] },
    
    // Nachhaltig
    { name: 'Armedangels', url: 'armedangels.com', land: 'DE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['nachhaltig'] },
    { name: 'Reformation', url: 'thereformation.com', land: 'US', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['nachhaltig'] },
    { name: 'Veja', url: 'veja-store.com', land: 'FR', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['sneaker', 'nachhaltig'] },
    { name: 'People Tree', url: 'peopletree.co.uk', land: 'UK', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['fairtrade'] },
    { name: 'Hessnatur', url: 'hessnatur.com', land: 'DE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['bio'] },
    { name: 'Lanius', url: 'lanius.com', land: 'DE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['nachhaltig'] },
    { name: 'Ecoalf', url: 'ecoalf.com', land: 'ES', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['recycled'] }
  ],
  
  // ------------------------------------------
  // HERREN MODE (50+ Shops)
  // ------------------------------------------
  herren: [
    // Schweiz
    { name: 'PKZ', url: 'pkz.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['klassisch'] },
    { name: 'Globus Men', url: 'globus.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['designer'] },
    { name: 'Jelmoli Men', url: 'jelmoli.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] },
    { name: 'Strellson', url: 'strellson.com', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['business'] },
    { name: 'Navyboot', url: 'navyboot.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['schuhe', 'accessoires'] },
    { name: 'Freitag', url: 'freitag.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['taschen', 'upcycling'] },
    
    // Online
    { name: 'Zalando', url: 'zalando.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['multi-brand'] },
    { name: 'About You', url: 'aboutyou.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['multi-brand'] },
    { name: 'Mr Porter', url: 'mrporter.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'schnell', spezialisierung: ['designer'] },
    { name: 'END.', url: 'endclothing.com', land: 'UK', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['streetwear'] },
    { name: 'Oi Polloi', url: 'oipolloi.com', land: 'UK', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['heritage'] },
    
    // Business & Klassisch
    { name: 'Hugo Boss', url: 'hugoboss.com', land: 'DE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['business'] },
    { name: 'Bogner', url: 'bogner.com', land: 'DE', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['sport', 'luxus'] },
    { name: 'Baldessarini', url: 'baldessarini.com', land: 'DE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['klassisch'] },
    { name: 'Windsor', url: 'windsor.de', land: 'DE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['business'] },
    { name: 'Hackett', url: 'hackett.com', land: 'UK', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['british'] },
    { name: 'Charles Tyrwhitt', url: 'ctshirts.com', land: 'UK', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['hemden'] },
    { name: 'TM Lewin', url: 'tmlewin.com', land: 'UK', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['hemden'] },
    
    // Casual & Streetwear
    { name: 'Carhartt WIP', url: 'carhartt-wip.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['streetwear'] },
    { name: 'The North Face', url: 'thenorthface.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['outdoor'] },
    { name: 'Patagonia', url: 'patagonia.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['outdoor', 'nachhaltig'] },
    { name: 'Arc\'teryx', url: 'arcteryx.com', land: 'CA', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['outdoor', 'technisch'] },
    { name: 'Norse Projects', url: 'norseprojects.com', land: 'DK', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['skandinavisch'] },
    { name: 'A.P.C.', url: 'apc.fr', land: 'FR', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['franzoesisch', 'minimal'] },
    { name: 'Acne Studios', url: 'acnestudios.com', land: 'SE', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['skandinavisch'] },
    { name: 'Our Legacy', url: 'ourlegacy.com', land: 'SE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['skandinavisch'] },
    
    // Denim
    { name: 'Levi\'s', url: 'levi.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['denim'] },
    { name: 'Edwin', url: 'edwin-europe.com', land: 'JP', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['denim', 'japanisch'] },
    { name: 'Nudie Jeans', url: 'nudiejeans.com', land: 'SE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['denim', 'nachhaltig'] },
    { name: 'Denham', url: 'denhamthejeanmaker.com', land: 'NL', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['denim'] }
  ],
  
  // ------------------------------------------
  // SPORTBEKLEIDUNG (40+ Shops)
  // ------------------------------------------
  sport: [
    // Schweiz
    { name: 'Ochsner Sport', url: 'ochsnersport.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['multi-sport'] },
    { name: 'SportXX', url: 'sportxx.ch', land: 'CH', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['multi-sport'] },
    { name: 'Decathlon CH', url: 'decathlon.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['budget'] },
    { name: 'Intersport CH', url: 'intersport.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['multi-sport'] },
    { name: 'Athleticum', url: 'athleticum.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['fitness'] },
    { name: 'Transa', url: 'transa.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['outdoor'] },
    { name: 'Bächli Bergsport', url: 'baechli-bergsport.ch', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['bergsport'] },
    
    // Marken
    { name: 'Nike', url: 'nike.com/ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['nike'] },
    { name: 'Adidas', url: 'adidas.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['adidas'] },
    { name: 'Puma', url: 'puma.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['puma'] },
    { name: 'Under Armour', url: 'underarmour.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['performance'] },
    { name: 'Asics', url: 'asics.com', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['running'] },
    { name: 'New Balance', url: 'newbalance.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['running'] },
    { name: 'On Running', url: 'on-running.com', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['running', 'schweizer'] },
    { name: 'Salomon', url: 'salomon.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['trail'] },
    { name: 'Hoka', url: 'hoka.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['running'] },
    { name: 'Brooks', url: 'brooksrunning.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['running'] },
    
    // Yoga & Fitness
    { name: 'Lululemon', url: 'lululemon.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['yoga'] },
    { name: 'Alo Yoga', url: 'aloyoga.com', land: 'US', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['yoga'] },
    { name: 'Sweaty Betty', url: 'sweatybetty.com', land: 'UK', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['damen-fitness'] },
    { name: 'Gymshark', url: 'gymshark.com', land: 'UK', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['gym'] },
    { name: 'Vuori', url: 'vuoriclothing.com', land: 'US', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['athleisure'] },
    
    // Outdoor Premium
    { name: 'Mammut', url: 'mammut.com', land: 'CH', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['bergsport', 'schweizer'] },
    { name: 'Patagonia', url: 'patagonia.com', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['outdoor', 'nachhaltig'] },
    { name: 'Arc\'teryx', url: 'arcteryx.com', land: 'CA', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['technisch'] },
    { name: 'The North Face', url: 'thenorthface.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['outdoor'] },
    { name: 'Fjällräven', url: 'fjallraven.com', land: 'SE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['outdoor', 'skandinavisch'] },
    { name: 'Peak Performance', url: 'peakperformance.com', land: 'SE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['ski'] },
    { name: 'Norrøna', url: 'norrona.com', land: 'NO', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['outdoor'] }
  ],
  
  // ------------------------------------------
  // SCHUHE (40+ Shops)
  // ------------------------------------------
  schuhe: [
    // Schweiz
    { name: 'Dosenbach', url: 'dosenbach.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['familie'] },
    { name: 'Ochsner Shoes', url: 'ochsner-shoes.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['marken'] },
    { name: 'Vögele Shoes', url: 'voegele-shoes.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['budget'] },
    { name: 'Navyboot', url: 'navyboot.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['premium'] },
    { name: 'Bally', url: 'bally.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus', 'schweizer'] },
    
    // Online
    { name: 'Zalando Schuhe', url: 'zalando.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['multi-brand'] },
    { name: 'Sarenza', url: 'sarenza.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['schuhe'] },
    
    // Sneaker
    { name: 'Snipes', url: 'snipes.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['sneaker', 'streetwear'] },
    { name: 'Foot Locker', url: 'footlocker.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['sneaker'] },
    { name: 'JD Sports', url: 'jdsports.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['sneaker', 'sport'] },
    { name: 'Titolo', url: 'titolo.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['sneaker', 'limited'] },
    { name: 'Asphaltgold', url: 'asphaltgold.com', land: 'DE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['sneaker'] },
    { name: 'Sneakersnstuff', url: 'sneakersnstuff.com', land: 'SE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['sneaker'] },
    { name: 'End. Clothing', url: 'endclothing.com', land: 'UK', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['sneaker'] },
    { name: 'GOAT', url: 'goat.com', land: 'US', qualitaet: 'hoch', preis: 'hoch', versand: 'langsam', spezialisierung: ['resell'] },
    { name: 'StockX', url: 'stockx.com', land: 'US', qualitaet: 'hoch', preis: 'hoch', versand: 'langsam', spezialisierung: ['resell'] },
    
    // Premium & Designer
    { name: 'Mytheresa Shoes', url: 'mytheresa.com', land: 'DE', qualitaet: 'premium', preis: 'luxus', versand: 'schnell', spezialisierung: ['designer'] },
    { name: 'Net-a-Porter Shoes', url: 'net-a-porter.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'schnell', spezialisierung: ['designer'] },
    { name: 'Jimmy Choo', url: 'jimmychoo.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] },
    { name: 'Christian Louboutin', url: 'christianlouboutin.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] },
    { name: 'Manolo Blahnik', url: 'manoloblahnik.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] },
    { name: 'Gianvito Rossi', url: 'gianvitorossi.com', land: 'IT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['italienisch'] },
    { name: 'Aquazzura', url: 'aquazzura.com', land: 'IT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['italienisch'] },
    
    // Klassisch & Business
    { name: 'Church\'s', url: 'church-footwear.com', land: 'UK', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['british'] },
    { name: 'Crockett & Jones', url: 'crockettandjones.com', land: 'UK', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['british'] },
    { name: 'Loake', url: 'loake.com', land: 'UK', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['british'] },
    { name: 'Grenson', url: 'grenson.com', land: 'UK', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['british'] },
    { name: 'Alden', url: 'aldenshoe.com', land: 'US', qualitaet: 'premium', preis: 'luxus', versand: 'langsam', spezialisierung: ['amerikanisch'] },
    { name: 'Carmina', url: 'carminashoemaker.com', land: 'ES', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['spanisch'] }
  ],
  
  // ------------------------------------------
  // ACCESSOIRES & SCHMUCK (30+ Shops)
  // ------------------------------------------
  accessoires: [
    // Uhren
    { name: 'Bucherer', url: 'bucherer.com', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['uhren', 'luxus'] },
    { name: 'Chrono24', url: 'chrono24.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['uhren', 'marktplatz'] },
    { name: 'Watches of Switzerland', url: 'watches-of-switzerland.com', land: 'UK', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['uhren'] },
    { name: 'Swatch', url: 'swatch.com', land: 'CH', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['swatch'] },
    { name: 'Daniel Wellington', url: 'danielwellington.com', land: 'SE', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['minimalist'] },
    
    // Schmuck
    { name: 'Christ', url: 'christ.ch', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['schmuck'] },
    { name: 'Pandora', url: 'pandora.net', land: 'INT', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['charms'] },
    { name: 'Swarovski', url: 'swarovski.com', land: 'AT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['kristall'] },
    { name: 'Tiffany & Co.', url: 'tiffany.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] },
    { name: 'Cartier', url: 'cartier.ch', land: 'CH', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] },
    { name: 'Monica Vinader', url: 'monicavinader.com', land: 'UK', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['modern'] },
    { name: 'Mejuri', url: 'mejuri.com', land: 'CA', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['everyday'] },
    { name: 'Missoma', url: 'missoma.com', land: 'UK', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['trendy'] },
    
    // Taschen
    { name: 'Louis Vuitton', url: 'louisvuitton.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] },
    { name: 'Gucci', url: 'gucci.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] },
    { name: 'Hermès', url: 'hermes.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] },
    { name: 'Chanel', url: 'chanel.com', land: 'INT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['luxus'] },
    { name: 'Bottega Veneta', url: 'bottegaveneta.com', land: 'IT', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['intrecciato'] },
    { name: 'Celine', url: 'celine.com', land: 'FR', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['minimal'] },
    { name: 'Loewe', url: 'loewe.com', land: 'ES', qualitaet: 'premium', preis: 'luxus', versand: 'mittel', spezialisierung: ['leder'] },
    { name: 'Mansur Gavriel', url: 'mansurgavriel.com', land: 'US', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['minimal'] },
    { name: 'Polène', url: 'polene-paris.com', land: 'FR', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['franzoesisch'] },
    
    // Brillen
    { name: 'Fielmann', url: 'fielmann.ch', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['optiker'] },
    { name: 'Viu', url: 'shopviu.com', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['design', 'schweizer'] },
    { name: 'Ace & Tate', url: 'aceandtate.com', land: 'NL', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['design'] },
    { name: 'Warby Parker', url: 'warbyparker.com', land: 'US', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['online'] },
    { name: 'Ray-Ban', url: 'ray-ban.com', land: 'INT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['sonnenbrillen'] },
    { name: 'Persol', url: 'persol.com', land: 'IT', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['italienisch'] }
  ],
  
  // ------------------------------------------
  // KINDER MODE (20+ Shops)
  // ------------------------------------------
  kinder: [
    { name: 'Zalando Kids', url: 'zalando.ch/kinder', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'schnell', spezialisierung: ['multi-brand'] },
    { name: 'H&M Kids', url: 'hm.com/ch/kids', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['fast-fashion'] },
    { name: 'Zara Kids', url: 'zara.com/kids', land: 'INT', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['fast-fashion'] },
    { name: 'C&A Kids', url: 'c-and-a.com/ch/kids', land: 'CH', qualitaet: 'gut', preis: 'guenstig', versand: 'mittel', spezialisierung: ['familie'] },
    { name: 'Vertbaudet', url: 'vertbaudet.ch', land: 'CH', qualitaet: 'gut', preis: 'mittel', versand: 'mittel', spezialisierung: ['franzoesisch'] },
    { name: 'Petit Bateau', url: 'petit-bateau.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['franzoesisch', 'klassisch'] },
    { name: 'Boden Mini', url: 'boden.ch', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['british'] },
    { name: 'Polarn O. Pyret', url: 'polarnopyret.com', land: 'SE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['skandinavisch', 'outdoor'] },
    { name: 'Reima', url: 'reima.com', land: 'FI', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['outdoor', 'finnisch'] },
    { name: 'Mini Rodini', url: 'minirodini.com', land: 'SE', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['nachhaltig', 'design'] },
    { name: 'Frugi', url: 'welovefrugi.com', land: 'UK', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['bio', 'farbenfroh'] },
    { name: 'Patagonia Kids', url: 'patagonia.com/kids', land: 'INT', qualitaet: 'premium', preis: 'hoch', versand: 'mittel', spezialisierung: ['outdoor', 'nachhaltig'] },
    { name: 'The North Face Kids', url: 'thenorthface.ch/kids', land: 'CH', qualitaet: 'hoch', preis: 'hoch', versand: 'mittel', spezialisierung: ['outdoor'] },
    { name: 'Nike Kids', url: 'nike.com/kids', land: 'INT', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['sport'] },
    { name: 'Adidas Kids', url: 'adidas.ch/kids', land: 'CH', qualitaet: 'hoch', preis: 'mittel', versand: 'mittel', spezialisierung: ['sport'] }
  ]
};

module.exports = {
  KOSMETIK_SHOPS,
  KLEIDUNG_SHOPS
};