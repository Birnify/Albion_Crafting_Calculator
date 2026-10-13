# Kontext: Albion Kostenrechner

Stand: 2026-10-13 · Version: v3.10.2 · Veredeln leveln: Preis je Stadt im Tooltip

> Diese Datei ist die **einzige Quelle für eine frische Session**: aktueller Stand,
> Fachlogik der App, Dateistruktur, Arbeitsweise, offenes Backlog. Zu Beginn jeder
> Arbeit an diesem Projekt vollständig lesen.
>
> Der **Auftrag** steht in `kostenrechner-PLAN.md` und ändert sich kaum. Die
> **Spielregeln und belegten Formeln** stehen in `CLAUDE.md`. Diese Datei hier
> beschreibt, wie weit die Anwendung ist.

## Was ist das?

**Seit v3.5.0 eine App mit fünf Bereichen** (v3.2.0 bis v3.4.1 vier, bis v3.1.11 drei) ("Albion Werkzeuge", sichtbarer
Titel in der Oberfläche, Ordner-/Repo-Name bleibt bewusst `Kostenrechner`, s.
Nutzer-Entscheidung unten): oben eine Reiterumschaltung
(Kostenrechner/Eintopf-Rechner/Preisvergleich/Schnelles Geld/Veredeln leveln, `js/tabs.js`). Jeder Bereich
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
vor App-Fusion)/`, s. `EINTOPF-KONTEXT-ARCHIV.md`), nicht gelöscht, aber kein aktives
Arbeitsziel mehr. Die App-Fusion (Pakete A-E) ist damit vollständig
abgeschlossen.

**Bereich 3, Preisvergleich** (seit v3.0.0 migriert): beliebige Items aus dem
kompletten ao-bin-dumps-Namensdump suchen, mehrere auswählen, Live-Preise über
alle 7 Hauptstädte und alle 5 Qualitätsstufen abrufen. Kein Bezug zum
Rezeptbaum, reine Marktabfrage. Migriert 1:1 (Rechenlogik unverändert) aus dem
ehemals eigenständigen Eintopf-Rechner (dort seit 13.09.2026 im Einsatz), s.
Abschnitt "Aktueller Stand" unten für Details.

## Ablesung festgehalten (19.09.2026, nur Dokumentation, keine Codeänderung)

Sören hat zehn Screenshots aus dem Spiel geschickt: die Fenster
"Foliant-", "Fackel-" und "Schild-Handwerksspezialisierung" sowie vier
Ausschnitte der "Alchemist-Handwerksspezialisierung". Zwei belegte Befunde
daraus, beide in `AUDIT-2026-09-13.md` mit voller Zuordnungstabelle:

- **Nebenhände haben drei getrennte Bäume, nicht einen** (Foliant, Fackel,
  Schild), mit je sechs Knoten. Die 18 decken die 18 abgeleiteten
  `offhand`-Gruppen exakt ab. Damit ist der erste der beiden Blocker von
  Audit-Befund 11 weg.
- **Der Alchemisten-Baum hat 16 Knoten**, nicht die im Wiki gelesenen 8. Sie
  decken alle 15 `potion`-Gruppen ab, plus einen eigenen Knoten **Alkohol**.
  Die bisherige Einsortierung von `ALCOHOL` unter "Kochzutaten" im Koch-Baum
  ist damit widerlegt.

**Bewusst noch nichts umgesetzt.** Beiden Bäumen fehlt der Mutual-Wert, und
ohne ihn wäre jede Knotenliste eine Zahl, die schlechter rechnet als der
Freitext-Fallback: bei den Tränken ergäbe 16 Knoten mit dem bisherigen Mutual
30 einen Endwert von 76.000 FCE gegen die 52.000 aus dem Wiki. Erbeten
(19.09.2026): das Details-Panel je eines Trank- und eines Schild-Knotens, ein
Bild der Ebene darüber wegen des Meisterschaftsknotens, und das
Kampfhandschuh-Fenster, von dem es gar kein Bild gibt.

Selbsttest nach der Doku-Änderung: **446/446 grün**, unverändert.

---

## Nachtrag v3.10.2 (13.10.2026): Veredeln leveln, Preis je Stadt im Tooltip

Nutzerwunsch: beim Hover über den Einkaufspreis sehen, was die Zutat in jeder
angehakten Einkaufsstadt kostet ("vielleicht kostet es da, wo ich bin, nur 2
Silber mehr"), statt des langen Erklärtextes. Gilt nur bei mehr als einer
angehakten Einkaufsstadt, sortiert vom günstigsten: "Bridgewatch: 88 ✓,
Martlock: 95 (+7), Lymhurst: 100 (+12), Caerleon: kein Preis". Basis ist der
Preis ohne Einstellgebühr, eigene Preise zählen mit. Gleiches beim
Verkaufserlös (bei mehr als einer Verkaufsstadt): Netto-Erlös je Stadt, bester
zuerst, Abstand zur gewählten. `einkaufWaehlen`/`verkaufWaehlen` liefern dafür
zusätzlich `alle`. Bei nur einer Stadt bleibt ein kurzer Tooltip. Tests 621/621.

## Nachtrag v3.10.1 (13.10.2026): Veredeln leveln, Darstellungsfixes

Inline nach Sichtprüfung des Hauptagenten. Lange Zutatennamen (z. B.
"Ungewöhnliche Bernstein-Baumwolle") liefen in das Preisfeld; `.vd-zname`
bricht jetzt um. "verkauft/Tag" mit Tausenderpunkt (`toLocaleString("de-DE")`).
Stationssatz-Felder in einem zweispaltigen Raster, die Eingabefelder stehen
bündig untereinander. Keine Rechenänderung, Tests 619/619.

## Nachtrag v3.10.0 (13.10.2026): Veredeln leveln, Handelsstädte und neues Layout

Wunsch von Sören (per /define-feature bestätigt, Design-Entwurf freigegeben):
Einkauf, Fertigung und Verkauf in verschiedenen Städten, übersichtlichere
Oberfläche mit Albion-Icons.

- **Rechnung** (`js/veredeln.js`, reine Funktionen): mehrere Einkaufsstädte,
  mehrere Verkaufsstädte, genau eine **Fertigungsstadt**. Die Fertigungsstadt
  geht als `opts.stadt` in den Rechenkern (Stadtbonus +0,40 nur für ihre
  Warengruppe, Rückgewinnung, Stationssatz). Je Zutat die günstigste
  angehakte Einkaufsstadt (`einkaufWaehlen`: Sofortkauf `sell_price_min`,
  Kauforder `buy_price_max`, Höchstalter wie im Rechenkern, eigene Preise der
  jeweiligen Stadt zählen mit, Gleichstand: erste Stadt). Die Kosten sind je
  Zutat getrennt (Preis × Menge), die günstigste Stadt je Zutat ist deshalb
  die günstigste Kombination. Je Produkt die Verkaufsstadt mit dem höchsten
  Netto-Erlös (`verkaufWaehlen` über `REGELN.erloesJeStueck`).
  verkauft/Tag kommt aus der gewählten Verkaufsstadt. Eine Zeile je Vorgang
  (vorher eine je Vorgang und Stadt).
- **Höchstpreis** unverändert linear, bezieht sich auf die **gewählte
  Einkaufsstadt** bei sonst festen Preisen. Liegt er über dem Preis einer
  anderen angehakten Stadt, würde dort gekauft (Gegenprobe als Test).
- **Nicht modelliert:** Transportkosten, Gewicht, Reiserisiko (Tooltip an
  „Einkauf in“, „Verkauf in“ und den Stadtschildern). Kein Vergleich
  mehrerer Fertigungsstädte.
- **Migration:** alte Liste `staedte` wird zu Einkauf = Verkauf = diese
  Städte, Fertigung Lymhurst falls angehakt, sonst die erste
  (`einstellungenBereinigen`). Neue Vorgabe: alles Lymhurst. Neues Feld
  `sortierung` (Vorgabe Marge).
- **Premium geteilt:** `UI.premiumSetzen()` und Ereignis `albion:premium`,
  Muster wie Stationssätze/Tagesbonus; der Kostenrechner meldet seine
  Änderung ebenfalls.
- **Oberfläche nach Entwurf:** drei Karten (Was veredeln, Wo handeln, Wie
  rechnen), Rohstoff-Kacheln mit Icon, Tier/Verzauberung als gleich große
  Chips, Fertigungsstadt mit Bonus-Schild und „Rückgewinnung 36,7 %“ (je
  Rohstoff, falls verschieden), Stationssätze der angehakten Rohstoffe,
  Städte als Chips, vier Schalter (Einkauf, Verkauf, Fokus, Premium),
  Tagesbonus mit fünf Icons, „Weitere Einstellungen“ zugeklappt. Ein Knopf
  „Gelegenheiten suchen“ ruft immer frisch ab (`erzwingen: true`, Städte
  nacheinander wie bisher); „Preise aktualisieren“ entfällt. Tabelle:
  Produkt, Einkauf je Vorgang (feste Spalten, Preisfeld wie Text, eigener
  Preis gold mit rotem ×), Verkauf, Kosten/Stück, Gewinn/Stück, Marge,
  Gewinn gesamt; Sortierung per Klick auf die Köpfe. Stadtschilder nur bei
  mehr als einer angehakten Stadt. Rundungen als `--r`/`--r-tag`/`--r-card`.
  Icons von `render.albiononline.com/v1/item/<ID>.png?size=…` (ID mit
  `_LEVELn`, geprüft: liefert das verzauberte Bild), lazy, fester Platz.
- **Nachrechnen ohne Abruf** jetzt auch bei Fertigungsstadt, Premium,
  Sortierung und bei verkleinerter Auswahl (Städte, Rohstoffe, Tier, Stufe),
  solange die Daten der letzten Suche reichen; sonst Hinweis im Status.
- **App-weit:** `.wrap` fluid bis 1440 px, Reiterleiste bricht um, Ränder
  16 px unter 600 px. Leerer waagerechter Scrollbalken unter „Schnelles
  Geld“: der Rahmen `.ch-tabellenrahmen` scrollte selbst, und die goldenen
  Eckklammern der `.gp-panel` ragen 1 px hinaus; jetzt scrollt nur der
  Inhalt. Kostenrechner bei 390 px war 597 px breit (`.klein-tbl` erbte
  `min-width:560px`), behoben. Gemessen: alle fünf Reiter bei 1920, 1280 und
  390 px ohne Seitenscrollbalken, waagerecht scrollen nur echte Tabellen.
- Selbsttest **619/619** grün (vorher 601; 18 neu, 6 bestehende
  Veredeln-Tests auf das Stadtmodell umgestellt). Headless mit Live-Preisen
  durchgeklickt; eine Zeile von Hand nachgerechnet (Guter Stoff T4.0
  Lymhurst: (2 × 100 + 175) / 1,58 + 7,2 = 245, Erlös 496 × 0,935 = 464,
  max. Hanf 100 + 219 / 1,266 = 273).

**Abweichungen vom Entwurf:** Sortierung voreingestellt nach Marge (wie
bisher), nicht Gewinn gesamt; „etwa Null“ gold statt rot; Fokus je Vorgang
klein unter den Kosten und verkauft/Tag unter dem Verkauf (im Entwurf nicht
vorhanden, Information bleibt erhalten); Ausbeute beim Stein als Tooltip am
Tier; kein Erklärtext unter der Tabelle (Nutzer-Nachtrag), nur Tooltips;
Schalter-Text darf umbrechen statt abgeschnitten zu werden.

## Nachtrag v3.9.1 (13.10.2026): Tagesbonus gilt in allen Städten

Nutzerbeleg (Sören, im Spiel beobachtet): der Tagesbonus auf die
Rückgewinnung ist **nicht stadtspezifisch**, er gilt in allen Städten gleich.
Ersetzt die Aussage „rotiert je Stadt“ in `CLAUDE.md` (beide Kopien) und im
Plan (Abschnitt 9, Punkt 6, mit Korrekturvermerk).

- **Veredeln leveln:** die Tabelle Stadt × Rohstoff ist ersetzt durch eine
  Zeile „Tagesbonus (gilt in allen Städten)“, je Rohstoff aus / 10 % / 20 %,
  mehrere gleichzeitig möglich. Der Wert gilt in jeder Stadt
  (`zeilenRechnen` nimmt `einstellungen.tagesbonus`, nicht mehr je Stadt).
- **Eine gemeinsame Einstellung:** der Kostenrechner führte den Tagesbonus
  schon immer ohne Stadt (`einstellungen.tagesbonus`, cc → silber/gold), und
  „Schnelles Geld“ liest denselben Wert. Der Reiter nutzt jetzt genau diese
  Einstellung, Abgleich wie bei den Stationssätzen: `UI.tagesbonusSetzen()`
  speichert und meldet per Ereignis `albion:tagesbonus`, der Kostenrechner
  übernimmt den einen Wert in seinen Arbeitsspeicher, der Reiter zieht bei
  Änderungen im Kostenrechner nach. `rechenkern.js`/`regeln.js` unverändert
  (dort war der Bonus nie stadtabhängig).
- **Migration:** ein alter Stand `tagesbonus` (Stadt → Rohstoff) im
  Reiter-Speicher wird beim Laden einmalig übernommen, je Rohstoff der
  **höchste** Wert über alle Städte (`VEREDELN.tagesbonusAusAltstand`).
  Begründung: jeder Eintrag war eine Ablesung desselben Bonus; die alte
  Tabelle zeigte jede angehakte Stadt, gepflegt wurde meist nur eine, ein
  „aus“ heißt also eher „nicht eingetragen“. Der Altstand ersetzt einen
  Kostenrechner-Wert derselben Kategorie (seit v3.6.0 wurde der Bonus für
  diese fünf Rohstoffe im Reiter gepflegt, der Kostenrechner-Wert dort
  ignoriert); Rohstoffe ohne Altstand behalten den Kostenrechner-Wert.
  `einstellungenBereinigen` führt kein Feld `tagesbonus` mehr, der
  Reiter-Speicher wird danach ohne das Feld zurückgeschrieben.
- Selbsttest **601/601** grün (vorher 594; der Test für
  `tagesbonusBereinigen` ersetzt, 8 neu: Faser 20 % ergibt Lymhurst
  B = 0,78 und Martlock/Caerleon B = 0,38, mehrere Rohstoffe, Altstand wirkt
  nicht mehr, Migration samt Vorrangregel, Ereignis, aus). Headless
  durchgeklickt mit Live-Preisen: Migration (Lymhurst Silber, Martlock Gold
  → Gold), Rückgewinnung 43,8 % / 27,5 %, Umschalten in beiden Reitern
  wirkt im jeweils anderen, Reload behält den Stand, 390 px bricht um.

## Nachtrag v3.9.0 (13.10.2026): Veredeln leveln, eigener Preis und Höchstpreis

Wunsch von Sören: nach der Entscheidung für einen Vorgang kauft er die Zutat,
der Preis steigt dabei; er will sehen, wie viel Gewinn bis zu welcher
Preisgrenze bleibt.

- **Einkaufspreis je Zutat überschreibbar.** In der Spalte „Einsatz je
  Vorgang, Einkaufspreis“ ist der Preis ein Eingabefeld (Wert ohne
  Einstellgebühr, wie im Marktfenster). Die Zeile rechnet sofort neu. Eigene
  Preise: goldener Rahmen, ✕ je Feld, Knopf „Eigene Preise zurücksetzen (n)“,
  Tooltip mit dem aktuellen Marktpreis. Leer oder ≤ 0 setzt zurück.
- **Entscheidung, Verhältnis zu den vorhandenen Mechanismen:** eigenes,
  kleines Speicherfeld `preisUeberschreibungen` (Stadt → Markt-ID → Silber) im
  Reiter-Speicher `albion_kostenrechner_veredeln_v1`. Keine Wiederverwendung,
  weil keiner der beiden Kostenrechner-Wege passt: die Eigenpreise
  (`PREISE.eigenpreis*`, „kein Eigenpreis“-Felder) greifen nur, wenn GAR kein
  Marktpreis da ist; die Preisübersteuerungen (`einstellungen.
  preisUebersteuerungen`) sind stadtunabhängig und ein fester Kaufpreis ohne
  Einstellgebühr. Der eigene Preis wird als Marktpreis in `opts.preise`
  eingesetzt (beide Seiten, ohne Datum), gilt je Stadt und Markt-ID in allen
  Zeilen und wirkt nur auf den Einkauf; der Erlös rechnet weiter mit dem
  Markt. Bei eigener Kauforder ist er der Orderpreis, die 2,5 % kommen
  obendrauf. **„Preise aktualisieren“ lässt eigene Preise stehen**, bis sie
  zurückgesetzt werden; der Tooltip zeigt den frischen Marktpreis daneben.
- **Höchstpreis je Zutat** („max. 1.236“, rot bei Verlust, „kein Preis
  reicht“ wenn ≤ 0): Preis, bei dem der Gewinn der Zeile auf 0 fällt, alle
  anderen fest. Lineare Herleitung, belegt: mit `nurDirekteEbene` wird jede
  Zutat gekauft (Kosten = Preis × Kauffaktor), die Rückgewinnung ist ein
  fester Mengenfaktor, die Gebühr hängt am Gegenstandswert. Also
  `p* = p0 + Gewinn / (effektiveMenge × Kauffaktor)` (`VEREDELN.hoechstpreis`).
  Selbsttests setzen p* über den echten Rechenkern ein (Sofortkauf, Kauforder,
  Kauf- und Verkaufsorder, Verlustfall) und prüfen Gewinn ≈ 0 sowie die
  Linearität an drei Punkten. Live gegengerechnet: Seltener Hanf 1.198,
  Gewinn 49/Stück, 2 × (1 − 0,367) → 1.198 + 49 / 1,266 = 1.236.
- **Stationssätze im Reiter** für die angehakten Rohstoffe (Weber, Sägewerk,
  Schmelze, Steinmetz, Gerberei), je 100 Nahrung. Dieselbe Einstellung wie im
  Kostenrechner: `UI.stationssatzSetzen()` schreibt `einstellungen.
  stationssaetze` und meldet per Ereignis `albion:stationssaetze`; der
  Kostenrechner übernimmt den einen Satz in seinen Arbeitsspeicher (sonst
  würde er beim nächsten Speichern den alten Stand zurückschreiben), der
  Reiter zieht umgekehrt nach. 0 ist erlaubt, leer ändert nichts. Fehlt ein
  Satz, sagt die Fußzeile „mit 0 gerechnet“.
- **Nachrechnen ohne Abruf:** die Suche legt Preise und Handelsvolumen je
  Stadt ab (`daten`), `VEREDELN.zeilenRechnen()` baut daraus die Zeilen.
  Neu gerechnet wird bei eigenem Preis, Stationssatz und jetzt auch bei
  Einkauf, Verkauf, Fokus, Zusatzbonus und Tagesbonus (vorher erst beim
  nächsten Suchen). Städte/Rohstoffe/Tier/Stufe brauchen weiter eine Suche.
- Selbsttest **594/594** grün (vorher 574, 20 neue). Headless mit
  Live-Preisen (Lymhurst, Faser T4–T6) durchgeklickt, auch bei 390 px.

**Nebenbefund, nicht behoben:** bei 390 px Breite ist die Seite 601 px breit,
die Reiterleiste bricht nicht um (auch schon in v3.8.3 so gemessen).

**Ältere Nachträge (v3.8.3 bis v3.1.7)** am 13.10.2026 unverkürzt nach
`kostenrechner-KONTEXT-HISTORIE.md` verschoben (Schlankheitsregel).

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
`AUDIT-2026-09-13.md` Befund 5/6/10/12) plus Befund 7+8 (v3.1.5,
`js/regeln.js` (istQualifizierbar(), stationsgebuehrGiltFuerTier()) +
`js/rechenkern.js` (kostenBeiQualitaet()/craftKandidat()/
craftBeiQualitaetKandidat()) + `js/ui.js` (renderHero()-Hinweis) +
`tests/test.html` (20 neue Tests) geaendert, s. "Aktueller Stand" und
`AUDIT-2026-09-13.md` Befund 7/8):

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
    chancen.js                neu v3.2.0, Reiter "Schnelles Geld": Knotenliste je Gebaeude
                              (aus REGELN.spezialisierungsGruppen), Kandidaten je Stufe und
                              Qualitaet, Erloes nach Steuer/Einstellgebuehr, Absatz je Tag
                              aus PREISE.absatzAbrufen, Filter und Sortierung,
                              CHANCEN.selbsttest(); rechnet ueber RECHENKERN.kosten mit
                              opts.nurDirekteEbene und den Einstellungen des Kostenrechners
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
                              RET_OHNE/RET_MIT/ORDERGEB/FEFF unveraendert aus CLAUDE.md;
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
                              Kombination in rechenkern.js) v3.1.4; neue Funktionen
                              stationsgebuehrGiltFuerTier() (T1/T2 gebuehrenfrei) und
                              istQualifizierbar() (Speisen/Traenke/Werkzeuge ausser Angelrute
                              nicht qualifizierbar) v3.1.5, s. AUDIT-2026-09-13.md Befund 7/8;
                              neue Funktion istEchterKnoten() (Veredelungsknoten erst ab T4),
                              wirkt in spezialisierungsGruppen() UND im Mutual-Anteil von
                              fceAusSpezialisierungsknoten() v3.1.7, s. Befund 4):
                              itemWert, RRR, Stationsgebuehr
                              (mit 0-Floor), Fokus (mit 0-Floor), Steuer, Kategorie-Tabellen,
                              rezepteFuerStufe, qualitaetWurfErfolgswahrscheinlichkeit()/
                              qualitaetsVerteilung()/rerollKostenZuQualitaet(),
                              Spezialisierungsknoten-Ableitung (v1.5.0/v1.5.1/v3.1.3/v3.1.4/v3.1.7).
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
                              s. AUDIT-2026-09-13.md Befund 10. craftKandidat()/
                              craftBeiQualitaetKandidat() setzen die Stationsgebuehr bei T1/T2
                              auf 0, kostenBeiQualitaet() delegiert fuer nicht qualifizierbare
                              Items direkt an kostenGesamt() v3.1.5, s. Befund 7/8. Unveraendert
                              seit v3.1.5.
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
                              v3.1.4; renderHero() zeigt einen Hinweis, wenn die eingestellte
                              Zielqualitaet fuer das gewaehlte Item ignoriert wird (nicht
                              qualifizierbar) v3.1.5, s. AUDIT-2026-09-13.md Befund 7):
                              Suche mit Tastaturbedienung, Rendering, Einstellungen, Eigenpreis-
                              Pflegeansicht (P6), baueKnoten()/eigenerKandidat() (v1.3.0)
  kostenrechner-PLAN.md
  kostenrechner-KONTEXT.md
  kostenrechner-KONTEXT-HISTORIE.md
  CLAUDE.md                 neu v3.1.6, konsolidierte, ans Repo angepasste Kopie der
                              Root-CLAUDE.md (Spielregeln/-formeln), s. "Aktueller Stand"
  EINTOPF-KONTEXT-ARCHIV.md neu v3.1.6, Kopie der historischen Eintopf-Rechner-
                              Fachdokumentation (vorher nur als ../KONTEXT.md erreichbar)
  AUDIT-2026-09-13.md       Code-Audit gegen das offizielle Wiki, mit Umsetzungsstatus
                              je Befund (s. Kopfzeile der Datei)
  .claude/agents/           neu v3.1.6 ins Repo kopiert (vorher nur lokal eine Ebene
                              hoeher): albion-cycle-orchestrator.md, rechenkern-pruefer.md,
                              spieldaten-pruefer.md, oberflaechen-pruefer.md
  .claude/skills/define-feature/ neu v3.1.6 ins Repo kopiert, s. oben
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
  Versionen/v3.1.5 - Befund 7 und 8, Qualitaet ignoriert und T1-T2 gebuehrenfrei/
  Versionen/v3.1.6 - Repo fuer Claude Projects eigenstaendig gemacht/
  tests/test.html           441 Tests (433 bisherige + 8 neu fuer die Bezugsgroesse des
                              Dump-Fokus, Audit-Befund 1, v3.1.10; 408 davon + 25 fuer Global
                              Discount und die neun Kochknoten, v3.1.8/v3.1.9;
                              396 davon + 12 fuer istEchterKnoten() und die
                              Knotenzahl je Veredelungskette, v3.1.7; dabei ein bestehender
                              Fokus-Regressionsanker von 1.087,45 auf 1.099,71 gezogen, s.
                              "Aktueller Stand"; 377 davon + 19 fuer istQualifizierbar()/
                              stationsgebuehrGiltFuerTier() und deren Integration, v3.1.5;
                              338 davon + 33 neu fuer shapeshifterstaff/
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
5. **ERLEDIGT 29.09.2026 (v3.3.0), s. Nachtrag oben.** Knopf zum voruebergehenden Ausschalten des Fokuseinsatzes. Nutzer-
   Wunsch (06.09.2026): eine Moeglichkeit, die Fokusnutzung fuer die
   Berechnung komplett und temporaer abzuschalten (nicht dauerhaft in den
   Einstellungen aendern). Noch nicht spezifiziert, ob das global (ein
   Schalter fuer die ganze Berechnung) oder je Knoten gemeint ist - die App
   hat bereits einen Fokus-Schalter je Knoten (`automatisch/immer/nie`, s.
   `fokus-schalter`-Klasse), ein GLOBALER Kurzschalter fehlt aber. Vor der
   Umsetzung klaeren, ob "automatisch" als Ausgangszustand gemeint ist oder
   der zuletzt gewaehlte Zustand je Knoten erhalten bleiben soll, wenn der
   Schalter wieder aus geht.
6. **ERLEDIGT 19.09.2026: "Reine Craften-Pfade in Alle Wege liefern
   astronomische Werte" war KEIN Rechenfehler, nur eine fehlende Angabe in
   der Beschriftung.** Diagnose in einem Projekt-Thread, die App dafuer
   offline in Node und headless im Browser gegen synthetische Preise
   laufen gelassen (Netzzugriff auf die Preis-API ist aus einem
   Cloud-Thread gesperrt, s. unten).

   **Ursache:** sobald die Zielqualitaet ueber Normal steht, multipliziert
   `craftBeiQualitaetKandidat()` in `js/rechenkern.js` Silber UND Fokus mit
   `erwarteteVersuche = 1 / Erfolgswahrscheinlichkeit`. Bei Exzellent und 0
   Chancenpunkten sind das 90,9 Versuche. Verzaubern traegt diesen Faktor
   nicht (kein Qualitaetswurf, es erbt die Qualitaet der Vorstufe), daher der
   beobachtete Faktor 30-70. Reproduziert: 52.236 Silber / 7.401 Fokus je
   Versuch, mal 90,9 ergibt 4.748.685 Silber / 672.782 Fokus, dieselbe
   Groessenordnung wie im urspruenglichen Bericht.

   **Zwei Annahmen des urspruenglichen Berichts sind widerlegt:** (a) die
   "Craften #N"-Zeilen erzwingen das Craften NICHT auf jeder Ebene, sondern
   nur an der Wurzel; die Zutaten nehmen weiter ihren guenstigsten Weg
   (`kind = kindErgebnis.beste`). Gegenprobe: senkt man den Marktpreis des
   verzauberten Barrens, kippt die Zutat in derselben Zeile von Craften auf
   Kaufen. (b) Die identischen Fokuswerte bei einem anderen Item sind zu
   erwarten und kein Indiz: alle T4-Plattenruestungen haengen an derselben
   Kette aus 16 Barren, und die Artefakt-Zutat kostet selbst keinen Fokus
   (SET1, SET3 und UNDEAD ergeben alle 7.401 Fokus).

   **Umgesetzt:** neue Hilfsfunktion `qualitaetsZusatzKurz()` in `js/ui.js`,
   angehaengt in `wegLabelKurz()` und (nur bei einheitlichem Zusatz ueber
   alle Mitglieder) in `wegGruppenLabel()`. Die Zeile heisst jetzt
   "Craften #1, mit Fokus, erwartet 90,9 Versuche" bzw. bei der seit v3.1.4
   kombinierten Strategie "Craften #1, mit Fokus, ein Versuch + Reroll".
   Wortlaut bewusst identisch zur Bauplan-Detailzeile und zum Tooltip, wo
   die Zahl schon vorher stand. Bei Zielqualitaet Normal bleibt die
   Beschriftung unveraendert. Keine Rechenlogik angefasst.

**Kleinere offene Punkte, unverändert seit früheren Paketen:**

- ERLEDIGT v3.10.0: Reiterleiste bricht um, keine Seitenscrollbar bei 390 px.
- Wartezeit/Füllrisiko eigener Orders und Transport zwischen Städten sind im
  Reiter „Veredeln leveln“ nicht modelliert (nur Tooltip).

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

- (Im Reiter „Veredeln leveln“ seit v3.10.0 umgesetzt, im Kostenrechner
  nicht.) Mehrere Staedte gleichzeitig vergleichen, getrennte Rollen je
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
