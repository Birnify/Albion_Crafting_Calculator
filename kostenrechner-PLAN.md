# Umsetzungsplan: Albion Kostenrechner

Der große Plan für eine neue Web-App: **Auf welchem Weg bekomme ich ein Item auf
einer bestimmten Verzauberungsstufe am günstigsten?**

Dieses Dokument ist der Auftrag. Es wird paketweise abgearbeitet, jedes Paket von
einer frischen Orchestrator-Instanz (s. `../CLAUDE.md`, Abschnitt „Arbeitsablauf").
Der laufende Stand steht in `kostenrechner-KONTEXT.md`, nicht hier; dieser Plan
bleibt weitgehend unverändert stehen und wird nur ergänzt, wenn sich der Auftrag
ändert.

Stand: 2026-09-04 · P0 bis P3 erledigt (v0.3.1), P4-Abnahmekriterien dabei
mit erfuellt. Als Naechstes P5 (Oberflaeche).
Die tagesaktuellen Zahlen stehen in `kostenrechner-KONTEXT.md`, nicht hier.

---

## 1. Ziel

Eine klassische **Make-or-Buy-Entscheidung**, aber über den ganzen Rezeptbaum und
über alle Verzauberungsstufen hinweg.

Beispiel des Nutzers, im Spieldump verifiziert. Die **Königliche Gugel des Adepten**
(`T4_HEAD_CLOTH_ROYAL`) auf Stufe .3:

| Weg | Was dabei passiert |
|---|---|
| Fertig kaufen | `T4_HEAD_CLOTH_ROYAL@3` am Markt |
| Craften auf .3 | 1× Gelehrten-/Kleriker-/Magiergugel **auf .3** + 2× Königliches Siegel |
| Verzaubern von .2 | Königliche Gugel .2 (gekauft oder gebaut) + 96× Relikt |
| Verzaubern von .1 | .1 besorgen, dann 96× Seele **und** 96× Relikt |
| Verzaubern von .0 | .0 besorgen, dann 96× Rune, Seele, Relikt |

Und jede dieser Zwischenstufen hat wieder dieselbe Frage: kaufen oder bauen? Die
Magiergugel .3 lässt sich aus 8× verzaubertem Stoff .3 craften, der Stoff aus
Faser .3 plus T3-Stoff, und so weiter bis zum Rohstoff.

Die App soll diesen Baum vollständig durchrechnen und den **günstigsten Weg samt
Aufschlüsselung** zeigen, nicht nur den Preis, sondern den konkreten Bauplan.

---

## 2. Getroffene Entscheidungen

Vom Nutzer am 04.09.2026 bestätigt. Nicht ohne Rücksprache ändern.

| Frage | Entscheidung |
|---|---|
| **Umfang** | Alles Craftbare, per Suchfeld. Der komplette Rezeptgraph wird eingebettet. |
| **Preise** | Live aus dem Browser gegen `europe.albion-online-data.com`, mit `localStorage`-Zwischenspeicher. |
| **Qualität** | Nur Qualität 1 (Normal), für Ein- und Verkauf. Craft-Qualitätschance wird nicht modelliert. |
| **Fokus** | Ein globaler Wert „Fokus-Effizienz %", dazu eine Ausnahmeliste je Craft-Kategorie. |
| **Stadt** | Alles Lymhurst. Andere Städte sind ausdrücklich v2. |

---

## 3. Was im Client-Dump bereits verifiziert wurde

Am 04.09.2026 gegen `ao-data/ao-bin-dumps` und die Live-API geprüft. Diese Punkte
tragen den ganzen Plan; sie müssen nicht erneut hergeleitet werden.

**Der Graph.** Rund 4.200 Knoten, davon rund 4.050 mit Rezept, als transitive
Huelle des Rezeptgraphen. **Keine Zyklen** (per Tiefensuche geprueft). Die
Rekursion braucht trotzdem einen Besuchsschutz, terminiert aber von Natur aus.
Die genauen Zahlen des jeweils letzten Laufs stehen in `kostenrechner-KONTEXT.md`.

**Alternativrezepte gibt es wirklich.** `craftingrequirements` ist bei 800 Items
eine **Liste** statt eines einzelnen Objekts. Die Königliche Gugel hat drei
Einträge (SET1 Gelehrte / SET2 Kleriker / SET3 Magier), jeder mit
`1× <Gugel> + 2× QUESTITEM_TOKEN_ROYAL_T4`. Genau die „beliebige Gugel" des
Nutzers.

**Zwei Wege je Verzauberungsstufe, beide im Dump.** Unter
`enchantments.enchantment[n]` stehen nebeneinander:

- `craftingrequirements` → direkt auf Stufe n craften, aus verzauberten Materialien
  (`T4_CLOTH_LEVEL3`, 8 Stück, Fokus 2298)
- `upgraderequirements` → aufverzaubern von n−1, z. B. 96× `T4_RELIC`

Die Mengen 96 / 192 / 288 / 384 aus der Excel `Verzaubern Kalkulator.xlsx` des
Nutzers stehen also im Dump und müssen nicht gepflegt werden. Stufe .4 hat **kein**
`upgraderequirements`; die Avalon-Stufe lässt sich nur craften, nicht
hochverzaubern.

**Ausrüstung hat keinen `@itemvalue`.** Nur Rohstoffe und Zwischenprodukte haben
ihn (`T4_CLOTH` = 16, `T4_CLOTH_LEVEL1` = 32, `T4_RUNE` = 1, `T4_SOUL` = 2,
`T4_RELIC` = 4, `QUESTITEM_TOKEN_ROYAL_T4` = 16). Für Waffen und Rüstung muss der
Wert **rekursiv aus den Zutaten aufsummiert** werden, sonst lässt sich die
Stationsgebühr nicht berechnen. Beispiel: `T4_HEAD_CLOTH_SET1` = 8 × 16 = **128**.

**Königliche Items sind reine Umwandlungen.** `T4_HEAD_CLOTH_ROYAL` hat keine
`craftingcategory` und `craftingfocus: 0` → **kein Fokus, keine Rückgewinnung**.
Exakt dasselbe Muster wie die Fischsauce im Eintopf-Projekt. Die `craftingcategory`
ist das Merkmal, das ein Item überhaupt erst einer Rückgewinnungs-Kategorie
zuordnet.

**`@maxreturnamount: 0`** steht an den Zutaten der königlichen Rezepte. Dieses Feld
schließt eine Zutat einzeln von der Rückgewinnung aus und **muss** in den Graph
übernommen werden.

**Runen, Seelen und Relikte sind untereinander umwandelbar.** `T4_SOUL` entsteht
aus 1× `T4_RUNE` + 625 Silber, `T4_RELIC` aus 1× `T4_SOUL` + 2.500 Silber. Damit
steckt selbst im Verzauberungsmaterial eine Make-or-Buy-Entscheidung, die die Excel
des Nutzers heute nicht abbildet. Fällt in der Rekursion automatisch mit ab.

**Deutsche Namen** liefert `formatted/items.json` (12.237 Einträge,
`LocalizedNames.DE-DE`), 0,64 MB als reine Namenstabelle. Gebraucht für das
Suchfeld.

**Der Live-Markt bestätigt den Sinn der App.** Abruf Lymhurst, 04.09.2026:

```
T4_HEAD_CLOTH_ROYAL      sell = 128.986      fertig kaufbar
QUESTITEM_TOKEN_ROYAL_T4 sell =  59.945      2 Stueck = 119.890
T4_HEAD_CLOTH_SET1       sell =   1.831      Summe selbst bauen: 121.721 + Gebuehr
T4_HEAD_CLOTH_ROYAL@2    sell =       0      gar nicht kaufbar, nur Kauforder 92.081
T4_HEAD_CLOTH_ROYAL@3    sell =       0      gar nicht kaufbar
T4_CLOTH_LEVEL1          sell =       0      in Lymhurst nicht angeboten
```

Zwei Lehren daraus, beide hart einzuhalten:

1. Auf höheren Verzauberungsstufen gibt es oft **überhaupt kein Angebot**. Der
   Craft- oder Verzauberungsweg ist dann nicht der billigere, sondern der einzige.
2. **Kein Preis heißt „nicht verfügbar", niemals „kostenlos".** Ein Preis von 0
   muss den Weg sperren, nicht ihn gewinnen lassen.

---

## 4. Rechenmodell

### 4.1 Knoten und Wege

Ein Knoten ist das Paar **(Item, Verzauberungsstufe)**, z. B.
`T4_HEAD_CLOTH_ROYAL@3`. Gesucht ist `kosten(knoten, menge)`: die günstigsten
erwarteten Beschaffungskosten.

Drei Wegearten, alle rekursiv:

**KAUFEN:** `menge × preis`. Preisbasis je nach eingestelltem Handelsweg:

| Weg | Basis | Aufschlag |
|---|---|---|
| Sofortkauf | `sell_price_min` | keiner |
| Eigene Kauforder | `buy_price_max` | + 2,5 % Einstellungsgebühr |

Gesperrt, wenn kein Preis vorliegt oder der Preis älter ist als die eingestellte
Höchstgrenze.

**CRAFTEN:** für **jedes** Alternativrezept der passenden Stufe einzeln
durchrechnen, das beste gewinnt:

```
Chargen        = menge / amountcrafted
Materialkosten = Summe ueber Zutaten:
                 kosten(zutat, zutatstufe, anzahl x Chargen) x (1 - RRR_wirksam)
Fokus          = craftingfocus x Fokuseffizienz x Chargen
Stationsgebuehr= itemWert(item, stufe, rezept) x 0,1125 x Stationssatz / 100 x Chargen
Rezeptsilber   = @silver x Chargen        (z. B. 2.500 bei Seele -> Relikt)
```

`RRR_wirksam` ist 0, wenn das **hergestellte** Item keine `craftingcategory` hat
oder die Zutat `@maxreturnamount: 0` trägt. Sonst gilt die belegte Formel aus
`../CLAUDE.md`:

```
RRR = B / (1 + B)
B   = 0,18  Grundproduktion
    + Stadt-Spezialbonus, nur in der Bonusstadt dieser Warengruppe:
        0,15  beim Craften
        0,40  beim Veredeln
    + 0,59  Fokus                (falls eingesetzt)
    + 0,10 oder 0,20  Tagesbonus (Silber- bzw. Goldtag, per Schalter)
```

Die Zuordnung Warengruppe zu Bonusstadt steht als Tabelle in `../CLAUDE.md`.
Fuer Lymhurst: Craft-Bonus auf Schwert, Bogen, Arkanstab, Lederhelm und
Lederschuhe, Veredelungsbonus auf Faser zu Stoff. Ein Stoffhelm wie die
Koenigliche Gugel bekommt in Lymhurst also **keinen** Craft-Bonus, der Stoff
fuer sie aber sehr wohl den Veredelungsbonus.

**VERZAUBERN:** nur für Stufe ≥ 1 und nur, wenn `upgraderequirements` existiert:

```
kosten(item, stufe-1, menge)
+ Summe ueber Materialien: kosten(material, 0, anzahl x menge)   (Rune/Seele/Relikt)
```

**Sonst nichts.** Verzaubern kostet keine Stationsgebuehr, keinen Fokus und
gewaehrt keine Rueckgewinnung. Vom Nutzer im Spiel bestaetigt am 04.09.2026.

Der vom Nutzer beschriebene Fall „auf .1 kaufen und nur noch Seele + Relikt
brauchen" entsteht dabei von selbst, ohne Sonderbehandlung, er ist einfach die
Kombination aus KAUFEN auf .1 und zweimal VERZAUBERN.

### 4.2 Fokus als zweite Währung

Fokus ist begrenzt und lässt sich nicht in Silber tauschen. Statt zwei getrennte
Rechnungen zu führen („mit Fokus" / „ohne Fokus"), bekommt der Nutzer ein Feld
**„Was ist mir ein Fokuspunkt wert?"** in Silber. Minimiert wird dann

```
Zielwert = Silber + Fokus x Fokuswert
```

Das entscheidet **pro Craft-Schritt** richtig, wo sich Fokus lohnt und wo nicht,
bei einem tiefen Baum ist das genau die Frage, die man von Hand nicht mehr
beantworten kann. Der Nutzer kennt seinen Silber-je-Fokus-Wert bereits aus dem
Eintopf-Rechner (Kennzahl „bestes Silber je Fokus").

Ausgegeben werden trotzdem beide Größen getrennt: Silber **und** verbrauchter
Fokus.

### 4.3 Verkaufsseite

Fällt fast geschenkt ab, weil „fertig kaufen" ohnehin einer der Wege ist:

```
Gewinn = Verkaufserloes - guenstigste Beschaffungskosten
```

| Weg | Basis | Abzüge |
|---|---|---|
| Sofortverkauf | `buy_price_max` | − Steuer |
| Eigene Verkaufsorder | `sell_price_min` | − Steuer − 2,5 % Einstellungsgebühr |

Steuer 4 % (Premium ist aktiv). Voreinstellung wie beim Eintopf: **Einkauf direkt,
Verkauf über eigene Verkaufsorder**.

### 4.4 Bewusste Vereinfachungen in v1

- Mengen werden **stetig** gerechnet, nicht auf ganze Chargen gerundet. Bei
  `amountcrafted > 1` (Rohstoffe, Runen) weicht das leicht ab. In der Ausgabe als
  Hinweis kennzeichnen.
- Die Rückgewinnung wird als **Erwartungswert** verrechnet (`× (1 − RRR)`), nicht
  als Zufallsprozess. Genau wie im Eintopf-Rechner.
- **Markttiefe fehlt.** Die API nennt nur den besten Preis, nicht die Stückzahl
  dahinter. Bei Ausrüstung weniger dramatisch als bei Fisch (man kauft ein Stück,
  nicht 600), bei Runen, Seelen und Relikten in Hunderterstückzahlen aber sehr wohl
  relevant. Behelf: Tagesumsatz aus `history` daneben anzeigen und warnen.

---

## 5. Architektur

Ein Python-Bauskript erzeugt die Datenbasis, die App selbst ist eine eigenständige
HTML-Datei, die per Doppelklick läuft und die Preise selbst holt.

```
Kostenrechner/
  build_graph.py            Python. Laedt die Dumps, erzeugt rezepte.js. Selten noetig.
  rezepte.js                Erzeugt. Rezeptgraph + deutsche Namen. ca. 2 MB.
  js/preise.js              API-Schicht: Abruf, Drosselung, localStorage-Cache
  js/rechenkern.js          kosten() - reine Funktionen, kein DOM
  js/regeln.js              RRR, Stationsgebuehr, Steuer, Fokus, Kategorie->Station
  js/ui.js                  Suchfeld, Ergebnisbaum, Einstellungen
  Kostenrechner.html        Die App. Laedt rezepte.js + js/*.
  tests/test.html           Testsuite, per Doppelklick, gruen = OK
  Versionen/                Schnappschuesse je Version (SemVer)
  kostenrechner-PLAN.md     Dieses Dokument
  kostenrechner-KONTEXT.md  Lebender Arbeitsstand + Backlog
```

**Anders als beim Eintopf-Rechner wird die App nicht als ein einziger
Python-String erzeugt.** Der `TEMPLATE`-String in `eintopf_update.py` ist auf
1.823 Zeilen gewachsen und enthält Backticks, die jede Shell zerlegen, jeder Patch
musste über ein Hilfsskript im Scratchpad laufen. Hier sind HTML und JS echte
Dateien, die sich direkt bearbeiten lassen. Python erzeugt nur `rezepte.js`.

---

## 6. Arbeitspakete

Jedes Paket ist einzeln abnehmbar und hat ein prüfbares Ergebnis. Die Reihenfolge
ist bindend, weil jedes auf dem vorigen aufbaut.

### P0: Projektrahmen ✔ erledigt 04.09.2026

Ordner, Kontextdatei, Agenten, Skill, Regeln in `../CLAUDE.md`. Siehe
`kostenrechner-KONTEXT.md`.

### P1: Rezeptgraph erzeugen

`build_graph.py` lädt `items.json` (17 MB) und `formatted/items.json` von
`ao-data/ao-bin-dumps` und schreibt `rezepte.js`.

Je Knoten zu übernehmen: `@tier`, `@craftingcategory`, `@itemvalue`, alle
Basisrezepte, alle Verzauberungsstufen mit Craft- **und** Upgrade-Rezept. Je Zutat:
Name, Anzahl, `@enchantmentlevel`, `@maxreturnamount`. Je Rezept:
`@craftingfocus`, `@silver`, `@amountcrafted`.

Zusätzlich abzuleiten und mit auszugeben:

- **ItemValue für Items ohne `@itemvalue`**: rekursiv aus dem ersten Rezept. Bei
  mehreren Rezepten prüfen, ob alle denselben Wert ergeben, und Abweichungen
  melden.
- Liste aller Zutaten **ohne Marktpreis-Aussicht** (Arena-Kristalle, GvG-Marken,
  Fraktionsmarken) für die spätere Eigenpreis-Pflege.

**Abnahme:**

- `T4_HEAD_CLOTH_ROYAL` hat genau 3 Basisrezepte, jedes mit
  2× `QUESTITEM_TOKEN_ROYAL_T4`.
- `T4_HEAD_CLOTH_SET1` hat 4 Verzauberungsstufen; Upgrade-Materialien sind
  96× `T4_RUNE`, 96× `T4_SOUL`, 96× `T4_RELIC`, Stufe 4 hat keins.
- `ItemValue(T4_HEAD_CLOTH_SET1)` = 128, `ItemValue(T4_HEAD_CLOTH_ROYAL)` = 160.
- Der Graph ist zyklenfrei; das Skript prüft das selbst und meldet es.
- Das Bauskript läuft ohne Handgriffe durch und meldet Knotenzahl und Dateigröße.

### P2: Preisschicht

`js/preise.js`. Alles, was im Eintopf-Projekt an der API weh getan hat, ist hier
schon bekannt und muss nicht neu gelernt werden:

- Realm **`europe.`**. `www.` ist Amerika und liefert stillschweigend falsche
  Preise.
- Sequenziell, nie parallel. Rund 1,5 s Pause zwischen Blöcken, bei HTTP 429 mit
  wachsender Wartezeit erneut (`1,5 × 2ⁿ`). Parallele Blöcke laufen zuverlässig ins
  Limit.
- Blockgröße 50 Item-IDs, wie im Eintopf-Rechner erprobt.
- `prices/` liefert das Feld **`city`**, `history/` liefert **`location`**.
- CORS ist offen, Abruf aus einer `file://`-Seite funktioniert.

Dazu neu:

- **Zwischenspeicher in `localStorage`** mit Zeitstempel je Item und einer
  Schema-Version. Vorschlag: 30 Minuten Gültigkeit, per Knopf erzwungen
  erneuerbar. Die Schema-Version bei jeder Datenformat-Änderung hochzählen, im
  Eintopf-Projekt hat genau das einmal alte Daten über frische geschrieben.
- **Preisalter sichtbar machen** und eine einstellbare Höchstgrenze. Bei
  Ausrüstung sind Preise oft Tage alt; das ist der Unterschied zwischen einer
  Rechnung und einer Fantasie.
- **Eigenpreis-Hinterlegung** je Item für alles, was nicht handelbar ist.
- Fortschrittsanzeige beim Abruf. Ein Baum kann 50 bis 200 IDs brauchen, das
  dauert.

**Abnahme:** Der Baum der Königlichen Gugel .3 wird vollständig geladen, kein
einziger 429-Abbruch, der zweite Aufruf kommt ohne Netzzugriff aus dem
Zwischenspeicher.

### P3: Rechenkern

`js/rechenkern.js` und `js/regeln.js`. Reine Funktionen, kein DOM, damit sie
testbar bleiben.

- `kosten(item, stufe, menge, opts)` mit Memoisierung über
  `item|stufe|mitFokus`, Besuchsschutz gegen Zyklen, Tiefenbegrenzung.
- Rückgabe: `{ silber, fokus, weg }`, `weg` ist der vollständige Bauplan als
  Baum, nicht nur eine Zahl. Ohne den Bauplan ist das Ergebnis wertlos.
- **Alle** Wege sammeln und sortiert zurückgeben, nicht nur den besten. Der Nutzer
  will sehen, wie weit Platz 2 entfernt liegt, genau wie in der
  „alle Strategien"-Aufklappliste des Eintopf-Rechners.
- Kategorie-zu-Station-Zuordnung in `regeln.js` als gepflegte Tabelle. Der Dump
  hat 43 `craftingcategory`-Werte: `arcanestaff, axe, bag, bow, cape, cloth_armor,
  cloth_helmet, cloth_shoes, crossbow, cursestaff, dagger, fiber, firestaff, food,
  froststaff, gatherergear, hammer, hide, holystaff, knuckles, leather_armor,
  leather_helmet, leather_shoes, mace, meat_chicken, meat_cow, meat_goat,
  meat_goose, meat_pig, meat_sheep, naturestaff, offhand, ore, plate_armor,
  plate_helmet, plate_shoes, potion, quarterstaff, rock, spear, sword, tools,
  wood`. Die Zuordnung zum Gebäude (Kriegerschmiede, Magierturm, Jägerhütte,
  Veredelung) steht seit 04.09.2026 als belegte Tabelle in `../CLAUDE.md`,
  Abschnitt „Craft-Kategorie zu Gebäude“. Nicht neu herleiten. Die dort
  genannten drei Sonderfälle (`offhand`, `knuckles`, `meat_*`) bekommen eigene
  Gebührengruppen statt einer erfundenen Zuordnung.

**Abnahme:** siehe P4, der Kern gilt erst mit grüner Testsuite als fertig.

### P4: Testsuite

`tests/test.html`, per Doppelklick, grün/rot wie beim Pizza-Rechner. Mindestens:

- Stationsgebühr gegen den belegten Eintopf-Wert: ItemValue 5.760 → 648 Nahrung →
  2.462 Silber bei Satz 380.
- RRR-Tabelle: B = 0,18 → 15,3 %; 0,33 → 24,8 %; 0,77 → 43,5 %; 1,17 → 53,9 %.
- Steuer und Einstellungsgebühr gegen die abgelesenen Marktfenster-Werte:
  1.751.184 → 70.047 Steuer und 43.780 Gebühr.
- Kein Preis ⇒ Weg gesperrt, **nicht** Kosten 0.
- Königliche Gugel: Rückgewinnung greift nicht (keine `craftingcategory`),
  Fokus 0.
- Ein von Hand nachgerechneter Vollfall über zwei Ebenen mit festen Preisen.
- Die Rekursion terminiert bei einem künstlich eingebauten Zyklus.

### P5: Oberfläche

`Kostenrechner.html` + `js/ui.js`. Aufbau in Anlehnung an den Eintopf-Rechner,
dessen Bedienlogik der Nutzer kennt und mag:

- **Suchfeld** über die deutschen Namen, dazu Stufe (T1 bis T8) und Verzauberung
  (.0 bis .4).
- **Ergebnis oben**: günstigster Weg, Kosten, verbrauchter Fokus, und falls das
  Item verkäuflich ist der Gewinn.
- **Bauplan als aufklappbarer Baum**: je Ebene, welcher Weg gewählt wurde, was er
  kostet, und was die Alternative gekostet hätte.
- **Alle Wege** als sortierte Tabelle darunter.
- **Einstellungen** in drei Blöcken wie beim Eintopf: Charakter und Station
  (Fokus-Effizienz global plus Ausnahmen, Fokuswert in Silber, Stationssätze je
  Gebäude, Tagesbonus), Handel (Kaufweg, Verkaufsweg, Premium), Beschaffung
  (Höchstalter der Preise, Eigenpreise).
- Erklärungen gehören in `title`-Tooltips, nicht in Erklärkästen. Gleichartige
  Felder gleich groß und ausgerichtet. Konstanten, die sich nie ändern, gehören in
  den Code und nicht ins Formular.

### P6: Beschaffung nicht handelbarer Zutaten

Eigenpreis-Pflege für Arena-Kristalle, GvG-Marken, Fraktionsmarken, und überall
dort, wo der Nutzer einen eigenen Höchstpreis setzen will. Speicherung in
`localStorage`. Entspricht dem Feld „Max. Silber je Fischstückchen" im
Eintopf-Rechner.

### P7: Härtung und Abschluss

Kontextdatei schlank, Versions-Schnappschuss, Testsuite grün, `.bat` zum Öffnen,
Vergleichsrechnung der Königlichen Gugel gegen eine Handrechnung des Nutzers.

---

## 7. Fallen aus dem Eintopf-Projekt

Fehler, die dort Zeit gekostet haben und hier nicht noch einmal passieren dürfen.

| Falle | Gegenmittel |
|---|---|
| **Falscher Realm.** `www.` liefert Amerika-Preise ohne Fehlermeldung. Fisch kostete dort 4.798 statt 5.419. | `europe.` fest verdrahtet und im Code kommentiert. |
| **Rate-Limit.** Parallele Blöcke laufen zuverlässig in HTTP 429. | Sequenziell, 1,5 s Pause, wachsende Wartezeit bei 429. |
| **`city` gegen `location`.** Zwei Endpunkte, zwei Feldnamen für dieselbe Sache. | In `preise.js` einmal normalisieren. |
| **Alter Zwischenspeicher überschreibt frische Daten.** Ist im Eintopf-Projekt passiert. | Schema-Version bei jeder Formatänderung hochzählen. |
| **Fehlender Preis als 0 gewertet.** Macht den teuersten Weg zum vermeintlich besten. | Kein Preis ⇒ Weg gesperrt. Als Test verankert. |
| **Rückgewinnung angenommen, wo es keine gibt.** Fischsauce hat keine `craftingcategory`, königliche Items genauso. | RRR nur bei vorhandener `craftingcategory` und `@maxreturnamount ≠ 0`. |
| **`@nutrition` aus dem Dump als Craft-Aufwand missdeutet.** Das ist der Fütterungswert. | Stationsgebühr immer aus ItemValue × 0,1125. |
| **`upgraderequirements` bei Speisen als Aufwertungspfad missdeutet.** Existiert dort im Spiel nicht. | Bei **Ausrüstung** existiert er sehr wohl, hier also nutzen, aber im Spiel gegenprüfen. |
| **Bestpreis statt Mischkalkulation.** Der günstigste Anbieter hat oft nur 10 Stück. | Tagesumsatz aus `history` daneben stellen und warnen. |
| **Riesiger `TEMPLATE`-String in Python.** Backticks zerlegen jede Shell, jeder Patch braucht ein Hilfsskript. | HTML und JS als echte Dateien. Python erzeugt nur Daten. |
| **Nur den Code gelesen statt die gerenderte Seite geprüft.** Mehrere Fehler fielen erst im Browser auf. | Nach jeder Änderung im Browser gegenprüfen. |

---

## 8. Ausdrücklich nicht in v1

Damit sie nicht durch die Hintertür wieder auftauchen.

- **Andere Städte als Lymhurst.** Weder Einkauf noch Verkauf noch Craft. Transport
  und Schwarzzonen-Risiko wären ohnehin unmodelliert.
- **Qualitätsstufen** über Normal hinaus, und die Qualitätschance beim Craften.
- **Wartezeit und Ausfallrisiko eigener Orders.**
- **Craft-Fame und Spezialisierungsaufbau** als Nutzen. Die App rechnet Silber,
  nicht Fortschritt.
- **Ernte, Farmen, Inseln.** Nur Markt und Werkbank.
- **Mengenrabatt durch ganze Chargen.** Stetige Mengen, s. 4.4.

---

## 9. Geklärte und offene Spielwerte

Stand 04.09.2026. Was der Nutzer bestätigt oder was belegt recherchiert wurde,
steht in `../CLAUDE.md` und gilt als gesetzt.

### Geklärt

1. **Verzaubern kostet nichts.** Keine Stationsgebühr, kein Fokus, keine
   Rückgewinnung. Verbraucht werden nur Rune, Seele und Relikt. Vom Nutzer im
   Spiel bestätigt. Der VERZAUBERN-Weg in Abschnitt 4.1 vereinfacht sich damit auf
   `kosten(item, stufe-1) + Materialkosten`.
2. **Stationssätze sind keine Konstanten.** Der Besitzer setzt sie, sie
   unterscheiden sich je Gebäude und ändern sich laufend. Gehören als
   Eingabefeld je Gebäude in die Oberfläche, mit Speicherung in `localStorage`.
3. **Stadtboni je Warengruppe** stehen als Tabelle in `../CLAUDE.md`. Für den
   Kostenrechner wichtig: Craft-Bonus **+0,15**, Veredelungs-Bonus **+0,40**. Die
   Königliche Gugel ist ein Stoffhelm und bekommt in Lymhurst **keinen**
   Craft-Bonus (das wäre Thetford), der Stoff für sie wird in Lymhurst aber mit
   **+0,40** veredelt. Die Zuordnung Kategorie zu Bonus gehört fest in
   `regeln.js`, nicht als Eingabefeld.
4. **ItemValue** ist eine Funktion von (Item, Verzauberungsstufe, Rezept), nicht
   des Items allein, und wird durch `amountcrafted` geteilt. Herleitung und Belege
   in `../CLAUDE.md`. Damit erübrigt sich die frühere Frage, welcher der beiden
   Werte bei Alternativrezepten gilt: **beide**, je nachdem, welches Rezept
   gerechnet wird. Die Gebühr hängt am tatsächlich verwendeten Weg.

### Daraus folgende Korrekturen an P1, in P3 mit zu erledigen

Beides in der Hauptsitzung am 04.09.2026 nachgewiesen, nicht vermutet:

- **`iv` in `rezepte.js` ist nur die Basisstufe** und für 61 Items zusätzlich um
  den Faktor `amountcrafted` zu groß. Nachweis: `T8_MEAL_STEW` trägt dort 5.760,
  der im Spiel abgelesene Gegenstandswert ist 576. Gegenprobe nach oben:
  Gelehrtensandalen T4.1 müssen 256 ergeben (Fremdquelle bestätigt), der
  gespeicherte Knotenwert nennt 128.
- **Zutaten, die selbst Ausrüstung sind, werden mit ihrem Basiswert gerechnet.**
  Die Königliche Gugel kommt dadurch auf allen vier Stufen auf 160, obwohl auf .3
  eine verzauberte Gugel im Wert von 1.024 verbaut wird. Richtig wären 1.056.
- **Konsequenz:** `iv` am Knoten taugt nur noch als Rohwert für Blätter, die ihn
  direkt aus dem Dump haben. Der Rechenkern braucht ein eigenes
  `itemWert(item, stufe, rezept)`, das rekursiv auflöst und dabei die Stufe der
  Zutat berücksichtigt.

### Offen, vom Nutzer einzutragen

5. **Fokus-Effizienz je Craft-Kategorie.** Trägt der Nutzer selbst ein, global
   plus Ausnahmeliste wie in Abschnitt 2 entschieden.

   **Eingabe besser über FCE statt über Prozent.** Die belegte Formel in
   `../CLAUDE.md` lautet `Fokus = Grundfokus × 0,5 ^ (FCE / 10.000)`. Der
   Prozentwert ist damit nur eine andere Schreibweise derselben Größe, aber die
   FCE ergeben sich direkt aus den Stufen am Schicksalsbrett
   (Meisterschaftsstufen × 30 + Spezialisierungsstufe des Items × 250) und sind
   deshalb leichter richtig einzutragen. Vorschlag für P5: ein Feld, zwei
   Eingabearten, die App rechnet ineinander um und zeigt beides an. Ein dritter
   Weg als Bequemlichkeit: der Nutzer trägt den im Craft-Fenster **abgelesenen**
   Fokuswert ein, die App rechnet die FCE per `FCE = −log2(abgelesen /
   Grundfokus) × 10.000` selbst aus.

   ⚠️ Beim Eintopf-Rechner steht ein ungeklärter Widerspruch zwischen der
   angegebenen Maximalspezialisierung und den gemessenen 93,16 %, s. `../CLAUDE.md`,
   Abschnitt Spielerprofil. Falls die Fokuszahlen später nicht aufgehen, dort
   zuerst nachsehen.
6. **Tagesbonus.** +0,10 am Silbertag, +0,20 am Goldtag, rotiert je Stadt und
   Warengruppe. Über keine Schnittstelle abfragbar, nur im Spiel auf der
   Stadtkarte ablesbar. **Empfehlung: ein Dreifach-Schalter (aus / Silbertag /
   Goldtag) je Craft-Schritt-Art**, kein Versuch, die Rotation nachzubauen. Ein
   Kalender wäre geraten statt gewusst, und ein falscher Tagesbonus verschiebt die
   Rückgewinnung um bis zu neun Prozentpunkte.
7. **Zählt `@preservequality: true` für uns?** Nur relevant, falls Qualität später
   doch modelliert wird. Für v1 ohne Belang, aber im Graph mitgeführt.

## 10. Wie der Plan abgearbeitet wird

Ein Paket = ein Zyklus = eine frische Orchestrator-Instanz. Der Ablauf steht in
`../CLAUDE.md`. Kurzform:

1. Der Hauptagent startet `albion-cycle-orchestrator` per `Agent`-Tool mit **genau
   einem** Paket aus Abschnitt 6.
2. Der Orchestrator klärt in Phase 1 die offenen Punkte mit dem Nutzer, setzt dann
   Phase 2 bis 5 selbstständig durch bis zum abgenommenen Ergebnis.
3. Er aktualisiert `kostenrechner-KONTEXT.md`, legt einen Versions-Schnappschuss an
   und beendet seine Runde mit einer Abschluss-Zusammenfassung.
4. Für das nächste Paket startet der Hauptagent eine **neue** Instanz. Nicht
   dieselbe weiterlaufen lassen, der Grund steht in `../CLAUDE.md`.
