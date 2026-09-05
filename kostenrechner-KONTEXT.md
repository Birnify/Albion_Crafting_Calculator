# Kontext: Albion Kostenrechner

Stand: 2026-09-05 · Version: v1.7.0 · Handelsvolumen als Zusatzsignal bei gesperrten Preisen

> Diese Datei ist die **einzige Quelle für eine frische Session**: aktueller Stand,
> Fachlogik der App, Dateistruktur, Arbeitsweise, offenes Backlog. Zu Beginn jeder
> Arbeit an diesem Projekt vollständig lesen.
>
> Der **Auftrag** steht in `kostenrechner-PLAN.md` und ändert sich kaum. Die
> **Spielregeln und belegten Formeln** stehen in `../CLAUDE.md`. Diese Datei hier
> beschreibt, wie weit die Anwendung ist.

## Was ist das?

Eine Web-App, die für ein beliebiges craftbares Albion-Item auf einer beliebigen
Verzauberungsstufe **und Qualitätsstufe** den **günstigsten Beschaffungsweg**
ermittelt: kaufen, craften, aus einer niedrigeren Stufe hochverzaubern, per Reroll
an der Reparaturstation hochqualifizieren, oder eine Mischung daraus über den
ganzen Rezeptbaum. Stadt frei wählbar (seit v1.1.0), Qualität frei wählbar
(seit v1.4.0).

Ziel und Rechenmodell: `kostenrechner-PLAN.md`, Abschnitte 1 und 4.

## Aktueller Stand (Handelsvolumen als Zusatzsignal bei gesperrten Preisen, 05.09.2026, v1.7.0)

**Auftrag:** Backlog-Punkt 1 ("Bekannte Grenze der Preisquelle") aus der
vorherigen Fassung dieser Liste, den der Nutzer beim letzten Mal bewusst
offen gelassen hatte. Vier Rückfragen aus der Brainstorming-Phase, alle vom
Nutzer wie empfohlen beantwortet: (1) Zeitraum/Kennzahl = **7-Tage-Summe**
von `item_count` plus mengengewichteter Durchschnittspreis, wie im
Eintopf-Rechner (`volumen_holen()`); (2) Abruf-Auslöser = **Knopfdruck, ein
globaler Knopf** fürs ganze Ergebnis, kein automatischer Abruf je Berechnung;
(3) Caching = **nur laufende Sitzung**, kein neues `localStorage`-Schema;
(4) Anzeigeort = **nur im Bauplan-Baum**, nicht in der "Alle Wege"-Tabelle.

**Umgesetzt:**

- `js/preise.js`: `volumenAbrufen(ids, opts)` gegen den `history/`-Endpunkt
  (`time-scale=24`), dieselbe Drossel-Disziplin wie `preiseAbrufen()`
  (50er-Blöcke, 1,5 s Pause, Backoff bei 429), aber bewusst OHNE
  `localStorage`-Cache. `normalisiereHistorieZeile(zeile, tageFenster)` als
  reine Hilfsfunktion (Summe `item_count` der letzten 7 Tage,
  mengengewichteter Durchschnittspreis), rechnet identisch zu
  `eintopf_update.py` `volumen_holen()` (dort `d7`/`avg`). `history/` liefert
  `location`, nicht `city` wie `prices/` - einmal mehr beachtet.
- `js/ui.js`: `sammleGesperrteKaufMarktIds(weg)` (Modul-Ebene, reine
  Funktion) traversiert dieselbe `weg`-Struktur wie `baueKnoten()`
  (`zutaten`/`vorstufe`/`materialien`/`basis`) und sammelt alle Markt-IDs
  von Knoten mit `typ:"gesperrt", ursprungsTyp:"kaufen"`. Neuer Knopf
  "Handelsvolumen laden" neben "Alles auf-/zuklappen" ruft
  `PREISE.volumenAbrufen()` für genau diese IDs auf, Ergebnis landet in
  `zustand.handelsvolumen` (Session-Speicher, bleibt über mehrere Suchen
  erhalten). `baueGesperrtZeile()` nimmt jetzt das ganze `weg`-Objekt
  entgegen (vorher drei Einzelfelder) und hängt bei einem echten
  "kaufen, gesperrt"-Knoten die neue `wegVolumenHtml()`-Anzeige an ("X Stk /
  7 Tage, Y Silber im Schnitt", oder "keine Daten"/nichts, solange der Knopf
  noch nicht geklickt wurde).
- `Kostenrechner.html`: Knopf `#volumenBtn` plus CSS `.kn-volumen` (Stil wie
  `.kn-alter`, gepunktet unterstrichen mit Tooltip). Keine belegten
  Werte/Formeln berührt.

**Wichtiger Befund beim Bauen, den der Auftrag nicht vorwegnahm:** die
Handelsvolumen-Anzeige greift nach genauer Prüfung der Sperrlogik in
`js/rechenkern.js` in der Praxis fast ausschließlich am **Wurzelknoten**
des Bauplans, nicht tief verschachtelt. Grund: `craftKandidat()`/
`verzaubernKandidat()` setzen `gesperrt=true` an sich selbst, sobald
IRGENDEINE Zutat/Vorstufe/Material gesperrt ist (s. `js/rechenkern.js`
Zeile ~366 ff.), und diese Sperre kaskadiert konsequent nach oben bis zum
nächsten Knoten mit einem tatsächlich funktionierenden Alternativweg, oder
bis zur Wurzel. Ein GEWONNENER (nicht gesperrter) Teilbaum kann deshalb per
Induktion nie einen gesperrten Kindknoten enthalten - der vorhandene
`weg.typ === "gesperrt"`-Zweig in `baueKnoten()` (verschachtelter Fall) ist
nach aktuellem Kaskadenverhalten praktisch nicht erreichbar, nur der
Sonderfall in `renderBauplan()` (ganzer `r.weg` gesperrt) tritt real auf -
genau der in `../CLAUDE.md` dokumentierte Fall (z. B.
`T4_HEAD_CLOTH_ROYAL@3` komplett unbepreisbar). `sammleGesperrteKaufMarktIds()`
spiegelt trotzdem bewusst die VOLLE Traversierung (craften/verzaubern/reroll),
robust gegenüber diesem Kaskadenverhalten und zukunftssicher, falls sich das
je ändert; die Tests decken beide Fälle (Wurzel und - synthetisch - auch
verschachtelt) ab. Live gegenübergestellt: `T4_HEAD_CLOTH_ROYAL@3` ist über
`prices/` in Lymhurst nicht bepreisbar, `history/` zeigt trotzdem 198
tatsächlich gehandelte Stück in den letzten 7 Tagen zu durchschnittlich
222.430 Silber - exakt das Zusatzsignal, das der Auftrag wollte.

**Getestet:** Testsuite von 246 auf **261 Tests** gewachsen (15 neue): 5 in
`PREISE.selbsttest()` für `normalisiereHistorieZeile()` (7-Tage-Fenster
schneidet ältere Tage ab, mengengewichteter ≠ einfacher Durchschnitt, leere
`data` ergibt 0/`null` statt `NaN`, `location`→`stadt`-Normalisierung,
ungültige Zeile liefert `null` statt zu werfen), 10 im neuen Abschnitt
"Regressionstest `UI.sammleGesperrteKaufMarktIds()`" (Wurzel/verschachtelt/
Verzaubern/Reroll/Dedup/Negativfälle mit `ursprungsTyp !== "kaufen"` bzw.
fehlender `marktId`). Alle 261 grün, per Node cachefrei gegen die Dateien
auf der Platte geprüft (`vm.runInContext`, `document`/`localStorage`/`fetch`-
Stub). **Zusätzlich live gegen die echte API geprüft** (kein Raten): drei
echte `fetch`-Aufrufe gegen `europe.albion-online-data.com/.../history/`
(einmal roh zur Feldnamen-Kontrolle, einmal durch `PREISE.volumenAbrufen()`
mit zwei IDs inkl. `T4_HEAD_CLOTH_ROYAL@3`, einmal mit einer erfundenen ID
zur Kontrolle des `null`-Falls) sowie eine volle Rechenkern-Integrationsprobe
(`RECHENKERN.kosten()` + `UI.sammleGesperrteKaufMarktIds()` gegen den echten
Rezeptgraphen ohne jeden hinterlegten Preis) bestätigen Feldnamen, Antwort-
form und Zusammenspiel.

**Bewusste Abweichung vom Standardablauf, wie schon in v1.4.0-v1.6.0:** weder
`SendMessage` noch `Agent` noch ein interaktives Browser-Werkzeug standen in
dieser Sitzung zur Verfügung. Die drei Spezialisten (`rechenkern-pruefer`,
`spieldaten-pruefer`, `oberflaechen-pruefer`) konnten deshalb nicht angefordert
werden, obwohl `spieldaten-pruefer` (neuer API-Endpunkt) und
`oberflaechen-pruefer` (neuer Knopf, neue Anzeige im Bauplan) hier fachlich
angebracht gewesen wären. Ersatzweise: die oben beschriebenen echten
Live-`fetch`-Aufrufe gegen die Produktions-API als Ersatz für
`spieldaten-pruefer`, und eine sorgfältige Zeilen-für-Zeile-Prüfung von
`baueGesperrtZeile()`/`wegVolumenHtml()` als Ersatz für
`oberflaechen-pruefer` - aber **kein echter Klick-Test des neuen Knopfs im
gerenderten Browser**. Empfehlung an den Nutzer: die App öffnen, ein Item
ohne Marktpreis suchen (z. B. eine hohe Verzauberungsstufe), "Handelsvolumen
laden" klicken und die neue Anzeige an der Gesperrt-Zeile prüfen.

Versions-Schnappschuss unter `Versionen/v1.7.0 - Handelsvolumen als
Zusatzsignal bei gesperrten Preisen/` angelegt. Git-Commit und Push wie im
Projekt üblich (s. `../CLAUDE.md`, "Versionskontrolle").

---

**Vorheriger Stand (v1.6.0, "Alle-Wege-Tabelle gruppiert gleichwertige
Wege") und alles davor** unverkürzt nach `kostenrechner-KONTEXT-HISTORIE.md`
ausgelagert (Schlankheitsregel, s. "Entwicklungsweise / Mitarbeit" unten).

## Dateistruktur

Stand nach P7 (v1.0.0) plus Feature "Craft-Stadt waehlbar" (v1.1.0) plus
Feature "Fokuseinsatz steuerbar machen" (v1.2.0) plus Feature "Bauplan-Ansicht
ergonomisch ueberarbeitet" (v1.3.0) plus Standardwert Stationssaetze (v1.3.1)
plus Feature "Qualitaetsstufen" (v1.4.0) plus "FCE-Ableitung ueber
Schicksalsbrett-Knotenliste je Kategorie" (v1.5.0) plus Bugfix "Veredeln-
Spezialisierungsknoten nach Tier gruppiert" (v1.5.1) plus Diagnose
"Fokus-Monotonie-Regressionstest" (v1.5.2, nur `tests/test.html` erweitert,
kein Rechenkern-/Regeln-/UI-Code geaendert) plus Feature "Alle-Wege-Tabelle
gruppiert gleichwertige Wege" (v1.6.0, nur `Kostenrechner.html`/`js/ui.js`/
`tests/test.html`, kein Rechenkern-/Regeln-Code geaendert, keine neuen
Dateien) plus Feature "Handelsvolumen als Zusatzsignal bei gesperrten
Preisen" (v1.7.0, `js/preise.js`/`js/ui.js`/`Kostenrechner.html`/
`tests/test.html`, kein Rechenkern-/Regeln-Code geaendert, keine neuen
Dateien):

```
Kostenrechner/
  build_graph.py            fertig (P1, P2: el-Feld ergaenzt), seither unveraendert
  rezepte.js                erzeugt (P1, P2), nicht von Hand bearbeiten
  Kostenrechner.html         fertig (P6, v0.5.0; Stadt-Dropdown v1.1.0; Fokus-Regel-
                              Tabelle + Fokus-Schalter im Bauplan v1.2.0; Qualitaet-Dropdown
                              + Qualitaets-Chancenpunkte-Block v1.4.0; Schicksalsbrett-
                              Meisterschaft/Spezialisierung-Zeile ersetzt durch
                              #spezKnotenContainer-Panel v1.5.0; #volumenBtn +
                              .kn-volumen v1.7.0): Suche, Hero,
                              Bauplan-Baum, Alle-Wege, Eigenpreis-Pflege (P6), Einstellungen
  js/
    preise.js                fertig (P2, P3; stadtabhaengiger Cache v1.1.0; qualitaetsabhaengiger
                              Cache-Schluessel + sammleQualitaetsMarktIds() v1.4.0, Schema auf 3);
                              volumenAbrufen()/normalisiereHistorieZeile() gegen history/,
                              bewusst OHNE localStorage-Cache v1.7.0):
                              eigenpreisSetzen lehnt Preis<=0 ab, PREIS_CACHE_SCHEMA_VERSION/
                              EIGENPREIS_SCHEMA_VERSION getrennt seit v1.1.0. Unveraendert v1.4.0-v1.6.0.
    regeln.js                fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0; Qualitaetswurf/Reroll-Kette
                              v1.4.0; SPEZ_TYP/KATEGORIE_ZU_SPEZTYP/spezialisierungsGruppen()/
                              fceAusSpezialisierungsknoten() v1.5.0; gruppenSchluesselVonItem(item,cc)
                              Bugfix v1.5.1, s. "Aktueller Stand"): itemWert, RRR, Stationsgebuehr
                              (mit 0-Floor), Fokus (mit 0-Floor), Steuer, Kategorie-Tabellen,
                              rezepteFuerStufe, qualitaetWurfErfolgswahrscheinlichkeit()/
                              rerollKostenZuQualitaet(), Spezialisierungsknoten-Ableitung (v1.5.0/v1.5.1).
                              Unveraendert seit v1.5.1.
    rechenkern.js             fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0, P6 v0.5.0,
                              Fokusregel-Ebenen v1.2.0; kostenBeiQualitaet() v1.4.0;
                              fceFuer() um Knoten-Ebene erweitert v1.5.0, reicht cc an
                              gruppenSchluesselVonItem() durch v1.5.1):
                              kosten(item,stufe,menge,opts), stationssatzFuer() unterscheidet
                              fehlend von ausdruecklich 0, weg.eigenpreis kennzeichnet
                              Kauf-Kandidaten aus einer eigenen Schaetzung (P6), fokusRegelFuer()
                              steuert mit/ohne Fokus je Knoten/Kategorie (v1.2.0),
                              kostenBeiQualitaet()/vier neue Kandidaten-Konstruktoren fuer
                              Kaufen/Reroll/Craften(Wurf oder preservequality)/Verzaubern
                              in Zielqualitaet (v1.4.0), fceFuer(item,cc,opts) mit drei
                              Prioritaetsebenen (Knoten > Kategorie-Freitext > global, v1.5.0).
                              Unveraendert seit v1.5.1.
    ui.js                     fertig (P5, v0.4.0, P6 v0.5.0, Stadt-Einstellung v1.1.0,
                              Fokus-Regel-Tabelle + Bauplan-Fokus-Schalter v1.2.0,
                              Bauplan-Knoten als Karten statt Fliesstext v1.3.0; Qualitaet-
                              Einstellung + reroll-Knotentyp im Bauplan v1.4.0;
                              fceAusSchicksalsbrett() entfernt, renderSpezialisierungsknoten()/
                              spezKnotenAnzeigeGruppen()/fceUeberschreibungenFuerOpts() v1.5.0;
                              wegLabelKurz() auf Modul-Ebene verschoben, neu:
                              statusInfoFuerWeg()/gruppiereAlleWege()/wegGruppenLabel(),
                              renderAlleWege() gruppiert+aufklappbar v1.6.0;
                              sammleGesperrteKaufMarktIds() (Modul-Ebene), volumenBtn-Listener,
                              wegVolumenHtml(), baueGesperrtZeile() nimmt jetzt das ganze
                              weg-Objekt statt Einzelfeldern entgegen, zustand.handelsvolumen
                              v1.7.0):
                              Suche mit Tastaturbedienung, Rendering, Einstellungen, Eigenpreis-
                              Pflegeansicht (P6), baueKnoten()/eigenerKandidat() (v1.3.0)
  kostenrechner-PLAN.md
  kostenrechner-KONTEXT.md
  kostenrechner-KONTEXT-HISTORIE.md
  Versionen/v0.1.0 - Rezeptgraph erzeugt/
  Versionen/v0.2.0 - Preisschicht mit localStorage-Cache/
  Versionen/v0.3.0 - Rechenkern/
  Versionen/v0.3.1 - Veredelungs-Rezeptbug behoben/
  Versionen/v0.4.0 - Oberflaeche/
  Versionen/v0.5.0 - Eigenpreis-Pflege/
  Versionen/v1.0.0 - Erste vollstaendige Version/
  Versionen/v1.0.1 - Zeitzonen-Bug Preisalter behoben/
  Versionen/v1.1.0 - Craft-Stadt waehlbar/
  Versionen/v1.2.0 - Fokuseinsatz steuerbar machen/
  Versionen/v1.3.0 - Bauplan-Ansicht ergonomisch ueberarbeitet/
  Versionen/v1.3.1 - Stationssaetze Standard 400/
  Versionen/v1.4.0 - Qualitaetsstufen/
  Versionen/v1.5.0 - FCE-Ableitung ueber Schicksalsbrett-Knotenliste je Kategorie/
  Versionen/v1.5.1 - Veredeln-Spezialisierungsknoten nach Tier gruppiert/
  Versionen/v1.5.2 - Fokus-Monotonie-Regressionstest (Diagnose ohne Codefehler)/
  Versionen/v1.6.0 - Alle-Wege-Tabelle gruppiert gleichwertige Wege/
  Versionen/v1.7.0 - Handelsvolumen als Zusatzsignal bei gesperrten Preisen/
  tests/test.html           261 Tests, Offline-Selbsttests + 2 Live-Abschnitte
  .gitignore, README.md      seit 04.09.2026: eigenes Git-Repo, Remote Birnify/Albion_Crafting_Calculator
```

Außerhalb des Repos, eine Ebene höher (`..\`, Albion-Wurzelverzeichnis):
`Kostenrechner öffnen.bat` (öffnet `Kostenrechner.html` direkt, kein Neubau),
`Rezeptgraph neu bauen.bat` (ruft `build_graph.py --refresh` auf). Beide bewusst
außerhalb des Git-Repos, weil sie Nutzer-Komfort sind, keine App-Bestandteile.

## Entwicklungsweise / Mitarbeit

- **Diese Kontextdatei nach jedem abgeschlossenen Paket aktualisieren**,
  Stand-Datum und Version oben mitziehen.
- **Schlank halten.** Sobald diese Datei über etwa 300 Zeilen wächst, wandert der
  bisherige Abschnitt „Aktueller Stand" unverkürzt an den Anfang einer neu
  anzulegenden `kostenrechner-KONTEXT-HISTORIE.md`, und hier bleibt nur ein kurzer
  Abschnitt (5 bis 10 Zeilen) mit Verweis. Nichts wird dabei gelöscht oder inhaltlich
  gekürzt, nur verschoben. Im Pizza-Projekt war genau das der Grund, warum die
  Hauptdatei auf 325 KB angewachsen war.
- **Versionen-Workflow (Pflicht bei jeder abgeschlossenen Änderung):** kompletten
  lauffähigen Stand nach `Versionen/vX.Y.Z - [Beschreibung]/` kopieren. SemVer:
  Patch = Fix, Minor = Feature, Major = Umbau. Konventionen in
  `Versionen/LIESMICH.txt`.
- **Testsuite:** `tests/test.html` per Doppelklick, grün = OK. Nach jeder Änderung
  am Rechenkern laufen lassen. Behauptete Testergebnisse eines Sub-Agenten nie
  ungeprüft übernehmen, immer selbst nachlaufen lassen.
- **Nach jeder Änderung im Browser gegenprüfen**, nicht nur den Code lesen. Im
  Eintopf-Projekt fielen mehrere Fehler erst in der gerenderten Seite auf.
- **Rechenergebnisse unabhängig nachziehen** (kurzes Python-Skript im Scratchpad).
  Das hat im Eintopf-Projekt die Mischkalkulation und die Steuerlogik bestätigt und
  einen echten Rückgewinnungsfehler aufgedeckt.
- **Plattform:** Windows, PowerShell. Die App selbst braucht kein Node und keine
  Build-Werkzeuge; sie läuft per Doppelklick. Nur `build_graph.py` braucht Python.

## Vorlieben des Nutzers

Aus dem Eintopf- und dem Pizza-Projekt übernommen, dort mehrfach bestätigt.

- Knapp und ohne Füllstoff. Erklärkästen sind unnötiger Füllstoff; Erläuterungen
  gehören in `title`-Tooltips.
- Konstanten, die sich nicht ändern, gehören in den Code, nicht als Eingabefeld.
- Oberfläche einheitlich: gleichartige Felder gleich groß, gruppiert, ausgerichtet.
- Der Nutzer fragt kritisch nach, wenn Zahlen nicht zusammenpassen. Diese Einwände
  waren bisher **immer** berechtigt und haben echte Fehler aufgedeckt. Im Zweifel
  nachfragen statt annehmen.
- Bei echten Lücken gezielt nachfragen (z. B. über `AskUserQuestion`), statt still
  zu raten.

## Backlog / Mögliche nächste Schritte

Die Arbeitspakete stehen in `kostenrechner-PLAN.md`, Abschnitt 6, alle sechs
(P1-P7) sind abgeschlossen. Hier nur, was darüber hinaus offen ist. Die
Bau-Handoff-Notizen zwischen den einzelnen Paketen (P1 für P2, P2 für P3 usw.)
wurden am 05.09.2026 aus dieser Liste entfernt, sie waren nur während des
Bauens selbst relevant und sind jetzt reine Ablenkung; die fachlichen Details
dazu stehen weiterhin unverkürzt in `kostenrechner-KONTEXT-HISTORIE.md`.

**Offene Fäden, keiner zu Ende entschieden.** Punkt 1 aus der vorherigen
Fassung dieser Liste („Alle Wege"-Tabelle zeigt bei baugleichen
Alternativrezepten identische, nichtssagende Zeilen") wurde im Zyklus
„Aussagekraft der Alle-Wege-Tabelle verbessern" (v1.6.0, 05.09.2026)
umgesetzt und ist deshalb hier entfernt, s. "Aktueller Stand" oben. Der
zweite Punkt („Bekannte Grenze der Preisquelle") wurde im Zyklus
„history/-Handelsvolumen als Zusatzsignal bei gesperrten Preisen" (v1.7.0,
05.09.2026) zur Hälfte umgesetzt (s. "Aktueller Stand" oben) und ist deshalb
hier ebenfalls entfernt.

1. **Noch offener Rest aus dem v1.7.0-Zyklus: Wortlaut-Alternative nicht
   umgesetzt.** Die ursprüngliche Backlog-Notiz nannte zwei Ideen: (a) den
   Wortlaut „gesperrt" auf etwas wie „kein bei AODP erfasster Preis" ändern,
   (b) `history/`-Handelsvolumen als Zusatzsignal nutzen. Die vier
   Rückfragen des v1.7.0-Zyklus deckten nur (b) ab; (a) wurde nicht gefragt
   und nicht umgesetzt. Falls weiterhin gewünscht: eigene Rückfrage, ob/wie
   der Wortlaut angepasst werden soll (z. B. nur bei `ursprungsTyp==="kaufen"`
   ohne jeden Preisdatensatz, oder generell).

2. **Fokuswert-Verdacht aus der v1.5.2-Diagnose, noch nicht durch den Nutzer
   bestätigt.** Der gemeldete Fokus-Anstieg (754,9 → 1.233,5) ließ sich mit
   `fokuswert:0` rechnerisch nicht reproduzieren (s. `kostenrechner-KONTEXT-HISTORIE.md`,
   Abschnitt "Aktueller Stand (Fokus-Monotonie-Regressionstest ..., v1.5.2)"), wohl
   aber die Erklärung, dass ein aus einer früheren Sitzung noch in
   `localStorage` stehender Fokuswert > 0 einen legitimen Pfadwechsel ausgelöst
   haben könnte (kein Formelfehler). **Vor der nächsten Sitzung zu diesem
   Thema:** den Nutzer bitten, das Feld "Was ist mir ein Fokuspunkt wert?" in
   den Einstellungen zu prüfen und den Test bei bestätigtem `Fokuswert = 0` zu
   wiederholen. Bestätigt sich die Erklärung nicht, ist das eine echte Lücke,
   die eine erneute, tiefere Diagnose braucht (evtl. mit Zugriff auf ein
   Browser-Werkzeug, um den tatsächlichen `localStorage`-Stand der gemeldeten
   Sitzung einzusehen).

**Kleinere offene Punkte, unverändert seit früheren Paketen:**

- Ein Eigenpreis von 0 könnte legitim sein, wenn der Nutzer eine Zutat schon
  auf Lager hat ("kostet mich nichts mehr"). In P6 bewusst nicht gelöst,
  `eigenpreisSetzen(id, 0)` löscht weiterhin den Eintrag. Falls gewünscht:
  eigene, klar gekennzeichnete Funktion statt eines überladenen Preisfelds.
- 21 von 365 Kandidaten in der Eigenpreis-Pflegeliste haben keinen deutschen
  Namen (`REZEPTGRAPH.namen[id]` fehlt, z. B. `QUESTITEM_TOKEN_ARENA_CRYSTAL`)
  und zeigen stattdessen ihre ID. Nicht nachgebessert, da `build_graph.py`/die
  Namensquelle betroffen wäre.

**Browser-Vorschau, Stand 05.09.2026 (wichtig für die nächste Sitzung):**
`.claude/launch.json` nutzt seit heute `no_cache_server.py` statt
`python -m http.server`, weil Letzterer wiederholt veraltete `js`-Dateien
ausgeliefert hat, auch nach Hard-Reload und in neuen Tabs. Trotzdem in dieser
Sitzung beobachtet: `127.0.0.1` als Navigationsziel wurde vom Vorschau-Werkzeug
verweigert ("denied or failed"), während `localhost` auf demselben Server
anstandslos funktionierte - ein Berechtigungsdetail dieser Sitzung, kein
Serverfehler. Bei einer neuen Sitzung zuerst `localhost` probieren, falls
`127.0.0.1` nicht navigiert. Bei Zweifel an einer Testzahl im Browser: dieselbe
Assertion-Logik aus `tests/test.html` (Zeilen zwischen dem Testrahmen-Start und
dem DOM-Rendering-Teil) in Node gegen die Dateien auf der Platte laufen lassen,
das ist cachefrei und war in dieser Sitzung mehrfach die einzig verlässliche
Probe.

**Ideen für später (v2), bewusst nicht in v1** (aus `kostenrechner-PLAN.md`
Abschnitt 8, hier vollständig gegen den Plan abgeglichen):

- Mehrere Staedte gleichzeitig vergleichen, getrennte Rollen je
  Einkaufen/Craften/Verkaufen (wie beim Eintopf-Rechner), Transportkosten und
  Schwarzzonen-Risiko. Eine einzelne, frei waehlbare Stadt fuer die ganze
  Rechnung ist seit v1.1.0 umgesetzt (05.09.2026), s. "Aktueller Stand" oben.
- Markttiefe über `history` statt nur Bestpreis (Mischkalkulation bei Massenbedarf)
- Einkaufsliste über mehrere Items hinweg („ich brauche ein komplettes Set")
- Wartezeit und Ausfallrisiko eigener Kauf-/Verkaufsorders
- Craft-Fame und Spezialisierungsaufbau als Nutzen (die App rechnet Silber,
  nicht Fortschritt)
- Ernte, Farmen, Inseln (nur Markt und Werkbank in v1)
- Mengenrabatt durch ganze Chargen (v1 rechnet stetig, s. Plan 4.4)
