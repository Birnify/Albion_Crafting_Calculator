// js/karte.js
//
// Reiter "Ancient Lands" (v3.14.0): interaktive Karte des Gebiets aus dem
// Dragonfire-Update. Gelände und feste Punkte (Truhen-Spawnpunkte, Schreine,
// Drachen, Teleporter-Verbindungen, Ausgänge, Lore) stammen aus dem
// Client-Dump und werden von build_karte.py erzeugt (assets/ancient-lands.webp,
// js/karte-daten.js). Dazu kommen ein Lauf-Tracker (Truhe geöffnet, Schrein
// benutzt, Verbindung aktiv, Insel erledigt) und eigene Marker.
//
// Ursprung: Entwurf "Albion Map Builder" eines Kollegen (Leaflet, eigene Marker,
// Export/Import). Übernommen sind Leaflet, eigene Marker mit Dialog, Ziehen,
// Export/Import und Vollbild; Kartenbild-Upload entfällt, weil die Karte fest ist.
//
// Eigener localStorage-Schlüssel, kein gemeinsamer Zustand mit anderen Reitern.

(function () {
  "use strict";

  const SPEICHER = "albion_kostenrechner_karte_v1";

  const EBENEN = [
    { id: "truhen", label: "Truhen", titel: "Feste Truhen-Spawnpunkte: 8 Camp-Truhen, 8 auf der Zentralinsel, 1 beim Feuerdrachen. Gleiche Lage in Solo, Veteran und Elite." },
    { id: "schreine", label: "Schreine", titel: "Drachenschreine: Knochen opfern für einen Segen. 12 feste Standorte." },
    { id: "drachen", label: "Drachen", titel: "Vier Drachen-Inseln und der Feuerdrache in der Mitte." },
    { id: "inseln", label: "Inseln", titel: "Inselnummer am Camp. Jedes Camp hat je Instanz 2 Truhen und einen Schlüsselstein, ihre genaue Lage wechselt." },
    { id: "verbindungen", label: "Verbindungen", titel: "Teleporter zwischen den Inseln. Klick schaltet aktiv/inaktiv." },
    { id: "ausgaenge", label: "Ausgänge", titel: "Ausgangsportale am Rand, dazu einer in der Mitte." },
    { id: "lore", label: "Lore", titel: "Lore-Fragmente, 6 feste Standorte." },
    { id: "angeln", label: "Angeln", titel: "Angelstellen mit Schatzchance." },
    { id: "eigene", label: "Eigene", titel: "Eigene Marker." },
  ];
  const EBENEN_VORGABE = { truhen: true, schreine: true, drachen: true, inseln: true, verbindungen: true, ausgaenge: true, lore: false, angeln: false, eigene: true };

  const TYPEN = {
    truhe: { label: "Truhe", farbe: "gold" },
    schrein: { label: "Schrein", farbe: "purple" },
    gegner: { label: "Gegner / Boss", farbe: "red" },
    gefahr: { label: "Gefahr / Spieler", farbe: "orange" },
    portal: { label: "Portal", farbe: "teal" },
    ressource: { label: "Ressource", farbe: "green" },
    notiz: { label: "Notiz", farbe: "dim" },
  };

  const TRUHEN_ART = { camp: "Camp-Truhe", zentrum: "Truhe der Zentralinsel", feuerdrache: "Truhe des Feuerdrachen" };

  // ------------------------------------------------------------ reine Helfer

  function leererLauf() {
    return { truhen: [], schreine: [], verbindungen: [], inseln: [] };
  }

  function nurTexte(arr, erlaubt) {
    if (!Array.isArray(arr)) return [];
    const gesehen = new Set();
    return arr.filter((v) => typeof v === "string" && (!erlaubt || erlaubt.has(v)) && !gesehen.has(v) && gesehen.add(v));
  }

  // Lauf-Stand säubern: nur bekannte IDs, keine Doppelten.
  function laufBereinigen(lauf, daten) {
    const d = daten || window.KARTE_DATEN || {};
    const ids = (liste) => new Set((liste || []).map((e) => e.id));
    const l = lauf && typeof lauf === "object" ? lauf : {};
    return {
      truhen: nurTexte(l.truhen, ids(d.truhen)),
      schreine: nurTexte(l.schreine, ids(d.schreine)),
      verbindungen: nurTexte(l.verbindungen, ids(d.verbindungen)),
      inseln: nurTexte(l.inseln, ids(d.inseln)),
    };
  }

  // Eigene Marker säubern (Import, alter Speicherstand). Ungültiges fliegt raus.
  function markerBereinigen(liste, grenze) {
    if (!Array.isArray(liste)) return [];
    const g = grenze || (window.KARTE_DATEN ? window.KARTE_DATEN.ausdehnung : 1000);
    const out = [];
    const ids = new Set();
    liste.forEach((m, i) => {
      if (!m || typeof m !== "object") return;
      const lat = Number(m.lat), lng = Number(m.lng);
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > g * 1.2 || Math.abs(lng) > g * 1.2) return;
      let id = typeof m.id === "string" && m.id ? m.id.slice(0, 60) : "m" + Date.now().toString(36) + i;
      if (ids.has(id)) id = id + "_" + i;
      ids.add(id);
      out.push({
        id: id,
        name: String(m.name == null ? "" : m.name).trim().slice(0, 80) || TYPEN[TYPEN[m.typ] ? m.typ : "notiz"].label,
        typ: TYPEN[m.typ] ? m.typ : (TYPEN[m.type] ? m.type : "notiz"),
        notiz: String(m.notiz == null ? (m.description || "") : m.notiz).slice(0, 500),
        lat: Math.round(lat * 10) / 10,
        lng: Math.round(lng * 10) / 10,
      });
    });
    return out;
  }

  function zustandLaden() {
    let roh = null;
    try { roh = JSON.parse(localStorage.getItem(SPEICHER)); } catch (e) { roh = null; }
    const ebenen = Object.assign({}, EBENEN_VORGABE);
    if (roh && roh.ebenen && typeof roh.ebenen === "object") {
      Object.keys(ebenen).forEach((k) => { if (typeof roh.ebenen[k] === "boolean") ebenen[k] = roh.ebenen[k]; });
    }
    return {
      ebenen: ebenen,
      lauf: laufBereinigen(roh && roh.lauf),
      marker: markerBereinigen(roh && roh.marker),
    };
  }

  function escapeHtml(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  }

  // ------------------------------------------------------------ Icons (SVG)

  const SVG = {
    truhe: '<svg viewBox="0 0 24 24"><path d="M4 10h16v9H4z" fill="currentColor" opacity=".35"/><path d="M4 10c0-3 2-5 5-5h6c3 0 5 2 5 5M4 10h16v9H4zM4 13h16M11 12h2v3h-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    schrein: '<svg viewBox="0 0 24 24"><path d="M12 3l5 6-5 12-5-12z" fill="currentColor" opacity=".35"/><path d="M12 3l5 6-5 12-5-12zM7 9h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    drache: '<svg viewBox="0 0 24 24"><path d="M12 3c1 4 6 5 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 1-6 1-9z" fill="currentColor" opacity=".4"/><path d="M12 3c1 4 6 5 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 1-6 1-9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    ausgang: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="6" ry="8" fill="currentColor" opacity=".3"/><ellipse cx="12" cy="12" rx="6" ry="8" fill="none" stroke="currentColor" stroke-width="1.8"/><ellipse cx="12" cy="12" rx="2.5" ry="4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    lore: '<svg viewBox="0 0 24 24"><path d="M5 5h9l5 5v9H5z" fill="currentColor" opacity=".3"/><path d="M5 5h9l5 5v9H5zM8 11h8M8 15h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    angeln: '<svg viewBox="0 0 24 24"><path d="M4 12c3-4 8-5 12-2l4-3v10l-4-3c-4 3-9 2-12-2z" fill="currentColor"/></svg>',
    gegner: '<svg viewBox="0 0 24 24"><path d="M12 3a7 7 0 0 0-5 12v3h10v-3a7 7 0 0 0-5-12z" fill="currentColor" opacity=".35"/><path d="M12 3a7 7 0 0 0-5 12v3h10v-3a7 7 0 0 0-5-12zM9 11h.01M15 11h.01M10 18v3M14 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    gefahr: '<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2z" fill="currentColor" opacity=".35"/><path d="M12 3l10 18H2zM12 10v5M12 18h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    portal: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="currentColor" opacity=".3"/><path d="M12 4a8 8 0 1 1-8 8M12 8a4 4 0 1 1-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    ressource: '<svg viewBox="0 0 24 24"><path d="M6 14l6-10 6 10-6 7z" fill="currentColor" opacity=".35"/><path d="M6 14l6-10 6 10-6 7zM6 14h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    notiz: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="currentColor" opacity=".35"/><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 9v4M12 15.5h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };

  // ------------------------------------------------------------ Oberfläche

  function boot() {
    const wurzel = document.getElementById("tab-karte");
    if (!wurzel || !window.L || !window.KARTE_DATEN) return; // z.B. tests/test.html
    const L = window.L;
    const D = window.KARTE_DATEN;
    const A = D.ausdehnung;
    const el = (id) => document.getElementById(id);

    const zustand = zustandLaden();
    let karte = null;
    let platzieren = false;
    const gruppen = {};
    const eigeneLayer = new Map();

    function speichern() {
      try {
        localStorage.setItem(SPEICHER, JSON.stringify(zustand));
      } catch (e) {
        status("Speichern fehlgeschlagen (Browser-Speicher voll oder gesperrt).", true);
      }
    }

    function status(text, fehler) {
      const s = el("kaStatus");
      s.textContent = text || "";
      s.className = fehler ? "err" : "";
    }

    function icon(art, klasse, extra) {
      return L.divIcon({
        className: "",
        html: '<div class="ka-pin ' + klasse + '">' + SVG[art] + (extra || "") + "</div>",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        tooltipAnchor: [14, 0],
        popupAnchor: [0, -14],
      });
    }

    function hat(liste, id) { return zustand.lauf[liste].indexOf(id) >= 0; }
    function umschalten(liste, id) {
      const l = zustand.lauf[liste];
      const i = l.indexOf(id);
      if (i >= 0) l.splice(i, 1); else l.push(id);
      speichern();
      zaehlerZeigen();
    }

    // -------------------------------------------- feste Ebenen
    function festeEbenenBauen() {
      Object.values(gruppen).forEach((g) => g.clearLayers());

      // Wie im Spiel von Inselmitte zu Inselmitte; die Portale selbst liegen
      // dicht beieinander am Inselrand (v.pa/v.pb), als Linie kaum sichtbar.
      const mitte = {};
      D.inseln.forEach((i) => { mitte[i.id] = i.p; });
      D.verbindungen.forEach((v) => {
        const aktiv = hat("verbindungen", v.id);
        const linie = L.polyline([mitte[v.a] || v.pa, mitte[v.b] || v.pb], {
          className: "ka-verb" + (aktiv ? " an" : ""),
          weight: aktiv ? 5 : 3,
          interactive: true,
          bubblingMouseEvents: false,
        });
        linie.bindTooltip("Verbindung " + v.a.replace("ISLAND_", "Insel ") + " ↔ " + v.b.replace("ISLAND_", "Insel ") +
          (aktiv ? " · aktiv" : " · inaktiv") + "<br><small>Klick schaltet um</small>", { sticky: true, className: "ka-tip" });
        linie.on("click", () => { umschalten("verbindungen", v.id); festeEbenenBauen(); });
        linie.addTo(gruppen.verbindungen);
      });

      D.inseln.forEach((i) => {
        if (i.art === "zentrum" || i.art === "pfad") return;
        const erledigt = hat("inseln", i.id);
        const art = i.art === "drache" ? "Drachen-Insel" : i.art === "gross" ? "große Insel" : "kleine Insel";
        const m = L.marker(i.p, {
          icon: L.divIcon({
            className: "",
            html: '<div class="ka-insel' + (erledigt ? " fertig" : "") + (i.art === "drache" ? " drache" : "") + '">' + (erledigt ? "✓" : i.nr) + "</div>",
            iconSize: [26, 26], iconAnchor: [13, 13], tooltipAnchor: [12, 0],
          }),
          keyboard: false,
        });
        m.bindTooltip("<b>Insel " + i.nr + "</b> · " + art + (erledigt ? " · erledigt" : "") +
          "<br>Camp mit 2 Truhen und Schlüsselstein, Lage je Instanz<br><small>Klick: erledigt umschalten</small>", { className: "ka-tip" });
        m.on("click", () => { umschalten("inseln", i.id); festeEbenenBauen(); });
        m.addTo(gruppen.inseln);
      });

      D.inseln.filter((i) => i.art === "drache").forEach((i) => {
        // Drachen-Symbol leicht versetzt, damit die Inselnummer lesbar bleibt.
        const p = [i.p[0] + 22, i.p[1] + 22];
        L.marker(p, { icon: icon("drache", "drache"), keyboard: false })
          .bindTooltip("<b>Drache</b> · Insel " + i.nr + "<br>Gehört zum Hauptziel; Truhen, Drachenblut, Wegsteinfragmente", { className: "ka-tip" })
          .addTo(gruppen.drachen);
      });
      if (D.feuerdrache) {
        L.marker(D.feuerdrache, { icon: icon("drache", "drache gross"), keyboard: false, zIndexOffset: 500 })
          .bindTooltip("<b>Feuerdrache</b> · Zentralinsel<br>Erscheint, wenn alle vier Drachen besiegt sind", { className: "ka-tip" })
          .addTo(gruppen.drachen);
      }

      D.truhen.forEach((t) => {
        const offen = hat("truhen", t.id);
        L.marker(t.p, { icon: icon("truhe", "truhe" + (offen ? " aus" : ""), offen ? '<span class="ka-haken">✓</span>' : ""), keyboard: false, zIndexOffset: 300 })
          .bindTooltip("<b>" + TRUHEN_ART[t.art] + "</b>" + (offen ? " · geöffnet" : "") + "<br><small>Klick: geöffnet umschalten</small>", { className: "ka-tip" })
          .on("click", () => { umschalten("truhen", t.id); festeEbenenBauen(); })
          .addTo(gruppen.truhen);
      });

      D.schreine.forEach((s, n) => {
        const benutzt = hat("schreine", s.id);
        L.marker(s.p, { icon: icon("schrein", "schrein" + (benutzt ? " aus" : ""), benutzt ? '<span class="ka-haken">✓</span>' : ""), keyboard: false, zIndexOffset: 200 })
          .bindTooltip("<b>Drachenschrein " + (n + 1) + "</b>" + (benutzt ? " · benutzt" : "") + "<br>Knochen opfern für einen Segen<br><small>Klick: benutzt umschalten</small>", { className: "ka-tip" })
          .on("click", () => { umschalten("schreine", s.id); festeEbenenBauen(); })
          .addTo(gruppen.schreine);
      });

      D.ausgaenge.forEach((a) => {
        L.marker(a.p, { icon: icon("ausgang", "ausgang"), keyboard: false })
          .bindTooltip("<b>Ausgang</b>" + (a.zentrum ? " · Zentralinsel" : ""), { className: "ka-tip" })
          .addTo(gruppen.ausgaenge);
      });
      D.lore.forEach((l) => {
        L.marker(l.p, { icon: icon("lore", "lore"), keyboard: false })
          .bindTooltip("<b>Lore-Fragment</b>", { className: "ka-tip" })
          .addTo(gruppen.lore);
      });
      D.angeln.forEach((p) => {
        L.marker(p, { icon: L.divIcon({ className: "", html: '<div class="ka-angel">' + SVG.angeln + "</div>", iconSize: [18, 18], iconAnchor: [9, 9] }), keyboard: false })
          .bindTooltip("Angelstelle mit Schatzchance", { className: "ka-tip" })
          .addTo(gruppen.angeln);
      });
    }

    // -------------------------------------------- eigene Marker
    function eigeneBauen() {
      gruppen.eigene.clearLayers();
      eigeneLayer.clear();
      zustand.marker.forEach((m) => {
        const typ = TYPEN[m.typ] || TYPEN.notiz;
        const lm = L.marker([m.lat, m.lng], { icon: icon(m.typ in SVG ? m.typ : "notiz", "eigen f-" + typ.farbe), draggable: true, zIndexOffset: 600 });
        lm.bindPopup(
          '<div class="ka-pop"><h3>' + escapeHtml(m.name) + "</h3><p class=\"ka-pop-typ\">" + escapeHtml(typ.label) + "</p>" +
          (m.notiz ? "<p>" + escapeHtml(m.notiz) + "</p>" : "") +
          '<button type="button" class="mini ka-bearbeiten" data-id="' + escapeHtml(m.id) + '">Bearbeiten</button></div>'
        );
        lm.on("dragend", (e) => {
          const p = e.target.getLatLng();
          m.lat = Math.round(p.lat * 10) / 10;
          m.lng = Math.round(p.lng * 10) / 10;
          speichern();
        });
        lm.on("dblclick", () => dialogOeffnen(m.id));
        lm.addTo(gruppen.eigene);
        eigeneLayer.set(m.id, lm);
      });
      listeZeigen();
    }

    function listeZeigen() {
      const box = el("kaListe");
      if (!zustand.marker.length) {
        box.innerHTML = '<div class="ka-leer">Noch keine eigenen Marker. „Marker setzen“ und auf die Karte klicken.</div>';
        return;
      }
      box.innerHTML = zustand.marker.map((m) => {
        const typ = TYPEN[m.typ] || TYPEN.notiz;
        return '<button type="button" class="ka-eintrag" data-id="' + escapeHtml(m.id) + '" title="Klick: hinspringen, Doppelklick: bearbeiten">' +
          '<span class="ka-punkt f-' + typ.farbe + '">' + SVG[m.typ in SVG ? m.typ : "notiz"] + "</span>" +
          '<span class="ka-eintrag-text"><b>' + escapeHtml(m.name) + "</b><small>" + escapeHtml(typ.label) + "</small></span></button>";
      }).join("");
    }

    el("kaListe").addEventListener("click", (e) => {
      const b = e.target.closest(".ka-eintrag");
      if (!b) return;
      const lm = eigeneLayer.get(b.dataset.id);
      if (!lm) return;
      if (!zustand.ebenen.eigene) { zustand.ebenen.eigene = true; ebenenAnwenden(); }
      karte.setView(lm.getLatLng(), Math.max(karte.getZoom(), 0.5));
      lm.openPopup();
    });
    el("kaListe").addEventListener("dblclick", (e) => {
      const b = e.target.closest(".ka-eintrag");
      if (b) dialogOeffnen(b.dataset.id);
    });
    wurzel.addEventListener("click", (e) => {
      const b = e.target.closest(".ka-bearbeiten");
      if (b) { karte.closePopup(); dialogOeffnen(b.dataset.id); }
    });

    // -------------------------------------------- Dialog
    const dlg = el("kaDialog");
    let neuePos = null;
    el("kaTyp").innerHTML = Object.keys(TYPEN).map((k) => '<option value="' + k + '">' + TYPEN[k].label + "</option>").join("");

    function dialogOeffnen(id) {
      const m = id ? zustand.marker.find((x) => x.id === id) : null;
      el("kaDialogTitel").textContent = m ? "Marker bearbeiten" : "Marker setzen";
      el("kaId").value = m ? m.id : "";
      el("kaName").value = m ? m.name : "";
      el("kaTyp").value = m ? m.typ : "truhe";
      el("kaNotiz").value = m ? m.notiz : "";
      el("kaLoeschen").hidden = !m;
      dlg.showModal();
      el("kaName").focus();
    }

    el("kaForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const id = el("kaId").value;
      const typ = el("kaTyp").value;
      const daten = {
        name: el("kaName").value.trim().slice(0, 80) || TYPEN[typ].label,
        typ: typ,
        notiz: el("kaNotiz").value.trim().slice(0, 500),
      };
      const vorhanden = zustand.marker.find((x) => x.id === id);
      if (vorhanden) Object.assign(vorhanden, daten);
      else if (neuePos) {
        zustand.marker.push(Object.assign({ id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }, daten,
          { lat: Math.round(neuePos.lat * 10) / 10, lng: Math.round(neuePos.lng * 10) / 10 }));
      }
      neuePos = null;
      speichern();
      eigeneBauen();
      dlg.close();
    });
    el("kaAbbrechen").addEventListener("click", () => { neuePos = null; dlg.close(); });
    el("kaLoeschen").addEventListener("click", () => {
      const id = el("kaId").value;
      zustand.marker = zustand.marker.filter((x) => x.id !== id);
      speichern();
      eigeneBauen();
      dlg.close();
    });

    // -------------------------------------------- Bedienleiste
    function platzierenSetzen(an) {
      platzieren = an;
      el("kaSetzen").textContent = an ? "Abbrechen" : "Marker setzen";
      el("kaSetzen").classList.toggle("an", an);
      el("kaHinweis").hidden = !an;
      el("kaKarte").classList.toggle("ka-zielen", an);
    }
    el("kaSetzen").addEventListener("click", () => platzierenSetzen(!platzieren));

    el("kaNeuerLauf").addEventListener("click", () => {
      const l = zustand.lauf;
      const n = l.truhen.length + l.schreine.length + l.verbindungen.length + l.inseln.length;
      if (n && !confirm("Neuen Lauf beginnen? Geöffnete Truhen, benutzte Schreine, aktive Verbindungen und erledigte Inseln werden zurückgesetzt. Eigene Marker bleiben.")) return;
      zustand.lauf = leererLauf();
      speichern();
      festeEbenenBauen();
      zaehlerZeigen();
      status("Neuer Lauf, alles zurückgesetzt.");
    });

    el("kaExport").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify({ app: "Albion Werkzeuge, Ancient Lands", version: 1, exportiert: new Date().toISOString(), marker: zustand.marker, lauf: zustand.lauf }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ancient-lands-marker.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status(zustand.marker.length + " Marker exportiert.");
    });
    el("kaImport").addEventListener("click", () => el("kaImportDatei").click());
    el("kaImportDatei").addEventListener("change", (e) => {
      const datei = e.target.files[0];
      e.target.value = "";
      if (!datei) return;
      const r = new FileReader();
      r.onload = () => {
        let roh;
        try { roh = JSON.parse(r.result); } catch (err) { status("Datei ist kein gültiges JSON.", true); return; }
        const neu = markerBereinigen(roh && roh.markers ? roh.markers : roh && roh.marker);
        if (!neu.length && !(roh && roh.lauf)) { status("Keine Marker in der Datei gefunden.", true); return; }
        const vorhanden = new Set(zustand.marker.map((m) => m.id));
        let dazu = 0;
        neu.forEach((m) => { if (!vorhanden.has(m.id)) { zustand.marker.push(m); dazu++; } });
        if (roh && roh.lauf && confirm("Die Datei enthält auch einen Lauf-Stand. Übernehmen?")) zustand.lauf = laufBereinigen(roh.lauf);
        speichern();
        eigeneBauen();
        festeEbenenBauen();
        zaehlerZeigen();
        status(dazu + " Marker importiert" + (neu.length > dazu ? ", " + (neu.length - dazu) + " schon vorhanden" : "") + ".");
      };
      r.readAsText(datei);
    });
    el("kaAllesLoeschen").addEventListener("click", () => {
      if (!zustand.marker.length) return;
      if (!confirm("Alle " + zustand.marker.length + " eigenen Marker löschen?")) return;
      zustand.marker = [];
      speichern();
      eigeneBauen();
      status("Eigene Marker gelöscht.");
    });
    el("kaVollbild").addEventListener("click", () => {
      const ziel = el("kaKarteRahmen");
      if (!document.fullscreenElement) ziel.requestFullscreen && ziel.requestFullscreen();
      else document.exitFullscreen();
    });
    document.addEventListener("fullscreenchange", () => setTimeout(() => karte && karte.invalidateSize(), 120));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && platzieren) platzierenSetzen(false);
    });

    // -------------------------------------------- Ebenen-Chips und Zähler
    el("kaEbenen").innerHTML = EBENEN.map((e) =>
      '<label class="ka-chip" title="' + escapeHtml(e.titel) + '"><input type="checkbox" data-ebene="' + e.id + '">' + escapeHtml(e.label) + "</label>").join("");
    el("kaEbenen").addEventListener("change", (e) => {
      const cb = e.target.closest("input[data-ebene]");
      if (!cb) return;
      zustand.ebenen[cb.dataset.ebene] = cb.checked;
      speichern();
      ebenenAnwenden();
    });

    function ebenenAnwenden() {
      el("kaEbenen").querySelectorAll("input[data-ebene]").forEach((cb) => {
        cb.checked = !!zustand.ebenen[cb.dataset.ebene];
        cb.parentElement.classList.toggle("an", cb.checked);
      });
      if (!karte) return;
      Object.keys(gruppen).forEach((k) => {
        if (zustand.ebenen[k]) gruppen[k].addTo(karte); else gruppen[k].remove();
      });
    }

    function zaehlerZeigen() {
      const l = zustand.lauf;
      const inselnMitCamp = D.inseln.filter((i) => i.art !== "zentrum" && i.art !== "pfad").length;
      const zeilen = [
        ["Truhen geöffnet", l.truhen.length, D.truhen.length],
        ["Schreine benutzt", l.schreine.length, D.schreine.length],
        ["Inseln erledigt", l.inseln.length, inselnMitCamp],
        ["Verbindungen aktiv", l.verbindungen.length, D.verbindungen.length],
      ];
      el("kaZaehler").innerHTML = zeilen.map((z) =>
        '<div class="ka-z"><span>' + z[0] + '</span><b>' + z[1] + "<small> / " + z[2] + '</small></b><i style="--w:' + (z[2] ? Math.round(z[1] / z[2] * 100) : 0) + '%"></i></div>').join("");
    }

    // -------------------------------------------- Karte erst beim ersten Öffnen
    function karteStarten() {
      if (karte) { karte.invalidateSize(); return; }
      const grenzen = [[-A, -A], [A, A]];
      karte = L.map("kaKarte", {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 2.5,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 90,
        maxBounds: [[-A * 1.15, -A * 1.15], [A * 1.15, A * 1.15]],
        maxBoundsViscosity: 0.8,
        attributionControl: true,
        doubleClickZoom: true,
      });
      karte.attributionControl.setPrefix(false);
      karte.attributionControl.addAttribution("Gelände und Punkte aus dem Client-Dump (ao-bin-dumps)");
      L.imageOverlay("assets/ancient-lands.webp?v=3.14.0", grenzen, { className: "ka-gelaende" }).addTo(karte);
      L.polygon([[A, 0], [0, A], [-A, 0], [0, -A]], { className: "ka-rahmen", interactive: false, fill: false }).addTo(karte);
      [["N", [A + 34, 0]], ["O", [0, A + 34]], ["S", [-A - 34, 0]], ["W", [0, -A - 34]]].forEach((r) => {
        L.marker(r[1], { icon: L.divIcon({ className: "", html: '<div class="ka-rose">' + r[0] + "</div>", iconSize: [28, 28], iconAnchor: [14, 14] }), interactive: false, keyboard: false }).addTo(karte);
      });
      EBENEN.forEach((e) => { gruppen[e.id] = L.layerGroup(); });
      festeEbenenBauen();
      eigeneBauen();
      ebenenAnwenden();
      const sicht = [[-A * 0.86, -A * 0.86], [A * 0.86, A * 0.86]];
      karte.fitBounds(sicht);
      // Bei weitem Herauszoomen kleinere Symbole, sonst deckt die Mitte sich zu.
      const groesse = () => el("kaKarte").classList.toggle("ka-klein", karte.getZoom() < -0.25);
      karte.on("zoomend", groesse);
      groesse();

      karte.on("click", (e) => {
        if (!platzieren) return;
        neuePos = e.latlng;
        platzierenSetzen(false);
        if (!zustand.ebenen.eigene) { zustand.ebenen.eigene = true; ebenenAnwenden(); speichern(); }
        dialogOeffnen(null);
      });
    }

    zaehlerZeigen();
    ebenenAnwenden();
    listeZeigen();
    const knopf = document.getElementById("tabbtn-karte");
    if (knopf) knopf.addEventListener("click", () => setTimeout(karteStarten, 0));
    if (wurzel.style.display !== "none") karteStarten();
  }

  // ------------------------------------------------------------ Selbsttest

  function selbsttest() {
    const e = [];
    const t = (name, ok, details) => e.push({ name: name, ok: !!ok, details: details || "" });
    const D = window.KARTE_DATEN;
    t("Kartendaten geladen", !!D, "");
    if (D) {
      t("37 Inseln, 60 Verbindungen, 12 Schreine, 17 Truhen", D.inseln.length === 37 && D.verbindungen.length === 60 && D.schreine.length === 12 && D.truhen.length === 17,
        [D.inseln.length, D.verbindungen.length, D.schreine.length, D.truhen.length].join("/"));
      t("vier Drachen-Inseln", D.inseln.filter((i) => i.art === "drache").length === 4, "");
      t("Truhenarten 8 Camp, 8 Zentrum, 1 Feuerdrache",
        D.truhen.filter((x) => x.art === "camp").length === 8 && D.truhen.filter((x) => x.art === "zentrum").length === 8 && D.truhen.filter((x) => x.art === "feuerdrache").length === 1, "");
      const punkte = [].concat(D.truhen.map((x) => x.p), D.schreine.map((x) => x.p), D.ausgaenge.map((x) => x.p), D.lore.map((x) => x.p), D.inseln.map((x) => x.p));
      t("alle Punkte innerhalb der Raute", punkte.every((p) => Math.abs(p[0]) + Math.abs(p[1]) <= D.ausdehnung), "");
      const inselIds = new Set(D.inseln.map((i) => i.id));
      t("jede Verbindung verbindet zwei bekannte Inseln", D.verbindungen.every((v) => inselIds.has(v.a) && inselIds.has(v.b) && v.a !== v.b), "");
      // Drehung: Dump (x=-1, z=1) (Nordwesten) muss oben liegen.
      t("Feuerdrache nahe der Mitte", D.feuerdrache && Math.hypot(D.feuerdrache[0], D.feuerdrache[1]) < 20, String(D.feuerdrache));
      const l = laufBereinigen({ truhen: [D.truhen[0].id, D.truhen[0].id, "gibtsnicht", 5], schreine: "kaputt" }, D);
      t("laufBereinigen: doppelte und unbekannte IDs raus", l.truhen.length === 1 && l.schreine.length === 0 && Array.isArray(l.inseln), JSON.stringify(l));
    }
    const m = markerBereinigen([
      { id: "a", name: "Truhe hier", typ: "truhe", lat: 10, lng: 20 },
      { id: "a", name: "doppelt", typ: "truhe", lat: 1, lng: 2 },
      { name: "<b>x</b>", type: "boss", lat: "5", lng: "6", description: "alt" },
      { name: "weit weg", typ: "notiz", lat: 99999, lng: 0 },
      null, "quatsch",
    ], 820);
    t("markerBereinigen: Anzahl", m.length === 3, JSON.stringify(m));
    t("markerBereinigen: doppelte ID umbenannt", m[0].id === "a" && m[1].id !== "a", m[1] && m[1].id);
    t("markerBereinigen: unbekannter Typ wird Notiz, alte Beschreibung übernommen", m[2] && m[2].typ === "notiz" && m[2].notiz === "alt" && m[2].lat === 5, JSON.stringify(m[2]));
    t("markerBereinigen: kein Array ergibt leere Liste", markerBereinigen(null).length === 0 && markerBereinigen({}).length === 0, "");
    t("escapeHtml", escapeHtml("<a href='x'>&</a>") === "&lt;a href=&#039;x&#039;&gt;&amp;&lt;/a&gt;", "");
    return e;
  }

  window.KARTE = { selbsttest: selbsttest, laufBereinigen: laufBereinigen, markerBereinigen: markerBereinigen };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
