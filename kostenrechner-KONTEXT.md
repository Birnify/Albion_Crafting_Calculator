# Kontext: Albion Kostenrechner

Stand: 2026-09-04 · Version: v0.5.0 · Paket P6 (Eigenpreis-Pflege) erledigt

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

## Aktueller Stand (P6, 04.09.2026, v0.5.0)

P1 bis P6 stehen: Rezeptgraph, Preisschicht, Rechenkern, Testsuite, Oberfläche
und jetzt die Eigenpreis-Pflege. Details zu P1-P5 (rezepte.js-Schema,
Markt-ID-Regel, Cache-Schema, ItemValue-Herleitung, Rezeptsuche-Verwechslung,
die fünf oberflaechen-pruefer-Befunde) stehen unverkürzt in
`kostenrechner-KONTEXT-HISTORIE.md`.

**P6 in Kürze:** Eigene Ansicht „Eigenpreis-Pflege" in `Kostenrechner.html`
(neues `<details>`-Panel zwischen „Alle Wege" und „Einstellungen"), listet alle
365 Kandidaten aus `REZEPTGRAPH.nichtHandelbareKandidaten` mit deutschem Namen
(Fallback auf die ID bei den 21 Kandidaten ohne Übersetzung) und der ID selbst,
durchsuchbar per Textfeld (filtert Name UND ID) über die neue reine Funktion
`UI.gefilterteEigenpreisKandidaten(query)`. Je Zeile ein normales
Zahlen-Eingabefeld, das direkt auf `PREISE.eigenpreisSetzen()` schreibt - kein
Combobox-/Tastatur-Sondermuster nötig wie bei der Item-Suche (P5), reine
`<input>`-Felder sind von Haus aus tastaturbedienbar. Zähler „X von 365 ...
versehen" über `UI.anzahlEigenpreiseGesetzt()`.

**Sichtbarmachung im Bauplan (Abnahmekriterium, nicht nur Komfort):**
`js/rechenkern.js` kennzeichnet jetzt in `preisMitGrund()`/`kaufKandidat()`,
ob ein gültiger Kaufpreis aus einem Marktpreis oder aus einem Eigenpreis stammt
(`weg.eigenpreis: true/false`). `js/ui.js` zeigt das im Bauplan als Badge
„Eigenpreis" (statt der Preisalter-Anzeige, die bei einem Eigenpreis ohnehin
bedeutungslos wäre) und in der Alle-Wege-Tabelle als Zusatz „, Eigenpreis"
hinter dem Kaufweg. Live im Browser mit einem echten Rezept verifiziert
(`QUESTITEM_CARAVAN_TRADEPACK_CAERLEON_HEAVY` braucht 40x „Schattenherz"
`T1_FACTION_CAERLEON_TOKEN_1`, kein Marktangebot, per Fetch-Stub simuliert):
Badge und Tabellenzusatz erschienen korrekt, verschwanden nach dem Löschen
des Eigenpreises wieder.

**Entscheidung zu Punkt 5 des Auftrags (freie Eingabe über die 365 Kandidaten
hinaus):** bewusst NICHT umgesetzt. Ein zu Unrecht als „nicht handelbar"
markiertes Item war schon vor P6 nicht blockiert - `PREISE.eigenpreisSetzen()`
kennt keine Beschränkung auf die Kandidatenliste, und die reaktive Tabelle aus
P5 (`sammleFehlendePreise()`) bietet für JEDES im Baum tatsächlich gesperrte
Item einen Eigenpreis an, unabhängig von der Heuristik. Eine zweite,
vollständige Item-Suche in der Pflegeansicht (zusätzlich zur bestehenden
Suche oben auf der Seite) hätte nur Redundanz und zwei verschieden bediente
Suchfelder auf derselben Seite erzeugt, ohne eine echte Lücke zu schließen.

**Validierung:** kein negativer oder nullwertiger Eigenpreis speicherbar -
`PREISE.eigenpreisSetzen()` behandelt `preis <= 0` bereits seit P2/P3 als
Löschen (nicht als 0-Silber-Preis), die neue Pflegeoberfläche nutzt diesen Weg
unverändert (kein zweiter Validierungspfad), plus `min="0"` am Eingabefeld
gegen versehentliche Minuswerte. Im Browser bestätigt: `-50` eingetragen →
kein Eintrag gespeichert, `PREISE.eigenpreisHolen()` bleibt `null`.

**6 neue Tests** (3 in `rechenkern.js`: `weg.eigenpreis` korrekt bei
Marktpreis/Eigenpreis/keinem von beiden; 7 in `ui.js`: Filterlogik inkl.
Namens- und ID-Suche, alphabetische Sortierung, Zähler, negativer Eigenpreis
wird nicht gezählt) - macht 10 insgesamt, 96 → 106, alle grün.

**Umgebungs-Fund, für künftige Browser-Prüfungen wichtig:** die Vorschau
(`Claude_Browser`, `preview_start`/`navigate`) cachte `js/rechenkern.js` unter
`http://localhost:8791/...` hartnäckig auf einem älteren Stand - weder ein
neuer Tab noch ein Server-Neustart (neue `serverId`) noch `Ctrl+Shift+R` haben
das aufgelöst, ein `fetch(..., {cache:"no-store"})` schon. Direktes `curl` vom
Bash-Tool auf denselben Port lieferte dagegen sofort den frischen Stand - der
Cache sitzt also in der Browser-Pane-Infrastruktur, nicht im Python-Server.
**Zuverlässiger Ausweg:** dieselbe Seite über `http://127.0.0.1:8791/...`
statt `http://localhost:8791/...` aufrufen, das traf offenbar einen anderen
Cache-Schlüssel und lieferte sofort den aktuellen Stand. Bei künftigen
Sitzungen, in denen eine Codeänderung im Browser partout nicht ankommt: zuerst
`127.0.0.1` statt `localhost` probieren, bevor man an der eigenen Änderung
zweifelt.

## Dateistruktur

Stand nach P6 (v0.5.0):

```
Kostenrechner/
  build_graph.py            fertig (P1, P2: el-Feld ergaenzt), seither unveraendert
  rezepte.js                erzeugt (P1, P2), nicht von Hand bearbeiten
  Kostenrechner.html         fertig (P6, v0.5.0): Suche, Hero, Bauplan-Baum, Alle-Wege,
                              Eigenpreis-Pflege (P6), Einstellungen
  js/
    preise.js                fertig (P2, P3): eigenpreisSetzen lehnt Preis<=0 ab
    regeln.js                fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0): itemWert, RRR,
                              Stationsgebuehr (mit 0-Floor), Fokus (mit 0-Floor), Steuer,
                              Kategorie-Tabellen, rezepteFuerStufe
    rechenkern.js             fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0, P6 v0.5.0):
                              kosten(item,stufe,menge,opts), stationssatzFuer() unterscheidet
                              fehlend von ausdruecklich 0, weg.eigenpreis kennzeichnet
                              Kauf-Kandidaten aus einer eigenen Schaetzung (P6)
    ui.js                     fertig (P5, v0.4.0, P6 v0.5.0): Suche mit Tastaturbedienung,
                              Rendering, Einstellungen, Eigenpreis-Pflegeansicht (P6)
  kostenrechner-PLAN.md
  kostenrechner-KONTEXT.md
  kostenrechner-KONTEXT-HISTORIE.md
  Versionen/v0.1.0 - Rezeptgraph erzeugt/
  Versionen/v0.2.0 - Preisschicht mit localStorage-Cache/
  Versionen/v0.3.0 - Rechenkern/
  Versionen/v0.3.1 - Veredelungs-Rezeptbug behoben/
  Versionen/v0.4.0 - Oberflaeche/
  Versionen/v0.5.0 - Eigenpreis-Pflege/
  tests/test.html           106 Tests, Offline-Selbsttests + 2 Live-Abschnitte
  .gitignore, README.md      seit 04.09.2026: eigenes Git-Repo, Remote Birnify/Albion_Crafting_Calculator
```

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

**Als Nächstes dran:** P7 (Härtung und Abschluss). P4 (Testsuite), P5
(Oberfläche) und P6 (Eigenpreis-Pflege) sind erledigt, s. oben.

**Aus P6 mitgenommen, für P7:**

- **Backlog-Idee aus P3 (rechenkern-pruefer, Befund 1), weiterhin offen:** ein
  Eigenpreis von 0 könnte legitim sein, wenn der Nutzer eine Zutat schon auf
  Lager hat ("kostet mich nichts mehr"). In P6 bewusst NICHT gelöst (siehe dort
  die Entscheidung zu Punkt 5) - `eigenpreisSetzen(id, 0)` löscht weiterhin den
  Eintrag. Falls der Nutzer das noch will: eigene, klar gekennzeichnete
  Funktion statt eines überladenen Preisfelds.
- Die 21 von 365 Kandidaten ohne deutschen Namen (`REZEPTGRAPH.namen[id]`
  fehlt, z. B. `QUESTITEM_TOKEN_ARENA_CRYSTAL`) zeigt die Pflegeliste unter
  ihrer ID an (gleicher Fallback wie überall sonst in `ui.js`). Nicht
  nachgebessert, da `build_graph.py`/die Namensquelle selbst betroffen wäre,
  nicht P6 - falls störend, dort ansetzen.
- Umgebungs-Fund zur Browser-Prüfung (Cache unter `localhost`, Ausweg über
  `127.0.0.1`) steht oben unter „Aktueller Stand". Bei der nächsten Sitzung mit
  Browser-Verifikation zuerst dort nachsehen, falls eine Änderung nicht ankommt.

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

**Ideen für später (v2), bewusst nicht in v1:**

- Weitere Städte samt Transportkosten
- Qualitätsstufen und Craft-Qualitätschance
- Markttiefe über `history` statt nur Bestpreis
- Einkaufsliste über mehrere Items hinweg („ich brauche ein komplettes Set")
