# Albion Kostenrechner

Ermittelt für ein beliebiges craftbares Item aus Albion Online, auf einer
beliebigen Verzauberungsstufe, den guenstigsten Beschaffungsweg: fertig kaufen,
selbst craften (ueber jedes Alternativrezept), oder aus einer niedrigeren Stufe
hochverzaubern, jeweils rekursiv ueber den ganzen Rezeptbaum bis zu den
Rohstoffen. Ergebnis ist nicht nur ein Preis, sondern der vollstaendige Bauplan
samt Alternativen je Ebene.

Alles in Lymhurst, Qualitaet Normal. Andere Staedte und Qualitaetsstufen sind
bewusst nicht Teil dieser ersten Version.

## Benutzen

`Kostenrechner.html` per Doppelklick oeffnen. Kein Server, keine Installation.
Die App holt ihre Marktpreise selbst von `europe.albion-online-data.com` und
speichert sie zwischen, dafuer braucht sie beim ersten Aufruf Internetzugang.

## Aufbau

| Datei | Zweck |
|---|---|
| `Kostenrechner.html` | Die App |
| `js/ui.js` | Oberflaeche |
| `js/rechenkern.js` | Kostenrekursion: kaufen, craften, verzaubern |
| `js/regeln.js` | Spielformeln: ItemValue, Rueckgewinnung, Stationsgebuehr, Fokus |
| `js/preise.js` | Marktabruf, Zwischenspeicher, Eigenpreise |
| `rezepte.js` | Erzeugter Rezeptgraph aus dem offiziellen Client-Dump |
| `build_graph.py` | Erzeugt `rezepte.js` neu, selten noetig |
| `js/karte.js` | Reiter „Ancient Lands“: interaktive Karte mit Lauf-Tracker und eigenen Markern |
| `build_karte.py` | Erzeugt Kartenbild und Kartendaten der Ancient Lands aus dem Client-Dump |
| `tests/test.html` | Testsuite, per Doppelklick |
| `js/gemeinsam.js` | Gemeinsamer Preisstand: Dateiformat und Lader der App |
| `tools/preisstand.js` | Abrufer des gemeinsamen Preisstands (Node 20, ohne Abhängigkeiten) |
| `tests/preisstand-test.js` | Tests des Abrufers: `node tests/preisstand-test.js` |
| `.github/workflows/preisstand.yml` | Zeitplan des Abrufers bei GitHub |

Die belegten Spielregeln und Formeln, auf denen die Rechnung beruht, stehen
in `CLAUDE.md`. Der Auftrag in Arbeitspaketen steht in
`kostenrechner-PLAN.md`, der laufende Stand in `kostenrechner-KONTEXT.md`.

## Gemeinsamer Preisstand

Damit Preisdaten nicht nur im Browser jedes Einzelnen liegen, ruft ein
Workflow bei GitHub (`.github/workflows/preisstand.yml`) regelmäßig Preise und
Handelsvolumen ab und legt sie als Dateien auf dem Zweig **`daten`** ab
(`stand.json`, `preise.json`, `volumen.json`). Die App lädt sie beim Start und
dann alle 15 Minuten von
`https://raw.githubusercontent.com/Birnify/Albion_Crafting_Calculator/daten/`,
mischt sie in ihren Preisbestand (je Eintrag gewinnt der jüngere Abruf) und
ersetzt sie durch den eigenen Scan Stück für Stück. Abschalten: Reiter
„Gelegenheiten“, Einstellungen, Schalter „Gemeinsamen Preisstand laden“. Die
App schreibt nichts zu GitHub.

- **Der Zweig `daten` ist kein gewöhnlicher Zweig.** Er hat keine gemeinsame
  Geschichte mit `main`, besteht immer aus genau einem Commit und wird bei
  jedem Lauf überschrieben (force-push). Nichts von Hand dort ablegen, es
  geht beim nächsten Lauf verloren. `main` wird vom Workflow nie verändert.
- **Wie oft:** stündlich ein voller Lauf (ganzer Vorgabe-Scanumfang von
  „Gelegenheiten“, alle sieben Städte, höchstens 300 Abrufe), alle 15 Minuten
  ein schneller Lauf (nur die Preise der Spitze der Rangliste, höchstens 30
  Abrufe). GitHub startet Zeitpläne oft einige Minuten verspätet. Einträge,
  die älter als 7 Tage sind, fallen heraus.
- **Von Hand starten:** auf GitHub unter „Actions“, Workflow „Preisstand“,
  „Run workflow“, Lauf-Art `voll` oder `schnell` wählen. Der allererste Lauf
  muss ein voller sein; ohne dessen Stand tut der schnelle nichts.
- **Lokal ausprobieren:** `node tools/preisstand.js --voll --aus daten`
  (schreibt in den ignorierten Ordner `daten/`), mit `--max-abrufe N` für
  einen kurzen Versuch. Tests ohne echte Abrufe: `node tests/preisstand-test.js`.
- **GitHub schaltet Zeitpläne ab**, wenn in einem öffentlichen Repo 60 Tage
  lang nichts geschieht. Dann unter „Actions“ den Workflow wieder
  einschalten; bis dahin arbeitet die App mit ihrem eigenen Bestand weiter.
- Wird die Preis-Schnittstelle gedrosselt (HTTP 429), wartet ein Lauf
  höchstens einmal bis zur genannten Reset-Zeit und endet sonst vorzeitig:
  was geholt ist, wird geschrieben, der Rest bleibt auf dem alten Stand.

## Datenquellen

Rezepte aus [ao-data/ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps)
(offizieller Client-Dump), Preise von
[Albion Online Data Project](https://www.albion-online-data.com/).
