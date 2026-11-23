// js/gemeinsam.js
//
// Gemeinsamer Preisstand (v3.23.0, Paket O9). Ein Abrufer bei GitHub
// (tools/preisstand.js, .github/workflows/preisstand.yml) legt regelmaessig
// einen Preisstand als Dateien auf dem Zweig "daten" des Repos ab. Diese Datei
// enthaelt
//
// 1. das DATEIFORMAT, an genau einer Stelle: packen() (benutzt das Skript)
//    und entpacken() (benutzt die App). Beide arbeiten auf den Eintraegen des
//    Preisbestands von js/preise.js, so wie dessen Abruffunktionen sie ablegen.
// 2. den LADER der App (erzeugen()): Kopf holen, grosse Dateien nur bei
//    Aenderung, entpacken, ueber PREISE.bestandEinmischen() einmischen (je
//    Eintrag gewinnt der juengere Abruf), Zustand fuer die Anzeige.
//
// Der Abruf bei GitHub laeuft NICHT ueber PREISE.planer: anderer Host, zaehlt
// nicht gegen das Budget der Preis-Schnittstelle. Die App schreibt nie zu
// GitHub und sendet nichts ausser dem gewoehnlichen Abruf der oeffentlichen
// Dateien.
//
// Muss NACH js/preise.js geladen werden. Ohne DOM lauffaehig (Node, Tests).
//
// ---------------------------------------------------------------------------
// Dateiformat, Schema 1 (JSON ohne Einrueckung, kurze Schluessel)
// ---------------------------------------------------------------------------
//
// stand.json (Kopf, klein):
//   { schema: 1,
//     erzeugtAm: ms,                       Zeit des Schreibens
//     dateien: {
//       preise:  { name: "preise.json",  geaendertAm: ms, eintraege: n, merker: n, bytes: n },
//       volumen: { name: "volumen.json", geaendertAm: ms, eintraege: n, bytes: n } },
//     laeufe: {                            je Lauf-Art
//       voll:    { begonnenAm, vollstaendigAm, beendetAm, abrufe, abgebrochen, grund },
//       schnell: { ... } },
//     letzterLauf: { art, begonnenAm, beendetAm, abrufe, abgebrochen, grund } }
//   geaendertAm aendert sich nur, wenn ein Lauf in diese Datei neu Abgerufenes
//   geschrieben hat; die App holt eine Datei nur dann erneut.
//
// preise.json:
//   { schema: 1, basis: ms, staedte: [Name, ...],
//     p: { "<Markt-ID>": [ Zeile, ... ] },   Preiszeilen (Schluessel Stadt::ID::qN)
//     m: { "<Markt-ID>": [ [s, dt, [q, ...]], ... ] },  Merker "alle Qualitaeten" (Stadt::ID::qA)
//     x: [ [Schluessel, Eintrag], ... ] }    woertlich, was nicht in die kurze Form passt
//   Zeile = [s, q, dt, sellPreis, sellDatum, buyPreis, buyDatum]
//        oder [s, q, dt] fuer "weder Angebot noch Kaufgesuch, nie erfasst".
//   s = Index in staedte, q = Qualitaet 1..5, dt = abgerufenAm - basis (ms).
//   Preis 0 = kein Angebot (im Bestand: preis null, kein true).
//   Datum: 0 = "0001-01-01T00:00:00" (nie erfasst), Zahl = Sekunden seit
//   Epoch (UTC, im Bestand "JJJJ-MM-TTTHH:MM:SS"), sonst der Text selbst.
//
// volumen.json:
//   { schema: 1, basis: ms, staedte: [...], fenster: 7,
//     a: { "<Markt-ID>": [ [s, dt, [q, stueckGesamt, preis], ...], ... ] },  Absatz je Qualitaet (Stadt::ID::a7)
//     x: [ [Schluessel, Eintrag], ... ] }
//   preis = mengengewichteter Durchschnittspreis oder null; stueckJeTag ergibt
//   sich als stueckGesamt / fenster.

const GEMEINSAM = (function () {
  "use strict";

  const SCHEMA = 1;
  // Zweig "daten" des Repos, s. README.md, Abschnitt "Gemeinsamer Preisstand".
  const BASIS_URL = "https://raw.githubusercontent.com/Birnify/Albion_Crafting_Calculator/daten/";
  const KOPF_DATEI = "stand.json";
  const DATEIEN = { preise: "preise.json", volumen: "volumen.json" };
  const LADE_INTERVALL_MS = 15 * 60 * 1000;
  const SPEICHER_KEY = "albion_kostenrechner_gemeinsam_v1";
  const MISCH_SCHEIBE = 20000; // Eintraege je Schritt beim Einmischen, danach bekommt der Browser Luft
  const NIE_DATUM = "0001-01-01T00:00:00";
  const DATUM_FORM = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/;

  // -------------------------------------------------------------------------
  // Format: packen und entpacken (rein, ohne Netz)
  // -------------------------------------------------------------------------

  function datumPacken(d) {
    if (d === NIE_DATUM) return 0;
    if (typeof d === "string" && DATUM_FORM.test(d)) {
      const ms = Date.parse(d + "Z");
      if (isFinite(ms) && ms !== 0 && ms % 1000 === 0 && datumEntpacken(ms / 1000) === d) return ms / 1000;
    }
    return typeof d === "string" ? d : "";
  }

  function datumEntpacken(x) {
    if (x === 0) return NIE_DATUM;
    if (typeof x === "number") return new Date(x * 1000).toISOString().slice(0, 19);
    return typeof x === "string" ? x : "";
  }

  const seiteOk = (s) => s && typeof s === "object" && (s.preis === null ? s.kein === true : typeof s.preis === "number" && s.preis > 0 && s.kein === false) && typeof s.datum === "string";

  /**
   * Bestandseintraege in das Dateiformat bringen.
   * @param {{preise: Array<[string, object]>, volumen: Array<[string, object]>}} eintraege wie PREISE.bestandEintraege()
   * @param {number} [basis] Bezugszeit fuer dt (Vorgabe: aelteste Abrufzeit)
   * @returns {{preise: object, volumen: object, zahl: {preise:number, merker:number, volumen:number, woertlich:number}}}
   */
  function packen(eintraege, basis) {
    const preise = (eintraege && eintraege.preise) || [];
    const volumen = (eintraege && eintraege.volumen) || [];
    if (basis == null) {
      basis = Infinity;
      preise.concat(volumen).forEach((p) => {
        if (p[1] && p[1].abgerufenAm < basis) basis = p[1].abgerufenAm;
      });
      if (!isFinite(basis)) basis = 0;
    }
    const staedte = [];
    const stadtIndex = (name) => {
      let i = staedte.indexOf(name);
      if (i === -1) i = staedte.push(name) - 1;
      return i;
    };
    const zahl = { preise: 0, merker: 0, volumen: 0, woertlich: 0 };
    const p = {};
    const m = {};
    const xp = [];
    preise.forEach(([key, e]) => {
      const t = String(key).split("::");
      const dt = e && typeof e.abgerufenAm === "number" ? e.abgerufenAm - basis : null;
      if (t.length === 3 && dt != null && t[2] === "qA" && e.alleQ === true && Array.isArray(e.qualitaeten)) {
        (m[t[1]] || (m[t[1]] = [])).push([stadtIndex(t[0]), dt, e.qualitaeten]);
        zahl.merker++;
        return;
      }
      const q = t.length === 3 ? /^q([1-5])$/.exec(t[2]) : null;
      if (q && dt != null && e.id === t[1] && e.stadt === t[0] && seiteOk(e.sell) && seiteOk(e.buy) && Object.keys(e).length === 5) {
        const zeile = [stadtIndex(t[0]), Number(q[1]), dt, e.sell.preis || 0, datumPacken(e.sell.datum), e.buy.preis || 0, datumPacken(e.buy.datum)];
        if (!zeile[3] && zeile[4] === 0 && !zeile[5] && zeile[6] === 0) zeile.length = 3;
        (p[t[1]] || (p[t[1]] = [])).push(zeile);
        zahl.preise++;
        return;
      }
      xp.push([key, e]);
      zahl.woertlich++;
    });
    const a = {};
    const xv = [];
    const FENSTER = 7;
    volumen.forEach(([key, e]) => {
      const t = String(key).split("::");
      const dt = e && typeof e.abgerufenAm === "number" ? e.abgerufenAm - basis : null;
      const jeQ = e && e.jeQ;
      const kurz =
        t.length === 3 &&
        t[2] === "a" + FENSTER &&
        dt != null &&
        jeQ &&
        typeof jeQ === "object" &&
        Object.keys(e).length === 2 &&
        Object.keys(jeQ).every((q) => {
          const x = jeQ[q];
          return (
            x && x.id === t[1] && x.stadt === t[0] && String(x.qualitaet) === q && x.tageFenster === FENSTER && x.abgerufenAm === e.abgerufenAm &&
            typeof x.stueckGesamt === "number" && x.stueckJeTag === x.stueckGesamt / FENSTER && (x.mengengewichteterPreis === null || typeof x.mengengewichteterPreis === "number") && Object.keys(x).length === 8
          );
        });
      if (!kurz) {
        xv.push([key, e]);
        zahl.woertlich++;
        return;
      }
      const zeile = [stadtIndex(t[0]), dt];
      Object.keys(jeQ).forEach((q) => zeile.push([Number(q), jeQ[q].stueckGesamt, jeQ[q].mengengewichteterPreis]));
      (a[t[1]] || (a[t[1]] = [])).push(zeile);
      zahl.volumen++;
    });
    return {
      preise: { schema: SCHEMA, basis, staedte, p, m, x: xp },
      volumen: { schema: SCHEMA, basis, staedte, fenster: FENSTER, a, x: xv },
      zahl,
    };
  }

  function schemaPruefen(datei, name) {
    if (!datei || typeof datei !== "object" || Array.isArray(datei)) throw new Error(name + ": kein gültiger Inhalt");
    if (datei.schema !== SCHEMA) throw new Error(name + ": unbekanntes Schema " + JSON.stringify(datei.schema) + " (erwartet " + SCHEMA + ")");
  }

  const istZahl = (x) => typeof x === "number" && isFinite(x);

  /** preise.json in Bestandspaare [Schluessel, Eintrag] entpacken. Wirft bei kaputtem Inhalt. */
  function preiseEntpacken(datei) {
    schemaPruefen(datei, DATEIEN.preise);
    if (!istZahl(datei.basis) || !Array.isArray(datei.staedte) || !datei.p || !datei.m) throw new Error(DATEIEN.preise + ": Felder fehlen");
    const out = [];
    const stadt = (i) => {
      const s = datei.staedte[i];
      if (typeof s !== "string") throw new Error(DATEIEN.preise + ": unbekannte Stadt " + i);
      return s;
    };
    Object.keys(datei.p).forEach((id) => {
      datei.p[id].forEach((z) => {
        if (!Array.isArray(z) || !(z.length === 3 || z.length === 7) || !istZahl(z[2]) || !(z[1] >= 1 && z[1] <= 5)) throw new Error(DATEIEN.preise + ": kaputte Zeile bei " + id);
        const s = stadt(z[0]);
        const sp = z.length === 7 ? z[3] : 0;
        const bp = z.length === 7 ? z[5] : 0;
        out.push([
          PREISE.cacheSchluessel(s, id, z[1]),
          {
            id,
            stadt: s,
            sell: { preis: sp || null, datum: datumEntpacken(z.length === 7 ? z[4] : 0), kein: !sp },
            buy: { preis: bp || null, datum: datumEntpacken(z.length === 7 ? z[6] : 0), kein: !bp },
            abgerufenAm: datei.basis + z[2],
          },
        ]);
      });
    });
    Object.keys(datei.m).forEach((id) => {
      datei.m[id].forEach((z) => {
        if (!Array.isArray(z) || !istZahl(z[1]) || !Array.isArray(z[2])) throw new Error(DATEIEN.preise + ": kaputter Merker bei " + id);
        out.push([stadt(z[0]) + "::" + id + "::qA", { alleQ: true, qualitaeten: z[2], abgerufenAm: datei.basis + z[1] }]);
      });
    });
    (datei.x || []).forEach((paar) => {
      if (Array.isArray(paar) && typeof paar[0] === "string" && paar[1] && typeof paar[1] === "object") out.push([paar[0], paar[1]]);
    });
    return out;
  }

  /** volumen.json in Bestandspaare entpacken. Wirft bei kaputtem Inhalt. */
  function volumenEntpacken(datei) {
    schemaPruefen(datei, DATEIEN.volumen);
    if (!istZahl(datei.basis) || !Array.isArray(datei.staedte) || !datei.a || !(datei.fenster > 0)) throw new Error(DATEIEN.volumen + ": Felder fehlen");
    const out = [];
    const fenster = datei.fenster;
    Object.keys(datei.a).forEach((id) => {
      datei.a[id].forEach((z) => {
        const s = Array.isArray(z) ? datei.staedte[z[0]] : null;
        if (typeof s !== "string" || !istZahl(z[1])) throw new Error(DATEIEN.volumen + ": kaputte Zeile bei " + id);
        const am = datei.basis + z[1];
        const jeQ = {};
        for (let i = 2; i < z.length; i++) {
          const x = z[i];
          if (!Array.isArray(x) || !istZahl(x[1])) throw new Error(DATEIEN.volumen + ": kaputte Qualitätszeile bei " + id);
          jeQ[x[0]] = { id, stadt: s, qualitaet: x[0], stueckJeTag: x[1] / fenster, stueckGesamt: x[1], tageFenster: fenster, mengengewichteterPreis: x[2] == null ? null : x[2], abgerufenAm: am };
        }
        out.push([s + "::" + id + "::a" + fenster, { abgerufenAm: am, jeQ }]);
      });
    });
    (datei.x || []).forEach((paar) => {
      if (Array.isArray(paar) && typeof paar[0] === "string" && paar[1] && typeof paar[1] === "object") out.push([paar[0], paar[1]]);
    });
    return out;
  }

  /** Kopf pruefen und auf die Felder bringen, die Lader und Anzeige brauchen. Wirft bei falschem Schema. */
  function kopfPruefen(kopf) {
    schemaPruefen(kopf, KOPF_DATEI);
    if (!istZahl(kopf.erzeugtAm) || !kopf.dateien || typeof kopf.dateien !== "object") throw new Error(KOPF_DATEI + ": Felder fehlen");
    const lauf = (x) => (x && typeof x === "object" ? x : {});
    const laeufe = kopf.laeufe && typeof kopf.laeufe === "object" ? kopf.laeufe : {};
    return {
      erzeugtAm: kopf.erzeugtAm,
      dateien: kopf.dateien,
      voll: lauf(laeufe.voll),
      schnell: lauf(laeufe.schnell),
    };
  }

  // -------------------------------------------------------------------------
  // Lader der App
  // -------------------------------------------------------------------------

  function luftHolen() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  function merkerLesen(key) {
    try {
      const x = JSON.parse(localStorage.getItem(key) || "null");
      return x && typeof x === "object" && x.schema === SCHEMA ? x : null;
    } catch (e) {
      return null;
    }
  }

  function merkerSchreiben(key, wert) {
    try {
      localStorage.setItem(key, JSON.stringify(wert));
    } catch (e) {
      /* Speicher voll oder gesperrt: dann wird beim naechsten Start eben neu geladen */
    }
  }

  /**
   * Legt einen Lader an. Er tut von sich aus nichts; starten() laedt einmal
   * und richtet die Wiederholung ein.
   * @param {object} [o]
   * @param {()=>boolean} [o.an]           Schalter "Gemeinsamen Preisstand laden"; false = kein Abruf
   * @param {string} [o.basisUrl]
   * @param {Function} [o.fetch]           Vorgabe: das globale fetch, zur Aufrufzeit gelesen
   * @param {()=>number} [o.jetzt]
   * @param {()=>boolean} [o.sichtbar]     Seite sichtbar? (Wiederholung nur dann)
   * @param {string|null} [o.speicherKey]  localStorage-Schluessel des Merkers, null = ohne
   * @param {()=>Promise} [o.luft]
   * @param {number} [o.intervallMs]
   */
  function erzeugen(o) {
    o = o || {};
    const an = typeof o.an === "function" ? o.an : () => true;
    const basisUrl = o.basisUrl || BASIS_URL;
    const jetzt = typeof o.jetzt === "function" ? o.jetzt : () => Date.now();
    const sichtbar = typeof o.sichtbar === "function" ? o.sichtbar : () => typeof document === "undefined" || document.visibilityState !== "hidden";
    const speicherKey = o.speicherKey === null ? null : o.speicherKey || SPEICHER_KEY;
    const luft = typeof o.luft === "function" ? o.luft : luftHolen;
    const intervallMs = o.intervallMs > 0 ? o.intervallMs : LADE_INTERVALL_MS;
    const hoerer = [];
    let laeuft = null;
    let timer = null;
    let sichtHoerer = null;

    // Merker: was zuletzt eingemischt wurde. Ueberlebt das Neuladen der Seite,
    // damit ein unveraenderter Stand nicht erneut heruntergeladen wird.
    const gespeichert = speicherKey ? merkerLesen(speicherKey) : null;
    const z = {
      zustand: "nie", // "nie" | "laedt" | "ok" | "fehler" | "aus"
      fehler: null,
      letzterVersuch: null,
      letzterErfolg: gespeichert ? gespeichert.letzterErfolg || null : null,
      eingemischt: gespeichert && gespeichert.eingemischt ? gespeichert.eingemischt : {}, // Datei -> geaendertAm des eingemischten Stands
      kopf: gespeichert ? gespeichert.kopf || null : null, // {erzeugtAm, voll, schnell}
      uebernommen: gespeichert ? gespeichert.uebernommen || null : null, // Zaehler des letzten Einmischens
      abrufe: 0, // Abrufe bei GitHub seit dem Laden der Seite
      grosseAbrufe: 0,
    };

    function status() {
      return {
        an: !!an(),
        zustand: an() ? z.zustand : "aus",
        fehler: z.fehler,
        letzterVersuch: z.letzterVersuch,
        letzterErfolg: z.letzterErfolg,
        kopf: z.kopf,
        uebernommen: z.uebernommen,
        abrufe: z.abrufe,
        grosseAbrufe: z.grosseAbrufe,
      };
    }

    function melden(ereignis) {
      hoerer.slice().forEach((fn) => {
        try {
          fn(ereignis);
        } catch (err) {
          if (typeof console !== "undefined") console.error(err);
        }
      });
    }

    async function holen(name, gross) {
      const f = o.fetch || fetch;
      z.abrufe++;
      if (gross) z.grosseAbrufe++;
      let antwort;
      try {
        antwort = await f(basisUrl + name, { cache: "no-store" });
      } catch (err) {
        throw new Error("nicht erreichbar (" + ((err && err.message) || err) + ")");
      }
      if (!antwort || !antwort.ok) throw new Error(antwort && antwort.status === 404 ? "noch kein Stand vorhanden (HTTP 404)" : "HTTP " + (antwort ? antwort.status : "?"));
      try {
        return await antwort.json();
      } catch (err) {
        throw new Error(name + " ist nicht lesbar");
      }
    }

    async function einmal() {
      await PREISE.bestandBereit();
      const kopf = kopfPruefen(await holen(KOPF_DATEI, false));
      // Ein geleerter Bestand kennt den eingemischten Stand nicht mehr: dann zaehlt der Merker nicht.
      const info = PREISE.bestandInfo();
      const leer = !info.preise && !info.volumen;
      const summe = { preise: 0, volumen: 0, aelter: 0, zuAlt: 0, zukunft: 0 };
      const ids = new Set();
      let geladen = 0;
      for (const feld of Object.keys(DATEIEN)) {
        const d = kopf.dateien[feld];
        if (!d || !istZahl(d.geaendertAm)) continue;
        if (!leer && z.eingemischt[feld] >= d.geaendertAm) continue;
        const paare = (feld === "preise" ? preiseEntpacken : volumenEntpacken)(await holen(DATEIEN[feld], true));
        for (let i = 0; i < paare.length; i += MISCH_SCHEIBE) {
          const r = PREISE.bestandEinmischen({ [feld]: paare.slice(i, i + MISCH_SCHEIBE) }, { jetzt: jetzt() });
          ["preise", "volumen", "aelter", "zuAlt", "zukunft"].forEach((k) => (summe[k] += r[k]));
          r.ids.forEach((id) => ids.add(id));
          if (i + MISCH_SCHEIBE < paare.length) await luft();
        }
        z.eingemischt[feld] = d.geaendertAm;
        geladen++;
      }
      z.kopf = { erzeugtAm: kopf.erzeugtAm, voll: kopf.voll, schnell: kopf.schnell };
      if (geladen) z.uebernommen = Object.assign({ um: jetzt() }, summe);
      z.letzterErfolg = jetzt();
      if (speicherKey) {
        const merker = { schema: SCHEMA, eingemischt: Object.assign({}, z.eingemischt), kopf: z.kopf, uebernommen: z.uebernommen, letzterErfolg: z.letzterErfolg };
        // v3.25.0: den Merker erst setzen, wenn der eingemischte Stand DAUERHAFT
        // im Bestand liegt. Das Schreiben von rund 155.000 Eintraegen laeuft im
        // Hintergrund und dauert einige Sekunden. Wurde die Seite vorher
        // geschlossen, stand der Merker schon auf "eingemischt", der Bestand war
        // aber nur zum Teil geschrieben (live gesehen am 23.11.2026: 125.000
        // von 131.621 Preisen, 578 von 23.566 Volumenwerten), und die App holte
        // den Rest bis zum naechsten Lauf bei GitHub nicht nach.
        const schreiben = () => merkerSchreiben(speicherKey, merker);
        if (geladen && typeof PREISE.bestandGeschrieben === "function") PREISE.bestandGeschrieben().then(schreiben, () => {});
        else schreiben();
      }
      return { geladen, ids: Array.from(ids), summe };
    }

    /**
     * Einmal laden und einmischen. Wirft nie: ein Fehler steht danach in
     * status().fehler, die App arbeitet mit ihrem Bestand weiter.
     * @returns {Promise<{geladen:number, ids:string[]}|null>} null = ausgeschaltet oder gescheitert
     */
    function laden() {
      if (!an()) return Promise.resolve(null);
      if (laeuft) return laeuft;
      z.zustand = "laedt";
      z.letzterVersuch = jetzt();
      melden({ typ: "status" });
      laeuft = einmal().then(
        (r) => {
          laeuft = null;
          z.zustand = "ok";
          z.fehler = null;
          if (r.geladen) melden({ typ: "eingemischt", ids: r.ids, summe: r.summe });
          melden({ typ: "status" });
          return r;
        },
        (err) => {
          laeuft = null;
          z.zustand = "fehler";
          z.fehler = (err && err.message) || String(err);
          melden({ typ: "status" });
          return null;
        }
      );
      return laeuft;
    }

    /** Wiederholung: alle intervallMs, solange die Seite sichtbar ist; nach einer verborgenen Phase beim Zurueckkehren. */
    function faelligPruefen() {
      if (!an() || !sichtbar()) return;
      if (z.letzterVersuch != null && jetzt() - z.letzterVersuch < intervallMs - 1000) return;
      laden();
    }

    function starten() {
      if (timer == null && typeof setInterval === "function") timer = setInterval(faelligPruefen, intervallMs);
      if (!sichtHoerer && typeof document !== "undefined" && document.addEventListener) {
        sichtHoerer = faelligPruefen;
        document.addEventListener("visibilitychange", sichtHoerer);
      }
      return laden();
    }

    function beenden() {
      if (timer != null) clearInterval(timer);
      timer = null;
      if (sichtHoerer) document.removeEventListener("visibilitychange", sichtHoerer);
      sichtHoerer = null;
      hoerer.length = 0;
    }

    return {
      laden,
      starten,
      beenden,
      faelligPruefen,
      status,
      /** Der Schalter wurde umgelegt: Anzeige nachziehen, beim Einschalten sofort laden. */
      schalterGeaendert() {
        melden({ typ: "status" });
        return an() ? laden() : Promise.resolve(null);
      },
      beiAenderung(fn) {
        hoerer.push(fn);
        return () => {
          const i = hoerer.indexOf(fn);
          if (i !== -1) hoerer.splice(i, 1);
        };
      },
    };
  }

  // -------------------------------------------------------------------------
  // Anzeige (ohne DOM, testbar)
  // -------------------------------------------------------------------------

  function zeitText(ms, jetzt) {
    if (!(ms > 0)) return "unbekannt";
    const d = new Date(ms);
    const uhr = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const heute = new Date(jetzt == null ? Date.now() : jetzt);
    const gleicherTag = d.getFullYear() === heute.getFullYear() && d.getMonth() === heute.getMonth() && d.getDate() === heute.getDate();
    return gleicherTag ? uhr : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + " " + uhr;
  }

  /** Zeit des letzten vollen Laufs: der letzte vollstaendige, sonst der letzte begonnene. */
  function vollZeit(kopf) {
    const v = kopf && kopf.voll;
    return v ? v.vollstaendigAm || v.begonnenAm || null : null;
  }

  /** Kurzer Text fuer die Leiste von "Gelegenheiten"; "" = nichts zeigen (ausgeschaltet). */
  function anzeigeText(s, jetzt) {
    if (!s.an) return "";
    const t = vollZeit(s.kopf);
    if (t) return "Gemeinsamer Stand von " + zeitText(t, jetzt);
    if (s.zustand === "fehler") return "Gemeinsamer Stand fehlt";
    return s.zustand === "laedt" || s.zustand === "nie" ? "Gemeinsamer Stand lädt" : "Gemeinsamer Stand fehlt";
  }

  function anzeigeTitel(s, jetzt) {
    const nl = String.fromCharCode(10);
    const zeilen = ["Preisstand, den ein Abrufer bei GitHub regelmäßig ablegt. Er füllt auf, was der eigene Preisbestand nicht oder nur älter hat; je Eintrag gewinnt der jüngere Abruf. Der eigene Scan ersetzt ihn Stück für Stück."];
    const k = s.kopf;
    const zahl = (n) => Math.round(n || 0).toLocaleString("de-DE");
    if (k) {
      const lauf = (name, x) =>
        name + ": " + (x.vollstaendigAm ? "vollständig " + zeitText(x.vollstaendigAm, jetzt) : "noch nie vollständig") +
        (x.begonnenAm && x.begonnenAm !== x.vollstaendigAm ? ", zuletzt begonnen " + zeitText(x.begonnenAm, jetzt) : "") +
        (x.abgebrochen ? ", abgebrochen (" + (x.grund || "Grund unbekannt") + ")" : "");
      zeilen.push(lauf("Voller Lauf", k.voll || {}));
      zeilen.push(lauf("Schneller Lauf (Spitze der Rangliste)", k.schnell || {}));
    }
    if (s.uebernommen) {
      const u = s.uebernommen;
      zeilen.push(
        "Zuletzt übernommen " + zeitText(u.um, jetzt) + ": " + zahl(u.preise) + " Preiseinträge und " + zahl(u.volumen) + " Einträge zu verkauft/Tag; " + zahl(u.aelter) + " waren im eigenen Bestand schon gleich alt oder jünger" +
          (u.zuAlt || u.zukunft ? ", " + zahl(u.zuAlt + u.zukunft) + " verworfen (älter als 7 Tage oder Abrufzeit in der Zukunft)" : "") + "."
      );
    }
    if (s.zustand === "fehler") zeilen.push("Letzter Abruf bei GitHub gescheitert: " + (s.fehler || "Grund unbekannt") + ". Die App rechnet mit dem eigenen Preisbestand weiter.");
    else if (s.letzterErfolg) zeilen.push("Zuletzt bei GitHub nachgesehen " + zeitText(s.letzterErfolg, jetzt) + ", wieder alle 15 Min., solange die Seite sichtbar ist.");
    return zeilen.join(nl);
  }

  return {
    SCHEMA,
    BASIS_URL,
    KOPF_DATEI,
    DATEIEN,
    LADE_INTERVALL_MS,
    SPEICHER_KEY,
    packen,
    preiseEntpacken,
    volumenEntpacken,
    kopfPruefen,
    erzeugen,
    vollZeit,
    anzeigeText,
    anzeigeTitel,
  };
})();
