# Kontext: Albion Kostenrechner

Stand: 2026-09-05 · Version: v1.5.2 · Fokus-Monotonie-Regressionstest (Diagnose, kein Codefehler gefunden)

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

## Aktueller Stand (Fokus-Monotonie-Regressionstest, Diagnose ohne Codefehler, 05.09.2026, v1.5.2)

**Gemeldeter kritischer Bug (Hauptgespräch, Live-Browser-Test):** Königliche
Gugel des Adepten .3, Qualität Exzellent, Lymhurst, FCE-Feld 0, Fokuswert 0.
Vor Eintragen der Spezialisierungsknoten zeigte der Bauplan-Schritt "Craften
Normal beschaffen Gelehrtengugel des Adepten.3 mit Fokus" 754,9 Fokus; nach
Eintragen echter Werte (`cloth_helmet` → Gelehrtengugel-Knoten 60,
`fiber` → Guter Stoff 75 + Kunstvoller/Qualitäts-/Luxusstoff je 1) zeigte
derselbe Schritt 1.233,5 Fokus, obwohl die FCE für beide Kategorien massiv
gestiegen war (0 → 15.000 bzw. 18.840). Das widerspräche der belegten Formel
`Fokus = Grundfokus × 0,5^(FCE/10.000)` (streng monoton fallend in FCE).
Silber blieb bei beiden Zuständen identisch (165.856).

**Systematische Diagnose (kein Raten), Ergebnis: kein Fehler in
`js/regeln.js`/`js/rechenkern.js` gefunden.** Vorgehen:

1. Isolierte Node-Reproduktion gegen den ECHTEN Rezeptgraphen (`rezepte.js`),
   mit `fceUeberschreibungenFuerOpts()` (aus `js/ui.js`) 1:1 nachgebaut. Mit
   passend gewählten Preisen (Basisrohstoffe billig und bepreist, alle
   Zwischen-/Endprodukte ohne Marktpreis → craften/reroll ist die einzige
   Option) trifft der berechnete NACH-Wert **exakt** 1.233,5021946275801 -
   die gemeldete Reproduktion ist damit nachvollzogen. Der VOR-Wert der
   gleichen Rechnung ergab aber 3.677,02, nicht 754,9 - also ein Rückgang
   (3.677 → 1.234), keine Erhöhung.
2. **Mathematischer Beweis, warum bei `fokuswert:0` keine Erhöhung möglich
   ist:** `RRR` hängt in `regeln.js`/`rrr()` ausschließlich vom `mitFokus`-Flag
   ab, nie von der FCE. `wert = silber + fokus × fokuswert` ist bei
   `fokuswert:0` identisch mit `silber`, und `silber` referenziert die FCE an
   keiner Stelle (`craftKandidat()`/`craftBeiQualitaetKandidat()`). Der
   gewählte Bauplan (welcher Knoten kauft/craftet/verzaubert/rerollt) kann sich
   durch eine reine FCE-Änderung bei `fokuswert:0` also gar nicht verschieben -
   nur der Fokus-Anteil eines bereits feststehenden Pfads sinkt mit steigender
   FCE, niemals steigt er.
3. **Property-Test (kein Einzelfall):** über 1.500 zufällige Kombinationen aus
   Kategorien, Qualitätsstufen (Normal bis Meisterwerk), Qualitäts-
   Chancenpunkten und Marktpreisen gegen mehrere echte Items unterschiedlicher
   `SPEZ_TYP`-Klassen (Waffen/Rüstung, Umhang, Tasche, Werkzeug/fused, Tränke)
   durchprobiert, dabei die Spezialisierungsstufen monoton erhöht: **keine
   einzige Verletzung** der Monotonie gefunden.

**Wahrscheinlichste Erklärung, NICHT bestätigt (dafür fehlt der Zugriff auf
die tatsächliche Sitzung/den localStorage-Stand):** ein von 0 abweichender
Fokuswert, der aus einer früheren Sitzung noch in `localStorage` stand (die
App persistiert Einstellungen dauerhaft, s. `einstellungenLesen()`/
`einstellungenSchreiben()` in `js/ui.js`; die eigenen Testfixturen dieses
Projekts verwenden z. B. `fokuswert: 5`). Bei `fokuswert > 0` KANN sich der
günstigste Weg mit steigender FCE tatsächlich von einem 0-Fokus-Weg (kaufen/
verzaubern) zu einem fokusnutzenden Weg verschieben, sobald der sinkende
Fokus-Malus den Silbervorteil des Craftens überwiegt - das ist kein
Formelfehler, sondern die gewollte Abwägung der Zielfunktion selbst, kann aber
den Gesamtfokus des gewählten Pfads erhöhen, wenn vorher ein 0-Fokus-Weg
gewonnen hatte. Per `AskUserQuestion`/Rückfrage zu klären: den Fokuswert im
Einstellungen-Panel vor einem erneuten Test ausdrücklich auf 0 prüfen.

**Umgesetzt statt eines Codefixes:** ein permanenter Regressionstest in
`tests/test.html` (Abschnitt "Regressionstest Fokus-Monotonie", gegen den
ECHTEN Rezeptgraphen, 5 Stufen aufsteigender Spezialisierung inklusive exakt
der gemeldeten Nutzerwerte als einer der Stufen), der genau diese Invariante
dauerhaft absichert: Fokus darf über keine zwei aufeinanderfolgenden Stufen
steigen, Silber muss bei `fokuswert:0` über alle Stufen identisch bleiben, und
der gemeldete NACH-Wert wird als Fixpunkt exakt nachgerechnet. **Kein
`regeln.js`/`rechenkern.js` geändert** - die Diagnose fand dort keinen Fehler.

**Getestet:** Testsuite von 220 auf 228 Tests gewachsen (8 neue, alle in
Abschnitt "Regressionstest Fokus-Monotonie"). Alle 228 grün, per Node
cachefrei gegen die Dateien auf der Platte geprüft (`vm.runInContext` mit
`document`/`localStorage`/`performance`-Stub, identische Logik wie im
Browser, kein Modul-Cache möglich, da frisch aus der Datei geladen).

**Bewusste Abweichung vom Standardablauf, wie schon in v1.4.0-v1.5.1:** weder
`SendMessage` noch `Agent` noch ein interaktives Browser-Werkzeug
(`mcp__claude-in-chrome__*`/`mcp__computer-use__*`) standen in dieser Sitzung
zur Verfügung. Die drei Spezialisten (`rechenkern-pruefer`,
`spieldaten-pruefer`, `oberflaechen-pruefer`) konnten deshalb nicht
angefordert werden. Da diese Runde ausschließlich `tests/test.html` erweitert
(kein `regeln.js`/`rechenkern.js`/`ui.js`/`Kostenrechner.html` geändert), ist
weder ein Browser-Rundgang noch ein Rechenkern-/Oberflächen-Review inhaltlich
zwingend nötig; nachzuholen ist trotzdem eine echte Bestätigung durch den
Nutzer im Spiel/in der laufenden App, sobald der Fokuswert-Verdacht geklärt
ist.

Versions-Schnappschuss unter `Versionen/v1.5.2 - Fokus-Monotonie-
Regressionstest (Diagnose ohne Codefehler)/` angelegt. Git-Commit und Push wie
im Projekt üblich (s. `../CLAUDE.md`, "Versionskontrolle").

---

**Vorheriger Stand (v1.5.1, Bugfix "Veredeln-Spezialisierungsknoten nach Tier
gruppiert") und alles davor** unverkürzt nach `kostenrechner-KONTEXT-HISTORIE.md`
ausgelagert (Schlankheitsregel, s. "Entwicklungsweise / Mitarbeit" unten).

## Dateistruktur

Stand nach P7 (v1.0.0) plus Feature "Craft-Stadt waehlbar" (v1.1.0) plus
Feature "Fokuseinsatz steuerbar machen" (v1.2.0) plus Feature "Bauplan-Ansicht
ergonomisch ueberarbeitet" (v1.3.0) plus Standardwert Stationssaetze (v1.3.1)
plus Feature "Qualitaetsstufen" (v1.4.0) plus "FCE-Ableitung ueber
Schicksalsbrett-Knotenliste je Kategorie" (v1.5.0) plus Bugfix "Veredeln-
Spezialisierungsknoten nach Tier gruppiert" (v1.5.1) plus Diagnose
"Fokus-Monotonie-Regressionstest" (v1.5.2, nur `tests/test.html` erweitert,
kein Rechenkern-/Regeln-/UI-Code geaendert, keine neuen Dateien):

```
Kostenrechner/
  build_graph.py            fertig (P1, P2: el-Feld ergaenzt), seither unveraendert
  rezepte.js                erzeugt (P1, P2), nicht von Hand bearbeiten
  Kostenrechner.html         fertig (P6, v0.5.0; Stadt-Dropdown v1.1.0; Fokus-Regel-
                              Tabelle + Fokus-Schalter im Bauplan v1.2.0; Qualitaet-Dropdown
                              + Qualitaets-Chancenpunkte-Block v1.4.0; Schicksalsbrett-
                              Meisterschaft/Spezialisierung-Zeile ersetzt durch
                              #spezKnotenContainer-Panel v1.5.0): Suche, Hero,
                              Bauplan-Baum, Alle-Wege, Eigenpreis-Pflege (P6), Einstellungen
  js/
    preise.js                fertig (P2, P3; stadtabhaengiger Cache v1.1.0; qualitaetsabhaengiger
                              Cache-Schluessel + sammleQualitaetsMarktIds() v1.4.0, Schema auf 3):
                              eigenpreisSetzen lehnt Preis<=0 ab, PREIS_CACHE_SCHEMA_VERSION/
                              EIGENPREIS_SCHEMA_VERSION getrennt seit v1.1.0. Unveraendert seit v1.4.0.
    regeln.js                fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0; Qualitaetswurf/Reroll-Kette
                              v1.4.0; SPEZ_TYP/KATEGORIE_ZU_SPEZTYP/spezialisierungsGruppen()/
                              fceAusSpezialisierungsknoten() v1.5.0; gruppenSchluesselVonItem(item,cc)
                              Bugfix v1.5.1, s. "Aktueller Stand"): itemWert, RRR, Stationsgebuehr
                              (mit 0-Floor), Fokus (mit 0-Floor), Steuer, Kategorie-Tabellen,
                              rezepteFuerStufe, qualitaetWurfErfolgswahrscheinlichkeit()/
                              rerollKostenZuQualitaet(), Spezialisierungsknoten-Ableitung (v1.5.0/v1.5.1)
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
                              Prioritaetsebenen (Knoten > Kategorie-Freitext > global, v1.5.0)
    ui.js                     fertig (P5, v0.4.0, P6 v0.5.0, Stadt-Einstellung v1.1.0,
                              Fokus-Regel-Tabelle + Bauplan-Fokus-Schalter v1.2.0,
                              Bauplan-Knoten als Karten statt Fliesstext v1.3.0; Qualitaet-
                              Einstellung + reroll-Knotentyp im Bauplan v1.4.0;
                              fceAusSchicksalsbrett() entfernt, renderSpezialisierungsknoten()/
                              spezKnotenAnzeigeGruppen()/fceUeberschreibungenFuerOpts() v1.5.0):
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
  tests/test.html           228 Tests, Offline-Selbsttests + 2 Live-Abschnitte
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

3. **Fokuswert-Verdacht aus der v1.5.2-Diagnose, noch nicht durch den Nutzer
   bestätigt.** Der gemeldete Fokus-Anstieg (754,9 → 1.233,5) ließ sich mit
   `fokuswert:0` rechnerisch nicht reproduzieren (s. "Aktueller Stand"), wohl
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
