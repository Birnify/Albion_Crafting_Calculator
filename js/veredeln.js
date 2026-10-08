// js/veredeln.js
//
// Reiter "Veredeln leveln" (08.10.2026): findet Stellen, an denen sich
// Veredeln zum Leveln lohnt. Rohstoff (Faser, Holz, Erz, Stein, Fell) und die
// Vorstufe in einer Stadt kaufen, dort veredeln, das Produkt in derselben
// Stadt wieder verkaufen; gesucht sind Gewinn oder etwa Null.
//
// Bewusst keine eigene Rechenlogik fuer Rueckgewinnung, Stationsgebuehr und
// Fokus: jede Zeile ist der Craft-Kandidat aus RECHENKERN.kosten() mit
// nurDirekteEbene (Zutaten werden gekauft, nur das Veredeln selbst wird
// gerechnet), also exakt dieselben Formeln wie im Kostenrechner
// (REGELN.rrr mit Stadtbonus +0,40 in der Veredelungs-Bonusstadt,
// REGELN.stationsgebuehr, REGELN.fokusKosten). Der Erloes kommt aus
// CHANCEN.erloesJeStueck (Steuer, Einstellgebuehr, Hoechstalter).
//
// Aus den Einstellungen des Kostenrechners kommen nur Werte, die dort schon
// gepflegt sind: Premium, Stationssaetze je Gebaeude, Tagesbonus, FCE und
// Hoechstalter der Preise. Stadt, Kauf- und Verkaufsweg und Fokus waehlt der
// Reiter selbst, weil sie hier die eigentliche Frage sind.
//
// Bewusst NICHT modelliert: Craft-Fame je Vorgang. Dafuer gibt es im Repo
// keinen belegten Wert (s. CLAUDE.md, "Belegte Werte nie ohne neuen Beleg").
// Die Rangliste sortiert deshalb nach Marge, nicht nach Silber je Fame.

const VEREDELN = (function () {
  "use strict";

  const STAEDTE = ["Lymhurst", "Fort Sterling", "Bridgewatch", "Martlock", "Thetford", "Caerleon", "Brecilien"];

  const ROHSTOFFE = [
    { cc: "fiber", label: "Faser → Stoff" },
    { cc: "wood", label: "Holz → Bretter" },
    { cc: "ore", label: "Erz → Barren" },
    { cc: "rock", label: "Stein → Blöcke" },
    { cc: "hide", label: "Fell → Leder" },
  ];

  const TIERS = [2, 3, 4, 5, 6, 7, 8];
  const STUFEN = [0, 1, 2, 3, 4];
  const TAGE_FENSTER = 7;
  const SPEICHER_KEY = "albion_kostenrechner_veredeln_v1";

  function standardEinstellungen() {
    return {
      staedte: ["Lymhurst"],
      rohstoffe: ROHSTOFFE.map((r) => r.cc),
      tiers: [4, 5, 6, 7, 8],
      stufen: STUFEN.slice(),
      kaufweg: "sofort",
      verkaufsweg: "sofort",
      mitFokus: false,
      toleranzProzent: 5,
      menge: 1000,
      verlusteZeigen: false,
    };
  }

  /** Gespeicherten Stand gegen die erlaubten Werte pruefen; Unbekanntes faellt weg, Fehlendes kommt aus dem Standard. */
  function einstellungenBereinigen(roh) {
    const basis = standardEinstellungen();
    if (!roh || typeof roh !== "object") return basis;
    const liste = (wert, erlaubt) => (Array.isArray(wert) ? erlaubt.filter((x) => wert.indexOf(x) !== -1) : null);
    const staedte = liste(roh.staedte, STAEDTE);
    const rohstoffe = liste(roh.rohstoffe, ROHSTOFFE.map((r) => r.cc));
    const tiers = liste(roh.tiers, TIERS);
    const stufen = liste(roh.stufen, STUFEN);
    return {
      staedte: staedte || basis.staedte,
      rohstoffe: rohstoffe || basis.rohstoffe,
      tiers: tiers || basis.tiers,
      stufen: stufen || basis.stufen,
      kaufweg: roh.kaufweg === "order" ? "order" : "sofort",
      verkaufsweg: roh.verkaufsweg === "order" ? "order" : "sofort",
      mitFokus: !!roh.mitFokus,
      toleranzProzent: isFinite(Number(roh.toleranzProzent)) && roh.toleranzProzent !== "" && roh.toleranzProzent != null ? Math.max(0, Number(roh.toleranzProzent)) : basis.toleranzProzent,
      menge: isFinite(Number(roh.menge)) && Number(roh.menge) > 0 ? Number(roh.menge) : basis.menge,
      verlusteZeigen: !!roh.verlusteZeigen,
    };
  }

  function aktuellerGraph(graph) {
    if (graph) return graph;
    return typeof REZEPTGRAPH !== "undefined" ? REZEPTGRAPH : null;
  }

  function marktIdVon(item, stufe, graph) {
    const g = aktuellerGraph(graph);
    const node = (g && g.items[item]) || {};
    const effektiv = node.el ? node.el : stufe || 0;
    return effektiv > 0 ? item + "@" + effektiv : item;
  }

  /**
   * Rezepte mit Fraktionsmarke (T1_FACTION_*_TOKEN_1) fallen weg: die Marke
   * hat keinen Marktpreis, das Rezept waere immer gesperrt. Ebenso Rezepte mit
   * Waehrungskosten.
   */
  function rezeptIstMarktfaehig(rezept) {
    if (!rezept || (rezept.cur && rezept.cur.length)) return false;
    return !(rezept.i || []).some((z) => /^T\d_FACTION_/.test(z.n));
  }

  /**
   * Alle Veredelungsvorgaenge der Auswahl: je veredeltem Item jedes
   * marktfaehige Rezept. Beim Stein sind das mehrere je Item (verzauberter
   * Stein ergibt 2/4/8 normale Bloecke, verzauberte Bloecke gibt es nicht).
   *
   * @returns {{item:string, stufe:number, tier:number, cc:string, rezeptIndex:number, menge:number, zutaten:{n:string,c:number,stufe:number}[], marktId:string}[]}
   */
  function kandidaten(auswahl, graph) {
    const g = aktuellerGraph(graph);
    if (!g) return [];
    const ccs = auswahl.rohstoffe || [];
    const tiers = auswahl.tiers || [];
    const stufen = auswahl.stufen || [];
    const out = [];
    Object.keys(g.items)
      .sort()
      .forEach((item) => {
        const node = g.items[item];
        if (!node || ccs.indexOf(node.cc) === -1 || tiers.indexOf(node.t) === -1) return;
        const stufe = node.el || 0;
        (node.r || []).forEach((rezept, idx) => {
          if (!rezeptIstMarktfaehig(rezept)) return;
          const zutaten = (rezept.i || []).map((z) => {
            const zNode = g.items[z.n];
            return { n: z.n, c: z.c, stufe: zNode && zNode.el ? zNode.el : z.l || 0 };
          });
          // Beim Stein bestimmt die Stufe des eingesetzten Steins die
          // "Verzauberung" des Vorgangs, das Produkt selbst bleibt .0.
          const vorgangsStufe = Math.max(stufe, ...zutaten.map((z) => z.stufe));
          if (stufen.indexOf(vorgangsStufe) === -1) return;
          out.push({
            item,
            stufe,
            vorgangsStufe,
            tier: node.t,
            cc: node.cc,
            rezeptIndex: idx,
            menge: rezept.a || 1,
            zutaten,
            marktId: marktIdVon(item, stufe, g),
          });
        });
      });
    return out;
  }

  /** Markt-IDs fuer den Preisabruf: die Produkte plus alle direkten Zutaten. */
  function benoetigteMarktIds(kandidatenListe, graph) {
    const ids = new Set();
    kandidatenListe.forEach((k) => {
      ids.add(k.marktId);
      k.zutaten.forEach((z) => ids.add(marktIdVon(z.n, z.stufe, graph)));
    });
    return Array.from(ids);
  }

  /**
   * Den Craft-Kandidaten genau dieses Rezepts aus kosten().alleWege holen,
   * mit oder ohne Fokus. Der Rechenkern waehlt sonst selbst den billigsten
   * Weg, und der waere oft "kaufen", hier ist aber gerade das Veredeln die
   * Frage.
   */
  function craftKandidatAus(kostenErgebnis, rezeptIndex, mitFokus) {
    const alle = (kostenErgebnis && kostenErgebnis.alleWege) || [];
    return (
      alle.find((k) => k.typ === "craften" && k.weg && k.weg.rezeptIndex === rezeptIndex && !!k.weg.mitFokus === !!mitFokus) || null
    );
  }

  /**
   * Eine Ergebniszeile. Rein rechnerisch, ohne DOM und Netz.
   * gewinnJeStueck = Erloes netto - (Material nach Rueckgewinnung + Gebuehr).
   * Je Vorgang = mal Ausbeute des Rezepts, insgesamt = mal geplanter Menge.
   * marge bezieht sich auf die eigenen Silberkosten.
   */
  function zeileBauen(kandidat, stadt, craft, erloes, absatzEintrag, opts) {
    opts = opts || {};
    const menge = opts.menge > 0 ? opts.menge : 1;
    const toleranz = (opts.toleranzProzent || 0) / 100;
    const z = {
      stadt,
      item: kandidat.item,
      stufe: kandidat.stufe,
      vorgangsStufe: kandidat.vorgangsStufe,
      tier: kandidat.tier,
      cc: kandidat.cc,
      marktId: kandidat.marktId,
      rezeptIndex: kandidat.rezeptIndex,
      ausbeute: kandidat.menge,
      zutaten: kandidat.zutaten,
      stueckJeTag: absatzEintrag && isFinite(absatzEintrag.stueckJeTag) ? absatzEintrag.stueckJeTag : null,
      rrr: null,
      stadtbonus: REGELN.hatVeredelBonus(kandidat.cc, stadt),
      silber: null,
      gebuehr: null,
      fokusJeVorgang: null,
      erloes: erloes ? erloes.netto : null,
      gewinn: null,
      marge: null,
      gewinnJeVorgang: null,
      gewinnGesamt: null,
      einstufung: null,
      grund: null,
    };
    if (!craft || craft.gesperrt || craft.silber == null) {
      z.grund = craft && craft.grund ? craft.grund : "kein Veredelungsweg";
      return z;
    }
    z.rrr = craft.weg.rrr;
    z.silber = craft.silber;
    z.gebuehr = craft.weg.stationsgebuehrJeStueck;
    z.fokusJeVorgang = (craft.fokus || 0) * kandidat.menge;
    if (!erloes || erloes.netto == null) {
      z.grund = (erloes && erloes.grund) || "kein Verkaufspreis";
      return z;
    }
    z.gewinn = erloes.netto - craft.silber;
    z.marge = craft.silber > 0 ? z.gewinn / craft.silber : null;
    z.gewinnJeVorgang = z.gewinn * kandidat.menge;
    z.gewinnGesamt = z.gewinn * menge;
    z.einstufung = einstufen(z.gewinn, craft.silber, toleranz);
    return z;
  }

  /** "gewinn" ab 0, "null" bis toleranz (Anteil der Kosten) im Minus, sonst "verlust". */
  function einstufen(gewinn, kosten, toleranz) {
    if (gewinn == null) return null;
    if (gewinn >= 0) return "gewinn";
    if (kosten > 0 && -gewinn <= kosten * (toleranz || 0)) return "null";
    return "verlust";
  }

  /** Nur Zeilen mit Ergebnis; ohne verlusteZeigen nur Gewinn und etwa Null. Sortiert nach Marge absteigend. */
  function filtereUndSortiere(zeilen, opts) {
    opts = opts || {};
    return zeilen
      .filter((z) => z.gewinn != null && z.marge != null)
      .filter((z) => opts.verlusteZeigen || z.einstufung !== "verlust")
      .sort((a, b) => b.marge - a.marge);
  }

  // -----------------------------------------------------------------------
  // Selbsttest (reine Funktionen, kein Netz, kein DOM)
  // -----------------------------------------------------------------------

  function selbsttest() {
    const ergebnisse = [];
    function pruefe(name, ok, details) {
      ergebnisse.push({ name, ok: !!ok, details: details == null ? "" : String(details) });
    }

    const kand = kandidaten({ rohstoffe: ["fiber"], tiers: [4], stufen: [0, 1, 2, 3, 4] });
    pruefe(
      "kandidaten: T4-Stoff liefert je Stufe genau ein Rezept, das Rezept mit Fraktionsmarke faellt weg",
      kand.length === 5 && kand.every((k) => k.rezeptIndex === 0 && k.zutaten.every((z) => !/FACTION/.test(z.n))),
      kand.map((k) => k.item + "#" + k.rezeptIndex).join(", ")
    );
    const t4 = kand.find((k) => k.item === "T4_CLOTH");
    pruefe(
      "kandidaten: T4-Stoff braucht 2 Faser T4 und 1 Stoff T3",
      t4 && t4.zutaten.length === 2 && t4.zutaten[0].n === "T4_FIBER" && t4.zutaten[0].c === 2 && t4.zutaten[1].n === "T3_CLOTH",
      t4 && JSON.stringify(t4.zutaten)
    );
    const t5drei = kandidaten({ rohstoffe: ["fiber"], tiers: [5], stufen: [3] });
    pruefe(
      "kandidaten: verzaubert traegt die Stufe in der Markt-ID, Vorstufe ebenfalls verzaubert",
      t5drei.length === 1 && t5drei[0].marktId === "T5_CLOTH_LEVEL3@3" && benoetigteMarktIds(t5drei).indexOf("T4_CLOTH_LEVEL3@3") !== -1,
      t5drei.map((k) => k.marktId).join(",") + " / " + benoetigteMarktIds(t5drei).join(",")
    );
    const stein = kandidaten({ rohstoffe: ["rock"], tiers: [5], stufen: [0, 1, 2, 3, 4] });
    pruefe(
      "kandidaten: Stein T5 hat vier Vorgaenge (Stein .0 bis .3), Ausbeute 1/2/4/8 Bloecke",
      stein.length === 4 && stein.map((k) => k.menge).join(",") === "1,2,4,8" && stein.map((k) => k.vorgangsStufe).join(",") === "0,1,2,3",
      stein.map((k) => k.vorgangsStufe + ":" + k.menge).join(",")
    );
    const nurStufe2 = kandidaten({ rohstoffe: ["rock"], tiers: [5], stufen: [2] });
    pruefe(
      "kandidaten: Stufenfilter greift beim Stein ueber den eingesetzten Stein",
      nurStufe2.length === 1 && nurStufe2[0].menge === 4,
      nurStufe2.length
    );

    pruefe(
      "einstellungenBereinigen: Unbekanntes faellt weg, Fehlendes kommt aus dem Standard",
      (function () {
        const e = einstellungenBereinigen({ staedte: ["Lymhurst", "Atlantis"], tiers: [4, 9], kaufweg: "quatsch", toleranzProzent: -3 });
        return e.staedte.join() === "Lymhurst" && e.tiers.join() === "4" && e.kaufweg === "sofort" && e.toleranzProzent === 0 && e.rohstoffe.length === 5;
      })(),
      JSON.stringify(einstellungenBereinigen({ staedte: ["Lymhurst", "Atlantis"], tiers: [4, 9] }))
    );

    pruefe(
      "einstufen: Gewinn ab 0, etwa Null bis zur Toleranz, darunter Verlust",
      einstufen(0, 100, 0.05) === "gewinn" && einstufen(-5, 100, 0.05) === "null" && einstufen(-5.1, 100, 0.05) === "verlust",
      [einstufen(0, 100, 0.05), einstufen(-5, 100, 0.05), einstufen(-5.1, 100, 0.05)].join(",")
    );

    // Integration mit dem Rechenkern, Lymhurst (Faser-Bonusstadt), ohne Fokus,
    // Weber-Satz 0: T4-Stoff aus 2 Faser a 100 und 1 T3-Stoff a 200.
    // RRR = 0,58/1,58; Kosten = (2*100 + 200) * (1 - RRR) = 400 / 1,58 = 253,16.
    const preise = {
      T4_FIBER: { sell: { preis: 100, kein: false, datum: "" }, buy: { kein: true } },
      T3_CLOTH: { sell: { preis: 200, kein: false, datum: "" }, buy: { kein: true } },
      T4_CLOTH: { sell: { kein: true }, buy: { preis: 300, kein: false, datum: "" } },
    };
    const optsBasis = {
      preise,
      kaufweg: "sofort",
      stadt: "Lymhurst",
      stationssaetze: { Weber: 0 },
      fokusAus: true,
      nurDirekteEbene: true,
    };
    const erg = RECHENKERN.kosten("T4_CLOTH", 0, 1, optsBasis);
    const craft = craftKandidatAus(erg, 0, false);
    pruefe(
      "craftKandidatAus: Veredeln in Lymhurst rechnet mit 36,7 % Rueckgewinnung auf Faser UND Vorstufe",
      craft && Math.abs(craft.silber - 400 / 1.58) < 0.01 && Math.abs(craft.weg.rrr - 0.58 / 1.58) < 1e-9,
      craft && craft.silber
    );
    const erloes = CHANCEN.erloesJeStueck(preise.T4_CLOTH, { verkaufsweg: "sofort", premium: true });
    const zeile = zeileBauen(kand[0], "Lymhurst", craft, erloes, { stueckJeTag: 50 }, { menge: 1000, toleranzProzent: 5 });
    pruefe(
      "zeileBauen: Sofortverkauf 300 mit 4 % Steuer = 288, Gewinn = 288 - 253,16, insgesamt mal Menge",
      Math.abs(zeile.gewinn - (288 - 400 / 1.58)) < 0.01 && Math.abs(zeile.gewinnGesamt - zeile.gewinn * 1000) < 0.01 && zeile.einstufung === "gewinn" && zeile.stadtbonus,
      JSON.stringify({ gewinn: zeile.gewinn, gesamt: zeile.gewinnGesamt, einstufung: zeile.einstufung })
    );
    const ohneBonus = craftKandidatAus(RECHENKERN.kosten("T4_CLOTH", 0, 1, Object.assign({}, optsBasis, { stadt: "Martlock" })), 0, false);
    pruefe(
      "craftKandidatAus: ausserhalb der Bonusstadt nur Grundproduktion (15,3 %)",
      ohneBonus && Math.abs(ohneBonus.weg.rrr - 0.18 / 1.18) < 1e-9,
      ohneBonus && ohneBonus.weg.rrr
    );
    const mitFokus = craftKandidatAus(RECHENKERN.kosten("T4_CLOTH", 0, 1, Object.assign({}, optsBasis, { fokusAus: false })), 0, true);
    pruefe(
      "craftKandidatAus: mit Fokus 53,9 % Rueckgewinnung in Lymhurst und Fokus aus dem Dump (54 bei FCE 0)",
      mitFokus && Math.abs(mitFokus.weg.rrr - 1.17 / 2.17) < 1e-9 && Math.abs(mitFokus.fokus - 54) < 1e-9,
      mitFokus && mitFokus.weg.rrr + " / " + mitFokus.fokus
    );
    const ohnePreis = zeileBauen(kand[0], "Lymhurst", craft, { netto: null, grund: "keine Kauforder am Markt" }, null, {});
    pruefe(
      "zeileBauen: ohne Verkaufspreis kein erfundener Gewinn",
      ohnePreis.gewinn === null && ohnePreis.grund === "keine Kauforder am Markt",
      JSON.stringify(ohnePreis.grund)
    );
    const sortiert = filtereUndSortiere(
      [
        { gewinn: 1, marge: 0.01, einstufung: "gewinn" },
        { gewinn: -1, marge: -0.02, einstufung: "null" },
        { gewinn: -50, marge: -0.5, einstufung: "verlust" },
        { gewinn: 10, marge: 0.2, einstufung: "gewinn" },
        { gewinn: null, marge: null, einstufung: null },
      ],
      {}
    );
    pruefe(
      "filtereUndSortiere: Verluste und Zeilen ohne Preis fallen raus, sortiert nach Marge",
      sortiert.length === 3 && sortiert[0].marge === 0.2 && sortiert[2].einstufung === "null",
      sortiert.map((z) => z.marge).join(",")
    );

    return ergebnisse;
  }

  // -----------------------------------------------------------------------
  // Oberflaeche
  // -----------------------------------------------------------------------

  function boot() {
    const wurzel = document.getElementById("tab-veredeln");
    if (!wurzel) return; // z.B. tests/test.html
    const el = (id) => document.getElementById(id);
    const staedteEl = el("vdStaedte");
    const rohstoffeEl = el("vdRohstoffe");
    const tiersEl = el("vdTiers");
    const stufenEl = el("vdStufen");
    const kaufwegEl = el("vdKaufweg");
    const verkaufswegEl = el("vdVerkaufsweg");
    const fokusEl = el("vdFokus");
    const toleranzEl = el("vdToleranz");
    const mengeEl = el("vdMenge");
    const verlusteEl = el("vdVerluste");
    const startEl = el("vdStart");
    const statusEl = el("vdStatus");
    const ausgabeEl = el("vdAusgabe");

    let auswahl = standardEinstellungen();
    let letzteZeilen = null;
    let laeuft = false;

    try {
      auswahl = einstellungenBereinigen(JSON.parse(localStorage.getItem(SPEICHER_KEY) || "null"));
    } catch (e) {
      auswahl = standardEinstellungen();
    }

    function speichern() {
      try {
        localStorage.setItem(SPEICHER_KEY, JSON.stringify(auswahl));
      } catch (e) {
        /* localStorage evtl. nicht verfuegbar */
      }
    }

    const namenNachMarktId = {};
    (typeof ITEM_NAMEN !== "undefined" && ITEM_NAMEN.alle ? ITEM_NAMEN.alle : []).forEach((e) => {
      namenNachMarktId[e.id] = e.n;
    });
    function nameVon(item, stufe) {
      const id = marktIdVon(item, stufe);
      return namenNachMarktId[id] || (REZEPTGRAPH.namen && REZEPTGRAPH.namen[item]) || id;
    }
    const fmt = (n) => (typeof UI !== "undefined" && UI.formatSilber ? UI.formatSilber(n) : String(Math.round(n)));
    const fmtFokus = (n) => (typeof UI !== "undefined" && UI.formatFokus ? UI.formatFokus(n) : String(Math.round(n)));
    const prozent = (a) => (a * 100).toFixed(1).replace(".", ",") + " %";
    const stueck = (n) => (n == null ? "k. A." : n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(".", ","));

    function checkboxGruppe(container, titel, werte, label, gewaehlt, schluessel, tooltip) {
      const alle = gewaehlt.length === werte.length;
      container.title = tooltip || "";
      container.innerHTML =
        `<div class="t">${titel}<button type="button" class="mini" data-alle="${schluessel}">${alle ? "Alle abwählen" : "Alle auswählen"}</button></div>` +
        werte
          .map((w) => `<label><input type="checkbox" data-gruppe="${schluessel}" value="${w}"${gewaehlt.indexOf(w) !== -1 ? " checked" : ""}>${label(w)}</label>`)
          .join("");
    }

    const GRUPPEN = {
      staedte: { el: staedteEl, titel: "Städte", werte: STAEDTE, label: (s) => s, parse: (v) => v, tooltip: "In jeder angehakten Stadt wird eingekauft, veredelt und wieder verkauft. Eine Stadt mit Veredelungsbonus erscheint in der Tabelle mit +40 %." },
      rohstoffe: { el: rohstoffeEl, titel: "Rohstoffe", werte: ROHSTOFFE.map((r) => r.cc), label: (cc) => ROHSTOFFE.find((r) => r.cc === cc).label, parse: (v) => v },
      tiers: { el: tiersEl, titel: "Tier", werte: TIERS, label: (t) => "T" + t, parse: Number, tooltip: "Tier des veredelten Produkts. T2 ist gebührenfrei." },
      stufen: { el: stufenEl, titel: "Verzauberung", werte: STUFEN, label: (s) => "." + s, parse: Number, tooltip: "Beim Stein zählt die Verzauberung des eingesetzten Steins; verzauberter Stein ergibt 2, 4 oder 8 normale Blöcke." },
    };

    function gruppenAufbauen() {
      Object.keys(GRUPPEN).forEach((k) => {
        const g = GRUPPEN[k];
        checkboxGruppe(g.el, g.titel, g.werte, g.label, auswahl[k], k, g.tooltip);
      });
    }

    function felderSetzen() {
      kaufwegEl.value = auswahl.kaufweg;
      verkaufswegEl.value = auswahl.verkaufsweg;
      fokusEl.value = auswahl.mitFokus ? "mit" : "ohne";
      toleranzEl.value = auswahl.toleranzProzent;
      mengeEl.value = auswahl.menge;
      verlusteEl.checked = auswahl.verlusteZeigen;
    }

    function felderLesen() {
      auswahl = einstellungenBereinigen(
        Object.assign({}, auswahl, {
          kaufweg: kaufwegEl.value,
          verkaufsweg: verkaufswegEl.value,
          mitFokus: fokusEl.value === "mit",
          toleranzProzent: toleranzEl.value,
          menge: mengeEl.value,
          verlusteZeigen: verlusteEl.checked,
        })
      );
      speichern();
    }

    wurzel.addEventListener("change", (ev) => {
      const box = ev.target.closest("input[data-gruppe]");
      if (box) {
        const g = GRUPPEN[box.dataset.gruppe];
        const an = Array.from(g.el.querySelectorAll("input:checked")).map((x) => g.parse(x.value));
        auswahl[box.dataset.gruppe] = g.werte.filter((w) => an.indexOf(w) !== -1);
        speichern();
        checkboxGruppe(g.el, g.titel, g.werte, g.label, auswahl[box.dataset.gruppe], box.dataset.gruppe, g.tooltip);
        return;
      }
      felderLesen();
      // Toleranz, Menge und Verluste-Schalter brauchen keinen neuen Abruf.
      if (letzteZeilen && [toleranzEl, mengeEl, verlusteEl].indexOf(ev.target) !== -1) neuBewerten();
    });
    wurzel.addEventListener("click", (ev) => {
      const knopf = ev.target.closest("button[data-alle]");
      if (!knopf) return;
      const k = knopf.dataset.alle;
      const g = GRUPPEN[k];
      auswahl[k] = auswahl[k].length === g.werte.length ? [] : g.werte.slice();
      speichern();
      checkboxGruppe(g.el, g.titel, g.werte, g.label, auswahl[k], k, g.tooltip);
    });

    function rezeptText(z) {
      return z.zutaten.map((x) => x.c + "× " + nameVon(x.n, x.stufe)).join(" + ");
    }

    function render(zeilen, gesamt, kontext) {
      if (!zeilen.length) {
        ausgabeEl.innerHTML =
          "<div class='ch-hinweis'>Von " + gesamt + " geprüften Vorgängen bringt keiner Gewinn oder liegt innerhalb der Toleranz. Toleranz erhöhen, „Verluste zeigen“ anhaken oder andere Städte wählen.</div>";
        return;
      }
      const kopf =
        "<tr><th>Stadt</th><th>Produkt</th><th>Einsatz je Vorgang</th><th class='num' title='Rückgewinnungsquote laut Stadtbonus, Fokus und Tagesbonus'>Rückgew.</th>" +
        "<th class='num' title='Material nach Rückgewinnung plus Stationsgebühr, je Stück Produkt'>Kosten/Stück</th>" +
        "<th class='num' title='Verkaufspreis nach Steuer (und Einstellgebühr bei eigener Verkaufsorder)'>Erlös/Stück</th>" +
        "<th class='num'>Gewinn/Stück</th><th class='num' title='Gewinn bezogen auf die eigenen Kosten'>Marge</th>" +
        "<th class='num' title='Ein Veredelungsvorgang; beim Stein aus verzaubertem Stein entstehen 2, 4 oder 8 Blöcke'>Gewinn/Vorgang</th>" +
        "<th class='num' title='Gewinn je Stück mal der eingestellten Menge'>Gewinn gesamt</th>" +
        "<th class='num' title='Erfasster Handel des Produkts in dieser Stadt, Mittel der letzten " + TAGE_FENSTER + " Tage. Untergrenze: gemeldet wird nur, was Spieler mit laufendem Data-Client sehen.'>verkauft/Tag</th><th>Ergebnis</th></tr>";
      const body = zeilen
        .map((z) => {
          const klasse = z.einstufung === "gewinn" ? "vd-gewinn" : z.einstufung === "null" ? "vd-null" : "vd-verlust";
          const text = z.einstufung === "gewinn" ? "Gewinn" : z.einstufung === "null" ? "etwa Null" : "Verlust";
          const bonus = z.stadtbonus ? " <span class='vd-bonus' title='Veredelungsbonus dieser Stadt, +0,40 Produktionsbonus'>+40 %</span>" : "";
          const fokus = z.fokusJeVorgang > 0 ? "<br><span class='ch-klein'>" + fmtFokus(z.fokusJeVorgang) + " Fokus/Vorgang</span>" : "";
          const ausbeute = z.ausbeute > 1 ? " <span class='ch-klein'>(" + z.ausbeute + " Stück)</span>" : "";
          return (
            "<tr>" +
            "<td>" + z.stadt + bonus + "</td>" +
            "<td>" + nameVon(z.item, z.stufe) + " <span class='ch-klein'>T" + z.tier + "." + z.vorgangsStufe + "</span>" + ausbeute + "</td>" +
            "<td class='ch-klein'>" + rezeptText(z) + "</td>" +
            "<td class='num'>" + prozent(z.rrr) + fokus + "</td>" +
            "<td class='num'>" + fmt(z.silber) + "</td>" +
            "<td class='num'>" + fmt(z.erloes) + "</td>" +
            "<td class='num'>" + fmt(z.gewinn) + "</td>" +
            "<td class='num'>" + prozent(z.marge) + "</td>" +
            "<td class='num'>" + fmt(z.gewinnJeVorgang) + "</td>" +
            "<td class='num'>" + fmt(z.gewinnGesamt) + "</td>" +
            "<td class='num'>" + stueck(z.stueckJeTag) + "</td>" +
            "<td class='" + klasse + "'>" + text + "</td>" +
            "</tr>"
          );
        })
        .join("");
      ausgabeEl.innerHTML =
        "<table class='ch-tabelle vd-tabelle'>" + kopf + body + "</table>" +
        "<div class='ch-hinweis' style='margin-top:10px'>" +
        zeilen.length + " von " + gesamt + " geprüften Vorgängen. Einkauf " +
        (kontext.kaufweg === "order" ? "über eigene Kauforder (+2,5 % Einstellgebühr)" : "per Sofortkauf aus den Verkaufsorders") +
        ", Verkauf " + (kontext.verkaufsweg === "order" ? "über eigene Verkaufsorder" : "per Sofortverkauf in die Kauforders") +
        ", Steuer " + (kontext.premium ? "4 % (Premium)" : "8 % (ohne Premium)") +
        ", " + (kontext.mitFokus ? "mit Fokus (FCE aus dem Kostenrechner)" : "ohne Fokus") +
        ". Rohstoff und Vorstufe werden gekauft. Stationssätze, Tagesbonus und Höchstalter der Preise kommen aus den Einstellungen des Kostenrechners. Craft-Fame ist nicht eingerechnet." +
        "</div>";
    }

    function neuBewerten() {
      if (!letzteZeilen) return;
      const toleranz = auswahl.toleranzProzent / 100;
      letzteZeilen.zeilen.forEach((z) => {
        if (z.gewinn == null) return;
        z.gewinnGesamt = z.gewinn * auswahl.menge;
        z.einstufung = einstufen(z.gewinn, z.silber, toleranz);
      });
      const gefiltert = filtereUndSortiere(letzteZeilen.zeilen, { verlusteZeigen: auswahl.verlusteZeigen });
      render(gefiltert, letzteZeilen.zeilen.length, letzteZeilen.kontext);
    }

    async function suchen() {
      if (laeuft) return;
      felderLesen();
      if (!auswahl.staedte.length || !auswahl.rohstoffe.length || !auswahl.tiers.length || !auswahl.stufen.length) {
        statusEl.textContent = "Mindestens eine Stadt, einen Rohstoff, ein Tier und eine Verzauberung anhaken.";
        return;
      }
      laeuft = true;
      startEl.disabled = true;
      ausgabeEl.innerHTML = "";
      try {
        const einstellungen = UI.einstellungenLesen();
        const kand = kandidaten(auswahl);
        const ids = benoetigteMarktIds(kand);
        const produktIds = Array.from(new Set(kand.map((k) => k.marktId)));
        const maxPreisAlterMin =
          einstellungen.maxPreisAlterMin === "" || einstellungen.maxPreisAlterMin == null ? null : Number(einstellungen.maxPreisAlterMin);
        const zeilen = [];
        for (let i = 0; i < auswahl.staedte.length; i++) {
          const stadt = auswahl.staedte[i];
          const vorsatz = stadt + " (" + (i + 1) + "/" + auswahl.staedte.length + "): ";
          const preiseRoh = await PREISE.preiseAbrufen(ids, {
            stadt,
            qualitaet: 1,
            aufFortschritt: (f, g) => {
              statusEl.textContent = vorsatz + "Preise " + f + "/" + g + " ...";
            },
          });
          statusEl.textContent = vorsatz + "Handelsvolumen ...";
          const absatz = await PREISE.absatzAbrufen(produktIds, { stadt, tageFenster: TAGE_FENSTER });
          const preise = CHANCEN.preiseZuOptsFormat(preiseRoh);
          const opts = {
            preise,
            eigenpreise: {},
            kaufweg: auswahl.kaufweg,
            stadt,
            stationssaetze: einstellungen.stationssaetze,
            fce: einstellungen.fce,
            fceUeberschreibungen: UI.fceUeberschreibungenAus(einstellungen),
            fokusAus: !auswahl.mitFokus,
            fokusRegelJeKategorie: {},
            fokusUebersteuerungJeKnoten: {},
            fokuswert: 0,
            tagesbonus: einstellungen.tagesbonus,
            maxPreisAlterMin,
            nurDirekteEbene: true,
          };
          kand.forEach((k) => {
            const craft = craftKandidatAus(RECHENKERN.kosten(k.item, k.stufe, 1, opts), k.rezeptIndex, auswahl.mitFokus);
            const erloes = CHANCEN.erloesJeStueck(preiseRoh[k.marktId], {
              verkaufsweg: auswahl.verkaufsweg,
              premium: einstellungen.premium,
              maxPreisAlterMin,
            });
            zeilen.push(zeileBauen(k, stadt, craft, erloes, (absatz[k.marktId] || {})[1], auswahl));
          });
        }
        letzteZeilen = {
          zeilen,
          kontext: { kaufweg: auswahl.kaufweg, verkaufsweg: auswahl.verkaufsweg, premium: einstellungen.premium !== false, mitFokus: auswahl.mitFokus },
        };
        neuBewerten();
        const mitErgebnis = zeilen.filter((z) => z.gewinn != null).length;
        const gewinne = zeilen.filter((z) => z.einstufung === "gewinn").length;
        statusEl.textContent =
          "Fertig: " + gewinne + " mit Gewinn, " + zeilen.filter((z) => z.einstufung === "null").length + " etwa Null. " +
          (zeilen.length - mitErgebnis) + " von " + zeilen.length + " Vorgängen ohne vollständige Preise.";
      } catch (e) {
        statusEl.textContent = "Fehler: " + (e && e.message ? e.message : e);
        if (typeof console !== "undefined") console.error(e);
      } finally {
        laeuft = false;
        startEl.disabled = false;
      }
    }

    gruppenAufbauen();
    felderSetzen();
    startEl.addEventListener("click", suchen);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }

  return {
    STAEDTE,
    ROHSTOFFE,
    standardEinstellungen,
    einstellungenBereinigen,
    rezeptIstMarktfaehig,
    kandidaten,
    benoetigteMarktIds,
    craftKandidatAus,
    zeileBauen,
    einstufen,
    filtereUndSortiere,
    selbsttest,
  };
})();
