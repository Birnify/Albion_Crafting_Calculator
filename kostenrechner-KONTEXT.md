# Kontext: Albion Kostenrechner

Stand: 2026-11-23 · Version: v3.23.0 · O9: gemeinsamer Preisstand über GitHub

> Diese Datei ist die **einzige Quelle für eine frische Session**: aktueller Stand,
> Fachlogik der App, Dateistruktur, Arbeitsweise, offenes Backlog. Zu Beginn jeder
> Arbeit an diesem Projekt vollständig lesen.
>
> Der **Auftrag** steht in `kostenrechner-PLAN.md` und ändert sich kaum; die
> laufende Optimierungsrunde (Pakete O1 bis O6) in `OPTIMIERUNG-PLAN.md`. Die
> **Spielregeln und belegten Formeln** stehen in `CLAUDE.md`. Diese Datei hier
> beschreibt, wie weit die Anwendung ist.
>
> Älteres steht unverkürzt in `kostenrechner-KONTEXT-HISTORIE.md` (neueste
> Auslagerung zuerst); dort nur gezielt nachlesen.

## Was ist das?

„Albion Werkzeuge“ (sichtbarer Titel; Ordner und Repo heißen bewusst weiter
`Kostenrechner`): eine Seite `Kostenrechner.html` mit **acht Bereichen**,
umgeschaltet über die Reiterleiste (`js/tabs.js`). Läuft per Doppelklick aus
`file://`, ohne Build-Werkzeug. Jeder Bereich hat eigenen Zustand; gemeinsam
sind die Preisschicht (`js/preise.js`) und einige Einstellungen (s. unten).
Reihenfolge wie in der Reiterleiste:

1. **Kostenrechner** (`js/ui.js`, `js/rechenkern.js`, `js/regeln.js`): für
   ein craftbares Item auf beliebiger Verzauberungs- und Qualitätsstufe den
   günstigsten Beschaffungsweg über den ganzen Rezeptbaum (kaufen, craften,
   hochverzaubern, Reroll, Mischung). Stadt frei wählbar. Rechenmodell:
   `kostenrechner-PLAN.md`, Abschnitte 1 und 4.
2. **Eintopf-Rechner** (`js/eintopf-*.js`): Profit des Rindfleischeintopfs
   T8.0 bis T8.3, Live-Abruf im Browser, eigene Abrufschicht. Fachdoku:
   `EINTOPF-KONTEXT-ARCHIV.md`.
3. **Preisvergleich** (`js/preisvergleich.js`): beliebige Items aus dem
   Namensdump, Preise über 7 Städte und 5 Qualitäten, dazu verkauft/Tag je
   Stadt. Kein Bezug zum Rezeptbaum, eigene Abrufschicht.
4. **Gelegenheiten** (`js/gelegenheiten.js`, seit v3.17.0): Rangliste der
   besten Crafts und Veredelungen über alle Warengruppen, gespeist von einem
   laufenden Hintergrundscan; Einkaufsliste und Merkliste. Keine eigene
   Rechenlogik, die Zeilen kommen aus `CRAFTEN` und `VEREDELN`.
5. **Craften: Gewinn** (`js/craften.js`, seit v3.11.0): lohnende Crafts
   einer gewählten Warengruppe, flach gerechnet (direkte Zutaten gekauft),
   Volumenfilter Pflicht, Zähler und Einkaufsliste.
6. **Veredeln leveln** (`js/veredeln.js`): Veredelungen mit Gewinn oder etwa
   Null; mehrere Einkaufs- und Verkaufsstädte, eine Fertigungsstadt, eigener
   Preis und Höchstpreis je Zutat. Liefert Zeilenbau, Stadtwahl und
   Kennzahlen auch für die Bereiche 4 und 5.
7. **Ancient Lands** (`js/karte.js`, `js/karte-daten.js`, seit v3.14.0):
   interaktive Karte (Leaflet) mit festen Punkten aus dem Client-Dump,
   Lauf-Tracker und eigenen Markern.
8. **Lootsplit** (`js/lootsplit.js`, seit v3.20.0): Beute einer Gruppe
   aufteilen. Je Mitglied Lootwert, Geldbeutel und Regear; die Gildenkasse
   bekommt einen Prozentsatz vom ganzen Topf, dann wird das Regear erstattet
   und der Rest gleich geteilt; Ergebnis sind Anspruch, Saldo und die Überweisungen. Keine
   Abrufe, kein Bezug zu den anderen Bereichen.

Die bisherige Langfassung dieses Abschnitts (Entstehung, App-Fusion) steht in
der Historie, Block „Ausgelagert am 22.11.2026 (Paket O6)“.

## Aktueller Stand

**Optimierungsrunde O1 bis O5 abgeschlossen (v3.15.0 bis v3.19.0, alle
22.11.2026), O6 Teil 1 erledigt (v3.19.1, nur Doku), Teil 2 entfällt.
Die Runde ist damit abgeschlossen.** Ziele laut `OPTIMIERUNG-PLAN.md`: kurzer Weg vom
Fund zum Einkauf, Potenzialerkennung ohne Vorauswahl, Performance nur wo
nötig. Einzelheiten je Version: Historie, Nachträge v3.15.0 bis v3.19.0.
Selbsttest zuletzt **950/950** grün, dazu `node tests/preisstand-test.js` 27/27.

- **O1, v3.15.0, gemeinsamer Preisbestand.** Preise und Handelsvolumen von
  `js/preise.js` liegen in IndexedDB (`albion_kostenrechner_bestand`), mit
  Arbeitskopie im Speicher: lesen synchron, schreiben im Hintergrund.
  Rückfall auf `localStorage`, wenn IndexedDB fehlt (`PREISE.bestandInfo()`).
  **Gültigkeit: Preise 30 Min., Volumen 60 Min.** (`VOLUMEN_GUELTIG_MIN`);
  beim Laden fällt weg, was **älter als 7 Tage** ist
  (`BESTAND_MAX_ALTER_TAGE`, seit v3.17.0). Die Gewinn-Reiter rufen nur ab,
  was fehlt oder zu alt ist; „Frisch abrufen“ erzwingt alles. Abruflogik:
  `VEREDELN.datenAbrufen()`, `CRAFTEN.datenAbrufen()`. Merker
  `Stadt::ID::qA` heißt „alle Qualitäten abgerufen“. Lesen aus dem Bestand:
  `PREISE.bestandPreis`, `bestandAlleQualitaeten`, `bestandAbsatz`.
- **O2, v3.16.0, Abrufplaner.** Alle Abrufe von `js/preise.js` laufen durch
  eine Warteschlange `PREISE.planer`: strikt nacheinander, 1,5 s Abstand,
  Vordergrund überholt Hintergrund, Budget 120 je Minute und 240 je 5
  Minuten. Schnittstelle: `einreihen(url, {prioritaet, gruppe,
  bezeichnung})`, `abbrechen(filter)`, `pausieren()`, `fortsetzen()`,
  `einstellen({hintergrundAuchVerborgen})`, `status()`, `beiAenderung(fn)`.
  Hintergrundaufträge ruhen bei verborgenem Tab. Bei 429 pausiert die ganze
  Schlange bis zur Reset-Zeit aus dem Antworttext (`limitResetAusText()`).
  **`opts.staedte`** in `preiseAbrufen`, `preiseAlleQualitaetenAbrufen`,
  `volumenAbrufen`, `absatzAbrufen` holt alle Städte in einem Abruf, Ergebnis
  dann `Stadt -> bisheriges Ergebnis`. Statusanzeige `#abrufStatus` in der
  Reiterleiste. Tests tauschen Uhr und Wartefunktion über
  `PREISE.testEinstellen()`. Preisvergleich und Eintopf-Rechner rufen
  weiter an der Schlange vorbei ab.
- **O3, v3.17.0, Reiter „Gelegenheiten“.** Modul `GELEGENHEITEN`. Öffnen
  rechnet sofort aus dem Bestand, auch mit abgelaufenen Werten (Alter je
  Zeile). Der Hintergrundscan (Planer, Priorität `hintergrund`, Gruppe
  `scan`) frischt zuerst gemerkte Zeilen und die Spitze der Rangliste auf,
  dann den Rest; er startet erst nach dem ersten Öffnen des Reiters.
  Vorgabe-Umfang: 3.203 Vorgänge, höchstens 202 Abrufe, rund 6,7 Min. je
  Durchlauf. Erweiterungspunkte: `GELEGENHEITEN.spalteErgaenzen({id, kopf,
  titel, zelle, wert, auf})`, `aktionErgaenzen({id, text, titel,
  ausfuehren})`, `maschine()` liefert die Instanz der App. **Zusatzbonus,
  eigene Preise und Etwa-Null-Grenze der Detailreiter fließen bewusst nicht
  ein**, dieselbe Zeile kann dort deshalb abweichen.
- **O4, v3.18.0, Gewinn je Einsatz.** `VEREDELN.kennzahlenSetzen()` setzt je
  Zeile `gewinnJeTag` (Gewinn/Stück × erreichbare Stück/Tag; erreichbar =
  Anteil × verkauft/Tag, mit Fokus und Premium zusätzlich höchstens 10.000 /
  Fokus je Stück) und `mehrgewinnJeFokus`. Gewinn/Tag ist die Vorgabe der
  Sortierung in allen drei Gewinn-Reitern. Der Anteil ist eine Annahme, kein
  Spielwert (`einstellungen.absatzAnteilProzent`, Vorgabe seit v3.22.0 10,
  vorher 25).
- **O5, v3.19.0, von der Gelegenheit zur Tat.** Einkaufsliste auch in
  „Gelegenheiten“, eine Logik für beide Reiter:
  `CRAFTEN.einkaufsliste(zeilen, plan, schluesselVon)`, Summen über
  `CRAFTEN.einkaufslisteSummenHtml`, Kopieren mit Stufe über
  `CRAFTEN.suchName()`. Sprung in den Kostenrechner aus jeder Zeile:
  `UI.itemOeffnen({item, stufe, stadt})` (stellt dessen Stadt dauerhaft um).
  Merkliste mit den Zahlen des Moments (`einstellungen.merkliste`, höchstens
  200). `VEREDELN.nachZeiger()` behebt den verlorenen ersten Klick nach
  einer Zahleneingabe. Tabellen bei 1440 px ohne waagerechtes Scrollen.

**O7, v3.21.0 (22.11.2026), Markttiefe im Einkauf.** `gewinnJeTag` wird
zusätzlich durch den Einkauf begrenzt (`VEREDELN.einkaufGrenze`): je
gekaufter Zutat `Anteil × verkauft/Tag in der gewählten Einkaufsstadt /
effektive Menge je Stück` (nach Rückgewinnung), das Minimum zählt neben
Absatz und Fokus; `tagGrenze` kennt `"einkauf"`, `einkaufZutat` nennt die
begrenzende Zutat. Drei Fälle: Zutat nie abgerufen (keine Grenze,
`einkaufUnbekannt`, Schild „Einkauf ?“), abgerufen ohne Handel (Gewinn/Tag
0), eigener Preis (begrenzt nicht). Der Anteil gilt jetzt für beide
Marktseiten, das Feld heißt „Annahme: Marktanteil %“. `datenAbrufen` beider
Detailreiter und der Scan holen das Zutatenvolumen mit
(`stadtDaten[].zutatAbsatz`); Durchlauf der Vorgabe höchstens 209 statt 202
Abrufe. Kosten, Gewinn/Stück, Marge und Stadtwahl unverändert (4.614 Zeilen
bytegleich, Umsetzer). **Live gemessen (Hauptsitzung):** Kunstvoller Stoff
T5.0 in Lymhurst, Absatzgrenze 31.499 Stück, Einkaufsgrenze 14.437 Stück
(25 % von 109.647 Himmelsblume, Bedarf 1,9 je Stück). **Die Grenze halbiert
hier nur, sie macht die Zahl nicht realistisch:** bei so liquiden Rohstoffen
entscheidet weiter der angenommene Marktanteil.

**O9, v3.23.0 (23.11.2026), gemeinsamer Preisstand.** Wunsch des Nutzers:
Preisdaten nicht nur im Browser jedes Einzelnen. Nutzer können nicht ins
Repo schreiben (kein Token in der App); stattdessen ruft ein Zeitplan bei
GitHub ab und legt den Stand auf dem **verwaisten Zweig `daten`** ab (immer
genau ein Commit, wird überschrieben; `main` bleibt unberührt).
- `tools/preisstand.js --voll | --schnell [--aus daten] [--max-abrufe N]`:
  voller Lauf = Vorgabe-Scanumfang für alle sieben Städte, 137 Abrufe, rund
  3,5 Min.; schneller Lauf = Preise der Spitze der Rangliste, höchstens 30
  Abrufe. Nutzt Abruf, Normalisierung und Planer der App (keine zweite
  Implementierung). 429: einmal bis zur Reset-Zeit warten, sonst sauber mit
  Teilergebnis enden. Die Vorgabe-Einstellungen sind im Skript gespiegelt
  (`vorgabeEinstellungen()`), bei Änderungen in `ui.js` nachziehen.
- Workflow: schnell `5,20,35,50 * * * *`, voll `10 * * * *` (UTC), von Hand
  über „Run workflow“; nur `contents: write`, kein Geheimnis.
- Dateien auf `daten` (Format in `js/gemeinsam.js`): `stand.json` (Kopf),
  `preise.json`, `volumen.json`; hochgerechnet rund 2,7 MB und 0,6 MB roh.
- App: `GEMEINSAM` lädt beim Start und alle 15 Min. `stand.json` von
  `raw.githubusercontent.com/.../daten/`, große Dateien nur bei Änderung,
  nicht über den Planer. `PREISE.bestandEinmischen()`: **je Eintrag gewinnt
  der jüngere `abgerufenAm`**, älter als 7 Tage oder aus der Zukunft wird
  verworfen. Schalter „Gemeinsamen Preisstand laden“ in „Gelegenheiten“
  (Vorgabe an), Anzeige „Gemeinsamer Stand von HH:MM“ in der Leiste.
  Fehler (404, offline) stören nicht.
- Gemessen (Umsetzer, nachgebildet): leerer Bestand, erste Zeile 0,5 s nach
  dem Klick. Rundlauf Skript → Datei → App → Rangliste: 2.851 Zeilen ohne
  Abweichung (Hauptsitzung nachgelaufen).

**O8, v3.22.0 (23.11.2026), Tagesmaximum sichtbar.** Wunsch des Nutzers:
kein Tagesbudget in Silber, stattdessen die maximale Stückzahl sichtbar.
Unter „Gewinn/Tag“ steht in allen drei Gewinn-Reitern `max. 20/Tag ·
Einkauf` (bzw. Absatz, Fokus; abgerundet; „Einkauf ?“ bei unbekanntem
Zutatenvolumen; Klasse `vd-tagmax`, die früheren Schilder sind darin
aufgegangen). Zähler (Gelegenheiten, Craften) werden hervorgehoben
(`cg-ueber`), wenn die Planung über dem Maximum liegt, die höhere Zahl
bleibt erlaubt; das Produktschild der Einkaufsliste nennt das Maximum
(`VEREDELN.planMaxHtml`). **Marktanteil: Vorgabe 10 % statt 25 %**
(Erfahrungswert des Nutzers: wer mehr anbietet, wird unterboten),
einmalige Umstellung gespeicherter 25 (Merker `anteilZehnUmgestellt`).

**Lootsplit, v3.20.0 und v3.20.1 (22.11.2026, nach der Runde).** Wunsch des Nutzers:
Lootwert, Geldbeutel, Regear getrennt je Partymitglied; seine Entscheidungen:
alle drei je Mitglied, Regear vorab erstatten, Gildenkasse in % vorher
abziehen. `LOOTSPLIT.rechnen(mitglieder, prozent)` in ganzen Silber (BigInt):

```
Topf = Summe Lootwert + Summe Geldbeutel
Gildenkasse = abrunden(Topf × %);  Verfügbar = Topf − Gildenkasse
Rest = Verfügbar − Summe Regear;   Anteil = abrunden(Rest / n)
Anspruch(i) = Regear(i) + Anteil;  Saldo(i) = Hält(i) − Anspruch(i)
```

Der Rundungsrest geht an die Gildenkasse (ohne Gildenanteil an das erste
Mitglied). **Gildenkasse vom ganzen Topf: Nutzer-Entscheidung vom
22.11.2026 (v3.20.1; v3.20.0 nahm sie vom Rest nach Regear).** Reicht der
Topf nach der Gildenkasse nicht fürs Regear, behält die Gilde ihren Anteil
und das Regear wird anteilig aus dem Verfügbaren erstattet (Hinweis in
Warnfarbe; Festlegung der Hauptsitzung, dem Nutzer angesagt). `ueberweisungen()` bildet die Zahlungsliste, die
Gildenkasse ist ein Empfänger. **Festlegung des Umsetzers, vom Nutzer
noch nicht bestätigt:** eine ganz leere Zeile (kein Name, alle
Werte 0) zählt nicht als Mitglied, ein Mitglied ohne Beute und ohne Regear
braucht also einen Namen. Eingabe versteht `250k`, `1,5m`; „Ergebnis
kopieren“ liefert Klartext für Discord; „Neuer Split“ behält Namen und
Gildenkasse. Von der Hauptsitzung nachgerechnet: zwei eigene Fälle (vier
Mitglieder mit 7,5 %: Gildenkasse 117.751, Anteil 269.699; Topf 1.000 bei
50 % und Regear 300/500: Erstattung 187/313) stimmen.
Ungeprüft: echte Zwischenablage, Touch, Firefox.

**Gemeinsame Einstellungen** (gelten in Kostenrechner und allen
Gewinn-Reitern, gespeichert in `albion_kostenrechner_einstellungen`): jede
Änderung läuft über eine `UI`-Funktion, die speichert und ein Ereignis
meldet; die anderen Reiter ziehen nach.

| Einstellung | Setzen | Ereignis |
|---|---|---|
| Stationssätze je Gebäude | `UI.stationssatzSetzen()` | `albion:stationssaetze` |
| Tagesbonus je Warengruppe (gilt in allen Städten) | `UI.tagesbonusSetzen()` | `albion:tagesbonus` |
| Premium | `UI.premiumSetzen()` | `albion:premium` |
| Anteil am Tagesvolumen (Annahme) | `UI.absatzAnteilSetzen()` | `albion:absatzanteil` |

**Speicherschlüssel** (alle `localStorage`, außer dem Bestand):

| Schlüssel | Inhalt | Datei |
|---|---|---|
| `albion_kostenrechner_bestand` | **IndexedDB**: Preise und Volumen von `preise.js`; alle `file://`-Seiten teilen sie sich, auch die Versionsordner | `js/preise.js` |
| `albion_kostenrechner_preiscache` | alter Preisbestand bis v3.14.1, wird einmalig übernommen und entfernt; Rückfall ohne IndexedDB | `js/preise.js` |
| `albion_kostenrechner_eigenpreise` | Eigenpreise für Items ohne Marktpreis | `js/preise.js` |
| `albion_kostenrechner_einstellungen` | Einstellungen des Kostenrechners samt der gemeinsamen | `js/ui.js` |
| `albion_kostenrechner_gelegenheiten_v1` | Scanumfang, Schalter, `plan`, `merkliste` | `js/gelegenheiten.js` |
| `albion_kostenrechner_craften_v1` | Auswahl, `plan` (Markt-ID → Stück) | `js/craften.js` |
| `albion_kostenrechner_veredeln_v1` | Auswahl, Städte, `preisUeberschreibungen` | `js/veredeln.js` |
| `albion_kostenrechner_eintopf_preise_v1`, `..._eintopf_einstellungen_v1` | Preise und Einstellungen des Eintopf-Rechners | `js/eintopf-preise.js`, `js/eintopf-ui.js` |
| `albion_kostenrechner_preisvergleich_v1`, `..._preisvergleich_staedte_v1` | Itemliste und Städte des Preisvergleichs | `js/preisvergleich.js` |
| `albion_kostenrechner_karte_v1` | Ebenen, Lauf, eigene Marker | `js/karte.js` |
| `albion_kostenrechner_gemeinsam_v1` | Merker, welcher gemeinsame Stand schon eingemischt ist | `js/gemeinsam.js` |
| `albion_kostenrechner_lootsplit_v1` | Mitglieder mit Werten, Gildenkasse % | `js/lootsplit.js` |

## Dateistruktur

Stand des Repos am 22.11.2026 (`git ls-files`). Die gewachsene Fassung mit
der Änderungsgeschichte je Datei steht in der Historie, Block „Ausgelagert am
22.11.2026 (Paket O6)“.

| Datei | Zweck |
|---|---|
| `Kostenrechner.html` | Die App: Markup und CSS aller acht Reiter, bindet alle Skripte mit `?v=<Version>` ein |
| `js/tabs.js` | Reiterumschaltung, füllt die Statusanzeige des Abrufplaners |
| `js/regeln.js` | Belegte Spielregeln als reine Funktionen (`REGELN`): ItemValue, Rückgewinnung, Stationsgebühr, Fokus und FCE, Steuer, Qualität, Tabellen Kategorie zu Gebäude und Stadtbonus |
| `js/rechenkern.js` | `RECHENKERN.kosten(item, stufe, menge, opts)`: günstigster Weg über den Rezeptbaum, rein, ohne DOM und ohne Abruf |
| `js/preise.js` | Preisschicht (`PREISE`): Markt-IDs, Abrufplaner, Preis- und Volumenbestand, Eigenpreise |
| `js/ui.js` | Oberfläche des Kostenrechners (`UI`) und die gemeinsamen Einstellungen |
| `js/veredeln.js` | Reiter „Veredeln leveln“ (`VEREDELN`); Zeilenbau, Stadtwahl, Höchstpreis und Kennzahlen auch für Craften und Gelegenheiten |
| `js/craften.js` | Reiter „Craften: Gewinn“ (`CRAFTEN`), Einkaufsliste |
| `js/gelegenheiten.js` | Reiter „Gelegenheiten“ (`GELEGENHEITEN`): Rangliste, Hintergrundscan, Merkliste |
| `js/preisvergleich.js` | Reiter „Preisvergleich“, eigene Abrufschicht, bewusst ohne gemeinsamen Code mit `preise.js` |
| `js/eintopf-daten.js`, `js/eintopf-preise.js`, `js/eintopf-rechenkern.js`, `js/eintopf-ui.js` | Reiter „Eintopf-Rechner“: feste Rezeptdaten, eigene Abrufschicht, Rechenkern, Oberfläche |
| `js/karte.js` | Reiter „Ancient Lands“: Leaflet-Karte, Lauf-Tracker, eigene Marker |
| `js/lootsplit.js` | Reiter „Lootsplit“ (`LOOTSPLIT`): Aufteilung, Überweisungen, ohne Abrufe |
| `js/karte-daten.js` | **Erzeugt** von `build_karte.py`, nicht von Hand bearbeiten |
| `rezepte.js`, `item-namen.js` | **Erzeugt** von `build_graph.py`, nicht von Hand bearbeiten: Rezeptgraph, Namen aller Items |
| `assets/ancient-lands.webp` | **Erzeugt** von `build_karte.py`: Kartenbild |
| `build_graph.py` | Baut `rezepte.js` und `item-namen.js` aus dem Client-Dump (`--refresh`) |
| `build_karte.py` | Baut Kartenbild und `js/karte-daten.js` aus dem Client-Dump |
| `tests/test.html` | Selbsttest aller Module, 950 Tests |
| `tests/preisstand-test.js` | Node-Tests des Abrufskripts (27), Aufruf `node tests/preisstand-test.js` |
| `tools/preisstand.js` | Abrufskript für den gemeinsamen Preisstand (Node 20, lädt die App-Dateien in einen `vm`-Kontext) |
| `.github/workflows/preisstand.yml` | Zeitplan bei GitHub: schnell alle 15 Min., voll stündlich, schreibt den Zweig `daten` |
| `js/gemeinsam.js` | Format und Lader des gemeinsamen Preisstands (`GEMEINSAM`) |
| `vendor/leaflet/` | Leaflet 1.9.4 lokal (js, css, LICENSE) |
| `assets/lymhurst-bg.jpg`, `assets/radiantwilds-bg.jpg` | Banner; das zweite ist bisher unbenutzt |
| `design.md` | Verbindliche Design-Spezifikation |
| `CLAUDE.md` | Spielregeln, belegte Formeln, Arbeitsablauf (Kopie der Root-Datei, ans Repo angepasst) |
| `kostenrechner-PLAN.md`, `OPTIMIERUNG-PLAN.md` | Auftrag der App, Auftrag der Optimierungsrunde |
| `kostenrechner-KONTEXT.md`, `kostenrechner-KONTEXT-HISTORIE.md` | Arbeitsstand, ausgelagerte ältere Stände |
| `AUDIT-2026-09-13.md` | Code-Audit gegen das Wiki, Status je Befund |
| `EINTOPF-KONTEXT-ARCHIV.md` | Fachdoku des früheren eigenständigen Eintopf-Rechners |
| `README.md`, `.gitignore` | Repo-Beschreibung; `Versionen/` und `__pycache__/` sind ignoriert |
| `.claude/agents/`, `.claude/skills/define-feature/`, `.claude/settings.json` | Prüfer-Agenten (Orchestrator abgelöst), Skill, Einstellungen |
| `Versionen/` | Lokale Schnappschüsse je Version, nicht im Repo |

Außerhalb des Repos, eine Ebene höher: `Kostenrechner öffnen.bat`,
`Rezeptgraph neu bauen.bat` (ruft `build_graph.py --refresh`),
`.claude/launch.json` und `.claude/no_cache_server.py` für die Vorschau.

## Entwicklungsweise / Mitarbeit

- **Diese Kontextdatei nach jedem abgeschlossenen Paket aktualisieren**,
  Stand-Datum und Version oben mitziehen.
- **Schlank halten.** Sobald diese Datei über etwa 300 Zeilen wächst, wandert der
  bisherige Abschnitt „Aktueller Stand" unverkürzt an den Anfang einer neu
  anzulegenden `kostenrechner-KONTEXT-HISTORIE.md`, und hier bleibt nur ein kurzer
  Abschnitt (5 bis 10 Zeilen) mit Verweis. Nichts wird dabei gelöscht oder inhaltlich
  gekürzt, nur verschoben. Im Pizza-Projekt war genau das der Grund, warum die
  Hauptdatei auf 325 KB angewachsen war.
- **Arbeitsablauf:** s. `CLAUDE.md`, Abschnitt „Arbeitsablauf“. Die
  Hauptsitzung steuert; je Paket ein frischer Umsetzer-Subagent, Prüfer als
  Subagenten ohne Schreibrechte, Abschluss (Kontextdatei, Version, Commit)
  durch die Hauptsitzung.
- **Versionen-Workflow (Pflicht bei jeder abgeschlossenen Änderung):** kompletten
  lauffähigen Stand nach `Versionen/vX.Y.Z - [Beschreibung]/` kopieren. SemVer:
  Patch = Fix, Minor = Feature, Major = Umbau. Konventionen in
  `Versionen/LIESMICH.txt`.
- **Testsuite:** `tests/test.html` per Doppelklick, grün = OK. Nach jeder Änderung
  am Rechenkern laufen lassen. Behauptete Testergebnisse eines Sub-Agenten nie
  ungeprüft übernehmen, immer selbst nachlaufen lassen.
  **Die Seite ist erst fertig bei
  `document.body.dataset.testsFertig === "1"`** (ein Teil der Tests läuft
  asynchron); wer vorher liest, sieht eine zu kleine Zahl. Stand: 950/950.
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

## Backlog

Alle offenen Punkte, Stand v3.19.0. In Klammern die Version, in deren
Nachtrag die Einzelheiten stehen (Historie); „Backlog alt“ meint dort den
Abschnitt „Backlog / Mögliche nächste Schritte“ im Block vom 22.11.2026.
**Die Optimierungsrunde ist abgeschlossen.** O6, Teil 2 (`js/ui.js`
aufteilen) entfällt: Nutzer-Entscheidung vom 22.11.2026 auf Rat der
Hauptsitzung (kaum Tests für das Rendering, gemeinsamer Zustand im
Startblock, kein Nutzen für die Ziele der Runde). Nicht erneut vorschlagen,
solange sich daran nichts ändert.

**Rechnung und Daten**

- Gemeinsamer Preisstand: ob die API die Abrufe der GitHub-Runner
  durchlässt und ob GitHub den Takt hält, zeigt erst der Betrieb; ein
  regelmäßig abgebrochener voller Lauf lässt immer dieselben hinteren
  Blöcke alt (keine Rotation); stündlich rund 48 MB Antwortdaten von der
  API; im `localStorage`-Rückfall sprengen 131.000 Einträge die Grenze;
  beim Öffnen mit leerem Bestand geht ein Scan-Abruf hinaus, bevor der
  gemeinsame Stand eingemischt ist; GitHub schaltet Zeitpläne nach 60 Tagen
  ohne Aktivität im Repo ab (v3.23.0).

- Tagesmaximum bei Massenware bleibt auch mit 10 % Marktanteil vierstellig
  (Kunstvoller Stoff T5.0: 5.587 je Tag). Ein Tagesbudget in Silber hat der
  Nutzer am 23.11.2026 abgelehnt („Geld ist nicht das Problem“); er plant
  über Zähler und Einkaufsliste. Keine Preisstaffel möglich (die API kennt
  kein Orderbuch).
- **Verkaufspreis aus besserer Qualität:** „Craften: Gewinn“ und
  „Gelegenheiten“ nehmen das billigste Angebot über alle Qualitäten; fehlt
  ein Normal-Angebot, rechnet die Zeile mit einem Exzellent-Preis für ein
  meist normales Stück (Heiligenstab des Adepten T4.2: 146 % Marge;
  überschlagen mit Aufwertung bis Exzellent rund 13 %). Geplantes Paket
  „Qualität im Verkauf“: Wege je Zielqualität mit Aufwertungskosten
  vergleichen, Normalpreis über gehandelten Durchschnitt absichern, Volumen
  der Zielqualität, Qualitätsbonus aus Schicksalsbrett und Salat
  (`CLAUDE.md`, Tabelle vom 22.11.2026; Einheit im Spiel zu bestätigen).
- O7: die Einkaufsgrenze verkleinert auch einen negativen Gewinn/Tag; bei
  verschiedenen Einkaufs- und Verkaufsstädten kann eine ID je Scan-Durchlauf
  in zwei Volumenabrufen stehen; meldet `history/` für eine Stadt nichts,
  wird der Kandidat nie „frisch“ (v3.21.0).
- Gewinn/Tag mehrerer Fokus-Zeilen ist nicht summierbar, jede Zeile setzt
  das volle Fokusbudget an (v3.18.0).
- **Echte 429 weit unter dem Limit, Ursache ungeklärt** (fehlende
  Kompression, gemeinsamer Zähler oder kürzeres Fenster). **Ob die
  429-Antwort einen CORS-Header trägt, ist ungeprüft:** fehlt er, landet der
  Planer im Fehlerweg (5 Versuche) statt im 429-Weg (v3.16.0).
- Preisvergleich und Eintopf-Rechner rufen an der Schlange vorbei ab; das
  Budget gilt je Browser-Tab (v3.16.0).
- Preisbestand: 270.000 Einträge nicht gemessen; IDs, die die API weglässt,
  werden bei Preisen jedes Mal neu geholt; zwei offene Tabs sehen die Abrufe
  des anderen erst nach Neuladen; ein Gesamtscan im `localStorage`-Rückfall
  sprengt dessen Grenze (v3.15.0, v3.17.0).
- Gelegenheiten: „oberste 50 frisch in 15 s“ ist nicht garantiert (12,3 s
  gemessen, wenn sich die Spitze umsortiert); Abrufe anderer Reiter fließen
  erst beim nächsten Öffnen oder Scan-Block ein; Scan mit Artefakt-Items
  (rund 6.800 Crafts) in der Oberfläche nicht getestet (v3.17.0).
- Craften: Gewinn rechnet beim Sofortverkauf mit der höchsten Kauforder in
  Normal (Annahme, nicht im Spiel geprüft); bessere gewürfelte Qualität ist
  nicht eingerechnet (v3.11.0).
- **Fokuswert-Verdacht aus v1.5.2:** gemeldeter Fokus-Anstieg (754,9 →
  1.233,5) nicht reproduzierbar; vermutet ein alter Fokuswert > 0 im
  `localStorage`. Nutzer bitten, das Feld „Was ist mir ein Fokuspunkt wert?“
  zu prüfen und bei 0 zu wiederholen (Backlog alt, Punkt 3).
- **549 Graph-Wurzeln ganz ohne Namen**, vom Nutzer am 06.09.2026 als Paket
  angefordert; braucht Stichproben, bevor `is_excluded_root()` wächst
  (Backlog alt, Punkt 4).
- Tierhaltung, Zucht und Season-Kosmetik in der Eigenpreis-Pflegeliste:
  Nutzer-Entscheidung je Familie offen (Backlog alt, Punkt 1, v2.0.1).
- 11 von 118 Kandidaten der Eigenpreis-Pflegeliste ohne deutschen Namen,
  zeigen ihre ID (Backlog alt).
- Eigenpreis 0 („habe ich auf Lager“) nicht möglich, `eigenpreisSetzen(id,
  0)` löscht den Eintrag; falls gewünscht eigene Funktion (Backlog alt).
- Tränke, Nebenhände, Kampfhandschuhe: Knotenlisten nicht umgesetzt, FCE
  über Freitext; `ALCOHOL` hängt noch im Koch-Baum (`CLAUDE.md`,
  `AUDIT-2026-09-13.md` Befund 4 und 11; wartet auf die Ablesungen unten).
- Ancient Lands: Gerüst von `DRAGON-ISLANDS-002` nicht geprüft (v3.14.0).
- Root-`CLAUDE.md` eine Ebene höher: am 22.11.2026 an die Kopie im Repo
  angeglichen (Spielerprofil, API, „Belegte Spielformeln“, „Craft-Kategorie
  zu Gebäude“). Noch verschieden ist der Abschnitt zum Wiki-Zugriff
  (In-App-Browser, weitere nützliche Seiten stehen nur in der Repo-Kopie);
  die übrigen Unterschiede sind gewollt (Pfade, Dateitabellen,
  Versionskontrolle). Künftige Änderungen an Spielwerten in beiden Dateien
  nachziehen.

**Oberfläche**

- Lootsplit: Entfernen einer Zeile fragt nicht nach und lässt sich nicht
  rückgängig machen; bei 390 px liegen Geldbeutel, Regear und die
  Ergebnisspalten hinter waagerechtem Scrollen im Rahmen; nicht gebaut sind
  gewichtete Anteile, Reparaturkosten, Bewertung der Beute über Marktpreise
  und eine Historie (v3.20.0).
- Wortlaut „gesperrt“: Alternative wie „kein bei AODP erfasster Preis“ nie
  gefragt und nicht umgesetzt (Backlog alt, Punkt 2, v1.7.0).
- Bei 390 px liegen in den Gewinn-Reitern Gewinn und Marge sowie die Summen
  der Einkaufsliste hinter waagerechtem Scrollen im Rahmen (v3.17.0, v3.19.0).
- Breite bei 1440 px mit klassischem 17-px-Scrollbalken ungeprüft (Craften
  mit Fokus und zweiter Einkaufsstadt läge etwa 1 px darüber); Touch und
  Firefox ungeprüft, auch IndexedDB unter `file://` in Firefox (v3.19.0,
  v3.16.0, v3.15.0).
- „Veredeln leveln“ hat keinen Zähler, keine eigene Einkaufsliste (v3.19.0).
- Ein Rückfall des Bestands auf `localStorage` ist in der Oberfläche nicht
  sichtbar (v3.15.0).
- Ob die Albion-Marktsuche „4.0“ so auswertet wie „4.3“, ist nicht geprüft
  (v3.12.2).
- Klick- und Sprungtests mit echter Maus liegen als Playwright-Skripte
  außerhalb des Repos, nicht in `tests/test.html` (v3.19.0).

**Ablesungen durch den Nutzer (erbeten)**

- Details-Panel je eines **Trank-** und eines **Schild-Knotens**
  (Mutual-Wert), ein Bild der Ebene darüber (Meisterschaftsknoten), und das
  **Kampfhandschuh-Fenster**, von dem es kein Bild gibt (Ablesung
  19.09.2026).
- **Gegenstandswert eines veredelten Rohstoffs** im Craft-Fenster (T5-Stoff
  am Weber): die App rechnet die Gebühr aus der Zutatensumme 31, der Dump
  nennt 32; 0,45 Silber je Stück bei Satz 400 (v3.17.0).
- Gebäude für Reittiere und Belagerungsbanner, Gebühr der Items ohne
  Kategorie (v3.8.3, „Offen, nicht geraten“).

**Ideen für später** (aus `kostenrechner-PLAN.md` Abschnitt 8; Backlog alt)

- Im Kostenrechner mehrere Städte vergleichen, getrennte Rollen für
  Einkaufen, Craften, Verkaufen (in „Veredeln leveln“ seit v3.10.0);
  Transportkosten, Gewicht, Reise- und Schwarzzonen-Risiko; Vergleich
  mehrerer Fertigungsstädte (v3.10.0).
- Markttiefe über `history` statt nur Bestpreis (Mischkalkulation bei
  Massenbedarf).
- Einkaufsliste über mehrere Items hinweg im Kostenrechner („ich brauche
  ein komplettes Set“).
- Wartezeit und Ausfallrisiko eigener Kauf- und Verkaufsorders.
- Craft-Fame und Spezialisierungsaufbau als Nutzen.
- Ernte, Farmen, Inseln.
- Mengenrabatt durch ganze Chargen (v1 rechnet stetig, Plan 4.4).
- Abrufschichten von Preisvergleich und Eintopf-Rechner mit `preise.js`
  zusammenlegen (`OPTIMIERUNG-PLAN.md` Abschnitt 6).

## Browser-Vorschau

- Server: `..\.claude\launch.json`, Eintrag `kostenrechner-static`, startet
  `no_cache_server.py` auf Port 8791 (ein gewöhnlicher `http.server`
  lieferte wiederholt veraltete `js`-Dateien aus).
- **`localhost` statt `127.0.0.1`** als Navigationsziel; `127.0.0.1` wurde
  vom Vorschau-Werkzeug schon verweigert.
- Bei Zweifel an einer Testzahl im Browser: die Assertion-Logik aus
  `tests/test.html` in Node gegen die Dateien auf der Platte laufen lassen,
  das ist cachefrei.
