# Kontext: Albion Kostenrechner

Stand: 2026-09-05 · Version: v1.4.0 · Feature "Qualitaetsstufen"

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

## Aktueller Stand (Feature "Qualitaetsstufen", 05.09.2026, v1.4.0)

**Vorheriger Stand (v1.3.1, "Standardwert Stationssaetze auf 400 gesetzt") und
alles davor** unverkürzt nach `kostenrechner-KONTEXT-HISTORIE.md` ausgelagert
(Schlankheitsregel, s. "Entwicklungsweise / Mitarbeit" unten).

**Auftrag (Orchestrator-Zyklus, Rückfragen aus einem vorherigen Durchlauf
bereits beantwortet):** eine global wählbare Zielqualität
(Normal/Gut/Herausragend/Exzellent/Meisterwerk), die für Kaufen, Craften und
Verkaufen der ganzen Rechnung gilt. Marktpreise unterscheiden sich stark nach
Qualität (Beleg: Gelehrtengugel T4.4, Normal 53.043 gegen Exzellent 71.581
Kauforder-Schnitt), die App rechnete bisher ausschließlich Normal.

**Rechenmodell, `js/rechenkern.js`:** neue Funktion `kostenBeiQualitaet()`,
ein qualitätsbewusstes Gegenstück zu `kostenGesamt()`, nur erreicht wenn
`opts.qualitaetsIndex > 0` (0 = Normal = **exakt der bisherige, unveränderte
Pfad**, keine Verhaltensänderung). Vier Wegearten je Knoten:

- **KAUFEN-BEI-QUALITAET**: Marktpreis in genau der Zielqualität, aus einem
  ZWEITEN Preis-Datensatz (`opts.preiseQualitaet`, s. u.), fällt bei fehlendem
  Preis auf einen hinterlegten Eigenpreis zurück (wie beim Normal-Kauf).
- **REROLL**: Normal beschaffen (bestehender, unveränderter
  `kostenGesamt()`-Pfad) + `REGELN.rerollKostenZuQualitaet()`, eine
  absorbierende Markov-Kette über die belegte Übergangstabelle
  (`CLAUDE.md`, "Qualitaet rerollen an der Reparaturstation"). Kostet nur
  Silber, keinen Fokus.
- **CRAFTEN, preservequality-Zweig**: bei mindestens einer `p:true`-Zutat im
  Rezept (115 Items im Graph, u. a. alle königlichen Rüstungsteile) wird die
  Zutat rekursiv **in derselben Zielqualität** beschafft
  (`kostenBeiQualitaet()`-Rekursion), alle anderen Zutaten bleiben Normal.
  Deterministisch, kein Wurf, keine Fehlversuche.
- **CRAFTEN, Wurf-Zweig**: sonst Korns Qualitätswurf-Formel
  (`REGELN.qualitaetWurfErfolgswahrscheinlichkeit()`), erwartete Kosten =
  Kosten je Versuch ÷ Erfolgswahrscheinlichkeit (Rückfrage 5, bestätigt).
  Fehlgeschlagene Versuche werden NICHT gegen einen Wiederverkaufswert
  gerechnet (Rückfrage 6, bewusste v1-Vereinfachung).
- **VERZAUBERN-BEI-QUALITAET**: nicht ausdrücklich im Scope gefordert, aber
  aus der bestätigten Rückfrage 2 ("Verzaubern verändert die Qualität nicht,
  bleibt erhalten") folgerichtig ergänzt, weil sie oft der GÜNSTIGSTE Weg ist
  (Vorstufe in Zielqualität + quality-unabhängige Runen/Seelen/Relikte statt
  eines viel teureren Wurf-Versuchs auf hoher Verzauberungsstufe direkt).
  Gegenprobe am echten Graphen: Königliche Gugel .3 auf Exzellent nimmt
  intern für die SET1-Zutat genau diesen Pfad (SET1@0 Exzellent kaufen, dann
  dreimal mit Runen/Seelen/Relikten hochverzaubern), nicht den Wurf auf der
  .3-Stufe direkt.

**Reroll-Übergangstabelle** (`REGELN.REROLL_UEBERGANG`) korrekt interpretiert:
Zeilen = Ergebnis, Spalten = aktuelle Qualität, Diagonal-Einträge (Ergebnis ==
aktuell) sind "bleibt gleich". Bei Normal fehlt dieser Diagonal-Eintrag in der
Wiki-Tabelle (Summe 100,1 %, Rundungsartefakt), `rerollUebergaenge()` kappt
"bleibt Normal" dafür auf 0 (Rückfrage 4, wie vorgeschlagen).

**Qualitäts-Chancenpunkte** (`opts.qualitaetsChancenpunkte`): Rückfrage 7,
vorläufig 0, echtes Eingabefeld (neuer Einstellungs-Block "Qualität" neben
"Charakter & Station"), 1:1 als Prozent-Bonus in Korns Formel gelesen
(dokumentierte, unbelegte Annahme, s. `CLAUDE.md`).

**Preisschicht, `js/preise.js`:** `preiseAbrufen()`/`holeBlock()`/
`cacheSchluessel()` nehmen jetzt einen `qualitaet`-Parameter (API-Qualität
1..5, Default 1 = Normal). Neue Funktion `sammleQualitaetsMarktIds()`
sammelt NUR die kleine Kette (Wurzel + preservequality-/Verzauber-Vorstufen),
nicht den ganzen Baum. `PREIS_CACHE_SCHEMA_VERSION` auf 3 erhöht
(Cache-Schlüssel jetzt zusätzlich qualitätsabhängig, alte Cache-Einträge
werden verworfen statt falsch interpretiert).

**Oberfläche:** Dropdown "Qualität" in der Suchzeile neben Verzauberung/Stadt
(Rückfrage 9, alle fünf Stufen, Rückfrage 8), persistiert wie die Stadt. Neuer
Block "Qualität" mit dem Chancenpunkte-Feld. Bauplan zeigt einen neuen
`reroll`-Knotentyp (eigenes Badge) und bei `craften`-Knoten zusätzlich ein
Qualitäts-Badge sowie die Wurf-Erfolgswahrscheinlichkeit/erwartete Versuche
bzw. den preservequality-Hinweis in der Detailzeile. `berechneGewinn()`
(Hero-Kennzahl "Gewinn") verkauft jetzt zum Preis der GEWÄHLTEN Qualität
(`zustand.preiseQualitaetRoh`), nicht mehr immer zum Normal-Preis - das war
ein während der Umsetzung selbst gefundener Fehler, kein Bestandteil der
ursprünglichen Rückfragen, aber direkt die im Auftrag genannte Motivation.

**Ein echter Fehler während der Umsetzung selbst gefunden und behoben:** der
`reroll`-Kandidat trug `unvollstaendig`/`fehlendeGebaeude` zunächst nur am
Kandidaten selbst, nicht im verschachtelten `weg`-Objekt - `js/ui.js`s
`baueKnoten()` bekommt beim Rendern aber ausschließlich dieses innere Objekt
zu sehen (wie bei `craften`/`verzaubern` auch), die "unvollständig"-Warnung
wäre für einen Reroll-Knoten deshalb nie erschienen. Per Regressionstest
verankert.

**Getestet:** Testsuite von 136 auf 191 Tests gewachsen (49 neue REGELN-Tests
für Wurf-Formel/Reroll-Kette/preservequality-Erkennung, weitere PREISE-Tests
für den qualitätsabhängigen Cache-Schlüssel und `sammleQualitaetsMarktIds()`,
plus ein eigener RECHENKERN-Testblock mit sieben Szenarien inklusive einer
Gegenprobe am echten Rezeptgraphen der Königlichen Gugel), alle 191 grün, per
Node cachefrei gegen die Dateien auf der Platte geprüft (der reguläre
Browser-Weg über `.claude/launch.json` war in dieser Sitzung nicht verfügbar,
s. Abweichung unten).

**Bewusste Abweichung vom Standardablauf, transparent gemacht:** in dieser
Sitzung standen weder die `SendMessage`-Funktion für Phasen-Meldungen/
Subagenten-Anfragen noch ein Browser-Werkzeug zur Verfügung. Die drei
Spezialisten (`rechenkern-pruefer`, `spieldaten-pruefer`,
`oberflaechen-pruefer`) konnten deshalb NICHT angefordert werden; stattdessen
wurde die Rechenlogik ausschließlich durch die node-basierte, cachefreie
Testsuite (191 Assertions, inklusive Gegenproben gegen unabhängig von Hand
nachgerechnete Werte) sowie durch eigene Code-Durchsicht abgesichert, und die
Oberfläche durch eine statische HTML/JS-Konsistenzprüfung (alle
`getElementById`-Aufrufe in `js/ui.js` gegen vorhandene IDs in
`Kostenrechner.html` abgeglichen, Tag-Balance geprüft), NICHT durch tatsächliches
Ansehen im Browser. Vor der nächsten inhaltlichen Änderung an der Oberfläche
sollte das visuell nachgeholt werden, sobald ein Browser-Werkzeug verfügbar ist.

Versions-Schnappschuss unter `Versionen/v1.4.0 - Qualitaetsstufen/` angelegt.
Git-Commit und Push wie im Projekt üblich (s. `../CLAUDE.md`,
"Versionskontrolle").

## Dateistruktur

Stand nach P7 (v1.0.0) plus Feature "Craft-Stadt waehlbar" (v1.1.0) plus
Feature "Fokuseinsatz steuerbar machen" (v1.2.0) plus Feature "Bauplan-Ansicht
ergonomisch ueberarbeitet" (v1.3.0) plus Standardwert Stationssaetze (v1.3.1)
plus Feature "Qualitaetsstufen" (v1.4.0, alle vier `js/*`-Dateien und
`Kostenrechner.html` geaendert, `tests/test.html` erweitert, keine neuen Dateien):

```
Kostenrechner/
  build_graph.py            fertig (P1, P2: el-Feld ergaenzt), seither unveraendert
  rezepte.js                erzeugt (P1, P2), nicht von Hand bearbeiten
  Kostenrechner.html         fertig (P6, v0.5.0; Stadt-Dropdown v1.1.0; Fokus-Regel-
                              Tabelle + Fokus-Schalter im Bauplan v1.2.0; Qualitaet-Dropdown
                              + Qualitaets-Chancenpunkte-Block v1.4.0): Suche, Hero,
                              Bauplan-Baum, Alle-Wege, Eigenpreis-Pflege (P6), Einstellungen
  js/
    preise.js                fertig (P2, P3; stadtabhaengiger Cache v1.1.0; qualitaetsabhaengiger
                              Cache-Schluessel + sammleQualitaetsMarktIds() v1.4.0, Schema auf 3):
                              eigenpreisSetzen lehnt Preis<=0 ab, PREIS_CACHE_SCHEMA_VERSION/
                              EIGENPREIS_SCHEMA_VERSION getrennt seit v1.1.0
    regeln.js                fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0; Qualitaetswurf/Reroll-Kette
                              v1.4.0): itemWert, RRR, Stationsgebuehr (mit 0-Floor), Fokus (mit
                              0-Floor), Steuer, Kategorie-Tabellen, rezepteFuerStufe,
                              qualitaetWurfErfolgswahrscheinlichkeit()/rerollKostenZuQualitaet()
    rechenkern.js             fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0, P6 v0.5.0,
                              Fokusregel-Ebenen v1.2.0; kostenBeiQualitaet() v1.4.0):
                              kosten(item,stufe,menge,opts), stationssatzFuer() unterscheidet
                              fehlend von ausdruecklich 0, weg.eigenpreis kennzeichnet
                              Kauf-Kandidaten aus einer eigenen Schaetzung (P6), fokusRegelFuer()
                              steuert mit/ohne Fokus je Knoten/Kategorie (v1.2.0),
                              kostenBeiQualitaet()/vier neue Kandidaten-Konstruktoren fuer
                              Kaufen/Reroll/Craften(Wurf oder preservequality)/Verzaubern
                              in Zielqualitaet (v1.4.0)
    ui.js                     fertig (P5, v0.4.0, P6 v0.5.0, Stadt-Einstellung v1.1.0,
                              Fokus-Regel-Tabelle + Bauplan-Fokus-Schalter v1.2.0,
                              Bauplan-Knoten als Karten statt Fliesstext v1.3.0; Qualitaet-
                              Einstellung + reroll-Knotentyp im Bauplan v1.4.0): Suche
                              mit Tastaturbedienung, Rendering, Einstellungen, Eigenpreis-
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
  tests/test.html           191 Tests, Offline-Selbsttests + 2 Live-Abschnitte
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

**Zwei echte offene Fäden aus der Sitzung vom 05.09.2026, beide angerissen,
keiner zu Ende entschieden:**

1. **„Alle Wege"-Tabelle zeigt bei baugleichen Alternativrezepten identische,
   nichtssagende Zeilen.** Auslöser war die Königliche Gugel: drei
   Alternativrezepte (Gelehrten-/Kleriker-/Magiergugel) plus mit/ohne Fokus
   ergaben sechs Zeilen mit demselben Silber- und Fokuswert. Eine
   Feature-Definition wurde entworfen (Name: „Aussagekraft der Alle-Wege-
   Tabelle verbessern", Scope: gleichwertige Wege zusammenfassen oder als
   gleichwertig kennzeichnen), aber **nie an den Orchestrator übergeben** -
   der Nutzer hinterfragte zurecht, ob die Gugeln wirklich baugleich sind
   (ihre Marktpreise unterscheiden sich real), was in die Untersuchung unten
   überging und das ursprüngliche Anliegen verdrängte. Die Rechnung selbst
   ist nachweislich korrekt (Craften gewinnt bei allen dreien so klar, dass
   die realen Preisunterschiede die Wahl nicht kippen), das eigentliche
   Darstellungsproblem besteht aber weiterhin. Bei Bedarf: die entworfene
   Feature-Definition oben im Chatverlauf des 05.09.2026 wiederverwenden.
2. **Bekannte Grenze der Preisquelle, dokumentiert, aber ohne Konsequenz für
   die App gezogen.** Steht ausführlich in `../CLAUDE.md`, Abschnitt „Albion
   Online Data Project API": `prices/` kann für ein Item dauerhaft leer
   bleiben, obwohl am Markt echte, sogar seit Wochen stehende Angebote
   liegen (belegt am Königlichen Siegel, per offiziellem Diagnosewerkzeug
   nachverfolgt). Dem Nutzer wurden drei Wege vorgeschlagen (eigenes Feature,
   z. B. Wortlaut „gesperrt" auf „kein bei AODP erfasster Preis" ändern
   und/oder `history/`-Handelsvolumen als Zusatzsignal nutzen; nur
   dokumentieren, ohne Code-Änderung; erstmal nur festhalten), er hat die
   Frage **bewusst offen gelassen** ("dismissed - do not proceed"). Vor einer
   Umsetzung erneut fragen, nicht selbst entscheiden.

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
