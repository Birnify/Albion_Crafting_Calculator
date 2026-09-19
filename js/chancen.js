// js/chancen.js
//
// Reiter "Schnelles Geld" (19.09.2026): zeigt auf Ebene eines
// Schicksalsbrett-Knotens (z. B. "Gelehrtengugel"), welche Stufe und welche
// Qualitaet sich gerade zu craften lohnt, und wie viele Stueck davon am Tag
// ueberhaupt gehandelt werden.
//
// Bewusst wenige Eingaben (Nutzer-Vorgabe 19.09.2026: "mache mir die eingaben
// wirklich einfach ... es geht um das schnelle geld"): Knoten waehlen, zwei
// Schwellen, fertig. Alles Weitere (Stadt, Kauf-/Verkaufsweg, Premium, FCE,
// Stationssaetze, Fokuswert, Hoechstalter der Preise) kommt unveraendert aus
// den Einstellungen des Kostenrechner-Reiters, damit es keine zweite Stelle
// gibt, an der dieselben Werte gepflegt werden muessen.
//
// ZWEI PUNKTE, DIE MAN BEIM LESEN DER TABELLE WISSEN MUSS:
//
// 1. "Verkauft/Tag" ist der von der Albion-Online-Data-API ERFASSTE Umsatz
//    (history/, item_count, Mittel ueber die letzten 7 Tage), also das, was
//    die Data-Clients der Spieler gemeldet haben. Das ist eine Untergrenze,
//    kein amtlicher Absatz (s. CLAUDE.md, "Bekannte Grenze: prices/ kann fuer
//    echte, aktuelle Marktangebote leer bleiben"). Die Oberflaeche benennt das
//    ausdruecklich so, statt "Absatz" zu behaupten.
// 2. Gerechnet wird mit Materialeinkauf auf der DIREKTEN Ebene
//    (RECHENKERN-Option nurDirekteEbene): die Zutaten des Rezepts werden
//    gekauft, nicht ihrerseits gecraftet. Das ist die ausdrueckliche Vorgabe
//    des Nutzers fuer diesen Reiter ("Beschaffungskosten der Materialien auf
//    der direkten Ebene"). Wer wissen will, ob Eigenveredeln billiger waere,
//    nimmt den Kostenrechner-Reiter.

const CHANCEN = (function () {
  "use strict";

  // Tier-Titel der deutschen Item-Namen. Aus ihnen wird der Knotenname
  // abgeleitet: "Gelehrtengugel des Adepten" -> "Gelehrtengugel". Feste Liste
  // statt einer allgemeinen Regel, damit ein Name wie "Gugel der Reinheit"
  // nicht versehentlich beschnitten wird.
  const TIER_TITEL = [
    "des Novizen",
    "des Gesellen",
    "des Adepten",
    "des Experten",
    "des Meisters",
    "des Großmeisters",
    "des Ältesten",
  ];

  const ALLE_QUALITAETEN = [1, 2, 3, 4, 5];
  const TAGE_FENSTER = 7;

  function aktuellerGraph(graph) {
    if (graph) return graph;
    return typeof REZEPTGRAPH !== "undefined" ? REZEPTGRAPH : null;
  }

  /** "Gelehrtengugel des Adepten" -> "Gelehrtengugel". Unbekannte Muster bleiben unveraendert. */
  function tierTitelEntfernen(name) {
    if (!name) return "";
    let out = String(name).trim();
    TIER_TITEL.forEach((titel) => {
      if (out.endsWith(" " + titel)) out = out.slice(0, out.length - titel.length - 1).trim();
    });
    return out;
  }

  /**
   * Anzeigename eines Knotens. Bei Kategorien mit gepflegter Knotenliste
   * (Speisen, s. REGELN.SPEZ_KNOTEN) steht der echte Name des
   * Schicksalsbrett-Fensters schon in gruppe.label; sonst wird er aus dem
   * Item-Namen der niedrigsten Stufe abgeleitet.
   */
  function knotenLabel(gruppe, graph) {
    if (gruppe.label) return gruppe.label;
    const g = aktuellerGraph(graph);
    const namen = (g && g.namen) || {};
    const sortiert = (gruppe.items || []).slice().sort();
    for (let i = 0; i < sortiert.length; i++) {
      const kurz = tierTitelEntfernen(namen[sortiert[i]]);
      if (kurz) return kurz;
    }
    return gruppe.schluessel;
  }

  /**
   * Alle waehlbaren Knoten, gruppiert nach Gebaeude. Grundlage ist
   * REGELN.spezialisierungsGruppen() je craftingcategory, also dieselbe
   * Knotenliste wie im FCE-Panel des Kostenrechners.
   *
   * Veredeln (fiber/ore/rock/hide/wood) bleibt bewusst drin: auch Barren und
   * Stoff lassen sich verkaufen, und gerade dort ist der schnelle Umsatz.
   *
   * @returns {{gebaeude:string, knoten:{cc:string, schluessel:string, label:string, items:string[]}[]}[]}
   */
  function knotenNachGebaeude(graph) {
    const g = aktuellerGraph(graph);
    if (!g) return [];
    const kategorien = {};
    Object.keys(g.items).forEach((item) => {
      const cc = g.items[item] && g.items[item].cc;
      if (cc) kategorien[cc] = true;
    });
    const nachGebaeude = {};
    Object.keys(kategorien).forEach((cc) => {
      const gebaeude = REGELN.gebaeudeVonKategorie(cc) || "Ohne Gebaeude (" + cc + ")";
      REGELN.spezialisierungsGruppen(cc, g).forEach((gruppe) => {
        if (!gruppe.items || !gruppe.items.length) return;
        if (!nachGebaeude[gebaeude]) nachGebaeude[gebaeude] = [];
        nachGebaeude[gebaeude].push({
          cc,
          schluessel: gruppe.schluessel,
          label: knotenLabel(gruppe, g),
          items: gruppe.items.slice(),
        });
      });
    });
    return Object.keys(nachGebaeude)
      .sort()
      .map((gebaeude) => ({
        gebaeude,
        knoten: nachGebaeude[gebaeude].sort((a, b) => a.label.localeCompare(b.label, "de")),
      }));
  }

  /** Sucht einen Knoten ueber seinen Auswahlschluessel "cc|gruppe". */
  function knotenFinden(wert, graph) {
    if (!wert) return null;
    const trenner = wert.indexOf("|");
    if (trenner < 0) return null;
    const cc = wert.slice(0, trenner);
    const schluessel = wert.slice(trenner + 1);
    const gruppe = REGELN.spezialisierungsGruppen(cc, aktuellerGraph(graph)).find((x) => x.schluessel === schluessel);
    if (!gruppe) return null;
    return { cc, schluessel, label: knotenLabel(gruppe, graph), items: gruppe.items.slice() };
  }

  /** Markt-ID wie in js/preise.js (verzauberte Stufen tragen "@N"). */
  function marktIdVon(item, stufe, graph) {
    const g = aktuellerGraph(graph);
    const node = (g && g.items[item]) || {};
    const effektiv = node.el ? node.el : stufe || 0;
    return effektiv > 0 ? item + "@" + effektiv : item;
  }

  /** Verzauberungsstufen, fuer die dieses Item ueberhaupt ein Rezept hat. */
  function stufenMitRezept(item, graph) {
    const g = aktuellerGraph(graph);
    const node = g && g.items[item];
    if (!node) return [];
    const out = [];
    for (let stufe = 0; stufe <= 4; stufe++) {
      const rezepte = REGELN.rezepteFuerStufe(node, stufe);
      const hatVerzaubern = stufe > 0 && node.e && node.e[String(stufe)] && node.e[String(stufe)].u;
      if ((rezepte && rezepte.length) || hatVerzaubern) out.push(stufe);
    }
    return out;
  }

  /**
   * Alle Zeilen-Kandidaten eines Knotens: jedes Item des Knotens, jede Stufe
   * mit Rezept, jede Qualitaet. Nicht qualifizierbare Items (Speisen,
   * Traenke, Werkzeuge ausser Angelrute, s. REGELN.istQualifizierbar) kommen
   * nur in Normal vor, statt vier unsinnige Zeilen zu erzeugen.
   */
  function kandidaten(knoten, graph) {
    const g = aktuellerGraph(graph);
    const out = [];
    (knoten.items || []).forEach((item) => {
      const node = g && g.items[item];
      if (!node) return;
      const qualitaeten = REGELN.istQualifizierbar(item, node.cc || null) ? ALLE_QUALITAETEN : [1];
      stufenMitRezept(item, g).forEach((stufe) => {
        qualitaeten.forEach((q) => out.push({ item, stufe, qualitaet: q, marktId: marktIdVon(item, stufe, g) }));
      });
    });
    return out;
  }

  /**
   * Markt-IDs, deren Normal-Preis fuer die Rechnung gebraucht wird: die
   * Produkte selbst (Kauf-Vergleich und Verzauber-Vorstufe) plus die direkten
   * Zutaten aller Rezepte plus die Verzauber-Materialien (Runen, Seelen,
   * Relikte). Bewusst NICHT der ganze Rezeptbaum: tiefer wird hier gar nicht
   * gerechnet (s. Modulkommentar, nurDirekteEbene).
   */
  function benoetigteMarktIds(kandidatenListe, graph) {
    const g = aktuellerGraph(graph);
    const ids = new Set();
    kandidatenListe.forEach((k) => {
      ids.add(k.marktId);
      const node = g && g.items[k.item];
      if (!node) return;
      REGELN.rezepteFuerStufe(node, k.stufe).forEach((rezept) => {
        (rezept.i || []).forEach((zutat) => {
          const zStufe = zutat.l != null ? zutat.l : 0;
          ids.add(marktIdVon(zutat.n, zStufe, g));
        });
      });
      if (k.stufe > 0 && node.e && node.e[String(k.stufe)] && node.e[String(k.stufe)].u) {
        const u = node.e[String(k.stufe)].u;
        (u.res || []).forEach((res) => ids.add(marktIdVon(res.n, 0, g)));
        ids.add(marktIdVon(k.item, k.stufe - 1, g));
      }
    });
    return Array.from(ids);
  }

  /** Markt-IDs, fuer die zusaetzlich Preise in Qualitaet 2..5 gebraucht werden. */
  function qualitaetsMarktIds(kandidatenListe) {
    const ids = {};
    kandidatenListe.forEach((k) => {
      if (k.qualitaet === 1) return;
      if (!ids[k.qualitaet]) ids[k.qualitaet] = new Set();
      ids[k.qualitaet].add(k.marktId);
    });
    const out = {};
    Object.keys(ids).forEach((q) => {
      out[q] = Array.from(ids[q]);
    });
    return out;
  }

  /** Preis-Rohdaten von js/preise.js ins Format von RECHENKERN.kosten(opts.preise). */
  function preiseZuOptsFormat(preiseRoh) {
    const out = {};
    Object.keys(preiseRoh || {}).forEach((id) => {
      const e = preiseRoh[id];
      out[id] = e ? { sell: e.sell, buy: e.buy } : { sell: { kein: true }, buy: { kein: true } };
    });
    return out;
  }

  /**
   * Verkaufserloes je Stueck nach Steuer und Einstellgebuehr. Dieselben
   * Konventionen wie im Kostenrechner (s. CLAUDE.md "Handelskonventionen"):
   * Verkaufsorder rechnet gegen sell_price_min und zahlt zusaetzlich 2,5 %
   * Einstellgebuehr, Sofortverkauf gegen buy_price_max ohne sie.
   *
   * Ein zu alter Preis wird wie kein Preis behandelt, mit derselben Grenze
   * wie im Rechenkern (maxPreisAlterMin). Reine Funktion, offline testbar.
   *
   * @returns {{netto:?number, brutto:?number, grund:?string, alterMin:?number}}
   */
  function erloesJeStueck(eintrag, opts) {
    opts = opts || {};
    const verkaufsweg = opts.verkaufsweg === "sofort" ? "sofort" : "order";
    const steuersatz = opts.premium === false ? REGELN.STEUER_OHNE_PREMIUM : REGELN.STEUER_PREMIUM;
    const jetzt = opts.jetzt == null ? Date.now() : opts.jetzt;
    if (!eintrag) return { netto: null, brutto: null, grund: "kein Preis abgerufen", alterMin: null };
    const seite = verkaufsweg === "order" ? eintrag.sell : eintrag.buy;
    if (!seite || seite.kein || seite.preis == null || seite.preis <= 0) {
      return {
        netto: null,
        brutto: null,
        grund: verkaufsweg === "order" ? "kein Verkaufsangebot am Markt" : "kein Kaufgesuch am Markt",
        alterMin: null,
      };
    }
    let alterMin = null;
    if (seite.datum) {
      const t = REGELN.parseApiDatumUtc(seite.datum);
      if (isFinite(t)) alterMin = (jetzt - t) / 60000;
    }
    if (opts.maxPreisAlterMin != null && alterMin != null && alterMin > opts.maxPreisAlterMin) {
      return { netto: null, brutto: seite.preis, grund: "Preis ist " + Math.round(alterMin) + " Minuten alt", alterMin };
    }
    const sug = REGELN.steuerUndGebuehr(seite.preis, { steuersatz, mitEinstellgebuehr: verkaufsweg === "order" });
    return { netto: sug.netto, brutto: seite.preis, grund: null, alterMin };
  }

  /**
   * Baut eine Ergebniszeile aus Kostenrechnung, Erloes und Absatz.
   * Rein rechnerisch, ohne DOM und ohne Netz, damit sie testbar bleibt.
   *
   * marge ist der Gewinn bezogen auf die eigenen Silberkosten (0,25 = 25 %),
   * nicht auf den Verkaufspreis. gewinnJeTag ist der Gewinn je Stueck mal dem
   * erfassten Tagesumsatz, also die Obergrenze dessen, was sich abschoepfen
   * liesse, wenn man den ganzen erfassten Handel selbst bediente.
   */
  function zeileBauen(kandidat, kosten, erloes, absatzEintrag) {
    const stueckJeTag = absatzEintrag && isFinite(absatzEintrag.stueckJeTag) ? absatzEintrag.stueckJeTag : 0;
    const basis = {
      item: kandidat.item,
      stufe: kandidat.stufe,
      qualitaet: kandidat.qualitaet,
      marktId: kandidat.marktId,
      stueckJeTag,
      silber: null,
      fokus: null,
      erloes: erloes ? erloes.netto : null,
      gewinn: null,
      marge: null,
      gewinnJeTag: null,
      weg: kosten && !kosten.gesperrt ? kosten.weg : null,
      grund: null,
    };
    if (!kosten || kosten.gesperrt || kosten.silber == null) {
      basis.grund = kosten && kosten.grund ? kosten.grund : "kein Beschaffungsweg";
      return basis;
    }
    basis.silber = kosten.silber;
    basis.fokus = kosten.fokus;
    if (erloes.netto == null) {
      basis.grund = erloes.grund || "kein Verkaufspreis";
      return basis;
    }
    basis.gewinn = erloes.netto - kosten.silber;
    basis.marge = kosten.silber > 0 ? basis.gewinn / kosten.silber : null;
    basis.gewinnJeTag = basis.gewinn * stueckJeTag;
    return basis;
  }

  /**
   * Filtert nach den beiden Schwellen und sortiert nach Gewinn je Tag
   * absteigend. Zeilen ohne Gewinn oder ohne Preis fallen immer heraus: in
   * einer Liste, die "was lohnt sich gerade" beantwortet, waeren sie nur
   * Rauschen.
   */
  function filtereUndSortiere(zeilen, opts) {
    opts = opts || {};
    const minAbsatz = opts.minAbsatz != null ? opts.minAbsatz : 0;
    const minMarge = opts.minMarge != null ? opts.minMarge : 0; // als Anteil, 0,05 = 5 %
    return zeilen
      .filter((z) => z.gewinn != null && z.marge != null)
      .filter((z) => z.stueckJeTag >= minAbsatz)
      .filter((z) => z.marge >= minMarge)
      .sort((a, b) => (b.gewinnJeTag || 0) - (a.gewinnJeTag || 0));
  }

  // -----------------------------------------------------------------------
  // Selbsttest (reine Funktionen, kein Netz, kein DOM)
  // -----------------------------------------------------------------------

  function selbsttest() {
    const ergebnisse = [];
    function pruefe(name, ok, details) {
      ergebnisse.push({ name, ok: !!ok, details: details == null ? "" : String(details) });
    }

    pruefe(
      "tierTitelEntfernen: Tier-Titel faellt weg, Rest bleibt unangetastet",
      tierTitelEntfernen("Gelehrtengugel des Adepten") === "Gelehrtengugel" &&
        tierTitelEntfernen("Gugel der Reinheit des Ältesten") === "Gugel der Reinheit" &&
        tierTitelEntfernen("Rindfleischeintopf") === "Rindfleischeintopf",
      tierTitelEntfernen("Gugel der Reinheit des Ältesten")
    );

    const knoten = knotenFinden("cloth_helmet|HEAD_CLOTH_SET1");
    pruefe(
      "knotenFinden: Stoffhelm-Knoten wird gefunden und traegt den Item-Namen ohne Tier-Titel",
      knoten && knoten.label === "Gelehrtengugel" && knoten.items.length >= 5,
      knoten ? knoten.label + " / " + knoten.items.length + " Items" : "nicht gefunden"
    );

    if (knoten) {
      const kand = kandidaten(knoten);
      const t8drei = kand.filter((k) => k.item === "T8_HEAD_CLOTH_SET1" && k.stufe === 3);
      pruefe(
        "kandidaten: qualifizierbares Item liefert alle 5 Qualitaeten je Stufe",
        t8drei.length === 5 && t8drei.every((k) => k.marktId === "T8_HEAD_CLOTH_SET1@3"),
        t8drei.length + " Zeilen, marktId " + (t8drei[0] && t8drei[0].marktId)
      );
      const ids = benoetigteMarktIds(kand);
      // Verzauberter Stoff traegt seine Stufe in der Markt-ID ("@3", s.
      // marktIdVon/js/preise.js marktId), die Faser als Zutat der Zutat darf
      // gar nicht erst auftauchen - sie wird in diesem Reiter nie gerechnet.
      pruefe(
        "benoetigteMarktIds: direkte Zutat (verzauberter Stoff) ist dabei, tiefere Ebene (Faser) nicht",
        ids.indexOf("T8_CLOTH_LEVEL3@3") >= 0 && ids.indexOf("T8_FIBER") < 0,
        "Stoff: " + (ids.indexOf("T8_CLOTH_LEVEL3@3") >= 0) + ", Faser: " + (ids.indexOf("T8_FIBER") >= 0)
      );
    }

    const eintopfKnoten = knotenFinden("food|EINTOEPFE");
    if (eintopfKnoten) {
      const kand = kandidaten(eintopfKnoten);
      pruefe(
        "kandidaten: Speisen sind nicht qualifizierbar und kommen nur in Normal vor",
        kand.length > 0 && kand.every((k) => k.qualitaet === 1),
        kand.length + " Zeilen, Qualitaeten " + Array.from(new Set(kand.map((k) => k.qualitaet))).join(",")
      );
      pruefe("knotenFinden: Speisen tragen den Namen aus dem Schicksalsbrett-Fenster", eintopfKnoten.label === "Eintoepfe", eintopfKnoten.label);
    }

    // Erloes: 100.000 Verkaufsorder mit Premium -> 4 % Steuer + 2,5 % Gebuehr = 93.500
    const e1 = erloesJeStueck({ sell: { preis: 100000, kein: false, datum: "" }, buy: { kein: true } }, { verkaufsweg: "order", premium: true });
    pruefe("erloesJeStueck: Verkaufsorder mit Premium zieht 4 % Steuer und 2,5 % Einstellgebuehr ab", Math.abs(e1.netto - 93500) < 0.5, e1.netto);

    const e2 = erloesJeStueck({ sell: { kein: true }, buy: { preis: 100000, kein: false, datum: "" } }, { verkaufsweg: "sofort", premium: true });
    pruefe("erloesJeStueck: Sofortverkauf zahlt nur Steuer, keine Einstellgebuehr", Math.abs(e2.netto - 96000) < 0.5, e2.netto);

    const e3 = erloesJeStueck({ sell: { kein: true, preis: null }, buy: { kein: true } }, { verkaufsweg: "order" });
    pruefe("erloesJeStueck: kein Angebot liefert null mit Grund, niemals 0", e3.netto === null && !!e3.grund, JSON.stringify(e3));

    const jetzt = Date.parse("2026-09-19T12:00:00Z");
    const e4 = erloesJeStueck({ sell: { preis: 100000, kein: false, datum: "2026-09-10T12:00:00" }, buy: { kein: true } }, { verkaufsweg: "order", maxPreisAlterMin: 4320, jetzt });
    pruefe("erloesJeStueck: zu alter Preis zaehlt wie kein Preis (Hoechstalter wie im Rechenkern)", e4.netto === null && /Minuten alt/.test(e4.grund), e4.grund);

    // Zeile: Gewinn, Marge und Gewinn je Tag haengen zusammen
    const z = zeileBauen(
      { item: "T8_HEAD_CLOTH_SET1", stufe: 3, qualitaet: 4, marktId: "T8_HEAD_CLOTH_SET1@3" },
      { gesperrt: false, silber: 200000, fokus: 1000, weg: { typ: "craften" } },
      { netto: 250000, grund: null },
      { stueckJeTag: 12 }
    );
    pruefe(
      "zeileBauen: Gewinn = Erloes - Silberkosten, Marge auf die Kosten bezogen, Gewinn/Tag = Gewinn x Absatz",
      z.gewinn === 50000 && Math.abs(z.marge - 0.25) < 1e-9 && z.gewinnJeTag === 600000,
      JSON.stringify({ gewinn: z.gewinn, marge: z.marge, gewinnJeTag: z.gewinnJeTag })
    );

    const zGesperrt = zeileBauen({ item: "X", stufe: 0, qualitaet: 1, marktId: "X" }, { gesperrt: true, grund: "kein Preis", silber: null }, { netto: 1000 }, null);
    pruefe(
      "zeileBauen: gesperrter Weg liefert keinen erfundenen Gewinn, sondern den Grund",
      zGesperrt.gewinn === null && zGesperrt.silber === null && zGesperrt.grund === "kein Preis",
      JSON.stringify(zGesperrt)
    );

    const gefiltert = filtereUndSortiere(
      [
        { gewinn: 10, marge: 0.5, stueckJeTag: 100, gewinnJeTag: 1000 },
        { gewinn: 100, marge: 0.5, stueckJeTag: 2, gewinnJeTag: 200 },
        { gewinn: 1000, marge: 0.01, stueckJeTag: 100, gewinnJeTag: 100000 },
        { gewinn: null, marge: null, stueckJeTag: 999, gewinnJeTag: null },
      ],
      { minAbsatz: 5, minMarge: 0.05 }
    );
    pruefe(
      "filtereUndSortiere: beide Schwellen greifen, Zeilen ohne Gewinn fallen raus, sortiert nach Gewinn je Tag",
      gefiltert.length === 1 && gefiltert[0].gewinnJeTag === 1000,
      JSON.stringify(gefiltert.map((z) => z.gewinnJeTag))
    );

    const gebaeude = knotenNachGebaeude();
    pruefe(
      "knotenNachGebaeude: liefert Gruppen je Gebaeude, darunter Kueche und Magierturm",
      gebaeude.length > 3 && gebaeude.some((g) => g.gebaeude === "Kueche") && gebaeude.some((g) => g.gebaeude === "Magierturm"),
      gebaeude.map((g) => g.gebaeude).join(", ")
    );

    return ergebnisse;
  }

  // -----------------------------------------------------------------------
  // Oberflaeche
  // -----------------------------------------------------------------------

  function boot() {
    const knotenEl = document.getElementById("chKnoten");
    if (!knotenEl) return; // z.B. tests/test.html, dort gibt es kein App-Markup
    const minAbsatzEl = document.getElementById("chMinAbsatz");
    const minMargeEl = document.getElementById("chMinMarge");
    const startEl = document.getElementById("chStart");
    const statusEl = document.getElementById("chStatus");
    const ausgabeEl = document.getElementById("chAusgabe");

    const zustand = { laeuft: false };

    function formatSilber(n) {
      return typeof UI !== "undefined" && UI.formatSilber ? UI.formatSilber(n) : String(Math.round(n));
    }
    function formatFokus(n) {
      return typeof UI !== "undefined" && UI.formatFokus ? UI.formatFokus(n) : String(Math.round(n));
    }
    function formatProzent(anteil) {
      return (anteil * 100).toFixed(1).replace(".", ",") + " %";
    }
    function formatStueck(n) {
      return n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(".", ",");
    }
    function nameVon(item) {
      return (REZEPTGRAPH.namen && REZEPTGRAPH.namen[item]) || item;
    }
    function stufenText(stufe) {
      return stufe > 0 ? "." + stufe : ".0";
    }

    function knotenAuswahlFuellen() {
      const gruppen = knotenNachGebaeude();
      const html = gruppen
        .map((g) => {
          const optionen = g.knoten
            .map((k) => `<option value="${k.cc}|${k.schluessel}">${k.label}</option>`)
            .join("");
          return `<optgroup label="${g.gebaeude}">${optionen}</optgroup>`;
        })
        .join("");
      knotenEl.innerHTML = html;
      // Vorbelegung: der Knoten, den der Nutzer als Beispiel genannt hat.
      const vorgabe = Array.from(knotenEl.options).find((o) => o.value === "cloth_helmet|HEAD_CLOTH_SET1");
      if (vorgabe) knotenEl.value = vorgabe.value;
    }

    function basisOpts(einstellungen, goldpreis) {
      return {
        eigenpreise: (function () {
          const alle = PREISE.eigenpreiseAlle();
          const out = {};
          Object.keys(alle).forEach((id) => {
            out[id] = alle[id].preis;
          });
          return out;
        })(),
        kaufweg: einstellungen.kaufweg,
        stadt: einstellungen.stadt,
        qualitaetsChancenpunkte: einstellungen.qualitaetsChancenpunkte || 0,
        stationssaetze: einstellungen.stationssaetze,
        fce: einstellungen.fce,
        fceUeberschreibungen: UI.fceUeberschreibungenAus(einstellungen),
        silberRabattFaktor: REGELN.silberRabattFaktor(goldpreis),
        fokusRegelJeKategorie: einstellungen.fokusRegelJeKategorie,
        fokusUebersteuerungJeKnoten: einstellungen.fokusUebersteuerungJeKnoten,
        fokuswert: einstellungen.fokuswert,
        tagesbonus: einstellungen.tagesbonus,
        maxPreisAlterMin:
          einstellungen.maxPreisAlterMin === "" || einstellungen.maxPreisAlterMin == null ? null : Number(einstellungen.maxPreisAlterMin),
        nurDirekteEbene: true,
      };
    }

    function renderTabelle(zeilen, gesamtZeilen, einstellungen) {
      if (!zeilen.length) {
        ausgabeEl.innerHTML =
          "<div class='ch-hinweis'>Nichts gefunden. Von " +
          gesamtZeilen +
          " geprüften Zeilen hat keine beide Schwellen geschafft. Schwellen senken, oder einen anderen Knoten wählen.</div>";
        return;
      }
      const kopf =
        "<tr><th>Item</th><th>Qualität</th><th class='num'>verkauft/Tag</th><th class='num'>Material + Gebühr</th>" +
        "<th class='num'>Erlös netto</th><th class='num'>Gewinn/Stück</th><th class='num'>Marge</th><th class='num'>Gewinn/Tag</th><th>Weg</th></tr>";
      const zeilenHtml = zeilen
        .map((z) => {
          // UI.wegLabelKurz erwartet den KANDIDATEN ({typ, weg}), nicht das
          // innere weg-Objekt; z.weg ist das innere Objekt (s. zeileBauen).
          const wegText =
            typeof UI !== "undefined" && UI.wegLabelKurz && z.weg ? UI.wegLabelKurz({ typ: z.weg.typ, weg: z.weg }) : z.weg ? z.weg.typ : "-";
          const fokusText = z.fokus > 0 ? " <span class='ch-klein'>+ " + formatFokus(z.fokus) + " Fokus</span>" : "";
          return (
            "<tr>" +
            "<td>" + nameVon(z.item) + " <span class='ch-klein'>" + stufenText(z.stufe) + "</span></td>" +
            "<td>" + REGELN.QUALITAETEN[z.qualitaet - 1] + "</td>" +
            "<td class='num'>" + formatStueck(z.stueckJeTag) + "</td>" +
            "<td class='num'>" + formatSilber(z.silber) + fokusText + "</td>" +
            "<td class='num'>" + formatSilber(z.erloes) + "</td>" +
            "<td class='num'>" + formatSilber(z.gewinn) + "</td>" +
            "<td class='num'>" + formatProzent(z.marge) + "</td>" +
            "<td class='num'>" + formatSilber(z.gewinnJeTag) + "</td>" +
            "<td class='ch-klein'>" + wegText + "</td>" +
            "</tr>"
          );
        })
        .join("");
      ausgabeEl.innerHTML =
        "<table class='ch-tabelle'>" + kopf + zeilenHtml + "</table>" +
        "<div class='ch-hinweis' style='margin-top:10px'>" +
        zeilen.length + " von " + gesamtZeilen + " geprüften Zeilen. Stadt " + einstellungen.stadt +
        ", Einkauf " + (einstellungen.kaufweg === "order" ? "eigene Kauforder" : "Sofortkauf") +
        ", Verkauf " + (einstellungen.verkaufsweg === "order" ? "eigene Verkaufsorder" : "Sofortverkauf") +
        ". Material wird auf der direkten Ebene gekauft, nicht selbst gecraftet. " +
        "Fokus zählt mit dem Fokuswert aus den Einstellungen (Vorgabe 0, Fokus geht dann als gratis in den Gewinn ein und steht nur als Menge in der Spalte). " +
        "„verkauft/Tag\" ist der von der Albion-Online-Data-API erfasste Handel der letzten " + TAGE_FENSTER +
        " Tage, geteilt durch " + TAGE_FENSTER + "; gemeldet wird nur, was Spieler mit laufendem Data-Client sehen, die echte Zahl liegt also eher höher." +
        "</div>";
    }

    async function suchen() {
      if (zustand.laeuft) return;
      const wert = knotenEl.value;
      const knoten = knotenFinden(wert);
      if (!knoten) {
        statusEl.textContent = "Knoten nicht gefunden.";
        return;
      }
      zustand.laeuft = true;
      startEl.disabled = true;
      ausgabeEl.innerHTML = "";
      try {
        const einstellungen = UI.einstellungenLesen();
        const kand = kandidaten(knoten);
        const normalIds = benoetigteMarktIds(kand);
        const qIds = qualitaetsMarktIds(kand);

        statusEl.textContent = "Preise werden geholt (" + normalIds.length + " Einträge) ...";
        const preiseNormalRoh = await PREISE.preiseAbrufen(normalIds, {
          stadt: einstellungen.stadt,
          qualitaet: 1,
          aufFortschritt: (fertig, gesamt) => {
            statusEl.textContent = "Preise werden geholt ... " + fertig + "/" + gesamt;
          },
        });

        const preiseQRoh = {};
        for (const q of Object.keys(qIds)) {
          statusEl.textContent = "Preise in Qualität " + REGELN.QUALITAETEN[Number(q) - 1] + " werden geholt ...";
          preiseQRoh[q] = await PREISE.preiseAbrufen(qIds[q], { stadt: einstellungen.stadt, qualitaet: Number(q) });
        }

        statusEl.textContent = "Handelsvolumen wird geholt ...";
        const produktIds = Array.from(new Set(kand.map((k) => k.marktId)));
        const absatz = await PREISE.absatzAbrufen(produktIds, { stadt: einstellungen.stadt, tageFenster: TAGE_FENSTER });

        const gold = await PREISE.goldpreisAbrufen();
        statusEl.textContent = "Wird gerechnet ...";

        const preiseNormal = preiseZuOptsFormat(preiseNormalRoh);
        const preiseQ = {};
        Object.keys(preiseQRoh).forEach((q) => {
          preiseQ[q] = preiseZuOptsFormat(preiseQRoh[q]);
        });
        const basis = basisOpts(einstellungen, gold ? gold.preis : null);

        const zeilen = kand.map((k) => {
          const opts = Object.assign({}, basis, {
            preise: preiseNormal,
            preiseQualitaet: k.qualitaet > 1 ? preiseQ[String(k.qualitaet)] || {} : {},
            qualitaetsIndex: k.qualitaet - 1,
          });
          const kosten = RECHENKERN.kosten(k.item, k.stufe, 1, opts);
          const preisEintrag = k.qualitaet > 1 ? (preiseQRoh[String(k.qualitaet)] || {})[k.marktId] : preiseNormalRoh[k.marktId];
          const erloes = erloesJeStueck(preisEintrag, {
            verkaufsweg: einstellungen.verkaufsweg,
            premium: einstellungen.premium,
            maxPreisAlterMin: basis.maxPreisAlterMin,
          });
          return zeileBauen(k, kosten, erloes, (absatz[k.marktId] || {})[k.qualitaet]);
        });

        const minAbsatz = Number(minAbsatzEl.value) || 0;
        const minMarge = (Number(minMargeEl.value) || 0) / 100;
        const gefiltert = filtereUndSortiere(zeilen, { minAbsatz, minMarge });
        renderTabelle(gefiltert, zeilen.length, einstellungen);

        const goldText = gold ? "Goldpreis " + formatSilber(gold.preis) : "Goldpreis nicht abrufbar";
        statusEl.textContent = "Fertig: " + gefiltert.length + " Treffer für " + knoten.label + " (" + goldText + ").";
      } catch (e) {
        statusEl.textContent = "Fehler: " + (e && e.message ? e.message : e);
        if (typeof console !== "undefined") console.error(e);
      } finally {
        zustand.laeuft = false;
        startEl.disabled = false;
      }
    }

    knotenAuswahlFuellen();
    startEl.addEventListener("click", suchen);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }

  return {
    tierTitelEntfernen,
    knotenLabel,
    knotenNachGebaeude,
    knotenFinden,
    marktIdVon,
    stufenMitRezept,
    kandidaten,
    benoetigteMarktIds,
    qualitaetsMarktIds,
    preiseZuOptsFormat,
    erloesJeStueck,
    zeileBauen,
    filtereUndSortiere,
    selbsttest,
  };
})();
