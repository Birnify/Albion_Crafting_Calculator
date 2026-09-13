// js/eintopf-preise.js
//
// Eintopf-Rechner-Reiter der App-Fusion (Paket C, 13.09.2026): Live-Abruf von
// Marktpreisen (/prices), Handelsvolumen (/history, time-scale=24) und
// Stundenprofil (/history, time-scale=1, nur fuer den Eintopf selbst).
//
// Nutzer-Entscheidung 13.09.2026: komplett auf Live-Fetch im Browser
// umgestellt, KEIN Python-Vorablauf mehr (der ehemalige eintopf_update.py lief
// vor jedem Seitenaufruf und bettete die Daten fest ein). Diese Datei ist aber
// keine Neuentwicklung von Grund auf: die eigentliche Abruflogik (Blockbildung
// zu 50, 429-Backoff mit wachsender Wartezeit) stand bereits nahezu
// unveraendert im TEMPLATE-String von eintopf_update.py als Funktion
// "aktualisieren()" - dort der Ersatz fuer einen erneuten Python-Lauf ueber
// den Knopf "Preise aktualisieren". Hier wird genau dieser Code zur EINZIGEN
// Datenquelle, DOM-Zugriffe sind herausgeloest (s. js/eintopf-ui.js).
//
// BEWUSST kein gemeinsamer Code mit js/preise.js oder js/preisvergleich.js:
// eigene Realm-Konstante, eigener Retry-Mechanismus, eigener localStorage-
// Schluessel - entspricht der bestehenden Praxis in diesem Projekt (s.
// kostenrechner-KONTEXT.md, Kommentar am Anfang von preisvergleich.js).

const EINTOPF_PREISE = (function () {
  "use strict";

  // Realm: der Nutzer spielt auf Europa, s. ../CLAUDE.md "Albion Online Data
  // Project API". "www." ist der Amerika-Server und liefert stillschweigend
  // andere Preise.
  const REALM = "europe";
  const API_BASE = `https://${REALM}.albion-online-data.com/api/v2/stats`;

  // Reihenfolge wie im ehemaligen eintopf_update.py (CITIES), bestimmt nur die
  // Anzeigereihenfolge der Staedte-Kontrollkaesten.
  const STAEDTE = ["Lymhurst", "Bridgewatch", "Fort Sterling", "Martlock", "Thetford", "Caerleon", "Brecilien"];

  const BLOCKGROESSE = 50;
  const PAUSE_MS = 1500;
  const MAX_VERSUCHE = 5;

  const SPEICHER_KEY = "albion_kostenrechner_eintopf_preise_v1";
  // Eigenes Schema, eigener Schluessel - NICHT der alte Schluessel
  // "eintopf_rechner_v2" der eigenstaendigen App (die bleibt unabhaengig
  // nutzbar, s. kostenrechner-KONTEXT.md).
  const SCHEMA = 1;

  let preise = {}; // preise[id][stadt] = {sell, sellDate, buy, buyDate}
  let volumen = {}; // volumen[id][stadt] = {d7, d30, min, max, avg}
  let zeiten = {}; // zeiten[id][stadt] = [{h, menge, preis}, ...]
  let stand = null; // ISO-Zeitstempel des letzten erfolgreichen Abrufs
  let standAnzeige = "noch nie";
  let HOME = STAEDTE[0];
  let MAXAGE = 7; // Tage, wird von aussen per setMaxAge() gesetzt (Einstellungen)

  function setHome(stadt) { HOME = stadt || STAEDTE[0]; }
  function getHome() { return HOME; }
  function setMaxAge(tage) { MAXAGE = tage; }

  // Aeltere Angebote gelten als nicht vorhanden; "0001-..." ist die
  // AODP-Kennung fuer "nie erfasst".
  function alterTage(iso) {
    if (!iso || iso.indexOf("0001") === 0) return null;
    return (Date.now() - new Date(iso + "Z").getTime()) / 86400000;
  }
  function frisch(iso) {
    const d = alterTage(iso);
    return d !== null && d <= MAXAGE;
  }

  function eintrag(id, stadt) { return (preise[id] || {})[stadt] || null; }
  function sell(id, stadt) {
    const e = eintrag(id, stadt || HOME);
    return e && e.sell && frisch(e.sellDate) ? e.sell : 0;
  }
  function buy(id, stadt) {
    const e = eintrag(id, stadt || HOME);
    return e && e.buy && frisch(e.buyDate) ? e.buy : 0;
  }
  function volEintrag(id, stadt) { return (volumen[id] || {})[stadt || HOME] || null; }
  function volOf(id, stadt) { return (volEintrag(id, stadt) || {}).d7 || 0; }
  function avgOf(id, stadt) { return (volEintrag(id, stadt) || {}).avg || 0; }
  function zeitenVon(id, stadt) { return (zeiten[id] || {})[stadt || HOME] || null; }

  function bloecke(arr, n) {
    const r = [];
    for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n));
    return r;
  }
  function warte(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // Nacheinander statt parallel, mit Pause und Wiederholung bei 429 - die API
  // drosselt sonst und liefert leere Antworten, s. ../CLAUDE.md.
  async function holen(pfad, ids, staedte, extra) {
    const orte = staedte.join(",").replace(/ /g, "%20");
    const aus = [];
    let fehlgeschlagen = 0;
    for (const teil of bloecke(ids, BLOCKGROESSE)) {
      const url = `${API_BASE}/${pfad}/${teil.join(",")}.json?locations=${orte}&qualities=1${extra || ""}`;
      let ok = false;
      for (let n = 0; n < MAX_VERSUCHE && !ok; n++) {
        try {
          const r = await fetch(url);
          if (r.status === 429) { await warte(PAUSE_MS * Math.pow(2, n + 1)); continue; }
          if (!r.ok) throw new Error("HTTP " + r.status);
          aus.push(...(await r.json()));
          ok = true;
        } catch (e) {
          if (n < MAX_VERSUCHE - 1) await warte(PAUSE_MS * Math.pow(2, n + 1));
        }
      }
      if (!ok) fehlgeschlagen++;
      await warte(PAUSE_MS * 0.8);
    }
    return { rows: aus, fehlgeschlagen };
  }

  function cacheSchreiben() {
    try {
      localStorage.setItem(SPEICHER_KEY, JSON.stringify({
        schema: SCHEMA, preise, volumen, zeiten, stand, standAnzeige,
      }));
    } catch (e) { /* Speicher gesperrt oder voll - dann eben nicht gespeichert */ }
  }

  // Liefert true, wenn brauchbare Daten aus dem Zwischenspeicher geladen wurden.
  function cacheLesen() {
    try {
      const c = JSON.parse(localStorage.getItem(SPEICHER_KEY) || "null");
      if (c && c.schema === SCHEMA && c.preise) {
        preise = c.preise; volumen = c.volumen || {}; zeiten = c.zeiten || {};
        stand = c.stand || null; standAnzeige = c.standAnzeige || "noch nie";
        return true;
      }
      if (c) localStorage.removeItem(SPEICHER_KEY); // veralteter Aufbau
    } catch (e) { /* defekter Cache wird ignoriert */ }
    return false;
  }

  function cacheAlterMinuten() {
    if (!stand) return Infinity;
    return (Date.now() - new Date(stand).getTime()) / 60000;
  }
  function hatDaten() { return Object.keys(preise).length > 0; }

  // Ruft Preise, Handelsvolumen und Stundenprofil live ab und ersetzt den
  // bisherigen Stand. onStatus(text) wird fuer jeden Teilschritt aufgerufen,
  // rein informativ (Ladezustand), die Funktion selbst ist DOM-frei.
  async function aktualisieren(onStatus) {
    const melde = (t) => { if (onStatus) onStatus(t); };
    const ids = EINTOPF_DATEN.idGruppen();
    const staedte = STAEDTE;

    melde("Rufe Marktpreise ab …");
    const a = await holen("prices", ids, staedte);
    if (!a.rows.length) throw new Error("keine Daten erhalten");
    // Ein Teilausfall darf die vorhandenen Preise nicht durch Luecken ersetzen.
    if (a.fehlgeschlagen) {
      throw new Error(`${a.fehlgeschlagen} Block/Blöcke nicht abrufbar - bisherige Preise bleiben stehen`);
    }
    const neuPreise = {};
    a.rows.forEach((e) => {
      (neuPreise[e.item_id] = neuPreise[e.item_id] || {})[e.city] = {
        sell: e.sell_price_min || 0, sellDate: e.sell_price_min_date || "",
        buy: e.buy_price_max || 0, buyDate: e.buy_price_max_date || "",
      };
    });

    melde("Rufe Handelsvolumen ab …");
    let volFehler = 0;
    const neuVolumen = {};
    try {
      const v = await holen("history", ids, staedte, "&time-scale=24");
      volFehler = v.fehlgeschlagen;
      v.rows.forEach((e) => {
        const alle = (e.data || []).map((x) => x.item_count || 0);
        if (!alle.length) return;
        const letzte = alle.slice(-7);
        const roh = (e.data || []).slice(-7);
        const summe = roh.reduce((s, x) => s + (x.item_count || 0), 0);
        // Mengengewichteter Durchschnittspreis der letzten Tage (Preisbasis
        // "Konservativ"), s. ../CLAUDE.md "Modellierung".
        const schnitt = summe
          ? Math.round(roh.reduce((s, x) => s + (x.avg_price || 0) * (x.item_count || 0), 0) / summe)
          : 0;
        // Die History-API nennt das Feld "location", die Preis-API "city".
        (neuVolumen[e.item_id] = neuVolumen[e.item_id] || {})[e.location] = {
          d7: Math.round(letzte.reduce((s, x) => s + x, 0) / letzte.length),
          d30: Math.round(alle.reduce((s, x) => s + x, 0) / alle.length),
          min: Math.min(...letzte), max: Math.max(...letzte), avg: schnitt,
        };
      });
    } catch (e) { /* Volumen ist optional */ }

    melde("Rufe Absatzzeiten ab …");
    const neuZeiten = {};
    try {
      // Nur der Eintopf selbst (alle Stufen), wie im ehemaligen
      // eintopf_update.py - begrenzt die Anzahl zusaetzlicher Anfragen.
      const stewIds = EINTOPF_DATEN.STEWS.flatMap((s) =>
        [s.id, ...Object.keys(s.ench).map((e) => `${s.id}@${e}`)]);
      const z = await holen("history", stewIds, staedte, "&time-scale=1");
      z.rows.forEach((e) => {
        const eimer = Array.from({ length: 24 }, () => ({ menge: 0, wert: 0, n: 0 }));
        (e.data || []).forEach((x) => {
          const ts = x.timestamp || "";
          if (ts.length < 13) return;
          const b = eimer[+ts.slice(11, 13)], c = x.item_count || 0;
          b.menge += c; b.wert += (x.avg_price || 0) * c; b.n++;
        });
        if (eimer.some((b) => b.n)) {
          (neuZeiten[e.item_id] = neuZeiten[e.item_id] || {})[e.location] = eimer.map((b, h) => ({
            h, menge: b.n ? Math.round(b.menge / b.n) : 0,
            preis: b.menge ? Math.round(b.wert / b.menge) : 0,
          }));
        }
      });
    } catch (e) { /* Stundenprofil ist optional */ }

    preise = neuPreise;
    if (Object.keys(neuVolumen).length) volumen = neuVolumen;
    if (Object.keys(neuZeiten).length) zeiten = neuZeiten;
    stand = new Date().toISOString();
    standAnzeige = new Date().toLocaleString("de-DE",
      { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    cacheSchreiben();

    const soll = ids.length * staedte.length;
    const ist = Object.values(neuPreise).reduce((a, v) => a + Object.keys(v).length, 0);
    return {
      vollstaendig: ist >= soll && !volFehler,
      fehlend: Math.max(0, soll - ist),
      volFehler,
      itemZahl: Object.keys(neuPreise).length,
      staedteZahl: staedte.length,
    };
  }

  return {
    REALM, STAEDTE,
    setHome, getHome, setMaxAge,
    alterTage, frisch,
    sell, buy, eintrag, volOf, avgOf, volEintrag, zeitenVon,
    cacheLesen, cacheAlterMinuten, hatDaten,
    aktualisieren,
    get stand() { return stand; },
    get standAnzeige() { return standAnzeige; },
  };
})();
