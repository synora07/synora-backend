// ============================================
// SYNORA - Pruefkatalog: die Fragen
// ============================================
// Jede Frage hat Bedingungen, die eine gute Antwort erfuellen muss.
// Was sich im Code pruefen laesst, wird automatisch geprueft. Was
// Urteil braucht - "passt das Produkt wirklich zum Zweck?" - musst
// du selbst anschauen; dafuer druckt der Katalog die Antworten mit.
//
// Erweitere die Liste. Jeder gemeldete Fehler aus dem echten
// Betrieb sollte hier als neue Frage landen, damit er nie wieder
// unbemerkt zurueckkommt.
// ============================================

'use strict';

module.exports = [
  // ---------- Budget: die harte Wand ----------
  {
    id: 'budget-1',
    frage: 'Kopfhörer bis 100 Franken',
    antworten: ['Zum Sport'],
    budget: 100,
    prueft: 'Budget wird eingehalten'
  },
  {
    id: 'budget-2',
    frage: 'Laptop bis 800 Franken für die Schule',
    budget: 800,
    prueft: 'Budget bei teurer Kategorie'
  },
  {
    id: 'budget-3',
    frage: 'Kaffeemaschine unter 200 CHF',
    budget: 200,
    prueft: 'Budget mit anderer Schreibweise'
  },

  // ---------- Zweck verstehen ----------
  {
    id: 'zweck-1',
    frage: 'Kopfhörer bis 200 Franken zum Pendeln',
    budget: 200,
    erwartetImText: ['pendeln', 'unterwegs', 'bahn', 'zug', 'lärm', 'umgebung'],
    prueft: 'Zweck taucht in der Begruendung auf'
  },
  {
    id: 'zweck-2',
    frage: 'Laufschuhe bis 150 Franken für Asphalt',
    budget: 150,
    prueft: 'Zweck bei Sportartikeln'
  },

  // ---------- Rueckfrage ----------
  {
    id: 'rueckfrage-1',
    frage: 'Kopfhörer',
    erwarteRueckfrage: true,
    prueft: 'Bei zu wenig Angaben wird gefragt'
  },
  {
    id: 'rueckfrage-2',
    frage: 'Bohrmaschine',
    erwarteRueckfrage: true,
    prueft: 'Rueckfrage auch ausserhalb Elektronik'
  },
  {
    id: 'rueckfrage-3',
    frage: 'zeig mir einfach Kopfhörer bis 50 Franken',
    budget: 50,
    erwarteRueckfrage: false,
    prueft: 'Wer keine Frage will, bekommt keine'
  },

  // ---------- Andere Kategorien ----------
  { id: 'kat-1', frage: 'Matratze 140x200 bis 500 Franken', budget: 500, prueft: 'Moebel' },
  { id: 'kat-2', frage: 'Winterjacke für Damen bis 200 Franken', budget: 200, prueft: 'Mode' },
  { id: 'kat-3', frage: 'Akkuschrauber bis 150 Franken für zu Hause', budget: 150, prueft: 'Werkzeug' },
  { id: 'kat-4', frage: 'Kinderfahrrad 20 Zoll bis 400 Franken', budget: 400, prueft: 'Kind und Velo' },
  { id: 'kat-5', frage: 'Gesichtscreme für trockene Haut bis 60 Franken', budget: 60, prueft: 'Kosmetik' },
  { id: 'kat-6', frage: 'Hundefutter für grosse Hunde bis 80 Franken', budget: 80, prueft: 'Tierbedarf' },
  { id: 'kat-7', frage: 'Bürostuhl bis 400 Franken für langes Sitzen', budget: 400, prueft: 'Buero' },
  { id: 'kat-8', frage: 'Rasenmäher bis 500 Franken für kleinen Garten', budget: 500, prueft: 'Garten' },

  // ---------- Schwierige Faelle ----------
  {
    id: 'schwer-1',
    frage: 'Kopfhörer für meinen Vater, er hört schlecht, Geld ist zweitrangig',
    prueft: 'Beschreibung ohne Budget und ohne Stichworte'
  },
  {
    id: 'schwer-2',
    frage: 'Ich brauche was zum Musik hören beim Rasenmähen',
    prueft: 'Umgangssprache, Zweck versteckt'
  },
  {
    id: 'schwer-3',
    frage: 'Sony Kopfhörer bis 150 Franken',
    budget: 150,
    markeVerlangt: 'sony',
    prueft: 'Marke wird beachtet oder ihr Fehlen benannt'
  },
  {
    id: 'schwer-4',
    frage: 'kopfhöhrer bis 100 fr',
    budget: 100,
    prueft: 'Tippfehler und Abkuerzung'
  },
  {
    id: 'schwer-5',
    frage: 'Laptop',
    erwarteRueckfrage: true,
    prueft: 'Ein Wort ohne alles'
  }
];