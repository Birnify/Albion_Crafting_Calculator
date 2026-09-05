// js/rechenkern.js
//
// Rechenkern des Kostenrechners: kosten(item, stufe, menge, opts) ermittelt
// den guenstigsten Beschaffungsweg fuer einen Knoten (Item, Verzauberungsstufe)
// ueber den ganzen Rezeptbaum, s. kostenrechner-PLAN.md Abschnitt 4. Reine
// Funktionen, kein DOM, kein fetch (Preise kommen fertig aufbereitet ueber
// opts.preise/opts.eigenpreise herein, s. js/preise.js).
//
// Drei Wegearten je Knoten, alle rekursiv:
//   KAUFEN     - Marktpreis, gesperrt ohne Preis (NIE Kosten 0)
//   CRAFTEN    - jedes Alternativrezept einzeln, je einmal mit und einmal
//                ohne Fokus (die Zielfunktion entscheidet danach automatisch,
//                s. kostenrechner-PLAN.md Abschnitt 4.2) - AUSSER eine Regel
//                aus opts.fokusRegelJeKategorie/opts.fokusUebersteuerungJeKnoten
//                gibt "immer" oder "nie" fest vor (Feature "Fokuseinsatz
//                steuerbar machen", 05.09.2026, s. fokusRegelFuer())
//   VERZAUBERN - nur Stufe >= 1 mit vorhandenem upgraderequirements, kostet
//                selbst weder Stationsgebuehr noch Fokus (vom Nutzer im Spiel
//                bestaetigt), nur die Vorstufe plus Rune/Seele/Relikt
//
// Rueckgabe von kosten(): { silber, fokus, wert, weg, gesperrt, grund, menge,
// alleWege }. `weg` ist der vollstaendige Bauplan als Baum (Mengenangaben
// darin sind je Stueck des jeweils uebergeordneten Schritts, nicht auf die
// angeforderte `menge` hochgerechnet - nur die Summenfelder silber/fokus/wert
// sind bereits mit `menge` skaliert). `alleWege` listet ausnahmslos jeden
// Weg, sortiert nach der Zielfunktion, inklusive gesperrter Wege (gesperrt:
// true, wert: Infinity) - genau die aus dem Plan geforderte Transparenz.
//
// Besuchsschutz: ein Set aus "item@stufe"-Schluesseln des aktuellen
// Rekursionspfads verhindert Endlosschleifen bei einem (in echten
// Spieldaten nicht vorkommenden, aber testweise konstruierbaren) Zyklus.
// Zusaetzlich eine Tiefenbegrenzung (opts.maxTiefe, Default 40).

const RECHENKERN = (function () {
  "use strict";

  const STANDARD_MAX_TIEFE = 40;

  function aktuellerGraph(graph) {
    if (graph) return graph;
    return typeof REZEPTGRAPH !== "undefined" ? REZEPTGRAPH : null;
  }

  function normOpts(options) {
    const o = options || {};
    return {
      graph: aktuellerGraph(o.graph),
      preise: o.preise || {}, // marktId -> {sell:{preis,kein}, buy:{preis,kein}}
      eigenpreise: o.eigenpreise || {}, // marktId/uniquename -> Silber je Stueck
      kaufweg: o.kaufweg || "sofort", // "sofort" | "order"
      stadt: o.stadt || "Lymhurst",
      stationssaetze: o.stationssaetze || {}, // Gebaeude/Gebuehrengruppe -> Satz (z.B. 380)
      fce: o.fce != null ? o.fce : 0, // globale Focus Cost Efficiency
      // craftingcategory -> FCE (Freitext/Fallback) UND/ODER "craftingcategory|Gruppe" -> FCE
      // (aus dem Spezialisierungsknoten-Panel abgeleitet, s. fceFuer() unten).
      fceUeberschreibungen: o.fceUeberschreibungen || {},
      // Fokuseinsatz steuerbar machen (Feature 05.09.2026): zwei Ebenen nach
      // demselben Muster wie fceUeberschreibungen oben, s. dortiger Kommentar
      // und fokusRegelFuer() weiter unten. Werte je "immer"/"nie", ein
      // fehlender Eintrag bedeutet weiterhin Automatik (Zielfunktion
      // entscheidet, unveraendertes Verhalten).
      fokusRegelJeKategorie: o.fokusRegelJeKategorie || {}, // craftingcategory -> "immer"|"nie"
      fokusUebersteuerungJeKnoten: o.fokusUebersteuerungJeKnoten || {}, // "item@stufe" -> "immer"|"nie", schlaegt die Kategorie-Regel
      fokuswert: o.fokuswert != null ? o.fokuswert : 0, // Silber je Fokuspunkt (Zielfunktion)
      tagesbonus: o.tagesbonus || {}, // craftingcategory -> "silber"|"gold"
      maxTiefe: o.maxTiefe || STANDARD_MAX_TIEFE,
      // Hoechstalter eines Marktpreises in Minuten (Datum aus preise.js,
      // sell_price_min_date/buy_price_max_date). null = keine Grenze. Ohne
      // diese Sperre wuerde ein wochenalter Preis unveraendert als gueltig
      // durchgehen, entgegen kostenrechner-PLAN.md Abschnitt 4.1 ("gesperrt,
      // wenn kein Preis vorliegt ODER der Preis aelter ist als die
      // eingestellte Hoechstgrenze"). Eingabefeld dafuer ist P5, hier nur der
      // Mechanismus. Von rechenkern-pruefer am 04.09.2026 gefunden (Befund 2, P3).
      maxPreisAlterMin: o.maxPreisAlterMin != null ? o.maxPreisAlterMin : null,
      // Qualitaetsstufen (Feature 05.09.2026, s. kostenrechner-KONTEXT.md):
      // qualitaetsIndex ist die globale ZIELQUALITAET fuer die ganze Rechnung
      // (0 = Normal = unveraendertes Verhalten, 1..4 = Gut..Meisterwerk).
      // preiseQualitaet ist ein ZWEITER Preis-Datensatz, nur fuer die Markt-IDs
      // der Wurzel und der preservequality-/Verzauber-Kette, in genau dieser
      // Zielqualitaet abgerufen (s. js/preise.js, sammleQualitaetsMarktIds),
      // GETRENNT von opts.preise (das bleibt immer Normal-Qualitaet fuer den
      // Rest des Baums, s. CLAUDE.md/kostenrechner-KONTEXT.md: gewoehnliche
      // Zutaten sind qualitaetsunabhaengig). qualitaetsChancenpunkte ist der
      // vom Nutzer am Schicksalsbrett abgelesene Bonus fuer Korns
      // Qualitaetswurf-Formel (s. REGELN.qualitaetWurfErfolgswahrscheinlichkeit).
      qualitaetsIndex: o.qualitaetsIndex != null ? o.qualitaetsIndex : 0,
      qualitaetsChancenpunkte: o.qualitaetsChancenpunkte != null ? o.qualitaetsChancenpunkte : 0,
      preiseQualitaet: o.preiseQualitaet || {},
      _memoGesamt: o._memoGesamt || new Map(),
      _memoCraft: o._memoCraft || new Map(),
      _memoQualitaet: o._memoQualitaet || new Map(),
      _memoCraftQualitaet: o._memoCraftQualitaet || new Map(),
    };
  }

  /**
   * Effektive FCE fuer einen Craft-Schritt, drei Ebenen, jede schlaegt die
   * naechst allgemeinere (05.09.2026, Zyklus "FCE-Ableitung ueber
   * Schicksalsbrett-Knotenliste je Kategorie"):
   *   1. Knoten-spezifisch: opts.fceUeberschreibungen["cc|Gruppe"], befuellt
   *      aus dem Spezialisierungsknoten-Panel (s. REGELN.fceAusSpezialisierungsknoten()).
   *   2. Kategorie-weiter Freitext: opts.fceUeberschreibungen[cc], die
   *      urspruengliche P5-Ausnahme, jetzt zugleich der Fallback fuer
   *      Kategorien ohne abgeleitete Knotenliste (offhand/knuckles/meat_*)
   *      bzw. fuer Faelle, in denen die automatische Gruppierung nicht passt.
   *   3. Globaler Wert: opts.fce.
   * js/ui.js befuellt beide Ueberschreibungs-Schluessel in derselben Map,
   * s. dort fceUeberschreibungenFuerOpts().
   */
  function fceFuer(item, cc, opts) {
    if (cc) {
      const knotenSchluessel = cc + "|" + REGELN.gruppenSchluesselVonItem(item);
      if (opts.fceUeberschreibungen[knotenSchluessel] != null) return opts.fceUeberschreibungen[knotenSchluessel];
      if (opts.fceUeberschreibungen[cc] != null) return opts.fceUeberschreibungen[cc];
    }
    return opts.fce;
  }

  /**
   * Ob fuer einen Knoten (item, stufe) der Fokuseinsatz beim Craften fest
   * vorgegeben ist ("immer"/"nie") oder weiterhin automatisch ueber die
   * Zielfunktion entscheidet, s. kostenrechner-KONTEXT.md Feature
   * "Fokuseinsatz steuerbar machen". Vorrangreihenfolge, wie beauftragt:
   * Knoten-Uebersteuerung schlaegt Kategorie-Regel schlaegt Automatik. Ohne
   * gesetzte Regel/Uebersteuerung ist das Ergebnis immer "automatisch" -
   * exakt das bisherige Verhalten (beide Kandidaten werden erzeugt, die
   * Zielfunktion waehlt).
   *
   * `grund` ist nur bei "immer"/"nie" gesetzt und wird als Sperrgrund fuer
   * die dadurch ausgeschlossene Variante verwendet (s. Aufrufer in
   * kostenGesamt), damit ein Nutzer in der Alle-Wege-Tabelle sieht, WARUM
   * eine Variante fehlt, statt dass sie kommentarlos verschwindet.
   *
   * @returns {{wert: "immer"|"nie"|"automatisch", grund: ?string}}
   */
  function fokusRegelFuer(item, stufe, cc, opts) {
    const knotenSchluessel = item + "@" + stufe;
    const knotenWert = opts.fokusUebersteuerungJeKnoten[knotenSchluessel];
    if (knotenWert === "immer" || knotenWert === "nie") {
      return { wert: knotenWert, grund: "Knoten-Uebersteuerung fuer " + knotenSchluessel + " (" + knotenWert + ")" };
    }
    const kategorieWert = cc ? opts.fokusRegelJeKategorie[cc] : null;
    if (kategorieWert === "immer" || kategorieWert === "nie") {
      return { wert: kategorieWert, grund: "Kategorie-Regel " + cc + " (" + kategorieWert + ")" };
    }
    return { wert: "automatisch", grund: null };
  }

  function tagesbonusFuer(cc, opts) {
    return (cc && opts.tagesbonus[cc]) || null;
  }

  // Gleiche Regel wie PREISE.marktId() in js/preise.js (dort ausfuehrlich
  // begruendet): node.el hat Vorrang vor der Kontextstufe, nicht Addition.
  // Hier lokal nachgebaut statt PREISE direkt zu benutzen, damit der
  // Rechenkern auch mit einem injizierten Test-Graphen ohne PREISE/rezepte.js
  // funktioniert (s. Zyklustest in tests/test.html).
  function marktIdVon(graph, uniquename, stufeAusKontext) {
    const node = (graph && graph.items[uniquename]) || {};
    const effektiveStufe = node.el ? node.el : stufeAusKontext || 0;
    return effektiveStufe > 0 ? uniquename + "@" + effektiveStufe : uniquename;
  }

  function zutatStufe(graph, zutatName, zutatL) {
    const node = graph.items[zutatName];
    const el = node && node.el;
    return el ? el : zutatL || 0;
  }

  // -----------------------------------------------------------------------
  // Kandidaten-Konstruktoren
  // -----------------------------------------------------------------------

  function gesperrterKandidat(typ, item, stufe, grund, extra) {
    return {
      typ,
      gesperrt: true,
      grund,
      silber: null,
      fokus: null,
      wert: Infinity,
      // unvollstaendig/fehlendeGebaeude auch hier mitfuehren (immer false/leer),
      // damit Aufrufer (v.a. ui.js) nicht erst auf gesperrt pruefen muessen,
      // bevor sie diese Felder lesen.
      unvollstaendig: false,
      fehlendeGebaeude: [],
      weg: Object.assign({ typ: "gesperrt", ursprungsTyp: typ, item, stufe, grund }, extra || {}),
    };
  }

  /**
   * Ermittelt den Stationssatz fuer ein Gebaeude, UNTERSCHEIDET dabei "nicht
   * gepflegt" von "ausdruecklich auf 0 gesetzt". Ein fehlender Satz ist KEIN
   * gueltiger 0er-Wert, sondern eine fehlende Angabe: ohne diese Unterscheidung
   * wuerde jeder Craft-Weg mit ungepflegtem Gebaeude stillschweigend zu billig
   * gerechnet, derselbe Fehlertyp wie ein Marktpreis von genau 0
   * (rechenkern-pruefer, P3). Ein echter Satz von 0 ist im Spiel moeglich
   * (eigene Insel, gebuehrenfreie Gildenstation) und bleibt gueltig, wenn er
   * ausdruecklich als Zahl (auch 0) in opts.stationssaetze steht.
   *
   * ui.js muss deshalb ein leeres Eingabefeld als FEHLENDEN Schluessel
   * uebergeben (nicht als 0), eine ausdrueckliche 0-Eingabe dagegen als
   * Zahl 0.
   *
   * Validiert den Rohwert ausdruecklich, statt ihm blind zu vertrauen
   * (rechenkern-pruefer, P5-Nacharbeit, Befund 1 und 2): ein negativer Satz
   * wuerde eine negative Gebuehr erzeugen und die Rechnung UNTER die
   * gewollte Untergrenze druecken, dabei aber gepflegt:true melden - selbe
   * Fehlerfamilie wie ein Marktpreis von 0 (P3) und ein fehlender Satz, der
   * als 0 durchgeht (P5, Befund oben): ein unsinniger Wert wird als
   * gueltig gelesen statt als fehlend. Leerer String und NaN faellen sonst
   * zufaellig unauffaellig aus (regeln.js hat in stationsgebuehr() ein
   * defensives `stationssatz || 0`), melden dabei aber faelschlich
   * gepflegt:true und unterdruecken so die Unvollstaendig-Warnung. Diese
   * Funktion ist deshalb bewusst nicht auf einen wohlerzogenen Aufrufer
   * angewiesen: nur eine endliche Zahl >= 0 gilt als gepflegt, alles
   * andere (fehlt, null, leerer String, NaN, negativ) als nicht gepflegt.
   *
   * @returns {{satz: number, gepflegt: boolean}} satz ist bei fehlender
   *   Angabe 0 (wird als Untergrenze weitergerechnet, s. craftKandidat),
   *   gepflegt zeigt an, ob das eine echte, gueltige Angabe war.
   */
  function stationssatzFuer(gebaeude, opts) {
    if (!gebaeude) return { satz: 0, gepflegt: true }; // kein Gebaeude noetig (z.B. koenigliche Items ohne craftingcategory)
    const roh = opts.stationssaetze[gebaeude];
    if (roh == null) return { satz: 0, gepflegt: false };
    if (typeof roh === "string" && roh.trim() === "") return { satz: 0, gepflegt: false };
    const zahl = Number(roh);
    if (!isFinite(zahl) || zahl < 0) return { satz: 0, gepflegt: false };
    return { satz: zahl, gepflegt: true };
  }

  /**
   * Ermittelt den Kaufpreis je Stueck fuer eine Markt-ID, oder eine
   * menschenlesbare Begruendung, warum keiner gilt. Ein Preis von genau 0
   * oder darunter zaehlt als "kein Preis" (nicht als gueltiger Kaufpreis 0),
   * egal ob er aus opts.preise oder aus einem Eigenpreis stammt - beides ist
   * ein Nutzerfehler oder ein Datenfehler, nie ein echtes 0-Silber-Angebot.
   * Zusaetzlich zaehlt ein Marktpreis als "kein Preis", wenn er aelter ist
   * als opts.maxPreisAlterMin (Datum aus preise.js). Eigenpreise haben kein
   * Alter (feste Nutzereingabe) und sind davon nicht betroffen.
   *
   * `eigenpreis` im Rueckgabewert zeigt an, ob ein gueltiger Preis aus einem
   * hinterlegten Eigenpreis stammt statt aus einem echten Marktpreis (P6).
   * kaufKandidat() reicht das in weg.eigenpreis weiter, damit die Oberflaeche
   * im Bauplan sichtbar machen kann, wo eine Rechnung auf einer eigenen
   * Schaetzung statt auf Marktdaten beruht - nicht nur, wo ein Preis fehlt.
   */
  function preisMitGrund(marktId, opts) {
    const eintrag = opts.preise[marktId];
    if (eintrag) {
      const seite = opts.kaufweg === "order" ? eintrag.buy : eintrag.sell;
      if (seite && !seite.kein && seite.preis != null) {
        if (seite.preis <= 0) {
          return { preis: null, grund: "Preis fuer " + marktId + " ist 0 oder kleiner und gilt als kein Preis, nicht als kostenloses Angebot", eigenpreis: false };
        }
        if (opts.maxPreisAlterMin != null && seite.datum) {
          const alterMin = (Date.now() - REGELN.parseApiDatumUtc(seite.datum)) / 60000;
          if (isFinite(alterMin) && alterMin > opts.maxPreisAlterMin) {
            return {
              preis: null,
              grund: "Preis fuer " + marktId + " ist " + Math.round(alterMin) + " Minuten alt, ueber der Hoechstgrenze von " + opts.maxPreisAlterMin + " Minuten",
              eigenpreis: false,
            };
          }
        }
        return { preis: REGELN.kaufKostenJeStueck(seite.preis, opts.kaufweg), grund: null, eigenpreis: false };
      }
    }
    const eigen = opts.eigenpreise[marktId];
    if (eigen != null) {
      if (eigen <= 0) {
        return { preis: null, grund: "Eigenpreis fuer " + marktId + " ist 0 oder kleiner und gilt als kein Preis", eigenpreis: true };
      }
      return { preis: eigen, grund: null, eigenpreis: true };
    }
    return { preis: null, grund: "kein Preis fuer " + marktId + " (" + opts.kaufweg + ") und kein Eigenpreis hinterlegt", eigenpreis: false };
  }

  function kaufKandidat(item, stufe, opts) {
    const marktId = marktIdVon(opts.graph, item, stufe);
    const info = preisMitGrund(marktId, opts);
    if (info.preis == null) {
      // marktId auch im gesperrten Fall mitgeben (P5): die Oberflaeche bietet
      // darueber gezielt einen Eigenpreis fuer genau diese Markt-ID an, wenn
      // der Grund "kein Preis" ist (nicht bei "zu alt" - da hilft kein
      // Eigenpreis, s. preisMitGrund()-Kommentar oben).
      return gesperrterKandidat("kaufen", item, stufe, info.grund, { marktId });
    }
    return {
      typ: "kaufen",
      gesperrt: false,
      grund: null,
      silber: info.preis,
      fokus: 0,
      wert: info.preis,
      unvollstaendig: false,
      fehlendeGebaeude: [],
      weg: { typ: "kaufen", item, stufe, marktId, kaufweg: opts.kaufweg, preisJeStueck: info.preis, eigenpreis: !!info.eigenpreis },
    };
  }

  /** Craft-Kandidat fuer EIN Alternativrezept, EINMAL mit fest gewaehltem mitFokus. */
  function craftKandidat(item, stufe, rezept, rezeptIndex, mitFokus, node, opts, tiefe, pfad) {
    const eigenerSchluessel = item + "@" + stufe;
    const memoKey = eigenerSchluessel + "@" + rezeptIndex + "@" + (mitFokus ? 1 : 0);

    // Kein eigener Zyklus-/Tiefencheck hier: der Aufrufer kostenGesamt() hat
    // (item, stufe) bereits VOR dem Aufruf gegen den Pfad geprueft, in dem
    // `pfad` selbst noch nicht enthalten war, und erst danach sich selbst
    // eingetragen (neuerPfad), bevor craftKandidat() aufgerufen wird. `pfad`
    // enthaelt also an dieser Stelle immer bereits eigenerSchluessel - ein
    // Check dagegen wuerde jeden Aufruf faelschlich als Zyklus melden. Ein
    // echter Zyklus (Zutat verlangt wieder item@stufe) wird stattdessen beim
    // rekursiven kostenGesamt()-Aufruf fuer die Zutat weiter unten erkannt.
    if (opts._memoCraft.has(memoKey)) return opts._memoCraft.get(memoKey);

    // Waehrungskosten (Gunst, Fraktionspunkte, ...) sind in v1 nicht bepreisbar.
    if (rezept.cur && rezept.cur.length) {
      const namen = rezept.cur.map((c) => c.n).join(", ");
      const g = gesperrterKandidat("craften", item, stufe, "Waehrungskosten (" + namen + ") sind nicht bepreisbar", { rezeptIndex, mitFokus });
      opts._memoCraft.set(memoKey, g);
      return g;
    }

    const amountcrafted = rezept.a || 1;
    const cc = node.cc || null;
    const gebaeude = REGELN.gebaeudeVonKategorie(cc);
    const stationsInfo = stationssatzFuer(gebaeude, opts);
    const stationssatz = stationsInfo.satz;
    const fce = fceFuer(item, cc, opts);
    const fokusJeStueck = mitFokus ? REGELN.fokusKosten(rezept.f, fce, 1) / amountcrafted : 0;
    const rrrWert = REGELN.rrr({ cc, stadt: opts.stadt, mitFokus, tagesbonus: tagesbonusFuer(cc, opts) });
    const itemWertJeStueck = REGELN.itemWert(item, stufe, rezept, opts.graph);
    const stationsgebuehrJeStueck = REGELN.stationsgebuehr(itemWertJeStueck, 1, stationssatz);
    const rezeptSilberJeStueck = (rezept.s || 0) / amountcrafted;

    const neuerPfad = new Set(pfad);
    neuerPfad.add(eigenerSchluessel);

    // unvollstaendig/fehlendeGebaeude: eigener Stationssatz plus alles, was aus
    // den Zutaten weiter unten im Baum hochgereicht wird. Ein fehlender Satz
    // sperrt den Weg NICHT (das waere fuer eine erste Naeherung zu hart), er
    // rechnet mit 0 als Untergrenze und markiert das Ergebnis sichtbar als
    // unvollstaendig, s. stationssatzFuer() oben.
    let unvollstaendig = gebaeude != null && !stationsInfo.gepflegt;
    const fehlendeGebaeude = unvollstaendig ? [gebaeude] : [];

    let materialSilber = 0;
    let materialFokus = 0;
    let gesperrt = false;
    let grund = null;
    const zutatenWeg = [];

    (rezept.i || []).forEach((zutat) => {
      const zStufe = zutatStufe(opts.graph, zutat.n, zutat.l);
      // Stetige Menge, bewusste Vereinfachung fuer v1 (kostenrechner-PLAN.md
      // Abschnitt 4.4): bei amountcrafted > 1 wird nicht auf ganze Chargen
      // aufgerundet, sondern der Bruchteil einer Charge anteilig verrechnet.
      // Weicht bei krummen Mengen leicht vom tatsaechlichen Ingame-Ergebnis
      // ab (man craftet immer ganze Chargen), ist aber fuer eine
      // Kostenschaetzung ausreichend und war ausdruecklich so vorgesehen.
      const mengeJeStueck = zutat.c / amountcrafted;
      const kindErgebnis = kostenGesamt(zutat.n, zStufe, opts, tiefe + 1, neuerPfad);
      const kind = kindErgebnis.beste;
      if (kind.gesperrt) {
        gesperrt = true;
        grund = grund || "Zutat " + zutat.n + "@" + zStufe + " gesperrt: " + kind.grund;
        zutatenWeg.push({ item: zutat.n, stufe: zStufe, menge: mengeJeStueck, gesperrt: true, weg: kind.weg });
        return;
      }
      const ruecklaufWirksam = zutat.m === 0 ? 0 : rrrWert;
      const effektiveMenge = mengeJeStueck * (1 - ruecklaufWirksam);
      materialSilber += kind.silber * effektiveMenge;
      materialFokus += kind.fokus * effektiveMenge;
      if (kind.unvollstaendig) {
        unvollstaendig = true;
        (kind.fehlendeGebaeude || []).forEach((g) => {
          if (fehlendeGebaeude.indexOf(g) === -1) fehlendeGebaeude.push(g);
        });
      }
      zutatenWeg.push({
        item: zutat.n,
        stufe: zStufe,
        menge: mengeJeStueck,
        ruecklaufAusgeschlossen: zutat.m === 0,
        ruecklaufAnteil: ruecklaufWirksam,
        effektiveMenge,
        silberJeStueck: kind.silber,
        fokusJeStueck: kind.fokus,
        weg: kind.weg,
      });
    });

    let ergebnis;
    if (gesperrt) {
      ergebnis = gesperrterKandidat("craften", item, stufe, grund, { rezeptIndex, mitFokus, zutaten: zutatenWeg });
    } else {
      const silber = materialSilber + stationsgebuehrJeStueck + rezeptSilberJeStueck;
      const fokus = materialFokus + fokusJeStueck;
      const wert = silber + fokus * opts.fokuswert;
      ergebnis = {
        typ: "craften",
        gesperrt: false,
        grund: null,
        silber,
        fokus,
        wert,
        unvollstaendig,
        fehlendeGebaeude,
        weg: {
          typ: "craften",
          item,
          stufe,
          rezeptIndex,
          mitFokus,
          amountcrafted,
          craftingcategory: cc,
          gebaeude,
          stationssatz,
          gebaeudeGepflegt: stationsInfo.gepflegt,
          itemWertJeStueck,
          stationsgebuehrJeStueck,
          rezeptSilberJeStueck,
          // Rohfokus laut Dump (rezept.f), unabhaengig von mitFokus. Dient P5
          // als Referenzwert fuer den "abgelesenen Fokus"-Umrechner in der
          // Oberflaeche: der Nutzer liest im Craft-Fenster GENAU DIESES Items
          // seinen eigenen Fokuswert ab und die Oberflaeche rechnet daraus die
          // FCE aus (REGELN.fceAusAbgelesenemFokus), ohne dass er den
          // Rohfokus selbst nachschlagen muesste.
          grundfokus: rezept.f || 0,
          fokusJeStueck,
          rrr: rrrWert,
          unvollstaendig,
          fehlendeGebaeude,
          zutaten: zutatenWeg,
        },
      };
    }

    opts._memoCraft.set(memoKey, ergebnis);
    return ergebnis;
  }

  function verzaubernKandidat(item, stufe, upgradeObj, opts, tiefe, pfad) {
    const eigenerSchluessel = item + "@" + stufe;
    const vorstufeErgebnis = kostenGesamt(item, stufe - 1, opts, tiefe + 1, pfad);
    const vorstufe = vorstufeErgebnis.beste;
    if (vorstufe.gesperrt) {
      return gesperrterKandidat("verzaubern", item, stufe, "Vorstufe " + item + "@" + (stufe - 1) + " gesperrt: " + vorstufe.grund, { vorstufe: vorstufe.weg });
    }

    let materialSilber = 0;
    let materialFokus = 0;
    let gesperrt = false;
    let grund = null;
    // Verzaubern selbst braucht kein Gebaeude/keinen Stationssatz (vom Nutzer
    // im Spiel bestaetigt); unvollstaendig kann trotzdem aus der Vorstufe oder
    // den Materialien hochgereicht werden.
    let unvollstaendig = vorstufe.unvollstaendig || false;
    const fehlendeGebaeude = (vorstufe.fehlendeGebaeude || []).slice();
    const materialien = [];

    (upgradeObj.res || []).forEach((mat) => {
      const matStufe = (opts.graph.items[mat.n] && opts.graph.items[mat.n].el) || 0;
      const kindErgebnis = kostenGesamt(mat.n, matStufe, opts, tiefe + 1, pfad);
      const kind = kindErgebnis.beste;
      if (kind.gesperrt) {
        gesperrt = true;
        grund = grund || "Material " + mat.n + " gesperrt: " + kind.grund;
        materialien.push({ item: mat.n, menge: mat.c, gesperrt: true, weg: kind.weg });
        return;
      }
      materialSilber += kind.silber * mat.c;
      materialFokus += kind.fokus * mat.c;
      if (kind.unvollstaendig) {
        unvollstaendig = true;
        (kind.fehlendeGebaeude || []).forEach((g) => {
          if (fehlendeGebaeude.indexOf(g) === -1) fehlendeGebaeude.push(g);
        });
      }
      materialien.push({ item: mat.n, menge: mat.c, silberJeStueck: kind.silber, fokusJeStueck: kind.fokus, weg: kind.weg });
    });

    if (upgradeObj.cur && upgradeObj.cur.length) {
      gesperrt = true;
      grund = grund || "Waehrungskosten (" + upgradeObj.cur.map((c) => c.n).join(", ") + ") sind nicht bepreisbar";
    }

    if (gesperrt) {
      return gesperrterKandidat("verzaubern", item, stufe, grund, { vorstufe: vorstufe.weg, materialien });
    }

    const rezeptSilber = upgradeObj.s || 0;
    const silber = vorstufe.silber + materialSilber + rezeptSilber;
    // Verzaubern selbst kostet keinen Fokus (vom Nutzer im Spiel bestaetigt).
    const fokus = vorstufe.fokus + materialFokus;
    const wert = silber + fokus * opts.fokuswert;

    return {
      typ: "verzaubern",
      gesperrt: false,
      grund: null,
      silber,
      fokus,
      wert,
      unvollstaendig,
      fehlendeGebaeude,
      weg: { typ: "verzaubern", item, stufe, vorstufe: vorstufe.weg, materialien, rezeptSilber, unvollstaendig, fehlendeGebaeude },
    };
  }

  // -----------------------------------------------------------------------
  // Qualitaetsstufen (Feature 05.09.2026): drei zusaetzliche Wegearten, NUR
  // erreichbar ueber kostenBeiQualitaet() (aufgerufen vom oeffentlichen
  // kosten() nur, wenn opts.qualitaetsIndex > 0), s. Modulkommentar oben und
  // kostenrechner-KONTEXT.md. Bei qualitaetsIndex 0 (Normal, Standard) laeuft
  // ausschliesslich der bestehende, unveraenderte kostenGesamt()-Pfad -
  // keine Verhaltensaenderung fuer alle bisherigen Aufrufer/Tests.
  //
  //   KAUFEN-BEI-QUALITAET  - Marktpreis in genau dieser Qualitaet
  //   REROLL                - Normal beschaffen (bestehender kostenGesamt()-
  //                           Pfad, unveraendert), dann an der Reparaturstation
  //                           hochrerollen (REGELN.rerollKostenZuQualitaet)
  //   CRAFTEN-BEI-QUALITAET - je Alternativrezept EINE von zwei Varianten:
  //     - preservequality-Zutat vorhanden (p:true): deterministisch, kein
  //       Wurf, kein Fokus-Einfluss auf die Qualitaet - die Zutat wird
  //       rekursiv IN DERSELBEN Zielqualitaet beschafft (kostenBeiQualitaet),
  //       alle anderen Zutaten bleiben Normal (kostenGesamt).
  //     - keine preservequality-Zutat: Korns Wurf-Mechanik, erwartete Kosten
  //       = Kosten je Versuch (materialgleich zum Normal-Craft) geteilt durch
  //       REGELN.qualitaetWurfErfolgswahrscheinlichkeit(). Fehlgeschlagene
  //       Versuche werden NICHT gegen einen Wiederverkaufswert gerechnet
  //       (v1-Vereinfachung, vom Nutzer bestaetigt, s. kostenrechner-KONTEXT.md).
  //   Verzaubern preserviert die Qualitaet (vom Nutzer im Spiel bestaetigt,
  //   s. CLAUDE.md "Craft-Qualitaetswurf"): eine Vorstufe in derselben
  //   Zielqualitaet plus quality-unabhaengige Runen/Seelen/Relikte ist deshalb
  //   ebenfalls ein gueltiger CRAFTEN-BEI-QUALITAET-Nachbar (eigene Wegart
  //   "verzaubern", ueber kostenBeiQualitaet() statt kostenGesamt() fuer die
  //   Vorstufe).
  // -----------------------------------------------------------------------

  /**
   * Wie kaufKandidat(), aber gegen opts.preiseQualitaet statt opts.preise (ein
   * ZWEITER, in der Zielqualitaet abgerufener Preis-Datensatz, s. Modulkommentar
   * und js/preise.js/sammleQualitaetsMarktIds()). Faellt bei fehlendem/zu altem
   * Marktpreis ebenfalls auf einen hinterlegten Eigenpreis zurueck (P6, gleiche
   * marktId wie beim Normal-Kauf), damit die Eigenpreis-Pflege auch fuer
   * qualitaetsgebundene Knoten wirkt, bei denen die API selten einen aktuellen
   * Preis fuehrt (z.B. hochqualitative Royal-Items).
   */
  function kaufKandidatQualitaet(item, stufe, qualitaet, opts) {
    const marktId = marktIdVon(opts.graph, item, stufe);
    const label = REGELN.QUALITAETEN[qualitaet] || ("Qualitaet " + qualitaet);
    const eintrag = opts.preiseQualitaet[marktId];
    let brauchtEigenpreis = false;
    let sperrgrund = null;
    if (!eintrag) {
      brauchtEigenpreis = true;
      sperrgrund = "kein Marktpreis fuer " + marktId + " in Qualitaet " + label + " abgerufen";
    } else {
      const seite = opts.kaufweg === "order" ? eintrag.buy : eintrag.sell;
      if (!seite || seite.kein || seite.preis == null || seite.preis <= 0) {
        brauchtEigenpreis = true;
        sperrgrund = "kein Angebot fuer " + marktId + " in Qualitaet " + label;
      } else if (opts.maxPreisAlterMin != null && seite.datum) {
        const alterMin = (Date.now() - REGELN.parseApiDatumUtc(seite.datum)) / 60000;
        if (isFinite(alterMin) && alterMin > opts.maxPreisAlterMin) {
          // Zu alt: hier hilft KEIN Eigenpreis (analog preisMitGrund() in der
          // Normal-Fassung), also direkt gesperrt statt auf Eigenpreis auszuweichen.
          return gesperrterKandidat(
            "kaufen",
            item,
            stufe,
            "Preis fuer " + marktId + " (Qualitaet " + label + ") ist " + Math.round(alterMin) + " Minuten alt, ueber der Hoechstgrenze von " + opts.maxPreisAlterMin + " Minuten",
            { marktId, qualitaet }
          );
        }
      }
      if (!brauchtEigenpreis) {
        const preis = REGELN.kaufKostenJeStueck(seite.preis, opts.kaufweg);
        return {
          typ: "kaufen",
          gesperrt: false,
          grund: null,
          silber: preis,
          fokus: 0,
          wert: preis,
          unvollstaendig: false,
          fehlendeGebaeude: [],
          weg: { typ: "kaufen", item, stufe, marktId, kaufweg: opts.kaufweg, preisJeStueck: preis, eigenpreis: false, qualitaet },
        };
      }
    }

    const eigen = opts.eigenpreise[marktId];
    if (eigen != null && eigen > 0) {
      return {
        typ: "kaufen",
        gesperrt: false,
        grund: null,
        silber: eigen,
        fokus: 0,
        wert: eigen,
        unvollstaendig: false,
        fehlendeGebaeude: [],
        weg: { typ: "kaufen", item, stufe, marktId, kaufweg: opts.kaufweg, preisJeStueck: eigen, eigenpreis: true, qualitaet },
      };
    }
    return gesperrterKandidat("kaufen", item, stufe, sperrgrund, { marktId, qualitaet });
  }

  function rerollKandidat(item, stufe, qualitaet, opts, tiefe, pfad) {
    const normalErgebnis = kostenGesamt(item, stufe, opts, tiefe, pfad).beste;
    if (normalErgebnis.gesperrt) {
      return gesperrterKandidat("reroll", item, stufe, "Normal-Beschaffung gesperrt: " + normalErgebnis.grund, { qualitaet, basis: normalErgebnis.weg });
    }
    const itemWertJeStueck = REGELN.itemWert(item, stufe, undefined, opts.graph);
    const reroll = REGELN.rerollKostenZuQualitaet(itemWertJeStueck, qualitaet, 0);
    if (reroll.gesperrt) {
      return gesperrterKandidat("reroll", item, stufe, reroll.grund, { qualitaet, basis: normalErgebnis.weg });
    }
    const silber = normalErgebnis.silber + reroll.silber;
    const fokus = normalErgebnis.fokus; // Reroll kostet keinen Fokus, s. CLAUDE.md
    const wert = silber + fokus * opts.fokuswert;
    const unvollstaendig = !!normalErgebnis.unvollstaendig;
    const fehlendeGebaeude = normalErgebnis.fehlendeGebaeude || [];
    return {
      typ: "reroll",
      gesperrt: false,
      grund: null,
      silber,
      fokus,
      wert,
      unvollstaendig,
      fehlendeGebaeude,
      // unvollstaendig/fehlendeGebaeude AUCH im verschachtelten weg-Objekt,
      // nicht nur am Kandidaten selbst: js/ui.js/baueKnoten() bekommt beim
      // Rendern ausschliesslich dieses innere weg-Objekt uebergeben (nicht den
      // ganzen Kandidaten), genau wie bei craften/verzaubern (dort ist das
      // Feld ebenfalls im weg-Objekt dupliziert). Ohne diese Duplikation wuerde
      // der "unvollstaendig"-Hinweis fuer einen Reroll-Knoten nie erscheinen,
      // selbst wenn die zugrundeliegende Normal-Beschaffung unvollstaendig ist.
      weg: { typ: "reroll", item, stufe, qualitaet, itemWertJeStueck, rerollSilber: reroll.silber, basis: normalErgebnis.weg, unvollstaendig, fehlendeGebaeude },
    };
  }

  function craftBeiQualitaetKandidat(item, stufe, rezept, rezeptIndex, mitFokus, node, qualitaet, opts, tiefe, pfad) {
    const eigenerSchluessel = item + "@" + stufe;
    const memoKey = eigenerSchluessel + "@q" + qualitaet + "@" + rezeptIndex + "@" + (mitFokus ? 1 : 0);
    if (opts._memoCraftQualitaet.has(memoKey)) return opts._memoCraftQualitaet.get(memoKey);

    if (rezept.cur && rezept.cur.length) {
      const namen = rezept.cur.map((c) => c.n).join(", ");
      const g = gesperrterKandidat("craften", item, stufe, "Waehrungskosten (" + namen + ") sind nicht bepreisbar", { rezeptIndex, mitFokus, qualitaet });
      opts._memoCraftQualitaet.set(memoKey, g);
      return g;
    }

    const hatP = REGELN.rezeptHatPreservequality(rezept);
    const amountcrafted = rezept.a || 1;
    const cc = node.cc || null;
    const gebaeude = REGELN.gebaeudeVonKategorie(cc);
    const stationsInfo = stationssatzFuer(gebaeude, opts);
    const stationssatz = stationsInfo.satz;
    const fce = fceFuer(item, cc, opts);
    const fokusJeStueck = mitFokus ? REGELN.fokusKosten(rezept.f, fce, 1) / amountcrafted : 0;
    const rrrWert = REGELN.rrr({ cc, stadt: opts.stadt, mitFokus, tagesbonus: tagesbonusFuer(cc, opts) });
    const itemWertJeStueck = REGELN.itemWert(item, stufe, rezept, opts.graph);
    const stationsgebuehrJeStueck = REGELN.stationsgebuehr(itemWertJeStueck, 1, stationssatz);
    const rezeptSilberJeStueck = (rezept.s || 0) / amountcrafted;

    const neuerPfad = new Set(pfad);
    neuerPfad.add(eigenerSchluessel + "@q" + qualitaet);

    let unvollstaendig = gebaeude != null && !stationsInfo.gepflegt;
    const fehlendeGebaeude = unvollstaendig ? [gebaeude] : [];
    let materialSilber = 0;
    let materialFokus = 0;
    let gesperrt = false;
    let grund = null;
    const zutatenWeg = [];

    (rezept.i || []).forEach((zutat) => {
      const zStufe = zutatStufe(opts.graph, zutat.n, zutat.l);
      const mengeJeStueck = zutat.c / amountcrafted;
      const nutztQualitaet = !!zutat.p;
      const kindErgebnis = nutztQualitaet
        ? kostenBeiQualitaet(zutat.n, zStufe, qualitaet, opts, tiefe + 1, neuerPfad)
        : kostenGesamt(zutat.n, zStufe, opts, tiefe + 1, neuerPfad);
      const kind = kindErgebnis.beste;
      if (kind.gesperrt) {
        gesperrt = true;
        grund = grund || "Zutat " + zutat.n + "@" + zStufe + " gesperrt: " + kind.grund;
        zutatenWeg.push({ item: zutat.n, stufe: zStufe, menge: mengeJeStueck, gesperrt: true, weg: kind.weg, qualitaetsgebunden: nutztQualitaet });
        return;
      }
      // preservequality-Zutaten tragen im Graph ausnahmslos maxreturnamount 0
      // (build_graph.py/@preservequality, s. Modulkommentar); die
      // "|| nutztQualitaet"-Bedingung ist defensiv, kein Verhaltenswechsel.
      const ruecklaufWirksam = zutat.m === 0 || nutztQualitaet ? 0 : rrrWert;
      const effektiveMenge = mengeJeStueck * (1 - ruecklaufWirksam);
      materialSilber += kind.silber * effektiveMenge;
      materialFokus += kind.fokus * effektiveMenge;
      if (kind.unvollstaendig) {
        unvollstaendig = true;
        (kind.fehlendeGebaeude || []).forEach((g) => {
          if (fehlendeGebaeude.indexOf(g) === -1) fehlendeGebaeude.push(g);
        });
      }
      zutatenWeg.push({
        item: zutat.n,
        stufe: zStufe,
        menge: mengeJeStueck,
        ruecklaufAusgeschlossen: zutat.m === 0,
        ruecklaufAnteil: ruecklaufWirksam,
        effektiveMenge,
        silberJeStueck: kind.silber,
        fokusJeStueck: kind.fokus,
        weg: kind.weg,
        qualitaetsgebunden: nutztQualitaet,
      });
    });

    let ergebnis;
    if (gesperrt) {
      ergebnis = gesperrterKandidat("craften", item, stufe, grund, { rezeptIndex, mitFokus, qualitaet, zutaten: zutatenWeg });
    } else {
      const jeVersuchSilber = materialSilber + stationsgebuehrJeStueck + rezeptSilberJeStueck;
      const jeVersuchFokus = materialFokus + fokusJeStueck;
      let silber, fokus, erwarteteVersuche, pErfolg;
      if (hatP) {
        // preservequality: kein Wurf, kein Fehlversuch. Die Zutat wurde bereits
        // rekursiv IN dieser Qualitaet beschafft (s. oben), das Ergebnis hat
        // deshalb GARANTIERT die Zielqualitaet.
        silber = jeVersuchSilber;
        fokus = jeVersuchFokus;
        erwarteteVersuche = 1;
        pErfolg = 1;
      } else {
        pErfolg = REGELN.qualitaetWurfErfolgswahrscheinlichkeit(qualitaet, opts.qualitaetsChancenpunkte);
        if (pErfolg <= 0) {
          ergebnis = gesperrterKandidat("craften", item, stufe, "Qualitaets-Wurf: Erfolgswahrscheinlichkeit 0 fuer " + REGELN.QUALITAETEN[qualitaet], { rezeptIndex, mitFokus, qualitaet });
          opts._memoCraftQualitaet.set(memoKey, ergebnis);
          return ergebnis;
        }
        erwarteteVersuche = 1 / pErfolg;
        silber = jeVersuchSilber * erwarteteVersuche;
        fokus = jeVersuchFokus * erwarteteVersuche;
      }
      const wert = silber + fokus * opts.fokuswert;
      ergebnis = {
        typ: "craften",
        gesperrt: false,
        grund: null,
        silber,
        fokus,
        wert,
        unvollstaendig,
        fehlendeGebaeude,
        weg: {
          typ: "craften",
          item,
          stufe,
          rezeptIndex,
          mitFokus,
          amountcrafted,
          craftingcategory: cc,
          gebaeude,
          stationssatz,
          gebaeudeGepflegt: stationsInfo.gepflegt,
          itemWertJeStueck,
          stationsgebuehrJeStueck,
          rezeptSilberJeStueck,
          grundfokus: rezept.f || 0,
          fokusJeStueck,
          rrr: rrrWert,
          unvollstaendig,
          fehlendeGebaeude,
          zutaten: zutatenWeg,
          qualitaet,
          qualitaetsart: hatP ? "preservequality" : "wurf",
          erfolgswahrscheinlichkeit: hatP ? null : pErfolg,
          erwarteteVersuche: hatP ? null : erwarteteVersuche,
        },
      };
    }

    opts._memoCraftQualitaet.set(memoKey, ergebnis);
    return ergebnis;
  }

  function verzaubernBeiQualitaetKandidat(item, stufe, upgradeObj, qualitaet, opts, tiefe, pfad) {
    const vorstufeErgebnis = kostenBeiQualitaet(item, stufe - 1, qualitaet, opts, tiefe + 1, pfad);
    const vorstufe = vorstufeErgebnis.beste;
    const label = REGELN.QUALITAETEN[qualitaet] || ("Qualitaet " + qualitaet);
    if (vorstufe.gesperrt) {
      return gesperrterKandidat("verzaubern", item, stufe, "Vorstufe " + item + "@" + (stufe - 1) + " (Qualitaet " + label + ") gesperrt: " + vorstufe.grund, { qualitaet, vorstufe: vorstufe.weg });
    }

    // Verzaubermaterialien (Rune/Seele/Relikt) sind quality-unabhaengig,
    // deshalb unveraendert ueber die normale kostenGesamt()-Rekursion.
    let materialSilber = 0;
    let materialFokus = 0;
    let gesperrt = false;
    let grund = null;
    let unvollstaendig = vorstufe.unvollstaendig || false;
    const fehlendeGebaeude = (vorstufe.fehlendeGebaeude || []).slice();
    const materialien = [];

    (upgradeObj.res || []).forEach((mat) => {
      const matStufe = (opts.graph.items[mat.n] && opts.graph.items[mat.n].el) || 0;
      const kindErgebnis = kostenGesamt(mat.n, matStufe, opts, tiefe + 1, pfad);
      const kind = kindErgebnis.beste;
      if (kind.gesperrt) {
        gesperrt = true;
        grund = grund || "Material " + mat.n + " gesperrt: " + kind.grund;
        materialien.push({ item: mat.n, menge: mat.c, gesperrt: true, weg: kind.weg });
        return;
      }
      materialSilber += kind.silber * mat.c;
      materialFokus += kind.fokus * mat.c;
      if (kind.unvollstaendig) {
        unvollstaendig = true;
        (kind.fehlendeGebaeude || []).forEach((g) => {
          if (fehlendeGebaeude.indexOf(g) === -1) fehlendeGebaeude.push(g);
        });
      }
      materialien.push({ item: mat.n, menge: mat.c, silberJeStueck: kind.silber, fokusJeStueck: kind.fokus, weg: kind.weg });
    });

    if (upgradeObj.cur && upgradeObj.cur.length) {
      gesperrt = true;
      grund = grund || "Waehrungskosten (" + upgradeObj.cur.map((c) => c.n).join(", ") + ") sind nicht bepreisbar";
    }

    if (gesperrt) {
      return gesperrterKandidat("verzaubern", item, stufe, grund, { qualitaet, vorstufe: vorstufe.weg, materialien });
    }

    const rezeptSilber = upgradeObj.s || 0;
    const silber = vorstufe.silber + materialSilber + rezeptSilber;
    const fokus = vorstufe.fokus + materialFokus;
    const wert = silber + fokus * opts.fokuswert;

    return {
      typ: "verzaubern",
      gesperrt: false,
      grund: null,
      silber,
      fokus,
      wert,
      unvollstaendig,
      fehlendeGebaeude,
      weg: { typ: "verzaubern", item, stufe, qualitaet, vorstufe: vorstufe.weg, materialien, rezeptSilber, unvollstaendig, fehlendeGebaeude },
    };
  }

  /**
   * Qualitaetsbewusstes Gegenstueck zu kostenGesamt(): bei qualitaet 0
   * (Normal) reine Weiterleitung, sonst KAUFEN-BEI-QUALITAET, REROLL und
   * CRAFTEN-BEI-QUALITAET (je Alternativrezept, s. Funktionskommentare oben).
   * Eigene Memoisierung/Besuchsschutz ueber "item@stufe@qN", damit ein Knoten
   * gleichzeitig in Normal (ueber kostenGesamt, z.B. als gewoehnliche Zutat)
   * UND in der Zielqualitaet (ueber diese Funktion) auftreten kann, ohne sich
   * gegenseitig zu ueberschreiben.
   */
  function kostenBeiQualitaet(item, stufe, qualitaet, opts, tiefe, pfad) {
    if (!qualitaet) return kostenGesamt(item, stufe, opts, tiefe, pfad);

    const schluessel = item + "@" + stufe + "@q" + qualitaet;
    if (tiefe > opts.maxTiefe) {
      const g = gesperrterKandidat("gesperrt", item, stufe, "maximale Tiefe erreicht (" + opts.maxTiefe + ")", { qualitaet });
      return { beste: g, alle: [g] };
    }
    if (pfad.has(schluessel)) {
      const g = gesperrterKandidat("gesperrt", item, stufe, "Zyklus erkannt (" + schluessel + " ist bereits im aktuellen Pfad)", { qualitaet });
      return { beste: g, alle: [g] };
    }
    if (opts._memoQualitaet.has(schluessel)) return opts._memoQualitaet.get(schluessel);

    const neuerPfad = new Set(pfad);
    neuerPfad.add(schluessel);

    const alle = [];
    alle.push(kaufKandidatQualitaet(item, stufe, qualitaet, opts));
    alle.push(rerollKandidat(item, stufe, qualitaet, opts, tiefe, pfad));

    const node = opts.graph.items[item];
    if (node) {
      const rezepte = REGELN.rezepteFuerStufe(node, stufe);
      const cc = node.cc || null;
      const fokusRegel = fokusRegelFuer(item, stufe, cc, opts);
      rezepte.forEach((rezept, idx) => {
        if (fokusRegel.wert === "nie") {
          alle.push(gesperrterKandidat("craften", item, stufe, "mit Fokus craften ausgeschlossen: " + fokusRegel.grund, { rezeptIndex: idx, mitFokus: true, qualitaet }));
        } else {
          alle.push(craftBeiQualitaetKandidat(item, stufe, rezept, idx, true, node, qualitaet, opts, tiefe, neuerPfad));
        }
        if (fokusRegel.wert === "immer") {
          alle.push(gesperrterKandidat("craften", item, stufe, "ohne Fokus craften ausgeschlossen: " + fokusRegel.grund, { rezeptIndex: idx, mitFokus: false, qualitaet }));
        } else {
          alle.push(craftBeiQualitaetKandidat(item, stufe, rezept, idx, false, node, qualitaet, opts, tiefe, neuerPfad));
        }
      });

      if (stufe > 0 && node.e && node.e[String(stufe)] && node.e[String(stufe)].u) {
        alle.push(verzaubernBeiQualitaetKandidat(item, stufe, node.e[String(stufe)].u, qualitaet, opts, tiefe, neuerPfad));
      }
    }

    const gueltige = alle.filter((k) => !k.gesperrt);
    const beste = gueltige.length ? gueltige.reduce((a, b) => (a.wert <= b.wert ? a : b)) : alle[0] || gesperrterKandidat("gesperrt", item, stufe, "kein Weg verfuegbar", { qualitaet });

    alle.sort((a, b) => a.wert - b.wert);

    const ergebnis = { beste, alle };
    opts._memoQualitaet.set(schluessel, ergebnis);
    return ergebnis;
  }

  // -----------------------------------------------------------------------
  // Knoten-Aggregator: alle Wege fuer (item, stufe) sammeln, sortieren, den
  // besten (kleinster Zielwert) markieren. Memoisiert ueber item|stufe -
  // die "mitFokus"-Dimension aus der Aufgabenstellung steckt bewusst in der
  // darunterliegenden craftKandidat()-Memoisierung (item|stufe|rezeptIndex|
  // mitFokus): jeder Knoten entscheidet den Fokuseinsatz fuer seinen EIGENEN
  // Craft-Schritt selbst (per Zielfunktion), waehrend Zutaten immer ueber den
  // bereits global optimierten kostenGesamt()-Wert des Kindknotens eingehen.
  // -----------------------------------------------------------------------

  function kostenGesamt(item, stufe, opts, tiefe, pfad) {
    const schluessel = item + "@" + stufe;

    if (tiefe > opts.maxTiefe) {
      const g = gesperrterKandidat("gesperrt", item, stufe, "maximale Tiefe erreicht (" + opts.maxTiefe + ")");
      return { beste: g, alle: [g] };
    }
    if (pfad.has(schluessel)) {
      const g = gesperrterKandidat("gesperrt", item, stufe, "Zyklus erkannt (" + schluessel + " ist bereits im aktuellen Pfad)");
      return { beste: g, alle: [g] };
    }
    if (opts._memoGesamt.has(schluessel)) return opts._memoGesamt.get(schluessel);

    const neuerPfad = new Set(pfad);
    neuerPfad.add(schluessel);

    const alle = [];
    alle.push(kaufKandidat(item, stufe, opts));

    const node = opts.graph.items[item];
    if (node) {
      // Rezeptsuche ueber REGELN.rezepteFuerStufe(), NICHT hier von Hand
      // nachbauen: el-Knoten (verzauberte Rohstoffe, Runen, Seelen, Relikte)
      // haben kein e-Feld, ihre Rezepte stehen immer in node.r und gelten
      // nur fuer die Stufe node.el selbst. Eine fruehere Fassung nahm bei
      // stufe>0 blind den Ausruestungs-Zweig (node.e[...]) und fand dort bei
      // el-Knoten nie etwas - der Craft-Weg fuer alle 299 el-Knoten fehlte
      // dadurch vollstaendig (rechenkern-pruefer, 04.09.2026, v0.3.1).
      const rezepte = REGELN.rezepteFuerStufe(node, stufe);
      const cc = node.cc || null;
      const fokusRegel = fokusRegelFuer(item, stufe, cc, opts);
      rezepte.forEach((rezept, idx) => {
        // Je Alternativrezept zwei Varianten: mit und ohne Fokuseinsatz bei
        // diesem Schritt. Die Zielfunktion entscheidet spaeter, welche
        // gewinnt (s. kostenrechner-PLAN.md Abschnitt 4.2); ohne Fokus ist
        // stets gueltig, auch wenn das Rezept gar keinen Fokus kostet
        // (mitFokus wirkt dann einfach nicht, kein Sonderfall noetig).
        //
        // Fokuseinsatz steuerbar machen: eine Regel "immer"/"nie" (Knoten
        // oder Kategorie, s. fokusRegelFuer) schliesst die jeweils andere
        // Variante aus. Statt sie einfach nicht zu erzeugen, wird sie als
        // gesperrter Kandidat MIT Begruendung eingetragen - bleibt so in
        // alleWege sichtbar (Transparenz-Vorgabe aus dem Plan) und macht im
        // Extremfall "kein Weg verfuegbar" nachvollziehbar, statt
        // kommentarlos zu verschwinden. "immer" auf einem Rezept ohne
        // eigenen Fokuswert (z.B. koenigliche Items, craftingfocus 0) wirkt
        // dabei einfach folgenlos, kein Sonderfall noetig (s. craftKandidat).
        if (fokusRegel.wert === "nie") {
          alle.push(gesperrterKandidat("craften", item, stufe, "mit Fokus craften ausgeschlossen: " + fokusRegel.grund, { rezeptIndex: idx, mitFokus: true }));
        } else {
          alle.push(craftKandidat(item, stufe, rezept, idx, true, node, opts, tiefe, neuerPfad));
        }
        if (fokusRegel.wert === "immer") {
          alle.push(gesperrterKandidat("craften", item, stufe, "ohne Fokus craften ausgeschlossen: " + fokusRegel.grund, { rezeptIndex: idx, mitFokus: false }));
        } else {
          alle.push(craftKandidat(item, stufe, rezept, idx, false, node, opts, tiefe, neuerPfad));
        }
      });

      if (stufe > 0 && node.e && node.e[String(stufe)] && node.e[String(stufe)].u) {
        alle.push(verzaubernKandidat(item, stufe, node.e[String(stufe)].u, opts, tiefe, neuerPfad));
      }
    }

    const gueltige = alle.filter((k) => !k.gesperrt);
    const beste = gueltige.length ? gueltige.reduce((a, b) => (a.wert <= b.wert ? a : b)) : alle[0] || gesperrterKandidat("gesperrt", item, stufe, "kein Weg verfuegbar");

    alle.sort((a, b) => a.wert - b.wert);

    const ergebnis = { beste, alle };
    opts._memoGesamt.set(schluessel, ergebnis);
    return ergebnis;
  }

  // -----------------------------------------------------------------------
  // Oeffentliche Funktion
  // -----------------------------------------------------------------------

  /**
   * @param {string} item
   * @param {number} stufe Verzauberungsstufe (0-4)
   * @param {number} menge angeforderte Stueckzahl
   * @param {object} [options] s. normOpts() oben
   * @returns {{silber:?number, fokus:?number, wert:number, weg:object,
   *   gesperrt:boolean, grund:?string, menge:number, alleWege:object[]}}
   */
  function kosten(item, stufe, menge, options) {
    const opts = normOpts(options);
    if (!opts.graph) throw new Error("REZEPTGRAPH fehlt - rezepte.js muss vor rechenkern.js geladen werden, oder opts.graph uebergeben");
    const m = menge == null ? 1 : menge;

    const ergebnis = opts.qualitaetsIndex
      ? kostenBeiQualitaet(item, stufe || 0, opts.qualitaetsIndex, opts, 0, new Set())
      : kostenGesamt(item, stufe || 0, opts, 0, new Set());

    function skaliere(k) {
      if (k.gesperrt) return k;
      return Object.assign({}, k, { silber: k.silber * m, fokus: k.fokus * m, wert: k.wert * m });
    }

    const beste = skaliere(ergebnis.beste);
    const alleWege = ergebnis.alle.map(skaliere);

    // Alternativen JE KNOTEN (nicht nur am Wurzelknoten): opts._memoGesamt
    // sammelt waehrend der Rekursion fuer jeden besuchten "item@stufe"-
    // Schluessel bereits alle Kandidaten, sortiert. P5 braucht das fuer den
    // aufklappbaren Bauplan ("was haette die naechstbeste Alternative auf
    // DIESER Ebene gekostet"), nicht nur fuer die Wurzel. Werte sind je Stueck
    // (nicht mit `menge` skaliert), genau wie alle anderen Mengenangaben im
    // Baum, s. Modulkommentar oben.
    const knotenAlternativen = {};
    opts._memoGesamt.forEach((eintrag, schluessel) => {
      knotenAlternativen[schluessel] = eintrag.alle;
    });
    // Qualitaetsstufen: _memoQualitaet fuehrt eigene Schluessel ("item@stufe@qN",
    // s. kostenBeiQualitaet()), die hier zusaetzlich (nicht ersetzend) aufgenommen
    // werden, damit js/ui.js dieselbe knotenAlternativen-Struktur fuer
    // qualitaetsgebundene Knoten nutzen kann wie fuer Normal-Knoten.
    opts._memoQualitaet.forEach((eintrag, schluessel) => {
      knotenAlternativen[schluessel] = eintrag.alle;
    });

    return {
      silber: beste.silber,
      fokus: beste.fokus,
      wert: beste.wert,
      weg: beste.weg,
      gesperrt: !!beste.gesperrt,
      grund: beste.grund || null,
      unvollstaendig: !!beste.unvollstaendig,
      fehlendeGebaeude: beste.fehlendeGebaeude || [],
      menge: m,
      alleWege,
      knotenAlternativen,
    };
  }

  return { kosten };
})();
