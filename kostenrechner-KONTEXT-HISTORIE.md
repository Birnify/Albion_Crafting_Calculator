# Kontext-Historie: Albion Kostenrechner

Diese Datei sammelt die vollständigen "Aktueller Stand"-Abschnitte, die aus
`kostenrechner-KONTEXT.md` ausgelagert wurden, sobald die Hauptdatei über etwa
300 Zeilen wuchs. Nichts wird gekürzt, nur verschoben - s. Regel dort unter
"Entwicklungsweise / Mitarbeit". Neueste Auslagerung zuerst.

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
