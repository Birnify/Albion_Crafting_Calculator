# Kontext: Albion Kostenrechner

Stand: 2026-09-06 · Version: v2.0.0 · Komplettes visuelles Redesign (Albion-Theme)

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

## Aktueller Stand (Komplettes visuelles Redesign, Albion-Theme, 06.09.2026, v2.0.0)

**Auftrag:** die gesamte Oberfläche (Suche/Filter, Hero-Ergebnis, Bauplan
Text, Bauplan Grafisch, Alle-Wege-Tabelle, Einstellungen) auf ein dunkles
Fantasy-/Albion-Online-Theme umstellen statt des bisherigen hellen
Funktions-Looks. Verbindliche Spezifikation **`design.md`** (neu, aus einem
im Hauptgespräch abgenommenen Claude-Design-Mockup, 5 Artboards) mit
oklch-Farbtokens, Cinzel/Manrope-Typografie, `.gp-panel`-Rahmenkomponente,
Banner, Hero-Kachel, Badges, Tabellen-/Eingabefeld-Stil. Bild-Assets
`assets/lymhurst-bg.jpg` (Banner) und `assets/radiantwilds-bg.jpg`
(unbenutzt, laut design.md kein separates Cover in der echten App) neu im
Repo. Reines Optik-Redesign: keine neue Cover-Seite, keine Änderung an
Rezeptdaten/API/Rechenkern/Testlogik, kein neues Feature.

**Umgesetzt, ausschließlich `Kostenrechner.html` (CSS + Markup):** `js/*.js`
komplett unangetastet, weil alle benötigten Klassennamen (`kn-badge-*`,
`bg-*`, `pill`, `dreifach`, `klein-tbl`, ...) bereits stabil und generisch
genug waren, um sie rein über CSS neu einzufärben, ohne die
DOM-Erzeugung in `js/ui.js` anzufassen. Alle 49 von `js/ui.js` per
`getElementById` referenzierten IDs erhalten (per Skript gegengeprüft).

- **Tokens:** `:root` auf die oklch-Werte aus design.md umgestellt
  (`--bg`/`--bg-2`/`--panel`/`--panel-2`/`--line`/`--line-strong`/`--text`/
  `--dim`/`--gold`/`--gold-dim`/`--green`/`--purple`/`--teal`/`--red`,
  `--lvl0`..`--lvl4`). Das bisherige `@media prefers-color-scheme`-Umschalten
  entfernt, die App ist jetzt durchgehend dunkel. Die generischen Alt-Namen
  (`--accent`, `--good(-bg)`, `--bad(-bg)`, `--warn(-bg)`), die der Großteil
  des bestehenden Stylesheets bereits nutzte, wurden bewusst als **Aliase**
  auf die neuen Tokens umgehängt (`--accent: var(--gold)` usw.) statt jede
  einzelne Regel umzubenennen: identisches optisches Ergebnis, deutlich
  kleinere Änderungsfläche. Explizite Direktfarben (statt Alias) nur dort,
  wo design.md von der Alias-Zuordnung abweicht: `kn-badge-verzaubern` lila
  (`--purple`), `kn-badge-reroll` türkis (`--teal`), `kn-badge-kaufen`/
  `kn-badge-craften`/`kn-badge-gesperrt` folgen den Aliasen (gold/grün/rot).
- **Typografie:** Google-Fonts-`@import` (Cinzel 600-800, Manrope 500-800).
  Cinzel auf `h1`/`h2`/`.sek-t`/Panel-Titel (`details.gp-panel>summary`)/
  Banner-Marke/Hero-Kicker-Label, Manrope als Grundschrift.
- **`.gp-panel`:** neue Klasse (Verlauf `--panel-2`→`--panel`, 1px Rand,
  Schatten, goldene Eckklammern oben links/rechts via `::before`/`::after`),
  additiv auf die 5 Hauptcontainer gesetzt (Such-/Filter-Box, die 3
  `<details>`-Panels Bauplan/Alle-Wege/Eigenpreis-Pflege, Einstellungen-Box).
  Reine Zusatzklasse, keine ID/Struktur geändert.
- **Banner:** neu, `assets/lymhurst-bg.jpg` mit `saturate(.9) brightness(.85)`,
  abgedunkelter Verlauf, Marke "Kostenrechner" in Cinzel/Gold unten links.
  Der bisherige sichtbare `<h1>Kostenrechner</h1>` wurde `sr-only` (Barrierefreiheit:
  Seite behält eine echte Top-Level-Überschrift, ohne die Marke doppelt
  sichtbar zu zeigen), `.sub`-Tagline bleibt als Fließtext unter dem Banner.
- **Hero:** warmer oklch-Verlauf statt der alten Navy/Blau-Kombination, große
  weiße Zahlen, goldene Kicker-Label; je Kennzahl (Weg/Silber/Fokus/Gewinn)
  eine kleine goldgerahmte Buchstaben-Kachel (`W`/`S`/`F`/`G`) rein über
  `nth-child`-Pseudoelemente, ohne `js/ui.js` anzufassen (Reihenfolge der 4
  Spalten ist in `renderHero()` fest verdrahtet, also stabil adressierbar).
- **Buttons/Segmented Control/Badges/Tabellen/Eingabefelder:** gemäß
  design.md (goldener Primärbutton mit dunklem Text, `.mini`/`.dreifach` als
  sekundäre Aktionen, Tabellenkopf schlank/dim statt farbiger Balken,
  `tr.best` mit grünem linkem Akzentbalken via `box-shadow: inset`, `.pill`
  großgeschrieben mit Farbpille, Eingabefelder auf `--bg-2` mit goldenem
  Fokusring). Radio-Auswahl (Einkauf/Verkauf) optisch als Pille via
  `:has(input:checked)` hervorgehoben, nativ funktional unverändert (kein
  verstecktes Radio, reine additive Optik, degradiert bei fehlender
  `:has()`-Unterstützung folgenlos auf normale Radios).
- **Icon-Kachel (grafischer Bauplan, seit v1.9.0 funktional fertig):**
  ausschließlich die Farbwerte von Hex auf die oklch-Tokens umgestellt
  (`--lvl0`..`--lvl4`), Struktur/Crop-Faktor 1,22 unverändert wie in
  design.md gefordert.

**Bewusste Abweichungen von design.md, in `design.md` selbst im
Änderungsprotokoll vermerkt:** kein wörtliches `.gp-panel` auf allen fünf
Containern als einzige Quelle der Panel-Optik (siehe oben, Alias-Strategie);
Hero-Icons als goldene Buchstaben-Kacheln statt Bild-Icons (keine
Icon-Assets vorhanden, kein Format spezifiziert).

**Getestet:** `tests/test.html` lädt `Kostenrechner.html` nicht mit (eigene,
von der App unabhängige Testseite mit eigenem Minimal-Markup), das
CSS-/Markup-Redesign konnte die Testsuite also strukturell nicht berühren.
Trotzdem zur Sicherheit vollständig neu gegen den aktuellen Dateistand
laufen lassen: eigener Node-Harness (`vm.createContext`, `document`/
`localStorage`/`fetch`/`performance`-Stub, lädt `rezepte.js`/`js/*.js`/den
Inline-Testblock aus `tests/test.html` cachefrei von der Platte) meldet
**273 von 273 grün**, unverändert gegenüber v1.8.0/v1.9.0 (erwartungsgemäß,
da kein `js/*.js` geändert wurde). Zusätzlich per Skript geprüft: alle
Klammern im `<style>`-Block balanciert, alle 49 von `js/ui.js` benötigten
IDs im Markup vorhanden, `<details>`/`<summary>`-Tags korrekt geschlossen.

**Härtung:** `oberflaechen-pruefer` konnte **nicht** angefordert werden,
`SendMessage`/`Agent` standen in dieser Sitzung nicht zur Verfügung (wie
schon in mehreren Vorgänger-Zyklen, s. Historie). Ebenso kein interaktives
Browser-Werkzeug für einen echten Rendering-Test verfügbar. Ersatzweise
eine gründliche eigene Prüfung von Kontrast (Textfarben gegen die neuen
dunklen Hintergründe rechnerisch abgeschätzt über die oklch-Lightness-Werte),
Fokus-Sichtbarkeit (Eingabefelder behalten einen sichtbaren Fokusring,
Radio-Buttons bleiben nativ und fokussierbar), und struktureller Konsistenz
(s. "Getestet" oben). **Der Nutzer hat ausdrücklich angekündigt, das
Ergebnis selbst live im Browser zu prüfen** - das ersetzt hier den fehlenden
`oberflaechen-pruefer` und den fehlenden Browser-Zugriff dieser Sitzung.

Versions-Schnappschuss unter `Versionen/v2.0.0 - Visuelles Redesign
Albion-Theme/` angelegt (inkl. `design.md`, `assets/`). Git-Commit und Push
wie im Projekt üblich (s. `../CLAUDE.md`, "Versionskontrolle").

---

**Vorheriger Stand (v1.9.0, "Icon-Kachel im grafischen Bauplan
ueberarbeitet") und alles davor** unverkürzt nach
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
`tests/test.html` unveraendert, neue Dateien `design.md`/`assets/`):

```
Kostenrechner/
  build_graph.py            fertig (P1, P2: el-Feld ergaenzt), seither unveraendert
  rezepte.js                erzeugt (P1, P2), nicht von Hand bearbeiten
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
                              v2.0.0): Suche, Hero,
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
                              v1.7.0; itemIconUrl()/bgBadgeInfo()/bgTooltipFuer()/bgCard()/
                              baueKnotenGrafisch()/renderBauplanGrafisch() (alle Modul-Ebene
                              bzw. im boot()-Scope wie baueKnoten()), einstellungen.bauplanAnsicht
                              (Text/Grafisch, localStorage-persistiert) v1.8.0):
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
  tests/test.html           273 Tests, Offline-Selbsttests + 2 Live-Abschnitte, unveraendert seit v1.7.0
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
