# Kontext: Albion Kostenrechner

Stand: 2026-09-05 · Version: v1.5.1 · Veredeln-Spezialisierungsknoten nach Tier gruppiert (Bugfix)

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

## Aktueller Stand (Veredeln-Spezialisierungsknoten nach Tier gruppiert, Bugfix, 05.09.2026, v1.5.1)

**Bug, im Hauptgespräch per Browser-Test gefunden** (an v1.5.0 direkt im
Anschluss, noch bevor der Browser-Check aus v1.5.0 nachgeholt wurde): das
`fiber`-Panel der Königlichen Gugel zeigte 5 Knoten **nach Verzauberungsstufe
getrennt** ("Einfacher Stoff", CLOTH_LEVEL1 bis LEVEL4), statt der im Spiel
tatsächlich existierenden 5 Knoten **nach Tier-Stufe getrennt** (Weberadept T4,
Weberexperte T5, Webermeister T6, Webergroßmeister T7, Weberältester T8),
bestätigt durch Schicksalsbrett-Screenshots des Nutzers.

**Ursache:** `gruppenSchluesselVonItem()` (`js/regeln.js`) strippte einheitlich
das Tier-Präfix und ließ den Verzauberungs-Suffix stehen. Das passt für
Ausrüstung (ein Item-Name über alle Tiers, Verzauberungsstufe steckt NICHT im
Namen, sondern in `e[stufe].r`), aber nicht für Veredeln: dort ist jede
Verzauberungsstufe ein **eigener** uniquename mit `_LEVEL1` bis `_LEVEL4`-Suffix
(`T4_CLOTH`, `T4_CLOTH_LEVEL1` ... `T4_CLOTH_LEVEL4`), während das Tier-Präfix
die eigentlich zählende Größe ist.

**Fix:** `gruppenSchluesselVonItem(item, cc)` bekommt einen zweiten,
optionalen Parameter. Bei `spezTypVonKategorie(cc) === "veredeln"`
(`fiber`/`ore`/`hide`/`wood`/`rock`) wird der `_LEVEL\d+`-Suffix entfernt, das
Tier-Präfix aber **behalten** (Gegenteil der Ausrüstungs-Regel). Beide
Aufrufstellen (`spezialisierungsGruppen()` in `regeln.js`, `fceFuer()` in
`rechenkern.js`) reichen `cc` jetzt durch. `js/ui.js` unverändert, da es nur
`REGELN.spezialisierungsGruppen(cc)` aufruft, die die Weiche intern trägt.

**Nebenbefund beim Testen, im Auftrag nicht erwähnt, aber vom selben Fix
mitbehoben:** `rock` (Steinblöcke) hat gar keine `_LEVEL`-Suffixe im
Item-Namen (Steinblöcke werden nicht verzaubert), die alte Regel hätte dort
alle 7 Tiers (T2 bis T8) fälschlich zu EINEM einzigen Knoten "STONEBLOCK"
zusammengefasst - das genaue Gegenteil des gemeldeten Fehlers, aber derselbe
Kategorie-Typ und vom selben Fix (Tier-Präfix behalten) automatisch mit
korrigiert. Gegenprobe gegen den echten Graphen: `spezialisierungsGruppen("fiber")`
liefert jetzt 7 Gruppen (T2_CLOTH bis T8_CLOTH, je ein Knoten mit allen 5
Verzauberungsstufen als Mitgliedern), `spezialisierungsGruppen("cloth_helmet")`
unverändert 9 Gruppen (Ausrüstung, tier-übergreifend). FCE-Rechenprobe mit den
Nutzer-Testwerten (Weberadept 75, Weberexperte/-meister/-großmeister je 1,
Weberältester 0): `T4_CLOTH` → 18.840 FCE (75×250 Unique + 90 Mutual von den
drei anderen Stufe-1-Knoten).

**Getestet:** Testsuite von 212 auf 220 Tests gewachsen (8 neue: 5
Einheitstests `gruppenSchluesselVonItem(item, cc)` inkl. Regressionstest "ohne
cc/nicht-veredelnde Kategorie unverändert", 3 Gegenproben
`spezialisierungsGruppen("fiber")` gegen den echten Rezeptgraphen: T4-Gruppe
fasst alle 5 Stufen zusammen, T5 ist eine eigene Gruppe, keine
`CLOTH_LEVEL*`-Gruppe mehr). Alle 220 grün, per Node cachefrei gegen die
Dateien auf der Platte geprüft (Testrahmen aus `tests/test.html`,
Zeilen 71-1263, per `vm.runInContext` mit `localStorage`/`performance`-Stub
ausgeführt, identische Logik wie im Browser, kein Node-Modul-Cache möglich, da
frisch aus der Datei geladen). Zusätzlich zwei eigene Rechenskripte gegen den ECHTEN
Rezeptgraphen: Gruppenliste für `fiber` und `cloth_helmet` von Hand
nachgesehen (s. Nebenbefund oben), FCE-Werte mit den Nutzer-Testdaten von Hand
nachgerechnet.

**Bewusste Abweichung vom Standardablauf, wie schon in v1.4.0/v1.5.0:** weder
die `SendMessage`-Funktion für Phasen-Meldungen/Subagenten-Anfragen noch ein
interaktives Browser-Werkzeug standen in dieser Sitzung zur Verfügung (kein
`SendMessage`, kein `Agent`, keine `mcp__claude-in-chrome__*`- oder
`mcp__computer-use__*`-Tools im verfügbaren Werkzeugsatz, trotz
Systemhinweisen, die sie erwähnen). Die drei Spezialisten
(`rechenkern-pruefer`, `spieldaten-pruefer`, `oberflaechen-pruefer`) konnten
deshalb NICHT angefordert werden. Ein lokaler Server
(`.claude/no_cache_server.py`, Port 8791) wurde probehalber gestartet und
antwortete mit HTTP 200 auf `Kostenrechner.html`, konnte aber mangels
Browser-Werkzeug nicht tatsächlich angesehen werden. **Die reparierte
Oberfläche wurde also weiterhin NICHT im Browser angesehen** - das steht schon
so in der v1.5.0-Notiz und gilt unverändert. Vor der nächsten inhaltlichen
Änderung an der Oberfläche nachholen, sobald ein Browser-Werkzeug verfügbar
ist.

Versions-Schnappschuss unter `Versionen/v1.5.1 - Veredeln-
Spezialisierungsknoten nach Tier gruppiert/` angelegt. Git-Commit und Push wie
im Projekt üblich (s. `../CLAUDE.md`, "Versionskontrolle").

---

**Vorheriger Stand (v1.5.0, Feature "FCE-Ableitung ueber
Schicksalsbrett-Knotenliste je Kategorie") und alles davor** unverkürzt nach
`kostenrechner-KONTEXT-HISTORIE.md` ausgelagert (Schlankheitsregel, s.
"Entwicklungsweise / Mitarbeit" unten).

## Dateistruktur

Stand nach P7 (v1.0.0) plus Feature "Craft-Stadt waehlbar" (v1.1.0) plus
Feature "Fokuseinsatz steuerbar machen" (v1.2.0) plus Feature "Bauplan-Ansicht
ergonomisch ueberarbeitet" (v1.3.0) plus Standardwert Stationssaetze (v1.3.1)
plus Feature "Qualitaetsstufen" (v1.4.0) plus "FCE-Ableitung ueber
Schicksalsbrett-Knotenliste je Kategorie" (v1.5.0) plus Bugfix "Veredeln-
Spezialisierungsknoten nach Tier gruppiert" (v1.5.1, nur `js/regeln.js` und
`js/rechenkern.js` geaendert, `tests/test.html` erweitert, `js/ui.js` und
`Kostenrechner.html` unveraendert, keine neuen Dateien):

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
  tests/test.html           220 Tests, Offline-Selbsttests + 2 Live-Abschnitte
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
