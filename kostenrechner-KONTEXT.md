# Kontext: Albion Kostenrechner

Stand: 2026-09-05 · Version: v1.3.1 · Standardwert Stationssaetze auf 400 gesetzt
(kein Paket aus dem Plan, kleine Nutzer-Vorgabe)

> Diese Datei ist die **einzige Quelle für eine frische Session**: aktueller Stand,
> Fachlogik der App, Dateistruktur, Arbeitsweise, offenes Backlog. Zu Beginn jeder
> Arbeit an diesem Projekt vollständig lesen.
>
> Der **Auftrag** steht in `kostenrechner-PLAN.md` und ändert sich kaum. Die
> **Spielregeln und belegten Formeln** stehen in `../CLAUDE.md`. Diese Datei hier
> beschreibt, wie weit die Anwendung ist.

## Was ist das?

Eine Web-App, die für ein beliebiges craftbares Albion-Item auf einer beliebigen
Verzauberungsstufe den **günstigsten Beschaffungsweg** ermittelt: kaufen, craften,
aus einer niedrigeren Stufe hochverzaubern, oder eine Mischung daraus über den
ganzen Rezeptbaum. Alles in Lymhurst, Qualität Normal.

Ziel und Rechenmodell: `kostenrechner-PLAN.md`, Abschnitte 1 und 4.

## Aktueller Stand (Standardwert Stationssaetze, 05.09.2026, v1.3.1)

**Vorheriger Stand (v1.3.0, Feature "Bauplan-Ansicht ergonomisch
ueberarbeitet") und alles davor** unverkürzt nach
`kostenrechner-KONTEXT-HISTORIE.md` ausgelagert (Schlankheitsregel, s.
"Entwicklungsweise / Mitarbeit" unten).

**Auftrag, direkt vom Nutzer, ohne Orchestrator-Zyklus (kleine, klar
umrissene Aenderung):** die Stationssaetze-Tabelle in den Einstellungen war
vorher fuer jedes Gebaeude leer, jede Berechnung startete deshalb als
"unvollstaendig", bis der Nutzer alle 14 Gebaeude von Hand ausfuellte. Der
Nutzer hatte das bereits fuer sich selbst auf 400 gesetzt und wollte das als
Standardwert, statt es nach jedem Zuruecksetzen erneut einzutragen.

**Umsetzung, zwei Stellen in `js/ui.js`:**

- `defaultEinstellungen()`: `stationssaetze` startet jetzt mit 400 fuer jedes
  Gebaeude aus `REGELN.KATEGORIE_ZU_GEBAEUDE` (alle 14 Eintraege, inklusive
  der drei Sonderfaelle Nebenhand/Kampfhandschuhe/Tierhaltung), statt einem
  leeren Objekt.
- `einstellungenLesen()`: die gespeicherten Saetze werden jetzt mit den
  Standardwerten zusammengefuehrt (`Object.assign`) statt sie komplett zu
  ersetzen. Ein Gebaeude, das der Nutzer ausdruecklich auf einen anderen Wert
  gesetzt hat, bleibt dabei erhalten; ein Gebaeude, das noch nie gesetzt
  wurde (auch ein erst spaeter hinzugekommenes), bekommt den 400er-Standard
  statt leer zu bleiben.

**Bleibt ein echtes Eingabefeld, keine Konstante im Code.** `CLAUDE.md`,
Abschnitt "Spielerprofil", verlangt ausdruecklich: die Nutzungsgebuehr ist
Eigentuemer-gesetzt, unterscheidet sich je Gebaeude und aendert sich laufend,
gehoert deshalb als Eingabefeld, nie als Konstante in die Rechenlogik. 400
ist hier nur der VORBELEGTE Wert dieses Feldes (in `js/ui.js`), nicht in
`rechenkern.js`/`regeln.js` verankert; jedes Gebaeude bleibt frei editierbar.

**Bewusste Nebenwirkung:** ein Gebaeude, das der Nutzer ueber das Eingabefeld
wieder leert, bekommt beim naechsten Laden erneut 400 statt in den Zustand
"nicht gepflegt" zurueckzufallen. Der Nutzer hat mit "pauschal 400 im
Standard" explizit diesen Ersatz fuer die bisherige Vorsichts-Warnung
gewaehlt, das ist keine versehentliche Regression.

**Stadt-unabhaengig, wie vorgesehen:** Stationssaetze sind seit jeher nicht
nach Stadt getrennt (eine reale, vom Nutzer selbst betriebene oder genutzte
Station, keine Eigenschaft der Stadt-Auswahl), 400 gilt deshalb automatisch
"in jeder Stadt", ohne dass die Stadt-Umschaltung angefasst werden musste.

**Getestet:** Testsuite (keine der 136 Tests beruehrt `defaultEinstellungen()`
oder `einstellungenLesen()` direkt) unveraendert 136/136 gruen, per Node
cachefrei gegen die Dateien auf der Platte geprueft. Im Browser mit
komplett geleertem `localStorage` bestaetigt: alle 14 Gebaeude zeigen 400,
die "unvollstaendig"-Warnung erscheint bei einer frischen Rechnung nicht
mehr, echte Stationsgebuehren (z.B. 7.373 fuer den Magierturm) erscheinen
sofort im Bauplan statt 0.

Versions-Schnappschuss unter `Versionen/v1.3.1 - Stationssaetze Standard 400/`
angelegt, wie bei jeder abgeschlossenen Aenderung, unabhaengig davon, ob sie
ueber einen Orchestrator-Zyklus oder inline erfolgte.

## Dateistruktur

Stand nach P7 (v1.0.0) plus Feature "Craft-Stadt waehlbar" (v1.1.0) plus
Feature "Fokuseinsatz steuerbar machen" (v1.2.0) plus Feature "Bauplan-Ansicht
ergonomisch ueberarbeitet" (v1.3.0, nur `Kostenrechner.html`/`js/ui.js`
geaendert, keine Dateien neu hinzugekommen):

```
Kostenrechner/
  build_graph.py            fertig (P1, P2: el-Feld ergaenzt), seither unveraendert
  rezepte.js                erzeugt (P1, P2), nicht von Hand bearbeiten
  Kostenrechner.html         fertig (P6, v0.5.0; Stadt-Dropdown v1.1.0; Fokus-Regel-
                              Tabelle + Fokus-Schalter im Bauplan v1.2.0): Suche, Hero,
                              Bauplan-Baum, Alle-Wege, Eigenpreis-Pflege (P6), Einstellungen
  js/
    preise.js                fertig (P2, P3; stadtabhaengiger Cache v1.1.0): eigenpreisSetzen
                              lehnt Preis<=0 ab, PREIS_CACHE_SCHEMA_VERSION/EIGENPREIS_SCHEMA_VERSION
                              getrennt seit v1.1.0
    regeln.js                fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0): itemWert, RRR,
                              Stationsgebuehr (mit 0-Floor), Fokus (mit 0-Floor), Steuer,
                              Kategorie-Tabellen, rezepteFuerStufe
    rechenkern.js             fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0, P6 v0.5.0,
                              Fokusregel-Ebenen v1.2.0): kosten(item,stufe,menge,opts),
                              stationssatzFuer() unterscheidet fehlend von ausdruecklich 0,
                              weg.eigenpreis kennzeichnet Kauf-Kandidaten aus einer eigenen
                              Schaetzung (P6), fokusRegelFuer() steuert mit/ohne Fokus je
                              Knoten/Kategorie (v1.2.0)
    ui.js                     fertig (P5, v0.4.0, P6 v0.5.0, Stadt-Einstellung v1.1.0,
                              Fokus-Regel-Tabelle + Bauplan-Fokus-Schalter v1.2.0,
                              Bauplan-Knoten als Karten statt Fliesstext v1.3.0): Suche
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
  tests/test.html           136 Tests, Offline-Selbsttests + 2 Live-Abschnitte
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
- Qualitätsstufen über Normal hinaus, und die Craft-Qualitätschance
- Markttiefe über `history` statt nur Bestpreis (Mischkalkulation bei Massenbedarf)
- Einkaufsliste über mehrere Items hinweg („ich brauche ein komplettes Set")
- Wartezeit und Ausfallrisiko eigener Kauf-/Verkaufsorders
- Craft-Fame und Spezialisierungsaufbau als Nutzen (die App rechnet Silber,
  nicht Fortschritt)
- Ernte, Farmen, Inseln (nur Markt und Werkbank in v1)
- Mengenrabatt durch ganze Chargen (v1 rechnet stetig, s. Plan 4.4)
