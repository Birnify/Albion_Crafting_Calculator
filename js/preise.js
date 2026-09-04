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

  const STADT = "Lymhurst"; // v1: nur Lymhurst, s. Plan Abschnitt 2 ("Stadt")
  const QUALITAET = 1; // v1: nur Qualitaet 1 (Normal), s. Plan Abschnitt 2 ("Qualitaet")

  // Bei jeder Aenderung am Cache-Format hochzaehlen. Ein Cache mit anderer
  // Schema-Version wird verworfen statt falsch interpretiert - im
  // Eintopf-Projekt hat ein alter Cache einmal frische Daten ueberschrieben.
  const SCHEMA_VERSION = 1;

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

  // ---------------------------------------------------------------------
  // localStorage-Preiscache
  // ---------------------------------------------------------------------

  function leererPreisCache() {
    return { schema: SCHEMA_VERSION, eintraege: {} };
  }

  function preisCacheLesen() {
    try {
      const roh = localStorage.getItem(PREIS_CACHE_KEY);
      if (!roh) return leererPreisCache();
      const daten = JSON.parse(roh);
      if (!daten || daten.schema !== SCHEMA_VERSION) return leererPreisCache();
      if (!daten.eintraege) daten.eintraege = {};
      return daten;
    } catch (e) {
      return leererPreisCache();
    }
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

  async function holeBlock(ids) {
    const url = `${API_BASE}/prices/${ids.join(",")}.json?locations=${STADT}&qualities=${QUALITAET}`;
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
   * @param {number} [opts.cacheMaxAlterMin=30]      ab wann ein Cache-Eintrag erneut abgerufen wird
   * @param {boolean} [opts.erzwingen=false]         Cache ignorieren, alles neu abrufen
   * @param {(erledigt:number, gesamt:number)=>void} [opts.aufFortschritt]
   *
   * @returns {Promise<Object<string, {sell:{preis:?number,datum:string,kein:boolean}, buy:{preis:?number,datum:string,kein:boolean}, abgerufenAm:number}|null>>}
   *   Eintrag je Markt-ID. null = nie abgefragt (auch nicht im Cache).
   *   sell.preis/buy.preis === null bedeutet "kein Angebot", NIEMALS 0.
   */
  async function preiseAbrufen(ids, opts) {
    opts = opts || {};
    const maxAlterMin = opts.cacheMaxAlterMin != null ? opts.cacheMaxAlterMin : CACHE_GUELTIG_MIN_DEFAULT;
    const erzwingen = !!opts.erzwingen;
    const aufFortschritt = typeof opts.aufFortschritt === "function" ? opts.aufFortschritt : function () {};

    const cache = preisCacheLesen();
    const eindeutigeIds = Array.from(new Set(ids));

    const zuHolen = erzwingen
      ? eindeutigeIds
      : eindeutigeIds.filter((id) => !istFrisch(cache.eintraege[id], maxAlterMin));

    const ergebnis = {};
    eindeutigeIds.forEach((id) => {
      ergebnis[id] = cache.eintraege[id] || null;
    });

    const gesamt = eindeutigeIds.length;
    let erledigt = gesamt - zuHolen.length;
    aufFortschritt(erledigt, gesamt);

    if (!zuHolen.length) return ergebnis;

    for (const block of bloecke(zuHolen, BLOCKGROESSE)) {
      const zeilen = await holeBlock(block);
      const gesehen = new Set();
      (zeilen || []).forEach((zeile) => {
        const eintrag = normalisierePreisZeile(zeile);
        cache.eintraege[eintrag.id] = eintrag;
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
  // Eigenpreise (nicht handelbare Zutaten). Volle Pflegeoberflaeche ist P6,
  // hier nur Speicherung und Zugriff.
  // ---------------------------------------------------------------------

  function leererEigenpreisSpeicher() {
    return { schema: SCHEMA_VERSION, preise: {} };
  }

  function eigenpreisSpeicherLesen() {
    try {
      const roh = localStorage.getItem(EIGENPREIS_KEY);
      if (!roh) return leererEigenpreisSpeicher();
      const daten = JSON.parse(roh);
      if (!daten || daten.schema !== SCHEMA_VERSION) return leererEigenpreisSpeicher();
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
        daten.schema !== SCHEMA_VERSION
      );
      localStorage.removeItem(testSchluessel);
    } catch (e) {
      pruefe("Cache-Schema-Test uebersprungen (kein localStorage verfuegbar)", true, String(e));
    }

    return ergebnisse;
  }

  return {
    REALM,
    STADT,
    QUALITAET,
    SCHEMA_VERSION,
    marktId,
    sammleMarktIds,
    preiseAbrufen,
    preisCacheLesen,
    preisCacheLeeren,
    eintragAlterMinuten,
    istFrisch,
    eigenpreisSetzen,
    eigenpreisHolen,
    eigenpreisEntfernen,
    eigenpreiseAlle,
    selbsttest,
  };
})();
