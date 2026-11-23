// tests/preisstand-test.js
//
// Tests fuer tools/preisstand.js (Abrufer des gemeinsamen Preisstands, v3.23.0)
// und fuer den Rundlauf Skript -> Dateien -> App. Node 20, ohne Abhaengigkeiten,
// ohne echte Schnittstelle (nachgebildetes fetch, nachgebildete Uhr):
//
//   node tests/preisstand-test.js
//
// Exit-Code 0 = alle gruen. Ein Test (Kopfzeilen) startet einen lokalen
// HTTP-Server auf 127.0.0.1 und benutzt das echte fetch von Node dagegen.

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const zlib = require("zlib");
const { lauf, argumente, appLaden, USER_AGENT, MAX_ABRUFE } = require("../tools/preisstand.js");

const WURZEL = path.join(__dirname, "..");
const TAG = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 10, 23, 12, 0, 0);

const ergebnisse = [];
function pruefe(name, ok, details) {
  ergebnisse.push({ name, ok: !!ok, details: details == null ? "" : String(details) });
  console.log((ok ? "[OK] " : "[FEHLER] ") + name + (details != null && details !== "" ? "  (" + details + ")" : ""));
}

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "preisstand-test-"));
}

function hash(text) {
  let x = 7;
  for (let i = 0; i < text.length; i++) x = (x * 31 + text.charCodeAt(i)) % 100003;
  return x;
}

const iso = (ms) => new Date(ms).toISOString().slice(0, 19);

/**
 * Nachgebildete Schnittstelle samt Uhr. Zutaten sind billig, Produkte teuer,
 * damit es Zeilen mit Gewinn gibt. `stoerung(nr, url)` kann je Abruf eine
 * andere Antwort liefern ({status, text} oder {wirf}).
 */
function welt(zutaten, start) {
  const w = { t: start == null ? T0 : start, log: [], warten: [], unterwegs: 0, gleichzeitigMax: 0, aufschlag: 0, stoerung: null };
  w.jetzt = () => w.t;
  w.warte = (ms) => {
    w.warten.push(ms);
    w.t += ms;
    return Promise.resolve();
  };
  const preisZeile = (id, stadt, q) => {
    const h = hash(stadt + "|" + id);
    const sell = (zutaten.has(id) ? 50 + (h % 50) : 5000 + (h % 20000) + w.aufschlag) + q * 10;
    const leer = h % 7 === 0 && q >= 4; // "nie erfasst" kommt in echten Antworten oft vor
    return {
      item_id: id, city: stadt, quality: q,
      sell_price_min: leer ? 0 : sell, sell_price_min_date: leer ? "0001-01-01T00:00:00" : iso(T0 - 3600000),
      buy_price_max: leer ? 0 : Math.floor(sell * 0.8), buy_price_max_date: leer ? "0001-01-01T00:00:00" : iso(T0 - 7200000),
    };
  };
  const historieZeilen = (id, stadt) =>
    [1, 2].map((q) => ({ location: stadt, item_id: id, quality: q, data: [{ item_count: 7 * (5 + (hash(id + stadt) % 30)) * q, avg_price: 90000000 + (hash(id) % 100), timestamp: iso(T0 - TAG) }] }));
  w.antwortFuer = (url) => {
    const u = decodeURIComponent(url);
    const staedte = /[?&]locations=([^&]+)/.exec(u)[1].split(",");
    const p = /\/prices\/(.+)\.json/.exec(u);
    if (p) {
      const qs = /[?&]qualities=([^&]+)/.exec(u)[1].split(",").map(Number);
      return [].concat(...staedte.map((stadt) => [].concat(...p[1].split(",").map((id) => qs.map((q) => preisZeile(id, stadt, q))))));
    }
    const hi = /\/history\/(.+)\.json/.exec(u);
    if (hi) return [].concat(...staedte.map((stadt) => [].concat(...hi[1].split(",").map((id) => historieZeilen(id, stadt)))));
    return [];
  };
  w.fetch = async (url, init) => {
    url = String(url);
    const eintrag = { url, start: w.t, ende: null, init };
    w.log.push(eintrag);
    w.unterwegs++;
    w.gleichzeitigMax = Math.max(w.gleichzeitigMax, w.unterwegs);
    await new Promise((r) => setImmediate(r));
    w.t += 100; // ein Abruf dauert 100 ms
    eintrag.ende = w.t;
    w.unterwegs--;
    const s = w.stoerung ? w.stoerung(w.log.length, url) : null;
    if (s && s.wirf) throw new Error(s.wirf);
    if (s) return { status: s.status, ok: s.status >= 200 && s.status < 300, text: async () => s.text || "" };
    return { status: 200, ok: true, text: async () => JSON.stringify(w.antwortFuer(url)) };
  };
  return w;
}

const still = () => {};
const starte = (w, art, aus, mehr) => lauf(Object.assign({ art, aus, wurzel: WURZEL, fetch: w.fetch, jetzt: w.jetzt, warte: w.warte, log: still }, mehr || {}));
const lies = (aus, name) => JSON.parse(fs.readFileSync(path.join(aus, name), "utf8"));
const idsAus = (url) => /\/(?:prices|history)\/(.+)\.json/.exec(decodeURIComponent(url))[1].split(",");

function sortiert(paare) {
  return paare.slice().sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

async function haupt() {
  // Zutaten des Vorgabe-Umfangs, aus der App selbst.
  const basisApp = appLaden(WURZEL, { fetch: async () => { throw new Error("kein Netz"); } });
  const G0 = basisApp.GELEGENHEITEN;
  const STAEDTE = basisApp.VEREDELN.STAEDTE.slice();
  const eAlle = G0.einstellungenBereinigen(Object.assign(G0.standardEinstellungen(), { einkaufStaedte: STAEDTE, verkaufStaedte: STAEDTE }));
  const kandidaten = G0.kandidaten(eAlle);
  const zutaten = new Set();
  kandidaten.forEach((x) => x.zutatIds.forEach((id) => zutaten.add(id)));
  const faellig = G0.faelligFuer(kandidaten, eAlle, { preis: () => null, alleQ: () => null, absatz: () => null }, T0, null);
  const n = basisApp.PREISE.BLOCKGROESSE;
  const erwartet = Math.ceil(faellig.q1.length / n) + Math.ceil(faellig.alleQ.length / n) + Math.ceil((faellig.absatz.length + faellig.zutatAbsatz.length) / n);

  // ---- Argumente ----
  pruefe(
    "argumente: --voll und --schnell mit Vorgaben (aus daten, Obergrenze 300 bzw. 30), --aus und --max-abrufe werden gelesen",
    argumente(["--voll"]).art === "voll" && argumente(["--voll"]).aus === "daten" && argumente(["--schnell", "--aus", "x", "--max-abrufe", "4"]).maxAbrufe === 4 && argumente(["--schnell", "--aus", "x"]).aus === "x" && MAX_ABRUFE.voll === 300 && MAX_ABRUFE.schnell === 30
  );
  const wirft = (argv) => {
    try {
      argumente(argv);
      return false;
    } catch (e) {
      return true;
    }
  };
  pruefe("argumente: ohne Lauf-Art, mit beiden, mit unbekanntem Argument oder --max-abrufe 0 gibt es einen Fehler", wirft([]) && wirft(["--voll", "--schnell"]) && wirft(["--voll", "--x"]) && wirft(["--voll", "--max-abrufe", "0"]));

  // ---- Voller Lauf ----
  const ausA = tmp();
  const wA = welt(zutaten);
  const rA = await starte(wA, "voll", ausA);
  const kopfA = lies(ausA, "stand.json");
  pruefe(
    "voll: ein Lauf ohne Stoerung ist vollstaendig, holt so viele Bloecke wie der Scanumfang der App verlangt, und bleibt unter der Obergrenze 300",
    rA.geschrieben && !rA.abgebrochen && rA.abrufe === erwartet && wA.log.length === erwartet && erwartet < 300 && rA.bloeckeOffen === 0,
    rA.abrufe + " Abrufe, erwartet " + erwartet + " (" + kandidaten.length + " Vorgaenge)"
  );
  pruefe(
    "voll: nie zwei Abrufe gleichzeitig, zwischen Ende und naechstem Start mindestens 1,5 s",
    wA.gleichzeitigMax === 1 && rA.gleichzeitigMax === 1 && wA.log.every((x, i) => i === 0 || x.start - wA.log[i - 1].ende >= 1500),
    "gleichzeitig hoechstens " + wA.gleichzeitigMax + ", kleinster Abstand " + Math.min(...wA.log.slice(1).map((x, i) => x.start - wA.log[i].ende)) + " ms"
  );
  pruefe(
    "voll: jeder Abruf geht an den Realm europe, nennt alle sieben Staedte und hoechstens 50 IDs; User-Agent ohne persoenliche Daten",
    wA.log.every((x) => x.url.indexOf("https://europe.albion-online-data.com/api/v2/stats/") === 0 && /[?&]locations=([^&]+)/.exec(decodeURIComponent(x.url))[1].split(",").length === 7 && idsAus(x.url).length <= 50 && x.init.headers["User-Agent"] === USER_AGENT) &&
      USER_AGENT === "albion-werkzeuge-preisstand"
  );
  const geholt = { alleQ: new Set(), q1: new Set(), absatz: new Set() };
  wA.log.forEach((x) => {
    const u = decodeURIComponent(x.url);
    const ziel = u.indexOf("/history/") !== -1 ? geholt.absatz : /qualities=1,2,3,4,5/.test(u) ? geholt.alleQ : geholt.q1;
    idsAus(x.url).forEach((id) => ziel.add(id));
  });
  pruefe(
    "voll: geholt wird genau der Vorgabe-Umfang (Produktpreise aller Qualitaeten, Normalpreise, verkauft/Tag von Produkten und Zutaten)",
    geholt.alleQ.size === faellig.alleQ.length && geholt.q1.size === faellig.q1.length && geholt.absatz.size === faellig.absatz.length + faellig.zutatAbsatz.length && faellig.alleQ.every((id) => geholt.alleQ.has(id)) && Array.from(zutaten).every((id) => geholt.q1.has(id) && geholt.absatz.has(id)),
    geholt.alleQ.size + " / " + geholt.q1.size + " / " + geholt.absatz.size + " IDs"
  );
  pruefe(
    "voll: der Kopf nennt Schema, Zeiten des Laufs, Abrufe, Eintraege und Dateigroessen",
    kopfA.schema === 1 && kopfA.erzeugtAm === wA.t && kopfA.laeufe.voll.begonnenAm === T0 && kopfA.laeufe.voll.vollstaendigAm === kopfA.erzeugtAm && kopfA.laeufe.voll.abgebrochen === false && kopfA.laeufe.voll.abrufe === erwartet &&
      kopfA.letzterLauf.art === "voll" && kopfA.dateien.preise.eintraege > 100000 && kopfA.dateien.preise.merker === faellig.alleQ.length * 7 && kopfA.dateien.volumen.eintraege === geholt.absatz.size * 7 &&
      kopfA.dateien.preise.bytes === fs.statSync(path.join(ausA, "preise.json")).size && kopfA.dateien.preise.gzipBytes > 0 && kopfA.dateien.preise.geaendertAm === kopfA.erzeugtAm,
    JSON.stringify(kopfA.dateien)
  );
  pruefe(
    "voll: ein voller Stand der nachgebildeten Schnittstelle bleibt unter 25 MB roh und 5 MB gzip",
    kopfA.dateien.preise.bytes + kopfA.dateien.volumen.bytes < 25 * 1024 * 1024 && kopfA.dateien.preise.gzipBytes + kopfA.dateien.volumen.gzipBytes < 5 * 1024 * 1024,
    "roh " + Math.round((kopfA.dateien.preise.bytes + kopfA.dateien.volumen.bytes) / 1024) + " KB, gzip " + Math.round((kopfA.dateien.preise.gzipBytes + kopfA.dateien.volumen.gzipBytes) / 1024) + " KB (nachgebildete Daten)"
  );

  // ---- Format: entpacken(packen(x)) ist x ----
  const appF = appLaden(WURZEL, { fetch: wA.fetch, jetzt: wA.jetzt, warte: wA.warte });
  await appF.PREISE.bestandBereit();
  const basis = { staedte: STAEDTE, prioritaet: "hintergrund" };
  await appF.PREISE.preiseAbrufen(faellig.q1.slice(0, 60), Object.assign({ qualitaet: 1 }, basis));
  await appF.PREISE.preiseAlleQualitaetenAbrufen(faellig.alleQ.slice(0, 60), basis);
  await appF.PREISE.absatzAbrufen(faellig.absatz.slice(0, 60), Object.assign({ tageFenster: 7 }, basis));
  appF.PREISE.testBestandSchreiben("volumen", [["Lymhurst::T4_X::v7", { abgerufenAm: wA.t, wert: { id: "T4_X", umsatz7Tage: 3 } }]]);
  appF.PREISE.testBestandSchreiben("preise", [["Lymhurst::T4_Y::q1", { id: "T4_Y", stadt: "lymhurst", sell: { preis: 5, datum: "2026-11-23T10:00:00.5", kein: false }, buy: { preis: null, datum: "", kein: true }, abgerufenAm: wA.t }]]);
  const vorher = appF.PREISE.bestandEintraege();
  const pack = appF.GEMEINSAM.packen(vorher);
  const zurueck = { preise: appF.GEMEINSAM.preiseEntpacken(JSON.parse(JSON.stringify(pack.preise))), volumen: appF.GEMEINSAM.volumenEntpacken(JSON.parse(JSON.stringify(pack.volumen))) };
  pruefe(
    "format: packen und entpacken geben den Bestand unveraendert wieder (Preise, Merker, verkauft/Tag; was nicht in die kurze Form passt, steht woertlich)",
    JSON.stringify(sortiert(zurueck.preise)) === JSON.stringify(sortiert(vorher.preise)) && JSON.stringify(sortiert(zurueck.volumen)) === JSON.stringify(sortiert(vorher.volumen)) && pack.zahl.woertlich === 2 && vorher.preise.length > 2500,
    vorher.preise.length + " Preiseintraege, " + vorher.volumen.length + " Volumeneintraege, woertlich " + pack.zahl.woertlich
  );
  const leereZeilen = Object.keys(pack.preise.p).reduce((a, id) => a + pack.preise.p[id].filter((z) => z.length === 3).length, 0);
  pruefe("format: Zeilen ohne Angebot und ohne Kaufgesuch stehen in der Kurzform [Stadt, Qualitaet, Zeit]", leereZeilen > 0, leereZeilen + " Kurzzeilen");

  // ---- Zusammenfuehren mit vorhandenem Stand ----
  const wB = welt(zutaten, T0 + 2 * 3600000);
  wB.aufschlag = 1000;
  const rB = await starte(wB, "voll", ausA, { maxAbrufe: 6 });
  const kopfB = lies(ausA, "stand.json");
  const pB = basisApp.GEMEINSAM.preiseEntpacken(lies(ausA, "preise.json"));
  const vB = basisApp.GEMEINSAM.volumenEntpacken(lies(ausA, "volumen.json"));
  const neuIds = new Set([].concat(...wB.log.map((x) => idsAus(x.url))));
  const neuP = pB.filter((x) => x[1].abgerufenAm >= T0 + 2 * 3600000);
  const altP = pB.filter((x) => x[1].abgerufenAm < T0 + 2 * 3600000);
  pruefe(
    "zusammenfuehren: --max-abrufe 6 wird eingehalten, der Lauf gilt als abgebrochen und nennt den Grund; vollstaendigAm bleibt beim frueheren Lauf",
    wB.log.length === 6 && rB.abrufe === 6 && rB.abgebrochen === true && /Obergrenze/.test(rB.grund) && kopfB.laeufe.voll.vollstaendigAm === kopfA.laeufe.voll.vollstaendigAm && kopfB.laeufe.voll.begonnenAm === T0 + 2 * 3600000 && kopfB.laeufe.voll.abgebrochen === true,
    wB.log.length + " Abrufe, Grund: " + rB.grund
  );
  pruefe(
    "zusammenfuehren: ersetzt ist nur, was der Lauf neu geholt hat; alles andere steht mit der alten Abrufzeit weiter im Stand",
    neuP.length > 0 && neuP.every((x) => neuIds.has(x[0].split("::")[1])) && altP.length > neuP.length && pB.length === kopfA.dateien.preise.eintraege + kopfA.dateien.preise.merker && vB.length === kopfA.dateien.volumen.eintraege &&
      vB.filter((x) => x[1].abgerufenAm >= T0 + 2 * 3600000).length === 2 * 50 * 7,
    neuP.length + " neue, " + altP.length + " alte Preiseintraege; " + vB.filter((x) => x[1].abgerufenAm >= T0 + 2 * 3600000).length + " neue Volumeneintraege"
  );
  const beispiel = neuP.find((x) => /::q1$/.test(x[0]) && !zutaten.has(x[0].split("::")[1]) && x[1].sell.preis);
  const alterWert = sortiert(basisApp.GEMEINSAM.preiseEntpacken(JSON.parse(JSON.stringify(appF.GEMEINSAM.packen({ preise: [], volumen: [] }).preise)))).length;
  pruefe("zusammenfuehren: ein neu geholter Produktpreis traegt den neuen Wert der Schnittstelle (Aufschlag 1.000)", beispiel && beispiel[1].sell.preis >= 6000 && alterWert === 0, beispiel ? beispiel[0] + " = " + beispiel[1].sell.preis : "kein Beispiel");

  // 8 Tage spaeter: was nicht neu geholt wird, ist aelter als 7 Tage und faellt weg.
  const wC = welt(zutaten, T0 + 8 * TAG);
  const rC = await starte(wC, "voll", ausA, { maxAbrufe: 3 });
  const pC = basisApp.GEMEINSAM.preiseEntpacken(lies(ausA, "preise.json"));
  const vC = basisApp.GEMEINSAM.volumenEntpacken(lies(ausA, "volumen.json"));
  pruefe(
    "zusammenfuehren: Eintraege aelter als 7 Tage werden entfernt, uebrig bleibt nur das frisch Geholte",
    rC.abrufe === 3 && pC.length > 0 && pC.every((x) => x[1].abgerufenAm >= T0 + 8 * TAG) && vC.every((x) => x[1].abgerufenAm >= T0 + 8 * TAG) && pC.length < 5000 && vC.length === 50 * 7,
    pC.length + " Preiseintraege, " + vC.length + " Volumeneintraege"
  );

  // ---- HTTP 429 ----
  const aus429 = tmp();
  const w429 = welt(zutaten);
  w429.stoerung = (nr) => (nr === 5 ? { status: 429, text: "Throttled, be nice to the server, use compression (gzip, deflate, etc)! Throttle resets at " + iso(w429.t + 90000).replace("T", " ") + " +0000!" } : nr === 9 ? { status: 429, text: "Throttled!" } : null);
  const r429 = await starte(w429, "voll", aus429);
  const lange = w429.warten.filter((ms) => ms > 30000);
  pruefe(
    "429: die Reset-Zeit aus dem Antworttext wird gelesen, der Lauf wartet genau einmal bis dahin (plus Marge) und macht weiter",
    lange.length === 1 && lange[0] >= 90000 && lange[0] <= 93000 && w429.log.length === 9,
    "gewartet " + JSON.stringify(lange) + " ms, " + w429.log.length + " Abrufe"
  );
  const k429 = lies(aus429, "stand.json");
  pruefe(
    "429: bei erneuter 429 endet der Lauf sauber, schreibt das Teilergebnis und meldet den Abbruch im Kopf; danach kein weiterer Abruf",
    r429.geschrieben && r429.abgebrochen === true && /429/.test(r429.grund) && r429.erledigt.q1 + r429.erledigt.alleQ + r429.erledigt.absatz === 7 && k429.laeufe.voll.abgebrochen === true && k429.laeufe.voll.vollstaendigAm === null &&
      k429.dateien.preise.eintraege > 0 && k429.dateien.volumen.eintraege > 0 && w429.gleichzeitigMax === 1,
    "erledigt " + JSON.stringify(r429.erledigt) + ", Grund: " + r429.grund
  );
  const aus429b = tmp();
  const w429b = welt(zutaten);
  w429b.stoerung = (nr) => (nr === 2 ? { status: 429, text: "Throttle resets at " + iso(w429b.t + 20 * 60000).replace("T", " ") + " +0000!" } : null);
  const r429b = await starte(w429b, "voll", aus429b);
  pruefe(
    "429: liegt die Reset-Zeit mehr als 5 Minuten entfernt, wartet der Lauf nicht, sondern endet sofort mit Teilergebnis",
    r429b.abgebrochen && w429b.log.length === 2 && !w429b.warten.some((ms) => ms > 30000) && r429b.erledigt.q1 === 1 && fs.existsSync(path.join(aus429b, "stand.json")),
    w429b.log.length + " Abrufe, Grund: " + r429b.grund
  );

  // ---- Netzfehler ----
  const ausN = tmp();
  const wN = welt(zutaten);
  wN.stoerung = (nr) => (nr === 2 || nr === 3 ? { wirf: "fetch failed" } : nr >= 6 && nr <= 8 ? (nr === 7 ? { status: 503, text: "x" } : { wirf: "fetch failed" }) : null);
  const rN = await starte(wN, "voll", ausN);
  pruefe(
    "netzfehler: zwei Fehlversuche und dann eine Antwort zaehlen als Erfolg; drei Fehlversuche in Folge (auch HTTP 503) beenden den Lauf sauber mit Teilergebnis",
    rN.abgebrochen && wN.log.length === 8 && rN.abrufe === 8 && rN.erledigt.q1 + rN.erledigt.alleQ + rN.erledigt.absatz === 3 && /3 Versuchen/.test(rN.grund) && lies(ausN, "stand.json").dateien.preise.eintraege > 0,
    wN.log.length + " Abrufe, erledigt " + JSON.stringify(rN.erledigt) + ", Grund: " + rN.grund
  );
  const ausK = tmp();
  const wK = welt(zutaten);
  wK.stoerung = (nr) => (nr === 2 ? { status: 200, text: "<html>kaputt" } : null);
  const rK = await starte(wK, "voll", ausK, { maxAbrufe: 5 });
  pruefe("netzfehler: eine Antwort, die kein JSON ist, wird wiederholt statt uebernommen", rK.abrufe === 5 && rK.erledigt.q1 + rK.erledigt.alleQ + rK.erledigt.absatz === 4, JSON.stringify(rK.erledigt));

  // ---- Schneller Lauf ----
  const ausS0 = tmp();
  const wS0 = welt(zutaten);
  const rS0 = await starte(wS0, "schnell", ausS0);
  pruefe("schnell: ohne Stand eines vollen Laufs geschieht nichts (kein Abruf, keine Datei), der Lauf endet ohne Fehler", rS0.geschrieben === false && wS0.log.length === 0 && fs.readdirSync(ausS0).length === 0);

  const ausS = tmp();
  const wS1 = welt(zutaten);
  await starte(wS1, "voll", ausS);
  const kopfS1 = lies(ausS, "stand.json");
  const standVorSchnell = { preise: lies(ausS, "preise.json"), volumen: lies(ausS, "volumen.json") };
  const wS2 = welt(zutaten, T0 + 20 * 60000);
  const rS2 = await starte(wS2, "schnell", ausS);
  const kopfS2 = lies(ausS, "stand.json");
  pruefe(
    "schnell: hoechstens 30 Abrufe, nur Preise (kein history/), ein Abruf zur Zeit",
    wS2.log.length > 0 && wS2.log.length <= 30 && rS2.abrufe === wS2.log.length && wS2.log.every((x) => x.url.indexOf("/prices/") !== -1) && wS2.gleichzeitigMax === 1 && !rS2.abgebrochen,
    wS2.log.length + " Abrufe, " + rS2.geplant + " geplant"
  );
  // Gegenprobe der Spitze mit der App: Zeilen je Stadt aus dem Stand des vollen Laufs.
  const appS = appLaden(WURZEL, { fetch: async () => { throw new Error("kein Netz"); }, jetzt: () => T0 + 20 * 60000 });
  await appS.PREISE.bestandBereit();
  appS.PREISE.bestandEinmischen({ preise: appS.GEMEINSAM.preiseEntpacken(standVorSchnell.preise), volumen: appS.GEMEINSAM.volumenEntpacken(standVorSchnell.volumen) }, { jetzt: T0 + 20 * 60000 });
  const GS = appS.GELEGENHEITEN;
  const std = GS.standardEinstellungen();
  const stations = {};
  appS.REGELN.alleGebaeude().forEach((g) => (stations[g] = 400));
  const gemeinsam = { premium: true, absatzAnteilProzent: 10, stationssaetze: stations, tagesbonus: {}, fce: 0, fceAusnahmen: {}, spezialisierung: {}, zusatzbonusProzent: 0, maxPreisAlterMin: 4320, qualitaetsChancenpunkte: 0, essen: null, aufwertungAufschlagProzent: 15.6 };
  const lesenS = { preis: appS.PREISE.bestandPreis, alleQ: appS.PREISE.bestandAlleQualitaeten, absatz: appS.PREISE.bestandAbsatz };
  const bester = new Map();
  const listeS = GS.kandidaten(std);
  STAEDTE.forEach((stadt) => {
    const e = GS.einstellungenBereinigen(Object.assign({}, std, { fertigungsstadt: stadt, einkaufStaedte: [stadt], verkaufStaedte: [stadt] }));
    GS.filtereUndSortiere(GS.zeilenRechnen(listeS, e, gemeinsam, lesenS, T0 + 20 * 60000), e).zeilen.forEach((z) => bester.set(z.schluessel, Math.max(bester.has(z.schluessel) ? bester.get(z.schluessel) : -Infinity, z.gewinnJeTag)));
  });
  const rangS = listeS.filter((x) => bester.has(x.schluessel)).sort((a, b) => bester.get(b.schluessel) - bester.get(a.schluessel) || (a.schluessel < b.schluessel ? -1 : 1));
  const geholtS = new Set([].concat(...wS2.log.map((x) => idsAus(x.url))));
  const kS = rangS.findIndex((x) => !geholtS.has(x.produktId));
  const erlaubt = new Set();
  rangS.forEach((x) => {
    erlaubt.add(x.produktId);
    x.zutatIds.forEach((id) => erlaubt.add(id));
  });
  pruefe(
    "schnell: geholt wird die Spitze nach Gewinn/Tag (die ersten Vorgaenge der Rangliste lueckenlos, mit ihren Zutaten), und nichts ausserhalb der Vorgaenge mit Gewinn",
    rangS.length > 100 && (kS === -1 || kS > 100) && rangS.slice(0, kS === -1 ? rangS.length : kS).every((x) => x.zutatIds.every((id) => geholtS.has(id))) && Array.from(geholtS).every((id) => erlaubt.has(id)),
    rangS.length + " Vorgaenge mit Gewinn, die ersten " + (kS === -1 ? rangS.length : kS) + " geholt, " + geholtS.size + " IDs"
  );
  pruefe(
    "schnell: der Kopf fuehrt den schnellen Lauf neben dem vollen; preise.json gilt als geaendert, volumen.json nicht",
    kopfS2.laeufe.schnell.vollstaendigAm === kopfS2.erzeugtAm && kopfS2.laeufe.voll.vollstaendigAm === kopfS1.laeufe.voll.vollstaendigAm && kopfS2.letzterLauf.art === "schnell" && kopfS2.dateien.preise.geaendertAm === kopfS2.erzeugtAm &&
      kopfS2.dateien.volumen.geaendertAm === kopfS1.dateien.volumen.geaendertAm && kopfS2.dateien.preise.eintraege === kopfS1.dateien.preise.eintraege && kopfS2.dateien.volumen.eintraege === kopfS1.dateien.volumen.eintraege,
    JSON.stringify(kopfS2.laeufe.schnell)
  );
  const wS3 = welt(zutaten, T0 + 40 * 60000);
  const rS3 = await starte(wS3, "schnell", ausS, { maxAbrufe: 4 });
  pruefe("schnell: --max-abrufe 4 verkleinert die Spitze, der Lauf bleibt vollstaendig", wS3.log.length > 0 && wS3.log.length <= 4 && !rS3.abgebrochen, wS3.log.length + " Abrufe");

  // ---- Kopfzeilen: echtes fetch von Node gegen einen lokalen Server ----
  const kopfzeilen = [];
  const wH = welt(zutaten);
  const server = http.createServer((req, res) => {
    kopfzeilen.push(req.headers);
    const ziel = new URL(req.url, "http://x").searchParams.get("u");
    const koerper = zlib.gzipSync(JSON.stringify(wH.antwortFuer(ziel)));
    res.writeHead(200, { "Content-Type": "application/json", "Content-Encoding": "gzip" });
    res.end(koerper);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const ausH = tmp();
  const rH = await lauf({ art: "voll", aus: ausH, wurzel: WURZEL, maxAbrufe: 2, fetch: (url, init) => fetch("http://127.0.0.1:" + port + "/?u=" + encodeURIComponent(url), init), warte: () => Promise.resolve(), log: still });
  await new Promise((r) => server.close(r));
  pruefe(
    "kopfzeilen: das fetch von Node verlangt gzip (Accept-Encoding), sendet den User-Agent des Skripts und entpackt die Antwort",
    kopfzeilen.length === 2 && kopfzeilen.every((h) => /gzip/.test(h["accept-encoding"] || "") && h["user-agent"] === USER_AGENT) && rH.erledigt.q1 + rH.erledigt.alleQ === 2 && lies(ausH, "stand.json").dateien.preise.eintraege > 0,
    kopfzeilen.length ? "accept-encoding: " + kopfzeilen[0]["accept-encoding"] + ", user-agent: " + kopfzeilen[0]["user-agent"] : "kein Abruf"
  );

  // ---- Rundlauf: Skript -> Dateien -> Lader der App -> Rangliste ----
  // Seite 1: der Stand des Skripts (ausS1, voller Lauf bei T0), in einer
  // frischen App ueber den Lader eingemischt. Seite 2: eine frische App, deren
  // Bestand mit denselben Antworten ueber die Abruffunktionen der App gefuellt
  // wird. Beide rechnen "Gelegenheiten" zur selben Zeit.
  const ausR = tmp();
  const wR = welt(zutaten);
  await starte(wR, "voll", ausR);
  const ZEIT = wR.t + 60000;
  const umfang = { warengruppen: std.warengruppen, rohstoffe: std.rohstoffe, einkaufStaedte: ["Lymhurst", "Martlock"], verkaufStaedte: ["Lymhurst", "Thetford", "Caerleon"], fertigungsstadt: "Lymhurst", scanAn: false };
  const rangliste = async (app) => {
    const m = app.GELEGENHEITEN.erzeugen({ einstellungen: umfang, einstellungenLesen: () => gemeinsam, jetzt: () => ZEIT });
    await m.oeffnen();
    await m.fertig();
    const r = m.rangliste();
    m.beenden();
    return r;
  };
  const app1 = appLaden(WURZEL, { fetch: async () => { throw new Error("kein Netz"); }, jetzt: () => ZEIT });
  let githubAbrufe = 0;
  const github = async (url) => {
    githubAbrufe++;
    const name = String(url).split("/").pop();
    return { status: 200, ok: true, json: async () => lies(ausR, name) };
  };
  const lader = app1.GEMEINSAM.erzeugen({ fetch: github, jetzt: () => ZEIT, speicherKey: null, basisUrl: "https://beispiel.invalid/daten/" });
  const geladen = await lader.laden();
  const r1 = await rangliste(app1);
  const wR2 = welt(zutaten);
  const app2 = appLaden(WURZEL, { fetch: wR2.fetch, jetzt: wR2.jetzt, warte: wR2.warte });
  await app2.PREISE.bestandBereit();
  const b2 = { staedte: STAEDTE, prioritaet: "hintergrund" };
  await app2.PREISE.preiseAbrufen(faellig.q1, Object.assign({ qualitaet: 1 }, b2));
  await app2.PREISE.preiseAlleQualitaetenAbrufen(faellig.alleQ, b2);
  await app2.PREISE.absatzAbrufen(faellig.absatz.concat(faellig.zutatAbsatz), Object.assign({ tageFenster: 7 }, b2));
  const r2 = await rangliste(app2);
  const FELDER = ["schluessel", "art", "silber", "erloes", "gewinn", "marge", "stueckJeTag", "gewinnJeTag", "mehrgewinnJeFokus", "rrr", "gebuehr", "vkStadt", "produktPreis", "tagGrenze", "einkaufZutat"];
  const kern = (z) => JSON.stringify(FELDER.map((f) => (z[f] === undefined ? null : z[f])).concat([(z.zutatenPreise || []).map((x) => [x.marktId, x.menge, x.stadt, x.basisPreis])]));
  const abweichend = r1.zeilen.filter((z, i) => !r2.zeilen[i] || kern(z) !== kern(r2.zeilen[i]));
  pruefe(
    "rundlauf: der Lader mischt den Stand des Skripts vollstaendig ein (Kopf und zwei Dateien, drei Abrufe)",
    geladen && geladen.geladen === 2 && githubAbrufe === 3 && lader.status().zustand === "ok" && lader.status().uebernommen.preise === app2.PREISE.bestandInfo().preise && lader.status().uebernommen.volumen === app2.PREISE.bestandInfo().volumen,
    JSON.stringify(lader.status().uebernommen) + " gegen " + app2.PREISE.bestandInfo().preise + " / " + app2.PREISE.bestandInfo().volumen
  );
  pruefe(
    "rundlauf: aus dem Stand des Skripts rechnet \"Gelegenheiten\" dieselben Zeilen in derselben Reihenfolge wie aus einem Bestand, den die Abruffunktionen der App mit denselben Antworten gefuellt haben",
    r1.zeilen.length > 200 && r1.zeilen.length === r2.zeilen.length && r1.ausgeblendet === r2.ausgeblendet && r1.gerechnet === r2.gerechnet && abweichend.length === 0,
    r1.zeilen.length + " gegen " + r2.zeilen.length + " Zeilen der Rangliste (" + r1.gerechnet + " gerechnet), abweichend " + abweichend.length + (abweichend.length ? ", z.B. " + abweichend[0].schluessel : "")
  );

  // v3.25.1: "Cache leeren" darf den gemeinsamen Stand nicht bis zum naechsten
  // Lauf bei GitHub verlieren. nachLeeren() mischt ihn sofort wieder ein, auch
  // wenn der Bestand schon wieder Eintraege hat (dann zaehlte der Merker bisher).
  const clVorher = app1.PREISE.bestandInfo();
  app1.PREISE.preisCacheLeeren();
  const clLeer = app1.PREISE.bestandInfo();
  const clAbrufeVor = githubAbrufe;
  const clNeu1 = await lader.nachLeeren();
  const clNach1 = app1.PREISE.bestandInfo();
  const clOhne = await lader.laden();
  const clNeu2 = await lader.nachLeeren();
  pruefe(
    "cache leeren: nachLeeren() mischt den gemeinsamen Stand sofort wieder vollstaendig ein; laden() allein holt danach nichts, nachLeeren() holt auch bei gefuelltem Bestand neu",
    clLeer.preise === 0 && clLeer.volumen === 0 && clNeu1 && clNeu1.geladen === 2 && clNach1.preise === clVorher.preise && clNach1.volumen === clVorher.volumen && clOhne && clOhne.geladen === 0 && clNeu2 && clNeu2.geladen === 2 && githubAbrufe === clAbrufeVor + 3 + 1 + 3,
    JSON.stringify({ vorher: clVorher, leer: clLeer, nach: clNach1, neu1: clNeu1 && clNeu1.geladen, ohne: clOhne && clOhne.geladen, neu2: clNeu2 && clNeu2.geladen, abrufe: githubAbrufe - clAbrufeVor })
  );

  const ok = ergebnisse.filter((e) => e.ok).length;
  console.log("\n" + ok + "/" + ergebnisse.length + " Tests gruen");
  process.exit(ok === ergebnisse.length ? 0 : 1);
}

haupt().catch((e) => {
  console.error("Testlauf abgebrochen: " + ((e && e.stack) || e));
  process.exit(1);
});
