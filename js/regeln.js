// js/regeln.js
//
// Belegte Spielregeln des Kostenrechners: ItemValue, Rueckgewinnung (RRR),
// Stationsgebuehr, Fokusumrechnung, Steuer und Einstellungsgebuehr, sowie die
// beiden gepflegten Tabellen "Kategorie -> Gebaeude" und "Kategorie ->
// Stadtbonus". Reine Funktionen, kein DOM. Alle Zahlenwerte sind belegt,
// s. ../../CLAUDE.md, Abschnitt "Belegte Spielformeln" und "Craft-Kategorie
// zu Gebaeude". Nichts hier raten oder "plausibel" anpassen, ohne neuen Beleg.
//
// Muss NACH rezepte.js geladen werden (itemWert() liest REZEPTGRAPH), kann
// aber auch mit einem injizierten Graphen aufgerufen werden (letzter
// Parameter), damit sich der Rechenkern mit einem kleinen Test-Graphen ohne
// die echte 2,5-MB-Datei pruefen laesst (s. tests/test.html, Zyklustest).

const REGELN = (function () {
  "use strict";

  // -----------------------------------------------------------------------
  // Grundkonstanten, alle belegt (s. ../../CLAUDE.md "Belegte Spielformeln")
  // -----------------------------------------------------------------------

  const STATIONSGEBUEHR_FAKTOR = 0.1125;
  const STEUER_PREMIUM = 0.04; // Nutzer hat Premium aktiv
  const STEUER_OHNE_PREMIUM = 0.08;
  const EINSTELLGEBUEHR_SATZ = 0.025; // beim Aufgeben einer eigenen Order

  const RRR_GRUNDPRODUKTION = 0.18;
  const RRR_STADTBONUS_CRAFT = 0.15;
  const RRR_STADTBONUS_VEREDELN = 0.40; // deutlich groesser als der Craft-Bonus, s. CLAUDE.md
  const RRR_FOKUSBONUS = 0.59;
  const RRR_TAGESBONUS_SILBER = 0.10;
  const RRR_TAGESBONUS_GOLD = 0.20;

  const FOKUS_HALBIERUNG_FCE = 10000; // je 10.000 FCE halbiert sich der Fokusbedarf

  // -----------------------------------------------------------------------
  // Qualitaetsstufen (Feature 05.09.2026, s. kostenrechner-KONTEXT.md).
  // Index 0..4 = Normal/Gut/Herausragend/Exzellent/Meisterwerk, deckungsgleich
  // mit den API-Qualitaeten 1..5 der Albion-Online-Data-API (Index + 1).
  // -----------------------------------------------------------------------

  const QUALITAETEN = ["Normal", "Gut", "Herausragend", "Exzellent", "Meisterwerk"];

  // Craft-Qualitaetswurf, Basistabelle OHNE Bonus (Korn, Entwickler-Forumspost,
  // verlinkt vom offiziellen Wiki "Item_Quality", s. ../../CLAUDE.md
  // "Craft-Qualitaetswurf"). Summe = 1 (68,9+25+5+1+0,1 %).
  const QUALITAETSWURF_BASIS = [0.689, 0.25, 0.05, 0.01, 0.001];

  // Reroll-Uebergangstabelle (Wiki "Item_Quality", Abschnitt "Rerolling
  // quality at a repair station", s. ../../CLAUDE.md "Qualitaet rerollen an
  // der Reparaturstation"). Schluessel = AKTUELLE Qualitaet vor dem Reroll,
  // Werte = { ErgebnisQualitaet: Wahrscheinlichkeit }. Ein Eintrag mit
  // ErgebnisQualitaet === AktuelleQualitaet ist "bleibt gleich" (kein
  // Ruecklauf moeglich, deshalb nie eine NIEDRIGERE Qualitaet als Ergebnis).
  // Bei "von Normal" fehlt der Stay-Eintrag bewusst: die Wiki-Werte summieren
  // sich dort auf 100,1 % (Rundungsartefakt), die Rest-Wahrscheinlichkeit
  // "bleibt Normal" wird deshalb in rerollUebergaenge() auf 0 gekappt statt
  // negativ zu werden, statt der 4 Werte hier proportional zu kuerzen.
  const REROLL_UEBERGANG = {
    0: { 1: 0.80, 2: 0.15, 3: 0.05, 4: 0.001 }, // von Normal
    1: { 1: 0.30, 2: 0.60, 3: 0.099, 4: 0.001 }, // von Gut (Stay 30 % explizit belegt)
    2: { 2: 0.50, 3: 0.499, 4: 0.001 }, // von Herausragend (Stay 50 % explizit belegt)
    3: { 3: 0.995, 4: 0.005 }, // von Exzellent (Stay 99,5 % explizit belegt)
  };

  // Kosten je Reroll = Gegenstandswert x Faktor der AKTUELLEN Qualitaet vor
  // dem Reroll (Index 0..3 = Normal..Exzellent; Meisterwerk wird nie
  // gererollt, ist bereits das Maximum).
  const REROLL_FAKTOR = { 0: 4.4, 1: 5.5, 2: 6.6, 3: 27.5 };

  // -----------------------------------------------------------------------
  // Kategorie -> Gebaeude / Gebuehrengruppe
  // Aus ../../CLAUDE.md, Abschnitt "Craft-Kategorie zu Gebaeude" (Wiki,
  // 04.09.2026). offhand, knuckles und meat_* sind dort ausdruecklich als
  // eigene Gebuehrengruppen vorgesehen statt einer erfundenen Zuordnung.
  // -----------------------------------------------------------------------

  const KATEGORIE_ZU_GEBAEUDE = {
    // Veredelung
    fiber: "Weber",
    ore: "Schmelze",
    rock: "Steinmetz",
    hide: "Gerberei",
    wood: "Saegewerk",
    // Kriegerschmiede
    sword: "Kriegerschmiede",
    axe: "Kriegerschmiede",
    mace: "Kriegerschmiede",
    hammer: "Kriegerschmiede",
    crossbow: "Kriegerschmiede",
    plate_armor: "Kriegerschmiede",
    plate_helmet: "Kriegerschmiede",
    plate_shoes: "Kriegerschmiede",
    // Magierturm
    firestaff: "Magierturm",
    arcanestaff: "Magierturm",
    holystaff: "Magierturm",
    cursestaff: "Magierturm",
    froststaff: "Magierturm",
    cloth_armor: "Magierturm",
    cloth_helmet: "Magierturm",
    cloth_shoes: "Magierturm",
    // Jaegerhuette
    bow: "Jaegerhuette",
    dagger: "Jaegerhuette",
    quarterstaff: "Jaegerhuette",
    naturestaff: "Jaegerhuette",
    spear: "Jaegerhuette",
    leather_armor: "Jaegerhuette",
    leather_helmet: "Jaegerhuette",
    leather_shoes: "Jaegerhuette",
    // Werkzeugmacher
    tools: "Werkzeugmacher",
    gatherergear: "Werkzeugmacher",
    bag: "Werkzeugmacher",
    cape: "Werkzeugmacher",
    // Einzelgebaeude
    potion: "Alchemistenlabor",
    food: "Kueche",
    // Sonderfaelle: keine eindeutige Wiki-Zuordnung, eigene Gebuehrengruppen
    // statt erfundener Zuordnung, s. ../../CLAUDE.md.
    offhand: "Nebenhand (Gebaeude je Item unterschiedlich)",
    knuckles: "Kampfhandschuhe (im Wiki keinem Gebaeude gelistet)",
    meat_chicken: "Tierhaltung",
    meat_cow: "Tierhaltung",
    meat_goat: "Tierhaltung",
    meat_goose: "Tierhaltung",
    meat_pig: "Tierhaltung",
    meat_sheep: "Tierhaltung",
  };

  // -----------------------------------------------------------------------
  // Kategorie -> Stadtbonus, alle sieben Staedte (s. ../../CLAUDE.md).
  // v1 rechnet nur mit Lymhurst, die Tabelle steht trotzdem vollstaendig,
  // wie ausdruecklich verlangt.
  // -----------------------------------------------------------------------

  const STADTBONUS = {
    Lymhurst: {
      craft: ["sword", "bow", "arcanestaff", "leather_helmet", "leather_shoes"],
      veredeln: ["fiber"],
    },
    "Fort Sterling": {
      craft: ["hammer", "spear", "holystaff", "plate_helmet", "cloth_armor"],
      veredeln: ["wood"],
    },
    Bridgewatch: {
      craft: ["crossbow", "dagger", "cursestaff", "plate_armor", "cloth_shoes"],
      veredeln: ["rock"],
    },
    Martlock: {
      craft: ["axe", "quarterstaff", "froststaff", "plate_shoes", "offhand"],
      veredeln: ["hide"],
    },
    Thetford: {
      craft: ["mace", "firestaff", "naturestaff", "leather_armor", "cloth_helmet"],
      veredeln: ["ore"],
    },
    Caerleon: {
      craft: ["food", "gatherergear", "tools", "knuckles"],
      veredeln: [],
    },
    Brecilien: {
      craft: ["cape", "bag", "potion"],
      veredeln: [],
    },
  };

  function gebaeudeVonKategorie(cc) {
    if (!cc) return null;
    return KATEGORIE_ZU_GEBAEUDE[cc] || null;
  }

  function hatCraftBonus(cc, stadt) {
    const s = STADTBONUS[stadt];
    return !!(s && cc && s.craft.indexOf(cc) !== -1);
  }

  function hatVeredelBonus(cc, stadt) {
    const s = STADTBONUS[stadt];
    return !!(s && cc && s.veredeln.indexOf(cc) !== -1);
  }

  // -----------------------------------------------------------------------
  // Rueckgewinnung (Resource Return Rate)
  // -----------------------------------------------------------------------

  /**
   * @param {{cc: ?string, stadt: string, mitFokus: boolean, tagesbonus: ?("silber"|"gold")}} p
   * @returns {number} RRR zwischen 0 und <1. 0, wenn cc fehlt (keine
   *   craftingcategory -> keine Rueckgewinnung moeglich, s. koenigliche Items).
   */
  function rrr(p) {
    p = p || {};
    if (!p.cc) return 0;
    let b = RRR_GRUNDPRODUKTION;
    if (hatCraftBonus(p.cc, p.stadt)) b += RRR_STADTBONUS_CRAFT;
    if (hatVeredelBonus(p.cc, p.stadt)) b += RRR_STADTBONUS_VEREDELN;
    if (p.mitFokus) b += RRR_FOKUSBONUS;
    if (p.tagesbonus === "silber") b += RRR_TAGESBONUS_SILBER;
    else if (p.tagesbonus === "gold") b += RRR_TAGESBONUS_GOLD;
    return b / (1 + b);
  }

  // -----------------------------------------------------------------------
  // Fokus
  // -----------------------------------------------------------------------

  /**
   * 0,5 ^ (FCE / 10.000). FCE 0 -> Faktor 1 (voller Rohfokus aus dem Dump).
   * FCE wird bei 0 nach unten gekappt: eine negative FCE ergaebe einen
   * Multiplikator > 1 (mehr als der volle Rohfokus), inhaltlich unmoeglich,
   * Spezialisierung kann Fokuskosten nur senken, nie erhoehen.
   * Verteidigung in der Tiefe zu der Kappung, die ui.js schon an der
   * Formular-Eingabe vornimmt (P5-Nacharbeit, oberflaechen-pruefer Befund 5).
   */
  function fokusMultiplikator(fce) {
    const f = Math.max(0, fce || 0);
    return Math.pow(0.5, f / FOKUS_HALBIERUNG_FCE);
  }

  /** Fokuskosten fuer `chargen` Chargen eines Rezepts mit Grundfokus `grundfokus`. */
  function fokusKosten(grundfokus, fce, chargen) {
    const c = chargen == null ? 1 : chargen;
    return (grundfokus || 0) * fokusMultiplikator(fce) * c;
  }

  /** FCE aus einem im Craft-Fenster abgelesenen Fokuswert zurueckrechnen. */
  function fceAusAbgelesenemFokus(abgelesen, grundfokus) {
    if (!grundfokus || !abgelesen) return 0;
    return -Math.log2(abgelesen / grundfokus) * FOKUS_HALBIERUNG_FCE;
  }

  // -----------------------------------------------------------------------
  // Spezialisierungsknoten am Schicksalsbrett (05.09.2026, Zyklus
  // "FCE-Ableitung ueber Schicksalsbrett-Knotenliste je Kategorie"). Ersetzt
  // die fruehere, strukturell falsche Herleitung "FCE = Meisterschaftsstufe x
  // 30 + Spezialisierungsstufe x 250" (js/ui.js, ehemals
  // fceAusSchicksalsbrett()): die nahm faelschlich EINEN globalen
  // Spezialisierungswert an und ignorierte sowohl den je Knotentyp
  // unterschiedlichen Unique-/Mutual-Anteil (s. CLAUDE.md "FCE je Stufe
  // haengt vom Knotentyp ab") als auch, dass der Mutual-Anteil JEDES
  // Spezialisierungsknotens auf ALLE ANDEREN Knoten derselben Kategorie
  // wirkt, nicht nur auf sich selbst.
  //
  // Modell: pro craftingcategory (falls hier abgebildet) ein Knotentyp mit
  // Unique-/Mutual-/Meisterschafts-FCE je Stufe (Tabelle CLAUDE.md). Die
  // einzelnen Spezialisierungsknoten werden NICHT von Hand gepflegt, sondern
  // aus dem Rezeptgraphen abgeleitet: alle Items derselben craftingcategory,
  // gruppiert nach ihrem Namen ohne Tier-Praefix (z.B. T4_MAIN_SWORD bis
  // T8_MAIN_SWORD -> ein Knoten "MAIN_SWORD"). Das ist eine Naeherung (echte
  // Schicksalsbrett-Knoten koennen anders geschnitten sein), deshalb bleibt
  // die bestehende kategorieweite FCE-Ausnahme (opts.fceUeberschreibungen[cc]
  // in rechenkern.js) als Freitext-Fallback erhalten: sie gilt automatisch
  // weiter, solange fuer eine Kategorie hier keine (oder ausschliesslich
  // Nullstufen-)Eingabe gemacht wurde, s. js/ui.js/fceUeberschreibungenFuerOpts().
  // -----------------------------------------------------------------------

  const SPEZ_TYP = {
    // Ruestungs-/Waffenknoten und Veredeln teilen dieselben Werte (250/30 je
    // Stufe, plus eigener Meisterschaftsknoten mit 30 je Stufe).
    waffen_ruestung: { unique: 250, mutual: 30, mastery: 30, einFeld: false },
    veredeln: { unique: 250, mutual: 30, mastery: 30, einFeld: false },
    umhang: { unique: 370, mutual: 0, mastery: 30, einFeld: false },
    tasche: { unique: 340, mutual: 0, mastery: 30, einFeld: false },
    // Uebrige Werkzeuge: Meisterschaft und Spezialisierung sind zu EINEM
    // Knoten verschmolzen ("fused"), kein getrennter Meisterschaftsknoten,
    // s. CLAUDE.md "Fokuskosten"/Wiki Specializations.
    werkzeug_fused: { unique: 250, mutual: 60, mastery: 0, einFeld: true },
    // Speisen (Koch) und Traenke (Alchemist): gleiche Struktur wie Waffen/
    // Ruestung (250/30 + eigene Meisterschaft 30 je Stufe), nur
    // unterschiedliche Anzahl Spezialisierungsknoten (Koch 9, Alchemist 8)
    // und Maximalwert (55.000 bzw. 52.000 FCE laut Wiki "Specializations").
    speise: { unique: 250, mutual: 30, mastery: 30, einFeld: false },
    trank: { unique: 250, mutual: 30, mastery: 30, einFeld: false },
  };

  const KATEGORIE_ZU_SPEZTYP = {
    sword: "waffen_ruestung", axe: "waffen_ruestung", mace: "waffen_ruestung", hammer: "waffen_ruestung",
    crossbow: "waffen_ruestung", bow: "waffen_ruestung", dagger: "waffen_ruestung", quarterstaff: "waffen_ruestung",
    naturestaff: "waffen_ruestung", spear: "waffen_ruestung", arcanestaff: "waffen_ruestung", firestaff: "waffen_ruestung",
    holystaff: "waffen_ruestung", cursestaff: "waffen_ruestung", froststaff: "waffen_ruestung",
    plate_armor: "waffen_ruestung", plate_helmet: "waffen_ruestung", plate_shoes: "waffen_ruestung",
    cloth_armor: "waffen_ruestung", cloth_helmet: "waffen_ruestung", cloth_shoes: "waffen_ruestung",
    leather_armor: "waffen_ruestung", leather_helmet: "waffen_ruestung", leather_shoes: "waffen_ruestung",
    fiber: "veredeln", ore: "veredeln", rock: "veredeln", hide: "veredeln", wood: "veredeln",
    cape: "umhang",
    bag: "tasche",
    tools: "werkzeug_fused", gatherergear: "werkzeug_fused",
    food: "speise",
    potion: "trank",
    // offhand, knuckles, meat_* absichtlich NICHT abgebildet, s. CLAUDE.md
    // "Craft-Kategorie zu Gebaeude": keine eindeutige Wiki-Zuordnung. Bleiben
    // beim bisherigen Freitext-Fallback (opts.fceUeberschreibungen[cc]).
  };

  function spezTypVonKategorie(cc) {
    return (cc && KATEGORIE_ZU_SPEZTYP[cc]) || null;
  }

  /**
   * Gruppenschluessel eines Items fuer die Schicksalsbrett-Knotenableitung.
   * Zwei GEGENSAETZLICHE Regeln je nach Knotentyp (Bug behoben 05.09.2026,
   * per Browser-Test am fiber-Panel der Koeniglichen Gugel gefunden):
   *
   *  - Veredeln (fiber/ore/hide/wood/rock, spezTyp "veredeln"): fuers
   *    Schicksalsbrett zaehlt NUR die Tier-Stufe des Rohstoffs, nicht die
   *    Verzauberungsstufe des Ergebnisses. Veredelte Guetertypen tragen ihre
   *    Verzauberungsstufe als Suffix IM Item-Namen (el-Knoten, jede Stufe ein
   *    eigener uniquename: T4_CLOTH, T4_CLOTH_LEVEL1..LEVEL4), waehrend die
   *    Tier-Stufe als Praefix ebenfalls im Namen steckt. Deshalb hier den
   *    Verzauberungs-Suffix entfernen, das Tier-Praefix aber BEHALTEN: alle
   *    fuenf Verzauberungsstufen von T4-Stoff teilen sich EINEN Knoten
   *    ("Weberadept"), T5-Stoff ist bereits ein ANDERER Knoten
   *    ("Weberexperte"). Belegt durch Schicksalsbrett-Screenshots des
   *    Nutzers (Handwerk-Baum "Verfeinerer": Weberadept/-experte/-meister/
   *    -grossmeister/-aeltester, exakt je ein Knoten pro Tier T4-T8), s.
   *    kostenrechner-KONTEXT.md.
   *  - Alles andere (Ausruestung usw.): das Schicksalsbrett zaehlt dort
   *    tier-UNABHAENGIG pro Item-Familie (Wiki: ein Spezialisierungsknoten
   *    wirkt "for all Galatine Pair you use" ueber alle Tiers). Ausruestung
   *    traegt ihre Verzauberungsstufe ohnehin nicht im Item-Namen (gleicher
   *    uniquename ueber alle Stufen, s. e[stufe].r), daher reicht es, das
   *    Tier-Praefix (T1_..T8_) zu entfernen.
   *
   * @param {string} item
   * @param {?string} [cc] craftingcategory des Items; bestimmt die Regel
   */
  function gruppenSchluesselVonItem(item, cc) {
    const s = String(item || "");
    if (spezTypVonKategorie(cc) === "veredeln") {
      return s.replace(/_LEVEL\d+$/, "");
    }
    return s.replace(/^T\d+_/, "");
  }

  /**
   * Alle Spezialisierungsknoten-Gruppen einer Kategorie, abgeleitet aus dem
   * Rezeptgraphen (nicht von Hand gepflegt): jedes Item mit dieser
   * craftingcategory, gruppiert nach gruppenSchluesselVonItem(). Sortiert
   * alphabetisch nach Gruppenschluessel fuer eine stabile Anzeige.
   * @returns {{schluessel: string, items: string[]}[]}
   */
  function spezialisierungsGruppen(cc, graph) {
    const g = aktuellerGraph(graph);
    if (!g || !cc) return [];
    const gruppen = {};
    Object.keys(g.items).forEach((item) => {
      const node = g.items[item];
      if (!node || node.cc !== cc) return;
      const schluessel = gruppenSchluesselVonItem(item, cc);
      if (!gruppen[schluessel]) gruppen[schluessel] = { schluessel, items: [] };
      gruppen[schluessel].items.push(item);
    });
    return Object.keys(gruppen)
      .sort()
      .map((k) => {
        gruppen[k].items.sort();
        return gruppen[k];
      });
  }

  /**
   * FCE fuer einen Spezialisierungsknoten (Gruppe `gruppenSchluessel`)
   * innerhalb der Kategorie `cc`: eigener Unique-Anteil (Stufe dieses
   * Knotens) + Mutual-Anteil ALLER ANDEREN Knoten derselben Kategorie (deren
   * Stufe x Mutual je Stufe) + bei getrenntem Meisterschaftsknoten dessen
   * Anteil (Meisterschaftsstufe x 30). 0, wenn die Kategorie hier nicht
   * abgebildet ist (s. KATEGORIE_ZU_SPEZTYP).
   * @param {string} cc
   * @param {string} gruppenSchluessel Gruppe des Zielknotens
   * @param {Object<string,number>} knotenStufen gruppenSchluessel -> Stufe (>= 0)
   * @param {number} [meisterschaftsstufe] nur bei getrenntem Meisterschaftsknoten (einFeld: false)
   */
  function fceAusSpezialisierungsknoten(cc, gruppenSchluessel, knotenStufen, meisterschaftsstufe) {
    const typ = SPEZ_TYP[spezTypVonKategorie(cc)];
    if (!typ) return 0;
    const stufen = knotenStufen || {};
    let fce = Math.max(0, stufen[gruppenSchluessel] || 0) * typ.unique;
    Object.keys(stufen).forEach((k) => {
      if (k !== gruppenSchluessel) fce += Math.max(0, stufen[k] || 0) * typ.mutual;
    });
    if (!typ.einFeld) fce += Math.max(0, meisterschaftsstufe || 0) * typ.mastery;
    return fce;
  }

  // -----------------------------------------------------------------------
  // Qualitaetsstufen: Craft-Qualitaetswurf (Korn) und Reroll an der
  // Reparaturstation. S. ../../CLAUDE.md "Craft-Qualitaetswurf" und
  // "Qualitaet rerollen an der Reparaturstation" fuer die Belege.
  // -----------------------------------------------------------------------

  /**
   * Liefert die vollstaendigen Uebergangswahrscheinlichkeiten EINES Rerolls ab
   * `aktuelleQualitaet` (Index 0..3), inklusive "bleibt gleich" (Schluessel ===
   * aktuelleQualitaet). null fuer Meisterwerk (4, nicht rerollbar, bereits
   * Maximum) oder einen unbekannten Index.
   * @returns {?Object<number, number>}
   */
  function rerollUebergaenge(aktuelleQualitaet) {
    const eintraege = REROLL_UEBERGANG[aktuelleQualitaet];
    if (!eintraege) return null;
    const ergebnis = Object.assign({}, eintraege);
    if (ergebnis[aktuelleQualitaet] == null) {
      // Nur "von Normal": kein Stay-Eintrag in der Tabelle, Rest der Spalte
      // (100 % - Summe der belegten Werte) wird bei 0 gekappt statt negativ
      // zu werden, s. Kommentar bei REROLL_UEBERGANG.
      const summe = Object.keys(eintraege).reduce((s, k) => s + eintraege[k], 0);
      ergebnis[aktuelleQualitaet] = Math.max(0, 1 - summe);
    }
    return ergebnis;
  }

  /**
   * Erwartete Silberkosten, ein Item per Reroll an der Reparaturstation von
   * `aktuelleQualitaet` (Default 0 = Normal) auf MINDESTENS `zielQualitaet` zu
   * bringen. Absorbierende Markov-Kette, geloest von Meisterwerk abwaerts (ein
   * Reroll ergibt nie eine niedrigere Qualitaet): E[q] = 0 fuer q >=
   * zielQualitaet, sonst E[q] = (Kosten_je_Reroll(q) + Summe_{r>q} P(q->r) x
   * E[r]) / (1 - P(q->q)). `itemWertJeStueck` ist quality-unabhaengig (keine
   * belegte Quelle nennt eine Aenderung des ItemValue durch Qualitaet), gilt
   * fuer die gesamte Reroll-Kette gleichermassen.
   * @returns {{silber: number, gesperrt: boolean, grund: ?string}}
   */
  function rerollKostenZuQualitaet(itemWertJeStueck, zielQualitaet, aktuelleQualitaet) {
    const start = aktuelleQualitaet || 0;
    if (zielQualitaet <= start) return { silber: 0, gesperrt: false, grund: null };
    if (zielQualitaet > 4 || zielQualitaet < 0) {
      return { silber: NaN, gesperrt: true, grund: "Qualitaetsindex " + zielQualitaet + " existiert nicht (0..4)" };
    }
    const e = { 4: 0 };
    for (let q = 3; q >= start; q--) {
      if (q >= zielQualitaet) {
        e[q] = 0;
        continue;
      }
      const uebergaenge = rerollUebergaenge(q);
      const kostenJeReroll = itemWertJeStueck * (REROLL_FAKTOR[q] || 0);
      const pStay = (uebergaenge && uebergaenge[q]) || 0;
      let summeHoeher = 0;
      if (uebergaenge) {
        Object.keys(uebergaenge).forEach((r) => {
          const rn = Number(r);
          if (rn !== q) summeHoeher += uebergaenge[rn] * (e[rn] != null ? e[rn] : 0);
        });
      }
      const nenner = 1 - pStay;
      e[q] = nenner > 0 ? (kostenJeReroll + summeHoeher) / nenner : Infinity;
    }
    const silber = e[start];
    return { silber, gesperrt: !isFinite(silber), grund: isFinite(silber) ? null : "Reroll-Erfolgswahrscheinlichkeit 0" };
  }

  /**
   * Erfolgswahrscheinlichkeit EINES Craft-Versuchs, direkt mindestens
   * `zielQualitaet` zu treffen (Korn: ohne Bonus ein Wurf auf die
   * Basistabelle, mit X % Bonus zusaetzlich X % Chance auf einen zweiten Wurf,
   * ab 100 % Bonus ein garantierter zweiter Wurf plus die restlichen Prozent
   * als Chance auf einen dritten usw.; bei mehreren Wuerfen zaehlt der beste).
   * `chancenpunkte` wird 1:1 als Prozent-Bonus gelesen: eine im Projekt
   * dokumentierte UNBELEGTE Annahme (s. ../../CLAUDE.md "Craft-Qualitaetswurf"),
   * keine Quelle bestaetigt woertlich 1 Punkt = 1 %.
   */
  function qualitaetWurfErfolgswahrscheinlichkeit(zielQualitaet, chancenpunkte) {
    if (zielQualitaet <= 0) return 1; // Normal wird von jedem Wurf getroffen
    const bonus = Math.max(0, chancenpunkte || 0);
    const garantierteWuerfe = 1 + Math.floor(bonus / 100);
    const zusatzChance = (bonus % 100) / 100;
    let pEinzelUnter = 0;
    for (let q = 0; q < zielQualitaet; q++) pEinzelUnter += QUALITAETSWURF_BASIS[q];
    const pErfolgMitN = (n) => 1 - Math.pow(pEinzelUnter, n);
    return zusatzChance * pErfolgMitN(garantierteWuerfe + 1) + (1 - zusatzChance) * pErfolgMitN(garantierteWuerfe);
  }

  /** Ob mindestens eine Zutat des Rezepts preservequality traegt (p:true). */
  function rezeptHatPreservequality(rezept) {
    return !!(rezept && rezept.i && rezept.i.some((z) => z.p));
  }

  // -----------------------------------------------------------------------
  // Stationsgebuehr
  // -----------------------------------------------------------------------

  /**
   * Gebuehr = ItemValue(je Stueck) x 0,1125 x Stationssatz / 100 x menge.
   * Aequivalent zur Formel aus ../../CLAUDE.md/PLAN (ItemValue je Charge x
   * 0,1125 x Stationssatz/100 x Chargen), nur mit itemWert() als Pro-Stueck-
   * Groesse und menge statt Chargen ausgedrueckt (menge = Chargen x
   * amountcrafted, ItemValueJeCharge = itemWert x amountcrafted, beides kuerzt
   * sich weg). Gegenprobe: itemWertJeStueck 576, Stationssatz 380, menge 10
   * (= 1 Charge Eintopf) -> 2.462,4 Silber, s. tests/test.html.
   */
  function stationsgebuehr(itemWertJeStueck, menge, stationssatz) {
    const wert = (itemWertJeStueck || 0) * STATIONSGEBUEHR_FAKTOR * ((stationssatz || 0) / 100) * menge;
    // Bei 0 gekappt: rechenkern.js/stationssatzFuer() behandelt einen negativen
    // Stationssatz bereits als "nicht gepflegt" und reicht hier nie einen
    // negativen Satz durch, aber diese Funktion soll bei einem DIREKTEN,
    // isolierten Aufruf (Test, spaetere Verwendungsstelle ohne diese
    // Vorpruefung) trotzdem nie eine negative Gebuehr liefern koennen.
    // Verteidigung in der Tiefe (oberflaechen-pruefer, P5-Nacharbeit, Befund 5).
    return Math.max(0, wert);
  }

  // -----------------------------------------------------------------------
  // Steuer und Einstellungsgebuehr (Verkaufsseite bzw. eigene Kauforder)
  // -----------------------------------------------------------------------

  /**
   * @param {number} betrag
   * @param {{steuersatz?: number, mitEinstellgebuehr?: boolean}} [opts]
   * @returns {{steuer: number, gebuehr: number, netto: number}}
   */
  function steuerUndGebuehr(betrag, opts) {
    opts = opts || {};
    const satz = opts.steuersatz == null ? STEUER_PREMIUM : opts.steuersatz;
    const steuer = betrag * satz;
    const gebuehr = opts.mitEinstellgebuehr ? betrag * EINSTELLGEBUEHR_SATZ : 0;
    return { steuer, gebuehr, netto: betrag - steuer - gebuehr };
  }

  /** Kaufkosten je Stueck: Sofortkauf ohne Aufschlag, eigene Kauforder + 2,5 % Einstellgebuehr. */
  function kaufKostenJeStueck(preisBasis, weg) {
    return weg === "order" ? preisBasis * (1 + EINSTELLGEBUEHR_SATZ) : preisBasis;
  }

  /**
   * Parst ein API-Datum (z.B. "2026-09-04T20:05:00", von preise.js aus
   * sell_price_min_date/buy_price_max_date der Albion-Online-Data-API) sicher
   * als UTC. Die API liefert diese Zeitstempel ohne Zeitzonen-Kennung. Ein
   * roher new Date(...)/Date.parse(...) auf so einen String interpretiert ihn
   * per ECMAScript-Spezifikation als LOKALE Zeit, nicht als UTC, das ergibt in
   * Mitteleuropa (Sommerzeit) einen Fehler von 2 Stunden bei jeder
   * Altersberechnung. CLAUDE.md, Abschnitt "Albion Online Data Project API":
   * "Zeitstempel sind UTC. Umrechnung in Ortszeit gehoert in den Browser."
   * Belegt am 04.09.2026: ein Preis von 20:05 UTC wurde als "vor 3,2 Std."
   * angezeigt statt korrekt "vor 1,2 Std.", weil new Date() ihn als 20:05
   * Lokalzeit (= 18:05 UTC) las. Betrifft nicht nur die Anzeige
   * (js/ui.js, alterFuerMarktId), sondern auch die Sperrlogik gegen zu alte
   * Preise (preisMitGrund unten): die Ueberschaetzung wirkt konservativ (macht
   * Preise faelschlich AELTER, sperrt also eher zu viel statt zu wenig), ist
   * aber trotzdem ein echter Fehler und keine Kleinigkeit.
   * @returns {number} Millisekunden seit Epoch (UTC), oder NaN bei leerem/
   *   ungueltigem Datum.
   */
  function parseApiDatumUtc(datum) {
    if (!datum) return NaN;
    const hatZone = /[zZ]$|[+-]\d\d:?\d\d$/.test(datum);
    return Date.parse(hatZone ? datum : datum + "Z");
  }

  // -----------------------------------------------------------------------
  // ItemValue: rekursiv aus (Item, Verzauberungsstufe, Rezept), mit
  // Memoisierung und Besuchsschutz. S. ../../CLAUDE.md, Abschnitt "ItemValue
  // genau" fuer die beiden P1-Fehler, die diese Funktion behebt:
  //   1. Division durch amountcrafted (sonst Batch- statt Stueckwert)
  //   2. Stufe der Zutat beruecksichtigen (node.el hat Vorrang vor l, wie bei
  //      der Markt-ID in preise.js, NICHT addieren)
  // `iv` am Knoten ist nur fuer Blaetter vertrauenswuerdig (ivd fehlt/false).
  // Bei allem, was `ivd:true` traegt (rekursiv aus dem Dump abgeleitet, immer
  // nur die Basisstufe), wird hier neu und stufenrichtig gerechnet.
  // -----------------------------------------------------------------------

  const itemWertMemo = new Map();

  function aktuellerGraph(graph) {
    if (graph) return graph;
    return typeof REZEPTGRAPH !== "undefined" ? REZEPTGRAPH : null;
  }

  function zutatStufe(graph, zutatName, zutatL) {
    const node = graph.items[zutatName];
    const el = node && node.el;
    return el ? el : zutatL || 0;
  }

  /**
   * Liefert die Rezeptliste eines Knotens fuer eine angefragte Stufe.
   * Zwei Knotenmuster im Graphen, s. rezepte.js-Schema:
   *
   *  - el-Knoten (veredelte Rohstoffe, Runen, Seelen, Relikte): jede Stufe
   *    ist ein EIGENER uniquename mit eigenem `r`, es gibt kein `e`-Feld.
   *    Die Rezepte in `r` gelten AUSSCHLIESSLICH fuer die Stufe `node.el`
   *    dieses Knotens selbst - fuer jede andere angefragte Stufe (auch 0)
   *    gibt es fuer DIESEN Knoten kein Rezept, das waere ein anderer
   *    uniquename.
   *  - Ausruestung (kein el): Stufe 0 steht in `r`, Stufe 1-4 in
   *    `e[stufe].r`.
   *
   * Ursprung: rechenkern-pruefer hat am 04.09.2026 (P3, Nacharbeit v0.3.1)
   * nachgewiesen, dass eine fruehere Fassung bei el-Knoten faelschlich immer
   * den Ausruestungs-Zweig nahm (stufe>0 -> node.e[...], das bei el-Knoten
   * nie existiert), wodurch fuer alle 299 el-Knoten (verzauberte Stoffe,
   * Leder, Bretter, Barren, Steinbloecke) nie ein Craft-Weg entstand,
   * sondern nur kaufen. Dieselbe Funktion wird von itemWertIntern() unten
   * und von RECHENKERN.kosten() benutzt, damit die Unterscheidung nur an
   * einer Stelle gepflegt wird.
   *
   * @param {object} node Knoten aus REZEPTGRAPH.items
   * @param {number} stufe angefragte Verzauberungsstufe
   * @returns {object[]} Liste der Rezept-Objekte (leer, wenn keine passen)
   */
  function rezepteFuerStufe(node, stufe) {
    if (!node) return [];
    if (node.el) {
      return stufe === node.el ? node.r || [] : [];
    }
    if (stufe > 0) {
      return (node.e && node.e[String(stufe)] && node.e[String(stufe)].r) || [];
    }
    return node.r || [];
  }

  function itemWertRezept(graph, rezept, tiefe, pfad) {
    const amount = (rezept && rezept.a) || 1;
    let summe = 0;
    (rezept.i || []).forEach((zutat) => {
      const zStufe = zutatStufe(graph, zutat.n, zutat.l);
      summe += itemWertIntern(graph, zutat.n, zStufe, undefined, tiefe + 1, pfad) * zutat.c;
    });
    return summe / amount;
  }

  function itemWertIntern(graph, item, stufe, rezeptUeberschreibung, tiefe, pfad) {
    const schluessel = item + "@" + stufe;
    // Besuchsschutz + Tiefenbegrenzung: bei Zyklus oder zu tiefer Rekursion
    // 0 zurueckgeben statt abzustuerzen. Ein Zyklus in echten Spieldaten ist
    // ausgeschlossen (P1 hat den Graphen per Tiefensuche geprueft), der
    // Schutz greift nur bei kuenstlich konstruierten Testgraphen.
    if (tiefe > 60 || pfad.has(schluessel)) return 0;

    const hatUeberschreibung = !!rezeptUeberschreibung;
    const memoSchluessel = hatUeberschreibung ? null : schluessel;
    if (memoSchluessel && itemWertMemo.has(memoSchluessel)) return itemWertMemo.get(memoSchluessel);

    const node = graph.items[item];
    let wert;
    if (!node) {
      wert = 0; // unbekanntes Item ausserhalb des Graphen (z.B. reine Waehrung)
    } else if (!hatUeberschreibung && !node.ivd) {
      // Blattwert, direkt aus dem Dump, s. Funktionskommentar oben.
      wert = node.iv || 0;
    } else {
      const neuerPfad = new Set(pfad);
      neuerPfad.add(schluessel);
      let rezept = rezeptUeberschreibung;
      if (!rezept) {
        rezept = rezepteFuerStufe(node, stufe)[0];
      }
      wert = rezept ? itemWertRezept(graph, rezept, tiefe, neuerPfad) : node.iv || 0;
    }

    if (memoSchluessel) itemWertMemo.set(memoSchluessel, wert);
    return wert;
  }

  /**
   * ItemValue je Stueck von (item, stufe), optional fuer ein konkret
   * uebergebenes Rezept (bei Alternativrezepten haengt die Stationsgebuehr am
   * tatsaechlich gewaehlten Weg, s. kostenrechner-PLAN.md Abschnitt 9).
   * Ohne `rezept` wird das erste Rezept auf dieser Stufe verwendet (Default,
   * fuer die Bewertung von Zutaten waehrend der Rekursion).
   *
   * @param {string} item
   * @param {number} [stufe=0]
   * @param {object} [rezept] konkretes Rezept-Objekt aus rezepte.js
   * @param {object} [graph] Testgraph statt des globalen REZEPTGRAPH
   */
  function itemWert(item, stufe, rezept, graph) {
    const g = aktuellerGraph(graph);
    if (!g) throw new Error("REZEPTGRAPH fehlt - rezepte.js muss vor regeln.js geladen werden");
    return itemWertIntern(g, item, stufe || 0, rezept, 0, new Set());
  }

  function itemWertMemoLeeren() {
    itemWertMemo.clear();
  }

  // -----------------------------------------------------------------------
  // Selbsttest: offline pruefbare Kernregeln. Volle Suite mit rezepte.js-
  // Gegenproben steht in tests/test.html.
  // -----------------------------------------------------------------------

  function selbsttest() {
    const ergebnisse = [];
    function pruefe(name, ok, details) {
      ergebnisse.push({ name, ok: !!ok, details: details || "" });
    }
    function nahe(a, b, toleranz) {
      return Math.abs(a - b) <= (toleranz == null ? 0.5 : toleranz);
    }

    pruefe(
      "Stationsgebuehr: itemWert 576, Satz 380, menge 10 (1 Charge Eintopf) -> 2.462 Silber",
      nahe(stationsgebuehr(576, 10, 380), 2462.4, 1),
      String(stationsgebuehr(576, 10, 380))
    );

    pruefe("RRR B=0,18 -> 15,3 %", nahe(rrr({ cc: "x", stadt: "Nirgendwo" }) * 100, 15.3, 0.1));
    pruefe(
      "RRR B=0,33 (Craft-Bonusstadt) -> 24,8 %",
      nahe(rrr({ cc: "sword", stadt: "Lymhurst" }) * 100, 24.8, 0.1)
    );
    pruefe(
      "RRR B=0,58 (Veredel-Bonusstadt) -> 36,7 %",
      nahe(rrr({ cc: "fiber", stadt: "Lymhurst" }) * 100, 36.7, 0.1)
    );
    pruefe(
      "RRR B=0,77 (Grund+Fokus) -> 43,5 %",
      nahe(rrr({ cc: "x", stadt: "Nirgendwo", mitFokus: true }) * 100, 43.5, 0.1)
    );
    pruefe(
      "RRR B=1,17 (Veredeln+Fokus in Bonusstadt) -> 53,9 %",
      nahe(rrr({ cc: "fiber", stadt: "Lymhurst", mitFokus: true }) * 100, 53.9, 0.1)
    );
    pruefe("RRR ohne craftingcategory -> 0", rrr({ cc: null, stadt: "Lymhurst" }) === 0);

    const sug = steuerUndGebuehr(1751184, { mitEinstellgebuehr: true });
    pruefe("Steuer 1.751.184 -> 70.047", nahe(sug.steuer, 70047, 1), String(sug.steuer));
    pruefe("Einstellgebuehr 1.751.184 -> 43.780", nahe(sug.gebuehr, 43780, 1), String(sug.gebuehr));

    pruefe("Fokus 2.353 bei 1.022 FCE -> 2.192", nahe(fokusKosten(2353, 1022, 1), 2192, 1), String(fokusKosten(2353, 1022, 1)));
    pruefe("Fokus 2.353 bei 55.000 FCE -> 52", nahe(fokusKosten(2353, 55000, 1), 52, 1), String(fokusKosten(2353, 55000, 1)));

    pruefe("Stoffhelm (cloth_helmet) in Lymhurst: kein Craft-Bonus", !hatCraftBonus("cloth_helmet", "Lymhurst"));
    pruefe("Faser (fiber) in Lymhurst: Veredelungsbonus +0,40", hatVeredelBonus("fiber", "Lymhurst"));
    pruefe("Stoffhelm bekommt in Thetford den Craft-Bonus", hatCraftBonus("cloth_helmet", "Thetford"));

    pruefe("Kategorie fiber -> Weber", gebaeudeVonKategorie("fiber") === "Weber");
    pruefe("Kategorie food -> Kueche", gebaeudeVonKategorie("food") === "Kueche");
    pruefe("Kategorie offhand -> eigene Gebuehrengruppe (nicht erfunden zugeordnet)", gebaeudeVonKategorie("offhand") !== "Kriegerschmiede" && gebaeudeVonKategorie("offhand") !== "Jaegerhuette" && gebaeudeVonKategorie("offhand") !== "Magierturm");
    pruefe("Kategorie knuckles -> eigene Gebuehrengruppe", gebaeudeVonKategorie("knuckles") !== null && gebaeudeVonKategorie("knuckles") !== "Kriegerschmiede");
    pruefe("Kategorie meat_cow -> Tierhaltung", gebaeudeVonKategorie("meat_cow") === "Tierhaltung");

    // Spezialisierungsknoten (05.09.2026, Zyklus "FCE-Ableitung ueber
    // Schicksalsbrett-Knotenliste je Kategorie")
    pruefe("spezTypVonKategorie(sword) = waffen_ruestung", spezTypVonKategorie("sword") === "waffen_ruestung");
    pruefe("spezTypVonKategorie(fiber) = veredeln", spezTypVonKategorie("fiber") === "veredeln");
    pruefe("spezTypVonKategorie(cape) = umhang", spezTypVonKategorie("cape") === "umhang");
    pruefe("spezTypVonKategorie(bag) = tasche", spezTypVonKategorie("bag") === "tasche");
    pruefe("spezTypVonKategorie(tools) = werkzeug_fused", spezTypVonKategorie("tools") === "werkzeug_fused");
    pruefe("spezTypVonKategorie(gatherergear) = werkzeug_fused", spezTypVonKategorie("gatherergear") === "werkzeug_fused");
    pruefe("spezTypVonKategorie(food) = speise", spezTypVonKategorie("food") === "speise");
    pruefe("spezTypVonKategorie(potion) = trank", spezTypVonKategorie("potion") === "trank");
    pruefe(
      "spezTypVonKategorie(offhand/knuckles/meat_cow) = null (keine eindeutige Wiki-Zuordnung, bleibt Freitext-Fallback)",
      spezTypVonKategorie("offhand") === null && spezTypVonKategorie("knuckles") === null && spezTypVonKategorie("meat_cow") === null
    );

    pruefe("gruppenSchluesselVonItem(T4_MAIN_SWORD) = MAIN_SWORD", gruppenSchluesselVonItem("T4_MAIN_SWORD") === "MAIN_SWORD");
    pruefe("gruppenSchluesselVonItem(T8_HEAD_CLOTH_SET1) = HEAD_CLOTH_SET1", gruppenSchluesselVonItem("T8_HEAD_CLOTH_SET1") === "HEAD_CLOTH_SET1");
    pruefe(
      "gruppenSchluesselVonItem: Item ohne Tier-Praefix bleibt unveraendert (z.B. Waehrungscodes)",
      gruppenSchluesselVonItem("QUESTITEM_TOKEN_ROYAL_T4") === "QUESTITEM_TOKEN_ROYAL_T4"
    );

    // Bug behoben 05.09.2026 (Browser-Test am fiber-Panel der Koeniglichen
    // Gugel): Veredeln zaehlt nach TIER, nicht nach Verzauberungsstufe.
    // gruppenSchluesselVonItem MUSS bei cc="fiber" (spezTyp "veredeln") das
    // Tier-Praefix BEHALTEN und nur den Verzauberungs-Suffix entfernen -
    // exaktes Gegenteil der Ausruestungs-Regel oben.
    pruefe(
      "gruppenSchluesselVonItem(T4_CLOTH, cc=fiber) = T4_CLOTH (Tier bleibt, kein Suffix zu entfernen)",
      gruppenSchluesselVonItem("T4_CLOTH", "fiber") === "T4_CLOTH"
    );
    pruefe(
      "gruppenSchluesselVonItem(T4_CLOTH_LEVEL3, cc=fiber) = T4_CLOTH (Verzauberungs-Suffix entfernt, Tier bleibt)",
      gruppenSchluesselVonItem("T4_CLOTH_LEVEL3", "fiber") === "T4_CLOTH"
    );
    pruefe(
      "gruppenSchluesselVonItem: T4_CLOTH und T4_CLOTH_LEVEL1..4 (cc=fiber) landen alle im selben Gruppenschluessel",
      ["T4_CLOTH", "T4_CLOTH_LEVEL1", "T4_CLOTH_LEVEL2", "T4_CLOTH_LEVEL3", "T4_CLOTH_LEVEL4"].every(
        (n) => gruppenSchluesselVonItem(n, "fiber") === "T4_CLOTH"
      )
    );
    pruefe(
      "gruppenSchluesselVonItem: T5_CLOTH (cc=fiber) ist ein ANDERER Gruppenschluessel als T4_CLOTH (andere Tier-Stufe, anderer Schicksalsbrett-Knoten)",
      gruppenSchluesselVonItem("T5_CLOTH", "fiber") === "T5_CLOTH" &&
        gruppenSchluesselVonItem("T5_CLOTH", "fiber") !== gruppenSchluesselVonItem("T4_CLOTH", "fiber")
    );
    pruefe(
      "gruppenSchluesselVonItem: ohne cc (oder nicht-veredelnde Kategorie) bleibt die alte Ausruestungs-Regel (Tier-Praefix entfernen) unveraendert",
      gruppenSchluesselVonItem("T4_CLOTH_LEVEL1") === "CLOTH_LEVEL1" &&
        gruppenSchluesselVonItem("T4_HEAD_CLOTH_SET1", "cloth_helmet") === "HEAD_CLOTH_SET1"
    );

    (function () {
      // waffen_ruestung: unique 250, mutual 30, mastery 30. Knoten A Stufe 10,
      // Knoten B Stufe 5 (wirkt nur als Mutual auf A), Meisterschaft 3.
      const stufen = { A: 10, B: 5 };
      const erwartet = 10 * 250 + 5 * 30 + 3 * 30; // 2.500 + 150 + 90 = 2.740
      pruefe(
        "fceAusSpezialisierungsknoten (Waffen/Ruestung): eigener Unique + fremder Mutual + Meisterschaft",
        fceAusSpezialisierungsknoten("sword", "A", stufen, 3) === erwartet,
        fceAusSpezialisierungsknoten("sword", "A", stufen, 3) + " vs " + erwartet
      );
    })();
    (function () {
      // umhang: mutual 0 -> der fremde Knoten B traegt NICHTS bei, nur eigener
      // Unique (370/Stufe) und die eigene Meisterschaft (30/Stufe).
      const stufen = { A: 4, B: 9 };
      const erwartet = 4 * 370 + 9 * 0 + 2 * 30; // 1.480 + 0 + 60 = 1.540
      pruefe(
        "fceAusSpezialisierungsknoten (Umhaenge): kein Mutual-Anteil von anderen Knoten (370/0)",
        fceAusSpezialisierungsknoten("cape", "A", stufen, 2) === erwartet,
        fceAusSpezialisierungsknoten("cape", "A", stufen, 2) + " vs " + erwartet
      );
    })();
    (function () {
      // werkzeug_fused: unique 250, mutual 60, KEINE getrennte Meisterschaft -
      // ein uebergebener Meisterschaftswert wird ignoriert (einFeld: true).
      const stufen = { A: 5, B: 2 };
      const erwartet = 5 * 250 + 2 * 60; // 1.250 + 120 = 1.370, ohne Meisterschaftsanteil
      const mitIgnorierterMeisterschaft = fceAusSpezialisierungsknoten("tools", "A", stufen, 100);
      pruefe(
        "fceAusSpezialisierungsknoten (uebrige Werkzeuge, fused): Meisterschaftsparameter wird ignoriert",
        mitIgnorierterMeisterschaft === erwartet,
        mitIgnorierterMeisterschaft + " vs " + erwartet
      );
    })();
    pruefe(
      "fceAusSpezialisierungsknoten: nicht abgebildete Kategorie (offhand) liefert immer 0",
      fceAusSpezialisierungsknoten("offhand", "X", { X: 50 }, 50) === 0
    );

    if (typeof REZEPTGRAPH !== "undefined") {
      (function () {
        const gruppen = spezialisierungsGruppen("sword");
        const mainSword = gruppen.find((g) => g.schluessel === "MAIN_SWORD");
        pruefe(
          "spezialisierungsGruppen(sword) findet die Gruppe MAIN_SWORD mit T4_MAIN_SWORD bis T8_MAIN_SWORD",
          !!mainSword && mainSword.items.indexOf("T4_MAIN_SWORD") !== -1 && mainSword.items.indexOf("T8_MAIN_SWORD") !== -1,
          JSON.stringify(mainSword)
        );
      })();
      (function () {
        const gruppen = spezialisierungsGruppen("cloth_helmet");
        const gugel = gruppen.find((g) => g.schluessel === "HEAD_CLOTH_SET1");
        pruefe(
          "spezialisierungsGruppen(cloth_helmet) findet die Gruppe HEAD_CLOTH_SET1 (Gelehrtengugel ueber alle Tiers)",
          !!gugel && gugel.items.indexOf("T4_HEAD_CLOTH_SET1") !== -1,
          JSON.stringify(gugel)
        );
      })();
      (function () {
        // Bug behoben 05.09.2026: fiber (Veredeln) muss nach TIER gruppieren,
        // nicht nach Verzauberungsstufe. Vorher zeigte das Panel fuer T4-Stoff
        // faelschlich 5 GETRENNTE Knoten (einen je Verzauberungsstufe:
        // T4_CLOTH, CLOTH_LEVEL1..4), weil der alte gruppenSchluesselVonItem()
        // das Tier-Praefix strippte, aber den Verzauberungs-Suffix im Namen
        // stehen liess. Richtig: T4_CLOTH bis T4_CLOTH_LEVEL4 sind EIN Knoten
        // ("Weberadept"), T5_CLOTH ein ANDERER ("Weberexperte").
        const gruppen = spezialisierungsGruppen("fiber");
        const t4 = gruppen.find((g) => g.schluessel === "T4_CLOTH");
        const t5 = gruppen.find((g) => g.schluessel === "T5_CLOTH");
        pruefe(
          "spezialisierungsGruppen(fiber): T4_CLOTH-Gruppe fasst alle 5 Verzauberungsstufen von T4-Stoff zu EINEM Knoten zusammen",
          !!t4 &&
            t4.items.length === 5 &&
            ["T4_CLOTH", "T4_CLOTH_LEVEL1", "T4_CLOTH_LEVEL2", "T4_CLOTH_LEVEL3", "T4_CLOTH_LEVEL4"].every(
              (n) => t4.items.indexOf(n) !== -1
            ),
          JSON.stringify(t4)
        );
        pruefe(
          "spezialisierungsGruppen(fiber): T5_CLOTH ist eine EIGENE Gruppe (andere Tier-Stufe), nicht mit T4_CLOTH vermischt",
          !!t5 && t5.items.indexOf("T4_CLOTH") === -1 && t4.items.indexOf("T5_CLOTH") === -1,
          JSON.stringify(t5)
        );
        pruefe(
          "spezialisierungsGruppen(fiber): keine Gruppe 'CLOTH_LEVEL1' o.ae. mehr (frueherer Bug, Verzauberungsstufe als eigener Knoten)",
          !gruppen.some((g) => /^CLOTH/.test(g.schluessel)),
          JSON.stringify(gruppen.map((g) => g.schluessel))
        );
      })();
    } else {
      pruefe("spezialisierungsGruppen-Gegenproben uebersprungen (REZEPTGRAPH nicht geladen)", true, "rezepte.js fehlt in diesem Kontext");
    }

    // P5-Nacharbeit (oberflaechen-pruefer, Befund 5): Verteidigung in der Tiefe
    // gegen negative/unsinnige Eingaben direkt in den Kernfunktionen, unabhaengig
    // davon, ob der eigentliche App-Pfad (stationssatzFuer in rechenkern.js,
    // FCE-Kappung in ui.js) bereits schuetzt.
    pruefe(
      "stationsgebuehr: negativer Stationssatz ergibt NIE eine negative Gebuehr (Untergrenze 0)",
      stationsgebuehr(576, 10, -380) === 0,
      String(stationsgebuehr(576, 10, -380))
    );
    pruefe(
      "stationsgebuehr: gueltiger Fall bleibt unveraendert (Regressionsschutz fuer den Floor)",
      nahe(stationsgebuehr(576, 10, 380), 2462.4, 1),
      String(stationsgebuehr(576, 10, 380))
    );
    pruefe(
      "fokusMultiplikator: negative FCE wird bei 0 gekappt, Multiplikator bleibt <= 1 (nie mehr als voller Rohfokus)",
      fokusMultiplikator(-500) === fokusMultiplikator(0) && fokusMultiplikator(-500) === 1,
      String(fokusMultiplikator(-500))
    );
    pruefe(
      "fokusKosten: negative FCE erhoeht die Fokuskosten NIE ueber den Rohwert hinaus",
      fokusKosten(2353, -500, 1) === 2353,
      String(fokusKosten(2353, -500, 1))
    );

    if (typeof REZEPTGRAPH !== "undefined") {
      pruefe(
        "itemWert(T8_MEAL_STEW, 0) = 576 (nicht 5.760, Bug 1: durch amountcrafted teilen)",
        nahe(itemWert("T8_MEAL_STEW", 0), 576, 0.1),
        String(itemWert("T8_MEAL_STEW", 0))
      );
      pruefe(
        "itemWert(T4_SHOES_CLOTH_SET1, 0) = 128",
        nahe(itemWert("T4_SHOES_CLOTH_SET1", 0), 128, 0.1),
        String(itemWert("T4_SHOES_CLOTH_SET1", 0))
      );
      pruefe(
        "itemWert(T4_SHOES_CLOTH_SET1, 1) = 256 (Bug 2: verdoppelt sich je Stufe)",
        nahe(itemWert("T4_SHOES_CLOTH_SET1", 1), 256, 0.1),
        String(itemWert("T4_SHOES_CLOTH_SET1", 1))
      );
      pruefe(
        "itemWert(T4_HEAD_CLOTH_ROYAL, 0) = 160",
        nahe(itemWert("T4_HEAD_CLOTH_ROYAL", 0), 160, 0.1),
        String(itemWert("T4_HEAD_CLOTH_ROYAL", 0))
      );
      pruefe(
        "itemWert(T4_HEAD_CLOTH_ROYAL, 3) = 1.056 (Bug 2: Stufe der Zutat, nicht Basiswert 160)",
        nahe(itemWert("T4_HEAD_CLOTH_ROYAL", 3), 1056, 0.1),
        String(itemWert("T4_HEAD_CLOTH_ROYAL", 3))
      );
    } else {
      pruefe("itemWert-Gegenproben uebersprungen (REZEPTGRAPH nicht geladen)", true, "rezepte.js fehlt in diesem Kontext");
    }

    // Qualitaetsstufen (Feature 05.09.2026)
    pruefe("QUALITAETEN hat 5 Eintraege, Index 0 = Normal, Index 4 = Meisterwerk", QUALITAETEN.length === 5 && QUALITAETEN[0] === "Normal" && QUALITAETEN[4] === "Meisterwerk");
    pruefe(
      "QUALITAETSWURF_BASIS summiert sich auf 1 (68,9+25+5+1+0,1 %)",
      nahe(QUALITAETSWURF_BASIS.reduce((a, b) => a + b, 0), 1, 1e-9)
    );

    pruefe(
      "qualitaetWurfErfolgswahrscheinlichkeit(0, ...) = 1 (Normal wird immer getroffen)",
      qualitaetWurfErfolgswahrscheinlichkeit(0, 0) === 1
    );
    pruefe(
      "qualitaetWurfErfolgswahrscheinlichkeit(Gut, 0 Bonus) = 1 - 0,689 = 31,1 % (ein Wurf auf die Basistabelle)",
      nahe(qualitaetWurfErfolgswahrscheinlichkeit(1, 0), 1 - 0.689, 1e-9)
    );
    pruefe(
      "qualitaetWurfErfolgswahrscheinlichkeit(Meisterwerk, 0 Bonus) = 0,1 % (Basistabelle direkt)",
      nahe(qualitaetWurfErfolgswahrscheinlichkeit(4, 0), 0.001, 1e-9)
    );
    (function () {
      // 100 % Bonus = "1 free reroll" (Korn woertlich): zwei garantierte
      // Wuerfe, bestes Ergebnis zaehlt. P(Erfolg) = 1 - p^2 statt 1 - p.
      const pUnter = 1 - 0.689; // P(ein Wurf >= Gut)
      const erwartet = 1 - Math.pow(1 - pUnter, 2);
      pruefe(
        "qualitaetWurfErfolgswahrscheinlichkeit(Gut, 100 Bonus) = 1 - (P<Gut)^2 (zwei garantierte Wuerfe)",
        nahe(qualitaetWurfErfolgswahrscheinlichkeit(1, 100), erwartet, 1e-9),
        String(qualitaetWurfErfolgswahrscheinlichkeit(1, 100)) + " vs " + erwartet
      );
    })();
    (function () {
      // 150 % Bonus: zwei garantierte Wuerfe plus 50 % Chance auf einen dritten.
      const pEinzelUnter = 0.689; // P(ein Wurf < Gut)
      const mit2 = 1 - Math.pow(pEinzelUnter, 2);
      const mit3 = 1 - Math.pow(pEinzelUnter, 3);
      const erwartet = 0.5 * mit3 + 0.5 * mit2;
      pruefe(
        "qualitaetWurfErfolgswahrscheinlichkeit(Gut, 150 Bonus) = 50/50 zwischen 2 und 3 Wuerfen",
        nahe(qualitaetWurfErfolgswahrscheinlichkeit(1, 150), erwartet, 1e-9),
        String(qualitaetWurfErfolgswahrscheinlichkeit(1, 150)) + " vs " + erwartet
      );
    })();
    pruefe(
      "qualitaetWurfErfolgswahrscheinlichkeit: hoeherer Bonus erhoeht die Erfolgswahrscheinlichkeit nie ueber 1",
      qualitaetWurfErfolgswahrscheinlichkeit(4, 100000) <= 1
    );

    pruefe(
      "rerollUebergaenge(Normal): 'bleibt Normal' auf 0 gekappt (80+15+5+0,1 = 100,1 %, Rundungsartefakt)",
      rerollUebergaenge(0)[0] === 0,
      String(rerollUebergaenge(0)[0])
    );
    pruefe(
      "rerollUebergaenge(Gut): 'bleibt Gut' 30 % (belegter Tabellenwert, keine Kappung noetig)",
      nahe(rerollUebergaenge(1)[1], 0.3, 1e-9)
    );
    pruefe("rerollUebergaenge(Meisterwerk) = null (nicht rerollbar)", rerollUebergaenge(4) === null);
    (function () {
      const summeExz = Object.values(rerollUebergaenge(3)).reduce((a, b) => a + b, 0);
      pruefe("rerollUebergaenge(Exzellent) summiert sich exakt auf 1 (99,5+0,5 %)", nahe(summeExz, 1, 1e-9), String(summeExz));
    })();

    pruefe(
      "rerollKostenZuQualitaet: Ziel <= aktuelle Qualitaet kostet 0 (kein Reroll noetig)",
      rerollKostenZuQualitaet(1000, 0, 0).silber === 0
    );
    (function () {
      // Von Normal auf Gut: praktisch garantiert im ersten Versuch (100,1 %
      // Trefferchance je Reroll, "bleibt Normal" ist 0), also ~1 Reroll-Kosten.
      const r = rerollKostenZuQualitaet(100, 1, 0); // itemWert 100, Ziel Gut
      const jeReroll = 100 * REROLL_FAKTOR[0];
      pruefe(
        "rerollKostenZuQualitaet(Normal->Gut) ~ genau ein Reroll (Erfolgschance ~100 %)",
        nahe(r.silber, jeReroll, 0.5),
        r.silber + " vs " + jeReroll
      );
    })();
    (function () {
      // Von Exzellent auf Meisterwerk: nur 0,5 % Trefferchance je Reroll,
      // erwartete Kosten = Kosten je Reroll / 0,005 = Kosten x 200.
      const itemWertJeStueck = 1000;
      const r = rerollKostenZuQualitaet(itemWertJeStueck, 4, 3);
      const erwartet = (itemWertJeStueck * REROLL_FAKTOR[3]) / 0.005;
      pruefe(
        "rerollKostenZuQualitaet(Exzellent->Meisterwerk) = Kosten je Reroll / 0,5 % (teuerster Schritt)",
        nahe(r.silber, erwartet, 1),
        r.silber + " vs " + erwartet
      );
    })();
    pruefe("rezeptHatPreservequality: erkennt p:true", rezeptHatPreservequality({ i: [{ n: "X", c: 1, p: true }] }) === true);
    pruefe("rezeptHatPreservequality: ohne p:true -> false", rezeptHatPreservequality({ i: [{ n: "X", c: 1 }] }) === false);
    pruefe("rezeptHatPreservequality: leeres/fehlendes Rezept -> false, kein Absturz", rezeptHatPreservequality(null) === false && rezeptHatPreservequality({}) === false);

    // parseApiDatumUtc: API-Daten ohne Zeitzonen-Kennung muessen als UTC
    // gelesen werden, nicht als Lokalzeit (belegter Fehler, s. Funktionskommentar).
    (function () {
      const ohneZ = parseApiDatumUtc("2026-09-04T20:05:00");
      const mitZ = Date.parse("2026-09-04T20:05:00Z");
      pruefe(
        "parseApiDatumUtc: Datum ohne Zeitzonen-Kennung wird als UTC gelesen, nicht als Lokalzeit",
        ohneZ === mitZ,
        "parseApiDatumUtc=" + ohneZ + " erwartet(als UTC)=" + mitZ
      );
      const mitZBereits = parseApiDatumUtc("2026-09-04T20:05:00Z");
      pruefe(
        "parseApiDatumUtc: Datum MIT Zeitzonen-Kennung wird nicht doppelt veraendert",
        mitZBereits === mitZ,
        "parseApiDatumUtc=" + mitZBereits + " erwartet=" + mitZ
      );
      pruefe(
        "parseApiDatumUtc: leeres/fehlendes Datum ergibt NaN, kein falscher Wert",
        Number.isNaN(parseApiDatumUtc("")) && Number.isNaN(parseApiDatumUtc(null)) && Number.isNaN(parseApiDatumUtc(undefined)),
        String(parseApiDatumUtc(""))
      );
    })();

    return ergebnisse;
  }

  return {
    STATIONSGEBUEHR_FAKTOR,
    STEUER_PREMIUM,
    STEUER_OHNE_PREMIUM,
    EINSTELLGEBUEHR_SATZ,
    RRR_GRUNDPRODUKTION,
    RRR_STADTBONUS_CRAFT,
    RRR_STADTBONUS_VEREDELN,
    RRR_FOKUSBONUS,
    RRR_TAGESBONUS_SILBER,
    RRR_TAGESBONUS_GOLD,
    FOKUS_HALBIERUNG_FCE,
    QUALITAETEN,
    QUALITAETSWURF_BASIS,
    REROLL_UEBERGANG,
    REROLL_FAKTOR,
    KATEGORIE_ZU_GEBAEUDE,
    STADTBONUS,
    gebaeudeVonKategorie,
    hatCraftBonus,
    hatVeredelBonus,
    rrr,
    fokusMultiplikator,
    fokusKosten,
    fceAusAbgelesenemFokus,
    SPEZ_TYP,
    KATEGORIE_ZU_SPEZTYP,
    spezTypVonKategorie,
    gruppenSchluesselVonItem,
    spezialisierungsGruppen,
    fceAusSpezialisierungsknoten,
    rerollUebergaenge,
    rerollKostenZuQualitaet,
    qualitaetWurfErfolgswahrscheinlichkeit,
    rezeptHatPreservequality,
    stationsgebuehr,
    steuerUndGebuehr,
    kaufKostenJeStueck,
    parseApiDatumUtc,
    rezepteFuerStufe,
    itemWert,
    itemWertMemoLeeren,
    selbsttest,
  };
})();
