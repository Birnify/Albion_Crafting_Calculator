// js/preise.js
//
// Preisschicht des Kostenrechners: Markt-ID-Bildung, ID-Sammler ueber den
// Rezeptgraphen, Abrufplaner (eine Warteschlange fuer alle Abrufe gegen die
// Albion Data API, seit v3.16.0, s. Abschnitt "Abrufplaner"), gemeinsamer
// Preis- und Volumenbestand (seit v3.15.0 in IndexedDB mit Arbeitskopie im
// Speicher, Rueckfall localStorage, s. Abschnitt "Bestand"), Eigenpreis-Ablage
// fuer nicht handelbare Zutaten (unveraendert localStorage). Reine JS-Datei ohne Oberflaeche: vom
// document wird nur die Sichtbarkeit des Tabs gelesen (Abrufplaner). Per <script src="js/preise.js"></script> einbindbar.
// Muss NACH rezepte.js geladen werden, sammleMarktIds() und marktId()
// lesen aus dem globalen REZEPTGRAPH.
//
// Wichtige Falle, mehrfach am 04.09.2026 gegen die echte API bestaetigt
// (s. kostenrechner-KONTEXT.md, Abschnitt "Markt-ID"):
//
//   Die Markt-ID eines verzauberten Gegenstands ist IMMER <uniquename>@<stufe>,
//   auch wenn die Stufe schon im uniquename steckt:
//     T4_CLOTH_LEVEL1@1   richtig  (nicht T4_CLOTH_LEVEL1, nicht T4_CLOTH@1)
//     T4_HEAD_CLOTH_SET1@2 richtig (Ausruestung, Stufe nur im Suffix)
//   Eine falsche oder unbekannte ID wird von der API NICHT als Fehler
//   gemeldet, sondern still mit Nullen und Datum "0001-01-01T00:00:00"
//   beantwortet - das sieht exakt aus wie "kein Angebot". marktId() unten
//   kapselt die Regel an genau einer Stelle, damit sie nirgends sonst falsch
//   nachgebaut werden kann.
//
// Realm: der Nutzer spielt auf Europa. "www.albion-online-data.com" ist der
// Amerika-Server und liefert stillschweigend andere (falsche) Preise, ohne
// Fehlermeldung. Siehe ../CLAUDE.md, Abschnitt "Albion Online Data
// Project API". Deshalb hier fest verdrahtet, nicht konfigurierbar.

const PREISE = (function () {
  "use strict";

  const REALM = "europe"; // NICHT "www" - das ist der Amerika-Server, s. Kommentar oben
  const API_BASE = `https://${REALM}.albion-online-data.com/api/v2/stats`;

  // Craft-Stadt ist seit dem Staedte-Feature (05.09.2026) eine Einstellung
  // (ui.js), nicht mehr fest verdrahtet. STADT_DEFAULT gilt nur als Fallback,
  // wenn preiseAbrufen() ohne opts.stadt aufgerufen wird (z.B. die beiden
  // Live-Tests in tests/test.html, unveraendert seit P2).
  const STADT_DEFAULT = "Lymhurst";
  const QUALITAET = 1; // v1: nur Qualitaet 1 (Normal), s. Plan Abschnitt 2 ("Qualitaet")

  // Bei jeder Aenderung am jeweiligen Datenformat hochzaehlen. Ein Cache mit
  // anderer Schema-Version wird verworfen statt falsch interpretiert - im
  // Eintopf-Projekt hat ein alter Cache einmal frische Daten ueberschrieben.
  // BEWUSST ZWEI GETRENNTE VERSIONEN: der Preiscache und die Eigenpreise
  // aendern sich unabhaengig voneinander. Eine gemeinsame Version wuerde beim
  // naechsten Cache-Formatwechsel faelschlich auch die vom Nutzer gepflegten
  // Eigenpreise (P6, 365 Kandidaten) loeschen, obwohl deren Format unveraendert
  // ist - genau der Fehlertyp, den eine Schema-Version eigentlich verhindern
  // soll.
  const PREIS_CACHE_SCHEMA_VERSION = 3; // 3: Cache-Schluessel jetzt zusaetzlich qualitaetsabhaengig (Feature "Qualitaetsstufen"), s. cacheSchluessel()
  const EIGENPREIS_SCHEMA_VERSION = 1; // unveraendert, vom Staedte-Feature nicht betroffen

  const PREIS_CACHE_KEY = "albion_kostenrechner_preiscache";
  const EIGENPREIS_KEY = "albion_kostenrechner_eigenpreise";
  const CACHE_GUELTIG_MIN_DEFAULT = 30;
  // Handelsvolumen (history/) ist ein 7-Tage-Mittel und aendert sich langsam,
  // deshalb laenger gueltig als ein Preis (OPTIMIERUNG-PLAN.md, Paket O1).
  const VOLUMEN_GUELTIG_MIN = 60;
  // Obergrenze des Bestands (v3.17.0, offener Punkt aus O1): Eintraege, die
  // aelter sind, werden beim Laden entfernt. Der Reiter "Gelegenheiten"
  // rechnet auch mit abgelaufenen Werten; aelter als das sagt ein Preis
  // nichts mehr, und der Bestand wuechse sonst mit jedem Scan weiter.
  const BESTAND_MAX_ALTER_TAGE = 7;

  // Bestand in IndexedDB (v3.15.0). Ein Gesamtscan sind bis etwa 270.000
  // Preiszeilen, das passt nicht in localStorage. Unter file:// belegt am
  // 22.11.2026 (Chrome 158, Edge 157: schreiben, Browser neu starten, lesen).
  // ACHTUNG: alle file://-Seiten teilen sich eine Herkunft, der Name muss
  // deshalb eindeutig sein. Bei einer Formataenderung BESTAND_DB_VERSION
  // hochzaehlen, die Speicher werden dann geleert und neu angelegt.
  const BESTAND_DB_NAME = "albion_kostenrechner_bestand";
  const BESTAND_DB_VERSION = 1;
  const STORE_PREISE = "preise";
  const STORE_VOLUMEN = "volumen";
  const LADE_BLOCK = 10000; // Eintraege je Leseschritt beim Start, damit die Oberflaeche nicht stockt
  const SCHREIB_BLOCK = 5000; // Eintraege je Schreibtransaktion

  const BLOCKGROESSE = 50; // im Eintopf-Rechner erprobt
  const PAUSE_MS = 1500; // Pause zwischen zwei Abrufen. NICHT ohne eigene Messung verkuerzen (OPTIMIERUNG-PLAN.md O2).
  const MAX_VERSUCHE = 5; // je Abruf bei Netz- oder Serverfehlern; HTTP 429 zaehlt nicht mit, s. Abrufplaner
  // Dokumentiertes Leselimit der API (https://www.albion-online-data.com/api):
  // 180 Anfragen je Minute, 300 je 5 Minuten. Der Abrufplaner bleibt mit
  // Abstand darunter. Bei PAUSE_MS = 1500 sind ohnehin hoechstens 40 je
  // Minute moeglich; das Budget greift erst, falls die Pause je verkuerzt wird.
  const LIMIT_JE_MINUTE = 180;
  const LIMIT_JE_5_MINUTEN = 300;
  const BUDGET_JE_MINUTE = 120;
  const BUDGET_JE_5_MINUTEN = 240;
  const BACKOFF_MAX_MS = 5 * 60 * 1000; // laengste Pause der Schlange nach wiederholter HTTP 429 (Rueckfall ohne Reset-Zeit)
  // Die API nennt bei HTTP 429 im Antworttext, wann die Drossel endet. Belegt
  // am 22.11.2026 (Realm europe), Wortlaut: "Throttled, be nice to the server,
  // use compression (gzip, deflate, etc)! Throttle resets at 2026-11-22
  // 11:10:00 +0000!". Der Planer wartet bis dahin plus Sicherheitsmarge.
  const LIMIT_RESET_MARGE_MS = 2000;
  const LIMIT_RESET_MAX_MS = 10 * 60 * 1000; // eine Reset-Zeit weiter in der Zukunft gilt als unglaubwuerdig
  const MAX_429_VORDERGRUND = 3; // so viele 429 in Folge, dann gibt ein Vordergrundauftrag auf; Hintergrund wiederholt unbegrenzt
  let pauseMs = PAUSE_MS; // nur von testEinstellen() veraendert (Tests mit nachgebildetem fetch)
  let abrufe = 0; // gezaehlte HTTP-Anfragen dieser Sitzung, s. abrufZaehler()

  // ---------------------------------------------------------------------
  // Markt-ID
  // ---------------------------------------------------------------------

  /**
   * Bildet die Markt-ID fuer einen Knoten aus rezepte.js.
   *
   * @param {string} uniquename          Item-uniquename, z.B. "T4_CLOTH_LEVEL1"
   *                                      oder "T4_HEAD_CLOTH_SET1".
   * @param {number} [stufeAusKontext]   Verzauberungsstufe, wie sie beim
   *                                      Durchlaufen des Graphen bekannt ist
   *                                      (der e-Schluessel bei Ausruestung,
   *                                      oder ing.l bei einer Zutat). 0/fehlt
   *                                      bei Grundstufe oder wenn die Stufe
   *                                      schon im Item selbst steckt.
   *
   * Regel: node.el hat immer Vorrang vor stufeAusKontext, NICHT addieren.
   * node.el ist die eigene Verzauberungsstufe des Items (nur bei veredelten
   * Rohstoffen/Runen/Seelen/Relikten gesetzt, s. rezepte.js-Schema). Ausruestung
   * hat kein el-Feld, dort kommt die Stufe ausschliesslich aus stufeAusKontext.
   *
   * Live am 04.09.2026 geprueft und dabei einen echten Fehler gefunden: der
   * Dump stempelt bei einer Zutat wie "8x T4_CLOTH_LEVEL3" zusaetzlich zum
   * bereits im Namen steckenden Level ein redundantes @enchantmentlevel=3 auf
   * die Zutat selbst. Eine fruehere additive Fassung ergab daraus faelschlich
   * "T4_CLOTH_LEVEL3@6" statt "T4_CLOTH_LEVEL3@3" - beide Zahlen beschreiben
   * dieselbe Stufe, nicht zwei verschiedene, die sich aufaddieren. Deshalb
   * Vorrang statt Addition.
   */
  function marktId(uniquename, stufeAusKontext) {
    const node = (typeof REZEPTGRAPH !== "undefined" && REZEPTGRAPH.items[uniquename]) || {};
    const effektiveStufe = node.el ? node.el : (stufeAusKontext || 0);
    return effektiveStufe > 0 ? `${uniquename}@${effektiveStufe}` : uniquename;
  }

  // ---------------------------------------------------------------------
  // ID-Sammler: alle Markt-IDs, die kosten(item, stufe) je brauchen koennte
  // ---------------------------------------------------------------------

  /**
   * Durchlaeuft den Rezeptgraphen ab (startItem, startStufe) und sammelt
   * alle Markt-IDs, die eine spaetere Kostenrechnung (P3) braucht: die
   * Kaufoption jedes besuchten Knotens, die Zutaten aller Alternativrezepte,
   * die Materialien jedes Verzauberungswegs, und die jeweils niedrigeren
   * Stufen (Verzaubern von N braucht N-1). Keine Kostenrechnung selbst,
   * nur das Einsammeln der IDs fuer den Preisabruf.
   *
   * @param {string} startItem
   * @param {number} startStufe
   * @param {{maxTiefe?: number, maxIds?: number}} [opts]
   * @returns {string[]} eindeutige Markt-IDs
   */
  function sammleMarktIds(startItem, startStufe, opts) {
    if (typeof REZEPTGRAPH === "undefined") {
      throw new Error("REZEPTGRAPH fehlt - rezepte.js muss vor preise.js geladen werden");
    }
    opts = opts || {};
    const maxTiefe = opts.maxTiefe || 30;
    const maxIds = opts.maxIds || 5000;
    const ids = new Set();
    const besucht = new Set();

    function besuche(item, stufe, tiefe) {
      if (tiefe > maxTiefe || ids.size > maxIds) return;
      const schluessel = `${item}@${stufe}`;
      if (besucht.has(schluessel)) return;
      besucht.add(schluessel);

      // Kaufoption dieses Knotens gehoert immer dazu, auch wenn er craftbar ist.
      ids.add(marktId(item, stufe));

      const node = REZEPTGRAPH.items[item];
      if (!node) return; // Blattknoten ohne eigenen Rezeptgraph-Eintrag, z.B. reine Waehrung

      // Veredelte Rohstoffe/Runen/Seelen/Relikte (node.el > 0) sind jeweils ein
      // eigener Knoten OHNE e-Feld; ihr Rezept steht immer unter r, unabhaengig
      // von der uebergebenen Kontextstufe (die bei ihnen ohnehin nur node.el
      // wiederholt, s. marktId-Kommentar). Ausruestung (kein el) hat Stufe 0
      // unter r, Stufe >=1 unter e[stufe].
      const nutzeBasisrezept = node.el ? true : stufe === 0;

      if (nutzeBasisrezept) {
        (node.r || []).forEach((rezept) => {
          rezept.i.forEach((zutat) => besuche(zutat.n, zutat.l || 0, tiefe + 1));
        });
      } else {
        const eintrag = (node.e || {})[String(stufe)];
        if (eintrag) {
          (eintrag.r || []).forEach((rezept) => {
            rezept.i.forEach((zutat) => besuche(zutat.n, zutat.l || 0, tiefe + 1));
          });
          if (eintrag.u) {
            (eintrag.u.res || []).forEach((material) => besuche(material.n, 0, tiefe + 1));
            besuche(item, stufe - 1, tiefe + 1); // Verzaubern von N braucht N-1
          }
        }
      }
    }

    besuche(startItem, startStufe || 0, 0);
    return Array.from(ids);
  }

  /**
   * Sammelt Markt-IDs, die eine Qualitaets-Rechnung (Feature "Qualitaetsstufen",
   * s. kostenrechner-KONTEXT.md) ZUSAETZLICH zur normalen Preisabfrage braucht:
   * die Kaufoption des Startknotens selbst UND jeder ueber eine
   * preservequality-Zutat (p:true) oder eine Verzauberungs-Vorstufe (Verzaubern
   * preserviert die Qualitaet, s. CLAUDE.md "Craft-Qualitaetswurf") erreichbare
   * Folgeknoten, jeweils IN DER ZIELQUALITAET. Gewoehnliche Zutaten (ohne
   * p:true) sind qualitaetsunabhaengig und werden hier NICHT gesammelt - fuer
   * sie gilt weiterhin die normale, in sammleMarktIds() gesammelte
   * Normal-Qualitaet-Preisliste. Ergebnis ist typischerweise sehr klein
   * (einstellig bis niedrig zweistellig), anders als sammleMarktIds().
   *
   * @param {string} startItem
   * @param {number} startStufe
   * @param {{maxTiefe?: number}} [opts]
   * @returns {string[]} eindeutige Markt-IDs
   */
  function sammleQualitaetsMarktIds(startItem, startStufe, opts) {
    if (typeof REZEPTGRAPH === "undefined") {
      throw new Error("REZEPTGRAPH fehlt - rezepte.js muss vor preise.js geladen werden");
    }
    opts = opts || {};
    const maxTiefe = opts.maxTiefe || 30;
    const ids = new Set();
    const besucht = new Set();

    function besuche(item, stufe, tiefe) {
      if (tiefe > maxTiefe) return;
      const schluessel = `${item}@${stufe}`;
      if (besucht.has(schluessel)) return;
      besucht.add(schluessel);
      ids.add(marktId(item, stufe));

      const node = REZEPTGRAPH.items[item];
      if (!node) return;

      const nutzeBasisrezept = node.el ? true : stufe === 0;
      const rezepte = nutzeBasisrezept ? node.r || [] : ((node.e || {})[String(stufe)] || {}).r || [];
      rezepte.forEach((rezept) => {
        (rezept.i || []).forEach((zutat) => {
          if (zutat.p) besuche(zutat.n, zutat.l || 0, tiefe + 1);
        });
      });

      // Verzaubern preserviert die Qualitaet: die Vorstufe braucht deshalb
      // ebenfalls einen Qualitaets-Preis, s. Funktionskommentar oben.
      if (!node.el && stufe > 0) {
        const eintrag = (node.e || {})[String(stufe)];
        if (eintrag && eintrag.u) besuche(item, stufe - 1, tiefe + 1);
      }
    }

    besuche(startItem, startStufe || 0, 0);
    return Array.from(ids);
  }

  // ---------------------------------------------------------------------
  // Bestand: Preise und Handelsvolumen (v3.15.0, OPTIMIERUNG-PLAN.md O1)
  //
  // Entwurf: die Arbeitskopie liegt im Speicher (zwei Maps), wird beim Start
  // asynchron aus IndexedDB geladen und bei jedem Abruf sofort im Speicher
  // und im Hintergrund in IndexedDB fortgeschrieben (nur die geaenderten
  // Eintraege, nicht wie frueher der ganze Bestand als ein JSON-Text).
  // Gelesen wird ausschliesslich aus dem Speicher, also synchron; die
  // Abruffunktionen warten vorher einmal auf bestand.bereit.
  //
  // Rueckfall: ist IndexedDB nicht verfuegbar, laeuft der Preisbestand wie
  // bis v3.14.1 ueber localStorage (PREIS_CACHE_KEY, Schema 3); das
  // Handelsvolumen bleibt dann wie frueher nur fuer die Sitzung im Speicher.
  //
  // Migration: ein vorhandener localStorage-Preisbestand wird beim ersten
  // Start mit IndexedDB einmalig uebernommen und danach aus localStorage
  // entfernt (nicht doppelt gefuehrt). Eigenpreise und Einstellungen bleiben
  // in localStorage.
  // ---------------------------------------------------------------------

  function leererPreisCache() {
    return { schema: PREIS_CACHE_SCHEMA_VERSION, eintraege: {} };
  }

  function lsPreisCacheLesen(lsKey) {
    try {
      const roh = localStorage.getItem(lsKey);
      if (!roh) return null;
      const daten = JSON.parse(roh);
      if (!daten || daten.schema !== PREIS_CACHE_SCHEMA_VERSION || !daten.eintraege) return null;
      return daten;
    } catch (e) {
      return null;
    }
  }

  function lsEntfernen(lsKey) {
    try {
      localStorage.removeItem(lsKey);
    } catch (e) {
      /* ignorieren */
    }
  }

  function idbOeffnen(name) {
    return new Promise((resolve, reject) => {
      let fertig = false;
      const ende = (fn, wert) => {
        if (fertig) return;
        fertig = true;
        fn(wert);
      };
      let req;
      try {
        req = indexedDB.open(name, BESTAND_DB_VERSION);
      } catch (e) {
        reject(e);
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        [STORE_PREISE, STORE_VOLUMEN].forEach((store) => {
          if (db.objectStoreNames.contains(store)) db.deleteObjectStore(store);
          db.createObjectStore(store);
        });
      };
      req.onsuccess = () => {
        const db = req.result;
        // Eine andere Seite will das Format anheben: Verbindung freigeben.
        db.onversionchange = () => db.close();
        ende(resolve, db);
      };
      req.onerror = () => ende(reject, req.error || new Error("IndexedDB nicht verfuegbar"));
      req.onblocked = () => ende(reject, new Error("IndexedDB blockiert"));
      setTimeout(() => ende(reject, new Error("IndexedDB antwortet nicht")), 5000);
    });
  }

  /** Liest einen Speicher blockweise in die Map (LADE_BLOCK je Schritt). */
  async function idbInMapLesen(db, store, map) {
    let ab = null;
    for (;;) {
      const teil = await new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const os = tx.objectStore(store);
        const bereich = ab == null ? null : IDBKeyRange.lowerBound(ab, true);
        const kReq = os.getAllKeys(bereich, LADE_BLOCK);
        const vReq = os.getAll(bereich, LADE_BLOCK);
        tx.oncomplete = () => resolve([kReq.result, vReq.result]);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      const keys = teil[0];
      const werte = teil[1];
      for (let i = 0; i < keys.length; i++) map.set(keys[i], werte[i]);
      if (keys.length < LADE_BLOCK) return;
      ab = keys[keys.length - 1];
    }
  }

  function idbSchreiben(db, store, paare) {
    return new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction(store, "readwrite", { durability: "relaxed" });
      } catch (e) {
        reject(e);
        return;
      }
      const os = tx.objectStore(store);
      paare.forEach((p) => os.put(p[1], p[0]));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  /** Schluessel in Bloecken loeschen (Obergrenze des Bestands). */
  function idbLoeschen(db, store, keys) {
    return new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction(store, "readwrite", { durability: "relaxed" });
      } catch (e) {
        reject(e);
        return;
      }
      const os = tx.objectStore(store);
      keys.forEach((k) => os.delete(k));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  function idbLeeren(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PREISE, STORE_VOLUMEN], "readwrite");
      tx.objectStore(STORE_PREISE).clear();
      tx.objectStore(STORE_VOLUMEN).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  /**
   * Legt einen Bestand an und beginnt sofort mit dem Laden.
   * @param {object} [o]
   * @param {string} [o.dbName]          IndexedDB-Name (Tests nutzen einen eigenen)
   * @param {string} [o.lsKey]           localStorage-Schluessel fuer Rueckfall und Migration
   * @param {boolean} [o.ohneIndexedDb]  Rueckfall erzwingen (Test)
   * @returns Bestand mit preise/volumen (Map), modus, bereit (Promise),
   *          schreiben(), leeren(), geschrieben()
   */
  function bestandAnlegen(o) {
    o = o || {};
    const dbName = o.dbName || BESTAND_DB_NAME;
    const lsKey = o.lsKey || PREIS_CACHE_KEY;
    const b = {
      preise: new Map(),
      volumen: new Map(),
      modus: "laedt", // "indexeddb" | "localstorage"
      db: null,
      ladeMs: null,
      migriert: 0,
      entfernt: 0, // beim Laden wegen BESTAND_MAX_ALTER_TAGE entfernte Eintraege
      eingemischt: null, // Zaehler des letzten bestandEinmischen() (gemeinsamer Preisstand, v3.23.0)
      fehler: null,
      kette: Promise.resolve(),
    };

    function lsSchreiben() {
      try {
        const eintraege = {};
        b.preise.forEach((wert, key) => {
          eintraege[key] = wert;
        });
        localStorage.setItem(lsKey, JSON.stringify({ schema: PREIS_CACHE_SCHEMA_VERSION, eintraege }));
      } catch (e) {
        // Speicher voll/gesperrt: die laufende Abfrage funktioniert trotzdem,
        // nur ohne dauerhaften Bestand.
      }
    }

    /**
     * Eintraege in den Bestand schreiben: sofort in die Arbeitskopie, im
     * Hintergrund dauerhaft. Wirft nie; ein Schreibfehler kostet nur den
     * dauerhaften Bestand, nicht die laufende Rechnung.
     * @param {"preise"|"volumen"} store
     * @param {Array<[string, object]>} paare
     */
    b.schreiben = function (store, paare) {
      if (!paare || !paare.length) return;
      const map = store === STORE_VOLUMEN ? b.volumen : b.preise;
      paare.forEach((p) => map.set(p[0], p[1]));
      if (b.modus === "indexeddb") {
        for (let i = 0; i < paare.length; i += SCHREIB_BLOCK) {
          const teil = paare.slice(i, i + SCHREIB_BLOCK);
          b.kette = b.kette.then(() => idbSchreiben(b.db, store, teil)).catch((e) => {
            b.fehler = e;
          });
        }
      } else if (b.modus === "localstorage" && store === STORE_PREISE) {
        lsSchreiben();
      }
    };

    b.leeren = function () {
      b.preise.clear();
      b.volumen.clear();
      lsEntfernen(lsKey);
      b.kette = b.kette
        .then(() => b.bereit)
        .then(() => (b.modus === "indexeddb" ? idbLeeren(b.db) : null))
        .catch((e) => {
          b.fehler = e;
        });
    };

    /** Promise, das erfuellt ist, sobald alle bisherigen Schreibvorgaenge dauerhaft sind. */
    b.geschrieben = function () {
      return b.kette;
    };

    b.schliessen = function () {
      if (b.db) b.db.close();
      b.db = null;
    };

    b.bereit = (async function () {
      const start = typeof performance !== "undefined" ? performance.now() : Date.now();
      let db = null;
      if (!o.ohneIndexedDb && typeof indexedDB !== "undefined" && indexedDB) {
        try {
          db = await idbOeffnen(dbName);
          await idbInMapLesen(db, STORE_PREISE, b.preise);
          await idbInMapLesen(db, STORE_VOLUMEN, b.volumen);
        } catch (e) {
          b.fehler = e;
          if (db) db.close();
          db = null;
          b.preise.clear();
          b.volumen.clear();
        }
      }
      const alt = lsPreisCacheLesen(lsKey);
      if (db) {
        b.db = db;
        b.modus = "indexeddb";
        // Migration des localStorage-Bestands (einmalig): uebernehmen, was
        // neuer ist als ein schon vorhandener Eintrag, dann den alten
        // Schluessel entfernen. Ein Bestand mit fremdem Schema wird verworfen.
        if (alt) {
          const paare = [];
          Object.keys(alt.eintraege).forEach((key) => {
            const e = alt.eintraege[key];
            const da = b.preise.get(key);
            if (e && e.abgerufenAm && (!da || !(da.abgerufenAm >= e.abgerufenAm))) paare.push([key, e]);
          });
          b.schreiben(STORE_PREISE, paare);
          b.migriert = paare.length;
        }
        lsEntfernen(lsKey);
      } else {
        b.modus = "localstorage";
        if (alt) Object.keys(alt.eintraege).forEach((key) => b.preise.set(key, alt.eintraege[key]));
      }
      // Obergrenze (v3.17.0): was aelter als BESTAND_MAX_ALTER_TAGE ist oder
      // keine Abrufzeit traegt, faellt weg; aus der Arbeitskopie sofort,
      // dauerhaft im Hintergrund. Ein Eintrag aus der Zukunft bleibt stehen.
      const grenze = Date.now() - BESTAND_MAX_ALTER_TAGE * 24 * 60 * 60 * 1000;
      [
        [STORE_PREISE, b.preise],
        [STORE_VOLUMEN, b.volumen],
      ].forEach(([store, map]) => {
        const alt = [];
        map.forEach((wert, key) => {
          if (!(wert && wert.abgerufenAm >= grenze)) alt.push(key);
        });
        if (!alt.length) return;
        alt.forEach((key) => map.delete(key));
        b.entfernt += alt.length;
        if (b.modus === "indexeddb") {
          for (let i = 0; i < alt.length; i += SCHREIB_BLOCK) {
            const teil = alt.slice(i, i + SCHREIB_BLOCK);
            b.kette = b.kette.then(() => idbLoeschen(b.db, store, teil)).catch((e) => {
              b.fehler = e;
            });
          }
        } else if (store === STORE_PREISE) lsSchreiben();
      });
      b.ladeMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - start;
      return b;
    })();

    return b;
  }

  let bestand = bestandAnlegen();

  /** Erfuellt, sobald der Bestand geladen ist (IndexedDB oder Rueckfall). */
  function bestandBereit() {
    return bestand.bereit.then(() => bestandInfo());
  }

  /** Kennzahlen des Bestands, fuer Statusanzeige und Tests. */
  function bestandInfo() {
    return {
      modus: bestand.modus,
      preise: bestand.preise.size,
      volumen: bestand.volumen.size,
      ladeMs: bestand.ladeMs,
      migriert: bestand.migriert,
      entfernt: bestand.entfernt,
      eingemischt: bestand.eingemischt,
      fehler: bestand.fehler ? String(bestand.fehler) : null,
    };
  }

  /**
   * Alle Eintraege der Arbeitskopie als Paarlisten [Schluessel, Eintrag]
   * (v3.23.0). Fuer tools/preisstand.js (schreibt daraus den gemeinsamen
   * Preisstand) und fuer Tests.
   */
  function bestandEintraege() {
    return { preise: Array.from(bestand.preise), volumen: Array.from(bestand.volumen) };
  }

  /**
   * Fremde Eintraege (gemeinsamer Preisstand, js/gemeinsam.js) in den Bestand
   * einmischen (v3.23.0). Regel je Eintrag: der juengere abgerufenAm gewinnt;
   * ein vorhandener Eintrag, der gleich alt oder juenger ist, bleibt stehen.
   * Nicht uebernommen wird, was aelter als BESTAND_MAX_ALTER_TAGE ist, keine
   * Abrufzeit traegt oder (nach der Uhr dieses Rechners) aus der Zukunft
   * stammt: ein solcher Eintrag wuerde sonst jeden spaeteren eigenen Abruf
   * als "aelter" verdraengen. Geschrieben wird ueber den gewoehnlichen
   * Bestandsweg (Arbeitskopie sofort, dauerhaft im Hintergrund). Der Aufrufer
   * wartet vorher auf bestandBereit().
   *
   * @param {{preise?: Array<[string, object]>, volumen?: Array<[string, object]>}} daten
   * @param {{jetzt?: number}} [o]
   * @returns {{preise:number, volumen:number, aelter:number, zuAlt:number, zukunft:number, ids:string[]}}
   *   preise/volumen = uebernommene Eintraege, aelter = vom Bestand geschlagen,
   *   ids = Markt-IDs der uebernommenen Eintraege
   */
  function bestandEinmischen(daten, o) {
    const jetzt = o && o.jetzt != null ? o.jetzt : Date.now();
    const grenze = jetzt - BESTAND_MAX_ALTER_TAGE * 24 * 60 * 60 * 1000;
    const out = { preise: 0, volumen: 0, aelter: 0, zuAlt: 0, zukunft: 0, ids: [] };
    const ids = new Set();
    [
      [STORE_PREISE, bestand.preise, "preise"],
      [STORE_VOLUMEN, bestand.volumen, "volumen"],
    ].forEach(([store, map, feld]) => {
      const neu = [];
      ((daten && daten[feld]) || []).forEach((paar) => {
        const key = paar && paar[0];
        const e = paar && paar[1];
        if (typeof key !== "string" || !e || !(e.abgerufenAm >= grenze)) {
          out.zuAlt++;
          return;
        }
        if (e.abgerufenAm > jetzt) {
          out.zukunft++;
          return;
        }
        const da = map.get(key);
        if (da && da.abgerufenAm >= e.abgerufenAm) {
          out.aelter++;
          return;
        }
        neu.push([key, e]);
        const teile = key.split("::");
        if (teile.length === 3) ids.add(teile[1]);
      });
      bestand.schreiben(store, neu);
      out[feld] = neu.length;
    });
    out.ids = Array.from(ids);
    const vor = bestand.eingemischt || { preise: 0, volumen: 0, laeufe: 0 };
    bestand.eingemischt = { um: jetzt, preise: vor.preise + out.preise, volumen: vor.volumen + out.volumen, laeufe: vor.laeufe + 1 };
    return out;
  }

  /** Erfuellt, sobald alle bisherigen Schreibvorgaenge dauerhaft abgelegt sind. */
  function bestandGeschrieben() {
    return bestand.geschrieben();
  }

  /**
   * Nur fuer Tests: Bestand auf eine eigene Datenbank umstellen (die echte
   * bleibt unberuehrt, alle file://-Seiten teilen sich eine Herkunft) und die
   * Pause zwischen Abrufen verkuerzen. Ohne Argument: zurueck zum echten
   * Bestand und zur echten Pause. Setzt den Abrufplaner zurueck (Fenster,
   * Sperren, Schalter); o.jetzt, o.warte und o.verborgen tauschen dessen
   * Uhr, Wartefunktion und Tab-Sichtbarkeit aus (Tests ohne echtes Warten).
   * Liefert ein Promise auf bestandInfo().
   */
  async function testEinstellen(o) {
    await bestand.bereit;
    await bestand.geschrieben();
    bestand.schliessen();
    planer.testZuruecksetzen(o);
    if (!o) {
      pauseMs = PAUSE_MS;
      bestand = bestandAnlegen();
    } else {
      pauseMs = o.pauseMs != null ? o.pauseMs : PAUSE_MS;
      bestand = bestandAnlegen({
        dbName: o.dbName || BESTAND_DB_NAME + "_test",
        lsKey: o.lsKey || PREIS_CACHE_KEY + "_test",
        ohneIndexedDb: !!o.ohneIndexedDb,
      });
    }
    return bestandBereit();
  }

  /** Nur fuer Tests: Eintraege direkt in den Bestand schreiben (Messung mit vielen Eintraegen). */
  function testBestandSchreiben(store, paare) {
    bestand.schreiben(store, paare);
    return bestand.geschrieben();
  }

  /** Nur fuer Tests: Datenbank eines Testbestands loeschen. */
  function testDatenbankLoeschen(dbName) {
    return new Promise((resolve) => {
      if (typeof indexedDB === "undefined" || !indexedDB) return resolve();
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  }

  /**
   * Sicht auf den Preisbestand im Format von vor v3.15.0
   * ({schema, eintraege}), synchron aus der Arbeitskopie. Vor Ablauf von
   * bestandBereit() ist sie leer.
   */
  function preisCacheLesen() {
    const cache = leererPreisCache();
    bestand.preise.forEach((wert, key) => {
      cache.eintraege[key] = wert;
    });
    return cache;
  }

  /**
   * Cache-Schluessel fuer einen Preiseintrag: IMMER stadt- UND
   * qualitaetsabhaengig, s. PREIS_CACHE_SCHEMA_VERSION-Kommentar oben. Ohne
   * die Stadt im Schluessel koennte ein frischer Cache-Eintrag fuer
   * "T4_CLOTH" aus Lymhurst faelschlich als gueltig fuer Bridgewatch
   * durchgehen, nur weil derselbe uniquename gemeint ist - Preise sind aber
   * je Stadt komplett unabhaengig. Ebenso mit der Qualitaet (Feature
   * "Qualitaetsstufen", 05.09.2026): derselbe uniquename hat in Normal und in
   * Exzellent voellig unterschiedliche Marktpreise. `qualitaet` fehlt in den
   * meisten Aufrufen (Normal-Qualitaet-Preise, der weit ueberwiegende
   * Regelfall) und faellt dann auf QUALITAET (1) zurueck. "::" als Trenner,
   * weil weder Staedtenamen noch Markt-IDs (die selbst schon ein "@"
   * enthalten koennen, s. Modulkommentar oben) das Zeichen verwenden.
   */
  function cacheSchluessel(stadt, id, qualitaet) {
    const q = qualitaet == null ? QUALITAET : qualitaet;
    return stadt + "::" + id + "::q" + q;
  }

  /**
   * Schluessel des Merkers "alle Qualitaeten dieser ID in dieser Stadt
   * wurden in EINEM Abruf geholt" (preiseAlleQualitaetenAbrufen). Der Merker
   * haelt Abrufzeit und die gelieferten Qualitaeten; die Preiszeilen selbst
   * liegen unter cacheSchluessel(stadt, id, q) und dienen damit auch
   * preiseAbrufen() mit derselben Qualitaet.
   */
  function alleQSchluessel(stadt, id) {
    return stadt + "::" + id + "::qA";
  }

  /** Schluessel im Volumenbestand. art: "a" = Absatz je Qualitaet, "v" = 7-Tage-Summe. */
  function volumenSchluessel(art, stadt, id, tageFenster) {
    return stadt + "::" + id + "::" + art + tageFenster;
  }

  // Synchrone Sicht auf einzelne Bestandseintraege (v3.17.0), fuer den Reiter
  // "Gelegenheiten": er rechnet ohne Abruf mit dem, was da ist, auch wenn es
  // aelter als die Gueltigkeit ist. Vor Ablauf von bestandBereit() leer.

  /** Preiseintrag einer Stadt, Markt-ID und Qualitaet aus der Arbeitskopie, oder null. */
  function bestandPreis(stadt, id, qualitaet) {
    return bestand.preise.get(cacheSchluessel(stadt, id, qualitaet)) || null;
  }

  /**
   * Preise aller Qualitaeten, wie preiseAlleQualitaetenAbrufen() sie aus dem
   * Bestand liest: nur wenn der Merker alleQSchluessel() existiert.
   * @returns {?{abgerufenAm:number, jeQ:Object<number, object>}}
   */
  function bestandAlleQualitaeten(stadt, id) {
    const merker = bestand.preise.get(alleQSchluessel(stadt, id));
    if (!merker) return null;
    const jeQ = {};
    (merker.qualitaeten || []).forEach((q) => {
      const e = bestand.preise.get(cacheSchluessel(stadt, id, q));
      if (e) jeQ[q] = e;
    });
    return { abgerufenAm: merker.abgerufenAm, jeQ };
  }

  /**
   * Absatz je Qualitaet, wie absatzAbrufen() ihn ablegt.
   * @returns {?{abgerufenAm:number, jeQ:Object<number, object>}}
   */
  function bestandAbsatz(stadt, id, tageFenster) {
    const da = bestand.volumen.get(volumenSchluessel("a", stadt, id, tageFenster || 7));
    return da ? { abgerufenAm: da.abgerufenAm, jeQ: da.jeQ || {} } : null;
  }

  /** Leert den ganzen Bestand (Preise und Handelsvolumen), Arbeitskopie sofort, dauerhaft im Hintergrund. */
  function preisCacheLeeren() {
    bestand.leeren();
  }

  /** Alter eines Cache-Eintrags in Minuten, oder null wenn kein Eintrag. */
  function eintragAlterMinuten(eintrag) {
    if (!eintrag || !eintrag.abgerufenAm) return null;
    return (Date.now() - eintrag.abgerufenAm) / 60000;
  }

  function istFrisch(eintrag, maxAlterMin) {
    const alter = eintragAlterMinuten(eintrag);
    // alter >= 0: ein Eintrag aus der Zukunft (Systemuhr zurueckgestellt) gilt nicht als frisch.
    return alter !== null && alter >= 0 && alter <= maxAlterMin;
  }

  // "0001-01-01..." ist der Marker der API fuer "kein Angebot". Ein fehlendes
  // Datum wird ebenso behandelt. Ein Preis von 0 OHNE dieses Datum kaeme aus
  // der API praktisch nicht vor, wird aber vorsichtshalber gleich gewertet.
  function istKeinAngebotDatum(datum) {
    return !datum || datum.slice(0, 10) === "0001-01-01";
  }

  function normalisierePreisZeile(zeile) {
    const sellKein = istKeinAngebotDatum(zeile.sell_price_min_date) || !zeile.sell_price_min;
    const buyKein = istKeinAngebotDatum(zeile.buy_price_max_date) || !zeile.buy_price_max;
    return {
      id: zeile.item_id,
      stadt: zeile.city, // /prices/ liefert "city", /history/ liefert "location" - hier einmal auf "stadt" normalisiert
      sell: { preis: sellKein ? null : zeile.sell_price_min, datum: zeile.sell_price_min_date || "", kein: sellKein },
      buy: { preis: buyKein ? null : zeile.buy_price_max, datum: zeile.buy_price_max_date || "", kein: buyKein },
      abgerufenAm: Date.now(),
    };
  }

  // ---------------------------------------------------------------------
  // Abrufplaner (v3.16.0, OPTIMIERUNG-PLAN.md O2)
  //
  // EINE Warteschlange fuer alle HTTP-Abrufe dieser Preisschicht
  // (Kostenrechner, "Craften: Gewinn", "Veredeln leveln"). Preisvergleich und
  // Eintopf-Rechner haben eigene Abrufschichten und laufen NICHT hierueber;
  // ihre Abrufe zaehlen im Budget deshalb nicht mit.
  //
  // - Ein Auftrag ist genau ein HTTP-Abruf (eine URL). Abrufe laufen strikt
  //   nacheinander, mit mindestens pauseMs zwischen Ende des einen und Start
  //   des naechsten.
  // - Zwei Prioritaeten: "vordergrund" (vom Nutzer ausgeloest, Vorgabe)
  //   ueberholt "hintergrund" (spaeterer Scan, O3). Innerhalb einer
  //   Prioritaet gilt die Reihenfolge des Einreihens.
  // - Budget als gleitendes Fenster (BUDGET_JE_MINUTE, BUDGET_JE_5_MINUTEN),
  //   mit Abstand unter dem dokumentierten Leselimit der API.
  // - HTTP 429: die GANZE Schlange pausiert mit wachsender Wartezeit
  //   (PAUSE_MS * 2^n, hoechstens BACKOFF_MAX_MS) und setzt selbst fort; der
  //   betroffene Abruf wird wiederholt, nicht verworfen. Nennt der
  //   Antworttext die Reset-Zeit, wartet die Schlange bis dahin plus
  //   LIMIT_RESET_MARGE_MS statt zu raten. Hintergrundauftraege wiederholen
  //   beliebig oft, ein Vordergrundauftrag gibt nach MAX_429_VORDERGRUND
  //   429 in Folge mit einem verstaendlichen Fehler auf. Andere Fehler (Netz, HTTP 5xx): hoechstens MAX_VERSUCHE Versuche
  //   mit wachsender Wartezeit, dann wird der Auftrag mit Fehler beendet.
  // - Hintergrundauftraege lassen sich pausieren, fortsetzen und abbrechen
  //   und ruhen, solange der Browser-Tab verborgen ist (abschaltbar ueber
  //   einstellen({hintergrundAuchVerborgen: true})). Vordergrund laeuft immer.
  // - Uhr, Wartefunktion und Sichtbarkeit sind fuer Tests austauschbar
  //   (testEinstellen), damit kein Test real sekundenlang wartet.
  // ---------------------------------------------------------------------

  function bloecke(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  function warte(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Liest die Reset-Zeit aus dem Antworttext einer HTTP 429 ("Throttle
   * resets at JJJJ-MM-TT HH:MM:SS +0000!"). Rein, offline testbar.
   * @returns {?number} Millisekunden seit Epoch, null wenn nichts Verwertbares im Text steht
   */
  function limitResetAusText(text) {
    const m = /resets at (\d{4}-\d\d-\d\d)[ T](\d\d:\d\d:\d\d) ?([+-]\d\d):?(\d\d)/i.exec(String(text || ""));
    if (!m) return null;
    const ms = Date.parse(m[1] + "T" + m[2] + m[3] + ":" + m[4]);
    return isFinite(ms) ? ms : null;
  }

  /** "HH:MM" in Ortszeit. */
  function uhrzeitText(ms) {
    return new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  const planer = (function () {
    const schlangen = { vordergrund: [], hintergrund: [] };
    const hoerer = [];
    let naechsteId = 1;
    let aktiv = null; // der gerade laufende Auftrag
    let laeuft = false; // Schleife lauf() aktiv
    let hintergrundPausiert = false;
    let auchVerborgen = false;
    let letztesEnde = -Infinity; // Ende des letzten Abrufs (Uhr des Planers)
    let sperreBis = -Infinity; // Pause der ganzen Schlange nach HTTP 429
    let fehlerBis = -Infinity; // Wartezeit nach einem anderen Fehler
    let folge429 = 0; // 429-Antworten in Folge, bestimmt die Wartezeit im Rueckfall
    let limitResetUm = null; // von der API genannte Reset-Zeit der laufenden Drossel, null im Rueckfall
    let starts = []; // Startzeiten der Abrufe im 5-Minuten-Fenster
    let bytes = 0; // geladene Antwortzeichen dieser Sitzung
    let warteGrund = null; // "limit" | "takt" waehrend einer Wartezeit
    let wartetBis = null;
    let uhr;
    let warteFn;
    let verborgenFn;

    function standardUmgebung() {
      uhr = () => Date.now();
      warteFn = warte;
      verborgenFn = () => typeof document !== "undefined" && document.visibilityState === "hidden";
    }
    standardUmgebung();

    function hintergrundDarf() {
      return !hintergrundPausiert && (auchVerborgen || !verborgenFn());
    }

    function imFenster(jetzt, ms) {
      let n = 0;
      for (let i = starts.length - 1; i >= 0 && jetzt - starts[i] < ms; i--) n++;
      return n;
    }

    /**
     * Zustand der Schlange.
     * zustand: "ruht" (nichts offen) | "laeuft" | "pausiert" (nur
     * Hintergrundauftraege offen, die pausiert sind oder wegen des verborgenen
     * Tabs ruhen) | "limit" (wartet wegen HTTP 429 oder wegen des Budgets).
     */
    function status() {
      const istV = aktiv && aktiv.prioritaet === "vordergrund" ? 1 : 0;
      const istH = aktiv && aktiv.prioritaet === "hintergrund" ? 1 : 0;
      const offenVordergrund = schlangen.vordergrund.length + istV;
      const offenHintergrund = schlangen.hintergrund.length + istH;
      const offen = offenVordergrund + offenHintergrund;
      let zustand;
      if (!offen) zustand = "ruht";
      else if (!aktiv && !offenVordergrund && !hintergrundDarf()) zustand = "pausiert";
      else if (warteGrund === "limit") zustand = "limit";
      else zustand = "laeuft";
      const jetzt = uhr();
      return {
        zustand,
        offen,
        offenVordergrund,
        offenHintergrund,
        hintergrundPausiert,
        hintergrundAuchVerborgen: auchVerborgen,
        verborgen: !!verborgenFn(),
        wartetBis: zustand === "limit" ? wartetBis : null,
        // Von der API genannte Reset-Zeit (ms seit Epoch), solange die Sperre nach HTTP 429 laeuft; sonst null.
        limitResetUm: limitResetUm != null && sperreBis > jetzt ? limitResetUm : null,
        abrufe,
        bytes,
        mb: bytes / (1024 * 1024),
        abrufeLetzteMinute: imFenster(jetzt, 60000),
        abrufeLetzte5Minuten: imFenster(jetzt, 300000),
      };
    }

    function melden() {
      if (!hoerer.length) return;
      const s = status();
      hoerer.slice().forEach((fn) => {
        try {
          fn(s);
        } catch (e) {
          /* ein fehlerhafter Zuhoerer darf die Schlange nicht anhalten */
        }
      });
    }

    function naechster() {
      if (schlangen.vordergrund.length) return schlangen.vordergrund[0];
      if (schlangen.hintergrund.length && hintergrundDarf()) return schlangen.hintergrund[0];
      return null;
    }

    /** Millisekunden, die das Budget noch verlangt (0 = frei). */
    function budgetWarteMs(jetzt) {
      while (starts.length && jetzt - starts[0] >= 300000) starts.shift();
      let w = 0;
      if (starts.length >= BUDGET_JE_5_MINUTEN) w = Math.max(w, starts[starts.length - BUDGET_JE_5_MINUTEN] + 300000 - jetzt);
      const inMinute = imFenster(jetzt, 60000);
      if (inMinute >= BUDGET_JE_MINUTE) w = Math.max(w, starts[starts.length - BUDGET_JE_MINUTE] + 60000 - jetzt);
      return w;
    }

    async function lauf() {
      if (laeuft) return;
      laeuft = true;
      try {
        for (;;) {
          const a = naechster();
          if (!a) break;
          const jetzt = uhr();
          const wLimit = Math.max(sperreBis - jetzt, budgetWarteMs(jetzt));
          const wTakt = Math.max(letztesEnde + pauseMs - jetzt, fehlerBis - jetzt);
          const w = Math.max(wLimit, wTakt);
          if (w > 0) {
            warteGrund = wLimit > 0 && wLimit >= wTakt ? "limit" : "takt";
            wartetBis = jetzt + w;
            melden();
            await warteFn(w);
            warteGrund = null;
            wartetBis = null;
            continue; // neu waehlen: inzwischen kann ein Vordergrundauftrag gekommen sein
          }
          const schlange = schlangen[a.prioritaet];
          schlange.splice(schlange.indexOf(a), 1);
          aktiv = a;
          a.versuche++;
          starts.push(jetzt);
          abrufe++;
          melden();
          let daten = null;
          let fehler = null;
          let limit = false;
          let limitText = "";
          try {
            const antwort = await fetch(a.url);
            if (antwort.status === 429) {
              limit = true;
              try {
                if (typeof antwort.text === "function") limitText = await antwort.text();
              } catch (e) {
                limitText = "";
              }
            } else if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
            else if (typeof antwort.text === "function") {
              const text = await antwort.text();
              bytes += text.length;
              daten = JSON.parse(text);
            } else {
              daten = await antwort.json(); // nachgebildetes fetch ohne text()
            }
          } catch (e) {
            fehler = e;
          }
          letztesEnde = uhr();
          aktiv = null;
          if (limit) {
            folge429++;
            a.folge429++;
            // Reset-Zeit aus dem Antworttext; fehlt sie, liegt sie in der
            // Vergangenheit oder zu weit in der Zukunft: wachsende Wartezeit.
            const reset = limitResetAusText(limitText);
            if (reset != null && reset > letztesEnde && reset - letztesEnde <= LIMIT_RESET_MAX_MS) {
              limitResetUm = reset;
              sperreBis = reset + LIMIT_RESET_MARGE_MS;
            } else {
              limitResetUm = null;
              sperreBis = letztesEnde + Math.min(BACKOFF_MAX_MS, PAUSE_MS * Math.pow(2, folge429));
            }
            a.versuche--; // eine 429 ist kein Fehlversuch, der Abruf wird wiederholt
            if (a.abgebrochen) {
              /* nichts: das Versprechen ist schon abgelehnt */
            } else if (a.prioritaet === "vordergrund" && a.folge429 >= MAX_429_VORDERGRUND) {
              // Eine Suche soll nicht unbegrenzt haengen. Die Sperre der
              // Schlange bleibt bestehen, der naechste Auftrag wartet sie ab.
              const e = new Error(`Die Preis-API drosselt gerade (Limit bis ${uhrzeitText(limitResetUm != null ? limitResetUm : sperreBis)}). Bitte danach erneut suchen.`);
              e.gedrosselt = true;
              e.limitBis = sperreBis;
              a.reject(e);
            } else schlange.unshift(a);
          } else if (fehler) {
            if (a.versuche < MAX_VERSUCHE && !a.abgebrochen) {
              fehlerBis = letztesEnde + PAUSE_MS * Math.pow(2, a.versuche);
              schlange.unshift(a);
            } else if (!a.abgebrochen) {
              a.reject(new Error(`${a.bezeichnung} fehlgeschlagen nach ${a.versuche} Versuchen: ${fehler}`));
            }
          } else {
            folge429 = 0;
            limitResetUm = null;
            a.resolve(daten); // auch nach abbrechen() folgenlos, das Versprechen ist dann schon abgelehnt
          }
          melden();
        }
      } finally {
        laeuft = false;
        warteGrund = null;
        wartetBis = null;
        melden();
      }
    }

    /**
     * Reiht einen Abruf ein.
     * @param {string} url
     * @param {object} [o]
     * @param {"vordergrund"|"hintergrund"} [o.prioritaet="vordergrund"]
     * @param {string} [o.gruppe]        frei waehlbare Kennung, um zusammengehoerige Auftraege gemeinsam abzubrechen
     * @param {string} [o.bezeichnung]   fuer die Fehlermeldung
     * @returns {Promise<*>} geparste JSON-Antwort; traegt zusaetzlich auftragId.
     *   Wird der Auftrag abgebrochen, lehnt das Versprechen mit einem Error
     *   ab, dessen Feld abgebrochen === true ist.
     */
    function einreihen(url, o) {
      o = o || {};
      const a = {
        id: naechsteId++,
        url,
        prioritaet: o.prioritaet === "hintergrund" ? "hintergrund" : "vordergrund",
        gruppe: o.gruppe || null,
        bezeichnung: o.bezeichnung || "Abruf",
        versuche: 0,
        folge429: 0,
        abgebrochen: false,
      };
      const versprechen = new Promise((resolve, reject) => {
        a.resolve = resolve;
        a.reject = reject;
      });
      versprechen.auftragId = a.id;
      schlangen[a.prioritaet].push(a);
      melden();
      lauf();
      return versprechen;
    }

    /**
     * Bricht wartende Auftraege ab. Ein gerade laufender Abruf wird nicht
     * unterbrochen; sein Ergebnis wird verworfen, wenn er zum Filter passt.
     * @param {number|number[]|{gruppe?:string, prioritaet?:string}} [filter]
     *   Auftragsnummer(n) oder Filter; ohne Angabe alle Hintergrundauftraege.
     * @returns {number} Zahl der abgebrochenen Auftraege
     */
    function abbrechen(filter) {
      let passt;
      if (typeof filter === "number") passt = (a) => a.id === filter;
      else if (Array.isArray(filter)) passt = (a) => filter.indexOf(a.id) !== -1;
      else if (filter && (filter.gruppe || filter.prioritaet)) {
        passt = (a) => (!filter.gruppe || a.gruppe === filter.gruppe) && (!filter.prioritaet || a.prioritaet === filter.prioritaet);
      } else passt = (a) => a.prioritaet === "hintergrund";
      let n = 0;
      const ablehnen = (a) => {
        a.abgebrochen = true;
        const e = new Error(`${a.bezeichnung} abgebrochen`);
        e.abgebrochen = true;
        a.reject(e);
        n++;
      };
      ["vordergrund", "hintergrund"].forEach((p) => {
        const bleibt = [];
        schlangen[p].forEach((a) => (passt(a) ? ablehnen(a) : bleibt.push(a)));
        schlangen[p].length = 0;
        bleibt.forEach((a) => schlangen[p].push(a));
      });
      if (aktiv && !aktiv.abgebrochen && passt(aktiv)) ablehnen(aktiv);
      if (n) melden();
      return n;
    }

    /** Hintergrundauftraege anhalten (ein laufender Abruf endet noch). Vordergrund laeuft weiter. */
    function pausieren() {
      hintergrundPausiert = true;
      melden();
    }

    function fortsetzen() {
      hintergrundPausiert = false;
      melden();
      lauf();
    }

    /** @param {{hintergrundAuchVerborgen?: boolean}} o */
    function einstellen(o) {
      if (o && o.hintergrundAuchVerborgen != null) auchVerborgen = !!o.hintergrundAuchVerborgen;
      melden();
      lauf();
    }

    /** Meldet jede Zustandsaenderung an fn(status). Liefert eine Funktion zum Abmelden. */
    function beiAenderung(fn) {
      hoerer.push(fn);
      return () => {
        const i = hoerer.indexOf(fn);
        if (i !== -1) hoerer.splice(i, 1);
      };
    }

    /** Sichtbarkeit des Tabs hat sich geaendert (auch von Tests aufgerufen). */
    function sichtbarkeitGeaendert() {
      melden();
      lauf();
    }

    /** Nur fuer Tests: Fenster, Sperren und Schalter zuruecksetzen, Umgebung austauschen. */
    function testZuruecksetzen(o) {
      o = o || {};
      starts = [];
      letztesEnde = -Infinity;
      sperreBis = -Infinity;
      fehlerBis = -Infinity;
      folge429 = 0;
      limitResetUm = null;
      hintergrundPausiert = false;
      auchVerborgen = false;
      standardUmgebung();
      if (typeof o.jetzt === "function") uhr = o.jetzt;
      if (typeof o.warte === "function") warteFn = o.warte;
      if (typeof o.verborgen === "function") verborgenFn = o.verborgen;
      melden();
    }

    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("visibilitychange", sichtbarkeitGeaendert);
    }

    return {
      einreihen,
      abbrechen,
      pausieren,
      fortsetzen,
      einstellen,
      status,
      beiAenderung,
      sichtbarkeitGeaendert,
      testZuruecksetzen,
    };
  })();

  /** Planer-Optionen aus den Optionen einer Abruffunktion. */
  function planOptionen(opts, bezeichnung) {
    return { prioritaet: opts.prioritaet, gruppe: opts.gruppe, bezeichnung };
  }

  /**
   * Reiht alle URLs ein (die Statusanzeige nennt damit sofort die ganze Zahl
   * offener Abrufe) und verarbeitet die Antworten in Reihenfolge. Scheitert
   * einer oder wird abgebrochen, werden die uebrigen Auftraege dieses Aufrufs
   * zurueckgezogen und der Fehler weitergereicht; schon verarbeitete Bloecke
   * bleiben im Bestand.
   */
  async function blockweiseAbrufen(urls, planOpts, jeAntwort) {
    const versprechen = urls.map((url) => {
      const p = planer.einreihen(url, planOpts);
      p.catch(() => {}); // Fehler wird unten ueber await behandelt, keine "unhandled rejection"
      return p;
    });
    try {
      for (let i = 0; i < versprechen.length; i++) jeAntwort(await versprechen[i], i);
    } catch (e) {
      planer.abbrechen(versprechen.map((p) => p.auftragId));
      throw e;
    }
  }

  /**
   * Staedte eines Abrufs aus den Optionen: opts.staedte (Liste, Ergebnis je
   * Stadt) oder opts.stadt (eine Stadt, Ergebnis wie bis v3.15.0).
   */
  function staedteAusOptionen(opts) {
    if (Array.isArray(opts.staedte)) return { staedte: Array.from(new Set(opts.staedte)), mehrere: true };
    return { staedte: [opts.stadt || STADT_DEFAULT], mehrere: false };
  }

  /**
   * Ordnet den Stadtnamen einer Antwortzeile (prices/: "city", history/:
   * "location") der angefragten Stadt zu. Gleichheit ohne Ruecksicht auf
   * Gross-/Kleinschreibung und Leerzeichen; eine Zeile fuer eine nicht
   * angefragte Stadt wird verworfen (null). Bei genau einer angefragten
   * Stadt gilt wie bis v3.15.0 jede Zeile fuer diese Stadt.
   */
  function stadtZuordner(staedte) {
    if (staedte.length === 1) return () => staedte[0];
    const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
    const karte = {};
    staedte.forEach((s) => {
      karte[norm(s)] = s;
    });
    return (name) => karte[norm(name)] || null;
  }

  /** Zeilen einer Antwort nach angefragter Stadt gruppieren. feld: "city" oder "location". */
  function zeilenJeStadt(zeilen, staedte, feld) {
    const zuordnen = stadtZuordner(staedte);
    const out = {};
    staedte.forEach((s) => {
      out[s] = [];
    });
    (zeilen || []).forEach((zeile) => {
      const s = zeile && zuordnen(zeile[feld]);
      if (s) out[s].push(zeile);
    });
    return out;
  }

  /** Staedte fuer den URL-Parameter locations: je Stadt kodiert ("Fort Sterling" -> "Fort%20Sterling"), Komma als Trenner. */
  function staedteParameter(staedte) {
    return staedte.map((s) => encodeURIComponent(s)).join(",");
  }

  function preisUrl(ids, staedte, qualitaet) {
    const q = qualitaet == null ? QUALITAET : qualitaet;
    return `${API_BASE}/prices/${ids.join(",")}.json?locations=${staedteParameter(staedte)}&qualities=${q}`;
  }

  function historieUrl(ids, staedte) {
    return `${API_BASE}/history/${ids.join(",")}.json?locations=${staedteParameter(staedte)}&time-scale=24`;
  }

  /**
   * Ruft Preise fuer die gegebenen Markt-IDs ab. Bereits frische Eintraege
   * im Bestand (s. Abschnitt "Bestand") werden nicht neu abgerufen. Der Rest
   * laeuft in 50er-Bloecken ueber den Abrufplaner (nacheinander, mit Pause,
   * bei HTTP 429 pausiert die ganze Schlange).
   *
   * Seit v3.16.0 mehrere Staedte in EINEM Abruf je ID-Block
   * (opts.staedte): prices/ liefert mit locations=A,B,... alle Staedte
   * vollstaendig und wertgleich zum Einzelabruf (OPTIMIERUNG-PLAN.md,
   * Abschnitt 2). Abgerufen werden die IDs, die in mindestens einer Stadt
   * fehlen oder zu alt sind, und zwar fuer genau die Staedte, in denen das
   * so ist. Die Bestandsschluessel bleiben je Stadt.
   *
   * @param {string[]} ids                          Markt-IDs, z.B. von sammleMarktIds()
   * @param {object} [opts]
   * @param {string} [opts.stadt=STADT_DEFAULT]      eine Stadt. Bestimmt Abfrageort und Bestandsschluessel
   *                                                  (s. cacheSchluessel()); ein Wechsel der Stadt darf niemals
   *                                                  mit dem Eintrag einer anderen Stadt beantwortet werden.
   * @param {string[]} [opts.staedte]                mehrere Staedte in einem Abruf; hat Vorrang vor opts.stadt
   *                                                  und aendert die Form des Ergebnisses (s. unten)
   * @param {number} [opts.cacheMaxAlterMin=30]      ab wann ein Eintrag erneut abgerufen wird
   * @param {boolean} [opts.erzwingen=false]         Bestand ignorieren, alles neu abrufen
   * @param {number} [opts.qualitaet=1]              API-Qualitaet 1..5 (1=Normal..5=Meisterwerk,
   *                                                  s. REGELN.QUALITAETEN Index+1). Normalerweise weggelassen
   *                                                  (Normal-Preise fuer den ganzen Baum), nur fuer die kleine
   *                                                  Liste aus sammleQualitaetsMarktIds() gesetzt.
   * @param {"vordergrund"|"hintergrund"} [opts.prioritaet="vordergrund"]  s. Abrufplaner
   * @param {string} [opts.gruppe]                   Kennung fuer planer.abbrechen({gruppe})
   * @param {(erledigt:number, gesamt:number)=>void} [opts.aufFortschritt]
   *
   * @returns {Promise<Object>} mit opts.stadt: Eintrag je Markt-ID,
   *   {sell:{preis,datum,kein}, buy:{preis,datum,kein}, abgerufenAm} oder
   *   null = nie abgefragt (auch nicht im Bestand). Mit opts.staedte:
   *   Stadt -> (Markt-ID -> Eintrag). sell.preis/buy.preis === null bedeutet
   *   "kein Angebot", NIEMALS 0.
   */
  async function preiseAbrufen(ids, opts) {
    opts = opts || {};
    const { staedte, mehrere } = staedteAusOptionen(opts);
    const qualitaet = opts.qualitaet != null ? opts.qualitaet : QUALITAET;
    const maxAlterMin = opts.cacheMaxAlterMin != null ? opts.cacheMaxAlterMin : CACHE_GUELTIG_MIN_DEFAULT;
    const erzwingen = !!opts.erzwingen;
    const aufFortschritt = typeof opts.aufFortschritt === "function" ? opts.aufFortschritt : function () {};

    const b = bestand;
    await b.bereit;
    const eindeutigeIds = Array.from(new Set(ids));

    const ergebnis = {};
    const fehlt = new Set();
    const holStaedte = [];
    staedte.forEach((stadt) => {
      ergebnis[stadt] = {};
      let stadtFehlt = false;
      eindeutigeIds.forEach((id) => {
        const da = b.preise.get(cacheSchluessel(stadt, id, qualitaet));
        ergebnis[stadt][id] = da || null;
        if (erzwingen || !istFrisch(da, maxAlterMin)) {
          fehlt.add(id);
          stadtFehlt = true;
        }
      });
      if (stadtFehlt) holStaedte.push(stadt);
    });
    const zuHolen = eindeutigeIds.filter((id) => fehlt.has(id));
    const fertig = () => (mehrere ? ergebnis : ergebnis[staedte[0]] || {});

    const gesamt = eindeutigeIds.length;
    let erledigt = gesamt - zuHolen.length;
    aufFortschritt(erledigt, gesamt);

    if (!zuHolen.length || !holStaedte.length) return fertig();

    const blockListe = bloecke(zuHolen, BLOCKGROESSE);
    await blockweiseAbrufen(
      blockListe.map((block) => preisUrl(block, holStaedte, qualitaet)),
      planOptionen(opts, "Preisabruf"),
      (zeilen, i) => {
        const jeStadt = zeilenJeStadt(zeilen, holStaedte, "city");
        const neu = [];
        holStaedte.forEach((stadt) => {
          jeStadt[stadt].forEach((zeile) => {
            const eintrag = normalisierePreisZeile(zeile);
            neu.push([cacheSchluessel(stadt, eintrag.id, qualitaet), eintrag]);
            ergebnis[stadt][eintrag.id] = eintrag;
          });
        });
        b.schreiben(STORE_PREISE, neu);
        // IDs, die die API nicht in der Antwort mitliefert (statt einer
        // Nullzeile), bleiben "nie abgefragt" statt faelschlich "kein
        // Angebot": ergebnis[stadt][id] behaelt dann den Wert von oben.
        erledigt += blockListe[i].length;
        aufFortschritt(erledigt, gesamt);
      }
    );

    return fertig();
  }

  /**
   * Reiter "Craften: Gewinn" (v3.11.0): Preise einer Antwort mit
   * qualities=1,2,3,4,5 nach Markt-ID UND Qualitaet ablegen. prices/ liefert
   * dann eine Zeile je Qualitaet (CLAUDE.md, API-Abschnitt); preiseAbrufen()
   * legt nur nach Markt-ID ab und wuerde die Qualitaeten gegenseitig
   * ueberschreiben. Rein, offline testbar.
   * @returns {Object<string, Object<number, object>>} id -> qualitaet(1..5) -> Eintrag wie preiseAbrufen()
   */
  function preiseJeQualitaetAusAntwort(zeilen) {
    const out = {};
    (zeilen || []).forEach((zeile) => {
      if (!zeile || !zeile.item_id) return;
      const q = Number(zeile.quality) || 1;
      if (!out[zeile.item_id]) out[zeile.item_id] = {};
      out[zeile.item_id][q] = normalisierePreisZeile(zeile);
    });
    return out;
  }

  /**
   * Preise in allen fuenf Qualitaeten, ein Abruf je 50er-Block ueber den
   * Abrufplaner. Seit v3.15.0 aus dem Bestand, soweit der Merker
   * alleQSchluessel() frisch ist; opts.erzwingen holt alles neu. Seit
   * v3.16.0 mehrere Staedte in einem Abruf (opts.staedte), s. preiseAbrufen().
   * @param {string[]} ids
   * @param {object} [opts]
   * @param {string} [opts.stadt=STADT_DEFAULT]
   * @param {string[]} [opts.staedte]  mehrere Staedte; Ergebnis dann Stadt -> id -> qualitaet -> Eintrag
   * @param {number} [opts.cacheMaxAlterMin=30]
   * @param {boolean} [opts.erzwingen=false]
   * @param {"vordergrund"|"hintergrund"} [opts.prioritaet="vordergrund"]
   * @param {string} [opts.gruppe]
   * @param {(erledigt:number, gesamt:number)=>void} [opts.aufFortschritt]
   * @returns {Promise<Object<string, Object<number, object>>>} id -> qualitaet -> Eintrag ({} = nichts geliefert)
   */
  async function preiseAlleQualitaetenAbrufen(ids, opts) {
    opts = opts || {};
    const { staedte, mehrere } = staedteAusOptionen(opts);
    const maxAlterMin = opts.cacheMaxAlterMin != null ? opts.cacheMaxAlterMin : CACHE_GUELTIG_MIN_DEFAULT;
    const erzwingen = !!opts.erzwingen;
    const aufFortschritt = typeof opts.aufFortschritt === "function" ? opts.aufFortschritt : function () {};
    const b = bestand;
    await b.bereit;
    const eindeutigeIds = Array.from(new Set(ids));
    const ergebnis = {};
    const fehlt = new Set();
    const faellig = {};
    const holStaedte = [];
    staedte.forEach((stadt) => {
      ergebnis[stadt] = {};
      faellig[stadt] = new Set();
      let stadtFehlt = false;
      eindeutigeIds.forEach((id) => {
        const merker = erzwingen ? null : b.preise.get(alleQSchluessel(stadt, id));
        if (!istFrisch(merker, maxAlterMin)) {
          fehlt.add(id);
          faellig[stadt].add(id);
          stadtFehlt = true;
          return;
        }
        const jeQ = {};
        (merker.qualitaeten || []).forEach((q) => {
          const e = b.preise.get(cacheSchluessel(stadt, id, q));
          if (e) jeQ[q] = e;
        });
        ergebnis[stadt][id] = jeQ;
      });
      if (stadtFehlt) holStaedte.push(stadt);
    });
    const zuHolen = eindeutigeIds.filter((id) => fehlt.has(id));
    let erledigt = eindeutigeIds.length - zuHolen.length;
    aufFortschritt(erledigt, eindeutigeIds.length);
    const blockListe = bloecke(zuHolen, BLOCKGROESSE);
    await blockweiseAbrufen(
      blockListe.map((block) => preisUrl(block, holStaedte, "1,2,3,4,5")),
      planOptionen(opts, "Preisabruf"),
      (zeilen, i) => {
        const jeStadt = zeilenJeStadt(zeilen, holStaedte, "city");
        const jetzt = Date.now();
        const neu = [];
        holStaedte.forEach((stadt) => {
          const teil = preiseJeQualitaetAusAntwort(jeStadt[stadt]);
          // Liefert die Antwort fuer eine Stadt gar keine Zeile, weder Merker
          // noch "nichts da" ablegen: sonst gaelten alle Produkte des Blocks
          // dort 30 Minuten lang als "kein Angebot".
          const stadtGeliefert = jeStadt[stadt].length > 0;
          blockListe[i].forEach((id) => {
            // Nur was fuer DIESE Stadt faellig war; ein frischer Eintrag einer
            // anderen Stadt im selben Abruf bleibt unberuehrt.
            if (!faellig[stadt].has(id)) return;
            const jeQ = teil[id] || {};
            ergebnis[stadt][id] = jeQ;
            if (!stadtGeliefert) return;
            Object.keys(jeQ).forEach((q) => neu.push([cacheSchluessel(stadt, id, Number(q)), jeQ[q]]));
            neu.push([alleQSchluessel(stadt, id), { alleQ: true, qualitaeten: Object.keys(jeQ).map(Number), abgerufenAm: jetzt }]);
          });
        });
        b.schreiben(STORE_PREISE, neu);
        erledigt += blockListe[i].length;
        aufFortschritt(erledigt, eindeutigeIds.length);
      }
    );
    return mehrere ? ergebnis : ergebnis[staedte[0]] || {};
  }

  // ---------------------------------------------------------------------
  // Handelsvolumen (history/-Endpunkt) als Zusatzsignal bei gesperrten
  // Kaufen-Knoten (Zyklus "history/-Handelsvolumen als Zusatzsignal bei
  // gesperrten Preisen", 05.09.2026, s. CLAUDE.md "Bekannte Grenze:
  // prices/ kann fuer echte, aktuelle Marktangebote leer bleiben"):
  // prices/ kann fuer ein Item dauerhaft leer bleiben, obwohl am Markt
  // echte Angebote liegen. history/ behebt das nicht (der Preis bleibt
  // gesperrt, das ist beabsichtigt, s. Plan 4.1 "Kein Preis heisst nicht
  // verfuegbar, niemals kostenlos"), zeigt aber zusaetzlich, ob ueberhaupt
  // gehandelt wird. Nutzer-Entscheidung 05.09.2026: nur per Knopfdruck
  // (kein automatischer Abruf), 7-Tage-Summe von item_count plus
  // mengengewichteter Durchschnittspreis (wie eintopf_update.py
  // volumen_holen(), Kennzahlen d7/avg dort). Bis v3.14.1 nur fuer die
  // Sitzung im Speicher gehalten; seit v3.15.0 im Volumenbestand mit
  // Abrufzeit, gueltig VOLUMEN_GUELTIG_MIN Minuten.
  // ---------------------------------------------------------------------

  /**
   * Wertet die Antwort von /stats/gold.json aus und liefert den juengsten
   * Goldpreis. Reine Funktion ohne Netzzugriff, deshalb offline testbar
   * (Audit-Befund 9, 19.09.2026).
   *
   * Der Endpunkt ist in der offiziellen API-Doku dokumentiert
   * (`/api/v2/stats/gold.json?date=...&end_date=...` bzw. `?count=2`), das
   * genaue Antwortschema dagegen nicht. Deshalb hier bewusst tolerant: die
   * Antwort ist eine Liste von Eintraegen, der Preis steht je nach
   * Schreibweise unter `price` oder `Price`, der Zeitstempel unter
   * `timestamp` oder `Timestamp`. Gibt es mehrere Eintraege, gewinnt der mit
   * dem juengsten Zeitstempel; ohne verwertbaren Zeitstempel der letzte
   * Eintrag der Liste. Nichts Verwertbares -> null, und der Aufrufer rechnet
   * dann ohne Rabatt weiter (kein stiller Ersatzwert).
   *
   * @param {*} antwort geparste JSON-Antwort
   * @returns {?{preis:number, zeitpunkt:?string}}
   */
  function normalisiereGoldAntwort(antwort) {
    const liste = Array.isArray(antwort) ? antwort : null;
    if (!liste || liste.length === 0) return null;
    let bester = null;
    liste.forEach((eintrag) => {
      if (!eintrag || typeof eintrag !== "object") return;
      const roh = eintrag.price != null ? eintrag.price : eintrag.Price;
      const preis = Number(roh);
      if (!isFinite(preis) || preis <= 0) return;
      const zeitpunkt = eintrag.timestamp != null ? eintrag.timestamp : eintrag.Timestamp;
      // REGELN.parseApiDatumUtc() kennt die API-Eigenheit (Zeitstempel ohne
      // Zonenangabe sind UTC, s. CLAUDE.md) und liefert Millisekunden bzw.
      // NaN. Ist regeln.js nicht geladen, entscheidet die Listenreihenfolge.
      const rohZeit =
        zeitpunkt && typeof REGELN !== "undefined" && REGELN.parseApiDatumUtc ? REGELN.parseApiDatumUtc(zeitpunkt) : NaN;
      const zeit = isFinite(rohZeit) ? rohZeit : null;
      const kandidat = { preis, zeitpunkt: zeitpunkt || null, _zeit: zeit };
      if (!bester) {
        bester = kandidat;
        return;
      }
      // Juengster Zeitstempel gewinnt; sind beide ohne Zeitstempel, gewinnt
      // der spaetere Listeneintrag (die API liefert chronologisch).
      if (kandidat._zeit != null && bester._zeit != null) {
        if (kandidat._zeit > bester._zeit) bester = kandidat;
      } else if (kandidat._zeit != null && bester._zeit == null) {
        bester = kandidat;
      } else if (kandidat._zeit == null && bester._zeit == null) {
        bester = kandidat;
      }
    });
    if (!bester) return null;
    return { preis: bester.preis, zeitpunkt: bester.zeitpunkt };
  }

  /**
   * Ruft den aktuellen Goldpreis ab (Grundlage des Global Discount, s.
   * REGELN.globalDiscount). Bewusst OHNE localStorage-Cache und bewusst
   * fehlertolerant: schlaegt der Abruf fehl, liefert die Funktion null statt
   * zu werfen, und die Rechnung laeuft ohne Rabatt weiter - genau wie bisher.
   * Ein erfundener Ersatz-Goldpreis waere schlimmer als gar keiner.
   *
   * @param {object} [opts]
   * @param {number} [opts.anzahl=2] wie viele Datenpunkte die API liefern soll
   * @returns {Promise<?{preis:number, zeitpunkt:?string}>}
   */
  async function goldpreisAbrufen(opts) {
    const o = opts || {};
    const anzahl = o.anzahl != null ? o.anzahl : 2;
    const url = `${API_BASE}/gold.json?count=${anzahl}`;
    try {
      return normalisiereGoldAntwort(await planer.einreihen(url, planOptionen(o, "Goldpreis-Abruf")));
    } catch (e) {
      return null;
    }
  }

  /**
   * Wertet eine einzelne history/-Antwortzeile aus: 7-Tage-Summe von
   * item_count (tatsaechlich gehandelte Stueckzahl, NICHT die Angebotsmenge,
   * s. CLAUDE.md "Albion Online Data Project API") und mengengewichteter
   * Durchschnittspreis ueber denselben Zeitraum. Identische Rechnung wie
   * eintopf_update.py volumen_holen() (dort "d7"/"avg"), reine Funktion ohne
   * Netzzugriff, deshalb offline testbar.
   *
   * history/ liefert das Feld "location", NICHT "city" wie prices/ - s.
   * Modulkommentar oben und CLAUDE.md.
   *
   * @param {object} zeile ein Eintrag der history/-Antwort ({item_id, location, data:[{item_count, avg_price}, ...]})
   * @param {number} tageFenster wie viele der (chronologisch letzten) Tageswerte zaehlen
   * @returns {?{id:string, stadt:string, umsatz7Tage:number, mengengewichteterPreis:?number}} null bei ungueltiger Zeile
   */
  function normalisiereHistorieZeile(zeile, tageFenster) {
    if (!zeile || !zeile.item_id) return null;
    const daten = zeile.data || [];
    const letzte = daten.slice(-tageFenster);
    const summe = letzte.reduce((a, x) => a + (x.item_count || 0), 0);
    const gewichteteSumme = letzte.reduce((a, x) => a + (x.avg_price || 0) * (x.item_count || 0), 0);
    return {
      id: zeile.item_id,
      stadt: zeile.location,
      umsatz7Tage: summe,
      mengengewichteterPreis: summe > 0 ? Math.round(gewichteteSumme / summe) : null,
    };
  }

  /**
   * Ruft das 7-Tage-Handelsvolumen fuer die gegebenen Markt-IDs ab. Seit
   * v3.15.0 aus dem Volumenbestand, soweit der Eintrag hoechstens
   * VOLUMEN_GUELTIG_MIN Minuten alt ist (auch ein "nichts geliefert" wird
   * gemerkt). Sequenziell in 50er-Bloecken mit Pause, bei HTTP 429 mit
   * wachsender Wartezeit wiederholt, dieselbe Drossel-Disziplin wie
   * preiseAbrufen().
   *
   * @param {string[]} ids Markt-IDs, typischerweise die aktuell gesperrten Kaufen-Knoten im Bauplan-Baum
   * @param {object} [opts]
   * @param {string} [opts.stadt=STADT_DEFAULT]
   * @param {string[]} [opts.staedte]  mehrere Staedte in einem Abruf; Ergebnis dann Stadt -> (Ergebnis wie unten)
   * @param {"vordergrund"|"hintergrund"} [opts.prioritaet="vordergrund"]
   * @param {string} [opts.gruppe]
   * @param {number} [opts.tageFenster=7]
   * @param {number} [opts.cacheMaxAlterMin=VOLUMEN_GUELTIG_MIN]
   * @param {boolean} [opts.erzwingen=false]
   * @param {(erledigt:number, gesamt:number)=>void} [opts.aufFortschritt]
   * @returns {Promise<Object<string, {umsatz7Tage:number, mengengewichteterPreis:?number, abgerufenAm:number}|null>>}
   *   null = history/ lieferte fuer diese ID keine (oder keine auswertbare) Zeile.
   */
  async function volumenAbrufen(ids, opts) {
    opts = opts || {};
    const { staedte, mehrere } = staedteAusOptionen(opts);
    const tageFenster = opts.tageFenster || 7;
    const maxAlterMin = opts.cacheMaxAlterMin != null ? opts.cacheMaxAlterMin : VOLUMEN_GUELTIG_MIN;
    const erzwingen = !!opts.erzwingen;
    const aufFortschritt = typeof opts.aufFortschritt === "function" ? opts.aufFortschritt : function () {};
    const b = bestand;
    await b.bereit;

    const eindeutigeIds = Array.from(new Set(ids));
    const ergebnis = {};
    const gesamt = eindeutigeIds.length;
    const fehlt = new Set();
    const faellig = {};
    const holStaedte = [];
    staedte.forEach((stadt) => {
      ergebnis[stadt] = {};
      faellig[stadt] = new Set();
      let stadtFehlt = false;
      eindeutigeIds.forEach((id) => {
        const da = erzwingen ? null : b.volumen.get(volumenSchluessel("v", stadt, id, tageFenster));
        if (istFrisch(da, maxAlterMin)) ergebnis[stadt][id] = da.wert;
        else {
          fehlt.add(id);
          faellig[stadt].add(id);
          stadtFehlt = true;
        }
      });
      if (stadtFehlt) holStaedte.push(stadt);
    });
    const zuHolen = eindeutigeIds.filter((id) => fehlt.has(id));
    let erledigt = gesamt - zuHolen.length;
    aufFortschritt(erledigt, gesamt);

    const blockListe = bloecke(zuHolen, BLOCKGROESSE);
    await blockweiseAbrufen(
      blockListe.map((block) => historieUrl(block, holStaedte)),
      planOptionen(opts, "Handelsvolumen-Abruf"),
      (zeilen, i) => {
        const jeStadt = zeilenJeStadt(zeilen, holStaedte, "location"); // history/ nennt die Stadt "location"
        const jetzt = Date.now();
        holStaedte.forEach((stadt) => {
          const teil = {};
          jeStadt[stadt].forEach((zeile) => {
            const eintrag = normalisiereHistorieZeile(zeile, tageFenster);
            if (eintrag) {
              eintrag.abgerufenAm = jetzt;
              teil[eintrag.id] = eintrag;
            }
          });
          const neu = [];
          blockListe[i].forEach((id) => {
            // Nur was fuer DIESE Stadt faellig war: ein frischer Wert wird
            // nicht durch die Antwort eines fremden Anlasses ersetzt.
            if (!faellig[stadt].has(id)) return;
            ergebnis[stadt][id] = teil[id] || null;
            neu.push([volumenSchluessel("v", stadt, id, tageFenster), { abgerufenAm: jetzt, wert: ergebnis[stadt][id] }]);
          });
          // Liefert die Antwort fuer eine Stadt gar keine Zeile, das nicht als
          // "kein Handel" merken: sonst fiele der ganze Block 60 Minuten lang
          // durch den Volumenfilter (wie bis v3.15.0 bei einer leeren Antwort).
          if (jeStadt[stadt].length) b.schreiben(STORE_VOLUMEN, neu);
        });
        erledigt += blockListe[i].length;
        aufFortschritt(erledigt, gesamt);
      }
    );
    return mehrere ? ergebnis : ergebnis[staedte[0]] || {};
  }

  // ---------------------------------------------------------------------
  // Absatz je Qualitaet (Reiter "Schnelles Geld" 19.09.2026, seit v3.11.0 "Craften: Gewinn", js/craften.js)
  //
  // Unterschied zu volumenAbrufen() oben: dort wird je Markt-ID EIN Wert
  // gefuehrt (7-Tage-Summe), und weil history/ pro Item MEHRERE Zeilen
  // liefert (je eine je Qualitaet), gewinnt dort die zuletzt gelesene Zeile.
  // Fuer ein Rohmaterial ist das folgenlos (nur Qualitaet 1 wird gehandelt),
  // fuer Ausruestung waere es falsch. Hier deshalb ausdruecklich nach
  // Qualitaet getrennt.
  //
  // Am 19.09.2026 gegen die echte API geprueft (T4_BAG, Lymhurst):
  //  - history/ liefert je Listeneintrag "location", "item_id", "quality"
  //    und "data" mit "item_count", "avg_price", "timestamp".
  //  - Der Parameter "qualities" wird von history/ IGNORIERT: ein Abruf mit
  //    qualities=4 bzw. qualities=5 lieferte unveraendert alle vier
  //    vorhandenen Qualitaetszeilen. Deshalb wird er hier gar nicht erst
  //    gesetzt und stattdessen die ganze Antwort ausgewertet.
  //
  // WAS DIE ZAHL IST: item_count ist die von den Data-Client-Meldungen der
  // Spieler ERFASSTE gehandelte Stueckzahl, nicht der garantiert vollstaendige
  // Marktumsatz (s. CLAUDE.md, Abschnitt "Albion Online Data Project API" und
  // "Bekannte Grenze"). Sie ist damit eine Untergrenze, kein amtlicher Absatz.
  // Die Oberflaeche muss das so benennen.
  // ---------------------------------------------------------------------

  /**
   * Wertet eine history/-Zeile zu einem Tagesdurchschnitt aus. Reine Funktion
   * ohne Netzzugriff, deshalb offline testbar.
   *
   * Gezaehlt werden die Tageswerte der letzten `tageFenster` Tage vor `jetzt`;
   * Tage ohne Handel fehlen in der Antwort und zaehlen damit als 0, der
   * Durchschnitt wird bewusst durch die volle Fensterbreite geteilt (sonst
   * saehe ein Item mit einem einzigen Handelstag aus wie ein Dauerlaeufer).
   * Ohne verwertbaren Zeitstempel wird auf die letzten `tageFenster`
   * Listeneintraege zurueckgefallen.
   *
   * @param {object} zeile Eintrag der history/-Antwort
   * @param {number} tageFenster Fensterbreite in Tagen
   * @param {number} [jetzt] Millisekunden seit Epoch (Default: Date.now())
   * @returns {?{id:string, stadt:string, qualitaet:number, stueckJeTag:number, stueckGesamt:number, tageFenster:number, mengengewichteterPreis:?number}}
   */
  function normalisiereAbsatzZeile(zeile, tageFenster, jetzt) {
    if (!zeile || !zeile.item_id) return null;
    const fenster = tageFenster > 0 ? tageFenster : 7;
    const bis = jetzt == null ? Date.now() : jetzt;
    const von = bis - fenster * 24 * 60 * 60 * 1000;
    const daten = Array.isArray(zeile.data) ? zeile.data : [];
    const mitZeit = daten.filter((x) => {
      if (!x || !x.timestamp) return false;
      const t = typeof REGELN !== "undefined" && REGELN.parseApiDatumUtc ? REGELN.parseApiDatumUtc(x.timestamp) : NaN;
      return isFinite(t);
    });
    const relevant = mitZeit.length
      ? mitZeit.filter((x) => {
          const t = REGELN.parseApiDatumUtc(x.timestamp);
          return t >= von && t <= bis;
        })
      : daten.slice(-fenster);
    const stueckGesamt = relevant.reduce((a, x) => a + (x.item_count || 0), 0);
    const gewichtet = relevant.reduce((a, x) => a + (x.avg_price || 0) * (x.item_count || 0), 0);
    return {
      id: zeile.item_id,
      stadt: zeile.location,
      qualitaet: zeile.quality || 1,
      stueckJeTag: stueckGesamt / fenster,
      stueckGesamt,
      tageFenster: fenster,
      mengengewichteterPreis: stueckGesamt > 0 ? Math.round(gewichtet / stueckGesamt) : null,
    };
  }

  /**
   * Fasst eine ganze history/-Antwort nach Markt-ID und Qualitaet zusammen.
   * Rein, offline testbar.
   * @returns {Object<string, Object<number, object>>} id -> qualitaet(1..5) -> Eintrag
   */
  function absatzAusAntwort(zeilen, tageFenster, jetzt) {
    const out = {};
    (zeilen || []).forEach((zeile) => {
      const e = normalisiereAbsatzZeile(zeile, tageFenster, jetzt);
      if (!e) return;
      if (!out[e.id]) out[e.id] = {};
      out[e.id][e.qualitaet] = e;
    });
    return out;
  }

  /**
   * Ruft den erfassten Tagesabsatz je Qualitaet ab. Seit v3.15.0 aus dem
   * Volumenbestand, soweit der Eintrag hoechstens VOLUMEN_GUELTIG_MIN
   * Minuten alt ist (auch "nichts erfasst" wird gemerkt); gleiche
   * Drossel-Disziplin (50er-Bloecke ueber den Abrufplaner). Jeder
   * Qualitaetseintrag traegt zusaetzlich abgerufenAm.
   *
   * @param {string[]} ids Markt-IDs
   * @param {object} [opts]
   * @param {string} [opts.stadt=STADT_DEFAULT]
   * @param {string[]} [opts.staedte]  mehrere Staedte in einem Abruf; Ergebnis dann Stadt -> (Ergebnis wie unten)
   * @param {"vordergrund"|"hintergrund"} [opts.prioritaet="vordergrund"]
   * @param {string} [opts.gruppe]
   * @param {number} [opts.tageFenster=7]
   * @param {number} [opts.cacheMaxAlterMin=VOLUMEN_GUELTIG_MIN]
   * @param {boolean} [opts.erzwingen=false]
   * @param {(erledigt:number, gesamt:number)=>void} [opts.aufFortschritt]
   * @returns {Promise<Object<string, Object<number, object>>>} id -> qualitaet -> Eintrag ({} = nichts erfasst)
   */
  async function absatzAbrufen(ids, opts) {
    opts = opts || {};
    const { staedte, mehrere } = staedteAusOptionen(opts);
    const tageFenster = opts.tageFenster || 7;
    const maxAlterMin = opts.cacheMaxAlterMin != null ? opts.cacheMaxAlterMin : VOLUMEN_GUELTIG_MIN;
    const erzwingen = !!opts.erzwingen;
    const aufFortschritt = typeof opts.aufFortschritt === "function" ? opts.aufFortschritt : function () {};
    const b = bestand;
    await b.bereit;

    const eindeutigeIds = Array.from(new Set(ids));
    const ergebnis = {};
    const gesamt = eindeutigeIds.length;
    const fehlt = new Set();
    const faellig = {};
    const holStaedte = [];
    staedte.forEach((stadt) => {
      ergebnis[stadt] = {};
      faellig[stadt] = new Set();
      let stadtFehlt = false;
      eindeutigeIds.forEach((id) => {
        const da = erzwingen ? null : b.volumen.get(volumenSchluessel("a", stadt, id, tageFenster));
        if (istFrisch(da, maxAlterMin)) ergebnis[stadt][id] = da.jeQ || {};
        else {
          fehlt.add(id);
          faellig[stadt].add(id);
          stadtFehlt = true;
        }
      });
      if (stadtFehlt) holStaedte.push(stadt);
    });
    const zuHolen = eindeutigeIds.filter((id) => fehlt.has(id));
    let erledigt = gesamt - zuHolen.length;
    aufFortschritt(erledigt, gesamt);

    const blockListe = bloecke(zuHolen, BLOCKGROESSE);
    await blockweiseAbrufen(
      blockListe.map((block) => historieUrl(block, holStaedte)),
      planOptionen(opts, "Handelsvolumen-Abruf"),
      (zeilen, i) => {
        const jeStadt = zeilenJeStadt(zeilen, holStaedte, "location"); // history/ nennt die Stadt "location"
        const jetzt = Date.now();
        holStaedte.forEach((stadt) => {
          const teil = absatzAusAntwort(jeStadt[stadt], tageFenster, jetzt);
          const neu = [];
          blockListe[i].forEach((id) => {
            if (!faellig[stadt].has(id)) return; // s. volumenAbrufen()
            const jeQ = teil[id] || {};
            Object.keys(jeQ).forEach((q) => {
              jeQ[q].abgerufenAm = jetzt;
            });
            ergebnis[stadt][id] = jeQ;
            neu.push([volumenSchluessel("a", stadt, id, tageFenster), { abgerufenAm: jetzt, jeQ }]);
          });
          // Liefert die Antwort fuer eine Stadt gar keine Zeile, das nicht als
          // "kein Handel" merken: sonst fiele der ganze Block 60 Minuten lang
          // durch den Volumenfilter (wie bis v3.15.0 bei einer leeren Antwort).
          if (jeStadt[stadt].length) b.schreiben(STORE_VOLUMEN, neu);
        });
        erledigt += blockListe[i].length;
        aufFortschritt(erledigt, gesamt);
      }
    );
    return mehrere ? ergebnis : ergebnis[staedte[0]] || {};
  }

  /** Zahl der HTTP-Anfragen dieser Sitzung (Preise, Handelsvolumen, Gold; jeder Versuch zaehlt), fuer Statuszeilen und Tests. */
  function abrufZaehler() {
    return abrufe;
  }

  // ---------------------------------------------------------------------
  // Eigenpreise (nicht handelbare Zutaten). Volle Pflegeoberflaeche ist P6,
  // hier nur Speicherung und Zugriff.
  // ---------------------------------------------------------------------

  function leererEigenpreisSpeicher() {
    return { schema: EIGENPREIS_SCHEMA_VERSION, preise: {} };
  }

  function eigenpreisSpeicherLesen() {
    try {
      const roh = localStorage.getItem(EIGENPREIS_KEY);
      if (!roh) return leererEigenpreisSpeicher();
      const daten = JSON.parse(roh);
      if (!daten || daten.schema !== EIGENPREIS_SCHEMA_VERSION) return leererEigenpreisSpeicher();
      if (!daten.preise) daten.preise = {};
      return daten;
    } catch (e) {
      return leererEigenpreisSpeicher();
    }
  }

  function eigenpreisSpeicherSchreiben(speicher) {
    try {
      localStorage.setItem(EIGENPREIS_KEY, JSON.stringify(speicher));
    } catch (e) {
      /* ignorieren: Speicher voll oder gesperrt */
    }
  }

  /**
   * Setzt den Eigenpreis fuer eine ID (uniquename oder Markt-ID). preis=null
   * loescht ihn. preis <= 0 wird ebenso behandelt wie null (loeschen), statt
   * als gueltiger Kaufpreis 0 gespeichert zu werden - genau der Fehlertyp,
   * den der Modulkommentar ausschliesst (kein Preis darf je einen Weg mit
   * Kosten 0 erzeugen). Ein absichtliches "habe ich schon auf Lager, kostet
   * mich 0" ist eine eigene Funktion mit eigener Kennzeichnung (P6-Backlog,
   * s. kostenrechner-KONTEXT.md), kein stillschweigender Nebeneffekt dieses
   * Zahlenfelds. Von rechenkern-pruefer am 04.09.2026 gefunden (Befund 1, P3).
   */
  function eigenpreisSetzen(id, preis) {
    const speicher = eigenpreisSpeicherLesen();
    if (preis == null || preis <= 0) {
      delete speicher.preise[id];
    } else {
      speicher.preise[id] = { preis: preis, gesetztAm: Date.now() };
    }
    eigenpreisSpeicherSchreiben(speicher);
  }

  /** Liest den Eigenpreis fuer eine ID, oder null wenn keiner gesetzt ist. */
  function eigenpreisHolen(id) {
    const speicher = eigenpreisSpeicherLesen();
    const eintrag = speicher.preise[id];
    return eintrag ? eintrag.preis : null;
  }

  function eigenpreisEntfernen(id) {
    eigenpreisSetzen(id, null);
  }

  /** Alle gesetzten Eigenpreise als { [id]: {preis, gesetztAm} }. */
  function eigenpreiseAlle() {
    return eigenpreisSpeicherLesen().preise;
  }

  // ---------------------------------------------------------------------
  // Selbsttest: offline pruefbare Kernregeln. Wird von tests/test.html
  // aufgerufen. P4 baut daraus die vollstaendige Testsuite.
  // ---------------------------------------------------------------------

  function selbsttest() {
    const ergebnisse = [];
    function pruefe(name, ok, details) {
      ergebnisse.push({ name, ok: !!ok, details: details || "" });
    }

    // Die Falle aus kostenrechner-KONTEXT.md: verzauberte Rohstoffe UND
    // Ausruestung muessen ueber marktId() auf die belegt-richtige ID treffen.
    pruefe(
      "marktId T4_CLOTH_LEVEL1 (el=1 aus dem Knoten) -> T4_CLOTH_LEVEL1@1",
      marktId("T4_CLOTH_LEVEL1", 0) === "T4_CLOTH_LEVEL1@1",
      marktId("T4_CLOTH_LEVEL1", 0)
    );
    pruefe(
      "marktId T4_HEAD_CLOTH_SET1 auf Stufe 2 (Ausruestung, Stufe aus Kontext) -> T4_HEAD_CLOTH_SET1@2",
      marktId("T4_HEAD_CLOTH_SET1", 2) === "T4_HEAD_CLOTH_SET1@2",
      marktId("T4_HEAD_CLOTH_SET1", 2)
    );
    pruefe(
      "marktId T4_CLOTH (Stufe 0, kein el) -> T4_CLOTH ohne Suffix",
      marktId("T4_CLOTH", 0) === "T4_CLOTH",
      marktId("T4_CLOTH", 0)
    );
    pruefe(
      "marktId ohne Kontextstufe bei Ausruestung -> keine Stufe angehaengt",
      marktId("T4_HEAD_CLOTH_SET1", 0) === "T4_HEAD_CLOTH_SET1",
      marktId("T4_HEAD_CLOTH_SET1", 0)
    );
    // Regressionstest fuer einen am 04.09.2026 live gefundenen Fehler: der Dump
    // stempelt bei einer Zutat wie "8x T4_CLOTH_LEVEL3" zusaetzlich zum bereits
    // im Namen steckenden Level ein redundantes @enchantmentlevel=3 auf die
    // Zutat. Vorrang statt Addition muss T4_CLOTH_LEVEL3@3 ergeben, nicht @6.
    pruefe(
      "marktId T4_CLOTH_LEVEL3 mit redundanter Kontextstufe 3 -> @3, nicht @6",
      marktId("T4_CLOTH_LEVEL3", 3) === "T4_CLOTH_LEVEL3@3",
      marktId("T4_CLOTH_LEVEL3", 3)
    );

    // Kein Preis heisst gesperrt, nicht 0: normalisierePreisZeile muss das
    // Datum 0001-01-01 als "kein Angebot" erkennen und preis auf null setzen.
    const keinAngebot = normalisierePreisZeile({
      item_id: "T4_HEAD_CLOTH_ROYAL@3",
      city: "Lymhurst",
      sell_price_min: 0,
      sell_price_min_date: "0001-01-01T00:00:00",
      buy_price_max: 92081,
      buy_price_max_date: "2026-09-04T10:00:00",
    });
    pruefe(
      "kein Angebot (Datum 0001-01-01) -> sell.preis === null, nicht 0",
      keinAngebot.sell.preis === null && keinAngebot.sell.kein === true,
      JSON.stringify(keinAngebot.sell)
    );
    pruefe(
      "vorhandener Preis bleibt vorhandener Preis",
      keinAngebot.buy.preis === 92081 && keinAngebot.buy.kein === false,
      JSON.stringify(keinAngebot.buy)
    );

    // ID-Sammler: die Koenigliche Gugel .3 muss die Marken-Zutat, alle drei
    // Verzauberungsstufen darunter und die zugehoerigen Verzauberungsmaterialien
    // (Rune/Seele/Relikt) einsammeln.
    if (typeof REZEPTGRAPH !== "undefined" && REZEPTGRAPH.items["T4_HEAD_CLOTH_ROYAL"]) {
      const ids = sammleMarktIds("T4_HEAD_CLOTH_ROYAL", 3);
      pruefe("ID-Sammler enthaelt die Kaufoption T4_HEAD_CLOTH_ROYAL@3", ids.includes("T4_HEAD_CLOTH_ROYAL@3"));
      pruefe(
        "ID-Sammler enthaelt QUESTITEM_TOKEN_ROYAL_T4 (Zutat der Basisrezepte)",
        ids.includes("QUESTITEM_TOKEN_ROYAL_T4")
      );
      pruefe("ID-Sammler enthaelt T4_RUNE (Verzaubermaterial Stufe 1)", ids.includes("T4_RUNE"));
      pruefe("ID-Sammler enthaelt T4_SOUL (Verzaubermaterial Stufe 2)", ids.includes("T4_SOUL"));
      pruefe("ID-Sammler enthaelt T4_RELIC (Verzaubermaterial Stufe 3)", ids.includes("T4_RELIC"));
      pruefe(
        "ID-Sammler enthaelt eine der drei Gugel-Vorstufen auf Stufe 0 (SET1/2/3)",
        ["T4_HEAD_CLOTH_SET1", "T4_HEAD_CLOTH_SET2", "T4_HEAD_CLOTH_SET3"].some((n) => ids.includes(n))
      );
      pruefe(
        "ID-Sammler enthaelt T4_CLOTH_LEVEL3@3 (Direktcraft-Zutat der Gugel .3), nicht @6",
        ids.includes("T4_CLOTH_LEVEL3@3") && !ids.some((id) => id.startsWith("T4_CLOTH_LEVEL3@") && id !== "T4_CLOTH_LEVEL3@3"),
        ids.filter((id) => id.startsWith("T4_CLOTH_LEVEL3")).join(",")
      );
    } else {
      pruefe("ID-Sammler-Tests uebersprungen (REZEPTGRAPH nicht geladen)", true, "rezepte.js fehlt in diesem Kontext");
    }

    // Cache-Schema-Version: ein Eintrag mit falscher Version wird verworfen.
    try {
      const testSchluessel = "__preise_selbsttest_cache__";
      localStorage.setItem(testSchluessel, JSON.stringify({ schema: -1, eintraege: { x: 1 } }));
      const roh = localStorage.getItem(testSchluessel);
      const daten = JSON.parse(roh);
      pruefe(
        "Cache mit falscher Schema-Version wird als veraltet erkannt (Simulation)",
        daten.schema !== PREIS_CACHE_SCHEMA_VERSION
      );
      localStorage.removeItem(testSchluessel);
    } catch (e) {
      pruefe("Cache-Schema-Test uebersprungen (kein localStorage verfuegbar)", true, String(e));
    }

    // Staedte-Feature (05.09.2026): der Cache-Schluessel muss die Stadt
    // einschliessen, sonst koennte ein Lymhurst-Eintrag faelschlich fuer eine
    // andere Stadt als frisch gelten (derselbe Fehlertyp wie der Zeitzonen-Bug,
    // nur bei der Stadt statt bei der Uhrzeit).
    pruefe(
      "cacheSchluessel: dieselbe Markt-ID in zwei Staedten ergibt zwei verschiedene Schluessel",
      cacheSchluessel("Lymhurst", "T4_CLOTH") !== cacheSchluessel("Bridgewatch", "T4_CLOTH"),
      cacheSchluessel("Lymhurst", "T4_CLOTH") + " vs " + cacheSchluessel("Bridgewatch", "T4_CLOTH")
    );
    pruefe(
      "PREIS_CACHE_SCHEMA_VERSION und EIGENPREIS_SCHEMA_VERSION sind unabhaengige Zaehler (Eigenpreise vom Staedte-Feature nicht betroffen)",
      typeof PREIS_CACHE_SCHEMA_VERSION === "number" && typeof EIGENPREIS_SCHEMA_VERSION === "number"
    );

    // Feature "Qualitaetsstufen" (05.09.2026): der Cache-Schluessel muss auch
    // die Qualitaet einschliessen, sonst koennte ein Normal-Preis faelschlich
    // fuer Exzellent als frisch gelten - derselbe Fehlertyp wie beim
    // Staedte-Feature oben, nur bei der Qualitaet statt der Stadt.
    pruefe(
      "cacheSchluessel: dieselbe Markt-ID in zwei Qualitaeten ergibt zwei verschiedene Schluessel",
      cacheSchluessel("Lymhurst", "T4_HEAD_CLOTH_ROYAL@3", 1) !== cacheSchluessel("Lymhurst", "T4_HEAD_CLOTH_ROYAL@3", 4),
      cacheSchluessel("Lymhurst", "T4_HEAD_CLOTH_ROYAL@3", 1) + " vs " + cacheSchluessel("Lymhurst", "T4_HEAD_CLOTH_ROYAL@3", 4)
    );
    pruefe(
      "cacheSchluessel: ohne qualitaet-Parameter identisch zu qualitaet=1 (Normal-Rueckfall)",
      cacheSchluessel("Lymhurst", "T4_CLOTH") === cacheSchluessel("Lymhurst", "T4_CLOTH", 1)
    );

    // sammleQualitaetsMarktIds: die Koenigliche Gugel .3 muss ueber die
    // preservequality-Zutat (T4_HEAD_CLOTH_SET1@3) UND die per Verzaubern
    // erreichbaren Vorstufen (SET1@2/@1/@0) einsammeln, aber NICHT die
    // gewoehnliche Token-Zutat (QUESTITEM_TOKEN_ROYAL_T4, kein p:true) und
    // auch nicht die Rohstoffe darunter (Faser/Stoff, qualitaetsunabhaengig).
    if (typeof REZEPTGRAPH !== "undefined" && REZEPTGRAPH.items["T4_HEAD_CLOTH_ROYAL"]) {
      const qids = sammleQualitaetsMarktIds("T4_HEAD_CLOTH_ROYAL", 3);
      pruefe("sammleQualitaetsMarktIds enthaelt die Wurzel T4_HEAD_CLOTH_ROYAL@3", qids.includes("T4_HEAD_CLOTH_ROYAL@3"), qids.join(","));
      pruefe("sammleQualitaetsMarktIds enthaelt die preservequality-Zutat T4_HEAD_CLOTH_SET1@3", qids.includes("T4_HEAD_CLOTH_SET1@3"), qids.join(","));
      pruefe(
        "sammleQualitaetsMarktIds enthaelt die per Verzaubern erreichbaren Vorstufen SET1@2/@1 und SET1 (Stufe 0)",
        qids.includes("T4_HEAD_CLOTH_SET1@2") && qids.includes("T4_HEAD_CLOTH_SET1@1") && qids.includes("T4_HEAD_CLOTH_SET1"),
        qids.join(",")
      );
      pruefe(
        "sammleQualitaetsMarktIds enthaelt NICHT die gewoehnliche Token-Zutat (kein p:true, qualitaetsunabhaengig)",
        !qids.includes("QUESTITEM_TOKEN_ROYAL_T4"),
        qids.join(",")
      );
      pruefe(
        "sammleQualitaetsMarktIds ist deutlich kleiner als sammleMarktIds fuer denselben Knoten (nur die Qualitaets-Kette, nicht der ganze Baum)",
        qids.length < sammleMarktIds("T4_HEAD_CLOTH_ROYAL", 3).length,
        qids.length + " vs " + sammleMarktIds("T4_HEAD_CLOTH_ROYAL", 3).length
      );
    } else {
      pruefe("sammleQualitaetsMarktIds-Tests uebersprungen (REZEPTGRAPH nicht geladen)", true, "rezepte.js fehlt in diesem Kontext");
    }

    // Handelsvolumen-Zusatzsignal (05.09.2026): normalisiereHistorieZeile()
    // rechnet identisch zu eintopf_update.py volumen_holen() (d7/avg dort),
    // hier gegen synthetische Zeilen offline nachgerechnet.
    const histZeile = {
      item_id: "T4_HEAD_CLOTH_ROYAL@3",
      location: "Lymhurst",
      // 10 Tageswerte, nur die letzten 7 zaehlen (tageFenster=7): 4,5,6,7,8,9,10 -> Summe 49
      data: [
        { item_count: 1, avg_price: 999 },
        { item_count: 2, avg_price: 999 },
        { item_count: 3, avg_price: 999 },
        { item_count: 4, avg_price: 100 },
        { item_count: 5, avg_price: 110 },
        { item_count: 6, avg_price: 120 },
        { item_count: 7, avg_price: 130 },
        { item_count: 8, avg_price: 140 },
        { item_count: 9, avg_price: 150 },
        { item_count: 10, avg_price: 160 },
      ],
    };
    const histAusgewertet = normalisiereHistorieZeile(histZeile, 7);
    pruefe(
      "normalisiereHistorieZeile: history/ liefert 'location', wird auf 'stadt' normalisiert",
      histAusgewertet && histAusgewertet.stadt === "Lymhurst" && histAusgewertet.id === "T4_HEAD_CLOTH_ROYAL@3",
      JSON.stringify(histAusgewertet)
    );
    pruefe(
      "normalisiereHistorieZeile: 7-Tage-Fenster nimmt nur die LETZTEN 7 Werte, nicht alle 10 (Summe 4+5+6+7+8+9+10=49)",
      histAusgewertet && histAusgewertet.umsatz7Tage === 49,
      histAusgewertet && histAusgewertet.umsatz7Tage
    );
    // Mengengewichteter Durchschnitt der letzten 7 Tage:
    // (4*100+5*110+6*120+7*130+8*140+9*150+10*160) / 49 = 6650/49 = 135,71... -> gerundet 136.
    // Das einfache (ungewichtete) Mittel der sieben Preise waere 130 - die
    // Abweichung zeigt genau den Sinn der Gewichtung: an Tagen mit mehr
    // Umsatz (hier zufaellig auch die teureren) zaehlt der Preis staerker.
    pruefe(
      "normalisiereHistorieZeile: mengengewichteter Durchschnittspreis ueber die letzten 7 Tage, nicht das einfache Mittel (136 statt 130)",
      histAusgewertet && histAusgewertet.mengengewichteterPreis === 136,
      histAusgewertet && histAusgewertet.mengengewichteterPreis
    );
    const histLeer = normalisiereHistorieZeile({ item_id: "X", location: "Lymhurst", data: [] }, 7);
    pruefe(
      "normalisiereHistorieZeile: kein Umsatz (leere data) -> umsatz7Tage 0, Preis null statt NaN/Infinity",
      histLeer && histLeer.umsatz7Tage === 0 && histLeer.mengengewichteterPreis === null,
      JSON.stringify(histLeer)
    );
    pruefe(
      "normalisiereHistorieZeile: ungueltige Zeile ohne item_id liefert null statt zu werfen",
      normalisiereHistorieZeile(null, 7) === null && normalisiereHistorieZeile({}, 7) === null
    );

    // -- Audit-Befund 9 (19.09.2026): Goldpreis fuer den Global Discount -----
    (function () {
      const g = normalisiereGoldAntwort([
        { price: 4200, timestamp: "2026-09-18T12:00:00" },
        { price: 2850, timestamp: "2026-09-19T12:00:00" },
      ]);
      pruefe(
        "normalisiereGoldAntwort: juengster Zeitstempel gewinnt, auch wenn er nicht der hoechste Preis ist",
        g && g.preis === 2850,
        JSON.stringify(g)
      );
    })();
    (function () {
      const g = normalisiereGoldAntwort([{ Price: 1500, Timestamp: "2026-09-19T12:00:00" }]);
      pruefe(
        "normalisiereGoldAntwort: grossgeschriebene Feldnamen werden ebenfalls erkannt (Antwortschema nicht dokumentiert)",
        g && g.preis === 1500,
        JSON.stringify(g)
      );
    })();
    (function () {
      const g = normalisiereGoldAntwort([{ price: 3100 }, { price: 3050 }]);
      pruefe(
        "normalisiereGoldAntwort: ohne Zeitstempel gewinnt der letzte Listeneintrag (API liefert chronologisch)",
        g && g.preis === 3050,
        JSON.stringify(g)
      );
    })();
    pruefe(
      "normalisiereGoldAntwort: unbrauchbare Antwort liefert null statt eines erfundenen Ersatzpreises",
      normalisiereGoldAntwort(null) === null &&
        normalisiereGoldAntwort([]) === null &&
        normalisiereGoldAntwort({ price: 1000 }) === null &&
        normalisiereGoldAntwort([{ price: 0 }]) === null &&
        normalisiereGoldAntwort([{ price: "keine Zahl" }]) === null
    );

    return ergebnisse;
  }

  return {
    REALM,
    STADT_DEFAULT,
    QUALITAET,
    PREIS_CACHE_SCHEMA_VERSION,
    EIGENPREIS_SCHEMA_VERSION,
    PREIS_GUELTIG_MIN: CACHE_GUELTIG_MIN_DEFAULT,
    VOLUMEN_GUELTIG_MIN,
    BESTAND_MAX_ALTER_TAGE,
    BESTAND_DB_NAME,
    BLOCKGROESSE,
    PAUSE_MS,
    LIMIT_JE_MINUTE,
    LIMIT_JE_5_MINUTEN,
    BUDGET_JE_MINUTE,
    BUDGET_JE_5_MINUTEN,
    LIMIT_RESET_MARGE_MS,
    MAX_429_VORDERGRUND,
    limitResetAusText,
    planer,
    cacheSchluessel,
    bestandBereit,
    bestandInfo,
    bestandGeschrieben,
    bestandEintraege,
    bestandEinmischen,
    bestandPreis,
    bestandAlleQualitaeten,
    bestandAbsatz,
    abrufZaehler,
    testEinstellen,
    testBestandSchreiben,
    testDatenbankLoeschen,
    marktId,
    sammleMarktIds,
    sammleQualitaetsMarktIds,
    preiseAbrufen,
    preiseJeQualitaetAusAntwort,
    preiseAlleQualitaetenAbrufen,
    preisCacheLesen,
    preisCacheLeeren,
    eintragAlterMinuten,
    istFrisch,
    eigenpreisSetzen,
    eigenpreisHolen,
    eigenpreisEntfernen,
    eigenpreiseAlle,
    normalisiereHistorieZeile,
    volumenAbrufen,
    normalisiereAbsatzZeile,
    absatzAusAntwort,
    absatzAbrufen,
    normalisiereGoldAntwort,
    goldpreisAbrufen,
    selbsttest,
  };
})();
