# Kontext: Albion Kostenrechner

Stand: 2026-09-05 · Version: v1.5.0 · FCE-Ableitung ueber Schicksalsbrett-Knotenliste je Kategorie

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

## Aktueller Stand (FCE-Ableitung ueber Schicksalsbrett-Knotenliste je Kategorie, 05.09.2026, v1.5.0)

**Vorheriger Stand (v1.4.0, Feature "Qualitaetsstufen") und alles davor**
unverkürzt nach `kostenrechner-KONTEXT-HISTORIE.md` ausgelagert
(Schlankheitsregel, s. "Entwicklungsweise / Mitarbeit" unten).

**Auftrag (Orchestrator-Zyklus über zwei Sitzungen, drei Rückfragen aus dem
ersten Durchlauf im zweiten beantwortet):** der bestätigte strukturelle Fehler
in der bisherigen `fceAusSchicksalsbrett(Meisterschaftsstufe,
Spezialisierungsstufe)`-Quick-Konvertierung (`js/ui.js`) sollte behoben
werden. Der Fehler: die Formel nahm EINEN globalen Spezialisierungswert an und
ignorierte sowohl den je Knotentyp unterschiedlichen Unique-/Mutual-Anteil
(`CLAUDE.md`, "FCE je Stufe hängt vom Knotentyp ab") als auch, dass der
Mutual-Anteil JEDES Spezialisierungsknotens auf ALLE ANDEREN Knoten derselben
Kategorie wirkt, nicht nur auf sich selbst.

**Rückfrage 1 (Herkunft der Knotenliste), beantwortet:** automatische
Ableitung aus dem Rezeptgraphen statt Handpflege. Items derselben
`craftingcategory` werden nach ihrem Namen ohne Tier-Präfix gruppiert (z. B.
`T4_MAIN_SWORD` bis `T8_MAIN_SWORD` → ein Knoten `MAIN_SWORD`). Pro im
Bauplan verwendeter Kategorie zeigt die Oberfläche ein Panel mit ALLEN
abgeleiteten Knoten dieser Kategorie, nicht nur den im Bauplan vorkommenden,
weil der Mutual-Anteil kategorieweit wirkt. Das ist eine Näherung (echte
Schicksalsbrett-Knoten können anders geschnitten sein); als Fallback für
Fehltreffer bleibt die bereits vorhandene kategorieweite Freitext-Ausnahme
(`Fokus-Effizienz-Ausnahmen je Kategorie`) erhalten und gewinnt automatisch,
solange für eine Kategorie im neuen Panel nichts eingetragen ist.

**Rückfrage 2 (Meisterschafts-Mutual bei Umhängen/Taschen/Werkzeugen),
beantwortet:** 30 FCE je Meisterschaftsstufe gilt einheitlich für
Rüstung/Waffen, Veredeln, Umhänge, Taschen (auch Kriegshammer). Echte
Ausnahme: „übrige Werkzeuge" (`tools`, `gatherergear`) haben KEINEN
getrennten Meisterschaftsknoten, Meisterschaft und Spezialisierung sind dort
zu einem „fused" Knoten verschmolzen (Ein-Feld-Modell: nur „Knotenstufe", kein
separates Meisterschaftsfeld).

**Rückfrage 3 (Speisen/Tränke), beantwortet:** beide folgen derselben
250-Unique/30-Mutual-Struktur wie Rüstung/Waffen samt getrenntem
Meisterschaftsknoten, unterscheiden sich nur in der Zahl der
Spezialisierungsknoten (Koch 9 → max. 55.000 FCE, Alchemist 8 → max. 52.000
FCE). `../CLAUDE.md` an der Stelle korrigiert, die fälschlich EINEN
gemeinsamen Wert (55.000) für beide nannte.

**Rechenmodell, `js/regeln.js`:** neue Tabellen `SPEZ_TYP` (7 Knotentypen:
`waffen_ruestung`, `veredeln`, `umhang`, `tasche`, `werkzeug_fused`, `speise`,
`trank`, je mit Unique-/Mutual-/Meisterschafts-FCE und `einFeld`-Flag) und
`KATEGORIE_ZU_SPEZTYP` (rund 35 `craftingcategory`-Werte darauf abgebildet;
`offhand`/`knuckles`/`meat_*` bewusst NICHT abgebildet, s. `../CLAUDE.md`
„Craft-Kategorie zu Gebäude": keine eindeutige Wiki-Zuordnung, bleiben beim
Freitext-Fallback). Neue Funktionen `spezTypVonKategorie()`,
`gruppenSchluesselVonItem()` (Tier-Präfix strippen),
`spezialisierungsGruppen(cc)` (Ableitung aus `REZEPTGRAPH`) und
`fceAusSpezialisierungsknoten(cc, gruppenSchluessel, knotenStufen,
meisterschaftsstufe)` (eigener Unique-Anteil + Mutual-Anteil aller anderen
Knoten + ggf. Meisterschaft). Gegenprobe am echten Graphen: `cloth_helmet` hat
9 abgeleitete Knoten (u. a. `HEAD_CLOTH_SET1` = Gelehrtengugel über alle
Tiers); mit Spezialisierung 50 auf `HEAD_CLOTH_SET1` und Meisterschaft 10
ergibt sich für `HEAD_CLOTH_SET1` selbst 12.800 FCE (50×250 + 10×30), für
jeden ANDEREN Knoten derselben Kategorie (z. B. `HEAD_CLOTH_AVALON`, der
selbst nichts hat) trotzdem 1.800 FCE (0×250 + 50×30 Mutual + 10×30
Meisterschaft) - genau der vorher fehlende Mutual-Übertrag.

**Rechenkern, `js/rechenkern.js`:** `fceFuer(cc, opts)` zu `fceFuer(item, cc,
opts)` erweitert, drei Ebenen, jede schlägt die nächst allgemeinere: 1.
knotenspezifisch (`opts.fceUeberschreibungen["cc|Gruppe"]`, aus dem neuen
Panel), 2. kategorieweiter Freitext (`opts.fceUeberschreibungen[cc]`, die
bisherige P5-Ausnahme, jetzt zugleich Fallback), 3. globaler Wert
(`opts.fce`). Beide Aufrufstellen (`craftKandidat`, `craftBeiQualitaetKandidat`)
angepasst. Rückwärtskompatibel: ohne knotenspezifische Einträge exakt das
bisherige Verhalten.

**Oberfläche, `js/ui.js` + `Kostenrechner.html`:** die alte
„Meisterschaftsstufe + Spezialisierungsstufe → FCE"-Zeile (`skMeister`,
`skSpez`, `skUebernehmen`) ist entfernt. Neuer Block „Spezialisierungsknoten
je Kategorie" (`renderSpezialisierungsknoten()`, Container
`#spezKnotenContainer`): pro Kategorie mit abgebildetem Knotentyp ein
aufklappbarer Bereich mit (bei getrenntem Meisterschaftsknoten) einem
Meisterschaftsstufe-Feld plus einer Tabelle aller abgeleiteten Knoten
(Anzeigename aus `REZEPTGRAPH.namen`, Stufe-Eingabefeld, live berechnete
FCE-Spalte). Persistiert in `einstellungen.spezialisierung` (`cc` → `{
meisterschaft, knoten: { gruppenSchluessel: stufe } }`), zusammengeführt mit
`einstellungen.fceAusnahmen` in `fceUeberschreibungenFuerOpts()`: eine
Kategorie liefert nur dann Knoten-Overrides, wenn dort tatsächlich etwas
eingetragen ist (Summe > 0), sonst greift weiterhin der Freitext/globale Wert
- verhindert, dass ein bloßes Aufklappen des Panels (alle Stufen 0)
versehentlich eine bestehende Kategorie-Ausnahme auf 0 FCE überschreibt. Die
„Abgelesener Fokus/Grundfokus"-Quick-Konvertierung (unabhängiger Mechanismus,
nicht vom Strukturfehler betroffen) bleibt unverändert erhalten.

**Getestet:** Testsuite von 191 auf 212 Tests gewachsen (regeln.js: 9
`spezTypVonKategorie`-Tests, `gruppenSchluesselVonItem`-Tests,
`fceAusSpezialisierungsknoten`-Arithmetik für alle drei Knotentyp-Varianten
inkl. „Meisterschaft wird bei fused-Typ ignoriert", zwei Gegenproben gegen den
echten Rezeptgraphen für `spezialisierungsGruppen`; rechenkern.js: ein neuer
Testblock für die dreistufige `fceFuer`-Vorrangreihenfolge, direkt gegen
`RECHENKERN.kosten()` mit erzwungenem Fokuseinsatz geprüft; ui.js: die beiden
`fceAusSchicksalsbrett`-Tests durch `spezKnotenAnzeigeGruppen`-Tests ersetzt),
alle 212 grün, per Node cachefrei gegen die Dateien auf der Platte geprüft
(exakt derselbe Ablauf/dieselbe Testlogik wie `tests/test.html` selbst, per
Skript aus der Datei extrahiert und mit DOM-Stubs ausgeführt). Zusätzlich ein
eigenes Rechenskript gegen den ECHTEN Rezeptgraphen (`T4_HEAD_CLOTH_SET1`,
Kategorie `cloth_helmet`) durchlaufen lassen, s. Gegenprobe oben - keine
Abstürze, FCE-Werte von Hand nachgerechnet und bestätigt.

**Bewusste Abweichung vom Standardablauf, transparent gemacht:** wie schon in
der v1.4.0-Sitzung standen weder die `SendMessage`-Funktion für
Phasen-Meldungen/Subagenten-Anfragen noch ein interaktives Browser-Werkzeug
zur Verfügung (versucht: `msedge --headless=new --dump-dom`, lieferte in
dieser Umgebung keine Ausgabe, vermutlich Sandbox-Einschränkung). Die drei
Spezialisten (`rechenkern-pruefer`, `spieldaten-pruefer`,
`oberflaechen-pruefer`) konnten deshalb NICHT angefordert werden. Stattdessen:
node-basierte, cachefreie Testsuite (s. oben), eigene Rechengegenprobe gegen
den echten Graphen, und eine statische HTML/JS-Konsistenzprüfung (alle 47
`getElementById`-Aufrufe in `js/ui.js` gegen vorhandene IDs in
`Kostenrechner.html` abgeglichen, Tag-Balance für `div`/`details`/`table`/
`thead`/`tbody`/`tr`/`label` geprüft). Die neue Oberfläche wurde NICHT
tatsächlich im Browser angesehen. Vor der nächsten inhaltlichen Änderung an
der Oberfläche sollte das nachgeholt werden, sobald ein Browser-Werkzeug
verfügbar ist.

Versions-Schnappschuss unter `Versionen/v1.5.0 - FCE-Ableitung ueber
Schicksalsbrett-Knotenliste je Kategorie/` angelegt. Git-Commit und Push wie
im Projekt üblich (s. `../CLAUDE.md`, "Versionskontrolle").

## Dateistruktur

Stand nach P7 (v1.0.0) plus Feature "Craft-Stadt waehlbar" (v1.1.0) plus
Feature "Fokuseinsatz steuerbar machen" (v1.2.0) plus Feature "Bauplan-Ansicht
ergonomisch ueberarbeitet" (v1.3.0) plus Standardwert Stationssaetze (v1.3.1)
plus Feature "Qualitaetsstufen" (v1.4.0) plus "FCE-Ableitung ueber
Schicksalsbrett-Knotenliste je Kategorie" (v1.5.0, `js/regeln.js`,
`js/rechenkern.js`, `js/ui.js` und `Kostenrechner.html` geaendert,
`tests/test.html` erweitert, `js/preise.js` unveraendert, keine neuen Dateien):

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
                              fceAusSpezialisierungsknoten() v1.5.0): itemWert, RRR, Stationsgebuehr
                              (mit 0-Floor), Fokus (mit 0-Floor), Steuer, Kategorie-Tabellen,
                              rezepteFuerStufe, qualitaetWurfErfolgswahrscheinlichkeit()/
                              rerollKostenZuQualitaet(), Spezialisierungsknoten-Ableitung (v1.5.0)
    rechenkern.js             fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0, P6 v0.5.0,
                              Fokusregel-Ebenen v1.2.0; kostenBeiQualitaet() v1.4.0;
                              fceFuer() um Knoten-Ebene erweitert v1.5.0):
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
  tests/test.html           212 Tests, Offline-Selbsttests + 2 Live-Abschnitte
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
