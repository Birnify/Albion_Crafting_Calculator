// js/craften.js
//
// Reiter "Craften: Gewinn" (v3.11.0, 17.10.2026). Ersetzt den Reiter
// "Schnelles Geld" (js/chancen.js, v3.2.0), der nach Sörens Urteil nicht wie
// gewuenscht funktionierte. Frage: welches Item laesst sich gerade aus
// eingekauften Materialien mit Gewinn craften, und wird es auch gehandelt?
//
// Aufbau und Bedienung bewusst wie "Veredeln leveln" (Nutzerwunsch): Auswahl
// per Chips (Warengruppe, Tier, Verzauberung), Einkaufs-, Fertigungs- und
// Verkaufsstadt, Schalter fuer Einkauf/Verkauf/Fokus/Premium, Tagesbonus,
// Zusatzbonus, eigene Einkaufspreise mit Hoechstpreis, Preise je Zeile.
// Keine eigene Rechenlogik: jede Zeile ist der Craft-Kandidat aus
// RECHENKERN.kosten() mit nurDirekteEbene, die Hilfsfunktionen (Stadtwahl je
// Zutat und je Produkt, eigene Preise, Hoechstpreis, Zeile, Einstufung)
// kommen unveraendert aus VEREDELN.
//
// Vorgaben von Sören (17.10.2026):
// - Fertigungsebene flach: die direkten Zutaten des Rezepts werden gekauft
//   (auch verzaubertes Material und Artefakte), nichts wird selbst gecraftet
//   und nichts hochverzaubert. Deshalb nur der Craft-Weg je Stufe, nie der
//   Verzaubern-Weg aus der Vorstufe mit Runen, Seelen, Relikten.
// - Filter auf gehandeltes Volumen ist Pflicht ("mindestens verkauft/Tag").
// - Qualitaet nicht im Detail. Gerechnet wird mit der niedrigsten Stufe:
//   * Verkaufsorder: der niedrigste sell_price_min ueber ALLE Qualitaeten.
//     Begruendung: ein Kaeufer nimmt das billigste Angebot gleicher oder
//     besserer Qualitaet; liegt ein "Gut" billiger als das guenstigste
//     "Normal", muss die eigene Order darunter. Das ist der "schlechteste
//     Preis" aus Sörens Nachricht und faellt nie hoeher aus als der
//     Normal-Preis.
//   * Sofortverkauf: die hoechste Kauforder in Normal. Eine Kauforder fuer
//     eine hoehere Qualitaet kann ein Normal-Stueck nicht bedienen.
//   * Volumen: Summe des erfassten Handels ueber alle Qualitaeten
//     (Standard, Sörens Wunsch) oder nur Normal (Schalter). history/ liefert
//     ohnehin je Qualitaet eine Zeile (CLAUDE.md, API-Abschnitt).
//   Eine besser gewuerfelte Qualitaet beim Craften ist nicht eingerechnet;
//   sie kann nur mehr bringen.
//
// Bewusst nicht modelliert: Transportkosten, Gewicht, Reiserisiko,
// Wartezeit eigener Orders, Craft-Fame.

const CRAFTEN = (function () {
  const PREISFELD = VEREDELN.PREISFELD; // v3.19.0: Preisfeld mit Tausenderpunkt
  "use strict";

  const V = VEREDELN; // geteilte Hilfsfunktionen, s. Modulkommentar
  const STAEDTE = V.STAEDTE;
  const TIERS = [2, 3, 4, 5, 6, 7, 8];
  const STUFEN = [0, 1, 2, 3, 4];
  const TAGE_FENSTER = 7;
  const SPEICHER_KEY = "albion_kostenrechner_craften_v1";
  // v3.18.0 (O4): "tag" = Gewinn/Tag (neue Vorgabe), "jefokus" = Mehrgewinn je Fokuspunkt, s. VEREDELN.kennzahlenSetzen().
  const SORTIERUNGEN = ["kosten", "stueck", "marge", "volumen", "gesamt", "tag", "jefokus"];

  // Warengruppen = craftingcategory des Dumps, gruppiert nach Gebaeude
  // (REGELN.gebaeudeVonKategorie). Veredeln und Tierhaltung fehlen bewusst:
  // dafuer gibt es den Reiter "Veredeln leveln" bzw. keinen Craft.
  const WARENGRUPPEN = [
    { cc: "sword", label: "Schwerter", haus: "Kriegerschmiede" },
    { cc: "axe", label: "Äxte", haus: "Kriegerschmiede" },
    { cc: "mace", label: "Streitkolben", haus: "Kriegerschmiede" },
    { cc: "hammer", label: "Hämmer", haus: "Kriegerschmiede" },
    { cc: "crossbow", label: "Armbrüste", haus: "Kriegerschmiede" },
    { cc: "plate_armor", label: "Plattenrüstung", haus: "Kriegerschmiede" },
    { cc: "plate_helmet", label: "Plattenhelme", haus: "Kriegerschmiede" },
    { cc: "plate_shoes", label: "Plattenschuhe", haus: "Kriegerschmiede" },
    { cc: "firestaff", label: "Feuerstäbe", haus: "Magierturm" },
    { cc: "holystaff", label: "Heiligenstäbe", haus: "Magierturm" },
    { cc: "arcanestaff", label: "Arkanstäbe", haus: "Magierturm" },
    { cc: "froststaff", label: "Froststäbe", haus: "Magierturm" },
    { cc: "cursestaff", label: "Fluchstäbe", haus: "Magierturm" },
    { cc: "cloth_armor", label: "Stoffrüstung", haus: "Magierturm" },
    { cc: "cloth_helmet", label: "Stoffhelme", haus: "Magierturm" },
    { cc: "cloth_shoes", label: "Stoffschuhe", haus: "Magierturm" },
    { cc: "bow", label: "Bögen", haus: "Jägerhütte" },
    { cc: "spear", label: "Speere", haus: "Jägerhütte" },
    { cc: "naturestaff", label: "Naturstäbe", haus: "Jägerhütte" },
    { cc: "dagger", label: "Dolche", haus: "Jägerhütte" },
    { cc: "quarterstaff", label: "Kampfstäbe", haus: "Jägerhütte" },
    { cc: "leather_armor", label: "Lederrüstung", haus: "Jägerhütte" },
    { cc: "leather_helmet", label: "Lederhelme", haus: "Jägerhütte" },
    { cc: "leather_shoes", label: "Lederschuhe", haus: "Jägerhütte" },
    { cc: "tools", label: "Werkzeuge", haus: "Werkzeugmacher" },
    { cc: "gatherergear", label: "Sammlerausrüstung", haus: "Werkzeugmacher" },
    { cc: "bag", label: "Taschen", haus: "Werkzeugmacher" },
    { cc: "cape", label: "Umhänge", haus: "Werkzeugmacher" },
    { cc: "potion", label: "Tränke", haus: "Alchemistenlabor" },
    { cc: "food", label: "Speisen", haus: "Küche" },
    { cc: "offhand", label: "Nebenhände", haus: "Sonstige" },
    { cc: "knuckles", label: "Kampfhandschuhe", haus: "Sonstige" },
    { cc: "shapeshifterstaff", label: "Wandlerstäbe", haus: "Sonstige" },
  ];
  const HAEUSER = ["Kriegerschmiede", "Magierturm", "Jägerhütte", "Werkzeugmacher", "Alchemistenlabor", "Küche", "Sonstige"];
  const LABEL = {};
  WARENGRUPPEN.forEach((w) => (LABEL[w.cc] = w.label));

  function standardEinstellungen() {
    return {
      warengruppen: ["sword"],
      tiers: [4, 5, 6, 7, 8],
      stufen: STUFEN.slice(),
      artefakte: true,
      einkaufStaedte: ["Lymhurst"],
      verkaufStaedte: ["Lymhurst"],
      fertigungsstadt: "Lymhurst",
      // Vorgabe wie im Spielerprofil (CLAUDE.md): Einkauf Sofortkauf, Verkauf eigene Verkaufsorder.
      kaufweg: "sofort",
      verkaufsweg: "order",
      mitFokus: false,
      minAbsatz: 5,
      volumenAlleQualitaeten: true,
      toleranzProzent: 5,
      menge: 10,
      verlusteZeigen: false,
      zusatzbonusProzent: 0,
      sortierung: "tag",
      sortTagUmgestellt: true, // v3.18.0: Merker der einmaligen Umstellung, s. VEREDELN.sortierungBereinigen()
      preisUeberschreibungen: {},
      plan: {}, // v3.12.0: Markt-ID des Produkts -> geplante Stueckzahl (Einkaufsliste)
    };
  }

  function einstellungenBereinigen(roh) {
    const basis = standardEinstellungen();
    if (!roh || typeof roh !== "object") return basis;
    const liste = (wert, erlaubt) => (Array.isArray(wert) ? erlaubt.filter((x) => wert.indexOf(x) !== -1) : null);
    const zahl = (w, min, std) => (w !== "" && w != null && isFinite(Number(w)) ? Math.max(min, Number(w)) : std);
    return {
      warengruppen: liste(roh.warengruppen, WARENGRUPPEN.map((w) => w.cc)) || basis.warengruppen,
      tiers: liste(roh.tiers, TIERS) || basis.tiers,
      stufen: liste(roh.stufen, STUFEN) || basis.stufen,
      artefakte: roh.artefakte == null ? basis.artefakte : !!roh.artefakte,
      einkaufStaedte: liste(roh.einkaufStaedte, STAEDTE) || basis.einkaufStaedte,
      verkaufStaedte: liste(roh.verkaufStaedte, STAEDTE) || basis.verkaufStaedte,
      fertigungsstadt: STAEDTE.indexOf(roh.fertigungsstadt) !== -1 ? roh.fertigungsstadt : basis.fertigungsstadt,
      kaufweg: roh.kaufweg === "order" ? "order" : "sofort",
      verkaufsweg: roh.verkaufsweg === "sofort" ? "sofort" : "order",
      mitFokus: !!roh.mitFokus,
      minAbsatz: zahl(roh.minAbsatz, 0, basis.minAbsatz),
      volumenAlleQualitaeten: roh.volumenAlleQualitaeten == null ? true : !!roh.volumenAlleQualitaeten,
      toleranzProzent: zahl(roh.toleranzProzent, 0, basis.toleranzProzent),
      menge: isFinite(Number(roh.menge)) && Number(roh.menge) > 0 ? Number(roh.menge) : basis.menge,
      verlusteZeigen: !!roh.verlusteZeigen,
      zusatzbonusProzent: isFinite(Number(roh.zusatzbonusProzent)) && Number(roh.zusatzbonusProzent) > 0 ? Number(roh.zusatzbonusProzent) : 0,
      sortierung: V.sortierungBereinigen(roh, (x) => SORTIERUNGEN.indexOf(x) !== -1, basis.sortierung),
      sortTagUmgestellt: true,
      preisUeberschreibungen: V.ueberschreibungenBereinigen(roh.preisUeberschreibungen),
      plan: planBereinigen(roh.plan),
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
   * Suchtext fuer die Marktsuche im Spiel: "Name 4.2" (Tier.Verzauberung),
   * auch "4.0". Alle Verzauberungsstufen heissen gleich, die Albion-Suche
   * findet die Variante nur mit der Stufe dahinter (Screenshot Soeren,
   * 17.10.2026: "Verfluchter Stab des Adepten 4.3"). Ohne Tier-Praefix
   * bleibt der Name unveraendert.
   */
  function suchName(name, item, stufe, graph) {
    const t = /^T(\d)_/.exec(String(item || ""));
    if (!t) return name;
    const g = aktuellerGraph(graph);
    const node = (g && g.items && g.items[item]) || {};
    return name + " " + t[1] + "." + (node.el ? node.el : stufe || 0);
  }

  /** Artefakt oder dessen Ersatz (Kristallisierter Geist, ARTEFACT_TOKEN_FAVOR). */
  function istArtefakt(id) {
    return /_ARTEFACT_/.test(id);
  }

  /**
   * Rezept ohne Waehrungskosten und ohne nicht handelbare Zutat
   * (REZEPTGRAPH.nichtHandelbareKandidaten aus build_graph.py, dazu die
   * Fraktionsmarken wie in VEREDELN.rezeptIstMarktfaehig). Sonst waere es
   * mangels Marktpreis immer gesperrt.
   */
  function rezeptMarktfaehig(rezept, graph) {
    if (!V.rezeptIstMarktfaehig(rezept)) return false;
    const g = aktuellerGraph(graph);
    const nh = (g && g.nichtHandelbareKandidaten) || [];
    return !(rezept.i || []).some((z) => nh.indexOf(z.n) !== -1);
  }

  /**
   * Alle Craft-Vorgaenge der Auswahl: je Item und Verzauberungsstufe eine
   * Zeile mit allen marktfaehigen Rezepten dieser Stufe (Artefakt-Items haben
   * oft zwei: mit Artefakt oder mit Kristallisiertem Geist; die Rechnung
   * nimmt spaeter das billigere). Stufen ohne eigenes Rezept fallen weg,
   * ein Verzauber-Weg wird nie angeboten.
   */
  function kandidaten(auswahl, graph) {
    const g = aktuellerGraph(graph);
    if (!g) return [];
    const ccs = auswahl.warengruppen || [];
    const tiers = auswahl.tiers || [];
    const stufen = auswahl.stufen || [];
    const out = [];
    Object.keys(g.items)
      .sort()
      .forEach((item) => {
        const node = g.items[item];
        if (!node || node.el || ccs.indexOf(node.cc) === -1 || tiers.indexOf(node.t) === -1) return;
        stufen.forEach((stufe) => {
          const rezepte = [];
          REGELN.rezepteFuerStufe(node, stufe).forEach((rezept, idx) => {
            if (!rezeptMarktfaehig(rezept, g)) return;
            rezepte.push({
              rezeptIndex: idx,
              menge: rezept.a || 1,
              zutaten: (rezept.i || []).map((z) => {
                const zNode = g.items[z.n];
                return { n: z.n, c: z.c, stufe: zNode && zNode.el ? zNode.el : z.l || 0 };
              }),
            });
          });
          if (!rezepte.length) return;
          const artefakt = rezepte.some((r) => r.zutaten.some((z) => istArtefakt(z.n)));
          if (artefakt && auswahl.artefakte === false) return;
          out.push({
            item,
            stufe,
            vorgangsStufe: stufe,
            tier: node.t,
            cc: node.cc,
            artefakt,
            qualifizierbar: REGELN.istQualifizierbar(item, node.cc || null, node.mq),
            rezepte,
            marktId: marktIdVon(item, stufe, g),
          });
        });
      });
    return out;
  }

  /** Markt-IDs fuer den Abruf, getrennt nach Zutaten (Einkauf) und Produkten (Verkauf). */
  function benoetigteMarktIds(kand, graph) {
    const zutaten = new Set();
    const produkte = new Set();
    kand.forEach((k) => {
      produkte.add(k.marktId);
      k.rezepte.forEach((r) => r.zutaten.forEach((z) => zutaten.add(marktIdVon(z.n, z.stufe, graph))));
    });
    return { zutaten: Array.from(zutaten), produkte: Array.from(produkte) };
  }

  /**
   * Grobe Abrufzahl je Suche, 50 IDs je Abruf. Seit v3.16.0 alle Staedte in
   * einem Abruf: die Zutaten einmal (fuer alle Einkaufsstaedte), Preise und
   * Handel der Produkte je einmal (fuer alle Verkaufsstaedte); seit v3.21.0
   * dazu der Handel der Zutaten (fuer alle Einkaufsstaedte), im selben Abruf
   * wie der Handel der Produkte, wenn Einkaufs- und Verkaufsstaedte gleich sind.
   */
  function abrufSchaetzung(kand, auswahl) {
    const ids = benoetigteMarktIds(kand);
    const bl = (n) => Math.ceil(n / 50);
    const von = (liste) => STAEDTE.filter((s) => (liste || []).indexOf(s) !== -1);
    const einkauf = von(auswahl.einkaufStaedte);
    const verkauf = von(auswahl.verkaufStaedte);
    let n = 0;
    if (einkauf.length) n += bl(ids.zutaten.length);
    if (verkauf.length) n += bl(ids.produkte.length);
    // v3.21.0 (O7): Handelsvolumen der Produkte und der Zutaten, s. VEREDELN.absatzGruppen().
    V.absatzGruppen(ids.zutaten, ids.produkte, einkauf, verkauf).forEach((g) => {
      n += bl(g.ids.length);
    });
    return { abrufe: n, produkte: ids.produkte.length, zutaten: ids.zutaten.length };
  }

  /**
   * Verkaufseintrag eines Produkts aus den Preisen je Qualitaet, nach der
   * Regel im Modulkommentar: sell = niedrigste gueltige Verkaufsorder ueber
   * alle Qualitaeten (Hoechstalter beachtet), buy = Kauforder in Normal.
   * Liefert ein Objekt im Format von PREISE.preiseAbrufen plus
   * sellQualitaet (Qualitaet, die den Preis setzt), oder null.
   */
  function produktEintrag(jeQ, maxPreisAlterMin, jetzt) {
    if (!jeQ) return null;
    let best = null;
    let bestQ = null;
    Object.keys(jeQ).forEach((q) => {
      const e = jeQ[q];
      const p = V.einkaufsBasisPreis(e && e.sell, maxPreisAlterMin, jetzt);
      if (p != null && (best == null || p < best.preis)) {
        best = e.sell;
        bestQ = Number(q);
      }
    });
    const normal = jeQ[1] || jeQ["1"] || null;
    if (!best && !normal) return null;
    return {
      sell: best || (normal ? normal.sell : { preis: null, kein: true, datum: "" }),
      buy: normal ? normal.buy : { preis: null, kein: true, datum: "" },
      sellQualitaet: bestQ,
    };
  }

  /** Erfasster Handel je Tag: Summe ueber alle Qualitaeten oder nur Normal. null = nichts erfasst. */
  function volumen(absatzJeQ, alleQualitaeten) {
    if (!absatzJeQ) return null;
    const qs = alleQualitaeten ? Object.keys(absatzJeQ) : ["1"];
    let summe = 0;
    let gefunden = false;
    qs.forEach((q) => {
      const e = absatzJeQ[q];
      if (e && isFinite(e.stueckJeTag)) {
        summe += e.stueckJeTag;
        gefunden = true;
      }
    });
    return gefunden ? summe : Object.keys(absatzJeQ).length ? 0 : null;
  }

  /**
   * Billigster gueltiger Craft-Kandidat unter den angegebenen Rezepten, mit
   * oder ohne Fokus. Ohne gueltigen der erste gesperrte (fuer den Grund).
   */
  function besterCraft(kostenErgebnis, rezeptIndizes, mitFokus) {
    const alle = ((kostenErgebnis && kostenErgebnis.alleWege) || []).filter(
      (k) => k.typ === "craften" || (k.weg && k.weg.ursprungsTyp === "craften")
    );
    const passend = alle.filter((k) => k.weg && rezeptIndizes.indexOf(k.weg.rezeptIndex) !== -1 && !!k.weg.mitFokus === !!mitFokus);
    let best = null;
    passend.forEach((k) => {
      if (!k.gesperrt && k.silber != null && (!best || k.silber < best.silber)) best = k;
    });
    return best || passend[0] || null;
  }

  /** Rueckgewinnung je angehakter Warengruppe in der Fertigungsstadt. */
  function rueckgewinnungJeWarengruppe(auswahl, einstellungen) {
    const tb = (einstellungen && einstellungen.tagesbonus) || {};
    return WARENGRUPPEN.filter((w) => (auswahl.warengruppen || []).indexOf(w.cc) !== -1).map((w) => ({
      cc: w.cc,
      label: w.label,
      bonus: REGELN.hatCraftBonus(w.cc, auswahl.fertigungsstadt),
      rrr: REGELN.rrr({
        cc: w.cc,
        stadt: auswahl.fertigungsstadt,
        mitFokus: !!auswahl.mitFokus,
        tagesbonus: tb[w.cc] || null,
        zusatzbonus: (auswahl.zusatzbonusProzent || 0) / 100,
        craftingfocus: 1,
      }),
    }));
  }

  /** Gebaeude/Gebuehrengruppen der angehakten Warengruppen, Schluessel wie einstellungen.stationssaetze. */
  function stationenFuer(warengruppen) {
    const out = [];
    (warengruppen || []).forEach((cc) => {
      const g = REGELN.gebaeudeVonKategorie(cc);
      if (g && out.indexOf(g) === -1) out.push(g);
    });
    return out;
  }

  /**
   * Alle Zeilen aus abgerufenen Daten, ohne Netz.
   * stadtDaten: [{stadt, preiseRoh (Zutaten, Normal), produktJeQ
   * (Markt-ID -> Qualitaet -> Eintrag), absatz (Markt-ID -> Qualitaet -> Eintrag),
   * zutatAbsatz (v3.21.0: Markt-ID -> {stueckJeTag, abgerufenAm} der Zutaten
   * in einer Einkaufsstadt, s. VEREDELN.zutatAbsatzSetzen())}].
   */
  function zeilenRechnen(kand, stadtDaten, auswahl, einstellungen, jetzt) {
    const maxPreisAlterMin =
      einstellungen.maxPreisAlterMin === "" || einstellungen.maxPreisAlterMin == null ? null : Number(einstellungen.maxPreisAlterMin);
    const zeit = jetzt == null ? Date.now() : jetzt;
    const fceUeb = typeof UI !== "undefined" && UI.fceUeberschreibungenAus ? UI.fceUeberschreibungenAus(einstellungen) : {};
    const fertigung = auswahl.fertigungsstadt || "Lymhurst";
    const ueberAlle = auswahl.preisUeberschreibungen || {};
    const datenVon = (stadt) => (stadtDaten || []).find((d) => d.stadt === stadt);
    const einkaufDaten = (auswahl.einkaufStaedte || []).map(datenVon).filter((d) => d && d.preiseRoh).map((d) => ({
      stadt: d.stadt,
      preiseRoh: d.preiseRoh,
      preise: V.preiseMitUeberschreibungen(REGELN.preiseZuOptsFormat(d.preiseRoh), ueberAlle[d.stadt] || {}),
    }));
    const verkaufDaten = (auswahl.verkaufStaedte || []).map(datenVon).filter((d) => d && d.produktJeQ);
    const optsBasis = {
      eigenpreise: {},
      kaufweg: auswahl.kaufweg,
      stadt: fertigung,
      stationssaetze: einstellungen.stationssaetze || {},
      fce: einstellungen.fce,
      fceUeberschreibungen: fceUeb,
      // v3.18.0 (O4): der Rechenkern liefert immer beide Varianten (mit und
      // ohne Fokus) in alleWege; die Zeile nimmt die zum Schalter passende,
      // die andere dient dem Mehrgewinn je Fokuspunkt.
      fokusAus: false,
      fokusRegelJeKategorie: {},
      fokusUebersteuerungJeKnoten: {},
      fokuswert: 0,
      tagesbonus: einstellungen.tagesbonus || {},
      zusatzProduktionsbonus: (auswahl.zusatzbonusProzent || 0) / 100,
      maxPreisAlterMin,
      nurDirekteEbene: true,
    };
    const erloesOpts = { verkaufsweg: auswahl.verkaufsweg, premium: einstellungen.premium, maxPreisAlterMin, jetzt: zeit };
    const kennzahlCtx = { mitFokus: !!auswahl.mitFokus, premium: einstellungen.premium !== false, anteil: V.anteilVon(einstellungen) };
    const wahl = {};
    const einkaufVon = (id) => {
      if (!(id in wahl)) {
        const w = V.einkaufWaehlen(id, einkaufDaten, auswahl.kaufweg, maxPreisAlterMin, zeit);
        if (w) w.eigen = !!(ueberAlle[w.stadt] && ueberAlle[w.stadt][id] != null);
        wahl[id] = w;
      }
      return wahl[id];
    };
    return kand.map((k) => {
      const preise = {};
      const herkunft = {};
      k.rezepte.forEach((r) =>
        r.zutaten.forEach((zt) => {
          const id = marktIdVon(zt.n, zt.stufe);
          const w = einkaufVon(id);
          if (!w) return;
          herkunft[id] = w;
          if (w.eintrag) preise[id] = w.eintrag;
        })
      );
      // Je Variante das billigere marktfaehige Rezept (wie bisher fuer die Zeile).
      const kostenErgebnis = RECHENKERN.kosten(k.item, k.stufe, 1, Object.assign({}, optsBasis, { preise }));
      const rezeptIndizes = k.rezepte.map((r) => r.rezeptIndex);
      const craftMit = besterCraft(kostenErgebnis, rezeptIndizes, true);
      const craftOhne = besterCraft(kostenErgebnis, rezeptIndizes, false);
      const craft = auswahl.mitFokus ? craftMit : craftOhne;
      const rezept = (craft && craft.weg && k.rezepte.find((r) => r.rezeptIndex === craft.weg.rezeptIndex)) || k.rezepte[0];
      const kandidat = Object.assign({}, k, { rezeptIndex: rezept.rezeptIndex, menge: rezept.menge, zutaten: rezept.zutaten });
      // O10: handel = gehandelter Durchschnittspreis in Normal; V.verkaufAbsichern() nimmt den niedrigeren aus Angebot und Handel.
      const vkEintraege = verkaufDaten.map((d) => ({ stadt: d.stadt, eintrag: produktEintrag(d.produktJeQ[k.marktId], maxPreisAlterMin, zeit), handel: V.handelspreisVon((d.absatz || {})[k.marktId]) }));
      const vk = V.verkaufAbsichern(vkEintraege, erloesOpts) || { stadt: null, erloes: { netto: null, grund: "keine Verkaufsstadt angehakt" } };
      const vkDaten = verkaufDaten.find((d) => d.stadt === vk.stadt) || {};
      const vkEintrag = (vkEintraege.find((e) => e.stadt === vk.stadt) || {}).eintrag || null;
      const zeile = V.zeileBauen(kandidat, fertigung, craft, vk.erloes, null, Object.assign({}, auswahl, { herkunft }));
      zeile.stadtbonus = REGELN.hatCraftBonus(k.cc, fertigung);
      zeile.artefakt = k.artefakt;
      zeile.qualifizierbar = k.qualifizierbar;
      zeile.stueckJeTag = volumen((vkDaten.absatz || {})[k.marktId], auswahl.volumenAlleQualitaeten !== false);
      zeile.stueckJeTagNormal = volumen((vkDaten.absatz || {})[k.marktId], false);
      zeile.sellQualitaet = vkEintrag ? vkEintrag.sellQualitaet : null;
      zeile.vkStadt = vk.stadt;
      zeile.vkAlle = vk.alle || null;
      V.preisAbsicherungSetzen(zeile, vk);
      // Nach dem Volumen: Gewinn/Tag nutzt dieselbe Zahl, die die Zeile als verkauft/Tag zeigt.
      V.zutatAbsatzSetzen(zeile, stadtDaten);
      V.kennzahlenSetzen(zeile, craftMit, craftOhne, kennzahlCtx);
      return zeile;
    });
  }

  /** Kosten/Stueck aufsteigend, alle anderen absteigend; Zeilen ohne Wert (z. B. Gewinn/Tag ohne erfassten Handel) ans Ende. */
  function sortiere(zeilen, schluessel) {
    const wert = {
      kosten: (z) => z.silber,
      stueck: (z) => z.gewinn,
      marge: (z) => z.marge,
      volumen: (z) => z.stueckJeTag || 0,
      gesamt: (z) => z.gewinnGesamt,
      tag: (z) => z.gewinnJeTag,
      jefokus: (z) => z.mehrgewinnJeFokus,
    }[SORTIERUNGEN.indexOf(schluessel) !== -1 ? schluessel : "marge"];
    const auf = schluessel === "kosten";
    return zeilen.slice().sort((a, b) => V.vergleiche(wert(a), wert(b), auf));
  }

  /**
   * Nur Zeilen mit Ergebnis, mindestens minAbsatz verkauft/Tag (Pflichtfilter,
   * ohne erfassten Handel faellt die Zeile ab minAbsatz > 0 heraus), ohne
   * verlusteZeigen nur Gewinn und etwa Null.
   */
  function filtereUndSortiere(zeilen, opts) {
    opts = opts || {};
    const min = opts.minAbsatz > 0 ? opts.minAbsatz : 0;
    return sortiere(
      zeilen
        .filter((z) => z.gewinn != null && z.marge != null)
        .filter((z) => (z.stueckJeTag || 0) >= min)
        .filter((z) => opts.verlusteZeigen || z.einstufung !== "verlust"),
      opts.sortierung || "marge"
    );
  }

  /** Geplante Stueckzahlen: nur ganze Zahlen > 0 bleiben. */
  function planBereinigen(roh) {
    const out = {};
    if (!roh || typeof roh !== "object") return out;
    Object.keys(roh).forEach((id) => {
      const n = Math.floor(Number(roh[id]));
      if (isFinite(n) && n > 0) out[id] = n;
    });
    return out;
  }

  /**
   * Einkaufsliste (v3.12.0, Wunsch 17.10.2026): fuer die geplanten
   * Stueckzahlen je Produkt die Zutatenmengen VOR Rueckgewinnung, also das,
   * was fuer die Crafts im Inventar liegen muss. Je Produkt ganze Vorgaenge
   * (Speisen: 10 Stueck je Vorgang, angefangene Vorgaenge zaehlen voll).
   * Gleiche Zutaten verschiedener Produkte werden je Markt-ID und
   * Einkaufsstadt zusammengezaehlt. Preis = Einkaufspreis der Zeile ohne
   * Einstellgebuehr, Kosten = Menge x angesetzter Stueckpreis (bei Kauforder
   * inkl. 2,5 %). Produkte ohne berechnete Zeile (kein Weg, nicht geladen)
   * stehen in `fehlend`.
   *
   * v3.19.0 (O5): dieselbe Funktion bedient den Reiter "Gelegenheiten".
   * Dort ist der Schluessel des Plans der Zeilenschluessel (Crafts und
   * Veredelungen gemischt), deshalb `schluesselVon` (Vorgabe: Markt-ID, wie
   * bisher). Je Produkt kommen dazu: hergestellt (Vorgaenge x Ausbeute),
   * erloes und gewinn fuer diese Menge (Zahlen der Zeile mal Menge, also
   * Gewinn = Erloes minus Kosten NACH Rueckgewinnung plus Gebuehr), in der
   * Summe `erloes` und `gewinn`. Posten, Mengen und `summe` sind unveraendert.
   * Dazu `kosten` je Produkt und `kostenNetto` in Summe: Kosten/Stueck der
   * Zeile (Material nach Rueckgewinnung plus Stationsgebuehr) mal Menge, so
   * dass gilt: erloes - kostenNetto = gewinn. In die drei Summen gehen nur
   * Produkte ein, die alle drei Werte haben (sonst ergebnisVollstaendig = false).
   *
   * O10 (23.11.2026): `menge` je Posten ist die KAUFMENGE nach
   * Rueckgewinnung, nicht mehr Menge je Vorgang x Vorgaenge. Je Produkt p
   * und Zutat i, mit n Vorgaengen, q je Vorgang und Rueckgewinnung r der Zeile:
   *   Bedarf(p,i)   = q + (n - 1) x q x (1 - r)
   *   Kaufmenge(i)  = aufrunden(Summe Bedarf x (1 + Puffer/100))  wenn r > 0 in mindestens einem Produkt
   *                 = aufrunden(Summe Bedarf)                     sonst
   *   Rest(i)       = Kaufmenge(i) - Summe n x q x (1 - r)
   * Je Posten dazu: mengeRezept (alter Wert), bedarf, verbrauch, rest,
   * mitRueckgewinnung, pufferProzent, abgerufenAm (aeltester Zutatenpreis).
   * kosten und summe rechnen mit der Kaufmenge. opts.pufferProzent: 0 bis 50,
   * Vorgabe 0. Zeilen ohne effektiveMenge (r unbekannt) rechnen mit r = 0.
   */
  function einkaufsliste(zeilen, plan, schluesselVon, opts) {
    const schluessel = typeof schluesselVon === "function" ? schluesselVon : (z) => z.marktId;
    const puffer = pufferBereinigen(opts && opts.pufferProzent);
    const nachId = {};
    (zeilen || []).forEach((z) => {
      const k = z ? schluessel(z) : null;
      if (k != null && !nachId[k]) nachId[k] = z;
    });
    const posten = {};
    const reihenfolge = [];
    const produkte = [];
    const fehlend = [];
    let summe = 0;
    let vollstaendig = true;
    let erloesSumme = 0;
    let gewinnSumme = 0;
    let kostenSumme = 0;
    let ergebnisVollstaendig = true;
    const mal = (wert, n) => (wert != null && isFinite(wert) ? wert * n : null);
    Object.keys(plan || {}).forEach((id) => {
      const stueck = plan[id];
      const z = nachId[id];
      if (!z || !z.zutatenPreise || !z.zutatenPreise.length) {
        fehlend.push(id);
        return;
      }
      const vorgaenge = Math.ceil(stueck / (z.ausbeute || 1));
      const hergestellt = vorgaenge * (z.ausbeute || 1);
      const erloes = mal(z.erloes, hergestellt);
      const gewinn = mal(z.gewinn, hergestellt);
      const kosten = mal(z.silber, hergestellt);
      if (erloes == null || gewinn == null || kosten == null) ergebnisVollstaendig = false;
      else {
        erloesSumme += erloes;
        gewinnSumme += gewinn;
        kostenSumme += kosten;
      }
      produkte.push({
        marktId: z.marktId, schluessel: id, art: z.art || null, item: z.item, stufe: z.stufe, vorgangsStufe: z.vorgangsStufe, tier: z.tier, stueck, vorgaenge, ausbeute: z.ausbeute || 1,
        hergestellt, erloes, gewinn, kosten,
        // v3.22.0: Tagesmaximum der Zeile (abgerundet) fuer das Produktschild; null ohne erfassten Handel
        maxJeTag: V.maxTagZahl(z), maxText: V.maxTagText(z), tagGrenze: z.tagGrenze || null,
      });
      z.zutatenPreise.forEach((x) => {
        const schluessel = x.marktId + "|" + x.stadt;
        if (!posten[schluessel]) {
          posten[schluessel] = { marktId: x.marktId, n: x.n, stufe: x.stufe, stadt: x.stadt, menge: 0, basisPreis: x.basisPreis, preis: x.preis, kosten: 0, mengeRezept: 0, bedarf: 0, verbrauch: 0, mitRueckgewinnung: false, pufferProzent: 0, rest: 0, abgerufenAm: null };
          reihenfolge.push(schluessel);
        }
        // O10: Bedarf nach Rueckgewinnung. Der Anteil, der je Vorgang
        // verbraucht wird (1 - r), kommt aus der Zeile: effektiveMenge des
        // Rechenkerns (je Stueck, nach Rueckgewinnung) mal Ausbeute durch die
        // Rezeptmenge je Vorgang. Keine eigene Formel; fehlt die Angabe, gilt
        // r = 0 (volle Menge).
        const po = posten[schluessel];
        const q = x.menge;
        const anteil = verbrauchsAnteil(x, z.ausbeute || 1);
        po.mengeRezept += q * vorgaenge;
        po.bedarf += q + (vorgaenge - 1) * q * anteil; // der letzte Vorgang braucht noch die volle Rezeptmenge
        po.verbrauch += vorgaenge * q * anteil;
        if (anteil < 1) po.mitRueckgewinnung = true;
        if (!x.uebersteuert && x.roh && x.roh.abgerufenAm > 0 && (po.abgerufenAm == null || x.roh.abgerufenAm < po.abgerufenAm)) po.abgerufenAm = x.roh.abgerufenAm;
        if (!(x.preis != null && isFinite(x.preis))) po.ohnePreis = true;
      });
    });
    // Kaufmenge je Zutat: aufgerundet; der Puffer wirkt nur, wo es Rueckgewinnung gibt (sonst steht die Menge fest).
    reihenfolge.forEach((k) => {
      const po = posten[k];
      po.pufferProzent = po.mitRueckgewinnung ? puffer : 0;
      po.menge = Math.ceil(po.bedarf * (1 + po.pufferProzent / 100) - 1e-9);
      po.rest = Math.max(0, po.menge - po.verbrauch);
      if (po.ohnePreis) vollstaendig = false;
      else {
        po.kosten = po.menge * po.preis;
        summe += po.kosten;
      }
      delete po.ohnePreis;
    });
    return { posten: reihenfolge.map((k) => posten[k]), produkte, fehlend, summe, vollstaendig, erloes: erloesSumme, gewinn: gewinnSumme, kostenNetto: kostenSumme, ergebnisVollstaendig, pufferProzent: puffer };
  }

  // ---- O10: Puffer der Einkaufsliste, gemeinsam fuer "Gelegenheiten" und "Craften: Gewinn" ----
  const LISTE_KEY = "albion_kostenrechner_einkaufsliste_v1";
  const LISTE_EVENT = "albion:einkaufsliste";
  const PUFFER_VORGABE = 0; // Nutzer-Entscheidung 23.11.2026: die Rueckgewinnung wird je Vorgang gerechnet und nur gerundet (Wiki Resource_return_rate)
  const PUFFER_MAX = 50;

  /** Puffer in Prozent: 0 bis 50, eine Nachkommastelle; Unlesbares ergibt die Vorgabe. Versteht "2,5". */
  function pufferBereinigen(wert) {
    const n = typeof wert === "string" ? Number(wert.replace(",", ".")) : Number(wert);
    if (wert === "" || wert == null || typeof wert === "boolean" || !isFinite(n)) return PUFFER_VORGABE;
    return Math.round(Math.min(PUFFER_MAX, Math.max(0, n)) * 10) / 10;
  }
  function pufferLesen() {
    try {
      const roh = JSON.parse(localStorage.getItem(LISTE_KEY) || "null");
      return pufferBereinigen(roh && roh.pufferProzent);
    } catch (e) {
      return PUFFER_VORGABE;
    }
  }
  /** Speichert den Puffer und meldet LISTE_EVENT ({quelle}), damit die andere Einkaufsliste nachzieht. */
  function pufferSetzen(wert, quelle) {
    const p = pufferBereinigen(wert);
    try {
      localStorage.setItem(LISTE_KEY, JSON.stringify({ pufferProzent: p }));
    } catch (e) {
      /* localStorage evtl. nicht verfuegbar */
    }
    if (typeof document !== "undefined" && typeof CustomEvent !== "undefined") document.dispatchEvent(new CustomEvent(LISTE_EVENT, { detail: { quelle: quelle || null, pufferProzent: p } }));
    return p;
  }

  /**
   * Anteil der Rezeptmenge, der je Vorgang wirklich verbraucht wird (1 - r),
   * aus der Zutat einer Zeile: effektiveMenge (je Stueck Produkt, nach
   * Rueckgewinnung, so wie der Rechenkern sie ansetzt) x Ausbeute / Menge je
   * Vorgang. 1 bei Zutaten ohne Rueckgewinnung (Artefakte) und ohne Angabe.
   */
  function verbrauchsAnteil(x, ausbeute) {
    if (!x || !(x.menge > 0) || x.effektiveMenge == null || !isFinite(x.effektiveMenge)) return 1;
    const a = (x.effektiveMenge * (ausbeute || 1)) / x.menge;
    return a > 0 && a < 1 ? a : 1;
  }

  const deZahl = (n, stellen) => Number(n).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: stellen == null ? 0 : stellen });

  /** Text neben der Ueberschrift: "Bedarf nach Rückgewinnung", mit Pufferangabe nur, wenn einer gesetzt ist. */
  function einkaufslisteLabel(liste) {
    const p = liste ? liste.pufferProzent : 0;
    return "Bedarf nach Rückgewinnung" + (p > 0 ? ", Puffer " + deZahl(p, 1) + " %" : "");
  }
  const LISTE_LABEL_TITEL =
    "Kaufmengen für mehrere Durchgänge: die Rückgewinnung jedes Vorgangs wird im nächsten wiederverwendet, für den letzten Vorgang liegt noch die volle Rezeptmenge bereit. Maßgeblich ist die Rückgewinnung der jeweiligen Zeile (Fertigungsstadt, Fokus-Schalter). Zutaten ohne Rückgewinnung stehen mit der vollen Menge da.";
  const PUFFER_TITEL =
    "Puffer in Prozent auf die Kaufmenge aller Zutaten mit Rückgewinnung, 0 bis 50. Die Rückgewinnung wird je Vorgang aus der Menge gerechnet und nur gerundet; über mehrere Durchgänge kann am Ende ein Stück fehlen. Wer sichergehen will, trägt 1 bis 2 % ein. Kein Puffer auf Zutaten ohne Rückgewinnung, deren Menge steht fest. Gilt für die Einkaufslisten in Gelegenheiten und Craften: Gewinn.";

  /** Tooltip der Zelle "Menge" einer Zutat. */
  function einkaufslisteMengeTitel(p) {
    const voll = deZahl(p.mengeRezept);
    if (!p.mitRueckgewinnung) return "Rezeptmenge " + voll + ". Diese Zutat hat keine Rückgewinnung: die Menge steht fest, kein Puffer.";
    return (
      "Rezeptmenge ohne Rückgewinnung: " + voll + ". Rechnerischer Bedarf nach Rückgewinnung: " + deZahl(p.bedarf, 1) +
      (p.pufferProzent > 0 ? ", mit Puffer " + deZahl(p.pufferProzent, 1) + " %: " + deZahl(p.bedarf * (1 + p.pufferProzent / 100), 1) : ", kein Puffer") +
      ", aufgerundet " + deZahl(p.menge) + ". Rest nach allen Vorgängen etwa " + deZahl(Math.floor(p.rest + 1e-9)) + ".\n\n" +
      "Wer alles in EINEM Vorgang craften will, braucht die volle Rezeptmenge (" + voll + "). Die Kaufmenge (" + deZahl(p.menge) +
      ") reicht nur, wenn in mehreren Durchgängen gecraftet und die Rückgewinnung wiederverwendet wird."
    );
  }

  /** Aeltester Abruf unter den Preisen der Liste (Zutaten ohne eigenen Preis), null ohne Angabe. */
  function einkaufslisteAeltester(liste) {
    let t = null;
    ((liste && liste.posten) || []).forEach((p) => {
      if (p.abgerufenAm > 0 && (t == null || p.abgerufenAm < t)) t = p.abgerufenAm;
    });
    return t;
  }

  /** "Preise von 12:45" fuer die Einkaufsliste; weitereZeiten: Abrufzeiten der Verkaufspreise der geplanten Produkte. Leer ohne Angabe. */
  function einkaufslisteAlterHtml(liste, weitereZeiten, esc) {
    let t = einkaufslisteAeltester(liste);
    (weitereZeiten || []).forEach((w) => {
      if (w > 0 && (t == null || w < t)) t = w;
    });
    if (!(t > 0)) return "";
    return (
      "<span class='vd-klein cg-el-alter' title='" + esc("Ältester verwendeter Preis der Einkaufsliste (Zutaten und Verkaufspreise der geplanten Produkte): abgerufen " + V.abrufAlterText(t) + ". „Preise aktualisieren“ holt sie frisch.") + "'>Preise von " +
      new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + "</span>"
    );
  }

  /** Knopf "Preise aktualisieren" (beide Reiter), steht neben "Alles kopieren"; gesperrt, solange der Abruf laeuft. */
  function einkaufslisteFrischKnopfHtml(attr, zustand, esc) {
    const an = !!(zustand && zustand.laeuft);
    return (
      "<button type='button' class='mini' data-" + attr + "-preise-frisch='1'" + (an ? " disabled" : "") +
      " title='" + esc("Holt die Preise der Zutaten dieser Liste (in den Einkaufsstädten) und die Verkaufspreise samt verkauft/Tag der geplanten Produkte (in den Verkaufsstädten) sofort frisch, auch wenn sie noch als frisch gelten. Danach rechnen die Zeilen und die Liste neu.") + "'>" +
      (an ? "Aktualisiere ..." : "Preise aktualisieren") + "</button>"
    );
  }

  /**
   * Bedienzeile der Einkaufsliste (beide Reiter): Feld "Puffer %", Alter der
   * Preise, Meldung des Abrufs. attr: Praefix der data-Attribute ("cg" oder
   * "gl"); zustand: {laeuft, text, fehler}.
   */
  function einkaufslisteBedienHtml(liste, attr, zustand, weitereZeiten, esc) {
    const zs = zustand || {};
    return (
      "<div class='cg-el-bedien'><label class='cg-el-puffer' title='" + esc(PUFFER_TITEL) + "'><span>Puffer %</span>" +
      "<input type='number' min='0' max='" + PUFFER_MAX + "' step='0.5' value='" + liste.pufferProzent + "' data-" + attr + "-puffer='1' aria-label='Puffer der Einkaufsliste in Prozent'></label>" +
      einkaufslisteAlterHtml(liste, weitereZeiten, esc) +
      (zs.text ? "<span class='cg-el-meldung" + (zs.fehler ? " err" : "") + "' role='status'>" + esc(zs.text) + "</span>" : "") +
      "</div>"
    );
  }

  /**
   * Die vier Summenzeilen der Einkaufsliste (v3.19.0), gemeinsam fuer
   * "Craften: Gewinn" und "Gelegenheiten": Einkauf gesamt (vorzustrecken),
   * Kosten nach Rueckgewinnung, Erloes gesamt, Gewinn gesamt. Sichtbar gilt
   * Erloes minus Kosten nach Rueckgewinnung = Gewinn.
   * @param o {{spalten:number, order:boolean, fmt:(n:number)=>string, esc:(s:string)=>string}}
   */
  function einkaufslisteSummenHtml(liste, o) {
    const zeile = (text, titel, wert, id, klasse) =>
      "<tr title='" + o.esc(titel) + "'><td colspan='" + o.spalten + "'>" + text + "</td><td class='num" + (klasse ? " " + klasse : "") + "' data-el-summe='" + id + "'>" + o.fmt(wert) + "</td></tr>";
    const luecke = liste.ergebnisVollstaendig ? "" : ", ohne Produkte ohne Verkaufspreis";
    return (
      "<tfoot>" +
      zeile(
        "Einkauf gesamt" + (o.order ? " (inkl. 2,5 % Einstellgebühr)" : "") + (liste.vollstaendig ? "" : ", ohne Zutaten ohne Preis"),
        "Kaufmenge mal Preis: so viel Silber kostet der Einkauf dieser Liste. Unterschied zu „Kosten nach Rückgewinnung“: hier fehlt die Stationsgebühr, dafür sind der Rest, der nach dem letzten Vorgang übrig bleibt, und der Puffer mitbezahlt.",
        liste.summe, "einkauf"
      ) +
      zeile(
        "Kosten nach Rückgewinnung" + luecke,
        "Kosten/Stück der Zeilen mal Menge: verbrauchtes Material plus Stationsgebühr. Unterschied zu „Einkauf gesamt“: die Stationsgebühr kommt hinzu, der Wert des Rests (Rückgewinnung des letzten Vorgangs, Aufrundung) und des Puffers fällt weg, denn dieses Material bleibt im Lager.",
        liste.kostenNetto, "kosten"
      ) +
      zeile("Erlös gesamt" + luecke, "Nach Steuer, bei eigener Verkaufsorder auch nach 2,5 % Einstellgebühr, für die hergestellte Menge.", liste.erloes, "erloes") +
      zeile(
        "Gewinn gesamt",
        "Erlös gesamt minus Kosten nach Rückgewinnung, also Gewinn/Stück der Zeilen mal Menge. Erlös minus Einkauf ergibt nicht den Gewinn: im Einkauf fehlt die Stationsgebühr, und der Rest bleibt als Material im Lager.",
        liste.gewinn, "gewinn", liste.gewinn >= 0 ? "gl-plus" : "gl-minus"
      ) +
      "</tfoot>"
    );
  }

  /** Text fuer "Alles kopieren": je Zeile Menge und Name, tabgetrennt. */
  function einkaufslisteText(liste, nameVon) {
    return liste.posten.map((p) => Math.round(p.menge) + "\t" + nameVon(p.n, p.stufe)).join("\n");
  }

  // -----------------------------------------------------------------------
  // Selbsttest (reine Funktionen, kein Netz, kein DOM)
  // -----------------------------------------------------------------------

  function selbsttest() {
    const ergebnisse = [];
    function pruefe(name, ok, details) {
      ergebnisse.push({ name, ok: !!ok, details: details == null ? "" : String(details) });
    }
    const g = aktuellerGraph();

    // Jede Craft-Kategorie des Dumps (ohne Veredeln und Tierhaltung) ist waehlbar.
    const ccs = new Set();
    Object.keys(g.items).forEach((id) => {
      const cc = g.items[id].cc;
      if (cc && !/^(fiber|ore|rock|hide|wood|meat_)/.test(cc)) ccs.add(cc);
    });
    const fehlt = Array.from(ccs).filter((cc) => !LABEL[cc]);
    pruefe("WARENGRUPPEN: jede Craft-Kategorie des Dumps hat eine Warengruppe", fehlt.length === 0, fehlt.join(","));
    pruefe(
      "WARENGRUPPEN: jede Warengruppe hat ein Gebaeude bzw. eine Gebuehrengruppe",
      WARENGRUPPEN.every((w) => REGELN.gebaeudeVonKategorie(w.cc) && HAEUSER.indexOf(w.haus) !== -1),
      WARENGRUPPEN.filter((w) => !REGELN.gebaeudeVonKategorie(w.cc)).map((w) => w.cc).join(",")
    );

    const schwert = kandidaten({ warengruppen: ["sword"], tiers: [5], stufen: [0, 1, 2, 3, 4], artefakte: true });
    const breit = schwert.filter((k) => k.item === "T5_MAIN_SWORD");
    pruefe(
      "kandidaten: Breitschwert T5 hat je Stufe .0 bis .4 eine Zeile, Material auf derselben Stufe",
      breit.length === 5 && breit[2].rezepte[0].zutaten.some((z) => z.n === "T5_METALBAR_LEVEL2" && z.stufe === 2 && z.c === 16),
      breit.map((k) => k.marktId).join(",")
    );
    pruefe(
      "benoetigteMarktIds: verzauberter Barren als Zutat, keine Runen/Seelen/Relikte (kein Verzaubern), kein Erz (keine tiefere Ebene)",
      (function () {
        const ids = benoetigteMarktIds(breit);
        return ids.zutaten.indexOf("T5_METALBAR_LEVEL2@2") !== -1 && !ids.zutaten.some((i) => /RUNE|SOUL|RELIC|_ORE/.test(i)) && ids.produkte.indexOf("T5_MAIN_SWORD@3") !== -1;
      })(),
      JSON.stringify(benoetigteMarktIds(breit))
    );
    const ohneArt = kandidaten({ warengruppen: ["sword"], tiers: [5], stufen: [0], artefakte: false });
    pruefe(
      "kandidaten: ohne Artefakt-Items bleiben nur Items ohne Artefakt im Rezept",
      ohneArt.length > 0 && ohneArt.length < schwert.filter((k) => k.stufe === 0).length && ohneArt.every((k) => !k.artefakt),
      ohneArt.length + " von " + schwert.filter((k) => k.stufe === 0).length
    );
    const eintopf = kandidaten({ warengruppen: ["food"], tiers: [8], stufen: [0, 1, 2, 3], artefakte: true }).filter((k) => k.item === "T8_MEAL_STEW");
    pruefe(
      "kandidaten: Speisen nicht qualifizierbar, Ausbeute 10 je Vorgang, Fischsauce als Zutat der verzauberten Stufe",
      eintopf.length === 4 && eintopf.every((k) => !k.qualifizierbar && k.rezepte[0].menge === 10) &&
        eintopf[1].rezepte[0].zutaten.some((z) => /FISHSAUCE/.test(z.n)),
      eintopf.map((k) => k.marktId + ":" + k.rezepte[0].menge).join(",")
    );
    pruefe(
      "rezeptMarktfaehig: Rezept mit nicht handelbarer Zutat faellt weg",
      !rezeptMarktfaehig({ i: [{ n: (g.nichtHandelbareKandidaten || ["T1_FACTION_FOREST_TOKEN_1"])[0], c: 1 }] }) && rezeptMarktfaehig({ i: [{ n: "T4_PLANKS", c: 1 }] }),
      (g.nichtHandelbareKandidaten || [])[0]
    );

    // Preisregel: Verkaufsorder = billigste Qualitaet, Sofortverkauf = Kauforder Normal.
    const s = (p) => ({ preis: p, kein: p == null, datum: "" });
    const jeQ = { 1: { sell: s(1000), buy: s(800) }, 2: { sell: s(950), buy: s(900) }, 3: { sell: s(null), buy: s(null) } };
    const pe = produktEintrag(jeQ, null);
    pruefe(
      "produktEintrag: Verkaufsorder nimmt den niedrigsten Preis ueber alle Qualitaeten, Sofortverkauf die Kauforder in Normal",
      pe.sell.preis === 950 && pe.sellQualitaet === 2 && pe.buy.preis === 800,
      JSON.stringify(pe)
    );
    const peNurGut = produktEintrag({ 2: { sell: s(700), buy: s(null) } }, null);
    pruefe(
      "produktEintrag: fehlt Normal, zaehlt die billigste andere Qualitaet; Kauforder dann leer",
      peNurGut.sell.preis === 700 && peNurGut.buy.kein,
      JSON.stringify(peNurGut)
    );
    const alt = { 1: { sell: { preis: 500, kein: false, datum: "2026-10-01T00:00:00" }, buy: s(null) }, 2: { sell: s(900), buy: s(null) } };
    pruefe(
      "produktEintrag: zu alter Preis zaehlt nicht (Hoechstalter wie im Rechenkern)",
      produktEintrag(alt, 60, Date.parse("2026-10-17T12:00:00Z")).sell.preis === 900,
      JSON.stringify(produktEintrag(alt, 60, Date.parse("2026-10-17T12:00:00Z")))
    );
    pruefe("produktEintrag: ohne Daten null", produktEintrag(null) === null && produktEintrag({}) === null, "");

    const abs = { 1: { stueckJeTag: 4 }, 2: { stueckJeTag: 3 }, 4: { stueckJeTag: 0.5 } };
    pruefe(
      "volumen: Summe ueber alle Qualitaeten bzw. nur Normal; nichts erfasst = null",
      volumen(abs, true) === 7.5 && volumen(abs, false) === 4 && volumen({}, true) === null && volumen({ 2: { stueckJeTag: 3 } }, false) === 0,
      [volumen(abs, true), volumen(abs, false), volumen({}, true)].join(",")
    );

    // Integration: Breitschwert T5.0 in Lymhurst (Schwert-Craftbonus), ohne
    // Fokus, Kriegerschmiede-Satz 0. 16 Barren a 100 + 8 Leder a 200 = 3.200.
    // RRR = 0,33 / 1,33; Kosten = 3.200 / 1,33 = 2.406,02.
    const kBreit = schwert.find((k) => k.item === "T5_MAIN_SWORD" && k.stufe === 0);
    const sp = (p) => ({ sell: { preis: p, kein: false, datum: "" }, buy: { preis: null, kein: true, datum: "" } });
    const stadtDaten = [
      {
        stadt: "Lymhurst",
        preiseRoh: { T5_METALBAR: sp(100), T5_LEATHER: sp(200) },
        produktJeQ: { T5_MAIN_SWORD: { 1: sp(3000), 2: sp(2900) } },
        absatz: { T5_MAIN_SWORD: { 1: { stueckJeTag: 6 }, 2: { stueckJeTag: 2 } } },
      },
    ];
    const auswahl = einstellungenBereinigen({ warengruppen: ["sword"], verkaufsweg: "order", mitFokus: false });
    const einst = { premium: true, stationssaetze: { Kriegerschmiede: 0 }, fce: 0, tagesbonus: {}, maxPreisAlterMin: null, absatzAnteilProzent: 25 }; // 25 ausdruecklich gesetzt (Vorgabe seit v3.22.0: 10), die Zahlen der Tests rechnen damit
    const zeilen = zeilenRechnen([kBreit], stadtDaten, auswahl, einst);
    const z = zeilen[0];
    const erwartetKosten = 3200 / 1.33;
    const erwartetErloes = 2900 * (1 - 0.04 - 0.025);
    pruefe(
      "zeilenRechnen: Breitschwert in Lymhurst mit Craft-Bonus (24,8 %), Erloes aus der billigsten Qualitaet mit Steuer und Einstellgebuehr",
      z && Math.abs(z.silber - erwartetKosten) < 0.01 && Math.abs(z.rrr - 0.33 / 1.33) < 1e-9 && z.stadtbonus &&
        Math.abs(z.erloes - erwartetErloes) < 0.01 && Math.abs(z.gewinn - (erwartetErloes - erwartetKosten)) < 0.01 && z.sellQualitaet === 2,
      z && JSON.stringify({ silber: z.silber, rrr: z.rrr, erloes: z.erloes, q: z.sellQualitaet })
    );
    pruefe(
      "zeilenRechnen: verkauft/Tag ueber alle Qualitaeten (6 + 2), Normal getrennt (6)",
      z && z.stueckJeTag === 8 && z.stueckJeTagNormal === 6,
      z && z.stueckJeTag + " / " + z.stueckJeTagNormal
    );
    const zNormal = zeilenRechnen([kBreit], stadtDaten, Object.assign({}, auswahl, { volumenAlleQualitaeten: false }), einst)[0];
    pruefe("zeilenRechnen: Volumen nur Normal, wenn so eingestellt", zNormal.stueckJeTag === 6, zNormal.stueckJeTag);
    pruefe(
      "zeilenRechnen: Hoechstpreis je Zutat setzt den Gewinn auf 0 (linear, wie im Veredeln-Reiter)",
      (function () {
        const barren = z.zutatenPreise.find((x) => x.n === "T5_METALBAR");
        const neu = zeilenRechnen([kBreit], [Object.assign({}, stadtDaten[0], { preiseRoh: { T5_METALBAR: sp(barren.hoechstpreis), T5_LEATHER: sp(200) } })], auswahl, einst)[0];
        return Math.abs(neu.gewinn) < 0.01;
      })(),
      ""
    );
    const zMartlock = zeilenRechnen([kBreit], stadtDaten, Object.assign({}, auswahl, { fertigungsstadt: "Martlock", einkaufStaedte: ["Lymhurst"], verkaufStaedte: ["Lymhurst"] }), einst)[0];
    pruefe(
      "zeilenRechnen: ohne Craft-Bonus der Fertigungsstadt nur Grundproduktion (15,3 %)",
      Math.abs(zMartlock.rrr - 0.18 / 1.18) < 1e-9 && !zMartlock.stadtbonus,
      zMartlock.rrr
    );
    const zTag = zeilenRechnen([kBreit], stadtDaten, auswahl, Object.assign({}, einst, { tagesbonus: { sword: "gold" } }))[0];
    pruefe("zeilenRechnen: Tagesbonus 20 % auf Schwerter ergibt B = 0,53", Math.abs(zTag.rrr - 0.53 / 1.53) < 1e-9, zTag.rrr);
    const zFokus = zeilenRechnen([kBreit], stadtDaten, Object.assign({}, auswahl, { mitFokus: true }), einst)[0];
    pruefe(
      "zeilenRechnen: mit Fokus B = 0,92 und Fokus je Vorgang aus dem Dump (FCE 0)",
      Math.abs(zFokus.rrr - 0.92 / 1.92) < 1e-9 && Math.abs(zFokus.fokusJeVorgang - g.items.T5_MAIN_SWORD.r[0].f) < 1e-9,
      zFokus.rrr + " / " + zFokus.fokusJeVorgang
    );

    const fz = filtereUndSortiere(
      [
        { gewinn: 10, marge: 0.5, stueckJeTag: 10, einstufung: "gewinn" },
        { gewinn: 50, marge: 0.9, stueckJeTag: 2, einstufung: "gewinn" },
        { gewinn: 20, marge: 0.2, stueckJeTag: null, einstufung: "gewinn" },
        { gewinn: -50, marge: -0.5, stueckJeTag: 99, einstufung: "verlust" },
      ],
      { minAbsatz: 5, sortierung: "marge" }
    );
    pruefe(
      "filtereUndSortiere: Volumenfilter greift, ohne erfassten Handel faellt die Zeile heraus, Verluste ausgeblendet",
      fz.length === 1 && fz[0].gewinn === 10,
      JSON.stringify(fz)
    );
    pruefe(
      "sortiere: nach verkauft/Tag absteigend",
      sortiere([{ stueckJeTag: 1 }, { stueckJeTag: 9 }, { stueckJeTag: null }], "volumen").map((x) => x.stueckJeTag).join() === "9,1,",
      ""
    );
    pruefe(
      "einstellungenBereinigen: Vorgabe Einkauf Sofortkauf, Verkauf Verkaufsorder; Unbekanntes faellt weg",
      (function () {
        const e = einstellungenBereinigen({ warengruppen: ["sword", "fiber"], tiers: [9, 5], minAbsatz: -3 });
        return e.kaufweg === "sofort" && e.verkaufsweg === "order" && e.warengruppen.join() === "sword" && e.tiers.join() === "5" && e.minAbsatz === 0 && e.volumenAlleQualitaeten === true;
      })(),
      JSON.stringify(einstellungenBereinigen({ warengruppen: ["sword", "fiber"] }))
    );
    pruefe(
      "abrufSchaetzung: Zutaten einmal fuer alle Einkaufsstaedte, Preise und Handel je einmal fuer alle Verkaufsstaedte, dazu (v3.21.0) der Handel der Zutaten fuer die Einkaufsstaedte",
      (function () {
        const a = abrufSchaetzung(breit, { einkaufStaedte: ["Lymhurst"], verkaufStaedte: ["Lymhurst", "Martlock"] });
        const nurEinkauf = abrufSchaetzung(breit, { einkaufStaedte: ["Lymhurst", "Thetford"], verkaufStaedte: [] });
        // Gleiche Staedte: Handel der Produkte und der Zutaten in EINEM Abruf (15 IDs).
        const gleich = abrufSchaetzung(breit, { einkaufStaedte: ["Lymhurst"], verkaufStaedte: ["Lymhurst"] });
        return a.produkte === 5 && a.abrufe === 1 + 2 + 1 && nurEinkauf.abrufe === 1 + 1 && gleich.abrufe === 1 + 1 + 1;
      })(),
      JSON.stringify(abrufSchaetzung(breit, { einkaufStaedte: ["Lymhurst"], verkaufStaedte: ["Lymhurst", "Martlock"] }))
    );
    pruefe(
      "planBereinigen: nur ganze Stueckzahlen > 0",
      JSON.stringify(planBereinigen({ A: 3, B: 0, C: -2, D: "2.7", E: "x" })) === JSON.stringify({ A: 3, D: 2 }),
      JSON.stringify(planBereinigen({ A: 3, B: 0, C: -2, D: "2.7", E: "x" }))
    );
    (function () {
      const zp = (n, menge, preis, stadt) => ({ n, stufe: 0, marktId: n, menge, preis, basisPreis: preis, stadt: stadt || "Lymhurst" });
      const zeilenTest = [
        { marktId: "SCHWERT", item: "SCHWERT", stufe: 0, ausbeute: 1, zutatenPreise: [zp("BARREN", 16, 100), zp("LEDER", 8, 200)] },
        { marktId: "AXT", item: "AXT", stufe: 0, ausbeute: 1, zutatenPreise: [zp("BARREN", 20, 100), zp("BRETT", 12, 50, "Martlock")] },
        { marktId: "EINTOPF", item: "EINTOPF", stufe: 0, ausbeute: 10, zutatenPreise: [zp("FLEISCH", 72, 30)] },
      ];
      const l = einkaufsliste(zeilenTest, { SCHWERT: 3, AXT: 1, EINTOPF: 15, WEG: 2 });
      const barren = l.posten.find((p) => p.marktId === "BARREN");
      const fleisch = l.posten.find((p) => p.marktId === "FLEISCH");
      pruefe(
        "einkaufsliste: Zeilen ohne Angabe zur Rueckgewinnung rechnen mit der vollen Menge, gleiche Zutat zusammengezaehlt (3 x 16 + 20 Barren), Speisen in ganzen Vorgaengen (15 Stueck = 2 Vorgaenge)",
        barren.menge === 68 && fleisch.menge === 144 && l.posten.length === 4 && l.fehlend.join() === "WEG" &&
          Math.abs(l.summe - (68 * 100 + 24 * 200 + 12 * 50 + 144 * 30)) < 1e-9,
        JSON.stringify(l.posten.map((p) => p.marktId + ":" + p.menge)) + " / " + l.summe
      );
      const gs = { items: { T5_X_LEVEL2: { el: 2 } } };
      pruefe(
        "suchName: Name mit Tier.Verzauberung, auch .0, Eigenstufe des Knotens zaehlt",
        suchName("Breitschwert", "T5_MAIN_SWORD", 2, gs) === "Breitschwert 5.2" &&
          suchName("Breitschwert", "T5_MAIN_SWORD", 0, gs) === "Breitschwert 5.0" &&
          suchName("Planke", "T5_X_LEVEL2", 0, gs) === "Planke 5.2" &&
          suchName("Ohne", "QUESTITEM_X", 1, gs) === "Ohne",
        suchName("Breitschwert", "T5_MAIN_SWORD", 2, gs)
      );
      pruefe(
        "einkaufslisteText: Menge und Name je Zeile, tabgetrennt",
        einkaufslisteText({ posten: [barren] }, (n) => n + "-Name") === "68\tBARREN-Name",
        einkaufslisteText({ posten: [barren] }, (n) => n + "-Name")
      );

      // ---- v3.19.0 (O5): Umbau fuer den Reiter "Gelegenheiten" ----
      // Die Fassung v3.12.0 woertlich als Referenz: der Umbau darf an Posten,
      // Mengen, Kosten und Summe nichts aendern.
      function referenzV3120(zeilen, plan) {
        const nachId = {};
        (zeilen || []).forEach((z) => {
          if (!nachId[z.marktId]) nachId[z.marktId] = z;
        });
        const posten = {};
        const reihenfolge = [];
        const produkte = [];
        const fehlend = [];
        let summe = 0;
        let vollstaendig = true;
        Object.keys(plan || {}).forEach((id) => {
          const stueck = plan[id];
          const z = nachId[id];
          if (!z || !z.zutatenPreise || !z.zutatenPreise.length) {
            fehlend.push(id);
            return;
          }
          const vorgaenge = Math.ceil(stueck / (z.ausbeute || 1));
          produkte.push({ marktId: id, item: z.item, stufe: z.stufe, tier: z.tier, stueck, vorgaenge, ausbeute: z.ausbeute || 1 });
          z.zutatenPreise.forEach((x) => {
            const schluessel = x.marktId + "|" + x.stadt;
            if (!posten[schluessel]) {
              posten[schluessel] = { marktId: x.marktId, n: x.n, stufe: x.stufe, stadt: x.stadt, menge: 0, basisPreis: x.basisPreis, preis: x.preis, kosten: 0 };
              reihenfolge.push(schluessel);
            }
            const m = x.menge * vorgaenge;
            posten[schluessel].menge += m;
            if (x.preis != null && isFinite(x.preis)) {
              posten[schluessel].kosten += m * x.preis;
              summe += m * x.preis;
            } else vollstaendig = false;
          });
        });
        return { posten: reihenfolge.map((k) => posten[k]), produkte, fehlend, summe, vollstaendig };
      }
      const zeilenRef = zeilenTest.concat([
        { marktId: "OHNEPREIS", item: "OHNEPREIS", stufe: 1, tier: 6, ausbeute: 1, zutatenPreise: [zp("BARREN", 4, 100), { n: "RUNE", stufe: 0, marktId: "RUNE", menge: 2, preis: null, basisPreis: null, stadt: "Lymhurst" }] },
        { marktId: "LEER", item: "LEER", stufe: 0, ausbeute: 1, zutatenPreise: [] },
      ]);
      const planRef = { EINTOPF: 25, SCHWERT: 7, OHNEPREIS: 2, AXT: 3, LEER: 1, WEG: 4 };
      const alt = referenzV3120(zeilenRef, planRef);
      const neu = einkaufsliste(zeilenRef, planRef);
      // O10: die Posten tragen neue Felder (bedarf, rest, ...); verglichen werden die Felder der Fassung v3.12.0. Die Testzeilen haben keine effektiveMenge, also r = 0: Kaufmenge = Rezeptmenge.
      const postenAlt = (liste) => liste.map((p) => ({ marktId: p.marktId, n: p.n, stufe: p.stufe, stadt: p.stadt, menge: p.menge, basisPreis: p.basisPreis, preis: p.preis, kosten: p.kosten }));
      const kern = (x) => JSON.stringify({ posten: postenAlt(x.posten), fehlend: x.fehlend, summe: x.summe, vollstaendig: x.vollstaendig, produkte: x.produkte.map((p) => [p.marktId, p.item, p.stufe, p.tier, p.stueck, p.vorgaenge, p.ausbeute]) });
      pruefe(
        "o5 einkaufsliste: nach dem Umbau dieselben Posten, Mengen, Kosten, Summe und Produkte wie die Fassung v3.12.0 (Referenz im Test, sechs geplante Produkte, eine Zutat ohne Preis, zwei fehlende)",
        kern(alt) === kern(neu) && alt.posten.length === 5 && alt.fehlend.join() === "LEER,WEG" && alt.vollstaendig === false &&
          Math.abs(alt.summe - ((7 * 16 + 3 * 20 + 2 * 4) * 100 + 7 * 8 * 200 + 3 * 12 * 50 + 3 * 72 * 30)) < 1e-9,
        kern(neu).slice(0, 160) + " / Summe " + neu.summe
      );
      // Schluessel waehlbar, Erloes und Gewinn je Produkt (Zahlen der Zeile mal hergestellte Menge).
      const gemischt = [
        { schluessel: "c:SCHWERT", art: "craften", marktId: "SCHWERT", item: "SCHWERT", stufe: 0, ausbeute: 1, erloes: 2700, silber: 2100, gewinn: 600, zutatenPreise: [zp("BARREN", 16, 100), zp("LEDER", 8, 150, "Martlock")] },
        { schluessel: "v:BARREN6:0", art: "veredeln", marktId: "BARREN6", item: "BARREN6", stufe: 0, ausbeute: 1, erloes: 650, silber: 350, gewinn: 300, zutatenPreise: [zp("ERZ6", 4, 80), zp("BARREN", 1, 100)] },
        { schluessel: "v:BARREN6:1", art: "veredeln", marktId: "BARREN6", item: "BARREN6", stufe: 0, ausbeute: 2, erloes: 650, gewinn: null, zutatenPreise: [zp("ERZ6", 4, 80)] },
        { schluessel: "c:EINTOPF", art: "craften", marktId: "EINTOPF", item: "EINTOPF", stufe: 0, ausbeute: 10, erloes: 50, silber: 45, gewinn: 5, zutatenPreise: [zp("FLEISCH", 72, 30)] },
      ];
      const g = einkaufsliste(gemischt, { "c:SCHWERT": 3, "v:BARREN6:0": 10, "c:EINTOPF": 15, "c:WEG": 1 }, (z) => z.schluessel);
      const gB = g.posten.find((p) => p.marktId === "BARREN");
      pruefe(
        "o5 einkaufsliste: Zeilenschluessel statt Markt-ID (Craft und Veredelung gemischt), gemeinsame Zutat zusammengezaehlt (3 x 16 + 10 x 1 Barren), Erloes und Gewinn je Produkt und in Summe; Speisen rechnen mit der hergestellten Menge (15 geplant = 20 Stueck)",
        gB.menge === 58 && g.fehlend.join() === "c:WEG" && g.produkte.map((p) => p.schluessel).join() === "c:SCHWERT,v:BARREN6:0,c:EINTOPF" &&
          g.produkte[0].erloes === 8100 && g.produkte[0].gewinn === 1800 && g.produkte[1].erloes === 6500 && g.produkte[1].gewinn === 3000 &&
          g.produkte[2].hergestellt === 20 && g.produkte[2].erloes === 1000 && g.produkte[2].gewinn === 100 &&
          g.erloes === 15600 && g.gewinn === 4900 && g.ergebnisVollstaendig === true && g.summe === 58 * 100 + 24 * 150 + 40 * 80 + 144 * 30 && g.kostenNetto === 3 * 2100 + 10 * 350 + 20 * 45 && g.erloes - g.kostenNetto === g.gewinn,
        JSON.stringify({ barren: gB.menge, erloes: g.erloes, gewinn: g.gewinn, summe: g.summe })
      );
      const g2 = einkaufsliste(gemischt, { "v:BARREN6:1": 3 }, (z) => z.schluessel);
      pruefe(
        "o5 einkaufsliste: zwei Rezepte desselben Produkts bleiben ueber den Zeilenschluessel getrennt; fehlt der Gewinn einer Zeile, ist die Summe als unvollstaendig markiert",
        g2.produkte.length === 1 && g2.produkte[0].vorgaenge === 2 && g2.produkte[0].hergestellt === 4 && g2.posten[0].menge === 8 && g2.produkte[0].gewinn === null && g2.ergebnisVollstaendig === false && g2.produkte[0].erloes === 2600 && g2.erloes === 0 && g2.gewinn === 0 && g2.kostenNetto === 0,
        JSON.stringify(g2.produkte[0])
      );
      // Vier Summen passen zusammen: Erloes minus Kosten nach Rueckgewinnung = Gewinn; der Einkauf liegt darueber.
      const mitKosten = [
        { schluessel: "c:SCHWERT", marktId: "SCHWERT", item: "SCHWERT", stufe: 0, ausbeute: 1, erloes: 2700, silber: 2100, gewinn: 600, zutatenPreise: [zp("BARREN", 16, 100), zp("LEDER", 8, 150)] },
        { schluessel: "c:EINTOPF", marktId: "EINTOPF", item: "EINTOPF", stufe: 0, ausbeute: 10, erloes: 50, silber: 45, gewinn: 5, zutatenPreise: [zp("FLEISCH", 72, 30)] },
        { schluessel: "c:OHNE", marktId: "OHNE", item: "OHNE", stufe: 0, ausbeute: 1, erloes: null, silber: 900, gewinn: null, zutatenPreise: [zp("BARREN", 4, 100)] },
      ];
      const s4 = einkaufsliste(mitKosten, { "c:SCHWERT": 3, "c:EINTOPF": 15 }, (z) => z.schluessel);
      const s5 = einkaufsliste(mitKosten, { "c:SCHWERT": 3, "c:OHNE": 2 }, (z) => z.schluessel);
      const fuss = einkaufslisteSummenHtml(s4, { spalten: 3, order: false, fmt: (n) => String(n), esc: (t) => String(t).replace(/'/g, "&#39;") });
      const fussWerte = {};
      fuss.replace(/data-el-summe='(\w+)'>(-?[\d.]+)</g, (m, id, w) => (fussWerte[id] = Number(w)));
      pruefe(
        "o5 einkaufsliste: die vier Summen passen zusammen (Einkauf 3 x 2.800 + 2 x 2.160 = 12.720; Kosten nach Rueckgewinnung 3 x 2.100 + 20 x 45 = 7.200; Erloes 9.100; Gewinn 1.900 = Erloes minus Kosten), auch in der Darstellung; ein Produkt ohne Verkaufspreis zaehlt in keiner der drei Ergebnissummen",
        s4.summe === 12720 && s4.kostenNetto === 7200 && s4.erloes === 9100 && s4.gewinn === 1900 && s4.erloes - s4.kostenNetto === s4.gewinn && s4.summe > s4.kostenNetto && s4.produkte[1].kosten === 900 &&
          fussWerte.einkauf === 12720 && fussWerte.kosten === 7200 && fussWerte.erloes === 9100 && fussWerte.gewinn === 1900 && (fuss.match(/<tr title='[^']{30,}'/g) || []).length === 4 &&
          s5.ergebnisVollstaendig === false && s5.kostenNetto === 6300 && s5.erloes === 8100 && s5.gewinn === 1800 && s5.summe === 3 * 2800 + 2 * 400 &&
          /ohne Produkte ohne Verkaufspreis/.test(einkaufslisteSummenHtml(s5, { spalten: 3, order: true, fmt: String, esc: String })) && /Einstellgebühr/.test(einkaufslisteSummenHtml(s5, { spalten: 3, order: true, fmt: String, esc: String })),
        JSON.stringify(fussWerte)
      );
    })();

    // ---- O10, Teil 2: Einkaufsliste mit Bedarf nach Rueckgewinnung ----
    (function () {
      const nahe = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-9 : tol);
      // Gegenprobe Klerikerrobe T4.2 in Lymhurst (kein Stoffruestung-Bonus):
      // 16 Stoff je Robe, r = 0,18 / 1,18, also 1 - r = 1 / 1,18 = 0,847458.
      // 30 Roben: Bedarf 16 + 29 x 16 x 0,847458 = 409,22 -> 410; mit 2 %:
      // 417,41 -> 418; mit 12,5 %: 460,37 -> 461. Rezeptmenge 480.
      // Verbrauch 30 x 16 x 0,847458 = 406,78; Rest 410 - 406,78 = 3,22.
      const robeK = kandidaten({ warengruppen: ["cloth_armor"], tiers: [4], stufen: [2], artefakte: false }).find((k) => k.item === "T4_ARMOR_CLOTH_SET2");
      const stoffId = robeK ? marktIdVon(robeK.rezepte[0].zutaten[0].n, robeK.rezepte[0].zutaten[0].stufe) : "";
      const spR = (p) => ({ sell: { preis: p, kein: false, datum: "" }, buy: { preis: null, kein: true, datum: "" }, abgerufenAm: 1700000000000 });
      const datR = [{ stadt: "Lymhurst", preiseRoh: { [stoffId]: spR(1000) }, produktJeQ: { "T4_ARMOR_CLOTH_SET2@2": { 1: spR(30000) } }, absatz: {} }];
      const aR = einstellungenBereinigen({ warengruppen: ["cloth_armor"], verkaufsweg: "order", mitFokus: false });
      const eR = { premium: true, stationssaetze: { Magierturm: 0 }, fce: 0, tagesbonus: {}, maxPreisAlterMin: null };
      const zR = robeK ? zeilenRechnen([robeK], datR, aR, eR)[0] : null;
      const zRF = robeK ? zeilenRechnen([robeK], datR, Object.assign({}, aR, { mitFokus: true }), eR)[0] : null;
      const lst = (z, n, puffer) => einkaufsliste([z], { [z.marktId]: n }, null, puffer == null ? undefined : { pufferProzent: puffer });
      const l0 = zR ? lst(zR, 30) : null;
      const p0 = l0 ? l0.posten[0] : {};
      pruefe(
        "o10 einkaufsliste: Gegenprobe 30 Klerikerroben T4.2 (16 Stoff, r = 0,18 / 1,18): Bedarf 16 + 29 x 16 / 1,18 = 409,22, Kaufmenge 410 in der Vorgabe (Puffer 0), Rezeptmenge 480, Rest 3,22; Kosten und Summe = 410 x Preis",
        !!zR && zR.zutatenPreise.length === 1 && zR.zutatenPreise[0].menge === 16 && nahe(zR.rrr, 0.18 / 1.18) && l0.pufferProzent === 0 && PUFFER_VORGABE === 0 &&
          p0.menge === 410 && p0.mengeRezept === 480 && nahe(p0.bedarf, 16 + (29 * 16) / 1.18) && nahe(p0.bedarf, 409.22, 0.005) && nahe(p0.verbrauch, 480 / 1.18) && nahe(p0.rest, 410 - 480 / 1.18) && nahe(p0.rest, 3.22, 0.005) &&
          p0.mitRueckgewinnung === true && p0.kosten === 410000 && l0.summe === 410000 && p0.abgerufenAm === 1700000000000,
        JSON.stringify(p0)
      );
      pruefe(
        "o10 einkaufsliste: Puffer 2 % ergibt 418 (409,22 x 1,02 = 417,41), 12,5 % ergibt 461 (460,37), 0 ergibt 410; der Puffer wird auf 0 bis 50 mit einer Nachkommastelle begrenzt",
        !!zR && lst(zR, 30, 2).posten[0].menge === 418 && lst(zR, 30, 12.5).posten[0].menge === 461 && lst(zR, 30, 0).posten[0].menge === 410 && lst(zR, 30, 2).posten[0].pufferProzent === 2 &&
          nahe(lst(zR, 30, 2).posten[0].rest, 418 - 480 / 1.18) && lst(zR, 30, 2).summe === 418000 &&
          pufferBereinigen("12,54") === 12.5 && pufferBereinigen(99) === 50 && pufferBereinigen(-3) === 0 && pufferBereinigen("") === 0 && pufferBereinigen("x") === 0 && pufferBereinigen(null) === 0,
        zR ? [lst(zR, 30, 2).posten[0].menge, lst(zR, 30, 12.5).posten[0].menge].join() : ""
      );
      pruefe(
        "o10 einkaufsliste: ein einziger Vorgang braucht die volle Rezeptmenge (16); der Puffer wirkt dort nur ueber das Aufrunden (2 %: 16,32 -> 17)",
        !!zR && lst(zR, 1).posten[0].menge === 16 && lst(zR, 1, 2).posten[0].menge === 17 && nahe(lst(zR, 1).posten[0].rest, 16 - 16 / 1.18),
        zR ? lst(zR, 1, 2).posten[0].menge : ""
      );
      pruefe(
        "o10 einkaufsliste: mit Fokus (B 0,77, 1 - r = 1 / 1,77) sinkt der Bedarf: 16 + 29 x 16 / 1,77 = 278,15 -> 279 statt 410",
        !!zRF && nahe(zRF.rrr, 0.77 / 1.77) && nahe(lst(zRF, 30).posten[0].bedarf, 16 + (29 * 16) / 1.77) && lst(zRF, 30).posten[0].menge === 279,
        zRF ? lst(zRF, 30).posten[0].bedarf : ""
      );
      // Zutat ohne Rueckgewinnung: Artefakt-Item, echte Zeile aus dem Rechenkern.
      const artK = kandidaten({ warengruppen: ["sword"], tiers: [5], stufen: [0], artefakte: true }).find((k) => k.artefakt);
      (function () {
        const prA = {};
        artK.rezepte.forEach((r) => r.zutaten.forEach((zt) => (prA[marktIdVon(zt.n, zt.stufe)] = spR(istArtefakt(zt.n) ? 50000 : 100))));
        const zA = zeilenRechnen([artK], [{ stadt: "Lymhurst", preiseRoh: prA, produktJeQ: { [artK.marktId]: { 1: spR(900000) } }, absatz: {} }], einstellungenBereinigen({ warengruppen: ["sword"] }), { premium: true, stationssaetze: { Kriegerschmiede: 0 }, fce: 0, tagesbonus: {}, maxPreisAlterMin: null })[0];
        const lA = einkaufsliste([zA], { [zA.marktId]: 5 }, null, { pufferProzent: 10 });
        const art = lA.posten.find((p) => istArtefakt(p.n));
        const mat = lA.posten.find((p) => !istArtefakt(p.n));
        const xArt = zA.zutatenPreise.find((x) => istArtefakt(x.n));
        pruefe(
          "o10 einkaufsliste: Zutat ohne Rueckgewinnung (Artefakt von " + artK.item + "): volle Menge 5 x " + (xArt ? xArt.menge : "?") + ", kein Puffer trotz 10 %; das Material derselben Zeile bekommt Rueckgewinnung und Puffer",
          !!art && !!mat && verbrauchsAnteil(xArt, 1) === 1 && art.menge === 5 * xArt.menge && art.mitRueckgewinnung === false && art.pufferProzent === 0 && art.rest === 0 &&
            mat.mitRueckgewinnung === true && mat.pufferProzent === 10 && mat.menge < mat.mengeRezept && mat.menge === Math.ceil(mat.bedarf * 1.1 - 1e-9),
          JSON.stringify([art, mat].map((p) => p && [p.marktId, p.menge, p.mengeRezept, p.pufferProzent]))
        );
      })();
      // Zwei Produkte teilen eine Zutat (synthetische Zeilen, effektiveMenge je Stueck):
      //   A: 3 Vorgaenge, 16 Barren, 1 - r = 0,75: Bedarf 16 + 2 x 12 = 40, Verbrauch 36
      //   B: 2 Vorgaenge, 20 Barren ohne Rueckgewinnung: Bedarf 40, Verbrauch 40
      //   Summe 80; Puffer 10 % (weil A Rueckgewinnung hat): 88; Rest 88 - 76 = 12
      //   C (Speise, Ausbeute 10): 15 Stueck = 2 Vorgaenge, 72 Fleisch je Vorgang,
      //   effektiveMenge 7,2 / 1,18 je Stueck: Bedarf 72 + 72 / 1,18 = 133,02; mit 10 %: 146,32 -> 147
      const zq = (n, menge, eff, preis) => ({ n, stufe: 0, marktId: n, menge, effektiveMenge: eff, preis, basisPreis: preis, stadt: "Lymhurst" });
      const zwei = [
        { marktId: "A", item: "A", stufe: 0, ausbeute: 1, zutatenPreise: [zq("BARREN", 16, 12, 100)] },
        { marktId: "B", item: "B", stufe: 0, ausbeute: 1, zutatenPreise: [zq("BARREN", 20, 20, 100)] },
        { marktId: "C", item: "C", stufe: 0, ausbeute: 10, zutatenPreise: [zq("FLEISCH", 72, 7.2 / 1.18, 30)] },
      ];
      const l2 = einkaufsliste(zwei, { A: 3, B: 2, C: 15 }, null, { pufferProzent: 10 });
      const l2o = einkaufsliste(zwei, { A: 3, B: 2, C: 15 });
      const bar = l2.posten.find((p) => p.marktId === "BARREN");
      const fl = l2.posten.find((p) => p.marktId === "FLEISCH");
      pruefe(
        "o10 einkaufsliste: zwei Produkte teilen eine Zutat (40 + 40 = 80, mit 10 % Puffer 88, Rest 12; ohne Puffer 80, Rest 4); Speise mit Ausbeute 10: 15 Stueck = 2 Vorgaenge, Bedarf 72 + 72 / 1,18 = 133,02 -> 134, mit 10 %: 147",
        bar.menge === 88 && nahe(bar.bedarf, 80) && nahe(bar.verbrauch, 76) && nahe(bar.rest, 12) && bar.mengeRezept === 88 && bar.kosten === 8800 &&
          l2o.posten.find((p) => p.marktId === "BARREN").menge === 80 && nahe(l2o.posten.find((p) => p.marktId === "BARREN").rest, 4) &&
          l2.produkte[2].vorgaenge === 2 && fl.mengeRezept === 144 && nahe(fl.bedarf, 72 + 72 / 1.18) && fl.menge === 147 && l2o.posten.find((p) => p.marktId === "FLEISCH").menge === 134 &&
          l2.summe === 8800 + 147 * 30,
        JSON.stringify(l2.posten.map((p) => [p.marktId, p.menge, p.bedarf, p.rest]))
      );
      const alleListen = [l2, l2o].concat(zR ? [l0, lst(zR, 30, 2), lst(zR, 1), lst(zR, 7, 0.5), lst(zRF, 30, 50)] : []);
      pruefe(
        "o10 einkaufsliste: der erwartete Rest ist nie negativ und die Kaufmenge nie groesser als Rezeptmenge mal (1 + Puffer), in allen Listen dieser Tests",
        alleListen.every((l) => l.posten.every((p) => p.rest >= 0 && p.menge >= p.verbrauch - 1e-9 && Number.isInteger(p.menge) && p.menge <= Math.ceil(p.mengeRezept * (1 + p.pufferProzent / 100)))),
        alleListen.length + " Listen"
      );
      pruefe(
        "o10 einkaufslisteText: der Kopiertext nennt die Kaufmengen (88 Barren, 147 Fleisch)",
        einkaufslisteText(l2, (n) => n) === "88\tBARREN\n147\tFLEISCH" && (!zR || einkaufslisteText(l0, () => "Stoff") === "410\tStoff"),
        einkaufslisteText(l2, (n) => n)
      );
      const tt = zR ? einkaufslisteMengeTitel(p0) : "";
      const tt2 = zR ? einkaufslisteMengeTitel(lst(zR, 30, 2).posten[0]) : "";
      pruefe(
        "o10 einkaufsliste: Tooltip der Menge nennt Rezeptmenge 480, Bedarf 409,2, Puffer, Rest und den Hinweis auf EINEN Vorgang; das Label nennt den Puffer nur, wenn er gesetzt ist",
        /480/.test(tt) && /409,2/.test(tt) && /kein Puffer/.test(tt) && /Rest nach allen Vorgängen etwa 3\./.test(tt) && /EINEM Vorgang/.test(tt) && /Puffer 2 %: 417,4/.test(tt2) && /etwa 11\./.test(tt2) &&
          einkaufslisteLabel(l0) === "Bedarf nach Rückgewinnung" && einkaufslisteLabel(lst(zR, 30, 2)) === "Bedarf nach Rückgewinnung, Puffer 2 %" && einkaufslisteLabel(lst(zR, 30, 12.5)) === "Bedarf nach Rückgewinnung, Puffer 12,5 %" &&
          /keine Rückgewinnung/.test(einkaufslisteMengeTitel({ mengeRezept: 5, mitRueckgewinnung: false })),
        tt
      );
      const bed = einkaufslisteBedienHtml(l0, "cg", { laeuft: false, text: "Fehlertext", fehler: true }, [1600000000000], (t) => String(t));
      pruefe(
        "o10 einkaufsliste: Bedienzeile mit Feld Puffer (0 bis 50), Alter des aeltesten Preises (\"Preise von hh:mm\", hier der Verkaufspreis, aelter als der Stoff) und Fehlertext; der Knopf ist waehrend des Abrufs gesperrt",
        /data-cg-puffer='1'/.test(bed) && /max='50'/.test(bed) && /value='0'/.test(bed) && /Preise von \d\d:\d\d/.test(bed) && /cg-el-meldung err/.test(bed) && /Fehlertext/.test(bed) &&
          einkaufslisteAeltester(l0) === 1700000000000 && / disabled/.test(einkaufslisteFrischKnopfHtml("gl", { laeuft: true }, String)) && !/ disabled/.test(einkaufslisteFrischKnopfHtml("gl", { laeuft: false }, String)) &&
          /data-gl-preise-frisch='1'/.test(einkaufslisteFrischKnopfHtml("gl", null, String)),
        bed.slice(0, 200)
      );
      const sd = stadtDatenMischen(
        [{ stadt: "Lymhurst", preiseRoh: { A: 1, B: 2 }, produktJeQ: { P: 1, Q: 2 }, absatz: { P: 1 } }, { stadt: "Martlock", preiseRoh: { A: 5 } }],
        [{ stadt: "Lymhurst", preiseRoh: { A: 9 }, produktJeQ: { P: 8 }, absatz: { P: 7 }, zutatAbsatz: { A: 6 } }, { stadt: "Thetford", preiseRoh: { A: 0 } }]
      );
      pruefe(
        "o10 stadtDatenMischen: frisch geholte Werte ersetzen nur ihre IDs, der Rest der letzten Suche bleibt",
        JSON.stringify(sd) === JSON.stringify([{ stadt: "Lymhurst", preiseRoh: { A: 9, B: 2 }, produktJeQ: { P: 8, Q: 2 }, absatz: { P: 7 }, zutatAbsatz: { A: 6 } }, { stadt: "Martlock", preiseRoh: { A: 5 } }]),
        JSON.stringify(sd)
      );
    })();

    // ---- O10, Teil 1: Verkaufspreis absichern ----
    (function () {
      const nahe = (a, b) => Math.abs(a - b) < 1e-6;
      const mit = (jeQ, absatzJeQ) => [Object.assign({}, stadtDaten[0], { produktJeQ: { T5_MAIN_SWORD: jeQ }, absatz: { T5_MAIN_SWORD: absatzJeQ } })];
      const h = (stueck, p) => ({ stueckJeTag: stueck, mengengewichteterPreis: p });
      const basis = zeilenRechnen([kBreit], stadtDaten, auswahl, einst)[0];
      // Scherzangebot: 31.111.111 als einziges Angebot, gehandelt fuer 82.000.
      const scherz = zeilenRechnen([kBreit], mit({ 1: sp(31111111) }, { 1: h(500, 82000) }), auswahl, einst)[0];
      pruefe(
        "o10 zeilenRechnen: Scherzangebot (Angebot 31.111.111, gehandelt 82.000): verwendet 82.000, Quelle \"handel\", Erloes 82.000 x 0,935 = 76.670; Kosten unveraendert",
        scherz.produktPreis === 82000 && scherz.produktPreisAngebot === 31111111 && scherz.produktPreisHandel === 82000 && scherz.preisQuelle === "handel" && scherz.preisUnsicher === false &&
          nahe(scherz.erloes, 76670) && nahe(scherz.gewinn, 76670 - 3200 / 1.33) && scherz.silber === basis.silber && nahe(scherz.gewinnJeTag, scherz.gewinn * 0.25 * 500),
        JSON.stringify([scherz.produktPreis, scherz.preisQuelle, scherz.erloes])
      );
      const drunter = zeilenRechnen([kBreit], mit({ 1: sp(80997) }, { 1: h(500, 82000) }), auswahl, einst)[0];
      const gleich = zeilenRechnen([kBreit], mit({ 1: sp(82000) }, { 1: h(500, 82000) }), auswahl, einst)[0];
      pruefe(
        "o10 zeilenRechnen: Angebot unter dem Handelspreis (80.997 gegen 82.000): das Angebot zaehlt, Quelle \"angebot\", nicht unsicher; bei Gleichstand ebenso",
        drunter.produktPreis === 80997 && drunter.preisQuelle === "angebot" && drunter.produktPreisHandel === 82000 && drunter.preisUnsicher === false && nahe(drunter.erloes, 80997 * 0.935) &&
          gleich.preisQuelle === "angebot" && gleich.produktPreis === 82000,
        JSON.stringify([drunter.produktPreis, drunter.preisQuelle])
      );
      const ohneHandel = zeilenRechnen([kBreit], mit({ 1: sp(31111111) }, {}), auswahl, einst)[0];
      const nurGutHandel = zeilenRechnen([kBreit], mit({ 1: sp(5000) }, { 2: h(9, 100) }), auswahl, einst)[0];
      const ohnePreisfeld = zeilenRechnen([kBreit], mit({ 1: sp(5000) }, { 1: { stueckJeTag: 0, mengengewichteterPreis: null } }), auswahl, einst)[0];
      pruefe(
        "o10 zeilenRechnen: kein erfasster Handel in Normal (gar keiner, nur in Gut, oder 0 Stueck): das Angebot bleibt, preisUnsicher",
        ohneHandel.produktPreis === 31111111 && ohneHandel.preisQuelle === "angebot" && ohneHandel.produktPreisHandel === null && ohneHandel.preisUnsicher === true &&
          nurGutHandel.produktPreis === 5000 && nurGutHandel.preisUnsicher === true && ohnePreisfeld.preisUnsicher === true && ohnePreisfeld.produktPreis === 5000 && basis.preisUnsicher === true,
        JSON.stringify([ohneHandel.produktPreis, ohneHandel.preisUnsicher, nurGutHandel.preisUnsicher])
      );
      // Heiligenstab-Fall: billigstes (einziges) Angebot ist Exzellent 69.958, gehandelt wird Normal fuer 30.000.
      const exz = zeilenRechnen([kBreit], mit({ 4: sp(69958) }, { 1: h(12, 30000), 4: h(1, 70000) }), auswahl, einst)[0];
      const exzOhne = zeilenRechnen([kBreit], mit({ 4: sp(69958) }, { 4: h(1, 70000) }), auswahl, einst)[0];
      pruefe(
        "o10 zeilenRechnen: qualifizierbares Produkt, billigstes Angebot Exzellent 69.958, Handel Normal 30.000: verwendet 30.000 (Quelle \"handel\", das Angebot bleibt als produktPreisAngebot und sellQualitaet 4 sichtbar); ohne Normal-Handel bleibt 69.958 und die Zeile ist unsicher",
        exz.qualifizierbar && exz.produktPreis === 30000 && exz.preisQuelle === "handel" && exz.produktPreisAngebot === 69958 && exz.sellQualitaet === 4 && nahe(exz.erloes, 30000 * 0.935) &&
          exzOhne.produktPreis === 69958 && exzOhne.preisUnsicher === true && exzOhne.preisQuelle === "angebot",
        JSON.stringify([exz.produktPreis, exz.preisQuelle, exzOhne.produktPreis])
      );
      // Sofortverkauf: ueberhoehte Kauforder 5.000.000 in Normal, gehandelt 30.000; nur Steuer 4 %.
      const sofort = Object.assign({}, auswahl, { verkaufsweg: "sofort" });
      const kauf = (sell, buy) => ({ sell: { preis: sell, kein: false, datum: "" }, buy: { preis: buy, kein: false, datum: "" } });
      const ueber = zeilenRechnen([kBreit], mit({ 1: kauf(40000, 5000000) }, { 1: h(50, 30000) }), sofort, einst)[0];
      const normalSofort = zeilenRechnen([kBreit], mit({ 1: kauf(40000, 25000) }, { 1: h(50, 30000) }), sofort, einst)[0];
      pruefe(
        "o10 zeilenRechnen: Sofortverkauf mit ueberhoehter Kauforder (5.000.000 gegen gehandelte 30.000): verwendet 30.000, Erloes 30.000 x 0,96; eine Kauforder unter dem Handelspreis (25.000) zaehlt selbst",
        ueber.produktPreis === 30000 && ueber.preisQuelle === "handel" && ueber.produktPreisAngebot === 5000000 && nahe(ueber.erloes, 28800) &&
          normalSofort.produktPreis === 25000 && normalSofort.preisQuelle === "angebot" && nahe(normalSofort.erloes, 24000),
        JSON.stringify([ueber.produktPreis, ueber.erloes, normalSofort.produktPreis])
      );
      // Zwei Verkaufsstaedte: die Stadtwahl laeuft ueber den abgesicherten Preis.
      const zweiVk = zeilenRechnen(
        [kBreit],
        [
          Object.assign({}, stadtDaten[0], { produktJeQ: { T5_MAIN_SWORD: { 1: sp(31111111) } }, absatz: { T5_MAIN_SWORD: { 1: h(500, 82000) } } }),
          { stadt: "Martlock", produktJeQ: { T5_MAIN_SWORD: { 1: sp(90000) } }, absatz: { T5_MAIN_SWORD: { 1: h(40, 95000) } } },
        ],
        Object.assign({}, auswahl, { verkaufStaedte: ["Lymhurst", "Martlock"] }),
        einst
      )[0];
      pruefe(
        "o10 zeilenRechnen: zwei Verkaufsstaedte, das Scherzangebot in Lymhurst gewinnt die Stadtwahl nicht mehr: Martlock mit echten 90.000 schlaegt Lymhurst mit abgesicherten 82.000",
        zweiVk.vkStadt === "Martlock" && zweiVk.produktPreis === 90000 && zweiVk.preisQuelle === "angebot" && zweiVk.stueckJeTag === 40 &&
          nahe(zweiVk.vkAlle.find((a) => a.stadt === "Lymhurst").netto, 76670),
        JSON.stringify([zweiVk.vkStadt, zweiVk.produktPreis])
      );
      const fmtT = (n) => String(Math.round(n));
      const kz = V.preisKennzeichen(scherz, fmtT);
      const kzU = V.preisKennzeichen(ohneHandel, fmtT);
      const kzA = V.preisKennzeichen(drunter, fmtT);
      pruefe(
        "o10 preisKennzeichen: \"gehandelt\" mit beiden Werten im Tooltip, \"?\" bei unsicherem Preis, nichts Sichtbares, wenn das Angebot zaehlt",
        /vd-preis-handel/.test(kz.html) && /gehandelt/.test(kz.html) && /82000/.test(kz.titel) && /31111111/.test(kz.titel) && /niedrigere/.test(kz.titel) &&
          /vd-preis-unsicher/.test(kzU.html) && /unsicher/.test(kzU.titel) && kzA.html === "" && /82000/.test(kzA.titel) && V.preisKennzeichen(null, fmtT).html === "",
        kz.html + " / " + kzU.html
      );
    })();

    // ---- v3.18.0 (O4): Gewinn/Tag und Mehrgewinn je Fokuspunkt ----
    (function () {
      // Breitschwert T5.0 in Lymhurst wie oben: Kosten ohne Fokus 3.200 / 1,33,
      // mit Fokus 3.200 / 1,92, Erloes 2.900 x 0,935 = 2.711,5; Fokus je Stueck
      // aus dem Dump (FCE 0); 8 verkauft/Tag.
      const F = g.items.T5_MAIN_SWORD.r[0].f;
      const erl = 2900 * 0.935;
      const ohne = zeilenRechnen([kBreit], stadtDaten, auswahl, einst)[0];
      const mit = zeilenRechnen([kBreit], stadtDaten, Object.assign({}, auswahl, { mitFokus: true }), einst)[0];
      const mehr = (3200 / 1.33 - 3200 / 1.92) / F;
      pruefe(
        "o4 zeilenRechnen: Mehrgewinn je Fokuspunkt = (3.200 / 1,33 - 3.200 / 1,92) / Fokus je Stueck, mit und ohne Fokus-Schalter gleich",
        F > 0 && Math.abs(ohne.mehrgewinnJeFokus - mehr) < 1e-9 && Math.abs(mit.mehrgewinnJeFokus - mehr) < 1e-9 && Math.abs(ohne.fokusJeStueck - F) < 1e-9 &&
          Math.abs(ohne.gewinnOhneFokus - ohne.gewinn) < 1e-9 && Math.abs(mit.gewinnMitFokus - mit.gewinn) < 1e-9,
        ohne.mehrgewinnJeFokus + " / " + mehr + " / F " + F
      );
      pruefe(
        "o4 zeilenRechnen: Gewinn/Tag ohne Fokus = (2.711,5 - 3.200 / 1,33) x 25 % von 8 verkauft/Tag = 610,97",
        Math.abs(ohne.gewinnJeTag - (erl - 3200 / 1.33) * 2) < 1e-6 && Math.abs(ohne.gewinnJeTag - 610.97) < 0.01 && ohne.tagGrenze === "absatz" && ohne.stueckJeTagErreichbar === 2,
        ohne.gewinnJeTag
      );
      // Mit Fokus: 10.000 / F Stueck je Tag. Bei 8 verkauft/Tag begrenzt der
      // Absatz (2 Stueck), bei 8.000 verkauft/Tag der Fokus.
      const viel = [Object.assign({}, stadtDaten[0], { absatz: { T5_MAIN_SWORD: { 1: { stueckJeTag: 8000 } } } })];
      const mitViel = zeilenRechnen([kBreit], viel, Object.assign({}, auswahl, { mitFokus: true }), einst)[0];
      const fokusStueck = 10000 / F;
      pruefe(
        "o4 zeilenRechnen: mit Fokus begrenzt je nach Lage der Absatz (25 % von 8 = 2 Stueck) oder das Fokusbudget (10.000 / Fokus je Stueck)",
        fokusStueck > 2 && fokusStueck < 2000 && Math.abs(mit.gewinnJeTag - (erl - 3200 / 1.92) * 2) < 1e-6 && mit.tagGrenze === "absatz" &&
          Math.abs(mitViel.gewinnJeTag - (erl - 3200 / 1.92) * fokusStueck) < 1e-6 && mitViel.tagGrenze === "fokus" && Math.abs(mitViel.stueckJeTagErreichbar - fokusStueck) < 1e-9,
        mit.gewinnJeTag + " / " + mitViel.gewinnJeTag + " / " + fokusStueck
      );
      const ohnePremium = zeilenRechnen([kBreit], viel, Object.assign({}, auswahl, { mitFokus: true }), Object.assign({}, einst, { premium: false }))[0];
      pruefe(
        "o4 zeilenRechnen: ohne Premium keine Fokusgrenze (kein belegtes Tagesbudget): Gewinn/Stueck x 25 % von 8.000",
        ohnePremium.tagGrenze === "absatz" && ohnePremium.fokusBudgetBelegt === false && Math.abs(ohnePremium.gewinnJeTag - ohnePremium.gewinn * 2000) < 1e-6,
        ohnePremium.gewinnJeTag
      );
      const keinHandel = zeilenRechnen([kBreit], [Object.assign({}, stadtDaten[0], { absatz: {} })], auswahl, einst)[0];
      const nurGut = zeilenRechnen([kBreit], [Object.assign({}, stadtDaten[0], { absatz: { T5_MAIN_SWORD: { 2: { stueckJeTag: 9 } } } })], Object.assign({}, auswahl, { volumenAlleQualitaeten: false }), einst)[0];
      pruefe(
        "o4 zeilenRechnen: ohne erfassten Handel (auch 0 in Normal bei \"nur Normal\") bleibt Gewinn/Tag leer und sortiert ans Ende",
        keinHandel.gewinnJeTag === null && keinHandel.gewinn != null && nurGut.stueckJeTag === 0 && nurGut.gewinnJeTag === null &&
          sortiere([keinHandel, ohne, nurGut], "tag")[0] === ohne && filtereUndSortiere([keinHandel, ohne], { minAbsatz: 0, sortierung: "tag" }).map((x) => x.gewinnJeTag).join() === ohne.gewinnJeTag + ",",
        keinHandel.gewinnJeTag + " / " + nurGut.gewinnJeTag
      );
      const halb = zeilenRechnen([kBreit], stadtDaten, auswahl, Object.assign({}, einst, { absatzAnteilProzent: 50 }))[0];
      pruefe("o4 zeilenRechnen: gemeinsamer Anteil 50 % verdoppelt den Gewinn/Tag", Math.abs(halb.gewinnJeTag - 2 * ohne.gewinnJeTag) < 1e-6, halb.gewinnJeTag);

      // ---- v3.21.0 (O7): Markttiefe im Einkauf, Craft mit zwei Zutaten ----
      // Breitschwert T5.0: 16 Barren und 8 Leder je Stueck, Rueckgewinnung
      // B 0,33, also Bedarf 16 / 1,33 und 8 / 1,33. Bei 8.000 verkauft/Tag
      // liesse der Absatz 2.000 Stueck zu. Barren 4.800/Tag: 25 % x 4.800 x
      // 1,33 / 16 = 99,75 Stueck; Leder 1.000/Tag: 25 % x 1.000 x 1,33 / 8 =
      // 41,5625 Stueck. Das Leder entscheidet.
      const mitZutaten = (za, absatzProdukt) => [Object.assign({}, stadtDaten[0], { absatz: { T5_MAIN_SWORD: { 1: { stueckJeTag: absatzProdukt == null ? 8000 : absatzProdukt } } }, zutatAbsatz: za })];
      const zaBeide = { T5_METALBAR: { stueckJeTag: 4800, abgerufenAm: 11 }, T5_LEATHER: { stueckJeTag: 1000, abgerufenAm: 12 } };
      const ekC = zeilenRechnen([kBreit], mitZutaten(zaBeide), auswahl, einst)[0];
      pruefe(
        "o7 zeilenRechnen: Craft mit zwei Zutaten, die knappere entscheidet (Leder 41,5625 Stueck vor Barren 99,75 und Absatz 2.000): (2.711,5 - 3.200 / 1,33) x 41,5625 = 12.696,72; Kosten und Gewinn/Stueck unveraendert",
        Math.abs(ekC.einkaufStueckJeTag - 41.5625) < 1e-9 && ekC.einkaufZutat.marktId === "T5_LEATHER" && ekC.tagGrenze === "einkauf" && Math.abs(ekC.gewinnJeTag - (erl - 3200 / 1.33) * 41.5625) < 1e-6 &&
          Math.abs(ekC.gewinnJeTag - 12696.72) < 0.01 && ekC.silber === ohne.silber && ekC.gewinn === ohne.gewinn && ekC.marge === ohne.marge && ekC.einkaufUnbekannt === false,
        ekC.gewinnJeTag + " / " + ekC.einkaufStueckJeTag
      );
      const ekCAbsatz = zeilenRechnen([kBreit], mitZutaten(zaBeide, 8), auswahl, einst)[0];
      const ekCFokus = zeilenRechnen([kBreit], mitZutaten({ T5_METALBAR: { stueckJeTag: 1e7 }, T5_LEATHER: { stueckJeTag: 1e7 } }), Object.assign({}, auswahl, { mitFokus: true }), einst)[0];
      pruefe(
        "o7 zeilenRechnen: bei 8 verkauft/Tag bindet der Absatz (2 Stueck, Zahl wie bis v3.20.1); bei reichlich Zutaten und Fokus bindet das Fokusbudget",
        ekCAbsatz.tagGrenze === "absatz" && ekCAbsatz.gewinnJeTag === ohne.gewinnJeTag && ekCAbsatz.einkaufStueckJeTag > 2 && ekCFokus.tagGrenze === "fokus" && ekCFokus.gewinnJeTag === mitViel.gewinnJeTag,
        ekCAbsatz.gewinnJeTag + " / " + ekCFokus.tagGrenze
      );
      const ekCFehlt = zeilenRechnen([kBreit], mitZutaten({ T5_METALBAR: { stueckJeTag: 4800 } }), auswahl, einst)[0];
      const ekCNull = zeilenRechnen([kBreit], mitZutaten({ T5_METALBAR: { stueckJeTag: 4800 }, T5_LEATHER: { stueckJeTag: 0 } }), auswahl, einst)[0];
      const ekCEigen = zeilenRechnen([kBreit], mitZutaten(zaBeide), Object.assign({}, auswahl, { preisUeberschreibungen: { Lymhurst: { T5_LEATHER: 200 } } }), einst)[0];
      pruefe(
        "o7 zeilenRechnen: Leder nie abgerufen: der Barren begrenzt (99,75 Stueck) und einkaufUnbekannt; Leder ohne Handel: Gewinn/Tag 0, Zeile bleibt und sortiert nach unten; eigener Lederpreis: Leder begrenzt nicht mehr",
        ekCFehlt.einkaufUnbekannt === true && ekCFehlt.einkaufFehlt[0].marktId === "T5_LEATHER" && Math.abs(ekCFehlt.einkaufStueckJeTag - 99.75) < 1e-9 && ekCFehlt.tagGrenze === "einkauf" &&
          ekCNull.gewinnJeTag === 0 && ekCNull.tagGrenze === "einkauf" && ekCNull.gewinn === ohne.gewinn &&
          filtereUndSortiere([ekCNull, ekC], { minAbsatz: 0, sortierung: "tag" }).map((x) => x.gewinnJeTag).join() === ekC.gewinnJeTag + ",0" &&
          Math.abs(ekCEigen.einkaufStueckJeTag - 99.75) < 1e-9 && ekCEigen.einkaufZutat.marktId === "T5_METALBAR" && ekCEigen.silber === ohne.silber && ekCEigen.einkaufUnbekannt === false,
        ekCFehlt.einkaufStueckJeTag + " / " + ekCNull.gewinnJeTag + " / " + ekCEigen.einkaufStueckJeTag
      );
      const ekCNormal = zeilenRechnen([kBreit], mitZutaten({ T5_METALBAR: { stueckJeTag: 4800 }, T5_LEATHER: { stueckJeTag: 1000 } }), Object.assign({}, auswahl, { volumenAlleQualitaeten: false }), einst)[0];
      pruefe(
        "o7 zeilenRechnen: der Schalter \"nur Normal\" betrifft nur das Produkt, die Einkaufsgrenze bleibt gleich",
        ekCNormal.einkaufStueckJeTag === ekC.einkaufStueckJeTag && ekCNormal.gewinnJeTag === ekC.gewinnJeTag,
        ekCNormal.einkaufStueckJeTag
      );

      // Vorgang ohne Fokus im Dump (craftingfocus 0): Mehrgewinn leer.
      const alleSpeisen = kandidaten({ warengruppen: ["food"], tiers: [8], stufen: [0], artefakte: true });
      const ohneF = alleSpeisen.find((k) => k.rezepte.every((r) => !(REGELN.rezepteFuerStufe(g.items[k.item], k.stufe)[r.rezeptIndex].f > 0)));
      pruefe(
        "o4 zeilenRechnen: Craft ohne Fokus im Dump (" + (ohneF ? ohneF.item : "keiner gefunden") + ") hat keinen Mehrgewinn je Fokuspunkt, aber einen Gewinn/Tag",
        (function () {
          if (!ohneF) return false;
          const preiseRoh = {};
          ohneF.rezepte.forEach((r) => r.zutaten.forEach((zt) => (preiseRoh[marktIdVon(zt.n, zt.stufe)] = sp(10))));
          const dat = [{ stadt: "Lymhurst", preiseRoh, produktJeQ: { [ohneF.marktId]: { 1: sp(1000000) } }, absatz: { [ohneF.marktId]: { 1: { stueckJeTag: 40 } } } }];
          const z1 = zeilenRechnen([ohneF], dat, Object.assign({}, auswahl, { warengruppen: ["food"], mitFokus: true }), Object.assign({}, einst, { stationssaetze: { Kueche: 0 } }))[0];
          return z1.gewinn > 0 && z1.mehrgewinnJeFokus === null && z1.fokusJeStueck === null && Math.abs(z1.gewinnJeTag - z1.gewinn * 10) < 1e-6 && z1.tagGrenze === "absatz" && z1.fokusBudgetBelegt === null;
        })(),
        ohneF ? ohneF.marktId : ""
      );

      // Bisherige Zahlen unveraendert: zeichengleich zur Rechnung vor dem
      // Umbau (fokusAus je nach Schalter, bester Craft dieser Variante).
      const viele = kandidaten({ warengruppen: ["sword", "bow", "cloth_helmet", "bag"], tiers: [4, 5, 6], stufen: [0, 1, 2], artefakte: true });
      const ids = benoetigteMarktIds(viele);
      const prZ = {};
      ids.zutaten.forEach((id, i) => (prZ[id] = sp(60 + ((i * 53) % 307))));
      const prP = {};
      ids.produkte.forEach((id, i) => (prP[id] = { 1: sp(20000 + ((i * 131) % 9001)) }));
      const datV = [{ stadt: "Lymhurst", preiseRoh: prZ, produktJeQ: prP, absatz: {} }];
      const e3 = { premium: true, stationssaetze: { Kriegerschmiede: 400, Jaegerhuette: 300, Magierturm: 350, Werkzeugmacher: 250 }, fce: 9000, tagesbonus: { bow: "gold" }, maxPreisAlterMin: null };
      const abweichend = [];
      [false, true].forEach((mitFokus) => {
        const neu = zeilenRechnen(viele, datV, Object.assign({}, auswahl, { mitFokus }), e3);
        viele.forEach((k, i) => {
          const alt = besterCraft(
            RECHENKERN.kosten(k.item, k.stufe, 1, {
              preise: REGELN.preiseZuOptsFormat(prZ), eigenpreise: {}, kaufweg: "sofort", stadt: "Lymhurst", stationssaetze: e3.stationssaetze, fce: e3.fce, fceUeberschreibungen: {}, fokusAus: !mitFokus,
              fokusRegelJeKategorie: {}, fokusUebersteuerungJeKnoten: {}, fokuswert: 0, tagesbonus: e3.tagesbonus, zusatzProduktionsbonus: 0, maxPreisAlterMin: null, nurDirekteEbene: true,
            }),
            k.rezepte.map((r) => r.rezeptIndex),
            mitFokus
          );
          const zz = neu[i];
          const erloes = REGELN.erloesJeStueck(prP[k.marktId][1], { verkaufsweg: "order", premium: true, maxPreisAlterMin: null }).netto;
          if (!alt || String(zz.silber) !== String(alt.silber) || String(zz.gewinn) !== String(erloes - alt.silber) || String(zz.marge) !== String((erloes - alt.silber) / alt.silber) || zz.rezeptIndex !== alt.weg.rezeptIndex)
            abweichend.push(k.marktId + (mitFokus ? "+F" : ""));
        });
      });
      pruefe(
        "o4 bisherige Zahlen unveraendert: Kosten, Gewinn/Stueck, Marge und gewaehltes Rezept zeichengleich zur Rechnung vor dem Umbau (" + viele.length + " Crafts, mit und ohne Fokus)",
        viele.length > 100 && abweichend.length === 0,
        abweichend.slice(0, 5).join(", ")
      );
      // O10: liegt der Handelspreis nicht unter dem Angebot, aendert die Absicherung nichts (die Rechnung oben laeuft ohne Handelspreis und entspricht der Fassung vor O10).
      (function () {
        const abH = {};
        ids.produkte.forEach((id, i) => (abH[id] = { 1: { stueckJeTag: 9, mengengewichteterPreis: prP[id][1].sell.preis + (i % 3 === 0 ? 0 : 1 + i) } }));
        const datH = [{ stadt: "Lymhurst", preiseRoh: prZ, produktJeQ: prP, absatz: abH }];
        const anders = [];
        let n = 0;
        [false, true].forEach((mitFokus) => {
          const a = Object.assign({}, auswahl, { mitFokus });
          const ohne = zeilenRechnen(viele, datV, a, e3);
          const mitH = zeilenRechnen(viele, datH, a, e3);
          ohne.forEach((z, i) => {
            n++;
            const m = mitH[i];
            if (["silber", "erloes", "gewinn", "marge", "produktPreis", "rezeptIndex"].some((f) => String(z[f]) !== String(m[f])) || m.preisQuelle !== "angebot" || m.preisUnsicher || !z.preisUnsicher) anders.push(z.marktId);
          });
        });
        pruefe(
          "o10 Vorher-Nachher: mit Handelspreis gleich oder ueber dem Angebot sind Kosten, Erloes, Gewinn, Marge und Preis zeichengleich zur Rechnung ohne Handelspreis (" + n + " Zeilen, mit und ohne Fokus)",
          n > 200 && anders.length === 0,
          anders.slice(0, 5).join(", ")
        );
      })();

      const alt1 = einstellungenBereinigen({ sortierung: "marge" });
      const bewusst = einstellungenBereinigen(Object.assign({}, alt1, { sortierung: "marge" }));
      pruefe(
        "o4 Sortierung: Vorgabe Gewinn/Tag; gespeichertes \"marge\" wird einmalig umgestellt, danach bewusst gewaehltes \"marge\" bleibt, gespeichertes \"gesamt\" und \"volumen\" bleiben",
        standardEinstellungen().sortierung === "tag" && alt1.sortierung === "tag" && alt1.sortTagUmgestellt === true && bewusst.sortierung === "marge" &&
          einstellungenBereinigen(JSON.parse(JSON.stringify(bewusst))).sortierung === "marge" && einstellungenBereinigen({ sortierung: "gesamt" }).sortierung === "gesamt" &&
          einstellungenBereinigen({ sortierung: "volumen" }).sortierung === "volumen" && einstellungenBereinigen({ sortierung: "quatsch" }).sortierung === "tag",
        [alt1.sortierung, bewusst.sortierung].join()
      );
    })();

    return ergebnisse;
  }

  // -----------------------------------------------------------------------
  // Oberflaeche
  // -----------------------------------------------------------------------

  /**
   * Preise und Handelsvolumen der Auswahl beschaffen (v3.15.0): aus dem
   * Preisbestand, was frisch ist, der Rest per Abruf. Seit v3.16.0 alle
   * Staedte in einem Abruf je ID-Block (PREISE, Abrufplaner): Zutatenpreise
   * nur fuer die Einkaufsstaedte, Produktpreise nur fuer die
   * Verkaufsstaedte, Handelsvolumen der Produkte fuer die Verkaufs- und
   * (seit v3.21.0) der Zutaten fuer die Einkaufsstaedte. opts.frisch erzwingt den Abruf von allem. Ohne DOM,
   * mit nachgebildetem fetch testbar.
   * @returns {Promise<{stadtDaten:Array, ids:{zutaten:string[], produkte:string[]}, abrufe:number}>}
   */
  async function datenAbrufen(kand, auswahl, opts) {
    opts = opts || {};
    const status = typeof opts.aufStatus === "function" ? opts.aufStatus : function () {};
    const frisch = !!opts.frisch;
    const ids = benoetigteMarktIds(kand);
    const staedte = STAEDTE.filter((s) => auswahl.einkaufStaedte.indexOf(s) !== -1 || auswahl.verkaufStaedte.indexOf(s) !== -1);
    const einkauf = staedte.filter((s) => auswahl.einkaufStaedte.indexOf(s) !== -1);
    const verkauf = staedte.filter((s) => auswahl.verkaufStaedte.indexOf(s) !== -1);
    const anzahl = (liste) => liste.length + (liste.length === 1 ? " Stadt" : " Städte");
    const start = PREISE.abrufZaehler();
    let preiseRoh = {};
    let produktJeQ = {};
    let absatz = {};
    if (einkauf.length) {
      preiseRoh = await PREISE.preiseAbrufen(ids.zutaten, {
        staedte: einkauf,
        erzwingen: frisch,
        qualitaet: 1,
        aufFortschritt: (f, g) => status("Materialpreise (" + anzahl(einkauf) + ") " + f + "/" + g + " ..."),
      });
    }
    if (verkauf.length) {
      produktJeQ = await PREISE.preiseAlleQualitaetenAbrufen(ids.produkte, {
        staedte: verkauf,
        erzwingen: frisch,
        aufFortschritt: (f, g) => status("Verkaufspreise (" + anzahl(verkauf) + ") " + f + "/" + g + " ..."),
      });
    }
    // v3.21.0 (O7): Handelsvolumen der Produkte (Verkaufsstaedte) und der
    // Zutaten (Einkaufsstaedte), jede ID hoechstens einmal.
    staedte.forEach((s) => {
      absatz[s] = {};
    });
    for (const gr of V.absatzGruppen(ids.zutaten, ids.produkte, einkauf, verkauf)) {
      const teil = await PREISE.absatzAbrufen(gr.ids, {
        staedte: gr.staedte,
        tageFenster: TAGE_FENSTER,
        erzwingen: frisch,
        aufFortschritt: (f, g) => status("Handelsvolumen (" + anzahl(gr.staedte) + ") " + f + "/" + g + " ..."),
      });
      gr.staedte.forEach((s) => Object.assign(absatz[s], teil[s]));
    }
    const stadtDaten = staedte.map((stadt) => {
      const eintrag = { stadt };
      if (preiseRoh[stadt]) {
        eintrag.preiseRoh = preiseRoh[stadt];
        eintrag.zutatAbsatz = V.zutatAbsatzAusBestand(stadt, ids.zutaten, PREISE.bestandAbsatz);
      }
      if (produktJeQ[stadt]) {
        eintrag.produktJeQ = produktJeQ[stadt];
        eintrag.absatz = {};
        ids.produkte.forEach((id) => {
          if (absatz[stadt][id] !== undefined) eintrag.absatz[id] = absatz[stadt][id];
        });
      }
      return eintrag;
    });
    return { stadtDaten, ids, abrufe: PREISE.abrufZaehler() - start };
  }

  /**
   * O10: "Preise aktualisieren" der Einkaufsliste. Holt fuer die geplanten
   * Produkte (plan: Markt-ID -> Stueck) sofort frisch, was datenAbrufen()
   * sonst aus dem Bestand naehme: Zutatenpreise in den Einkaufsstaedten,
   * Verkaufspreise aller Qualitaeten und verkauft/Tag in den Verkaufsstaedten
   * (dazu verkauft/Tag der Zutaten, wie jede Suche). Keine eigene
   * Abrufschicht: datenAbrufen() mit frisch = true, Vordergrund ueber den
   * Planer. Bei Artefakt-Items gehoeren die Zutaten beider Rezepte dazu,
   * weil die Zeile das billigere waehlt.
   * @returns {Promise<?object>} Ergebnis von datenAbrufen() oder null, wenn kein geplantes Produkt unter den Kandidaten ist
   */
  async function planAktualisieren(kand, auswahl, plan, opts) {
    const geplant = (kand || []).filter((k) => plan && plan[k.marktId] > 0);
    if (!geplant.length) return null;
    return datenAbrufen(geplant, auswahl, Object.assign({}, opts || {}, { frisch: true }));
  }

  /** Frisch geholte stadtDaten (Teilmenge der IDs) in die Daten der letzten Suche einsetzen. */
  function stadtDatenMischen(ziel, neu) {
    (neu || []).forEach((n) => {
      const a = (ziel || []).find((x) => x.stadt === n.stadt);
      if (!a) return;
      ["preiseRoh", "produktJeQ", "absatz", "zutatAbsatz"].forEach((f) => {
        if (n[f]) a[f] = Object.assign({}, a[f] || {}, n[f]);
      });
    });
    return ziel;
  }

  function boot() {
    const wurzel = document.getElementById("tab-craften");
    if (!wurzel) return; // z.B. tests/test.html
    const el = (id) => document.getElementById(id);
    const gruppenEl = el("cgGruppen");
    const tiersEl = el("cgTiers");
    const stufenEl = el("cgStufen");
    const einkaufEl = el("cgEinkauf");
    const verkaufEl = el("cgVerkauf");
    const fertigungEl = el("cgFertigung");
    const bonusEl = el("cgBonus");
    const rrrEl = el("cgRrr");
    const toleranzEl = el("cgToleranz");
    const mengeEl = el("cgMenge");
    const minAbsatzEl = el("cgMinAbsatz");
    const verlusteEl = el("cgVerluste");
    const tagesbonusEl = el("cgTagesbonus");
    const zusatzbonusEl = el("cgZusatzbonus");
    const mehrTextEl = el("cgMehrText");
    const startEl = el("cgStart");
    const frischEl = el("cgFrisch");
    const statusEl = el("cgStatus");
    const ausgabeEl = el("cgAusgabe");
    const listeEl = el("cgEinkaufsliste");
    const stationenEl = el("cgStationen");
    const preiseResetEl = el("cgPreiseReset");
    const umfangEl = el("cgUmfang");
    const anteilEl = el("cgAnteil");

    let auswahl = standardEinstellungen();
    let letzteZeilen = null;
    let daten = null;
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
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/'/g, "&#39;").replace(/"/g, "&quot;");
    const fmt = (n) => (typeof UI !== "undefined" && UI.formatSilber ? UI.formatSilber(n) : String(Math.round(n)));
    const fmtFokus = (n) => (typeof UI !== "undefined" && UI.formatFokus ? UI.formatFokus(n) : String(Math.round(n)));
    const prozent = (a) => (a * 100).toFixed(1).replace(".", ",") + " %";
    const stueck = (n) => (n == null ? "k. A." : n >= 10 ? Math.round(n).toLocaleString("de-DE") : n.toFixed(1).replace(".", ","));
    const TRANSPORT = "Transportkosten, Gewicht und Reiserisiko sind nicht eingerechnet.";

    function icon(itemId, px, alt) {
      return (
        "<span class='vd-ic' style='width:" + px + "px;height:" + px + "px'>" +
        "<img src='" + esc(V.iconUrl(itemId, px)) + "' width='" + px + "' height='" + px + "' alt='" + esc(alt || "") + "' loading='lazy' decoding='async' onerror='this.remove()'></span>"
      );
    }

    // Beispiel-Icon je Warengruppe: erstes T4-Item (sonst niedrigstes Tier) ohne Artefakt im Rezept.
    const beispiel = {};
    Object.keys(REZEPTGRAPH.items)
      .sort()
      .forEach((id) => {
        const n = REZEPTGRAPH.items[id];
        if (!n.cc || n.el || !LABEL[n.cc]) return;
        if ((n.r || []).some((r) => (r.i || []).some((z) => istArtefakt(z.n)))) return;
        const bisher = beispiel[n.cc] ? REZEPTGRAPH.items[beispiel[n.cc]].t : null;
        if (bisher == null || (bisher !== 4 && (n.t === 4 || n.t < bisher))) beispiel[n.cc] = id;
      });

    const GRUPPEN = {
      warengruppen: { el: gruppenEl, werte: WARENGRUPPEN.map((w) => w.cc), parse: (v) => v },
      tiers: { el: tiersEl, werte: TIERS, parse: Number },
      stufen: { el: stufenEl, werte: STUFEN, parse: Number },
      einkaufStaedte: { el: einkaufEl, werte: STAEDTE, parse: (v) => v },
      verkaufStaedte: { el: verkaufEl, werte: STAEDTE, parse: (v) => v },
    };

    function chip(gruppe, wert, inhalt, an, klasse, titel) {
      return (
        "<label class='vd-chip" + (klasse ? " " + klasse : "") + (an ? " an" : "") + "'" + (titel ? " title='" + esc(titel) + "'" : "") + ">" +
        "<input type='checkbox' data-gruppe='" + gruppe + "' value='" + esc(wert) + "'" + (an ? " checked" : "") + ">" + inhalt + "</label>"
      );
    }

    function gruppenAufbauen() {
      gruppenEl.innerHTML = HAEUSER.map((haus) => {
        const chips = WARENGRUPPEN.filter((w) => w.haus === haus)
          .map((w) =>
            chip("warengruppen", w.cc, (beispiel[w.cc] ? icon(beispiel[w.cc], 24, w.label) : "") + "<span>" + w.label + "</span>", auswahl.warengruppen.indexOf(w.cc) !== -1, "cg-wg")
          )
          .join("");
        return "<div class='cg-haus'><span class='cg-haus-name'>" + haus + "</span><div class='vd-chip-reihe'>" + chips + "</div></div>";
      }).join("");
      tiersEl.innerHTML = TIERS.map((t) => chip("tiers", t, "T" + t, auswahl.tiers.indexOf(t) !== -1, "", t === 2 ? "T2 ist gebührenfrei." : "")).join("");
      stufenEl.innerHTML = STUFEN.map((s) =>
        chip("stufen", s, "." + s, auswahl.stufen.indexOf(s) !== -1, "", "Gecraftet wird direkt auf dieser Stufe, mit Material derselben Stufe. Kein Hochverzaubern.")
      ).join("");
      einkaufEl.innerHTML = STAEDTE.map((s) => chip("einkaufStaedte", s, s, auswahl.einkaufStaedte.indexOf(s) !== -1)).join("");
      verkaufEl.innerHTML = STAEDTE.map((s) => chip("verkaufStaedte", s, s, auswahl.verkaufStaedte.indexOf(s) !== -1)).join("");
    }

    const SCHALTER = {
      kaufweg: { an: "Eigene Kauforder", aus: "Sofortkauf", lesen: () => auswahl.kaufweg === "order", setzen: (an) => (auswahl.kaufweg = an ? "order" : "sofort") },
      verkaufsweg: { an: "Eigene Verkaufsorder", aus: "Sofortverkauf", lesen: () => auswahl.verkaufsweg === "order", setzen: (an) => (auswahl.verkaufsweg = an ? "order" : "sofort") },
      fokus: { an: "Mit Fokus", aus: "Ohne Fokus", lesen: () => auswahl.mitFokus, setzen: (an) => (auswahl.mitFokus = an) },
      premium: { an: "Mit Premium (4 % Steuer)", aus: "Ohne Premium (8 % Steuer)", lesen: () => UI.einstellungenLesen().premium !== false, setzen: (an) => UI.premiumSetzen(an, "craften") },
      volumen: { an: "Alle Qualitäten", aus: "Nur Normal", lesen: () => auswahl.volumenAlleQualitaeten !== false, setzen: (an) => (auswahl.volumenAlleQualitaeten = an) },
      artefakte: { an: "Mit Artefakt-Items", aus: "Ohne Artefakt-Items", lesen: () => auswahl.artefakte !== false, setzen: (an) => (auswahl.artefakte = an) },
    };

    function schalterSetzen() {
      Object.keys(SCHALTER).forEach((k) => {
        const btn = wurzel.querySelector("[data-cg-schalter='" + k + "']");
        if (!btn) return;
        const an = !!SCHALTER[k].lesen();
        btn.setAttribute("aria-checked", an ? "true" : "false");
        btn.querySelector(".vd-tgl-text").textContent = an ? SCHALTER[k].an : SCHALTER[k].aus;
      });
    }

    /** Ein Feld je angehakter Warengruppe; dieselbe Einstellung wie im Kostenrechner. */
    function tagesbonusAufbauen() {
      const tb = UI.einstellungenLesen().tagesbonus || {};
      const gewaehlt = WARENGRUPPEN.filter((w) => auswahl.warengruppen.indexOf(w.cc) !== -1);
      tagesbonusEl.innerHTML = gewaehlt.length
        ? gewaehlt
            .map((w) => {
              const v = tb[w.cc] || "aus";
              const opt = (wert, text) => `<option value="${wert}"${v === wert ? " selected" : ""}>${text}</option>`;
              return (
                "<label class='cg-tag-feld'><span>" + esc(w.label) + "</span>" +
                `<select class="vd-tag" data-tag-cc="${w.cc}" aria-label="Tagesbonus ${esc(w.label)}">${opt("aus", "aus")}${opt("silber", "10 %")}${opt("gold", "20 %")}</select></label>`
              );
            })
            .join("")
        : "<span class='vd-erkl'>Erst eine Warengruppe wählen.</span>";
    }

    const STATION_LABEL = { Jaegerhuette: "Jägerhütte", Kueche: "Küche" };
    function stationName(g) {
      if (STATION_LABEL[g]) return STATION_LABEL[g];
      return g.replace(/ \(.*\)$/, "");
    }

    function stationenAufbauen() {
      const stationen = stationenFuer(auswahl.warengruppen);
      const saetze = UI.einstellungenLesen().stationssaetze || {};
      stationenEl.innerHTML = stationen
        .map((g) => {
          const name = stationName(g);
          return (
            "<label class='vd-satz-zeile' title='" + esc(g) + "'><span>" + esc(name) + ", Satz je 100 Nahrung</span>" +
            `<input type="number" class="vd-satz" min="0" step="10" data-cg-station="${esc(g)}" value="${saetze[g] != null ? saetze[g] : ""}" placeholder="nicht gepflegt" aria-label="Stationssatz ${esc(name)}"></label>`
          );
        })
        .join("");
    }

    function fertigungAufbauen() {
      fertigungEl.innerHTML = STAEDTE.map((s) => `<option value="${esc(s)}"${s === auswahl.fertigungsstadt ? " selected" : ""}>${s}</option>`).join("");
    }

    function fertigungInfo() {
      const r = rueckgewinnungJeWarengruppe(auswahl, UI.einstellungenLesen());
      const mitBonus = r.filter((x) => x.bonus);
      bonusEl.textContent = mitBonus.length ? "+15 % auf " + mitBonus.map((x) => x.label).join(", ") : "kein Craft-Bonus für die Auswahl";
      bonusEl.classList.toggle("ohne", !mitBonus.length);
      bonusEl.title = "Craft-Bonus der Stadt: +0,15 Produktionsbonus, nur für ihre Warengruppen.";
      if (!r.length) {
        rrrEl.textContent = "";
        return;
      }
      // Gleiche Werte zusammenfassen: "Rückgewinnung 24,8 % (Schwerter), 15,3 % (übrige)".
      const nachWert = {};
      r.forEach((x) => {
        const k = prozent(x.rrr);
        (nachWert[k] = nachWert[k] || []).push(x.label);
      });
      const teile = Object.keys(nachWert);
      rrrEl.textContent =
        "Rückgewinnung " + (teile.length === 1 ? teile[0] : teile.map((k) => k + " (" + nachWert[k].join(", ") + ")").join(", "));
      rrrEl.title = "Rückgewinnung in " + auswahl.fertigungsstadt + " aus Grundproduktion, Stadtbonus" + (auswahl.mitFokus ? ", Fokus" : "") + ", Tagesbonus und Zusatzbonus.";
    }

    function umfangSetzen() {
      const kand = kandidaten(auswahl);
      const a = abrufSchaetzung(kand, auswahl);
      umfangEl.textContent = kand.length
        ? a.produkte + " Produkte, " + a.zutaten + " Zutaten, höchstens " + a.abrufe + " Abrufe (rund " + (a.abrufe * 2 < 60 ? a.abrufe * 2 + " s" : (Math.round((a.abrufe * 2) / 60 * 10) / 10).toString().replace(".", ",") + " Min.") + ")"
        : "Nichts ausgewählt.";
      umfangEl.title = "Obergrenze: was im Preisbestand noch frisch ist (Preise " + PREISE.PREIS_GUELTIG_MIN + " Min., Handelsvolumen " + PREISE.VOLUMEN_GUELTIG_MIN + " Min.), wird nicht neu abgerufen. Abgerufen werden die Preise der Zutaten, die Preise der Produkte und das Handelsvolumen (verkauft/Tag) von beiden. Die Preis-Schnittstelle drosselt; die App fragt 50 Einträge je Abruf mit Pause dazwischen ab. Alle Städte kommen in einem Abruf; weniger Warengruppen oder Tiers gehen schneller.";
    }

    function preiseResetAktualisieren() {
      let n = 0;
      Object.keys(auswahl.preisUeberschreibungen || {}).forEach((s) => (n += Object.keys(auswahl.preisUeberschreibungen[s]).length));
      preiseResetEl.hidden = n === 0;
      preiseResetEl.textContent = "Eigene Preise zurücksetzen (" + n + ")";
    }

    function mehrTextSetzen() {
      mehrTextEl.textContent =
        "(Etwa-Null-Grenze " + String(auswahl.toleranzProzent).replace(".", ",") + " %, Zusatzbonus " + String(auswahl.zusatzbonusProzent).replace(".", ",") + " %, Menge " + auswahl.menge + ")";
    }

    /** Gemeinsame Annahme "Anteil am Tageshandel" ins Feld schreiben (v3.18.0). */
    function anteilSetzen() {
      if (!anteilEl) return;
      anteilEl.value = UI.einstellungenLesen().absatzAnteilProzent;
    }

    function felderSetzen() {
      anteilSetzen();
      toleranzEl.value = auswahl.toleranzProzent;
      mengeEl.value = auswahl.menge;
      minAbsatzEl.value = auswahl.minAbsatz;
      verlusteEl.checked = auswahl.verlusteZeigen;
      zusatzbonusEl.value = auswahl.zusatzbonusProzent;
      schalterSetzen();
      mehrTextSetzen();
    }

    function felderLesen() {
      auswahl = einstellungenBereinigen(
        Object.assign({}, auswahl, {
          toleranzProzent: toleranzEl.value,
          menge: mengeEl.value,
          minAbsatz: minAbsatzEl.value,
          verlusteZeigen: verlusteEl.checked,
          zusatzbonusProzent: zusatzbonusEl.value,
          fertigungsstadt: fertigungEl.value,
        })
      );
      speichern();
      mehrTextSetzen();
    }

    function eigenenPreisSetzen(stadt, marktId, wert) {
      const u = auswahl.preisUeberschreibungen;
      const p = Number(wert);
      if (wert === "" || wert == null || !isFinite(p) || p <= 0) {
        if (u[stadt]) delete u[stadt][marktId];
        if (u[stadt] && !Object.keys(u[stadt]).length) delete u[stadt];
      } else {
        if (!u[stadt]) u[stadt] = {};
        u[stadt][marktId] = p;
      }
      speichern();
      preiseResetAktualisieren();
      rechnen();
    }

    function datenReichen() {
      if (!daten) return false;
      if (auswahl.einkaufStaedte.some((s) => !daten.einkauf.has(s))) return false;
      if (auswahl.verkaufStaedte.some((s) => !daten.verkauf.has(s))) return false;
      const ids = benoetigteMarktIds(kandidaten(auswahl));
      return ids.zutaten.every((id) => daten.zutaten.has(id)) && ids.produkte.every((id) => daten.produkte.has(id));
    }

    function auswahlGeaendert() {
      umfangSetzen();
      if (datenReichen()) rechnen();
      else if (daten) {
        statusEl.className = "";
        statusEl.textContent = "Auswahl geändert: „Gelegenheiten suchen“ ruft die fehlenden Preise ab.";
      }
    }

    // v3.19.0: ueber V.nachZeiger(), damit ein Klick direkt nach der Eingabe nicht verloren geht.
    wurzel.addEventListener("change", (ev) => V.nachZeiger(() => beiAenderung(ev)));
    function beiAenderung(ev) {
      // v3.18.0: Anteil am Tageshandel, gemeinsam mit den anderen Gewinn-Reitern.
      if (anteilEl && ev.target === anteilEl) {
        UI.absatzAnteilSetzen(anteilEl.value, "craften");
        anteilSetzen();
        rechnen();
        return;
      }
      const zaehlerEl = ev.target.closest(".cg-zaehler");
      if (zaehlerEl && ev.target.classList.contains("cg-zn")) {
        planSetzen(zaehlerEl.dataset.cgPlan, ev.target.value);
        return;
      }
      // O10: Puffer der Einkaufsliste, gemeinsam mit "Gelegenheiten".
      if (ev.target.closest("input[data-cg-puffer]")) {
        pufferSetzen(ev.target.value, "craften");
        listeRendern();
        return;
      }
      const preisEl = ev.target.closest("input[data-vd-markt]");
      if (preisEl) {
        const stadt = preisEl.dataset.vdStadt;
        const markt = preisEl.dataset.vdMarkt;
        // v3.19.0: Textfeld mit Tausenderpunkt. Unveraenderter Wert (nur hineingeklickt) aendert nichts.
        const zahl = PREISFELD.lesen(preisEl.value);
        if (zahl != null && zahl === Number(preisEl.dataset.vdRoh)) {
          preisEl.value = PREISFELD.anzeige(zahl);
          return;
        }
        const wert = zahl == null ? "" : String(zahl);
        setTimeout(() => eigenenPreisSetzen(stadt, markt, wert), 0);
        return;
      }
      const satzEl = ev.target.closest("input[data-cg-station]");
      if (satzEl) {
        const roh = satzEl.value.trim();
        const zahl = Number(roh);
        if (roh !== "" && isFinite(zahl) && zahl >= 0) {
          UI.stationssatzSetzen(satzEl.dataset.cgStation, zahl, "craften");
          rechnen();
        }
        stationenAufbauen();
        return;
      }
      const box = ev.target.closest("input[data-gruppe]");
      if (box) {
        const k = box.dataset.gruppe;
        const g = GRUPPEN[k];
        box.closest(".vd-chip").classList.toggle("an", box.checked);
        const an = Array.from(g.el.querySelectorAll("input:checked")).map((x) => g.parse(x.value));
        auswahl[k] = g.werte.filter((w) => an.indexOf(w) !== -1);
        speichern();
        if (k === "warengruppen") {
          stationenAufbauen();
          tagesbonusAufbauen();
          fertigungInfo();
        }
        auswahlGeaendert();
        return;
      }
      const tagSel = ev.target.closest("select[data-tag-cc]");
      if (tagSel) {
        UI.tagesbonusSetzen(tagSel.dataset.tagCc, tagSel.value, "craften");
        fertigungInfo();
        rechnen();
        return;
      }
      felderLesen();
      if ([toleranzEl, mengeEl, verlusteEl, minAbsatzEl].indexOf(ev.target) !== -1) neuBewerten();
      else if ([fertigungEl, zusatzbonusEl].indexOf(ev.target) !== -1) {
        fertigungInfo();
        rechnen();
      }
    }

    wurzel.addEventListener("click", (ev) => {
      const schalter = ev.target.closest("[data-cg-schalter]");
      if (schalter) {
        const name = schalter.dataset.cgSchalter;
        const s = SCHALTER[name];
        s.setzen(!s.lesen());
        speichern();
        schalterSetzen();
        fertigungInfo();
        if (name === "artefakte") auswahlGeaendert();
        else rechnen();
        return;
      }
      const zb = ev.target.closest("button[data-cg-delta]");
      if (zb) {
        const w = zb.closest(".cg-zaehler");
        const schritt = Number(w.dataset.cgSchritt) || 1;
        planSetzen(w.dataset.cgPlan, (auswahl.plan[w.dataset.cgPlan] || 0) + Number(zb.dataset.cgDelta) * schritt);
        return;
      }
      const kopie = ev.target.closest("button[data-cg-kopie]");
      if (kopie) {
        kopieren(kopie.dataset.cgKopie, kopie);
        return;
      }
      const kr = ev.target.closest("button[data-vd-kr]");
      if (kr) {
        V.kostenrechnerOeffnen(kr);
        return;
      }
      if (ev.target.closest("button[data-cg-alle-kopieren]")) {
        kopieren(einkaufslisteText(planListe(), (n, st) => suchName(nameVon(n, st), n, st)), ev.target.closest("button"));
        return;
      }
      if (ev.target.closest("button[data-cg-preise-frisch]")) {
        listePreiseAktualisieren();
        return;
      }
      const weg = ev.target.closest("button[data-cg-weg]");
      if (weg) {
        planSetzen(weg.dataset.cgWeg, 0);
        return;
      }
      if (ev.target.closest("button[data-cg-leeren]") || ev.target.closest("button[data-cg-fehlend-weg]")) {
        const nurFehlend = !!ev.target.closest("button[data-cg-fehlend-weg]");
        const ids = nurFehlend ? planListe().fehlend : Object.keys(auswahl.plan);
        ids.forEach((id) => planSetzen(id, 0));
        return;
      }
      const sortKnopf = ev.target.closest("[data-vd-sort]");
      if (sortKnopf) {
        auswahl.sortierung = sortKnopf.dataset.vdSort;
        speichern();
        neuBewerten();
        return;
      }
      const reset = ev.target.closest("button[data-vd-reset]");
      if (reset) {
        eigenenPreisSetzen(reset.dataset.vdStadt, reset.dataset.vdReset, "");
        return;
      }
      if (ev.target === preiseResetEl) {
        auswahl.preisUeberschreibungen = {};
        speichern();
        preiseResetAktualisieren();
        rechnen();
      }
    });

    document.addEventListener(UI.TAGESBONUS_EVENT, (ev) => {
      if (ev.detail && ev.detail.quelle === "craften") return;
      tagesbonusAufbauen();
      fertigungInfo();
      rechnen();
    });
    document.addEventListener(UI.STATIONSSAETZE_EVENT, (ev) => {
      if (ev.detail && ev.detail.quelle === "craften") return;
      stationenAufbauen();
      rechnen();
    });
    document.addEventListener(UI.PREMIUM_EVENT, (ev) => {
      if (ev.detail && ev.detail.quelle === "craften") return;
      schalterSetzen();
      rechnen();
    });
    // Anteil am Tageshandel in einem anderen Gewinn-Reiter geaendert (v3.18.0).
    document.addEventListener(UI.ABSATZANTEIL_EVENT, (ev) => {
      if (ev.detail && ev.detail.quelle === "craften") return;
      anteilSetzen();
      rechnen();
    });

    // O10: Puffer in der Einkaufsliste von "Gelegenheiten" geaendert.
    document.addEventListener(LISTE_EVENT, (ev) => {
      if (ev.detail && ev.detail.quelle === "craften") return;
      listeRendern();
    });

    function alterText(min) {
      if (min == null || !isFinite(min)) return "";
      return min < 90 ? Math.round(min) + " Min." : min < 2880 ? Math.round(min / 60) + " Std." : Math.round(min / 1440) + " Tage";
    }

    function marktSeite(x, kaufweg) {
      const seite = x.roh ? (kaufweg === "order" ? x.roh.buy : x.roh.sell) : null;
      const preis = seite && !seite.kein && seite.preis > 0 ? seite.preis : null;
      let alter = null;
      if (seite && seite.datum) {
        const t = REGELN.parseApiDatumUtc(seite.datum);
        if (isFinite(t)) alter = (Date.now() - t) / 60000;
      }
      return { preis, alter };
    }

    function staedteListe(werte, gewaehlt, hoeherBesser) {
      const ref = (werte.find((w) => w.stadt === gewaehlt) || {}).wert;
      return werte
        .slice()
        .sort((a, b) => (a.wert == null) - (b.wert == null) || (hoeherBesser ? b.wert - a.wert : a.wert - b.wert))
        .map((w) => {
          if (w.wert == null) return w.stadt + ": kein Preis";
          const d = ref != null ? Math.round(w.wert - ref) : null;
          return w.stadt + ": " + fmt(Math.round(w.wert)) + (w.stadt === gewaehlt ? "  ✓" : d ? "  (" + (d > 0 ? "+" : "") + fmt(d) + ")" : "  (gleich)");
        })
        .join("\n");
    }

    function stadtSchild(stadt, titel) {
      return stadt ? "<span class='vd-stadt' title='" + esc(titel) + "'>" + esc(stadt) + "</span>" : "<span></span>";
    }

    function zutatenHtml(z, kontext) {
      const order = kontext.kaufweg === "order";
      return z.zutatenPreise
        .map((x) => {
          const name = nameVon(x.n, x.stufe);
          const m = marktSeite(x, kontext.kaufweg);
          const alter = alterText(m.alter);
          const abruf = V.abrufAlterText(x.roh && x.roh.abgerufenAm);
          const herkunft = x.uebersteuert
            ? "Eigener Preis für " + x.stadt + (m.preis != null ? ", Markt: " + fmt(m.preis) + (alter ? " (" + alter + " alt)" : "") : ", kein Marktpreis")
            : (order ? "Höchste Kauforder" : "Günstigste Verkaufsorder") + " in " + x.stadt + (alter ? ", " + alter + " alt" : "") + (abruf ? ", abgerufen " + abruf : "");
          const handelText = V.zutatHandelText(x);
          const titel =
            kontext.mehrEk && x.alle && x.alle.length > 1
              ? staedteListe(x.alle.map((a) => ({ stadt: a.stadt, wert: a.basis })), x.stadt, false) + (abruf && !x.uebersteuert ? "\n\nAbgerufen " + abruf + "." : "") + (handelText ? "\n\n" + handelText : "") + "\n\nKlicken zum Überschreiben."
              : herkunft + (/\.$/.test(herkunft) ? "" : ".") + (handelText ? " " + handelText : "") + " Klicken zum Überschreiben.";
          const wert = Math.round(x.basisPreis * 100) / 100;
          const feld =
            "<input type='text' inputmode='decimal' autocomplete='off' class='vd-preis" + (x.uebersteuert ? " vd-eigen" : "") + "' value='" + PREISFELD.anzeige(wert) + "' data-vd-roh='" + wert + "'" +
            " data-vd-stadt='" + esc(x.stadt) + "' data-vd-markt='" + esc(x.marktId) + "'" +
            " aria-label='Einkaufspreis " + esc(name) + " in " + esc(x.stadt) + "' title='" + esc(titel) + "'>";
          const reset = x.uebersteuert
            ? "<button type='button' class='vd-reset' data-vd-stadt='" + esc(x.stadt) + "' data-vd-reset='" + esc(x.marktId) + "' title='Marktpreis wiederherstellen' aria-label='Eigenen Preis für " + esc(name) + " entfernen'>×</button>"
            : "";
          let max = "<span></span>";
          if (x.hoechstpreis != null) {
            const titelMax =
              "Höchstpreis in " + x.stadt + ": bis zu diesem " + (order ? "Orderpreis" : "Einkaufspreis") + " bleibt der Gewinn dieser Zeile bei 0 oder darüber, alle anderen Preise fest. " +
              "Mit Rückgewinnung " + prozent(z.rrr) + ", Stationsgebühr" + (order ? " und 2,5 % Einstellgebühr" : "") + "." +
              (z.gewinn < 0 ? " Der Gewinn ist schon beim aktuellen Preis negativ." : "");
            max =
              x.hoechstpreis <= 0
                ? "<span class='vd-max vd-verlust' title='" + esc(titelMax) + "'>kein Preis reicht</span>"
                : "<span class='vd-max" + (z.gewinn < 0 ? " vd-verlust" : "") + "' title='" + esc(titelMax) + "'>max. " + fmt(Math.floor(x.hoechstpreis)) + "</span>";
          }
          return (
            "<div class='vd-zutat'>" + icon(x.n, 30, name) +
            "<span class='vd-zname'>" + Math.round(x.menge * 100) / 100 + "× " + esc(name) + "</span>" +
            "<span class='vd-preisfeld'>" + feld + reset + "</span>" +
            (kontext.mehrEk ? stadtSchild(x.stadt, "Günstigste angehakte Einkaufsstadt für diese Zutat. " + TRANSPORT) : "") +
            max + "</div>"
          );
        })
        .join("");
    }

    function kopfHtml(kontext) {
      const sortTh = (id, text, titel) => {
        const an = kontext.sortierung === id;
        const pfeil = an ? (id === "kosten" ? " ▲" : " ▼") : "";
        return (
          "<th class='num'" + (an ? " aria-sort='" + (id === "kosten" ? "ascending" : "descending") + "'" : "") + ">" +
          "<button type='button' class='vd-sortk" + (an ? " an" : "") + "' data-vd-sort='" + id + "' title='" + esc(titel) + "'>" + text + pfeil + "</button></th>"
        );
      };
      return (
        "<thead><tr><th>Produkt</th><th>Einkauf je Vorgang</th><th>Verkauf</th>" +
        sortTh("volumen", "verkauft<br>/Tag", "Erfasster Handel des Produkts in der Verkaufsstadt, Mittel der letzten " + TAGE_FENSTER + " Tage. Klicken sortiert absteigend.") +
        sortTh("kosten", "Kosten<br>/Stück", "Material nach Rückgewinnung plus Stationsgebühr, je Stück Produkt. Klicken sortiert aufsteigend.") +
        "<th class='num' title='Kosten je Stück mal der eingestellten Menge: so viel Silber kostet die ganze Menge, Material nach Rückgewinnung plus Stationsgebühr.'>Kosten<br>gesamt</th>" +
        sortTh("stueck", "Gewinn<br>/Stück", "Erlös nach Steuer minus Kosten, je Stück. Klicken sortiert absteigend.") +
        sortTh("marge", "Marge", V.KOPF_TITEL.marge) +
        sortTh("tag", "Gewinn<br>/Tag", V.KOPF_TITEL.tag(kontext.anteilProzent)) +
        sortTh("jefokus", "Mehrgewinn<br>je Fokus", V.KOPF_TITEL.jefokus) +
        sortTh("gesamt", "Gewinn<br>gesamt", "Gewinn je Stück mal der eingestellten Menge. Klicken sortiert absteigend.") +
        "</tr></thead>"
      );
    }

    // ---- Einkaufsliste (v3.12.0) ----
    function zaehlerHtml(z, name) {
      const n = auswahl.plan[z.marktId] || 0;
      const schritt = z.ausbeute || 1;
      const t = schritt > 1 ? " (ein Vorgang ergibt " + schritt + " Stück)" : "";
      const mx = V.zaehlerMax(z, n); // v3.22.0: Planung ueber dem Tagesmaximum hervorheben
      return (
        "<div class='cg-zaehler" + (n ? " an" : "") + mx.klasse + "' data-cg-plan='" + esc(z.marktId) + "' data-cg-schritt='" + schritt + "'" + mx.attr + " data-vd-titel='Geplante Stückzahl für die Einkaufsliste" + esc(t) + "'>" +
        "<button type='button' class='cg-zb' data-cg-delta='-1' aria-label='Eins weniger " + esc(name) + "' title='Weniger" + esc(t) + "'>−</button>" +
        "<input type='number' class='cg-zn' min='0' step='" + schritt + "' value='" + n + "' aria-label='Geplante Stückzahl " + esc(name) + "' title='" + esc(mx.titel) + "Geplante Stückzahl für die Einkaufsliste" + esc(t) + "'>" +
        "<button type='button' class='cg-zb' data-cg-delta='1' aria-label='Eins mehr " + esc(name) + "' title='Mehr" + esc(t) + "'>+</button></div>"
      );
    }

    function planSetzen(id, stueck) {
      const n = Math.max(0, Math.floor(Number(stueck)) || 0);
      if (n > 0) auswahl.plan[id] = n;
      else delete auswahl.plan[id];
      speichern();
      wurzel.querySelectorAll(".cg-zaehler").forEach((w) => {
        if (w.dataset.cgPlan !== id) return;
        w.classList.toggle("an", n > 0);
        V.zaehlerMaxSetzen(w, n);
        const inp = w.querySelector(".cg-zn");
        if (inp && document.activeElement !== inp) inp.value = n;
      });
      listeRendern();
    }

    // v3.19.0: nach veredeln.js gezogen, damit "Gelegenheiten" dieselbe Funktion nutzt.
    const kopieren = V.kopieren;

    /** Die Einkaufsliste des Reiters mit dem gemeinsamen Puffer (O10). */
    function planListe() {
      return einkaufsliste(letzteZeilen ? letzteZeilen.zeilen : [], auswahl.plan, null, { pufferProzent: pufferLesen() });
    }

    // O10: Knopf "Preise aktualisieren" der Einkaufsliste.
    let listeZustand = { laeuft: false, text: "", fehler: false };
    async function listePreiseAktualisieren() {
      if (listeZustand.laeuft) return;
      if (laeuft || !daten || !datenReichen()) {
        listeZustand = { laeuft: false, fehler: true, text: laeuft ? "Die Suche läuft noch." : "Erst „Gelegenheiten suchen“: die Auswahl hat sich seit der letzten Suche geändert." };
        listeRendern();
        return;
      }
      listeZustand = { laeuft: true, text: "Preise werden abgerufen ...", fehler: false };
      listeRendern();
      try {
        const ziel = daten;
        const geholt = await planAktualisieren(kandidaten(auswahl), auswahl, auswahl.plan, {
          aufStatus: (text) => {
            listeZustand.text = text;
            const m = listeEl.querySelector(".cg-el-meldung");
            if (m) m.textContent = text;
          },
        });
        if (!geholt) listeZustand = { laeuft: true, fehler: true, text: "Keines der geplanten Produkte liegt in der aktuellen Suche." };
        else {
          stadtDatenMischen(ziel.stadtDaten, geholt.stadtDaten);
          listeZustand = { laeuft: true, fehler: false, text: geholt.abrufe + (geholt.abrufe === 1 ? " Abruf" : " Abrufe") + ", Preise aktualisiert." };
        }
      } catch (e) {
        listeZustand = { laeuft: true, fehler: true, text: "Preise nicht aktualisiert: " + (e && e.message ? e.message : e) };
        if (typeof console !== "undefined") console.warn(e);
      } finally {
        listeZustand.laeuft = false;
        if (!listeZustand.fehler && !rechnen()) listeRendern();
        else if (listeZustand.fehler) listeRendern();
      }
    }

    function listeRendern() {
      if (!listeEl) return;
      const zeilen = letzteZeilen ? letzteZeilen.zeilen : [];
      const liste = planListe();
      if (!Object.keys(auswahl.plan).length) {
        listeEl.hidden = true;
        listeEl.innerHTML = "";
        return;
      }
      listeEl.hidden = false;
      const order = auswahl.kaufweg === "order";
      const mehrEk = V.schilderZeigen(auswahl.einkaufStaedte);
      const produkte = liste.produkte
        .map((p) => {
          const name = nameVon(p.item, p.stufe);
          return (
            "<span class='cg-plan-produkt'>" + icon(marktIdVon(p.item, p.stufe), 24, name) + p.stueck + "× " + esc(name) + (p.tier ? " <span class='vd-klein'>T" + p.tier + "." + p.stufe + "</span>" : "") +
            (p.ausbeute > 1 ? " <span class='vd-klein'>(" + p.vorgaenge + " Vorgänge)</span>" : "") + V.planMaxHtml(p, esc) +
            "<button type='button' class='vd-reset cg-plan-weg' data-cg-weg='" + esc(p.marktId) + "' title='Aus der Planung nehmen' aria-label='" + esc(name) + " aus der Planung nehmen'>×</button></span>"
          );
        })
        .join("");
      const zeilenHtml = liste.posten
        .map((x) => {
          const name = nameVon(x.n, x.stufe);
          return (
            "<tr><td><div class='cg-el-name'>" + icon(x.n, 30, name) + "<span>" + esc(name) + "</span>" +
            "<button type='button' class='mini cg-kopie' data-cg-kopie='" + esc(suchName(name, x.n, x.stufe)) + "' title='„" + esc(suchName(name, x.n, x.stufe)) + "“ kopieren, zum Einfügen in die Marktsuche'>Kopieren</button></div></td>" +
            "<td class='num cg-el-menge' title='" + esc(einkaufslisteMengeTitel(x)) + "'>" + Math.round(x.menge).toLocaleString("de-DE") + "</td>" +
            (mehrEk ? "<td>" + stadtSchild(x.stadt, "Günstigste angehakte Einkaufsstadt. " + TRANSPORT) + "</td>" : "") +
            "<td class='num'>" + (x.basisPreis != null ? fmt(x.basisPreis) : "k. A.") + "</td>" +
            "<td class='num'>" + fmt(x.kosten) + "</td></tr>"
          );
        })
        .join("");
      const fehlt = liste.fehlend.length
        ? "<div class='vd-erkl'>" + liste.fehlend.length + " geplante" + (liste.fehlend.length === 1 ? "s Produkt ist" : " Produkte sind") +
          " in der aktuellen Suche nicht enthalten und fehlen in der Liste: " + liste.fehlend.map((id) => esc(namenNachMarktId[id] || id)).join(", ") +
          ". <button type='button' class='mini' data-cg-fehlend-weg='1' title='Nimmt diese Produkte aus der Planung. Die übrige Liste bleibt.'>Entfernen</button></div>"
        : "";
      // Abrufzeiten der Verkaufspreise der geplanten Produkte, fuer "Preise von 12:45".
      const vkZeiten = [];
      liste.produkte.forEach((p) => {
        const z = zeilen.find((x) => x.marktId === p.marktId);
        if (z) produktBestand(z).preise.forEach((e) => vkZeiten.push(e && e.abgerufenAm));
      });
      listeEl.innerHTML =
        "<div class='cg-el-kopf'><h2 class='vd-kt'>Einkaufsliste</h2>" +
        "<span class='vd-klein cg-el-label' title='" + esc(LISTE_LABEL_TITEL) + "'>" + esc(einkaufslisteLabel(liste)) + "</span>" +
        "<span class='cg-el-knoepfe'><button type='button' class='mini' data-cg-alle-kopieren='1' title='Alle Zeilen als „Menge Name 4.1“ kopieren'>Alles kopieren</button>" +
        einkaufslisteFrischKnopfHtml("cg", listeZustand, esc) +
        "<button type='button' class='mini' data-cg-leeren='1' title='Setzt alle Zähler auf 0 und leert die Einkaufsliste.'>Liste leeren</button></span></div>" +
        einkaufslisteBedienHtml(liste, "cg", listeZustand, vkZeiten, esc) +
        "<div class='cg-plan'>" + produkte + "</div>" + fehlt +
        (liste.posten.length
          ? "<div class='vd-tabrahmen'><table class='vd-tabelle cg-el-tabelle'><thead><tr><th>Zutat</th><th class='num' title='Kaufmenge: Bedarf nach Rückgewinnung, aufgerundet. Einzelheiten je Zeile im Tooltip der Zahl.'>Menge</th>" +
            (mehrEk ? "<th>Stadt</th>" : "") + "<th class='num'>" + (order ? "Orderpreis" : "Preis") + "/Stück</th><th class='num'>Kosten</th></tr></thead><tbody>" +
            zeilenHtml + "</tbody>" + einkaufslisteSummenHtml(liste, { spalten: mehrEk ? 4 : 3, order, fmt, esc }) + "</table></div>"
          : "");
    }

    /** Bestandseintraege des Produkts in seiner Verkaufsstadt: Preise je Qualitaet und Handelsvolumen. */
    function produktBestand(z) {
      const d = daten ? daten.stadtDaten.find((x) => x.stadt === z.vkStadt) : null;
      if (!d) return { preise: [], absatz: [] };
      const werte = (o) => Object.keys(o || {}).map((q) => o[q]);
      return { preise: werte((d.produktJeQ || {})[z.marktId]), absatz: werte((d.absatz || {})[z.marktId]) };
    }

    /** Aelteste Abrufzeit der in dieser Zeile verwendeten Werte (Zutaten, Produktpreise, Handelsvolumen). */
    function zeileAbrufAm(z) {
      const p = produktBestand(z);
      return V.aeltesteAbrufzeit(
        (z.zutatenPreise || [])
          .filter((x) => !x.uebersteuert)
          .map((x) => x.roh)
          .concat((z.zutatenPreise || []).filter((x) => !x.uebersteuert && x.handel).map((x) => x.handel))
          .concat(p.preise, p.absatz)
      );
    }

    function render(zeilen, gesamt, ausgeblendet, kontext) {
      if (!zeilen.length) {
        ausgabeEl.innerHTML =
          "<div class='vd-leer'>Von " + gesamt + " geprüften Vorgängen bleibt keiner übrig" +
          (ausgeblendet ? " (" + ausgeblendet + " mit Gewinn, aber unter " + stueck(kontext.minAbsatz) + " verkauft/Tag)" : "") +
          ". Volumenfilter senken, „Verluste zeigen“ anhaken oder andere Städte wählen.</div>";
        return;
      }
      const vkTitel = kontext.verkaufsweg === "order" ? "günstigste Verkaufsorder" : "höchste Kauforder in Normal";
      const body = zeilen
        .map((z) => {
          const klasse = z.einstufung === "gewinn" ? "vd-gewinn" : z.einstufung === "null" ? "vd-null" : "vd-verlust";
          const einstufung = z.einstufung === "gewinn" ? "Gewinn" : z.einstufung === "null" ? "etwa Null (innerhalb der Toleranz)" : "Verlust";
          const name = nameVon(z.item, z.stufe);
          const tierTitel = z.ausbeute > 1 ? "Ein Vorgang ergibt " + z.ausbeute + " Stück." : "";
          const fokus = z.fokusJeVorgang > 0 ? "<div class='vd-klein vd-umbruch'>" + fmtFokus(z.fokusJeVorgang) + "&nbsp;Fokus je&nbsp;Vorgang</div>" : "";
          // O10: der Zusatz "(Exzellent)" bleibt nur, wenn wirklich ein Angebot dieser Qualitaet den Preis setzt.
          const qText =
            kontext.verkaufsweg === "order" && z.qualifizierbar && z.sellQualitaet > 1 && z.preisQuelle !== "handel"
              ? ", günstigstes Angebot in " + REGELN.QUALITAETEN[z.sellQualitaet - 1] + " (unter Normal)"
              : "";
          const pk = V.preisKennzeichen(z, fmt);
          const pb = produktBestand(z);
          const preisAbruf = V.abrufAlterText(V.aeltesteAbrufzeit(pb.preise));
          const volAbruf = V.abrufAlterText(V.aeltesteAbrufzeit(pb.absatz));
          const zeilenAbruf = V.abrufAlterText(zeileAbrufAm(z));
          const preisTitel = vkTitel + qText + (z.vkStadt ? " in " + z.vkStadt : "") + (z.produktAlterMin != null ? ", " + alterText(z.produktAlterMin) + " alt" : "") + (preisAbruf ? ", abgerufen " + preisAbruf : "");
          const volTitel =
            "Erfasster Handel in " + (z.vkStadt || "") + ", Mittel der letzten " + TAGE_FENSTER + " Tage" +
            (z.qualifizierbar ? (kontext.alleQ ? ", alle Qualitäten zusammen (Normal allein: " + stueck(z.stueckJeTagNormal) + ")" : ", nur Normal") : "") +
            ". Untergrenze: gemeldet wird nur, was Spieler mit laufendem Data-Client sehen." + (volAbruf ? " Abgerufen " + volAbruf + "." : "");
          return (
            "<tr class='" + klasse + "'" + (zeilenAbruf ? " title='" + esc("Ältester verwendeter Wert dieser Zeile: abgerufen " + zeilenAbruf + ".") + "'" : "") + ">" +
            "<td><div class='vd-produkt'>" + icon(marktIdVon(z.item, z.stufe), 48, name) + "<div><div class='vd-pname'>" + esc(name) +
            " <button type='button' class='mini cg-kopie' data-cg-kopie='" + esc(suchName(name, z.item, z.stufe)) + "' title='„" + esc(suchName(name, z.item, z.stufe)) + "“ kopieren, zum Einfügen in die Marktsuche'>Kopieren</button></div>" +
            "<div class='vd-klein'" + (tierTitel ? " title='" + esc(tierTitel) + "'" : "") + ">T" + z.tier + "." + z.vorgangsStufe + (z.stadtbonus ? " · Stadtbonus" : "") + "</div>" +
            "<div class='vd-zeilenknoepfe'>" + zaehlerHtml(z, name) + V.krKnopfHtml(z, esc, name) + "</div></div></div></td>" +
            "<td><div class='vd-zutaten" + (kontext.mehrEk ? "" : " ohne-stadt") + "'>" + zutatenHtml(z, kontext) + "</div></td>" +
            "<td><div class='vd-erloes' title='" +
            esc(
              kontext.mehrVk && z.vkAlle && z.vkAlle.length > 1
                ? "Erlös je Stück nach Steuer je Stadt:\n" + staedteListe(z.vkAlle.map((a) => ({ stadt: a.stadt, wert: a.netto })), z.vkStadt, true)
                : "Erlös je Stück nach Steuer" + (kontext.verkaufsweg === "order" ? " und 2,5 % Einstellgebühr" : "")
            ) +
            "'>" + fmt(z.erloes) + "</div>" +
            "<div class='vd-klein" + (pk.html ? " vd-umbruch" : "") + "' title='" + esc(preisTitel + (pk.titel ? ". " + pk.titel : "")) + "'><span class='vd-nw'>Preis " + fmt(z.produktPreis) + (qText ? " (" + REGELN.QUALITAETEN[z.sellQualitaet - 1] + ")" : "") + "</span>" + pk.html + "</div>" +
            (kontext.mehrVk ? "<div>" + stadtSchild(z.vkStadt, "Angehakte Verkaufsstadt mit dem höchsten Erlös. " + TRANSPORT) + "</div>" : "") +
            "</td>" +
            "<td class='num' title='" + esc(volTitel) + "'>" + stueck(z.stueckJeTag) + "</td>" +
            "<td class='num'>" + fmt(z.silber) + fokus + "</td>" +
            "<td class='num'>" + fmt(z.kostenGesamt) + "</td>" +
            "<td class='num vd-wert' title='" + einstufung + "'>" + fmt(z.gewinn) + "</td>" +
            "<td class='num vd-wert2'>" + prozent(z.marge) + "</td>" +
            V.kennzahlZellenHtml(z, esc, "", "", nameVon) +
            "<td class='num vd-wert'>" + fmt(z.gewinnGesamt) + "</td>" +
            "</tr>"
          );
        })
        .join("");
      ausgabeEl.innerHTML = "<div class='vd-tabrahmen'><table class='vd-tabelle'>" + kopfHtml(kontext) + "<tbody>" + body + "</tbody></table></div>";
    }

    function rechnen() {
      if (!daten || laeuft || !datenReichen()) return null;
      const einstellungen = UI.einstellungenLesen();
      const kand = kandidaten(auswahl);
      const zeilen = zeilenRechnen(kand, daten.stadtDaten, auswahl, einstellungen);
      letzteZeilen = {
        zeilen,
        kontext: {
          kaufweg: auswahl.kaufweg,
          verkaufsweg: auswahl.verkaufsweg,
          alleQ: auswahl.volumenAlleQualitaeten !== false,
          mehrEk: V.schilderZeigen(auswahl.einkaufStaedte),
          mehrVk: V.schilderZeigen(auswahl.verkaufStaedte),
          anteilProzent: V.anteilVon(einstellungen) * 100,
        },
      };
      neuBewerten();
      return zeilen;
    }

    function neuBewerten() {
      if (!letzteZeilen) return;
      const toleranz = auswahl.toleranzProzent / 100;
      const zeilen = letzteZeilen.zeilen;
      zeilen.forEach((z) => {
        if (z.gewinn == null) return;
        z.gewinnGesamt = z.gewinn * auswahl.menge;
        z.kostenGesamt = z.silber * auswahl.menge;
        z.einstufung = V.einstufen(z.gewinn, z.silber, toleranz);
      });
      const opts = { verlusteZeigen: auswahl.verlusteZeigen, sortierung: auswahl.sortierung, minAbsatz: auswahl.minAbsatz };
      const gefiltert = filtereUndSortiere(zeilen, opts);
      const ohneVolumen = filtereUndSortiere(zeilen, Object.assign({}, opts, { minAbsatz: 0 }));
      const ausgeblendet = ohneVolumen.length - gefiltert.length;
      render(gefiltert, zeilen.length, ausgeblendet, Object.assign({}, letzteZeilen.kontext, { sortierung: auswahl.sortierung, minAbsatz: auswahl.minAbsatz }));
      listeRendern();
      const einstellungen = UI.einstellungenLesen();
      const saetze = einstellungen.stationssaetze || {};
      const mitErgebnis = zeilen.filter((z) => z.gewinn != null).length;
      const fehlend = stationenFuer(auswahl.warengruppen).filter((g) => saetze[g] == null).map(stationName);
      statusEl.className = "ok";
      statusEl.textContent =
        "Fertig: " + gefiltert.filter((z) => z.einstufung === "gewinn").length + " mit Gewinn" +
        (ausgeblendet ? ", " + ausgeblendet + " unter dem Volumenfilter ausgeblendet" : "") +
        (zeilen.length - mitErgebnis ? ", " + (zeilen.length - mitErgebnis) + " von " + zeilen.length + " ohne vollständige Preise" : "") +
        ". " + V.bestandStatusText(daten.abrufe, V.aeltesteAbrufzeit(zeilen.filter((z) => z.gewinn != null).map((z) => ({ abgerufenAm: zeileAbrufAm(z) }))), null, daten.frisch) +
        (fehlend.length ? " Stationssatz fehlt für " + fehlend.join(", ") + ", mit 0 gerechnet." : "");
    }

    // "Gelegenheiten suchen" (v3.15.0): rechnet mit dem Preisbestand und
    // ruft nur ab, was fehlt oder zu alt ist. "Frisch abrufen" (frisch = true)
    // umgeht den Bestand und holt alles neu.
    async function suchen(frisch) {
      if (laeuft) return;
      felderLesen();
      if (!auswahl.einkaufStaedte.length || !auswahl.verkaufStaedte.length || !auswahl.warengruppen.length || !auswahl.tiers.length || !auswahl.stufen.length) {
        statusEl.className = "err";
        statusEl.textContent = "Mindestens je eine Warengruppe, ein Tier, eine Verzauberung, eine Einkaufs- und eine Verkaufsstadt anhaken.";
        return;
      }
      laeuft = true;
      startEl.disabled = true;
      if (frischEl) frischEl.disabled = true;
      statusEl.className = "";
      ausgabeEl.innerHTML = "";
      try {
        const kand = kandidaten(auswahl);
        const geholt = await datenAbrufen(kand, auswahl, {
          frisch: !!frisch,
          aufStatus: (text) => {
            statusEl.textContent = text;
          },
        });
        daten = {
          stadtDaten: geholt.stadtDaten,
          zutaten: new Set(geholt.ids.zutaten),
          produkte: new Set(geholt.ids.produkte),
          einkauf: new Set(auswahl.einkaufStaedte),
          verkauf: new Set(auswahl.verkaufStaedte),
          abrufe: geholt.abrufe,
          frisch: !!frisch,
        };
        laeuft = false;
        rechnen();
      } catch (e) {
        statusEl.className = "err";
        statusEl.textContent = "Fehler: " + (e && e.message ? e.message : e);
        if (typeof console !== "undefined") console.error(e);
      } finally {
        laeuft = false;
        startEl.disabled = false;
        if (frischEl) frischEl.disabled = false;
      }
    }

    gruppenAufbauen();
    fertigungAufbauen();
    tagesbonusAufbauen();
    stationenAufbauen();
    preiseResetAktualisieren();
    felderSetzen();
    fertigungInfo();
    umfangSetzen();
    speichern();
    startEl.addEventListener("click", () => suchen(false));
    if (frischEl) frischEl.addEventListener("click", () => suchen(true));
    PREISFELD.einrichten(wurzel);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }

  return {
    WARENGRUPPEN,
    SORTIERUNGEN,
    standardEinstellungen,
    einstellungenBereinigen,
    kandidaten,
    benoetigteMarktIds,
    abrufSchaetzung,
    rezeptMarktfaehig,
    produktEintrag,
    volumen,
    besterCraft,
    rueckgewinnungJeWarengruppe,
    stationenFuer,
    zeilenRechnen,
    sortiere,
    filtereUndSortiere,
    planBereinigen,
    einkaufsliste,
    einkaufslisteSummenHtml,
    suchName,
    einkaufslisteText,
    LISTE_KEY,
    LISTE_EVENT,
    PUFFER_VORGABE,
    pufferBereinigen,
    pufferLesen,
    pufferSetzen,
    verbrauchsAnteil,
    einkaufslisteLabel,
    LISTE_LABEL_TITEL,
    einkaufslisteMengeTitel,
    einkaufslisteAeltester,
    einkaufslisteBedienHtml,
    einkaufslisteFrischKnopfHtml,
    planAktualisieren,
    stadtDatenMischen,
    datenAbrufen,
    selbsttest,
  };
})();
