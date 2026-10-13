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
// REGELN.erloesJeStueck (Steuer, Einstellgebuehr, Hoechstalter).
//
// Aus den Einstellungen des Kostenrechners kommen nur Werte, die dort schon
// gepflegt sind: Premium, Stationssaetze je Gebaeude, Tagesbonus, FCE und
// Hoechstalter der Preise. Stadt, Kauf- und Verkaufsweg, Fokus und
// Zusatzbonus waehlt der Reiter selbst, weil sie hier die eigentliche Frage
// sind. Der Tagesbonus (+0,10 Silbertag, +0,20 Goldtag, s. CLAUDE.md und
// AUDIT-2026-09-13.md: Wiki "each day two items have an extra 10% or 20%")
// ist ueber keine Schnittstelle abrufbar, deshalb ein Schalter je Rohstoff
// statt eines Kalenders. Seit v3.9.1 (13.10.2026, Nutzerbeleg: im Spiel
// beobachtet) gilt er in allen Staedten gleich: eine Zeile statt einer je
// Stadt, und es ist dieselbe Einstellung wie im Kostenrechner
// (einstellungen.tagesbonus, UI.tagesbonusSetzen).
//
// Bewusst NICHT modelliert: Craft-Fame je Vorgang. Dafuer gibt es im Repo
// keinen belegten Wert (s. CLAUDE.md, "Belegte Werte nie ohne neuen Beleg").
// Die Rangliste sortiert deshalb nach Marge, nicht nach Silber je Fame.
//
// v3.9.0 (13.10.2026): Einkaufspreis je Zutat ueberschreibbar und Hoechstpreis
// je Zutat (Gewinn der Zeile = 0). Eigene Preise gelten je Stadt und Markt-ID
// (Item@Stufe) und werden als Marktpreis in opts.preise eingesetzt, beide
// Seiten gleich: der Rechenkern behandelt sie damit genau wie einen
// Marktpreis, bei eigener Kauforder also als Orderpreis plus 2,5 %
// Einstellgebuehr. Bewusst KEIN Rueckgriff auf die Mechanismen des
// Kostenrechners: Eigenpreise (PREISE.eigenpreis*) greifen nur, wenn GAR kein
// Marktpreis da ist, und Preisuebersteuerungen (einstellungen.
// preisUebersteuerungen) sind stadtunabhaengig und ein fester Kaufpreis ohne
// Einstellgebuehr. Beides passt nicht zu "dieser Preis fuer Hanf in
// Lymhurst". Eigene Preise bleiben gespeichert, auch ueber "Preise
// aktualisieren" hinweg, bis sie zurueckgesetzt werden; der Erloes (Produkt)
// rechnet weiter mit dem Marktpreis.
//
// Stationssaetze sind dieselbe Einstellung wie im Kostenrechner
// (einstellungen.stationssaetze, UI.stationssatzSetzen); eine Aenderung in
// einem Reiter wirkt im anderen. Nachrechnen ohne neuen Abruf: die
// abgerufenen Preise und Handelsvolumen bleiben je Stadt in `daten` liegen.

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
      zusatzbonusProzent: 0,
      preisUeberschreibungen: {}, // Stadt -> Markt-ID -> Silber je Stueck (> 0), s. Modulkommentar
    };
  }

  /** Gebaeude je Rohstoff, dieselben Schluessel wie einstellungen.stationssaetze. */
  function stationenFuer(rohstoffe) {
    const out = [];
    (rohstoffe || []).forEach((cc) => {
      const g = REGELN.gebaeudeVonKategorie(cc);
      if (g && out.indexOf(g) === -1) out.push(g);
    });
    return out;
  }

  /** Nur bekannte Staedte und Preise > 0 bleiben stehen. */
  function ueberschreibungenBereinigen(roh) {
    const out = {};
    if (!roh || typeof roh !== "object") return out;
    STAEDTE.forEach((stadt) => {
      const je = roh[stadt];
      if (!je || typeof je !== "object") return;
      Object.keys(je).forEach((id) => {
        const p = Number(je[id]);
        if (je[id] !== "" && je[id] != null && isFinite(p) && p > 0) {
          if (!out[stadt]) out[stadt] = {};
          out[stadt][id] = p;
        }
      });
    });
    return out;
  }

  function anzahlUeberschreibungen(ueb) {
    return Object.keys(ueb || {}).reduce((n, s) => n + Object.keys(ueb[s] || {}).length, 0);
  }

  /**
   * Eigene Preise einer Stadt als Marktpreis einsetzen (Kopie, das Original
   * bleibt fuer den Erloes unberuehrt). Beide Seiten bekommen denselben
   * Preis, ohne Datum (kein Alter, also keine Sperre durch das Hoechstalter).
   */
  function preiseMitUeberschreibungen(preiseOpts, ueberschreibungenStadt) {
    const out = Object.assign({}, preiseOpts || {});
    Object.keys(ueberschreibungenStadt || {}).forEach((id) => {
      const p = Number(ueberschreibungenStadt[id]);
      if (!isFinite(p) || p <= 0) return;
      const seite = { preis: p, kein: false, datum: "" };
      out[id] = { sell: seite, buy: Object.assign({}, seite) };
    });
    return out;
  }

  /**
   * Hoechstpreis einer Zutat: der Basispreis (Verkaufsorder bzw. Orderpreis),
   * bei dem der Gewinn je Stueck auf 0 faellt, alle anderen Preise fest.
   * Die Kosten sind in diesem Preis linear: mit nurDirekteEbene wird jede
   * Zutat gekauft (Kosten = Preis x Kauffaktor), die Rueckgewinnung wirkt als
   * fester Mengenfaktor (effektiveMenge = Menge x (1 - RRR)), und die
   * Stationsgebuehr haengt am Gegenstandswert, nicht am Preis. Also
   *   Kosten(p) = Kosten(p0) + (p - p0) x effektiveMenge x Kauffaktor
   * und der Nullpunkt liegt bei p0 + Gewinn / (effektiveMenge x Kauffaktor).
   * Der Selbsttest rechnet das gegen RECHENKERN.kosten() nach.
   */
  function hoechstpreis(gewinnJeStueck, basisPreis, effektiveMenge, kaufFaktor) {
    if (gewinnJeStueck == null || basisPreis == null || !(effektiveMenge > 0) || !(kaufFaktor > 0)) return null;
    return basisPreis + gewinnJeStueck / (effektiveMenge * kaufFaktor);
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
      zusatzbonusProzent: isFinite(Number(roh.zusatzbonusProzent)) && Number(roh.zusatzbonusProzent) > 0 ? Number(roh.zusatzbonusProzent) : 0,
      preisUeberschreibungen: ueberschreibungenBereinigen(roh.preisUeberschreibungen),
    };
  }

  /**
   * Migration des alten Speicherstands (bis v3.9.0: tagesbonus je Stadt,
   * Stadt -> craftingcategory -> "silber"|"gold") auf einen Wert je Rohstoff.
   * Je Rohstoff gilt der HOECHSTE Wert ueber alle Staedte (Gold vor Silber).
   * Begruendung: jeder Eintrag war eine Ablesung desselben, wie wir jetzt
   * wissen stadtunabhaengigen Bonus. Die alte Tabelle zeigte jede angehakte
   * Stadt, gepflegt wurde meist nur eine; ein "aus" in einer anderen Stadt
   * heisst also eher "nicht eingetragen" als "abgelesen: kein Bonus". Bei
   * Silber hier und Gold dort ist nicht feststellbar, welcher Eintrag neuer
   * ist; der hoehere ist die tatsaechlich beobachtete Bonusstufe. Unbekannte
   * Staedte, Rohstoffe und Werte fallen weg. Liefert {} ohne Altstand.
   */
  function tagesbonusAusAltstand(roh) {
    const out = {};
    if (!roh || typeof roh !== "object") return out;
    const rang = { silber: 1, gold: 2 };
    ROHSTOFFE.forEach(({ cc }) => {
      STAEDTE.forEach((stadt) => {
        const w = roh[stadt] && typeof roh[stadt] === "object" ? roh[stadt][cc] : null;
        if (rang[w] && (!out[cc] || rang[w] > rang[out[cc]])) out[cc] = w;
      });
    });
    return out;
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
      produktPreis: erloes && erloes.brutto != null ? erloes.brutto : null,
      produktAlterMin: erloes && erloes.alterMin != null ? erloes.alterMin : null,
      zutatenPreise: [],
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
    // Zur Absicherung (Wunsch 08.10.2026): die tatsaechlich verwendeten
    // Einkaufspreise je Zutat, so wie der Rechenkern sie angesetzt hat
    // (bei eigener Kauforder inkl. 2,5 % Einstellgebuehr).
    // v3.9.0: basisPreis ist der Preis ohne Einstellgebuehr (Verkaufsorder
    // bzw. Orderpreis), so wie ihn der Nutzer eintippt; preis bleibt der
    // angesetzte Stueckpreis inkl. Gebuehr.
    const kaufFaktor = REGELN.kaufKostenJeStueck(1, opts.kaufweg === "order" ? "order" : "sofort");
    const ueber = opts.ueberschreibungen || {};
    z.kaufFaktor = kaufFaktor;
    z.zutatenPreise = (craft.weg.zutaten || []).map((zt) => {
      const marktId = zt.weg && zt.weg.marktId ? zt.weg.marktId : null;
      return {
        n: zt.item,
        stufe: zt.stufe,
        menge: zt.menge * kandidat.menge,
        preis: zt.silberJeStueck,
        basisPreis: zt.silberJeStueck / kaufFaktor,
        effektiveMenge: zt.effektiveMenge,
        marktId,
        uebersteuert: !!(marktId && ueber[marktId] != null),
        hoechstpreis: null,
      };
    });
    if (!erloes || erloes.netto == null) {
      z.grund = (erloes && erloes.grund) || "kein Verkaufspreis";
      return z;
    }
    z.gewinn = erloes.netto - craft.silber;
    z.marge = craft.silber > 0 ? z.gewinn / craft.silber : null;
    z.gewinnJeVorgang = z.gewinn * kandidat.menge;
    z.gewinnGesamt = z.gewinn * menge;
    z.einstufung = einstufen(z.gewinn, craft.silber, toleranz);
    z.zutatenPreise.forEach((x) => {
      x.hoechstpreis = hoechstpreis(z.gewinn, x.basisPreis, x.effektiveMenge, kaufFaktor);
    });
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

  /**
   * Alle Zeilen aus bereits abgerufenen Daten, ohne Netz. Wird nach jeder
   * Suche und bei jeder Aenderung von eigenem Preis, Stationssatz oder
   * Rechenoption erneut aufgerufen.
   *
   * @param kand Kandidatenliste (kandidaten())
   * @param stadtDaten [{stadt, preiseRoh, absatz}] wie von PREISE geliefert
   * @param auswahl Reiter-Einstellungen (einstellungenBereinigen())
   * @param einstellungen Kostenrechner-Einstellungen (UI.einstellungenLesen())
   */
  function zeilenRechnen(kand, stadtDaten, auswahl, einstellungen) {
    const maxPreisAlterMin =
      einstellungen.maxPreisAlterMin === "" || einstellungen.maxPreisAlterMin == null ? null : Number(einstellungen.maxPreisAlterMin);
    const fceUeb = typeof UI !== "undefined" && UI.fceUeberschreibungenAus ? UI.fceUeberschreibungenAus(einstellungen) : {};
    const zeilen = [];
    (stadtDaten || []).forEach((d) => {
      const stadt = d.stadt;
      const ueber = (auswahl.preisUeberschreibungen || {})[stadt] || {};
      const opts = {
        preise: preiseMitUeberschreibungen(REGELN.preiseZuOptsFormat(d.preiseRoh), ueber),
        eigenpreise: {},
        kaufweg: auswahl.kaufweg,
        stadt,
        stationssaetze: einstellungen.stationssaetze || {},
        fce: einstellungen.fce,
        fceUeberschreibungen: fceUeb,
        fokusAus: !auswahl.mitFokus,
        fokusRegelJeKategorie: {},
        fokusUebersteuerungJeKnoten: {},
        fokuswert: 0,
        tagesbonus: einstellungen.tagesbonus || {}, // v3.9.1: gilt in allen Staedten gleich
        zusatzProduktionsbonus: (auswahl.zusatzbonusProzent || 0) / 100,
        maxPreisAlterMin,
        nurDirekteEbene: true,
      };
      kand.forEach((k) => {
        const craft = craftKandidatAus(RECHENKERN.kosten(k.item, k.stufe, 1, opts), k.rezeptIndex, auswahl.mitFokus);
        const erloes = REGELN.erloesJeStueck((d.preiseRoh || {})[k.marktId], {
          verkaufsweg: auswahl.verkaufsweg,
          premium: einstellungen.premium,
          maxPreisAlterMin,
        });
        const zeile = zeileBauen(k, stadt, craft, erloes, ((d.absatz || {})[k.marktId] || {})[1], Object.assign({}, auswahl, { ueberschreibungen: ueber }));
        zeile.preiseRoh = d.preiseRoh;
        zeilen.push(zeile);
      });
    });
    return zeilen;
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
    const erloes = REGELN.erloesJeStueck(preise.T4_CLOTH, { verkaufsweg: "sofort", premium: true });
    const zeile = zeileBauen(kand[0], "Lymhurst", craft, erloes, { stueckJeTag: 50 }, { menge: 1000, toleranzProzent: 5 });
    pruefe(
      "zeileBauen: Sofortverkauf 300 mit 4 % Steuer = 288, Gewinn = 288 - 253,16, insgesamt mal Menge",
      Math.abs(zeile.gewinn - (288 - 400 / 1.58)) < 0.01 && Math.abs(zeile.gewinnGesamt - zeile.gewinn * 1000) < 0.01 && zeile.einstufung === "gewinn" && zeile.stadtbonus,
      JSON.stringify({ gewinn: zeile.gewinn, gesamt: zeile.gewinnGesamt, einstufung: zeile.einstufung })
    );
    const ohneBonus = craftKandidatAus(RECHENKERN.kosten("T4_CLOTH", 0, 1, Object.assign({}, optsBasis, { stadt: "Martlock" })), 0, false);
    pruefe(
      "zeileBauen: Einzelpreise zur Absicherung (Faser 100, Vorstufe 200, Produkt 300 brutto)",
      zeile.zutatenPreise.length === 2 && zeile.zutatenPreise[0].preis === 100 && zeile.zutatenPreise[0].menge === 2 &&
        zeile.zutatenPreise[1].preis === 200 && zeile.produktPreis === 300,
      JSON.stringify({ z: zeile.zutatenPreise, p: zeile.produktPreis })
    );
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
    const mitTag = craftKandidatAus(RECHENKERN.kosten("T4_CLOTH", 0, 1, Object.assign({}, optsBasis, { tagesbonus: { fiber: "gold" } })), 0, false);
    pruefe(
      "Tagesbonus: Goldtag in Lymhurst ergibt B = 0,78, also 43,8 % Rueckgewinnung",
      mitTag && Math.abs(mitTag.weg.rrr - 0.78 / 1.78) < 1e-9,
      mitTag && mitTag.weg.rrr
    );
    const mitZusatz = craftKandidatAus(RECHENKERN.kosten("T4_CLOTH", 0, 1, Object.assign({}, optsBasis, { tagesbonus: { fiber: "silber" }, zusatzProduktionsbonus: 0.05 })), 0, false);
    pruefe(
      "Zusatzbonus: +5 Prozentpunkte addieren sich zu Grundwert, Stadtbonus und Silbertag (B = 0,73)",
      mitZusatz && Math.abs(mitZusatz.weg.rrr - 0.73 / 1.73) < 1e-9,
      mitZusatz && mitZusatz.weg.rrr
    );
    pruefe(
      "Zusatzbonus: negative oder fehlende Werte aendern nichts",
      Math.abs(REGELN.rrr({ cc: "fiber", stadt: "Martlock", zusatzbonus: -0.5 }) - 0.18 / 1.18) < 1e-12 &&
        Math.abs(REGELN.rrr({ cc: "fiber", stadt: "Martlock" }) - 0.18 / 1.18) < 1e-12,
      REGELN.rrr({ cc: "fiber", stadt: "Martlock", zusatzbonus: -0.5 })
    );
    const alt = { Lymhurst: { fiber: "silber", wood: "bronze", sword: "silber" }, Martlock: { fiber: "gold", hide: "silber" }, Atlantis: { ore: "gold" } };
    pruefe(
      "tagesbonusAusAltstand: je Rohstoff der hoechste Wert ueber alle Staedte, Unbekanntes faellt weg",
      JSON.stringify(tagesbonusAusAltstand(alt)) === JSON.stringify({ fiber: "gold", hide: "silber" }) &&
        JSON.stringify(tagesbonusAusAltstand(null)) === "{}" && JSON.stringify(tagesbonusAusAltstand({ Lymhurst: "gold" })) === "{}",
      JSON.stringify(tagesbonusAusAltstand(alt))
    );
    pruefe(
      "einstellungenBereinigen: der alte Tagesbonus je Stadt bleibt nicht im Reiter-Speicher (liegt jetzt in den gemeinsamen Einstellungen)",
      !("tagesbonus" in einstellungenBereinigen({ tagesbonus: alt })) && !("tagesbonus" in standardEinstellungen()),
      Object.keys(einstellungenBereinigen({ tagesbonus: alt })).join(",")
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

    // ---- v3.9.0: eigene Einkaufspreise, Hoechstpreis, Stationssaetze ----
    const roh = (sell, buy) => ({
      sell: sell == null ? { kein: true } : { preis: sell, kein: false, datum: "" },
      buy: buy == null ? { kein: true } : { preis: buy, kein: false, datum: "" },
    });
    const preiseRoh = { T4_FIBER: roh(100, 90), T3_CLOTH: roh(200, 180), T4_CLOTH: roh(320, 300) };
    const einst = { stationssaetze: { Weber: 400 }, fce: 0, premium: true, maxPreisAlterMin: null, fceAusnahmen: {}, spezialisierung: {} };
    const k4 = kandidaten({ rohstoffe: ["fiber"], tiers: [4], stufen: [0] });
    const rechne = (aus, daten, e) => zeilenRechnen(k4, daten || [{ stadt: "Lymhurst", preiseRoh, absatz: {} }], einstellungenBereinigen(aus), e || einst);
    const basisZ = rechne({ kaufweg: "sofort", verkaufsweg: "sofort" })[0];
    const gebuehr = basisZ.gebuehr;
    pruefe(
      "zeilenRechnen: Weber 400 geht als Stationsgebuehr ein, Kosten = 400 / 1,58 + Gebuehr",
      gebuehr > 0 && Math.abs(basisZ.silber - (400 / 1.58 + gebuehr)) < 1e-9,
      basisZ.silber + " / " + gebuehr
    );
    // v3.9.1: Tagesbonus gilt in allen Staedten gleich, aus den gemeinsamen Einstellungen.
    const tagDaten = ["Lymhurst", "Martlock", "Caerleon"].map((stadt) => ({ stadt, preiseRoh, absatz: {} }));
    const tagAus = { staedte: ["Lymhurst", "Martlock", "Caerleon"], kaufweg: "sofort", verkaufsweg: "sofort" };
    const tagZ = rechne(tagAus, tagDaten, Object.assign({}, einst, { tagesbonus: { fiber: "gold" } }));
    const rrrVon = (zs, stadt) => (zs.find((z) => z.stadt === stadt) || {}).rrr;
    pruefe(
      "Tagesbonus Faser 20 % wirkt in jeder Stadt: Lymhurst B = 0,18 + 0,40 + 0,20, Martlock und Caerleon B = 0,18 + 0,20",
      Math.abs(rrrVon(tagZ, "Lymhurst") - 0.78 / 1.78) < 1e-9 && Math.abs(rrrVon(tagZ, "Martlock") - 0.38 / 1.38) < 1e-9 &&
        Math.abs(rrrVon(tagZ, "Caerleon") - 0.38 / 1.38) < 1e-9,
      ["Lymhurst", "Martlock", "Caerleon"].map((s) => s + ":" + rrrVon(tagZ, s)).join(", ")
    );
    const tagSilberAndere = rechne(tagAus, tagDaten, Object.assign({}, einst, { tagesbonus: { fiber: "silber", wood: "gold", ore: "gold" } }));
    pruefe(
      "Tagesbonus: mehrere Rohstoffe gleichzeitig, Faser 10 % gibt Martlock B = 0,28; Holz/Erz-Bonus beruehrt Faser nicht",
      Math.abs(rrrVon(tagSilberAndere, "Martlock") - 0.28 / 1.28) < 1e-9 && Math.abs(rrrVon(tagSilberAndere, "Lymhurst") - 0.68 / 1.68) < 1e-9,
      rrrVon(tagSilberAndere, "Martlock") + " / " + rrrVon(tagSilberAndere, "Lymhurst")
    );
    const tagAlt = rechne(Object.assign({}, tagAus, { tagesbonus: { Martlock: { fiber: "gold" } } }), tagDaten, einst);
    pruefe(
      "Tagesbonus: ein alter Eintrag je Stadt im Reiter-Speicher wirkt nicht mehr (nur die gemeinsame Einstellung zaehlt)",
      Math.abs(rrrVon(tagAlt, "Martlock") - 0.18 / 1.18) < 1e-9,
      rrrVon(tagAlt, "Martlock")
    );
    const mit150 = rechne({ kaufweg: "sofort", verkaufsweg: "sofort", preisUeberschreibungen: { Lymhurst: { T4_FIBER: 150 } } })[0];
    pruefe(
      "Eigener Preis: Faser 150 statt 100, die Zeile rechnet neu (Kosten, Gewinn, Marge) und markiert die Zutat",
      Math.abs(mit150.silber - ((2 * 150 + 200) / 1.58 + gebuehr)) < 1e-9 &&
        Math.abs(mit150.gewinn - (288 - mit150.silber)) < 1e-9 && Math.abs(mit150.marge - mit150.gewinn / mit150.silber) < 1e-12 &&
        mit150.zutatenPreise[0].uebersteuert && mit150.zutatenPreise[0].basisPreis === 150 && !mit150.zutatenPreise[1].uebersteuert,
      JSON.stringify({ s: mit150.silber, g: mit150.gewinn })
    );
    const zweiStaedte = rechne(
      { staedte: ["Lymhurst", "Martlock"], kaufweg: "sofort", verkaufsweg: "sofort", preisUeberschreibungen: { Lymhurst: { T4_FIBER: 150 } } },
      [{ stadt: "Lymhurst", preiseRoh, absatz: {} }, { stadt: "Martlock", preiseRoh, absatz: {} }]
    );
    pruefe(
      "Eigener Preis gilt nur in seiner Stadt (Lymhurst 150, Martlock weiter Markt 100)",
      zweiStaedte[0].zutatenPreise[0].preis === 150 && zweiStaedte[1].zutatenPreise[0].preis === 100 && !zweiStaedte[1].zutatenPreise[0].uebersteuert,
      zweiStaedte.map((z) => z.stadt + ":" + z.zutatenPreise[0].preis).join(",")
    );
    const produktUeb = rechne({ kaufweg: "sofort", verkaufsweg: "sofort", preisUeberschreibungen: { Lymhurst: { T4_CLOTH: 999 } } })[0];
    pruefe(
      "Eigener Preis wirkt nur auf den Einkauf, der Erloes rechnet weiter mit dem Marktpreis",
      Math.abs(produktUeb.erloes - basisZ.erloes) < 1e-9 && produktUeb.produktPreis === 300,
      produktUeb.erloes
    );
    const gewinnBei = (aus, id, p) => {
      const u = {};
      u[id] = p;
      return rechne(Object.assign({}, aus, { preisUeberschreibungen: { Lymhurst: u } }))[0].gewinn;
    };
    [
      ["Sofortkauf", { kaufweg: "sofort", verkaufsweg: "sofort" }],
      ["eigene Kauforder", { kaufweg: "order", verkaufsweg: "sofort" }],
      ["Kauforder und Verkaufsorder", { kaufweg: "order", verkaufsweg: "order" }],
    ].forEach(([text, aus]) => {
      const z0 = rechne(aus)[0];
      z0.zutatenPreise.forEach((x, i) => {
        const g = gewinnBei(aus, x.marktId, x.hoechstpreis);
        pruefe(
          "Hoechstpreis (" + text + "): " + x.marktId + " beim Hoechstpreis eingesetzt ergibt im Rechenkern Gewinn 0",
          x.hoechstpreis > x.basisPreis && Math.abs(g) < 1e-6,
          "Hoechstpreis " + x.hoechstpreis + ", Gewinn dort " + g + " (Zutat " + i + ")"
        );
      });
    });
    const order = rechne({ kaufweg: "order", verkaufsweg: "sofort" })[0];
    const orderUeb = rechne({ kaufweg: "order", verkaufsweg: "sofort", preisUeberschreibungen: { Lymhurst: { T4_FIBER: 120 } } })[0];
    pruefe(
      "Kauforder: Markt- und eigener Preis gelten als Orderpreis, die 2,5 % Einstellgebuehr kommt obendrauf",
      order.zutatenPreise[0].basisPreis === 90 && Math.abs(order.zutatenPreise[0].preis - 92.25) < 1e-9 &&
        orderUeb.zutatenPreise[0].basisPreis === 120 && Math.abs(orderUeb.zutatenPreise[0].preis - 123) < 1e-9,
      order.zutatenPreise[0].preis + " / " + orderUeb.zutatenPreise[0].preis
    );
    const kostenBei = (p) => rechne({ kaufweg: "order", verkaufsweg: "sofort", preisUeberschreibungen: { Lymhurst: { T3_CLOTH: p } } })[0].silber;
    const k1 = kostenBei(50), k2 = kostenBei(150), k3 = kostenBei(4000);
    pruefe(
      "Hoechstpreis: Kosten im Rechenkern sind im Zutatenpreis linear (drei Punkte, Steigung = effektive Menge x 1,025)",
      Math.abs((k2 - k1) / 100 - (k3 - k1) / 3950) < 1e-9 && Math.abs((k2 - k1) / 100 - (1 / 1.58) * 1.025) < 1e-9,
      [(k2 - k1) / 100, (k3 - k1) / 3950].join(" / ")
    );
    const verlustDaten = [{ stadt: "Lymhurst", preiseRoh: Object.assign({}, preiseRoh, { T4_CLOTH: roh(250, 200) }), absatz: {} }];
    const verlust = rechne({ kaufweg: "sofort", verkaufsweg: "sofort" }, verlustDaten)[0];
    pruefe(
      "Hoechstpreis bei Verlust: liegt unter dem aktuellen Preis, und auch dort gilt Gewinn 0",
      verlust.gewinn < 0 && verlust.zutatenPreise[0].hoechstpreis < 100 &&
        Math.abs(
          zeilenRechnen(k4, verlustDaten, einstellungenBereinigen({ kaufweg: "sofort", verkaufsweg: "sofort", preisUeberschreibungen: { Lymhurst: { T4_FIBER: verlust.zutatenPreise[0].hoechstpreis } } }), einst)[0].gewinn
        ) < 1e-6,
      verlust.gewinn + " / " + verlust.zutatenPreise[0].hoechstpreis
    );
    pruefe(
      "hoechstpreis: ohne Gewinn oder ohne wirksame Menge kein Wert",
      hoechstpreis(null, 100, 1, 1) === null && hoechstpreis(10, 100, 0, 1) === null && hoechstpreis(10, 100, 2, 1) === 105,
      hoechstpreis(10, 100, 2, 1)
    );
    const ohneGebuehr = rechne({ kaufweg: "sofort", verkaufsweg: "sofort" }, null, Object.assign({}, einst, { stationssaetze: { Weber: 0 } }))[0];
    const satz800 = rechne({ kaufweg: "sofort", verkaufsweg: "sofort" }, null, Object.assign({}, einst, { stationssaetze: { Weber: 800 } }))[0];
    pruefe(
      "Stationssatz: Weber 0 / 400 / 800 aendert die Kosten genau um die Gebuehr (linear im Satz)",
      ohneGebuehr.gebuehr === 0 && Math.abs(basisZ.silber - ohneGebuehr.silber - gebuehr) < 1e-9 && Math.abs(satz800.gebuehr - 2 * gebuehr) < 1e-9,
      [ohneGebuehr.silber, basisZ.silber, satz800.silber].join(" / ")
    );
    pruefe(
      "stationenFuer: die fuenf Rohstoffe gehoeren zu Weber, Saegewerk, Schmelze, Steinmetz, Gerberei",
      stationenFuer(["fiber", "wood", "ore", "rock", "hide"]).join() === "Weber,Saegewerk,Schmelze,Steinmetz,Gerberei",
      stationenFuer(["fiber", "wood", "ore", "rock", "hide"]).join()
    );
    pruefe(
      "ueberschreibungenBereinigen: unbekannte Stadt, 0, negativ und leer fallen weg",
      JSON.stringify(ueberschreibungenBereinigen({ Lymhurst: { T4_FIBER: 120, T3_CLOTH: 0, T5_FIBER: -3, T6_FIBER: "" }, Atlantis: { T4_FIBER: 5 } })) ===
        JSON.stringify({ Lymhurst: { T4_FIBER: 120 } }) &&
        anzahlUeberschreibungen({ Lymhurst: { a: 1, b: 2 }, Martlock: { c: 3 } }) === 3,
      JSON.stringify(ueberschreibungenBereinigen({ Lymhurst: { T4_FIBER: 120, T3_CLOTH: 0 }, Atlantis: { T4_FIBER: 5 } }))
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
    const tagesbonusEl = el("vdTagesbonus");
    const zusatzbonusEl = el("vdZusatzbonus");
    const startEl = el("vdStart");
    const statusEl = el("vdStatus");
    const ausgabeEl = el("vdAusgabe");
    const stationenEl = el("vdStationen");
    const preiseResetEl = el("vdPreiseReset");

    let auswahl = standardEinstellungen();
    let letzteZeilen = null;
    let daten = null; // { kand, stadtDaten: [{stadt, preiseRoh, absatz}] } der letzten Suche, fuer Nachrechnen ohne Abruf
    let laeuft = false;

    let altTagesbonus = null;
    try {
      const gespeichert = JSON.parse(localStorage.getItem(SPEICHER_KEY) || "null");
      altTagesbonus = gespeichert && gespeichert.tagesbonus;
      auswahl = einstellungenBereinigen(gespeichert);
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

    /** Eine Zeile, ein Schalter je Rohstoff; dieselbe Einstellung wie im Kostenrechner (v3.9.1). */
    function tagesbonusAufbauen() {
      const tb = UI.einstellungenLesen().tagesbonus || {};
      tagesbonusEl.innerHTML = ROHSTOFFE.map((r) => {
        const w = tb[r.cc] || "aus";
        const opt = (wert, text) => `<option value="${wert}"${w === wert ? " selected" : ""}>${text}</option>`;
        const name = r.label.split(" ")[0];
        return `<label>${name}<select class="vd-tag" data-tag-cc="${r.cc}" aria-label="Tagesbonus ${name}">${opt("aus", "aus")}${opt("silber", "10 %")}${opt("gold", "20 %")}</select></label>`;
      }).join("");
    }

    // v3.9.1: alter Tagesbonus je Stadt aus dem Reiter-Speicher einmalig in
    // die gemeinsame Einstellung uebernehmen (je Rohstoff der hoechste Wert,
    // s. tagesbonusAusAltstand). Der Altstand hat Vorrang vor einem Wert, der
    // im Kostenrechner fuer dieselbe Kategorie steht: seit v3.6.0 wurde der
    // Tagesbonus fuer genau diese fuenf Rohstoffe hier gepflegt, der
    // Kostenrechner-Wert wurde vom Reiter ignoriert. Rohstoffe ohne Altstand
    // behalten den Kostenrechner-Wert. Danach den Reiter-Speicher ohne das
    // alte Feld zurueckschreiben, damit die Migration nur einmal laeuft.
    if (altTagesbonus && typeof altTagesbonus === "object") {
      const migriert = tagesbonusAusAltstand(altTagesbonus);
      Object.keys(migriert).forEach((cc) => UI.tagesbonusSetzen(cc, migriert[cc], "veredeln"));
      speichern();
    }

    const STATION_LABEL = { Saegewerk: "Sägewerk" };

    /** Stationssatz je Gebaeude der angehakten Rohstoffe, dieselbe Einstellung wie im Kostenrechner. */
    function stationenAufbauen() {
      const stationen = stationenFuer(auswahl.rohstoffe);
      const titel = "<div class='t'>Stationssatz je 100 Nahrung (dieselben Werte wie im Kostenrechner)</div>";
      if (!stationen.length) {
        stationenEl.innerHTML = titel + "<div class='hint'>Erst einen Rohstoff anhaken.</div>";
        return;
      }
      const saetze = UI.einstellungenLesen().stationssaetze || {};
      stationenEl.innerHTML =
        titel +
        stationen
          .map(
            (g) =>
              `<label>${STATION_LABEL[g] || g}<input type="number" class="vd-satz" min="0" step="10" data-vd-station="${g}" value="${saetze[g] != null ? saetze[g] : ""}" placeholder="nicht gepflegt" aria-label="Stationssatz ${STATION_LABEL[g] || g}"></label>`
          )
          .join("");
    }

    function preiseResetAktualisieren() {
      const n = anzahlUeberschreibungen(auswahl.preisUeberschreibungen);
      preiseResetEl.hidden = n === 0;
      preiseResetEl.textContent = "Eigene Preise zurücksetzen (" + n + ")";
    }

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
      zusatzbonusEl.value = auswahl.zusatzbonusProzent;
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
          zusatzbonusProzent: zusatzbonusEl.value,
        })
      );
      speichern();
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

    wurzel.addEventListener("change", (ev) => {
      // v3.9.0: eigener Einkaufspreis je Zutat. Leer oder <= 0 setzt zurueck.
      const preisEl = ev.target.closest("input[data-vd-markt]");
      if (preisEl) {
        eigenenPreisSetzen(preisEl.dataset.vdStadt, preisEl.dataset.vdMarkt, preisEl.value.trim());
        return;
      }
      // v3.9.0: Stationssatz, geteilt mit dem Kostenrechner. Leer oder
      // ungueltig aendert nichts (0 ist erlaubt: eigene, gebuehrenfreie Station).
      const satzEl = ev.target.closest("input[data-vd-station]");
      if (satzEl) {
        const roh = satzEl.value.trim();
        const zahl = Number(roh);
        if (roh !== "" && isFinite(zahl) && zahl >= 0) {
          UI.stationssatzSetzen(satzEl.dataset.vdStation, zahl, "veredeln");
          rechnen();
        }
        stationenAufbauen();
        return;
      }
      const box = ev.target.closest("input[data-gruppe]");
      if (box) {
        const g = GRUPPEN[box.dataset.gruppe];
        const an = Array.from(g.el.querySelectorAll("input:checked")).map((x) => g.parse(x.value));
        auswahl[box.dataset.gruppe] = g.werte.filter((w) => an.indexOf(w) !== -1);
        speichern();
        checkboxGruppe(g.el, g.titel, g.werte, g.label, auswahl[box.dataset.gruppe], box.dataset.gruppe, g.tooltip);
        if (box.dataset.gruppe === "rohstoffe") stationenAufbauen();
        return;
      }
      // v3.9.1: Tagesbonus je Rohstoff, gilt in allen Staedten, geteilt mit dem Kostenrechner.
      const tagSel = ev.target.closest("select[data-tag-cc]");
      if (tagSel) {
        UI.tagesbonusSetzen(tagSel.dataset.tagCc, tagSel.value, "veredeln");
        rechnen();
        return;
      }
      felderLesen();
      // Toleranz, Menge und Verluste-Schalter brauchen nur eine neue
      // Bewertung; Einkauf, Verkauf, Fokus und Zusatzbonus rechnen mit den
      // schon abgerufenen Preisen neu (beide Preisseiten liegen vor).
      if ([toleranzEl, mengeEl, verlusteEl].indexOf(ev.target) !== -1) neuBewerten();
      else if ([kaufwegEl, verkaufswegEl, fokusEl, zusatzbonusEl].indexOf(ev.target) !== -1) rechnen();
    });
    wurzel.addEventListener("click", (ev) => {
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
        return;
      }
      const knopf = ev.target.closest("button[data-alle]");
      if (!knopf) return;
      const k = knopf.dataset.alle;
      const g = GRUPPEN[k];
      auswahl[k] = auswahl[k].length === g.werte.length ? [] : g.werte.slice();
      speichern();
      checkboxGruppe(g.el, g.titel, g.werte, g.label, auswahl[k], k, g.tooltip);
      if (k === "rohstoffe") stationenAufbauen();
    });
    // Tagesbonus im Kostenrechner geaendert: Zeile nachziehen, neu rechnen.
    document.addEventListener(UI.TAGESBONUS_EVENT, (ev) => {
      if (ev.detail && ev.detail.quelle === "veredeln") return;
      tagesbonusAufbauen();
      rechnen();
    });
    // Stationssatz im Kostenrechner geaendert: Felder nachziehen, neu rechnen.
    document.addEventListener(UI.STATIONSSAETZE_EVENT, (ev) => {
      if (ev.detail && ev.detail.quelle === "veredeln") return;
      stationenAufbauen();
      rechnen();
    });

    function alterText(min) {
      if (min == null || !isFinite(min)) return "";
      return min < 90 ? Math.round(min) + " Min." : min < 2880 ? Math.round(min / 60) + " Std." : Math.round(min / 1440) + " Tage";
    }

    function zutatAlter(marktId, kontext) {
      const e = kontext.preiseRoh && kontext.preiseRoh[marktId];
      const seite = e ? (kontext.kaufweg === "order" ? e.buy : e.sell) : null;
      if (!seite || !seite.datum) return null;
      const t = REGELN.parseApiDatumUtc(seite.datum);
      return isFinite(t) ? (Date.now() - t) / 60000 : null;
    }

    function marktBasisPreis(marktId, preiseRoh, kaufweg) {
      const e = preiseRoh && preiseRoh[marktId];
      const seite = e ? (kaufweg === "order" ? e.buy : e.sell) : null;
      return seite && !seite.kein && seite.preis > 0 ? seite.preis : null;
    }

    // v3.9.0: Einkaufspreis als Eingabefeld (ohne Einstellgebuehr, so wie im
    // Marktfenster), darunter der Hoechstpreis fuer Gewinn 0.
    function rezeptText(z, kontext) {
      const order = kontext.kaufweg === "order";
      return z.zutatenPreise
        .map((x) => {
          const name = nameVon(x.n, x.stufe);
          const alter = alterText(zutatAlter(x.marktId, { preiseRoh: z.preiseRoh, kaufweg: kontext.kaufweg }));
          const markt = marktBasisPreis(x.marktId, z.preiseRoh, kontext.kaufweg);
          const herkunft = x.uebersteuert
            ? "Eigener Preis für " + z.stadt + (markt != null ? ", Markt: " + fmt(markt) + (alter ? " (" + alter + " alt)" : "") : ", kein Marktpreis")
            : (order ? "Höchste Kauforder" : "Günstigste Verkaufsorder") + (alter ? ", " + alter + " alt" : "");
          const titel =
            herkunft + ". " +
            (order ? "Eingabe ist der Orderpreis; gerechnet wird mit 2,5 % Einstellgebühr obendrauf (" + fmt(x.preis) + "). " : "") +
            "Ein eigener Preis gilt für diese Zutat in " + z.stadt + " in allen Zeilen und bleibt gespeichert, auch über „Preise aktualisieren“. Leer setzt zurück.";
          const wert = Math.round(x.basisPreis * 100) / 100;
          const feld =
            "<input type='number' class='vd-preis" + (x.uebersteuert ? " vd-eigen" : "") + "' min='1' step='1' value='" + wert + "'" +
            " data-vd-stadt='" + esc(z.stadt) + "' data-vd-markt='" + esc(x.marktId) + "'" +
            " aria-label='Einkaufspreis " + esc(name) + " in " + esc(z.stadt) + "' title='" + esc(titel) + "'>";
          const reset = x.uebersteuert
            ? "<button type='button' class='vd-reset' data-vd-stadt='" + esc(z.stadt) + "' data-vd-reset='" + esc(x.marktId) + "' title='Eigenen Preis entfernen, zurück zum Marktpreis' aria-label='Eigenen Preis für " + esc(name) + " entfernen'>✕</button>"
            : "";
          let max = "";
          if (x.hoechstpreis != null) {
            const titelMax =
              "Höchstpreis: bis zu diesem " + (order ? "Orderpreis" : "Einkaufspreis") + " bleibt der Gewinn dieser Zeile bei 0 oder darüber, alle anderen Preise fest. " +
              "Mit Rückgewinnung " + prozent(z.rrr) + ", Stationsgebühr" + (order ? " und 2,5 % Einstellgebühr" : "") + "." +
              (z.gewinn < 0 ? " Der Gewinn ist schon beim aktuellen Preis negativ." : "");
            max =
              x.hoechstpreis <= 0
                ? "<span class='vd-max vd-verlust' title='" + esc(titelMax) + "'>kein Preis reicht</span>"
                : "<span class='vd-max" + (z.gewinn < 0 ? " vd-verlust" : "") + "' title='" + esc(titelMax) + "'>max. " + fmt(Math.floor(x.hoechstpreis)) + "</span>";
          }
          return (
            "<div class='vd-zutat'><span>" + (Math.round(x.menge * 100) / 100) + "× " + name + " à</span> " +
            "<span class='vd-preisfeld'>" + feld + reset + "</span>" + max + "</div>"
          );
        })
        .join("");
    }

    function render(zeilen, gesamt, kontext) {
      if (!zeilen.length) {
        ausgabeEl.innerHTML =
          "<div class='ch-hinweis'>Von " + gesamt + " geprüften Vorgängen bringt keiner Gewinn oder liegt innerhalb der Toleranz. Toleranz erhöhen, „Verluste zeigen“ anhaken oder andere Städte wählen.</div>";
        return;
      }
      const kopf =
        "<tr><th>Stadt</th><th>Produkt</th><th title='Einsatz vor Rückgewinnung mit dem Einkaufspreis je Stück in dieser Stadt (ohne Einstellgebühr). Der Preis ist überschreibbar, die Zeile rechnet sofort neu. max. = Höchstpreis, bei dem der Gewinn auf 0 fällt.'>Einsatz je Vorgang, Einkaufspreis</th><th class='num' title='Rückgewinnungsquote laut Stadtbonus, Fokus und Tagesbonus'>Rückgew.</th>" +
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
            "<td class='ch-klein'>" + rezeptText(z, kontext) + "</td>" +
            "<td class='num'>" + prozent(z.rrr) + fokus + "</td>" +
            "<td class='num'>" + fmt(z.silber) + "</td>" +
            "<td class='num'>" + fmt(z.erloes) +
            "<br><span class='ch-klein' title='" + (kontext.verkaufsweg === "order" ? "günstigste Verkaufsorder" : "höchste Kauforder") +
            (z.produktAlterMin != null ? ", " + alterText(z.produktAlterMin) + " alt" : "") + "'>Preis " + fmt(z.produktPreis) + "</span></td>" +
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
        (kontext.zusatzbonusProzent ? ", Zusatzbonus +" + kontext.zusatzbonusProzent + " Prozentpunkte" : "") +
        ". Rohstoff und Vorstufe werden gekauft." +
        (kontext.eigenePreise ? " " + kontext.eigenePreise + " eigene Einkaufspreise aktiv (gold umrandet)." : "") +
        (kontext.fehlendeSaetze && kontext.fehlendeSaetze.length ? " Stationssatz fehlt für " + kontext.fehlendeSaetze.join(", ") + ", mit 0 gerechnet." : "") +
        " Höchstalter der Preise aus den Einstellungen des Kostenrechners. Craft-Fame ist nicht eingerechnet." +
        "</div>";
    }

    /** Zeilen aus den Daten der letzten Suche neu rechnen, ohne Abruf. */
    function rechnen() {
      if (!daten || laeuft) return null;
      const einstellungen = UI.einstellungenLesen();
      const zeilen = zeilenRechnen(daten.kand, daten.stadtDaten, auswahl, einstellungen);
      const saetze = einstellungen.stationssaetze || {};
      letzteZeilen = {
        zeilen,
        kontext: {
          kaufweg: auswahl.kaufweg,
          verkaufsweg: auswahl.verkaufsweg,
          premium: einstellungen.premium !== false,
          mitFokus: auswahl.mitFokus,
          zusatzbonusProzent: auswahl.zusatzbonusProzent,
          eigenePreise: anzahlUeberschreibungen(auswahl.preisUeberschreibungen),
          fehlendeSaetze: stationenFuer(Array.from(new Set(daten.kand.map((k) => k.cc)))).filter((g) => saetze[g] == null).map((g) => STATION_LABEL[g] || g),
        },
      };
      neuBewerten();
      return zeilen;
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

    async function suchen(erzwingen) {
      if (laeuft) return;
      felderLesen();
      if (!auswahl.staedte.length || !auswahl.rohstoffe.length || !auswahl.tiers.length || !auswahl.stufen.length) {
        statusEl.textContent = "Mindestens eine Stadt, einen Rohstoff, ein Tier und eine Verzauberung anhaken.";
        return;
      }
      laeuft = true;
      startEl.disabled = true;
      el("vdRefresh").disabled = true;
      ausgabeEl.innerHTML = "";
      try {
        const kand = kandidaten(auswahl);
        const ids = benoetigteMarktIds(kand);
        const produktIds = Array.from(new Set(kand.map((k) => k.marktId)));
        const stadtDaten = [];
        for (let i = 0; i < auswahl.staedte.length; i++) {
          const stadt = auswahl.staedte[i];
          const vorsatz = stadt + " (" + (i + 1) + "/" + auswahl.staedte.length + "): ";
          const preiseRoh = await PREISE.preiseAbrufen(ids, {
            stadt,
            erzwingen: !!erzwingen,
            qualitaet: 1,
            aufFortschritt: (f, g) => {
              statusEl.textContent = vorsatz + "Preise " + f + "/" + g + " ...";
            },
          });
          statusEl.textContent = vorsatz + "Handelsvolumen ...";
          const absatz = await PREISE.absatzAbrufen(produktIds, { stadt, tageFenster: TAGE_FENSTER });
          stadtDaten.push({ stadt, preiseRoh, absatz });
        }
        daten = { kand, stadtDaten };
        laeuft = false;
        const zeilen = rechnen();
        const mitErgebnis = zeilen.filter((z) => z.gewinn != null).length;
        const gewinne = zeilen.filter((z) => z.einstufung === "gewinn").length;
        const stand = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        statusEl.textContent =
          "Fertig: " + gewinne + " mit Gewinn, " + zeilen.filter((z) => z.einstufung === "null").length + " etwa Null. " +
          (zeilen.length - mitErgebnis) + " von " + zeilen.length + " Vorgängen ohne vollständige Preise. " +
          (erzwingen ? "Preise neu abgerufen um " + stand + "." : "Gerechnet um " + stand + ", Preise aus dem Zwischenspeicher, sofern jünger als 30 Min.");
      } catch (e) {
        statusEl.textContent = "Fehler: " + (e && e.message ? e.message : e);
        if (typeof console !== "undefined") console.error(e);
      } finally {
        laeuft = false;
        startEl.disabled = false;
        el("vdRefresh").disabled = false;
      }
    }

    gruppenAufbauen();
    tagesbonusAufbauen();
    stationenAufbauen();
    preiseResetAktualisieren();
    felderSetzen();
    startEl.addEventListener("click", () => suchen(false));
    // "Preise aktualisieren" (Wunsch 08.10.2026): wie in den anderen
    // Reitern den Preis-Cache umgehen und alles neu abrufen.
    el("vdRefresh").addEventListener("click", () => suchen(true));
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
    tagesbonusAusAltstand,
    rezeptIstMarktfaehig,
    kandidaten,
    benoetigteMarktIds,
    craftKandidatAus,
    zeileBauen,
    einstufen,
    filtereUndSortiere,
    stationenFuer,
    ueberschreibungenBereinigen,
    preiseMitUeberschreibungen,
    hoechstpreis,
    zeilenRechnen,
    selbsttest,
  };
})();
