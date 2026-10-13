// js/veredeln.js
//
// Reiter "Veredeln leveln" (08.10.2026): findet Stellen, an denen sich
// Veredeln zum Leveln lohnt. Rohstoff (Faser, Holz, Erz, Stein, Fell) und die
// Vorstufe kaufen, veredeln, das Produkt verkaufen; gesucht sind Gewinn oder
// etwa Null. Bis v3.9.1 alles in derselben Stadt, seit v3.10.0 Einkauf,
// Fertigung und Verkauf getrennt (s. unten).
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

// v3.10.0 (13.10.2026): Handelsstaedte getrennt. Mehrere Einkaufs- und
// Verkaufsstaedte (Mehrfachauswahl) und genau eine Fertigungsstadt. Die
// Fertigungsstadt bestimmt Stadtbonus, Rueckgewinnung und Stationssatz (der
// Rechenkern rechnet mit opts.stadt = Fertigungsstadt). Je Zutat zaehlt die
// guenstigste angehakte Einkaufsstadt nach Kaufweg (Sofortkauf
// sell_price_min, Kauforder buy_price_max, Hoechstalter beachtet, eigene
// Preise der jeweiligen Stadt eingerechnet), je Produkt die angehakte
// Verkaufsstadt mit dem hoechsten Netto-Erloes. Die Kosten sind je Zutat
// getrennt (Summe Preis x Menge), die guenstigste Stadt je Zutat ergibt
// deshalb auch die guenstigste Kombination. Transportkosten, Gewicht und
// Reiserisiko sind nicht modelliert. Der Hoechstpreis einer Zutat bezieht
// sich auf die gewaehlte Einkaufsstadt bei sonst festen Preisen; steigt der
// Preis dort ueber den einer anderen angehakten Stadt, waere diese guenstiger.
//
// Speicherstand bis v3.9.1 (eine Liste `staedte` fuer alles) wird beim Laden
// auf Einkauf = Verkauf = diese Staedte und Fertigung = Lymhurst (falls
// angehakt, sonst die erste) abgebildet, s. einstellungenBereinigen().

const VEREDELN = (function () {
  "use strict";

  const STAEDTE = ["Lymhurst", "Fort Sterling", "Bridgewatch", "Martlock", "Thetford", "Caerleon", "Brecilien"];

  const ROHSTOFFE = [
    { cc: "fiber", name: "Faser", label: "Faser → Stoff", bonusText: "Faser zu Stoff", icon: "T4_FIBER" },
    { cc: "wood", name: "Holz", label: "Holz → Bretter", bonusText: "Holz zu Brettern", icon: "T4_WOOD" },
    { cc: "ore", name: "Erz", label: "Erz → Barren", bonusText: "Erz zu Barren", icon: "T4_ORE" },
    { cc: "rock", name: "Stein", label: "Stein → Blöcke", bonusText: "Stein zu Blöcken", icon: "T4_ROCK" },
    { cc: "hide", name: "Fell", label: "Fell → Leder", bonusText: "Fell zu Leder", icon: "T4_HIDE" },
  ];

  const TIERS = [2, 3, 4, 5, 6, 7, 8];
  const STUFEN = [0, 1, 2, 3, 4];
  const TAGE_FENSTER = 7;
  const SPEICHER_KEY = "albion_kostenrechner_veredeln_v1";
  // Sortierschluessel der Tabellenkoepfe; Kosten aufsteigend, alle anderen absteigend.
  const SORTIERUNGEN = ["kosten", "stueck", "marge", "gesamt"];

  function standardEinstellungen() {
    return {
      einkaufStaedte: ["Lymhurst"],
      verkaufStaedte: ["Lymhurst"],
      fertigungsstadt: "Lymhurst",
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
      sortierung: "marge",
      preisUeberschreibungen: {}, // Stadt -> Markt-ID -> Silber je Stueck (> 0), s. Modulkommentar
    };
  }

  /** Icon vom offiziellen Albion-Bildserver; doppelte Pixelzahl fuer scharfe Darstellung. */
  function iconUrl(itemId, px) {
    return "https://render.albiononline.com/v1/item/" + encodeURIComponent(itemId) + ".png?size=" + Math.round((px || 32) * 2);
  }

  /** Stadtschilder (Einkaufsstadt je Zutat, Verkaufsstadt je Produkt) nur, wenn mehr als eine Stadt angehakt ist. */
  function schilderZeigen(staedte) {
    return Array.isArray(staedte) && staedte.length > 1;
  }

  /** Rohstoff, fuer den die Stadt den Veredelungsbonus (+0,40) hat, oder null. */
  function veredelBonusVon(stadt) {
    return ROHSTOFFE.find((r) => REGELN.hatVeredelBonus(r.cc, stadt)) || null;
  }

  /** Rueckgewinnung je angehaktem Rohstoff in der Fertigungsstadt, mit Fokus, Tagesbonus und Zusatzbonus. */
  function rueckgewinnungJeRohstoff(auswahl, einstellungen) {
    const tb = (einstellungen && einstellungen.tagesbonus) || {};
    return ROHSTOFFE.filter((r) => (auswahl.rohstoffe || []).indexOf(r.cc) !== -1).map((r) => ({
      cc: r.cc,
      name: r.name,
      rrr: REGELN.rrr({
        cc: r.cc,
        stadt: auswahl.fertigungsstadt,
        mitFokus: !!auswahl.mitFokus,
        tagesbonus: tb[r.cc] || null,
        zusatzbonus: (auswahl.zusatzbonusProzent || 0) / 100,
        craftingfocus: 1, // alle Veredelungsrezepte haben craftingfocus > 0
      }),
    }));
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

  /**
   * Gespeicherten Stand gegen die erlaubten Werte pruefen; Unbekanntes faellt
   * weg, Fehlendes kommt aus dem Standard. Migration bis v3.9.1: die alte
   * Liste `staedte` (Einkauf, Fertigung und Verkauf in derselben Stadt) wird
   * zu Einkauf = Verkauf = diesen Staedten; Fertigung ist Lymhurst, falls
   * angehakt, sonst die erste. Neue Felder haben Vorrang vor dem Altstand.
   */
  function einstellungenBereinigen(roh) {
    const basis = standardEinstellungen();
    if (!roh || typeof roh !== "object") return basis;
    const liste = (wert, erlaubt) => (Array.isArray(wert) ? erlaubt.filter((x) => wert.indexOf(x) !== -1) : null);
    const alt = liste(roh.staedte, STAEDTE);
    const altGefuellt = alt && alt.length ? alt : null;
    const einkauf = liste(roh.einkaufStaedte, STAEDTE) || (altGefuellt && altGefuellt.slice());
    const verkauf = liste(roh.verkaufStaedte, STAEDTE) || (altGefuellt && altGefuellt.slice());
    let fertigung = STAEDTE.indexOf(roh.fertigungsstadt) !== -1 ? roh.fertigungsstadt : null;
    if (!fertigung && altGefuellt) fertigung = altGefuellt.indexOf("Lymhurst") !== -1 ? "Lymhurst" : altGefuellt[0];
    const rohstoffe = liste(roh.rohstoffe, ROHSTOFFE.map((r) => r.cc));
    const tiers = liste(roh.tiers, TIERS);
    const stufen = liste(roh.stufen, STUFEN);
    return {
      einkaufStaedte: einkauf || basis.einkaufStaedte,
      verkaufStaedte: verkauf || basis.verkaufStaedte,
      fertigungsstadt: fertigung || basis.fertigungsstadt,
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
      sortierung: SORTIERUNGEN.indexOf(roh.sortierung) !== -1 ? roh.sortierung : basis.sortierung,
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
    // v3.10.0: Herkunft je Zutat (Einkaufsstadt, Rohpreis der Stadt, eigener Preis), s. zeilenRechnen().
    const herkunft = opts.herkunft || null;
    z.kaufFaktor = kaufFaktor;
    z.zutatenPreise = (craft.weg.zutaten || []).map((zt) => {
      const marktId = zt.weg && zt.weg.marktId ? zt.weg.marktId : null;
      const h = herkunft && marktId ? herkunft[marktId] : null;
      return {
        stadt: h ? h.stadt : stadt,
        roh: h ? h.roh : null,
        n: zt.item,
        stufe: zt.stufe,
        menge: zt.menge * kandidat.menge,
        preis: zt.silberJeStueck,
        basisPreis: zt.silberJeStueck / kaufFaktor,
        effektiveMenge: zt.effektiveMenge,
        marktId,
        uebersteuert: h ? !!h.eigen : !!(marktId && ueber[marktId] != null),
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

  /** Sortieren nach Tabellenkopf: Kosten/Stueck aufsteigend, Gewinn/Stueck, Marge, Gewinn gesamt absteigend. */
  function sortiere(zeilen, schluessel) {
    const wert = {
      kosten: (z) => z.silber,
      stueck: (z) => z.gewinn,
      marge: (z) => z.marge,
      gesamt: (z) => z.gewinnGesamt,
    }[SORTIERUNGEN.indexOf(schluessel) !== -1 ? schluessel : "marge"];
    const auf = schluessel === "kosten";
    return zeilen.slice().sort((a, b) => (auf ? wert(a) - wert(b) : wert(b) - wert(a)));
  }

  /** Nur Zeilen mit Ergebnis; ohne verlusteZeigen nur Gewinn und etwa Null. Sortiert nach opts.sortierung (Vorgabe Marge absteigend). */
  function filtereUndSortiere(zeilen, opts) {
    opts = opts || {};
    return sortiere(
      zeilen.filter((z) => z.gewinn != null && z.marge != null).filter((z) => opts.verlusteZeigen || z.einstufung !== "verlust"),
      opts.sortierung || "marge"
    );
  }

  /** Einkaufspreis ohne Einstellgebuehr einer Marktseite, oder null (kein Preis, <= 0, zu alt; wie im Rechenkern). */
  function einkaufsBasisPreis(seite, maxPreisAlterMin, jetzt) {
    if (!seite || seite.kein || seite.preis == null || !(seite.preis > 0)) return null;
    if (maxPreisAlterMin != null && seite.datum) {
      const t = REGELN.parseApiDatumUtc(seite.datum);
      if (isFinite(t) && ((jetzt == null ? Date.now() : jetzt) - t) / 60000 > maxPreisAlterMin) return null;
    }
    return seite.preis;
  }

  /**
   * Guenstigste Einkaufsstadt einer Zutat. einkaufDaten: [{stadt, preise
   * (opts-Format, eigene Preise der Stadt schon eingesetzt), preiseRoh}] in
   * Reihenfolge der Staedte; bei Gleichstand gewinnt die erste. Ohne gueltigen
   * Preis in irgendeiner Stadt kommt die erste Stadt mit basis null zurueck,
   * damit der Rechenkern den Grund (kein Preis, zu alt) liefert.
   */
  function einkaufWaehlen(marktId, einkaufDaten, kaufweg, maxPreisAlterMin, jetzt) {
    let best = null;
    (einkaufDaten || []).forEach((d) => {
      const e = d.preise && d.preise[marktId];
      const basis = einkaufsBasisPreis(e ? (kaufweg === "order" ? e.buy : e.sell) : null, maxPreisAlterMin, jetzt);
      if (basis != null && (!best || basis < best.basis)) best = { stadt: d.stadt, eintrag: e, basis };
    });
    if (!best) {
      const erste = (einkaufDaten || [])[0];
      if (!erste) return null;
      best = { stadt: erste.stadt, eintrag: (erste.preise && erste.preise[marktId]) || null, basis: null };
    }
    const quelle = einkaufDaten.find((x) => x.stadt === best.stadt);
    best.roh = quelle && quelle.preiseRoh ? quelle.preiseRoh[marktId] || null : null;
    return best;
  }

  /**
   * Verkaufsstadt mit dem hoechsten Netto-Erloes (REGELN.erloesJeStueck je
   * Stadt). eintraege: [{stadt, eintrag}]. Ohne verwertbaren Preis kommt die
   * erste Stadt mit ihrem Grund zurueck; ohne Stadt null.
   */
  function verkaufWaehlen(eintraege, opts) {
    let best = null;
    let erstes = null;
    (eintraege || []).forEach(({ stadt, eintrag }) => {
      const erloes = REGELN.erloesJeStueck(eintrag, opts);
      if (!erstes) erstes = { stadt, erloes };
      if (erloes.netto != null && (!best || erloes.netto > best.erloes.netto)) best = { stadt, erloes };
    });
    return best || erstes;
  }

  /**
   * Alle Zeilen aus bereits abgerufenen Daten, ohne Netz. Wird nach jeder
   * Suche und bei jeder Aenderung von eigenem Preis, Stationssatz,
   * Rechenoption oder Staedtewahl (soweit Daten vorliegen) erneut aufgerufen.
   * Eine Zeile je Vorgang: gefertigt in auswahl.fertigungsstadt, jede Zutat
   * aus ihrer guenstigsten Einkaufsstadt, verkauft in der besten Verkaufsstadt.
   *
   * @param kand Kandidatenliste (kandidaten())
   * @param stadtDaten [{stadt, preiseRoh, absatz}] wie von PREISE geliefert;
   *   eine Stadt zaehlt als Einkaufs- bzw. Verkaufsquelle, wenn sie in
   *   auswahl.einkaufStaedte bzw. auswahl.verkaufStaedte steht
   * @param auswahl Reiter-Einstellungen (einstellungenBereinigen())
   * @param einstellungen Kostenrechner-Einstellungen (UI.einstellungenLesen())
   */
  function zeilenRechnen(kand, stadtDaten, auswahl, einstellungen, jetzt) {
    const maxPreisAlterMin =
      einstellungen.maxPreisAlterMin === "" || einstellungen.maxPreisAlterMin == null ? null : Number(einstellungen.maxPreisAlterMin);
    const zeit = jetzt == null ? Date.now() : jetzt;
    const fceUeb = typeof UI !== "undefined" && UI.fceUeberschreibungenAus ? UI.fceUeberschreibungenAus(einstellungen) : {};
    const fertigung = auswahl.fertigungsstadt || "Lymhurst";
    const ueberAlle = auswahl.preisUeberschreibungen || {};
    const datenVon = (stadt) => (stadtDaten || []).find((d) => d.stadt === stadt && d.preiseRoh);
    const einkaufDaten = (auswahl.einkaufStaedte || []).map(datenVon).filter(Boolean).map((d) => ({
      stadt: d.stadt,
      preiseRoh: d.preiseRoh,
      preise: preiseMitUeberschreibungen(REGELN.preiseZuOptsFormat(d.preiseRoh), ueberAlle[d.stadt] || {}),
    }));
    const verkaufDaten = (auswahl.verkaufStaedte || []).map(datenVon).filter(Boolean);
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
      tagesbonus: einstellungen.tagesbonus || {}, // v3.9.1: gilt in allen Staedten gleich
      zusatzProduktionsbonus: (auswahl.zusatzbonusProzent || 0) / 100,
      maxPreisAlterMin,
      nurDirekteEbene: true,
    };
    const erloesOpts = { verkaufsweg: auswahl.verkaufsweg, premium: einstellungen.premium, maxPreisAlterMin, jetzt: zeit };
    const wahl = {};
    const einkaufVon = (id) => {
      if (!(id in wahl)) {
        const w = einkaufWaehlen(id, einkaufDaten, auswahl.kaufweg, maxPreisAlterMin, zeit);
        if (w) w.eigen = !!(ueberAlle[w.stadt] && ueberAlle[w.stadt][id] != null);
        wahl[id] = w;
      }
      return wahl[id];
    };
    return kand.map((k) => {
      const preise = {};
      const herkunft = {};
      k.zutaten.forEach((zt) => {
        const id = marktIdVon(zt.n, zt.stufe);
        const w = einkaufVon(id);
        if (!w) return;
        herkunft[id] = w;
        if (w.eintrag) preise[id] = w.eintrag;
      });
      const craft = craftKandidatAus(
        RECHENKERN.kosten(k.item, k.stufe, 1, Object.assign({}, optsBasis, { preise })),
        k.rezeptIndex,
        auswahl.mitFokus
      );
      const vk =
        verkaufWaehlen(verkaufDaten.map((d) => ({ stadt: d.stadt, eintrag: d.preiseRoh[k.marktId] })), erloesOpts) ||
        { stadt: null, erloes: { netto: null, grund: "keine Verkaufsstadt angehakt" } };
      const vkDaten = verkaufDaten.find((d) => d.stadt === vk.stadt) || {};
      const zeile = zeileBauen(k, fertigung, craft, vk.erloes, ((vkDaten.absatz || {})[k.marktId] || {})[1], Object.assign({}, auswahl, { herkunft }));
      zeile.vkStadt = vk.stadt;
      return zeile;
    });
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
        const e = einstellungenBereinigen({ einkaufStaedte: ["Lymhurst", "Atlantis"], tiers: [4, 9], kaufweg: "quatsch", toleranzProzent: -3, sortierung: "quatsch" });
        return e.einkaufStaedte.join() === "Lymhurst" && e.sortierung === "marge" && e.tiers.join() === "4" && e.kaufweg === "sofort" && e.toleranzProzent === 0 && e.rohstoffe.length === 5;
      })(),
      JSON.stringify(einstellungenBereinigen({ einkaufStaedte: ["Lymhurst", "Atlantis"], tiers: [4, 9] }))
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
    // v3.10.0: eine Zeile je Vorgang, die Stadt ist die Fertigungsstadt.
    const tagAus = { kaufweg: "sofort", verkaufsweg: "sofort" };
    const rechneIn = (aus, e) => ["Lymhurst", "Martlock", "Caerleon"].map((f) => rechne(Object.assign({}, aus, { fertigungsstadt: f }), null, e)[0]);
    const tagZ = rechneIn(tagAus, Object.assign({}, einst, { tagesbonus: { fiber: "gold" } }));
    const rrrVon = (zs, stadt) => (zs.find((z) => z.stadt === stadt) || {}).rrr;
    pruefe(
      "Tagesbonus Faser 20 % wirkt in jeder Stadt: Lymhurst B = 0,18 + 0,40 + 0,20, Martlock und Caerleon B = 0,18 + 0,20",
      Math.abs(rrrVon(tagZ, "Lymhurst") - 0.78 / 1.78) < 1e-9 && Math.abs(rrrVon(tagZ, "Martlock") - 0.38 / 1.38) < 1e-9 &&
        Math.abs(rrrVon(tagZ, "Caerleon") - 0.38 / 1.38) < 1e-9,
      ["Lymhurst", "Martlock", "Caerleon"].map((s) => s + ":" + rrrVon(tagZ, s)).join(", ")
    );
    const tagSilberAndere = rechneIn(tagAus, Object.assign({}, einst, { tagesbonus: { fiber: "silber", wood: "gold", ore: "gold" } }));
    pruefe(
      "Tagesbonus: mehrere Rohstoffe gleichzeitig, Faser 10 % gibt Martlock B = 0,28; Holz/Erz-Bonus beruehrt Faser nicht",
      Math.abs(rrrVon(tagSilberAndere, "Martlock") - 0.28 / 1.28) < 1e-9 && Math.abs(rrrVon(tagSilberAndere, "Lymhurst") - 0.68 / 1.68) < 1e-9,
      rrrVon(tagSilberAndere, "Martlock") + " / " + rrrVon(tagSilberAndere, "Lymhurst")
    );
    const tagAlt = rechneIn(Object.assign({}, tagAus, { tagesbonus: { Martlock: { fiber: "gold" } } }), einst);
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
      { einkaufStaedte: ["Lymhurst", "Martlock"], kaufweg: "sofort", verkaufsweg: "sofort", preisUeberschreibungen: { Lymhurst: { T4_FIBER: 150 } } },
      [{ stadt: "Lymhurst", preiseRoh, absatz: {} }, { stadt: "Martlock", preiseRoh, absatz: {} }]
    )[0];
    pruefe(
      "Eigener Preis gilt nur in seiner Stadt: Lymhurst 150 eigen, Martlock Markt 100, gekauft wird in Martlock zu 100",
      zweiStaedte.zutatenPreise[0].preis === 100 && zweiStaedte.zutatenPreise[0].stadt === "Martlock" && !zweiStaedte.zutatenPreise[0].uebersteuert,
      JSON.stringify(zweiStaedte.zutatenPreise.map((x) => x.stadt + ":" + x.preis))
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

    // ---- v3.10.0: Einkaufs-, Verkaufs- und Fertigungsstadt getrennt ----
    const mehr = (lym, mar, bri) => [
      { stadt: "Lymhurst", preiseRoh: lym, absatz: {} },
      { stadt: "Martlock", preiseRoh: mar, absatz: { T4_CLOTH: { 1: { stueckJeTag: 42 } } } },
      { stadt: "Bridgewatch", preiseRoh: bri, absatz: {} },
    ];
    const dreiDaten = mehr(
      { T4_FIBER: roh(100, 90), T3_CLOTH: roh(200, 180), T4_CLOTH: roh(320, 300) },
      { T4_FIBER: roh(80, 95), T3_CLOTH: roh(250, 170), T4_CLOTH: roh(330, 350) },
      { T4_FIBER: roh(90, 70), T3_CLOTH: roh(190, 175), T4_CLOTH: roh(310, null) }
    );
    const alleDrei = ["Lymhurst", "Martlock", "Bridgewatch"];
    const besteEk = rechne({ einkaufStaedte: alleDrei, verkaufStaedte: ["Lymhurst"], kaufweg: "sofort", verkaufsweg: "sofort" }, dreiDaten)[0];
    pruefe(
      "Einkauf: je Zutat die guenstigste angehakte Stadt (Faser Martlock 80, Vorstufe Bridgewatch 190), Kosten = (2 x 80 + 190) / 1,58 + Gebuehr",
      besteEk.zutatenPreise[0].stadt === "Martlock" && besteEk.zutatenPreise[0].preis === 80 &&
        besteEk.zutatenPreise[1].stadt === "Bridgewatch" && besteEk.zutatenPreise[1].preis === 190 &&
        Math.abs(besteEk.silber - ((2 * 80 + 190) / 1.58 + gebuehr)) < 1e-9,
      JSON.stringify(besteEk.zutatenPreise.map((x) => x.stadt + ":" + x.preis)) + " / " + besteEk.silber
    );
    const besteEkOrder = rechne({ einkaufStaedte: alleDrei, verkaufStaedte: ["Lymhurst"], kaufweg: "order", verkaufsweg: "sofort" }, dreiDaten)[0];
    pruefe(
      "Einkauf per Kauforder: Vergleich auf der Kauforder-Seite (Faser Bridgewatch 70, Vorstufe Martlock 170), plus 2,5 %",
      besteEkOrder.zutatenPreise[0].stadt === "Bridgewatch" && besteEkOrder.zutatenPreise[1].stadt === "Martlock" &&
        Math.abs(besteEkOrder.zutatenPreise[0].preis - 70 * 1.025) < 1e-9,
      JSON.stringify(besteEkOrder.zutatenPreise.map((x) => x.stadt + ":" + x.preis))
    );
    // Der Rechenkern prueft das Alter gegen Date.now(), deshalb relative Zeitstempel.
    const jetztT = Date.now();
    const vorMin = (m) => new Date(jetztT - m * 60000).toISOString().slice(0, 19);
    const mitDatum = (p, datum) => ({ sell: { preis: p, kein: false, datum }, buy: { kein: true } });
    const altDaten = mehr(
      { T4_FIBER: mitDatum(100, vorMin(30)), T3_CLOTH: mitDatum(200, vorMin(30)), T4_CLOTH: roh(320, 300) },
      { T4_FIBER: mitDatum(50, vorMin(120)), T3_CLOTH: mitDatum(250, vorMin(30)), T4_CLOTH: roh(330, 350) },
      {}
    );
    const altZ = zeilenRechnen(
      k4,
      altDaten,
      einstellungenBereinigen({ einkaufStaedte: ["Lymhurst", "Martlock"], kaufweg: "sofort", verkaufsweg: "sofort" }),
      Object.assign({}, einst, { maxPreisAlterMin: 60 }),
      jetztT
    )[0];
    pruefe(
      "Einkauf: ein zu alter Preis zaehlt nicht, Faser Martlock 50 ist 120 Min. alt, gekauft wird in Lymhurst zu 100",
      altZ.zutatenPreise[0].stadt === "Lymhurst" && altZ.zutatenPreise[0].preis === 100,
      JSON.stringify(altZ.zutatenPreise.map((x) => x.stadt + ":" + x.preis))
    );
    const besteVk = rechne({ einkaufStaedte: ["Lymhurst"], verkaufStaedte: alleDrei, kaufweg: "sofort", verkaufsweg: "sofort" }, dreiDaten)[0];
    pruefe(
      "Verkauf: die Stadt mit dem hoechsten Netto-Erloes (Sofortverkauf Martlock 350 x 0,96 = 336), Bridgewatch ohne Kauforder zaehlt nicht",
      besteVk.vkStadt === "Martlock" && Math.abs(besteVk.erloes - 336) < 1e-9 && besteVk.produktPreis === 350,
      besteVk.vkStadt + " / " + besteVk.erloes
    );
    pruefe(
      "Verkauf: verkauft/Tag kommt aus der gewaehlten Verkaufsstadt (Martlock 42)",
      besteVk.stueckJeTag === 42 && rechne({ verkaufStaedte: ["Lymhurst"] }, dreiDaten)[0].stueckJeTag === null,
      besteVk.stueckJeTag
    );
    const besteVkOrder = rechne({ einkaufStaedte: ["Lymhurst"], verkaufStaedte: alleDrei, kaufweg: "sofort", verkaufsweg: "order" }, dreiDaten)[0];
    pruefe(
      "Verkauf per Verkaufsorder: Vergleich auf der Verkaufsorder-Seite (Martlock 330)",
      besteVkOrder.vkStadt === "Martlock" && besteVkOrder.produktPreis === 330,
      besteVkOrder.vkStadt + " / " + besteVkOrder.produktPreis
    );
    const ohneVk = rechne({ verkaufStaedte: [] }, dreiDaten)[0];
    pruefe("Verkauf: ohne angehakte Verkaufsstadt kein Gewinn", ohneVk.gewinn === null && ohneVk.vkStadt === null, ohneVk.grund);
    const fLym = rechne({ einkaufStaedte: ["Martlock"], verkaufStaedte: ["Martlock"], fertigungsstadt: "Lymhurst" }, dreiDaten)[0];
    const fMar = rechne({ einkaufStaedte: ["Martlock"], verkaufStaedte: ["Martlock"], fertigungsstadt: "Martlock" }, dreiDaten)[0];
    pruefe(
      "Fertigungsstadt bestimmt den Bonus: Faser in Lymhurst B = 0,58 (36,7 %), in Martlock B = 0,18, auch bei Einkauf und Verkauf in Martlock",
      Math.abs(fLym.rrr - 0.58 / 1.58) < 1e-9 && Math.abs(fMar.rrr - 0.18 / 1.18) < 1e-9 && fLym.stadt === "Lymhurst" && fLym.stadtbonus && !fMar.stadtbonus,
      fLym.rrr + " / " + fMar.rrr
    );
    const eigenWahl = rechne(
      { einkaufStaedte: ["Lymhurst", "Martlock"], preisUeberschreibungen: { Lymhurst: { T4_FIBER: 70 } } },
      dreiDaten
    )[0];
    pruefe(
      "Eigener Preis fliesst in die Stadtwahl ein: Lymhurst eigen 70 schlaegt Martlock 80, Zutat als eigen markiert",
      eigenWahl.zutatenPreise[0].stadt === "Lymhurst" && eigenWahl.zutatenPreise[0].preis === 70 && eigenWahl.zutatenPreise[0].uebersteuert,
      JSON.stringify(eigenWahl.zutatenPreise[0])
    );
    // Andere Staedte teuer, damit Bridgewatch auch beim Hoechstpreis die guenstigste bleibt.
    const hpDaten = mehr(
      { T4_FIBER: roh(100, 90), T3_CLOTH: roh(1000, 900), T4_CLOTH: roh(320, 300) },
      { T4_FIBER: roh(80, 95), T3_CLOTH: roh(1000, 900), T4_CLOTH: roh(330, 350) },
      { T4_FIBER: roh(90, 70), T3_CLOTH: roh(190, 175), T4_CLOTH: roh(310, null) }
    );
    const hpAus = { einkaufStaedte: alleDrei, verkaufStaedte: ["Lymhurst"], kaufweg: "sofort", verkaufsweg: "sofort" };
    const hp = rechne(hpAus, hpDaten)[0].zutatenPreise[1];
    const hpUeb = {};
    hpUeb[hp.stadt] = { T3_CLOTH: hp.hoechstpreis };
    const hpZ2 = rechne(Object.assign({}, hpAus, { preisUeberschreibungen: hpUeb }), hpDaten)[0];
    pruefe(
      "Hoechstpreis bezieht sich auf die gewaehlte Einkaufsstadt (Vorstufe Bridgewatch): dort eingesetzt ergibt Gewinn 0",
      hp.stadt === "Bridgewatch" && hpZ2.zutatenPreise[1].stadt === "Bridgewatch" && Math.abs(hpZ2.gewinn) < 1e-6,
      hp.hoechstpreis + " / " + hpZ2.gewinn
    );
    // Gegenprobe der dokumentierten Grenze: liegt der Hoechstpreis ueber dem
    // Preis einer anderen angehakten Stadt, wird dort gekauft und es bleibt Gewinn.
    const hpWeit = rechne(hpAus, dreiDaten)[0].zutatenPreise[1];
    const weitUeb = {};
    weitUeb[hpWeit.stadt] = { T3_CLOTH: hpWeit.hoechstpreis };
    const weitZ = rechne(Object.assign({}, hpAus, { preisUeberschreibungen: weitUeb }), dreiDaten)[0];
    pruefe(
      "Hoechstpreis ueber dem Preis einer anderen Stadt: die Wahl wechselt (Lymhurst 200), der Gewinn bleibt positiv",
      hpWeit.hoechstpreis > 200 && weitZ.zutatenPreise[1].stadt === "Lymhurst" && weitZ.gewinn > 0,
      hpWeit.hoechstpreis + " / " + weitZ.zutatenPreise[1].stadt + " / " + weitZ.gewinn
    );
    pruefe(
      "Migration: alte Liste staedte wird Einkauf = Verkauf, Fertigung Lymhurst wenn angehakt, sonst die erste",
      (function () {
        const a = einstellungenBereinigen({ staedte: ["Martlock", "Lymhurst"] });
        const b = einstellungenBereinigen({ staedte: ["Thetford", "Martlock"] });
        const c = einstellungenBereinigen({ staedte: [] });
        const d = einstellungenBereinigen({ staedte: ["Martlock"], einkaufStaedte: ["Caerleon"], fertigungsstadt: "Thetford" });
        return a.einkaufStaedte.join() === "Lymhurst,Martlock" && a.verkaufStaedte.join() === "Lymhurst,Martlock" && a.fertigungsstadt === "Lymhurst" &&
          b.fertigungsstadt === "Martlock" && b.einkaufStaedte.join() === "Martlock,Thetford" &&
          c.einkaufStaedte.join() === "Lymhurst" && c.fertigungsstadt === "Lymhurst" &&
          d.einkaufStaedte.join() === "Caerleon" && d.verkaufStaedte.join() === "Martlock" && d.fertigungsstadt === "Thetford" &&
          !("staedte" in a);
      })(),
      JSON.stringify(einstellungenBereinigen({ staedte: ["Martlock", "Lymhurst"] }))
    );
    const std = standardEinstellungen();
    pruefe(
      "Vorgabe: Einkauf, Verkauf und Fertigung Lymhurst",
      std.einkaufStaedte.join() === "Lymhurst" && std.verkaufStaedte.join() === "Lymhurst" && std.fertigungsstadt === "Lymhurst",
      JSON.stringify([std.einkaufStaedte, std.verkaufStaedte, std.fertigungsstadt])
    );
    pruefe(
      "Stadtschilder nur bei mehr als einer angehakten Stadt",
      !schilderZeigen([]) && !schilderZeigen(["Lymhurst"]) && schilderZeigen(["Lymhurst", "Martlock"]) && !schilderZeigen(null),
      ""
    );
    const sz = [
      { silber: 300, gewinn: 5, marge: 0.3, gewinnGesamt: 5000, einstufung: "gewinn" },
      { silber: 100, gewinn: 20, marge: 0.05, gewinnGesamt: 20000, einstufung: "gewinn" },
      { silber: 200, gewinn: -1, marge: -0.005, gewinnGesamt: -1000, einstufung: "null" },
    ];
    pruefe(
      "Sortierung: Kosten aufsteigend, Gewinn/Stueck, Marge und Gewinn gesamt absteigend",
      sortiere(sz, "kosten").map((z) => z.silber).join() === "100,200,300" &&
        sortiere(sz, "stueck").map((z) => z.gewinn).join() === "20,5,-1" &&
        sortiere(sz, "marge").map((z) => z.marge).join() === "0.3,0.05,-0.005" &&
        sortiere(sz, "gesamt").map((z) => z.gewinnGesamt).join() === "20000,5000,-1000" &&
        filtereUndSortiere(sz, { sortierung: "kosten" })[0].silber === 100 && filtereUndSortiere(sz, {})[0].marge === 0.3,
      sortiere(sz, "kosten").map((z) => z.silber).join()
    );
    pruefe(
      "Fertigungsstadt: Veredelungsbonus-Hinweis und Rueckgewinnung je Rohstoff (Lymhurst Faser 36,7 %, Holz 15,3 %)",
      (function () {
        const r = rueckgewinnungJeRohstoff({ fertigungsstadt: "Lymhurst", rohstoffe: ["fiber", "wood"], mitFokus: false, zusatzbonusProzent: 0 }, {});
        return veredelBonusVon("Lymhurst").cc === "fiber" && veredelBonusVon("Fort Sterling").cc === "wood" && veredelBonusVon("Caerleon") === null &&
          r.length === 2 && Math.abs(r[0].rrr - 0.58 / 1.58) < 1e-12 && Math.abs(r[1].rrr - 0.18 / 1.18) < 1e-12;
      })(),
      JSON.stringify(rueckgewinnungJeRohstoff({ fertigungsstadt: "Lymhurst", rohstoffe: ["fiber", "wood"] }, {}))
    );
    pruefe(
      "iconUrl: offizieller Bildserver, Item-ID mit _LEVELn, doppelte Pixelzahl",
      iconUrl("T4_FIBER_LEVEL2", 30) === "https://render.albiononline.com/v1/item/T4_FIBER_LEVEL2.png?size=60",
      iconUrl("T4_FIBER_LEVEL2", 30)
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
    const rohstoffeEl = el("vdRohstoffe");
    const tiersEl = el("vdTiers");
    const stufenEl = el("vdStufen");
    const einkaufEl = el("vdEinkauf");
    const verkaufEl = el("vdVerkauf");
    const fertigungEl = el("vdFertigung");
    const bonusEl = el("vdBonus");
    const rrrEl = el("vdRrr");
    const toleranzEl = el("vdToleranz");
    const mengeEl = el("vdMenge");
    const verlusteEl = el("vdVerluste");
    const tagesbonusEl = el("vdTagesbonus");
    const zusatzbonusEl = el("vdZusatzbonus");
    const mehrTextEl = el("vdMehrText");
    const startEl = el("vdStart");
    const statusEl = el("vdStatus");
    const ausgabeEl = el("vdAusgabe");
    const stationenEl = el("vdStationen");
    const preiseResetEl = el("vdPreiseReset");

    let auswahl = standardEinstellungen();
    let letzteZeilen = null;
    // Daten der letzten Suche, fuer Nachrechnen ohne Abruf:
    // { stadtDaten: [{stadt, preiseRoh, absatz}], ids: Set, einkauf: Set, verkauf: Set, zeit }
    let daten = null;
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
    const stueck = (n) => (n == null ? "k. A." : n >= 10 ? Math.round(n).toLocaleString("de-DE") : n.toFixed(1).replace(".", ","));
    const TRANSPORT = "Transportkosten, Gewicht und Reiserisiko sind nicht eingerechnet.";

    /** Icon mit festem Platz; schlaegt das Laden fehl, bleibt nur das leere Feld (kein Layout-Springen). */
    function icon(itemId, px, alt) {
      return (
        "<span class='vd-ic' style='width:" + px + "px;height:" + px + "px'>" +
        "<img src='" + esc(iconUrl(itemId, px)) + "' width='" + px + "' height='" + px + "' alt='" + esc(alt || "") + "' loading='lazy' decoding='async' onerror='this.remove()'></span>"
      );
    }

    // ---- Auswahl-Chips (Rohstoff, Tier, Verzauberung, Einkauf, Verkauf) ----
    const GRUPPEN = {
      rohstoffe: { el: rohstoffeEl, werte: ROHSTOFFE.map((r) => r.cc), parse: (v) => v },
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
      rohstoffeEl.innerHTML = ROHSTOFFE.map((r) =>
        chip("rohstoffe", r.cc, icon(r.icon, 44, r.name) + "<span>" + r.name + "</span>", auswahl.rohstoffe.indexOf(r.cc) !== -1, "vd-roh", r.label)
      ).join("");
      tiersEl.innerHTML = TIERS.map((t) =>
        chip("tiers", t, "T" + t, auswahl.tiers.indexOf(t) !== -1, "", t === 2 ? "T2 ist gebührenfrei." : "")
      ).join("");
      stufenEl.innerHTML = STUFEN.map((s) =>
        chip("stufen", s, "." + s, auswahl.stufen.indexOf(s) !== -1, "", "Beim Stein zählt die Verzauberung des eingesetzten Steins; verzauberter Stein ergibt 2, 4 oder 8 normale Blöcke.")
      ).join("");
      einkaufEl.innerHTML = STAEDTE.map((s) => chip("einkaufStaedte", s, s, auswahl.einkaufStaedte.indexOf(s) !== -1)).join("");
      verkaufEl.innerHTML = STAEDTE.map((s) => chip("verkaufStaedte", s, s, auswahl.verkaufStaedte.indexOf(s) !== -1)).join("");
    }

    // ---- Schalter (Einkauf, Verkauf, Fokus, Premium) ----
    const SCHALTER = {
      kaufweg: { an: "Eigene Kauforder", aus: "Sofortkauf", lesen: () => auswahl.kaufweg === "order", setzen: (an) => (auswahl.kaufweg = an ? "order" : "sofort") },
      verkaufsweg: { an: "Eigene Verkaufsorder", aus: "Sofortverkauf", lesen: () => auswahl.verkaufsweg === "order", setzen: (an) => (auswahl.verkaufsweg = an ? "order" : "sofort") },
      fokus: { an: "Mit Fokus", aus: "Ohne Fokus", lesen: () => auswahl.mitFokus, setzen: (an) => (auswahl.mitFokus = an) },
      // Premium ist dieselbe Einstellung wie im Kostenrechner (v3.10.0).
      premium: { an: "Mit Premium (4 % Steuer)", aus: "Ohne Premium (8 % Steuer)", lesen: () => UI.einstellungenLesen().premium !== false, setzen: (an) => UI.premiumSetzen(an, "veredeln") },
    };

    function schalterSetzen() {
      Object.keys(SCHALTER).forEach((k) => {
        const btn = wurzel.querySelector("[data-vd-schalter='" + k + "']");
        if (!btn) return;
        const an = !!SCHALTER[k].lesen();
        btn.setAttribute("aria-checked", an ? "true" : "false");
        btn.querySelector(".vd-tgl-text").textContent = an ? SCHALTER[k].an : SCHALTER[k].aus;
      });
    }

    /** Eine Zeile, ein Schalter je Rohstoff; dieselbe Einstellung wie im Kostenrechner (v3.9.1). */
    function tagesbonusAufbauen() {
      const tb = UI.einstellungenLesen().tagesbonus || {};
      tagesbonusEl.innerHTML = ROHSTOFFE.map((r) => {
        const w = tb[r.cc] || "aus";
        const opt = (wert, text) => `<option value="${wert}"${w === wert ? " selected" : ""}>${text}</option>`;
        return (
          "<div class='vd-tag-feld' title='" + esc(r.label) + "'>" + icon(r.icon, 30, r.name) +
          `<select class="vd-tag" data-tag-cc="${r.cc}" aria-label="Tagesbonus ${r.name}">${opt("aus", "aus")}${opt("silber", "10 %")}${opt("gold", "20 %")}</select></div>`
        );
      }).join("");
    }

    // v3.9.1: alter Tagesbonus je Stadt aus dem Reiter-Speicher einmalig in
    // die gemeinsame Einstellung uebernehmen (je Rohstoff der hoechste Wert,
    // s. tagesbonusAusAltstand). Danach den Reiter-Speicher ohne das alte
    // Feld zurueckschreiben, damit die Migration nur einmal laeuft. Seit
    // v3.10.0 schreibt das zugleich die neuen Staedtefelder (Migration der
    // alten Liste `staedte`, s. einstellungenBereinigen).
    if (altTagesbonus && typeof altTagesbonus === "object") {
      const migriert = tagesbonusAusAltstand(altTagesbonus);
      Object.keys(migriert).forEach((cc) => UI.tagesbonusSetzen(cc, migriert[cc], "veredeln"));
    }
    speichern();

    const STATION_LABEL = { Saegewerk: "Sägewerk" };

    /** Stationssatz je Gebaeude der angehakten Rohstoffe, dieselbe Einstellung wie im Kostenrechner. */
    function stationenAufbauen() {
      const stationen = stationenFuer(auswahl.rohstoffe);
      if (!stationen.length) {
        stationenEl.innerHTML = "";
        return;
      }
      const saetze = UI.einstellungenLesen().stationssaetze || {};
      stationenEl.innerHTML = stationen
        .map((g) => {
          const name = STATION_LABEL[g] || g;
          return (
            "<label class='vd-satz-zeile'><span>" + name + ", Satz je 100 Nahrung</span>" +
            `<input type="number" class="vd-satz" min="0" step="10" data-vd-station="${g}" value="${saetze[g] != null ? saetze[g] : ""}" placeholder="nicht gepflegt" aria-label="Stationssatz ${name}"></label>`
          );
        })
        .join("");
    }

    function fertigungAufbauen() {
      fertigungEl.innerHTML = STAEDTE.map((s) => `<option value="${esc(s)}"${s === auswahl.fertigungsstadt ? " selected" : ""}>${s}</option>`).join("");
    }

    /** Veredelungsbonus und Rueckgewinnung der Fertigungsstadt. */
    function fertigungInfo() {
      const b = veredelBonusVon(auswahl.fertigungsstadt);
      bonusEl.textContent = b ? "+40 % auf " + b.bonusText : "kein Veredelungsbonus";
      bonusEl.classList.toggle("ohne", !b);
      bonusEl.title = b
        ? "Veredelungsbonus der Stadt: +0,40 Produktionsbonus auf " + b.bonusText + ", gilt nur für diese Warengruppe."
        : "Diese Stadt hat für keinen der fünf Rohstoffe einen Veredelungsbonus.";
      const r = rueckgewinnungJeRohstoff(auswahl, UI.einstellungenLesen());
      if (!r.length) {
        rrrEl.textContent = "";
        return;
      }
      const gleich = r.every((x) => Math.abs(x.rrr - r[0].rrr) < 1e-12);
      rrrEl.textContent = "Rückgewinnung " + (gleich ? prozent(r[0].rrr) : r.map((x) => x.name + " " + prozent(x.rrr)).join(", "));
      rrrEl.title = "Rückgewinnung in " + auswahl.fertigungsstadt + " aus Grundproduktion, Stadtbonus" + (auswahl.mitFokus ? ", Fokus" : "") + ", Tagesbonus und Zusatzbonus.";
    }

    function preiseResetAktualisieren() {
      const n = anzahlUeberschreibungen(auswahl.preisUeberschreibungen);
      preiseResetEl.hidden = n === 0;
      preiseResetEl.textContent = "Eigene Preise zurücksetzen (" + n + ")";
    }

    function mehrTextSetzen() {
      mehrTextEl.textContent = "(Etwa-Null-Grenze " + String(auswahl.toleranzProzent).replace(".", ",") + " %, Zusatzbonus " + String(auswahl.zusatzbonusProzent).replace(".", ",") + " %)";
    }

    function felderSetzen() {
      toleranzEl.value = auswahl.toleranzProzent;
      mengeEl.value = auswahl.menge;
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

    /** Reichen die geladenen Daten fuer die aktuelle Auswahl? Dann ohne Abruf neu rechnen. */
    function datenReichen() {
      if (!daten) return false;
      if (auswahl.einkaufStaedte.some((s) => !daten.einkauf.has(s))) return false;
      if (auswahl.verkaufStaedte.some((s) => !daten.verkauf.has(s))) return false;
      return benoetigteMarktIds(kandidaten(auswahl)).every((id) => daten.ids.has(id));
    }

    function auswahlGeaendert() {
      if (datenReichen()) rechnen();
      else if (daten) {
        statusEl.className = "";
        statusEl.textContent = "Auswahl geändert: „Gelegenheiten suchen“ ruft die fehlenden Preise ab.";
      }
    }

    wurzel.addEventListener("change", (ev) => {
      // v3.9.0: eigener Einkaufspreis je Zutat. Leer oder <= 0 setzt zurueck.
      const preisEl = ev.target.closest("input[data-vd-markt]");
      if (preisEl) {
        // Neu zeichnen erst nach dem Ereignis: das Feld kann gerade den Fokus
        // verlieren, und innerHTML mitten im Fokuswechsel wirft in Chromium.
        const stadt = preisEl.dataset.vdStadt;
        const markt = preisEl.dataset.vdMarkt;
        const wert = preisEl.value.trim();
        setTimeout(() => eigenenPreisSetzen(stadt, markt, wert), 0);
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
        const k = box.dataset.gruppe;
        const g = GRUPPEN[k];
        box.closest(".vd-chip").classList.toggle("an", box.checked);
        const an = Array.from(g.el.querySelectorAll("input:checked")).map((x) => g.parse(x.value));
        auswahl[k] = g.werte.filter((w) => an.indexOf(w) !== -1);
        speichern();
        if (k === "rohstoffe") {
          stationenAufbauen();
          fertigungInfo();
        }
        auswahlGeaendert();
        return;
      }
      // v3.9.1: Tagesbonus je Rohstoff, gilt in allen Staedten, geteilt mit dem Kostenrechner.
      const tagSel = ev.target.closest("select[data-tag-cc]");
      if (tagSel) {
        UI.tagesbonusSetzen(tagSel.dataset.tagCc, tagSel.value, "veredeln");
        fertigungInfo();
        rechnen();
        return;
      }
      felderLesen();
      // Toleranz, Menge und Verluste-Schalter brauchen nur eine neue
      // Bewertung; Fertigungsstadt und Zusatzbonus rechnen mit den schon
      // abgerufenen Preisen neu.
      if ([toleranzEl, mengeEl, verlusteEl].indexOf(ev.target) !== -1) neuBewerten();
      else if ([fertigungEl, zusatzbonusEl].indexOf(ev.target) !== -1) {
        fertigungInfo();
        rechnen();
      }
    });

    wurzel.addEventListener("click", (ev) => {
      const schalter = ev.target.closest("[data-vd-schalter]");
      if (schalter) {
        const s = SCHALTER[schalter.dataset.vdSchalter];
        s.setzen(!s.lesen());
        speichern();
        schalterSetzen();
        fertigungInfo();
        rechnen();
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

    // Tagesbonus im Kostenrechner geaendert: Zeile nachziehen, neu rechnen.
    document.addEventListener(UI.TAGESBONUS_EVENT, (ev) => {
      if (ev.detail && ev.detail.quelle === "veredeln") return;
      tagesbonusAufbauen();
      fertigungInfo();
      rechnen();
    });
    // Stationssatz im Kostenrechner geaendert: Felder nachziehen, neu rechnen.
    document.addEventListener(UI.STATIONSSAETZE_EVENT, (ev) => {
      if (ev.detail && ev.detail.quelle === "veredeln") return;
      stationenAufbauen();
      rechnen();
    });
    // Premium im Kostenrechner geaendert (v3.10.0).
    document.addEventListener(UI.PREMIUM_EVENT, (ev) => {
      if (ev.detail && ev.detail.quelle === "veredeln") return;
      schalterSetzen();
      rechnen();
    });

    function alterText(min) {
      if (min == null || !isFinite(min)) return "";
      return min < 90 ? Math.round(min) + " Min." : min < 2880 ? Math.round(min / 60) + " Std." : Math.round(min / 1440) + " Tage";
    }

    /** Marktpreis (ohne eigenen Preis) und Alter einer Zutat in ihrer Einkaufsstadt. */
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

    function stadtSchild(stadt, titel) {
      return stadt ? "<span class='vd-stadt' title='" + esc(titel) + "'>" + esc(stadt) + "</span>" : "<span></span>";
    }

    // Zutaten in festen Spalten: Icon, Menge und Name, Preisfeld, Stadtschild
    // (nur bei mehreren Einkaufsstaedten), Hoechstpreis.
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
            herkunft + ". " +
            (order ? "Eingabe ist der Orderpreis; gerechnet wird mit 2,5 % Einstellgebühr obendrauf (" + fmt(x.preis) + "). " : "") +
            "Klicken zum Überschreiben: ein eigener Preis gilt für diese Zutat in " + x.stadt + " in allen Zeilen, bleibt gespeichert und zählt bei der Wahl der günstigsten Stadt mit. Leer setzt zurück.";
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
            "<span class='vd-zname'>" + (Math.round(x.menge * 100) / 100) + "× " + esc(name) + "</span>" +
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
        sortTh("kosten", "Kosten/Stück", "Material nach Rückgewinnung plus Stationsgebühr, je Stück Produkt. Klicken sortiert aufsteigend.") +
        sortTh("stueck", "Gewinn/Stück", "Erlös nach Steuer minus Kosten, je Stück. Klicken sortiert absteigend.") +
        sortTh("marge", "Marge", "Gewinn bezogen auf die eigenen Kosten. Klicken sortiert absteigend.") +
        sortTh("gesamt", "Gewinn gesamt", "Gewinn je Stück mal der eingestellten Menge. Klicken sortiert absteigend.") +
        "</tr></thead>"
      );
    }

    function render(zeilen, gesamt, kontext) {
      if (!zeilen.length) {
        ausgabeEl.innerHTML =
          "<div class='vd-leer'>Von " + gesamt + " geprüften Vorgängen bringt keiner Gewinn oder liegt innerhalb der Toleranz. Toleranz erhöhen, „Verluste zeigen“ anhaken oder andere Städte wählen.</div>";
        return;
      }
      const vkTitel = (kontext.verkaufsweg === "order" ? "günstigste Verkaufsorder" : "höchste Kauforder");
      const body = zeilen
        .map((z) => {
          const klasse = z.einstufung === "gewinn" ? "vd-gewinn" : z.einstufung === "null" ? "vd-null" : "vd-verlust";
          const einstufung = z.einstufung === "gewinn" ? "Gewinn" : z.einstufung === "null" ? "etwa Null (innerhalb der Toleranz)" : "Verlust";
          const name = nameVon(z.item, z.stufe);
          const tierTitel = z.ausbeute > 1 ? "Ein Vorgang ergibt " + z.ausbeute + " Stück." : "";
          const fokus = z.fokusJeVorgang > 0 ? "<div class='vd-klein'>" + fmtFokus(z.fokusJeVorgang) + " Fokus/Vorgang</div>" : "";
          const preisTitel = vkTitel + (z.vkStadt ? " in " + z.vkStadt : "") + (z.produktAlterMin != null ? ", " + alterText(z.produktAlterMin) + " alt" : "");
          const handel =
            "<div class='vd-klein' title='Erfasster Handel des Produkts in " + esc(z.vkStadt || "") + ", Mittel der letzten " + TAGE_FENSTER +
            " Tage. Untergrenze: gemeldet wird nur, was Spieler mit laufendem Data-Client sehen.'>verkauft/Tag " + stueck(z.stueckJeTag) + "</div>";
          return (
            "<tr class='" + klasse + "'>" +
            "<td><div class='vd-produkt'>" + icon(z.item, 48, name) + "<div><div class='vd-pname'>" + esc(name) + "</div>" +
            "<div class='vd-klein'" + (tierTitel ? " title='" + esc(tierTitel) + "'" : "") + ">T" + z.tier + "." + z.vorgangsStufe + "</div></div></div></td>" +
            "<td><div class='vd-zutaten" + (kontext.mehrEk ? "" : " ohne-stadt") + "'>" + zutatenHtml(z, kontext) + "</div></td>" +
            "<td><div class='vd-erloes' title='Erlös je Stück nach Steuer" + (kontext.verkaufsweg === "order" ? " und 2,5 % Einstellgebühr" : "") + "'>" + fmt(z.erloes) + "</div>" +
            "<div class='vd-klein' title='" + esc(preisTitel) + "'>Preis " + fmt(z.produktPreis) + "</div>" +
            (kontext.mehrVk ? "<div>" + stadtSchild(z.vkStadt, "Angehakte Verkaufsstadt mit dem höchsten Erlös. " + TRANSPORT) + "</div>" : "") +
            handel + "</td>" +
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

    /** Zeilen aus den Daten der letzten Suche neu rechnen, ohne Abruf. */
    function rechnen() {
      if (!daten || laeuft || !datenReichen()) return null;
      const einstellungen = UI.einstellungenLesen();
      const kand = kandidaten(auswahl);
      const zeilen = zeilenRechnen(kand, daten.stadtDaten, auswahl, einstellungen);
      const saetze = einstellungen.stationssaetze || {};
      letzteZeilen = {
        zeilen,
        kontext: {
          kaufweg: auswahl.kaufweg,
          verkaufsweg: auswahl.verkaufsweg,
          mehrEk: schilderZeigen(auswahl.einkaufStaedte),
          mehrVk: schilderZeigen(auswahl.verkaufStaedte),
        },
      };
      neuBewerten();
      const mitErgebnis = zeilen.filter((z) => z.gewinn != null).length;
      const fehlend = stationenFuer(Array.from(new Set(kand.map((k) => k.cc)))).filter((g) => saetze[g] == null).map((g) => STATION_LABEL[g] || g);
      statusEl.className = "ok";
      statusEl.textContent =
        "Fertig: " + zeilen.filter((z) => z.einstufung === "gewinn").length + " mit Gewinn, " + zeilen.filter((z) => z.einstufung === "null").length + " etwa Null" +
        (zeilen.length - mitErgebnis ? ", " + (zeilen.length - mitErgebnis) + " von " + zeilen.length + " ohne vollständige Preise" : "") +
        ". Preise frisch abgerufen um " + daten.zeit + "." +
        (fehlend.length ? " Stationssatz fehlt für " + fehlend.join(", ") + ", mit 0 gerechnet." : "");
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
      const gefiltert = filtereUndSortiere(letzteZeilen.zeilen, { verlusteZeigen: auswahl.verlusteZeigen, sortierung: auswahl.sortierung });
      render(gefiltert, letzteZeilen.zeilen.length, Object.assign({}, letzteZeilen.kontext, { sortierung: auswahl.sortierung }));
    }

    // Ein Knopf (v3.10.0): ruft immer frische Preise der Auswahl ab
    // (Zwischenspeicher umgangen), Staedte nacheinander wie bisher, damit
    // die API-Drosselung greift (PREISE wartet zwischen den Bloecken).
    async function suchen() {
      if (laeuft) return;
      felderLesen();
      if (!auswahl.einkaufStaedte.length || !auswahl.verkaufStaedte.length || !auswahl.rohstoffe.length || !auswahl.tiers.length || !auswahl.stufen.length) {
        statusEl.className = "err";
        statusEl.textContent = "Mindestens je eine Einkaufs- und Verkaufsstadt, einen Rohstoff, ein Tier und eine Verzauberung anhaken.";
        return;
      }
      laeuft = true;
      startEl.disabled = true;
      statusEl.className = "";
      ausgabeEl.innerHTML = "";
      try {
        const kand = kandidaten(auswahl);
        const produktIds = Array.from(new Set(kand.map((k) => k.marktId)));
        const zutatIds = Array.from(new Set([].concat(...kand.map((k) => k.zutaten.map((zt) => marktIdVon(zt.n, zt.stufe))))));
        const staedte = STAEDTE.filter((s) => auswahl.einkaufStaedte.indexOf(s) !== -1 || auswahl.verkaufStaedte.indexOf(s) !== -1);
        const stadtDaten = [];
        for (let i = 0; i < staedte.length; i++) {
          const stadt = staedte[i];
          const ek = auswahl.einkaufStaedte.indexOf(stadt) !== -1;
          const vk = auswahl.verkaufStaedte.indexOf(stadt) !== -1;
          const ids = Array.from(new Set([].concat(ek ? zutatIds : [], vk ? produktIds : [])));
          const vorsatz = stadt + " (" + (i + 1) + "/" + staedte.length + "): ";
          const preiseRoh = await PREISE.preiseAbrufen(ids, {
            stadt,
            erzwingen: true,
            qualitaet: 1,
            aufFortschritt: (f, g) => {
              statusEl.textContent = vorsatz + "Preise " + f + "/" + g + " ...";
            },
          });
          let absatz = {};
          if (vk) {
            statusEl.textContent = vorsatz + "Handelsvolumen ...";
            absatz = await PREISE.absatzAbrufen(produktIds, { stadt, tageFenster: TAGE_FENSTER });
          }
          stadtDaten.push({ stadt, preiseRoh, absatz });
        }
        daten = {
          stadtDaten,
          ids: new Set(zutatIds.concat(produktIds)),
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
    startEl.addEventListener("click", () => suchen());
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
    SORTIERUNGEN,
    iconUrl,
    schilderZeigen,
    veredelBonusVon,
    rueckgewinnungJeRohstoff,
    sortiere,
    einkaufsBasisPreis,
    einkaufWaehlen,
    verkaufWaehlen,
    selbsttest,
  };
})();
