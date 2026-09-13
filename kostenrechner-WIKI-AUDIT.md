# Wiki-Audit der Spielregel-Annahmen

Stand: 2026-09-13 · Prüfstand: v3.1.2 · **Kein Code geändert**, reine Prüfung.
Die handlungsrelevanten Punkte stehen zusätzlich als Backlog-Einträge in
`kostenrechner-KONTEXT.md`, Abschnitt „Befunde aus dem Wiki-Audit".

## Auftrag und Vorgehen

Auftrag: die ganze App auditieren und jede Annahme, die bisher nur Annahme ist,
gegen das Wiki absichern; nichts am Code ändern, Auffälligkeiten in den Backlog.

Geprüft wurden alle Zahlen und Regeln aus `js/regeln.js`, `js/rechenkern.js`,
`js/preise.js`, `js/eintopf-daten.js`, `js/eintopf-rechenkern.js`,
`js/eintopf-preise.js` und `build_graph.py`. Zwei Prüfwege:

1. **Wiki/Forum.** Siehe die Einschränkung unten.
2. **Gegenprobe am offiziellen Client-Dump** (`rezepte.js`, erzeugt aus
   ao-data/ao-bin-dumps). Damit ließen sich mehrere Annahmen unabhängig vom
   Wiki prüfen oder widerlegen — die Befunde A3, A5, A6 und die Bestätigung
   von maxreturnamount stammen daraus.

### Einschränkung: das Wiki war nicht direkt abrufbar

`wiki.albiononline.com` (und jede andere Albion-Domain) ist aus dieser Sitzung
nicht direkt ladbar: die Egress-Richtlinie der Ausführungsumgebung blockiert
den Abruf („Access to wiki.albiononline.com is blocked by the network egress
proxy"). Die Belege unten stammen deshalb aus **Websuche-Auszügen der
Wiki-Seiten**, nicht aus der gelesenen Seite selbst. Für eindeutige,
mehrfach übereinstimmend zitierte Zahlen (Steuer, Gebührenformel,
Produktionsboni, Stadtlisten, FCE-Werte) reicht das; für Tabellen, die im
Auszug nicht vollständig auftauchen (Reroll-Übergänge, Qualitäts-Basiszeile),
ausdrücklich **nicht** — diese Punkte stehen unten unter „offen".

---

## 1. Bestätigt, kein Handlungsbedarf

| Annahme im Code | Wert | Belegt durch |
|---|---|---|
| Stationsgebühr = ItemValue × 0,1125 × Satz/100 | `STATIONSGEBUEHR_FAKTOR 0.1125` | Wiki *Building*: „Nutrition used per item = Item Value × 0.1125"; Forum-Feature-Dive *Usage Fee and Crafting Changes*: Gebühr je 100 verbrauchter Nahrung, Beispiel 4.1-Sandalen ItemValue 256 bei Satz 1000 → 288 Silber |
| Marktsteuer 4 % mit Premium, 8 % ohne | `STEUER_PREMIUM/OHNE` | Wiki *Marketplace* |
| Einstellgebühr 2,5 %, auf Kauf- wie Verkaufsorder | `EINSTELLGEBUEHR_SATZ` | Wiki *Marketplace*: „2.5 % of the listed price, paid whenever a buy or sell order is created or updated" |
| RRR = B/(1+B) | `rrr()` | Wiki *Resource return rate*: 1 − 1/(1 + B) — algebraisch identisch |
| Grundproduktion 18 % | `RRR_GRUNDPRODUKTION` | Wiki *Local Production Bonus*: „Baseline royal cities have 18 % refining and crafting production bonus" |
| Craft-Stadtbonus +15 %, Veredeln-Stadtbonus +40 % | `RRR_STADTBONUS_CRAFT/_VEREDELN` | ebd.: „specializations that add 40 % bonus to refining or 15 % to crafting"; Gegenprobe Lymhurst Stoff 58 % → 36,7 % RRR, exakt der Wert aus dem Selbsttest in `regeln.js` |
| Fokus +59 % | `RRR_FOKUSBONUS` | Wiki *Resource return rate* |
| Tagesbonus +10 % / +20 % | `RRR_TAGESBONUS_SILBER/GOLD` | Wiki *Resource return rate* / *Dynamic Events*: zwei Kategorien je Tag mit 10 % oder 20 % |
| Fokusbedarf halbiert sich je 10.000 FCE | `FOKUS_HALBIERUNG_FCE` | Wiki *Crafting Focus* |
| Spezialisierungsknoten: 250 unique + 30 mutual je Stufe | `SPEZ_TYP.waffen_ruestung/veredeln` | Wiki *Specializations*: „unique 250 … mutual 30 … total 280 per level (28.000 auf Stufe 100)" |
| Meisterschaft 30 FCE je Stufe | `mastery: 30` | Forum-Formel: `0.5^((Meisterschaftsstufe × 0,3 + …)/100)` — 0,3 × 100 = 30 FCE |
| Umhangknoten 370 FCE je Stufe, kein Mutual | `SPEZ_TYP.umhang` | Wiki *Specializations*: „370 focus cost efficiency bonus for each specialization node level (37.000 auf Stufe 100)" |
| Koch 55.000 / Alchemist 52.000 FCE maximal | Kommentar in `regeln.js` | Wiki *Specializations* |
| Veredeln: ein Knoten **je Tier** (T4…T8), nicht je Verzauberungsstufe | `gruppenSchluesselVonItem()` | Wiki *Specializations*: voll ausgebaut 40.000 FCE je Veredelung = 25.000 eigener Unique + 12.000 Mutual aus **vier** anderen Knoten + 3.000. Die Vier bestätigt genau die Fünfer-Gruppierung nach Tier |
| Qualitäts-Basistabelle 68,9 / 25 / 5 / 1 / 0,1 % | `QUALITAETSWURF_BASIS` | Wiki *Quality* (aber siehe D2: zweite Fassung im Umlauf) |
| Verzaubern ohne Rückgewinnung | `verzaubernKandidat()` rechnet Material ohne (1 − RRR) | Forum/Wiki *Enchanting*: „For enchanting you don't get resource return" |
| Artefaktgießerei-Verschmelzung ist kein 1:1-Rezept | `is_gambling_recipe()` | Wiki *Artifact Foundry#Melding* |
| Metzgern ergibt 18 Fleisch je Tier | Dump `a:18` bei `T8_MEAT` | Wiki *Butcher (Building)*: „Every animal is butchered into 18 raw meat of the corresponding tier" |
| maxreturnamount ist binär (0 oder unbegrenzt) | `zutat.m === 0 ? 0 : rrrWert` | **Eigene Gegenprobe am Dump**: 28.001 Zutateneinträge, Werte ausschließlich `0` (9.786×) oder gar nicht gesetzt (18.215×); Verzauberungsmaterialien nie mit `m`. Die binäre Behandlung ist damit vollständig |
| Stadtboni Lymhurst, Fort Sterling, Bridgewatch, Martlock, Thetford, Caerleon | `STADTBONUS` | Wiki-Stadtseiten, wortgleich inkl. Caerleon (Sammlerausrüstung, Kampfhandschuhe, Werkzeug, Speisen) |
| Eintopf-Rezept T8_MEAL_STEW | 36 Kürbis / 36 Brot / 72 Fleisch → 10 Stück, Fokus 551 bzw. 752/1.152/2.353, 90 Sauce je Charge | **Dump-Gegenprobe**: exakt identisch |
| Saucenrezepte 15/45/135 Stückchen + 1/3/9 Seegras | `EINTOPF_DATEN.SAUCE` | **Dump-Gegenprobe**: identisch |
| ItemValue 40 für Kürbis/Brot/Rind, 0 für Fischsauce | `EINTOPF_DATEN.ITEM_VALUE` | **Dump-Gegenprobe**: identisch; Nahrung je Charge 5.760 × 0,1125 = 648 ✔ |

## 2. Auffälligkeiten mit Rechenwirkung (A)

### A1 · `shapeshifterstaff` fehlt in der Gebäudetabelle

`KATEGORIE_ZU_GEBAEUDE` kennt 43 Kategorien, der Graph enthält 44. Nicht
abgedeckt: `shapeshifterstaff` mit **41 craftbaren Knoten** (Pirschstab,
Blutmondstab, Erdrunenstab …). Folge in `craftKandidat()`:
`gebaeudeVonKategorie()` → `null` → `stationssatzFuer(null)` liefert
`{satz: 0, gepflegt: true}` → **keine Stationsgebühr, und der Weg wird nicht
als unvollständig markiert** (die Warnung hängt an `gebaeude != null`). Der
Nutzer sieht also einen zu billigen Craft-Weg ohne jeden Hinweis.
Wiki (*Shapeshifter Crafter*, *Category:Shapeshifter Staff*): Gestaltwandler-
Stäbe werden in der **Jägerhütte** hergestellt. Ebenso fehlt die Kategorie in
`KATEGORIE_ZU_SPEZTYP` (fällt auf Freitext-FCE zurück) und in jedem
`STADTBONUS`-Eintrag (ob es dort einen Bonus gibt, ist ungeprüft).

### A2 · 141 craftbare Rezepte ohne craftingcategory zahlen nie Gebühr

Im Graph haben 1.926 Knoten ein Rezept, aber keine `craftingcategory`;
**141 davon kosten Fokus** — Reittiere (`T4_MOUNT_HORSE` …), Möbel
(`T4_FURNITUREITEM_BED`, Truhen, Tische), Reparatursätze. Dieselbe Mechanik wie
A1: kein Gebäude → keine Gebühr, keine Unvollständig-Warnung; zusätzlich
`rrr({cc: null})` = 0, also auch keine Rückgewinnung.
Wiki: Reittiere werden am **Sattler** hergestellt, Möbel am **Werkzeugmacher**
(„All craftable Furniture can be made in the Toolmaker"), beide Gebäude haben
Nahrung und damit eine Nutzungsgebühr. Für königliche Items (50 Knoten, alle
ohne cc) ist die Null-Rückgewinnung dagegen korrekt: deren Zutaten tragen
ohnehin ausnahmslos `m:0`.

### A3 · 517 craftbare Knoten haben ItemValue 0 — Reroll wird dadurch gratis

`derive_itemvalues()` in `build_graph.py` bricht die Ableitung eines
ItemValues **komplett ab**, sobald eine einzige Zutat keinen Wert hat
(`ok = False` → keine Kandidaten → `iv` bleibt ungesetzt). Im Dump haben 86
Zutaten-Knoten kein `@itemvalue` (Arkanes Extrakt, Foliant der Einsicht,
Schattenklauen, Sylvanierwurzel, Geisterpfoten, Werwolfzähne, Schneeball …),
zusammen 566 Referenzen. Ergebnis: **517 von 3.576 craftbaren Knoten liefern
`REGELN.itemWert(...) === 0`**, davon 66 mit craftingcategory:
36 Gestaltwandler-Stäbe, 24 Tränke, 5 Tornister der Einsicht, 1 Speise
(Jungdrachenei-Kekse).

Zwei getrennte Folgen:

* **Reroll kostet 0 Silber.** `rerollKandidat()` ruft `itemWert(item, stufe,
  undefined, graph)` **ohne** Rezept auf; ohne `iv`/`ivd` liefert
  `itemWertIntern()` dann `node.iv || 0` = 0, und
  `rerollKostenZuQualitaet(0, 2, 0)` gibt `{silber: 0, gesperrt: false}`
  zurück. Für diese Items gewinnt der Reroll-Weg jede Qualitätsrechnung mit
  Kosten null. Gegenprobe mit einem gesunden Item (T4-Stoffgugel, ItemValue
  128): 1.367,77 Silber auf Herausragend.
* **Stationsgebühr zu niedrig.** Im Craft-Weg wird das Rezept übergeben, der
  Wert also aus den Zutaten gerechnet — die wertlosen Zutaten zählen dabei mit
  0. Beispiel Pirschstab des Adepten: 20 Bretter à 16 + 12 Leder à 16 = 512,
  die 2 Schattenklauen tragen 0 bei.

Wiki *Item Value*: „The Item Value reflects how much value the resources that
were used to craft an item totals" — die Ableitung ist im Ansatz richtig, es
fehlen nur die Blattwerte.

### A4 · Eintopf-Reiter rechnet immer mit Lymhurst-Rückgewinnung

`EINTOPF_RECHENKERN` verdrahtet `RET_OHNE = 0.152` und `RET_MIT = 0.435` fest
(Kommentar: „am Kochtopf in Lymhurst, kein Stadtbonus auf Speisen"), die
Craft-Stadt ist im Reiter aber frei wählbar (`etCraftStadt`, alle sieben
Städte). Caerleon hat laut Wiki **Speisen +15 %** — dort gilt B = 0,33 ohne
und 0,92 mit Fokus, also 24,8 % / 47,9 % statt 15,2 % / 43,5 %. Der Reiter
rechnet Caerleon damit systematisch zu teuer. Der Tagesbonus (+10/+20 %), den
der Kostenrechner kennt, fehlt im Eintopf-Reiter ganz.

### A5 · Drei Fische fehlen in der Eintopf-Fischliste

Das Dump-Rezept von `T1_FISHCHOPS` kennt 41 Fische, `EINTOPF_DATEN.FISH_ROH`
nur 38. Es fehlen `T3/T5/T7_FISH_FRESHWATER_DRAGON_AREA_RARE` (Unbekümmerte /
Lichtseelen- / Drachengebundene Leyflosse, 10/20/30 Stückchen). Mengen und
IDs der übrigen 38 stimmen exakt. Folge: die „günstigste Stückchen-Quelle"
und die Schmerzgrenze können eine real verfügbare, billigere Quelle übersehen.

### A6 · Eintopf-Reiter kennt den Aufwertungs-Pfad des Dumps nicht

`eintopf-rechenkern.js` schließt ihn ausdrücklich aus („Kein Upgrade-Pfad: die
Verzauberungsstufe wird beim Kochen gewählt"). Der Dump führt für
`T8_MEAL_STEW` je Stufe aber ein `upgraderequirements` von **9 Fischsaucen je
Eintopf**. Rechnerisch entspricht das den 90 Saucen je Zehner-Charge, die Wege
sind trotzdem nicht gleichwertig: beim Kochen wirkt die Rückgewinnung auf die
Sauce, beim Aufwerten laut Wiki nicht. „Fertige .0-Eintöpfe kaufen und
aufwerten" wird deshalb nie bewertet — der Kostenrechner-Reiter kann genau
diesen Weg.

### A7 · Eintopf-Datumsauswertung ohne Zonenprüfung

`eintopf-preise.js/alterTage()` hängt das `Z` bedingungslos an
(`new Date(iso + "Z")`). Der Kostenrechner löst dasselbe Problem in
`REGELN.parseApiDatumUtc()` sauber (prüft erst, ob schon eine Zone dransteht).
Solange die API ohne Zone liefert, identisch; sobald sie eine mitliefert,
ergibt der Ausdruck `Invalid Date` → `frisch()` = false → **alle Preise gelten
still als nicht vorhanden**.

### A8 · Eintopf-Fokuseffizienz ist ein persönlicher Messwert im Code

`FEFF = 2192 / 2353` ist die zum Ablesezeitpunkt gültige Spezialisierung des
Nutzers, keine Spielkonstante (entspricht 1.022 FCE, demselben Wert wie im
`regeln.js`-Selbsttest). Der Kostenrechner hat dafür ein Eingabefeld, der
Eintopf-Reiter nicht — mit jedem Spezialisierungsfortschritt veraltet der Wert
still.

## 3. Bisher als unbelegt geführt, jetzt belegt (B)

### B1 · „1 Chancenpunkt = 1 %" ist keine unbelegte Annahme mehr

`Kostenrechner.html` (Hinweis am Feld Chancenpunkte) und `regeln.js`
(`qualitaetWurfErfolgswahrscheinlichkeit`, Kommentar) führen die Umrechnung
ausdrücklich als „dokumentierte, unbelegte Annahme". Das Wiki sagt dazu:
„Quality rolls increase by 1 for each 100 increase in quality points" bzw.
„100 quality points equals 1 reroll" — genau das Modell der Funktion
(volle Würfe plus anteilige Chance auf einen weiteren). Beleg vorhanden,
die beiden Textstellen sind überholt.

### B2 · Kampfhandschuhe gehören in die Kriegerschmiede

`KATEGORIE_ZU_GEBAEUDE.knuckles` trägt die Platzhaltergruppe
„Kampfhandschuhe (im Wiki keinem Gebäude gelistet)". Wiki *War Gloves*:
„War Gloves are crafted at a Warrior's Forge". Die eigene Gebührengruppe kann
entfallen.

### B3 · Nebenhand verteilt sich auf drei Gebäude

`offhand` trägt die Sammelgruppe „Nebenhand (Gebäude je Item
unterschiedlich)". Das Wiki benennt die Aufteilung: Schilde →
Kriegerschmiede, Fackeln → Jägerhütte, Folianten/Tomes → Magierturm. Die
Gruppe lässt sich damit je Item-Familie auflösen, statt eine Sammelgebühr zu
verlangen. (Martlocks Stadtbonus gilt laut Wiki für „Offhand" als Ganzes.)

### B4 · `meat_*` gehört zum Metzger, nicht zur Tierhaltung

Die Gebührengruppe heißt „Tierhaltung". Laut Wiki *Butcher (Building)* werden
die Tiere aus der **Weide** am **Metzger** zu Rohfleisch verarbeitet — zwei
verschiedene Gebäude mit verschiedenen Gebühren. Der Nutzer trägt unter dem
jetzigen Namen die Gebühr des falschen Gebäudes ein.

## 4. Weiterhin offen (D)

* **D1 · Reroll-Tabelle und -Faktoren.** Die Faktoren 4,4 / 5,5 / 6,6 / 27,5
  tauchen in Suchauszügen auf, die Übergangswahrscheinlichkeiten
  (`REROLL_UEBERGANG`) nicht. Zusätzlich gab es ein „Quality Reroll Rework"
  (Stapel-Reroll, Zielqualität, „chances and costs will now increase with the
  quality of the items you have put into the menu") — die Tabelle im Rechner
  könnte von davor stammen. Prüfen, sobald die Wiki-Seite *Quality* direkt
  lesbar ist.
* **D2 · Zweite Fassung der Qualitäts-Basiszeile.** Ein Wiki-Auszug nennt
  68,8 / 25 / 5 / **1,1** / 0,1 statt der im Code hinterlegten
  68,9 / 25 / 5 / **1** / 0,1. Beide summieren sich auf 100 %. Betrifft vor
  allem „Exzellent" (1,0 gegen 1,1 %, also 10 % relativ).
* **D3 · Taschenknoten 340 FCE.** Nicht belegt. Das Wiki nennt für den
  regulären Taschenknoten keinen Zahlenwert, sagt aber: der Knoten „Tornister
  der Einsicht" gibt einen Mutual-Bonus, der reguläre Taschenknoten nicht —
  `SPEZ_TYP.tasche` setzt für beide `mutual: 0`.
* **D4 · Meisterschaft gegen eigenen Mutual-Anteil.** Das Wiki rechnet die
  40.000 FCE beim Veredeln als 28.000 (eigener Knoten: 250 + 30 je Stufe) +
  12.000 (vier andere Knoten). `fceAusSpezialisierungsknoten()` kommt über
  25.000 + 12.000 + 3.000 (separates Meisterschaftsfeld) auf dieselbe Summe —
  aber nur, solange Meisterschaftsstufe = Knotenstufe. Bei ungleichen Stufen
  gehen beide Lesarten auseinander. Klären, welche stimmt.
* **D5 · Brecilien-Stadtboni.** `STADTBONUS.Brecilien` führt Umhang, Tasche,
  Trank. Nicht bestätigt; belegt ist nur, dass Brecilien einen Grund-Craft-/
  Veredelungsbonus hat und seit dem Wild-Blood-Update **+10 % auf alle
  Feldfrüchte**.
* **D6 · Rohtier- und Feldfruchtboni fehlen im Modell.** Jede Königsstadt hat
  zusätzlich +10 % auf ein Rohtierprodukt (Lymhurst Rohe Gans, Martlock Rohes
  Rind, Thetford Rohes Schwein). `STADTBONUS` kennt nur die Stufen +15 und
  +40. Wirkt beim Metzgern (`meat_*`) und bei Feldfrüchten. Beim jetzigen
  Modell folgenlos, solange die einzige Zutat `m:0` trägt (beim Fleisch der
  Fall) — der Bonus erhöht im Spiel die **Ausbeute**, was das reine
  Rückgewinnungsmodell ohnehin nicht abbilden kann.
* **D7 · Verzaubern: Gebühr und Fokus.** Der Rechner setzt beides auf 0 (vom
  Nutzer im Spiel abgelesen). Das Wiki bestätigt nur „keine Rückgewinnung beim
  Verzaubern" und nennt die **Artefaktgießerei** als Verzauberungsstation.
  Ob dort eine Nutzungsgebühr anfällt, ist unbelegt — Nutzungsgebühren hängen
  laut Wiki an der verbrauchten Nahrung, und eine Station ohne Nahrung wäre
  die Ausnahme.
* **D8 · T1/T2 ohne Nutzungsgebühr.** Wiki *Building*: „This fee does not
  affect any service that does not cost Silver, such as refining and crafting
  Tier 2 or lower items." `stationsgebuehr()` berechnet auch für T1/T2-Schritte
  eine Gebühr.
* **D9 · Preisvergleich/Qualitäts-Abruf.** Die Zuordnung „Qualitätsindex 0…4
  = API-Qualität 1…5" und die Beschränkung echter Qualitätspreise auf
  `equipmentitem`/`weapon`/`transformationweapon` sind API-Verhalten, kein
  Wiki-Thema; sie wurden hier nicht erneut gegen die Live-API geprüft (laut
  `build_graph.py` am 13.09.2026 belegt).

## 5. Geprüft und ausdrücklich ohne Befund

* `maxreturnamount` ist im gesamten Dump binär (siehe Tabelle oben) — die
  Vereinfachung `zutat.m === 0` verliert nichts.
* Alle 43 Einträge in `KATEGORIE_ZU_GEBAEUDE` kommen auch wirklich im Graphen
  vor; es gibt keine Karteileichen.
* Die Stadtboni-Listen der fünf Königsstädte und Caerleons stimmen Item für
  Item mit dem Wiki überein.
* Eintopf-Rezept, Saucenrezepte und ItemValues des Eintopf-Reiters stimmen
  exakt mit dem Client-Dump überein (unabhängig von der Migration aus
  `eintopf_update.py` nachgerechnet).
* Die Nahrung je Charge (648) ergibt sich sowohl aus den Zutaten
  (5.760 × 0,1125) als auch aus dem abgeleiteten Stück-ItemValue
  (576 × 10 × 0,1125) — beide Wege stimmen überein.

## 6. Quellen

Alle über Websuche-Auszüge, nicht direkt abrufbar (siehe Einschränkung oben):

* Wiki: *Resource return rate*, *Local Production Bonus*, *Dynamic Events*,
  *Crafting Focus*, *Specializations*, *Marketplace*, *Building*, *Quality*,
  *Crafting*, *Item Value*, *Enchanting*, *Artifact Foundry*,
  *Butcher (Building)*, *War Gloves*, *Off-Hand*, *Toolmaker*, *Saddler*,
  *Shapeshifter Crafter*, Stadtseiten Lymhurst / Fort Sterling / Bridgewatch /
  Martlock / Thetford / Caerleon / Brecilien.
* Forum: *Usage Fee and Crafting Changes* (Lands-Awakened-Feature-Dive),
  *Nutrition usage and item value*, *Quality Reroll Rework*,
  *What's the current formula for Focus Efficiency?*.
* Client-Dump: `rezepte.js` (Stand 2026-09-13), erzeugt aus
  ao-data/ao-bin-dumps.
