# Kontext-Historie: Albion Kostenrechner

Diese Datei sammelt die vollständigen "Aktueller Stand"-Abschnitte, die aus
`kostenrechner-KONTEXT.md` ausgelagert wurden, sobald die Hauptdatei über etwa
300 Zeilen wuchs. Nichts wird gekürzt, nur verschoben - s. Regel dort unter
"Entwicklungsweise / Mitarbeit". Neueste Auslagerung zuerst.

---

## Aktueller Stand (Eigenpreis-Kandidatenliste auf echte Crafting-Zutaten eingeschraenkt, 06.09.2026, v2.0.1)

**Auftrag:** die Eigenpreis-Pflegeliste (`REZEPTGRAPH.nichtHandelbareKandidaten`,
zuletzt 365 Eintraege) enthielt Item-Familien ohne jeden Bezug zu echtem
Spieler-Crafting, vom Nutzer per Screenshot gezeigt: Sieg-Emote-Aufladungen
("Aufladung des Sieg-Emotes Controllerbanner/Hammer/Hoellentor/
Mobilversionbanner/Schwert" usw.). Ursache: `build_graph()` in
`build_graph.py` waehlte als Graph-Wurzeln (`roots`) **jedes** Item mit
eigenem Rezeptfeld (`has_own_recipe()`), unabhaengig davon, ob es sich um
echtes Crafting oder um kosmetische/interne Sondermechaniken handelt. Von
dort zieht die transitive Huelle deren Zutaten in den Graph, und
`find_non_tradeable_candidates()` markiert sie als Eigenpreis-Kandidat.

**Empirisch am Dump geprueft (nicht geraten):** alle vom Nutzer genannten
Beispiele tragen `@shopcategory="vanity"` und `@shopsubcategory1="killemotes"`.
Dieselbe `vanity`-Kategorie deckt zusaetzlich weitere rein kosmetische
Familien ab (Avatare, Avatarrahmen, kosmetische Ruestungs-/Waffen-/
Reittier-/Umhang-Skins), 270 von 4.054 bisherigen Graph-Wurzeln insgesamt.
Gegenprobe: keines dieser `vanity`-Items wird von irgendeinem verbleibenden
Rezept als Zutat referenziert, sie verschwinden also vollstaendig aus dem
Graph statt nur als Wurzel zu fehlen und ueber eine Zutatenreferenz wieder
hereinzukommen. Zusaetzlich ausgeschlossen: interne Gamemaster-/Debug-Items
(Uniquename enthaelt `GAMEMASTER`, 4 Stueck, z. B.
`UNIQUE_INTERNAL_HEAD_GAMEMASTER`), ebenfalls nie von einem echten Rezept
referenziert.

**Umgesetzt in `build_graph.py`:** neue Funktion `is_excluded_root(name, entry)`
(shopcategory in `ROOT_EXCLUDE_SHOPCATEGORIES = {"vanity"}` oder Name enthaelt
`GAMEMASTER`), in `build_graph()` als zusaetzliche Bedingung neben
`has_own_recipe()` bei der Wurzel-Auswahl verankert. Bewusst **nicht** an
`find_non_tradeable_candidates()` oder an jedem erreichbaren Knoten
angesetzt, nur an der Wurzel-Liste, damit Zutaten ohne eigene
`craftingcategory`, die aber echte Zutaten in einem gueltigen Rezept sind
(Fischsauce-Analogon, z. B. `QUESTITEM_TOKEN_ROYAL_T4`), nicht mit
verschwinden. `rezepte.js` neu erzeugt: Knotenzahl 4.242 → 3.965,
Eigenpreis-Kandidaten 365 → **118**. Stichprobe der verbleibenden 118 rein
plausible echte Nicht-Markt-Zutaten (Fraktionsmarken, GvG-Marke, Community-
Token, Fashion-Umhang-Freischaltungen, Kampagnientruhen-Token, Tierhaltungs-
Jungtiere, Skillbooks). `run_self_checks()` weiterhin gruen, insbesondere
`T4_HEAD_CLOTH_ROYAL`/`QUESTITEM_TOKEN_ROYAL_T4` unveraendert im Graph.

**Getestet:** eigener Node-Harness (wie in frueheren Zyklen: `vm.createContext`,
`document`/`localStorage`/`fetch`/`performance`-Stub, laedt `rezepte.js`/
`js/*.js`/den Inline-Testblock aus `tests/test.html` cachefrei von der Platte)
meldet **273 von 273 gruen**, unveraendert gegenueber v2.0.0 (die Pruefung
auf die Kandidatenzahl vergleicht dynamisch gegen
`REZEPTGRAPH.nichtHandelbareKandidaten.length`, kein Test war auf die
Zahl 365 hartkodiert; nur die beschreibende Testbezeichnung in
`tests/test.html` wurde von "365" auf einen zahlenunabhaengigen Wortlaut
korrigiert). Zusaetzlich direkt gegen `rezepte.js` geprueft:
`T1_KILL_EMOTE_FLAG_CONTROLLER_CHARGES_NONTRADABLE` (das vom Nutzer gezeigte
Beispiel) ist verschwunden, `QUESTITEM_TOKEN_ROYAL_T4`/`T4_HEAD_CLOTH_ROYAL`
weiterhin vorhanden, `QUESTITEM_TOKEN_ARENA_CRYSTAL`/`QUESTITEM_TOKEN_ADC_FRAME`
weiterhin korrekt als Eigenpreis-Kandidat gelistet.

**Haerten:** `spieldaten-pruefer` und `oberflaechen-pruefer` konnten **nicht**
angefordert werden, `SendMessage`/`Agent` standen in dieser Sitzung nicht zur
Verfuegung (wie schon in mehreren Vorgaenger-Zyklen). Ersatzweise die
Dump-Analyse selbst grundlegend und mit mehreren Gegenproben durchgefuehrt
(s. oben), keine reine Behauptung uebernommen. Kein Browser-Werkzeug
verfuegbar; ersatzweise `UI.gefilterteEigenpreisKandidaten("")` ueber
denselben Node-Harness aufgerufen und die ersten 25 von 118 Eintraegen
(alphabetisch, deutsche Namen) durchgesehen: ausschliesslich plausible
Nicht-Markt-Zutaten, keine Emotes/Kosmetik/Debug-Items mehr darunter. Eine
echte visuelle Pruefung im Browser steht noch aus.

**Offene Frage, bewusst nicht entschieden (im Zweifel drin gelassen):** von
den verbliebenen 118 Kandidaten sind 16 Tierhaltungs-/Zucht-Jungtiere
(`T5_FARM_*_BABY`/`T8_FARM_*_BABY`, shopcategory `farming`) und mehrere
Season-/Kampagnen-Kosmetikfamilien (z. B. `UNIQUE_LOOTCHEST_FACTIONCAMPAIGN_*`,
Avalon-Umhang-Freischaltungen). Ob diese ebenfalls raus sollen oder als
legitime Eigenpreis-Faelle bleiben sollen, war nicht eindeutig zu entscheiden
und wurde deshalb **nicht** entfernt.

Versions-Schnappschuss unter `Versionen/v2.0.1 - Eigenpreis-Kandidatenliste
auf echte Crafting-Zutaten eingeschraenkt/` angelegt. Git-Commit und Push wie
im Projekt ueblich (s. `../CLAUDE.md`, "Versionskontrolle").

---

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

## Aktueller Stand (Bauplan grafisch als Baumdiagramm mit Item-Icons, 06.09.2026, v1.8.0)

**Auftrag:** zusätzlich zur bestehenden Text-Baumansicht des Bauplans (bleibt
vollständig erhalten) eine umschaltbare grafische Ansicht, die den Bauplan als
Baumdiagramm zeigt: Knoten als Kästchen mit Item-Icon vom offiziellen
Render-Dienst, Name, Kosten, durch Linien verbunden. Bestätigte
Design-Entscheidungen aus der Brainstorming-Phase: Baumrichtung **links nach
rechts** (Wurzel links, Zweige nach rechts), Umschalter-Wahl dauerhaft in
`localStorage` gemerkt, kein Zoom-Regler (nur Scrollen), Kästchen zeigt
Icon+Name+Verzauberungs-/Qualitäts-Badge+Silber+Fokus+Status-Badge, Details
(Rezept-Index, Stationsgebühr, Rückgewinnung, Preisalter) nur im
`title`-Tooltip, Icon-Größe 40-48px, bei Ladefehler kein Platzhalterbild,
gleiche Auf-/Zuklapp-Logik wie die Text-Ansicht.

**Umgesetzte Implementierung vorgefunden, nicht neu gebaut:** eine vorherige
Sitzung dieses Zyklus hatte die Umsetzung bereits vollständig fertiggestellt
und war am eigenen Sitzungslimit abgebrochen, während sie gerade den
Node-Testlauf zur eigenen Verifikation ausführte (also nach abgeschlossener
Implementierung, mitten in Phase 3). Diese Fortsetzung hat den unveränderten
`git diff` gegen `fada022` (v1.7.0) Zeile für Zeile geprüft, bevor irgendetwas
angefasst wurde, und keine Abweichung von den obigen Design-Entscheidungen
gefunden - deshalb direkt verifiziert statt neu gebaut oder verworfen.

**Umgesetzt in `js/ui.js`:**

- `itemIconUrl(uniquename, qualitaetIndex)`: baut die URL des
  Render-Diensts (`https://render.albiononline.com/v1/item/{id}.png?count=1&quality=Q&size=48`).
  **Wichtigste Einzelheit:** der Dienst zählt Qualität 1-basiert (1=Normal),
  die App 0-basiert (`weg.qualitaet` 0=Normal) - deshalb immer `+1`.
  `count=1` unterdrückt den Mengen-Stapel-Aufdruck (die Menge zeigt die App
  ohnehin separat an der Baumkante).
- `bgBadgeInfo(weg)`: Aktionstyp-Badge (Farbe+Label), dieselbe Farbgebung wie
  die Text-Ansicht (`kn-badge-*`).
- `bgTooltipFuer(weg, r, kante)`/`altBeschreibungPlain()`/`wegVolumenTextPlain()`:
  bauen den gesamten `title`-Tooltip-Text (Rezept-Index, Stationsgebühr samt
  Gebäude, Rückgewinnung, Qualitätsweg, Kaufweg, Preisalter, Handelsvolumen,
  nächstbeste Alternative) - Plain-Text-Varianten der bestehenden
  HTML-Bausteine, weil `title` kein Markup erlaubt.
- `bgCard(weg, r, kante)`: Kästchen-Inhalt (Icon, Badge, Name+Stufe,
  Qualitäts-Badge, Silber, Fokus). Ladefehler: `img.addEventListener("error",
  () => img.remove())` statt Platzhalterbild.
- `baueKnotenGrafisch(weg, r, tiefe, kante)`: Baumaufbau links->rechts,
  dieselbe Tiefenschwelle (`tiefe < 2` automatisch aufgeklappt) und dieselben
  vier Wegtypen (craften/verzaubern/reroll/kaufen+gesperrt als Blätter) wie
  `baueKnoten()` in der Text-Ansicht.
- `renderBauplanGrafisch(r)`/`renderBauplan(r)`: Weiche zwischen Text- und
  Grafisch-Ansicht über `einstellungen.bauplanAnsicht` (`"text"` Standard,
  `"grafisch"` Opt-in), Auswahl dauerhaft in den bestehenden
  Einstellungen-`localStorage` integriert (kein neues Schema).

**Umgesetzt in `Kostenrechner.html`:** CSS für `.bg-*`-Klassen (Kästchen,
Icon, Verbindungslinien als `::before`/`::after`-Pseudoelemente auf
`.bg-child`, links->rechts durch `.bg-children` als Spalte rechts vom
Elternkästchen), Umschalter `#bauplanAnsichtSchalter` (Text/Grafisch, `.dreifach`-
Stil wie andere Umschalter im Projekt) neben "Alles auf-/zuklappen"/
"Handelsvolumen laden". Keine belegten Werte/Formeln berührt.

**Getestet:** Testsuite von 261 auf **273 Tests** gewachsen (12 neue), alle im
neuen Abschnitt "Regressionstest `UI.itemIconUrl()`/`UI.bgBadgeInfo()`": die
+1-Qualitätsumrechnung (Index 0/undefined -> 1, Index 3 -> 4, Index 4 -> 5),
URL-Kodierung des `uniquename`, alle fünf Badge-Zuordnungen plus
Negativfall (`null`), und `defaultEinstellungen().bauplanAnsicht === "text"`
als Standardwert. Alle 273 grün geprüft per eigenem Node-Harness
(`vm.createContext`, `document`/`localStorage`/`fetch`-Stub, lädt
`rezepte.js`/`js/*.js`/den Inline-Testblock aus `tests/test.html` cachefrei
von der Platte, extrahiert `alleTests` über einen zweiten `vm.runInContext`-
Lauf im selben Kontext, da `const` auf Skript-Ebene keine Eigenschaft des
Sandbox-Objekts wird).

**Zusätzlich echt im Browser geprüft** (Puppeteer, da in dieser Sitzung kein
interaktives Browser-Werkzeug zur Verfügung stand, wohl aber Netzzugriff für
`npm install`): `Kostenrechner.html` per `file://` geladen, Gelehrtengugel
T4.3 und T8.3 gesucht, berechnet, auf "Grafisch" umgeschaltet, "Alles
aufklappen" geklickt. Bestätigt per Screenshot: Baum wächst tatsächlich
**links nach rechts** (Wurzel links, mehrstufige Verzweigung nach rechts,
Mengenlabel wie "8.00x"/"2.00x" an den Verbindungslinien, Icons laden
sichtbar farbig, nicht nur der Text). Bestätigt per DOM-Auswertung: `title`-
Tooltips enthalten die volle Detailtiefe ("Rezept #1. Stationsgebuehr 461
(Magierturm). Rueckgewinnung 43,5 %. Naechstbeste Alternative: ..."); ein
simulierter 404 auf eine Icon-URL entfernt genau das `<img>` (7 Icons -> 6),
das Kästchen selbst bleibt intakt, kein Platzhalter erscheint; die
Text/Grafisch-Wahl übersteht einen Seiten-Reload (localStorage-Persistenz
bestätigt, Schlüssel `albion_kostenrechner_einstellungen`).

**Bewusste Abweichung vom Standardablauf, wie schon in v1.4.0-v1.7.0:** weder
`SendMessage` noch `Agent` standen in dieser Sitzung zur Verfügung, die drei
Spezialisten (`rechenkern-pruefer`, `spieldaten-pruefer`, `oberflaechen-pruefer`)
konnten deshalb nicht angefordert werden, obwohl `oberflaechen-pruefer` (neue
Ansicht, neuer Umschalter) fachlich angebracht gewesen wäre. Ersatzweise
diesmal aber, anders als in v1.4.0-v1.7.0, ein **echter** Klicktest im
gerenderten Browser per Puppeteer (s. oben) statt nur Code-Review - dieser
Zyklus hat die in den Vorgängern offen gebliebene Lücke ("kein echter
Klick-Test im gerenderten Browser") also geschlossen.

Versions-Schnappschuss unter `Versionen/v1.8.0 - Bauplan grafisch als
Baumdiagramm mit Item-Icons/` angelegt. Git-Commit und Push wie im Projekt
üblich (s. `../CLAUDE.md`, "Versionskontrolle").

## Aktueller Stand (Icon-Kachel im grafischen Bauplan ueberarbeitet, 06.09.2026, v1.9.0)

Kurz nachgetragen (die ausfuehrliche Beschreibung dieses Zyklus fehlte in der
Hauptdatei zum Zeitpunkt der v2.0.0-Auslagerung; Ableitung aus Commit
`a5c45ed` statt einer vom damaligen Zyklus selbst verfassten Notiz). Icon-
Kachel im grafischen Bauplan (`js/ui.js`, `Kostenrechner.html`) ueberarbeitet:
Rahmenfarbe zeigt die Verzauberungsstufe (0 grau bis 4 gold, `--lvl0`..`--lvl4`),
ein kombiniertes Badge "T\<Tier\>.\<Stufe\>" ersetzt die separate Text-
Stufenangabe, ein Stueckzahl-Badge liegt direkt auf dem Icon (kompakt, ohne
feste Nachkommastellen) statt als Text neben dem Verbindungsstrich. Icons
groesser und per Zoom-Crop (Faktor 1,22) randfuellend ohne sichtbare
Transparenzraender, der Faktor per Live-Test im Browser gegen echte Render-
Service-Icons ermittelt. Nur die grafische Bauplan-Ansicht betroffen, Text-
Baum unveraendert. Keine Testsuite-Aenderung laut Commit (Aenderungsumfang
`Kostenrechner.html`/`js/ui.js`, 58 Zeilen).

---

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

## Aktueller Stand (Alle-Wege-Tabelle gruppiert gleichwertige Wege, 05.09.2026, v1.6.0)

**Auftrag:** Backlog-Punkt "'Alle Wege'-Tabelle zeigt bei baugleichen
Alternativrezepten identische, nichtssagende Zeilen" (Auslöser: Königliche
Gugel, drei Alternativrezepte plus mit/ohne Fokus ergaben sechs Zeilen mit
demselben Silber- und Fokuswert). Drei Rückfragen aus der Brainstorming-Phase,
alle vom Nutzer wie empfohlen beantwortet: (1) zusammenfassen mit Aufklappen,
nicht nur kennzeichnen; (2) Gleichwertigkeit = **exakt gleich bei der
angezeigten Rundung** (die tatsächlich per `formatSilber()`/`formatFokus()`
gerundeten Anzeigewerte, keine Toleranzschwelle auf den Rohwerten); (3)
Gruppierung **nur innerhalb desselben Wegtyps** (kaufen/craften/verzaubern/
reroll bleiben fachlich getrennt).

**Umgesetzt in `js/ui.js`:** drei neue, reine (DOM-freie) Funktionen auf
Modul-Ebene, testbar wie `spezKnotenAnzeigeGruppen()`:

- `statusInfoFuerWeg(w)`: Pille (good/warn/bad) + Text + Grundtext eines Weges,
  wie in der Tabelle sichtbar.
- `gruppiereAlleWege(alleWege)`: fasst Wege zu Gruppen zusammen, deren
  Schlüssel `typ + formatSilber(silber) + formatFokus(fokus) + statusPille +
  Grundtext` ist - also exakt die Definition aus Rückfrage (2)/(3). Reihenfolge
  bleibt stabil (erstes Vorkommen entscheidet die Position), auch bei nicht
  benachbarten Duplikaten.
- `wegGruppenLabel(gruppe)`: bei einem Mitglied unverändert `wegLabelKurz()`
  (keine Regression im Normalfall); bei mehreren ein zusammenfassendes Label
  mit Anzahl, bei `craften` nur dann mit "mit/ohne Fokus" präzisiert, wenn
  ALLE Mitglieder denselben Fokuseinsatz haben.

`renderAlleWege()` gruppiert jetzt vor dem Rendern; eine Gruppe mit mehreren
Mitgliedern wird als anfangs eingeklappte Kopfzeile (Klick toggelt, Pfeil
"▸"/rotiert wie beim bestehenden `<details>`-Muster) plus darunterliegenden,
ursprünglichen Einzelzeilen gerendert. `wegLabelKurz()` von `boot()` auf
Modul-Ebene verschoben (wird jetzt auch von `wegGruppenLabel()` gebraucht).
CSS-Ergänzung in `Kostenrechner.html` (`.wg-gruppe-kopf`, `.wg-pfeil`,
`.wg-gruppe-detail`), keine belegten Werte/Formeln berührt.

**Wichtiger Befund beim Bauen, der die im Auftrag skizzierte Erwartung
korrigiert:** die Vorhersage "sechs Craften-Zeilen der Königlichen Gugel
werden zu zwei Gruppen (mit/ohne Fokus, Fokus-Spannen 287,4 bzw. 514,4)" war
als Hypothese formuliert ("oder je nachdem wie die tatsächlichen Werte
aussehen") und wurde vor dem Bauen per Node-Nachrechnung gegen den ECHTEN
Rezeptgraphen geprüft, nicht ungeprüft übernommen. Ergebnis: `mitFokus` ist am
Wurzelknoten der Königlichen Gugel **folgenlos**, weil das Item keine
`craftingcategory` hat (kein Fokus, keine Rückgewinnung, s. `../CLAUDE.md`
"Königliche Items sind reine Umwandlungen") - mit/ohne Fokus liefern für JEDES
der drei Alternativrezepte identische Zahlen. Bei gleich teuren
Alternativrezepten (Testfixtur: SET1=SET2=SET3=100.000, Siegel=59.945) sind
deshalb tatsächlich **alle sechs** Kandidaten exakt gleich (Silber 219.890,
Fokus 0) und werden zu EINER Gruppe "Craften (6 gleichwertige Wege)"
zusammengefasst - nicht zu zwei Gruppen zu je drei. Das entspricht sogar
genauer dem ursprünglichen Bug-Bericht ("sechs Zeilen mit demselben Silber-
und Fokuswert"). Bei unterschiedlich teuren Alternativrezepten (Gegenprobe:
SET2 teurer) entstehen dagegen korrekt zwei Gruppen (4 + 2 Mitglieder), die
NICHT fälschlich zu einer verschmelzen.

**Getestet:** Testsuite von 228 auf **246 Tests** gewachsen (18 neue, Abschnitt
"Regressionstest Alle-Wege-Gruppierung"): 10 synthetische Kontrollfälle direkt
gegen `UI.gruppiereAlleWege()`/`UI.wegGruppenLabel()` (u. a. unterschiedlicher
Wegtyp trotz gleicher Zahlen bleibt getrennt, unterschiedlicher Status/
Grundtext bleibt getrennt, Rundungsgleichheit bei unterschiedlichen Rohwerten
wird zusammengefasst, Rundungsungleichheit bleibt getrennt, nicht benachbarte
Duplikate werden trotzdem gefunden), plus die reale Königliche-Gugel-
Gegenprobe oben (genau 1 Gruppe bei Gleichstand, genau 2 Gruppen bei
Preisunterschied, Kaufen/Verzaubern bleiben trotz je 1 Mitglied als eigene
Wegtypen getrennt). Alle 246 grün, per Node cachefrei gegen die Dateien auf
der Platte geprüft (`vm.runInContext`, `document`/`localStorage`/
`performance`-Stub sowie ein zweiter Lauf mit vollständigerem DOM-Stub, der
`boot()` fehlerfrei durchlaufen lässt).

**Bewusste Abweichung vom Standardablauf, wie schon in v1.4.0-v1.5.2:** weder
`SendMessage` noch `Agent` noch ein interaktives Browser-Werkzeug
(`mcp__claude-in-chrome__*`/`mcp__computer-use__*`) standen in dieser Sitzung
zur Verfügung. Die drei Spezialisten (`rechenkern-pruefer`,
`spieldaten-pruefer`, `oberflaechen-pruefer`) konnten deshalb nicht angefordert
werden, obwohl `oberflaechen-pruefer` hier fachlich angebracht gewesen wäre
(Oberfläche geändert: `Kostenrechner.html`/`js/ui.js`). Ersatzweise: `boot()`
mit einem vollständigeren DOM-Stub fehlerfrei durchlaufen lassen (fängt
Syntax-/Referenzfehler im neuen Code ab), aber **kein echter Klick-Test der
neuen Aufklapp-Interaktion im Browser** - das steht noch aus. Empfehlung an
den Nutzer: die App einmal öffnen, eine Suche mit bekannten Gleichstand-Fällen
(z. B. Königliche Gugel) durchführen und die neue Gruppenzeile antippen.

Versions-Schnappschuss unter `Versionen/v1.6.0 - Alle-Wege-Tabelle gruppiert
gleichwertige Wege/` angelegt. Git-Commit und Push wie im Projekt üblich
(s. `../CLAUDE.md`, "Versionskontrolle").

---

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

## Aktueller Stand (FCE-Ableitung ueber Schicksalsbrett-Knotenliste je Kategorie, 05.09.2026, v1.5.0)

**Vorheriger Stand (v1.4.0, Feature "Qualitaetsstufen") und alles davor**
unverkürzt weiter unten in dieser Datei.

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
`gruppenSchluesselVonItem()` (Tier-Präfix strippen; **05.09.2026 in v1.5.1
korrigiert für Veredeln, s. Eintrag oben in `kostenrechner-KONTEXT.md`**),
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

---

## Aktueller Stand (Feature "Qualitaetsstufen", 05.09.2026, v1.4.0)

**Vorheriger Stand (v1.3.1, "Standardwert Stationssaetze auf 400 gesetzt") und
alles davor** unverkürzt weiter unten in dieser Datei.

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

---

## Aktueller Stand (Standardwert Stationssaetze, 05.09.2026, v1.3.1)

**Vorheriger Stand (v1.3.0, Feature "Bauplan-Ansicht ergonomisch
ueberarbeitet") und alles davor** unverkürzt weiter unten in dieser Datei.

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

---

## Aktueller Stand (Feature "Bauplan-Ansicht ergonomisch ueberarbeitet", 05.09.2026, v1.3.0)

**Vorheriger Stand (v1.2.0, Feature "Fokuseinsatz steuerbar machen") und alles
davor** unverkürzt weiter unten in dieser Datei.

**Auftrag:** rein visuelle Ueberarbeitung des Bauplan-Baums (`js/ui.js`,
`baueKnoten()`), keine Aenderung an der Rechenlogik. Auslöser war ein
Nutzer-Screenshot der Gelehrtengugel: jeder Knoten eine einzige lange
Fliesstextzeile mit Aktionstyp, Item, Rezept-Index, Fokus-Flag,
Stationsgebuehr samt Gebaeude, Rueckgewinnung und der vollen "naechstbeste
Alternative"-Erklaerung, Farbe faerbte nur die ganze Zeile ein. Bei einem
tief verschachtelten Baum kaum noch lesbar ("man sieht nicht, was genau,
wann, wie, wo zu tun ist").

**Neue Struktur je Knoten, zwei Zeilen statt einer:**

- **kn-zeile (primaer, immer sichtbar):** farbiges Badge des Aktionstyps
  (Kaufen/Craften/Verzaubern/Gesperrt, Farbe sitzt NUR noch auf dem Badge,
  nicht mehr auf der ganzen Zeile), Menge als Chip (nur bei Zutat/Material/
  Vorstufe, z.B. "8,00x"), Item.Stufe fett, bei Craften der bestehende
  Fokus-Schalter, Warn-Badges (unvollstaendig/kein Ruecklauf/Eigenpreis),
  rechtsbuendig die tatsaechlichen Kosten GENAU DIESES Knotens (Silber, ggf.
  Fokus).
- **kn-detail (sekundaer, kleiner/gedaempft):** Rezept-Index, Stationsgebuehr
  samt Gebaeude, genaue Rueckgewinnung bzw. Kaufweg, dazu die naechstbeste
  Alternative in Kurzform ("Alt.: Craften 135.290") mit dem vollen Satz im
  `title`-Tooltip. Gibt es keine Alternative, steht dort nichts (vorher immer
  ein Fuelltext "(keine Alternative verfuegbar)").
- Jeder Knoten ist jetzt eine klar umrandete Karte (`<details>` mit Rahmen),
  nicht mehr eine randlose Zeile. Tiefenverschachtelung bleibt ueber Einrueckung
  und den gepunkteten linken Rand erhalten, wird durch die Kartenoptik eher
  klarer als vorher.

**Relevanz-Entscheidung (Auftrag: "triff eine klare, begruendete
Entscheidung"):**

- **Immer sichtbar:** Aktionstyp, Item+Stufe, Menge, Kosten - genau die vier
  Fragen "was/welches/wieviel/wieviel kostet's", die der Nutzer im Auslöser-
  Zitat als fehlend nannte.
- **Kosten je Knoten sind neu.** Vorher zeigte der Baum nirgends, was ein
  einzelner Zwischenschritt selbst kostet (nur die Stationsgebuehr-Teilsumme
  bei Craften). Das ist keine neue Berechnung: `eigenerKandidat(r, weg)` liest
  den Wert aus dem seit v1.2.0 vorhandenen `r.knotenAlternativen` aus (Index 0
  ist dort immer der guenstigste/gewaehlte Kandidat je "item@stufe",
  rechenkern.js sortiert `alle` genau dafuer aufsteigend), der Bauplan hat ihn
  vorher schlicht nicht angezeigt.
- **Rueckgewinnungs-Prozentzahl je Zutat entfaellt.** Nachgewiesen (nicht nur
  vermutet): `ruecklaufAnteil` je Zutat in `rechenkern.js` ist exakt derselbe
  `rrrWert`, der auch als `weg.rrr` im umschliessenden Craften-Knoten landet
  (`rechenkern.js` Zeilen 297/336/397) - beide Zahlen sind in JEDEM Fall
  identisch, ausser eine einzelne Zutat hat die Mengenobergrenze erreicht
  (`zutat.m===0`, dann greift ihr Ruecklauf gar nicht). Die alte Anzeige
  wiederholte also bei jeder Zutat exakt den Wert, den die Detailzeile des
  Eltern-Craftens ohnehin schon zeigt. Verbleibt: ein rotes "kein Ruecklauf"-
  Badge nur fuer den Ausnahmefall (`ruecklaufAusgeschlossen`), das ist der
  einzige Fall mit echtem Informationsgehalt.
- **Sekundaer (kn-detail, kleiner):** Rezept-Index, Stationsgebuehr-
  Aufschluesselung, genaue Rueckgewinnung, Kaufweg, naechstbeste Alternative -
  im Alltag selten die erste Frage, deshalb kleiner statt gleichrangig, aber
  nicht versteckt (keine zusaetzliche Klickinteraktion noetig, nur optisch
  nachrangig). Vollstaendiger Text der Alternative steckt im `title`-Tooltip.
- Nichts geht ersatzlos verloren: jede vorher gezeigte Angabe ist entweder in
  kn-zeile, in kn-detail, oder im Tooltip weiterhin da; nur die nachgewiesen
  redundante Ruecklaufzahl je Zutat wurde gestrichen (Begruendung oben).

**Alle-Wege-Tabelle bewusst unveraendert gelassen:** sie ist bereits eine
echte Tabelle mit getrennten Spalten (Weg/Silber/Fokus/Zielwert/Status) und
Status-Pills statt einer Fliesstextzeile - teilt die Dichte-Problematik des
Bauplans nicht, deshalb kein Umbau noetig.

**Fokus-Schalter, Eigenpreis-Badge, Preisalter-Anzeige, Unvollstaendig-
Warnung, Gesperrt-Karten:** alle im Browser tatsaechlich angeklickt bzw.
erzwungen und geprueft (Königliche Gugel des Adepten .3, Lymhurst):
Fokus-Schalter dreimal durchgeklickt (automatisch -> immer -> nie ->
automatisch), Alle-Wege-Tabelle reagierte je Klick korrekt; Eigenpreis-Badge
durch Setzen echter Eigenpreise fuer zwei nicht handelbare Zutaten sichtbar
gemacht; Preisalter-Tooltip per DOM-Abfrage bestaetigt; Unvollstaendig-Warnung
war durchgehend sichtbar (fehlende Stationssaetze); Gesperrt-Karte (rot,
Badge "Gesperrt", Item+Stufe, Grund) durch `maxPreisAlterMin=0` erzwungen und
sowohl als Wurzel- als auch als generische Karte bestaetigt, danach
zurueckgesetzt.

**Tests:** 136/136 weiterhin gruen, unveraendert (reine Darstellungsaenderung,
keine neue Testabdeckung noetig - die getesteten `UI.*`-Funktionen sind reine,
DOM-freie Helfer, `baueKnoten()`/`altBeschreibung()` waren nie oeffentlich und
sind nicht Teil der Testsuite).

---

## Aktueller Stand (Feature "Fokuseinsatz steuerbar machen", 05.09.2026, v1.2.0)

**Vorheriger Stand (v1.1.0, Feature "Craft-Stadt waehlbar") und alles davor**
unverkürzt nach `kostenrechner-KONTEXT-HISTORIE.md` ausgelagert
(Schlankheitsregel, s. "Entwicklungsweise / Mitarbeit" unten).

**Auftrag:** die App entschied bislang je Craft-Schritt automatisch ueber
"mit Fokus"/"ohne Fokus" nach der Zielfunktion (Silber + Fokus x Fokuswert).
Bei `fokuswert: 0` (Standard) ist Fokus darin faktisch gratis, die Automatik
waehlt deshalb fast immer die Fokus-Variante - genau das wollte der Nutzer
selbst steuern koennen, statt sich auf den Fokuswert zu verlassen.

**Was gebaut wurde**, nach dem Vorbild von `opts.fceUeberschreibungen`
(FCE-Ausnahmen je Kategorie, P5): zwei neue `opts`-Felder in
`js/rechenkern.js`, beide Werte `"immer"`/`"nie"`, fehlend = Automatik wie
bisher.

- `opts.fokusRegelJeKategorie` (`craftingcategory -> "immer"|"nie"`): gilt fuer
  **jedes** Vorkommen dieser Kategorie im ganzen Baum.
- `opts.fokusUebersteuerungJeKnoten` (`"item@stufe" -> "immer"|"nie"`): gilt fuer
  genau diesen Knoten und schlaegt die Kategorie-Regel. Vorrang: Knoten vor
  Kategorie vor Automatik.

In `kostenGesamt()` entscheidet `fokusRegelFuer(item, stufe, cc, opts)` vor der
`rezepte.forEach`-Schleife, welche der beiden Fokus-Varianten je Alternativrezept
ueberhaupt erzeugt wird. Die durch eine Regel ausgeschlossene Variante wird
NICHT einfach weggelassen, sondern als gesperrter Kandidat MIT lesbarem Grund
eingetragen (z.B. "mit Fokus craften ausgeschlossen: Kategorie-Regel fiber
(nie)") - bleibt so in `alleWege` sichtbar (Transparenz-Vorgabe aus dem Plan)
und macht auch einen etwaigen Totalausfall ("kein Weg verfuegbar")
nachvollziehbar. "immer" an einem Rezept ohne eigenen Fokuswert (koenigliche
Items, `craftingfocus: 0`, keine `craftingcategory`) wirkt einfach folgenlos,
kein Sonderfall noetig.

**Oberflaeche, zwei Ebenen:**

- Kategorie-Regel: neue Tabelle "Fokus-Regel je Kategorie" in den
  Einstellungen (Charakter & Station), exakt nach dem Muster der bestehenden
  FCE-Ausnahmen-Tabelle (zeigt zuerst nur die im aktuellen Bauplan verwendeten
  Kategorien, Knopf fuer alle 43). Dreifach-Schalter Automatisch/Immer/Nie wie
  beim bereits vorhandenen Tagesbonus-Schalter, kein neuer UI-Baustein noetig.
- Knoten-Uebersteuerung: **bewusst keine zusaetzliche Liste**, um den
  Ergonomie-Wunsch des Nutzers zu treffen ("wenige, klar auffindbare Regeln").
  Stattdessen wurde der bereits vorhandene Text "(Rezept #n, mit/ohne Fokus)"
  im Bauplan-Baum selbst interaktiv gemacht: ein Klick auf den Fokus-Teil
  zyklisch automatisch -> immer -> nie -> automatisch (Button mit
  `preventDefault`/`stopPropagation`, damit der Klick nicht zugleich den
  umgebenden `<details>`-Knoten auf-/zuklappt). Genau dort schaut der Nutzer
  ohnehin schon hin, wenn er einen Schritt uebersteuern will.

**Persistenz, bewusste Entscheidung:** beide Regelebenen liegen dauerhaft in
`localStorage` (`einstellungen.fokusRegelJeKategorie`/`.fokusUebersteuerungJeKnoten`),
nicht nur fuer die aktuelle Berechnung. Begruendung: ein Knoten wie
`T4_CLOTH_LEVEL3@3` taucht in vielen verschiedenen Bauplaenen wieder auf (jedes
Item, das verzauberten T4-Stoff braucht) und `kostenGesamt()` memoisiert ohnehin
global ueber `item@stufe`, nicht pfadabhaengig - eine einmal getroffene
Entscheidung soll deshalb nicht bei jedem neuen Suchbegriff verloren gehen.
Identisch zur bestehenden Persistenz der FCE-Ausnahmen.

**Konkretes Zahlenbeispiel (Abnahmekriterium), live im Browser mit echten
Marktpreisen nachvollzogen** (Königliche Gugel des Adepten .3, Lymhurst,
FCE 0, Fokuswert 0):

- Ohne Regel (Automatik): `T4_CLOTH_LEVEL3.3` wird mit Fokus gecraftet
  (Rueckgewinnung 53,9 %), Wurzel kostet **150.808 Silber, 3.677 Fokus**.
- Mit Kategorie-Regel `fiber -> nie`: dieselbe Craft-mit-Fokus-Variante wird
  ausgeschlossen; da craften-ohne-Fokus (Rueckgewinnung nur noch 36,7 %, ca.
  7.605 Silber/Stueck) teurer ist als der Marktpreis, kauft die App
  `T4_CLOTH_LEVEL3.3` jetzt direkt (5.835 Silber/Stueck). Wurzel kostet
  **152.245 Silber (+1.437), 2.298 Fokus (-1.379)** - nachweislich teurer, wie
  vom Nutzer gewuenscht erzwungen, nicht zufaellig gleich geblieben.
- Knoten-Uebersteuerung `"T4_CLOTH_LEVEL3@3": "nie"` (ohne Kategorie-Regel)
  liefert dieselben 152.245/2.298 wie oben; `"immer"` liefert wieder die
  Automatik-Zahlen 150.808/3.677 (hier ohnehin schon die automatische Wahl).
  Vorrang Knoten vor Kategorie eigens mit einer Kombination beider Regeln
  gegeneinander getestet (s. Tests).

**Tests:** 17 neue in `tests/test.html` (Regressionstest ohne jede Regel,
Kategorie-Regel "nie" inkl. Handrechnung, Vorrang Knoten vor Kategorie, "immer"
an einem Rezept ohne Fokuswert). Testsuite 119 -> 136 gruen. Zusaetzlich, weil
dieses Feature den Rechenkern selbst aendert: unabhaengige Nachrechnung per
Node-Skript im Scratchpad (eigener Testgraph, vier Faelle inkl. Handrechnung
der erwarteten RRR/Silberwerte), alle bestanden, bevor die Browser-Pruefung
folgte.

**Browser-Cache-Falle erneut aufgetreten, jetzt als wiederkehrendes Muster
bestaetigt** (s. Backlog/Umgebungs-Fund bei v1.1.0 in der Historie): eine
Aenderung an `js/rechenkern.js` blieb sowohl im wiederverwendeten Tab als auch
in einem frisch geoeffneten neuen Tab unwirksam (`fetch(...,{cache:'no-store'})`
zeigte den frischen Dateiinhalt, das ausgefuehrte Skript verhielt sich aber
nach dem alten). Ausweg wie beim letzten Mal: eine temporaere Kopie mit
cache-gebusteten `?v=timestamp`-Pfaden fuer `tests/test.html` UND
`Kostenrechner.html`, damit 136/136 gruen sowie das obige Zahlenbeispiel im
echten Browser bestaetigt, beide Kopien danach geloescht (Original-Dateien
unveraendert). Fuer kuenftige Sitzungen: bei einer Aenderung an `js/*.js`, die
im Browser nicht ankommt, direkt zu dieser Umgehung greifen, nicht erst lange
mit Hard-Reload experimentieren.

---

## Aktueller Stand (Feature "Craft-Stadt waehlbar", 05.09.2026, v1.1.0)

Der Plan (P1-P7) war mit v1.0.0 vollständig abgeschlossen, v1.0.1 war eine
Fehlerkorrektur danach (Zeitzonen-Bug), s. Eintrag darunter für die Details zu
beidem. Dieses Paket ist keins der sechs Plan-Pakete, sondern ein vom Nutzer
beauftragtes Feature.

**Wichtig, gegen `kostenrechner-PLAN.md` abgeglichen:** Abschnitt 2
("Getroffene Entscheidungen") nannte "Alles Lymhurst" ausdruecklich als
v1-Vorgabe, Abschnitt 8 ("Ausdruecklich nicht in v1") listete andere Staedte
als bewusst ausgeschlossen. Der Nutzer hat diese Vorgabe am 05.09.2026 aktiv
aufgeweicht (Feature-Definition per `define-feature` bestaetigt), kein
eigenmaechtiges Abweichen vom Plan. Beide Stellen in `kostenrechner-PLAN.md`
tragen jetzt einen Verweis hierher. Weiterhin NICHT umgesetzt (Abgrenzung der
Feature-Definition, bewusst v2): getrennte Rollen je Einkaufen/Craften/
Verkaufen wie beim Eintopf-Rechner, Vergleich mehrerer Staedte gleichzeitig,
Transportkosten und Schwarzzonen-Risiko.

**Was gebaut wurde:** ein Dropdown "Stadt" (alle sieben Staedte) neben
Tier/Verzauberung in `Kostenrechner.html`, eine Stadt fuer die gesamte
Rechnung (Kaufen, Craften, Verkaufen zugleich). `js/rechenkern.js` nahm
`opts.stadt` bereits entgegen (unveraendert), `js/regeln.js`s `STADTBONUS`
kannte bereits alle sieben Staedte (unveraendert) - beide waren beim Bau von
P3 schon vorbereitet. Zwei Stellen waren tatsaechlich fest auf Lymhurst
verdrahtet und wurden durch die Einstellung ersetzt:
`js/preise.js` (Konstante `STADT` fuer die API-Abfrage, jetzt `opts.stadt` an
`preiseAbrufen()`, Default `STADT_DEFAULT = "Lymhurst"` nur fuer Aufrufer ohne
eigene Angabe, z.B. die beiden unveraenderten Live-Tests) und `js/ui.js`
(`stadt: "Lymhurst"` beim Zusammenbauen der Opts, jetzt `einstellungen.stadt`).
Ein Stadtwechsel loest ueber den bestehenden `stufeEl`-Mechanismus (neuer,
gleichartiger `stadtEl`-Listener) einen Neuabruf der Preise fuer die neue
Stadt aus und rechnet mit den dortigen `STADTBONUS`-Werten neu.

**Echter Fund dabei, kein Nebeneffekt:** der `localStorage`-Preiscache in
`js/preise.js` war NICHT stadtabhaengig (Schluessel = reine Markt-ID). Ohne
Korrektur haette ein frischer Cache-Eintrag aus Lymhurst faelschlich als
gueltig fuer z.B. Bridgewatch gegolten, obwohl Preise je Stadt vollstaendig
unabhaengig sind - derselbe Fehlertyp wie der v1.0.1-Zeitzonen-Bug, nur bei
der Stadt statt bei der Uhrzeit. Behoben durch `cacheSchluessel(stadt, id)`
(Format `"<Stadt>::<MarktId>"`) an allen Lese-/Schreibstellen des Preiscaches.
Schema-Version dafuer hochgezaehlt, aber BEWUSST GETRENNT von der
Eigenpreis-Schema-Version: `PREIS_CACHE_SCHEMA_VERSION` (1 -> 2) betrifft nur
den Preiscache, `EIGENPREIS_SCHEMA_VERSION` (unveraendert bei 1) den separat
gefuehrten Eigenpreis-Speicher (P6, vom Nutzer gepflegte 365 Kandidaten). Eine
gemeinsame Version haette beim Hochzaehlen faelschlich auch die Eigenpreise
geloescht, obwohl deren Format unveraendert ist - der Fehlertyp, den eine
Schema-Version eigentlich verhindern soll. Konsequenz fuer bestehende Nutzer:
der Preiscache wird beim ersten Laden nach diesem Update einmalig verworfen
(Preise werden neu abgerufen), die gepflegten Eigenpreise bleiben erhalten.

**Zwei-Staedte-Probe (Abnahmekriterium), live im Browser nachvollzogen:**
Faser-zu-Stoff-Veredelung ("Guter Stoff", `craftingcategory` "fiber") mit
Fokus zeigt im Bauplan der Koeniglichen Gugel des Adepten in Lymhurst
**Rueckgewinnung 53,9 %** (Grund 0,18 + Veredelungsbonus 0,40 + Fokus 0,59 =
1,17, RRR = 1,17/2,17), nach Umschalten auf Fort Sterling (dort ist Holz die
Bonusgruppe, nicht Faser) **43,5 %** (0,18 + 0,59 = 0,77, RRR = 0,77/1,77),
bei ansonsten unveraenderten Einstellungen. Preise wurden beim Umschalten
nachweislich neu abgerufen (Statuszeile nennt die Stadt, `localStorage`-Cache
zeigt getrennte Eintraege `Lymhurst::T4_HEAD_CLOTH_ROYAL` und
`Fort Sterling::T4_HEAD_CLOTH_ROYAL`).

**Tests:** 3 neue in `js/preise.js` selbsttest (Cache-Schluessel
stadtabhaengig, zwei unabhaengige Schema-Versionen), 8 neue in
`tests/test.html` (Voraussetzungen `hatVeredelBonus`, sowie
`RECHENKERN.kosten()` mit `opts.stadt` "Lymhurst" vs. "Fort Sterling" am
selben Testgraphen: RRR und Silberkosten unterscheiden sich nachweislich).
Testsuite 111 -> 119 gruen. Eigene, in der Suite sonst nicht verwendete
Item-Namen gewaehlt (`STADTTEST_R`, `STADTTEST_X_LEVEL2`): `REGELN.itemWert()`
memoisiert modulweit ueber `item@stufe` unabhaengig vom uebergebenen
Testgraphen, ein Namenszusammenstoss mit einem der Testbloecke weiter oben
(die ebenfalls generische Namen wie "R" oder "X_LEVEL2" verwenden) haette
sonst stillschweigend falsche Werte aus dem jeweils anderen Testgraphen
uebernommen - live so aufgetreten und korrigiert, nicht nur theoretisch
vermieden.

**Browser-Pruefung, Umgebungs-Fund:** Kostenrechner.html wurde ueber mehrere
Editier-Zyklen hinweg im selben Browser-Tab (127.0.0.1:8791) mehrfach neu
geladen; der HTTP-Disk-Cache des Browsers behielt dabei eine veraltete Kopie
von `js/ui.js`/`js/preise.js` weit laenger als erwartet (auch nach
Query-String-Cache-Busting auf der HTML-Seite selbst und einem
Hard-Reload-Tastaturkuerzel) - erkennbar erst durch direkten Abgleich von
`PREISE.STADT_DEFAULT` (neu) gegen `PREISE.STADT` (alt) im laufenden
Dokument. Umgangen durch eine temporaere Kopie mit cache-gebusteten
`<script src=...?v=timestamp>`-Pfaden, danach geloescht. Betrifft nur diese
Pruefsitzung (Original-`Kostenrechner.html` unveraendert), nicht Endnutzer
mit einem regulaeren ersten Seitenaufruf; trotzdem hier vermerkt, falls eine
kuenftige Sitzung an derselben Stelle haengen bleibt. **Bestaetigt erneut beim
Feature "Fokuseinsatz steuerbar machen" (05.09.2026, v1.2.0):** selbes Muster,
diesmal bei `js/rechenkern.js`, sogar in einem druckfrisch geoeffneten neuen
Tab (nicht nur bei Wiederverwendung eines alten). Kein Einzelfall mehr,
sondern eine wiederkehrende Eigenschaft dieser Browser-Pane-Umgebung; die
cache-gebusteten Kopien bleiben der zuverlaessige Ausweg.

## Aktueller Stand (Fehlerkorrektur nach P7, 05.09.2026, v1.0.1)

Der Plan (P1-P7) war mit v1.0.0 vollständig abgeschlossen, s. Eintrag darunter
für die Details dazu. Dieser Fund kam erst danach, beim gemeinsamen
Nachprüfen einzelner Preise mit dem Nutzer.

**Zeitzonen-Bug bei der Preisalter-Berechnung, gefunden und behoben.** Die
Albion-Online-Data-API liefert Zeitstempel ohne Zeitzonen-Kennung
(`"2026-09-04T20:05:00"`, kein `Z`). Ein rohes `Date.parse()`/`new Date()`
darauf interpretiert das laut ECMAScript-Spezifikation als **lokale Zeit**,
nicht als UTC. In Mitteleuropa (Sommerzeit, UTC+2) ergab das einen Fehler von
exakt 2 Stunden bei jeder Altersberechnung: ein Preis von 20:05 Uhr UTC wurde
als „vor 3,2 Std." angezeigt statt korrekt „vor 1,2 Std.".

Betraf zwei Stellen mit dem exakt gleichen Fehler: `js/ui.js`
(`alterFuerMarktId()`, nur Anzeige) und `js/rechenkern.js`
(`preisMitGrund()`, echte Sperrlogik gegen `opts.maxPreisAlterMin`). Die
Überschätzung wirkt konservativ (macht Preise fälschlich älter, sperrt also
eher zu viel statt zu wenig durchzulassen), ist aber trotzdem ein echter
Fehler: ein Preis, der eigentlich noch innerhalb der eingestellten
Höchstgrenze liegt, konnte fälschlich als zu alt gesperrt werden.

Behoben durch eine gemeinsame Funktion `REGELN.parseApiDatumUtc()` in
`js/regeln.js`, die ein fehlendes Zeitzonen-Suffix erkennt und `Z` ergänzt,
bevor geparst wird. Beide Stellen nutzen jetzt diese Funktion statt eines
rohen `Date.parse()`. 5 neue Tests (3 für `parseApiDatumUtc()` selbst, 2 für
das Verhalten in `RECHENKERN.kosten()` mit einem API-Datum ohne `Z`), Testsuite
106 → 111, live im Browser bestätigt. Zusätzlich live nachgestellt: derselbe
Fall (75 Minuten echtes Alter, API-Format ohne `Z`) ergab vorher 195 Minuten
(195 − 75 = 120 = genau der Zeitzonen-Versatz), nachher korrekt 75.

Gefunden durch den Nutzer beim Vergleich eines von der App angezeigten Alters
mit der tatsächlichen Uhrzeit der API-Antwort, nicht durch einen Prüfer-Agenten.

**Version:** Patch (v1.0.0 auf v1.0.1), reine Fehlerkorrektur, kein neues
Feature und keine Verhaltensänderung außerhalb dieses Bugs.

---

## Aktueller Stand (P7, 04.09.2026, v1.0.0)

P1 bis P7 stehen: Rezeptgraph, Preisschicht, Rechenkern, Testsuite, Oberfläche,
Eigenpreis-Pflege und jetzt Härtung/Abschluss. Details zu P1-P6 (rezepte.js-Schema,
Markt-ID-Regel, Cache-Schema, ItemValue-Herleitung, Rezeptsuche-Verwechslung, die
fünf oberflaechen-pruefer-Befunde, Eigenpreis-Pflegeansicht) stehen unverkürzt in
diesem Dokument weiter unten.

**P7 ist das letzte Paket des Plans, damit gilt die App als vollständig im Sinne
von `kostenrechner-PLAN.md` Abschnitt 1** (Kaufen, Craften und Verzaubern über
den ganzen Baum, mit Oberfläche und Eigenpreis-Pflege). SemVer-Entscheidung:
**Major** (v0.5.0 auf v1.0.0), kein Minor: Abschluss aller sechs Baupakete, kein
einzelnes neues Feature.

**Kontextdatei:** war mit 252 Zeilen bereits schlank, keine inhaltliche Kürzung
nötig. Der P6-Detailblock ist mit dieser Aktualisierung nach
`kostenrechner-KONTEXT-HISTORIE.md` gewandert (gleiches Muster wie zuvor bei
P1-P5), damit diese Datei unter der 300-Zeilen-Schwelle bleibt.

**Testsuite:** 106/106 grün, live über `http://127.0.0.1:8791/tests/test.html`
geprüft (unverändert seit P6; P7 ändert nichts am Rechenkern, reine Härtung).
Der in P6 vermerkte `localhost`-Cache-Fund trat in dieser Prüfung nicht erneut
auf; `127.0.0.1` bleibt trotzdem die empfohlene Adresse für künftige
Browser-Prüfungen.

**`.bat`-Dateien** (`../Kostenrechner öffnen.bat`, `../Rezeptgraph neu bauen.bat`,
eine Ebene über diesem Ordner, außerhalb des Git-Repos) referenzieren beide nur
relative Pfade und funktionieren nach dem Git-Umzug (P5/P6) unverändert weiter,
per Pfadprüfung bestätigt.

**Excel-Gegenprobe (Nutzer-Vorgabe):** `../Verzaubern Kalkulator.xlsx`, Blatt
„Kalkulator", als Beleg für den Verzauberungsschritt (Runen/Seelen/Relikte je
Waffentyp), nicht für den vollen Beschaffungsbaum; der ist bereits früher gegen
die Königliche Gugel geprüft (s. Historie/Commits). Beim Auslesen stand in der
Datei ein anderes Beispiel als in der Aufgabenstellung notiert: **Typus
Werkstück war auf Zweihänder gestellt** (Bedarf 384, nicht Einhänder/288 wie
zuvor in der Hauptsitzung vermerkt; das Dropdown wurde offenbar zwischenzeitlich
umgestellt). Nachgerechnet mit dem tatsächlich vorgefundenen Stand, per
`RECHENKERN.kosten()` mit einem synthetischen Testgraphen (`opts.graph`, Start
Tx.1, Ziel T4.x, 384x Seele à 85, 384x Relikt à 410, keine Rune nötig, da schon
auf .1):

| Größe | Excel | RECHENKERN.kosten() |
|---|---|---|
| Materialkosten (384 Seele + 384 Relikt) | 190.080 | 190.080 |
| Fokus fürs Verzaubern | (kein Feld, konzeptionell 0) | 0 |
| Gewinn (Verkaufsorder, Einkauf 225.000, Verkauf 700.000) | 239.420 | 239.420 |

Exakte Übereinstimmung, Gewinn zusätzlich über `REGELN.STEUER_PREMIUM` und
`REGELN.EINSTELLGEBUEHR_SATZ` nachgerechnet. Bestätigt den Verzauberungszweig
(„Verzaubern kostet nur Materialien, keine Stationsgebühr, keinen Fokus") gegen
eine echte, vom Nutzer selbst gepflegte Referenz. Kein Ersatz für die frühere,
ausführlichere Prüfung des vollen Baums der Königlichen Gugel.

**Live-Plausibilitätslauf (Momentaufnahme, keine Abnahme):** Königliche Gugel .3
mit aktuellen Marktpreisen (04.09.2026, Testsuite Abschnitt 3): günstigster Weg
146.823 Silber, 2.298 Fokus, über Craften der Gelehrtengugel .3 (Rezept #0, mit
Fokus) plus 2x Königliches Siegel. Marktpreise ändern sich laufend, das ist
erwartet und keine Abweichung.

---

## Aktueller Stand (P6, 04.09.2026, v0.5.0)

P1 bis P6 stehen: Rezeptgraph, Preisschicht, Rechenkern, Testsuite, Oberflaeche
und jetzt die Eigenpreis-Pflege. Details zu P1-P5 (rezepte.js-Schema,
Markt-ID-Regel, Cache-Schema, ItemValue-Herleitung, Rezeptsuche-Verwechslung,
die fuenf oberflaechen-pruefer-Befunde) stehen unverkuerzt weiter unten in
dieser Datei.

**P6 in Kuerze:** Eigene Ansicht „Eigenpreis-Pflege" in `Kostenrechner.html`
(neues `<details>`-Panel zwischen „Alle Wege" und „Einstellungen"), listet alle
365 Kandidaten aus `REZEPTGRAPH.nichtHandelbareKandidaten` mit deutschem Namen
(Fallback auf die ID bei den 21 Kandidaten ohne Uebersetzung) und der ID selbst,
durchsuchbar per Textfeld (filtert Name UND ID) ueber die neue reine Funktion
`UI.gefilterteEigenpreisKandidaten(query)`. Je Zeile ein normales
Zahlen-Eingabefeld, das direkt auf `PREISE.eigenpreisSetzen()` schreibt - kein
Combobox-/Tastatur-Sondermuster noetig wie bei der Item-Suche (P5), reine
`<input>`-Felder sind von Haus aus tastaturbedienbar. Zaehler „X von 365 ...
versehen" ueber `UI.anzahlEigenpreiseGesetzt()`.

**Sichtbarmachung im Bauplan (Abnahmekriterium, nicht nur Komfort):**
`js/rechenkern.js` kennzeichnet jetzt in `preisMitGrund()`/`kaufKandidat()`,
ob ein gueltiger Kaufpreis aus einem Marktpreis oder aus einem Eigenpreis stammt
(`weg.eigenpreis: true/false`). `js/ui.js` zeigt das im Bauplan als Badge
„Eigenpreis" (statt der Preisalter-Anzeige, die bei einem Eigenpreis ohnehin
bedeutungslos waere) und in der Alle-Wege-Tabelle als Zusatz „, Eigenpreis"
hinter dem Kaufweg. Live im Browser mit einem echten Rezept verifiziert
(`QUESTITEM_CARAVAN_TRADEPACK_CAERLEON_HEAVY` braucht 40x „Schattenherz"
`T1_FACTION_CAERLEON_TOKEN_1`, kein Marktangebot, per Fetch-Stub simuliert):
Badge und Tabellenzusatz erschienen korrekt, verschwanden nach dem Loeschen
des Eigenpreises wieder.

**Entscheidung zu Punkt 5 des Auftrags (freie Eingabe ueber die 365 Kandidaten
hinaus):** bewusst NICHT umgesetzt. Ein zu Unrecht als „nicht handelbar"
markiertes Item war schon vor P6 nicht blockiert - `PREISE.eigenpreisSetzen()`
kennt keine Beschraenkung auf die Kandidatenliste, und die reaktive Tabelle aus
P5 (`sammleFehlendePreise()`) bietet fuer JEDES im Baum tatsaechlich gesperrte
Item einen Eigenpreis an, unabhaengig von der Heuristik. Eine zweite,
vollstaendige Item-Suche in der Pflegeansicht (zusaetzlich zur bestehenden
Suche oben auf der Seite) haette nur Redundanz und zwei verschieden bediente
Suchfelder auf derselben Seite erzeugt, ohne eine echte Luecke zu schliessen.

**Validierung:** kein negativer oder nullwertiger Eigenpreis speicherbar -
`PREISE.eigenpreisSetzen()` behandelt `preis <= 0` bereits seit P2/P3 als
Loeschen (nicht als 0-Silber-Preis), die neue Pflegeoberflaeche nutzt diesen Weg
unveraendert (kein zweiter Validierungspfad), plus `min="0"` am Eingabefeld
gegen versehentliche Minuswerte. Im Browser bestaetigt: `-50` eingetragen ->
kein Eintrag gespeichert, `PREISE.eigenpreisHolen()` bleibt `null`.

**6 neue Tests** (3 in `rechenkern.js`: `weg.eigenpreis` korrekt bei
Marktpreis/Eigenpreis/keinem von beiden; 7 in `ui.js`: Filterlogik inkl.
Namens- und ID-Suche, alphabetische Sortierung, Zaehler, negativer Eigenpreis
wird nicht gezaehlt) - macht 10 insgesamt, 96 -> 106, alle gruen.

**Umgebungs-Fund, fuer kuenftige Browser-Pruefungen wichtig:** die Vorschau
(`Claude_Browser`, `preview_start`/`navigate`) cachte `js/rechenkern.js` unter
`http://localhost:8791/...` hartnaeckig auf einem aelteren Stand - weder ein
neuer Tab noch ein Server-Neustart (neue `serverId`) noch `Ctrl+Shift+R` haben
das aufgeloest, ein `fetch(..., {cache:"no-store"})` schon. Direktes `curl` vom
Bash-Tool auf denselben Port lieferte dagegen sofort den frischen Stand - der
Cache sitzt also in der Browser-Pane-Infrastruktur, nicht im Python-Server.
**Zuverlaessiger Ausweg:** dieselbe Seite ueber `http://127.0.0.1:8791/...`
statt `http://localhost:8791/...` aufrufen, das traf offenbar einen anderen
Cache-Schluessel und lieferte sofort den aktuellen Stand. Bei kuenftigen
Sitzungen, in denen eine Codeaenderung im Browser partout nicht ankommt: zuerst
`127.0.0.1` statt `localhost` probieren, bevor man an der eigenen Aenderung
zweifelt. **Update P7:** in der P7-Pruefung ist der `localhost`-Cache-Fund
nicht erneut aufgetreten, `127.0.0.1` bleibt trotzdem die empfohlene Adresse.

---

## Aktueller Stand (P5, 04.09.2026, v0.4.0)

P1 bis P5 stehen: Rezeptgraph, Preisschicht, Rechenkern, Testsuite und jetzt
auch die Oberfläche (`Kostenrechner.html` + `js/ui.js`). Details zu P1-P3
(rezepte.js-Schema, Markt-ID-Regel, Cache-Schema, ItemValue-Herleitung,
Rezeptsuche-Verwechslung) stehen unverkürzt weiter unten in dieser Datei.

**P5 in Kürze:** Suchfeld über die deutschen Namen (Tier-Filter, Verzauberung),
Ergebnis-Hero (Weg, Kosten, Fokus, Gewinn), aufklappbarer Bauplan-Baum,
Alle-Wege-Tabelle, Einstellungen in drei Blöcken (Charakter & Station, Handel,
Beschaffung) mit Speicherung in `localStorage`. Dafür in `js/rechenkern.js`
ergänzt: `stationssatzFuer()`, unterscheidet einen fehlenden Stationssatz
(Untergrenze 0, Ergebnis als „unvollständig" markiert) von einem ausdrücklich
auf 0 gesetzten (gültige Gebührenfreiheit).

**Fünf Befunde vom `oberflaechen-pruefer` (echte Bedienung im Browser, nicht
nur Code gelesen), alle in derselben Runde behoben und selbst im Browser
nachverifiziert:**

1. **Suchergebnisse nicht per Tastatur erreichbar (blockierend).** Trefferliste
   jetzt ein ARIA-Combobox-Muster: `role="listbox"` am Container, `role="option"`
   je Zeile, `aria-selected`/`aria-activedescendant`. Pfeil runter/hoch bewegen
   die Markierung, Enter übernimmt, Escape schließt (unverändert). Verifiziert:
   Suche getippt, per Pfeiltasten markiert, per Enter ausgewählt, ganz ohne Maus.
2. **Eigener Platzhaltertext ohne Umlaut lieferte „Keine Treffer" (blockierend).**
   `placeholder` in `Kostenrechner.html` von „Koenigliche" auf „Königliche"
   korrigiert. Keine Umlaut-Ersetzungslogik in der Suche selbst, das wäre ein
   größerer, nicht beauftragter Eingriff gewesen.
3. **Angezeigtes Preisalter maß die falsche Größe (blockierend).**
   `alterFuerMarktId()` in `js/ui.js` verwendete `PREISE.eintragAlterMinuten()`
   (Cache-Abrufzeitpunkt „abgerufenAm"), während die Sperrlogik in
   `preisMitGrund()` (rechenkern.js) das echte API-Marktdatum verwendet. Beide
   Größen liegen im Beispiel des Prüfers 186 Minuten auseinander (5,6 vs. 191
   Min.) - täuscht Frische vor, wo keine ist. Jetzt verwendet die Anzeige
   dasselbe `sell.datum`/`buy.datum` wie die Sperrlogik, inklusive derselben
   Sofortkauf/Kauforder-Umschaltung. Verifiziert mit künstlich gealterten
   Marktdaten (Fetch-Mock, Datum 191 Min. alt, Cache-Zeit frisch): Anzeige
   zeigte danach „vor 3,2 Std.", nicht „vor 0 Min.".
4. **Schnelles Item-Wechseln während laufendem Preisabruf überschrieb still das
   Ergebnis (wichtig).** `berechnen()` in `js/ui.js` hat jetzt ein
   Anfrage-Token (`anfrageZaehler`); eine zurückkommende, inzwischen überholte
   Antwort darf `zustand`/die Anzeige nicht mehr verändern. Verifiziert mit
   Fetch-Mock (ein Item antwortet nach 4 s, ein zweites sofort): nach Wahl des
   ersten und sofort danach des zweiten Items blieb die Anzeige auch nach
   Ablauf der 4 s stabil beim zweiten Item, keine stille Überschreibung.
5. **Negative/unsinnige Zahlenwerte (Schwere geklärt).** Stationssatz: der
   echte Nutzerpfad (`craftKandidat()` → `stationssatzFuer()`) behandelte einen
   negativen Satz bereits korrekt als „nicht gepflegt" (Untergrenze 0, nicht
   negativ) - im Browser mit `-50` am Magierturm bestätigt, Ergebnis identisch
   zum Fall „Satz fehlt". Trotzdem zusätzlich `Math.max(0, ...)` in
   `REGELN.stationsgebuehr()` selbst ergänzt (Verteidigung in der Tiefe für
   einen direkten, isolierten Aufruf ohne die Vorprüfung). Fokus-Effizienz: hier
   fehlte tatsächlich jede Sperre (FCE -500 ergab rechnerisch einen Multiplikator
   über 100 %). Jetzt an der Eingabe in `js/ui.js` auf mindestens 0 begrenzt
   (globales Feld, Kategorie-Ausnahmen, Schicksalsbrett- und
   Abgelesener-Fokus-Übernahme) und zusätzlich in `REGELN.fokusMultiplikator()`
   gekappt. Im Browser bestätigt: `-500` eingetragen → Feld springt sofort auf
   `0`, Anzeige „100 % der Rohfokuskosten".

4 neue Regressionstests in `js/regeln.js` (`stationsgebuehr`- und
`fokusMultiplikator`-Floor), Testsuite danach vollständig grün, 0 Fehler,
keine Duplikate. Tastaturbedienung, Preisalter-Quelle und die Race Condition
sind bewusst keine Unit-Tests (echte Tastatur-/Timing-/DOM-Interaktion nötig),
s. Kommentar in `tests/test.html` bei den ui.js-Tests.

---

## Aktueller Stand (P3, 04.09.2026, v0.3.1)

P1 (Rezeptgraph), P2 (Preisschicht) und P3 (Rechenkern) stehen. Die
Abnahmekriterien von P4 (Testsuite) sind dabei mit erledigt worden, s. unten.
Noch keine Oberfläche, das ist P5. Details zu P1/P2 (rezepte.js-Schema inkl.
`el`-Feld, Graphgröße, `js/preise.js`-API, Markt-ID-Regel, Cache-Schema,
Heuristiken, `build_graph.py`-Arbeitsweise) stehen unverkürzt in
`kostenrechner-KONTEXT-HISTORIE.md`.

**P3 in Kürze:** `js/regeln.js` liefert `itemWert(item, stufe, rezept)`
(rekursiv, memoisiert, besuchsgeschützt), `rrr()`, `stationsgebuehr()`,
`fokusKosten()`, `steuerUndGebuehr()` und die beiden gepflegten Tabellen
Kategorie→Gebäude und Kategorie→Stadtbonus (alle sieben Städte, auch wenn v1
nur Lymhurst rechnet). `js/rechenkern.js` liefert
`RECHENKERN.kosten(item, stufe, menge, opts)`: KAUFEN, CRAFTEN (jedes
Alternativrezept, je einmal mit und ohne Fokuseinsatz), VERZAUBERN, alle Wege
sortiert per Zielfunktion `silber + fokus × fokuswert` zurückgegeben, `weg`
als vollständiger Bauplan-Baum. Getestet: 59 Selbsttests (`tests/test.html`),
plus ein Live-Plausibilitätslauf mit echten Marktpreisen für die Königliche
Gugel .3 (Button „Guenstigsten Weg berechnen"), Ergebnis dort im Baum sichtbar.

**Zwei P1-Fehler behoben:** `iv` am Graph-Knoten war nur die Basisstufe und
bei 61 Items zusätzlich um `amountcrafted` zu groß (Eintopf 5.760 statt 576).
`itemWert()` löst das jetzt rekursiv über das tatsächlich verwendete Rezept
auf, unter Berücksichtigung der Zutat-Stufe (`node.el` hat Vorrang vor `l`,
dieselbe Regel wie bei der Markt-ID). Gegenproben: Eintopf 576, Gelehrten-
sandalen 128/256, Königliche Gugel 160/1.056. `build_graph.py` wurde dafür
NICHT angepasst; das gespeicherte `iv`/`ivd` bleibt der Rohwert für Blätter,
`itemWert()` ist die einzige Stelle, die ihn korrekt verwendet.

**Vom `rechenkern-pruefer` gefunden und behoben (P3):** ein Preis von genau 0
(aus dem Markt oder als Eigenpreis) galt als gültiger Kaufpreis statt als
„kein Preis" - der gefährlichste Fehlertyp der App. Jetzt in
`preisMitGrund()` (rechenkern.js) und `eigenpreisSetzen()` (preise.js)
abgefangen. Außerdem fehlte die in Plan 4.1 verlangte Preisalter-Sperre;
`kosten()` hat jetzt `opts.maxPreisAlterMin`, ein zu alter Marktpreis (Datum
aus preise.js) gilt als kein Preis. Eigenpreise haben kein Alter.

**v0.3.1, Nacharbeit: el-Knoten bekamen nie einen Craft-Weg.** Der Hauptagent
hat den Fehler selbst gefunden und an der Engine reproduziert, nachdem die
P3-Abnahme schon grün war. Ursache: `kostenGesamt()` wählte die Rezeptliste
für einen Knoten allein danach, ob `stufe > 0` war (`stufe>0` → `node.e[...]`,
sonst `node.r`). Das gilt nur für **Ausrüstung**. Bei **el-Knoten**
(veredelte Rohstoffe: Stoff/Leder/Bretter/Barren/Steinblock je Verzauberungs-
stufe, dazu Runen/Seelen/Relikte, 299 Knoten) liegt das Rezept immer in
`node.r`, ein `e`-Feld existiert dort gar nicht. Bei jeder Anfrage mit
`stufe > 0` griff also der Ausrüstungs-Zweig, fand nichts, und es entstand
gar kein Craft-Kandidat, nur `kaufen`. **Dieselbe Verwechslung wie in P2**
im ID-Sammler (dort behoben, s. „Markt-ID" weiter unten), nur an einer
anderen Stelle erneut aufgetreten. Der Fehler war einseitig (macht Ergebnisse
nur zu teuer, nie unmöglich) und fiel deshalb bei keinem Abnahmetest auf,
weil keiner einen verzauberten Rohstoff als Zwischenprodukt verlangte - eine
Lücke in der Beauftragung, nicht in der Umsetzung.

Behoben durch eine einzige gemeinsame Funktion `REGELN.rezepteFuerStufe(node,
stufe)` in `regeln.js`, die sowohl `rechenkern.js` (`kostenGesamt`) als auch
`itemWertIntern()` in `regeln.js` selbst benutzen: hat der Knoten ein `el`,
gilt `node.r` NUR für `stufe === node.el`, sonst leere Liste (auch für
`stufe === 0`, ein el-Knoten liefert sein hochstufiges Rezept nicht als
Stufe-0-Rezept aus). Ohne `el` bleibt die bisherige Ausrüstungslogik.
**Regel fürs nächste Mal: Rezeptsuche für einen Knoten IMMER über
`REGELN.rezepteFuerStufe()`, nie `node.e`/`node.r` von Hand mit einer
`stufe > 0`-Abfrage nachbauen.** Auswirkung am Beispiel Königliche Gugel .3
mit echten Preisen: vorher 147.550 Silber / 2.298 Fokus (Stoff wurde nur
gekauft), nachher 140.316 Silber / 3.595 Fokus (Stoff wird jetzt bis zu drei
Ebenen tief selbst veredelt, bis hinunter zu T2_CLOTH/T3_FIBER). 8 neue Tests
in `tests/test.html` sichern das ab, darunter ein Regressionstest mit festen
Preisen, bei dem Selbstveredeln gegen Kaufen gewinnen muss.


---


## Aktueller Stand (P2, 04.09.2026, v0.2.0)

P1 (Rezeptgraph) und P2 (Preisschicht) stehen. Noch keine App, kein
Rechenkern, keine Oberfläche, das ist P3 bis P5.

### Markt-ID: belegte Regel und zwei gefundene Fehler (P2)

**Die Markt-ID eines Items ist `<uniquename>@<stufe>`, sobald eine Stufe
größer 0 gilt, auch wenn die Stufe schon im uniquename steckt.** Vom Nutzer
am 04.09.2026 live gegen `europe.` bestätigt (`T4_CLOTH_LEVEL1@1` richtig,
`T4_CLOTH_LEVEL1` und `T4_CLOTH@1` beide still leer). Regel in
`js/preise.js`, Funktion `marktId(uniquename, stufeAusKontext)`:

```
effektiveStufe = node.el ? node.el : (stufeAusKontext || 0)
marktId = uniquename + (effektiveStufe > 0 ? "@" + effektiveStufe : "")
```

**Wichtig: Vorrang, nicht Addition.** Beim ersten Live-Test (Baum der
Königlichen Gugel .3) fiel auf, dass der Dump bei einer Zutat wie
„8x T4_CLOTH_LEVEL3" zusätzlich zum bereits im Namen steckenden Level ein
redundantes `@enchantmentlevel: 3` auf die Zutat selbst stempelt. Eine erste,
additive Fassung der Regel (`node.el + stufeAusKontext`) ergab daraus
fälschlich `T4_CLOTH_LEVEL3@6` statt `T4_CLOTH_LEVEL3@3` - beide Zahlen
beschreiben dieselbe Stufe, kein Aufaddieren. Nach dem Fix live bestätigt:
`T4_CLOTH_LEVEL1@1` sell = 420 (exakt der vom Nutzer vorab genannte Beleg-Wert).

**Zweiter, verwandter Fehler:** der ID-Sammler (`sammleMarktIds`) brach bei
veredelten Rohstoffen (eigenes `el`-Feld) die Rekursion in tiefere Zutaten ab,
weil er fälschlich im `e`-Feld statt im `r`-Feld nach dem Rezept suchte -
veredelte Rohstoffe haben aber gar kein `e`-Feld, ihr Rezept steht immer unter
`r` (jede Stufe ein eigener Knoten, s. Schema unten). Nach dem Fix wuchs der
gesammelte Baum der Königlichen Gugel .3 korrekt von 33 auf 36 Markt-IDs
(die fehlenden 3 waren Faser-Zutaten unterhalb von Stoff). Beide Fehler waren
nur im Browser gegen die echte API sichtbar, nicht am Code allein - Beleg
dafür, warum die Browser-Gegenprüfung Pflicht ist.

Zwei Regressionstests dafür stehen in `tests/test.html` (`PREISE.selbsttest()`).

### rezepte.js: neues Feld el (P2)

`build_graph.py` liest jetzt zusätzlich `@enchantmentlevel` vom Item selbst
(nicht von der Zutat) und speichert es als `el`, falls > 0. Betrifft nur
veredelte Rohstoffe, Runen, Seelen, Relikte (312 Items im Rohdump, 299 davon
in der transitiven Hülle des Graphen - die restlichen 13 sind Lootkisten und
Dungeon-Token, die im Rezeptgraph nicht vorkommen). Ausrüstung hat kein
`el`-Feld, deren Stufe steckt ausschließlich im `e`-Schlüssel. Ohne dieses
Feld ließe sich die Markt-ID für verzauberte Rohstoffe nicht korrekt bilden,
s. oben.

### js/preise.js: Preisschicht (P2)

Reine JS-Datei ohne DOM-Abhängigkeit (kein `document.*`), Zugriff über den
globalen `PREISE`-Namensraum. Muss NACH `rezepte.js` geladen werden. Öffentliche
Funktionen:

- `PREISE.marktId(uniquename, stufeAusKontext)` - s. oben.
- `PREISE.sammleMarktIds(item, stufe, {maxTiefe, maxIds})` - durchläuft den
  Rezeptgraphen ab einem Startknoten und sammelt alle Markt-IDs, die eine
  spätere Kostenrechnung braucht (Kaufoption jedes Knotens, Zutaten aller
  Alternativrezepte, Verzauberungsmaterialien, jeweils niedrigere Stufen).
  Keine Kostenrechnung selbst, das ist P3.
- `PREISE.preiseAbrufen(ids, {cacheMaxAlterMin, erzwingen, aufFortschritt})`
  - async, sequenziell in 50er-Blöcken, 1,5 s Pause, bei HTTP 429 wachsende
  Wartezeit (`1,5 s × 2ⁿ`, 5 Versuche). Realm `europe.` fest verdrahtet und
  kommentiert (`www.` ist Amerika). Nutzt frische Cache-Einträge, statt sie
  neu zu holen. Rückgabe je ID: `{sell:{preis,datum,kein}, buy:{...},
  abgerufenAm}` oder `null` bei „nie abgefragt". `preis` ist `null` bei „kein
  Angebot" (Datum `0001-01-01`), **niemals 0**.
- `PREISE.eintragAlterMinuten(eintrag)`, `PREISE.istFrisch(eintrag, minuten)`
  - Preisalter für die spätere Anzeige/Höchstgrenze.
- `PREISE.eigenpreisSetzen/Holen/Entfernen(id, preis)`,
  `PREISE.eigenpreiseAlle()` - Ablage für nicht handelbare Zutaten, eigener
  localStorage-Schlüssel, volle Pflegeoberfläche ist P6.
- `PREISE.preisCacheLesen()/preisCacheLeeren()` - Diagnose/Test bzw. „Preise
  erzwungen neu laden" für P5.
- `PREISE.selbsttest()` - offline prüfbare Kernregeln, von `tests/test.html`
  aufgerufen.

**Cache-Schema:** `localStorage["albion_kostenrechner_preiscache"]` =
`{schema, eintraege: {marktId: {sell, buy, abgerufenAm}}}`. Ein Cache mit
falscher `schema`-Version wird beim Lesen verworfen statt falsch interpretiert
(genau die Falle aus dem Eintopf-Projekt). Aktuell `schema = 1`, Standard-
Gültigkeit 30 Minuten (per `cacheMaxAlterMin` überschreibbar), `erzwingen:
true` erzwingt Neuladen unabhängig vom Alter.

**Live geprüft (04.09.2026, `tests/test.html`, Baum Königliche Gugel .3):** 36
Markt-IDs, 0 HTTP-429-Abbrüche, zweiter Aufruf ohne jeden `fetch()`-Aufruf
(bestätigt per Monkeypatch) direkt aus dem Cache. Belegzahlen verzauberter
Rohstoffe: `T4_CLOTH_LEVEL1@1` sell 420 / buy 376, `T4_CLOTH_LEVEL2@2` sell
2.782 / buy 1.791, `T4_CLOTH_LEVEL3@3` sell 6.023 / buy 4.512,
`T4_FIBER_LEVEL1@1` sell 190, `T4_FIBER_LEVEL2@2` sell 1.350,
`T4_FIBER_LEVEL3@3` sell 4.659 - alles echte Preise, keine Nullen.

### rezepte.js: Schema

`rezepte.js` ist eine reine JS-Datei mit `const REZEPTGRAPH = {...};`, direkt per
`<script src="rezepte.js"></script>` einbindbar. Aufbau:

```
REZEPTGRAPH = {
  meta: { generated, nodeCount, recipeNodeCount },
  items: { "<uniquename>": { ...Item-Knoten... }, ... },
  namen: { "<uniquename>": "<deutscher Name>", ... },   // 11.372 Eintraege
  fehlendeZutaten: [...],           // Zutaten, die im Dump referenziert aber nicht im Index sind
  nichtHandelbareKandidaten: [...], // Heuristik-Liste fuer P6, s. unten
  schema: { ...Kurzbeschreibung der Kuerzel, auch im JSON selbst nachlesbar... }
}
```

**Item-Knoten** (kurze Schluessel, um die Dateigroesse klein zu halten,
Default-Werte werden weggelassen statt gespeichert):

| Schluessel | Bedeutung | Default falls abwesend |
|---|---|---|
| `t` | Tier | - |
| `cc` | craftingcategory | keine Kategorie, keine Fokus/Rueckgewinnung |
| `iv` | ItemValue | - |
| `ivd` | `true` wenn `iv` rekursiv abgeleitet statt aus dem Dump | `false` (Wert kommt direkt aus `@itemvalue`) |
| `ivm` | Liste abweichender Werte, falls Alternativrezepte nicht uebereinstimmen | keine Abweichung |
| `el` | eigene Verzauberungsstufe des Items (P2, aus `@enchantmentlevel` am Item selbst, NICHT an der Zutat). Nur bei veredelten Rohstoffen/Runen/Seelen/Relikten gesetzt (eigener uniquename je Stufe), NIE bei Ausruestung. Grundlage der Markt-ID, s. Abschnitt "Markt-ID" oben. | `0` (Grundstufe oder Ausruestung) |
| `r` | Liste der Basisrezepte (Stufe 0), je ein Rezept-Objekt | Item nicht direkt craftbar |
| `e` | Verzauberungsstufen, Schluessel `"1"`..`"4"`, je `{ r: [...], u: {...} }` | keine Verzauberungsstufen |

**Rezept-Objekt:** `i` = Zutatenliste (Pflicht, kann leer sein bei reinen
Waehrungsrezepten), `f` = craftingfocus (fehlt = 0), `s` = Silberkosten
(fehlt = 0), `a` = amountcrafted (fehlt = 1), `cur` = Waehrungskosten
(z. B. Fraktionspunkte, Gunst) als `[{n, a}]`, wenn das Rezept keine reine
Marktzutat ist.

**Zutat** (in `i`): `n` = uniquename, `c` = count, `l` = enchantmentLevel
(fehlt = 0, wichtig bei Ausruestungs-Zutaten wie „Gelehrtengugel Stufe 1"),
`m` = maxreturnamount (fehlt = unbegrenzt, `0` schliesst Rueckgewinnung fuer
diese Zutat aus, s. z. B. die Koenigs-Items), `p` = preservequality
(fehlt = `false`).

**Upgrade-Objekt** (in `e[stufe].u`, nur wenn `upgraderequirements` existiert):
`res` = Materialliste wie Zutat, aber ohne `l`/`p` (immer Grundstufe), `s` =
Silber, `cur` = Waehrungskosten.

**Zwei Item-Muster im Dump, beide vom selben Parser abgedeckt:**
- **Ausruestung/Waffen:** ein uniquename, Stufen 1-4 stecken in `e`.
- **Veredelte Rohstoffe** (Stoff, Leder, Bretter, Barren, Steinblock) und
  Runen/Seelen/Relikte: **jede Stufe ein eigener uniquename**
  (`T4_CLOTH`, `T4_CLOTH_LEVEL1` ... `T4_CLOTH_LEVEL4`), kein `e`-Feld noetig,
  das ist bereits ein eigener Knoten mit eigenem `r`.

**Wichtig fuer den kuenftigen Rechenkern (P3):** die Abhaengigkeit „Verzaubern
auf Stufe N braucht das Item auf Stufe N-1" steht **nicht** explizit als Kante
im JSON, sie ist strukturell (Spielregel). `kosten(item, stufe)` beim Verzaubern
muss `kosten(item, stufe-1)` selbst aufrufen, s. Plan Abschnitt 4.1.

### Graphgroesse (Lauf 04.09.2026)

- 6.049 Items im Rohindex ueber alle Gruppen des Dumps
- 4.242 Knoten im Graph, davon 4.054 mit eigenem Rezept
- 0 Zyklen (Tiefensuche ueber ein komponiertes `item@stufe`-Modell, inklusive der
  impliziten „Verzaubern braucht Vorstufe"-Kante)
- 0 fehlende Zutaten. Die 7 aus der Vorarbeit vom 04.09. bekannten fehlenden
  Artefakt-/Bannergegenstaende (`T4..T8_ARTEFACT_2H_IRONGAUNTLETS_HELL`, zwei
  Arena-Banner) sind im tagesaktuellen Dump inzwischen vorhanden, das Spiel
  wurde also seither aktualisiert. Kein Handlungsbedarf.
- 365 Kandidaten fuer nicht handelbare Zutaten (Heuristik, s. unten)
- 11.372 deutsche Namen
- `rezepte.js`: 2.506 KB
- 584 Items mit abweichenden ItemValues je Alternativrezept, ueberwiegend
  Artefakt-Ausruestung (Undead/Hell/Keeper/Morgana/Avalon-Varianten) und
  Dungeon-Token, wo ein Alternativweg ueber ein anderes Beschaffungsmuster laeuft.
  Keine dieser Abweichungen betrifft die beiden Abnahme-Items. Vollstaendige
  Liste im Skript-Log, nicht in `rezepte.js` en bloc gespeichert (nur die
  betroffenen Items tragen `ivm`).

**Hinweis zum urspruenglich genannten Vergleichswert „5.883 Knoten":** das war
eine fruehere Prototyp-Zahl aus der Vorarbeit. **Kein Zaehlfehler**, sondern eine
andere Auswahl: der Prototyp nahm jedes Item auf, das ueberhaupt `@tier`,
`@itemvalue` oder `@craftingcategory` trug, also auch Reittiere, Moebel,
Journale, Trophaeen und Zierrat, die im Rezeptgraph nie vorkommen. Das jetzige
Skript nimmt die transitive Huelle des Rezeptgraphen, also alle Items mit
eigenem Rezept plus alle davon referenzierten Zutaten. Das ist die richtige
Auswahl.

Am 04.09.2026 in der Hauptsitzung unabhaengig nachgeprueft: die 4.242 Knoten sind
die Huelle exakt, weder zu gross noch zu klein (eigene Breitensuche ueber die
fertige `rezepte.js` ergab dieselben 4.242 bei 4.054 Wurzeln, Differenz 0), und
keine einzige referenzierte Zutat fehlt als Knoten. Fuer die Suche in der
Oberflaeche ist die Verengung unschaedlich, weil das Suchfeld aus `namen`
gespeist wird (11.372 Eintraege, vollstaendig).

### Heuristik „nicht handelbare Kandidaten"

`build_graph.py` markiert ein Item als Kandidat, wenn eines zutrifft: `@tradable`
explizit `false` im Dump, der uniquename passt zu bekannten Mustern
(`UNIQUE_GVGTOKEN_*`, `*_FACTION_*_TOKEN_*`, Arena-Kristalle/-Marken), oder alle
Basisrezepte des Items sind reine Waehrungsrezepte (Gunst, Fraktionspunkte) ohne
jede Marktzutat. Das ist eine **Heuristik fuer die manuelle Pruefung in P6**,
keine belegte Wahrheit. Stichprobe bestaetigt: `QUESTITEM_TOKEN_ROYAL_T4` steht
**nicht** auf der Liste (korrekt, ist handelbar), `UNIQUE_GVGTOKEN_GENERIC` steht
drauf.

### build_graph.py: Arbeitsweise

- Laedt `items.json` und `formatted/items.json` per `urllib` von
  `raw.githubusercontent.com/ao-data/ao-bin-dumps/master/...`, mit einem
  Zwischenspeicher im System-Temp-Ordner (`--refresh` erzwingt Neuladen).
- Baut zuerst den flachen Item-Index ueber alle Gruppen, dann per Breitensuche
  den Graph: alle Items mit eigenem Rezept sind „Wurzeln", von dort werden alle
  referenzierten Zutaten transitiv aufgenommen (auch wenn sie selbst kein Rezept
  haben, z. B. rohe Ressourcen).
- ItemValue-Ableitung rekursiv mit Memoisierung, meldet Abweichungen zwischen
  Alternativrezepten statt sie stillschweigend zu ignorieren.
- Zyklenpruefung iterativ (keine Rekursion, keine Tiefenbegrenzung noetig) ueber
  ein `item@stufe`-Kantenmodell inklusive der impliziten Verzauberungs-Kante.
- Selbstpruefung am Ende gegen alle Abnahmekriterien aus dem Plan, bricht mit
  Exitcode 1 ab, wenn etwas nicht stimmt.
- Laufzeit bei kaltem Download rund 20 Sekunden, aus dem Zwischenspeicher unter
  1 Sekunde.

### Sonstiges aus P1

- `../.claude/launch.json` neu angelegt: startet einen lokalen
  `python -m http.server` auf Port 8791, Wurzel `Kostenrechner/`. Damit laesst
  sich jede Datei im Ordner ueber `http://localhost:8791/...` im Browser-Pane
  echt ausfuehren (nicht nur als statischer Schnappschuss wie bei `file://`
  ausserhalb des Projektordners). Fuer P5 (Oberflaeche) direkt wiederverwendbar.
- Currency-finanzierte Items (Fraktionsmarken, GvG-Marken) leiten per
  ItemValue-Formel oft `0` ab, weil ihr Rezept keine Marktzutat hat, sondern eine
  Spielwaehrung. Das ist eine bekannte Einschraenkung der Formel aus `CLAUDE.md`,
  betrifft aber genau die Items, die ohnehin auf der Nicht-handelbar-Kandidaten-
  Liste stehen, also fuer P6 vorgesehen sind.
