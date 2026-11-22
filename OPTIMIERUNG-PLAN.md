# Optimierungsplan: Albion Werkzeuge

Stand: 2026-11-22 · Ausgangsversion: v3.14.1 · Status: O1 bis O4 abgeschlossen (v3.18.0), O5 als Nächstes

> Auftrag für die Optimierungsrunde, in Arbeitspaketen O1 bis O6. Jedes Paket
> geht an einen **frischen** Umsetzer-Subagenten; die Hauptsitzung steuert,
> prüft und schließt ab (s. `CLAUDE.md`, „Arbeitsablauf", Stand 22.11.2026).
> Die Warteschlange führt die Hauptsitzung. Der ursprüngliche Auftrag der App steht
> weiter in `kostenrechner-PLAN.md`, der Arbeitsstand in
> `kostenrechner-KONTEXT.md`.

## 1. Ziel

Vom Nutzer am 22.11.2026 genannt, in dieser Reihenfolge:

1. **Ergonomische Gewinnmaximierung.** Der Weg von „was lohnt sich" bis „ich
   habe eingekauft und gecraftet" soll kurz sein.
2. **Potenzialerkennung.** Die App zeigt lohnende Gelegenheiten von sich aus,
   nicht nur dort, wo man vorher eine Warengruppe ausgewählt hat.
3. **Performance**, soweit sie den beiden Zielen im Weg steht.

## 2. Ausgangslage, gemessen am 22.11.2026

| Befund | Wert | Beleg |
|---|---|---|
| Ladezeit lokal | 0,4 s bis `load`, 15 MB Heap, 1.964 DOM-Knoten | Browser, `performance`-API, lokaler Server |
| Datenmenge beim Start | `rezepte.js` 2,5 MB, `item-namen.js` 0,9 MB | dieselbe Messung; kein Problem |
| Eine Warengruppe in „Craften: Gewinn" | 200 Produkte, 95 Zutaten, etwa 10 Abrufe, rund 1 Min. je Stadt | Anzeige der App (Schwerter, T4 bis T8, alle Stufen) |
| Zwangsabruf | `craften.js` und `veredeln.js` rufen Materialpreise mit `erzwingen: true` ab | `craften.js:1489`, `veredeln.js:1660` |
| Preisbestand | ein `localStorage`-Eintrag (`albion_kostenrechner_preiscache`), Schlüssel `Stadt::ID::qN`, Gültigkeit 30 Min. | `preise.js:54` bis `263` |
| Getrennte Abrufschichten | `preise.js`, `preisvergleich.js`, `eintopf-preise.js`, bewusst ohne gemeinsamen Code | Kontextdatei |
| Mengengerüst | 1.529 craftbare Items mit Warengruppe, 115 Veredelungs-Items, 44 Kategorien | `REZEPTGRAPH.items` im Browser gezählt |

**Folgerungen:**

- Ladezeit ist kein Arbeitsziel. Nachladen von `rezepte.js` bringt nichts.
- Der Engpass ist die API-Drosselung (1,5 s Pause je Block zu 50 IDs,
  Leselimit 180 je Minute und 300 je 5 Minuten).
- Ein Gesamtscan sind grob 1.529 × 5 Stufen ≈ 7.600 Produkte. Mit allen fünf
  Qualitäten und sieben Städten sind das bis zu 270.000 Preiszeilen. Das passt
  **nicht** in `localStorage` (üblich 5 MB).
- **`prices/` und `history/` liefern alle sieben Städte in einem Abruf.**
  Gegen die echte API gemessen am 22.11.2026 (50 Schwert-IDs, T4, alle
  Stufen):

  | Abruf | Zeilen | Größe | Dauer | URL-Länge |
  |---|---|---|---|---|
  | `prices/`, 50 IDs, 7 Städte, 5 Qualitäten | 1.750 (= 50 × 7 × 5, vollständig) | 541 KB | 0,23 s | 1.238 |
  | `prices/`, 50 IDs, nur Lymhurst | 250 | 77 KB | 0,04 s | |
  | `history/`, 50 IDs, 7 Städte, Tageswerte | 415 | 387 KB | 0,20 s | 1.233 |
  | `prices/`, 100 IDs, 7 Städte, 5 Qualitäten | 3.500 (vollständig) | 1.084 KB | 0,13 s | 2.338 |

  Die 250 Lymhurst-Zeilen aus dem Sieben-Städte-Abruf stimmen in
  `sell_price_min` und `buy_price_max` vollständig mit dem Einzelabruf
  überein (250 gleich, 0 ungleich).
- **Ein Gesamtdurchlauf über alle Städte sind damit rund 310 Abrufe**
  (je 153 für Preise und Volumen bei 50 IDs je Block, dazu wenige für
  Zutaten), bei 1,5 s Pause **etwa 8 Minuten**, mit 100 IDs je Block etwa 4.
  Das Limit von 300 je 5 Minuten wird bei 1,5 s Pause nicht erreicht
  (200 je 5 Minuten).
- **Neue Grenze: die Datenmenge.** Ein Gesamtdurchlauf lädt rund 140 MB
  (153 × 541 KB Preise, 153 × 387 KB Volumen). Nur 358 der 1.750 Zeilen im
  Test trugen überhaupt einen Verkaufspreis. Der Scan muss deshalb nach
  Aussicht ordnen und Volumen seltener holen als Preise, statt stur alles im
  Kreis abzurufen.

## 3. Entscheidungen

| Entscheidung | Wer | Wann |
|---|---|---|
| Potenzialerkennung über **laufenden Hintergrundscan**, solange die App offen ist; kein Scan auf Knopfdruck, kein Python-Vorablauf | Nutzer | 22.11.2026 |
| Ladezeit wird nicht optimiert | Hauptagent, aus der Messung | 22.11.2026 |
| Paket O4 (Gewinn je Einsatz) ist ein Vorschlag des Hauptagenten, kein Nutzerwunsch; vor Beginn bestätigen lassen | offen | |

## 4. Rahmen für alle Pakete

- **Rechenlogik bleibt unverändert**, außer wo ein Paket es ausdrücklich
  nennt. Belegte Werte aus `CLAUDE.md` werden nicht angefasst.
- **Selbsttest vor und nach jedem Paket**: Ausgang 660/660 grün. Testzahlen
  selbst nachlaufen lassen, nie vom Prüfer übernehmen.
- **API-Regeln aus `CLAUDE.md` gelten**: Realm `europe`, sequenziell, Pause,
  bei 429 mit wachsender Wartezeit wiederholen.
- **Kein Build-Werkzeug.** Die App läuft weiter per Doppelklick aus `file://`.
- **`item_count` bleibt eine Untergrenze** und heißt in der Oberfläche
  „verkauft/Tag".
- **Abschluss je Paket** durch die Hauptsitzung, nach bestandener Prüfung:
  Kontextdatei nachziehen, Versionsordner, Commit und Push.
- **Stil**: keine Gedankenstriche, keine Erklärkästen, Erläuterungen in
  Tooltips.

## 5. Arbeitspakete

Reihenfolge: O1 → O2 → O3, danach O4, O5, O6 in beliebiger Reihenfolge.
O4 und O5 ändern beide den Reiter aus O3 und laufen deshalb nacheinander.

### O1: Gemeinsamer Preisbestand

**Auftrag.** Ein Preisbestand für Kostenrechner, „Craften: Gewinn" und
„Veredeln leveln", der einen Gesamtscan fasst.

- Speicher von `localStorage` auf IndexedDB umstellen (Preise und
  Handelsvolumen), mit Rückfall auf den heutigen Weg, falls IndexedDB nicht
  verfügbar ist. Zuerst prüfen, ob IndexedDB unter `file://` in Chrome und
  Edge trägt; falls nicht, zurück zum Hauptagenten.
- Handelsvolumen bekommt ebenfalls einen Bestand mit Alter (heute bewusst
  ohne Zwischenspeicher).
- Die Gewinn-Reiter verwenden frische Einträge wieder. Der Zwangsabruf bleibt
  als ausdrückliche Aktion „frisch abrufen" erhalten.
- Alter der verwendeten Preise je Zeile sichtbar (Tooltip), ältester Wert in
  der Statuszeile.
- Migration: vorhandener `localStorage`-Bestand wird übernommen oder
  verworfen, nicht doppelt geführt. Eigenpreise und Einstellungen bleiben, wo
  sie sind.

**Abgrenzung.** Preisvergleich und Eintopf-Rechner behalten ihre eigenen
Schichten. Keine Änderung an `rechenkern.js` und `regeln.js`.

**Abnahme.**
- Zweite Suche derselben Auswahl innerhalb der Gültigkeit: 0 Abrufe.
- Was „Veredeln leveln" geholt hat, nutzt „Craften: Gewinn" ohne neuen Abruf.
- Bestand mit 50.000 synthetischen Einträgen: Lesen und Schreiben ohne
  spürbares Stocken der Oberfläche, Zeiten gemessen und berichtet.
- Ergebnisse einer Suche sind vor und nach dem Umbau bei gleichen Preisen
  identisch.

**Prüfer.** `rechenkern-pruefer` (Gleichheit der Ergebnisse).

### O2: Abrufplaner

**Auftrag.** Eine einzige Warteschlange für alle Abrufe der drei Reiter aus
O1, mit Budget gegen das API-Limit.

- Vordergrund vor Hintergrund: eine vom Nutzer ausgelöste Suche überholt den
  Hintergrundscan.
- Budget unter 180 je Minute und 300 je 5 Minuten, mit Abstand. Bei 429
  pausiert die ganze Schlange, nicht nur der eine Abruf.
- Pausieren, Fortsetzen, Abbrechen. Kein Abruf, während der Browser-Tab
  verborgen ist, außer der Nutzer schaltet das ein.
- Alle Städte in einem Abruf holen (belegt, s. Abschnitt 2). Blockgröße 50
  beibehalten; 100 funktioniert im Test, die Antwort ist dann aber über
  1 MB. Eine Erhöhung nur mit eigener Messung über mehrere Warengruppen.
- Volumen (`history/`) seltener auffrischen als Preise, etwa einmal je
  Stunde; es ist ein 7-Tage-Mittel und ändert sich langsam.
- Verbrauchte Datenmenge je Durchlauf in der Statusanzeige nennen.

**Abgrenzung.** Noch keine neue Oberfläche außer einer Statusanzeige
(läuft, pausiert, wartet wegen Limit, Anzahl offen).

**Abnahme.**
- Zwei Reiter suchen gleichzeitig: Abrufe laufen nacheinander, keiner geht
  verloren, keine 429 im Normalbetrieb.
- Simulierte 429-Antwort: Schlange pausiert und setzt selbst fort.
- Gemessene Dauer eines Durchlaufs für eine Warengruppe vorher und nachher.

**Prüfer.** `spieldaten-pruefer` (API-Verhalten gegen die echte API).

### O3: Reiter „Gelegenheiten"

**Auftrag.** Eine Rangliste der besten Crafts und Veredelungen über alle
Warengruppen, gespeist vom Hintergrundscan.

- Der Scan arbeitet die Gruppen nacheinander ab und beginnt danach von vorn
  bei den ältesten Daten. Reihenfolge: zuerst, was zuletzt Gewinn zeigte und
  Volumen hat.
- Die Rangliste ist sofort nach dem Öffnen aus dem Bestand gefüllt und nennt
  ihr Alter. Fortschritt des laufenden Durchlaufs sichtbar.
- Rechnung je Zeile unverändert aus `CRAFTEN` und `VEREDELN` (flach, direkte
  Zutaten gekauft, Volumenfilter Pflicht). Keine zweite Rechenlogik.
- Filter: Fertigungsstadt, Einkaufs- und Verkaufsstädte, Tier, mit oder ohne
  Fokus, Mindestvolumen. Vorgaben aus dem Spielerprofil (Lymhurst,
  Sofortkauf, Verkaufsorder, Premium).
- Umfang des Scans einstellbar (Gruppen, Tiers, Städte), damit ein Durchlauf
  in überschaubarer Zeit bleibt. Vorgabe mit dem Nutzer klären.

**Wartezeit (Nutzer-Vorgabe 22.11.2026: auf den Durchlauf zu warten ist
nicht ergonomisch).** Der Durchlauf von etwa 8 Minuten ist die Zeit, bis
*alles* einmal aufgefrischt ist, nicht die Zeit bis zur ersten Rangliste:

- Beim Öffnen steht sofort die Rangliste aus dem gespeicherten Bestand der
  letzten Sitzung, mit Altersangabe je Zeile.
- Der Scan frischt zuerst die Zeilen auf, die oben stehen (letzte Gewinner
  mit Volumen, Vorgaben aus dem Spielerprofil), danach den Rest. 200
  Produkte sind 4 Preisabrufe, also rund 6 Sekunden.
- Jeder abgeschlossene Block rechnet seine Zeilen sofort neu; die Liste
  wächst und sortiert sich laufend, ohne zu springen, während man liest
  (Umsortieren nur auf Klick oder wenn nicht gescrollt ist).
- Allererster Start ohne Bestand: erste Zeilen nach dem ersten Block,
  Reihenfolge der Gruppen nach Tagesvolumen aus dem ersten Volumenabruf.

**Abgrenzung.** Kein Kostenrechner-Baum je Zeile (das wäre der ganze
Rezeptbaum für tausende Items). Keine Transportkosten, keine Wartezeit
eigener Orders. Keine Benachrichtigungen.

**Abnahme.**
- App mit vorhandenem Bestand geöffnet: Rangliste steht ohne Abruf, in unter
  1 Sekunde. Die obersten 50 Zeilen sind nach höchstens 15 Sekunden frisch.
- Jede Zeile der Rangliste ergibt in „Craften: Gewinn" bzw. „Veredeln leveln"
  mit denselben Einstellungen und Preisen dieselben Zahlen.
- Drei Zeilen von Hand oder per Python-Skript nachgerechnet.
- Oberfläche bei 1440 und 390 px ohne Seitenscrollbalken, Bedienung bleibt
  flüssig, während der Scan läuft.

**Prüfer.** `rechenkern-pruefer`, `oberflaechen-pruefer`.

### O4: Gewinn je Einsatz (Vorschlag, vor Beginn bestätigen lassen)

**Auftrag.** Rangfolge nach dem, was tatsächlich knapp ist.

- **Gewinn je Tag**: Gewinn je Stück × Stückzahl, begrenzt durch
  verkauft/Tag. Als Untergrenze beschriftet, weil das Volumen eine ist.
- **Gewinn je Fokuspunkt**, begrenzt durch 10.000 Fokus je Tag.
- **Gewinn je eingesetztem Silber** (Kapitalbindung).
- Sortierbar in „Gelegenheiten", „Craften: Gewinn" und „Veredeln leveln".

**Vorgabe (Vorschlag des Hauptagenten, 22.11.2026):** Sortierung nach
**Gewinn je Tag**, die anderen beiden als weitere Spalten. Begründung: es ist
die einzige der drei Kennzahlen, die das Volumen einrechnet, und damit die,
die ein Produkt mit hoher Marge und drei Verkäufen am Tag nach unten
sortiert. Der erreichbare Anteil am Tagesvolumen ist eine Annahme, kein
Spielwert: als einstellbare Größe führen (Vorgabe 25 %) und so beschriften.

**Abnahme.** Formeln als Tests, drei Zeilen unabhängig nachgerechnet.

**Prüfer.** `rechenkern-pruefer`.

### O5: Von der Gelegenheit zur Tat

**Auftrag.** Kurze Wege aus der Rangliste.

- Zeile → Einkaufsliste (die vorhandene aus v3.12.0, mit Zähler und
  Kopierknopf samt Stufe).
- Zeile → Kostenrechner mit vorbelegtem Item, Stufe und Stadt, um den
  ganzen Rezeptbaum zu prüfen.
- Merkliste für Gelegenheiten, die man verfolgt, mit Preis zum Zeitpunkt des
  Merkens und heutigem Preis.

**Abgrenzung.** Keine neue Rechnung.

**Abnahme.** Jeder Weg in höchstens zwei Klicks, per Tastatur bedienbar,
Stand überlebt Neuladen.

**Prüfer.** `oberflaechen-pruefer`.

### O6: Aufräumen

**Auftrag.**
- `kostenrechner-KONTEXT.md` (921 Zeilen) nach der eigenen Schlankheitsregel
  auf etwa 300 kürzen: ältere Nachträge und die gewachsene Dateistruktur
  unverkürzt nach `kostenrechner-KONTEXT-HISTORIE.md`, Dateistruktur neu als
  knappe Tabelle.
- `js/ui.js` (2.916 Zeilen) in fachliche Teile aufteilen, ohne
  Verhaltensänderung.

**Abgrenzung.** `regeln.js` bleibt, wie es ist. Kein Umbau von Rechenlogik.

**Abnahme.** Selbsttest unverändert grün, Kostenrechner-Reiter im Browser
durchgeklickt, keine Konsolenfehler.

**Prüfer.** keiner; der Hauptagent prüft selbst.

## 6. Bewusst nicht in dieser Runde

- **Markttiefe auf der Einkaufsseite** (aus O4 entstanden): Gewinn/Tag
  zusätzlich durch das erfasste Tagesvolumen der Zutaten begrenzen. Eigenes
  Paket, braucht einen Volumenabruf je Zutat. Bis dahin überschätzt
  Gewinn/Tag Massenware mit dünner Marge.

- Knotenlisten für Tränke, Nebenhände und Kampfhandschuhe (warten auf
  Ablesungen des Nutzers, s. `AUDIT-2026-09-13.md`).
- Die 549 namenlosen Graph-Wurzeln (eigenes Backlog-Paket).
- Zusammenlegen der Abrufschichten von Preisvergleich und Eintopf-Rechner.
- Transportkosten, Reiserisiko, Wartezeit eigener Orders.

## 7. Stand der Pakete

| Paket | Status | Version |
|---|---|---|
| O1 Gemeinsamer Preisbestand | erledigt 22.11.2026 | v3.15.0 |
| O2 Abrufplaner | erledigt 22.11.2026 | v3.16.0 |
| O3 Reiter „Gelegenheiten" | erledigt 22.11.2026 | v3.17.0 |
| O4 Gewinn je Einsatz | erledigt 22.11.2026 (ohne eigene Spalte „je eingesetztem Silber“, das ist die Marge) | v3.18.0 |
| O5 Von der Gelegenheit zur Tat | offen | |
| O6 Aufräumen | offen | |
