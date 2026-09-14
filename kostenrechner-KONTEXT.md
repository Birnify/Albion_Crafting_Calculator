# Kontext: Albion Kostenrechner

Stand: 2026-09-14 · Version: v3.1.4 · Vier Audit-Befunde (5/6/12/10): shapeshifterstaff ergänzt, gatherergear-FCE korrigiert, RRR-Konstanten dokumentiert, Craften+Reroll-Strategie kombiniert

> Diese Datei ist die **einzige Quelle für eine frische Session**: aktueller Stand,
> Fachlogik der App, Dateistruktur, Arbeitsweise, offenes Backlog. Zu Beginn jeder
> Arbeit an diesem Projekt vollständig lesen.
>
> Der **Auftrag** steht in `kostenrechner-PLAN.md` und ändert sich kaum. Die
> **Spielregeln und belegten Formeln** stehen in `../CLAUDE.md`. Diese Datei hier
> beschreibt, wie weit die Anwendung ist.

## Was ist das?

**Seit v3.0.0 eine App mit drei Bereichen** ("Albion Werkzeuge", sichtbarer
Titel in der Oberfläche, Ordner-/Repo-Name bleibt bewusst `Kostenrechner`, s.
Nutzer-Entscheidung unten): oben eine Reiterumschaltung
(Kostenrechner/Eintopf-Rechner/Preisvergleich, `js/tabs.js`). Jeder Bereich
bleibt fachlich eigenständig (eigener Rechenkern/eigener Zustand), das ist
Architektur-Zusammenführung, keine inhaltliche Vermischung.

**Bereich 1, Kostenrechner** (der ursprüngliche, unveränderte Auftrag dieser
Datei): für ein beliebiges craftbares Albion-Item auf einer beliebigen
Verzauberungsstufe **und Qualitätsstufe** den **günstigsten Beschaffungsweg**
ermitteln: kaufen, craften, aus einer niedrigeren Stufe hochverzaubern, per Reroll
an der Reparaturstation hochqualifizieren, oder eine Mischung daraus über den
ganzen Rezeptbaum. Stadt frei wählbar (seit v1.1.0), Qualität frei wählbar
(seit v1.4.0). Ziel und Rechenmodell: `kostenrechner-PLAN.md`, Abschnitte 1 und 4.

**Bereich 2, Eintopf-Rechner** (seit v3.1.0 migriert): Profitrechner für den
Rindfleischeintopf (T8, Stufen .0-.3), komplett auf Live-Fetch im Browser
umgestellt (Preise, Handelsvolumen, Stundenprofil - kein Python-Vorablauf
mehr, anders als ursprünglich für dieses Paket erwartet, s.
`kostenrechner-KONTEXT-HISTORIE.md` Abschnitt "Aktueller Stand (v3.1.0 ...)").
Der eigenständige Eintopf-Rechner im Albion-Wurzelverzeichnis ist seit Paket E
(v3.1.2, 13.09.2026) archiviert (`../Archiv/Eintopf-Rechner (eigenstaendig,
vor App-Fusion)/`, s. `../KONTEXT.md`), nicht gelöscht, aber kein aktives
Arbeitsziel mehr. Die App-Fusion (Pakete A-E) ist damit vollständig
abgeschlossen.

**Bereich 3, Preisvergleich** (seit v3.0.0 migriert): beliebige Items aus dem
kompletten ao-bin-dumps-Namensdump suchen, mehrere auswählen, Live-Preise über
alle 7 Hauptstädte und alle 5 Qualitätsstufen abrufen. Kein Bezug zum
Rezeptbaum, reine Marktabfrage. Migriert 1:1 (Rechenlogik unverändert) aus dem
ehemals eigenständigen Eintopf-Rechner (dort seit 13.09.2026 im Einsatz), s.
Abschnitt "Aktueller Stand" unten für Details.

## Aktueller Stand (v3.1.4, vier Audit-Befunde in einer Nacht-Sitzung, 14.09.2026)

**Vorheriger Stand (v3.1.3, Bugfix Spezialisierungsknoten-FCE-Formel)**
unverkürzt nach `kostenrechner-KONTEXT-HISTORIE.md` ausgelagert
(Schlankheitsregel, s. "Entwicklungsweise / Mitarbeit" unten).

**Auftrag:** vier weitere, durch das offizielle Wiki belegte Befunde aus
`AUDIT-2026-09-13.md` beheben, vom Nutzer in dieser Reihenfolge angefordert:
Befund 5, 6, 12, 10 ("und alle Befunde die du sonst noch ohne mich machen
kannst"). Komplett autonom umgesetzt (Nutzer schlief), ohne
`albion-cycle-orchestrator` (weiterhin nicht über das Agent-Tool aufrufbar).

**Umgesetzt** (`js/regeln.js`, `js/rechenkern.js`, `js/ui.js`,
`js/eintopf-rechenkern.js`, `tests/test.html`):

1. **Befund 5, `shapeshifterstaff` fehlte in allen drei Kategorie-Tabellen.**
   `KATEGORIE_ZU_SPEZTYP.shapeshifterstaff = "waffen_ruestung"` (Wiki nennt
   keine abweichende Struktur). `STADTBONUS.Caerleon.craft` um
   `shapeshifterstaff` ergänzt (Wiki "Resource_return_rate", Zeile
   Caerleon/Weapons: "War Gloves, Shapeshifter Staff", klar belegt). Für das
   Gebäude **kein Beleg gefunden** (Crafting-Seite, Hunter's-Lodge-Seite und
   Shapeshifter-Seite gezielt durchsucht, auch im rohen HTML, kein einziges
   Vorkommen) - deshalb wie `offhand`/`knuckles`/`meat_*` eine eigene
   Gebührengruppe ("Wandlerstab") statt einer erfundenen Zuordnung zur
   Jägerhütte.
2. **Befund 6, `gatherergear` fälschlich als `werkzeug_fused` eingeordnet.**
   Wiki "Specializations" trennt beide ausdrücklich: `werkzeug_fused` hat 250
   Unique + 60 Mutual in einem verschmolzenen Knoten ohne eigene
   Meisterschaft, Sammlerausrüstung dagegen 250 Unique + **nur 30** Mutual je
   eigenem Knoten plus eine separate, hier als Meisterschaftsfeld modellierte
   Komponente von 60 FCE je Stufe (im Spiel eigentlich der geteilte fused
   Werkzeug-Meisterschaftsknoten, s. Codekommentar für die bewusste
   Vereinfachung). Neuer `SPEZ_TYP.gatherergear`, Gegenprobe exakt gegen den
   wörtlichen Wiki-Wert (ein Knoten + Meisterschaft auf Stufe 100 = 34.000
   FCE).
3. **Befund 12, zwei leicht verschiedene RRR-Konstanten (kosmetisch).**
   `js/eintopf-rechenkern.js`s `RET_OHNE=0,152` ist eine EIGENE, unabhängig im
   Spiel abgelesene Messung, `js/regeln.js`s `RRR_GRUNDPRODUKTION=0,18`
   liefert über die Formel 0,152542... - beide sind demselben Spielwert aus
   zwei verschiedenen Quellen zugeordnet (Screenshot vs. Formel), keine
   davon wurde geändert (Regel "Belegte Werte nie ohne neuen Beleg ändern").
   Nur Kommentare in beiden Dateien ergänzt, die den Zusammenhang erklären.
4. **Befund 10, Craft-Wurf und Reroll wurden nie kombiniert.** Neue Funktion
   `REGELN.qualitaetsVerteilung(chancenpunkte)`: volle
   Wahrscheinlichkeitsverteilung über die gelandete Qualität eines
   Craft-Versuchs (nicht nur Erfolg/Misserfolg gegen ein Ziel wie die
   bestehende `qualitaetWurfErfolgswahrscheinlichkeit()`, die unverändert
   bleibt). `craftBeiQualitaetKandidat()` in `rechenkern.js` rechnet jetzt bei
   jedem Qualitäts-Wurf-Weg (kein `preservequality`) zwei Strategien
   gegeneinander - "immer neu craften bis ein Versuch direkt trifft"
   (bisheriges Verhalten, unverändert als Fallback) und "einmal craften, die
   gelandete Qualität danach hochrerollen" (neu, Materialien/Fokus nur
   einmal, Reroll kostet laut Spielregel keinen Fokus) - und wählt die
   günstigere über den Zielwert. Neues Feld `weg.qualitaetsart` kann jetzt
   auch `"wurf+reroll"` sein, `weg.erwarteterRerollSilber` neu. `js/ui.js` an
   beiden Stellen (Bauplan-Detailzeile, Tooltip) um diesen Fall ergänzt, sonst
   keine Logikänderung.

**Getestet:** `js/regeln.js` selbsttest() um 33 neue Tests erweitert:
`qualitaetsVerteilung` gegen die bereits getestete
`qualitaetWurfErfolgswahrscheinlichkeit` gegengeprüft (Tail-Summe muss exakt
übereinstimmen, fünf Bonuswerte), plus `shapeshifterstaff`/`gatherergear`-
Tabellen- und Formel-Tests (u. a. Wiki-Gegenprobe 34.000 FCE für einen vollen
Gathergear-Knoten). `tests/test.html` um zwei Integrationstests für die
Craften+Reroll-Kombination ergänzt (reales Item `T4_MAIN_SWORD`, ein
Szenario, in dem die neue Strategie klar gewinnen muss (teure Materialien,
Zielqualität Meisterwerk, 0 Bonus, ~24 Mio. Silber nach alter Rechnung
vs. tatsächlich 2,12 Mio.), ein Szenario, in dem die alte Strategie weiterhin
gewinnen muss (billige Materialien, Zielqualität Gut), beide mit exakten
Regressionswerten). **377/377 grün** (344 + 33 neue), über den lokalen Server
im Browser ausgeführt, keine Konsolenfehler.

**Gehärtet:** `Kostenrechner.html` über den lokalen Server geladen, keine
Konsolenfehler. Wegen der Uhrzeit (Nutzer schlief) keine vertiefte manuelle
Klick-Gegenprobe der neuen Craften+Reroll-Anzeige im Bauplan wie bei
Befund 5/6 am Vortag - die Node-Gegenrechnung und die beiden neuen
Integrationstests decken die Kernlogik ab, eine visuelle Prüfung der neuen
Detailzeile steht für die nächste Sitzung noch aus.

Damit sind aus `AUDIT-2026-09-13.md` die Befunde 2, 3, 5, 6, 10 und 12
behoben. Offen: Befund 1 (schwer, braucht eine Schicksalsbrett-Ablesung im
Spiel), Befund 4 (Knotenableitung trifft die echte Knotenzahl nicht),
Befund 7 (Qualität für nicht qualifizierbare Items), Befund 8 (T1/T2 im Spiel
gebührenfrei), Befund 9 (Global Discount/Gold Market Stabilization, braucht
einen neuen Eingabewert vom Nutzer), Befund 11 (offhand/knuckles ohne
Spezialisierungsformel, fuer offhand widerspruechliche/unklare Wiki-Werte je
Nebenhand-Typ). Bewusst nicht angefasst: das Risiko, mit widersprüchlicher
oder unvollständiger Quellenlage etwas Falsches zu bauen, während der Nutzer
nicht gegenlesen konnte, wog schwerer als der Wunsch nach Vollständigkeit.

**Zusätzlich vom Nutzer angestoßen, noch nicht begonnen:** den
Eintopf-Rechner-Reiter zu einem generischen "Foodrechner" verallgemeinern
(beliebiges Gericht statt nur Rindfleischeintopf auswählen, danach dieselbe
Logik wie heute). Das ist ein echter Feature-Umbau, keine Bugfix-Korrektur -
braucht laut eigenem Arbeitsablauf ("Orchestrator statt direkter Umsetzung")
erst eine interaktive Brainstorming-Phase (welche Gerichte, welche
Selektions-UI, ob alle Speisen wirklich derselben Fischsauce-Struktur folgen)
und wurde deshalb in dieser unbeaufsichtigten Nachtsitzung bewusst nicht
begonnen. Nächster Schritt: `/define-feature`, dann eine frische
Orchestrator-Instanz (sobald das Agent-Tool sie wieder findet) oder eine
interaktive Sitzung mit dem Nutzer.

---

**Vorheriger Stand (v2.1.0-v2.1.4 und alles davor)** unverkürzt nach
`kostenrechner-KONTEXT-HISTORIE.md` ausgelagert (Schlankheitsregel, s.
"Entwicklungsweise / Mitarbeit" unten).

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
Dateien) plus Feature "Bauplan grafisch als Baumdiagramm mit Item-Icons"
(v1.8.0, `js/ui.js`/`Kostenrechner.html`/`tests/test.html`, kein
Rechenkern-/Regeln-/Preise-Code geaendert, keine neuen Dateien) plus
"Icon-Kachel im grafischen Bauplan ueberarbeitet" (v1.9.0, `js/ui.js`/
`Kostenrechner.html`) plus "Komplettes visuelles Redesign, Albion-Theme"
(v2.0.0, ausschliesslich `Kostenrechner.html` CSS+Markup, `js/*.js` und
`tests/test.html` unveraendert, neue Dateien `design.md`/`assets/`) plus
"Eigenpreis-Kandidatenliste auf echte Crafting-Zutaten eingeschraenkt"
(v2.0.1, nur `build_graph.py`/`rezepte.js` (neu erzeugt)/`tests/test.html`
(eine Testbezeichnung angepasst), kein Rechenkern-/Regeln-/UI-Code geaendert)
plus "App-Fusion Paket A+B: Reiterumschaltung + Preisvergleich migriert"
(v3.0.0, neue Dateien `item-namen.js` (von `build_graph.py` zusaetzlich
erzeugt)/`js/tabs.js`/`js/preisvergleich.js`, `Kostenrechner.html`/
`tests/test.html` erweitert, kein Rechenkern-/Regeln-Code geaendert) plus
"App-Fusion Paket C: Eintopf-Rechenkern live migriert" (v3.1.0, neue Dateien
`js/eintopf-daten.js`/`js/eintopf-preise.js`/`js/eintopf-rechenkern.js`/
`js/eintopf-ui.js`, `Kostenrechner.html` erweitert (Eintopf-Platzhalter durch
echtes Markup ersetzt, neue CSS-Klassen), kein bestehendes
Kostenrechner-/Preisvergleich-Modul und `tests/test.html` nicht geaendert -
Tests fuer den Eintopf-Rechenkern sind Paket D) plus "App-Fusion Paket D:
Eintopf-Rechenkern automatisierte Tests ergaenzt" (v3.1.1, ausschliesslich
`tests/test.html` erweitert (39 neue Tests + 3 neue Script-Einbindungen),
keine der drei Eintopf-Dateien geaendert, Option A) plus "App-Fusion Paket E:
alte eigenstaendige Eintopf-Rechner-Dateien archiviert" (v3.1.2, reines
Aufraeum-/Dokumentationspaket, KEINE Kostenrechner-Code-Datei geaendert, nur
diese Kontextdatei; die drei archivierten Dateien und die Doku ausserhalb
dieses Repos s. "Aktueller Stand"; App-Fusion Pakete A-E damit abgeschlossen)
plus Bugfix "Spezialisierungsknoten-FCE-Formel" (v3.1.3, `js/regeln.js`
(SPEZ_TYP.veredeln, fceAusSpezialisierungsknoten()) + `tests/test.html`
(drei Tests angepasst, zwei neu) geaendert, `js/ui.js` nur Kommentare/
Tooltip-Text, s. "Aktueller Stand" und `AUDIT-2026-09-13.md` Befund 2/3) plus
vier weitere Audit-Befunde (v3.1.4, `js/regeln.js` (shapeshifterstaff/
gatherergear-Tabellen, qualitaetsVerteilung()) + `js/rechenkern.js`
(craftBeiQualitaetKandidat() Craften+Reroll-Kombination) + `js/ui.js`
(neuer qualitaetsart-Fall) + `js/eintopf-rechenkern.js` (nur Kommentar) +
`tests/test.html` (33 neue Tests) geaendert, s. "Aktueller Stand" und
`AUDIT-2026-09-13.md` Befund 5/6/10/12):

```
Kostenrechner/
  build_graph.py            fertig (P1, P2: el-Feld ergaenzt); Root-Filter
                              is_excluded_root() gegen kosmetische/interne
                              Nicht-Crafting-Items (vanity-Shopkategorie,
                              GAMEMASTER-Items) v2.0.1; erzeugt zusaetzlich
                              item-namen.js fuer den Preisvergleich-Reiter v3.0.0
  rezepte.js                erzeugt (P1, P2, v2.0.1 neu erzeugt), nicht von Hand bearbeiten
  item-namen.js             neu v3.0.0, erzeugt von build_graph.py: ALLE 12.237
                              Items aus dem Namensdump (nicht nur der Rezeptgraph),
                              q-Merker fuer Items mit Qualitaetsstufen-Preisen
  Kostenrechner.html         fertig (P6, v0.5.0; Stadt-Dropdown v1.1.0; Fokus-Regel-
                              Tabelle + Fokus-Schalter im Bauplan v1.2.0; Qualitaet-Dropdown
                              + Qualitaets-Chancenpunkte-Block v1.4.0; Schicksalsbrett-
                              Meisterschaft/Spezialisierung-Zeile ersetzt durch
                              #spezKnotenContainer-Panel v1.5.0; #volumenBtn +
                              .kn-volumen v1.7.0; .bg-*-CSS (grafischer Bauplan-Baum,
                              Verbindungslinien als Pseudoelemente) + #bauplanAnsichtSchalter
                              v1.8.0; Icon-Kachel-Farbwerte/-Badges v1.9.0; komplettes
                              CSS + Banner-/`.gp-panel`-Markup auf das dunkle Albion-Theme
                              aus design.md umgestellt, IDs/JS-Klassennamen unveraendert
                              v2.0.0; Reiterumschaltung (.tabs/.tabbtn), Eintopf-Platzhalter-
                              Reiter, Preisvergleich-Reiter-Markup (.pv-*), App-Titel
                              "Albion Werkzeuge" v3.0.0; Eintopf-Platzhalter durch echtes
                              Markup ersetzt (Einstellungen/Haupttabelle/Fischsauce/
                              Tagesertrag/Faustregel/Absatzzeiten/Fisch-Rangliste/Rohpreise,
                              IDs mit et-Praefix), neue CSS-Klassen .tag/.staedte/.stunden/
                              .legend v3.1.0): Suche, Hero,
                              Bauplan-Baum, Alle-Wege, Eigenpreis-Pflege (P6), Einstellungen
  js/
    tabs.js                  neu v3.0.0, keine Rechenlogik: Reiterumschaltung
                              zwischen den drei Bereichen, aria-selected mitgezogen
    preisvergleich.js        neu v3.0.0, migriert 1:1 aus dem ehemals eigenstaendigen
                              Eintopf-Rechner (Reiter "Preisvergleich"): Suche ueber
                              ITEM_NAMEN.alle, Live-Preise ueber alle Staedte/Qualitaeten,
                              eigener Realm/Retry/localStorage-Schluessel (bewusst kein
                              gemeinsamer Code mit preise.js), PREISVERGLEICH.selbsttest()
    eintopf-daten.js          neu v3.1.0, migriert aus eintopf_update.py (STEWS/SAUCE/FISH/
                              ITEM_VALUE, Rindfleischeintopf T8_MEAL_STEW), reine
                              Sprachumstellung Python->JS, keine Werteaenderung
    eintopf-preise.js         neu v3.1.0, Live-Fetch-Schicht (/prices + /history
                              time-scale=24/1), eigener localStorage-Schluessel
                              albion_kostenrechner_eintopf_preise_v1 (Schema 1), bewusst
                              kein gemeinsamer Code mit preise.js/preisvergleich.js
    eintopf-rechenkern.js     neu v3.1.0, alle Rechenfunktionen unveraendert aus dem alten
                              Eintopf_Rechner.html-TEMPLATE uebernommen (bezugsarten/
                              billigste/bestChopQuelle/sauceWege/verkaufswege/strategien/
                              gerade/entscheidungsleiter/schmerzgrenze/guete), nur
                              Datenquelle auf EINTOPF_PREISE/EINTOPF_DATEN umgestellt;
                              RET_OHNE/RET_MIT/ORDERGEB/FEFF unveraendert aus ../CLAUDE.md;
                              Kommentar bei RET_OHNE ergaenzt (Verhaeltnis zu
                              REGELN.RRR_GRUNDPRODUKTION erklaert, keine Werteaenderung)
                              v3.1.4, s. AUDIT-2026-09-13.md Befund 12
    eintopf-ui.js             neu v3.1.0, Rendering/DOM-Verdrahtung 1:1 aus dem alten
                              TEMPLATE, IDs mit et-Praefix, alle querySelectorAll auf
                              #tab-eintopf eingeschraenkt; automatischer Erstabruf beim
                              ersten Reiter-Oeffnen je Sitzung (Cache leer oder >30 Min. alt)
    preise.js                fertig (P2, P3; stadtabhaengiger Cache v1.1.0; qualitaetsabhaengiger
                              Cache-Schluessel + sammleQualitaetsMarktIds() v1.4.0, Schema auf 3);
                              volumenAbrufen()/normalisiereHistorieZeile() gegen history/,
                              bewusst OHNE localStorage-Cache v1.7.0):
                              eigenpreisSetzen lehnt Preis<=0 ab, PREIS_CACHE_SCHEMA_VERSION/
                              EIGENPREIS_SCHEMA_VERSION getrennt seit v1.1.0. Unveraendert v1.4.0-v1.6.0.
    regeln.js                fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0; Qualitaetswurf/Reroll-Kette
                              v1.4.0; SPEZ_TYP/KATEGORIE_ZU_SPEZTYP/spezialisierungsGruppen()/
                              fceAusSpezialisierungsknoten() v1.5.0; gruppenSchluesselVonItem(item,cc)
                              Bugfix v1.5.1; Bugfix fceAusSpezialisierungsknoten() (eigener Mutual-
                              Anteil ergaenzt) + SPEZ_TYP.veredeln (kein getrennter Meisterschafts-
                              knoten mehr) v3.1.3; shapeshifterstaff in allen drei Tabellen
                              ergaenzt, SPEZ_TYP.gatherergear eigener Typ (vorher faelschlich
                              werkzeug_fused), neue Funktion qualitaetsVerteilung() (volle
                              Wurf-Qualitaetsverteilung, Basis fuer die Craften+Reroll-
                              Kombination in rechenkern.js) v3.1.4, s. "Aktueller Stand" und
                              AUDIT-2026-09-13.md Befund 5/6/10): itemWert, RRR, Stationsgebuehr
                              (mit 0-Floor), Fokus (mit 0-Floor), Steuer, Kategorie-Tabellen,
                              rezepteFuerStufe, qualitaetWurfErfolgswahrscheinlichkeit()/
                              qualitaetsVerteilung()/rerollKostenZuQualitaet(),
                              Spezialisierungsknoten-Ableitung (v1.5.0/v1.5.1/v3.1.3/v3.1.4).
                              Unveraendert seit v3.1.4.
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
                              craftBeiQualitaetKandidat() rechnet im Wurf-Fall (kein
                              preservequality) jetzt zwei Strategien gegeneinander (Neu-
                              Craften vs. Craften+Reroll ueber REGELN.qualitaetsVerteilung()/
                              rerollKostenZuQualitaet()) und waehlt die guenstigere, neue Felder
                              weg.qualitaetsart="wurf+reroll"/weg.erwarteterRerollSilber v3.1.4,
                              s. AUDIT-2026-09-13.md Befund 10. Unveraendert seit v3.1.4.
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
                              v1.7.0; itemIconUrl()/bgBadgeInfo()/bgTooltipFuer()/bgCard()/
                              baueKnotenGrafisch()/renderBauplanGrafisch() (alle Modul-Ebene
                              bzw. im boot()-Scope wie baueKnoten()), einstellungen.bauplanAnsicht
                              (Text/Grafisch, localStorage-persistiert) v1.8.0; FCE-Spalten-
                              Tooltip + Kommentar praezisiert, keine Logikaenderung
                              (Meisterschaftsfeld-Sichtbarkeit haengt schon vorher an
                              typ.einFeld) v3.1.3; neuer Fall weg.qualitaetsart==="wurf+reroll"
                              an beiden Detailzeilen-Stellen (Bauplan-Karte, Tooltip) ergaenzt
                              v3.1.4, s. AUDIT-2026-09-13.md Befund 10):
                              Suche mit Tastaturbedienung, Rendering, Einstellungen, Eigenpreis-
                              Pflegeansicht (P6), baueKnoten()/eigenerKandidat() (v1.3.0)
  kostenrechner-PLAN.md
  kostenrechner-KONTEXT.md
  kostenrechner-KONTEXT-HISTORIE.md
  design.md                 neu v2.0.0, verbindliche Design-Spezifikation (Farben/Typografie/
                              Bausteine), einzige Quelle fuer Design-Entscheidungen
  assets/lymhurst-bg.jpg    neu v2.0.0, Banner Hauptseite
  assets/radiantwilds-bg.jpg neu v2.0.0, in der App bisher unbenutzt (kein Cover, s. design.md)
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
  Versionen/v1.8.0 - Bauplan grafisch als Baumdiagramm mit Item-Icons/
  Versionen/v1.9.0 - Icon-Kachel im grafischen Bauplan ueberarbeitet/
  Versionen/v2.0.0 - Visuelles Redesign Albion-Theme/
  Versionen/v2.0.1 - Eigenpreis-Kandidatenliste auf echte Crafting-Zutaten eingeschraenkt/
  Versionen/v2.1.0 - v2.1.4 - siehe kostenrechner-KONTEXT-HISTORIE.md/
  Versionen/v3.0.0 - App-Fusion Paket A+B, Reiterumschaltung und Preisvergleich migriert/
  Versionen/v3.1.0 - App-Fusion Paket C, Eintopf-Rechenkern live migriert/
  Versionen/v3.1.1 - App-Fusion Paket D, Eintopf-Rechenkern automatisierte Tests ergaenzt/
  Versionen/v3.1.2 - App-Fusion Paket E, alte eigenstaendige Eintopf-Rechner-Dateien archiviert/
  Versionen/v3.1.3 - Bugfix Spezialisierungsknoten-FCE-Formel/
  Versionen/v3.1.4 - Vier Audit-Befunde (shapeshifterstaff, gatherergear, RRR-Kommentare, Craften+Reroll)/
  tests/test.html           377 Tests (338 bisherige + 33 neu fuer shapeshifterstaff/
                              gatherergear/qualitaetsVerteilung()/Craften+Reroll-Kombination,
                              v3.1.4; 335 davon + 3 neu/angepasst fuer
                              fceAusSpezialisierungsknoten(), v3.1.3, Bugfix
                              Spezialisierungsknoten-FCE-Formel; 296 davon + 39 fuer
                              eintopf-rechenkern.js/eintopf-daten.js, v3.1.1, App-Fusion
                              Paket D). Offline-
                              Selbsttests + 2 Live-Abschnitte; Testrahmen/-logik sonst
                              unveraendert seit v1.7.0. Die 39 neuen Tests binden
                              js/eintopf-daten.js/eintopf-preise.js/eintopf-rechenkern.js
                              zusaetzlich per <script> ein und ersetzen EINTOPF_PREISE.
                              sell/buy/volOf/avgOf temporaer per Monkey-Patching durch
                              synthetische Fixtures (mitFixture()-Helfer), keine der drei
                              Eintopf-Dateien wurde dafuer geaendert (Nutzer-Entscheidung)
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

**App-Fusion (Pakete A-E) ist mit v3.1.2 vollständig abgeschlossen**, s.
"Aktueller Stand" oben. Kein offenes Paket aus diesem Vorhaben mehr. Die
Backlog-Punkte unten sind eigenständige, davon unabhängige Ideen.

**`oberflaechen-pruefer` und `spieldaten-pruefer` waren über mehrere
Sitzungen hinweg nicht verfügbar** (Harness-Fehler "Agent type ... not found").
Im v3.1.0-Zyklus deshalb auf Anweisung gar nicht erst angefordert, stattdessen
durchgehend selbst geprüft (Screenshot der gerenderten Seite, eigene
Python-Gegenprobe). `rechenkern-pruefer` war im selben Zyklus dagegen
problemlos erreichbar. Wirkt wie ein selektives Harness-Problem bei genau
diesen beiden Agenten, nicht wie ein generelles Subagenten-Problem - falls das
weiterhin auftritt, lohnt sich eine Prüfung der Agenten-Registrierung dieser
beiden speziell.

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

1. **Offen aus dem v2.0.1-Zyklus: Tierhaltung/Zucht und Season-Kosmetik in der
   Eigenpreis-Pflegeliste, bewusst nicht entschieden.** Nach dem Root-Filter
   auf `@shopcategory=="vanity"` und `GAMEMASTER`-Items (365 → 118 Kandidaten,
   s. "Aktueller Stand") bleiben u. a. 16 Tierhaltungs-/Zucht-Jungtiere
   (`T5_FARM_*_BABY`/`T8_FARM_*_BABY`) und mehrere Season-/Kampagnen-
   Kosmetikfamilien (`UNIQUE_LOOTCHEST_FACTIONCAMPAIGN_*`, Avalon-Umhang-
   Freischaltungen) in der Liste. Nicht klar entscheidbar, ob das echte
   Eigenpreis-Faelle sind oder ebenfalls raus sollten; im Zweifel drin
   gelassen statt geraten. Falls gewuenscht: Nutzer-Entscheidung je Familie,
   dann `ROOT_EXCLUDE_SHOPCATEGORIES`/`is_excluded_root()` in
   `build_graph.py` gezielt erweitern.

2. **Noch offener Rest aus dem v1.7.0-Zyklus: Wortlaut-Alternative nicht
   umgesetzt.** Die ursprüngliche Backlog-Notiz nannte zwei Ideen: (a) den
   Wortlaut „gesperrt" auf etwas wie „kein bei AODP erfasster Preis" ändern,
   (b) `history/`-Handelsvolumen als Zusatzsignal nutzen. Die vier
   Rückfragen des v1.7.0-Zyklus deckten nur (b) ab; (a) wurde nicht gefragt
   und nicht umgesetzt. Falls weiterhin gewünscht: eigene Rückfrage, ob/wie
   der Wortlaut angepasst werden soll (z. B. nur bei `ursprungsTyp==="kaufen"`
   ohne jeden Preisdatensatz, oder generell).

3. **Fokuswert-Verdacht aus der v1.5.2-Diagnose, noch nicht durch den Nutzer
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

4. **Naechstes Orchestrator-Paket: 549 Graph-Wurzeln komplett ohne Namen
   (weder Deutsch noch Englisch).** Beim v2.1.2-PROTOTYPE-Fund (s.
   "Aktueller Stand" oben) mitentdeckt: deutlich groesser als die 14
   PROTOTYPE-Faelle, quer durch viele Item-Familien (Quest-Items wie
   `QUESTITEM_CARAVAN_TRADEPACK_*`, Dungeon-Erfahrungs-Token
   `QUESTITEM_EXP_TOKEN_*` usw.), meist ohne `craftingcategory`. Nicht
   pauschal ausschliessbar wie bei "vanity" - braucht dieselbe empirische
   Sorgfalt (Stichproben pruefen, Gegenprobe "wird als Zutat referenziert?"),
   bevor `is_excluded_root()` erweitert wird. Vom Nutzer als naechstes Paket
   angefordert (06.09.2026: "die 549 namenlosen Items einreihen").
5. **Knopf zum voruebergehenden Ausschalten des Fokuseinsatzes.** Nutzer-
   Wunsch (06.09.2026): eine Moeglichkeit, die Fokusnutzung fuer die
   Berechnung komplett und temporaer abzuschalten (nicht dauerhaft in den
   Einstellungen aendern). Noch nicht spezifiziert, ob das global (ein
   Schalter fuer die ganze Berechnung) oder je Knoten gemeint ist - die App
   hat bereits einen Fokus-Schalter je Knoten (`automatisch/immer/nie`, s.
   `fokus-schalter`-Klasse), ein GLOBALER Kurzschalter fehlt aber. Vor der
   Umsetzung klaeren, ob "automatisch" als Ausgangszustand gemeint ist oder
   der zuletzt gewaehlte Zustand je Knoten erhalten bleiben soll, wenn der
   Schalter wieder aus geht.
6. **Reine "Craften"-Pfade in Alle Wege liefern astronomische Werte (echter
   Rechenfehler, beim v2.1.3-Fix entdeckt, noch nicht untersucht).** Die
   "Craften #N, mit/ohne Fokus"-Zeilen (erzwingen Craften statt Kaufen auf
   jeder Ebene) zeigen fuer T4.3-Plattenruestung 4,6-10,9 Mio. Silber,
   274.710-600.958 Fokus - Faktor 30-70 ueber Verzaubern/Craften+Reroll fuer
   dasselbe Item. Gegenprobe an einem unbeteiligten Item (Soldatenruestung
   des Adepten, keine Artefakt-/Relikt-Beteiligung) zeigt EXAKT dieselben
   Fokus-Werte - deshalb sicher kein Folgefehler des v2.1.3-Fixes, sondern
   ein eigener, vermutlich schon laenger bestehender Bug. Naheliegender
   Verdacht (nicht verifiziert): die rekursive "immer craften"-Traversierung
   craftet Rune/Seele/Relikt bzw. die Ore->Barren-Kette faelschlich mit statt
   sie zu kaufen, oder ein `gesperrt`-Fallback tief im Baum liefert einen
   ueberzogenen Ersatzwert statt den Pfad sauber zu sperren. Braucht eigene
   Diagnose, am besten mit Zwischenwerten aus `craftKandidat()`/
   `zutatenWeg()` in `rechenkern.js`.

**Kleinere offene Punkte, unverändert seit früheren Paketen:**

- Ein Eigenpreis von 0 könnte legitim sein, wenn der Nutzer eine Zutat schon
  auf Lager hat ("kostet mich nichts mehr"). In P6 bewusst nicht gelöst,
  `eigenpreisSetzen(id, 0)` löscht weiterhin den Eintrag. Falls gewünscht:
  eigene, klar gekennzeichnete Funktion statt eines überladenen Preisfelds.
- 11 von 118 Kandidaten (Stand v2.0.1, vorher 21 von 365) in der
  Eigenpreis-Pflegeliste haben keinen deutschen Namen
  (`REZEPTGRAPH.namen[id]` fehlt, z. B. `QUESTITEM_TOKEN_ARENA_CRYSTAL`) und
  zeigen stattdessen ihre ID. Nicht nachgebessert, da `build_graph.py`/die
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
