# Design-System Kostenrechner

Verbindliche Design-Referenz, entstanden aus einem Claude-Design-Mockup
(05./06.09.2026, Nutzer-Vorgabe "deutlich spielerischer, Albion-Thema").
**Vor jeder Design-Entscheidung (neue Komponente, neue Farbe, neuer Text-Stil)
zuerst hier nachsehen, ob es schon eine passende Regel gibt.** Weicht eine
Umsetzung bewusst davon ab, den Grund hier ergaenzen, nicht stillschweigend
eine zweite Konvention einfuehren.

Mockup-Quelldateien (Referenz, nicht Teil der App):
`C:\Users\soere\AppData\Local\Temp\claude\...\scratchpad\design\*.dc.html`
(Cover, Main, BauplanGrafisch, AlleWege, Einstellungen). Pfad ist
sitzungsgebunden und kann verschwinden; dieses Dokument ist die dauerhafte
Quelle, sobald die App umgestellt ist.

## Grundprinzip

Dunkles Fantasy-/Pergament-Thema statt des bisherigen hellen Funktions-Looks.
Kein Light/Dark-Umschalten mehr noetig (ersetzt `@media prefers-color-scheme`),
die App ist durchgehend dunkel, wie ein Spiel-Interface.

## Farben (oklch)

```css
--bg:        oklch(0.15 0.02 55);   /* Seitenhintergrund */
--bg-2:      oklch(0.19 0.024 55);  /* Eingabefelder, Icon-Slot-Hintergrund */
--panel:     oklch(0.225 0.026 58); /* Panel-Verlauf unten */
--panel-2:   oklch(0.27 0.03 58);   /* Panel-Verlauf oben */
--line:      oklch(0.34 0.03 60);   /* normale Trennlinie */
--line-strong: oklch(0.46 0.05 72); /* betonter Rahmen (Karten, Buttons) */
--text:      oklch(0.93 0.015 75);  /* Fliesstext */
--dim:       oklch(0.68 0.02 65);   /* Nebentext, Labels */
--gold:      oklch(0.78 0.14 85);   /* Akzent: Ueberschriften, primaere Buttons, Links */
--gold-dim:  oklch(0.52 0.1 85);    /* Panel-Eckornamente, Fokus-Ring */
--green:     oklch(0.72 0.13 145);  /* Status ok, Craften-Badge */
--purple:    oklch(0.72 0.13 300);  /* Verzaubern-Badge, Stufe 3 */
--teal:      oklch(0.72 0.12 200);  /* Reroll-Badge */
--red:       oklch(0.62 0.19 25);   /* Gesperrt/Fehler */
```

Statusfarben in Tabellen/Badges: `ok` = `--green` auf `oklch(0.72 0.13 145 / .14)`
Hintergrund, `gesperrt` = `--red` auf `oklch(0.62 0.19 25 / .14)` Hintergrund.

## Typografie

- Ueberschriften (`h1,h2,h3`, Panel-Titel, Hero-Betrag-Label): **Cinzel**,
  Gewicht 600-800, `letter-spacing:.02em`.
- Fliesstext, Labels, Werte: **Manrope**, Gewicht 500-800 je nach Kontext.
- Beide via Google Fonts: `@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Manrope:wght@500;600;700;800&display=swap');`
- Sektionstitel (`.sek-t`): 11px, 800, Grossbuchstaben, `letter-spacing:.14em`,
  Farbe `--gold`, mit kleinem Icon davor.
- Tabellen-Kopf: 10.5px, 800, Grossbuchstaben, `--dim`.
- Zahlen (Silber, Fokus, FCE): `font-variant-numeric: tabular-nums`.

## Bausteine

**`.gp-panel`** – der wiederkehrende Rahmen fuer jeden Abschnitt: Verlauf
`--panel-2` nach `--panel`, 1px `--line`-Rand, dezenter Schatten, und zwei
goldene Eckklammern oben links/rechts (`::before`/`::after`, 9x9px,
`border-color: --gold-dim`, nur obere+seitliche Kante). Ersetzt die bisherigen
schlichten `.panel`-Kacheln.

**Banner** (nur oben auf der Hauptseite): 172px hohes Bild
(`assets/lymhurst-bg.jpg`, Bildausschnitt 50% 38%, `saturate(0.9)
brightness(0.85)`), unten abgedunkelter Verlauf, Marke ("Kostenrechner" in
Cinzel/gold) unten links im Bild.

**Hero-Ergebnis** (guenstigster Weg): warmer Verlauf
(`oklch(0.3 0.05 70)` nach `oklch(0.19 0.03 55)`), 3-spaltiges Grid mit
Icon-Kachel + Label + Wert je Kennzahl (Kosten/Fokus/Gewinn), grosse weisse
Zahlen, `--gold` fuer Icons und Kicker-Label.

**Buttons/Segmented Control**: `.btn` = 1px `--line`, Hintergrund `--bg-2`;
`.btn.primary` und aktives Segment (`.seg button.on`) = voll `--gold` mit
dunklem Text (`oklch(0.2 0.03 60)`).

**Badges** (Aktionstyp: Kaufen/Craften/Verzaubern/Reroll/Gesperrt): Textfarbe =
die jeweilige Akzentfarbe, Hintergrund dieselbe Farbe bei 10-14% Deckkraft.

**Icon-Kachel** (Bauplan grafisch, Stand 06.09.2026 nach zwei Ueberarbeitungs-
Runden): kein eigener CSS-Rahmen mehr (das `--lvl0`..`--lvl4`-System aus
v1.9.0 wurde entfernt). Der Render-Dienst liefert den Verzauberungs-Look
jetzt direkt im Bild mit:
- `itemIconUrl(item, qualitaet, stufe)` haengt `@<stufe>` an die Item-ID
  UND erhoeht `size` auf 128 (vorher 48, wirkte auf der 64px-Anzeigeflaeche
  unscharf). Das `@<stufe>`-Suffix liefert den ECHTEN spielinternen
  Farbschimmer plus gefuellte Rauten fuer die Verzauberungsstufe direkt im
  Bild - unabhaengig vom `quality`-Parameter, der nur den inneren Rahmen
  (Gegenstandsqualitaet Normal..Meisterwerk) faerbt. Beide Parameter sind
  eigenstaendig, nicht verwechseln (live gegen den Dienst geprueft,
  06.09.2026).
- `.bg-ic-wrap` 64x64px, `.bg-slot` ohne Rahmen, Icon per `object-fit:cover`
  + `transform:scale(1.22)` randfuellend zugeschnitten (Wert empirisch im
  Browser gegen echte Render-Service-Icons ermittelt, s. Commit v1.9.0 -
  **nicht ohne erneuten visuellen Test aendern**).
- `.bg-ic-lvl` oben links: kombiniertes Badge "T\<Tier>.\<Stufe>" bleibt
  (Punkt entfaellt bei Stufe 0), Hintergrund `--gold-dim`, dunkler Text -
  jetzt zusaetzlich zum echten Icon-Schimmer, nicht mehr als Ersatz dafuer.
- `.bg-ic-qty` oben rechts: Stueckzahl kompakt ohne erzwungene
  Nachkommastellen ("2×" statt "2,00×"), nur bei echten Mengenkanten
  (nicht bei "Vorstufe"/"Normal beschaffen").

**Tabellen** (Alle Wege, Stationssaetze): rechtsbuendige Zahlenspalten,
`--line`-Trennlinien, beste Zeile (`tr.best`) mit gruenem linkem Balken
(3px `--green`) und leicht gruen getoentem Hintergrund, Status als Pille
(`.status`, abgerundet, Grossbuchstaben).

**Eingabefelder**: `--bg-2` Hintergrund, `--line` Rand, Fokusring
`box-shadow: 0 0 0 3px oklch(0.6 0.1 85 / .18)` plus `border-color: --gold-dim`.
Pill-Auswahl (Handelsweg in Einstellungen) analog zum Segmented Control.

## Bilder

- `assets/lymhurst-bg.jpg` – Banner Hauptseite. Offizielles Albion-Online-
  Wallpaper (albiononline.com/wallpapers), auf ~57 KB komprimiert.
- `assets/radiantwilds-bg.jpg` – nur im Cover-Mockup verwendet ("Radiant
  Wilds" von Carlos Ancot); fuer die App selbst nicht zwingend noetig, da sie
  keine separate Titelseite hat. Falls doch verwendet: Bildnachweis sichtbar
  lassen (Wallpaper-Lizenzbedingungen).

## Was sich NICHT aendert

Reine CSS-/Markup-Umstellung. Keine Aenderung an Rechenkern, Rezeptdaten,
Kalkulationslogik oder den Bezeichnungen/IDs im DOM, die von `js/ui.js`
angesprochen werden (IDs wie `#suche`, `#bauplan`, Klassen wie `.kn-*`, die
`js` per `getElementById`/`querySelector` anspricht, muessen erhalten bleiben
oder die JS-Referenzen entsprechend mitgezogen werden). Die Icon-Kachel-Logik
aus v1.9.0 (Farbrahmen, kombiniertes Badge, Crop-Faktor) bleibt funktional
unangetastet, nur die Farbwerte wandern auf die oklch-Token dieses Dokuments.

## Aenderungsprotokoll

| Datum | Was | Warum |
|---|---|---|
| 06.09.2026 | Dokument angelegt aus dem Claude-Design-Mockup | Nutzer-Wunsch: Entscheidungen dauerhaft nachschlagbar machen, nicht nur im Mockup |
| 06.09.2026 | `.gp-panel` als eigene CSS-Klasse umgesetzt, aber die generischen Alt-Variablennamen (`--accent`, `--good(-bg)`, `--bad(-bg)`, `--warn(-bg)`), die der Grossteil des bestehenden Stylesheets bereits nutzte, als Aliase auf die neuen oklch-Tokens umgehaengt statt jede einzelne Regel auf die neuen Tokennamen umzubenennen | Identisches optisches Ergebnis, deutlich kleinere Aenderungsflaeche im bestehenden CSS, geringeres Risiko fuer die JS-Verzahnung |
| 06.09.2026 | Hero-Kennzahlen bekommen keine Bild-Icons, sondern kleine goldgerahmte Buchstaben-Kacheln (W/S/F/G), rein per CSS `nth-child` | Keine Icon-Assets fuer die Hero-Kennzahlen vorhanden, kein Format dafuer spezifiziert; die Reihenfolge der vier Spalten in `renderHero()` ist stabil, deshalb ohne JS-Aenderung ueber CSS adressierbar |
| 08.11.2026 | Reiter „Ancient Lands“: Kartenbild selbst gerendert in den Thema-Farben (Inseln Moosgrün, Klippen Braun, goldene Kante, dunkler Grund), Symbole als runde Pins mit 1,5px-Rand in der Akzentfarbe (Truhe `--gold`, Schrein `--purple`, Ausgang `--teal`, Drache Orange-Rot), eigene Marker als Tropfenform. Karten wie im Veredeln-Reiter (`--r-card`), Ebenen als Pillen-Chips | Einheitlich mit den Badge-Farben; Spielkarte wirkt sonst wie ein Fremdkörper |
| 22.11.2026 | Statusanzeige des Abrufplaners (`.abruf-status`) rechts in der Reiterleiste: Pille mit `--line`-Rand auf `--bg-2`, 11,5px Manrope 700, `tabular-nums`, davor ein 8px-Punkt als Zustand (ruht `--line-strong`, läuft `--green`, pausiert `--gold`, wartet wegen Limit `--red`). Erläuterung nur im Tooltip | App-weit sichtbar, ohne eigenen Kasten; Farben wie die Status-Badges |
| 22.11.2026 | Reiter „Gelegenheiten“ (v3.17.0): Bausteine wie „Craften: Gewinn“ (`vd-*`, `cg-*`). Neu: Einstellungen als eingeklappter Block über der Liste (`details.gl-einst`, Titel in Cinzel/Gold, Kurzfassung in `--dim`), weil hier die Rangliste und nicht die Auswahl die Hauptsache ist. Mitlaufende Leiste (`.gl-leiste`, `position:sticky`) mit Scan-Schalter, Stand (8px-Punkt wie die Abruf-Statusanzeige: läuft `--green`, ruht `--gold`, Fehler `--red`) und dem Knopf „Neu sortieren“. Alte Zeilen (`tr.gl-alt`): Altersangabe in `--warn` und fett, Gewinn und Marge mit 72 % Deckkraft; frische Zeilen: Alter in `--dim`. Warnschild `.gl-warnung` (fehlender Stationssatz): `--warn` auf `--warn-bg` mit 1px-Rand, wie `.pill.warn` | Liste soll beim Öffnen sofort sichtbar sein; Alter dezent, ohne eigenen Kasten |
| 22.11.2026 | Gewinn-Tabellen (`.vd-tabelle`, v3.18.0): zwei Spalten mehr (Gewinn/Tag, Mehrgewinn je Fokus). Zahlenspalten mit 7px statt 12px Seitenabstand, Köpfe unten ausgerichtet, zweizeilige Köpfe („Mehrgewinn je Fokus“, „Kosten gesamt“, „Gewinn gesamt“) rechtsbündig. Neues Feld „Annahme: Anteil %“ wie die übrigen Zahlenfelder der Karte „Wie rechnen“ | Die Sortierspalte Gewinn/Tag soll bei 1440px ohne waagerechtes Scrollen sichtbar sein |
| 22.11.2026 | „Von der Gelegenheit zur Tat“ (v3.19.0). Je Zeile in „Gelegenheiten“ eine Knopfreihe unter dem Produkt (`.gl-aktionen`): Zähler wie in „Craften: Gewinn“ (`.cg-zaehler`), Merkstern (`button.gl-stern`, 28px, `aria-pressed`; gemerkt = `--gold` auf `--accent-soft`), „Kostenrechner“ (`button.mini.vd-kr`, auch in „Craften: Gewinn“ und „Veredeln leveln“, dort in `.vd-zeilenknoepfe`), „Kopieren“ am Produktnamen. Mitlaufende Leiste: Filter „Gemerkt (n)“ (gedrückt = volles `--gold` wie `.btn.primary`) und Sprungknopf „Einkaufsliste (n)“. Im Filter „Gemerkt“ steht der Wert vom Merken über dem heutigen als „damals 21.815“ (`.gl-damals`, 12px, 700, Zahl in `--text`, das Wort „damals“ in `--dim`), dahinter ▲ in `--good` oder ▼ in `--bad` für die Richtung bis heute; am Produkt die Unterzeile „★ gemerkt vor 3 Std.“ in `--gold`; Einzelheiten im Tooltip der ganzen Zelle. Einkaufsliste unter der Rangliste mit den Bausteinen aus „Craften: Gewinn“ (`.cg-einkaufsliste`), dazu je geplantem Produkt Erlös und Gewinn im Schild und in beiden Reitern vier Summenzeilen (Einkauf gesamt, Kosten nach Rückgewinnung, Erlös gesamt, Gewinn gesamt, jede mit Tooltip); Produkte außerhalb der Rangliste mit gestricheltem Rand (`.gl-ausser-rang`). Sichtbarer Fokus aller Zeilenknöpfe: 2px `--gold` | Kurze Wege aus der Rangliste; nichts davon braucht einen eigenen Kasten |
| 22.11.2026 | Gewinn-Tabellen bei 1440px ohne waagerechtes Scrollen (v3.19.0): Köpfe mit Schrägstrich zweizeilig („Kosten /Stück“, „Gewinn /Stück“, „Gewinn /Tag“, „verkauft /Tag“), Zellen 10px Seitenabstand, Zahlenspalten 5px, Zutatenzeile mit Name ab 116px, Preisfeld 76px (vorher 84px; seit v3.19.0 ein Textfeld, das den Preis mit Tausenderpunkt zeigt und beim Hineinklicken ohne) und Höchstpreis so breit wie sein Inhalt, Unterzeilen „Fokus je Vorgang“ und „Fokus begrenzt“ umbrechbar (`.vd-umbruch`). Zahlenzellen brechen nicht um | In „Craften: Gewinn“ lagen zwei Spalten hinter waagerechtem Scrollen, in „Veredeln leveln“ war die letzte angeschnitten |
| 22.11.2026 | Reiter „Lootsplit“ (v3.20.0): Karten wie in „Ancient Lands“ (`.ls-karte`, `--r-card`). Eine Tabelle, je Mitglied eine Zeile: links die vier Eingaben (Name, Lootwert, Geldbeutel, Regear; Zahlenfelder 132px, rechtsbündig, `tabular-nums`, Tausenderpunkt beim Verlassen), rechts nach einer `--line-strong`-Trennlinie Anspruch, Hält, Saldo. Saldo als Text: „zahlt“ in `--gold`, „bekommt“ in `--green`, „ausgeglichen“ in `--dim`. Ungültige Eingabe: Rand `--red` mit rotem Fokusring. Hinweis „Topf reicht nicht fürs Regear“ (`.ls-warnung`): `--warn` auf `--warn-bg` mit 1px-Rand, wie `.gl-warnung`. Zusammenfassung als Rechenschritte untereinander (`.ls-rz`, Zwischensummen in `--text` mit Zahl in `--gold`), Erläuterungen nur in Tooltips | Eingabe und Ergebnis je Mitglied in einer Zeile; kein Erklärkasten |
| 22.11.2026 | Markttiefe im Einkauf (v3.21.0): an der Zelle „Gewinn/Tag“ ein kleines Schild unter der Zahl (`.vd-grenze`, Form wie das Stadtschild `.vd-stadt`: 11px, 700, `--r-tag`). „Einkauf“ in `--warn` auf `--warn-bg`, wenn das Tagesvolumen einer Zutat die Stückzahl begrenzt; „Einkauf ?“ nur als 1px-Umriss in `--dim`, wenn das Volumen einer Zutat noch nicht abgerufen ist. Alle drei Grenzen (Absatz, Einkauf, Fokus) mit Zahlen im Tooltip der Zelle, verkauft/Tag der Zutat im Tooltip ihres Preises. Feld heißt jetzt „Annahme: Marktanteil %“ (gilt für Einkauf und Verkauf). Keine neue Spalte | Die Grenze soll sichtbar sein, ohne Erklärkasten und ohne die Tabelle bei 1440px zu verbreitern |
| 06.09.2026 | Icon-Kachel im grafischen Bauplan: eigener CSS-Rahmen (`--lvl0`..`--lvl4`) entfernt, stattdessen `@<Stufe>`-Suffix an der Render-Dienst-URL fuer den echten spielinternen Farbschimmer/Rauten, Icon-Groesse `size=48` auf `128` erhoeht | Nutzer-Feedback: Icon wirkte unscharf, und der eigene Rahmen war ueberfluessig, sobald das echte Icon den Verzauberungsgrad ohnehin zeigt. Text-Badge "T4.3" bleibt (Nutzer-Wunsch), nur der Rahmen fiel weg |
