# Kontext: Albion Kostenrechner

Stand: 2026-09-19 · Version: v3.1.11 · Schicksalsbrett-Ablesung für Nebenhände und Alchemist festgehalten (nur Dokumentation, Code unverändert)

> Diese Datei ist die **einzige Quelle für eine frische Session**: aktueller Stand,
> Fachlogik der App, Dateistruktur, Arbeitsweise, offenes Backlog. Zu Beginn jeder
> Arbeit an diesem Projekt vollständig lesen.
>
> Der **Auftrag** steht in `kostenrechner-PLAN.md` und ändert sich kaum. Die
> **Spielregeln und belegten Formeln** stehen in `CLAUDE.md`. Diese Datei hier
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

## Aktueller Stand (v3.1.10, Audit-Befund 1 behoben: Fokus-Grundwert gilt je Stück, 19.09.2026)

**Auftrag:** Audit-Befund 1 entscheidungsreif machen und, sobald die Ablesung
da ist, umsetzen. Die Frage war, ob `craftingfocus` aus dem Client-Dump den
Grundfokus je Charge oder je Stück meint; bei `amountcrafted=10` ein Faktor 10.

**Die Ablesung, die es entschieden hat: Steinmetz statt Schicksalsbrett.**
`T4_STONEBLOCK` hat vier Rezepte mit identischem `f=54` und `amountcrafted`
1/2/4/8 (verzauberter Stein liefert mehr Blöcke, verzauberte Steinblöcke gibt
es nicht als eigene Items). Dasselbe Item, derselbe Spezialisierungsknoten,
dieselbe FCE, die eigene Spezialisierung kürzt sich also vollständig heraus.
Nutzerablesung: "2 Blöcke brauchen doppelt so viel Fokus wie ein Block."
Damit gilt der Dumpwert **je Stück**, der Rohfokus eines Craft-Vorgangs ist
`craftingfocus x amountcrafted`. Die Schicksalsbrett-Screenshots aus dem
v3.1.9-Zyklus sagen unabhängig davon dasselbe (FCE zwischen 31.300 und 34.300,
"je Stück" verlangt 34.242, "je Charge" verlangt 1.022 und ist in dem Bereich
nicht erreichbar).

**Umgesetzt** (`js/rechenkern.js`, `Kostenrechner.html`, `js/regeln.js`,
`js/eintopf-rechenkern.js`, `tests/test.html`, `CLAUDE.md`,
`AUDIT-2026-09-13.md`):

- `craftKandidat()` und `craftBeiQualitaetKandidat()` rechnen `fokusJeStueck`
  ohne die Division durch `amountcrafted`.
- Beide melden `weg.grundfokus = rezept.f x amountcrafted`. Das Feld füttert den
  Umrechner "FCE aus abgelesenem Fokus" in `js/ui.js`, und das Craft-Fenster
  zeigt den Wert des ganzen Vorgangs. Ohne diese Multiplikation lieferte der
  Umrechner bei Speisen/Tränken/Steinblöcken eine um Faktor `amountcrafted` zu
  kleine FCE; genau das war der innere Widerspruch zwischen den zwei
  FCE-Eingabewegen, den das Audit beschrieben hat.
- Fokus-Tooltip in `Kostenrechner.html`, zwei Selbsttest-Bezeichnungen in
  `js/regeln.js` (2.192 von 23.530 statt von 2.353) und der Kommentar bei
  `FEFF` in `js/eintopf-rechenkern.js` nachgezogen.
- `CLAUDE.md`: Abschnitt "Spielerprofil" und "Achtung, Bezugsgröße" neu
  geschrieben, Wertetabelle korrigiert. Die belegte Ablesung 2.192 bleibt
  unverändert, nur ihre Bezugsgröße ändert sich: **FCE 34.242** statt 1.022,
  Fokus-Effizienz **9,32 %** statt 93,16 %.

**Der Eintopf-Reiter bleibt rechnerisch unberührt**, nur der Kommentar wurde
präzisiert. Er multipliziert den Dumpwert mit `FEFF = 2192/2353` und behandelt
das Ergebnis als Fokus je Charge; `f x (2192/2353)` ist identisch mit
`f x 10 x (2192/23530)`, die beiden Lesarten kürzen sich dort heraus, weil
`FEFF` direkt gegen die Messung geeicht ist.

**Testlücke geschlossen, das war der eigentliche Befund unter dem Befund.** Vor
dem Fix deckte kein einziger Test die Bezugsgröße ab: eine Probeänderung auf die
andere Lesart ließ die Suite unverändert grün. Acht neue Tests pinnen jetzt
beide Codestellen (normaler und Qualitäts-Craftweg), den Gleichstand bei
`amountcrafted=1` und die Gegenprobe gegen den echten Dump.

**Wirkung:** 313 von 13.010 Rezepten im Graphen rechneten den Fokus zu billig,
davon 120 Speisen (`a=10`), 172 Tränke (`a=5`/`a=10`), 15 Steinblöcke
(`a=2/4/8`) und 6 Tierhaltungsrezepte (`a=18`). Ausrüstung, Barren, Bretter,
Leder und Stoff haben durchweg `a=1` und waren nie betroffen. Silberkosten
ändern sich nirgends, nur Fokus.

**Hinweis für den Nutzer:** wer die FCE bisher über den Umrechner aus der
Ablesung 2.192 gesetzt hatte, hat 1.022 im Feld stehen und muss auf **34.242**
ziehen (oder den Umrechner erneut aufrufen, der holt sich den Grundfokus jetzt
richtig). Sonst werden Speisen und Tränke um `amountcrafted` zu teuer
gerechnet.

**Getestet:** `tests/test.html` zweimal ausgeführt, in Node gegen die Dateien
auf der Platte und headless über Chromium, beide Male **441/441 grün** (433
bisherige plus 8 neue).

---

## Aktueller Stand (v3.1.9, die neun echten Kochknoten, 19.09.2026)

**Auslöser:** Sören hat drei Screenshots des Fensters
"Koch-Handwerksspezialisierung" geschickt. Damit war die Knotenfrage für
Speisen entschieden, die vorher nur als "braucht eine Ablesung" offen stand.

**Die neun Knoten, in Fensterreihenfolge:** Suppen, Salate, Pasteten, Braten,
Omelette, Eintöpfe, Sandwiches, Kochzutaten, Fleisch. Die App leitete dafür
bisher 25 Gruppen ab.

**Umgesetzt (Audit-Befund 4, Speisen-Teil):**

- `js/regeln.js`: neue Tabelle `SPEZ_KNOTEN` (bisher nur `food`) mit den neun
  Knoten, ihren Anzeigenamen und den Präfixen des tierlosen
  Gruppenschlüssels. Bewusst Präfixe statt fester Item-Listen: künftige
  Varianten (`MEAL_STEW_IRGENDWAS`) wandern damit automatisch in den richtigen
  Knoten, statt beim nächsten Dump-Lauf still zu verschwinden.
- Neue Tabelle `SPEZ_FAMILIE` plus `spezFamilieVonKategorie()`: mehrere
  `craftingcategory`-Werte können sich einen Schicksalsbrett-Baum teilen. Nötig
  für den Knoten "Fleisch", dessen Items `meat_chicken` bis `meat_sheep`
  tragen, im Spiel aber im Koch-Fenster stehen. Die Gebührengruppe bleibt
  davon unberührt (`meat_*` weiter unter "Tierhaltung").
- `gruppenSchluesselVonItem()`, `istEchterKnoten()` und
  `spezialisierungsGruppen()` arbeiten jetzt über die Knotenliste, wo es eine
  gibt. `spezialisierungsGruppen()` liefert sie in Fensterreihenfolge statt
  alphabetisch, damit sich das Panel neben dem Spielfenster abtippen lässt,
  und bringt den echten Knotennamen als `label` mit ("Suppen" statt
  "Möhrensuppe").
- `js/rechenkern.js`: `fceFuer()` bildet den Knotenschlüssel über die Familie,
  damit rohes Fleisch auf `food|FLEISCH` trifft.
- `js/ui.js`: zwei kleine Stellen. Das Panel nutzt das `label`, wenn es eines
  gibt, und die Liste der "verwendeten" Kategorien läuft über die Familie,
  damit rohes Fleisch im Bauplan das Speisen-Panel öffnet statt sechs eigener.

**Unabhängige Gegenprobe, als Test verankert:** das Wiki nennt 55.000 FCE als
Endwert des Kochbaums. Neun Knoten auf Stufe 100 plus Meisterschaft 100 ergeben
jetzt exakt `25.000 + 9 × 3.000 + 3.000 = 55.000`. Mit acht oder zehn Knoten
ginge das nicht auf, die Knotenzahl ist damit doppelt belegt.

**Bewusst ohne Knoten:** `T8_MEAL_SPECIAL_FOOD_DRAKE_EGG`
(Jungdrachenei-Kekse), im Fenster gibt es keinen passenden Knoten. Klein und
offen: ob `ALCOHOL` wirklich unter "Kochzutaten" hängt.

**Tränke bleiben offen**, dort fehlt derselbe Screenshot; die Wiki-Seiten
`Potion`/`Potions`/`Alchemist` liefern 403.

**Nebenbefund, wichtig und nicht Teil dieses Pakets: Audit-Befund 1 ist durch
dieselben Screenshots rechnerisch entschieden.** Aus den Stufen folgt
`FCE(Eintöpfe) = 31.300 + 30 × Meisterschaft`, also 31.300 bis 34.300. Die
Lesart "Dump-Fokus je Stück" verlangt 34.243 und passt, die Lesart "je Charge"
verlangt 1.022 und ist in diesem Bereich unerreichbar. Die Division durch
`amountcrafted` in `craftKandidat()` ist damit falsch; betroffen sind 120
Speise-, 172 Trank-, 15 Steinblock- und sechs Tierhaltungs-Rezepte. Umsetzung
steht aus, s. `AUDIT-2026-09-13.md` Befund 1.

**Getestet:** `tests/test.html` headless über Chromium/Playwright,
**433/433 grün** (419 bisherige, 14 neue für die Knotenliste, die
Familienzuordnung und die 55.000-Gegenprobe).

---

## Aktueller Stand (v3.1.8, Global Discount, 19.09.2026)

**Auftrag:** Sören hat nach dem Wiki-Nachschlag entschieden: "zieh die Daten
live und lass die Stationsgebühren einfach in Ruhe."

**Umgesetzt (Audit-Befund 9):**

- `js/regeln.js`: `GLOBAL_DISCOUNT_SCHWELLE` (3.000), `globalDiscount()` und
  `silberRabattFaktor()`. Formel wörtlich aus der Wiki-Seite
  `Global_Discount`: `(1 - Goldpreis / 3000) x 100 %`, aktiv unter einem
  Goldpreis von 3.000. `rerollKostenZuQualitaet()` nimmt den Faktor als
  vierten, optionalen Parameter; ohne ihn verhält sie sich unverändert.
- `js/rechenkern.js`: neues `opts.silberRabattFaktor` (Default 1), an beide
  Reroll-Aufrufstellen durchgereicht.
- `js/preise.js`: `goldpreisAbrufen()` gegen `/stats/gold.json?count=2` auf
  demselben Europa-Realm, mit derselben 429-Disziplin wie die übrigen Abrufe,
  plus die reine, offline testbare `normalisiereGoldAntwort()`.
- `js/ui.js`: der Goldpreis wird beim Preisabruf mitgezogen, in `zustand.gold`
  gehalten (nur Seitenspeicher, kein localStorage) und über
  `opts.silberRabattFaktor` in die Rechnung gegeben. Die Statuszeile nennt
  Goldpreis und Rabatt und sagt ausdrücklich, dass er auf die Reroll-Kosten
  wirkt.

**Bewusst NICHT auf die Stationsgebühr angewendet**, Nutzer-Entscheidung. Die
Wiki-Seite nennt als Silbersenken nur Reparatur, Transmutation und
Qualitätsverbesserungen; die Nutzungsgebühr geht an den Gebäudebesitzer.

**Fehlertoleranz ist hier der Kern:** das Antwortschema des Goldendpunkts ist
nicht dokumentiert (nur der Pfad selbst), und aus dem Cloud-Thread ist die API
nicht erreichbar, der Abruf konnte also nicht live geprüft werden. Deshalb
wertet `normalisiereGoldAntwort()` beide Schreibweisen aus und liefert bei
allem Unbrauchbaren `null`; der Faktor bleibt dann 1 und die App rechnet exakt
wie vorher. Ein erfundener Ersatz-Goldpreis wäre schlimmer als gar keiner.
**Im Browser gegenzuprüfen**, sobald Sören die Seite das nächste Mal öffnet:
ob die Statuszeile einen plausiblen Goldpreis nennt.

Ein Testfall hat dabei einen echten Fehler gefunden: `Number(null)` ist 0, und
ein Goldpreis von 0 bedeutet nach der Wiki-Skala 100 % Rabatt. Ohne die
ausdrückliche `null`-Prüfung hätte ein fehlgeschlagener Abruf also alle
Reroll-Kosten auf 0 gesetzt.

**Getestet:** `tests/test.html` headless über Chromium/Playwright,
**419/419 grün** (408 bisherige, 11 neue für Global Discount und
Goldpreis-Auswertung).

---

## Aktueller Stand (v3.1.7, Audit-Befund 4 für Veredeln behoben, 19.09.2026)

**Vorheriger Stand (v3.1.7, Audit-Befund 4 für Veredeln behoben)** unverkürzt
nach `kostenrechner-KONTEXT-HISTORIE.md` ausgelagert (Schlankheitsregel, s.
"Entwicklungsweise / Mitarbeit" unten).

**Auftrag:** Audit-Befund 1 entscheidungsreif machen und, sobald die Ablesung
da ist, umsetzen. Die Frage war, ob `craftingfocus` aus dem Client-Dump den
Grundfokus je Charge oder je Stück meint; bei `amountcrafted=10` ein Faktor 10.

**Die Ablesung, die es entschieden hat: Steinmetz statt Schicksalsbrett.**
`T4_STONEBLOCK` hat vier Rezepte mit identischem `f=54` und `amountcrafted`
1/2/4/8 (verzauberter Stein liefert mehr Blöcke, verzauberte Steinblöcke gibt
es nicht als eigene Items). Dasselbe Item, derselbe Spezialisierungsknoten,
dieselbe FCE, die eigene Spezialisierung kürzt sich also vollständig heraus.
Nutzerablesung: "2 Blöcke brauchen doppelt so viel Fokus wie ein Block."
Damit gilt der Dumpwert **je Stück**, der Rohfokus eines Craft-Vorgangs ist
`craftingfocus x amountcrafted`.

**Umgesetzt** (`js/rechenkern.js`, `Kostenrechner.html`, `js/regeln.js`,
`js/eintopf-rechenkern.js`, `tests/test.html`, `CLAUDE.md`,
`AUDIT-2026-09-13.md`):

- `craftKandidat()` und `craftBeiQualitaetKandidat()` rechnen `fokusJeStueck`
  ohne die Division durch `amountcrafted`.
- Beide melden `weg.grundfokus = rezept.f x amountcrafted`. Das Feld füttert den
  Umrechner "FCE aus abgelesenem Fokus" in `js/ui.js`, und das Craft-Fenster
  zeigt den Wert des ganzen Vorgangs. Ohne diese Multiplikation lieferte der
  Umrechner bei Speisen/Tränken/Steinblöcken eine um Faktor `amountcrafted` zu
  kleine FCE; genau das war der innere Widerspruch zwischen den zwei
  FCE-Eingabewegen, den das Audit beschrieben hat.
- Fokus-Tooltip in `Kostenrechner.html`, zwei Selbsttest-Bezeichnungen in
  `js/regeln.js` (2.192 von 23.530 statt von 2.353) und der Kommentar bei
  `FEFF` in `js/eintopf-rechenkern.js` nachgezogen.
- `CLAUDE.md`: Abschnitt "Spielerprofil" und "Achtung, Bezugsgröße" neu
  geschrieben, Wertetabelle korrigiert. Die belegte Ablesung 2.192 bleibt
  unverändert, nur ihre Bezugsgröße ändert sich: **FCE 34.242** statt 1.022,
  Fokus-Effizienz **9,32 %** statt 93,16 %. Damit löst sich auch der seit
  04.09.2026 dokumentierte Widerspruch zur Angabe des Nutzers, sein Kochbaum
  sei weit ausgebaut: 34.242 von maximal 55.000 passt dazu, 1.022 nicht.

**Der Eintopf-Reiter bleibt rechnerisch unberührt**, nur der Kommentar wurde
präzisiert. Er multipliziert den Dumpwert mit `FEFF = 2192/2353` und behandelt
das Ergebnis als Fokus je Charge; `f x (2192/2353)` ist identisch mit
`f x 10 x (2192/23530)`, die beiden Lesarten kürzen sich dort heraus, weil
`FEFF` direkt gegen die Messung geeicht ist.

**Testlücke geschlossen, das war der eigentliche Befund unter dem Befund.** Vor
dem Fix deckte kein einziger der 408 Tests die Bezugsgröße ab: eine
Probeänderung auf die andere Lesart ließ die Suite unverändert grün. Acht neue
Tests pinnen jetzt beide Codestellen (normaler und Qualitäts-Craftweg), den
Gleichstand bei `amountcrafted=1` und die Gegenprobe gegen den echten Dump.

**Wirkung:** 313 von 13.010 Rezepten im Graphen rechneten den Fokus zu billig,
davon 120 Speisen (`a=10`), 172 Tränke (`a=5`/`a=10`), 15 Steinblöcke
(`a=2/4/8`) und 6 Tierhaltungsrezepte (`a=18`). Ausrüstung, Barren, Bretter,
Leder und Stoff haben durchweg `a=1` und waren nie betroffen.

**Getestet:** `tests/test.html` zweimal ausgeführt, in Node gegen die Dateien
auf der Platte und headless über Chromium, beide Male **416/416 grün** (408
bisherige plus 8 neue).

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
