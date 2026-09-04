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
    KATEGORIE_ZU_GEBAEUDE,
    STADTBONUS,
    gebaeudeVonKategorie,
    hatCraftBonus,
    hatVeredelBonus,
    rrr,
    fokusMultiplikator,
    fokusKosten,
    fceAusAbgelesenemFokus,
    stationsgebuehr,
    steuerUndGebuehr,
    kaufKostenJeStueck,
    rezepteFuerStufe,
    itemWert,
    itemWertMemoLeeren,
    selbsttest,
  };
})();
