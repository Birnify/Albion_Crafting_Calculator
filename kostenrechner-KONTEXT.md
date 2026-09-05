# Kontext: Albion Kostenrechner

Stand: 2026-09-05 · Version: v1.2.0 · Feature: Fokuseinsatz steuerbar machen
(kein Paket aus dem Plan, Nutzer-Feature ausserhalb der P0-P7-Reihenfolge)

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

## Dateistruktur

Stand nach P7 (v1.0.0) plus Feature "Craft-Stadt waehlbar" (v1.1.0) plus
Feature "Fokuseinsatz steuerbar machen" (v1.2.0):

```
Kostenrechner/
  build_graph.py            fertig (P1, P2: el-Feld ergaenzt), seither unveraendert
  rezepte.js                erzeugt (P1, P2), nicht von Hand bearbeiten
  Kostenrechner.html         fertig (P6, v0.5.0; Stadt-Dropdown v1.1.0; Fokus-Regel-
                              Tabelle + Fokus-Schalter im Bauplan v1.2.0): Suche, Hero,
                              Bauplan-Baum, Alle-Wege, Eigenpreis-Pflege (P6), Einstellungen
  js/
    preise.js                fertig (P2, P3; stadtabhaengiger Cache v1.1.0): eigenpreisSetzen
                              lehnt Preis<=0 ab, PREIS_CACHE_SCHEMA_VERSION/EIGENPREIS_SCHEMA_VERSION
                              getrennt seit v1.1.0
    regeln.js                fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0): itemWert, RRR,
                              Stationsgebuehr (mit 0-Floor), Fokus (mit 0-Floor), Steuer,
                              Kategorie-Tabellen, rezepteFuerStufe
    rechenkern.js             fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0, P6 v0.5.0,
                              Fokusregel-Ebenen v1.2.0): kosten(item,stufe,menge,opts),
                              stationssatzFuer() unterscheidet fehlend von ausdruecklich 0,
                              weg.eigenpreis kennzeichnet Kauf-Kandidaten aus einer eigenen
                              Schaetzung (P6), fokusRegelFuer() steuert mit/ohne Fokus je
                              Knoten/Kategorie (v1.2.0)
    ui.js                     fertig (P5, v0.4.0, P6 v0.5.0, Stadt-Einstellung v1.1.0,
                              Fokus-Regel-Tabelle + Bauplan-Fokus-Schalter v1.2.0): Suche
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
  Versionen/v1.0.1 - Zeitzonen-Bug Preisalter behoben/
  Versionen/v1.1.0 - Craft-Stadt waehlbar/
  Versionen/v1.2.0 - Fokuseinsatz steuerbar machen/
  tests/test.html           136 Tests, Offline-Selbsttests + 2 Live-Abschnitte
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
