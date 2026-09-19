# Arbeitsstand: Eintopf-Rechner

> **ARCHIVIERT (13.09.2026, App-Fusion Paket E).** Diese eigenständige App ist nicht
> mehr aktiv; ihre komplette Funktionalität (Rechenkern und Preisvergleich) lebt seit
> den Paketen C/D vollständig und mit eigener Testabdeckung (335/335 Tests grün) im
> zweiten und dritten Reiter des **Kostenrechners** weiter:
> `Kostenrechner.html`. Der aktuelle Stand dieser fusionierten App steht
> in `kostenrechner-KONTEXT.md`, nicht mehr hier.
>
> Die drei Dateien dieser Seite (`Eintopf_Rechner.html`, `eintopf_update.py`,
> `Eintopf-Rechner aktualisieren.bat`) liegen archiviert, außerhalb dieses
> Repos im lokalen Albion-Ordner, unter
> `Archiv/Eintopf-Rechner (eigenstaendig, vor App-Fusion)/`, nicht gelöscht. Die
> Versionshistorie unter `Versionen/` im dortigen Wurzelverzeichnis bleibt
> unverändert stehen.
>
> **Diese Kopie (19.09.2026):** dieselbe Datei liegt weiterhin auch eine Ebene
> höher im lokalen Albion-Ordner (`../KONTEXT.md`, dort das Original). Diese
> Kopie hier macht das Kostenrechner-Repository für Claude Projects/GitHub-
> Anbindungen eigenständig, die nur dieses Repo sehen.
>
> **Der Rest dieses Dokuments bleibt unverkürzt erhalten** als historische
> Fachdokumentation: die hier beschriebenen Formeln, Werte und Entscheidungen sind
> weiterhin die Quelle für die migrierte Logik in `js/eintopf-*.js` und wurden bei der
> Migration nicht verändert.

Übergabedokument für die Fortsetzung in einer neuen Sitzung.
Die **Spielregeln und belegten Formeln** stehen in [CLAUDE.md](CLAUDE.md),
dieses Dokument beschreibt den Stand der **Anwendung**.

Stand: 13.09.2026, v1.1.0 (archiviert)

---

## Was gebaut wurde

Ein Profitrechner für den **Rindfleischeintopf** (T8_MEAL_STEW, Stufen T8.0–T8.3)
als eigenständige Web-App. Ziel: entscheiden, welche Verzauberungsstufe sich
lohnt, wo der Fisch eingekauft und wo verkauft wird, und bis zu welchem
Fischpreis das noch trägt.

Seit 13.09.2026 hat die Seite einen **zweiten, unabhängigen Reiter**
("Preisvergleich"): beliebige Items aus dem kompletten ao-bin-dumps-Namensdump
suchen, mehrere auswählen, Live-Preise über alle 7 Hauptstädte abrufen. Dient
nicht dem Eintopf-Geschäft, sondern dem schnellen Nachsehen unterwegs, wo ein
Item gerade am günstigsten ist. Siehe eigener Abschnitt unten.

### Aufbau

```
eintopf_update.py      Python. Holt Daten, erzeugt die App.
  ├─ Rezepte           fest hinterlegt (aus ao-bin-dumps abgeleitet)
  ├─ preise_holen()    /prices, je Item und Stadt
  ├─ volumen_holen()   /history time-scale=24 → Tagesumsatz + Ø-Preis
  ├─ absatzzeiten_holen()  /history time-scale=1 → Stundenprofil
  └─ TEMPLATE          das gesamte HTML/CSS/JS als String

Eintopf_Rechner.html   Erzeugt. Daten als JSON eingebettet, läuft per Doppelklick.
```

Der Rechenkern liegt vollständig im **JavaScript** der erzeugten Seite, damit
alle Schalter ohne Neuabruf wirken. Python liefert nur Rohdaten.

**Wichtig:** Nie direkt an `Eintopf_Rechner.html` arbeiten; sie wird bei jedem
Lauf überschrieben. Änderungen gehören in den `TEMPLATE`-String in
`eintopf_update.py`.

### Neu bauen

```bash
py -X utf8 eintopf_update.py
```

Dauert ~1 Minute (Drosselung gegen HTTP 429). Erwartete Ausgabe am Ende:
`Preiseintraege 332/332`. Weniger heißt, Blöcke sind ins Rate-Limit gelaufen;
dann erneut laufen lassen.

---

## Was die App zeigt

| Panel | Inhalt |
|---|---|
| **Hero** | Bester Gewinn je Batch, Strategie, bestes Silber je Fokus |
| **Einstellungen** | drei Abschnitte: Charakter & Station (inkl. Craft-Stadt), Handel (inkl. Verkaufsstädte), Beschaffung (inkl. eigener Höchstpreis je Stückchen) |
| **Beste Strategie je Verzauberungsstufe** | Haupttabelle, aufklappbar mit allen Strategien |
| **Fischsauce** | kaufen vs. selbst craften zum eigenen Höchstpreis |
| **Tagesertrag** | was das Fokusbudget hergibt: der entscheidende Vergleich |
| **Faustregel** | Preisbänder: welche Stufe ab welchem Fischpreis am besten ist |
| **Absatzzeiten** | Stundenprofil je Stufe, je in der dort günstigsten Verkaufsstadt, auf Ortszeit gedreht |
| **Fisch-Rangliste** | alle Fische nach Silber je Stückchen, mit Filter Selten/Übrige |
| **Rohpreise** | aufklappbar, alle Preise und Volumina |

### Zentrale Funktionen im JS

| Funktion | Zweck |
|---|---|
| `bezugsarten(id, stadt, o)` | Sofortkauf und/oder Kauforder als Preisvarianten |
| `bestChopQuelle(o)` | reiner Referenzwert: günstigste aktuelle Quelle je Fischstückchen |
| `sauceWege(lvl, o, anzahl)` | Sauce kaufen vs. selbst craften zum eigenen Höchstpreis (`o.eigenerPreis`) |
| `verkaufswege(itemId, o)` | Sofortverkauf vs. Verkaufsorder, bestes Ergebnis über alle gewählten Verkaufsstädte (`o.vkStaedte`) |
| `strategien(stew, ench, o, mitFokus)` | alle Wege für eine Stufe, sortiert |
| `gerade(stew, ench, o, mitFokus)` | Gewinn als Gerade `A − B × Stückchenpreis` |
| `entscheidungsleiter(stew, o, mitFokus)` | Preisbänder: welche Stufe wann die beste ist |
| `schmerzgrenze(...)` | Preis, bei dem der Gewinn einer Stufe genau auf null fällt |
| `guete(s, o)` | Bewertungsmaßstab: Gewinn je Batch **oder** je Fokus |

Die Craft-Stadt ist die globale Variable `HOME` (kein `const` mehr); sie wird
zu Beginn von `opts()` aus dem Dropdown `#craftStadt` neu gesetzt, bevor
irgendeine Funktion sie liest. Alle Stellen, die einfach `HOME` referenzieren
(`sell()`, `buy()`, `volOf()`, Basiszutaten in `strategien()` usw.), folgen
automatisch der aktuellen Auswahl.

---

## Preisvergleich-Reiter (seit 13.09.2026)

Zweiter Reiter, komplett unabhängig vom Eintopf-Rechenkern (keine Rezepte, kein
Fokus, keine Rückgewinnung). Reine Marktabfrage.

- **Item-Quelle:** `eintopf_update.py` lädt zusätzlich `items.json` (Kategorien)
  und `formatted/items.json` (Namen) von ao-bin-dumps, mit eigenem Zwischenspeicher
  im Temp-Ordner (`albion_eintopf_dumpcache`, getrennt vom Kostenrechner-Cache,
  die Apps bleiben unabhängig). Eingebettet als `DATEN.alleItems`: alle 12.237
  Items mit deutschem Namen (Fallback Englisch, sonst die ID selbst - betrifft
  865 Items ohne jede Lokalisierung im Dump, meist Quest-/Tradepack-Items).
- **Qualitätsstufen-Erkennung:** belegt am 13.09.2026, Dump und Live-API
  gegengeprüft. Nur Items der Top-Level-Kategorien `equipmentitem`, `weapon`
  und `transformationweapon` in `items.json` kennen Qualität (Normal bis
  Meisterwerk); alle anderen Kategorien (`simpleitem` = Rohstoffe/Zwischen-
  produkte, `consumableitem` = Speisen/Fische/Tränke, `mount`, `furnitureitem`
  usw.) nicht. Gegenprobe live: `T4_BAG`, `T5_2H_SHAPESHIFTER_SET1` haben echte
  unterschiedliche Preise über mehrere Qualitäten, `T4_WOOD` und `T8_MEAL_STEW`
  liefern nur bei Qualität 1 einen Preis, 2-5 sind 0. Die Oberfläche zeigt die
  Qualitätsauswahl deshalb nur bei Items mit diesem Merker.
- **Live-Abruf:** ein `/prices`-Aufruf je Suchtreffer, alle 7 Städte und
  `qualities=1,2,3,4,5` in einem Request (Chunking ab 50 Items wie beim
  Bestandscode). Zeigt `sell_price_min` (hervorgehoben) und `buy_price_max` je
  Stadt, mit Abrufzeitstempel. Qualitätswechsel danach ohne neuen Abruf, da
  alle 5 Stufen schon geladen sind.
- **Persistenz:** Auswahl (Item + gewählte Qualität) in eigenem localStorage-
  Schlüssel (`eintopf_preisvergleich_v1`), unabhängig vom Schlüssel der
  Einstellungen im ersten Reiter. Beim Laden automatisch neu abgerufen.
- **Getestet:** headless Chrome (kein Selenium/Playwright installiert, daher
  `chrome.exe --headless --screenshot` mit injizierten Testskripten), da diese
  App kein `tests/test.html` hat. Reiterwechsel, Suche mit/ohne Treffer,
  Hinzufügen/Entfernen, Qualitätsauswahl nur bei Ausrüstung, Persistenz über
  Reload, keine JS-Fehler - alles bestätigt.

## Belegt und geprüft

Diese Werte sind gegen das Spiel oder gegen Fremdquellen verifiziert;
nicht ohne neuen Beleg ändern.

| Größe | Wert | Beleg |
|---|---|---|
| Stationsgebühr | `ItemValue × 0,1125 × Satz/100` | Craft-Fenster zeigt 2.462, Formel liefert 2.462,4 |
| ItemValue Eintopf | 576 je Stück | im Spiel abgelesen; = 144 Materialien × 40 ÷ 10 |
| Nahrung je Batch | 648 | Gegenprobe T7 Pork Pie im Albion-Forum |
| Fokus T8.3 | 2.192 | abgelesen; = 2.353 × 93,16 % |
| Ertragsrate | 15,2 % / 43,5 % | Craft-Fenster mit und ohne Fokus |
| Steuer / Einstellungsgebühr | 4 % / 2,5 % | Marktfenster: 70.047 und 43.780 bei 1.751.184 |
| Realm | `europe.` | Fisch 5.419 statt 4.798 auf `www.` |
| Qualitäts-Kategorien | `equipmentitem`/`weapon`/`transformationweapon` = Qualität, sonst nicht | Dump-Kategorien + Live-API (`T4_BAG` vs. `T4_WOOD`/`T8_MEAL_STEW`), 13.09.2026 |

**Vorgehen bei Zweifeln:** Der Nutzer liest Werte im Spiel ab und liefert
Screenshots. Das hat mehrfach Fehler aufgedeckt; im Zweifel nachfragen statt
annehmen.

---

## Offene Punkte

Nach Tragweite geordnet.

**Orderbuchtiefe fehlt.** Die API liefert nur den besten Preis, nicht die
Stückzahl dahinter. Der Nutzer hat belegt: beim Klardunst Schnapper lagen zum
Bestpreis nur 10 Fische. Behelf ist die Preisbasis *Konservativ*: der höhere
Wert aus Bestpreis und 7-Tage-Durchschnitt. Das ist eine Näherung, keine Lösung.
Eine echte Lösung gäbe es nur mit einer Tiefen-Schnittstelle, die es nicht gibt.

**Marktanteil 25 % ist frei gegriffen.** Seit der Entfernung der Mischbeschaffung
(24.08.2026) begrenzt der Regler nur noch, ob der Markt genug **fertige Sauce**
zum Kaufen hergibt (`sauceWege`-Route „kaufen"), nicht mehr die Fischstückchen,
die kommen jetzt ungeprüft zum selbst eingetragenen Höchstpreis. Die frühere
Live-Anzeige „Beschaffbar: X Stückchen" ist mit entfallen.

**Wartezeit und Ausfallrisiko eigener Orders** sind nicht modelliert. Eine
Verkaufsorder für 10 T8.3 reiht sich hinter dutzenden Stück derselben Preisstufe
ein. Die Spalte *Absatz / Markt* im Tagesertrag warnt nur grob.

**Transportkosten zwischen Städten** fehlen. Caerleon zeigt oft den höchsten
Erlös, liegt aber in der Schwarzzone; der Weg dorthin kostet Zeit und Risiko.

**`localStorage` auf `file://`** weiterhin nicht am echten Doppelklick-Aufruf
verifiziert. Die Browser-Vorschau in dieser Session läuft immer als `data:`-URL
(auch bei `file://`-Navigation) und wirft dort zuverlässig `SecurityError` beim
Zugriff auf `localStorage`, bestätigt am 24.08.2026. Das sagt nichts darüber
aus, ob es beim Nutzer im echten `file://`-Kontext (Doppelklick auf die HTML-
Datei) funktioniert. Falls die Einstellungen dort ein Neuladen nicht überleben:
Alternative wäre, sie in die URL zu schreiben. Betrifft seit 13.09.2026 auch
den zweiten localStorage-Schlüssel des Preisvergleich-Reiters
(`eintopf_preisvergleich_v1`) - in dieser Session per headless Chrome mit
`file://`-Pfad erfolgreich getestet (Reload behielt die Auswahl), aber auch das
ist kein Ersatz für den echten Doppelklick-Aufruf des Nutzers.

**Eingebettete Item-Liste vergrößert die Datei deutlich.** Der komplette
Namensdump (12.237 Items, für den Preisvergleich-Reiter) bläht
`Eintopf_Rechner.html` von rund 160 KB auf rund 1,1 MB auf. Für eine lokale
Datei unkritisch, aber falls die Datei je geteilt/gemailt werden soll: der
Preisvergleich-Reiter ist der Grund für den Sprung.

---

## Verworfene Ansätze

Damit sie nicht erneut vorgeschlagen werden.

- **Upgrade-Pfad** (Basis-Eintopf kaufen und mit Sauce aufwerten): existiert im
  Spiel nicht. War aus `upgraderequirements` fehlgedeutet, vom Nutzer widerlegt.
- **Durchschnitt der 10 günstigsten Fische** statt Mischkalkulation: ignoriert
  Mengen und reagiert nicht auf die Bestellgröße. Gemessen bis 29 % daneben.
- **Ø 7 Tage als Preisbasis** ohne `Math.max`: senkt den Preis unter das beste
  Angebot, was beim Sofortkauf unmöglich ist.
- **Rückgewinnung auf Saucen-Craft**: Fischsauce hat weder `craftingfocus` noch
  `craftingcategory`. Der Schalter dafür wurde entfernt.
- **Weitere Eintopfarten** (Ziegen-, Hammelfleischeintopf): auf Wunsch entfernt,
  nur Rindfleisch. Ließen sich als weitere `STEWS`-Einträge ergänzen.
- **Mischbeschaffung für Fischstückchen** (`chopQuellen`/`mischChops`, füllte den
  Bedarf vom günstigsten Preis aufwärts, begrenzt durch Tagesumsatz): auf Wunsch
  am 24.08.2026 entfernt. Der Nutzer kauft Fische, keine Stückchen, und wollte
  dafür selbst einen Höchstpreis vorgeben statt einer Mengen-Mischkalkulation.
  Ersetzt durch das Eingabefeld „Max. Silber je Fischstückchen" (`o.eigenerPreis`).
- **„Preisgrenzen"-Panel mit Mindestmarge**: auf Wunsch am 24.08.2026 entfernt.
  Stand ohnehin immer auf 0 % Standard. Die Faustregel-Leiter (welche Stufe ab
  welchem Fischpreis lohnt) blieb erhalten, `schmerzgrenze()`/`entscheidungsleiter()`
  intern auf die Null-Marge-Variante vereinfacht.

---

## Arbeitsweise, die sich bewährt hat

- **Nach jeder Änderung neu bauen und im Browser gegenprüfen**, nicht nur den
  Code lesen. Mehrere Fehler fielen erst in der gerenderten Seite auf.
- **Rechenergebnisse unabhängig in Python nachziehen.** Hat die Mischkalkulation
  und die Steuerlogik bestätigt und den Saucen-Rückgewinnungsfehler aufgedeckt.
- **Grenzwerte gegenprobieren:** bei exakt der Schmerzgrenze muss der Gewinn null
  sein, bei 20 % Mindestmarge exakt 20,0000 %.
- **Bei Änderungen am Datenaufbau `SCHEMA` im JS hochzählen**, sonst überschreibt
  ein alter Browser-Zwischenspeicher die frischen Daten. Genau das ist passiert.
- Patches über kleine Python-Skripte im Scratchpad statt vieler Einzel-Edits:
  der `TEMPLATE`-String enthält Backticks, die die Shell zerlegt.
- **Ohne Browser-Tool trotzdem echt rendern:** `chrome.exe --headless
  --disable-gpu --no-sandbox --user-data-dir=<schreibbarer Ordner>
  --screenshot=<pfad>.png --window-size=B,H --virtual-time-budget=ms
  "file:///<pfad>"` erzeugt einen echten Screenshot, auch aus einer Bash-Session
  ohne Chrome-Erweiterung. Für Interaktionen (Reiter klicken, Item auswählen)
  eine Kopie der HTML mit einem kleinen `<script>`-Block vor `</body>` versehen,
  der die echten JS-Funktionen der Seite aufruft (z. B. `pvHinzufuegen(...)`) -
  kein Mock, ruft denselben Code auf wie ein echter Klick. Gleicher Dateipfad
  und `--user-data-dir` über zwei Aufrufe hinweg testet `localStorage`-
  Persistenz über einen Reload.

## Vorlieben des Nutzers

- Knapp und ohne Füllstoff. Erklärkästen wurden als „unnötiger Füllstoff"
  entfernt; Erläuterungen gehören in `title`-Tooltips.
- Konstanten, die sich nicht ändern, gehören in den Code, nicht als Eingabefeld.
- Oberfläche einheitlich: gleichartige Felder gleich groß, gruppiert, ausgerichtet.
- Fragt kritisch nach, wenn Zahlen nicht zusammenpassen. Diese Einwände waren
  bisher **immer** berechtigt und haben echte Fehler aufgedeckt.
