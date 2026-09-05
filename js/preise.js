// js/preise.js
//
// Preisschicht des Kostenrechners: Markt-ID-Bildung, ID-Sammler ueber den
// Rezeptgraphen, gedrosselter Abruf gegen die Albion Data API, localStorage-
// Zwischenspeicher mit Schema-Version, Eigenpreis-Ablage fuer nicht
// handelbare Zutaten. Reine JS-Datei ohne DOM-Abhaengigkeit (kein
// document.*), per <script src="js/preise.js"></script> einbindbar.
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
// Fehlermeldung. Siehe ../../CLAUDE.md, Abschnitt "Albion Online Data
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

  const BLOCKGROESSE = 50; // im Eintopf-Rechner erprobt
  const PAUSE_MS = 1500; // Pause zwischen Bloecken
  const MAX_VERSUCHE = 5;

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
  // localStorage-Preiscache
  // ---------------------------------------------------------------------

  function leererPreisCache() {
    return { schema: PREIS_CACHE_SCHEMA_VERSION, eintraege: {} };
  }

  function preisCacheLesen() {
    try {
      const roh = localStorage.getItem(PREIS_CACHE_KEY);
      if (!roh) return leererPreisCache();
      const daten = JSON.parse(roh);
      if (!daten || daten.schema !== PREIS_CACHE_SCHEMA_VERSION) return leererPreisCache();
      if (!daten.eintraege) daten.eintraege = {};
      return daten;
    } catch (e) {
      return leererPreisCache();
    }
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

  function preisCacheSchreiben(cache) {
    try {
      localStorage.setItem(PREIS_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      // Speicher voll/gesperrt (z.B. manche Browser bei file://) - die
      // laufende Abfrage funktioniert trotzdem, nur ohne Zwischenspeicher.
    }
  }

  function preisCacheLeeren() {
    try {
      localStorage.removeItem(PREIS_CACHE_KEY);
    } catch (e) {
      /* ignorieren */
    }
  }

  /** Alter eines Cache-Eintrags in Minuten, oder null wenn kein Eintrag. */
  function eintragAlterMinuten(eintrag) {
    if (!eintrag || !eintrag.abgerufenAm) return null;
    return (Date.now() - eintrag.abgerufenAm) / 60000;
  }

  function istFrisch(eintrag, maxAlterMin) {
    const alter = eintragAlterMinuten(eintrag);
    return alter !== null && alter <= maxAlterMin;
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
  // Abruf gegen die API: sequenziell, gedrosselt, mit Backoff bei 429
  // ---------------------------------------------------------------------

  function bloecke(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  function warte(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function holeBlock(ids, stadt, qualitaet) {
    const q = qualitaet == null ? QUALITAET : qualitaet;
    const url = `${API_BASE}/prices/${ids.join(",")}.json?locations=${stadt}&qualities=${q}`;
    let letzterFehler = null;
    for (let versuch = 0; versuch < MAX_VERSUCHE; versuch++) {
      try {
        const antwort = await fetch(url);
        if (antwort.status === 429) {
          await warte(PAUSE_MS * Math.pow(2, versuch + 1));
          continue;
        }
        if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
        return await antwort.json();
      } catch (e) {
        letzterFehler = e;
        if (versuch < MAX_VERSUCHE - 1) await warte(PAUSE_MS * Math.pow(2, versuch + 1));
      }
    }
    throw new Error(`Preisabruf fehlgeschlagen nach ${MAX_VERSUCHE} Versuchen: ${letzterFehler}`);
  }

  /**
   * Ruft Preise fuer die gegebenen Markt-IDs ab. Bereits frische Cache-
   * Eintraege werden nicht neu abgerufen. Der Rest wird sequenziell in
   * 50er-Bloecken mit Pause geholt, bei HTTP 429 mit wachsender Wartezeit
   * wiederholt (1,5s * 2^n).
   *
   * @param {string[]} ids                          Markt-IDs, z.B. von sammleMarktIds()
   * @param {object} [opts]
   * @param {string} [opts.stadt=STADT_DEFAULT]      Craft-Stadt, s. ui.js Einstellung "Stadt". Bestimmt sowohl den
   *                                                  API-Abfrageort als auch den Cache-Schluessel (s. cacheSchluessel()) -
   *                                                  ein Wechsel der Stadt darf niemals mit dem Cache-Eintrag einer
   *                                                  anderen Stadt beantwortet werden.
   * @param {number} [opts.cacheMaxAlterMin=30]      ab wann ein Cache-Eintrag erneut abgerufen wird
   * @param {boolean} [opts.erzwingen=false]         Cache ignorieren, alles neu abrufen
   * @param {number} [opts.qualitaet=1]              API-Qualitaet 1..5 (1=Normal..5=Meisterwerk,
   *                                                  s. REGELN.QUALITAETEN Index+1). Feature
   *                                                  "Qualitaetsstufen": normalerweise weggelassen
   *                                                  (Normal-Preise fuer den ganzen Baum), nur fuer
   *                                                  die kleine Liste aus sammleQualitaetsMarktIds()
   *                                                  mit der gewaehlten Zielqualitaet aufgerufen.
   * @param {(erledigt:number, gesamt:number)=>void} [opts.aufFortschritt]
   *
   * @returns {Promise<Object<string, {sell:{preis:?number,datum:string,kein:boolean}, buy:{preis:?number,datum:string,kein:boolean}, abgerufenAm:number}|null>>}
   *   Eintrag je Markt-ID (unpraefigiert, ohne Stadt - die Antwort gilt ohnehin
   *   ausschliesslich fuer die angefragte Stadt UND Qualitaet). null = nie
   *   abgefragt (auch nicht im Cache). sell.preis/buy.preis === null bedeutet
   *   "kein Angebot", NIEMALS 0.
   */
  async function preiseAbrufen(ids, opts) {
    opts = opts || {};
    const stadt = opts.stadt || STADT_DEFAULT;
    const qualitaet = opts.qualitaet != null ? opts.qualitaet : QUALITAET;
    const maxAlterMin = opts.cacheMaxAlterMin != null ? opts.cacheMaxAlterMin : CACHE_GUELTIG_MIN_DEFAULT;
    const erzwingen = !!opts.erzwingen;
    const aufFortschritt = typeof opts.aufFortschritt === "function" ? opts.aufFortschritt : function () {};

    const cache = preisCacheLesen();
    const eindeutigeIds = Array.from(new Set(ids));

    const zuHolen = erzwingen
      ? eindeutigeIds
      : eindeutigeIds.filter((id) => !istFrisch(cache.eintraege[cacheSchluessel(stadt, id, qualitaet)], maxAlterMin));

    const ergebnis = {};
    eindeutigeIds.forEach((id) => {
      ergebnis[id] = cache.eintraege[cacheSchluessel(stadt, id, qualitaet)] || null;
    });

    const gesamt = eindeutigeIds.length;
    let erledigt = gesamt - zuHolen.length;
    aufFortschritt(erledigt, gesamt);

    if (!zuHolen.length) return ergebnis;

    for (const block of bloecke(zuHolen, BLOCKGROESSE)) {
      const zeilen = await holeBlock(block, stadt, qualitaet);
      const gesehen = new Set();
      (zeilen || []).forEach((zeile) => {
        const eintrag = normalisierePreisZeile(zeile);
        cache.eintraege[cacheSchluessel(stadt, eintrag.id, qualitaet)] = eintrag;
        ergebnis[eintrag.id] = eintrag;
        gesehen.add(eintrag.id);
      });
      // IDs, die die API nicht in der Antwort mitliefert (statt einer
      // Nullzeile), bleiben "nie abgefragt" statt faelschlich "kein Angebot".
      block.forEach((id) => {
        if (!gesehen.has(id) && !ergebnis[id]) ergebnis[id] = null;
      });
      erledigt += block.length;
      aufFortschritt(erledigt, gesamt);
      preisCacheSchreiben(cache);
      await warte(PAUSE_MS);
    }

    return ergebnis;
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
  // volumen_holen(), Kennzahlen d7/avg dort), nur fuer die Sitzung im
  // Speicher gehalten (kein localStorage-Cache, kein Schema noetig).
  // ---------------------------------------------------------------------

  async function holeHistorieBlock(ids, stadt) {
    const url = `${API_BASE}/history/${ids.join(",")}.json?locations=${stadt}&time-scale=24`;
    let letzterFehler = null;
    for (let versuch = 0; versuch < MAX_VERSUCHE; versuch++) {
      try {
        const antwort = await fetch(url);
        if (antwort.status === 429) {
          await warte(PAUSE_MS * Math.pow(2, versuch + 1));
          continue;
        }
        if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
        return await antwort.json();
      } catch (e) {
        letzterFehler = e;
        if (versuch < MAX_VERSUCHE - 1) await warte(PAUSE_MS * Math.pow(2, versuch + 1));
      }
    }
    throw new Error(`Handelsvolumen-Abruf fehlgeschlagen nach ${MAX_VERSUCHE} Versuchen: ${letzterFehler}`);
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
   * Ruft das 7-Tage-Handelsvolumen fuer die gegebenen Markt-IDs ab. Bewusst
   * OHNE localStorage-Cache (Nutzer-Entscheidung 05.09.2026, "nur laufende
   * Sitzung"): der Aufrufer (ui.js) haelt das Ergebnis selbst im
   * Seitenspeicher, solange die Seite offen ist. Sequenziell in 50er-
   * Bloecken mit Pause, bei HTTP 429 mit wachsender Wartezeit wiederholt -
   * dieselbe Drossel-Disziplin wie preiseAbrufen().
   *
   * @param {string[]} ids Markt-IDs, typischerweise die aktuell gesperrten Kaufen-Knoten im Bauplan-Baum
   * @param {object} [opts]
   * @param {string} [opts.stadt=STADT_DEFAULT]
   * @param {number} [opts.tageFenster=7]
   * @param {(erledigt:number, gesamt:number)=>void} [opts.aufFortschritt]
   * @returns {Promise<Object<string, {umsatz7Tage:number, mengengewichteterPreis:?number}|null>>}
   *   null = history/ lieferte fuer diese ID keine (oder keine auswertbare) Zeile.
   */
  async function volumenAbrufen(ids, opts) {
    opts = opts || {};
    const stadt = opts.stadt || STADT_DEFAULT;
    const tageFenster = opts.tageFenster || 7;
    const aufFortschritt = typeof opts.aufFortschritt === "function" ? opts.aufFortschritt : function () {};

    const eindeutigeIds = Array.from(new Set(ids));
    const ergebnis = {};
    const gesamt = eindeutigeIds.length;
    let erledigt = 0;
    aufFortschritt(erledigt, gesamt);
    if (!gesamt) return ergebnis;

    for (const block of bloecke(eindeutigeIds, BLOCKGROESSE)) {
      const zeilen = await holeHistorieBlock(block, stadt);
      const gesehen = new Set();
      (zeilen || []).forEach((zeile) => {
        const eintrag = normalisiereHistorieZeile(zeile, tageFenster);
        if (eintrag) {
          ergebnis[eintrag.id] = eintrag;
          gesehen.add(eintrag.id);
        }
      });
      block.forEach((id) => {
        if (!gesehen.has(id)) ergebnis[id] = null;
      });
      erledigt += block.length;
      aufFortschritt(erledigt, gesamt);
      await warte(PAUSE_MS);
    }
    return ergebnis;
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
      /* ignorieren, s. preisCacheSchreiben */
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

    return ergebnisse;
  }

  return {
    REALM,
    STADT_DEFAULT,
    QUALITAET,
    PREIS_CACHE_SCHEMA_VERSION,
    EIGENPREIS_SCHEMA_VERSION,
    marktId,
    sammleMarktIds,
    sammleQualitaetsMarktIds,
    preiseAbrufen,
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
    selbsttest,
  };
})();
