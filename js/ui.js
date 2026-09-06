// js/ui.js
//
// Oberflaeche des Kostenrechners: Suche, Ergebnis, aufklappbarer Bauplan,
// Alle-Wege-Tabelle und Einstellungen (Charakter/Station, Handel,
// Beschaffung), s. kostenrechner-PLAN.md Abschnitt 6/P5. Baut auf
// RECHENKERN.kosten() und PREISE auf, kein eigener Rechenweg hier.
//
// Modul-Aufbau wie regeln.js/rechenkern.js: reine Hilfsfunktionen zuerst
// (testbar ohne DOM, s. tests/test.html), danach die DOM-Verdrahtung in
// boot(). boot() beendet sich sofort, wenn das App-Markup fehlt (z.B. auf
// der Testseite), damit dieselbe Datei dort gefahrlos mitgeladen werden kann.

const UI = (function () {
  "use strict";

  const EINSTELLUNGEN_KEY = "albion_kostenrechner_einstellungen";
  const EINSTELLUNGEN_SCHEMA = 1;

  function defaultEinstellungen() {
    return {
      schema: EINSTELLUNGEN_SCHEMA,
      stadt: "Lymhurst", // Craft-Stadt der gesamten Rechnung (Kaufen, Craften, Verkaufen), s. CLAUDE.md "Craft-Kategorie zu Gebaeude"
      // Qualitaetsstufen (Feature 05.09.2026): globale Zielqualitaet fuer die
      // gesamte Rechnung (0 = Normal = unveraendertes Verhalten), analog zur
      // Stadt-Einstellung persistiert. qualitaetsChancenpunkte ist der vom
      // Nutzer am Schicksalsbrett abgelesene Bonus fuer Korns Craft-
      // Qualitaetswurf, vorlaeufig 0 (s. CLAUDE.md "Craft-Qualitaetswurf"),
      // bleibt wie die Stationssaetze ein echtes Eingabefeld, keine Konstante.
      qualitaetsIndex: 0,
      qualitaetsChancenpunkte: 0,
      fce: 0, // 0 = volle Rohfokuskosten, die konservative Richtung (zu teuer statt zu billig)
      fceAusnahmen: {}, // craftingcategory -> FCE (Freitext-Fallback, s. spezialisierung unten)
      // Spezialisierungsknoten-Panel (05.09.2026, Zyklus "FCE-Ableitung ueber
      // Schicksalsbrett-Knotenliste je Kategorie"): craftingcategory -> { meisterschaft, knoten }.
      // knoten ist gruppenSchluessel (REGELN.gruppenSchluesselVonItem) -> Stufe.
      // meisterschaft gilt nur fuer Kategorien mit getrenntem Meisterschaftsknoten
      // (REGELN.SPEZ_TYP[...].einFeld === false); bei "uebrige Werkzeuge" (fused)
      // bleibt es ungenutzt. Ersetzt die fruehere fceAusSchicksalsbrett()-Quick-
      // Konvertierung (Meisterschaft x 30 + EINE Spezialisierung x 250), die den
      // Mutual-Anteil anderer Knoten ignorierte, s. regeln.js fuer die Herleitung.
      spezialisierung: {},
      // Fokuseinsatz steuerbar machen (Feature 05.09.2026): fokusRegelJeKategorie
      // (craftingcategory -> "immer"|"nie") gilt fuer JEDES Vorkommen dieser
      // Kategorie im ganzen Baum, genau wie fceAusnahmen oben.
      // fokusUebersteuerungJeKnoten ("item@stufe" -> "immer"|"nie") schlaegt das
      // fuer einen einzelnen Knoten, ueber den Fokus-Schalter im Bauplan gesetzt.
      // Fehlt ein Eintrag, bleibt es bei der bisherigen Automatik (Zielfunktion
      // entscheidet je Schritt). Beide bewusst dauerhaft in localStorage, nicht
      // nur fuer die aktuelle Berechnung: ein Knoten wie "T4_CLOTH_LEVEL3@3"
      // taucht potenziell in vielen verschiedenen Bauplaenen wieder auf (jedes
      // Item, das verzauberten T4-Stoff braucht), und der Nutzer soll seine
      // einmal getroffene Entscheidung nicht bei jedem neuen Suchbegriff
      // verlieren - identisch zur bestehenden Persistenz von fceAusnahmen.
      fokusRegelJeKategorie: {},
      fokusUebersteuerungJeKnoten: {},
      fokuswert: 0, // Silber je Fokuspunkt; 0 ist gueltig, verschiebt aber zu fokusintensiven Wegen
      // Bauplan-Ansicht (Zyklus "Bauplan grafisch als Baumdiagramm mit Item-
      // Icons", 05./06.09.2026): "text" (Fliesstext-Karten, bisheriges
      // Verhalten) oder "grafisch" (Baumdiagramm links->rechts mit Item-
      // Icons). Dauerhaft gemerkt wie die uebrigen Einstellungen (Nutzer-
      // Entscheidung), s. renderBauplan()/renderBauplanGrafisch() unten.
      bauplanAnsicht: "text",
      // Stationssaetze: Nutzer-Vorgabe vom 05.09.2026, pauschal 400 als Standard
      // fuer jedes Gebaeude, in jeder Stadt (der Satz ist absichtlich nicht nach
      // Stadt getrennt, s. CLAUDE.md "Craft-Kategorie zu Gebaeude": die Station
      // ist eine reale, vom Nutzer selbst gewaehlte Anlage, keine Eigenschaft der
      // Stadt). Bleibt trotzdem ein voll editierbares Eingabefeld je Gebaeude,
      // kein hartkodierter Wert in der Rechenlogik selbst, s. CLAUDE.md
      // "Spielerprofil": "Nutzungsgebuehr ... gehoert als Eingabefeld je Gebaeude,
      // nie als Konstante in den Code." 400 ist hier nur der VORBELEGTE Wert
      // dieses Feldes, keine Konstante in rechenkern.js/regeln.js. Vorher war
      // stationssaetze leer, jedes Gebaeude startete als "nicht gepflegt" und
      // machte das Ergebnis unvollstaendig, bis der Nutzer es manuell eintrug.
      stationssaetze: Array.from(new Set(Object.values(REGELN.KATEGORIE_ZU_GEBAEUDE))).reduce((acc, g) => {
        acc[g] = 400;
        return acc;
      }, {}),
      tagesbonus: {}, // craftingcategory -> "silber"|"gold", fehlt = aus
      kaufweg: "sofort",
      verkaufsweg: "order",
      premium: true,
      maxPreisAlterMin: 4320, // Vorgabe 3 Tage, frei gewaehlt, kein Spielwert
    };
  }

  function einstellungenLesen() {
    try {
      const roh = localStorage.getItem(EINSTELLUNGEN_KEY);
      if (!roh) return defaultEinstellungen();
      const daten = JSON.parse(roh);
      if (!daten || daten.schema !== EINSTELLUNGEN_SCHEMA) return defaultEinstellungen();
      const basis = defaultEinstellungen();
      basis.stadt = daten.stadt || basis.stadt;
      basis.qualitaetsIndex = daten.qualitaetsIndex != null ? daten.qualitaetsIndex : basis.qualitaetsIndex;
      basis.qualitaetsChancenpunkte = daten.qualitaetsChancenpunkte != null ? daten.qualitaetsChancenpunkte : basis.qualitaetsChancenpunkte;
      basis.fce = daten.fce != null ? daten.fce : basis.fce;
      basis.fceAusnahmen = daten.fceAusnahmen || {};
      basis.spezialisierung = daten.spezialisierung || {};
      basis.fokusRegelJeKategorie = daten.fokusRegelJeKategorie || {};
      basis.fokusUebersteuerungJeKnoten = daten.fokusUebersteuerungJeKnoten || {};
      basis.fokuswert = daten.fokuswert != null ? daten.fokuswert : basis.fokuswert;
      basis.bauplanAnsicht = daten.bauplanAnsicht === "grafisch" ? "grafisch" : basis.bauplanAnsicht;
      // Zusammenfuehren statt ersetzen: ein Gebaeude, das der Nutzer schon
      // ausdruecklich gesetzt hat (auch auf einen anderen Wert als 400), bleibt
      // erhalten. Ein Gebaeude, das im gespeicherten Stand noch fehlt (z.B. weil
      // es erst nach dem letzten Speichern zur Kategorie-Zuordnung dazukam),
      // bekommt den 400er-Standard aus defaultEinstellungen() statt leer zu
      // bleiben. S. Kommentar bei stationssaetze in defaultEinstellungen().
      basis.stationssaetze = Object.assign({}, basis.stationssaetze, daten.stationssaetze || {});
      basis.tagesbonus = daten.tagesbonus || {};
      basis.kaufweg = daten.kaufweg || basis.kaufweg;
      basis.verkaufsweg = daten.verkaufsweg || basis.verkaufsweg;
      basis.premium = daten.premium != null ? !!daten.premium : basis.premium;
      basis.maxPreisAlterMin = daten.maxPreisAlterMin !== undefined ? daten.maxPreisAlterMin : basis.maxPreisAlterMin;
      return basis;
    } catch (e) {
      return defaultEinstellungen();
    }
  }

  function einstellungenSchreiben(e) {
    try {
      localStorage.setItem(EINSTELLUNGEN_KEY, JSON.stringify(e));
    } catch (err) {
      /* Speicher voll/gesperrt, App funktioniert trotzdem weiter */
    }
  }

  // -----------------------------------------------------------------------
  // Reine Hilfsfunktionen, ohne DOM, s. tests/test.html
  // -----------------------------------------------------------------------

  /** Alle craftingcategory-Werte, die im gewaehlten Bauplan tatsaechlich vorkommen. */
  function sammleVerwendeteKategorien(weg) {
    const kategorien = [];
    function merke(cc) {
      if (cc && kategorien.indexOf(cc) === -1) kategorien.push(cc);
    }
    function besuche(w) {
      if (!w) return;
      if (w.typ === "craften") {
        merke(w.craftingcategory);
        (w.zutaten || []).forEach((z) => besuche(z.weg));
      } else if (w.typ === "verzaubern") {
        besuche(w.vorstufe);
        (w.materialien || []).forEach((m) => besuche(m.weg));
      } else if (w.typ === "reroll") {
        // Craften+Reroll (Feature "Qualitaetsstufen"): die Kategorien stecken
        // in der eingebetteten Normal-Beschaffung (weg.basis), der Reroll-
        // Schritt selbst hat keine eigene Kategorie (s. CLAUDE.md).
        besuche(w.basis);
      }
      // kaufen/gesperrt: keine Kategorie, keine Kinder
    }
    besuche(weg);
    return kategorien;
  }

  /** Alle Gebaeude/Gebuehrengruppen, die der Bauplan braucht (ueber REGELN.gebaeudeVonKategorie). */
  function sammleVerwendeteGebaeude(weg) {
    const gebaeude = [];
    sammleVerwendeteKategorien(weg).forEach((cc) => {
      const g = REGELN.gebaeudeVonKategorie(cc);
      if (g && gebaeude.indexOf(g) === -1) gebaeude.push(g);
    });
    return gebaeude;
  }

  /**
   * Knoten-Schluessel fuer knotenAlternativen (s. RECHENKERN.kosten()): bei
   * Qualitaetsstufen > 0 (Feature 05.09.2026, s. kostenBeiQualitaet() in
   * rechenkern.js) fuehrt der Rechenkern zusaetzlich eigene Schluessel
   * "item@stufe@qN" fuer qualitaetsgebundene Knoten, GETRENNT von den
   * quality-unabhaengigen "item@stufe"-Eintraegen desselben Items. weg.qualitaet
   * ist nur auf qualitaetsgebundenen weg-Objekten gesetzt (>0).
   */
  function knotenSchluessel(item, stufe, qualitaet) {
    return item + "@" + stufe + (qualitaet ? "@q" + qualitaet : "");
  }

  /**
   * Naechstbeste Alternative fuer EINEN Knoten (item, stufe[, qualitaet]) aus
   * knotenAlternativen (s. RECHENKERN.kosten()). Index 0 ist immer der
   * gewaehlte (bestbewertete) Kandidat, Index 1 die naechstbeste Alternative,
   * unabhaengig davon, ob sie gesperrt ist. null, wenn es keine zweite
   * Option gibt.
   */
  function naechstbesteAlternative(knotenAlternativen, item, stufe, qualitaet) {
    const liste = knotenAlternativen && knotenAlternativen[knotenSchluessel(item, stufe, qualitaet)];
    if (!liste || liste.length < 2) return null;
    return liste[1];
  }

  /**
   * Anzeige-Aufbereitung der Spezialisierungsknoten-Gruppen einer Kategorie
   * (05.09.2026, Zyklus "FCE-Ableitung ueber Schicksalsbrett-Knotenliste je
   * Kategorie"), fuer das Panel in den Einstellungen: pro Gruppe ein
   * Anzeigename (aus dem tiefsten verfuegbaren Tier dieser Gruppe, ueber
   * REZEPTGRAPH.namen) plus der Gruppenschluessel selbst als Tooltip/Fallback.
   * Reine Funktion (nur Lesezugriffe auf REZEPTGRAPH/REGELN), damit sie ohne
   * DOM testbar bleibt.
   * @param {string} cc
   * @returns {{schluessel:string, name:string, items:string[]}[]}
   */
  function spezKnotenAnzeigeGruppen(cc) {
    return REGELN.spezialisierungsGruppen(cc).map((g) => {
      const repraesentant = g.items[0];
      return { schluessel: g.schluessel, name: nameVonExtern(repraesentant, g.schluessel), items: g.items };
    });
  }

  /** nameVon()-Aequivalent ohne den geschlossenen boot()-Scope, fuer spezKnotenAnzeigeGruppen() oben. */
  function nameVonExtern(uniquename, fallback) {
    return (typeof REZEPTGRAPH !== "undefined" && REZEPTGRAPH.namen && REZEPTGRAPH.namen[uniquename]) || fallback || uniquename;
  }

  /** Fokus-Multiplikator einer FCE als Prozentzahl (0..100). */
  function prozentAusFce(fce) {
    return REGELN.fokusMultiplikator(fce) * 100;
  }

  /**
   * Ob ein Eigenpreis einen gesperrten Kauf-Kandidaten ueberhaupt retten
   * koennte. Deckt sich mit dem tatsaechlichen Code-Pfad in
   * rechenkern.js/preisMitGrund(): bei einem zu alten Preis wird VOR der
   * Eigenpreis-Pruefung zurueckgegeben (Eigenpreis haette dort keine
   * Wirkung), bei fehlendem/ungueltigem Marktangebot dagegen schon. Deshalb
   * hier ausdruecklich nur den "zu alt"-Fall ausschliessen, nicht generisch
   * auf "kein Preis" pruefen.
   */
  function eigenpreisKoenntHelfen(grund) {
    return typeof grund === "string" && grund.indexOf("Minuten alt") === -1;
  }

  /**
   * Sammelt alle Markt-IDs im GESAMTEN besuchten Baum (nicht nur dem
   * gewaehlten Weg), die mangels Marktpreis gesperrt sind und bei denen ein
   * Eigenpreis helfen wuerde. Nutzt knotenAlternativen, weil das jeden
   * besuchten Knoten abdeckt, nicht nur den letztlich gewaehlten Pfad.
   */
  function sammleFehlendePreise(r) {
    const gefunden = [];
    const gesehen = {};
    if (!r || !r.knotenAlternativen) return gefunden;
    Object.keys(r.knotenAlternativen).forEach((schluessel) => {
      const alle = r.knotenAlternativen[schluessel];
      const kauf = alle.filter((k) => k.typ === "kaufen")[0];
      if (kauf && kauf.gesperrt && eigenpreisKoenntHelfen(kauf.grund)) {
        const marktId = kauf.weg && kauf.weg.marktId;
        if (marktId && !gesehen[marktId]) {
          gesehen[marktId] = true;
          gefunden.push({ marktId, grund: kauf.grund, schluessel });
        }
      }
    });
    return gefunden;
  }

  /**
   * P6: alle 365 Kandidaten aus REZEPTGRAPH.nichtHandelbareKandidaten,
   * gefiltert nach Name ODER ID (Suchbegriff), alphabetisch sortiert. Reine
   * Funktion ohne DOM, damit die Filterlogik unabhaengig von der
   * Pflegeoberfläche testbar ist. Namensfallback wie ueberall in dieser
   * Datei: fehlt der deutsche Name (21 von 365 Kandidaten), zeigt die Liste
   * die uniquename statt "undefined".
   */
  function gefilterteEigenpreisKandidaten(query) {
    const kandidaten = typeof REZEPTGRAPH !== "undefined" ? REZEPTGRAPH.nichtHandelbareKandidaten || [] : [];
    const liste = kandidaten.map((id) => ({
      id,
      name: (REZEPTGRAPH.namen && REZEPTGRAPH.namen[id]) || id,
    }));
    const q = (query || "").trim().toLowerCase();
    const gefiltert = q ? liste.filter((e) => e.name.toLowerCase().indexOf(q) !== -1 || e.id.toLowerCase().indexOf(q) !== -1) : liste;
    gefiltert.sort((a, b) => a.name.localeCompare(b.name, "de"));
    return gefiltert;
  }

  /** Wie viele der gegebenen IDs (typischerweise nichtHandelbareKandidaten) einen gesetzten Eigenpreis haben. */
  function anzahlEigenpreiseGesetzt(ids) {
    const alle = PREISE.eigenpreiseAlle();
    let n = 0;
    (ids || []).forEach((id) => {
      if (alle[id] != null) n++;
    });
    return n;
  }

  function formatSilber(n) {
    return n == null || !isFinite(n) ? "-" : Math.round(n).toLocaleString("de-DE");
  }

  function formatFokus(n) {
    return n == null || !isFinite(n) ? "-" : n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  }

  /**
   * Kompakte Stueckzahl fuers Icon-Badge der grafischen Bauplan-Ansicht
   * (Nutzer-Feedback 06.09.2026: "prägnant, nicht mit zwei Nachkommastellen"):
   * toLocaleString rundet auf maximal 2 Nachkommastellen, laesst aber
   * ueberfluessige Nullen weg ("2" bleibt "2", "1.5" wird "1,5").
   */
  function formatMengeKompakt(n) {
    return n.toLocaleString("de-DE", { maximumFractionDigits: 2 }) + "×";
  }

  function formatProzent(n) {
    return n.toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " %";
  }

  function formatAlter(minuten) {
    if (minuten == null) return "unbekannt";
    if (minuten < 60) return Math.round(minuten) + " Min.";
    if (minuten < 60 * 24) return (minuten / 60).toFixed(1) + " Std.";
    return (minuten / (60 * 24)).toFixed(1) + " Tage";
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /**
   * Kurzes Label eines EINZELNEN Weges fuer die "Alle Wege"-Tabelle, inklusive
   * der Details, die einen von mehreren gleichartigen Wegen unterscheiden
   * (Rezept-Index, Kaufweg). Modul-Ebene (nicht in boot()), damit
   * wegGruppenLabel() und die Tests darauf zugreifen koennen.
   */
  function wegLabelKurz(w) {
    if (w.typ === "kaufen")
      return (
        "Kaufen (" +
        (w.weg.kaufweg === "order" ? "Kauforder" : "Sofortkauf") +
        (w.weg.eigenpreis ? ", Eigenpreis" : "") +
        ")"
      );
    if (w.typ === "craften")
      return "Craften #" + (w.weg.rezeptIndex != null ? w.weg.rezeptIndex + 1 : "?") + ", " + (w.weg.mitFokus ? "mit Fokus" : "ohne Fokus");
    if (w.typ === "verzaubern") return "Verzaubern";
    if (w.typ === "reroll") return "Craften + Reroll";
    return w.typ;
  }

  /**
   * Status-Info eines Weges (Pille + Text + Grund), wie in der "Alle Wege"-
   * Tabelle angezeigt. Modul-Ebene, weil sowohl renderAlleWege() als auch
   * die Gleichwertigkeits-Gruppierung darauf angewiesen sind: zwei Wege
   * gelten status-technisch nur dann als gleich, wenn Pille UND (bei
   * gesperrt) der angezeigte Grundtext uebereinstimmen.
   */
  function statusInfoFuerWeg(w) {
    if (w.gesperrt) return { pill: "bad", text: "gesperrt", grund: w.grund || "" };
    if (w.unvollstaendig) return { pill: "warn", text: "unvollstaendig", grund: "" };
    return { pill: "good", text: "ok", grund: "" };
  }

  /**
   * Aussagekraft der "Alle Wege"-Tabelle (Zyklus 05.09.2026):
   * fasst Wege zusammen, die beim aktuellen Rundungsstand NICHT
   * unterscheidbar sind, damit z.B. drei baugleiche Alternativrezepte der
   * Koeniglichen Gugel nicht als drei nichtssagend identische Zeilen
   * erscheinen. Gleichwertigkeits-Definition (Nutzer-Entscheidung
   * 05.09.2026): EXAKT gleich bei der ANGEZEIGTEN Rundung, siehe
   * formatSilber()/formatFokus() oben, nicht bei den Rohwerten - und nur
   * innerhalb desselben Wegtyps (kaufen/craften/verzaubern/reroll bleiben
   * fachlich getrennt, auch bei zufaellig gleichem Preis). Status (gesperrt
   * inkl. Grundtext, unvollstaendig, ok) ist Teil der Gleichheit, weil er in
   * der Tabelle sichtbar ist.
   *
   * Reine Funktion, keine DOM-Abhaengigkeit: Reihenfolge bleibt stabil
   * (erstes Vorkommen entscheidet die Position), r.alleWege kommt bereits
   * nach Zielwert sortiert herein, siehe rechenkern.js.
   *
   * @param {object[]} alleWege wie von RECHENKERN.kosten() geliefert
   * @returns {{key:string, typ:string, mitglieder:object[], silberAnzeige:string,
   *   fokusAnzeige:string, statusPill:string, statusText:string, grund:?string}[]}
   */
  function gruppiereAlleWege(alleWege) {
    const gruppenNachSchluessel = new Map();
    const reihenfolge = [];
    (alleWege || []).forEach((w) => {
      const status = statusInfoFuerWeg(w);
      const silberAnzeige = formatSilber(w.silber);
      const fokusAnzeige = formatFokus(w.fokus);
      const schluessel = [w.typ, silberAnzeige, fokusAnzeige, status.pill, status.grund].join("|");
      let gruppe = gruppenNachSchluessel.get(schluessel);
      if (!gruppe) {
        gruppe = {
          key: schluessel,
          typ: w.typ,
          mitglieder: [],
          silberAnzeige,
          fokusAnzeige,
          statusPill: status.pill,
          statusText: status.text,
          grund: status.grund || null,
        };
        gruppenNachSchluessel.set(schluessel, gruppe);
        reihenfolge.push(gruppe);
      }
      gruppe.mitglieder.push(w);
    });
    return reihenfolge;
  }

  /**
   * Anzeigetext einer Gruppe aus gruppiereAlleWege(). Bei genau einem
   * Mitglied unveraendert wegLabelKurz() (bisheriges Verhalten, keine
   * Regression fuer den Normalfall ohne Gleichstand). Bei mehreren
   * Mitgliedern ein zusammenfassendes Label mit Anzahl; bei "craften" nur
   * dann mit "mit/ohne Fokus" praezisiert, wenn ALLE Mitglieder denselben
   * Fokuseinsatz haben (bei der Koeniglichen Gugel z.B. nicht der Fall -
   * dort ist der Fokuseinsatz am Wurzelknoten selbst folgenlos, weil das
   * Item keine craftingcategory hat, s. CLAUDE.md).
   */
  function wegGruppenLabel(gruppe) {
    if (gruppe.mitglieder.length === 1) return wegLabelKurz(gruppe.mitglieder[0]);
    const anzahl = gruppe.mitglieder.length;
    let basis;
    if (gruppe.typ === "kaufen") basis = "Kaufen";
    else if (gruppe.typ === "craften") {
      const ersterFokuswert = gruppe.mitglieder[0].weg && gruppe.mitglieder[0].weg.mitFokus;
      const alleGleich = gruppe.mitglieder.every((w) => w.weg && w.weg.mitFokus === ersterFokuswert);
      basis = "Craften" + (alleGleich ? (ersterFokuswert ? " mit Fokus" : " ohne Fokus") : "");
    } else if (gruppe.typ === "verzaubern") basis = "Verzaubern";
    else if (gruppe.typ === "reroll") basis = "Craften + Reroll";
    else basis = gruppe.typ;
    return basis + " (" + anzahl + " gleichwertige Wege)";
  }

  /**
   * Sammelt die Markt-IDs aller "kaufen, gesperrt"-Knoten, die im
   * TATSAECHLICH GERENDERTEN Bauplan-Baum auftreten (nicht im gesamten
   * waehrend der Rekursion durchlaufenen Rezeptgraphen inkl. verworfener
   * Alternativrezepte, s. sammleFehlendePreise() oben fuer den bewusst
   * breiteren Fall der Eigenpreis-Pflegeliste). Traversiert dieselbe
   * weg-Struktur wie baueKnoten() in boot() (zutaten/vorstufe/materialien/
   * basis), reine Funktion ohne DOM.
   *
   * Grundlage fuer den Knopf "Handelsvolumen laden" (Zyklus "history/-
   * Handelsvolumen als Zusatzsignal bei gesperrten Preisen", 05.09.2026):
   * der Nutzer hat sich ausdruecklich fuer diesen engeren Scope entschieden
   * (nur im Bauplan-Baum sichtbare gesperrte Kaufen-Knoten, kein Abruf fuer
   * den ganzen Rezeptgraphen).
   *
   * @param {?object} weg ein weg-Objekt aus RECHENKERN.kosten() (r.weg, oder
   *   ein verschachtelter Kindknoten wie z.weg/m.weg/weg.vorstufe/weg.basis)
   * @param {Set<string>} [ids] zum Akkumulieren bei rekursiven Aufrufen
   * @returns {Set<string>} eindeutige Markt-IDs
   */
  function sammleGesperrteKaufMarktIds(weg, ids) {
    ids = ids || new Set();
    if (!weg) return ids;
    if (weg.typ === "gesperrt") {
      if (weg.ursprungsTyp === "kaufen" && weg.marktId) ids.add(weg.marktId);
      return ids;
    }
    if (weg.typ === "craften") {
      (weg.zutaten || []).forEach((z) => sammleGesperrteKaufMarktIds(z.weg, ids));
    } else if (weg.typ === "verzaubern") {
      sammleGesperrteKaufMarktIds(weg.vorstufe, ids);
      (weg.materialien || []).forEach((m) => sammleGesperrteKaufMarktIds(m.weg, ids));
    } else if (weg.typ === "reroll") {
      sammleGesperrteKaufMarktIds(weg.basis, ids);
    }
    return ids;
  }

  /**
   * Icon-URL des offiziellen Albion-Render-Diensts fuer die grafische
   * Bauplan-Ansicht (Zyklus "Bauplan grafisch als Baumdiagramm mit Item-
   * Icons", 05./06.09.2026). Reine Funktion (kein DOM), damit die URL-
   * Bildung ohne Browser testbar ist.
   *
   * WICHTIG (Befund aus der Brainstorming-Phase dieses Zyklus, nicht
   * vergessen): der Render-Dienst zaehlt Qualitaet 1-basiert (1=Normal ...
   * 5=Meisterwerk), diese App zaehlt sie 0-basiert (weg.qualitaet ist nur
   * bei qualitaetsgebundenen Knoten > 0 gesetzt, 0/undefined = Normal, s.
   * Kommentar bei weg.qualitaet in knotenSchluessel() oben). Deshalb hier
   * IMMER +1, sonst zeigt jeder Knoten die falsche Qualitaetsstufe.
   *
   * count=1 unterdrueckt den Mengen-Stapel-Aufdruck auf dem Icon (die Menge
   * zeigt die App ohnehin separat an der Baumkante). size=128 statt 48
   * (Nutzer-Feedback 06.09.2026: sichtbar unscharf bei 48 auf einer 64px+
   * Anzeigeflaeche mit Zoom-Crop) - der Browser skaliert beim Anzeigen
   * herunter, das ist schaerfer als serverseitig hochskaliert.
   *
   * "@<stufe>" haengt die echte Verzauberungsstufe an die Item-ID (Nutzer-
   * Feedback 06.09.2026: der Dienst liefert darueber den ECHTEN spielinternen
   * Farbschimmer plus die gefuellten Rauten fuer die Verzauberungsstufe direkt
   * im Bild mit - unabhaengig vom quality-Parameter, der nur den inneren
   * Rahmen (Gegenstandsqualitaet) faerbt. Ohne dieses Suffix zeigt der Dienst
   * immer die Stufe-0-Variante (leere Rauten, kein Schimmer). Live gegen den
   * Dienst geprueft (@0/@3, quality 1 und 5) bevor das hier verbaut wurde.
   * Der bisherige eigene CSS-Rahmen (--ic-color/--lvl0.."--lvl4) entfaellt
   * deshalb, das echte Icon deckt das jetzt ab; das kombinierte "T4.3"-Badge
   * und das Stueckzahl-Badge bleiben (Nutzer-Wunsch: die Textangabe soll
   * bleiben, nur der zusaetzliche Rahmen war ueberfluessig).
   *
   * AUSNAHME, live gefunden (06.09.2026): Zutaten mit eigenem "el"-Feld
   * (z.B. "T4_CLOTH_LEVEL3", el=3 - die Verzauberungsstufe steckt dort schon
   * im Namen, s. marktId() in preise.js) liefern mit zusaetzlichem "@3"-Suffix
   * einen HTTP 502 vom Render-Dienst, mit "@0" oder ganz ohne Suffix aber ein
   * gueltiges Bild. Der Markt-Dienst (AODP) akzeptiert "T4_CLOTH_LEVEL3@3"
   * durchaus (eigener, unabhaengiger Dienst mit eigener Konvention, s.
   * marktId()-Kommentar "-> @3, nicht @6") - der Render-Dienst tut das nicht.
   * Deshalb hier bewusst KEIN Suffix anhaengen, wenn REZEPTGRAPH ein eigenes
   * "el" fuer das Item kennt; nur echte Ausruestung (ohne "el") bekommt den
   * Kontext-Stufe-Suffix.
   */
  function itemIconUrl(uniquename, qualitaetIndex, stufe) {
    const q = (qualitaetIndex || 0) + 1;
    const node = (typeof REZEPTGRAPH !== "undefined" && REZEPTGRAPH.items[uniquename]) || {};
    const stufenSuffix = node.el ? "" : "@" + (stufe || 0);
    return (
      "https://render.albiononline.com/v1/item/" +
      encodeURIComponent(uniquename) +
      stufenSuffix +
      ".png?count=1&quality=" +
      q +
      "&size=128"
    );
  }

  /**
   * Aktionstyp-Badge (Farbe + Label) eines Weg-Knotens, fuer die grafische
   * Bauplan-Ansicht dieselbe Farbgebung wie die Text-Ansicht (kn-badge-*,
   * s. Kostenrechner.html). Reine Funktion, Modul-Ebene, testbar.
   */
  function bgBadgeInfo(weg) {
    if (!weg) return { cls: "", label: "" };
    if (weg.typ === "gesperrt") return { cls: "kn-badge-gesperrt", label: "Gesperrt" };
    if (weg.typ === "kaufen") return { cls: "kn-badge-kaufen", label: "Kaufen" };
    if (weg.typ === "craften") return { cls: "kn-badge-craften", label: "Craften" };
    if (weg.typ === "verzaubern") return { cls: "kn-badge-verzaubern", label: "Verzaubern" };
    if (weg.typ === "reroll") return { cls: "kn-badge-reroll", label: "Craften + Reroll" };
    return { cls: "", label: weg.typ };
  }

  // -----------------------------------------------------------------------
  // DOM-Verdrahtung. Bricht sofort ab, wenn das App-Markup fehlt (z.B. auf
  // tests/test.html, das ui.js nur wegen der Hilfsfunktionen oben mitlaedt).
  // -----------------------------------------------------------------------

  function boot() {
    const sucheEl = document.getElementById("suche");
    if (!sucheEl) return;

    const trefferListeEl = document.getElementById("trefferListe");
    const tierFilterEl = document.getElementById("tierFilter");
    const stufeEl = document.getElementById("stufe");
    const stadtEl = document.getElementById("stadt");
    const qualitaetEl = document.getElementById("qualitaet");
    const qualitaetsChancenpunkteEl = document.getElementById("qualitaetsChancenpunkte");
    const ausgewaehltEl = document.getElementById("ausgewaehlt");
    const ausgewaehltTextEl = document.getElementById("ausgewaehltText");
    const ausgewaehltIdEl = document.getElementById("ausgewaehltId");

    const berechnenBtn = document.getElementById("berechnenBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    const cacheBtn = document.getElementById("cacheBtn");
    const statusEl = document.getElementById("status");

    const unvollstaendigEl = document.getElementById("unvollstaendigHinweis");
    const heroEl = document.getElementById("hero");

    const bauplanEl = document.getElementById("bauplan");
    const alleAufBtn = document.getElementById("alleAufBtn");
    const alleZuBtn = document.getElementById("alleZuBtn");
    const volumenBtn = document.getElementById("volumenBtn");
    const bauplanAnsichtSchalterEl = document.getElementById("bauplanAnsichtSchalter");

    const alleWegeTabelleEl = document.getElementById("alleWegeTabelle");

    const fceEingabeEl = document.getElementById("fceEingabe");
    const fceProzentAnzeigeEl = document.getElementById("fceProzentAnzeige");
    const fokuswertEl = document.getElementById("fokuswert");
    const abgAbgelesenEl = document.getElementById("abgAbgelesen");
    const abgGrundfokusEl = document.getElementById("abgGrundfokus");
    const abgUebernehmenBtn = document.getElementById("abgUebernehmen");
    const fceHerkunftEl = document.getElementById("fceHerkunft");

    const spezKnotenContainerEl = document.getElementById("spezKnotenContainer");
    const spezKnotenAlleZeigenBtn = document.getElementById("spezKnotenAlleZeigenBtn");

    const fceAusnahmenTabelleEl = document.getElementById("fceAusnahmenTabelle");
    const fceAlleZeigenBtn = document.getElementById("fceAlleZeigenBtn");
    const fokusRegelTabelleEl = document.getElementById("fokusRegelTabelle");
    const fokusRegelAlleZeigenBtn = document.getElementById("fokusRegelAlleZeigenBtn");
    const tagesbonusTabelleEl = document.getElementById("tagesbonusTabelle");
    const tagAlleZeigenBtn = document.getElementById("tagAlleZeigenBtn");
    const stationTabelleEl = document.getElementById("stationTabelle");

    const kwSofortEl = document.getElementById("kwSofort");
    const kwOrderEl = document.getElementById("kwOrder");
    const vwSofortEl = document.getElementById("vwSofort");
    const vwOrderEl = document.getElementById("vwOrder");
    const premiumEl = document.getElementById("premium");
    const maxPreisAlterEl = document.getElementById("maxPreisAlter");
    const maxPreisAlterPresetsEl = document.getElementById("maxPreisAlterPresets");

    const eigenpreiseHinweisEl = document.getElementById("eigenpreiseHinweis");
    const eigenpreiseTabelleEl = document.getElementById("eigenpreiseTabelle");

    const eigenpreisPflegeSucheEl = document.getElementById("eigenpreisPflegeSuche");
    const eigenpreisPflegeZaehlerEl = document.getElementById("eigenpreisPflegeZaehler");
    const eigenpreisPflegeTabelleEl = document.getElementById("eigenpreisPflegeTabelle");

    let einstellungen = einstellungenLesen();
    let anfrageZaehler = 0; // Token gegen veraltete Preisabrufe, s. berechnen()
    let volumenAnfrageZaehler = 0; // dasselbe Muster fuer den Handelsvolumen-Abruf, s. volumenBtn-Listener

    const ALLE_KATEGORIEN = Array.from(
      new Set(
        Object.keys(REZEPTGRAPH.items)
          .map((k) => REZEPTGRAPH.items[k].cc)
          .filter(Boolean)
      )
    ).sort();
    const ALLE_GEBAEUDE = Array.from(new Set(Object.keys(REGELN.KATEGORIE_ZU_GEBAEUDE).map((k) => REGELN.KATEGORIE_ZU_GEBAEUDE[k])));

    const suchIndex = Object.keys(REZEPTGRAPH.items).map((uniquename) => ({
      uniquename,
      name: (REZEPTGRAPH.namen && REZEPTGRAPH.namen[uniquename]) || uniquename,
      tier: REZEPTGRAPH.items[uniquename].t || 0,
    }));

    const zustand = {
      item: null,
      stufe: 0,
      preiseRoh: null,
      preiseQualitaetRoh: null, // Feature "Qualitaetsstufen": zweiter, quality-spezifischer Preisdatensatz, s. berechnen()
      ergebnis: null,
      fceAlleZeigen: false,
      spezKnotenAlleZeigen: false,
      spezKnotenOffen: {}, // craftingcategory -> vom Nutzer explizit gesetzter Aufklapp-Zustand
      fokusRegelAlleZeigen: false,
      tagAlleZeigen: false,
      // Handelsvolumen-Zusatzsignal (Zyklus "history/-Handelsvolumen als
      // Zusatzsignal bei gesperrten Preisen", 05.09.2026): marktId ->
      // {umsatz7Tage, mengengewichteterPreis} | null (abgerufen, aber ohne
      // Daten). Bewusst NUR im Seitenspeicher (Nutzer-Entscheidung: kein
      // localStorage-Cache), bleibt ueber mehrere Suchen hinweg erhalten,
      // solange die Seite offen ist, s. PREISE.volumenAbrufen().
      handelsvolumen: {},
    };

    function nameVon(uniquename) {
      return (REZEPTGRAPH.namen && REZEPTGRAPH.namen[uniquename]) || uniquename;
    }

    function tierVon(uniquename) {
      return (REZEPTGRAPH.items[uniquename] && REZEPTGRAPH.items[uniquename].t) || 0;
    }

    function setStatus(text, cls) {
      statusEl.textContent = text;
      statusEl.className = cls || "";
    }

    // ---- Formular <- Einstellungen ----
    function ladeEinstellungenInFormular() {
      stadtEl.value = einstellungen.stadt;
      qualitaetEl.value = einstellungen.qualitaetsIndex;
      qualitaetsChancenpunkteEl.value = einstellungen.qualitaetsChancenpunkte;
      fceEingabeEl.value = einstellungen.fce;
      fokuswertEl.value = einstellungen.fokuswert;
      maxPreisAlterEl.value = einstellungen.maxPreisAlterMin == null ? "" : einstellungen.maxPreisAlterMin;
      premiumEl.value = einstellungen.premium ? "1" : "0";
      (einstellungen.kaufweg === "order" ? kwOrderEl : kwSofortEl).checked = true;
      (einstellungen.verkaufsweg === "order" ? vwOrderEl : vwSofortEl).checked = true;
      aktualisiereFceAnzeige();
      aktualisiereBauplanAnsichtSchalter();
    }

    /** Markiert den aktiven Text/Grafisch-Knopf im Bauplan-Panel (.an, wie die uebrigen Dreifach-Schalter). */
    function aktualisiereBauplanAnsichtSchalter() {
      if (!bauplanAnsichtSchalterEl) return;
      bauplanAnsichtSchalterEl.querySelectorAll("button").forEach((btn) => {
        btn.classList.toggle("an", btn.dataset.ansicht === einstellungen.bauplanAnsicht);
      });
    }

    function aktualisiereFceAnzeige() {
      fceProzentAnzeigeEl.textContent = "= " + formatProzent(prozentAusFce(einstellungen.fce)) + " der Rohfokuskosten";
    }

    function persistiereUndRechne() {
      einstellungenSchreiben(einstellungen);
      if (zustand.item && zustand.preiseRoh) berechneMitVorhandenenPreisen();
    }

    // ---- Suche ----
    // ARIA-Combobox-Muster (Befund 1, oberflaechen-pruefer P5): die Trefferliste
    // ist per Maus UND Tastatur erreichbar. tabindex sitzt am Suchfeld selbst
    // (Eingabefelder sind von Natur aus fokussierbar), Pfeil runter/hoch bewegen
    // die Markierung *innerhalb* der bereits geoeffneten Liste, Enter uebernimmt
    // den markierten Treffer, Escape schliesst (unveraendert). role="listbox"
    // auf dem Container und role="option" je Zeile plus aria-selected machen die
    // Markierung fuer Screenreader sichtbar, aria-activedescendant am Suchfeld
    // verbindet beides ohne den Fokus aus dem Eingabefeld zu nehmen.
    sucheEl.setAttribute("role", "combobox");
    sucheEl.setAttribute("aria-autocomplete", "list");
    sucheEl.setAttribute("aria-expanded", "false");
    sucheEl.setAttribute("aria-controls", "trefferListe");
    trefferListeEl.setAttribute("role", "listbox");

    let aktuelleTreffer = []; // aktuell gerenderte, klickbare/markierbare Zeilen (ohne "leer"/"mehr")
    let markierterIndex = -1;

    function schliesseTrefferliste() {
      trefferListeEl.hidden = true;
      sucheEl.setAttribute("aria-expanded", "false");
      sucheEl.removeAttribute("aria-activedescendant");
      markierterIndex = -1;
    }

    function markiere(index) {
      const zeilen = trefferListeEl.querySelectorAll('.zeile[role="option"]');
      markierterIndex = index;
      zeilen.forEach((z, i) => {
        const aktiv = i === index;
        z.classList.toggle("markiert", aktiv);
        z.setAttribute("aria-selected", aktiv ? "true" : "false");
      });
      if (index >= 0 && zeilen[index]) {
        sucheEl.setAttribute("aria-activedescendant", zeilen[index].id);
        zeilen[index].scrollIntoView({ block: "nearest" });
      } else {
        sucheEl.removeAttribute("aria-activedescendant");
      }
    }

    function renderTreffer() {
      const q = sucheEl.value.trim().toLowerCase();
      const tier = tierFilterEl.value;
      trefferListeEl.innerHTML = "";
      aktuelleTreffer = [];
      markierterIndex = -1;
      if (!q) {
        schliesseTrefferliste();
        return;
      }
      let treffer = suchIndex.filter((e) => e.name.toLowerCase().indexOf(q) !== -1);
      if (tier) treffer = treffer.filter((e) => String(e.tier) === tier);
      treffer.sort((a, b) => a.name.localeCompare(b.name, "de") || a.tier - b.tier);

      if (!treffer.length) {
        const nichtCraftbarGefunden = Object.keys(REZEPTGRAPH.namen || {}).some(
          (id) => !REZEPTGRAPH.items[id] && (REZEPTGRAPH.namen[id] || "").toLowerCase().indexOf(q) !== -1
        );
        const div = document.createElement("div");
        div.className = "leer";
        div.textContent = nichtCraftbarGefunden
          ? "Gefunden, aber nicht auswaehlbar: das Item existiert im Spiel, ist aber im Rezeptgraphen weder craftbar noch als Zutat verwendet. Fuer solche Items ist die Make-or-Buy-Frage sinnlos."
          : "Keine Treffer. Nur die rund 4.242 craftbaren Items bzw. Zutaten sind auswaehlbar.";
        trefferListeEl.appendChild(div);
        trefferListeEl.hidden = false;
        sucheEl.setAttribute("aria-expanded", "true");
        return;
      }

      const LIMIT = 40;
      const sichtbar = treffer.slice(0, LIMIT);
      sichtbar.forEach((e, idx) => {
        const zeile = document.createElement("div");
        zeile.className = "zeile";
        zeile.id = "treffer-opt-" + idx;
        zeile.setAttribute("role", "option");
        zeile.setAttribute("aria-selected", "false");
        const nameSpan = document.createElement("span");
        nameSpan.textContent = e.name;
        const tSpan = document.createElement("span");
        tSpan.className = "t";
        tSpan.textContent = "T" + e.tier;
        zeile.appendChild(nameSpan);
        zeile.appendChild(tSpan);
        zeile.addEventListener("click", () => waehleItem(e.uniquename, e.name));
        trefferListeEl.appendChild(zeile);
      });
      aktuelleTreffer = sichtbar;
      if (treffer.length > LIMIT) {
        const mehr = document.createElement("div");
        mehr.className = "mehr";
        mehr.textContent = "+" + (treffer.length - LIMIT) + " weitere Treffer, Suche eingrenzen";
        trefferListeEl.appendChild(mehr);
      }
      trefferListeEl.hidden = false;
      sucheEl.setAttribute("aria-expanded", "true");
    }

    function waehleItem(uniquename, name) {
      zustand.item = uniquename;
      sucheEl.value = name;
      schliesseTrefferliste();
      ausgewaehltTextEl.textContent = name + " (T" + (REZEPTGRAPH.items[uniquename].t || 0) + ")";
      ausgewaehltIdEl.textContent = uniquename;
      ausgewaehltEl.classList.add("aktiv");
      berechnenBtn.disabled = false;
      refreshBtn.disabled = false;
      berechnen(false);
    }

    sucheEl.addEventListener("input", renderTreffer);
    sucheEl.addEventListener("focus", () => {
      if (sucheEl.value.trim()) renderTreffer();
    });
    tierFilterEl.addEventListener("change", renderTreffer);
    document.addEventListener("click", (ev) => {
      if (ev.target !== sucheEl && !trefferListeEl.contains(ev.target)) schliesseTrefferliste();
    });
    sucheEl.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        schliesseTrefferliste();
        return;
      }
      if (trefferListeEl.hidden || !aktuelleTreffer.length) return;
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        markiere(Math.min(markierterIndex + 1, aktuelleTreffer.length - 1));
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        markiere(Math.max(markierterIndex - 1, 0));
      } else if (ev.key === "Enter") {
        if (markierterIndex >= 0 && aktuelleTreffer[markierterIndex]) {
          ev.preventDefault();
          const e = aktuelleTreffer[markierterIndex];
          waehleItem(e.uniquename, e.name);
        }
      }
    });

    stufeEl.addEventListener("change", () => {
      zustand.stufe = Number(stufeEl.value) || 0;
      if (zustand.item) berechnen(false);
    });

    // Stadtwechsel: Kaufen, Craften und Verkaufen laufen alle in der neuen
    // Stadt, s. kostenrechner-KONTEXT.md/Feature "Craft-Stadt waehlbar". Die
    // bisher geladenen Preise (zustand.preiseRoh) gelten fuer die ALTE Stadt
    // und duerfen nicht weiterverwendet werden - berechnen() unten ruft
    // PREISE.preiseAbrufen() erneut mit der neuen Stadt auf und ersetzt
    // zustand.preiseRoh vollstaendig. Der Preiscache selbst ist seit diesem
    // Feature stadtabhaengig (s. preise.js, cacheSchluessel()), ein
    // Stadtwechsel muss den Cache deshalb NICHT erzwungen umgehen: fuer die
    // neue Stadt gibt es dort ohnehin noch keinen (oder einen eigenen,
    // ebenfalls gueltigen) Eintrag.
    stadtEl.addEventListener("change", () => {
      einstellungen.stadt = stadtEl.value;
      einstellungenSchreiben(einstellungen);
      if (zustand.item) berechnen(false);
    });

    // Qualitaetswechsel (Feature 05.09.2026): braucht wie ein Stadtwechsel
    // einen NEUEN Preisabruf (die Qualitaets-spezifische Preisliste
    // preiseQualitaetRoh gilt nur fuer die vorher gewaehlte Qualitaet), nicht
    // nur eine Neuberechnung mit vorhandenen Preisen. Bei 0 (Normal) wird kein
    // zusaetzlicher Preisabruf gebraucht, berechnen() ueberspringt ihn dann
    // selbst (s. dort).
    qualitaetEl.addEventListener("change", () => {
      einstellungen.qualitaetsIndex = Number(qualitaetEl.value) || 0;
      einstellungenSchreiben(einstellungen);
      if (zustand.item) berechnen(false);
    });
    qualitaetsChancenpunkteEl.addEventListener("change", () => {
      // Nur der Qualitaetswurf haengt an diesem Wert, keine neuen Markt-IDs
      // noetig - persistiereUndRechne() (wie bei Fokuswert/FCE) reicht.
      einstellungen.qualitaetsChancenpunkte = Math.max(0, Number(qualitaetsChancenpunkteEl.value) || 0);
      qualitaetsChancenpunkteEl.value = einstellungen.qualitaetsChancenpunkte;
      persistiereUndRechne();
    });

    // ---- Preise laden + berechnen ----
    berechnenBtn.addEventListener("click", () => berechnen(false));
    refreshBtn.addEventListener("click", () => berechnen(true));
    cacheBtn.addEventListener("click", () => {
      PREISE.preisCacheLeeren();
      setStatus("Preis-Zwischenspeicher geleert.");
    });

    /**
     * Befund 4 (oberflaechen-pruefer, P5): schnelles Item-Wechseln waehrend
     * ein Preisabruf noch laeuft konnte den zurueckkommenden, inzwischen
     * veralteten Abruf ungeprueft in zustand.preiseRoh schreiben und damit
     * fuer das laengst angezeigte NEUE Item mit den Preisen des ALTEN
     * rechnen, ohne jede Fehlermeldung. anfrageZaehler ist ein einfaches
     * Anfrage-Token: jeder berechnen()-Aufruf zieht sich beim Start eine neue
     * Nummer, und nur der Aufruf, dessen Nummer beim Zurueckkommen noch die
     * aktuelle ist, darf zustand/die Anzeige veraendern. Eine ueberholte
     * Antwort wird still verworfen, nicht als Fehler gemeldet - ein neuerer
     * Aufruf laeuft ja bereits und meldet seinerseits Status/Fehler.
     */
    async function berechnen(erzwingen) {
      if (!zustand.item) return;
      const meinToken = ++anfrageZaehler;
      berechnenBtn.disabled = true;
      refreshBtn.disabled = true;
      const stadt = einstellungen.stadt;
      const qualitaet = einstellungen.qualitaetsIndex || 0;
      setStatus("Sammle Markt-IDs (" + stadt + ") ...");
      try {
        const ids = PREISE.sammleMarktIds(zustand.item, zustand.stufe);
        if (meinToken !== anfrageZaehler) return; // inzwischen ueberholt
        setStatus("0 / " + ids.length + " Preise abgerufen (" + stadt + ") ...");
        const preiseRoh = await PREISE.preiseAbrufen(ids, {
          erzwingen: !!erzwingen,
          stadt: stadt,
          aufFortschritt: (erledigt, gesamt) => {
            if (meinToken === anfrageZaehler) setStatus(erledigt + " / " + gesamt + " Preise abgerufen (" + stadt + ") ...");
          },
        });
        if (meinToken !== anfrageZaehler) return; // waehrend des Abrufs wurde ein neueres Item oder eine andere Stadt gewaehlt, diese Antwort ist veraltet

        // Qualitaetsstufen (Feature 05.09.2026): bei einer Zielqualitaet > 0
        // ZUSAETZLICH die kleine Preisliste der Qualitaets-/preservequality-
        // Kette in genau dieser Qualitaet abrufen (API-Qualitaet = Index + 1,
        // s. PREISE.preiseAbrufen()/REGELN.QUALITAETEN). Bleibt Normal (0)
        // gewaehlt, entfaellt dieser zweite Abruf vollstaendig.
        let preiseQualitaetRoh = {};
        if (qualitaet > 0) {
          const qualitaetsIds = PREISE.sammleQualitaetsMarktIds(zustand.item, zustand.stufe);
          if (qualitaetsIds.length) {
            setStatus("0 / " + qualitaetsIds.length + " Preise in Qualitaet " + REGELN.QUALITAETEN[qualitaet] + " abgerufen (" + stadt + ") ...");
            preiseQualitaetRoh = await PREISE.preiseAbrufen(qualitaetsIds, {
              erzwingen: !!erzwingen,
              stadt: stadt,
              qualitaet: qualitaet + 1,
              aufFortschritt: (erledigt, gesamt) => {
                if (meinToken === anfrageZaehler) setStatus(erledigt + " / " + gesamt + " Preise in Qualitaet " + REGELN.QUALITAETEN[qualitaet] + " abgerufen (" + stadt + ") ...");
              },
            });
            if (meinToken !== anfrageZaehler) return;
          }
        }

        zustand.preiseRoh = preiseRoh;
        zustand.preiseQualitaetRoh = preiseQualitaetRoh;
        berechneMitVorhandenenPreisen();
        setStatus(ids.length + " Markt-IDs, " + Object.keys(preiseRoh).length + " Preise fuer " + stadt + " geladen.", "ok");
      } catch (err) {
        if (meinToken === anfrageZaehler) setStatus("Fehler beim Preisabruf: " + err.message, "err");
      } finally {
        if (meinToken === anfrageZaehler) {
          berechnenBtn.disabled = false;
          refreshBtn.disabled = false;
        }
      }
    }

    function preiseZuOptsFormat(preiseRoh) {
      const out = {};
      Object.keys(preiseRoh).forEach((id) => {
        const e = preiseRoh[id];
        out[id] = e ? { sell: e.sell, buy: e.buy } : { sell: { kein: true }, buy: { kein: true } };
      });
      return out;
    }

    function eigenpreiseFuerOpts() {
      const alle = PREISE.eigenpreiseAlle();
      const out = {};
      Object.keys(alle).forEach((id) => {
        out[id] = alle[id].preis;
      });
      return out;
    }

    /**
     * Fuegt die kategorieweite Freitext-Ausnahme (einstellungen.fceAusnahmen,
     * "cc" -> FCE) und die aus dem Spezialisierungsknoten-Panel abgeleiteten,
     * knotenspezifischen Werte ("cc|Gruppe" -> FCE) zu EINER Map zusammen, s.
     * RECHENKERN.fceFuer() fuer die Vorrangreihenfolge. Eine Kategorie liefert
     * nur dann Knoten-Werte, wenn der Nutzer dort tatsaechlich etwas
     * eingetragen hat (Summe aller Stufen inkl. Meisterschaft > 0) - sonst
     * bliebe ein blosses Oeffnen des Panels (alle Stufen 0) faelschlich eine
     * Ueberschreibung auf "0 FCE" statt weiterhin den Freitext/globalen Wert
     * gelten zu lassen.
     */
    function fceUeberschreibungenFuerOpts() {
      const out = Object.assign({}, einstellungen.fceAusnahmen);
      Object.keys(einstellungen.spezialisierung || {}).forEach((cc) => {
        if (!REGELN.spezTypVonKategorie(cc)) return;
        const eintrag = einstellungen.spezialisierung[cc] || {};
        const knotenStufen = eintrag.knoten || {};
        const summe = Object.values(knotenStufen).reduce((a, b) => a + (b || 0), 0) + (eintrag.meisterschaft || 0);
        if (summe <= 0) return;
        REGELN.spezialisierungsGruppen(cc).forEach((g) => {
          out[cc + "|" + g.schluessel] = REGELN.fceAusSpezialisierungsknoten(cc, g.schluessel, knotenStufen, eintrag.meisterschaft);
        });
      });
      return out;
    }

    function baueOpts() {
      return {
        preise: preiseZuOptsFormat(zustand.preiseRoh || {}),
        preiseQualitaet: preiseZuOptsFormat(zustand.preiseQualitaetRoh || {}),
        eigenpreise: eigenpreiseFuerOpts(),
        kaufweg: einstellungen.kaufweg,
        stadt: einstellungen.stadt,
        qualitaetsIndex: einstellungen.qualitaetsIndex || 0,
        qualitaetsChancenpunkte: einstellungen.qualitaetsChancenpunkte || 0,
        stationssaetze: einstellungen.stationssaetze,
        fce: einstellungen.fce,
        fceUeberschreibungen: fceUeberschreibungenFuerOpts(),
        fokusRegelJeKategorie: einstellungen.fokusRegelJeKategorie,
        fokusUebersteuerungJeKnoten: einstellungen.fokusUebersteuerungJeKnoten,
        fokuswert: einstellungen.fokuswert,
        tagesbonus: einstellungen.tagesbonus,
        maxPreisAlterMin:
          einstellungen.maxPreisAlterMin === "" || einstellungen.maxPreisAlterMin == null
            ? null
            : Number(einstellungen.maxPreisAlterMin),
      };
    }

    function berechneMitVorhandenenPreisen() {
      if (!zustand.item) return;
      const r = RECHENKERN.kosten(zustand.item, zustand.stufe, 1, baueOpts());
      zustand.ergebnis = r;
      renderAlles(r);
    }

    // ---- Rendering ----
    function renderAlles(r) {
      renderHero(r);
      renderUnvollstaendig(r);
      renderBauplan(r);
      renderAlleWege(r);
      renderSpezialisierungsknoten(r);
      renderFceAusnahmen(r);
      renderFokusRegel(r);
      renderTagesbonus(r);
      renderStationTabelle(r);
      renderEigenpreiseTabelle(r);
    }

    /**
     * Preisalter fuer die Anzeige im Bauplan. Verwendet ABSICHTLICH dasselbe
     * Datum wie die Sperrlogik in rechenkern.js/preisMitGrund() (das echte
     * Marktdatum aus der API, sell_price_min_date/buy_price_max_date), NICHT
     * PREISE.eintragAlterMinuten() (das misst nur, wann diese App den Preis
     * zuletzt selbst abgerufen hat, "abgerufenAm"). Beide Groessen koennen
     * weit auseinanderliegen: ein Preis kann Minuten seit dem letzten
     * App-Abruf im Cache liegen, aber Stunden alt sein, weil ihn seither
     * niemand am Markt aktualisiert hat. Vorher zeigte diese Funktion das
     * Cache-Alter an, waehrend preisMitGrund() bereits mit dem echten,
     * deutlich aelteren Marktdatum sperrte - der Nutzer sah "vor 0 Min." bei
     * einem Preis, den die App selbst als ueber drei Stunden alt bewertete.
     * Welche Marktseite (sell/buy) zaehlt, folgt derselben Regel wie dort:
     * Sofortkauf -> sell, Kauforder -> buy.
     */
    function alterFuerMarktId(marktId) {
      const eintrag = zustand.preiseRoh && zustand.preiseRoh[marktId];
      if (!eintrag) return { text: "unbekannt", stale: false };
      const seite = einstellungen.kaufweg === "order" ? eintrag.buy : eintrag.sell;
      if (!seite || seite.kein || !seite.datum) return { text: "unbekannt", stale: false };
      const alterMs = Date.now() - REGELN.parseApiDatumUtc(seite.datum);
      if (!isFinite(alterMs)) return { text: "unbekannt", stale: false };
      const min = alterMs / 60000;
      const grenze = einstellungen.maxPreisAlterMin;
      const stale = grenze != null && grenze !== "" && min > Number(grenze);
      return { text: "vor " + formatAlter(min), stale };
    }

    function berechneGewinn(r) {
      const marktId = PREISE.marktId(zustand.item, zustand.stufe);
      // Qualitaetsstufen (Feature 05.09.2026): der Verkaufserloes muss aus der
      // GEWAEHLTEN Zielqualitaet stammen, nicht aus dem Normal-Preis - genau
      // das belegt die Motivation des Features (Gelehrtengugel T4.4 Normal
      // 53.043 gegen Exzellent 71.581). preiseQualitaetRoh ist nur bei
      // qualitaet > 0 befuellt (s. berechnen()).
      const qualitaet = einstellungen.qualitaetsIndex || 0;
      const quelle = qualitaet > 0 ? zustand.preiseQualitaetRoh : zustand.preiseRoh;
      const eintrag = quelle && quelle[marktId];
      if (!eintrag) return null;
      // Sofortverkauf: buy_price_max (eintrag.buy). Verkaufsorder: sell_price_min (eintrag.sell). S. CLAUDE.md "Handelskonventionen".
      const seite = einstellungen.verkaufsweg === "order" ? eintrag.sell : eintrag.buy;
      if (!seite || seite.kein || seite.preis == null) return null;
      const steuersatz = einstellungen.premium ? REGELN.STEUER_PREMIUM : REGELN.STEUER_OHNE_PREMIUM;
      const sug = REGELN.steuerUndGebuehr(seite.preis, { steuersatz, mitEinstellgebuehr: einstellungen.verkaufsweg === "order" });
      return {
        gewinn: sug.netto - r.silber,
        hinweis:
          (einstellungen.verkaufsweg === "order" ? "Verkaufsorder" : "Sofortverkauf") +
          ", " +
          Math.round(steuersatz * 100) +
          " % Steuer" +
          (qualitaet > 0 ? ", Qualitaet " + REGELN.QUALITAETEN[qualitaet] : ""),
      };
    }

    function renderHero(r) {
      if (r.gesperrt) {
        heroEl.className = "hero gesperrt";
        heroEl.innerHTML =
          "<div class='k'>Kein Weg verfuegbar</div><div class='w'>" + escapeHtml(r.grund || "") + "</div>";
        return;
      }
      heroEl.className = "hero";
      const wegLabel = { kaufen: "Kaufen", craften: "Craften", verzaubern: "Verzaubern", reroll: "Craften + Reroll" }[r.weg.typ] || r.weg.typ;
      const gewinnInfo = berechneGewinn(r);
      let html = "<div class='cols'>";
      html += "<div><div class='k'>Guenstigster Weg</div><div class='v'>" + wegLabel + "</div></div>";
      html += "<div><div class='k'>Kosten</div><div class='v'>" + formatSilber(r.silber) + "</div><div class='w'>Silber</div></div>";
      html += "<div><div class='k'>Fokus</div><div class='v'>" + formatFokus(r.fokus) + "</div></div>";
      if (gewinnInfo) {
        html +=
          "<div><div class='k'>Gewinn</div><div class='v'>" +
          formatSilber(gewinnInfo.gewinn) +
          "</div><div class='w'>" +
          escapeHtml(gewinnInfo.hinweis) +
          "</div></div>";
      } else {
        html += "<div><div class='k'>Gewinn</div><div class='v'>-</div><div class='w'>Kein Verkaufsangebot fuer den gewaehlten Verkaufsweg</div></div>";
      }
      html += "</div>";
      heroEl.innerHTML = html;
    }

    function renderUnvollstaendig(r) {
      if (!r.gesperrt && r.unvollstaendig) {
        unvollstaendigEl.hidden = false;
        unvollstaendigEl.innerHTML =
          "<b>Ergebnis unvollstaendig:</b> Stationssatz fehlt fuer " +
          r.fehlendeGebaeude.map(escapeHtml).join(", ") +
          ". Silber und Zielwert sind eine Untergrenze, die echten Kosten liegen mindestens so hoch. Satz unten bei Stationssaetze eintragen.";
      } else {
        unvollstaendigEl.hidden = true;
      }
    }

    /**
     * Kurzform der naechstbesten Alternative fuer die Detailzeile: sichtbar nur
     * "Alt.: Craften 135.290", die volle Erklaerung (Grund bei gesperrt, "Silber"
     * ausgeschrieben) steckt im title-Tooltip. Ergonomie-Umbau 05.09.2026: vorher
     * stand der volle Satz immer ausgeschrieben in der Zeile, obwohl er im
     * Alltag selten gebraucht wird (s. kostenrechner-KONTEXT.md). Gibt es keine
     * Alternative, wird nichts angezeigt statt eines Fuelltexts.
     */
    function altBeschreibungKurz(alt) {
      if (!alt) return "";
      let kurz, voll;
      if (alt.gesperrt) {
        kurz = "gesperrt";
        voll = "Naechstbeste Alternative: gesperrt (" + (alt.grund || "") + ")";
      } else {
        const typLabel = { kaufen: "Kaufen", craften: "Craften", verzaubern: "Verzaubern", reroll: "Craften+Reroll" }[alt.typ] || alt.typ;
        kurz = typLabel + " " + formatSilber(alt.silber);
        voll = "Naechstbeste Alternative: " + typLabel + " fuer " + formatSilber(alt.silber) + " Silber";
      }
      return " <span class='kn-alt' title='" + escapeHtml(voll) + "'>Alt.: " + escapeHtml(kurz) + "</span>";
    }

    /**
     * Eigene (per-Stueck) Kosten eines Knotens, itemgenerisch nutzbar fuer
     * Wurzel, Zutat, Material und Vorstufe gleichermassen: r.knotenAlternativen
     * fuehrt je "item@stufe" die sortierte Kandidatenliste, Index 0 ist immer
     * der guenstigste/tatsaechlich gewaehlte (s. rechenkern.js kostenGesamt(),
     * "alle" wird VOR dem Ablegen in knotenAlternativen aufsteigend sortiert).
     * Craften-/Verzaubern-Knoten tragen ihre eigenen Silber/Fokus-Werte NICHT
     * in sich selbst (nur die umschliessenden zutatenWeg-/materialien-
     * Eintraege kennen silberJeStueck/fokusJeStueck) - das war der Grund,
     * warum der Bauplan bisher gar keine Kosten je Knoten anzeigte. Diese
     * Funktion liest sie stattdessen ueber den globalen, bereits vorhandenen
     * Index nach, ohne die Rechenlogik selbst anzufassen.
     */
    function eigenerKandidat(r, weg) {
      const liste = r && r.knotenAlternativen && r.knotenAlternativen[knotenSchluessel(weg.item, weg.stufe, weg.qualitaet)];
      return liste && liste[0] ? liste[0] : null;
    }

    // ---- Knoten-Uebersteuerung des Fokuseinsatzes (Feature "Fokuseinsatz
    // steuerbar machen"): der bestehende "(Rezept #n, mit/ohne Fokus)"-Text im
    // Bauplan wird interaktiv statt eine zusaetzliche Liste/Haken-Sammlung zu
    // bauen (Ergonomie-Vorgabe: wenige, auffindbare Regeln statt vieler Haken -
    // dieser Schalter sitzt bereits genau dort, wo der Nutzer sowieso
    // hinschaut). Klick zyklisch automatisch -> immer -> nie -> automatisch.
    // Persistiert dauerhaft je "item@stufe" in einstellungen.fokusUebersteuerungJeKnoten,
    // s. Kommentar bei defaultEinstellungen().
    const FOKUS_REGEL_REIHENFOLGE = ["automatisch", "immer", "nie"];
    function fokusUebersteuerungLabel(regel, mitFokus) {
      if (regel === "immer") return "immer mit Fokus";
      if (regel === "nie") return "nie mit Fokus";
      return mitFokus ? "mit Fokus" : "ohne Fokus"; // automatisch: zeigt die tatsaechlich gewaehlte Variante
    }
    function baueFokusSchalter(weg) {
      const eigenerSchluessel = weg.item + "@" + weg.stufe;
      const aktuell = einstellungen.fokusUebersteuerungJeKnoten[eigenerSchluessel] || "automatisch";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fokus-schalter" + (aktuell !== "automatisch" ? " uebersteuert" : "");
      btn.textContent = fokusUebersteuerungLabel(aktuell, weg.mitFokus);
      btn.title =
        "Fokuseinsatz fuer diesen Knoten (" +
        eigenerSchluessel +
        "). Klicken zum Umschalten: automatisch -> immer -> nie -> automatisch. Automatisch heisst, die Zielfunktion (Silber + Fokus x Fokuswert) entscheidet wie bisher. Schlaegt die Fokus-Regel je Kategorie in den Einstellungen.";
      btn.addEventListener("click", (ev) => {
        // preventDefault + stopPropagation: der Klick sitzt in einem <summary>,
        // ohne beides wuerde er zusaetzlich den umgebenden <details>-Knoten
        // auf-/zuklappen statt nur den Schalter zu bedienen.
        ev.preventDefault();
        ev.stopPropagation();
        const i = FOKUS_REGEL_REIHENFOLGE.indexOf(aktuell);
        const neu = FOKUS_REGEL_REIHENFOLGE[(i + 1) % FOKUS_REGEL_REIHENFOLGE.length];
        if (neu === "automatisch") delete einstellungen.fokusUebersteuerungJeKnoten[eigenerSchluessel];
        else einstellungen.fokusUebersteuerungJeKnoten[eigenerSchluessel] = neu;
        persistiereUndRechne();
      });
      return btn;
    }

    /**
     * Ergonomie-Umbau des Bauplans (05.09.2026, "Bauplan-Ansicht ergonomisch
     * ueberarbeiten"): vorher eine einzige lange Fliesstextzeile je Knoten mit
     * Aktionstyp, Item, Rezept-Index, Fokus-Flag, Stationsgebuehr samt Gebaeude,
     * Rueckgewinnung UND der vollen "naechstbeste Alternative"-Erklaerung in
     * einem Satz; Farbe faerbte nur die ganze Zeile im Aktionsfarbton ein.
     * Jetzt zwei Zeilen je Knoten:
     *   kn-zeile (primaer, immer sichtbar): farbiges Badge des Aktionstyps,
     *     Menge (nur bei Zutat/Material/Vorstufe), Item.Stufe fett, bei
     *     Craften der Fokus-Schalter, Warn-Badges (unvollstaendig/kein
     *     Ruecklauf/Eigenpreis), rechtsbuendig die tatsaechlichen Kosten
     *     GENAU DIESES Knotens (Silber, ggf. Fokus).
     *   kn-detail (sekundaer, kleiner/gedaempft): Rezept-Index,
     *     Stationsgebuehr samt Gebaeude, genaue Rueckgewinnung bzw. Kaufweg,
     *     dazu die naechstbeste Alternative in Kurzform mit vollem Text im
     *     title-Tooltip.
     * Die Kosten je Knoten sind eine neue ANZEIGE, keine neue Berechnung:
     * eigenerKandidat() liest sie aus dem bereits vorhandenen
     * r.knotenAlternativen, das es seit dem Fokus-Feature schon gibt, aber
     * bisher im Baum nirgends gezeigt wurde.
     *
     * Die Ruecklauf-Prozentzahl je Zutat entfaellt bewusst (s. kostenrechner-
     * KONTEXT.md): sie ist rechnerisch IMMER identisch mit der Rueckgewinnung,
     * die der umschliessende Craften-Knoten ohnehin schon in seiner eigenen
     * Detailzeile zeigt (beide stammen aus demselben rrrWert in
     * rechenkern.js), einzige Ausnahme ist "Ruecklauf ausgeschlossen" bei
     * erreichter Mengenobergrenze je Material - das bleibt als eigenes
     * Warn-Badge erhalten, alles Weitere waere reine Wiederholung gewesen.
     */
    /**
     * Handelsvolumen-Zusatzsignal fuer einen gesperrten Kaufen-Knoten
     * (Zyklus "history/-Handelsvolumen als Zusatzsignal bei gesperrten
     * Preisen", 05.09.2026): CLAUDE.md dokumentiert, dass prices/ fuer ein
     * Item dauerhaft leer bleiben kann, obwohl am Markt tatsaechlich Angebote
     * liegen. Das history/-Handelsvolumen kann die Sperre nicht aufheben
     * (kein Preis heisst weiterhin nicht verfuegbar, s. Plan 4.1) und wird
     * auch nicht dafuer verwendet, zeigt aber zusaetzlich, ob am Markt
     * ueberhaupt gehandelt wird. Rendert nur fuer echte "kaufen, gesperrt"-
     * Knoten (ursprungsTyp+marktId gesetzt) und erst NACHDEM der Knopf
     * "Handelsvolumen laden" tatsaechlich geklickt wurde (zustand.
     * handelsvolumen ist bis dahin leer).
     */
    function wegVolumenHtml(weg) {
      if (!weg || weg.ursprungsTyp !== "kaufen" || !weg.marktId) return "";
      const info = zustand.handelsvolumen[weg.marktId];
      if (info === undefined) return "";
      if (info === null) {
        return "<span class='kn-volumen' title='Handelsvolumen (history/) abgerufen, aber keine Daten fuer diese Markt-ID.'>Handelsvolumen: keine Daten</span>";
      }
      const text =
        info.umsatz7Tage > 0
          ? formatSilber(info.umsatz7Tage) + " Stk / 7 Tage" + (info.mengengewichteterPreis != null ? ", " + formatSilber(info.mengengewichteterPreis) + " Silber im Schnitt" : "")
          : "kein Umsatz in den letzten 7 Tagen";
      return (
        "<span class='kn-volumen' title='7-Tage-Handelsvolumen (history/-Endpunkt) mit mengengewichtetem Durchschnittspreis. Zusatzsignal, ob am Markt ueberhaupt gehandelt wird - ersetzt keinen Preis und hebt die Sperre nicht auf.'>" +
        escapeHtml(text) +
        "</span>"
      );
    }

    function baueGesperrtZeile(weg, kante) {
      weg = weg || {};
      const div = document.createElement("div");
      div.className = "kn-zeile kn-zeile-gesperrt";
      div.innerHTML =
        "<span class='kn-badge kn-badge-gesperrt'>Gesperrt</span>" +
        (kante ? "<span class='kn-menge'>" + escapeHtml(kante.label) + "</span>" : "") +
        "<span class='kn-name'>" + escapeHtml(nameVon(weg.item)) + (weg.stufe ? "." + weg.stufe : "") + "</span>" +
        "<span class='kn-grund'>" + escapeHtml(weg.grund || "") + "</span>" +
        wegVolumenHtml(weg);
      return div;
    }

    /** Qualitaets-Badge fuer einen qualitaetsgebundenen Knoten (Feature 05.09.2026), leer bei Normal (0/fehlt). */
    function qualitaetBadgeHtml(qualitaet) {
      if (!qualitaet) return "";
      return "<span class='kn-qualitaet' title='Zielqualitaet dieses Schritts'>" + escapeHtml(REGELN.QUALITAETEN[qualitaet]) + "</span>";
    }

    function baueKnoten(weg, r, tiefe, kante) {
      const wrap = document.createElement("div");
      if (!weg) return wrap;

      if (weg.typ === "gesperrt") {
        wrap.appendChild(baueGesperrtZeile(weg, kante));
        return wrap;
      }

      const alt = naechstbesteAlternative(r.knotenAlternativen, weg.item, weg.stufe, weg.qualitaet);
      const altHtml = altBeschreibungKurz(alt);
      const mengeHtml = kante ? "<span class='kn-menge'>" + escapeHtml(kante.label) + "</span>" : "";
      const qualitaetHtml = qualitaetBadgeHtml(weg.qualitaet);
      const ausschlussHtml =
        kante && kante.ausschluss
          ? "<span class='kn-flag kn-flag-ausschluss' title='Mengenobergrenze fuer dieses Material erreicht: es wird bei der Rueckgewinnung dieses Crafts nicht mehr beruecksichtigt.'>kein Ruecklauf</span>"
          : "";

      if (weg.typ === "reroll") {
        // Craften+Reroll (Feature "Qualitaetsstufen"): Normal beschaffen (Vorstufe
        // in weg.basis, ueber baueKnoten() rekursiv gerendert), dann an der
        // Reparaturstation auf die Zielqualitaet hochrerollen. Reroll selbst
        // kostet nur Silber (kein Fokus, keine Station, keine Zutatenliste, s.
        // CLAUDE.md "Qualitaet rerollen an der Reparaturstation"), deshalb keine
        // eigene Zutatenliste im body, nur die eine Vorstufen-Kante.
        const details = document.createElement("details");
        details.open = tiefe < 2;
        const summary = document.createElement("summary");
        summary.className = "zeile-reroll";
        const eigenReroll = eigenerKandidat(r, weg);
        const zeile = document.createElement("div");
        zeile.className = "kn-zeile";
        zeile.innerHTML =
          "<span class='kn-badge kn-badge-reroll'>Reroll</span>" +
          mengeHtml +
          "<span class='kn-name'>" + escapeHtml(nameVon(weg.item)) + (weg.stufe ? "." + weg.stufe : "") + "</span>" +
          qualitaetHtml +
          ausschlussHtml +
          (weg.unvollstaendig
            ? "<span class='kn-flag kn-flag-unvoll' title='Stationssatz fuer mindestens ein Gebaeude fehlt. Silber ist eine Untergrenze.'>unvollstaendig</span>"
            : "") +
          "<span class='kn-spacer'></span>" +
          "<span class='kn-kosten'>" + formatSilber(eigenReroll && eigenReroll.silber) + " Silber</span>" +
          (eigenReroll && eigenReroll.fokus ? "<span class='kn-fokus'>" + formatFokus(eigenReroll.fokus) + " Fokus</span>" : "");
        summary.appendChild(zeile);

        const detail = document.createElement("div");
        detail.className = "kn-detail";
        detail.innerHTML =
          "Reroll-Silber " + formatSilber(weg.rerollSilber) + " (Gegenstandswert " + formatSilber(weg.itemWertJeStueck) + "), Normal->" + escapeHtml(REGELN.QUALITAETEN[weg.qualitaet]) + altHtml;
        summary.appendChild(detail);
        details.appendChild(summary);

        const body = document.createElement("div");
        body.className = "body";
        body.appendChild(baueKnoten(weg.basis, r, tiefe + 1, { label: "Normal beschaffen" }));
        details.appendChild(body);
        wrap.appendChild(details);
        return wrap;
      }

      if (weg.typ === "kaufen") {
        const details = document.createElement("details");
        details.open = tiefe < 1;
        const summary = document.createElement("summary");
        summary.className = "zeile-kaufen";
        const alterInfo = alterFuerMarktId(weg.marktId);
        const zeile = document.createElement("div");
        zeile.className = "kn-zeile";
        zeile.innerHTML =
          "<span class='kn-badge kn-badge-kaufen'>Kaufen</span>" +
          mengeHtml +
          "<span class='kn-name'>" + escapeHtml(nameVon(weg.item)) + (weg.stufe ? "." + weg.stufe : "") + "</span>" +
          qualitaetHtml +
          ausschlussHtml +
          (weg.eigenpreis
            ? "<span class='kn-flag kn-flag-eigen' title='Kein Marktpreis, sondern eine hinterlegte eigene Schaetzung.'>Eigenpreis</span>"
            : "") +
          "<span class='kn-spacer'></span>" +
          "<span class='kn-kosten'>" + formatSilber(weg.preisJeStueck) + " Silber</span>" +
          (!weg.eigenpreis
            ? "<span class='kn-alter" + (alterInfo.stale ? " stale" : "") + "' title='Alter des Marktpreises'>" + escapeHtml(alterInfo.text) + "</span>"
            : "");
        summary.appendChild(zeile);
        const detail = document.createElement("div");
        detail.className = "kn-detail";
        detail.innerHTML = (weg.kaufweg === "order" ? "Kauforder" : "Sofortkauf") + altHtml;
        summary.appendChild(detail);
        details.appendChild(summary);
        wrap.appendChild(details);
        return wrap;
      }

      if (weg.typ === "craften") {
        const details = document.createElement("details");
        details.open = tiefe < 2;
        const summary = document.createElement("summary");
        summary.className = "zeile-craften";

        const zeile = document.createElement("div");
        zeile.className = "kn-zeile";
        zeile.innerHTML =
          "<span class='kn-badge kn-badge-craften'>Craften</span>" +
          mengeHtml +
          "<span class='kn-name'>" + escapeHtml(nameVon(weg.item)) + (weg.stufe ? "." + weg.stufe : "") + "</span>" +
          qualitaetHtml;
        summary.appendChild(zeile);
        zeile.appendChild(baueFokusSchalter(weg));

        const flags = document.createElement("span");
        let flagsHtml = ausschlussHtml;
        if (weg.unvollstaendig)
          flagsHtml +=
            "<span class='kn-flag kn-flag-unvoll' title='Stationssatz fuer mindestens ein Gebaeude fehlt. Silber ist eine Untergrenze.'>unvollstaendig</span>";
        flags.innerHTML = flagsHtml;
        zeile.appendChild(flags);

        const spacer = document.createElement("span");
        spacer.className = "kn-spacer";
        zeile.appendChild(spacer);

        const eigen = eigenerKandidat(r, weg);
        const kostenSpan = document.createElement("span");
        kostenSpan.className = "kn-kosten";
        kostenSpan.textContent = formatSilber(eigen && eigen.silber) + " Silber";
        zeile.appendChild(kostenSpan);
        if (eigen && eigen.fokus) {
          const fokusSpan = document.createElement("span");
          fokusSpan.className = "kn-fokus";
          fokusSpan.textContent = formatFokus(eigen.fokus) + " Fokus";
          zeile.appendChild(fokusSpan);
        }

        // Qualitaetsstufen (Feature 05.09.2026): bei einem qualitaetsgebundenen
        // Craft-Knoten zusaetzlich ausweisen, WIE die Zielqualitaet erreicht
        // wird - deterministisch ueber eine preservequality-Zutat, oder ueber
        // Korns Wurf-Mechanik mit erwarteten Mehrfachversuchen (s.
        // craftBeiQualitaetKandidat() in rechenkern.js). weg.qualitaetsart ist
        // nur bei qualitaetsgebundenen Knoten gesetzt.
        let qualitaetDetailHtml = "";
        if (weg.qualitaetsart === "preservequality") {
          qualitaetDetailHtml = ", Qualitaet " + escapeHtml(REGELN.QUALITAETEN[weg.qualitaet]) + " ueber preservequality-Zutat (kein Wurf, keine Fehlversuche)";
        } else if (weg.qualitaetsart === "wurf") {
          qualitaetDetailHtml =
            ", Qualitaets-Wurf auf " +
            escapeHtml(REGELN.QUALITAETEN[weg.qualitaet]) +
            ": " +
            formatProzent(weg.erfolgswahrscheinlichkeit * 100) +
            " Erfolgschance je Versuch, erwartet " +
            weg.erwarteteVersuche.toLocaleString("de-DE", { maximumFractionDigits: 2 }) +
            " Versuche";
        }
        const detail = document.createElement("div");
        detail.className = "kn-detail";
        detail.innerHTML =
          "Rezept #" +
          (weg.rezeptIndex + 1) +
          ", Stationsgebuehr " +
          formatSilber(weg.stationsgebuehrJeStueck) +
          (weg.gebaeude ? " (" + escapeHtml(weg.gebaeude) + ")" : "") +
          ", Rueckgewinnung " +
          formatProzent(weg.rrr * 100) +
          qualitaetDetailHtml +
          altHtml;
        summary.appendChild(detail);
        details.appendChild(summary);

        const body = document.createElement("div");
        body.className = "body";
        (weg.zutaten || []).forEach((z) => {
          const zutatKante = { label: z.menge.toFixed(2) + "x", ausschluss: !!z.ruecklaufAusgeschlossen };
          body.appendChild(baueKnoten(z.weg, r, tiefe + 1, zutatKante));
        });
        details.appendChild(body);
        wrap.appendChild(details);
        return wrap;
      }

      if (weg.typ === "verzaubern") {
        const details = document.createElement("details");
        details.open = tiefe < 2;
        const summary = document.createElement("summary");
        summary.className = "zeile-verzaubern";

        const eigen = eigenerKandidat(r, weg);
        const zeile = document.createElement("div");
        zeile.className = "kn-zeile";
        zeile.innerHTML =
          "<span class='kn-badge kn-badge-verzaubern'>Verzaubern</span>" +
          mengeHtml +
          "<span class='kn-name'>" + escapeHtml(nameVon(weg.item)) + "." + weg.stufe + "</span>" +
          qualitaetHtml +
          ausschlussHtml +
          (weg.unvollstaendig
            ? "<span class='kn-flag kn-flag-unvoll' title='Stationssatz fuer mindestens ein Gebaeude fehlt. Silber ist eine Untergrenze.'>unvollstaendig</span>"
            : "") +
          "<span class='kn-spacer'></span>" +
          "<span class='kn-kosten'>" + formatSilber(eigen && eigen.silber) + " Silber</span>" +
          (eigen && eigen.fokus ? "<span class='kn-fokus'>" + formatFokus(eigen.fokus) + " Fokus</span>" : "");
        summary.appendChild(zeile);

        const detail = document.createElement("div");
        detail.className = "kn-detail";
        detail.innerHTML = "Rezeptsilber " + formatSilber(weg.rezeptSilber) + altHtml;
        summary.appendChild(detail);
        details.appendChild(summary);

        const body = document.createElement("div");
        body.className = "body";
        body.appendChild(baueKnoten(weg.vorstufe, r, tiefe + 1, { label: "Vorstufe" }));
        (weg.materialien || []).forEach((m) => {
          body.appendChild(baueKnoten(m.weg, r, tiefe + 1, { label: m.menge + "x" }));
        });
        details.appendChild(body);
        wrap.appendChild(details);
        return wrap;
      }

      return wrap;
    }

    /**
     * Plain-Text-Variante von altBeschreibungKurz() (oben), fuer den
     * title-Tooltip der grafischen Bauplan-Ansicht: dort ist kein HTML
     * erlaubt (title ist ein Attributwert, keine Markup-Senke), deshalb kein
     * escapeHtml/keine <span>-Verschachtelung noetig, nur der reine Text.
     */
    function altBeschreibungPlain(alt) {
      if (!alt) return "";
      if (alt.gesperrt) return "Naechstbeste Alternative: gesperrt (" + (alt.grund || "") + ")";
      const typLabel = { kaufen: "Kaufen", craften: "Craften", verzaubern: "Verzaubern", reroll: "Craften+Reroll" }[alt.typ] || alt.typ;
      return "Naechstbeste Alternative: " + typLabel + " fuer " + formatSilber(alt.silber) + " Silber";
    }

    /** Plain-Text-Variante von wegVolumenHtml() (oben), fuer denselben Tooltip-Zweck wie altBeschreibungPlain(). */
    function wegVolumenTextPlain(weg) {
      if (!weg || weg.ursprungsTyp !== "kaufen" || !weg.marktId) return "";
      const info = zustand.handelsvolumen[weg.marktId];
      if (info === undefined) return "";
      if (info === null) return "Handelsvolumen: keine Daten";
      return info.umsatz7Tage > 0
        ? "Handelsvolumen: " + formatSilber(info.umsatz7Tage) + " Stk / 7 Tage" + (info.mengengewichteterPreis != null ? ", " + formatSilber(info.mengengewichteterPreis) + " Silber im Schnitt" : "")
        : "Handelsvolumen: kein Umsatz in den letzten 7 Tagen";
    }

    /**
     * Gesamter title-Tooltip-Text eines Kaestchens in der grafischen Bauplan-
     * Ansicht: alles, was in der Text-Ansicht als kn-detail/kn-flag/kn-alter
     * sichtbar war (Rezept-Index, Stationsgebuehr samt Gebaeude,
     * Rueckgewinnung, Qualitaetsweg, unvollstaendig-Warnung, Kaufweg,
     * Eigenpreis-Kennzeichnung, Preisalter, "kein Ruecklauf"-Warnung,
     * Handelsvolumen, naechstbeste Alternative), s. Nutzer-Entscheidung 4
     * dieses Zyklus ("Details ... nur per title-Tooltip beim Hover, nicht
     * permanent sichtbar"). Reihenfolge/Wortlaut lehnt sich an die
     * bestehenden kn-detail-Texte in baueKnoten() an.
     */
    function bgTooltipFuer(weg, r, kante) {
      const teile = [];
      if (weg.typ === "gesperrt") {
        teile.push("Gesperrt: " + (weg.grund || ""));
        const vol = wegVolumenTextPlain(weg);
        if (vol) teile.push(vol);
        return teile.join(". ");
      }
      const alt = naechstbesteAlternative(r.knotenAlternativen, weg.item, weg.stufe, weg.qualitaet);
      if (weg.typ === "kaufen") {
        teile.push(weg.kaufweg === "order" ? "Kauforder" : "Sofortkauf");
        teile.push(weg.eigenpreis ? "Eigenpreis (keine Marktdaten)" : "Preisalter " + alterFuerMarktId(weg.marktId).text);
      } else if (weg.typ === "craften") {
        teile.push("Rezept #" + (weg.rezeptIndex + 1));
        teile.push("Stationsgebuehr " + formatSilber(weg.stationsgebuehrJeStueck) + (weg.gebaeude ? " (" + weg.gebaeude + ")" : ""));
        teile.push("Rueckgewinnung " + formatProzent(weg.rrr * 100));
        if (weg.qualitaetsart === "preservequality") {
          teile.push("Qualitaet " + REGELN.QUALITAETEN[weg.qualitaet] + " ueber preservequality-Zutat (kein Wurf, keine Fehlversuche)");
        } else if (weg.qualitaetsart === "wurf") {
          teile.push(
            "Qualitaets-Wurf auf " +
              REGELN.QUALITAETEN[weg.qualitaet] +
              ": " +
              formatProzent(weg.erfolgswahrscheinlichkeit * 100) +
              " Erfolgschance je Versuch, erwartet " +
              weg.erwarteteVersuche.toLocaleString("de-DE", { maximumFractionDigits: 2 }) +
              " Versuche"
          );
        }
        if (weg.unvollstaendig) teile.push("Stationssatz fuer mindestens ein Gebaeude fehlt, Silber ist eine Untergrenze");
      } else if (weg.typ === "verzaubern") {
        teile.push("Rezeptsilber " + formatSilber(weg.rezeptSilber));
        if (weg.unvollstaendig) teile.push("Stationssatz fuer mindestens ein Gebaeude fehlt, Silber ist eine Untergrenze");
      } else if (weg.typ === "reroll") {
        teile.push("Reroll-Silber " + formatSilber(weg.rerollSilber) + " (Gegenstandswert " + formatSilber(weg.itemWertJeStueck) + ")");
        teile.push("Normal -> " + REGELN.QUALITAETEN[weg.qualitaet]);
        if (weg.unvollstaendig) teile.push("Stationssatz fuer mindestens ein Gebaeude fehlt, Silber ist eine Untergrenze");
      }
      if (kante && kante.ausschluss) teile.push("Ruecklauf ausgeschlossen (Mengenobergrenze fuer dieses Material erreicht)");
      const altText = altBeschreibungPlain(alt);
      if (altText) teile.push(altText);
      return teile.join(". ");
    }

    /**
     * Kaestchen-Inhalt der grafischen Bauplan-Ansicht (Nutzer-Entscheidung 4
     * dieses Zyklus): Icon + Name(.Stufe) + Verzauberungs-/Qualitaets-Badge +
     * Silber + Fokus + Status-/Aktionstyp-Badge. Alles Weitere steckt im
     * title-Tooltip, s. bgTooltipFuer() oben. Kein Platzhalterbild bei
     * Ladefehler (Nutzer-Entscheidung 5): der error-Handler entfernt das
     * <img> ersatzlos, das Kaestchen bleibt ohne Icon, der Name bleibt
     * sichtbar.
     *
     * Icon-Ueberarbeitung (Nutzer-Feedback 06.09.2026, zweite Runde): das
     * Icon selbst traegt jetzt per "@<Stufe>"-Suffix (s. itemIconUrl()) den
     * echten spielinternen Farbschimmer und die Verzauberungs-Rauten, der
     * bisherige eigene CSS-Rahmen (--ic-color/--lvl0.."--lvl4) ist deshalb
     * weg (waere doppelt gewesen). Ein einzelnes Badge oben links traegt
     * weiterhin "T<Tier>.<Stufe>" (Nutzer-Wunsch: Textangabe bleibt, nur der
     * Rahmen war ueberfluessig), ein Stueckzahl-Badge oben rechts (nur bei
     * echten Mengenkanten, s. kante.menge) ersetzt die bisherige separate
     * kn-menge-Beschriftung neben dem Verbindungsstrich. Bei Stufe 0 faellt
     * der Punkt weg (dieselbe Konvention wie beim kn-name-Text unten: "T4"
     * statt "T4.0"), damit Kaufen-Token ohne Verzauberungsstufe nicht
     * faelschlich ".0" zeigen.
     */
    function bgCard(weg, r, kante) {
      const badge = bgBadgeInfo(weg);
      const card = document.createElement("div");
      card.className = "bg-card" + (weg.typ === "gesperrt" ? " kn-zeile-gesperrt" : "");
      card.title = bgTooltipFuer(weg, r, kante);

      if (weg.item) {
        const wrap = document.createElement("div");
        wrap.className = "bg-ic-wrap";
        const slot = document.createElement("div");
        slot.className = "bg-slot";
        const img = document.createElement("img");
        img.className = "bg-icon";
        img.loading = "lazy";
        img.alt = "";
        img.src = itemIconUrl(weg.item, weg.qualitaet, weg.stufe);
        img.addEventListener("error", () => img.remove());
        slot.appendChild(img);
        wrap.appendChild(slot);
        const lvlBadge = document.createElement("span");
        lvlBadge.className = "bg-ic-lvl";
        lvlBadge.textContent = "T" + tierVon(weg.item) + (weg.stufe ? "." + weg.stufe : "");
        wrap.appendChild(lvlBadge);
        if (kante && kante.menge != null) {
          const qtyBadge = document.createElement("span");
          qtyBadge.className = "bg-ic-qty";
          qtyBadge.textContent = formatMengeKompakt(kante.menge);
          wrap.appendChild(qtyBadge);
        }
        card.appendChild(wrap);
      }

      const info = document.createElement("div");
      info.className = "bg-info";
      const nameZeile = document.createElement("div");
      nameZeile.className = "bg-name-zeile";
      nameZeile.innerHTML =
        "<span class='kn-badge " + badge.cls + "'>" + escapeHtml(badge.label) + "</span>" +
        "<span class='kn-name'>" + escapeHtml(nameVon(weg.item)) + (weg.stufe ? "." + weg.stufe : "") + "</span>" +
        qualitaetBadgeHtml(weg.qualitaet);
      info.appendChild(nameZeile);

      if (weg.typ !== "gesperrt") {
        let silber, fokus;
        if (weg.typ === "kaufen") {
          silber = weg.preisJeStueck;
          fokus = null;
        } else {
          const eigen = eigenerKandidat(r, weg);
          silber = eigen && eigen.silber;
          fokus = eigen && eigen.fokus;
        }
        const kostenZeile = document.createElement("div");
        kostenZeile.className = "bg-kosten-zeile";
        kostenZeile.innerHTML =
          "<span class='kn-kosten'>" + formatSilber(silber) + " Silber</span>" +
          (fokus ? "<span class='kn-fokus'>" + formatFokus(fokus) + " Fokus</span>" : "");
        info.appendChild(kostenZeile);
      }
      card.appendChild(info);
      return card;
    }

    /**
     * Grafische Bauplan-Ansicht (Baumdiagramm links->rechts, Zyklus "Bauplan
     * grafisch als Baumdiagramm mit Item-Icons", Nutzer-Entscheidungen s.
     * kostenrechner-KONTEXT.md): dieselbe Auf-/Zuklapplogik wie baueKnoten()
     * oben (Nutzer-Entscheidung 6) - Kaufen/Gesperrt sind Blaetter ohne
     * eigenen Teilbaum (in der Text-Ansicht traegt "kaufen" zwar ebenfalls
     * ein <details>, aber ohne jedes <body>-Element: die Detailzeile sitzt
     * dort direkt IM <summary>, also immer sichtbar - das Aufklappen dort ist
     * bereits ein Leerlauf-Effekt ohne sichtbaren Unterschied, hier deshalb
     * bewusst weggelassen), Craften/Verzaubern/Reroll bleiben <details> mit
     * Tiefenschwelle 2 wie in der Text-Ansicht. Reagiert auf denselben
     * "Alles auf-/zuklappen"-Knopf, weil bauplanEl.querySelectorAll("details")
     * generisch alle <details> im aktuell gerenderten Baum findet.
     */
    function baueKnotenGrafisch(weg, r, tiefe, kante) {
      if (!weg) return document.createDocumentFragment();

      if (weg.typ === "gesperrt" || weg.typ === "kaufen") {
        const div = document.createElement("div");
        div.className = "bg-node bg-leaf";
        div.appendChild(bgCard(weg, r, kante));
        return div;
      }

      const details = document.createElement("details");
      details.className = "bg-node";
      details.open = tiefe < 2;
      const summary = document.createElement("summary");
      summary.appendChild(bgCard(weg, r, kante));
      details.appendChild(summary);

      const children = document.createElement("div");
      children.className = "bg-children";
      function anhaengen(kindWeg, kindKante) {
        const child = document.createElement("div");
        child.className = "bg-child";
        const stub = document.createElement("span");
        stub.className = "bg-stub";
        child.appendChild(stub);
        if (kindKante && kindKante.label) {
          const label = document.createElement("span");
          label.className = "kn-menge";
          label.textContent = kindKante.label;
          child.appendChild(label);
        }
        child.appendChild(baueKnotenGrafisch(kindWeg, r, tiefe + 1, kindKante));
        children.appendChild(child);
      }

      if (weg.typ === "craften") {
        (weg.zutaten || []).forEach((z) =>
          anhaengen(z.weg, { menge: z.menge, ausschluss: !!z.ruecklaufAusgeschlossen })
        );
      } else if (weg.typ === "verzaubern") {
        anhaengen(weg.vorstufe, { label: "Vorstufe" });
        (weg.materialien || []).forEach((m) => anhaengen(m.weg, { menge: m.menge }));
      } else if (weg.typ === "reroll") {
        anhaengen(weg.basis, { label: "Normal beschaffen" });
      }

      if (children.childNodes.length) details.appendChild(children);
      return details;
    }

    function renderBauplanGrafisch(r) {
      bauplanEl.innerHTML = "";
      bauplanEl.className = "baum bg-baum";
      const scroll = document.createElement("div");
      scroll.className = "bg-scroll";
      scroll.appendChild(baueKnotenGrafisch(r.weg, r, 0));
      bauplanEl.appendChild(scroll);
    }

    function renderBauplan(r) {
      if (einstellungen.bauplanAnsicht === "grafisch") {
        renderBauplanGrafisch(r);
        return;
      }
      bauplanEl.className = "baum";
      bauplanEl.innerHTML = "";
      if (r.gesperrt) {
        bauplanEl.appendChild(baueGesperrtZeile(r.weg, null));
        return;
      }
      bauplanEl.appendChild(baueKnoten(r.weg, r, 0));
    }

    alleAufBtn.addEventListener("click", () => bauplanEl.querySelectorAll("details").forEach((d) => (d.open = true)));
    alleZuBtn.addEventListener("click", () => bauplanEl.querySelectorAll("details").forEach((d) => (d.open = false)));

    // Text/Grafisch-Umschalter (Zyklus "Bauplan grafisch als Baumdiagramm mit
    // Item-Icons"): dauerhaft in localStorage gemerkt wie die uebrigen
    // Einstellungen (Nutzer-Entscheidung 05./06.09.2026), kein separater
    // Zoom-Regler - nur Scrollen im Panel (s. .bg-scroll in Kostenrechner.html).
    if (bauplanAnsichtSchalterEl) {
      bauplanAnsichtSchalterEl.addEventListener("click", (ev) => {
        const btn = ev.target.closest("button[data-ansicht]");
        if (!btn) return;
        einstellungen.bauplanAnsicht = btn.dataset.ansicht === "grafisch" ? "grafisch" : "text";
        einstellungenSchreiben(einstellungen);
        aktualisiereBauplanAnsichtSchalter();
        if (zustand.ergebnis) renderBauplan(zustand.ergebnis);
      });
    }

    /**
     * Handelsvolumen-Zusatzsignal (Zyklus "history/-Handelsvolumen als
     * Zusatzsignal bei gesperrten Preisen", 05.09.2026): laedt per Knopfdruck
     * das 7-Tage-Handelsvolumen fuer alle aktuell im Bauplan-Baum sichtbaren
     * "kaufen, gesperrt"-Knoten nach (sammleGesperrteKaufMarktIds(), s. dort).
     * Kein automatischer Abruf bei jeder Berechnung - der Nutzer entscheidet,
     * wann sich der zusaetzliche Netzzugriff lohnt. Ergebnis landet in
     * zustand.handelsvolumen (nur Seitenspeicher, kein localStorage-Cache,
     * bleibt ueber mehrere Suchen hinweg erhalten) und wird anschliessend
     * durch einen erneuten renderBauplan()-Aufruf sichtbar (baueGesperrtZeile()/
     * wegVolumenHtml() lesen daraus). anfrageZaehler-Muster wie bei
     * berechnen(): eine ueberholte Antwort (Item inzwischen gewechselt) wird
     * still verworfen.
     */
    volumenBtn.addEventListener("click", async () => {
      if (!zustand.ergebnis) return;
      const ids = Array.from(sammleGesperrteKaufMarktIds(zustand.ergebnis.weg));
      if (!ids.length) {
        setStatus("Keine gesperrten Kaufen-Knoten im aktuellen Bauplan.", "ok");
        return;
      }
      const meinToken = ++volumenAnfrageZaehler;
      volumenBtn.disabled = true;
      setStatus("0 / " + ids.length + " Handelsvolumen abgerufen (" + einstellungen.stadt + ") ...");
      try {
        const ergebnis = await PREISE.volumenAbrufen(ids, {
          stadt: einstellungen.stadt,
          aufFortschritt: (erledigt, gesamt) => {
            if (meinToken === volumenAnfrageZaehler) setStatus(erledigt + " / " + gesamt + " Handelsvolumen abgerufen (" + einstellungen.stadt + ") ...");
          },
        });
        if (meinToken !== volumenAnfrageZaehler) return; // inzwischen ueberholt (neue Suche/neuer Abruf)
        Object.assign(zustand.handelsvolumen, ergebnis);
        if (zustand.ergebnis) renderBauplan(zustand.ergebnis);
        setStatus(ids.length + " Handelsvolumen fuer " + einstellungen.stadt + " geladen.", "ok");
      } catch (err) {
        if (meinToken === volumenAnfrageZaehler) setStatus("Fehler beim Handelsvolumen-Abruf: " + err.message, "err");
      } finally {
        if (meinToken === volumenAnfrageZaehler) volumenBtn.disabled = false;
      }
    });

    // wegLabelKurz(), statusInfoFuerWeg(), gruppiereAlleWege() und
    // wegGruppenLabel() stehen auf Modul-Ebene oben (testbar ohne DOM, s.
    // tests/test.html).

    function statusHtmlFuer(pill, text, grund) {
      return "<span class='pill " + pill + "'>" + text + "</span>" + (grund ? " " + escapeHtml(grund) : "");
    }

    /**
     * "Alle Wege"-Tabelle, seit dem Zyklus "Aussagekraft der Alle-Wege-
     * Tabelle verbessern" (05.09.2026) nach Gleichwertigkeit gruppiert
     * (s. gruppiereAlleWege() oben): eine Gruppe mit nur einem Mitglied
     * rendert exakt wie zuvor eine einzelne Zeile. Eine Gruppe mit mehreren
     * Mitgliedern rendert eine aufklappbare Kopfzeile (Klick toggelt), darunter
     * die urspruenglichen Einzelzeilen, anfangs eingeklappt.
     */
    function renderAlleWege(r) {
      const tbody = alleWegeTabelleEl.querySelector("tbody");
      tbody.innerHTML = "";
      const gruppen = gruppiereAlleWege(r.alleWege);
      gruppen.forEach((gruppe, gIdx) => {
        const bestesMitglied = gruppe.mitglieder[0];
        const istBest = gIdx === 0 && !bestesMitglied.gesperrt;
        const mehrfach = gruppe.mitglieder.length > 1;

        const kopf = document.createElement("tr");
        const klassen = [];
        if (istBest) klassen.push("best");
        if (gruppe.statusPill === "bad") klassen.push("gesperrt-zeile");
        if (mehrfach) klassen.push("wg-gruppe-kopf");
        kopf.className = klassen.join(" ");
        const wegLabel = mehrfach
          ? "<span class='wg-pfeil'>&#9656;</span>" + escapeHtml(wegGruppenLabel(gruppe))
          : escapeHtml(wegGruppenLabel(gruppe));
        kopf.innerHTML =
          "<td class='l'>" +
          wegLabel +
          "</td><td class='num'>" +
          gruppe.silberAnzeige +
          "</td><td class='num'>" +
          gruppe.fokusAnzeige +
          "</td><td class='num'>" +
          (bestesMitglied.gesperrt ? "-" : formatSilber(bestesMitglied.wert)) +
          "</td><td class='l'>" +
          statusHtmlFuer(gruppe.statusPill, gruppe.statusText, gruppe.grund) +
          "</td>";
        tbody.appendChild(kopf);

        if (!mehrfach) return;

        const detailZeilen = gruppe.mitglieder.map((w) => {
          const tr = document.createElement("tr");
          tr.className = "wg-gruppe-detail";
          if (gruppe.statusPill === "bad") tr.classList.add("gesperrt-zeile");
          tr.innerHTML =
            "<td class='l'>" +
            escapeHtml(wegLabelKurz(w)) +
            "</td><td class='num'>" +
            formatSilber(w.silber) +
            "</td><td class='num'>" +
            formatFokus(w.fokus) +
            "</td><td class='num'>" +
            (w.gesperrt ? "-" : formatSilber(w.wert)) +
            "</td><td class='l'>" +
            statusHtmlFuer(gruppe.statusPill, gruppe.statusText, gruppe.grund) +
            "</td>";
          tbody.appendChild(tr);
          return tr;
        });

        kopf.addEventListener("click", () => {
          const offen = kopf.classList.toggle("offen");
          detailZeilen.forEach((tr) => tr.classList.toggle("zeige", offen));
        });
      });
    }

    /**
     * Spezialisierungsknoten-Panel (05.09.2026, Zyklus "FCE-Ableitung ueber
     * Schicksalsbrett-Knotenliste je Kategorie"): fuer jede Kategorie mit
     * einem abgebildeten Knotentyp (REGELN.spezTypVonKategorie) ein
     * aufklappbarer Block mit ALLEN aus dem Rezeptgraphen abgeleiteten
     * Knoten-Gruppen dieser Kategorie, nicht nur den im Bauplan vorkommenden
     * - der Mutual-Anteil wirkt kategorieweit, s. Kommentar in
     * Kostenrechner.html. Gleicher Verwendete-zuerst/Alle-anzeigen-Umschalter
     * wie renderFceAusnahmen()/renderFokusRegel() unten, aber zusaetzlich auf
     * spezTypVonKategorie() gefiltert (nicht jede Kategorie hat ein Modell).
     */
    function renderSpezialisierungsknoten(r) {
      const verwendete = (r && !r.gesperrt ? sammleVerwendeteKategorien(r.weg) : []).filter((cc) => REGELN.spezTypVonKategorie(cc));
      const alle = ALLE_KATEGORIEN.filter((cc) => REGELN.spezTypVonKategorie(cc));
      const liste = (zustand.spezKnotenAlleZeigen ? alle.slice() : verwendete).slice().sort();
      spezKnotenContainerEl.innerHTML = "";
      if (!liste.length) {
        spezKnotenContainerEl.innerHTML = "<div class='hint'>Noch keine Kategorie mit Spezialisierungsknoten im Bauplan.</div>";
        return;
      }
      liste.forEach((cc) => {
        const typSchluessel = REGELN.spezTypVonKategorie(cc);
        const typ = REGELN.SPEZ_TYP[typSchluessel];
        const gruppen = spezKnotenAnzeigeGruppen(cc);
        if (!gruppen.length) return;
        const istVerwendet = verwendete.indexOf(cc) !== -1;
        const eintrag = einstellungen.spezialisierung[cc] || { meisterschaft: 0, knoten: {} };
        const knotenStufen = eintrag.knoten || {};

        function neuStufeSetzen(mutator) {
          const e = einstellungen.spezialisierung[cc] || (einstellungen.spezialisierung[cc] = { meisterschaft: 0, knoten: {} });
          if (!e.knoten) e.knoten = {};
          mutator(e);
          persistiereUndRechne();
          renderSpezialisierungsknoten(zustand.ergebnis);
        }

        const details = document.createElement("details");
        details.open = zustand.spezKnotenOffen[cc] != null ? zustand.spezKnotenOffen[cc] : istVerwendet;
        details.addEventListener("toggle", () => {
          zustand.spezKnotenOffen[cc] = details.open;
        });
        const summary = document.createElement("summary");
        summary.textContent = cc + (istVerwendet ? " (im Bauplan)" : "") + " - " + gruppen.length + " Knoten";
        details.appendChild(summary);

        const body = document.createElement("div");
        body.className = "body";

        if (!typ.einFeld) {
          const meisterZeile = document.createElement("div");
          meisterZeile.className = "meister";
          const feld = document.createElement("div");
          feld.className = "feld";
          const label = document.createElement("label");
          label.textContent = "Meisterschaftsstufe";
          label.title = "Getrennter Meisterschaftsknoten dieser Kategorie: " + typ.mastery + " FCE je Stufe, wirkt auf alle Knoten der Kategorie.";
          const input = document.createElement("input");
          input.type = "number";
          input.min = "0";
          input.step = "1";
          input.value = eintrag.meisterschaft || 0;
          input.addEventListener("change", () => {
            const wert = Math.max(0, Number(input.value) || 0);
            input.value = wert;
            neuStufeSetzen((e) => {
              e.meisterschaft = wert;
            });
          });
          feld.appendChild(label);
          feld.appendChild(input);
          meisterZeile.appendChild(feld);
          body.appendChild(meisterZeile);
        }

        const table = document.createElement("table");
        table.className = "klein-tbl";
        const thead = document.createElement("thead");
        thead.innerHTML =
          "<tr><th>Knoten</th><th>" +
          (typ.einFeld ? "Knotenstufe" : "Spezialisierungsstufe") +
          "</th><th title='Eigener Unique-Anteil + Mutual-Anteil aller anderen Knoten dieser Kategorie + ggf. Meisterschaft'>FCE</th></tr>";
        table.appendChild(thead);
        const tbody = document.createElement("tbody");
        gruppen.forEach((g) => {
          const tr = document.createElement("tr");
          const stufe = knotenStufen[g.schluessel] || 0;
          if (stufe > 0) tr.className = "gesetzt";
          const tdName = document.createElement("td");
          tdName.textContent = g.name;
          tdName.title = g.schluessel + " (" + g.items.length + " Tier-Variante" + (g.items.length === 1 ? "" : "n") + "): " + g.items.join(", ");
          const tdInput = document.createElement("td");
          const input = document.createElement("input");
          input.type = "number";
          input.min = "0";
          input.step = "1";
          input.value = stufe;
          input.addEventListener("change", () => {
            const wert = Math.max(0, Number(input.value) || 0);
            input.value = wert;
            neuStufeSetzen((e) => {
              if (wert === 0) delete e.knoten[g.schluessel];
              else e.knoten[g.schluessel] = wert;
            });
          });
          tdInput.appendChild(input);
          const tdFce = document.createElement("td");
          tdFce.textContent = formatFokus(REGELN.fceAusSpezialisierungsknoten(cc, g.schluessel, knotenStufen, eintrag.meisterschaft));
          tr.appendChild(tdName);
          tr.appendChild(tdInput);
          tr.appendChild(tdFce);
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        body.appendChild(table);

        const summe = Object.values(knotenStufen).reduce((a, b) => a + (b || 0), 0) + (eintrag.meisterschaft || 0);
        const hinweis = document.createElement("div");
        hinweis.className = "summe";
        hinweis.textContent =
          summe > 0
            ? "Wirkt fuer alle Craft-Schritte dieser Kategorie, schlaegt die Fokus-Effizienz-Ausnahme unten."
            : "Noch keine Stufe eingetragen: die Fokus-Effizienz-Ausnahme unten bzw. der globale Wert oben gilt weiterhin.";
        body.appendChild(hinweis);

        details.appendChild(body);
        spezKnotenContainerEl.appendChild(details);
      });
    }

    spezKnotenAlleZeigenBtn.addEventListener("click", () => {
      zustand.spezKnotenAlleZeigen = !zustand.spezKnotenAlleZeigen;
      spezKnotenAlleZeigenBtn.textContent = zustand.spezKnotenAlleZeigen ? "Nur verwendete Kategorien anzeigen" : "Alle abgebildeten Kategorien anzeigen";
      renderSpezialisierungsknoten(zustand.ergebnis);
    });

    function renderFceAusnahmen(r) {
      const verwendete = r && !r.gesperrt ? sammleVerwendeteKategorien(r.weg) : [];
      const liste = (zustand.fceAlleZeigen ? ALLE_KATEGORIEN.slice() : verwendete).slice().sort();
      const tbody = fceAusnahmenTabelleEl.querySelector("tbody");
      tbody.innerHTML = "";
      if (!liste.length) {
        tbody.innerHTML = "<tr><td colspan='2' class='hint'>Noch keine Kategorien im Bauplan.</td></tr>";
        return;
      }
      liste.forEach((cc) => {
        const tr = document.createElement("tr");
        if (verwendete.indexOf(cc) !== -1) tr.className = "gebraucht";
        const tdName = document.createElement("td");
        tdName.textContent = cc;
        const tdInput = document.createElement("td");
        const input = document.createElement("input");
        input.type = "number";
        input.step = "100";
        input.min = "0";
        input.placeholder = "global";
        input.value = einstellungen.fceAusnahmen[cc] != null ? einstellungen.fceAusnahmen[cc] : "";
        input.addEventListener("change", () => {
          if (input.value.trim() === "") {
            delete einstellungen.fceAusnahmen[cc];
          } else {
            // Gleicher Floor wie beim globalen FCE-Feld, s. dortiger Kommentar.
            const wert = Math.max(0, Number(input.value) || 0);
            einstellungen.fceAusnahmen[cc] = wert;
            input.value = wert;
          }
          persistiereUndRechne();
        });
        tdInput.appendChild(input);
        tr.appendChild(tdName);
        tr.appendChild(tdInput);
        tbody.appendChild(tr);
      });
    }

    fceAlleZeigenBtn.addEventListener("click", () => {
      zustand.fceAlleZeigen = !zustand.fceAlleZeigen;
      fceAlleZeigenBtn.textContent = zustand.fceAlleZeigen ? "Nur verwendete Kategorien anzeigen" : "Alle 43 Kategorien anzeigen";
      renderFceAusnahmen(zustand.ergebnis);
    });

    // ---- Fokus-Regel je Kategorie (Feature "Fokuseinsatz steuerbar machen") ----
    // Gleicher Aufbau wie renderFceAusnahmen oben, aber ein Dreifach-Schalter
    // (wie beim Tagesbonus) statt eines Zahlenfelds: Automatisch/Immer/Nie.
    function renderFokusRegel(r) {
      const verwendete = r && !r.gesperrt ? sammleVerwendeteKategorien(r.weg) : [];
      const liste = (zustand.fokusRegelAlleZeigen ? ALLE_KATEGORIEN.slice() : verwendete).slice().sort();
      const tbody = fokusRegelTabelleEl.querySelector("tbody");
      tbody.innerHTML = "";
      if (!liste.length) {
        tbody.innerHTML = "<tr><td colspan='2' class='hint'>Noch keine Kategorien im Bauplan.</td></tr>";
        return;
      }
      liste.forEach((cc) => {
        const tr = document.createElement("tr");
        if (verwendete.indexOf(cc) !== -1) tr.className = "gebraucht";
        const tdName = document.createElement("td");
        tdName.textContent = cc;
        const tdSchalter = document.createElement("td");
        const gruppe = document.createElement("div");
        gruppe.className = "dreifach";
        const aktuellerWert = einstellungen.fokusRegelJeKategorie[cc] || "automatisch";
        [
          ["automatisch", "Automatisch"],
          ["immer", "Immer"],
          ["nie", "Nie"],
        ].forEach((paar) => {
          const wert = paar[0];
          const label = paar[1];
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = label;
          if (wert === aktuellerWert) btn.className = "an";
          btn.addEventListener("click", () => {
            if (wert === "automatisch") delete einstellungen.fokusRegelJeKategorie[cc];
            else einstellungen.fokusRegelJeKategorie[cc] = wert;
            persistiereUndRechne();
          });
          gruppe.appendChild(btn);
        });
        tdSchalter.appendChild(gruppe);
        tr.appendChild(tdName);
        tr.appendChild(tdSchalter);
        tbody.appendChild(tr);
      });
    }

    fokusRegelAlleZeigenBtn.addEventListener("click", () => {
      zustand.fokusRegelAlleZeigen = !zustand.fokusRegelAlleZeigen;
      fokusRegelAlleZeigenBtn.textContent = zustand.fokusRegelAlleZeigen ? "Nur verwendete Kategorien anzeigen" : "Alle 43 Kategorien anzeigen";
      renderFokusRegel(zustand.ergebnis);
    });

    function renderTagesbonus(r) {
      const verwendete = r && !r.gesperrt ? sammleVerwendeteKategorien(r.weg) : [];
      const liste = (zustand.tagAlleZeigen ? ALLE_KATEGORIEN.slice() : verwendete).slice().sort();
      const tbody = tagesbonusTabelleEl.querySelector("tbody");
      tbody.innerHTML = "";
      if (!liste.length) {
        tbody.innerHTML = "<tr><td colspan='2' class='hint'>Noch keine Kategorien im Bauplan.</td></tr>";
        return;
      }
      liste.forEach((cc) => {
        const tr = document.createElement("tr");
        if (verwendete.indexOf(cc) !== -1) tr.className = "gebraucht";
        const tdName = document.createElement("td");
        tdName.textContent = cc;
        const tdSchalter = document.createElement("td");
        const gruppe = document.createElement("div");
        gruppe.className = "dreifach";
        const aktuellerWert = einstellungen.tagesbonus[cc] || "aus";
        [
          ["aus", "Aus"],
          ["silber", "Silber"],
          ["gold", "Gold"],
        ].forEach((paar) => {
          const wert = paar[0];
          const label = paar[1];
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = label;
          if (wert === aktuellerWert) btn.className = "an";
          btn.addEventListener("click", () => {
            if (wert === "aus") delete einstellungen.tagesbonus[cc];
            else einstellungen.tagesbonus[cc] = wert;
            persistiereUndRechne();
          });
          gruppe.appendChild(btn);
        });
        tdSchalter.appendChild(gruppe);
        tr.appendChild(tdName);
        tr.appendChild(tdSchalter);
        tbody.appendChild(tr);
      });
    }

    tagAlleZeigenBtn.addEventListener("click", () => {
      zustand.tagAlleZeigen = !zustand.tagAlleZeigen;
      tagAlleZeigenBtn.textContent = zustand.tagAlleZeigen ? "Nur verwendete Kategorien anzeigen" : "Alle 43 Kategorien anzeigen";
      renderTagesbonus(zustand.ergebnis);
    });

    function renderStationTabelle(r) {
      const verwendete = r && !r.gesperrt ? sammleVerwendeteGebaeude(r.weg) : [];
      const tbody = stationTabelleEl.querySelector("tbody");
      tbody.innerHTML = "";
      const sortiert = ALLE_GEBAEUDE.slice().sort((a, b) => {
        const av = verwendete.indexOf(a) !== -1;
        const bv = verwendete.indexOf(b) !== -1;
        if (av !== bv) return av ? -1 : 1;
        return a.localeCompare(b, "de");
      });
      sortiert.forEach((g) => {
        const tr = document.createElement("tr");
        const istVerwendet = verwendete.indexOf(g) !== -1;
        const wertVorhanden = einstellungen.stationssaetze[g] != null;
        const klassen = [];
        if (istVerwendet) klassen.push("gebraucht");
        if (istVerwendet && !wertVorhanden) klassen.push("fehlt");
        tr.className = klassen.join(" ");
        const tdName = document.createElement("td");
        tdName.textContent = g + (istVerwendet ? " (im Bauplan)" : "");
        const tdInput = document.createElement("td");
        const input = document.createElement("input");
        input.type = "number";
        input.step = "10";
        input.min = "0";
        input.placeholder = "nicht gepflegt";
        input.value = wertVorhanden ? einstellungen.stationssaetze[g] : "";
        input.addEventListener("change", () => {
          if (input.value.trim() === "") delete einstellungen.stationssaetze[g];
          else einstellungen.stationssaetze[g] = Number(input.value);
          persistiereUndRechne();
        });
        tdInput.appendChild(input);
        tr.appendChild(tdName);
        tr.appendChild(tdInput);
        tbody.appendChild(tr);
      });
    }

    function renderEigenpreiseTabelle(r) {
      const fehlende = sammleFehlendePreise(r);
      if (!fehlende.length) {
        eigenpreiseHinweisEl.hidden = false;
        eigenpreiseTabelleEl.hidden = true;
        return;
      }
      eigenpreiseHinweisEl.hidden = true;
      eigenpreiseTabelleEl.hidden = false;
      const tbody = eigenpreiseTabelleEl.querySelector("tbody");
      tbody.innerHTML = "";
      fehlende.forEach((f) => {
        const tr = document.createElement("tr");
        const teile = f.marktId.split("@");
        const tdName = document.createElement("td");
        tdName.textContent = nameVon(teile[0]) + (teile[1] ? "." + teile[1] : "");
        const tdInput = document.createElement("td");
        const input = document.createElement("input");
        input.type = "number";
        input.step = "1";
        input.min = "0";
        input.placeholder = "kein Eigenpreis";
        const vorhanden = PREISE.eigenpreisHolen(f.marktId);
        input.value = vorhanden != null ? vorhanden : "";
        input.addEventListener("change", () => {
          const wert = input.value.trim() === "" ? null : Number(input.value);
          PREISE.eigenpreisSetzen(f.marktId, wert);
          berechneMitVorhandenenPreisen();
        });
        tdInput.appendChild(input);
        tr.appendChild(tdName);
        tr.appendChild(tdInput);
        tbody.appendChild(tr);
      });
    }

    // ---- Eigenpreis-Pflege (P6): eigene Ansicht ueber alle 365 Kandidaten
    // aus REZEPTGRAPH.nichtHandelbareKandidaten, unabhaengig von einer
    // konkreten Berechnung. Ergaenzt die reaktive Tabelle oben (die nur
    // zeigt, was im ZULETZT berechneten Baum tatsaechlich fehlt): hier kann
    // der Nutzer vorab Eigenpreise fuer Arena-Kristalle, GvG-/Fraktionsmarken
    // usw. hinterlegen, bevor er ueberhaupt etwas berechnet. Bewusst OHNE
    // eigenes Tastatur-/Fokus-Muster wie die Item-Suche (kein Combobox-
    // Pattern noetig): reines Textfeld + Standard-<table>-Inputs sind von
    // Haus aus per Tastatur bedienbar, genau der Befund, der bei der
    // Item-Suche in P5 nachtraeglich behoben werden musste (s. KONTEXT.md).
    // Die Heuristik hinter nichtHandelbareKandidaten ist keine belegte
    // Wahrheit (s. kostenrechner-KONTEXT.md); diese Liste verhindert deshalb
    // NICHTS: ein faelschlich hier gelisteter, tatsaechlich handelbarer
    // Gegenstand laesst sich trotzdem mit einem Eigenpreis versehen, und
    // PREISE.eigenpreisSetzen() selbst kennt ohnehin keine Beschraenkung auf
    // diese Liste (die reaktive Tabelle oben nutzt sie voellig unabhaengig
    // davon fuer JEDES im Baum tatsaechlich gesperrte Item).
    function renderEigenpreisPflege() {
      const alleKandidaten = (typeof REZEPTGRAPH !== "undefined" && REZEPTGRAPH.nichtHandelbareKandidaten) || [];
      const gesetzt = anzahlEigenpreiseGesetzt(alleKandidaten);
      const treffer = gefilterteEigenpreisKandidaten(eigenpreisPflegeSucheEl.value);
      eigenpreisPflegeZaehlerEl.textContent =
        gesetzt + " von " + alleKandidaten.length + " Kandidaten mit Eigenpreis versehen." + (treffer.length !== alleKandidaten.length ? " " + treffer.length + " davon sichtbar." : "");

      const tbody = eigenpreisPflegeTabelleEl.querySelector("tbody");
      tbody.innerHTML = "";
      if (!treffer.length) {
        tbody.innerHTML = "<tr><td colspan='2' class='hint'>Keine Treffer.</td></tr>";
        return;
      }
      treffer.forEach((e) => {
        const marktId = PREISE.marktId(e.id, 0); // keiner der 365 Kandidaten traegt eine Verzauberungsstufe (el), s. kostenrechner-KONTEXT.md; marktId() bleibt trotzdem die einheitliche Regel
        const vorhanden = PREISE.eigenpreisHolen(marktId);
        const tr = document.createElement("tr");
        if (vorhanden != null) tr.className = "gesetzt";
        const tdName = document.createElement("td");
        tdName.innerHTML = escapeHtml(e.name) + "<br><span class='id'>" + escapeHtml(e.id) + "</span>";
        const tdInput = document.createElement("td");
        const input = document.createElement("input");
        input.type = "number";
        input.step = "1";
        input.min = "0";
        input.placeholder = "kein Eigenpreis";
        input.value = vorhanden != null ? vorhanden : "";
        input.addEventListener("change", () => {
          const wert = input.value.trim() === "" ? null : Number(input.value);
          PREISE.eigenpreisSetzen(marktId, wert);
          // Sofort wirksam: eine laufende Berechnung desselben Items
          // uebernimmt den neuen/entfernten Eigenpreis ohne Neuladen.
          if (zustand.item && zustand.preiseRoh) berechneMitVorhandenenPreisen();
          renderEigenpreisPflege();
        });
        tdInput.appendChild(input);
        tr.appendChild(tdName);
        tr.appendChild(tdInput);
        tbody.appendChild(tr);
      });
    }

    eigenpreisPflegeSucheEl.addEventListener("input", renderEigenpreisPflege);

    // ---- Einstellungen: Handel + Beschaffung ----
    [kwSofortEl, kwOrderEl].forEach((el) =>
      el.addEventListener("change", () => {
        einstellungen.kaufweg = document.querySelector('input[name="kaufweg"]:checked').value;
        persistiereUndRechne();
      })
    );
    [vwSofortEl, vwOrderEl].forEach((el) =>
      el.addEventListener("change", () => {
        einstellungen.verkaufsweg = document.querySelector('input[name="verkaufsweg"]:checked').value;
        persistiereUndRechne();
      })
    );
    premiumEl.addEventListener("change", () => {
      einstellungen.premium = premiumEl.value === "1";
      persistiereUndRechne();
    });
    maxPreisAlterEl.addEventListener("change", () => {
      einstellungen.maxPreisAlterMin = maxPreisAlterEl.value.trim() === "" ? null : Number(maxPreisAlterEl.value);
      persistiereUndRechne();
    });
    /**
     * Voreinstellungen fuers Preisalter (Nutzer-Wunsch 06.09.2026): reine
     * Komfort-Buttons, setzen nur den bestehenden Zahlenwert und feuern
     * "change" auf dem Feld, keine eigene Zustandsquelle. Aktiver Button
     * markiert sich selbst ueber den aktuellen Feldwert, auch nach manueller
     * Eingabe oder nach dem Laden gespeicherter Einstellungen.
     */
    function maxPreisAlterPresetsAktualisieren() {
      const aktuell = maxPreisAlterEl.value.trim();
      maxPreisAlterPresetsEl.querySelectorAll("button").forEach((btn) => {
        btn.classList.toggle("an", btn.dataset.min === aktuell);
      });
    }
    maxPreisAlterPresetsEl.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-min]");
      if (!btn) return;
      maxPreisAlterEl.value = btn.dataset.min;
      maxPreisAlterEl.dispatchEvent(new Event("change"));
      maxPreisAlterPresetsAktualisieren();
    });
    maxPreisAlterEl.addEventListener("input", maxPreisAlterPresetsAktualisieren);
    maxPreisAlterPresetsAktualisieren();
    fceEingabeEl.addEventListener("change", () => {
      // FCE unter 0 ist inhaltlich unmoeglich (Spezialisierung senkt Fokuskosten,
      // erhoeht sie nie); an der Eingabe abfangen, nicht erst rechnen lassen.
      // Verteidigung in der Tiefe zusaetzlich in REGELN.fokusMultiplikator().
      einstellungen.fce = Math.max(0, Number(fceEingabeEl.value) || 0);
      fceEingabeEl.value = einstellungen.fce;
      aktualisiereFceAnzeige();
      persistiereUndRechne();
    });
    fokuswertEl.addEventListener("change", () => {
      einstellungen.fokuswert = Number(fokuswertEl.value) || 0;
      persistiereUndRechne();
    });

    abgUebernehmenBtn.addEventListener("click", () => {
      const abgelesen = Number(abgAbgelesenEl.value);
      const grundfokus = Number(abgGrundfokusEl.value);
      if (!abgelesen || !grundfokus) {
        fceHerkunftEl.textContent = "Abgelesenen Fokus und Grundfokus eintragen, beide noetig.";
        return;
      }
      const fce = Math.max(0, Math.round(REGELN.fceAusAbgelesenemFokus(abgelesen, grundfokus)));
      fceEingabeEl.value = fce;
      einstellungen.fce = fce;
      fceHerkunftEl.textContent = "FCE " + fce.toLocaleString("de-DE") + " aus abgelesenem Fokus (" + abgelesen + " von " + grundfokus + ") uebernommen.";
      aktualisiereFceAnzeige();
      persistiereUndRechne();
    });

    // ---- Start ----
    ladeEinstellungenInFormular();
    renderSpezialisierungsknoten(null);
    renderFceAusnahmen(null);
    renderFokusRegel(null);
    renderTagesbonus(null);
    renderStationTabelle(null);
    renderEigenpreiseTabelle(null);
    renderEigenpreisPflege();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }

  return {
    defaultEinstellungen,
    sammleVerwendeteKategorien,
    sammleVerwendeteGebaeude,
    naechstbesteAlternative,
    spezKnotenAnzeigeGruppen,
    prozentAusFce,
    eigenpreisKoenntHelfen,
    sammleFehlendePreise,
    gefilterteEigenpreisKandidaten,
    anzahlEigenpreiseGesetzt,
    formatSilber,
    formatFokus,
    formatProzent,
    formatAlter,
    wegLabelKurz,
    gruppiereAlleWege,
    wegGruppenLabel,
    sammleGesperrteKaufMarktIds,
    itemIconUrl,
    bgBadgeInfo,
  };
})();
