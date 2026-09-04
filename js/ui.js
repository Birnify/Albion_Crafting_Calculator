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
      fce: 0, // 0 = volle Rohfokuskosten, die konservative Richtung (zu teuer statt zu billig)
      fceAusnahmen: {}, // craftingcategory -> FCE
      fokuswert: 0, // Silber je Fokuspunkt; 0 ist gueltig, verschiebt aber zu fokusintensiven Wegen
      stationssaetze: {}, // Gebaeude -> Satz. NUR gepflegte Eintraege drin, s. rechenkern.js stationssatzFuer()
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
      basis.fce = daten.fce != null ? daten.fce : basis.fce;
      basis.fceAusnahmen = daten.fceAusnahmen || {};
      basis.fokuswert = daten.fokuswert != null ? daten.fokuswert : basis.fokuswert;
      basis.stationssaetze = daten.stationssaetze || {};
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
   * Naechstbeste Alternative fuer EINEN Knoten (item, stufe) aus
   * knotenAlternativen (s. RECHENKERN.kosten()). Index 0 ist immer der
   * gewaehlte (bestbewertete) Kandidat, Index 1 die naechstbeste Alternative,
   * unabhaengig davon, ob sie gesperrt ist. null, wenn es keine zweite
   * Option gibt.
   */
  function naechstbesteAlternative(knotenAlternativen, item, stufe) {
    const liste = knotenAlternativen && knotenAlternativen[item + "@" + stufe];
    if (!liste || liste.length < 2) return null;
    return liste[1];
  }

  /** FCE aus den Schicksalsbrett-Stufen: Meisterschaft x 30 + Spezialisierung x 250. */
  function fceAusSchicksalsbrett(meisterschaftsstufe, spezialisierungsstufe) {
    return (meisterschaftsstufe || 0) * 30 + (spezialisierungsstufe || 0) * 250;
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

    const alleWegeTabelleEl = document.getElementById("alleWegeTabelle");

    const fceEingabeEl = document.getElementById("fceEingabe");
    const fceProzentAnzeigeEl = document.getElementById("fceProzentAnzeige");
    const fokuswertEl = document.getElementById("fokuswert");
    const skMeisterEl = document.getElementById("skMeister");
    const skSpezEl = document.getElementById("skSpez");
    const skUebernehmenBtn = document.getElementById("skUebernehmen");
    const abgAbgelesenEl = document.getElementById("abgAbgelesen");
    const abgGrundfokusEl = document.getElementById("abgGrundfokus");
    const abgUebernehmenBtn = document.getElementById("abgUebernehmen");
    const fceHerkunftEl = document.getElementById("fceHerkunft");

    const fceAusnahmenTabelleEl = document.getElementById("fceAusnahmenTabelle");
    const fceAlleZeigenBtn = document.getElementById("fceAlleZeigenBtn");
    const tagesbonusTabelleEl = document.getElementById("tagesbonusTabelle");
    const tagAlleZeigenBtn = document.getElementById("tagAlleZeigenBtn");
    const stationTabelleEl = document.getElementById("stationTabelle");

    const kwSofortEl = document.getElementById("kwSofort");
    const kwOrderEl = document.getElementById("kwOrder");
    const vwSofortEl = document.getElementById("vwSofort");
    const vwOrderEl = document.getElementById("vwOrder");
    const premiumEl = document.getElementById("premium");
    const maxPreisAlterEl = document.getElementById("maxPreisAlter");

    const eigenpreiseHinweisEl = document.getElementById("eigenpreiseHinweis");
    const eigenpreiseTabelleEl = document.getElementById("eigenpreiseTabelle");

    const eigenpreisPflegeSucheEl = document.getElementById("eigenpreisPflegeSuche");
    const eigenpreisPflegeZaehlerEl = document.getElementById("eigenpreisPflegeZaehler");
    const eigenpreisPflegeTabelleEl = document.getElementById("eigenpreisPflegeTabelle");

    let einstellungen = einstellungenLesen();
    let anfrageZaehler = 0; // Token gegen veraltete Preisabrufe, s. berechnen()

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
      ergebnis: null,
      fceAlleZeigen: false,
      tagAlleZeigen: false,
    };

    function nameVon(uniquename) {
      return (REZEPTGRAPH.namen && REZEPTGRAPH.namen[uniquename]) || uniquename;
    }

    function setStatus(text, cls) {
      statusEl.textContent = text;
      statusEl.className = cls || "";
    }

    // ---- Formular <- Einstellungen ----
    function ladeEinstellungenInFormular() {
      fceEingabeEl.value = einstellungen.fce;
      fokuswertEl.value = einstellungen.fokuswert;
      maxPreisAlterEl.value = einstellungen.maxPreisAlterMin == null ? "" : einstellungen.maxPreisAlterMin;
      premiumEl.value = einstellungen.premium ? "1" : "0";
      (einstellungen.kaufweg === "order" ? kwOrderEl : kwSofortEl).checked = true;
      (einstellungen.verkaufsweg === "order" ? vwOrderEl : vwSofortEl).checked = true;
      aktualisiereFceAnzeige();
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
      setStatus("Sammle Markt-IDs ...");
      try {
        const ids = PREISE.sammleMarktIds(zustand.item, zustand.stufe);
        if (meinToken !== anfrageZaehler) return; // inzwischen ueberholt
        setStatus("0 / " + ids.length + " Preise abgerufen ...");
        const preiseRoh = await PREISE.preiseAbrufen(ids, {
          erzwingen: !!erzwingen,
          aufFortschritt: (erledigt, gesamt) => {
            if (meinToken === anfrageZaehler) setStatus(erledigt + " / " + gesamt + " Preise abgerufen ...");
          },
        });
        if (meinToken !== anfrageZaehler) return; // waehrend des Abrufs wurde ein neueres Item gewaehlt, diese Antwort ist veraltet
        zustand.preiseRoh = preiseRoh;
        berechneMitVorhandenenPreisen();
        setStatus(ids.length + " Markt-IDs, " + Object.keys(preiseRoh).length + " Preise geladen.", "ok");
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

    function baueOpts() {
      return {
        preise: preiseZuOptsFormat(zustand.preiseRoh || {}),
        eigenpreise: eigenpreiseFuerOpts(),
        kaufweg: einstellungen.kaufweg,
        stadt: "Lymhurst",
        stationssaetze: einstellungen.stationssaetze,
        fce: einstellungen.fce,
        fceUeberschreibungen: einstellungen.fceAusnahmen,
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
      renderFceAusnahmen(r);
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
      const alterMs = Date.now() - Date.parse(seite.datum);
      if (!isFinite(alterMs)) return { text: "unbekannt", stale: false };
      const min = alterMs / 60000;
      const grenze = einstellungen.maxPreisAlterMin;
      const stale = grenze != null && grenze !== "" && min > Number(grenze);
      return { text: "vor " + formatAlter(min), stale };
    }

    function berechneGewinn(r) {
      const marktId = PREISE.marktId(zustand.item, zustand.stufe);
      const eintrag = zustand.preiseRoh && zustand.preiseRoh[marktId];
      if (!eintrag) return null;
      // Sofortverkauf: buy_price_max (eintrag.buy). Verkaufsorder: sell_price_min (eintrag.sell). S. CLAUDE.md "Handelskonventionen".
      const seite = einstellungen.verkaufsweg === "order" ? eintrag.sell : eintrag.buy;
      if (!seite || seite.kein || seite.preis == null) return null;
      const steuersatz = einstellungen.premium ? REGELN.STEUER_PREMIUM : REGELN.STEUER_OHNE_PREMIUM;
      const sug = REGELN.steuerUndGebuehr(seite.preis, { steuersatz, mitEinstellgebuehr: einstellungen.verkaufsweg === "order" });
      return {
        gewinn: sug.netto - r.silber,
        hinweis: (einstellungen.verkaufsweg === "order" ? "Verkaufsorder" : "Sofortverkauf") + ", " + Math.round(steuersatz * 100) + " % Steuer",
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
      const wegLabel = { kaufen: "Kaufen", craften: "Craften", verzaubern: "Verzaubern" }[r.weg.typ] || r.weg.typ;
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

    function altBeschreibung(alt) {
      if (!alt) return "<span class='alt'>(keine Alternative verfuegbar)</span>";
      if (alt.gesperrt) return "<span class='alt'>naechstbeste Alternative: gesperrt (" + escapeHtml(alt.grund || "") + ")</span>";
      const typLabel = alt.typ === "kaufen" ? "Kaufen" : alt.typ === "craften" ? "Craften" : "Verzaubern";
      return "<span class='alt'>naechstbeste Alternative: " + typLabel + " fuer " + formatSilber(alt.silber) + " Silber</span>";
    }

    function baueKnoten(weg, r, tiefe) {
      const wrap = document.createElement("div");
      if (!weg) return wrap;

      if (weg.typ === "gesperrt") {
        const zeile = document.createElement("div");
        zeile.className = "zeile-gesperrt";
        zeile.textContent = "Gesperrt: " + (weg.grund || "");
        wrap.appendChild(zeile);
        return wrap;
      }

      const alt = naechstbesteAlternative(r.knotenAlternativen, weg.item, weg.stufe);
      const altHtml = altBeschreibung(alt);

      if (weg.typ === "kaufen") {
        const details = document.createElement("details");
        details.open = tiefe < 1;
        const summary = document.createElement("summary");
        summary.className = "zeile-kaufen";
        const alterInfo = alterFuerMarktId(weg.marktId);
        summary.innerHTML =
          "Kaufen: " +
          escapeHtml(nameVon(weg.item)) +
          (weg.stufe ? "." + weg.stufe : "") +
          " fuer " +
          formatSilber(weg.preisJeStueck) +
          " Silber/Stueck (" +
          (weg.kaufweg === "order" ? "Kauforder" : "Sofortkauf") +
          ")" +
          (weg.eigenpreis
            ? "<span class='badge-eigen' title='Kein Marktpreis, sondern eine hinterlegte eigene Schaetzung.'>Eigenpreis</span>"
            : "<span class='alter" + (alterInfo.stale ? " stale" : "") + "'> [Preis " + alterInfo.text + "]</span>") +
          altHtml;
        details.appendChild(summary);
        wrap.appendChild(details);
        return wrap;
      }

      if (weg.typ === "craften") {
        const details = document.createElement("details");
        details.open = tiefe < 2;
        const summary = document.createElement("summary");
        summary.className = "zeile-craften";
        let text =
          "Craften: " +
          escapeHtml(nameVon(weg.item)) +
          (weg.stufe ? "." + weg.stufe : "") +
          " (Rezept #" +
          (weg.rezeptIndex + 1) +
          ", " +
          (weg.mitFokus ? "mit Fokus" : "ohne Fokus") +
          "), Stationsgebuehr " +
          formatSilber(weg.stationsgebuehrJeStueck) +
          (weg.gebaeude ? " (" + escapeHtml(weg.gebaeude) + ")" : "") +
          ", Rueckgewinnung " +
          formatProzent(weg.rrr * 100);
        if (weg.unvollstaendig) text += "<span class='badge-unvoll'>unvollstaendig</span>";
        text += altHtml;
        summary.innerHTML = text;
        details.appendChild(summary);
        const body = document.createElement("div");
        body.className = "body";
        (weg.zutaten || []).forEach((z) => {
          const zeile = document.createElement("div");
          const ruecklaufText = z.gesperrt
            ? ""
            : z.ruecklaufAusgeschlossen
            ? " (Ruecklauf ausgeschlossen)"
            : z.ruecklaufAnteil
            ? " (Ruecklauf " + formatProzent(z.ruecklaufAnteil * 100) + ")"
            : "";
          const kopf = document.createElement("div");
          kopf.className = "hint";
          kopf.textContent = z.menge.toFixed(2) + "x " + nameVon(z.item) + (z.stufe ? "." + z.stufe : "") + ruecklaufText;
          zeile.appendChild(kopf);
          zeile.appendChild(baueKnoten(z.weg, r, tiefe + 1));
          body.appendChild(zeile);
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
        let text = "Verzaubern auf ." + weg.stufe + " (Rezeptsilber " + formatSilber(weg.rezeptSilber) + ")";
        if (weg.unvollstaendig) text += "<span class='badge-unvoll'>unvollstaendig</span>";
        text += altHtml;
        summary.innerHTML = text;
        details.appendChild(summary);
        const body = document.createElement("div");
        body.className = "body";
        const vorstufeZeile = document.createElement("div");
        const vorstufeKopf = document.createElement("div");
        vorstufeKopf.className = "hint";
        vorstufeKopf.textContent = "Vorstufe ." + (weg.stufe - 1);
        vorstufeZeile.appendChild(vorstufeKopf);
        vorstufeZeile.appendChild(baueKnoten(weg.vorstufe, r, tiefe + 1));
        body.appendChild(vorstufeZeile);
        (weg.materialien || []).forEach((m) => {
          const zeile = document.createElement("div");
          const kopf = document.createElement("div");
          kopf.className = "hint";
          kopf.textContent = m.menge + "x " + nameVon(m.item);
          zeile.appendChild(kopf);
          zeile.appendChild(baueKnoten(m.weg, r, tiefe + 1));
          body.appendChild(zeile);
        });
        details.appendChild(body);
        wrap.appendChild(details);
        return wrap;
      }

      return wrap;
    }

    function renderBauplan(r) {
      bauplanEl.innerHTML = "";
      if (r.gesperrt) {
        const div = document.createElement("div");
        div.className = "zeile-gesperrt";
        div.textContent = "Gesperrt: " + (r.grund || "");
        bauplanEl.appendChild(div);
        return;
      }
      bauplanEl.appendChild(baueKnoten(r.weg, r, 0));
    }

    alleAufBtn.addEventListener("click", () => bauplanEl.querySelectorAll("details").forEach((d) => (d.open = true)));
    alleZuBtn.addEventListener("click", () => bauplanEl.querySelectorAll("details").forEach((d) => (d.open = false)));

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
      return w.typ;
    }

    function renderAlleWege(r) {
      const tbody = alleWegeTabelleEl.querySelector("tbody");
      tbody.innerHTML = "";
      r.alleWege.forEach((w, idx) => {
        const tr = document.createElement("tr");
        const klassen = [];
        if (idx === 0 && !w.gesperrt) klassen.push("best");
        if (w.gesperrt) klassen.push("gesperrt-zeile");
        tr.className = klassen.join(" ");
        let statusHtml;
        if (w.gesperrt) statusHtml = "<span class='pill bad'>gesperrt</span> " + escapeHtml(w.grund || "");
        else if (w.unvollstaendig) statusHtml = "<span class='pill warn'>unvollstaendig</span>";
        else statusHtml = "<span class='pill good'>ok</span>";
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
          statusHtml +
          "</td>";
        tbody.appendChild(tr);
      });
    }

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

    skUebernehmenBtn.addEventListener("click", () => {
      const fce = Math.max(0, fceAusSchicksalsbrett(Number(skMeisterEl.value) || 0, Number(skSpezEl.value) || 0));
      fceEingabeEl.value = fce;
      einstellungen.fce = fce;
      fceHerkunftEl.textContent = "FCE " + fce.toLocaleString("de-DE") + " aus Schicksalsbrett uebernommen.";
      aktualisiereFceAnzeige();
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
    renderFceAusnahmen(null);
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
    fceAusSchicksalsbrett,
    prozentAusFce,
    eigenpreisKoenntHelfen,
    sammleFehlendePreise,
    gefilterteEigenpreisKandidaten,
    anzahlEigenpreiseGesetzt,
    formatSilber,
    formatFokus,
    formatProzent,
    formatAlter,
  };
})();
