# Kontext-Historie: Albion Kostenrechner

Diese Datei sammelt die vollständigen "Aktueller Stand"-Abschnitte, die aus
`kostenrechner-KONTEXT.md` ausgelagert wurden, sobald die Hauptdatei über etwa
300 Zeilen wuchs. Nichts wird gekürzt, nur verschoben - s. Regel dort unter
"Entwicklungsweise / Mitarbeit". Neueste Auslagerung zuerst.

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
