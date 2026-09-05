# Kontext: Albion Kostenrechner

Stand: 2026-09-05 · Version: v1.1.0 · Feature: Craft-Stadt waehlbar (kein
Paket aus dem Plan, Nutzer-Feature ausserhalb der P0-P7-Reihenfolge)

> Diese Datei ist die **einzige Quelle für eine frische Session**: aktueller Stand,
> Fachlogik der App, Dateistruktur, Arbeitsweise, offenes Backlog. Zu Beginn jeder
> Arbeit an diesem Projekt vollständig lesen.
>
> Der **Auftrag** steht in `kostenrechner-PLAN.md` und ändert sich kaum. Die
> **Spielregeln und belegten Formeln** stehen in `../CLAUDE.md`. Diese Datei hier
> beschreibt, wie weit die Anwendung ist.

## Was ist das?

Eine Web-App, die für ein beliebiges craftbares Albion-Item auf einer beliebigen
Verzauberungsstufe den **günstigsten Beschaffungsweg** ermittelt: kaufen, craften,
aus einer niedrigeren Stufe hochverzaubern, oder eine Mischung daraus über den
ganzen Rezeptbaum. Alles in Lymhurst, Qualität Normal.

Ziel und Rechenmodell: `kostenrechner-PLAN.md`, Abschnitte 1 und 4.

## Aktueller Stand (Feature "Craft-Stadt waehlbar", 05.09.2026, v1.1.0)

Der Plan (P1-P7) war mit v1.0.0 vollständig abgeschlossen, v1.0.1 war eine
Fehlerkorrektur danach (Zeitzonen-Bug), s. `kostenrechner-KONTEXT-HISTORIE.md`
für die Details zu beidem. Dieses Paket ist keins der sechs Plan-Pakete,
sondern ein vom Nutzer beauftragtes Feature.

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
kuenftige Sitzung an derselben Stelle haengen bleibt.

**Vorheriger Stand (v1.0.1, Zeitzonen-Bug bei der Preisalter-Berechnung)**
unverkürzt nach `kostenrechner-KONTEXT-HISTORIE.md` ausgelagert (Schlankheitsregel,
s. "Entwicklungsweise / Mitarbeit" unten), diese Datei war ueber 300 Zeilen
gewachsen.

## Dateistruktur

Stand nach P7 (v1.0.0) plus Feature "Craft-Stadt waehlbar" (v1.1.0):

```
Kostenrechner/
  build_graph.py            fertig (P1, P2: el-Feld ergaenzt), seither unveraendert
  rezepte.js                erzeugt (P1, P2), nicht von Hand bearbeiten
  Kostenrechner.html         fertig (P6, v0.5.0; Stadt-Dropdown v1.1.0): Suche, Hero,
                              Bauplan-Baum, Alle-Wege, Eigenpreis-Pflege (P6), Einstellungen
  js/
    preise.js                fertig (P2, P3; stadtabhaengiger Cache v1.1.0): eigenpreisSetzen
                              lehnt Preis<=0 ab, PREIS_CACHE_SCHEMA_VERSION/EIGENPREIS_SCHEMA_VERSION
                              getrennt seit v1.1.0
    regeln.js                fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0): itemWert, RRR,
                              Stationsgebuehr (mit 0-Floor), Fokus (mit 0-Floor), Steuer,
                              Kategorie-Tabellen, rezepteFuerStufe
    rechenkern.js             fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0, P6 v0.5.0):
                              kosten(item,stufe,menge,opts), stationssatzFuer() unterscheidet
                              fehlend von ausdruecklich 0, weg.eigenpreis kennzeichnet
                              Kauf-Kandidaten aus einer eigenen Schaetzung (P6)
    ui.js                     fertig (P5, v0.4.0, P6 v0.5.0, Stadt-Einstellung v1.1.0): Suche
                              mit Tastaturbedienung, Rendering, Einstellungen, Eigenpreis-
                              Pflegeansicht (P6)
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
  tests/test.html           106 Tests, Offline-Selbsttests + 2 Live-Abschnitte
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

Die Arbeitspakete stehen in `kostenrechner-PLAN.md`, Abschnitt 6. Hier nur, was
darüber hinaus aufkommt.

**Als Nächstes dran:** nichts mehr aus `kostenrechner-PLAN.md` Abschnitt 6 - P7
war das letzte der sechs Baupakete. Weitere Arbeit an dieser App ist entweder
ein v2-Punkt aus der Liste unten (neue Rücksprache mit dem Nutzer nötig, welcher
zuerst) oder eine der beiden unten offen gebliebenen Kleinigkeiten.

**Aus P6/P7 mitgenommen, unerledigt (keins davon blockierend für v1.0.0):**

- **Backlog-Idee aus P3 (rechenkern-pruefer, Befund 1), weiterhin offen:** ein
  Eigenpreis von 0 könnte legitim sein, wenn der Nutzer eine Zutat schon auf
  Lager hat ("kostet mich nichts mehr"). In P6 bewusst NICHT gelöst (siehe dort
  die Entscheidung zu Punkt 5) - `eigenpreisSetzen(id, 0)` löscht weiterhin den
  Eintrag. Falls der Nutzer das noch will: eigene, klar gekennzeichnete
  Funktion statt eines überladenen Preisfelds.
- Die 21 von 365 Kandidaten ohne deutschen Namen (`REZEPTGRAPH.namen[id]`
  fehlt, z. B. `QUESTITEM_TOKEN_ARENA_CRYSTAL`) zeigt die Pflegeliste unter
  ihrer ID an (gleicher Fallback wie überall sonst in `ui.js`). Nicht
  nachgebessert, da `build_graph.py`/die Namensquelle selbst betroffen wäre -
  falls störend, dort ansetzen.
- Umgebungs-Fund zur Browser-Prüfung (Cache unter `localhost`, Ausweg über
  `127.0.0.1`) steht oben unter „Aktueller Stand". Bei P7 nicht erneut
  aufgetreten; bei der nächsten Sitzung mit Browser-Verifikation trotzdem
  zuerst dort nachsehen, falls eine Änderung nicht ankommt.

**Aus P1 mitgenommen, für spätere Pakete:**

- Das genaue `rezepte.js`-Schema steht in `kostenrechner-KONTEXT-HISTORIE.md`
  unter „rezepte.js: Schema" und ist Grundlage für `js/rechenkern.js` (P3).
  Insbesondere: die Stufe-N-braucht-Stufe-(N-1)-Abhängigkeit beim Verzaubern
  ist nicht als Kante im JSON codiert, sondern eine Spielregel, die der
  Rechenkern selbst anwenden muss.
- 365 Kandidaten für nicht handelbare Zutaten liegen bereits in
  `rezepte.js.nichtHandelbareKandidaten`, direkt verwendbar für P6
  (Eigenpreis-Pflege). Heuristik, keine belegte Liste, s. Historie.
- 584 Items mit uneinheitlichen ItemValues über ihre Alternativrezepte
  (`ivm`-Feld in `rezepte.js`), überwiegend Artefakt-Ausrüstung und
  Dungeon-Token. Für P3 relevant: bei solchen Items zeigt die Stationsgebühr
  je nach gewähltem Rezeptweg unterschiedliche Werte, das ist korrektes
  Verhalten, kein Fehler.
- `../.claude/launch.json` existiert jetzt (lokaler Static-Server auf Port 8791
  für `Kostenrechner/`), direkt wiederverwendbar für die Browser-Prüfung in P5.

**Aus P2 mitgenommen, für spätere Pakete:**

- `js/preise.js` liefert P3 fertige Bausteine: `sammleMarktIds()` für den
  Bedarf eines Baums, `preiseAbrufen()` für die Preise dazu (mit `sell`/`buy`,
  `kein`-Flag, Alter), `eigenpreisHolen()` für nicht handelbare Zutaten.
  `rechenkern.js` sollte **nicht** selbst gegen `fetch` gehen, sondern immer
  über diese Schicht.
- Die „gesperrt bei fehlendem/altem Preis"-Logik aus Plan Abschnitt 4.1 ist
  **nicht** in `preise.js`, sondern in P3 in `kosten()` umgesetzt worden
  (`preisMitGrund()` in `rechenkern.js`, plus `opts.maxPreisAlterMin`):
  `preise.js` liefert nur `preis === null` bzw. das Datum, die Entscheidung
  „damit rechnen oder sperren" trifft `rechenkern.js`.
- Die Markt-ID-Regel (Vorrang `el` vor Kontextstufe, nicht Addition) ist die
  wichtigste Einzel-Erkenntnis aus P2 und steht ausführlich in
  `kostenrechner-KONTEXT-HISTORIE.md` unter „Markt-ID". Für P3/P5 wichtig:
  beim Aufbau eines Bauplans für die Anzeige IMMER `PREISE.marktId()`
  verwenden, nie die ID von Hand zusammensetzen.

**Aus P3 mitgenommen, für P5:**

- `RECHENKERN.kosten()` fasst absichtlich NICHT selbst `fetch`/`PREISE` an:
  der Aufrufer (spaeter `ui.js`) sammelt Markt-IDs ueber
  `PREISE.sammleMarktIds()`, ruft `PREISE.preiseAbrufen()` ab und uebergibt
  das Ergebnis direkt als `opts.preise`. So bleibt der Rechenkern rein
  synchron testbar (s. `tests/test.html`, Abschnitt 3, macht das schon vor).
- `opts.graph` erlaubt, `RECHENKERN.kosten()` und `REGELN.itemWert()` mit
  einem eigenen (kleinen) Testgraphen statt dem echten `REZEPTGRAPH`
  aufzurufen. Fuer P5 ohne Bedeutung (dort immer der echte Graph), aber
  wichtig, falls spaeter weitere Unittests dazukommen.
- Die Markt-ID-Bildung ist in `rechenkern.js` bewusst LOKAL nachgebaut
  (`marktIdVon()`), nicht ueber `PREISE.marktId()` aufgerufen, damit
  `opts.graph` auch ohne das globale `REZEPTGRAPH`/`PREISE` funktioniert. Für
  P5 kein Problem: der fertige Bauplan (`weg`) trägt die Markt-ID bei jedem
  `kaufen`-Knoten bereits fertig im Feld `marktId`, dort nichts neu bauen.
- Rückgabeform von `kosten()`: `{ silber, fokus, wert, weg, gesperrt, grund,
  menge, alleWege }`. `weg` ist ein Baum aus `{typ:"kaufen"|"craften"|
  "verzaubern"|"gesperrt", ...}`-Knoten; Mengenangaben darin sind **je Stück
  des jeweils übergeordneten Schritts**, nicht auf `menge` hochgerechnet (nur
  die Summenfelder `silber`/`fokus`/`wert` sind das). `tests/test.html`,
  Abschnitt 3 (`renderBaum()`), zeigt eine erste rekursive Darstellung, die P5
  als Ausgangspunkt für den aufklappbaren Bauplan übernehmen kann.

**Ideen für später (v2), bewusst nicht in v1** (aus `kostenrechner-PLAN.md`
Abschnitt 8, hier vollständig gegen den Plan abgeglichen):

- Mehrere Staedte gleichzeitig vergleichen, getrennte Rollen je
  Einkaufen/Craften/Verkaufen (wie beim Eintopf-Rechner), Transportkosten und
  Schwarzzonen-Risiko. Eine einzelne, frei waehlbare Stadt fuer die ganze
  Rechnung ist seit v1.1.0 umgesetzt (05.09.2026), s. "Aktueller Stand" oben.
- Qualitätsstufen über Normal hinaus, und die Craft-Qualitätschance
- Markttiefe über `history` statt nur Bestpreis (Mischkalkulation bei Massenbedarf)
- Einkaufsliste über mehrere Items hinweg („ich brauche ein komplettes Set")
- Wartezeit und Ausfallrisiko eigener Kauf-/Verkaufsorders
- Craft-Fame und Spezialisierungsaufbau als Nutzen (die App rechnet Silber,
  nicht Fortschritt)
- Ernte, Farmen, Inseln (nur Markt und Werkbank in v1)
- Mengenrabatt durch ganze Chargen (v1 rechnet stetig, s. Plan 4.4)
