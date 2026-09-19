# Albion Kostenrechner: Projektregeln

> **In-Repo-Kopie für Claude Projects/GitHub-Anbindung (19.09.2026).** Diese
> Datei ist eine konsolidierte, an dieses Git-Repository angepasste Fassung der
> Regeln, die zuvor nur eine Ebene höher lagen
> (`C:\Users\soere\OneDrive\Dokumente\Claude\Albion\CLAUDE.md`, dort weiterhin
> die maßgebliche Datei für lokale Sitzungen in diesem Ordner, gilt dort auch
> für das fremde `Pizza/`-Projekt). Grund: ein Claude-Code-Projekt-Thread, der
> nur an dieses GitHub-Repo (`Birnify/Albion_Crafting_Calculator`) angebunden
> ist, sieht **nichts** außerhalb davon, auch keine lokalen Dateien der eigenen
   Maschine. Diese Datei macht das Repo dafür eigenständig.
>
> **Pflege:** inhaltliche Änderungen an Spielformeln/-werten hier UND in der
> Root-Datei nachziehen (oder umgekehrt), sonst laufen beide Kopien auseinander.
> Bis auf die "Kontext-Dateien"-Tabelle, die "Dateien"-Tabelle und den
> Pizza-Absatz (beide reine Pfad-/Scope-Anpassungen ans Repo) ist der Inhalt
> identisch zur Root-Datei.

Diese Datei enthält die **Spielregeln und belegten Formeln**, gegen die der
Kostenrechner (inkl. der seit App-Fusion v3.0.0-v3.1.2 migrierten
Eintopf-Rechner-/Preisvergleich-Reiter) entwickelt wird.

## Kontext-Dateien immer zuerst lesen

**Zu Beginn jeder Arbeit an diesem Repository**, bevor du eine inhaltliche
Frage beantwortest oder Code änderst, die Kontextdatei vollständig lesen. Ohne
sie kennst du weder den Stand noch die bereits getroffenen Entscheidungen.

| Datei | Zweck |
|---|---|
| `kostenrechner-KONTEXT.md` | **Arbeitsstand**: was ist fertig, was ist offen |
| `kostenrechner-PLAN.md` | **Auftrag**, in Arbeitspaketen, ändert sich kaum |
| `AUDIT-2026-09-13.md` | Code-Audit gegen das offizielle Wiki, Status je Befund |
| `EINTOPF-KONTEXT-ARCHIV.md` | Historische Fachdokumentation des ehemals eigenständigen Eintopf-Rechners; die migrierte Logik in `js/eintopf-*.js` beruht weiterhin auf diesen Formeln/Werten, aber kein aktives Arbeitsziel mehr |

Die Regel gilt für jede Art von Arbeit, egal ob direkt im Chat, über einen
gespawnten Subagenten oder einen Projekt-Thread.

**App-Fusion (Pakete A-E, abgeschlossen 13.09.2026):** der ehemals
eigenständige Eintopf-Rechner (Rechenkern und Preisvergleich) ist vollständig
in den Kostenrechner überführt, als zweiter und dritter Reiter neben dem
ursprünglichen Kostenrechner (s. `kostenrechner-KONTEXT.md`, Abschnitt "Was
ist das?"). Die alten eigenständigen Dateien liegen archiviert, nicht
gelöscht, außerhalb dieses Repos im lokalen Albion-Ordner
(`Archiv/Eintopf-Rechner (eigenstaendig, vor App-Fusion)/`) - für einen
Projekt-Thread, der nur an dieses Repo angebunden ist, nicht erreichbar und
auch nicht nötig (reines Archiv, kein aktives Arbeitsziel).

## Spielerprofil

- **Gecraftet** wird in der Praxis fast immer in **Lymhurst**; das ist die
  Vorgabe der App. Die Craft-Stadt ist seit 24.08.2026 aber per Dropdown frei
  wählbar; die Grundzutaten (Kürbis, Brot, Fleisch) werden dann aus der
  jeweils gewählten Stadt bezogen. Einkaufsstädte für Fisch/Stückchen/Seegras/
  Saucen und Verkaufsstädte für die Eintöpfe sind ebenfalls in der App frei
  wählbar (Checkboxen, unabhängig von der Craft-Stadt).
- **Premium** ist aktiv (4 % Steuer statt 8 %).
- Kochen und Eintöpfe sind nach Angabe des Nutzers auf **Maximalstufe**
  spezialisiert. Fokus-Effizienz **93,16 %** der Roh-Fokuskosten, im Craft-Fenster
  abgelesen: T8.3 kostet 2.192 Fokus statt der 2.353 aus dem Dump.

  ⚠️ **Die Annahme „Maximalstufe" trifft nach Aktenlage nicht zu.** Geklärt am
  04.09.2026 gegen das offizielle Wiki. Rückgerechnet ergeben 2.192 von 2.353
  genau **1.022 FCE**. Das Wiki nennt für vollständig ausgebaute Speisen- und
  Trankknoten **55.000 FCE, also 2,21 % der Grundkosten**. Der T8.3-Eintopf würde
  dann **52 Fokus je Charge** kosten statt 2.192, also Faktor 42. Selbst der
  Eintopf-Knoten allein auf Stufe 100 (28.000 FCE) brächte 338 Fokus, Faktor 6,5.

  Drei Fehlerquellen sind ausgeschlossen: der Vergleich ist stufenrichtig
  (2.353 gehört zu T8.**3**, darunter liegen 551 / 752 / 1.152), der Dumpwert ist
  belegt der Grundwert bei Stufe 0 (elf Wiki-Werte stimmen exakt), und die
  Bezugsgröße stimmt (beide Zahlen je Charge, nicht je Stück).

  1.022 FCE entspricht rechnerisch etwa Meisterschaftsstufe 34 bei
  **Spezialisierungsstufe 0** auf den Rindfleischeintopf (34 × 30 = 1.020).
  Nachzusehen am Schicksalsbrett unter dem Rindfleischeintopf-Knoten. Bis der
  Nutzer widerspricht, gilt weiterhin der **abgelesene** Wert für die Rechnung,
  nur die Beschreibung „Maximalstufe" ist damit hinfällig. **Offener Audit-
  Befund 1 (19.09.2026):** die Wiki-Tabelle für Speisen-Fokus stimmt exakt mit
  den Dump-Werten überein, unabhängig von `amountcrafted` - die im Projekt
  lange gültige Annahme "Wiki je Stück, Dump je Charge" ist damit widerlegt,
  s. `AUDIT-2026-09-13.md` Befund 1 für die volle Analyse. Braucht eine neue
  Schicksalsbrett-Ablesung, um die richtige Bezugsgröße zu klären.
- Küche in Lymhurst: **T8 Küche des Ältesten**, Nutzungsgebühr **380 Silber
  je 100 Nahrung**.

### Im Spiel abgelesene Werte (20.08.2026, Craft-Fenster T8.3)

| Größe | Wert | Bedeutung |
|---|---|---|
| Ressourcen-Ertragsrate | **15,2 %** ohne Fokus, **43,5 %** mit Fokus | Rückgewinnung |
| Silberkosten | **2.462** je Batch | Stationsgebühr |
| Gegenstandswert | **576** je Stück | ItemValue, ×10 = 5.760 je Batch |
| Nährwert | 8.170 je Batch | Fütterungswert, **nicht** Craft-Aufwand |
| Fokus | **2.192** je Batch | bei Rohwert 2.353 |

**Lymhurst hat keinen Stadtbonus auf gekochte Speisen.** Die 15,2 % entsprechen
der reinen Grundproduktion (B = 0,18). Gekochte Speisen sind die Bonuswarengruppe
von **Caerleon**, nicht von Lymhurst.

**Nachtrag 04.09.2026, frühere Bewertung korrigiert:** Die 36,7 / 53,9 % aus der
Original-Excel waren **nicht falsch**, nur auf etwas anderes bezogen. Es sind die
Werte fürs **Veredeln in der Bonusstadt**, und der Veredelungsbonus ist mit
**+0,40 deutlich größer als der Craft-Bonus mit +0,15**:
0,58 / 1,58 = 36,7 % ohne Fokus, 1,17 / 2,17 = 53,9 % mit Fokus. Für den
Eintopf-Craft galten sie trotzdem nicht, insofern war die Konsequenz richtig
und nur die Begründung falsch.

**Die Nutzungsgebühr von 380 Silber je 100 Nahrung ist kein fester Wert.** Sie
wird vom Besitzer der Station gesetzt, unterscheidet sich je Gebäude und ändert
sich laufend. 380 war der Wert der T8-Küche zum Zeitpunkt der Messung. In jeder
App gehört sie als **Eingabefeld je Gebäude**, nie als Konstante in den Code.
Vom Nutzer ausdrücklich klargestellt am 04.09.2026.

## Handelskonventionen

Beide Seiten sind in der App umschaltbar. Voreingestellt ist, was der Nutzer
tatsächlich tut: **Einkauf direkt (Sofortkauf), Verkauf über eigene Verkaufsorder.**
Die Kauforder für Fisch ist zuschaltbar; sie lohnt sich, füllt sich aber langsam.

| Weg | Preisbasis | Abzüge |
|---|---|---|
| Sofortkauf | `sell_price_min` | keine |
| **Kauforder** (eigene) | `buy_price_max` | + 2,5 % Einstellungsgebühr |
| Sofortverkauf | `buy_price_max` | − Steuer |
| **Verkaufsorder** (eigene) | `sell_price_min` | − Steuer − 2,5 % Einstellungsgebühr |

Steuer: 4 % mit Premium, 8 % ohne. Die Einstellungsgebühr fällt beim Aufgeben
einer eigenen Order an und verfällt auch bei Nichterfüllung.

Am Marktfenster belegt (T8.3, 8 Stück à 218.898): 4 % Steuer = 70.047,
2,5 % Einstellungsgebühr = 43.780.

**Der Verkaufsweg entscheidet über die Rangfolge.** Bei Sofortverkauf ist T8.2
am profitabelsten, bei Verkaufsorder T8.3, und der Unterschied beträgt ein
Vielfaches. Eigene Orders sind preislich weit besser, füllen sich aber erst mit
der Zeit oder gar nicht; Wartezeit und Ausfallrisiko sind nicht modelliert.

## Albion Online Data Project API

- **Der Realm-Server muss stimmen.** Der Nutzer spielt auf **Europa**:
  `https://europe.albion-online-data.com/api/v2/stats/`
  Das in der Doku genannte `www.` ist der **Amerika**-Server und liefert völlig
  andere Preise, und zwar stillschweigend, ohne Fehlermeldung. Am 20.08.2026 kostete
  derselbe Fisch auf `www.` 4.798 und auf `europe.` 5.419 Silber.
  Den eigenen Realm verrät der Albion Data Client im Log:
  er meldet an `pow.europe.albion-online-data.com`.
- Basis (allgemein): `https://<realm>.albion-online-data.com/api/v2/stats/`
- `prices/` liefert das Feld **`city`**, `history/` liefert **`location`** (leicht zu verwechseln).
- `history/` mit `time-scale=24` gibt Tageswerte, mit `time-scale=1` Stundenwerte.
  `item_count` ist die tatsächlich gehandelte Stückzahl, nicht die Angebotsmenge.
- Zeitstempel sind **UTC**. Umrechnung in Ortszeit gehört in den Browser.
- Die API **drosselt aggressiv** (HTTP 429). Anfragen sequenziell mit ~1,5 s Pause
  senden und bei 429 mit wachsender Wartezeit wiederholen. Parallele Blöcke laufen ins Limit.
- CORS ist offen (`access-control-allow-origin: *`), Abrufe direkt aus einer
  `file://`-Seite funktionieren deshalb.
- Lese-Seite hat ein separates Limit: 180 Anfragen je Minute, 300 je 5 Minuten
  (offizielle Doku, `https://www.albion-online-data.com/api`). Betrifft nur
  Abfragen, nicht den Data-Client-Ingest. Die App bleibt mit Blöcken zu 50 Items
  und ~1,5 s Pause weit darunter (max. ~40 Anfragen je Minute).

### Bekannte Grenze: `prices/` kann für echte, aktuelle Marktangebote leer bleiben

**Belegt am 04.09.2026, nicht nur vermutet.** Der Bestpreis-Endpunkt kann für ein
Item über Stunden hinweg „nie erfasst" (`0001-01-01`) melden, obwohl am
Marktplatz-Bildschirm (nicht dem Item-Vergleichsfenster) echte, aktuelle
Verkaufs- und Kaufgesuche liegen und der Data Client aktiv und unverschlüsselt
sendet. `history/` (Handelsvolumen) kann davon unberührt bleiben und weiterhin
echte, mehrtägige Umsatzdaten zeigen, `prices/` (Bestpreis) bleibt trotzdem leer.

**Ursache gefunden, nicht nur der Effekt:** über das offizielle Diagnosewerkzeug
`https://www.albion-online-data.com/identifier` (Client-Identifier aus dem
eigenen Log eingeben) lässt sich der Weg einer einzelnen Meldung nachverfolgen.
Befund für `QUESTITEM_TOKEN_ROYAL_T4`, Lymhurst, 04.09.2026, 21:10:49 UTC:

```
1. "Received on Pow Controller and enqueued for MarketOrderDedupeWorker"
   ItemTypeId: QUESTITEM_TOKEN_ROYAL_T4, LocationId: 1000
2. "Received on MarketOrderDedupeService, no valid orders found."
```

**Die rohe NATS-Nachricht wurde geprüft, nicht nur die Kurzmeldung.** Sie enthält
52 Kaufgesuche (`"AuctionType": "request"`), `UnitPriceSilver` mit Faktor 10.000
skaliert. Die ersten sechs Werte (550.150.000 / 550.000.000 / 541.320.000 / ...
÷ 10.000 = 55.015 / 55.000 / 54.132 ...) samt Stückzahl (23 / 101 / 74 ...)
stimmen exakt mit den sechs sichtbaren Zeilen im Marktplatz-Screenshot des
Nutzers überein. **Die gesendeten Daten sind also nachweislich korrekt, kein
Übertragungsfehler.** Die `Expires`-Zeitstempel reichen bis in den Oktober,
diese Kaufgesuche standen also schon vor dem Test, nicht erst seit diesem.

Das relativiert die Lesart „vom Dienst als ungültig verworfen": ein Dienst
namens *Dedupe*-Service prüft primär auf Duplikate, „no valid orders found"
bedeutet daher eher „nichts Neues gegenüber dem bereits bekannten Stand" als
„Daten fehlerhaft". Ungeklärt bleibt trotzdem der Kern: warum diese seit Wochen
stehenden, nachweislich korrekten Kaufgesuche nie in `buy_price_max` der
`prices/`-Antwort erscheinen, auch nicht historisch. Das liegt jenseits dessen,
was sich von außen über die öffentliche API und das Diagnosewerkzeug klären
lässt.

Ausgeschlossen wurden der Reihe nach: falsche Item-ID (Zeichen-für-Zeichen-
Treffer in der offiziellen `items.txt`), falsches Fenster (Test direkt am
Marktplatz-Bildschirm, nicht im Vergleichsfenster), verschlüsselter Account
(Client zeigte „Not Encrypted"), Rate-Limit (weit darunter, hätte ohnehin einen
Fehlercode statt einer leeren Antwort gegeben), reine Verarbeitungsverzögerung
(über Minuten unverändert, trotz mehrfacher frischer Meldungen dazwischen),
fehlerhaft übertragene Daten (Rohnachricht stimmt exakt mit dem Bildschirm
überein).

**Für die App bedeutet das:** ein gesperrter Weg mangels Preis kann auch dann
auftreten, wenn am Markt tatsächlich ein Angebot liegt, und zwar auch dann,
wenn das Angebot nachweislich schon seit Wochen und nicht nur vorübergehend
fehlt. Das ist keine Kleinigkeit, sondern eine strukturelle Grenze der
Datenquelle, deren genauer Mechanismus serverseitig bei AODP liegt und von
hier aus nicht weiter aufklärbar ist. Kein Workaround bekannt; das
Diagnosewerkzeug oben ist der einzige Weg, einen Einzelfall zu bestätigen.

## Rezeptdaten

Quelle ist der offizielle Client-Dump: `https://github.com/ao-data/ao-bin-dumps`

- `formatted/items.json` enthält nur Namen und Lokalisierung.
- `items.json` im Wurzelverzeichnis (~17 MB) enthält die **Rezepte**
  (`craftingrequirements`, `craftingfocus`, `enchantments`, `upgraderequirements`).

Wichtige Erkenntnis: **Fischsauce und Fischstückchen haben weder `craftingfocus`
noch `craftingcategory`**, anders als Bretter, Barren, Leder, Brot oder der Eintopf
selbst, die beides besitzen. Die `craftingcategory` ordnet ein Item überhaupt erst
einer Rückgewinnungs-Kategorie zu. Fischsauce ist damit eine reine Umwandlung:
kein Fokus, keine Rückgewinnung. Vom Nutzer im Spiel bestätigt; die Option
existiert dort schlicht nicht.

Nur der Eintopf-Craft selbst bekommt Fokus und Rückgewinnung.

## Belegte Spielformeln

**Stationsgebühr** (Albion-Forum, Lands-Awakened-Update, seit 14.09.2026
zusätzlich offiziell durch das Wiki "Building" bestätigt):

```
Gebühr = (ItemValue × 0,1125) × Stationssatz / 100
```

`ItemValue` ist der Wert des *hergestellten* Items, bei Craftgütern die Summe der
Zutatenwerte. Alle Koch-Rohstoffe haben ItemValue 40, Zwischenprodukte erben ihn
über das Rezept (`T3_WHEAT 40 → T3_FLOUR 40 → T4_BREAD 40`). **Fischprodukte haben
ItemValue 0**: Fischsauce erhöht die Gebühr also nicht, alle Verzauberungsstufen
kosten gleich viel.

**Keine Stationsgebühr für Tier 2 oder niedriger** (Wiki "Building", wörtlich:
"This fee does not affect any service that does not cost Silver, such as
refining and crafting Tier 2 or lower items."), belegt 19.09.2026, umgesetzt
in `REGELN.stationsgebuehrGiltFuerTier()`.

**ItemValue genau (04.09.2026 belegt, drei Punkte, die leicht schiefgehen):**

```
ItemValue = Summe(Zutatenwert x Anzahl) / amountcrafted
```

1. **Durch `amountcrafted` teilen.** Gegenprobe am Eintopf: 144 Materialien x 40
   = 5.760 je Batch, geteilt durch 10 Stück = **576 je Stück**, genau der im
   Spiel abgelesene Gegenstandswert. Wer die Teilung vergisst, führt bei Speisen
   und Tränken einen Batch-Wert als Stückwert.
2. **ItemValue verdoppelt sich je Tier und je Verzauberungsstufe.** Im Dump
   nachvollziehbar: `T4_CLOTH` 16, `T4_CLOTH_LEVEL1` 32, `LEVEL2` 64, `LEVEL3`
   128, `LEVEL4` 256; ebenso `T4_CLOTH` 16 bis `T8_CLOTH` 256.
3. **Deshalb ist ItemValue keine Eigenschaft des Items allein, sondern von
   (Item, Verzauberungsstufe, verwendetem Rezept).** Gegenprobe aus einer
   Fremdquelle: Gelehrtensandalen T4.0 = 8 x 16 = 128, T4.1 = 8 x 32 = **256**,
   und genau 256 nennt das Albion-Forum für 4.1 Scholar Sandals. Die
   Stationsgebühr einer .3 ist damit achtmal so hoch wie die einer .0.

Rindfleischeintopf: 144 Materialien × 40 × 0,1125 = **648 Nahrung je Batch**.
Gegenprobe: T7 Pork Pie hat ebenfalls 144 Materialien, und das Forum nennt dafür
exakt 648 Nahrung.

Nicht verwenden: das Attribut `@nutrition` aus dem Dump. Das ist der
*Fütterungswert* des Gerichts, nicht der Craft-Aufwand.

**Rückgewinnung** (Resource Return Rate, seit 14.09.2026 offiziell durch das
Wiki "Resource_return_rate" bestätigt: `1-1/(1 + Produktionsbonus/100)`,
identisch zur Formel unten):

```
RRR = B / (1 + B)
B = Grundproduktion 0,18
  + Stadt-Spezialbonus       (nur in der Bonusstadt der Warengruppe)
      0,15 beim Craften
      0,40 beim Veredeln     <- deutlich größer, oft übersehen
  + Fokus 0,59               (falls eingesetzt)
  + Tagesbonus 0,10 oder 0,20 (Silber- bzw. Goldtag, rotiert je Stadt)
```

Daraus die geläufigen Werte: 15,3 % (B 0,18) · 24,8 % (B 0,33, Craft-Bonusstadt)
· 36,7 % (B 0,58, Veredelungs-Bonusstadt) · 43,5 % (B 0,77) · 47,9 % (B 0,92)
· 53,9 % (B 1,17, Veredeln in der Bonusstadt mit Fokus).

**Stadtboni je Warengruppe** (04.09.2026, zwei unabhängige Quellen stimmen
überein; 14.09.2026 zusätzlich der bis dahin fehlende `shapeshifterstaff`-
Eintrag bei Caerleon ergänzt, s. `AUDIT-2026-09-13.md` Befund 5):

| Stadt | Craften +0,15 | Veredeln +0,40 |
|---|---|---|
| **Lymhurst** | Schwert, Bogen, Arkanstab, Lederhelm, Lederschuhe | **Faser → Stoff** |
| Fort Sterling | Hammer, Speer, Heiligenstab, Plattenhelm, Stoffrüstung | Holz → Bretter |
| Bridgewatch | Armbrust, Dolch, Fluchstab, Plattenrüstung, Stoffschuhe | Stein → Blöcke |
| Martlock | Axt, Kampfstab, Froststab, Plattenschuhe, alle Nebenhände | Häute → Leder |
| Thetford | Streitkolben, Feuerstab, Naturstab, Lederrüstung, **Stoffhelm** | Erz → Barren |
| Caerleon | gekochte Speisen, Sammlerausrüstung, Werkzeug, Kampfhandschuhe, **Wandlerstab** | keiner |
| Brecilien | Umhänge, Taschen, Tränke | keiner |

Für den Kostenrechner heißt das konkret: die **Königliche Gugel ist ein Stoffhelm
und bekommt in Lymhurst keinen Craft-Bonus** (das wäre Thetford). Der **Stoff für
sie wird in Lymhurst aber mit +0,40 veredelt**. Beides greift im selben Bauplan
an verschiedenen Stellen.

**Verzaubern kostet keine Stationsgebühr** und keinen Fokus. Verbraucht werden nur
Runen, Seelen und Relikte. Vom Nutzer im Spiel bestätigt am 04.09.2026.

**Spezialisierung erhöht die Rückgewinnung nicht.** Sie senkt ausschließlich die
Fokuskosten. Beide Größen deshalb getrennt führen.

**Fokuskosten** (04.09.2026, aus dem offiziellen Wiki, vom Nutzer als Screenshot
beigebracht, und gegen den Dump gegengeprüft):

```
Fokus = Grundfokus × 0,5 ^ (FCE / 10.000)
```

Je 10.000 Focus Cost Efficiency halbiert sich der Bedarf. Das ist die
Wiki-Formulierung im Wortlaut.

**`craftingfocus` aus dem Dump ist der Grundwert bei Spezialisierungsstufe 0.**
Elf Werte der Wiki-Tabelle „Base Refining Focus Cost (at 0 spec)" stimmen exakt
mit dem Dump überein, unter anderem `T4_CLOTH` 54, `T4_CLOTH_LEVEL1` 94,
`LEVEL2` 164, `LEVEL3` 287, `LEVEL4` 503 und `T8_CLOTH` 503 bis
`T8_CLOTH_LEVEL4` 4.714. Damit ist der Bezugspunkt gesichert.

**FCE je Stufe hängt vom Knotentyp ab.** Jede Stufe eines Spezialisierungsknotens
gibt „Unique" auf diesen Knoten UND „Mutual" auf ALLE Knoten der Kategorie,
**den eigenen eingeschlossen** (Bugfix 14.09.2026, s. `AUDIT-2026-09-13.md`
Befund 2: eine frühere Fassung dieser Regel und des Codes ließ den Mutual-
Anteil des eigenen Knotens fälschlich aus):

| Knotentyp | Unique je Stufe | Mutual je Stufe | Summe je Stufe (eigener Knoten) |
|---|---|---|---|
| Rüstungs- und Waffenknoten | 250 | 30 | 280 |
| Sammlerausrüstung | 250 | 30 | 280 |
| Umhänge | 370 | 0 | 370 |
| Taschen | 340 | 0 | 340 |
| Werkzeuge (übrige, "fused") | 250 | 60 | 310 |

**Zusätzlich zu den Spezialisierungsknoten gibt es je Kategorie einen
getrennten Meisterschaftsknoten mit 30 FCE je Stufe**, der wie ein
Mutual-Bonus auf ALLE Knoten der Kategorie wirkt (Wiki, wortgleich für jede
Kategorie wiederholt: „The mastery node will provide 30 focus cost efficiency
bonus for each mastery node level."). Gilt für Rüstung/Waffen, Umhänge,
Taschen, Speisen und Tränke. **Echte Ausnahmen ohne getrennten
Meisterschaftsknoten: „Werkzeuge (übrige)" UND Veredeln** (Bugfix 14.09.2026,
s. Befund 3: Veredeln stand hier vorher fälschlich MIT getrenntem
Meisterschaftsknoten). Bei „Werkzeuge (übrige)" sind Meisterschaft und
Spezialisierung zu einem einzigen „fused" Knoten verschmolzen (Wiki: „All the
other tool crafting specialization nodes are fused with their own mastery
nodes... Each fused node will provide a unique 250 focus cost efficiency
bonus... a mutual 60 focus cost efficiency bonus..."), bei Veredeln ist jede
Knotenstufe selbst bereits die Meisterschaft (Wiki, Abschnitt Refining,
wörtlich: „All refining specialization nodes are their own crafting mastery
nodes"). Beide Fälle: nur EIN Stufenfeld je Knoten, kein separates
Meisterschaftsfeld. Beleg: Wiki-Seite `Specializations`, 05.09.2026/14.09.2026.

**Sammlerausrüstung (`gatherergear`) ist KEIN „fused"-Werkzeugknoten** (Bugfix
14.09.2026, s. Befund 6: vorher fälschlich als „Werkzeuge (übrige)" behandelt,
60 statt 30 Mutual). Jeder Gathergear-Knoten für sich hat 250 Unique + 30
Mutual (wie ein gewöhnlicher Spezialisierungsknoten), zusätzlich profitiert er
vom fused Werkzeug-Meisterschaftsknoten mit 60 FCE je Stufe (Wiki, wörtlich:
„A single gathering gear crafting specialization node, and its fused mastery
node on level 100 will provide: 34,000 focus cost efficiency (28,000 +
6,000)"). Die App modelliert diese 60/Stufe vereinfachend als eigenes
Meisterschaftsfeld dieser Kategorie, ohne die reale Kopplung an die
Werkzeug-Meisterschaft abzubilden.

Erreichbare Endwerte laut Wiki: **40.000 FCE** für T4-T8-Veredeln, also 6,25 %
der Grundkosten. **47.500** für Rüstungsknoten. Speisen (Koch) und Tränke
(Alchemist) folgen derselben Unique/Mutual-Struktur wie Rüstung/Waffen (250
Unique + 30 Mutual je Spezialisierungsknoten-Stufe, 30 je Meisterschaftsstufe),
unterscheiden sich aber in der Anzahl der Spezialisierungsknoten: Koch hat 9
zusätzliche Knoten (**55.000 FCE maximal, 2,21 % der Grundkosten**), Alchemist
hat 8 (**52.000 FCE maximal**). Beleg wie oben: Wiki-Seite `Specializations`,
Abschnitt „Farming Specializations", Unterabschnitt zu Chef- und
Alchemist-Meisterschaft, 05.09.2026.

**Audit-Befund 4, teilweise behoben (19.09.2026, v3.1.7):** die App leitet ihre
Spezialisierungsknoten-Liste NICHT von Hand, sondern automatisch aus dem
Rezeptgraphen ab (alle Items derselben `craftingcategory`, gruppiert ohne
Tier-Präfix). Das ist eine Näherung, die zu viele Knoten liefert.

- **Veredeln: behoben.** Echte Knoten existieren erst ab T4 (Wiki-Endwert
  40.000 FCE = 25.000 Unique + 15.000 Mutual, und 15.000 = 5 x 3.000, also
  genau fünf Knoten je Kette). `REGELN.istEchterKnoten()` wirft die
  T2-/T3-Gruppen deshalb aus `spezialisierungsGruppen()` und aus dem
  Mutual-Anteil in `fceAusSpezialisierungsknoten()`, auch für bereits
  gespeicherte Stufen. Folge, bewusst so: T2-/T3-Veredelungsschritte im
  Rezeptbaum bekommen keinen aus Knotenstufen abgeleiteten FCE-Wert mehr,
  sondern fallen auf den allgemeinen FCE-Wert der Einstellungen zurück; ein
  Mutual-Bonus ist laut Wiki ein Bonus auf Knoten, und für T2/T3 gibt es
  keinen.
- **Speisen und Tränke: weiter offen.** 25 abgeleitete Gruppen gegen 9 echte
  Kochknoten, 15 gegen 8 Alchemistenknoten. Dass die Zahl nicht stimmt, ist
  belegt; welche der abgeleiteten Gruppen die echten Knoten sind, nicht. Das
  braucht eine Ablesung der Knotennamen am Schicksalsbrett, bis dahin wird
  dort nichts geändert.

**Achtung, Bezugsgröße (Audit-Befund 1, 19.09.2026, weiterhin ungeklärt,
widerlegt die vorherige Zeile dieses Abschnitts):** früher stand hier, die
Wiki-Tabellen für Speisen/Tränke nennten den Fokus je Stück, der Dump dagegen
je Charge, mit Faktor 10 Unterschied bei `amountcrafted=10`. Das ist
**widerlegt**: die Wiki-Tabelle „Food Base Focus Cost" enthält exakt die
Dump-Werte des Rindfleischeintopfs (551/752/1.152/2.353, `amountcrafted=10`)
UNVERÄNDERT, nicht durch 10 geteilt. Offen bleibt, was der Dump-Wert
tatsächlich meint (je Charge oder je Stück) - siehe `AUDIT-2026-09-13.md`
Befund 1 für die volle Analyse inklusive Gegenproben in beide Richtungen.
Braucht eine neue Schicksalsbrett-Ablesung zur Klärung.

**Der Umkehrschluss ist nützlich:** aus einem im Craft-Fenster abgelesenen
Fokuswert lässt sich die eigene FCE ausrechnen.

```
FCE = −log2(abgelesen / Grundfokus) × 10.000
```

**Fokusbudget:** mit Premium 10.000 Punkte je 24 Stunden, Höchststand 30.000.
Wer den Höchststand erreicht, sammelt nichts mehr an.

**Craft-Qualitätswurf** (05.09.2026, Forumspost von Korn, Entwickler, verlinkt vom
offiziellen Wiki, `Item_Quality`): ohne jeden Qualitätsbonus gibt es **einen Wurf**
auf die Basistabelle. Mit **X % Qualitätsbonus** bleibt es bei einem Wurf, aber es
kommt eine **X % Chance auf einen zweiten** Wurf hinzu; über 100 % Bonus (z. B.
150 %) gibt es zwei garantierte Würfe plus 50 % Chance auf einen dritten. Bei
mehreren Würfen zählt der beste. Korn wörtlich: "100 % crafting quality bonus
means that you get 1 free reroll on each craft."

```
Basistabelle (ohne Bonus):
Normal        68,9 %   (+0 Gegenstandskraft)
Gut           25 %     (+20)
Herausragend  5 %      (+40)
Exzellent     1 %      (+60)
Meisterwerk   0,1 %    (+100)
```

Der Qualitätsbonus X % stammt aus Schicksalsbrett-Ausbau (**Qualitäts-
Chancenpunkte**, laut Wiki-Seite `Specializations` strukturell parallel zu den
FCE-Tabellen: Unique- und Mutual-Bonus je Knotenstufe, Meisterschaftsknoten
obendrauf), aus aktiviertem Fokus beim Craften und aus Essen vor dem Craften
(zeitlich befristeter Buff). **Inzwischen belegt (14.09.2026):** 1
Chancenpunkt entspricht 1 % Bonus in Korns Formel - Wiki "Crafting", wörtlich:
"default quality roll is 1, increases by 1 each 100 increase quality". Der
Effekt von Fokus und Essen auf die Qualität selbst ist weiterhin nicht
entwicklerseitig beziffert, nur unbestätigte Spielerschätzungen.

**Speisen und Tränke sind grundsätzlich nicht qualifizierbar** (Wiki: "All
consumables can not be qualified. Consumables are foods, and potions."),
**ebenso Werkzeuge außer der Angelrute** (Wiki: "All the tools except fishing
rod can not be qualified", belegt 19.09.2026, umgesetzt in
`REGELN.istQualifizierbar()`). Betrifft den Kostenrechner-Rezeptbaum bei
Speisen/Tränken/Werkzeugen, bestätigt aber auch, dass beim Eintopf-Rechner
Qualität zu Recht nie modelliert wurde.

**Qualität rerollen an der Reparaturstation** (05.09.2026, offizielles Wiki,
`Item_Quality`, Abschnitt "Rerolling quality at a repair station", per
Chrome-Erweiterung gelesen und die Tabelle per Screenshot gegen die
Spaltensummen geprüft): unabhängiger Mechanismus, unabhängig vom Verzaubern der
Verzauberungsstufe (.0 bis .4). Kein Fokus, keine Rückgewinnung, nur Silber gegen
Chance, beliebig oft wiederholbar, keine Rückstufung möglich.

```
Ergebnis je Reroll, nach aktueller Qualität (Spalte = vorher, Zeile = nachher):

               Normal   Gut     Herausragend   Exzellent
Gut            80 %     30 %    –              –
Herausragend   15 %     60 %    50 %           –
Exzellent      5 %      9,9 %   49,9 %         99,5 %
Meisterwerk    0,1 %    0,1 %   0,1 %          0,5 %

(Rest der Spalte: bleibt auf der aktuellen Stufe. Aus Exzellent heraus praktisch
nur 0,5 % Meisterwerk, sonst bleibt es Exzellent, kein Rückschritt.)
```

```
Kosten je Reroll = Gegenstandswert x Reroll-Faktor der AKTUELLEN Qualität
Faktoren: Normal 4,4 · Gut 5,5 · Herausragend 6,6 · Exzellent 27,5
```

Der große Sprung des Faktors bei Exzellent (27,5 statt 6,6) passt zur niedrigen
Meisterwerk-Chance (0,5 %) und macht das letzte Rerollen deutlich teurer als die
vorigen Stufen.

**Offener Audit-Befund 9 (19.09.2026, nachgeprüft):** live im Spiel schwankende
Rabatte (Global Discount, Gold Market Stabilization) wirken laut Wiki zusätzlich
auf Reroll-Kosten ("Reroll costs are affected by both Global Discount and Gold
Market Stabilization") und vermutlich auch auf die Stationsgebühr, sind aber
in der App nicht modelliert. Bewusst nicht umgesetzt: die Quellenlage nennt
weder die Rechenart (multiplikativ? auf welche Größen?) noch einen Wert, und
ob die Stationsgebühr überhaupt betroffen ist, ist nur eine Vermutung. Braucht
eine Nutzer-Entscheidung plus eine Ablesung im Spiel, nicht nur ein
Eingabefeld.

**Craft-Wurf und Reroll kombinieren (Bugfix 14.09.2026, s. Befund 10):** ein
Craft-Versuch, der die Zielqualität verfehlt, landet nicht "nichts", sondern
eine konkrete Qualität laut Basistabelle, die sich oft günstiger hochrerollen
lässt als ein kompletter Neuversuch. `REGELN.qualitaetsVerteilung()` liefert
die volle Verteilung der gelandeten Qualität, `rechenkern.js` rechnet beide
Strategien (Neu-Craften vs. Craften+Reroll) gegeneinander und wählt die
günstigere.

## Craft-Kategorie zu Gebäude

Aus dem offiziellen Wiki (`Crafting`, `Refining`), abgerufen am 04.09.2026. Nötig,
weil die Nutzungsgebühr je Gebäude gilt und die 43 `craftingcategory`-Werte des
Dumps dorthin abgebildet werden müssen.

| Gebäude | `craftingcategory` |
|---|---|
| **Weber** | `fiber` (Faser zu Stoff) |
| **Schmelze** | `ore` |
| **Steinmetz** | `rock` |
| **Gerberei** | `hide` |
| **Sägewerk** | `wood` |
| **Kriegerschmiede** | `sword`, `axe`, `mace`, `hammer`, `crossbow`, `plate_armor`, `plate_helmet`, `plate_shoes` |
| **Magierturm** | `firestaff`, `arcanestaff`, `holystaff`, `cursestaff`, `froststaff`, `cloth_armor`, `cloth_helmet`, `cloth_shoes` |
| **Jägerhütte** | `bow`, `dagger`, `quarterstaff`, `naturestaff`, `spear`, `leather_armor`, `leather_helmet`, `leather_shoes` |
| **Werkzeugmacher** | `tools`, `gatherergear`, `bag`, `cape` |
| **Alchemistenlabor** | `potion` |
| **Küche** | `food` |

**Vier Kategorien sind damit nicht eindeutig zugeordnet:**

- `offhand` verteilt sich im Spiel auf alle drei Waffengebäude (Schild zur
  Kriegerschmiede, Fackel zur Jägerhütte, Foliant zum Magierturm), der Dump kennt
  aber nur die eine Kategorie. Die Item-Namen sind zu uneinheitlich für eine
  saubere Regel: `T4_OFF_BOOK`, `T4_OFF_SHIELD`, `T4_OFF_HORN_KEEPER`,
  `T4_OFF_LAMP_UNDEAD`, `T4_OFF_ORB_MORGANA`, `T4_OFF_TALISMAN_AVALON` und weitere.
  **Offener Audit-Befund 11 (19.09.2026, nachgeprüft):** die FCE-Formel selbst
  ist für offhand im Grundsatz belegbar (Wiki "Crafting"-Übersichtstabelle
  nennt eigene Unique-/Mutual-Werte: unique 250, mutual 90 in der ersten
  Gruppe, 15 in den übrigen), nur nützt das ohne die Gruppenzuordnung nichts,
  und genau die ist aus den Item-Namen nicht sauber ableitbar (18 abgeleitete
  Nebenhand-Gruppen). `SPEZ_TYP` kennt außerdem nur einen Mutual-Wert je Typ.
  Für `knuckles` sind gar keine Werte bekannt. Beides bleibt deshalb beim
  Freitext-Fallback; Gebührengruppe und Stadtbonus sind für beide gepflegt,
  es entsteht also kein stiller Rechenfehler.
- `knuckles` (Kampfhandschuhe) taucht in keiner Gebäudeliste des Wikis auf,
  auch keine FCE-Werte bekannt.
- `meat_chicken`, `meat_cow`, `meat_goat`, `meat_goose`, `meat_pig`, `meat_sheep`
  gehören zur Tierhaltung, nicht zu den Craft-Gebäuden.
- `shapeshifterstaff` (Bugfix 14.09.2026, s. Befund 5): trotz gezielter Suche
  auf den Wiki-Seiten "Crafting", "Hunter's Lodge" und "Shapeshifter" kein
  einziger Beleg für ein Gebäude gefunden. Stadtbonus (Caerleon) und
  FCE-Struktur (wie andere Waffen) sind dagegen klar belegt und in der App
  umgesetzt.

**Vorgehen statt Raten:** diese vier als eigene Gebührengruppen in der Oberfläche
führen. Der Nutzer trägt dort den Satz der Station ein, die er tatsächlich
benutzt. Das ist ehrlicher als eine erfundene Zuordnung und kostet nichts.

## Modellierung

- **Markttiefe beachten.** Der günstigste Fisch nützt nichts, wenn davon nur 200 Stück
  am Tag umgesetzt werden, der Batch aber 600 braucht. Bedarf immer vom günstigsten
  Preis aufwärts über die real gehandelten Mengen auffüllen (Mischkalkulation),
  nie mit dem Bestpreis hochrechnen.
- **Es gibt keinen Upgrade-Pfad für Speisen.** Die Verzauberungsstufe wird beim
  Kochen gewählt, die Fischsauce ist dabei schlicht die vierte Zutat. Ein fertiger
  T8.0 lässt sich nicht nachträglich aufwerten. Das Feld `upgraderequirements` im
  Client-Dump nennt 9 Saucen je Eintopf, dieselbe Rate wie das Rezept (90 je
  10 Stück) und damit nur dessen Pro-Stück-Schreibweise, kein eigener Weg.

## Arbeitsablauf: Orchestrator statt direkter Umsetzung im Hauptgespräch

Größere Vorhaben werden nicht direkt im Hauptgespräch gebaut, sondern von einem
Hintergrund-Agenten. Etablierter Ablauf:

1. Grobe Idee: `/define-feature` ausführen, bis Name, Idee, Motivation, Scope und
   Abgrenzung feststehen. Bei einem Paket aus `kostenrechner-PLAN.md` entfällt
   das; der Auftrag steht dort schon.
2. Auftrag an `albion-cycle-orchestrator` per `Agent`-Tool übergeben, mit **genau
   einem** Paket bzw. Punkt.
3. **Nur ein Zyklus je Instanz.** Sobald eine Instanz ihren Punkt abschließt und
   ihre Runde beendet, für den nächsten Punkt eine **frische** Instanz per
   `Agent`-Tool starten, nicht dieselbe per `SendMessage` weiterlaufen lassen.
   Grund, im Pizza-Projekt gemessen: eine durchlaufende Instanz erzeugte über 670
   Turns rund 196 Mio. Cache-Read-Tokens bei nur rund 304.000 neu erzeugten
   Output-Tokens, weil jeder Turn die komplette bisherige Konversation erneut
   liest. `SendMessage` an eine laufende Instanz nur **innerhalb** desselben, noch
   offenen Punktes (Rückfrage beantworten, Spezialisten-Ergebnis liefern,
   nach einem Sitzungslimit fortsetzen).
4. Die Warteschlange führt der Hauptagent, nicht der Orchestrator. Reihenfolge
   ausdrücklich vorgeben.
5. **Sub-Agenten-Relay bedienen:** Der Orchestrator kann als Subagent selbst keine
   weiteren Subagenten spawnen. Schickt er eine Nachricht, die mit
   `SUBAGENT-ANFRAGE:` beginnt, spawnt der Hauptagent den genannten Spezialisten
   selbst (`run_in_background: false`), wartet dessen Ergebnis ab und schickt es
   per `SendMessage` zurück, beginnend mit `SUBAGENT-ERGEBNIS:`. Das ist eine
   interne Steuernachricht, keine Nutzer-Rückfrage: autonom bedienen und den
   Befund dem Nutzer nur informativ weitergeben. Ist ein Spezialist nicht
   verfügbar, das ehrlich zurückmelden statt ihn zu erfinden.
6. Eine Agenten-Instanz ist **nie sitzungsübergreifend** erreichbar. Eine neue
   Sitzung startet immer einen frischen Orchestrator. Das ist kein Fehler.

**Bekanntes Problem (seit 13.09.2026, Stand 19.09.2026 unverändert):** in
mehreren lokalen Sitzungen war `albion-cycle-orchestrator` über das Agent-Tool
nicht aufrufbar (Harness-Fehler "Agent type ... not found"), zeitweise auch
`oberflaechen-pruefer`/`spieldaten-pruefer`. Wirkt wie ein selektives
Harness-Problem, kein grundsätzliches. In einem Projekt-Thread (dieses Repo
als GitHub-Anbindung) ist unbekannt, ob dasselbe Problem auftritt - dort bei
Bedarf denselben Fallback (inline im Hauptgespräch, nach kurzer Rückfrage)
anwenden.

**Wann stattdessen inline im Hauptgespräch:** winzige, klar umrissene Fixes (eine
Zeile, ein Doku-Nachtrag, ein Textfehler), kurze Analysen, oder wenn der Kontext
ohnehin geladen ist. Faustregel: wäre das eine Minute Handarbeit, dann inline. Bei
jedem neuen Umsetzungswunsch kurz rückfragen, welchen Weg der Nutzer will, mit
Empfehlung und kurzer Begründung, aber die Wahl bestätigt er.

### Agenten

| Agent | Rolle | Modell |
|---|---|---|
| `albion-cycle-orchestrator` | führt einen kompletten Zyklus durch | sonnet |
| `rechenkern-pruefer` | rechnet Ergebnisse unabhängig nach | haiku |
| `spieldaten-pruefer` | prüft Rezepte und API gegen die Quellen | haiku |
| `oberflaechen-pruefer` | prüft Oberfläche und Bedienbarkeit | haiku |

Die drei Prüfer haben bewusst **keine Schreibrechte** und liefern Befundlisten.
**Ihre Ergebnisse nie ungeprüft übernehmen**: im Pizza-Projekt haben Spezialisten
mehrfach Testergebnisse behauptet, die bei eigener Nachprüfung falsch waren.
Testzahlen immer selbst nachlaufen lassen.

## Belegte Werte nie ohne neuen Beleg ändern

Die Werte im Abschnitt „Belegte Spielformeln" und in den Kontextdateien sind gegen
das Spiel oder gegen Fremdquellen verifiziert. Sie werden **nicht** geändert, weil
eine Rechnung sonst nicht aufgeht oder eine Zahl unplausibel wirkt.

- **Beleg heißt:** im Spiel abgelesen (Screenshot), im Client-Dump nachgewiesen,
  oder aus einer nachvollziehbaren Fremdquelle mit erkennbarer Fachlichkeit. Kein
  Vertrauen in KI-generierte Zusammenfassungen oder Wikis unklarer Herkunft.
- **Mechanismus und konkreten Parameter trennen**, wenn nur einer von beiden belegt
  ist. Ehrlich benennen, was die Quellenlage hergibt.
- **Reicht die Quellenlage nicht, wird nichts geändert.** Ein neuer Ratewert mit
  Quellenanstrich ist nicht besser als der alte.
- Das bewährte Vorgehen bei Zweifeln: **den Nutzer im Spiel nachsehen lassen.** Das
  hat mehrfach echte Fehler aufgedeckt. Nachfragen schlägt annehmen.

### Das offizielle Wiki ist die beste Quelle

`https://wiki.albiononline.com/` beantwortet Abrufe per `WebFetch` mit **HTTP
403**. Das ist kein Ausfall und kein Grund, auf Sekundärquellen auszuweichen:
lokal lässt sich die Seite über die **Chrome-Erweiterung**
(`mcp__claude-in-chrome__*`) oder den **In-App-Browser** (Browser-Pane,
`mcp__Claude_Browser__*`, seit 13.09.2026 bestätigt: liefert ebenfalls kein
403) öffnen und lesen. **In einem Cloud-Projekt-Thread ist unbekannt, ob eines
von beiden verfügbar ist** - dort zuerst prüfen, welche Browser-/Web-Werkzeuge
die Umgebung bereitstellt, und falls keines funktioniert, den Nutzer um eine
manuelle Ablesung/einen Screenshot bitten statt auf Sekundärquellen
auszuweichen.

Nützliche Seiten: `Crafting_Focus` (Fokusformel, Grundkosten-Tabellen je Tier und
Verzauberung, FCE je Knotentyp), `Resource_return_rate`, `Local_Production_Bonus`,
`Specializations`, `Crafting`, `Item_Quality`, `Marketplace`, `Building`,
`Enchanting`.

Sekundärquellen (albioncodex, scanalbion, albionmarket) nur noch zur Gegenprobe,
nicht als Hauptbeleg.

## Kommunikationsstil

- **Keinen Gedankenstrich verwenden** (weder Em-Dash noch freistehender En-Dash),
  weder im Chat noch in Dateien noch in Texten, die in der App landen. Stattdessen
  Komma, Semikolon, Doppelpunkt, Punkt oder Klammern. Bis-Striche in Bereichen
  (T1–T8, 5–10) sind davon nicht betroffen, die sind kein Gedankenstrich.
  Nutzer-Vorgabe vom 04.09.2026, gilt dauerhaft und rückwirkend; die vorhandenen
  Dateien wurden am selben Tag bereinigt.
- Knapp und ohne Füllstoff. Der Nutzer schätzt keine Erklärkästen und keine
  Wiederholungen.
- Bei echten Lücken gezielt nachfragen (z. B. über `AskUserQuestion`) statt still
  zu raten. Vorher prüfen, ob die Antwort schon aus dem Gespräch hervorgeht.

## Versionskontrolle

Eigenes Git-Repo, Remote `https://github.com/Birnify/Albion_Crafting_Calculator.git`,
Branch `main`. Seit 04.09.2026 (Abend). `Versionen/` bleibt zusätzlich
bestehen, ist aber redundant zur Commit-Historie und deshalb gitignored.

Commits nur bei abgeschlossenen Paketen (Phase 5 des Orchestrators), nicht bei
jedem Zwischenschritt. Push nach jedem Commit ist Standard, keine Rückfrage
pro Push nötig. Das gilt nur für die automatisierten Commits in diesem
Projekt, keine pauschale Push-Erlaubnis darüber hinaus.

## Versionierung

Bei jeder abgeschlossenen Änderung einen vollständigen, lauffähigen Schnappschuss
nach `Versionen/vX.Y.Z - [Beschreibung]/` anlegen. SemVer: Patch = Fix,
Minor = Feature, Major = Umbau. Zusätzlich zum Git-Commit, nicht statt ihm:
der Commit ist die maßgebliche Historie, der Versionsordner bleibt der
schnelle lokale Zugriff auf einen lauffähigen Stand ohne Checkout. In einem
Cloud-Projekt-Thread ohne lokales Dateisystem ist dieser Schritt
möglicherweise nicht sinnvoll durchführbar (kein "lokaler Zugriff" existiert
dort) - der Git-Commit bleibt dort trotzdem Pflicht.

## Dateien in diesem Repository

| Datei | Zweck |
|---|---|
| `CLAUDE.md` | Diese Datei: Spielregeln, belegte Formeln, Arbeitsweise |
| `.claude/agents/` | Orchestrator und Prüfer-Spezialisten |
| `.claude/skills/define-feature/` | Idee zu einer Feature-Definition verdichten |
| `kostenrechner-PLAN.md` | **Auftrag**, in Arbeitspaketen |
| `kostenrechner-KONTEXT.md` | **Arbeitsstand** |
| `kostenrechner-KONTEXT-HISTORIE.md` | Ausgelagerte, unverkürzte ältere "Aktueller Stand"-Abschnitte |
| `AUDIT-2026-09-13.md` | Code-Audit gegen das offizielle Wiki, mit Umsetzungsstatus je Befund |
| `EINTOPF-KONTEXT-ARCHIV.md` | Historische Fachdokumentation des archivierten, eigenständigen Eintopf-Rechners; weiterhin die Quelle für `js/eintopf-*.js` |
| `Kostenrechner.html`, `js/*.js` | Die App |
| `rezepte.js`, `item-namen.js` | Von `build_graph.py` erzeugt, nicht von Hand bearbeiten |
| `build_graph.py` | Erzeugt `rezepte.js`/`item-namen.js` neu, braucht den Client-Dump |
| `design.md` | Verbindliche Design-Spezifikation (Farben/Typografie/Bausteine) |
| `tests/test.html` | Testsuite |
| `Versionen/` | Lokale, gitignored Schnappschüsse je Version |

**Nicht in diesem Repository, nur lokal im Albion-Ordner erreichbar** (für
einen reinen Projekt-Thread irrelevant, da archiviert/kein aktives
Arbeitsziel): die Original-Excel-Tabellen (`Eintöpfe.xlsx` u. a.), das Archiv
der eigenständigen Eintopf-Rechner-App, das fremde `Pizza/`-Projekt.
