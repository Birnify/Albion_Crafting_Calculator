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
- Kochen und Eintöpfe sind nach Angabe des Nutzers weit spezialisiert.
  Im Craft-Fenster abgelesen: eine Charge T8.3-Rindfleischeintopf (10 Stück)
  kostet **2.192 Fokus**. Der Rohfokus dafür ist **23.530** (10 × 2.353 aus dem
  Dump, der Dumpwert gilt je Stück, s. unten), die Fokus-Effizienz also
  **9,32 %** der Roh-Fokuskosten, entsprechend **FCE 34.242**.

  **Bezugsgröße geklärt (19.09.2026, im Spiel abgelesen, Audit-Befund 1
  geschlossen):** `craftingfocus` aus dem Dump ist der Grundfokus **je Stück**,
  nicht je Charge. Beleg: am Steinmetz kostet derselbe Travertinblock-Craft mit
  doppelter Ausbeute doppelt so viel Fokus. Alle vier Steinblock-Rezepte tragen
  im Dump identisch `f=54` und unterscheiden sich nur in `amountcrafted`
  (1/2/4/8), es ist dasselbe Item und derselbe Spezialisierungsknoten, die
  eigene FCE kürzt sich also vollständig heraus. Bis dahin rechnete
  `rechenkern.js` `fokusKosten(...) / amountcrafted` und lag bei 313 Rezepten
  (Speisen, Tränke, Steinblöcke, Tierhaltung) um genau diesen Faktor zu
  billig; behoben am 19.09.2026, s. `AUDIT-2026-09-13.md` Befund 1.

  **Am 19.09.2026 zusätzlich am Schicksalsbrett nachgesehen, zweiter,
  unabhängiger Beleg.** Die Koch-Handwerksspezialisierung steht auf Suppen 18,
  Salate 2, Pasteten 2, Braten 18, Omelette 0, **Eintöpfe 100**, Sandwiches 0,
  Kochzutaten 19, Fleisch 51, Stufensumme 210. Daraus folgt
  `FCE(Eintöpfe) = 250 × 100 + 30 × 210 + 30 × Meisterschaft = 31.300 + 30 ×
  Meisterschaft`, also ein Wert zwischen 31.300 und 34.300. **1.022 ist in
  diesem Bereich nicht erreichbar**, 34.242 dagegen schon (Meisterschaft 98).
  Steinmetz-Ablesung und Schicksalsbrett sagen damit dasselbe, und der seit
  04.09.2026 dokumentierte Widerspruch zur Angabe „weit spezialisiert" ist
  aufgelöst.

  Zwei Fehlerquellen waren schon vorher ausgeschlossen: der Vergleich ist
  stufenrichtig (2.353 gehört zu T8.**3**, darunter liegen 551 / 752 / 1.152),
  und der Dumpwert ist belegt der Grundwert bei Spezialisierungsstufe 0 (elf
  Wiki-Werte stimmen exakt).
- Küche in Lymhurst: **T8 Küche des Ältesten**, Nutzungsgebühr **380 Silber
  je 100 Nahrung**.

### Im Spiel abgelesene Werte (20.08.2026, Craft-Fenster T8.3)

| Größe | Wert | Bedeutung |
|---|---|---|
| Ressourcen-Ertragsrate | **15,2 %** ohne Fokus, **43,5 %** mit Fokus | Rückgewinnung |
| Silberkosten | **2.462** je Batch | Stationsgebühr |
| Gegenstandswert | **576** je Stück | ItemValue, ×10 = 5.760 je Batch |
| Nährwert | 8.170 je Batch | Fütterungswert, **nicht** Craft-Aufwand |
| Fokus | **2.192** je Batch | bei Rohwert 23.530 je Batch (2.353 je Stück × 10) |

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
- **`gold.json`** liefert den Goldpreis des Realms, Grundlage des Global
  Discount (s. oben): `gold.json?count=2` oder `gold.json?date=...&end_date=...`,
  beides in der offiziellen API-Doku dokumentiert. Das Antwortschema ist dort
  **nicht** dokumentiert; die App wertet deshalb `price`/`timestamp` und
  `Price`/`Timestamp` gleichermaßen aus und rechnet ohne Rabatt weiter, wenn
  nichts Verwertbares kommt.
- `history/` mit `time-scale=24` gibt Tageswerte, mit `time-scale=1` Stundenwerte.
  `item_count` ist die tatsächlich gehandelte Stückzahl, nicht die Angebotsmenge.
- **`history/` liefert je Item eine Zeile JE QUALITÄT, und der Parameter
  `qualities` wird dabei ignoriert** (19.09.2026 gegen die echte API abgelesen,
  `T4_BAG`, Lymhurst: die Antwort enthielt vier Einträge mit `quality` 1 bis 4;
  Abrufe mit `qualities=4` und `qualities=5` lieferten unverändert dieselben
  vier Einträge). Schlüssel eines Eintrags: `location`, `item_id`, `quality`,
  `data` mit `item_count`, `avg_price`, `timestamp`. Wer Zeilen nur nach
  `item_id` ablegt, überschreibt die Qualitäten gegenseitig. `prices/` dagegen
  wertet `qualities=1,2,3,4,5` korrekt aus und liefert eine Zeile je Qualität.
- **`item_count` ist eine Untergrenze, kein amtlicher Absatz.** Gemeldet wird
  nur, was Spieler mit laufendem Data-Client gesehen haben (s. auch "Bekannte
  Grenze" unten). Jede Oberfläche, die die Zahl zeigt, muss das so benennen;
  die Reiter „Craften: Gewinn" und „Veredeln leveln" schreiben deshalb „verkauft/Tag" und nicht
  „Absatz".
- Zeitstempel sind **UTC**. Umrechnung in Ortszeit gehört in den Browser.
- Die API **drosselt aggressiv** (HTTP 429). Anfragen sequenziell mit ~1,5 s Pause
  senden und bei 429 mit wachsender Wartezeit wiederholen. Parallele Blöcke laufen ins Limit.
- **Eine 429-Antwort nennt die Reset-Zeit im Klartext** (22.11.2026, echte
  Antwort, wörtlich): `Throttled, be nice to the server, use compression
  (gzip, deflate, etc)! Throttle resets at 2026-11-22 11:10:00 +0000!`. Die
  Zeit ist UTC und lag auf einer runden Minute. Die App wartet seit v3.16.0
  bis zu dieser Zeit, statt blind zu wiederholen. Der Abruf kam per `curl`
  ohne Kompression und war erst der zweite des Prüfers; kurz zuvor liefen
  aber rund 25 Abrufe aus derselben Sitzung. Ob die Drosselung an fehlender
  Kompression, an einem gemeinsamen Zähler je IP oder an einem kürzeren
  Fenster als dokumentiert lag, ist **nicht geklärt**. Browser-`fetch` sendet
  `Accept-Encoding` von selbst.
- **`prices/` und `history/` liefern mehrere Städte in einem Abruf**
  (`locations=Lymhurst,Fort Sterling,...`), vollständig und wertgleich zum
  Einzelabruf (22.11.2026 gemessen: 50 IDs × 7 Städte × 5 Qualitäten = 1.750
  Zeilen, 541 KB; 250 Lymhurst-Zeilen identisch zum Einzelabruf). Seit
  v3.16.0 holt die Preisschicht so alle Städte je ID-Block in einem Abruf.
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

**Präzisiert 13.10.2026 (v3.8.3): die Rückgewinnung hängt an
`craftingfocus > 0`, nicht an der `craftingcategory`.** Die Kategorie
bestimmt nur den Stadtbonus und (wo vorhanden) das Gebäude. Beleg,
Craft-Fenster ohne Fokus, Screenshots 13.10.2026: Tisch des Großmeisters und
Reparatursatz des Adepten (beide ohne Kategorie, Fokus 5.627 bzw. 280) zeigen
15,2 %, Hai-Trophäe und Unterschlupf-Baukasten (Fokus 0) 0 %. Items ohne
Kategorie bekommen Grundproduktion, Fokus, Tagesbonus, keinen Stadtbonus.

**Möbel (`furnitureitem`, ohne Kategorie) werden beim Werkzeugmacher
gefertigt** (Nutzerangabe) und zahlen Stationsgebühr nach derselben Formel.
Gegenprobe mit einem Satz 970 an drei Möbeln (Screenshots 13.10.2026):
Gegenstandswert 7.680 → 8.381, 256 → 279, 1.736 → 1.894 Silber, jeweils exakt.
Reittiere und Belagerungsbanner (ebenfalls ohne Kategorie): Gebäude nicht
belegt, in der App je eigene Gebührengruppe.

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
  + Tagesbonus 0,10 oder 0,20 (Silber- bzw. Goldtag, gilt in allen Städten gleich (Nutzerbeleg 13.10.2026))
  + Zusatzbonus              (in der App frei einstellbar, kein Spielwert)
```

Gilt nur für Rezepte mit `craftingfocus > 0` (sonst 0 %), s. „Rezeptdaten“.

**Die Rückgewinnung schwankt nicht je Stück, sie wird je Vorgang gerechnet**
(23.11.2026, offizielles Wiki `Resource_return_rate`, im In-App-Browser
gelesen, wörtlich: "Actual refund is calculated from RRR for each crafted
batch."). Bruchteile werden laut derselben Seite so gerundet, dass im Mittel
die erwartete Rate herauskommt. Die Abweichung vom Erwartungswert ist damit
höchstens etwa ein Stück je Zutat und Vorgang, kein Würfeln je Material.
Artefakte kommen nie zurück (dieselbe Seite). Beispiel der Seite: 100 Baumwolle
in Lymhurst ergeben 100 Stoff und 36 bis 37 Baumwolle zurück; wiederholt bis
nichts mehr übrig ist, entstehen rund 158 Stoff. Folge für die Einkaufsliste
(seit v3.24.0): der Bedarf nach Rückgewinnung lässt sich knapp rechnen, ein
kleiner Puffer deckt die Rundung.

**Im Spiel bestätigt (23.11.2026, vier Screenshots des Nutzers, Klerikerrobe
des Adepten T4.2, 16 Stoff je Stück, Ertragsrate 15,2 %):** mit 410 gekauften
Stoff (Rechnung `16 + 29 × 16 × 0,8475 = 409,2`) ließen sich genau 30 Roben
in drei Durchgängen fertigen, 4 Stoff blieben übrig (erwartet 3,2).

| Durchgang | verbraucht | zurück | erwartet |
|---|---|---|---|
| 25 Stück | 400 | 61 | 61,0 |
| 4 Stück | 64 | 10 | 9,8 |
| 1 Stück | 16 | 3 | 2,4 |

Die Rückgabe lag in keinem Durchgang unter dem Erwartungswert, der Bruchteil
wurde zweimal aufgerundet. Dieselben Bilder bestätigen die Gebührenformel für
verzauberte Ausrüstung: Gegenstandswert 16 × 64 = 1.024, × 0,1125 = 115,2
Nahrung, bei Satz 425 sind das 489,6 Silber je Stück; das Spiel zeigt 490 für
ein Stück und 12.240 für 25.

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
- **Speisen: behoben (19.09.2026, v3.1.9).** Statt der Ableitung steht jetzt
  eine gepflegte Knotenliste (`REGELN.SPEZ_KNOTEN.food`), belegt durch
  Screenshots des Nutzers vom Fenster "Koch-Handwerksspezialisierung". Es hat
  genau neun Knoten, in dieser Reihenfolge: **Suppen, Salate, Pasteten,
  Braten, Omelette, Eintöpfe, Sandwiches, Kochzutaten, Fleisch.** Die 25
  abgeleiteten Gruppen werden darauf abgebildet; Fisch- und Avalon-Varianten
  liegen beim selben Knoten wie ihr Bauernhof-Gegenstück, der Seegras-Salat
  bei den Salaten und der gegrillte Fisch bei den Pasteten (Wiki `Cooking`,
  Abschnitt "Chef Masteries", wörtlich). Gegenprobe: neun Knoten auf Stufe 100
  plus Meisterschaft 100 ergeben exakt die 55.000 FCE, die das Wiki als
  Endwert nennt.
- **Das rohe Fleisch gehört in den Koch-Baum, nicht in einen eigenen.** Der
  Knoten "Fleisch" steht im selben Fenster, die Items tragen im Dump aber
  `meat_chicken` bis `meat_sheep`. Dafür gibt es jetzt `REGELN.SPEZ_FAMILIE`:
  mehrere `craftingcategory`-Werte können sich einen Schicksalsbrett-Baum
  teilen. Die Gebührengruppe bleibt getrennt, `meat_*` läuft weiter unter
  "Tierhaltung".
- **Tränke: Knotenliste abgelesen (19.09.2026), Umsetzung steht aus.** Sören
  hat vier Ausschnitte des Fensters "Alchemist-Handwerksspezialisierung"
  geschickt. Es enthält **16 Knoten**, in dieser Reihenfolge: Heilungstrank,
  Energietrank, Trank des Riesenwuchses, Resistenztrank, Klebriger Trank,
  Gifttrank, Unsichtbarkeitstrank, Beruhigender Trank, Reinigungstrank,
  Säurehaltiger Trank, Berserkertrank, Höllenfeuertrank, Sammeltrank, Tornado
  in der Flasche, **Alkohol**, Lebensschutztrank. Sie decken alle 15
  `potion`-Gruppen des Dumps ab, ohne Rest. Die Zuordnung Knoten zu Gruppe
  steht in `AUDIT-2026-09-13.md`, Befund 4.
  **Noch nicht umgesetzt, weil der Mutual-Wert fehlt:** die App führt Tränke
  mit 8 Knoten und 30 Mutual, passend zum Wiki-Endwert 52.000 FCE. Mit 16
  Knoten ergäbe dieselbe Formel 76.000. Rechnerisch ginge 52.000 bei 16 Knoten
  mit Mutual 15 auf; das ist aber eine Rechnung und kein Beleg. Es fehlt das
  Details-Panel eines Trankknotens und die Antwort, ob es einen getrennten
  Alchemisten-Meisterschaftsknoten gibt.
- **`ALCOHOL` hängt NICHT unter "Kochzutaten".** Dieselben Screenshots zeigen
  Alkohol als eigenen Knoten im **Alchemisten**-Baum. Die bisherige
  Einsortierung im Koch-Baum ist damit widerlegt; die Wiki-Seite `Alchemy`
  lag richtig. Derselbe Fall wie beim rohen Fleisch, nur umgekehrt: eine
  `food`-Kategorie in einem fremden Baum. `SPEZ_FAMILIE` bildet bisher nur
  ganze Kategorien ab und reicht dafür nicht, die Zuordnung muss je Gruppe
  möglich sein. Korrektur steht zusammen mit der Trank-Umsetzung aus.
- **Ohne Knoten, bewusst:** `T8_MEAL_SPECIAL_FOOD_DRAKE_EGG`
  (Jungdrachenei-Kekse), im Fenster gibt es keinen passenden Knoten.

**Bezugsgröße: `craftingfocus` gilt je Stück (Audit-Befund 1, geklärt und
behoben 19.09.2026).** Früher stand hier, die Wiki-Tabellen für Speisen/Tränke
nennten den Fokus je Stück, der Dump dagegen je Charge. Beides war falsch: die
Wiki-Tabelle „Food Base Focus Cost" enthält exakt die Dump-Werte des
Rindfleischeintopfs (551/752/1.152/2.353, `amountcrafted=10`) unverändert, und
der Dumpwert selbst gilt **je Stück**. Der Rohfokus eines Craft-Vorgangs ist
also `craftingfocus × amountcrafted`. Im Spiel belegt am Steinmetz (s.
„Spielerprofil" oben). Gegenproben aus dem Dump, die dasselbe stützen: ein
T8-Fischeintopf (`amountcrafted=1`) kostet je Stück das 1,2-fache eines
T8-Rindfleischeintopfs, unter der alten Lesart wäre es das 11,8-fache gewesen
(über alle 76 Gerichtspaare Median 2,1 gegen 21,3); und verzaubertes Material
kostet sonst überall mehr Fokus, nie weniger (`T4_METALBAR` 54 gegen
`_LEVEL1` 94 usw.), während die alte Lesart Steinblöcke aus verzaubertem Stein
billiger gemacht hätte. Umgesetzt in `rechenkern.js/craftKandidat()` und
`craftBeiQualitaetKandidat()`, abgedeckt durch acht Regressionstests in
`tests/test.html`.

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

**Qualitätsbonus durch Essen: Salate (22.11.2026, Client-Dump).** In
`spells.json` tragen genau die Zauber der Salate einen Effekt
`craftingquality` (dazu `crafttime`, schnelleres Craften); `items.json`
ordnet sie über `@consumespell` je Verzauberungsstufe zu:

| Speise | .0 | .1 | .2 | .3 |
|---|---|---|---|---|
| Bohnensalat (T2) | 33 | 49,5 | 66 | 82,5 |
| Rübensalat (T4) | 66 | 82,5 | 99 | 115,5 |
| Kartoffelsalat (T6) | 99 | 115,5 | 132 | 148,5 |
| Flachwassertintenfischsalat (T2) | 49,5 | 74,25 | 99 | 123,75 |
| Meeresoktopussalat (T4) | 99 | 123,75 | 148,5 | 173,25 |
| Tiefseekalmarsalat (T6) | 148,5 | 173,25 | 198 | 222,75 |

Roh gegessen: Flachwasser-Tintenfisch 16,5, Meeresoktopus 33, Tiefseekalmar
49,5. Keine andere Speise und kein Trank trägt `craftingquality`. **Nicht
belegt ist die Einheit:** dass diese Zahl dieselben Chancenpunkte sind wie am
Schicksalsbrett (1 Punkt = 1 % Chance auf einen weiteren Wurf), liegt nahe
(ein Testzauber `TEST_CRAFTQUALITY` trägt den Wert 100), ist aber nicht im
Spiel abgelesen. Ebenso offen: die Dauer des Buffs (das Feld `@time` nennt
120, Einheit unklar) und ob sich Essen und Schicksalsbrett addieren. Der
Fokus trägt im Dump keinen solchen Effekt; sein Einfluss auf die Qualität
bleibt unbeziffert.

**Speisen und Tränke sind grundsätzlich nicht qualifizierbar** (Wiki: "All
consumables can not be qualified. Consumables are foods, and potions."),
**ebenso Werkzeuge außer der Angelrute** (Wiki: "All the tools except fishing
rod can not be qualified", belegt 19.09.2026, umgesetzt in
`REGELN.istQualifizierbar()`). Betrifft den Kostenrechner-Rezeptbaum bei
Speisen/Tränken/Werkzeugen, bestätigt aber auch, dass beim Eintopf-Rechner
Qualität zu Recht nie modelliert wurde.

**Maßgebliche Quelle für Qualität ist `@maxqualitylevel` im Client-Dump**
(`items.json`, Stand 13.10.2026): 5 = Qualitätsstufen Normal bis Meisterwerk,
1 oder fehlend = keine Qualität. Deckt sich mit allen Regeln oben, erfasst aber
auch Items ohne `craftingcategory` (Möbel, Trophäen, Tagebücher, Reittiere mit
Wert 1). `build_graph.py` liefert es als Knotenfeld `mq`, umgesetzt in
`REGELN.istQualifizierbar()` (v3.8.2).

**Veredelte Rohstoffe und Fleisch haben ebenfalls keine Qualität** (Stoff,
Barren, Leder, Bretter, Blöcke, `meat_*`). Beleg ist der Client-Dump: alle
Items dieser Kategorien stehen außerhalb der Gruppen `equipmentitem`/`weapon`/`transformationweapon`,
die `build_graph.py` als qualifizierbar führt (kein `q` in `item-namen.js`).
Bis 29.09.2026 fehlten sie in `REGELN.istQualifizierbar()`; eine globale
Zielqualität ließ den Rechner dann für Stoff Qualitätswurf und Reroll
einrechnen (Kunstvoller Stoff "Exzellent", mit Fokus: 1.292 statt 645 Silber plus Gebühr).

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

**Global Discount** (Audit-Befund 9, behoben 19.09.2026, v3.1.8). Belegt über
die Wiki-Seite `Global_Discount`, wörtlich: "When the gold price on the market
is below 3000, a Global Discount on silver costs is active, the percentage of
discount is proportionate to the price of gold".

```
Global Discount = (1 - Goldpreis / 3000) x 100 %
Skala: Goldpreis 3.000 -> 0 % · 1.500 -> 50 % · 0 -> 100 %
```

Gegenprobe der Seite selbst: bei 4,74 % Rabatt sank ein Inselausbau von
1.875.000 auf 1.786.125 Silber. Als Silbersenken nennt sie "repair,
transmutation, quality improvements".

**Die App wendet den Rabatt NUR auf die Reroll-Kosten an, nicht auf die
Stationsgebühr.** Ausdrückliche Nutzer-Entscheidung vom 19.09.2026: die
Wiki-Seite erwähnt die Nutzungsgebühr nicht, und sie geht an den
Gebäudebesitzer, ist also keine Silbersenke im Sinne der Seite. Der Goldpreis
wird live über die API mitgezogen (s. unten), nicht als Feld gepflegt; ist er
nicht abrufbar, wird ohne Rabatt gerechnet. **Gold Market Stabilization** ist
weiterhin nicht modelliert, die zugehörige Wiki-Seite antwortet mit 403.

**Korrektur und neue Belege zur Aufwertung (23.11.2026).** Quellen: sieben
Screenshots des Nutzers (Reparaturstation des Ältesten in Lymhurst,
Nutzungsgebühr 0; Marktplatz Lymhurst) und das offizielle Wiki (`Quality`,
`Global_Discount`, `Version_28.000.1`), im In-App-Browser gelesen.

- **Der Global Discount setzt inzwischen unter einem Goldpreis von 5.000
  ein, nicht mehr unter 3.000.** Wiki `Global_Discount`:
  `(1 − Goldpreis / 5000) × 100 %`; 3.000 galt laut derselben Seite vor dem
  Update „Beyond the Veil“, davor 1.500. Die Zahl 3.000 weiter oben und in
  `REGELN.globalDiscount()` war damit überholt; der Code rechnet seit v3.25.0 mit 5.000. Am
  23.11.2026 lag der Goldpreis laut API bei 10.650, es gab also keinen
  Rabatt.
- **Die Aufwertungskosten tragen zusätzlich einen Auf- oder Abschlag aus der
  „Gold Market Stabilization“** (Wiki `Quality`, sinngemäß: die Kosten
  hängen von Global Discount und Gold Market Stabilization ab; Patchnotiz
  28.000.1: ein selbstregelndes System passt Silbererträge und Silberkosten
  je Server laufend leicht an). Eine Formel dafür ist nicht veröffentlicht.
  **Gemessen:** Klerikerrobe des Adepten T4.2 (Gegenstandswert 16 × 64 =
  1.024), Kosten je Versuch 5.208 aus Normal, 6.510 aus Gut, 7.813 aus
  Hervorragend. Die Formel `Gegenstandswert × 4,4 / 5,5 / 6,6` ergibt 4.506 /
  5.632 / 6.758. Das Verhältnis ist in allen drei Fällen **1,156**. Die App
  rechnet die Aufwertung an diesem Tag also um rund 13,5 % zu billig. Der
  Faktor ist nicht fest; er gehört als abgelesener, einstellbarer Wert in
  die App, nicht als Konstante (seit v3.25.0 Feld „Aufschlag Aufwertung“, Vorgabe 15,6 %).
- **Auf der Stationsgebühr liegt dieser Aufschlag nicht** (Nutzerablesung
  23.11.2026): der Magierturm zeigt Nutzungsgebühr 425, und
  `1.024 × 0,1125 × 425 / 100 = 489,6` ist genau die abgelesene Gebühr (490
  je Robe, 12.240 für 25). Die Gebührenformel gilt also unverändert und ohne
  Korrekturfaktor; der Aufschlag 1,156 betrifft die Aufwertung.
- **Die Ergebnistabelle der Aufwertung ist im Spiel bestätigt:** aus Normal
  80 / 15 / 5 / 0,1 %, aus Gut 30 (bleibt) / 60 / 9,9 / 0,1 %, aus
  Hervorragend 50 (bleibt) / 49,9 / 0,1 %.
- **Die dritte Qualitätsstufe heißt im deutschen Client „Hervorragend“**,
  nicht „Herausragend“ (Gegenstandsstärke Normal 1.240, Gut 1.260,
  Hervorragend 1.280). Die App schreibt seit v3.25.0 „Hervorragend“; ältere Abschnitte
  dieses Textes noch „Herausragend“.
- **Markt je Qualität, Klerikerrobe T4.2, Lymhurst:** billigste
  Verkaufsorder Normal und Gut je 31.961, Hervorragend 35.934, Exzellent
  35.980; höchste Kauforder in allen Qualitäten rund 18.826. Verkauft an je
  einem Tag: Normal 97, Gut 287, Hervorragend 175, Exzellent 299. Der Handel
  läuft also überwiegend in den besseren Qualitäten, und Normal und Gut
  kosten gleich viel. Die Liste „Normal“ im Marktfenster enthält erkennbar
  auch bessere Stücke (dieselben Preise wie unter „Gut“).

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
| **Küche** | `food` (außer Mehl und Butter: **Mühle**; Alkohol: **Alchemistenlabor**; Wiki `Mill`, `Cook`, `Alchemist's Lab`, 23.11.2026) |

**Vier Kategorien sind damit nicht eindeutig zugeordnet:**

- `offhand` verteilt sich im Spiel auf alle drei Waffengebäude (Schild zur
  Kriegerschmiede, Fackel zur Jägerhütte, Foliant zum Magierturm), der Dump kennt
  aber nur die eine Kategorie. Die Item-Namen sind zu uneinheitlich für eine
  saubere Regel: `T4_OFF_BOOK`, `T4_OFF_SHIELD`, `T4_OFF_HORN_KEEPER`,
  `T4_OFF_LAMP_UNDEAD`, `T4_OFF_ORB_MORGANA`, `T4_OFF_TALISMAN_AVALON` und weitere.
  **Audit-Befund 11, Gruppenzuordnung abgelesen (19.09.2026):** Sören hat
  sechs Screenshots geschickt. Sie zeigen, dass Nebenhände im Spiel **drei
  getrennte Spezialisierungsbäume** haben, nicht einen: "Foliant-",
  "Fackel-" und "Schild-Handwerksspezialisierung", jeder mit genau sechs
  Knoten. Die 3 x 6 = 18 Knoten decken die 18 abgeleiteten Nebenhand-Gruppen
  exakt ab; die vollständige Zuordnungstabelle steht in
  `AUDIT-2026-09-13.md`, Befund 11. Der Satz oben, die Item-Namen seien für
  eine saubere Regel zu uneinheitlich, bleibt richtig, ist aber gegenstandslos
  geworden: statt einer Regel braucht es eine gepflegte Liste wie
  `SPEZ_KNOTEN.food`.
  **Weiter offen, deshalb noch nicht umgesetzt:** die FCE-Werte. Die
  Wiki-Übersichtstabelle nennt unique 250, mutual 90 in der ersten Gruppe und
  15 in den übrigen; mit den drei Bäumen hat das jetzt eine naheliegende
  Entsprechung (eigener Baum gegen die zwei Geschwisterbäume), nachprüfbar ist
  es aus dem Cloud-Thread aber nicht. `SPEZ_TYP` kennt außerdem nur einen
  Mutual-Wert je Typ und braucht dafür eine Erweiterung. Ungeklärt ist auch,
  ob Nebenhände einen getrennten Meisterschaftsknoten haben oder unter einer
  Waffen-Meisterschaft hängen. Für `knuckles` sind weiterhin weder Screenshot
  noch FCE-Werte vorhanden (acht abgeleitete Gruppen). Beides bleibt deshalb
  beim Freitext-Fallback; Gebührengruppe und Stadtbonus sind für beide
  gepflegt, es entsteht also kein stiller Rechenfehler.
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

## Arbeitsablauf: Die Hauptsitzung steuert, Subagenten setzen um und prüfen

**Seit 22.11.2026, Nutzer-Entscheidung.** Löst den Ablauf über
`albion-cycle-orchestrator` ab. Größere Vorhaben werden weiter nicht im
Hauptgespräch gebaut, aber die Hauptsitzung steuert sie selbst, ohne
Zwischenagent.

**Warum der Wechsel:** der Orchestrator durfte als Subagent keine Prüfer
starten, jede Prüfung lief als Relay (`SUBAGENT-ANFRAGE`) über die
Hauptsitzung, die damit ohnehin steuerte. Er lief auf Sonnet, was für
entwurfslastige Pakete knapp ist. Seine Phase 1 fragte den Nutzer erneut, was
im Plan schon stand. Und er war seit 13.09.2026 in vielen Sitzungen gar nicht
aufrufbar (Ursache s. „Agenten" unten).

### Ablauf je Paket

1. **Auftrag klären.** Grobe Idee: `/define-feature`, bis Name, Idee,
   Motivation, Scope und Abgrenzung feststehen. Steht das Paket schon in einer
   Plandatei (`kostenrechner-PLAN.md`, `OPTIMIERUNG-PLAN.md`), entfällt das.
   Offene fachliche Fragen und fehlende Spielwerte klärt die Hauptsitzung mit
   dem Nutzer, **bevor** ein Umsetzer startet.
2. **Umsetzen.** Die Hauptsitzung startet per `Agent`-Tool einen **frischen**
   Umsetzer (`general-purpose`) mit **genau einem** Paket. Der Auftrag nennt:
   die zu lesenden Dateien (`CLAUDE.md`, Kontextdatei, Plan-Abschnitt des
   Pakets), Abgrenzung, Abnahmekriterien und die Stopp-Regeln unten. Der
   Umsetzer committet nicht und legt keine Version an.
3. **Prüfen.** Die Hauptsitzung startet die zum Paket passenden Prüfer selbst,
   parallel, und lässt `tests/test.html` selbst laufen. Bei Änderungen an der
   Oberfläche sieht sie die App im Browser an. Nur den Code zu lesen reicht
   nicht.
4. **Nacharbeit.** Befunde gehen an denselben Umsetzer zurück (`SendMessage`,
   nur innerhalb desselben Pakets) oder werden, wenn klein, inline behoben.
   Danach Tests erneut.
5. **Abschluss durch die Hauptsitzung**, erst nach bestandener Prüfung:
   Kontextdatei nachziehen, Paket im Plan markieren, Versionsordner, Commit
   und Push.

### Regeln

- **Ein Paket je Umsetzer-Instanz.** Für das nächste Paket eine frische
  Instanz, nicht dieselbe weiterlaufen lassen. Grund, im Pizza-Projekt
  gemessen: eine durchlaufende Instanz erzeugte über 670 Turns rund 196 Mio.
  Cache-Read-Tokens bei nur rund 304.000 neu erzeugten Output-Tokens, weil
  jeder Turn die komplette bisherige Konversation erneut liest.
- **Die Warteschlange führt die Hauptsitzung.** Reihenfolge laut Plan; kein
  automatischer Start eines Folgepakets ohne Wort des Nutzers.
- **Prüfer-Ergebnisse nie ungeprüft übernehmen.** Im Pizza-Projekt haben
  Spezialisten mehrfach Testergebnisse behauptet, die bei eigener Nachprüfung
  falsch waren. Testzahlen immer selbst nachlaufen lassen, gemeldete
  Rechenabweichungen selbst nachrechnen.
- Eine Agenten-Instanz ist **nie sitzungsübergreifend** erreichbar.

### Stopp-Regeln (gehören wörtlich in jeden Umsetzer-Auftrag)

- Rote Tests: stoppen, Befund melden, nicht weitermachen.
- **Ein Spielwert fehlt oder ist unbelegt:** nicht schätzen. Melden, damit der
  Nutzer im Spiel nachsieht. Das ist in diesem Projekt der häufigste und
  wichtigste Stopp.
- Belegte Werte aus dieser Datei nicht anfassen. Scheint eine Änderung nötig,
  ist das eine Rückfrage, keine Umsetzung.
- Zahlen passen nicht zusammen: melden statt glattbügeln.
- Echte Architektur- oder Modellentscheidung, Abweichung vom Scope,
  unerwarteter Dateizustand: mit Vorschlag und Optionen zurückmelden.
- Erzeugte Dateien (`rezepte.js`, `item-namen.js`, `js/karte-daten.js`) nicht
  von Hand bearbeiten.

**Wann stattdessen inline im Hauptgespräch:** winzige, klar umrissene Fixes (eine
Zeile, ein Doku-Nachtrag, ein Textfehler), kurze Analysen, oder wenn der Kontext
ohnehin geladen ist. Faustregel: wäre das eine Minute Handarbeit, dann inline. Bei
jedem neuen Umsetzungswunsch kurz rückfragen, welchen Weg der Nutzer will, mit
Empfehlung und kurzer Begründung, aber die Wahl bestätigt er.

### Agenten

| Agent | Rolle | Modell |
|---|---|---|
| `general-purpose` (eingebaut) | Umsetzer, ein Paket je Instanz | wie die Hauptsitzung |
| `rechenkern-pruefer` | rechnet Ergebnisse unabhängig nach | sonnet |
| `spieldaten-pruefer` | prüft Rezepte und API gegen die Quellen | sonnet |
| `oberflaechen-pruefer` | prüft Oberfläche und Bedienbarkeit | sonnet |
| `albion-cycle-orchestrator` | abgelöst am 22.11.2026, Datei bleibt als Referenz | sonnet |

Die drei Prüfer haben bewusst **keine Schreibrechte** und liefern Befundlisten.
Seit 22.11.2026 laufen sie auf Sonnet statt Haiku, weil ihre Befunde zu oft
nicht stimmten.

**Ursache des Fehlers „Agent type ... not found" (22.11.2026, gefunden,
behoben und bestätigt):** die `description`-Zeile im
Dateikopf der drei betroffenen Agenten enthielt einen Doppelpunkt mit
Leerzeichen („aktuell: der ...", „gegen die Quellen: den ...",
„Bedienbarkeit: einheitliche ...") und war nicht in Anführungszeichen gesetzt.
Das bricht das YAML. Der einzige Agent ohne solchen Doppelpunkt
(`rechenkern-pruefer`) war auch der einzige, der lud. Alle vier
Beschreibungen stehen jetzt in Anführungszeichen. Bestätigt: wenige Minuten
nach der Korrektur meldete die laufende Sitzung die drei fehlenden Agenten
als neu verfügbar.
**Beim Anlegen oder Ändern eines Agenten die Beschreibung immer in
Anführungszeichen setzen.**

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

Commits nur bei abgeschlossenen Paketen (Abschluss durch die Hauptsitzung, s. „Arbeitsablauf"), nicht bei
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
| `.claude/agents/` | Prüfer-Spezialisten; der Orchestrator ist seit 22.11.2026 abgelöst |
| `OPTIMIERUNG-PLAN.md` | **Auftrag** der Optimierungsrunde, Pakete O1 bis O6 |
| `.claude/skills/define-feature/` | Idee zu einer Feature-Definition verdichten |
| `kostenrechner-PLAN.md` | **Auftrag**, in Arbeitspaketen |
| `kostenrechner-KONTEXT.md` | **Arbeitsstand** |
| `kostenrechner-KONTEXT-HISTORIE.md` | Ausgelagerte, unverkürzte ältere "Aktueller Stand"-Abschnitte |
| `AUDIT-2026-09-13.md` | Code-Audit gegen das offizielle Wiki, mit Umsetzungsstatus je Befund |
| `EINTOPF-KONTEXT-ARCHIV.md` | Historische Fachdokumentation des archivierten, eigenständigen Eintopf-Rechners; weiterhin die Quelle für `js/eintopf-*.js` |
| `Kostenrechner.html`, `js/*.js` | Die App |
| `js/gelegenheiten.js` | Reiter „Gelegenheiten" (seit v3.17.0): Rangliste über alle Warengruppen, Hintergrundscan, Einkaufsliste, Merkliste |
| `js/craften.js` | Reiter „Craften: Gewinn" (seit v3.11.0, ersetzt „Schnelles Geld"): lohnende Crafts aus eingekauftem Material, mit Volumenfilter |
| `js/veredeln.js` | Reiter „Veredeln leveln": Veredeln mit Gewinn oder etwa Null; Einkaufs- und Verkaufsstädte mehrfach, eine Fertigungsstadt (seit v3.10.0) |
| `js/karte.js` | Reiter „Ancient Lands“: Karte, Lauf-Tracker, eigene Marker (seit v3.14.0) |
| `js/lootsplit.js` | Reiter „Lootsplit“ (seit v3.20.0): Beute einer Gruppe aufteilen, Regear vorab, Gildenkasse in % |
| `js/gemeinsam.js`, `tools/preisstand.js`, `.github/workflows/preisstand.yml` | Gemeinsamer Preisstand (seit v3.23.0): Zeitplan bei GitHub schreibt den Zweig `daten`, die App mischt ihn ein |
| `build_karte.py` | Erzeugt `assets/ancient-lands.webp` und `js/karte-daten.js` aus dem Client-Dump |
| `vendor/leaflet/` | Leaflet 1.9.4, lokal statt CDN |
| `rezepte.js`, `item-namen.js` | Von `build_graph.py` erzeugt, nicht von Hand bearbeiten |
| `build_graph.py` | Erzeugt `rezepte.js`/`item-namen.js` neu, braucht den Client-Dump |
| `design.md` | Verbindliche Design-Spezifikation (Farben/Typografie/Bausteine) |
| `tests/test.html` | Testsuite |
| `Versionen/` | Lokale, gitignored Schnappschüsse je Version |

**Nicht in diesem Repository, nur lokal im Albion-Ordner erreichbar** (für
einen reinen Projekt-Thread irrelevant, da archiviert/kein aktives
Arbeitsziel): die Original-Excel-Tabellen (`Eintöpfe.xlsx` u. a.), das Archiv
der eigenständigen Eintopf-Rechner-App, das fremde `Pizza/`-Projekt.
