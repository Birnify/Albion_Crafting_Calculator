// js/eintopf-ui.js
//
// Eintopf-Rechner-Reiter der App-Fusion (Paket C, 13.09.2026): Rendering und
// DOM-Verdrahtung. Migriert aus dem TEMPLATE-String von eintopf_update.py
// (Funktionen render()/heroZeichnen()/tagesZeichnen()/kippZeichnen()/
// saucenZeichnen()/fischeZeichnen()/zeitenZeichnen()/rohpreiseZeichnen() usw.),
// Logik unveraendert. Angepasst an die neue Umgebung:
//
//   - Alle Element-IDs tragen das Praefix "et" (etCraftStadt, etHaupt, ...),
//     weil einige Namen sonst mit dem Kostenrechner-Reiter kollidiert haetten
//     (z.B. gab es dort schon ein #premium). Reine Umbenennung, keine
//     fachliche Aenderung.
//   - Alle document.querySelectorAll()-Aufrufe, die frueher das ganze
//     Dokument durchsuchten (Einstellungen speichern/Listener anhaengen),
//     sind jetzt auf "#tab-eintopf" eingeschraenkt - sonst wuerden sie in der
//     fusionierten Seite auch Felder des Kostenrechner- und
//     Preisvergleich-Reiters erfassen.
//   - Marktdaten kommen aus EINTOPF_PREISE (Live-Fetch statt eingebettetes
//     DATEN-Objekt); Rezepte/Rechenfunktionen aus EINTOPF_DATEN/EINTOPF_RECHENKERN.
//   - Neu: Erster Marktabruf passiert automatisch beim ERSTEN Oeffnen dieses
//     Reiters in der Sitzung (wenn kein Cache vorliegt oder er aelter als
//     30 Minuten ist), s. boot() unten. Nutzer-Entscheidung 13.09.2026.

const EINTOPF_UI = (function () {
  "use strict";

  const D = EINTOPF_DATEN;
  const M = EINTOPF_PREISE;
  const R = EINTOPF_RECHENKERN;
  const ROOT = "#tab-eintopf";
  const EINST_KEY = "albion_kostenrechner_eintopf_einstellungen_v1";
  const AUTO_FETCH_SCHWELLE_MIN = 30;

  const nf = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = (v) => (v === null || v === undefined || !isFinite(v)) ? "&mdash;" : nf.format(Math.round(v));
  const fmt2 = (v) => (v === null || v === undefined || !isFinite(v)) ? "&mdash;" : nf2.format(v);
  const nameOf = (id) => D.ZUTAT_NAMEN[id] || id;

  function $(id) { return document.getElementById(id); }

  function datumZelle(iso) {
    const d = M.alterTage(iso);
    if (d === null) return '<span class="miss">kein Angebot</span>';
    const s = new Date(iso + "Z").toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    if (d <= 1 / 24) return s;
    return `<span class="stale" title="${d < 1 ? Math.round(d * 24) + ' Stunden' : Math.round(d) + ' Tage'} alt">${s}</span>`;
  }

  // ─── Name in die Zwischenablage ──────────────────────────────────────────
  function kopieren(text, el) {
    const melde = () => {
      const alt = el.textContent;
      el.textContent = "✓"; el.classList.add("ok");
      setTimeout(() => { el.textContent = alt; el.classList.remove("ok"); }, 1100);
    };
    const fallback = () => {
      const t = document.createElement("textarea");
      t.value = text;
      t.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); melde(); } catch (e) { alert(text); }
      document.body.removeChild(t);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(melde).catch(fallback);
    else fallback();
  }
  const cpBtn = (text) =>
    `<button class="cp" type="button" data-cp="${String(text).replace(/"/g, "&quot;")}" title="Namen kopieren">⧉</button>`;

  document.addEventListener("click", (ev) => {
    const b = ev.target.closest(".cp");
    if (!b) return;
    ev.stopPropagation();
    kopieren(b.dataset.cp, b);
  }, true);

  // ─── Handelsvolumen-/Preisbasis-Zellen ───────────────────────────────────
  function preisbasisZelle(id, stadt) {
    const best = M.sell(id, stadt), schnitt = M.avgOf(id, stadt);
    if (!best || !schnitt) return '<span class="miss">&mdash;</span>';
    const ab = (schnitt / best - 1) * 100;
    const stark = Math.abs(ab) >= 10;
    return `${nf.format(best)} / ${nf.format(schnitt)}` +
      `<div class="hint"${stark ? ' style="color:var(--warn);font-weight:600"' : ""}>` +
      `${ab >= 0 ? "+" : "&minus;"}${fmt2(Math.abs(ab))} %</div>`;
  }
  function volZelle(id, stadt) {
    const v = M.volEintrag(id, stadt);
    if (!v || !v.d7) return '<span class="miss">&mdash;</span>';
    return `<span title="Letzte 7 Tage: ${nf.format(v.min)} bis ${nf.format(v.max)} pro Tag &middot; 30-Tage-Schnitt ${nf.format(v.d30)}">${nf.format(v.d7)}</span>`;
  }

  // ─── Staedteauswahl ───────────────────────────────────────────────────────
  function staedteCheckboxen(boxId, knopfId, auswahl, titel, verfuegbar) {
    const box = $(boxId);
    const aktiv = auswahl || (box.querySelector("input")
      ? [...box.querySelectorAll("input:checked")].map((x) => x.value) : [M.getHome()]);
    box.innerHTML = `<div class="t">${titel}<button type="button" id="${knopfId}" class="mini"></button></div>`;
    M.STAEDTE.forEach((c) => {
      const hat = verfuegbar(c);
      const l = document.createElement("label");
      if (!hat) { l.className = "leer"; l.title = "Aktuell keine Angebote in dieser Stadt"; }
      l.innerHTML = `<input type="checkbox" value="${c}"${aktiv.includes(c) ? " checked" : ""}>${c}`;
      box.appendChild(l);
    });
    box.querySelectorAll("input").forEach((el) => el.addEventListener("change", () => {
      knopfBeschriften(boxId, knopfId); einstellungenSpeichern(); render();
    }));
    const knopf = $(knopfId);
    knopf.addEventListener("click", () => {
      const kaesten = [...box.querySelectorAll("input")];
      const alle = kaesten.every((k) => k.checked);
      kaesten.forEach((k) => { k.checked = !alle; });
      knopfBeschriften(boxId, knopfId); einstellungenSpeichern(); render();
    });
    knopfBeschriften(boxId, knopfId);
  }
  function knopfBeschriften(boxId, knopfId) {
    const knopf = $(knopfId);
    if (!knopf) return;
    const kaesten = [...document.querySelectorAll(`#${boxId} input`)];
    knopf.textContent = kaesten.every((k) => k.checked) ? "Alle abwählen" : "Alle auswählen";
  }
  function gewaehlteStaedte() {
    const a = [...document.querySelectorAll("#etStaedte input:checked")].map((x) => x.value);
    return a.length ? a : [M.getHome()];
  }
  function staedteAufbauen(auswahl) {
    staedteCheckboxen("etStaedte", "etAlleStaedte", auswahl,
      "Fisch, Stückchen, Seegras und Saucen einkaufen in",
      (c) => ["T1_FISHCHOPS", "T1_SEAWEED"].some((i) => M.eintrag(i, c) && M.eintrag(i, c).sell)
        || D.FISH.some((f) => M.eintrag(f.id, c) && M.eintrag(f.id, c).sell));
  }
  function gewaehlteVkStaedte() {
    const a = [...document.querySelectorAll("#etVkStaedte input:checked")].map((x) => x.value);
    return a.length ? a : [M.getHome()];
  }
  function vkStaedteAufbauen(auswahl) {
    const stew = D.STEWS[0];
    staedteCheckboxen("etVkStaedte", "etAlleVkStaedte", auswahl,
      "Eintöpfe verkaufen in",
      (c) => [0, 1, 2, 3].some((e) => {
        const id = e ? `${stew.id}@${e}` : stew.id;
        return M.eintrag(id, c) && M.eintrag(id, c).sell;
      }));
  }
  function craftStadtAufbauen() {
    const sel = $("etCraftStadt");
    const aktuell = sel.value || M.STAEDTE[0];
    sel.innerHTML = M.STAEDTE.map((c) => `<option value="${c}"${c === aktuell ? " selected" : ""}>${c}</option>`).join("");
  }

  // ─── Optionen aus den Eingabefeldern lesen ───────────────────────────────
  function opts() {
    const g = (id) => parseFloat($(id).value) || 0;
    M.setHome($("etCraftStadt").value || M.STAEDTE[0]);
    return {
      craftStadt: M.getHome(),
      tax: $("etPremium").value === "1" ? 0.04 : 0.08,
      station: g("etStation"),
      maxage: g("etMaxage"),
      anteil: g("etAnteil") / 100,
      tage: g("etTage"),
      fokus: $("etFokus").checked,
      staedte: gewaehlteStaedte(),
      bez: bezWahl(),
      vk: vkWahl(),
      vkStaedte: gewaehlteVkStaedte(),
      basis: $("etBasis").value,
      kriterium: $("etKriterium").value,
      fokusbudget: g("etFokusbudget"),
      eigenerPreis: g("etEigenerPreis"),
    };
  }
  function vkWahl() {
    const s = $("etVkSofort").checked, o = $("etVkOrder").checked;
    return (s || o) ? { sofort: s, order: o } : { sofort: true, order: true };
  }
  function bezWahl() {
    const s = $("etBezSofort").checked, o = $("etBezOrder").checked;
    return (s || o) ? { sofort: s, order: o } : { sofort: true, order: true };
  }

  // ─── Einstellungen dauerhaft merken ──────────────────────────────────────
  function einstellungenSpeichern() {
    try {
      const d = { _staedte: gewaehlteStaedte(), _vkStaedte: gewaehlteVkStaedte() };
      document.querySelectorAll(`${ROOT} input[id], ${ROOT} select[id]`).forEach((el) => {
        d[el.id] = el.type === "checkbox" ? el.checked : el.value;
      });
      localStorage.setItem(EINST_KEY, JSON.stringify(d));
    } catch (e) { /* Speicher gesperrt - dann eben nicht */ }
  }
  function einstellungenLaden() {
    try {
      const d = JSON.parse(localStorage.getItem(EINST_KEY) || "null");
      if (!d) return { staedte: null, vkStaedte: null };
      for (const [k, v] of Object.entries(d)) {
        if (k.startsWith("_")) continue;
        const el = $(k);
        if (!el) continue;
        if (el.type === "checkbox") el.checked = !!v; else el.value = v;
      }
      return {
        staedte: Array.isArray(d._staedte) ? d._staedte : null,
        vkStaedte: Array.isArray(d._vkStaedte) ? d._vkStaedte : null,
      };
    } catch (e) { return { staedte: null, vkStaedte: null }; }
  }
  function einstellungenZuruecksetzen() {
    try { localStorage.removeItem(EINST_KEY); } catch (e) {}
    location.reload();
  }

  // ─── Rendering ────────────────────────────────────────────────────────────
  function standText(o) {
    return `Marktdaten vom ${M.standAnzeige} &middot; <strong>${M.REALM}</strong>-Server ` +
      `&middot; Qualität 1 &middot; Craft in ${M.getHome()} ` +
      `&middot; Einkauf aus ${o.staedte.join(", ")} &middot; Verkauf in ${o.vkStaedte.join(", ")}`;
  }

  function render() {
    const o = opts();
    M.setMaxAge(o.maxage);
    $("etStand").innerHTML = standText(o);

    if (!M.hatDaten()) {
      $("etHero").className = "hero leer";
      $("etHero").innerHTML = "Noch keine Marktdaten geladen. Oben auf &quot;Preise aktualisieren&quot; klicken.";
      ["etHaupt", "etSaucen", "etTages", "etFische", "etRohpreise"].forEach((id) => {
        const tb = document.querySelector(`#${id} tbody`);
        if (tb) tb.innerHTML = "";
      });
      $("etTagesHinweis").textContent = "";
      $("etKipp").innerHTML = "";
      $("etZeiten").innerHTML = "";
      $("etStueckchenRef").innerHTML = "";
      return;
    }
    $("etHero").className = "hero";

    const zeilen = R.varianten().map(({ stew, ench }) => {
      const mit = R.strategien(stew, ench, o, true);
      const ohne = R.strategien(stew, ench, o, false);
      const akt = o.fokus ? mit : ohne;
      const best = akt[0];
      if (!best) return null;
      const bMit = mit[0], bOhne = ohne[0];
      const spf = (bMit && bOhne && bMit.fokus > 0) ? (bMit.gewinn - bOhne.gewinn) / bMit.fokus : null;
      return {
        stew, ench, best, alle: akt, spf,
        sp: R.spanne(ench ? `${stew.id}@${ench}` : stew.id, best.vk ? best.vk.stadt : o.vkStaedte[0]),
      };
    }).filter(Boolean);

    zeilen.sort((a, b) => R.guete(b.best, o) - R.guete(a.best, o));
    heroZeichnen(zeilen);

    const tb = document.querySelector("#etHaupt tbody");
    tb.innerHTML = "";
    zeilen.forEach((z) => {
      const label = `${z.stew.name} T${z.stew.tier}.${z.ench}`;
      const g = z.best.gewinn;
      const tr = document.createElement("tr");
      tr.className = "toggle";
      tr.innerHTML =
        `<td class="l"><strong>${label}</strong>${cpBtn(z.stew.name)}</td>` +
        `<td class="l">${z.best.label}</td>` +
        `<td class="num">${fmt(z.best.kosten)}</td>` +
        `<td class="num">${fmt(z.best.erloes)}` +
        (z.best.vk ? `<div class="hint">${z.best.vk.art} à ${fmt(z.best.vk.brutto)}</div>` : "") +
        `</td>` +
        `<td class="num ${g >= 0 ? "pos" : "neg"}">${fmt(g)}` +
        `<div class="hint">${fmt(g / z.stew.out)} je Stück &middot; ` +
        `${z.best.kosten > 0 ? fmt2(g / z.best.kosten * 100) + " % Marge" : "&mdash;"}</div></td>` +
        `<td class="num">${z.best.fokus ? fmt2(z.best.gewinn / z.best.fokus) : "&mdash;"}` +
        `<div class="hint">${z.best.fokus ? fmt(z.best.fokus) + " Fokus je Batch" : "ohne Fokus"}` +
        `${z.spf === null ? "" : " &middot; Fokusvorteil " + fmt2(z.spf)}</div></td>` +
        `<td class="num">${z.sp === null ? "&mdash;" :
          (z.sp > 0.3 ? `<span class="pill warn">${Math.round(z.sp * 100)} %</span>` : Math.round(z.sp * 100) + " %")}</td>` +
        `<td><span class="pill ${g >= 0 ? "good" : "bad"}">${g >= 0 ? "Profit" : "Verlust"}</span>` +
        (z.best.gedeckt ? "" : '<div class="hint" style="color:var(--bad)">Menge fehlt</div>') + `</td>`;
      tb.appendChild(tr);

      const det = document.createElement("tr");
      det.className = "detail";
      det.style.display = "none";
      const rows = z.alle.map((s, k) =>
        `<tr${k === 0 ? ' class="best"' : ""}><td class="l">${s.label}</td>` +
        `<td class="num">${fmt(s.kosten)}</td><td class="num">${fmt(s.erloes)}</td>` +
        `<td class="num ${s.gewinn >= 0 ? "pos" : "neg"}">${fmt(s.gewinn)}</td>` +
        `<td class="num ${s.gewinn >= 0 ? "pos" : "neg"}">${s.kosten > 0 ? fmt2(s.gewinn / s.kosten * 100) + " %" : "&mdash;"}</td>` +
        `<td class="num">${s.fokus ? fmt(s.fokus) : "&mdash;"}</td>` +
        `<td>${s.gedeckt ? '<span class="pill good">beschaffbar</span>' : '<span class="pill bad">Menge fehlt</span>'}</td>` +
        `<td class="l">${s.detail}${s.info ? '<div class="hint">' + s.info + "</div>" : ""}</td></tr>`).join("");

      det.innerHTML = `<td colspan="8"><div class="tblwrap"><table>` +
        `<thead><tr><th class="l">Strategie</th><th>Kosten</th><th>Erlös</th>` +
        `<th>Gewinn</th><th>Marge</th><th>Fokus</th><th>Menge</th>` +
        `<th class="l">Zusammensetzung</th></tr></thead><tbody>${rows}</tbody></table></div></td>`;
      tb.appendChild(det);
      tr.onclick = () => { det.style.display = det.style.display === "none" ? "" : "none"; };
    });

    refZeichnen(o);
    tagesZeichnen(o);
    kippZeichnen(o);
    saucenZeichnen(o);
    fischeZeichnen(o);
    zeitenZeichnen(o);
    rohpreiseZeichnen(o);
  }

  function refZeichnen(o) {
    const el = $("etStueckchenRef");
    if (!el) return;
    const b = R.bestChopQuelle(o);
    el.innerHTML = b
      ? `Aktuell günstigster Markt: <strong>${fmt2(b.pro)}</strong> je Stückchen (${b.name}, ${b.stadt}, ${b.art})`
      : "Kein Marktpreis verfügbar";
  }

  function heroZeichnen(zeilen) {
    const b = zeilen.filter((z) => z.best.gewinn > 0 && z.best.gedeckt)[0];
    const h = $("etHero");
    if (!b) {
      h.innerHTML = `<div class="k">Aktuelle Lage</div><div class="v">Kein profitabler Weg</div>` +
        `<div class="w">Bei den aktuellen Preisen trägt keine Variante Gewinn. ` +
        `Preise aktualisieren oder Städteauswahl erweitern.</div>`;
      return;
    }
    const fk = zeilen.filter((z) => z.spf !== null && z.best.gewinn > 0 && z.best.gedeckt)
      .sort((a, b2) => b2.spf - a.spf)[0];
    h.innerHTML = `<div class="cols">` +
      `<div><div class="k">Bester Gewinn je Batch</div><div class="v">${fmt(b.best.gewinn)}</div>` +
      `<div class="w">${b.stew.name} T${b.stew.tier}.${b.ench}</div></div>` +
      `<div><div class="k">Strategie</div>` +
      `<div class="w" style="font-size:15px;font-weight:600;margin-top:6px">${b.best.label}</div>` +
      `<div class="w">Einsatz ${fmt(b.best.kosten)} Silber</div></div>` +
      (fk ? `<div><div class="k">Bestes Silber je Fokus</div><div class="v">${fmt2(fk.spf)}</div>` +
        `<div class="w">${fk.stew.name} T${fk.stew.tier}.${fk.ench}</div></div>` : "") +
      `</div>`;
  }

  function tagesZeichnen(o) {
    const tb = document.querySelector("#etTages tbody");
    const stew = D.STEWS[0];
    tb.innerHTML = "";
    const zeilen = [1, 2, 3].map((e) => {
      const s = R.strategien(stew, e, o, o.fokus)[0];
      if (!s || !s.fokus) return null;
      const n = Math.floor(o.fokusbudget / s.fokus);
      return {
        e, s, n, proFokus: s.gewinn / s.fokus, tag: n * s.gewinn, kapital: n * s.kosten,
        stueck: n * stew.out, markt: s.vk ? M.volOf(`${stew.id}@${e}`, s.vk.stadt) : 0,
      };
    }).filter(Boolean);
    if (!zeilen.length) { $("etTagesHinweis").textContent = ""; return; }

    const bester = zeilen.reduce((a, b) => (b.tag > a.tag ? b : a));
    zeilen.forEach((z) => {
      const anteil = z.markt ? z.stueck / z.markt * 100 : null;
      const eng = anteil !== null && anteil > 50;
      tb.innerHTML +=
        `<tr${z === bester ? ' class="best"' : ""}>` +
        `<td class="l"><strong>${stew.name} T${stew.tier}.${z.e}</strong></td>` +
        `<td class="num">${fmt(z.s.fokus)}</td><td class="num">${z.n}</td>` +
        `<td class="num"><strong>${fmt2(z.proFokus)}</strong></td>` +
        `<td class="num ${z.tag >= 0 ? "pos" : "neg"}"><strong>${fmt(z.tag)}</strong></td>` +
        `<td class="num">${fmt(z.kapital)}</td>` +
        `<td class="num">${z.stueck} / ${z.markt ? nf.format(z.markt) : "?"}` +
        (anteil !== null ? `<div class="hint"${eng ? ' style="color:var(--warn);font-weight:600"' : ""}>${fmt(anteil)} % des Marktes</div>` : "") +
        `</td></tr>`;
    });
    $("etTagesHinweis").innerHTML =
      `Bei <strong>${nf.format(o.fokusbudget)} Fokus am Tag</strong> bringt ` +
      `<strong>T${stew.tier}.${bester.e}</strong> mit ${fmt(bester.tag)} Silber am meisten &mdash; ` +
      `nicht zwingend die Stufe mit dem höchsten Gewinn je Batch. Wenige große Batches lassen Fokus liegen, ` +
      `viele kleine binden weniger Kapital. Die letzte Spalte warnt, wenn du mehr als die Hälfte des ` +
      `Tagesumsatzes selbst absetzen müsstest &mdash; dann drückst du den Preis, den die Rechnung noch als gegeben annimmt.`;
  }

  function verdraengt(stew, zonen, o) {
    const drin = new Set(zonen.map((z) => z.ench).filter(Boolean));
    const fehlt = [1, 2, 3].filter((e) => !drin.has(e));
    if (!fehlt.length) return "";
    const teile = fehlt.map((e) => {
      const a = R.gerade(stew, e, o, o.fokus);
      if (!a) return `T${stew.tier}.${e}`;
      const gegner = [1, 2, 3].filter((x) => x !== e).map((x) => R.gerade(stew, x, o, o.fokus))
        .filter(Boolean).map((b) => ({ ench: b.ench, P: (a.A - b.A) / (a.B - b.B) }))
        .filter((x) => x.P > 0 && isFinite(x.P)).sort((x, y) => x.P - y.P)[0];
      return gegner
        ? `T${stew.tier}.${e} (ab ${fmt2(gegner.P)} von T${stew.tier}.${gegner.ench} überholt)`
        : `T${stew.tier}.${e}`;
    });
    return `<div class="legend" style="color:var(--warn)">Derzeit nie optimal: <strong>${teile.join(", ")}</strong>. ` +
      `Die Stärkere wird von der Schwächeren überholt, bevor sie selbst zurückfällt &mdash; die Stufe wird ` +
      `dadurch von beiden Seiten eingeklemmt.</div>`;
  }

  function kippZeichnen(o) {
    const box = $("etKipp");
    const stew = D.STEWS[0];
    const jetzt = o.eigenerPreis > 0 ? o.eigenerPreis : NaN;
    const zonen = R.entscheidungsleiter(stew, o, o.fokus);
    if (!zonen.length) { box.innerHTML = ""; return; }

    const zeilen = zonen.map((z) => {
      const hier = isFinite(jetzt) && jetzt >= z.von && (z.bis === null || jetzt < z.bis);
      const bereich = z.bis === null ? `ab ${fmt2(z.von)}` : (z.von <= 0 ? `bis ${fmt2(z.bis)}` : `${fmt2(z.von)} &ndash; ${fmt2(z.bis)}`);
      const tat = z.ench ? `<strong>T${stew.tier}.${z.ench} craften</strong>` : '<span style="color:var(--bad)">nicht craften</span>';
      const traegt = z.ench ? R.schmerzgrenze(stew, z.ench, o, o.fokus) : null;
      return `<tr${hier ? ' class="best"' : ""}>` +
        `<td class="l num">${bereich}</td><td class="l">${tat}</td>` +
        `<td class="num">${traegt ? fmt2(traegt) : "&mdash;"}</td>` +
        `<td class="l">${hier ? '<span class="pill good">du bist hier</span>' : ""}</td></tr>`;
    }).join("");

    box.innerHTML =
      `<div class="sek-t" style="margin-bottom:10px">Faustregel nach Fischpreis</div>` +
      `<div class="tblwrap"><table style="min-width:0">` +
      `<thead><tr><th class="l">Preis je Fischstückchen</th><th class="l">Dann lohnt</th>` +
      `<th title="Bis zu diesem Preis wirft diese Stufe überhaupt noch Gewinn ab.">diese Stufe trägt bis</th>` +
      `<th class="l">Aktuell</th></tr></thead><tbody>${zeilen}</tbody></table></div>` +
      (isFinite(jetzt) ? `<div class="legend">Eigener Preis: <strong>${fmt2(jetzt)}</strong> je Stückchen.</div>` : "") +
      verdraengt(stew, zonen, o) +
      `<div class="legend">Der Fischbedarf steht je Stufe im Verhältnis 1 : 3 : 9 (1.350 / 4.050 / 12.150 Stückchen ` +
      `je Batch), während Kürbis, Brot und Fleisch gleich bleiben. Ein Silber mehr je Stückchen kostet T${stew.tier}.3 ` +
      `deshalb neunmal so viel wie T${stew.tier}.1 &mdash; darum übernimmt bei steigenden Preisen die niedrigere Stufe.</div>`;
  }

  function saucenZeichnen(o) {
    const st = document.querySelector("#etSaucen tbody");
    st.innerHTML = "";
    const stew0 = D.STEWS[0];
    [1, 2, 3].forEach((lvl) => {
      const anzahl = stew0.ench[lvl].sauce;
      const sw = R.sauceWege(lvl, o, anzahl);
      const s = sw.rezept;
      const get = (a) => sw.wege.find((x) => x.art === a) || null;
      const machbar = sw.wege.filter((w) => w.gedeckt);
      const best = (machbar.length ? machbar : sw.wege).slice().sort((a, b) => a.kosten - b.kosten)[0];
      const werte = machbar.map((w) => w.kosten);
      const ersp = werte.length > 1 ? Math.max(...werte) - Math.min(...werte) : null;
      const zelle = (w) => !w ? '<td class="num">&mdash;</td>' :
        `<td class="num${best && w === best ? " best" : ""}">${fmt(w.kosten)}${w.gedeckt ? "" : ' <span class="pill bad">Menge</span>'}</td>`;
      st.innerHTML +=
        `<tr><td class="l"><strong>${s.name}</strong></td>` +
        `<td class="num">${s.chops}&times; Stückchen + ${s.seaweed}&times; Seegras</td>` +
        `<td class="num">${nf.format(anzahl)}</td>` +
        `<td class="num"><strong>${nf.format(sw.bedarfChops)}</strong> Stückchen<div class="hint">+ ${nf.format(sw.bedarfSeegras)} Seegras</div></td>` +
        zelle(get("kaufen")) + zelle(get("eigen")) +
        `<td class="l">${best ? best.label : "&mdash;"}${best && best.info ? `<div class="hint">${best.info}</div>` : ""}</td>` +
        `<td class="num pos">${ersp !== null ? fmt(ersp * anzahl) : "&mdash;"}</td></tr>`;
    });
  }

  function fischeZeichnen(o) {
    const ft = document.querySelector("#etFische tbody");
    ft.innerHTML = "";
    const chopRef = R.billigste("T1_FISHCHOPS", o);
    const stew = D.STEWS[0];
    const wahl = $("etGrenzeStufe").value;
    let refE = null;
    if (wahl === "auto") {
      let bestG = -Infinity;
      [1, 2, 3].forEach((e) => {
        const s = R.strategien(stew, e, o, o.fokus)[0];
        if (s && s.gewinn > bestG) { bestG = s.gewinn; refE = e; }
      });
    } else {
      refE = +wahl;
    }
    const eigen = parseFloat($("etEigenerPreis").value) || 0;
    const zonen = R.entscheidungsleiter(stew, o, o.fokus);
    const zone = (!eigen && refE) ? zonen.find((z) => z.ench === refE) : null;
    const grenze = eigen ? eigen : !refE ? null : zone ? (zone.bis !== null ? zone.bis : R.schmerzgrenze(stew, refE, o, o.fokus)) : null;
    const nieVorn = !eigen && refE && !zone;
    $("etGrenzeSpalte").textContent = eigen ? `Max. bei ${fmt2(eigen)} je Stückchen` : refE ? `Lohnt für T${stew.tier}.${refE} bis` : "Lohnt bis";

    const grenzZelle = (f) => {
      if (nieVorn) return '<span class="pill warn" title="Diese Stufe ist bei den aktuellen Preisen in keinem Bereich die beste Wahl">nie vorn</span>';
      if (!grenze) return '<span class="miss">&mdash;</span>';
      const max = grenze * f.chops;
      const ok = f.preis <= max;
      return `<span class="pill ${ok ? "good" : "bad"}">${fmt(max)}</span>`;
    };
    const zSelten = $("etFischSelten").checked;
    const zUebrig = $("etFischUebrig").checked;
    const fische = (zSelten || zUebrig) ? D.FISH.filter((f) => (f.gruppe === "Selten" ? zSelten : zUebrig)) : D.FISH;

    const liste = fische.map((f) => {
      const b = R.billigste(f.id, o);
      return b ? { ...f, stadt: b.stadt, art: b.art, preis: b.preis, pro: b.preis / f.chops } : null;
    }).filter(Boolean);
    if (chopRef) {
      liste.push({
        id: "T1_FISHCHOPS", name: "Zerkleinerter Fisch", tier: 1, gruppe: "Referenz", chops: 1,
        stadt: chopRef.stadt, art: chopRef.art, preis: chopRef.preis, pro: chopRef.preis, referenz: true,
      });
    }
    liste.sort((a, b) => a.pro - b.pro);

    liste.forEach((f, i) => {
      const diff = (chopRef && !f.referenz) ? chopRef.preis - f.pro : null;
      ft.innerHTML +=
        `<tr${i === 0 ? ' class="best"' : ""}><td class="l"><strong>${f.name}</strong>${cpBtn(f.name)}</td>` +
        `<td class="num">T${f.tier}</td><td class="l"><span class="tag">${f.gruppe}</span></td>` +
        `<td class="l">${f.stadt}</td><td class="l"><span class="tag">${f.art}</span></td>` +
        `<td class="num">${f.chops}</td><td class="num">${fmt(f.preis)}</td>` +
        `<td class="num"><strong>${fmt2(f.pro)}</strong></td>` +
        `<td class="num ${diff >= 0 ? "pos" : "neg"}">${diff === null ? "&mdash;" : (diff >= 0 ? "+" : "&minus;") + fmt2(Math.abs(diff))}</td>` +
        `<td class="l">${grenzZelle(f)}</td>` +
        `<td class="num">${preisbasisZelle(f.id, f.stadt)}</td>` +
        `<td class="num">${volZelle(f.id, f.stadt)}</td>` +
        `<td>${datumZelle((M.eintrag(f.id, f.stadt) || {}).sellDate)}</td></tr>`;
    });
  }

  function zeitenZeichnen(o) {
    const box = $("etZeiten");
    const versatz = -new Date().getTimezoneOffset() / 60;
    const stew = D.STEWS[0];
    const teile = [];
    for (const e of [0, 1, 2, 3]) {
      const id = e ? `${stew.id}@${e}` : stew.id;
      const s = R.strategien(stew, e, o, o.fokus)[0];
      const stadt = s && s.vk ? s.vk.stadt : o.vkStaedte[0];
      const roh = M.zeitenVon(id, stadt);
      if (!roh || !roh.length) continue;
      const lokal = new Array(24).fill(null).map((_, h) => {
        const q = roh[((h - versatz) % 24 + 24) % 24];
        return { h, menge: q ? q.menge : 0, preis: q ? q.preis : 0 };
      });
      const max = Math.max(...lokal.map((x) => x.menge));
      if (max <= 0) continue;
      const beste = lokal.slice().sort((a, b) => b.menge - a.menge).slice(0, 3).sort((a, b) => a.h - b.h);
      const balken = lokal.map((x) =>
        `<div style="height:${Math.max(4, Math.round(x.menge / max * 46))}px;opacity:${0.25 + 0.75 * x.menge / max}" ` +
        `title="${String(x.h).padStart(2, "0")}:00 Uhr &middot; ${nf.format(x.menge)} Stück${x.preis ? " &middot; Ø " + nf.format(x.preis) + " Silber" : ""}"></div>`).join("");
      const achse = lokal.map((x) => `<span>${x.h % 6 === 0 ? String(x.h).padStart(2, "0") : ""}</span>`).join("");
      teile.push(
        `<div style="margin-bottom:20px">` +
        `<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">` +
        `<strong>${stew.name} T${stew.tier}.${e}</strong>` +
        `<span class="hint">${stadt} &middot; Beste Zeiten: ${beste.map((b) => String(b.h).padStart(2, "0") + ":00").join(", ")} ` +
        `&middot; Tagesmittel ${nf.format(Math.round(lokal.reduce((a, x) => a + x.menge, 0) / 24))} Stück/h</span></div>` +
        `<div class="stunden" style="align-items:end">${balken}</div><div class="stunden">${achse}</div></div>`);
    }
    box.innerHTML = teile.length
      ? teile.join("") + `<div class="hint">Durchschnittlich gehandelte Stückzahl je Tagesstunde in der jeweils ` +
        `günstigsten Verkaufsstadt über die letzten 7 Tage, umgerechnet auf deine Ortszeit ` +
        `(${Intl.DateTimeFormat().resolvedOptions().timeZone}). Balken anfahren zeigt Menge und Durchschnittspreis. ` +
        `Hohe Balken heißen viele Käufer &mdash; dort füllen sich Kauforders am schnellsten. Der Gipfel liegt meist ` +
        `in der Nacht, weil dann in Amerika Hauptspielzeit ist.</div>`
      : `<div class="hint">Keine Stundendaten verfügbar. Über "Preise aktualisieren" werden sie mitgeladen.</div>`;
  }

  function rohpreiseZeichnen(o) {
    const rt = document.querySelector("#etRohpreise tbody");
    rt.innerHTML = "";
    const zeilen = [];
    const stew = D.STEWS[0];
    const beschriftung = (id) => {
      const m = id.match(/^(T\d)_MEAL_STEW(?:@(\d))?$/);
      if (m && D.STEWS.find((x) => x.id === m[1] + "_MEAL_STEW")) return `${stew.name} T${stew.tier}.${m[2] || 0}`;
      const s = Object.values(D.SAUCE).find((x) => x.id === id);
      return s ? s.name : nameOf(id);
    };
    stew.base.forEach(([id]) => zeilen.push([id, M.getHome()]));
    [0, 1, 2, 3].forEach((e) => o.vkStaedte.forEach((c) => zeilen.push([e ? `${stew.id}@${e}` : stew.id, c])));
    for (const c of o.staedte) {
      ["T1_FISHCHOPS", "T1_SEAWEED"].forEach((id) => zeilen.push([id, c]));
      Object.values(D.SAUCE).forEach((s) => zeilen.push([s.id, c]));
      D.FISH.forEach((f) => { if (M.sell(f.id, c)) zeilen.push([f.id, c]); });
    }
    rt.innerHTML = zeilen.map(([id, c]) => {
      const p = M.eintrag(id, c) || { sell: 0, buy: 0, sellDate: "" };
      return `<tr><td class="l">${beschriftung(id)}${cpBtn(beschriftung(id))}</td><td class="l">${c}</td>` +
        `<td class="l"><code>${id}</code></td>` +
        `<td class="num">${p.sell ? fmt(p.sell) : '<span class="miss">&mdash;</span>'}</td>` +
        `<td class="num">${p.buy ? fmt(p.buy) : '<span class="miss">&mdash;</span>'}</td>` +
        `<td class="num">${volZelle(id, c)}</td><td>${datumZelle(p.sellDate)}</td></tr>`;
    }).join("");
  }

  // ─── Aktualisieren-Knopf ──────────────────────────────────────────────────
  async function aktualisieren() {
    const btn = $("etRefresh"), st = $("etStatus");
    if (btn) btn.disabled = true;
    if (st) { st.className = ""; st.textContent = "Rufe Marktpreise ab …"; }
    try {
      const ergebnis = await M.aktualisieren((text) => { if (st) st.textContent = text; });
      staedteAufbauen(); vkStaedteAufbauen(); // Auswahl bleibt, nur Durchgestrichen-Markierung aktualisiert sich
      render();
      const teile = [`${ergebnis.itemZahl} Items in ${ergebnis.staedteZahl} Städten`];
      if (ergebnis.fehlend > 0) teile.push(`${ergebnis.fehlend} Preiseinträge fehlen`);
      if (ergebnis.volFehler) teile.push(`Volumen unvollständig (${ergebnis.volFehler} Block/Blöcke)`);
      if (st) { st.className = ergebnis.vollstaendig ? "ok" : "err"; st.textContent = teile.join(" · "); }
    } catch (err) {
      if (st) { st.className = "err"; st.textContent = `Abruf fehlgeschlagen: ${err.message}.`; }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ─── Aufbau/Verdrahtung ───────────────────────────────────────────────────
  let aufgebaut = false;
  let ersterAbrufAusgeloest = false;

  function aufbauen() {
    if (aufgebaut) return;
    aufgebaut = true;

    craftStadtAufbauen();
    const gemerkt = einstellungenLaden();
    M.setHome($("etCraftStadt").value || M.STAEDTE[0]);
    M.cacheLesen();
    staedteAufbauen(gemerkt.staedte);
    vkStaedteAufbauen(gemerkt.vkStaedte);
    render();

    $("etRefresh").addEventListener("click", aktualisieren);
    $("etReset").addEventListener("click", einstellungenZuruecksetzen);
    document.querySelectorAll(`${ROOT} .grid input, ${ROOT} .grid select, #etEigenerPreis`).forEach((el) => {
      const merken = () => { einstellungenSpeichern(); render(); };
      el.addEventListener("input", merken);
      el.addEventListener("change", merken);
    });
  }

  // Beim ERSTEN Oeffnen dieses Reiters in der Sitzung automatisch abrufen,
  // sofern kein Cache vorliegt oder er aelter als 30 Minuten ist. Danach nur
  // noch per Klick auf "Preise aktualisieren". Nutzer-Entscheidung 13.09.2026.
  function ersterAbruf() {
    if (ersterAbrufAusgeloest) return;
    ersterAbrufAusgeloest = true;
    if (!M.hatDaten() || M.cacheAlterMinuten() > AUTO_FETCH_SCHWELLE_MIN) aktualisieren();
  }

  function einrichten() {
    if (!document.getElementById("tab-eintopf")) return; // z.B. tests/test.html ohne App-Markup
    aufbauen();
    const tabBtn = document.getElementById("tabbtn-eintopf");
    if (tabBtn) {
      tabBtn.addEventListener("click", ersterAbruf);
      if (tabBtn.classList.contains("active")) ersterAbruf(); // Deep-Link/Reload mit aktivem Eintopf-Tab
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", einrichten);
  else einrichten();

  return { render, aktualisieren };
})();
