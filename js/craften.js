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
  "use strict";

  const V = VEREDELN; // geteilte Hilfsfunktionen, s. Modulkommentar
  const STAEDTE = V.STAEDTE;
  const TIERS = [2, 3, 4, 5, 6, 7, 8];
  const STUFEN = [0, 1, 2, 3, 4];
  const TAGE_FENSTER = 7;
  const SPEICHER_KEY = "albion_kostenrechner_craften_v1";
  const SORTIERUNGEN = ["kosten", "stueck", "marge", "volumen", "gesamt"];

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
      sortierung: "marge",
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
      sortierung: SORTIERUNGEN.indexOf(roh.sortierung) !== -1 ? roh.sortierung : basis.sortierung,
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

  /** Grobe Abrufzahl je Suche: je Einkaufsstadt die Zutaten, je Verkaufsstadt Preise und Handel der Produkte, 50 IDs je Abruf. */
  function abrufSchaetzung(kand, auswahl) {
    const ids = benoetigteMarktIds(kand);
    const bl = (n) => Math.ceil(n / 50);
    let n = 0;
    STAEDTE.forEach((s) => {
      if ((auswahl.einkaufStaedte || []).indexOf(s) !== -1) n += bl(ids.zutaten.length);
      if ((auswahl.verkaufStaedte || []).indexOf(s) !== -1) n += 2 * bl(ids.produkte.length);
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
   * (Markt-ID -> Qualitaet -> Eintrag), absatz (Markt-ID -> Qualitaet -> Eintrag)}].
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
      fokusAus: !auswahl.mitFokus,
      fokusRegelJeKategorie: {},
      fokusUebersteuerungJeKnoten: {},
      fokuswert: 0,
      tagesbonus: einstellungen.tagesbonus || {},
      zusatzProduktionsbonus: (auswahl.zusatzbonusProzent || 0) / 100,
      maxPreisAlterMin,
      nurDirekteEbene: true,
    };
    const erloesOpts = { verkaufsweg: auswahl.verkaufsweg, premium: einstellungen.premium, maxPreisAlterMin, jetzt: zeit };
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
      const craft = besterCraft(
        RECHENKERN.kosten(k.item, k.stufe, 1, Object.assign({}, optsBasis, { preise })),
        k.rezepte.map((r) => r.rezeptIndex),
        auswahl.mitFokus
      );
      const rezept = (craft && craft.weg && k.rezepte.find((r) => r.rezeptIndex === craft.weg.rezeptIndex)) || k.rezepte[0];
      const kandidat = Object.assign({}, k, { rezeptIndex: rezept.rezeptIndex, menge: rezept.menge, zutaten: rezept.zutaten });
      const vkEintraege = verkaufDaten.map((d) => ({ stadt: d.stadt, eintrag: produktEintrag(d.produktJeQ[k.marktId], maxPreisAlterMin, zeit) }));
      const vk = V.verkaufWaehlen(vkEintraege, erloesOpts) || { stadt: null, erloes: { netto: null, grund: "keine Verkaufsstadt angehakt" } };
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
      return zeile;
    });
  }

  function sortiere(zeilen, schluessel) {
    const wert = {
      kosten: (z) => z.silber,
      stueck: (z) => z.gewinn,
      marge: (z) => z.marge,
      volumen: (z) => z.stueckJeTag || 0,
      gesamt: (z) => z.gewinnGesamt,
    }[SORTIERUNGEN.indexOf(schluessel) !== -1 ? schluessel : "marge"];
    const auf = schluessel === "kosten";
    return zeilen.slice().sort((a, b) => (auf ? wert(a) - wert(b) : wert(b) - wert(a)));
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
   */
  function einkaufsliste(zeilen, plan) {
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
    const einst = { premium: true, stationssaetze: { Kriegerschmiede: 0 }, fce: 0, tagesbonus: {}, maxPreisAlterMin: null };
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
      "abrufSchaetzung: Zutaten je Einkaufsstadt, Preise und Handel je Verkaufsstadt",
      (function () {
        const a = abrufSchaetzung(breit, { einkaufStaedte: ["Lymhurst"], verkaufStaedte: ["Lymhurst", "Martlock"] });
        return a.produkte === 5 && a.abrufe === 1 + 2 * 2;
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
        "einkaufsliste: Mengen vor Rueckgewinnung, gleiche Zutat zusammengezaehlt (3 x 16 + 20 Barren), Speisen in ganzen Vorgaengen (15 Stueck = 2 Vorgaenge)",
        barren.menge === 68 && fleisch.menge === 144 && l.posten.length === 4 && l.fehlend.join() === "WEG" &&
          Math.abs(l.summe - (68 * 100 + 24 * 200 + 12 * 50 + 144 * 30)) < 1e-9,
        JSON.stringify(l.posten.map((p) => p.marktId + ":" + p.menge)) + " / " + l.summe
      );
      pruefe(
        "einkaufslisteText: Menge und Name je Zeile, tabgetrennt",
        einkaufslisteText({ posten: [barren] }, (n) => n + "-Name") === "68\tBARREN-Name",
        einkaufslisteText({ posten: [barren] }, (n) => n + "-Name")
      );
    })();
    return ergebnisse;
  }

  // -----------------------------------------------------------------------
  // Oberflaeche
  // -----------------------------------------------------------------------

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
    const statusEl = el("cgStatus");
    const ausgabeEl = el("cgAusgabe");
    const listeEl = el("cgEinkaufsliste");
    const stationenEl = el("cgStationen");
    const preiseResetEl = el("cgPreiseReset");
    const umfangEl = el("cgUmfang");

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
        ? a.produkte + " Produkte, " + a.zutaten + " Zutaten, etwa " + a.abrufe + " Abrufe (rund " + Math.max(1, Math.round((a.abrufe * 2) / 60 * 10) / 10).toString().replace(".", ",") + " Min.)"
        : "Nichts ausgewählt.";
      umfangEl.title = "Die Preis-Schnittstelle drosselt; die App fragt 50 Einträge je Abruf mit Pause dazwischen ab. Weniger Warengruppen, Tiers oder Städte gehen schneller.";
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

    function felderSetzen() {
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

    wurzel.addEventListener("change", (ev) => {
      const zaehlerEl = ev.target.closest(".cg-zaehler");
      if (zaehlerEl && ev.target.classList.contains("cg-zn")) {
        planSetzen(zaehlerEl.dataset.cgPlan, ev.target.value);
        return;
      }
      const preisEl = ev.target.closest("input[data-vd-markt]");
      if (preisEl) {
        const stadt = preisEl.dataset.vdStadt;
        const markt = preisEl.dataset.vdMarkt;
        const wert = preisEl.value.trim();
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
    });

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
      if (ev.target.closest("button[data-cg-alle-kopieren]")) {
        kopieren(einkaufslisteText(einkaufsliste(letzteZeilen ? letzteZeilen.zeilen : [], auswahl.plan), nameVon), ev.target.closest("button"));
        return;
      }
      const weg = ev.target.closest("button[data-cg-weg]");
      if (weg) {
        planSetzen(weg.dataset.cgWeg, 0);
        return;
      }
      if (ev.target.closest("button[data-cg-leeren]") || ev.target.closest("button[data-cg-fehlend-weg]")) {
        const nurFehlend = !!ev.target.closest("button[data-cg-fehlend-weg]");
        const ids = nurFehlend ? einkaufsliste(letzteZeilen ? letzteZeilen.zeilen : [], auswahl.plan).fehlend : Object.keys(auswahl.plan);
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
          const herkunft = x.uebersteuert
            ? "Eigener Preis für " + x.stadt + (m.preis != null ? ", Markt: " + fmt(m.preis) + (alter ? " (" + alter + " alt)" : "") : ", kein Marktpreis")
            : (order ? "Höchste Kauforder" : "Günstigste Verkaufsorder") + " in " + x.stadt + (alter ? ", " + alter + " alt" : "");
          const titel =
            kontext.mehrEk && x.alle && x.alle.length > 1
              ? staedteListe(x.alle.map((a) => ({ stadt: a.stadt, wert: a.basis })), x.stadt, false) + "\n\nKlicken zum Überschreiben."
              : herkunft + ". Klicken zum Überschreiben.";
          const wert = Math.round(x.basisPreis * 100) / 100;
          const feld =
            "<input type='number' class='vd-preis" + (x.uebersteuert ? " vd-eigen" : "") + "' min='1' step='1' value='" + wert + "'" +
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
        sortTh("volumen", "verkauft/Tag", "Erfasster Handel des Produkts in der Verkaufsstadt, Mittel der letzten " + TAGE_FENSTER + " Tage. Klicken sortiert absteigend.") +
        sortTh("kosten", "Kosten/Stück", "Material nach Rückgewinnung plus Stationsgebühr, je Stück Produkt. Klicken sortiert aufsteigend.") +
        sortTh("stueck", "Gewinn/Stück", "Erlös nach Steuer minus Kosten, je Stück. Klicken sortiert absteigend.") +
        sortTh("marge", "Marge", "Gewinn bezogen auf die eigenen Kosten. Klicken sortiert absteigend.") +
        sortTh("gesamt", "Gewinn gesamt", "Gewinn je Stück mal der eingestellten Menge. Klicken sortiert absteigend.") +
        "</tr></thead>"
      );
    }

    // ---- Einkaufsliste (v3.12.0) ----
    function zaehlerHtml(z, name) {
      const n = auswahl.plan[z.marktId] || 0;
      const schritt = z.ausbeute || 1;
      const t = schritt > 1 ? " (ein Vorgang ergibt " + schritt + " Stück)" : "";
      return (
        "<div class='cg-zaehler" + (n ? " an" : "") + "' data-cg-plan='" + esc(z.marktId) + "' data-cg-schritt='" + schritt + "'>" +
        "<button type='button' class='cg-zb' data-cg-delta='-1' aria-label='Eins weniger " + esc(name) + "' title='Weniger" + esc(t) + "'>−</button>" +
        "<input type='number' class='cg-zn' min='0' step='" + schritt + "' value='" + n + "' aria-label='Geplante Stückzahl " + esc(name) + "' title='Geplante Stückzahl für die Einkaufsliste" + esc(t) + "'>" +
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
        const inp = w.querySelector(".cg-zn");
        if (inp && document.activeElement !== inp) inp.value = n;
      });
      listeRendern();
    }

    function kopieren(text, knopf) {
      const fertig = () => {
        if (!knopf) return;
        const alt = knopf.textContent;
        knopf.textContent = "✓";
        knopf.classList.add("ok");
        setTimeout(() => {
          knopf.textContent = alt;
          knopf.classList.remove("ok");
        }, 900);
      };
      const ersatz = () => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch (e) {
          /* ignorieren */
        }
        document.body.removeChild(ta);
        fertig();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(fertig, ersatz);
      else ersatz();
    }

    function listeRendern() {
      if (!listeEl) return;
      const zeilen = letzteZeilen ? letzteZeilen.zeilen : [];
      const liste = einkaufsliste(zeilen, auswahl.plan);
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
            (p.ausbeute > 1 ? " <span class='vd-klein'>(" + p.vorgaenge + " Vorgänge)</span>" : "") +
            "<button type='button' class='vd-reset cg-plan-weg' data-cg-weg='" + esc(p.marktId) + "' title='Aus der Planung nehmen' aria-label='" + esc(name) + " aus der Planung nehmen'>×</button></span>"
          );
        })
        .join("");
      const zeilenHtml = liste.posten
        .map((x) => {
          const name = nameVon(x.n, x.stufe);
          return (
            "<tr><td><div class='cg-el-name'>" + icon(x.n, 30, name) + "<span>" + esc(name) + "</span>" +
            "<button type='button' class='mini cg-kopie' data-cg-kopie='" + esc(name) + "' title='Namen kopieren, zum Einfügen in die Marktsuche'>Kopieren</button></div></td>" +
            "<td class='num'>" + Math.round(x.menge).toLocaleString("de-DE") + "</td>" +
            (mehrEk ? "<td>" + stadtSchild(x.stadt, "Günstigste angehakte Einkaufsstadt. " + TRANSPORT) + "</td>" : "") +
            "<td class='num'>" + (x.basisPreis != null ? fmt(x.basisPreis) : "k. A.") + "</td>" +
            "<td class='num'>" + fmt(x.kosten) + "</td></tr>"
          );
        })
        .join("");
      const fehlt = liste.fehlend.length
        ? "<div class='vd-erkl'>" + liste.fehlend.length + " geplante" + (liste.fehlend.length === 1 ? "s Produkt ist" : " Produkte sind") +
          " in der aktuellen Suche nicht enthalten und fehlen in der Liste: " + liste.fehlend.map((id) => esc(namenNachMarktId[id] || id)).join(", ") +
          ". <button type='button' class='mini' data-cg-fehlend-weg='1'>Entfernen</button></div>"
        : "";
      listeEl.innerHTML =
        "<div class='cg-el-kopf'><h2 class='vd-kt'>Einkaufsliste</h2>" +
        "<span class='vd-klein' title='Mengen, die für die geplanten Crafts im Inventar liegen müssen. Die Rückgewinnung gibt einen Teil davon nach dem Craften zurück; die Kosten in der Tabelle oben sind deshalb niedriger.'>vor Rückgewinnung</span>" +
        "<span class='cg-el-knoepfe'><button type='button' class='mini' data-cg-alle-kopieren='1' title='Alle Zeilen als „Menge Name“ kopieren'>Alles kopieren</button>" +
        "<button type='button' class='mini' data-cg-leeren='1'>Liste leeren</button></span></div>" +
        "<div class='cg-plan'>" + produkte + "</div>" + fehlt +
        (liste.posten.length
          ? "<div class='vd-tabrahmen'><table class='vd-tabelle cg-el-tabelle'><thead><tr><th>Zutat</th><th class='num'>Menge</th>" +
            (mehrEk ? "<th>Stadt</th>" : "") + "<th class='num'>" + (order ? "Orderpreis" : "Preis") + "/Stück</th><th class='num'>Kosten</th></tr></thead><tbody>" +
            zeilenHtml + "</tbody><tfoot><tr><td colspan='" + (mehrEk ? 4 : 3) + "'>Summe" + (order ? " (inkl. 2,5 % Einstellgebühr)" : "") +
            (liste.vollstaendig ? "" : ", ohne Zutaten ohne Preis") + "</td><td class='num'>" + fmt(liste.summe) + "</td></tr></tfoot></table></div>"
          : "");
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
          const fokus = z.fokusJeVorgang > 0 ? "<div class='vd-klein'>" + fmtFokus(z.fokusJeVorgang) + " Fokus/Vorgang</div>" : "";
          const qText =
            kontext.verkaufsweg === "order" && z.qualifizierbar && z.sellQualitaet > 1
              ? ", günstigstes Angebot in " + REGELN.QUALITAETEN[z.sellQualitaet - 1] + " (unter Normal)"
              : "";
          const preisTitel = vkTitel + qText + (z.vkStadt ? " in " + z.vkStadt : "") + (z.produktAlterMin != null ? ", " + alterText(z.produktAlterMin) + " alt" : "");
          const volTitel =
            "Erfasster Handel in " + (z.vkStadt || "") + ", Mittel der letzten " + TAGE_FENSTER + " Tage" +
            (z.qualifizierbar ? (kontext.alleQ ? ", alle Qualitäten zusammen (Normal allein: " + stueck(z.stueckJeTagNormal) + ")" : ", nur Normal") : "") +
            ". Untergrenze: gemeldet wird nur, was Spieler mit laufendem Data-Client sehen.";
          return (
            "<tr class='" + klasse + "'>" +
            "<td><div class='vd-produkt'>" + icon(marktIdVon(z.item, z.stufe), 48, name) + "<div><div class='vd-pname'>" + esc(name) + "</div>" +
            "<div class='vd-klein'" + (tierTitel ? " title='" + esc(tierTitel) + "'" : "") + ">T" + z.tier + "." + z.vorgangsStufe + (z.stadtbonus ? " · Stadtbonus" : "") + "</div>" +
            zaehlerHtml(z, name) + "</div></div></td>" +
            "<td><div class='vd-zutaten" + (kontext.mehrEk ? "" : " ohne-stadt") + "'>" + zutatenHtml(z, kontext) + "</div></td>" +
            "<td><div class='vd-erloes' title='" +
            esc(
              kontext.mehrVk && z.vkAlle && z.vkAlle.length > 1
                ? "Erlös je Stück nach Steuer je Stadt:\n" + staedteListe(z.vkAlle.map((a) => ({ stadt: a.stadt, wert: a.netto })), z.vkStadt, true)
                : "Erlös je Stück nach Steuer" + (kontext.verkaufsweg === "order" ? " und 2,5 % Einstellgebühr" : "")
            ) +
            "'>" + fmt(z.erloes) + "</div>" +
            "<div class='vd-klein' title='" + esc(preisTitel) + "'>Preis " + fmt(z.produktPreis) + (qText ? " (" + REGELN.QUALITAETEN[z.sellQualitaet - 1] + ")" : "") + "</div>" +
            (kontext.mehrVk ? "<div>" + stadtSchild(z.vkStadt, "Angehakte Verkaufsstadt mit dem höchsten Erlös. " + TRANSPORT) + "</div>" : "") +
            "</td>" +
            "<td class='num' title='" + esc(volTitel) + "'>" + stueck(z.stueckJeTag) + "</td>" +
            "<td class='num'>" + fmt(z.silber) + fokus + "</td>" +
            "<td class='num vd-wert' title='" + einstufung + "'>" + fmt(z.gewinn) + "</td>" +
            "<td class='num vd-wert2'>" + prozent(z.marge) + "</td>" +
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
        ". Preise abgerufen um " + daten.zeit + "." +
        (fehlend.length ? " Stationssatz fehlt für " + fehlend.join(", ") + ", mit 0 gerechnet." : "");
    }

    async function suchen() {
      if (laeuft) return;
      felderLesen();
      if (!auswahl.einkaufStaedte.length || !auswahl.verkaufStaedte.length || !auswahl.warengruppen.length || !auswahl.tiers.length || !auswahl.stufen.length) {
        statusEl.className = "err";
        statusEl.textContent = "Mindestens je eine Warengruppe, ein Tier, eine Verzauberung, eine Einkaufs- und eine Verkaufsstadt anhaken.";
        return;
      }
      laeuft = true;
      startEl.disabled = true;
      statusEl.className = "";
      ausgabeEl.innerHTML = "";
      try {
        const kand = kandidaten(auswahl);
        const ids = benoetigteMarktIds(kand);
        const staedte = STAEDTE.filter((s) => auswahl.einkaufStaedte.indexOf(s) !== -1 || auswahl.verkaufStaedte.indexOf(s) !== -1);
        const stadtDaten = [];
        for (let i = 0; i < staedte.length; i++) {
          const stadt = staedte[i];
          const ek = auswahl.einkaufStaedte.indexOf(stadt) !== -1;
          const vk = auswahl.verkaufStaedte.indexOf(stadt) !== -1;
          const vorsatz = stadt + " (" + (i + 1) + "/" + staedte.length + "): ";
          const eintrag = { stadt };
          if (ek) {
            eintrag.preiseRoh = await PREISE.preiseAbrufen(ids.zutaten, {
              stadt,
              erzwingen: true,
              qualitaet: 1,
              aufFortschritt: (f, g) => {
                statusEl.textContent = vorsatz + "Materialpreise " + f + "/" + g + " ...";
              },
            });
          }
          if (vk) {
            eintrag.produktJeQ = await PREISE.preiseAlleQualitaetenAbrufen(ids.produkte, {
              stadt,
              aufFortschritt: (f, g) => {
                statusEl.textContent = vorsatz + "Verkaufspreise " + f + "/" + g + " ...";
              },
            });
            eintrag.absatz = await PREISE.absatzAbrufen(ids.produkte, {
              stadt,
              tageFenster: TAGE_FENSTER,
              aufFortschritt: (f, g) => {
                statusEl.textContent = vorsatz + "Handelsvolumen " + f + "/" + g + " ...";
              },
            });
          }
          stadtDaten.push(eintrag);
        }
        daten = {
          stadtDaten,
          zutaten: new Set(ids.zutaten),
          produkte: new Set(ids.produkte),
          einkauf: new Set(auswahl.einkaufStaedte),
          verkauf: new Set(auswahl.verkaufStaedte),
          zeit: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
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
    startEl.addEventListener("click", () => suchen());
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
    einkaufslisteText,
    selbsttest,
  };
})();
