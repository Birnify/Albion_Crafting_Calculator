// js/gelegenheiten.js
//
// Reiter "Gelegenheiten" (v3.17.0, 22.11.2026, OPTIMIERUNG-PLAN.md Paket O3):
// eine Rangliste der besten Crafts und Veredelungen ueber ALLE Warengruppen,
// ohne dass vorher eine Gruppe gewaehlt werden muss. Nutzer-Vorgabe: auf
// einen Durchlauf zu warten ist nicht ergonomisch. Deshalb
//
// 1. steht die Rangliste beim Oeffnen sofort aus dem Preisbestand
//    (PREISE, IndexedDB-Arbeitskopie), auch mit abgelaufenen Werten, und
//    nennt je Zeile ihr Alter;
// 2. haelt ein laufender Hintergrundscan den Bestand frisch, solange die App
//    offen ist (PREISE.planer, prioritaet "hintergrund", gruppe "scan"),
//    zuerst fuer das, was in der Rangliste oben steht.
//
// KEINE eigene Rechenlogik: jede Zeile kommt unveraendert aus
// CRAFTEN.zeilenRechnen() bzw. VEREDELN.zeilenRechnen() (flach, direkte
// Zutaten gekauft, Stadtwahl je Zutat und Produkt). Diese Datei baut nur die
// Eingaben dafuer aus dem Bestand (in derselben Form wie
// CRAFTEN.datenAbrufen()/VEREDELN.datenAbrufen()), ordnet, filtert und zeigt.
//
// Aufbau:
// - reine Funktionen (Einstellungen, Kandidaten, Zeilen aus dem Bestand,
//   Filter, Sortierung, Scanreihenfolge, Faelligkeit, Abrufschaetzung),
// - erzeugen(): die "Maschine" ohne DOM (Zeilenbestand, Neuberechnung in
//   Scheiben, Scanschleife), mit austauschbarer Umgebung fuer Tests,
// - boot(): Verdrahtung mit dem Markup in Kostenrechner.html.
//
// Gemeinsame Einstellungen der App (Stationssaetze, Tagesbonus, Premium, FCE,
// Hoechstalter der Preise) kommen aus UI.einstellungenLesen(); der Reiter
// fuehrt nur, was hier die Frage ist (Scanumfang, Staedte, Kauf- und
// Verkaufsweg, Fokus, Mindestvolumen, Art).
//
// Bewusst nicht modelliert (wie in den Detailreitern): Transportkosten,
// Gewicht, Reiserisiko, Wartezeit eigener Orders. Eigene Preise und
// Hoechstpreise gibt es nur in den Detailreitern.
//
// Fuer O4 und O5 vorbereitet: spalteErgaenzen() (weitere Spalten samt
// Sortierung) und aktionErgaenzen() (Knoepfe je Zeile).

const GELEGENHEITEN = (function () {
  "use strict";

  const V = VEREDELN;
  const C = CRAFTEN;
  const STAEDTE = V.STAEDTE;
  const TIERS = [2, 3, 4, 5, 6, 7, 8];
  const STUFEN = [0, 1, 2, 3, 4];
  const TAGE_FENSTER = 7; // wie in craften.js und veredeln.js, bestimmt den Schluessel im Volumenbestand
  const SPEICHER_KEY = "albion_kostenrechner_gelegenheiten_v1";
  const ARTEN = ["beides", "craften", "veredeln"];
  const SCHEIBE = 200; // Kandidaten je Rechenschritt, danach bekommt der Browser Luft
  const MAX_ZEILEN = 200; // Zeilen im DOM, der Rest ueber "mehr anzeigen"
  const SCAN_GRUPPE = "scan";
  const SCAN_RUHE_MS = 20000; // ist nichts faellig, prueft der Scan in diesem Abstand erneut (ohne Abruf)
  const SCAN_FEHLER_MS = 60000; // Pause nach einem gescheiterten Abruf

  const GRUPPEN_LABEL = {};
  C.WARENGRUPPEN.forEach((w) => (GRUPPEN_LABEL[w.cc] = w.label));
  V.ROHSTOFFE.forEach((r) => (GRUPPEN_LABEL[r.cc] = r.name));

  // -----------------------------------------------------------------------
  // Einstellungen
  // -----------------------------------------------------------------------

  /**
   * Vorgaben laut Auftrag O3 und Spielerprofil (CLAUDE.md): alle
   * Warengruppen und alle fuenf Veredelungsrohstoffe, T4 bis T8, alle
   * Verzauberungsstufen, ohne Artefakt-Items; Fertigung, Einkauf und Verkauf
   * in Lymhurst; Sofortkauf, eigene Verkaufsorder, ohne Fokus; mindestens 5
   * verkauft/Tag; Scan an.
   */
  function standardEinstellungen() {
    return {
      warengruppen: C.WARENGRUPPEN.map((w) => w.cc),
      rohstoffe: V.ROHSTOFFE.map((r) => r.cc),
      tiers: [4, 5, 6, 7, 8],
      stufen: STUFEN.slice(),
      artefakte: false,
      fertigungsstadt: "Lymhurst",
      einkaufStaedte: ["Lymhurst"],
      verkaufStaedte: ["Lymhurst"],
      kaufweg: "sofort",
      verkaufsweg: "order",
      mitFokus: false,
      minAbsatz: 5,
      art: "beides",
      sortierung: "marge",
      scanAn: true,
      scanAuchVerborgen: false,
      einstellungenOffen: false, // der eingeklappte Block ueber der Rangliste
    };
  }

  /** Gespeicherten Stand gegen die erlaubten Werte pruefen; Unbekanntes faellt weg, Fehlendes kommt aus dem Standard. */
  function einstellungenBereinigen(roh) {
    const basis = standardEinstellungen();
    if (!roh || typeof roh !== "object") return basis;
    const liste = (wert, erlaubt) => (Array.isArray(wert) ? erlaubt.filter((x) => wert.indexOf(x) !== -1) : null);
    const minRoh = roh.minAbsatz;
    return {
      warengruppen: liste(roh.warengruppen, basis.warengruppen) || basis.warengruppen,
      rohstoffe: liste(roh.rohstoffe, basis.rohstoffe) || basis.rohstoffe,
      tiers: liste(roh.tiers, TIERS) || basis.tiers,
      stufen: liste(roh.stufen, STUFEN) || basis.stufen,
      artefakte: !!roh.artefakte,
      fertigungsstadt: STAEDTE.indexOf(roh.fertigungsstadt) !== -1 ? roh.fertigungsstadt : basis.fertigungsstadt,
      einkaufStaedte: liste(roh.einkaufStaedte, STAEDTE) || basis.einkaufStaedte,
      verkaufStaedte: liste(roh.verkaufStaedte, STAEDTE) || basis.verkaufStaedte,
      kaufweg: roh.kaufweg === "order" ? "order" : "sofort",
      verkaufsweg: roh.verkaufsweg === "sofort" ? "sofort" : "order",
      mitFokus: !!roh.mitFokus,
      minAbsatz: minRoh !== "" && minRoh != null && isFinite(Number(minRoh)) ? Math.max(0, Number(minRoh)) : basis.minAbsatz,
      art: ARTEN.indexOf(roh.art) !== -1 ? roh.art : basis.art,
      sortierung: SORTIERER[roh.sortierung] ? roh.sortierung : basis.sortierung,
      scanAn: roh.scanAn == null ? true : !!roh.scanAn,
      scanAuchVerborgen: !!roh.scanAuchVerborgen,
      einstellungenOffen: !!roh.einstellungenOffen,
    };
  }

  /**
   * Dieselbe Auswahl, wie man sie im Reiter "Craften: Gewinn" einstellen
   * wuerde. Volumen ueber alle Qualitaeten (dortige Vorgabe), ohne
   * Zusatzbonus, ohne eigene Preise.
   */
  function auswahlCraften(e) {
    return C.einstellungenBereinigen({
      warengruppen: e.warengruppen,
      tiers: e.tiers,
      stufen: e.stufen,
      artefakte: e.artefakte,
      einkaufStaedte: e.einkaufStaedte,
      verkaufStaedte: e.verkaufStaedte,
      fertigungsstadt: e.fertigungsstadt,
      kaufweg: e.kaufweg,
      verkaufsweg: e.verkaufsweg,
      mitFokus: e.mitFokus,
      minAbsatz: e.minAbsatz,
      volumenAlleQualitaeten: true,
      toleranzProzent: 0,
      menge: 1,
    });
  }

  /** Dieselbe Auswahl fuer "Veredeln leveln". */
  function auswahlVeredeln(e) {
    return V.einstellungenBereinigen({
      rohstoffe: e.rohstoffe,
      tiers: e.tiers,
      stufen: e.stufen,
      einkaufStaedte: e.einkaufStaedte,
      verkaufStaedte: e.verkaufStaedte,
      fertigungsstadt: e.fertigungsstadt,
      kaufweg: e.kaufweg,
      verkaufsweg: e.verkaufsweg,
      mitFokus: e.mitFokus,
      toleranzProzent: 0,
      menge: 1,
    });
  }

  const staedteVon = (liste) => STAEDTE.filter((s) => (liste || []).indexOf(s) !== -1);

  // -----------------------------------------------------------------------
  // Kandidaten
  // -----------------------------------------------------------------------

  /**
   * Alle Vorgaenge des Scanumfangs: zuerst die Veredelungen (wenige IDs,
   * hohes Volumen), dann die Crafts in der Reihenfolge der Warengruppen. Das
   * ist zugleich die feste Scanreihenfolge beim allerersten Start ohne
   * Bestand. k ist der unveraenderte Kandidat aus VEREDELN.kandidaten() bzw.
   * CRAFTEN.kandidaten().
   * @returns {{art:"veredeln"|"craften", schluessel:string, k:object, cc:string, produktId:string, zutatIds:string[]}[]}
   */
  function kandidaten(e, graph) {
    const out = [];
    V.kandidaten({ rohstoffe: e.rohstoffe, tiers: e.tiers, stufen: e.stufen }, graph).forEach((k) => {
      out.push({
        art: "veredeln",
        schluessel: "v:" + k.marktId + ":" + k.rezeptIndex,
        k,
        cc: k.cc,
        produktId: k.marktId,
        zutatIds: Array.from(new Set(k.zutaten.map((z) => PREISE.marktId(z.n, z.stufe)))),
      });
    });
    const rang = {};
    C.WARENGRUPPEN.forEach((w, i) => (rang[w.cc] = i));
    C.kandidaten({ warengruppen: e.warengruppen, tiers: e.tiers, stufen: e.stufen, artefakte: e.artefakte }, graph)
      .map((k, i) => ({ k, i }))
      .sort((a, b) => rang[a.k.cc] - rang[b.k.cc] || a.i - b.i)
      .forEach(({ k }) => {
        const ids = new Set();
        k.rezepte.forEach((r) => r.zutaten.forEach((z) => ids.add(PREISE.marktId(z.n, z.stufe))));
        out.push({ art: "craften", schluessel: "c:" + k.marktId, k, cc: k.cc, produktId: k.marktId, zutatIds: Array.from(ids) });
      });
    return out;
  }

  // -----------------------------------------------------------------------
  // Zeilen aus dem Bestand
  // -----------------------------------------------------------------------

  /** Zugriff auf den Preisbestand; in Tests austauschbar. */
  function bestandLeser() {
    return { preis: PREISE.bestandPreis, alleQ: PREISE.bestandAlleQualitaeten, absatz: PREISE.bestandAbsatz };
  }

  /** Anteil als Prozenttext mit einer Nachkommastelle und Tausenderpunkt: 258,296 -> "25.829,6 %". */
  function prozentText(anteil) {
    return (anteil * 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
  }

  const zeitVon = (eintrag) => (eintrag && eintrag.abgerufenAm > 0 ? eintrag.abgerufenAm : 0);

  /**
   * Eingaben fuer VEREDELN.zeilenRechnen() aus dem Bestand, in der Form von
   * VEREDELN.datenAbrufen(): je Stadt preiseRoh (Zutaten in Einkaufs-,
   * Produkte in Verkaufsstaedten, Normal) und absatz (nur Verkaufsstaedte).
   */
  function stadtDatenVeredeln(teil, e, lesen) {
    const ek = staedteVon(e.einkaufStaedte);
    const vk = staedteVon(e.verkaufStaedte);
    const zutatIds = new Set();
    const produktIds = new Set();
    teil.forEach((x) => {
      produktIds.add(x.produktId);
      x.zutatIds.forEach((id) => zutatIds.add(id));
    });
    return STAEDTE.filter((s) => ek.indexOf(s) !== -1 || vk.indexOf(s) !== -1).map((stadt) => {
      const istEk = ek.indexOf(stadt) !== -1;
      const istVk = vk.indexOf(stadt) !== -1;
      const preiseRoh = {};
      if (istEk) zutatIds.forEach((id) => (preiseRoh[id] = lesen.preis(stadt, id, 1) || null));
      if (istVk) produktIds.forEach((id) => (preiseRoh[id] = lesen.preis(stadt, id, 1) || null));
      const absatz = {};
      const absatzAm = {};
      if (istVk) {
        produktIds.forEach((id) => {
          const a = lesen.absatz(stadt, id, TAGE_FENSTER);
          if (a) {
            absatz[id] = a.jeQ;
            absatzAm[id] = a.abgerufenAm;
          }
        });
      }
      return { stadt, preiseRoh, absatz, absatzAm };
    });
  }

  /**
   * Eingaben fuer CRAFTEN.zeilenRechnen() aus dem Bestand, in der Form von
   * CRAFTEN.datenAbrufen(): preiseRoh (Zutaten, Normal) nur in
   * Einkaufsstaedten, produktJeQ und absatz nur in Verkaufsstaedten.
   */
  function stadtDatenCraften(teil, e, lesen) {
    const ek = staedteVon(e.einkaufStaedte);
    const vk = staedteVon(e.verkaufStaedte);
    const zutatIds = new Set();
    const produktIds = new Set();
    teil.forEach((x) => {
      produktIds.add(x.produktId);
      x.zutatIds.forEach((id) => zutatIds.add(id));
    });
    return STAEDTE.filter((s) => ek.indexOf(s) !== -1 || vk.indexOf(s) !== -1).map((stadt) => {
      const eintrag = { stadt, absatzAm: {}, produktAm: {} };
      if (ek.indexOf(stadt) !== -1) {
        eintrag.preiseRoh = {};
        zutatIds.forEach((id) => (eintrag.preiseRoh[id] = lesen.preis(stadt, id, 1) || null));
      }
      if (vk.indexOf(stadt) !== -1) {
        eintrag.produktJeQ = {};
        eintrag.absatz = {};
        produktIds.forEach((id) => {
          const p = lesen.alleQ(stadt, id);
          if (p) {
            eintrag.produktJeQ[id] = p.jeQ;
            eintrag.produktAm[id] = p.abgerufenAm;
          }
          const a = lesen.absatz(stadt, id, TAGE_FENSTER);
          if (a) {
            eintrag.absatz[id] = a.jeQ;
            eintrag.absatzAm[id] = a.abgerufenAm;
          }
        });
      }
      return eintrag;
    });
  }

  /**
   * Zeilen fuer einen Teil der Kandidaten, ohne Netz: die Rechnung selbst
   * machen CRAFTEN.zeilenRechnen() und VEREDELN.zeilenRechnen(). Jede Zeile
   * bekommt dazu art, schluessel und die Abrufzeiten der verwendeten Werte:
   * preisAbrufAm (aeltester verwendeter Preis: Zutaten und Produkt in der
   * gewaehlten Verkaufsstadt), volAbrufAm (Handelsvolumen dort), abrufAm
   * (der aeltere von beiden; fehlt einer, der vorhandene). 0 heisst: fehlt
   * im Bestand.
   *
   * @param teil Kandidaten aus kandidaten()
   * @param e Einstellungen des Reiters
   * @param einstellungen gemeinsame Einstellungen (UI.einstellungenLesen())
   * @param [lesen] Zugriff auf den Bestand (Vorgabe: PREISE)
   * @param [jetzt]
   */
  function zeilenRechnen(teil, e, einstellungen, lesen, jetzt) {
    lesen = lesen || bestandLeser();
    const out = new Array(teil.length);
    const jeArt = { veredeln: [], craften: [] };
    teil.forEach((x, i) => jeArt[x.art].push(i));
    const aelteste = (zeiten) => {
      let t = Infinity;
      zeiten.forEach((z) => {
        t = Math.min(t, z > 0 ? z : 0);
      });
      return isFinite(t) ? t : 0;
    };
    const abschluss = (z, x, preisZeiten, volAm) => {
      z.art = x.art;
      z.schluessel = x.schluessel;
      (z.zutatenPreise || []).forEach((p) => preisZeiten.push(zeitVon(p.roh)));
      if (!(z.zutatenPreise || []).length) preisZeiten.push(0);
      z.preisAbrufAm = aelteste(preisZeiten);
      z.volAbrufAm = volAm > 0 ? volAm : 0;
      z.abrufAm = z.preisAbrufAm > 0 && z.volAbrufAm > 0 ? Math.min(z.preisAbrufAm, z.volAbrufAm) : Math.max(z.preisAbrufAm, z.volAbrufAm);
      return z;
    };
    if (jeArt.veredeln.length) {
      const vTeil = jeArt.veredeln.map((i) => teil[i]);
      const daten = stadtDatenVeredeln(vTeil, e, lesen);
      const zeilen = V.zeilenRechnen(vTeil.map((x) => x.k), daten, auswahlVeredeln(e), einstellungen, jetzt);
      zeilen.forEach((z, n) => {
        const x = vTeil[n];
        const d = daten.find((s) => s.stadt === z.vkStadt);
        out[jeArt.veredeln[n]] = abschluss(z, x, [d ? zeitVon(d.preiseRoh[x.produktId]) : 0], d ? d.absatzAm[x.produktId] : 0);
      });
    }
    if (jeArt.craften.length) {
      const cTeil = jeArt.craften.map((i) => teil[i]);
      const daten = stadtDatenCraften(cTeil, e, lesen);
      const zeilen = C.zeilenRechnen(cTeil.map((x) => x.k), daten, auswahlCraften(e), einstellungen, jetzt);
      zeilen.forEach((z, n) => {
        const x = cTeil[n];
        const d = daten.find((s) => s.stadt === z.vkStadt);
        const jeQ = d && d.produktJeQ ? d.produktJeQ[x.produktId] : null;
        const zeiten = jeQ ? Object.keys(jeQ).map((q) => zeitVon(jeQ[q])) : [];
        zeiten.push(d ? d.produktAm[x.produktId] || 0 : 0);
        out[jeArt.craften[n]] = abschluss(z, x, zeiten, d ? d.absatzAm[x.produktId] : 0);
      });
    }
    return out;
  }

  const PREIS_MAX_MS = () => PREISE.PREIS_GUELTIG_MIN * 60000;
  const VOLUMEN_MAX_MS = () => PREISE.VOLUMEN_GUELTIG_MIN * 60000;

  function zeitFrisch(t, jetzt, maxMs) {
    return t > 0 && jetzt - t >= 0 && jetzt - t <= maxMs;
  }

  /**
   * Eine Zeile gilt als alt, sobald einer ihrer verwendeten Werte ueber der
   * Gueltigkeit liegt (Preise 30 Min., Handelsvolumen 60 Min.): genau dann
   * wuerde ein Detailreiter neu abrufen.
   */
  function istAlt(z, jetzt) {
    const t = jetzt == null ? Date.now() : jetzt;
    return !zeitFrisch(z.preisAbrufAm, t, PREIS_MAX_MS()) || !zeitFrisch(z.volAbrufAm, t, VOLUMEN_MAX_MS());
  }

  // -----------------------------------------------------------------------
  // Filter und Sortierung
  // -----------------------------------------------------------------------

  // Sortierschluessel der Tabellenkoepfe. O4 ergaenzt weitere ueber spalteErgaenzen().
  const SORTIERER = {
    marge: { wert: (z) => z.marge, auf: false },
    stueck: { wert: (z) => z.gewinn, auf: false },
    kosten: { wert: (z) => z.silber, auf: true },
    volumen: { wert: (z) => z.stueckJeTag || 0, auf: false },
    alter: { wert: (z) => z.abrufAm || 0, auf: false }, // juengste zuerst
  };

  /** Sortiert stabil: bei Gleichstand entscheidet der Zeilenschluessel, damit die Liste nicht zufaellig umspringt. */
  function sortiere(zeilen, schluessel) {
    const s = SORTIERER[schluessel] || SORTIERER.marge;
    const w = (z) => {
      const x = s.wert(z);
      return x == null || isNaN(x) ? -Infinity : x;
    };
    return zeilen.slice().sort((a, b) => (s.auf ? w(a) - w(b) : w(b) - w(a)) || (a.schluessel < b.schluessel ? -1 : a.schluessel > b.schluessel ? 1 : 0));
  }

  /**
   * Die Rangliste: nur Zeilen mit Gewinn, mindestens minAbsatz verkauft/Tag
   * (Pflichtfilter, ohne erfassten Handel faellt die Zeile ab minAbsatz > 0
   * heraus), gefiltert nach Art, sortiert.
   * @returns {{zeilen:object[], ausgeblendet:number}} ausgeblendet = Zeilen mit Gewinn unter dem Volumenfilter
   */
  function filtereUndSortiere(zeilen, e) {
    const min = e.minAbsatz > 0 ? e.minAbsatz : 0;
    let ausgeblendet = 0;
    const bleibt = zeilen.filter((z) => {
      if (!z || z.gewinn == null || z.marge == null || !(z.gewinn > 0)) return false;
      if (e.art && e.art !== "beides" && z.art !== e.art) return false;
      if ((z.stueckJeTag || 0) < min) {
        ausgeblendet++;
        return false;
      }
      return true;
    });
    return { zeilen: sortiere(bleibt, e.sortierung), ausgeblendet };
  }

  // -----------------------------------------------------------------------
  // Scan: Reihenfolge, Faelligkeit, Schaetzung
  // -----------------------------------------------------------------------

  /**
   * Stand eines Kandidaten im Bestand: aelteste Abrufzeit seiner Preise
   * (Zutaten in allen Einkaufsstaedten, Produkt in allen Verkaufsstaedten)
   * und seines Handelsvolumens. 0 = mindestens ein Wert fehlt.
   */
  function kandidatStand(x, e, lesen) {
    const ek = staedteVon(e.einkaufStaedte);
    const vk = staedteVon(e.verkaufStaedte);
    if (!ek.length || !vk.length) return { preisAm: 0, volAm: 0 };
    let preisAm = Infinity;
    let volAm = Infinity;
    x.zutatIds.forEach((id) => ek.forEach((s) => (preisAm = Math.min(preisAm, zeitVon(lesen.preis(s, id, 1))))));
    vk.forEach((s) => {
      preisAm = Math.min(preisAm, zeitVon(x.art === "craften" ? lesen.alleQ(s, x.produktId) : lesen.preis(s, x.produktId, 1)));
      volAm = Math.min(volAm, zeitVon(lesen.absatz(s, x.produktId, TAGE_FENSTER)));
    });
    return { preisAm: isFinite(preisAm) ? preisAm : 0, volAm: isFinite(volAm) ? volAm : 0 };
  }

  function kandidatFrisch(stand, jetzt) {
    return zeitFrisch(stand.preisAm, jetzt, PREIS_MAX_MS()) && zeitFrisch(stand.volAm, jetzt, VOLUMEN_MAX_MS());
  }

  /**
   * Reihenfolge des Scans ("oben zuerst"): erst die Kandidaten,
   * die gerade in der Rangliste stehen, in deren Reihenfolge; dann der Rest,
   * die aeltesten Preise zuerst (nie abgerufen = am aeltesten), bei
   * Gleichstand in der festen Reihenfolge von kandidaten().
   * @param liste Kandidaten
   * @param rangSchluessel Zeilenschluessel der Rangliste, bester zuerst
   * @param standVon (kandidat) => {preisAm, volAm}
   */
  function scanReihenfolge(liste, rangSchluessel, standVon) {
    const rang = new Map();
    (rangSchluessel || []).forEach((s, i) => {
      if (!rang.has(s)) rang.set(s, i);
    });
    const oben = [];
    const rest = [];
    liste.forEach((x, i) => {
      if (rang.has(x.schluessel)) oben.push(x);
      else rest.push({ x, i, t: standVon(x).preisAm || 0 });
    });
    oben.sort((a, b) => rang.get(a.schluessel) - rang.get(b.schluessel));
    rest.sort((a, b) => a.t - b.t || a.i - b.i);
    return oben.concat(rest.map((r) => r.x));
  }

  /**
   * Was fuer eine Einheit (hoechstens PREISE.BLOCKGROESSE Kandidaten)
   * abzurufen ist: Produktpreise der Crafts in allen Qualitaeten (alleQ),
   * Normalpreise (q1: alle Zutaten, dazu die Veredelungsprodukte) und
   * Handelsvolumen. Faellig ist, was in mindestens einer benoetigten Stadt
   * fehlt oder ueber der Gueltigkeit liegt. `versucht` (Map "art:id" ->
   * Zeit) haelt fest, was der Scan schon angefragt hat: liefert die API eine
   * ID nicht, wird sie nicht in jedem Durchlauf erneut geholt.
   */
  function faelligFuer(einheit, e, lesen, jetzt, versucht) {
    const ek = staedteVon(e.einkaufStaedte);
    const vk = staedteVon(e.verkaufStaedte);
    const alleQ = new Set();
    const q1 = new Set();
    const absatz = new Set();
    const pMax = PREIS_MAX_MS();
    const vMax = VOLUMEN_MAX_MS();
    const offen = (art, id, max) => !(versucht && zeitFrisch(versucht.get(art + ":" + id), jetzt, max));
    if (ek.length && vk.length) {
      einheit.forEach((x) => {
        x.zutatIds.forEach((id) => {
          if (ek.some((s) => !zeitFrisch(zeitVon(lesen.preis(s, id, 1)), jetzt, pMax)) && offen("q1", id, pMax)) q1.add(id);
        });
        const pid = x.produktId;
        if (x.art === "craften") {
          if (vk.some((s) => !zeitFrisch(zeitVon(lesen.alleQ(s, pid)), jetzt, pMax)) && offen("qA", pid, pMax)) alleQ.add(pid);
        } else if (vk.some((s) => !zeitFrisch(zeitVon(lesen.preis(s, pid, 1)), jetzt, pMax)) && offen("q1", pid, pMax)) q1.add(pid);
        if (vk.some((s) => !zeitFrisch(zeitVon(lesen.absatz(s, pid, TAGE_FENSTER)), jetzt, vMax)) && offen("a", pid, vMax)) absatz.add(pid);
      });
    }
    const bl = (n) => Math.ceil(n / PREISE.BLOCKGROESSE);
    return { alleQ: Array.from(alleQ), q1: Array.from(q1), absatz: Array.from(absatz), abrufe: bl(alleQ.size) + bl(q1.size) + bl(absatz.size) };
  }

  /**
   * Obergrenze der Abrufe eines Durchlaufs, wenn nichts mehr frisch ist. Je
   * Einheit (50 Vorgaenge) hoechstens ein Abruf fuer die Produktpreise, einer
   * fuer das Handelsvolumen und einer fuer Normalpreise; dazu je volle 50
   * Normalpreis-IDs ein weiterer (jede ID wird je Durchlauf nur einmal
   * geholt). Mehr Staedte aendern die Zahl nicht (ein Abruf je Block fuer
   * alle Staedte), nur die Datenmenge.
   */
  function abrufSchaetzung(liste) {
    const q1 = new Set();
    const produkte = new Set();
    liste.forEach((x) => {
      produkte.add(x.produktId);
      x.zutatIds.forEach((id) => q1.add(id));
      if (x.art === "veredeln") q1.add(x.produktId);
    });
    const einheiten = Math.ceil(liste.length / PREISE.BLOCKGROESSE);
    const abrufe = liste.length ? 3 * einheiten + Math.ceil(q1.size / PREISE.BLOCKGROESSE) : 0;
    return { vorgaenge: liste.length, produkte: produkte.size, normalpreisIds: q1.size, einheiten, abrufe, sekunden: abrufe * 2 };
  }

  // -----------------------------------------------------------------------
  // Maschine: Zeilenbestand, Neuberechnung in Scheiben, Scanschleife. Ohne DOM.
  // -----------------------------------------------------------------------

  /** Gibt dem Browser Luft, ohne die 4-ms-Bremse verschachtelter Timer. */
  function luftHolen() {
    return new Promise((resolve) => {
      if (typeof MessageChannel !== "undefined") {
        const k = new MessageChannel();
        k.port1.onmessage = () => {
          k.port1.close();
          resolve();
        };
        k.port2.postMessage(0);
      } else setTimeout(resolve, 0);
    });
  }

  /**
   * @param {object} [o]
   * @param {object} [o.einstellungen]        Startstand (wird bereinigt)
   * @param {()=>object} [o.einstellungenLesen] gemeinsame Einstellungen, Vorgabe UI.einstellungenLesen
   * @param {()=>number} [o.jetzt]
   * @param {(ms:number)=>Promise} [o.warte]  Pause zwischen Durchlaeufen
   * @param {()=>Promise} [o.luft]            Atempause zwischen Rechenscheiben
   * @param {object} [o.lesen]                Zugriff auf den Bestand
   * @param {object} [o.graph]
   */
  function erzeugen(o) {
    o = o || {};
    const jetzt = typeof o.jetzt === "function" ? o.jetzt : () => Date.now();
    const warte = typeof o.warte === "function" ? o.warte : (ms) => new Promise((r) => setTimeout(r, ms));
    const luft = typeof o.luft === "function" ? o.luft : luftHolen;
    const lesen = o.lesen || bestandLeser();
    const gemeinsam = typeof o.einstellungenLesen === "function" ? o.einstellungenLesen : () => (typeof UI !== "undefined" && UI.einstellungenLesen ? UI.einstellungenLesen() : {});
    const hoerer = [];

    let e = einstellungenBereinigen(o.einstellungen);
    let liste = [];
    let nutzer = new Map(); // Markt-ID -> Indizes der Kandidaten, die sie als Zutat oder Produkt brauchen
    const zeilen = new Map(); // schluessel -> Zeile
    const offen = new Set(); // Indizes, die neu zu rechnen sind
    let umfangVersion = 0;
    let arbeit = null;
    let geoeffnet = false;
    let laengsteScheibeMs = 0;
    let standCache = null;
    let rangCache = null; // gilt, bis Zeilen oder Einstellungen sich aendern

    const scan = {
      lauf: 0, // Kennung der laufenden Schleife; jede Aenderung beendet die alte
      aktiv: false,
      zustand: "aus", // "aus" | "laeuft" | "ruht" | "fehler"
      durchlaufSeit: null,
      durchlaeufe: 0,
      abrufe: 0,
      abrufeDurchlauf: 0,
      fehler: null,
      versucht: new Map(),
      wecker: null,
    };

    function melden(ereignis) {
      hoerer.slice().forEach((fn) => {
        try {
          fn(ereignis);
        } catch (err) {
          if (typeof console !== "undefined") console.error(err);
        }
      });
    }

    function umfangBauen() {
      umfangVersion++;
      liste = kandidaten(e, o.graph);
      nutzer = new Map();
      liste.forEach((x, i) => {
        [x.produktId].concat(x.zutatIds).forEach((id) => {
          let m = nutzer.get(id);
          if (!m) nutzer.set(id, (m = []));
          m.push(i);
        });
      });
      zeilen.clear();
      offen.clear();
      standCache = null;
      rangCache = null;
    }

    const WERTE = ["silber", "erloes", "gewinn", "stueckJeTag", "vkStadt"];
    function scheibeRechnen(indizes) {
      const start = typeof performance !== "undefined" ? performance.now() : Date.now();
      const teil = indizes.map((i) => liste[i]);
      const neu = zeilenRechnen(teil, e, gemeinsam(), lesen, jetzt());
      const geaendert = [];
      neu.forEach((z) => {
        const alt = zeilen.get(z.schluessel);
        if (!alt || WERTE.some((f) => alt[f] !== z[f])) geaendert.push(z.schluessel);
        zeilen.set(z.schluessel, z);
      });
      rangCache = null;
      const ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - start;
      if (ms > laengsteScheibeMs) laengsteScheibeMs = ms;
      return geaendert;
    }

    async function arbeiten() {
      await PREISE.bestandBereit();
      while (offen.size) {
        const indizes = [];
        for (const i of offen) {
          indizes.push(i);
          if (indizes.length >= SCHEIBE) break;
        }
        indizes.forEach((i) => offen.delete(i));
        const geaendert = scheibeRechnen(indizes);
        standCache = null;
        melden({ typ: "zeilen", geaendert, fertig: offen.size === 0 });
        if (offen.size) await luft();
      }
    }

    /** Kandidaten neu rechnen (ohne Angabe alle), in Scheiben. */
    function anfordern(indizes) {
      if (indizes) indizes.forEach((i) => offen.add(i));
      else for (let i = 0; i < liste.length; i++) offen.add(i);
      if (!arbeit && offen.size) {
        arbeit = arbeiten().then(
          () => {
            arbeit = null;
          },
          (err) => {
            arbeit = null;
            if (typeof console !== "undefined") console.error(err);
          }
        );
      }
      return arbeit || Promise.resolve();
    }

    /** Erfuellt, sobald nichts mehr zu rechnen ist. */
    async function fertig() {
      while (arbeit) await arbeit;
    }

    function rangliste() {
      if (!rangCache) {
        const r = filtereUndSortiere(Array.from(zeilen.values()), e);
        rangCache = { zeilen: r.zeilen, ausgeblendet: r.ausgeblendet, vorgaenge: liste.length, gerechnet: zeilen.size };
      }
      return rangCache;
    }

    function standZaehlen() {
      const t = jetzt();
      if (standCache && t - standCache.um >= 0 && t - standCache.um < 3000) return standCache;
      let frisch = 0;
      liste.forEach((x) => {
        if (kandidatFrisch(kandidatStand(x, e, lesen), t)) frisch++;
      });
      standCache = { um: t, frisch };
      return standCache;
    }

    function status() {
      return {
        geoeffnet,
        vorgaenge: liste.length,
        frisch: standZaehlen().frisch,
        rechnet: !!arbeit,
        scanAn: e.scanAn,
        scan: scan.aktiv ? scan.zustand : "aus",
        durchlaufSeit: scan.aktiv ? scan.durchlaufSeit : null,
        durchlaeufe: scan.durchlaeufe,
        abrufe: scan.abrufe,
        abrufeDurchlauf: scan.abrufeDurchlauf,
        fehler: scan.fehler,
        laengsteScheibeMs,
      };
    }

    // ---- Scan ----

    function scanMeldung(zustand) {
      scan.zustand = zustand;
      melden({ typ: "status" });
    }

    /** Pause, die scanStoppen() abbricht. */
    function ruhe(ms) {
      return new Promise((resolve) => {
        let erledigt = false;
        const ende = () => {
          if (erledigt) return;
          erledigt = true;
          scan.wecker = null;
          resolve();
        };
        scan.wecker = ende;
        warte(ms).then(ende, ende);
      });
    }

    async function einheitAbrufen(f, lauf) {
      const ek = staedteVon(e.einkaufStaedte);
      const vk = staedteVon(e.verkaufStaedte);
      const alle = STAEDTE.filter((s) => ek.indexOf(s) !== -1 || vk.indexOf(s) !== -1);
      const basis = { prioritaet: "hintergrund", gruppe: SCAN_GRUPPE };
      const merken = (art, ids) => {
        const t = jetzt();
        ids.forEach((id) => scan.versucht.set(art + ":" + id, t));
      };
      const zaehlen = (n) => {
        const k = Math.ceil(n / PREISE.BLOCKGROESSE);
        scan.abrufe += k;
        scan.abrufeDurchlauf += k;
      };
      if (f.alleQ.length) {
        await PREISE.preiseAlleQualitaetenAbrufen(f.alleQ, Object.assign({ staedte: vk }, basis));
        if (lauf !== scan.lauf) return;
        merken("qA", f.alleQ);
        zaehlen(f.alleQ.length);
      }
      if (f.q1.length) {
        await PREISE.preiseAbrufen(f.q1, Object.assign({ staedte: alle, qualitaet: 1 }, basis));
        if (lauf !== scan.lauf) return;
        merken("q1", f.q1);
        zaehlen(f.q1.length);
      }
      if (f.absatz.length) {
        await PREISE.absatzAbrufen(f.absatz, Object.assign({ staedte: vk, tageFenster: TAGE_FENSTER }, basis));
        if (lauf !== scan.lauf) return;
        merken("a", f.absatz);
        zaehlen(f.absatz.length);
      }
    }

    /**
     * Die naechste Einheit: die ersten PREISE.BLOCKGROESSE Kandidaten der
     * Scanreihenfolge, fuer die etwas faellig ist. Die Reihenfolge wird vor
     * JEDER Einheit neu bestimmt: verschiebt ein Block die Rangliste, gilt
     * "oben zuerst" fuer die neue Spitze, nicht fuer die von vorhin.
     */
    function naechsteEinheit() {
      const t = jetzt();
      const reihenfolge = scanReihenfolge(liste, rangliste().zeilen.map((z) => z.schluessel), (x) => kandidatStand(x, e, lesen));
      const einheit = [];
      for (let i = 0; i < reihenfolge.length && einheit.length < PREISE.BLOCKGROESSE; i++) {
        if (faelligFuer([reihenfolge[i]], e, lesen, t, scan.versucht).abrufe) einheit.push(reihenfolge[i]);
      }
      return einheit.length ? faelligFuer(einheit, e, lesen, t, scan.versucht) : null;
    }

    /**
     * Laeuft, solange der Scan an ist. Ein Durchlauf reicht vom ersten
     * faelligen Abruf bis nichts mehr faellig ist; danach prueft die Schleife
     * alle SCAN_RUHE_MS, ob wieder etwas abgelaufen ist (von vorn bei den
     * aeltesten Daten, die Spitze der Rangliste zuerst).
     */
    async function scanSchleife(lauf) {
      await PREISE.bestandBereit();
      let imDurchlauf = false;
      while (lauf === scan.lauf) {
        await fertig(); // die Rangliste aus dem Bestand bestimmt die Reihenfolge
        if (lauf !== scan.lauf) return;
        const f = naechsteEinheit();
        if (!f) {
          if (imDurchlauf) scan.durchlaeufe++;
          imDurchlauf = false;
          scanMeldung("ruht");
          await ruhe(SCAN_RUHE_MS);
          continue;
        }
        if (!imDurchlauf) {
          imDurchlauf = true;
          scan.durchlaufSeit = jetzt();
          scan.abrufeDurchlauf = 0;
        }
        scan.fehler = null;
        scanMeldung("laeuft");
        const version = umfangVersion;
        try {
          await einheitAbrufen(f, lauf);
        } catch (err) {
          if (lauf !== scan.lauf || (err && err.abgebrochen)) return;
          scan.fehler = err && err.message ? err.message : String(err);
          scanMeldung("fehler");
          await ruhe(SCAN_FEHLER_MS);
          continue;
        }
        if (lauf !== scan.lauf) return;
        if (version === umfangVersion) {
          // Jeder abgeschlossene Block rechnet sofort neu, was seine IDs braucht.
          const betroffen = new Set();
          f.alleQ.concat(f.q1, f.absatz).forEach((id) => (nutzer.get(id) || []).forEach((n) => betroffen.add(n)));
          standCache = null;
          anfordern(Array.from(betroffen));
          melden({ typ: "status" });
        }
      }
    }

    function scanStoppen() {
      scan.lauf++;
      scan.aktiv = false;
      scan.zustand = "aus";
      PREISE.planer.abbrechen({ gruppe: SCAN_GRUPPE });
      if (scan.wecker) scan.wecker();
    }

    function scanStarten() {
      if (scan.aktiv) return;
      scan.aktiv = true;
      const lauf = ++scan.lauf;
      scanSchleife(lauf).catch((err) => {
        if (typeof console !== "undefined") console.error(err);
      });
    }

    /** Laeuft der Scan, wie er soll? Er startet nur nach dem ersten Oeffnen und mit Schalter an. */
    function scanAbgleichen(neuStart) {
      const soll = geoeffnet && e.scanAn && liste.length > 0;
      if (scan.aktiv && (!soll || neuStart)) scanStoppen();
      if (soll && !scan.aktiv) scanStarten();
      melden({ typ: "status" });
    }

    const UMFANG = ["warengruppen", "rohstoffe", "tiers", "stufen", "artefakte", "einkaufStaedte", "verkaufStaedte"];
    const RECHNEN = ["fertigungsstadt", "kaufweg", "verkaufsweg", "mitFokus"];

    /**
     * Einstellungen aendern. Scanumfang und Staedte: Kandidaten neu, alles aus
     * dem Bestand rechnen, Scan neu ansetzen. Rechen-Einstellungen: nur neu
     * rechnen, kein Abruf. Filter und Sortierung: nichts rechnen.
     * @returns {"umfang"|"rechnen"|"anzeige"} was sich geaendert hat
     */
    function einstellen(patch) {
      const neu = einstellungenBereinigen(Object.assign({}, e, patch || {}));
      const anders = (k) => JSON.stringify(neu[k]) !== JSON.stringify(e[k]);
      const umfang = UMFANG.some(anders);
      const rechnen = RECHNEN.some(anders);
      const scanSchalter = anders("scanAn");
      const verborgen = anders("scanAuchVerborgen");
      e = neu;
      rangCache = null;
      if (verborgen) PREISE.planer.einstellen({ hintergrundAuchVerborgen: e.scanAuchVerborgen });
      if (umfang) {
        umfangBauen();
        scan.versucht.clear();
        if (geoeffnet) anfordern();
        scanAbgleichen(true);
      } else if (rechnen) {
        if (geoeffnet) anfordern();
      }
      if (scanSchalter && !umfang) scanAbgleichen(false);
      melden({ typ: "einstellungen" });
      return umfang ? "umfang" : rechnen ? "rechnen" : "anzeige";
    }

    /**
     * Der Reiter wurde geoeffnet: alles aus dem Bestand rechnen (ohne Abruf),
     * beim ersten Mal den Scan starten, falls der Schalter an ist.
     */
    function oeffnen() {
      const erstes = !geoeffnet;
      geoeffnet = true;
      if (erstes) PREISE.planer.einstellen({ hintergrundAuchVerborgen: e.scanAuchVerborgen });
      const p = anfordern();
      if (erstes) scanAbgleichen(false);
      return p;
    }

    /** Gemeinsame Einstellungen haben sich geaendert (Stationssatz, Tagesbonus, Premium): neu rechnen, kein Abruf. */
    function neuRechnen() {
      return geoeffnet ? anfordern() : Promise.resolve();
    }

    function beenden() {
      scanStoppen();
      offen.clear();
      hoerer.length = 0;
    }

    umfangBauen();

    return {
      einstellungen: () => e,
      einstellen,
      oeffnen,
      neuRechnen,
      fertig,
      rangliste,
      zeile: (schluessel) => zeilen.get(schluessel) || null,
      kandidaten: () => liste,
      schaetzung: () => abrufSchaetzung(liste),
      status,
      beiAenderung(fn) {
        hoerer.push(fn);
        return () => {
          const i = hoerer.indexOf(fn);
          if (i !== -1) hoerer.splice(i, 1);
        };
      },
      beenden,
    };
  }

  // -----------------------------------------------------------------------
  // Erweiterungspunkte fuer O4 (Spalten) und O5 (Aktionen je Zeile)
  // -----------------------------------------------------------------------

  const zusatzSpalten = [];
  const aktionen = [];
  let neuZeichnen = function () {};
  let maschine = null;

  /**
   * Weitere Spalte in der Rangliste, vor "Alter".
   * @param {{id:string, kopf:string, titel?:string, zelle:(z:object)=>string, wert?:(z:object)=>number, auf?:boolean}} s
   *   zelle liefert den Zellinhalt als HTML; mit wert wird die Spalte sortierbar (Schluessel = id).
   */
  function spalteErgaenzen(s) {
    if (!s || !s.id || typeof s.zelle !== "function") return;
    if (zusatzSpalten.some((x) => x.id === s.id)) return;
    zusatzSpalten.push(s);
    if (typeof s.wert === "function") SORTIERER[s.id] = { wert: s.wert, auf: !!s.auf };
    neuZeichnen();
  }

  /**
   * Knopf je Zeile, unter dem Produktnamen.
   * @param {{id:string, text:string, titel?:string, ausfuehren:(z:object, knopf:Element)=>void}} a
   */
  function aktionErgaenzen(a) {
    if (!a || !a.id || typeof a.ausfuehren !== "function") return;
    if (aktionen.some((x) => x.id === a.id)) return;
    aktionen.push(a);
    neuZeichnen();
  }

  // -----------------------------------------------------------------------
  // Selbsttest (reine Funktionen, kein Netz, kein DOM)
  // -----------------------------------------------------------------------

  function selbsttest() {
    const ergebnisse = [];
    function pruefe(name, ok, details) {
      ergebnisse.push({ name, ok: !!ok, details: details == null ? "" : String(details) });
    }
    const std = standardEinstellungen();
    pruefe(
      "Vorgaben: alle Warengruppen und fuenf Rohstoffe, T4 bis T8, alle Stufen, ohne Artefakte, alles Lymhurst, Sofortkauf, Verkaufsorder, ohne Fokus, mind. 5 verkauft/Tag, Scan an",
      std.warengruppen.length === C.WARENGRUPPEN.length && std.rohstoffe.length === 5 && std.tiers.join() === "4,5,6,7,8" && std.stufen.join() === "0,1,2,3,4" &&
        std.artefakte === false && std.fertigungsstadt === "Lymhurst" && std.einkaufStaedte.join() === "Lymhurst" && std.verkaufStaedte.join() === "Lymhurst" &&
        std.kaufweg === "sofort" && std.verkaufsweg === "order" && std.mitFokus === false && std.minAbsatz === 5 && std.art === "beides" && std.sortierung === "marge" &&
        std.scanAn === true && std.scanAuchVerborgen === false,
      JSON.stringify(std).slice(0, 200)
    );
    const ber = einstellungenBereinigen({ warengruppen: ["sword", "fiber", "gibtsnicht"], rohstoffe: [], tiers: [9, 5], minAbsatz: -3, art: "x", sortierung: "y", kaufweg: "order", scanAn: false, einkaufStaedte: ["Martlock", "Atlantis"] });
    pruefe(
      "einstellungenBereinigen: Unbekanntes faellt weg, leere Listen bleiben leer, Fehlendes kommt aus dem Standard",
      ber.warengruppen.join() === "sword" && ber.rohstoffe.length === 0 && ber.tiers.join() === "5" && ber.minAbsatz === 0 && ber.art === "beides" && ber.sortierung === "marge" &&
        ber.kaufweg === "order" && ber.verkaufsweg === "order" && ber.scanAn === false && ber.einkaufStaedte.join() === "Martlock" && ber.verkaufStaedte.join() === "Lymhurst",
      JSON.stringify(ber)
    );
    pruefe("einstellungenBereinigen: ohne Speicherstand der Standard", JSON.stringify(einstellungenBereinigen(null)) === JSON.stringify(std), "");
    pruefe("Speicherschluessel ist albion_kostenrechner_gelegenheiten_v1", SPEICHER_KEY === "albion_kostenrechner_gelegenheiten_v1", SPEICHER_KEY);

    const klein = einstellungenBereinigen({ warengruppen: ["sword"], rohstoffe: ["ore", "hide"], tiers: [5], stufen: [0, 1] });
    const kl = kandidaten(klein);
    const ersteCraft = kl.findIndex((x) => x.art === "craften");
    pruefe(
      "kandidaten: Veredelungen zuerst, dann Crafts; Schluessel eindeutig; ohne Artefakt-Items",
      ersteCraft > 0 && kl.slice(0, ersteCraft).every((x) => x.art === "veredeln") && kl.slice(ersteCraft).every((x) => x.art === "craften" && !x.k.artefakt) &&
        new Set(kl.map((x) => x.schluessel)).size === kl.length && kl.some((x) => x.schluessel === "c:T5_MAIN_SWORD@1") && kl.some((x) => x.schluessel === "v:T5_METALBAR:0"),
      kl.length + " Vorgaenge, erste: " + kl.slice(0, 3).map((x) => x.schluessel).join(",")
    );
    const breit = kl.find((x) => x.schluessel === "c:T5_MAIN_SWORD");
    pruefe(
      "kandidaten: Zutaten als Markt-IDs (Barren und Leder der Stufe des Produkts)",
      breit && breit.zutatIds.slice().sort().join() === "T5_LEATHER,T5_METALBAR" && kl.find((x) => x.schluessel === "c:T5_MAIN_SWORD@1").zutatIds.slice().sort().join() === "T5_LEATHER_LEVEL1@1,T5_METALBAR_LEVEL1@1",
      breit && breit.zutatIds.join()
    );
    const alleStd = kandidaten(std);
    const mitArt = kandidaten(Object.assign({}, std, { artefakte: true }));
    pruefe(
      "kandidaten: Vorgabe-Umfang ist gefuellt, mit Artefakt-Items groesser, Crafts in der Reihenfolge der Warengruppen",
      alleStd.length > 1000 && mitArt.length > alleStd.length &&
        (function () {
          const folge = [];
          alleStd.forEach((x) => {
            if (x.art === "craften" && folge[folge.length - 1] !== x.cc) folge.push(x.cc);
          });
          return folge.join() === C.WARENGRUPPEN.map((w) => w.cc).filter((cc) => folge.indexOf(cc) !== -1).join();
        })(),
      alleStd.length + " / " + mitArt.length
    );

    // Bestand nachgebildet: Stadt::ID::Art -> Eintrag.
    const T0 = Date.parse("2026-11-22T12:00:00Z");
    const seite = (p) => ({ preis: p, kein: p == null, datum: "" });
    const preis = (sell, buy, am) => ({ sell: seite(sell), buy: seite(buy == null ? null : buy), abgerufenAm: am });
    function leser(daten) {
      return {
        preis: (s, id, q) => daten[s + "::" + id + "::q" + q] || null,
        alleQ: (s, id) => daten[s + "::" + id + "::qA"] || null,
        absatz: (s, id) => daten[s + "::" + id + "::a"] || null,
      };
    }
    const am = T0 - 10 * 60000;
    const daten = {
      "Lymhurst::T5_METALBAR::q1": preis(100, 80, am),
      "Lymhurst::T5_LEATHER::q1": preis(200, 150, am - 60000),
      "Lymhurst::T5_MAIN_SWORD::qA": { abgerufenAm: am, jeQ: { 1: preis(3000, 2500, am), 2: preis(2900, 2400, am) } },
      "Lymhurst::T5_MAIN_SWORD::a": { abgerufenAm: am - 120000, jeQ: { 1: { stueckJeTag: 6 }, 2: { stueckJeTag: 2 } } },
      "Lymhurst::T5_ORE::q1": preis(50, 40, am),
      "Lymhurst::T4_METALBAR::q1": preis(60, 50, am),
      "Lymhurst::T5_METALBAR::a": { abgerufenAm: am, jeQ: { 1: { stueckJeTag: 900 } } },
    };
    const einst = { premium: true, stationssaetze: { Kriegerschmiede: 0, Schmelze: 0 }, fce: 0, tagesbonus: {}, maxPreisAlterMin: null };
    const zBreit = zeilenRechnen([breit], klein, einst, leser(daten), T0)[0];
    // Breitschwert T5.0 in Lymhurst: 16 Barren a 100 + 8 Leder a 200 = 3.200,
    // Craft-Bonus Schwert (B 0,33): 3.200 / 1,33; Verkaufsorder zum
    // billigsten Angebot (2.900) minus 4 % Steuer und 2,5 % Einstellgebuehr.
    pruefe(
      "zeilenRechnen: Breitschwert aus dem Bestand, Zahlen wie in \"Craften: Gewinn\" (Kosten 3.200 / 1,33, Erloes 2.900 x 0,935, 8 verkauft/Tag)",
      zBreit && zBreit.art === "craften" && zBreit.schluessel === "c:T5_MAIN_SWORD" && Math.abs(zBreit.silber - 3200 / 1.33) < 0.01 && Math.abs(zBreit.erloes - 2900 * 0.935) < 0.01 &&
        Math.abs(zBreit.gewinn - (2900 * 0.935 - 3200 / 1.33)) < 0.01 && zBreit.stueckJeTag === 8 && zBreit.vkStadt === "Lymhurst",
      zBreit && JSON.stringify({ silber: zBreit.silber, erloes: zBreit.erloes, vol: zBreit.stueckJeTag })
    );
    (function () {
      const direkt = C.zeilenRechnen(
        [breit.k],
        [{ stadt: "Lymhurst", preiseRoh: { T5_METALBAR: daten["Lymhurst::T5_METALBAR::q1"], T5_LEATHER: daten["Lymhurst::T5_LEATHER::q1"] }, produktJeQ: { T5_MAIN_SWORD: daten["Lymhurst::T5_MAIN_SWORD::qA"].jeQ }, absatz: { T5_MAIN_SWORD: daten["Lymhurst::T5_MAIN_SWORD::a"].jeQ } }],
        auswahlCraften(klein),
        einst,
        T0
      )[0];
      pruefe(
        "zeilenRechnen: identisch zu CRAFTEN.zeilenRechnen mit denselben Preisen (keine zweite Rechnung)",
        ["silber", "erloes", "gewinn", "marge", "stueckJeTag", "rrr", "gebuehr"].every((f) => direkt[f] === zBreit[f]),
        JSON.stringify({ direkt: direkt.gewinn, hier: zBreit.gewinn })
      );
    })();
    pruefe(
      "zeilenRechnen: Alter = aeltester verwendeter Wert (Leder 11 Min., Volumen 12 Min.); die Zeile ist frisch",
      zBreit.preisAbrufAm === am - 60000 && zBreit.volAbrufAm === am - 120000 && zBreit.abrufAm === am - 120000 && !istAlt(zBreit, T0),
      [zBreit.preisAbrufAm - am, zBreit.volAbrufAm - am].join()
    );
    pruefe(
      "istAlt: Preis aelter als 30 Min. oder Volumen aelter als 60 Min. macht die Zeile alt, ein fehlender Wert ebenso",
      istAlt(zBreit, T0 + 25 * 60000) && !istAlt({ preisAbrufAm: T0, volAbrufAm: T0 - 50 * 60000 }, T0) && istAlt({ preisAbrufAm: T0, volAbrufAm: T0 - 61 * 60000 }, T0) && istAlt({ preisAbrufAm: 0, volAbrufAm: T0 }, T0),
      ""
    );
    const barren = kl.find((x) => x.schluessel === "v:T5_METALBAR:0");
    const zBarren = zeilenRechnen([barren], klein, einst, leser(daten), T0)[0];
    (function () {
      const direkt = V.zeilenRechnen(
        [barren.k],
        [{ stadt: "Lymhurst", preiseRoh: { T5_ORE: daten["Lymhurst::T5_ORE::q1"], T4_METALBAR: daten["Lymhurst::T4_METALBAR::q1"], T5_METALBAR: daten["Lymhurst::T5_METALBAR::q1"] }, absatz: { T5_METALBAR: daten["Lymhurst::T5_METALBAR::a"].jeQ } }],
        auswahlVeredeln(klein),
        einst,
        T0
      )[0];
      pruefe(
        "zeilenRechnen: Veredelung aus dem Bestand identisch zu VEREDELN.zeilenRechnen (Stahlbarren T5, Verkaufsorder)",
        zBarren && zBarren.art === "veredeln" && zBarren.silber != null && zBarren.gewinn != null && ["silber", "erloes", "gewinn", "marge", "stueckJeTag", "rrr"].every((f) => direkt[f] === zBarren[f]) && zBarren.stueckJeTag === 900,
        zBarren && JSON.stringify({ silber: zBarren.silber, erloes: zBarren.erloes, direkt: direkt.silber })
      );
    })();
    const gemischt = zeilenRechnen([breit, barren, kl.find((x) => x.schluessel === "c:T5_MAIN_SWORD@1")], klein, einst, leser(daten), T0);
    pruefe(
      "zeilenRechnen: gemischte Scheibe behaelt die Reihenfolge; ohne Preise im Bestand bleibt die Zeile ohne Ergebnis (nie Kosten 0)",
      gemischt.length === 3 && gemischt[0].schluessel === "c:T5_MAIN_SWORD" && gemischt[1].schluessel === "v:T5_METALBAR:0" && gemischt[2].schluessel === "c:T5_MAIN_SWORD@1" &&
        gemischt[2].gewinn == null && gemischt[2].silber == null && gemischt[2].abrufAm === 0 && istAlt(gemischt[2], T0),
      gemischt.map((z) => z.schluessel + ":" + z.gewinn).join(" | ")
    );
    const zOrder = zeilenRechnen([breit], Object.assign({}, klein, { kaufweg: "order", verkaufsweg: "sofort" }), einst, leser(daten), T0)[0];
    pruefe(
      "zeilenRechnen: Kauforder (Orderpreis plus 2,5 %) und Sofortverkauf (Kauforder in Normal minus Steuer) rechnen aus demselben Bestand",
      Math.abs(zOrder.silber - ((16 * 80 + 8 * 150) * 1.025) / 1.33) < 0.01 && Math.abs(zOrder.erloes - 2500 * 0.96) < 0.01,
      JSON.stringify({ silber: zOrder.silber, erloes: zOrder.erloes })
    );

    const zl = [
      { schluessel: "b", art: "craften", gewinn: 10, marge: 0.5, silber: 20, stueckJeTag: 10, abrufAm: 5 },
      { schluessel: "a", art: "veredeln", gewinn: 50, marge: 0.5, silber: 100, stueckJeTag: 7, abrufAm: 9 },
      { schluessel: "c", art: "craften", gewinn: 50, marge: 0.9, silber: 55, stueckJeTag: 2, abrufAm: 1 },
      { schluessel: "d", art: "craften", gewinn: 20, marge: 0.2, silber: 100, stueckJeTag: null, abrufAm: 1 },
      { schluessel: "e", art: "craften", gewinn: -50, marge: -0.5, silber: 100, stueckJeTag: 99, abrufAm: 1 },
      { schluessel: "f", art: "craften", gewinn: null, marge: null, silber: null, stueckJeTag: 99, abrufAm: 0 },
    ];
    const f1 = filtereUndSortiere(zl, { minAbsatz: 5, art: "beides", sortierung: "marge" });
    pruefe(
      "filtereUndSortiere: nur Gewinn, Volumenfilter Pflicht (ohne erfassten Handel faellt die Zeile heraus), Gleichstand nach Schluessel",
      f1.zeilen.map((z) => z.schluessel).join() === "a,b" && f1.ausgeblendet === 2,
      f1.zeilen.map((z) => z.schluessel).join() + " / " + f1.ausgeblendet
    );
    pruefe(
      "filtereUndSortiere: Art-Filter und Sortierungen (Gewinn, Kosten aufsteigend, verkauft/Tag, Alter)",
      filtereUndSortiere(zl, { minAbsatz: 0, art: "veredeln", sortierung: "marge" }).zeilen.map((z) => z.schluessel).join() === "a" &&
        filtereUndSortiere(zl, { minAbsatz: 0, art: "craften", sortierung: "stueck" }).zeilen.map((z) => z.schluessel).join() === "c,d,b" &&
        filtereUndSortiere(zl, { minAbsatz: 0, art: "beides", sortierung: "kosten" }).zeilen.map((z) => z.schluessel).join() === "b,c,a,d" &&
        filtereUndSortiere(zl, { minAbsatz: 0, art: "beides", sortierung: "volumen" }).zeilen.map((z) => z.schluessel).join() === "b,a,c,d" &&
        filtereUndSortiere(zl, { minAbsatz: 0, art: "beides", sortierung: "alter" }).zeilen.map((z) => z.schluessel).join() === "a,b,c,d",
      ""
    );

    const kA = { schluessel: "A" };
    const kB = { schluessel: "B" };
    const kC = { schluessel: "C" };
    const kD = { schluessel: "D" };
    const staende = { A: 500, B: 0, C: 300, D: 0 };
    pruefe(
      "scanReihenfolge: zuerst die Rangliste in ihrer Reihenfolge, dann der Rest, aelteste Preise zuerst, nie Abgerufenes vorn in fester Reihenfolge",
      scanReihenfolge([kA, kB, kC, kD], ["C"], (x) => ({ preisAm: staende[x.schluessel] })).map((x) => x.schluessel).join() === "C,B,D,A" &&
        scanReihenfolge([kA, kB, kC, kD], [], (x) => ({ preisAm: 0 })).map((x) => x.schluessel).join() === "A,B,C,D" &&
        scanReihenfolge([kA, kB, kC, kD], ["D", "A"], (x) => ({ preisAm: staende[x.schluessel] })).map((x) => x.schluessel).join() === "D,A,B,C",
      scanReihenfolge([kA, kB, kC, kD], ["C"], (x) => ({ preisAm: staende[x.schluessel] })).map((x) => x.schluessel).join()
    );

    const lf = leser(daten);
    const fFrisch = faelligFuer([breit, barren], klein, lf, T0, null);
    pruefe(
      "faelligFuer: was frisch im Bestand liegt, wird nicht abgerufen",
      fFrisch.abrufe === 0 && !fFrisch.alleQ.length && !fFrisch.q1.length && !fFrisch.absatz.length,
      JSON.stringify(fFrisch)
    );
    const fSpaeter = faelligFuer([breit, barren], klein, lf, T0 + 40 * 60000, null);
    pruefe(
      "faelligFuer: nach 40 Min. sind die Preise faellig (Craft-Produkt in allen Qualitaeten, Zutaten und Veredelungsprodukt in Normal), das Volumen (60 Min.) noch nicht",
      fSpaeter.alleQ.join() === "T5_MAIN_SWORD" && fSpaeter.q1.slice().sort().join() === "T4_METALBAR,T5_LEATHER,T5_METALBAR,T5_ORE" && fSpaeter.absatz.length === 0 && fSpaeter.abrufe === 2,
      JSON.stringify(fSpaeter)
    );
    const fStunde = faelligFuer([breit, barren], klein, lf, T0 + 70 * 60000, null);
    pruefe("faelligFuer: nach 70 Min. ist auch das Handelsvolumen faellig", fStunde.absatz.slice().sort().join() === "T5_MAIN_SWORD,T5_METALBAR" && fStunde.abrufe === 3, JSON.stringify(fStunde));
    const versucht = new Map([["qA:T5_MAIN_SWORD", T0 + 39 * 60000]]);
    pruefe(
      "faelligFuer: eine gerade angefragte ID, die die API nicht geliefert hat, wird nicht in jedem Durchlauf erneut geholt",
      faelligFuer([breit], klein, lf, T0 + 40 * 60000, versucht).alleQ.length === 0 && faelligFuer([breit], klein, lf, T0 + 80 * 60000, versucht).alleQ.length === 1,
      ""
    );
    pruefe(
      "faelligFuer: zweite Einkaufsstadt ohne Preise macht die Zutaten faellig; ohne Verkaufsstadt wird nichts abgerufen",
      faelligFuer([breit], Object.assign({}, klein, { einkaufStaedte: ["Lymhurst", "Martlock"] }), lf, T0, null).q1.slice().sort().join() === "T5_LEATHER,T5_METALBAR" &&
        faelligFuer([breit], Object.assign({}, klein, { verkaufStaedte: [] }), lf, T0 + 99 * 60000, null).abrufe === 0,
      ""
    );
    pruefe(
      "kandidatStand: aelteste Abrufzeit der Preise und des Volumens, 0 wenn etwas fehlt",
      kandidatStand(breit, klein, lf).preisAm === am - 60000 && kandidatStand(breit, klein, lf).volAm === am - 120000 &&
        kandidatStand(kl.find((x) => x.schluessel === "c:T5_MAIN_SWORD@1"), klein, lf).preisAm === 0 && kandidatFrisch(kandidatStand(breit, klein, lf), T0) &&
        !kandidatFrisch(kandidatStand(breit, klein, lf), T0 + 40 * 60000),
      JSON.stringify(kandidatStand(breit, klein, lf))
    );

    const sch = abrufSchaetzung(kl);
    const q1Ids = new Set();
    kl.forEach((x) => {
      x.zutatIds.forEach((id) => q1Ids.add(id));
      if (x.art === "veredeln") q1Ids.add(x.produktId);
    });
    pruefe(
      "abrufSchaetzung: Obergrenze 3 Abrufe je Einheit zu 50 Vorgaengen plus ein Abruf je 50 Normalpreis-IDs; die Staedte aendern die Zahl nicht",
      sch.vorgaenge === kl.length && sch.einheiten === Math.ceil(kl.length / 50) && sch.abrufe === 3 * sch.einheiten + Math.ceil(q1Ids.size / 50) && sch.normalpreisIds === q1Ids.size &&
        abrufSchaetzung(kandidaten(Object.assign({}, klein, { einkaufStaedte: STAEDTE.slice(), verkaufStaedte: STAEDTE.slice() }))).abrufe === sch.abrufe && abrufSchaetzung([]).abrufe === 0,
      JSON.stringify(sch)
    );
    (function () {
      // Die Obergrenze haelt: alle Einheiten in fester Reihenfolge, nichts im Bestand.
      const leer = leser({});
      const gemerkt = new Map();
      let abrufe = 0;
      for (let i = 0; i < alleStd.length; i += 50) {
        const f = faelligFuer(alleStd.slice(i, i + 50), std, leer, T0, gemerkt);
        abrufe += f.abrufe;
        f.alleQ.forEach((id) => gemerkt.set("qA:" + id, T0));
        f.q1.forEach((id) => gemerkt.set("q1:" + id, T0));
        f.absatz.forEach((id) => gemerkt.set("a:" + id, T0));
      }
      const s = abrufSchaetzung(alleStd);
      pruefe(
        "abrufSchaetzung: ein voller Durchlauf des Vorgabe-Umfangs ohne Bestand bleibt unter der genannten Obergrenze",
        abrufe > 0 && abrufe <= s.abrufe,
        abrufe + " Abrufe bei Obergrenze " + s.abrufe + " (" + s.vorgaenge + " Vorgaenge)"
      );
    })();

    pruefe(
      "auswahlCraften und auswahlVeredeln: dieselben Staedte, Wege und der Fokus wie im Reiter, Menge 1, ohne Zusatzbonus und eigene Preise",
      (function () {
        const g = Object.assign({}, klein, { einkaufStaedte: ["Lymhurst", "Martlock"], verkaufStaedte: ["Caerleon"], fertigungsstadt: "Martlock", kaufweg: "order", verkaufsweg: "sofort", mitFokus: true });
        const a = auswahlCraften(g);
        const b = auswahlVeredeln(g);
        return [a, b].every((x) => x.einkaufStaedte.join() === "Lymhurst,Martlock" && x.verkaufStaedte.join() === "Caerleon" && x.fertigungsstadt === "Martlock" && x.kaufweg === "order" && x.verkaufsweg === "sofort" &&
          x.mitFokus === true && x.menge === 1 && x.zusatzbonusProzent === 0 && Object.keys(x.preisUeberschreibungen).length === 0) && a.volumenAlleQualitaeten === true && b.rohstoffe.join() === "ore,hide";
      })(),
      ""
    );
    (function () {
      const vorher = Object.keys(SORTIERER).length;
      spalteErgaenzen({ id: "__test", kopf: "Test", zelle: () => "", wert: (z) => z.gewinn * 2 });
      const ok = !!SORTIERER.__test && einstellungenBereinigen({ sortierung: "__test" }).sortierung === "__test";
      zusatzSpalten.splice(zusatzSpalten.findIndex((x) => x.id === "__test"), 1);
      delete SORTIERER.__test;
      pruefe("spalteErgaenzen: eine weitere Spalte mit Wert wird sortierbar (Erweiterungspunkt fuer O4)", ok && Object.keys(SORTIERER).length === vorher, "");
    })();
    pruefe(
      "prozentText: Marge mit einer Nachkommastelle und Tausenderpunkt (25.829,6 %), kleine und negative Werte unveraendert lesbar",
      prozentText(258.296) === "25.829,6 %" && prozentText(0.574) === "57,4 %" && prozentText(0.05) === "5,0 %" && prozentText(-0.123) === "-12,3 %" && prozentText(10) === "1.000,0 %",
      [prozentText(258.296), prozentText(0.574), prozentText(-0.123)].join(" | ")
    );
    return ergebnisse;
  }

  // -----------------------------------------------------------------------
  // Oberflaeche
  // -----------------------------------------------------------------------

  const messung = { geoeffnetUm: null, ersteZeilenMs: null, fertigMs: null, zeilenBeimErsten: null };

  function boot() {
    const wurzel = document.getElementById("tab-gelegenheiten");
    if (!wurzel) return; // z.B. tests/test.html
    const el = (id) => document.getElementById(id);
    const reiterKnopf = el("tabbtn-gelegenheiten");
    const leisteEl = el("glLeiste");
    const standEl = el("glStand");
    const statusEl = el("glStatus");
    const warnungEl = el("glWarnung");
    const neuSortierenEl = el("glNeuSortieren");
    const ausgabeEl = el("glAusgabe");
    const umfangEl = el("glUmfang");
    const gruppenEl = el("glGruppen");
    const rohstoffeEl = el("glRohstoffe");
    const tiersEl = el("glTiers");
    const stufenEl = el("glStufen");
    const einkaufEl = el("glEinkauf");
    const verkaufEl = el("glVerkauf");
    const fertigungEl = el("glFertigung");
    const minAbsatzEl = el("glMinAbsatz");
    const artEl = el("glArt");

    let gespeichert = null;
    try {
      gespeichert = JSON.parse(localStorage.getItem(SPEICHER_KEY) || "null");
    } catch (err) {
      gespeichert = null;
    }
    const m = erzeugen({ einstellungen: gespeichert });
    maschine = m;
    const e = () => m.einstellungen();
    function speichern() {
      try {
        localStorage.setItem(SPEICHER_KEY, JSON.stringify(e()));
      } catch (err) {
        /* localStorage evtl. nicht verfuegbar */
      }
    }

    let namen = null;
    function nameVon(item, stufe) {
      if (!namen) {
        namen = {};
        (typeof ITEM_NAMEN !== "undefined" && ITEM_NAMEN.alle ? ITEM_NAMEN.alle : []).forEach((x) => {
          namen[x.id] = x.n;
        });
      }
      const id = PREISE.marktId(item, stufe);
      return namen[id] || (REZEPTGRAPH.namen && REZEPTGRAPH.namen[item]) || id;
    }
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/'/g, "&#39;").replace(/"/g, "&quot;");
    const fmt = (n) => (typeof UI !== "undefined" && UI.formatSilber ? UI.formatSilber(n) : String(Math.round(n)));
    const fmtFokus = (n) => (typeof UI !== "undefined" && UI.formatFokus ? UI.formatFokus(n) : String(Math.round(n)));
    const zahl = (n) => Math.round(n).toLocaleString("de-DE");
    const prozent = prozentText;
    const stueck = (n) => (n == null ? "k. A." : n >= 10 ? Math.round(n).toLocaleString("de-DE") : n.toFixed(1).replace(".", ","));
    const minText = (n) => String(n).replace(".", ",");
    const uhrzeit = (ms) => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const TRANSPORT = "Transportkosten, Gewicht und Reiserisiko sind nicht eingerechnet.";

    function icon(itemId, px, alt) {
      return (
        "<span class='vd-ic' style='width:" + px + "px;height:" + px + "px'>" +
        "<img src='" + esc(V.iconUrl(itemId, px)) + "' width='" + px + "' height='" + px + "' alt='" + esc(alt || "") + "' loading='lazy' decoding='async' onerror='this.remove()'></span>"
      );
    }

    function alterText(am, jetzt) {
      if (!(am > 0)) return "fehlt";
      const min = (jetzt - am) / 60000;
      if (min < 1) return "gerade eben";
      return min < 90 ? Math.round(min) + " Min." : min < 2880 ? Math.round(min / 60) + " Std." : Math.round(min / 1440) + " Tage";
    }

    function alterTitel(z, jetzt) {
      return (
        "Ältester verwendeter Wert dieser Zeile. Preise abgerufen " + (V.abrufAlterText(z.preisAbrufAm, jetzt) || "nie") + ", verkauft/Tag " + (V.abrufAlterText(z.volAbrufAm, jetzt) || "nie") +
        "; als frisch gelten Preise " + PREISE.PREIS_GUELTIG_MIN + " Min. und verkauft/Tag " + PREISE.VOLUMEN_GUELTIG_MIN + " Min.; ältere Zeilen frischt der Scan auf."
      );
    }

    // ---- Auswahl ----

    const veredelt = V.ROHSTOFFE.map((r) => r.cc);
    const beispiel = {};
    Object.keys(REZEPTGRAPH.items)
      .sort()
      .forEach((id) => {
        const n = REZEPTGRAPH.items[id];
        if (!n.cc || n.el || !GRUPPEN_LABEL[n.cc] || veredelt.indexOf(n.cc) !== -1) return;
        if ((n.r || []).some((r) => (r.i || []).some((z) => /_ARTEFACT_/.test(z.n)))) return;
        const bisher = beispiel[n.cc] ? REZEPTGRAPH.items[beispiel[n.cc]].t : null;
        if (bisher == null || (bisher !== 4 && (n.t === 4 || n.t < bisher))) beispiel[n.cc] = id;
      });

    const HAEUSER = [];
    C.WARENGRUPPEN.forEach((w) => {
      if (HAEUSER.indexOf(w.haus) === -1) HAEUSER.push(w.haus);
    });

    const GRUPPEN = {
      warengruppen: { el: gruppenEl, werte: C.WARENGRUPPEN.map((w) => w.cc), parse: (v) => v },
      rohstoffe: { el: rohstoffeEl, werte: V.ROHSTOFFE.map((r) => r.cc), parse: (v) => v },
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

    function auswahlAufbauen() {
      const s = e();
      gruppenEl.innerHTML = HAEUSER.map((haus) => {
        const chips = C.WARENGRUPPEN.filter((w) => w.haus === haus)
          .map((w) => chip("warengruppen", w.cc, (beispiel[w.cc] ? icon(beispiel[w.cc], 24, w.label) : "") + "<span>" + w.label + "</span>", s.warengruppen.indexOf(w.cc) !== -1, "cg-wg"))
          .join("");
        return "<div class='cg-haus'><span class='cg-haus-name'>" + haus + "</span><div class='vd-chip-reihe'>" + chips + "</div></div>";
      }).join("");
      rohstoffeEl.innerHTML = V.ROHSTOFFE.map((r) => chip("rohstoffe", r.cc, icon(r.icon, 24, r.name) + "<span>" + r.label + "</span>", s.rohstoffe.indexOf(r.cc) !== -1, "cg-wg")).join("");
      tiersEl.innerHTML = TIERS.map((t) => chip("tiers", t, "T" + t, s.tiers.indexOf(t) !== -1, "", t === 2 ? "T2 ist gebührenfrei." : "")).join("");
      stufenEl.innerHTML = STUFEN.map((st) => chip("stufen", st, "." + st, s.stufen.indexOf(st) !== -1)).join("");
      einkaufEl.innerHTML = STAEDTE.map((st) => chip("einkaufStaedte", st, st, s.einkaufStaedte.indexOf(st) !== -1)).join("");
      verkaufEl.innerHTML = STAEDTE.map((st) => chip("verkaufStaedte", st, st, s.verkaufStaedte.indexOf(st) !== -1)).join("");
      fertigungEl.innerHTML = STAEDTE.map((st) => `<option value="${esc(st)}"${st === s.fertigungsstadt ? " selected" : ""}>${st}</option>`).join("");
      artEl.innerHTML = [
        ["beides", "Beides"],
        ["craften", "Craften"],
        ["veredeln", "Veredeln"],
      ]
        .map(([wert, text]) => "<label class='vd-chip" + (s.art === wert ? " an" : "") + "'><input type='radio' name='glArt' value='" + wert + "'" + (s.art === wert ? " checked" : "") + ">" + text + "</label>")
        .join("");
      minAbsatzEl.value = s.minAbsatz;
    }

    const SCHALTER = {
      scan: { an: "Scan läuft", aus: "Scan pausiert", lesen: () => e().scanAn, setzen: (an) => m.einstellen({ scanAn: an }) },
      verborgen: { an: "Auch im Hintergrund-Tab", aus: "Nur im sichtbaren Tab", lesen: () => e().scanAuchVerborgen, setzen: (an) => m.einstellen({ scanAuchVerborgen: an }) },
      kaufweg: { an: "Eigene Kauforder", aus: "Sofortkauf", lesen: () => e().kaufweg === "order", setzen: (an) => m.einstellen({ kaufweg: an ? "order" : "sofort" }) },
      verkaufsweg: { an: "Eigene Verkaufsorder", aus: "Sofortverkauf", lesen: () => e().verkaufsweg === "order", setzen: (an) => m.einstellen({ verkaufsweg: an ? "order" : "sofort" }) },
      fokus: { an: "Mit Fokus", aus: "Ohne Fokus", lesen: () => e().mitFokus, setzen: (an) => m.einstellen({ mitFokus: an }) },
      premium: { an: "Mit Premium (4 % Steuer)", aus: "Ohne Premium (8 % Steuer)", lesen: () => UI.einstellungenLesen().premium !== false, setzen: (an) => UI.premiumSetzen(an, "gelegenheiten") },
      artefakte: { an: "Mit Artefakt-Items", aus: "Ohne Artefakt-Items", lesen: () => e().artefakte, setzen: (an) => m.einstellen({ artefakte: an }) },
    };

    function schalterSetzen() {
      Object.keys(SCHALTER).forEach((k) => {
        const btn = wurzel.querySelector("[data-gl-schalter='" + k + "']");
        if (!btn) return;
        const an = !!SCHALTER[k].lesen();
        btn.setAttribute("aria-checked", an ? "true" : "false");
        btn.querySelector(".vd-tgl-text").textContent = an ? SCHALTER[k].an : SCHALTER[k].aus;
      });
    }

    function dauerText(sekunden) {
      return sekunden < 60 ? sekunden + " s" : (Math.round((sekunden / 60) * 10) / 10).toString().replace(".", ",") + " Min.";
    }

    function umfangSetzen() {
      const s = m.schaetzung();
      const ohneStadt = !e().einkaufStaedte.length || !e().verkaufStaedte.length;
      umfangEl.textContent = !s.vorgaenge
        ? "Nichts ausgewählt."
        : ohneStadt
          ? "Mindestens eine Einkaufs- und eine Verkaufsstadt anhaken."
          : zahl(s.vorgaenge) + " Produkte, höchstens " + zahl(s.abrufe) + " Abrufe je Durchlauf, rund " + dauerText(s.sekunden);
      umfangEl.title =
        "Jede Verzauberungsstufe zählt als eigenes Produkt. Obergrenze für einen Durchlauf, in dem nichts mehr frisch ist: " + zahl(s.einheiten) + " Blöcke zu 50 Produkten mit je höchstens 3 Abrufen (Verkaufspreise, verkauft/Tag, Zutatenpreise), dazu ein Abruf je 50 der " +
        zahl(s.normalpreisIds) + " verschiedenen Zutaten und Veredelungsprodukte: " + zahl(s.einheiten) + " × 3 + " + zahl(s.abrufe - 3 * s.einheiten) + " = " + zahl(s.abrufe) + ". Üblich sind weniger. Was im Preisbestand noch frisch ist (Preise " +
        PREISE.PREIS_GUELTIG_MIN + " Min., verkauft/Tag " + PREISE.VOLUMEN_GUELTIG_MIN +
        " Min.), wird nicht abgerufen. Mehr Städte erhöhen die Zahl der Abrufe nicht (ein Abruf je Block für alle Städte), aber die Datenmenge je Abruf. Gerechnet mit 2 s je Abruf, weil die Preis-Schnittstelle drosselt (1,5 s Pause).";
    }

    const einstEl = el("glEinst");
    const kurzEl = el("glKurz");
    function kurzSetzen() {
      const s = e();
      const staedte = (liste) => (liste.length ? liste.join(", ") : "keine Stadt");
      kurzEl.textContent = [
        "Fertigung " + s.fertigungsstadt,
        "Einkauf " + staedte(s.einkaufStaedte) + (s.kaufweg === "order" ? " (Kauforder)" : " (Sofortkauf)"),
        "Verkauf " + staedte(s.verkaufStaedte) + (s.verkaufsweg === "order" ? " (Verkaufsorder)" : " (Sofortverkauf)"),
        s.mitFokus ? "mit Fokus" : "ohne Fokus",
        "mind. " + minText(s.minAbsatz) + " verkauft/Tag",
        s.art === "beides" ? null : s.art === "craften" ? "nur Craften" : "nur Veredeln",
        zahl(m.kandidaten().length) + " Produkte im Scan",
      ]
        .filter(Boolean)
        .join(" · ");
    }

    // ---- Tabelle ----

    let grenze = MAX_ZEILEN;
    let letztesZeichnen = 0;
    let zeichnenGeplant = null;
    const wartend = new Set(); // geaenderte Zeilen, die wegen Scrollens noch nicht eingeordnet sind
    let gezeichnet = new Set();

    function kopfHtml(sortierung) {
      const sortTh = (id, text, titel) => {
        const an = sortierung === id;
        const auf = SORTIERER[id] && SORTIERER[id].auf;
        return (
          "<th class='num'" + (an ? " aria-sort='" + (auf ? "ascending" : "descending") + "'" : "") + ">" +
          "<button type='button' class='vd-sortk" + (an ? " an" : "") + "' data-gl-sort='" + esc(id) + "' title='" + esc(titel) + "'>" + text + (an ? (auf ? " ▲" : " ▼") : "") + "</button></th>"
        );
      };
      return (
        "<thead><tr><th>Produkt</th><th title='Zutaten je Vorgang mit dem Einkaufspreis je Stück, ohne Einstellgebühr.'>Einkauf je Vorgang</th>" +
        "<th title='Erlös je Stück nach Steuer, bei eigener Verkaufsorder auch nach 2,5 % Einstellgebühr.'>Verkauf</th>" +
        sortTh("volumen", "verkauft/Tag", "Erfasster Handel des Produkts in der Verkaufsstadt, Mittel der letzten " + TAGE_FENSTER + " Tage. Untergrenze: gemeldet wird nur, was Spieler mit laufendem Data-Client sehen. Klicken sortiert absteigend.") +
        sortTh("kosten", "Kosten/Stück", "Material nach Rückgewinnung plus Stationsgebühr, je Stück Produkt. Klicken sortiert aufsteigend.") +
        sortTh("stueck", "Gewinn/Stück", "Erlös nach Steuer minus Kosten, je Stück. Klicken sortiert absteigend.") +
        sortTh("marge", "Marge", "Gewinn bezogen auf die eigenen Kosten. Klicken sortiert absteigend.") +
        zusatzSpalten.map((s) => (typeof s.wert === "function" ? sortTh(s.id, esc(s.kopf), s.titel || "") : "<th class='num'" + (s.titel ? " title='" + esc(s.titel) + "'" : "") + ">" + esc(s.kopf) + "</th>")).join("") +
        sortTh("alter", "Alter", "Ältester verwendeter Wert der Zeile (Preise oder verkauft/Tag). Klicken zeigt die frischesten zuerst.") +
        "</tr></thead>"
      );
    }

    function zutatenHtml(z, mehrEk, order) {
      return (z.zutatenPreise || [])
        .map((x) => {
          const name = nameVon(x.n, x.stufe);
          const titel =
            mehrEk && x.alle && x.alle.length > 1
              ? x.alle
                  .slice()
                  .sort((a, b) => (a.basis == null) - (b.basis == null) || a.basis - b.basis)
                  .map((a) => a.stadt + ": " + (a.basis == null ? "kein Preis" : fmt(Math.round(a.basis)) + (a.stadt === x.stadt ? "  ✓" : "")))
                  .join("\n")
              : (order ? "Höchste Kauforder" : "Günstigste Verkaufsorder") + " in " + x.stadt + (x.roh && x.roh.abgerufenAm ? ", abgerufen " + V.abrufAlterText(x.roh.abgerufenAm) : "");
          return (
            "<div class='gl-zutat' title='" + esc(titel) + "'>" + icon(x.n, 20, "") +
            "<span class='gl-zname'>" + Math.round(x.menge * 100) / 100 + "× " + esc(name) + "</span>" +
            "<span class='num'>" + fmt(Math.round(x.basisPreis * 100) / 100) + "</span>" +
            (mehrEk ? "<span class='vd-stadt' title='" + esc("Günstigste angehakte Einkaufsstadt für diese Zutat. " + TRANSPORT) + "'>" + esc(x.stadt) + "</span>" : "") +
            "</div>"
          );
        })
        .join("");
    }

    function zeileHtml(z, k) {
      const name = nameVon(z.item, z.stufe);
      const istCraft = z.art === "craften";
      const artText = (istCraft ? "Craften" : "Veredeln") + " · " + (GRUPPEN_LABEL[z.cc] || z.cc);
      const qText = istCraft && k.order && z.qualifizierbar && z.sellQualitaet > 1 ? REGELN.QUALITAETEN[z.sellQualitaet - 1] : "";
      const erloesTitel =
        k.mehrVk && z.vkAlle && z.vkAlle.length > 1
          ? "Erlös je Stück nach Steuer je Stadt:\n" +
            z.vkAlle
              .slice()
              .sort((a, b) => (a.netto == null) - (b.netto == null) || b.netto - a.netto)
              .map((a) => a.stadt + ": " + (a.netto == null ? "kein Preis" : fmt(Math.round(a.netto)) + (a.stadt === z.vkStadt ? "  ✓" : "")))
              .join("\n")
          : "Erlös je Stück nach Steuer" + (k.order ? " und 2,5 % Einstellgebühr" : "") + (z.vkStadt ? " in " + z.vkStadt : "");
      const preisTitel =
        (k.order ? (istCraft ? "Günstigste Verkaufsorder über alle Qualitäten" : "Günstigste Verkaufsorder") : istCraft ? "Höchste Kauforder in Normal" : "Höchste Kauforder") +
        (qText ? ", günstigstes Angebot in " + qText + " (unter Normal)" : "") + (z.vkStadt ? " in " + z.vkStadt : "");
      const volTitel =
        "Erfasster Handel in " + (z.vkStadt || "") + ", Mittel der letzten " + TAGE_FENSTER + " Tage" + (istCraft && z.qualifizierbar ? ", alle Qualitäten zusammen" : "") +
        ". Untergrenze: gemeldet wird nur, was Spieler mit laufendem Data-Client sehen.";
      const alt = istAlt(z, k.jetzt);
      const knoepfe = aktionen.length
        ? "<div class='gl-aktionen'>" + aktionen.map((a) => "<button type='button' class='mini' data-gl-aktion='" + esc(a.id) + "'" + (a.titel ? " title='" + esc(a.titel) + "'" : "") + ">" + esc(a.text) + "</button>").join("") + "</div>"
        : "";
      return (
        "<tr class='vd-gewinn" + (alt ? " gl-alt" : "") + "' data-gl-zeile='" + esc(z.schluessel) + "'>" +
        "<td><div class='vd-produkt'>" + icon(z.marktId, 40, name) + "<div><div class='vd-pname'>" + esc(name) + "</div>" +
        "<div class='vd-klein'" + (z.ausbeute > 1 ? " title='Ein Vorgang ergibt " + z.ausbeute + " Stück.'" : "") + ">T" + z.tier + "." + z.vorgangsStufe + " · " + esc(artText) + (z.stadtbonus ? " · Stadtbonus" : "") + "</div>" +
        knoepfe + "</div></div></td>" +
        "<td><div class='gl-zutaten" + (k.mehrEk ? " mit-stadt" : "") + "'>" + zutatenHtml(z, k.mehrEk, k.kauforder) + "</div></td>" +
        "<td><div class='vd-erloes' title='" + esc(erloesTitel) + "'>" + fmt(z.erloes) + "</div>" +
        "<div class='vd-klein' title='" + esc(preisTitel) + "'>Preis " + fmt(z.produktPreis) + (qText ? " (" + qText + ")" : "") + "</div>" +
        (k.mehrVk && z.vkStadt ? "<div><span class='vd-stadt' title='" + esc("Angehakte Verkaufsstadt mit dem höchsten Erlös. " + TRANSPORT) + "'>" + esc(z.vkStadt) + "</span></div>" : "") +
        "</td>" +
        "<td class='num' title='" + esc(volTitel) + "'>" + stueck(z.stueckJeTag) + "</td>" +
        "<td class='num'>" + fmt(z.silber) + (z.fokusJeVorgang > 0 ? "<div class='vd-klein'>" + fmtFokus(z.fokusJeVorgang) + " Fokus/Vorgang</div>" : "") + "</td>" +
        "<td class='num vd-wert'>" + fmt(z.gewinn) + "</td>" +
        "<td class='num vd-wert2'>" + prozent(z.marge) + "</td>" +
        zusatzSpalten.map((s) => "<td class='num'>" + s.zelle(z) + "</td>").join("") +
        "<td class='num gl-alter' title='" + esc(alterTitel(z, k.jetzt)) + "'>" + alterText(z.abrufAm, k.jetzt) + "</td>" +
        "</tr>"
      );
    }

    function zeichnen() {
      if (zeichnenGeplant) {
        clearTimeout(zeichnenGeplant);
        zeichnenGeplant = null;
      }
      letztesZeichnen = performance.now();
      wartend.clear();
      neuSortierenEl.hidden = true;
      const r = m.rangliste();
      const s = e();
      const st = m.status();
      gezeichnet = new Set();
      if (!r.zeilen.length) {
        const info = PREISE.bestandInfo();
        let text;
        if (!st.geoeffnet || st.rechnet) text = "Rechne aus dem Preisbestand ...";
        else if (!r.vorgaenge) text = "Der Scanumfang ist leer: mindestens eine Warengruppe oder einen Rohstoff, ein Tier und eine Verzauberung anhaken.";
        else if (!s.einkaufStaedte.length || !s.verkaufStaedte.length) text = "Mindestens eine Einkaufs- und eine Verkaufsstadt anhaken.";
        else if (!info.preise) text = s.scanAn ? "Der Preisbestand ist noch leer. Der Scan holt die Preise, die ersten Zeilen erscheinen nach wenigen Abrufen." : "Der Preisbestand ist leer und der Scan ist pausiert.";
        else
          text =
            "Von " + zahl(r.vorgaenge) + " Produkten im Scanumfang zeigt gerade keines Gewinn bei mindestens " + minText(s.minAbsatz) + " verkauft/Tag" +
            (r.ausgeblendet ? " (" + zahl(r.ausgeblendet) + " mit Gewinn unter „Mind. verkauft/Tag“)" : "") + ".";
        ausgabeEl.innerHTML = "<div class='vd-leer'>" + esc(text) + "</div>";
        statusSetzen();
        return;
      }
      const k = zeilenKontext();
      const sichtbar = r.zeilen.slice(0, grenze);
      sichtbar.forEach((z) => gezeichnet.add(z.schluessel));
      const rest = r.zeilen.length - sichtbar.length;
      ausgabeEl.innerHTML =
        "<div class='vd-tabrahmen'><table class='vd-tabelle gl-tabelle'>" + kopfHtml(s.sortierung) + "<tbody>" + sichtbar.map((z) => zeileHtml(z, k)).join("") + "</tbody></table></div>" + mehrKnopfHtml(rest);
      if (messung.geoeffnetUm != null && messung.ersteZeilenMs == null) {
        messung.ersteZeilenMs = performance.now() - messung.geoeffnetUm;
        messung.zeilenBeimErsten = sichtbar.length;
      }
      statusSetzen();
    }
    neuZeichnen = function () {
      if (m.status().geoeffnet) zeichnen();
    };

    function zeilenKontext() {
      const s = e();
      return {
        jetzt: Date.now(),
        order: s.verkaufsweg === "order",
        kauforder: s.kaufweg === "order",
        mehrEk: V.schilderZeigen(s.einkaufStaedte),
        mehrVk: V.schilderZeigen(s.verkaufStaedte),
      };
    }

    function mehrKnopfHtml(rest) {
      return rest > 0 ? "<div class='gl-mehr'><button type='button' class='mini' data-gl-mehr='1'>Mehr anzeigen (noch " + zahl(rest) + ")</button></div>" : "";
    }

    /** Weitere Zeilen anhaengen, ohne die schon gezeigten umzuordnen. */
    function mehrZeigen() {
      const tbody = ausgabeEl.querySelector("tbody");
      if (!tbody) return;
      const alle = m.rangliste().zeilen.filter((z) => !gezeichnet.has(z.schluessel));
      const weitere = alle.slice(0, MAX_ZEILEN);
      const k = zeilenKontext();
      tbody.insertAdjacentHTML("beforeend", weitere.map((z) => zeileHtml(z, k)).join(""));
      weitere.forEach((z) => gezeichnet.add(z.schluessel));
      grenze += weitere.length;
      const alt = ausgabeEl.querySelector(".gl-mehr");
      if (alt) alt.remove();
      ausgabeEl.insertAdjacentHTML("beforeend", mehrKnopfHtml(alle.length - weitere.length));
    }

    /** Liest der Nutzer gerade in der Liste? Dann wird nicht umsortiert. */
    function istGescrollt() {
      if (wurzel.style.display === "none") return false;
      return ausgabeEl.getBoundingClientRect().top < leisteEl.offsetHeight + 8;
    }

    function zeichnenPlanen() {
      if (zeichnenGeplant) return;
      const warten = Math.max(0, 300 - (performance.now() - letztesZeichnen));
      zeichnenGeplant = setTimeout(() => {
        zeichnenGeplant = null;
        // Zwischenzeitlich gescrollt: nicht mehr umsortieren.
        if (istGescrollt() && gezeichnet.size) wartendZeigen();
        else zeichnen();
      }, warten);
    }

    function wartendZeigen() {
      const rang = new Set(m.rangliste().zeilen.map((z) => z.schluessel));
      let n = 0;
      wartend.forEach((s) => {
        if (rang.has(s) || gezeichnet.has(s)) n++;
      });
      neuSortierenEl.hidden = n === 0;
      neuSortierenEl.textContent = "Neu sortieren (" + zahl(n) + " geändert)";
      alterAuffrischen();
      statusSetzen();
    }

    /** Altersangaben der sichtbaren Zeilen nachziehen, ohne die Liste umzubauen. */
    function alterAuffrischen() {
      const jetzt = Date.now();
      ausgabeEl.querySelectorAll("tr[data-gl-zeile]").forEach((tr) => {
        const z = m.zeile(tr.dataset.glZeile);
        if (!z) return;
        const zelle = tr.querySelector(".gl-alter");
        if (!zelle) return;
        const text = alterText(z.abrufAm, jetzt);
        if (zelle.textContent !== text) zelle.textContent = text;
        zelle.title = alterTitel(z, jetzt);
        tr.classList.toggle("gl-alt", istAlt(z, jetzt));
      });
    }

    function statusSetzen() {
      const st = m.status();
      const s = e();
      const r = m.rangliste();
      let scanText;
      if (!st.scanAn) scanText = "";
      else if (st.scan === "laeuft") scanText = "Durchlauf seit " + uhrzeit(st.durchlaufSeit);
      else if (st.scan === "fehler") scanText = "Abruf gescheitert, neuer Versuch in 1 Min.";
      else if (st.scan === "ruht") scanText = st.frisch >= st.vorgaenge ? "alles frisch" : "nichts abzurufen";
      else scanText = "";
      standEl.textContent = zahl(st.frisch) + " von " + zahl(st.vorgaenge) + " frisch" + (scanText ? " · " + scanText : "");
      standEl.title =
        "Frisch heißt: Preise höchstens " + PREISE.PREIS_GUELTIG_MIN + " Min. und verkauft/Tag höchstens " + PREISE.VOLUMEN_GUELTIG_MIN + " Min. alt. Gerechnet wird auch mit älteren Werten, die Zeile nennt dann ihr Alter." +
        (st.scanAn ? " Der Scan frischt zuerst auf, was in der Rangliste oben steht, dann den Rest, die ältesten Werte zuerst." : " Der Scan ist pausiert.") +
        (st.abrufe ? " Abrufe des Scans seit dem Laden: " + zahl(st.abrufe) + ", in diesem Durchlauf " + zahl(st.abrufeDurchlauf) + "." : "") +
        (st.fehler ? " Letzter Fehler: " + st.fehler : "");
      leisteEl.dataset.scan = st.scanAn ? st.scan : "aus";
      const saetze = UI.einstellungenLesen().stationssaetze || {};
      const fehlend = C.stationenFuer(s.warengruppen).concat(V.stationenFuer(s.rohstoffe)).filter((g, i, a) => a.indexOf(g) === i && saetze[g] == null);
      statusEl.textContent =
        zahl(r.zeilen.length) + (r.zeilen.length === 1 ? " Gelegenheit" : " Gelegenheiten") +
        (r.ausgeblendet ? ", " + zahl(r.ausgeblendet) + " unter „Mind. verkauft/Tag“" : "");
      statusEl.title = "Zeilen mit Gewinn und mindestens " + minText(s.minAbsatz) + " verkauft/Tag.";
      warnungEl.hidden = !fehlend.length;
      warnungEl.textContent = "Stationssatz fehlt für " + fehlend.length + " Gebäude";
      warnungEl.title = fehlend.length
        ? "Ohne Stationssatz wird mit 0 Gebühr gerechnet, der Gewinn fällt dann zu hoch aus: " + fehlend.map((g) => ({ Jaegerhuette: "Jägerhütte", Kueche: "Küche" }[g] || g.replace(/ \(.*\)$/, ""))).join(", ") + ". Eintragen in „Craften: Gewinn“, „Veredeln leveln“ oder im Kostenrechner."
        : "";
    }

    // ---- Ereignisse ----

    m.beiAenderung((ev) => {
      if (ev.typ === "zeilen") {
        if (ev.fertig && messung.geoeffnetUm != null && messung.fertigMs == null) messung.fertigMs = performance.now() - messung.geoeffnetUm;
        ev.geaendert.forEach((s) => wartend.add(s));
        if (istGescrollt() && gezeichnet.size) {
          if (ev.fertig) wartendZeigen();
        } else if (ev.geaendert.length || ev.fertig || !gezeichnet.size) zeichnenPlanen();
      } else if (ev.typ === "status") statusSetzen();
    });

    function geaendert(art) {
      speichern();
      schalterSetzen();
      if (art === "umfang") {
        umfangSetzen();
        grenze = MAX_ZEILEN;
      }
      kurzSetzen();
      // Eine Aenderung durch den Nutzer zeichnet immer neu, auch wenn gescrollt
      // ist: Filter und Sortierung sofort, alles andere nach dem Rechnen.
      if (m.status().geoeffnet && m.status().rechnet) m.fertig().then(zeichnen);
      else zeichnen();
    }

    wurzel.addEventListener("change", (ev) => {
      const box = ev.target.closest("input[data-gruppe]");
      if (box) {
        const g = GRUPPEN[box.dataset.gruppe];
        box.closest(".vd-chip").classList.toggle("an", box.checked);
        const an = Array.from(g.el.querySelectorAll("input:checked")).map((x) => g.parse(x.value));
        geaendert(m.einstellen({ [box.dataset.gruppe]: g.werte.filter((w) => an.indexOf(w) !== -1) }));
        return;
      }
      if (ev.target.name === "glArt") {
        artEl.querySelectorAll(".vd-chip").forEach((c) => c.classList.toggle("an", c.querySelector("input").checked));
        grenze = MAX_ZEILEN;
        geaendert(m.einstellen({ art: ev.target.value }));
        return;
      }
      if (ev.target === fertigungEl) geaendert(m.einstellen({ fertigungsstadt: fertigungEl.value }));
      else if (ev.target === minAbsatzEl) {
        geaendert(m.einstellen({ minAbsatz: minAbsatzEl.value }));
        minAbsatzEl.value = e().minAbsatz;
      }
    });

    wurzel.addEventListener("click", (ev) => {
      const schalter = ev.target.closest("[data-gl-schalter]");
      if (schalter) {
        const name = schalter.dataset.glSchalter;
        const s = SCHALTER[name];
        const art = s.setzen(!s.lesen());
        if (name === "scan" || name === "verborgen") {
          // Der Scan-Schalter sitzt in der mitlaufenden Leiste: die Liste bleibt, wie sie ist.
          speichern();
          schalterSetzen();
          statusSetzen();
        } else geaendert(art);
        return;
      }
      const alle = ev.target.closest("button[data-gl-alle]");
      if (alle) {
        const name = alle.dataset.glAlle;
        const g = GRUPPEN[name];
        const art = m.einstellen({ [name]: alle.dataset.glWert === "1" ? g.werte.slice() : [] });
        auswahlAufbauen();
        geaendert(art);
        return;
      }
      const sortKnopf = ev.target.closest("[data-gl-sort]");
      if (sortKnopf) {
        geaendert(m.einstellen({ sortierung: sortKnopf.dataset.glSort }));
        return;
      }
      if (ev.target.closest("[data-gl-mehr]")) {
        mehrZeigen();
        return;
      }
      if (ev.target === neuSortierenEl) {
        zeichnen();
        return;
      }
      const aktion = ev.target.closest("button[data-gl-aktion]");
      if (aktion) {
        const a = aktionen.find((x) => x.id === aktion.dataset.glAktion);
        const tr = aktion.closest("tr[data-gl-zeile]");
        const z = tr ? m.zeile(tr.dataset.glZeile) : null;
        if (a && z) a.ausfuehren(z, aktion);
      }
    });

    // Gemeinsame Einstellungen der App: neu rechnen, kein Abruf.
    [UI.TAGESBONUS_EVENT, UI.STATIONSSAETZE_EVENT, UI.PREMIUM_EVENT].forEach((name) => {
      document.addEventListener(name, () => {
        schalterSetzen();
        if (!m.status().geoeffnet) return;
        m.neuRechnen();
        m.fertig().then(zeichnen);
      });
    });

    if (reiterKnopf) {
      reiterKnopf.addEventListener("click", () => {
        if (messung.geoeffnetUm == null) messung.geoeffnetUm = performance.now();
        // Jedes Oeffnen rechnet aus dem Bestand neu: was ein anderer Reiter inzwischen abgerufen hat, zaehlt mit.
        m.oeffnen();
        statusSetzen();
      });
    }

    // Altersangaben und der Zaehler "frisch" altern auch ohne Abruf.
    setInterval(() => {
      if (wurzel.style.display === "none" || !m.status().geoeffnet) return;
      alterAuffrischen();
      statusSetzen();
    }, 30000);

    einstEl.open = e().einstellungenOffen;
    einstEl.addEventListener("toggle", () => {
      m.einstellen({ einstellungenOffen: einstEl.open });
      speichern();
    });
    auswahlAufbauen();
    schalterSetzen();
    umfangSetzen();
    kurzSetzen();
    speichern();
    ausgabeEl.innerHTML = "<div class='vd-leer'>Rechne aus dem Preisbestand ...</div>";
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }

  return {
    SPEICHER_KEY,
    SCHEIBE,
    MAX_ZEILEN,
    SCAN_GRUPPE,
    SCAN_RUHE_MS,
    SORTIERER,
    standardEinstellungen,
    einstellungenBereinigen,
    auswahlCraften,
    auswahlVeredeln,
    kandidaten,
    zeilenRechnen,
    istAlt,
    sortiere,
    filtereUndSortiere,
    kandidatStand,
    scanReihenfolge,
    faelligFuer,
    abrufSchaetzung,
    erzeugen,
    spalteErgaenzen,
    aktionErgaenzen,
    /** Die Maschine des Reiters in der App (null in tests/test.html). */
    maschine: () => maschine,
    messung,
    prozentText,
    selbsttest,
  };
})();
