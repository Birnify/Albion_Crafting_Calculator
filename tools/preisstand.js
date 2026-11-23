#!/usr/bin/env node
// tools/preisstand.js
//
// Abrufer des gemeinsamen Preisstands (v3.23.0, Paket O9). Laeuft bei GitHub
// (.github/workflows/preisstand.yml) oder von Hand, mit Node 20, ohne
// Abhaengigkeiten:
//
//   node tools/preisstand.js --voll    [--aus daten] [--max-abrufe 300]
//   node tools/preisstand.js --schnell [--aus daten] [--max-abrufe 30]
//
// --voll     alle Preise und Handelsvolumen des Vorgabe-Scanumfangs von
//            "Gelegenheiten" (T4 bis T8, alle Stufen, alle Warengruppen, fuenf
//            Veredelungsrohstoffe, ohne Artefakt-Items) fuer alle sieben
//            Staedte: Produktpreise der Crafts in allen Qualitaeten,
//            Normalpreise (Zutaten, Veredelungsprodukte), verkauft/Tag
//            (Produkte und Zutaten). Ein Abruf je 50 IDs fuer alle Staedte.
// --schnell  nur die Preise der "Spitze": Produkte und Zutaten der Vorgaenge,
//            die im vorhandenen Stand unter den Vorgabe-Einstellungen der App
//            (Sofortkauf, Verkaufsorder, Premium, ohne Fokus, Marktanteil
//            10 %, Mindestvolumen 5) in mindestens einer Stadt (zugleich
//            Fertigungs-, Einkaufs- und Verkaufsstadt) Gewinn zeigen,
//            absteigend nach Gewinn/Tag, so viele, wie in die Abrufgrenze
//            passen. Ohne Stand eines vollen Laufs tut er nichts.
//
// KEINE zweite Implementierung der Formate: das Skript laedt die Dateien der
// App in einen vm-Kontext. ID-Listen kommen aus GELEGENHEITEN.kandidaten()
// und faelligFuer(), URLs, Normalisierung und Ablage aus den Abruffunktionen
// von PREISE (samt Abrufplaner: strikt nacheinander, 1,5 s Pause), die Zeilen
// der Spitze aus GELEGENHEITEN.zeilenRechnen(), das Dateiformat aus
// GEMEINSAM.packen() (beschrieben im Kopf von js/gemeinsam.js: stand.json als
// kleiner Kopf, preise.json und volumen.json mit den Daten).
//
// Zusammenfuehren: der Lauf liest den vorhandenen Stand aus --aus, ersetzt
// nur, was er neu geholt hat, laesst Eintraege aelter als 7 Tage weg und
// schreibt alle drei Dateien neu.
//
// Hoeflichkeit gegenueber der Schnittstelle: ein Abruf zur Zeit, 1,5 s Pause,
// komprimierte Antworten (Node-fetch sendet Accept-Encoding von selbst),
// User-Agent ohne persoenliche Daten. HTTP 429: Reset-Zeit aus dem
// Antworttext (PREISE.limitResetAusText), hoechstens EINMAL je Lauf bis dahin
// warten (hoechstens 5 Minuten), bei erneuter 429 endet der Lauf sauber: was
// geholt ist, wird geschrieben, der Rest bleibt alt, Exit-Code 0. Netz- und
// Serverfehler: 3 Versuche je Abruf, dann dasselbe Ende. --max-abrufe ist die
// harte Obergrenze der HTTP-Anfragen eines Laufs (jeder Versuch zaehlt).

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const zlib = require("zlib");

const APP_DATEIEN = ["rezepte.js", "js/preise.js", "js/gemeinsam.js", "js/regeln.js", "js/rechenkern.js", "js/veredeln.js", "js/craften.js", "js/gelegenheiten.js"];
const USER_AGENT = "albion-werkzeuge-preisstand";
const MAX_ABRUFE = { voll: 300, schnell: 30 };
const NETZ_VERSUCHE = 3;
const WARTE_429_MAX_MS = 5 * 60 * 1000;
const WARTE_429_OHNE_ZEIT_MS = 60 * 1000; // nennt die 429-Antwort keine Reset-Zeit
const ZEITLIMIT_ABRUF_MS = 60 * 1000;
const PLANER_GRUPPE = "preisstand";

/** Laedt die App-Dateien in einen eigenen vm-Kontext und liefert deren Module. */
function appLaden(wurzel, umgebung) {
  const kontext = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance,
    fetch: umgebung.fetch,
  };
  vm.createContext(kontext);
  APP_DATEIEN.forEach((datei) => {
    vm.runInContext(fs.readFileSync(path.join(wurzel, datei), "utf8"), kontext, { filename: datei });
  });
  if (umgebung.jetzt) {
    kontext.__jetzt = umgebung.jetzt;
    vm.runInContext("Date.now = __jetzt;", kontext);
  }
  const app = vm.runInContext("({ PREISE, GEMEINSAM, REGELN, VEREDELN, CRAFTEN, GELEGENHEITEN })", kontext);
  // Uhr und Wartefunktion des Abrufplaners (Tests laufen ohne echtes Warten).
  if (umgebung.jetzt || umgebung.warte) app.PREISE.planer.testZuruecksetzen({ jetzt: umgebung.jetzt, warte: umgebung.warte });
  return app;
}

/**
 * Gemeinsame Einstellungen der App in ihrer Vorgabe (js/ui.js,
 * standardEinstellungen(); ui.js braucht ein DOM und laesst sich hier nicht
 * laden): Premium, Marktanteil 10 %, Stationssatz 400 je Gebaeude (der
 * vorbelegte Wert des Eingabefelds), kein Tagesbonus, FCE 0, Hoechstalter
 * der Preise 3 Tage, Qualitaets-Chancenpunkte 0, kein Essen, Aufschlag auf
 * die Aufwertungskosten 15,6 % (v3.25.0).
 */
function vorgabeEinstellungen(app) {
  const stationssaetze = {};
  app.REGELN.alleGebaeude().forEach((g) => (stationssaetze[g] = 400));
  return { premium: true, absatzAnteilProzent: 10, stationssaetze, tagesbonus: {}, fce: 0, fceAusnahmen: {}, spezialisierung: {}, zusatzbonusProzent: 0, maxPreisAlterMin: 4320, qualitaetsChancenpunkte: 0, essen: null, aufwertungAufschlagProzent: 15.6 };
}

function jsonLesen(datei) {
  return JSON.parse(fs.readFileSync(datei, "utf8"));
}

/** Vorhandenen Stand lesen; null, wenn keiner da oder er nicht lesbar ist. */
function standLesen(aus, app, log) {
  const G = app.GEMEINSAM;
  const kopfDatei = path.join(aus, G.KOPF_DATEI);
  if (!fs.existsSync(kopfDatei)) return null;
  try {
    const kopf = jsonLesen(kopfDatei);
    G.kopfPruefen(kopf);
    return {
      kopf,
      preise: G.preiseEntpacken(jsonLesen(path.join(aus, G.DATEIEN.preise))),
      volumen: G.volumenEntpacken(jsonLesen(path.join(aus, G.DATEIEN.volumen))),
    };
  } catch (e) {
    log("Vorhandener Stand in " + aus + " ist nicht lesbar und wird ignoriert: " + (e && e.message));
    return null;
  }
}

function bloecke(liste, n) {
  const out = [];
  for (let i = 0; i < liste.length; i += n) out.push(liste.slice(i, i + n));
  return out;
}

/** Auftraege reihum aus mehreren Listen: bricht ein Lauf ab, ist von jeder Art etwas geholt. */
function reihum(listen) {
  const out = [];
  const laenge = Math.max(0, ...listen.map((l) => l.length));
  for (let i = 0; i < laenge; i++) listen.forEach((l) => i < l.length && out.push(l[i]));
  return out;
}

const LEER_LESEN = { preis: () => null, alleQ: () => null, absatz: () => null };

/** Einstellungen von "Gelegenheiten" in der Vorgabe, mit allen Staedten im Ein- und Verkauf. */
function umfangAlleStaedte(app) {
  const G = app.GELEGENHEITEN;
  const staedte = app.VEREDELN.STAEDTE.slice();
  return G.einstellungenBereinigen(Object.assign(G.standardEinstellungen(), { einkaufStaedte: staedte, verkaufStaedte: staedte }));
}

function auftraegeAus(f, app, mitVolumen) {
  const n = app.PREISE.BLOCKGROESSE;
  const listen = [bloecke(f.q1, n).map((ids) => ({ art: "q1", ids })), bloecke(f.alleQ, n).map((ids) => ({ art: "alleQ", ids }))];
  if (mitVolumen) listen.push(bloecke(f.absatz.concat(f.zutatAbsatz), n).map((ids) => ({ art: "absatz", ids })));
  return reihum(listen);
}

/** Voller Lauf: alles, was der Scan der App fuer den Vorgabe-Umfang in allen Staedten abrufen wuerde. */
function auftraegeVoll(app, jetzt) {
  const G = app.GELEGENHEITEN;
  const e = umfangAlleStaedte(app);
  const liste = G.kandidaten(e);
  const f = G.faelligFuer(liste, e, LEER_LESEN, jetzt, null);
  return { auftraege: auftraegeAus(f, app, true), vorgaenge: liste.length };
}

/**
 * Schneller Lauf: Rangliste aus dem vorhandenen Stand, je Stadt einzeln
 * gerechnet (Fertigung, Einkauf und Verkauf in dieser Stadt), die besten
 * Vorgaenge nach Gewinn/Tag, so viele, wie ihre Preisabrufe in maxAbrufe passen.
 */
function auftraegeSchnell(app, jetzt, maxAbrufe) {
  const G = app.GELEGENHEITEN;
  const P = app.PREISE;
  const std = G.standardEinstellungen();
  const liste = G.kandidaten(std);
  const lesen = { preis: P.bestandPreis, alleQ: P.bestandAlleQualitaeten, absatz: P.bestandAbsatz };
  const gemeinsam = vorgabeEinstellungen(app);
  const bester = new Map(); // Zeilenschluessel -> hoechster Gewinn/Tag ueber die Staedte
  app.VEREDELN.STAEDTE.forEach((stadt) => {
    const e = G.einstellungenBereinigen(Object.assign({}, std, { fertigungsstadt: stadt, einkaufStaedte: [stadt], verkaufStaedte: [stadt] }));
    const zeilen = G.zeilenRechnen(liste, e, gemeinsam, lesen, jetzt);
    G.filtereUndSortiere(zeilen, e).zeilen.forEach((z) => {
      const w = z.gewinnJeTag;
      if (w == null || isNaN(w)) return;
      if (!bester.has(z.schluessel) || w > bester.get(z.schluessel)) bester.set(z.schluessel, w);
    });
  });
  const rang = liste
    .filter((x) => bester.has(x.schluessel))
    .sort((a, b) => bester.get(b.schluessel) - bester.get(a.schluessel) || (a.schluessel < b.schluessel ? -1 : a.schluessel > b.schluessel ? 1 : 0));
  const eAlle = umfangAlleStaedte(app);
  const n = P.BLOCKGROESSE;
  const fuer = (k) => G.faelligFuer(rang.slice(0, k), eAlle, LEER_LESEN, jetzt, null);
  const abrufe = (f) => Math.ceil(f.q1.length / n) + Math.ceil(f.alleQ.length / n);
  // Groesste Spitze, deren Preisabrufe in die Grenze passen (die Zahl waechst mit k, deshalb Halbierung).
  let lo = 0;
  let hi = rang.length;
  while (lo < hi) {
    const mitte = Math.ceil((lo + hi) / 2);
    if (abrufe(fuer(mitte)) <= maxAbrufe) lo = mitte;
    else hi = mitte - 1;
  }
  return { auftraege: lo ? auftraegeAus(fuer(lo), app, false) : [], vorgaenge: lo, mitGewinn: rang.length };
}

/**
 * Ein Lauf. Wirft nur bei echten Programmfehlern (z.B. Zielordner nicht
 * schreibbar); gedrosselte oder gescheiterte Abrufe beenden den Lauf sauber.
 *
 * @param {object} o
 * @param {"voll"|"schnell"} o.art
 * @param {string} o.aus            Zielordner, enthaelt auch den vorhandenen Stand
 * @param {number} [o.maxAbrufe]
 * @param {string} [o.wurzel]       Ordner der App (Vorgabe: eine Ebene ueber tools/)
 * @param {Function} [o.fetch]      Vorgabe: das fetch von Node
 * @param {()=>number} [o.jetzt]    Uhr (Tests)
 * @param {(ms:number)=>Promise} [o.warte]
 * @param {(text:string)=>void} [o.log]
 * @returns {Promise<object>} Bericht des Laufs (auch im Kopf stand.json)
 */
async function lauf(o) {
  const art = o.art === "schnell" ? "schnell" : "voll";
  const aus = path.resolve(o.aus || "daten");
  const maxAbrufe = o.maxAbrufe > 0 ? Math.floor(o.maxAbrufe) : MAX_ABRUFE[art];
  const wurzel = o.wurzel || path.join(__dirname, "..");
  const echtFetch = o.fetch || fetch;
  const jetzt = o.jetzt || (() => Date.now());
  const warte = o.warte || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const log = o.log || ((t) => console.log(t));

  const s = { abrufe: 0, bytes: 0, unterwegs: 0, gleichzeitigMax: 0, gewartet429: false, abbruch: null };
  let app = null;

  function abbrechen(grund) {
    if (!s.abbruch) {
      s.abbruch = grund;
      log("ABBRUCH: " + grund + ". Was bis hierher geholt wurde, wird geschrieben; der Rest bleibt auf dem alten Stand.");
    }
    if (app) app.PREISE.planer.abbrechen({ gruppe: PLANER_GRUPPE });
    const e = new Error(grund);
    e.preisstandAbbruch = true;
    return e;
  }

  /** Das fetch, das der Abrufplaner der App benutzt: zaehlt, wiederholt, behandelt 429. */
  async function hoeflich(url) {
    let fehlversuche = 0;
    for (;;) {
      if (s.abbruch) throw abbrechen(s.abbruch);
      if (s.abrufe >= maxAbrufe) throw abbrechen("Obergrenze von " + maxAbrufe + " Abrufen erreicht (--max-abrufe)");
      s.abrufe++;
      s.unterwegs++;
      s.gleichzeitigMax = Math.max(s.gleichzeitigMax, s.unterwegs);
      const start = jetzt();
      let status = 0;
      let text = "";
      let fehler = null;
      try {
        const init = { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } };
        if (typeof AbortSignal !== "undefined" && AbortSignal.timeout && !o.fetch) init.signal = AbortSignal.timeout(ZEITLIMIT_ABRUF_MS);
        const antwort = await echtFetch(url, init);
        status = antwort.status;
        text = await antwort.text();
        if (status !== 429 && !antwort.ok) fehler = "HTTP " + status;
        else if (status !== 429) JSON.parse(text);
      } catch (e) {
        fehler = (e && e.message) || String(e);
      } finally {
        s.unterwegs--;
      }
      if (status === 429) {
        if (s.gewartet429) throw abbrechen("erneut HTTP 429 nach einmaligem Warten");
        const reset = app.PREISE.limitResetAusText(text);
        const bis = reset != null ? reset + app.PREISE.LIMIT_RESET_MARGE_MS : jetzt() + WARTE_429_OHNE_ZEIT_MS;
        const ms = Math.max(app.PREISE.PAUSE_MS, bis - jetzt());
        if (ms > WARTE_429_MAX_MS) throw abbrechen("HTTP 429, die Drossel endet erst in " + Math.round(ms / 1000) + " s (mehr als 5 Minuten)");
        s.gewartet429 = true;
        log("HTTP 429 (Abruf " + s.abrufe + ")" + (reset != null ? ", Drossel endet " + new Date(reset).toISOString() : ", ohne Reset-Zeit") + ": warte einmalig " + Math.round(ms / 1000) + " s.");
        await warte(ms);
        continue;
      }
      if (fehler) {
        fehlversuche++;
        log("Abruf " + s.abrufe + " gescheitert (Versuch " + fehlversuche + " von " + NETZ_VERSUCHE + "): " + fehler);
        if (fehlversuche >= NETZ_VERSUCHE) throw abbrechen("Abruf nach " + NETZ_VERSUCHE + " Versuchen gescheitert (" + fehler + ")");
        await warte(app.PREISE.PAUSE_MS * Math.pow(2, fehlversuche));
        continue;
      }
      s.bytes += text.length;
      log("Abruf " + s.abrufe + ": " + Math.round(text.length / 1024) + " KB in " + (jetzt() - start) + " ms");
      return { status, ok: true, text: async () => text };
    }
  }

  app = appLaden(wurzel, { fetch: hoeflich, jetzt: o.jetzt, warte: o.warte });
  const P = app.PREISE;
  const G = app.GEMEINSAM;
  await P.bestandBereit();

  const begonnenAm = jetzt();
  const alt = standLesen(aus, app, log);
  if (alt) {
    const r = P.bestandEinmischen({ preise: alt.preise, volumen: alt.volumen }, { jetzt: begonnenAm });
    log("Vorhandener Stand: " + r.preise + " Preiseinträge und " + r.volumen + " Volumeneinträge übernommen, " + (r.zuAlt + r.zukunft) + " verworfen (älter als " + P.BESTAND_MAX_ALTER_TAGE + " Tage).");
  } else log("Kein vorhandener Stand in " + aus + ".");

  const altLaeufe = (alt && alt.kopf.laeufe) || {};
  const hatVollenStand = !!(alt && altLaeufe.voll && altLaeufe.voll.begonnenAm && P.bestandInfo().preise > 0);
  if (art === "schnell" && !hatVollenStand) {
    log("Schneller Lauf: es gibt noch keinen Stand eines vollen Laufs, nichts zu tun.");
    return { art, geschrieben: false, abrufe: 0, abgebrochen: false, grund: null, gleichzeitigMax: 0 };
  }

  const plan = art === "voll" ? auftraegeVoll(app, begonnenAm) : auftraegeSchnell(app, begonnenAm, maxAbrufe);
  log(
    (art === "voll" ? "Voller Lauf: " + plan.vorgaenge + " Vorgänge" : "Schneller Lauf: Spitze von " + plan.vorgaenge + " der " + plan.mitGewinn + " Vorgänge mit Gewinn") +
      ", " + plan.auftraege.length + " Abrufe geplant, Obergrenze " + maxAbrufe + "."
  );

  const staedte = app.VEREDELN.STAEDTE.slice();
  const basis = { staedte, erzwingen: true, prioritaet: "hintergrund", gruppe: PLANER_GRUPPE };
  const erledigt = { q1: 0, alleQ: 0, absatz: 0 };
  for (const a of plan.auftraege) {
    if (s.abbruch) break;
    if (s.abrufe >= maxAbrufe) {
      abbrechen("Obergrenze von " + maxAbrufe + " Abrufen erreicht (--max-abrufe)");
      break;
    }
    try {
      if (a.art === "q1") await P.preiseAbrufen(a.ids, Object.assign({ qualitaet: 1 }, basis));
      else if (a.art === "alleQ") await P.preiseAlleQualitaetenAbrufen(a.ids, basis);
      else await P.absatzAbrufen(a.ids, Object.assign({ tageFenster: app.GELEGENHEITEN.TAGE_FENSTER }, basis));
      erledigt[a.art]++;
    } catch (e) {
      if (!s.abbruch) abbrechen("Abruf gescheitert (" + ((e && e.message) || e) + ")");
      break;
    }
  }
  const offen = plan.auftraege.length - erledigt.q1 - erledigt.alleQ - erledigt.absatz;
  const abgebrochen = !!s.abbruch && offen > 0;

  // Schreiben: alles, was hoechstens 7 Tage alt ist.
  const beendetAm = jetzt();
  const grenze = beendetAm - P.BESTAND_MAX_ALTER_TAGE * 24 * 60 * 60 * 1000;
  const alle = P.bestandEintraege();
  const frisch = (paar) => paar[1] && paar[1].abgerufenAm >= grenze;
  const pack = G.packen({ preise: alle.preise.filter(frisch), volumen: alle.volumen.filter(frisch) });
  const texte = { preise: JSON.stringify(pack.preise), volumen: JSON.stringify(pack.volumen) };
  const altDateien = (alt && alt.kopf.dateien) || {};
  const geaendert = { preise: erledigt.q1 + erledigt.alleQ > 0, volumen: erledigt.absatz > 0 };
  const groesse = (text) => ({ bytes: Buffer.byteLength(text), gzipBytes: zlib.gzipSync(text).length });
  const dateiKopf = (feld, zahlen) =>
    Object.assign({ name: G.DATEIEN[feld], geaendertAm: geaendert[feld] || !altDateien[feld] ? beendetAm : altDateien[feld].geaendertAm }, zahlen, groesse(texte[feld]));
  const dieserLauf = { begonnenAm, beendetAm, abrufe: s.abrufe, abgebrochen, grund: abgebrochen ? s.abbruch : null };
  const altArt = altLaeufe[art] || {};
  const laeufe = Object.assign({}, altLaeufe);
  laeufe[art] = Object.assign({}, dieserLauf, { vollstaendigAm: abgebrochen ? altArt.vollstaendigAm || null : beendetAm });
  const kopf = {
    schema: G.SCHEMA,
    erzeugtAm: beendetAm,
    dateien: {
      preise: dateiKopf("preise", { eintraege: pack.zahl.preise, merker: pack.zahl.merker }),
      volumen: dateiKopf("volumen", { eintraege: pack.zahl.volumen }),
    },
    laeufe,
    letzterLauf: Object.assign({ art }, dieserLauf),
  };
  fs.mkdirSync(aus, { recursive: true });
  fs.writeFileSync(path.join(aus, G.DATEIEN.preise), texte.preise);
  fs.writeFileSync(path.join(aus, G.DATEIEN.volumen), texte.volumen);
  fs.writeFileSync(path.join(aus, G.KOPF_DATEI), JSON.stringify(kopf));

  const kb = (n) => Math.round(n / 1024) + " KB";
  log(
    "Geschrieben nach " + aus + ": " + pack.zahl.preise + " Preiseinträge, " + pack.zahl.merker + " Merker, " + pack.zahl.volumen + " Volumeneinträge" + (pack.zahl.woertlich ? ", " + pack.zahl.woertlich + " wörtlich" : "") +
      ". preise.json " + kb(kopf.dateien.preise.bytes) + " (gzip " + kb(kopf.dateien.preise.gzipBytes) + "), volumen.json " + kb(kopf.dateien.volumen.bytes) + " (gzip " + kb(kopf.dateien.volumen.gzipBytes) + ")."
  );
  log(
    "Lauf " + art + (abgebrochen ? " ABGEBROCHEN (" + s.abbruch + ")" : " vollständig") + ": " + s.abrufe + " Abrufe, " + (erledigt.q1 + erledigt.alleQ + erledigt.absatz) + " von " + plan.auftraege.length +
      " Blöcken, " + Math.round(s.bytes / 1024 / 1024 * 10) / 10 + " MB Antwortdaten, " + Math.round((beendetAm - begonnenAm) / 1000) + " s."
  );
  return Object.assign({ art, geschrieben: true, geplant: plan.auftraege.length, erledigt, bloeckeOffen: offen, antwortBytes: s.bytes, gleichzeitigMax: s.gleichzeitigMax, zahl: pack.zahl, kopf }, dieserLauf);
}

function argumente(argv) {
  const o = { art: null, aus: "daten", maxAbrufe: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--voll" || a === "--schnell") {
      if (o.art) throw new Error("Nur eine Lauf-Art angeben (--voll oder --schnell).");
      o.art = a.slice(2);
    } else if (a === "--aus") o.aus = argv[++i];
    else if (a === "--max-abrufe") {
      o.maxAbrufe = Number(argv[++i]);
      if (!(o.maxAbrufe > 0) || o.maxAbrufe !== Math.floor(o.maxAbrufe)) throw new Error("--max-abrufe braucht eine ganze Zahl größer 0.");
    } else throw new Error("Unbekanntes Argument: " + a);
  }
  if (!o.art) throw new Error("Lauf-Art fehlt: --voll oder --schnell.");
  if (!o.aus) throw new Error("--aus braucht einen Ordner.");
  return o;
}

if (require.main === module) {
  let o;
  try {
    o = argumente(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    console.error("Aufruf: node tools/preisstand.js --voll|--schnell [--aus daten] [--max-abrufe N]");
    process.exit(2);
  }
  lauf(o).then(
    () => process.exit(0),
    (e) => {
      console.error("Programmfehler: " + ((e && e.stack) || e));
      process.exit(1);
    }
  );
}

module.exports = { lauf, argumente, appLaden, USER_AGENT, MAX_ABRUFE, APP_DATEIEN };
