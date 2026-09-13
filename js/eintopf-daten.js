// js/eintopf-daten.js
//
// Eintopf-Rechner-Reiter der App-Fusion (Paket C, 13.09.2026): fest hinterlegte
// Rezeptdaten (Rindfleischeintopf T8_MEAL_STEW, Fischsauce, Fischliste).
//
// Migriert aus eintopf_update.py (STEWS/SAUCE/FISH/ITEM_VALUE, dort vormals in
// Python gehalten und per Python-Vorablauf in die erzeugte HTML-Seite
// eingebettet). Inhaltlich unveraendert, nur die Sprache wechselt (Python ->
// JS), weil der Python-Vorablauf fuer diesen Reiter komplett entfaellt
// (Nutzer-Entscheidung 13.09.2026, s. kostenrechner-KONTEXT.md "Aktueller
// Stand"): alle Marktdaten (Preise/Volumen/Stundenprofil) kommen jetzt live
// aus dem Browser, s. js/eintopf-preise.js. Diese Datei liefert nur, was sich
// NICHT aus einem Marktabruf ergibt - das Rezept selbst.
//
// Nur der Rindfleischeintopf ist hinterlegt (Ziegen-/Hammelfleischeintopf auf
// Nutzerwunsch entfernt, s. KONTEXT.md "Verworfene Ansaetze"). Die Rezepte
// kommen bewusst NICHT aus dem Rezeptgraphen des Kostenrechners
// (rezepte.js/build_graph.py) - das ist ein eigenes System fuer craftbare
// Ausruestung, keine Speisen, s. Auftrag zu Paket C.

const EINTOPF_DATEN = (function () {
  "use strict";

  // out = Stueck je Craft-Vorgang (Batch), Fokuskosten sind Rohwerte ohne
  // Spezialisierung (s. CLAUDE.md "craftingfocus aus dem Dump ist der
  // Grundwert bei Spezialisierungsstufe 0").
  const STEWS = [
    {
      id: "T8_MEAL_STEW", name: "Rindfleischeintopf", tier: 8,
      out: 10, focus0: 551,
      base: [["T8_PUMPKIN", 36], ["T4_BREAD", 36], ["T8_MEAT", 72]],
      ench: {
        1: { focus: 752, sauce: 90 },
        2: { focus: 1152, sauce: 90 },
        3: { focus: 2353, sauce: 90 },
      },
    },
  ];

  // Fischsauce: Stueckchen + Seegras -> 1 Sauce.
  const SAUCE = {
    1: { id: "T1_FISHSAUCE_LEVEL1", name: "Einfache Fischsauce", chops: 15, seaweed: 1 },
    2: { id: "T1_FISHSAUCE_LEVEL2", name: "Besondere Fischsauce", chops: 45, seaweed: 3 },
    3: { id: "T1_FISHSAUCE_LEVEL3", name: "Spezielle Fischsauce", chops: 135, seaweed: 9 },
  };

  // 1 Fisch -> n Fischstueckchen. [id, name, chops, gruppe]
  const FISH_ROH = [
    ["T1_FISH_FRESHWATER_ALL_COMMON", "Unechtes Rotauge", 1, "Süßwasser"],
    ["T2_FISH_FRESHWATER_ALL_COMMON", "Gestreifter Karpfen", 2, "Süßwasser"],
    ["T3_FISH_FRESHWATER_ALL_COMMON", "Albionbarsch", 3, "Süßwasser"],
    ["T4_FISH_FRESHWATER_ALL_COMMON", "Blauschuppenhecht", 4, "Süßwasser"],
    ["T5_FISH_FRESHWATER_ALL_COMMON", "Gepunktete Forelle", 6, "Süßwasser"],
    ["T6_FISH_FRESHWATER_ALL_COMMON", "Weißschuppenzander", 8, "Süßwasser"],
    ["T7_FISH_FRESHWATER_ALL_COMMON", "Bartelwels", 10, "Süßwasser"],
    ["T8_FISH_FRESHWATER_ALL_COMMON", "Flussstör", 14, "Süßwasser"],
    ["T1_FISH_SALTWATER_ALL_COMMON", "Gewöhnlicher Hering", 1, "Salzwasser"],
    ["T2_FISH_SALTWATER_ALL_COMMON", "Gestreifte Makrele", 2, "Salzwasser"],
    ["T3_FISH_SALTWATER_ALL_COMMON", "Küstenscholle", 3, "Salzwasser"],
    ["T4_FISH_SALTWATER_ALL_COMMON", "Blauschuppen-Kabeljau", 4, "Salzwasser"],
    ["T5_FISH_SALTWATER_ALL_COMMON", "Gepunkteter Seewolf", 6, "Salzwasser"],
    ["T6_FISH_SALTWATER_ALL_COMMON", "Buckellachs", 8, "Salzwasser"],
    ["T7_FISH_SALTWATER_ALL_COMMON", "Blauflossenthun", 10, "Salzwasser"],
    ["T8_FISH_SALTWATER_ALL_COMMON", "Stahlschuppenschwertfisch", 14, "Salzwasser"],
    ["T3_FISH_FRESHWATER_FOREST_RARE", "Grünflossenaal", 10, "Selten"],
    ["T5_FISH_FRESHWATER_FOREST_RARE", "Rotquellen-Aal", 20, "Selten"],
    ["T7_FISH_FRESHWATER_FOREST_RARE", "Totwasser-Aal", 30, "Selten"],
    ["T3_FISH_FRESHWATER_MOUNTAIN_RARE", "Kaltauge", 10, "Selten"],
    ["T5_FISH_FRESHWATER_MOUNTAIN_RARE", "Blindauge", 20, "Selten"],
    ["T7_FISH_FRESHWATER_MOUNTAIN_RARE", "Froststarrer", 30, "Selten"],
    ["T3_FISH_FRESHWATER_HIGHLANDS_RARE", "Steinbett-Lurch", 10, "Selten"],
    ["T5_FISH_FRESHWATER_HIGHLANDS_RARE", "Schnellwasser-Lurch", 20, "Selten"],
    ["T7_FISH_FRESHWATER_HIGHLANDS_RARE", "Donnerbach-Lurch", 30, "Selten"],
    ["T3_FISH_FRESHWATER_STEPPE_RARE", "Uferkrabbe", 10, "Selten"],
    ["T5_FISH_FRESHWATER_STEPPE_RARE", "Bachkrabbe", 20, "Selten"],
    ["T7_FISH_FRESHWATER_STEPPE_RARE", "Staublochkrabbe", 30, "Selten"],
    ["T3_FISH_FRESHWATER_SWAMP_RARE", "Grünmoor-Muschel", 10, "Selten"],
    ["T5_FISH_FRESHWATER_SWAMP_RARE", "Brackwasser-Muschel", 20, "Selten"],
    ["T7_FISH_FRESHWATER_SWAMP_RARE", "Schwarzsumpf-Muschel", 30, "Selten"],
    ["T3_FISH_FRESHWATER_AVALON_RARE", "Weißnebel Schnapper", 10, "Selten"],
    ["T5_FISH_FRESHWATER_AVALON_RARE", "Klardunst Schnapper", 20, "Selten"],
    ["T7_FISH_FRESHWATER_AVALON_RARE", "Reinnebel Schnapper", 30, "Selten"],
    ["T3_FISH_SALTWATER_ALL_RARE", "Flachwasser-Tintenfisch", 10, "Selten"],
    ["T5_FISH_SALTWATER_ALL_RARE", "Meeresoktopus", 20, "Selten"],
    ["T7_FISH_SALTWATER_ALL_RARE", "Tiefseekalmar", 30, "Selten"],
    ["T8_FISH_SALTWATER_ALL_BOSS_SHARK", "Hai", 200, "Selten"],
  ];
  // Tier steckt im Item-Praefix (T5_FISH_... -> 5), wie im Python-Original.
  const FISH = FISH_ROH.map(([id, name, chops, gruppe]) => ({
    id, name, chops, gruppe, tier: parseInt(id.split("_")[0].slice(1), 10),
  }));

  const ZUTAT_NAMEN = {
    T8_PUMPKIN: "Kürbis", T4_BREAD: "Brot", T8_MEAT: "Rohes Rind",
    T1_FISHCHOPS: "Zerkleinerter Fisch", T1_SEAWEED: "Seegras",
  };

  // Stationsgebuehr: Gebuehr = (ItemValue x 0,1125) x Stationssatz / 100, s.
  // CLAUDE.md "Belegte Spielformeln". Alle Koch-Rohstoffe haben ItemValue 40;
  // Fischprodukte haben 0 (reine Umwandlungsrezepte ohne craftingcategory).
  const ITEM_VALUE = {
    T8_PUMPKIN: 40, T4_BREAD: 40, T8_MEAT: 40,
    T1_FISHSAUCE_LEVEL1: 0, T1_FISHSAUCE_LEVEL2: 0, T1_FISHSAUCE_LEVEL3: 0,
  };
  const NAHRUNG_JE_ITEMVALUE = 0.1125;

  // Nahrung, die ein Craft-Vorgang (= 1 Batch) an der Station verbraucht, je
  // Verzauberungsstufe. Fischsauce hat ItemValue 0, deshalb ist der Wert fuer
  // alle Stufen gleich (Gegenprobe T7 Pork Pie: 144 x 4,5 = 648 Nahrung, exakt
  // der im Albion-Forum genannte Wert).
  function nahrungJeCraft(stew) {
    const iv = stew.base.reduce((a, [id, n]) => a + (ITEM_VALUE[id] || 0) * n, 0);
    const werte = { 0: iv * NAHRUNG_JE_ITEMVALUE };
    Object.entries(stew.ench).forEach(([e, d]) => {
      const sauceId = SAUCE[e].id;
      werte[e] = (iv + (ITEM_VALUE[sauceId] || 0) * d.sauce) * NAHRUNG_JE_ITEMVALUE;
    });
    return werte;
  }
  STEWS.forEach((s) => { s.nahrung = nahrungJeCraft(s); });

  // Alle Item-IDs, die fuer den Eintopf-Reiter ueber alle Staedte abgefragt
  // werden muessen (s. js/eintopf-preise.js). Die Craft-Stadt ist frei
  // waehlbar, darum auch die Grundzutaten (Kuerbis, Brot, Fleisch) in jeder
  // Stadt - dieselbe Liste wie vormals item_gruppen() in eintopf_update.py.
  function idGruppen() {
    const ids = new Set(["T1_FISHCHOPS", "T1_SEAWEED"]);
    STEWS.forEach((s) => {
      ids.add(s.id);
      Object.keys(s.ench).forEach((e) => ids.add(`${s.id}@${e}`));
      s.base.forEach(([id]) => ids.add(id));
    });
    Object.values(SAUCE).forEach((x) => ids.add(x.id));
    FISH.forEach((f) => ids.add(f.id));
    return [...ids];
  }

  return { STEWS, SAUCE, FISH, ZUTAT_NAMEN, ITEM_VALUE, idGruppen };
})();
