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
  // Sichtbare Staedte (v3.4.0), getrennt von der Item-Auswahl gespeichert.
  const STAEDTE_KEY = "albion_kostenrechner_preisvergleich_staedte_v1";
  const BLOCKGROESSE = 50; // im Eintopf-Rechner erprobt, s. ../CLAUDE.md
  const PAUSE_MS = 1500;
  const MAX_VERSUCHE = 5;
  const TREFFER_LIMIT = 40;

  let auswahl = []; // [{id, q}], q = gewaehlte Qualitaet 1..5
  let daten = {}; // daten[itemId][stadt][qualitaet] = {sell,sellDate,buy,buyDate}
  let sichtbareStaedte = STAEDTE.slice(); // Anzeige-Filter; abgerufen werden immer alle
  // v3.13.0: erfasster Handel je Tag, volumen[itemId][stadt][qualitaet] =
  // Stueck je Tag (Mittel der letzten TAGE_FENSTER Tage, history/-Endpunkt).
  let volumen = {};
  const TAGE_FENSTER = 7; // wie "Craften: Gewinn" und "Veredeln leveln"

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

  // Seit v3.8.2 ueber die zentrale Regel (REGELN.istQualifizierbarId:
  // Knotenfeld mq aus rezepte.js, sonst q-Merker aus item-namen.js, beide
  // aus @maxqualitylevel des Dumps). Ohne geladenes regeln.js bleibt der
  // q-Merker allein massgeblich.
  // Verzauberte Varianten tragen im Namensdump die Endung @1 bis @4, aber
  // keinen eigenen q-Merker und keinen Knoten im Rezeptgraphen. Die
  // Qualitaet haengt nicht an der Verzauberung, deshalb zaehlt die Grund-ID
  // (Bugfix v3.12.1: vorher fehlte die Auswahl bei .1 bis .4).
  function basisId(id) {
    return String(id || "").replace(/@\d+$/, "");
  }

  // Stufe als "4.1" aus Tier-Praefix und @-Endung, damit gleichnamige
  // Verzauberungsstufen unterscheidbar sind. Ohne Tier-Praefix: "".
  function stufeVon(id) {
    const t = /^T(\d)_/.exec(String(id || ""));
    if (!t) return "";
    const v = /@(\d+)$/.exec(id);
    return t[1] + "." + (v ? v[1] : "0");
  }

  function istQualifizierbar(idRoh) {
    const id = basisId(idRoh);
    if (typeof REGELN !== "undefined" && REGELN.istQualifizierbarId) {
      const bekannt =
        (typeof REZEPTGRAPH !== "undefined" && REZEPTGRAPH.items && REZEPTGRAPH.items[id]) ||
        alleItems().some((it) => it.id === id);
      return bekannt ? REGELN.istQualifizierbarId(id) : false;
    }
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

  /**
   * Bereinigt eine gespeicherte Staedteauswahl: unbekannte Namen fliegen raus,
   * die Reihenfolge folgt immer STAEDTE. Kein gueltiges Array (erster Start,
   * defekter Speicher) heisst: alle Staedte. Ein leeres Array bleibt leer,
   * "keine Stadt" ist eine bewusste Wahl.
   */
  function staedteBereinigen(gespeichert) {
    if (!Array.isArray(gespeichert)) return STAEDTE.slice();
    return STAEDTE.filter((s) => gespeichert.includes(s));
  }

  /**
   * Baut die Tabellenzeilen eines Items fuer die sichtbaren Staedte und
   * markiert die guenstigste Verkaufsorder NUR unter diesen Staedten.
   */
  function tabellenZeilen(jeStadt, qualitaet, staedte, volJeStadt) {
    const je = jeStadt || {};
    const vol = volJeStadt || {};
    const zeilen = (staedte || []).map((stadt) => {
      const e = (je[stadt] || {})[qualitaet] || null;
      return {
        stadt,
        sell: (e && e.sell) || 0,
        sellDate: (e && e.sellDate) || "",
        buy: (e && e.buy) || 0,
        buyDate: (e && e.buyDate) || "",
        vol: volumenSumme(vol[stadt]),
        volJeQ: vol[stadt] || null,
      };
    });
    const sells = zeilen.filter((z) => z.sell).map((z) => z.sell);
    const minSell = sells.length ? Math.min(...sells) : null;
    zeilen.forEach((z) => {
      z.best = !!z.sell && z.sell === minSell;
    });
    return zeilen;
  }

  // Datum der API ohne Zonenangabe ist UTC (s. CLAUDE.md).
  function parseUtc(datum) {
    if (!datum) return NaN;
    const s = String(datum);
    return Date.parse(/[zZ]$|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z");
  }

  /**
   * Wertet rohe history/-Zeilen (item_id, location, quality, data[]) zu
   * Stueck je Tag aus: Summe von item_count der letzten `tage` Tage, geteilt
   * durch die volle Fensterbreite (Tage ohne Handel zaehlen als 0), gleiche
   * Lesart wie PREISE.normalisiereAbsatzZeile fuer "Craften: Gewinn".
   * history/ liefert je Qualitaet eine eigene Zeile und ignoriert den
   * Parameter qualities, deshalb nach Qualitaet getrennt abgelegt.
   * Rein, ohne Netz testbar.
   */
  function volumenAusHistorie(rows, tage, jetzt, ziel) {
    const out = ziel || {};
    const fenster = tage > 0 ? tage : TAGE_FENSTER;
    const bis = jetzt == null ? Date.now() : jetzt;
    const von = bis - fenster * 86400000;
    (rows || []).forEach((z) => {
      if (!z || !z.item_id || !z.location) return;
      const daten = Array.isArray(z.data) ? z.data : [];
      const summe = daten.reduce((a, x) => {
        const t = parseUtc(x && x.timestamp);
        return isFinite(t) && t >= von && t <= bis ? a + (x.item_count || 0) : a;
      }, 0);
      out[z.item_id] = out[z.item_id] || {};
      out[z.item_id][z.location] = out[z.item_id][z.location] || {};
      out[z.item_id][z.location][z.quality || 1] = summe / fenster;
    });
    return out;
  }

  /** Summe ueber alle Qualitaeten einer Stadt; null = nichts erfasst. */
  function volumenSumme(jeQ) {
    if (!jeQ) return null;
    const werte = Object.values(jeQ).filter((v) => isFinite(v));
    return werte.length ? werte.reduce((a, v) => a + v, 0) : null;
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

  function holeBlockMitRetry(block, staedte) {
    return holeMitRetry(baueUrl(block, staedte, ALLE_QUALITAETEN));
  }

  async function holeMitRetry(url) {
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

  function baueHistorieUrl(ids, staedte) {
    const orte = staedte.join(",").replace(/ /g, "%20");
    return `${API_BASE}/history/${ids.join(",")}.json?locations=${orte}&time-scale=24`;
  }

  // Preise und danach Handelsvolumen. renderZwischendurch zeigt die Preise,
  // bevor der langsamere history/-Abruf fertig ist.
  async function preiseAbrufen(ids, staedte, renderZwischendurch) {
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
    if (renderZwischendurch) renderZwischendurch();
    for (const block of bloecke(ids, BLOCKGROESSE)) {
      try {
        const zeilen = await holeMitRetry(baueHistorieUrl(block, staedte));
        // Alte Werte der abgerufenen Items verwerfen, sonst bleiben Tage
        // stehen, die inzwischen aus dem Fenster gefallen sind.
        block.forEach((id) => (volumen[id] = {}));
        volumenAusHistorie(zeilen, TAGE_FENSTER, null, volumen);
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

  function staedteLaden() {
    try {
      sichtbareStaedte = staedteBereinigen(JSON.parse(localStorage.getItem(STAEDTE_KEY) || "null"));
    } catch (e) {
      sichtbareStaedte = STAEDTE.slice();
    }
  }

  function staedteSpeichern() {
    try {
      localStorage.setItem(STAEDTE_KEY, JSON.stringify(sichtbareStaedte));
    } catch (e) {
      /* s. auswahlSpeichern() */
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
    const staedteEl = document.getElementById("pvStaedte");
    if (!staedteEl || !sucheEl || !vorschlaegeEl || !auswahlEl || !statusEl || !refreshBtn) return;

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

    const nf1 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
    // Unter 10 Stueck je Tag mit einer Nachkommastelle, sonst ganzzahlig.
    const stueck = (v) => (v < 10 ? nf1.format(v) : nf.format(Math.round(v)));
    function volTitel(jeQ) {
      if (!jeQ) return "";
      const teile = [1, 2, 3, 4, 5].filter((q) => jeQ[q] > 0).map((q) => `${QUAL_NAMEN[q]}: ${stueck(jeQ[q])}`);
      return teile.length ? ` title="${teile.join(" · ")}"` : "";
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
        ? treffer.map((it) => `<div data-id="${it.id}">${it.n}${stufeVon(it.id) ? " " + stufeVon(it.id) : ""}<span class="hint"> · ${it.id}</span></div>`).join("")
        : '<div class="leer">Keine Treffer</div>';
      vorschlaegeEl.style.display = "block";
    }

    function hinzufuegen(id) {
      if (auswahl.some((a) => a.id === id)) return;
      auswahl.push({ id, q: 1 });
      auswahlSpeichern();
      render();
      preiseAbrufen([id], STAEDTE, render).then(render);
    }

    function entfernen(id) {
      auswahl = auswahl.filter((a) => a.id !== id);
      auswahlSpeichern();
      render();
    }

    // Checkboxen je Stadt plus Umschaltknopf, Muster wie etStaedte im
    // Eintopf-Rechner (js/eintopf-ui.js). Filtert nur die Anzeige.
    function staedteAufbauen() {
      const alle = sichtbareStaedte.length === STAEDTE.length;
      staedteEl.innerHTML =
        `<div class="t">Angezeigte Städte<button type="button" id="pvAlleStaedte" class="mini">${alle ? "Alle abwählen" : "Alle auswählen"}</button></div>` +
        STAEDTE.map((c) => `<label><input type="checkbox" value="${c}"${sichtbareStaedte.includes(c) ? " checked" : ""}>${c}</label>`).join("");
    }

    function render() {
      if (!auswahl.length) {
        auswahlEl.innerHTML = '<div class="hint">Noch keine Items ausgewählt. Oben suchen und einen Treffer anklicken.</div>';
        return;
      }
      auswahlEl.innerHTML = auswahl
        .map((a) => {
          const name = nameVon(a.id);
          const qualifizierbar = istQualifizierbar(a.id);
          const qualWahl = qualifizierbar
            ? `<select data-qsel="${a.id}" title="Qualitätsstufe - nur Ausrüstung kennt das, Rohstoffe und Verbrauchsgüter nicht.">${[1, 2, 3, 4, 5]
                .map((n) => `<option value="${n}"${a.q === n ? " selected" : ""}>${QUAL_NAMEN[n]}</option>`)
                .join("")}</select>`
            : "";
          const je = daten[a.id] || {};
          // Ohne Qualitaetsstufen gilt immer Normal (1), auch wenn aus einer
          // frueheren Version noch eine andere Stufe gespeichert ist.
          const zeilen = tabellenZeilen(je, qualifizierbar ? a.q : 1, sichtbareStaedte, volumen[a.id]);
          const volGeladen = !!volumen[a.id];
          const geladen = Object.keys(je).length > 0;
          const rows = zeilen
            .map(
              (z) =>
                `<tr${z.best ? ' class="best"' : ""}>` +
                `<td class="l">${z.stadt}</td>` +
                `<td class="num">${z.sell ? "<strong>" + fmt(z.sell) + "</strong>" : "<span class='miss'>—</span>"}` +
                (z.sell ? `<div class="hint">${datumZelle(z.sellDate)}</div>` : "") +
                `</td>` +
                `<td class="num">${z.buy ? fmt(z.buy) : "<span class='miss'>—</span>"}` +
                (z.buy ? `<div class="hint">${datumZelle(z.buyDate)}</div>` : "") +
                `</td>` +
                `<td class="num"${volTitel(z.volJeQ)}>${!volGeladen ? "<span class='hint'>…</span>" : z.vol ? stueck(z.vol) : "<span class='miss'>—</span>"}</td></tr>`
            )
            .join("");
          return (
            `<div class="pv-item">` +
            `<div class="pv-item-head"><strong>${name}${stufeVon(a.id) ? " " + stufeVon(a.id) : ""}</strong>${cpBtn(name)}${qualWahl}` +
            `<button type="button" class="mini" data-entf="${a.id}">Entfernen</button></div>` +
            (!sichtbareStaedte.length
              ? '<div class="hint">Keine Stadt ausgewählt. Oben mindestens eine Stadt anhaken.</div>'
              : geladen
              ? `<div class="tblwrap"><table><thead><tr><th class="l">Stadt</th>` +
                `<th title="Günstigste Verkaufsorder am Markt, das zahlst du beim Sofortkauf.">Verkaufsorders</th>` +
                `<th title="Höchste Kauforder am Markt, das bekämst du beim Sofortverkauf.">Kauforders</th>` +
                `<th title="Erfasster Handel in dieser Stadt, alle Qualitäten zusammen, Mittel der letzten ${TAGE_FENSTER} Tage. Gezählt wird nur, was Spieler mit Data-Client gesehen haben, also eine Untergrenze. Aufschlüsselung je Qualität im Tooltip der Zahl.">verkauft/Tag</th>` +
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
        const fehlgeschlagen = await preiseAbrufen(ids, STAEDTE, () => {
          statusEl.textContent = "Preise da, rufe Handelsvolumen ab …";
          render();
        });
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
    staedteEl.addEventListener("change", (ev) => {
      if (!ev.target.matches("input[type=checkbox]")) return;
      const an = new Set([...staedteEl.querySelectorAll("input:checked")].map((x) => x.value));
      sichtbareStaedte = staedteBereinigen([...an]);
      staedteSpeichern();
      staedteAufbauen();
      render();
    });
    staedteEl.addEventListener("click", (ev) => {
      if (!ev.target.closest("#pvAlleStaedte")) return;
      sichtbareStaedte = sichtbareStaedte.length === STAEDTE.length ? [] : STAEDTE.slice();
      staedteSpeichern();
      staedteAufbauen();
      render();
    });

    staedteLaden();
    staedteAufbauen();
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
    pruefe("istQualifizierbar(T8_FURNITUREITEM_BED) === false (Moebel, maxqualitylevel fehlt)", istQualifizierbar("T8_FURNITUREITEM_BED") === false);
    pruefe("istQualifizierbar(T4_2H_TOOL_PICK) === false (Werkzeug, maxqualitylevel 1)", istQualifizierbar("T4_2H_TOOL_PICK") === false);
    pruefe("istQualifizierbar(T3_MOUNT_HORSE) === true (Reittier, maxqualitylevel 5)", istQualifizierbar("T3_MOUNT_HORSE") === true);
    pruefe("istQualifizierbar(T4_HEAD_CLOTH_SET1@1) === true (verzauberte Ausruestung, Bugfix v3.12.1)", istQualifizierbar("T4_HEAD_CLOTH_SET1@1") === true);
    pruefe("istQualifizierbar(T4_BAG@4) === true (verzauberte Tasche)", istQualifizierbar("T4_BAG@4") === true);
    pruefe("istQualifizierbar(T4_PLANKS_LEVEL1@1) === false, verzauberter Rohstoff bleibt ohne Qualitaet", istQualifizierbar("T4_PLANKS_LEVEL1@1") === false);
    pruefe("stufeVon(): T4_BAG = 4.0, T4_BAG@3 = 4.3, ohne Tier leer", stufeVon("T4_BAG") === "4.0" && stufeVon("T4_BAG@3") === "4.3" && stufeVon("UNIQUE_X") === "");
    pruefe("istQualifizierbar(UNBEKANNT) === false (unbekannte ID)", istQualifizierbar("GIBT_ES_NICHT_XYZ") === false);

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

    pruefe("staedteBereinigen(null) liefert alle 7 Staedte (erster Start)", staedteBereinigen(null).length === 7);
    pruefe("staedteBereinigen('kaputt') liefert alle 7 Staedte", staedteBereinigen("kaputt").length === 7);
    pruefe("staedteBereinigen([]) bleibt leer (bewusst keine Stadt)", staedteBereinigen([]).length === 0);
    pruefe(
      "staedteBereinigen() verwirft Unbekanntes und ordnet nach STAEDTE",
      staedteBereinigen(["Caerleon", "Atlantis", "Lymhurst"]).join("|") === "Lymhurst|Caerleon",
      staedteBereinigen(["Caerleon", "Atlantis", "Lymhurst"]).join("|")
    );
    const tz = {
      Lymhurst: { 1: { sell: 976, buy: 957 } },
      Caerleon: { 1: { sell: 886, buy: 806 } },
      Martlock: { 1: { sell: 954, buy: 969 } },
      Thetford: { 2: { sell: 500, buy: 400 } },
    };
    const zAlle = tabellenZeilen(tz, 1, STAEDTE);
    pruefe("tabellenZeilen() liefert je sichtbarer Stadt eine Zeile", zAlle.length === 7);
    pruefe(
      "tabellenZeilen() markiert die guenstigste Verkaufsorder aller Staedte",
      zAlle.filter((z) => z.best).map((z) => z.stadt).join() === "Caerleon"
    );
    const zOhneCaerleon = tabellenZeilen(tz, 1, ["Lymhurst", "Martlock", "Thetford"]);
    pruefe(
      "tabellenZeilen() zeigt nur die gewaehlten Staedte, in STAEDTE-Reihenfolge",
      zOhneCaerleon.map((z) => z.stadt).join("|") === "Lymhurst|Martlock|Thetford"
    );
    pruefe(
      "tabellenZeilen() bestimmt den Bestpreis nur unter den gewaehlten Staedten",
      zOhneCaerleon.filter((z) => z.best).map((z) => z.stadt).join() === "Martlock"
    );
    pruefe("tabellenZeilen() nutzt nur die gewaehlte Qualitaet (Thetford Q2 zaehlt bei Q1 nicht)", zOhneCaerleon[2].sell === 0 && !zOhneCaerleon[2].best);
    const jetzt = Date.parse("2026-10-17T12:00:00Z");
    const hist = volumenAusHistorie(
      [
        { item_id: "T4_BAG", location: "Lymhurst", quality: 1, data: [{ item_count: 70, timestamp: "2026-10-16T00:00:00" }, { item_count: 7, timestamp: "2026-10-15T00:00:00" }, { item_count: 999, timestamp: "2026-10-01T00:00:00" }] },
        { item_id: "T4_BAG", location: "Lymhurst", quality: 3, data: [{ item_count: 14, timestamp: "2026-10-14T00:00:00" }] },
        { item_id: "T4_BAG", location: "Caerleon", quality: 1, data: [] },
        { location: "Lymhurst", quality: 1, data: [] },
      ],
      7,
      jetzt
    );
    pruefe("volumenAusHistorie(): 7-Tage-Mittel je Qualitaet, alte Tage fallen raus (77/7 = 11)", hist.T4_BAG.Lymhurst[1] === 11, hist.T4_BAG.Lymhurst[1]);
    pruefe("volumenAusHistorie(): Qualitaeten getrennt abgelegt (14/7 = 2)", hist.T4_BAG.Lymhurst[3] === 2, hist.T4_BAG.Lymhurst[3]);
    pruefe("volumenSumme(): Summe ueber alle Qualitaeten (11 + 2 = 13)", volumenSumme(hist.T4_BAG.Lymhurst) === 13);
    pruefe("volumenSumme(): Stadt ohne Zeile = null, Zeile ohne Handel = 0", volumenSumme(hist.T4_BAG.Martlock) === null && volumenSumme(hist.T4_BAG.Caerleon) === 0);
    const zVol = tabellenZeilen(tz, 1, ["Lymhurst", "Martlock"], hist.T4_BAG);
    pruefe("tabellenZeilen() traegt das Volumen je Stadt ein", zVol[0].vol === 13 && zVol[1].vol === null);
    pruefe("baueHistorieUrl(): history/, alle Staedte, Tageswerte", baueHistorieUrl(["T4_BAG"], ["Fort Sterling"]).endsWith("/history/T4_BAG.json?locations=Fort%20Sterling&time-scale=24"));
    pruefe("tabellenZeilen() ohne Staedte liefert keine Zeilen", tabellenZeilen(tz, 1, []).length === 0);

    return ergebnisse;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    selbsttest,
    nameVon,
    istQualifizierbar,
    stufeVon,
    sucheTreffer,
    baueUrl,
    zeilenVerarbeiten,
    alterTage,
    staedteBereinigen,
    tabellenZeilen,
    volumenAusHistorie,
    volumenSumme,
  };
})();
