// js/preisvergleich.js
//
// Preisvergleich-Reiter der App-Fusion (13.09.2026): beliebige Items aus dem
// kompletten ao-bin-dumps-Namensdump suchen, mehrere auswaehlen, Live-Preise
// ueber alle 7 Hauptstaedte und alle 5 Qualitaetsstufen abrufen. Dient nicht
// dem Kostenrechner-Rezeptbaum, sondern dem schnellen Nachsehen, wo ein Item
// gerade am guenstigsten gehandelt wird.
//
// Migriert aus dem ehemals eigenstaendigen Eintopf-Rechner (Eintopf_Rechner.html,
// Reiter "Preisvergleich", dort seit 13.09.2026), im Zuge der App-Fusion
// (kostenrechner-KONTEXT.md, "App-Fusion: eine Web-App, drei Bereiche").
// Rechenlogik unveraendert uebernommen, nur an die neue Umgebung angepasst:
//
//   - Item-Namensliste kommt jetzt aus item-namen.js (ITEM_NAMEN.alle, von
//     build_graph.py erzeugt) statt aus einem in Python vorab geholten
//     DATEN.alleItems-Objekt.
//   - localStorage-Schluessel umbenannt auf das Kostenrechner-Namensschema
//     (albion_kostenrechner_*), s. js/preise.js. Der alte Schluessel aus dem
//     eigenstaendigen Eintopf-Rechner (eintopf_preisvergleich_v1) wird bewusst
//     NICHT gelesen - beide Apps bleiben bis zur vollstaendigen Migration
//     (Paket C) parallel benutzbar, mit getrennter Auswahl.
//
// BEWUSST kein gemeinsamer Code mit js/preise.js: der Preisvergleich bleibt
// fachlich eigenstaendig (eigene Realm-Konstante, eigener Retry-Mechanismus,
// eigener Cache), s. kostenrechner-KONTEXT.md, Abschnitt "Keine inhaltliche
// Vermischung der Rechenlogik". Etwas Codeverdopplung (Blockbildung, 429-
// Backoff) wird dafuer bewusst in Kauf genommen, genau wie REALM in js/preise.js
// und im ehemaligen eintopf_update.py bereits unabhaengig voneinander galt.

const PREISVERGLEICH = (function () {
  "use strict";

  // Realm: der Nutzer spielt auf Europa. "www." ist der Amerika-Server und
  // liefert stillschweigend andere Preise, s. ../CLAUDE.md, Abschnitt "Albion
  // Online Data Project API". Eigene Konstante, s. Kommentar oben.
  const REALM = "europe";
  const API_BASE = `https://${REALM}.albion-online-data.com/api/v2/stats`;

  const STAEDTE = ["Lymhurst", "Fort Sterling", "Bridgewatch", "Martlock", "Thetford", "Caerleon", "Brecilien"];
  const QUAL_NAMEN = { 1: "Normal", 2: "Gut", 3: "Herausragend", 4: "Exzellent", 5: "Meisterwerk" };
  const ALLE_QUALITAETEN = "1,2,3,4,5";

  const SPEICHER_KEY = "albion_kostenrechner_preisvergleich_v1";
  const BLOCKGROESSE = 50; // im Eintopf-Rechner erprobt, s. ../CLAUDE.md
  const PAUSE_MS = 1500;
  const MAX_VERSUCHE = 5;
  const TREFFER_LIMIT = 40;

  let auswahl = []; // [{id, q}], q = gewaehlte Qualitaet 1..5
  let daten = {}; // daten[itemId][stadt][qualitaet] = {sell,sellDate,buy,buyDate}

  // -----------------------------------------------------------------------
  // Reine Hilfsfunktionen (ohne DOM), einzeln testbar - s. tests/test.html
  // -----------------------------------------------------------------------

  function alleItems() {
    return (typeof ITEM_NAMEN !== "undefined" && ITEM_NAMEN.alle) || [];
  }

  function nameVon(id) {
    const treffer = alleItems().find((it) => it.id === id);
    return treffer ? treffer.n : id;
  }

  function istQualifizierbar(id) {
    const treffer = alleItems().find((it) => it.id === id);
    return !!(treffer && treffer.q);
  }

  /**
   * Sucht Items nach Name oder ID (Teilstring, gross-/kleinschreibungsunabhaengig),
   * schliesst bereits ausgewaehlte IDs aus, begrenzt auf TREFFER_LIMIT Treffer.
   */
  function sucheTreffer(query, ausgewaehlteIds) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    const ausschluss = new Set(ausgewaehlteIds || []);
    const treffer = [];
    for (const it of alleItems()) {
      if (ausschluss.has(it.id)) continue;
      if (it.n.toLowerCase().includes(q) || it.id.toLowerCase().includes(q)) {
        treffer.push(it);
        if (treffer.length >= TREFFER_LIMIT) break;
      }
    }
    return treffer;
  }

  function bloecke(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  function warte(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Baut die Abfrage-URL fuer den prices/-Endpunkt: alle Staedte UND alle
   * Qualitaeten in EINEM Request, s. ../CLAUDE.md ("CORS ist offen").
   */
  function baueUrl(ids, staedte, qualities) {
    const orte = staedte.join(",").replace(/ /g, "%20");
    return `${API_BASE}/prices/${ids.join(",")}.json?locations=${orte}&qualities=${qualities}`;
  }

  function istKeinAngebotDatum(datum) {
    return !datum || String(datum).startsWith("0001");
  }

  /**
   * Wandelt rohe /prices/-Zeilen (item_id, city, quality, sell_price_min, ...)
   * in die verschachtelte daten[id][stadt][qualitaet]-Struktur um. Pure
   * Funktion, damit sie ohne echten Netzabruf testbar ist.
   */
  function zeilenVerarbeiten(rows, zielDaten) {
    const ziel = zielDaten || {};
    (rows || []).forEach((zeile) => {
      const q = zeile.quality || 1;
      const id = zeile.item_id;
      if (!id) return;
      ziel[id] = ziel[id] || {};
      ziel[id][zeile.city] = ziel[id][zeile.city] || {};
      ziel[id][zeile.city][q] = {
        sell: istKeinAngebotDatum(zeile.sell_price_min_date) ? 0 : zeile.sell_price_min || 0,
        sellDate: zeile.sell_price_min_date || "",
        buy: istKeinAngebotDatum(zeile.buy_price_max_date) ? 0 : zeile.buy_price_max || 0,
        buyDate: zeile.buy_price_max_date || "",
      };
    });
    return ziel;
  }

  function alterTage(iso) {
    if (!iso || String(iso).startsWith("0001")) return null;
    return (Date.now() - new Date(iso + "Z").getTime()) / 86400000;
  }

  // -----------------------------------------------------------------------
  // Netzabruf: sequenziell, gedrosselt, mit Backoff bei 429 - dasselbe Muster
  // wie js/preise.js und der ehemalige Eintopf-Rechner, hier eigenstaendig
  // (s. Kommentar am Dateianfang).
  // -----------------------------------------------------------------------

  async function holeBlockMitRetry(block, staedte) {
    const url = baueUrl(block, staedte, ALLE_QUALITAETEN);
    let letzterFehler = null;
    for (let versuch = 0; versuch < MAX_VERSUCHE; versuch++) {
      try {
        const antwort = await fetch(url);
        if (antwort.status === 429) {
          await warte(PAUSE_MS * Math.pow(2, versuch + 1));
          continue;
        }
        if (!antwort.ok) throw new Error("HTTP " + antwort.status);
        return await antwort.json();
      } catch (e) {
        letzterFehler = e;
        if (versuch < MAX_VERSUCHE - 1) await warte(PAUSE_MS * Math.pow(2, versuch + 1));
      }
    }
    throw letzterFehler || new Error("Abruf fehlgeschlagen");
  }

  async function preiseAbrufen(ids, staedte) {
    let fehlgeschlagen = 0;
    for (const block of bloecke(ids, BLOCKGROESSE)) {
      try {
        const zeilen = await holeBlockMitRetry(block, staedte);
        zeilenVerarbeiten(zeilen, daten);
      } catch (e) {
        fehlgeschlagen++;
      }
      await warte(PAUSE_MS);
    }
    return fehlgeschlagen;
  }

  // -----------------------------------------------------------------------
  // localStorage-Persistenz der Auswahl (Item + gewaehlte Qualitaet)
  // -----------------------------------------------------------------------

  function auswahlLaden() {
    try {
      const d = JSON.parse(localStorage.getItem(SPEICHER_KEY) || "null");
      if (Array.isArray(d)) {
        const gueltigeIds = new Set(alleItems().map((it) => it.id));
        auswahl = d
          .filter((x) => x && x.id && gueltigeIds.has(x.id))
          .map((x) => ({ id: x.id, q: [1, 2, 3, 4, 5].includes(x.q) ? x.q : 1 }));
      }
    } catch (e) {
      /* defekter Speicher wird ignoriert */
    }
  }

  function auswahlSpeichern() {
    try {
      localStorage.setItem(SPEICHER_KEY, JSON.stringify(auswahl));
    } catch (e) {
      /* localStorage evtl. nicht verfuegbar (z.B. file://-Sicherheitskontext) */
    }
  }

  // -----------------------------------------------------------------------
  // DOM-Anbindung. Fruehzeitiger Ausstieg, falls das Markup fehlt (z.B. in
  // tests/test.html), analog js/ui.js boot().
  // -----------------------------------------------------------------------

  function boot() {
    const sucheEl = document.getElementById("pvSuche");
    const vorschlaegeEl = document.getElementById("pvVorschlaege");
    const auswahlEl = document.getElementById("pvAuswahl");
    const statusEl = document.getElementById("pvStatus");
    const refreshBtn = document.getElementById("pvRefresh");
    if (!sucheEl || !vorschlaegeEl || !auswahlEl || !statusEl || !refreshBtn) return;

    const nf = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
    const fmt = (v) => (v === null || v === undefined || !isFinite(v) || v === 0 ? "—" : nf.format(Math.round(v)));

    function datumZelle(iso) {
      const d = alterTage(iso);
      if (d === null) return "<span class='miss'>kein Angebot</span>";
      const s = new Date(iso + "Z").toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      if (d <= 1 / 24) return s;
      return `<span class="stale" title="${d < 1 ? Math.round(d * 24) + " Stunden" : Math.round(d) + " Tage"} alt">${s}</span>`;
    }

    function kopieren(text, el) {
      const melde = () => {
        const alt = el.textContent;
        el.textContent = "✓";
        el.classList.add("ok");
        setTimeout(() => {
          el.textContent = alt;
          el.classList.remove("ok");
        }, 1100);
      };
      const fallback = () => {
        const t = document.createElement("textarea");
        t.value = text;
        t.style.cssText = "position:fixed;top:-1000px;opacity:0";
        document.body.appendChild(t);
        t.select();
        try {
          document.execCommand("copy");
          melde();
        } catch (e) {
          alert(text);
        }
        document.body.removeChild(t);
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(melde).catch(fallback);
      else fallback();
    }

    const cpBtn = (text) => `<button class="cp" type="button" data-cp="${String(text).replace(/"/g, "&quot;")}" title="Namen kopieren">⧉</button>`;

    document.addEventListener(
      "click",
      (ev) => {
        const b = ev.target.closest(".cp");
        if (!b) return;
        ev.stopPropagation();
        kopieren(b.dataset.cp, b);
      },
      true
    );

    function suchen() {
      const treffer = sucheTreffer(sucheEl.value, auswahl.map((a) => a.id));
      if (!sucheEl.value.trim()) {
        vorschlaegeEl.style.display = "none";
        vorschlaegeEl.innerHTML = "";
        return;
      }
      vorschlaegeEl.innerHTML = treffer.length
        ? treffer.map((it) => `<div data-id="${it.id}">${it.n}<span class="hint"> · ${it.id}</span></div>`).join("")
        : '<div class="leer">Keine Treffer</div>';
      vorschlaegeEl.style.display = "block";
    }

    function hinzufuegen(id) {
      if (auswahl.some((a) => a.id === id)) return;
      auswahl.push({ id, q: 1 });
      auswahlSpeichern();
      render();
      preiseAbrufen([id], STAEDTE).then(render);
    }

    function entfernen(id) {
      auswahl = auswahl.filter((a) => a.id !== id);
      auswahlSpeichern();
      render();
    }

    function render() {
      if (!auswahl.length) {
        auswahlEl.innerHTML = '<div class="hint">Noch keine Items ausgewählt. Oben suchen und einen Treffer anklicken.</div>';
        return;
      }
      auswahlEl.innerHTML = auswahl
        .map((a) => {
          const name = nameVon(a.id);
          const qualWahl = istQualifizierbar(a.id)
            ? `<select data-qsel="${a.id}" title="Qualitätsstufe - nur Ausrüstung kennt das, Rohstoffe und Verbrauchsgüter nicht.">${[1, 2, 3, 4, 5]
                .map((n) => `<option value="${n}"${a.q === n ? " selected" : ""}>${QUAL_NAMEN[n]}</option>`)
                .join("")}</select>`
            : "";
          const je = daten[a.id] || {};
          const zeilen = STAEDTE.map((stadt) => {
            const e = (je[stadt] || {})[a.q] || null;
            return { stadt, sell: (e && e.sell) || 0, sellDate: (e && e.sellDate) || "", buy: (e && e.buy) || 0, buyDate: (e && e.buyDate) || "" };
          });
          const verfuegbareSells = zeilen.filter((z) => z.sell).map((z) => z.sell);
          const minSell = verfuegbareSells.length ? Math.min(...verfuegbareSells) : null;
          const geladen = Object.keys(je).length > 0;
          const rows = zeilen
            .map(
              (z) =>
                `<tr${z.sell && z.sell === minSell ? ' class="best"' : ""}>` +
                `<td class="l">${z.stadt}</td>` +
                `<td class="num">${z.sell ? "<strong>" + fmt(z.sell) + "</strong>" : "<span class='miss'>—</span>"}` +
                (z.sell ? `<div class="hint">${datumZelle(z.sellDate)}</div>` : "") +
                `</td>` +
                `<td class="num">${z.buy ? fmt(z.buy) : "<span class='miss'>—</span>"}` +
                (z.buy ? `<div class="hint">${datumZelle(z.buyDate)}</div>` : "") +
                `</td></tr>`
            )
            .join("");
          return (
            `<div class="pv-item">` +
            `<div class="pv-item-head"><strong>${name}</strong>${cpBtn(name)}${qualWahl}` +
            `<button type="button" class="mini" data-entf="${a.id}">Entfernen</button></div>` +
            (geladen
              ? `<div class="tblwrap"><table><thead><tr><th class="l">Stadt</th>` +
                `<th title="Niedrigstes Verkaufsangebot - was du beim Sofortkauf zahlst.">Sofortkauf</th>` +
                `<th title="Höchste Kauforder - was du beim Sofortverkauf bekämst.">Kaufgesuch</th>` +
                `</tr></thead><tbody>${rows}</tbody></table></div>`
              : '<div class="hint">Preise werden abgerufen …</div>') +
            `</div>`
          );
        })
        .join("");
    }

    async function abrufen(ids) {
      if (!ids || !ids.length) return;
      statusEl.className = "";
      statusEl.textContent = "Rufe Preise ab …";
      try {
        const fehlgeschlagen = await preiseAbrufen(ids, STAEDTE);
        const stand = new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
        statusEl.className = fehlgeschlagen ? "err" : "ok";
        statusEl.textContent = fehlgeschlagen ? `Abgerufen: ${stand} · ${fehlgeschlagen} Block/Blöcke fehlten` : `Abgerufen: ${stand}`;
      } catch (err) {
        statusEl.className = "err";
        statusEl.textContent = `Abruf fehlgeschlagen: ${err.message}`;
      } finally {
        render();
      }
    }

    sucheEl.addEventListener("input", suchen);
    vorschlaegeEl.addEventListener("click", (ev) => {
      const d = ev.target.closest("[data-id]");
      if (!d) return;
      hinzufuegen(d.dataset.id);
      sucheEl.value = "";
      vorschlaegeEl.style.display = "none";
    });
    document.addEventListener("click", (ev) => {
      if (!ev.target.closest(".pv-suche")) vorschlaegeEl.style.display = "none";
    });
    auswahlEl.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-entf]");
      if (b) entfernen(b.dataset.entf);
    });
    auswahlEl.addEventListener("change", (ev) => {
      const s = ev.target.closest("[data-qsel]");
      if (!s) return;
      const a = auswahl.find((x) => x.id === s.dataset.qsel);
      if (a) {
        a.q = +s.value;
        auswahlSpeichern();
        render();
      }
    });
    refreshBtn.addEventListener("click", () => abrufen(auswahl.map((a) => a.id)));

    auswahlLaden();
    render();
    if (auswahl.length) abrufen(auswahl.map((a) => a.id));
  }

  // -----------------------------------------------------------------------
  // Selbsttest, s. tests/test.html (Muster wie PREISE.selbsttest()).
  // -----------------------------------------------------------------------

  function selbsttest() {
    const ergebnisse = [];
    const pruefe = (name, ok, details) => ergebnisse.push({ name, ok: !!ok, details: details == null ? "" : String(details) });

    pruefe("ITEM_NAMEN geladen mit deutlich mehr als 10.000 Items", alleItems().length > 10000, alleItems().length);
    pruefe("nameVon() findet T4_BAG", nameVon("T4_BAG") !== "T4_BAG", nameVon("T4_BAG"));
    pruefe("nameVon() faellt bei unbekannter ID auf die ID zurueck", nameVon("__NICHT_VORHANDEN__") === "__NICHT_VORHANDEN__");
    pruefe("istQualifizierbar(T4_BAG) === true (Ausruestung)", istQualifizierbar("T4_BAG") === true);
    pruefe("istQualifizierbar(T4_WOOD) === false (Rohstoff)", istQualifizierbar("T4_WOOD") === false);
    pruefe("istQualifizierbar(T8_MEAL_STEW) === false (Speise)", istQualifizierbar("T8_MEAL_STEW") === false);

    const treffer = sucheTreffer("Kürbis", []);
    pruefe("sucheTreffer() findet Treffer fuer 'Kürbis'", treffer.length > 0, treffer.length);
    pruefe(
      "sucheTreffer() ist gross-/kleinschreibungsunabhaengig",
      sucheTreffer("kürbis", []).length === sucheTreffer("KÜRBIS", []).length
    );
    pruefe("sucheTreffer() schliesst bereits ausgewaehlte IDs aus", !sucheTreffer("Kürbis", treffer.length ? [treffer[0].id] : []).some((t) => t.id === (treffer[0] || {}).id));
    pruefe("sucheTreffer('') liefert keine Treffer (leere Suche)", sucheTreffer("", []).length === 0);
    pruefe(
      "sucheTreffer() begrenzt auf " + TREFFER_LIMIT + " Treffer",
      sucheTreffer("a", []).length <= TREFFER_LIMIT
    );

    const url = baueUrl(["T4_BAG", "T4_WOOD"], ["Lymhurst", "Fort Sterling"], "1,2,3,4,5");
    pruefe("baueUrl() nutzt den Europa-Realm", url.startsWith("https://europe.albion-online-data.com/"), url);
    pruefe("baueUrl() haengt beide IDs an", url.includes("T4_BAG,T4_WOOD"), url);
    pruefe("baueUrl() ersetzt Leerzeichen in Stadtnamen durch %20", url.includes("Fort%20Sterling"), url);
    pruefe("baueUrl() fragt alle 5 Qualitaeten in einem Request ab", url.includes("qualities=1,2,3,4,5"), url);

    const testDaten = {};
    zeilenVerarbeiten(
      [
        { item_id: "T4_BAG", city: "Lymhurst", quality: 1, sell_price_min: 1000, sell_price_min_date: new Date().toISOString(), buy_price_max: 800, buy_price_max_date: new Date().toISOString() },
        { item_id: "T4_BAG", city: "Lymhurst", quality: 2, sell_price_min: 0, sell_price_min_date: "0001-01-01T00:00:00", buy_price_max: 0, buy_price_max_date: "0001-01-01T00:00:00" },
      ],
      testDaten
    );
    pruefe("zeilenVerarbeiten() legt Stadt und Qualitaet korrekt verschachtelt ab", testDaten.T4_BAG && testDaten.T4_BAG.Lymhurst && testDaten.T4_BAG.Lymhurst[1].sell === 1000);
    pruefe("zeilenVerarbeiten() wertet das Nulldatum 0001-... als kein Angebot (sell=0)", testDaten.T4_BAG.Lymhurst[2].sell === 0);
    pruefe("zeilenVerarbeiten() ignoriert Zeilen ohne item_id statt abzustuerzen", (() => {
      try {
        zeilenVerarbeiten([{ city: "Lymhurst", quality: 1 }], {});
        return true;
      } catch (e) {
        return false;
      }
    })());

    pruefe("alterTage(null) === null (kein Angebot)", alterTage(null) === null);
    pruefe("alterTage('0001-01-01T00:00:00') === null (Nulldatum)", alterTage("0001-01-01T00:00:00") === null);
    pruefe("alterTage(jetzt) ist ungefaehr 0", (() => {
      const d = alterTage(new Date().toISOString().replace("Z", ""));
      return d !== null && d < 0.01;
    })());

    return ergebnisse;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    selbsttest,
    nameVon,
    istQualifizierbar,
    sucheTreffer,
    baueUrl,
    zeilenVerarbeiten,
    alterTage,
  };
})();
