# Kontext: Albion Kostenrechner

Stand: 2026-09-04 · Version: v0.4.0 · Paket P5 (Oberfläche) erledigt, fünf Prüfer-Befunde behoben

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

## Aktueller Stand (P5, 04.09.2026, v0.4.0)

P1 bis P5 stehen: Rezeptgraph, Preisschicht, Rechenkern, Testsuite und jetzt
auch die Oberfläche (`Kostenrechner.html` + `js/ui.js`). Details zu P1-P3
(rezepte.js-Schema, Markt-ID-Regel, Cache-Schema, ItemValue-Herleitung,
Rezeptsuche-Verwechslung) stehen unverkürzt in `kostenrechner-KONTEXT-HISTORIE.md`.

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

## Dateistruktur

Stand nach P5 (v0.4.0):

```
Kostenrechner/
  build_graph.py            fertig (P1, P2: el-Feld ergaenzt), seither unveraendert
  rezepte.js                erzeugt (P1, P2), nicht von Hand bearbeiten
  Kostenrechner.html         fertig (P5, v0.4.0): Suche, Hero, Bauplan-Baum, Alle-Wege, Einstellungen
  js/
    preise.js                fertig (P2, P3): eigenpreisSetzen lehnt Preis<=0 ab
    regeln.js                fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0): itemWert, RRR,
                              Stationsgebuehr (mit 0-Floor), Fokus (mit 0-Floor), Steuer,
                              Kategorie-Tabellen, rezepteFuerStufe
    rechenkern.js             fertig (P3, v0.3.1, P5-Nacharbeit v0.4.0): kosten(item,stufe,menge,opts),
                              stationssatzFuer() unterscheidet fehlend von ausdruecklich 0
    ui.js                     fertig (P5, v0.4.0): Suche mit Tastaturbedienung, Rendering, Einstellungen
  kostenrechner-PLAN.md
  kostenrechner-KONTEXT.md
  kostenrechner-KONTEXT-HISTORIE.md
  Versionen/v0.1.0 - Rezeptgraph erzeugt/
  Versionen/v0.2.0 - Preisschicht mit localStorage-Cache/
  Versionen/v0.3.0 - Rechenkern/
  Versionen/v0.3.1 - Veredelungs-Rezeptbug behoben/
  Versionen/v0.4.0 - Oberflaeche/
  tests/test.html           96 Tests, Offline-Selbsttests + 2 Live-Abschnitte
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

**Als Nächstes dran:** P6 (Beschaffung nicht handelbarer Zutaten). P4
(Testsuite) und P5 (Oberfläche) sind erledigt, s. oben.

**Aus P5 mitgenommen, für P6:**

- **Backlog-Idee aus P3 (rechenkern-pruefer, Befund 1):** ein Eigenpreis von 0
  könnte legitim sein, wenn der Nutzer eine Zutat schon auf Lager hat ("kostet
  mich nichts mehr"). Absichtlich NICHT über `eigenpreisSetzen(id, 0)` gelöst
  (das löscht jetzt den Eintrag, s. oben), sondern falls gewünscht eine eigene,
  klar gekennzeichnete Funktion in P6.
- Die Eigenpreis-Tabelle in `Kostenrechner.html`/`js/ui.js` (P5) zeigt bislang
  nur die im zuletzt berechneten Baum tatsächlich fehlenden Preise
  (`sammleFehlendePreise()`). Eine vollständige Pflegeoberfläche für alle 365
  Kandidaten aus `rezepte.js.nichtHandelbareKandidaten`, unabhängig von einer
  konkreten Berechnung, ist P6.
- `js/ui.js` speichert Einstellungen unter dem `localStorage`-Schlüssel
  `albion_kostenrechner_einstellungen`, Schema-Version 1. Bei einer
  Formatänderung die Version hochzählen (gleiche Regel wie beim Preiscache).

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
