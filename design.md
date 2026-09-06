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
| 06.09.2026 | Icon-Kachel im grafischen Bauplan: eigener CSS-Rahmen (`--lvl0`..`--lvl4`) entfernt, stattdessen `@<Stufe>`-Suffix an der Render-Dienst-URL fuer den echten spielinternen Farbschimmer/Rauten, Icon-Groesse `size=48` auf `128` erhoeht | Nutzer-Feedback: Icon wirkte unscharf, und der eigene Rahmen war ueberfluessig, sobald das echte Icon den Verzauberungsgrad ohnehin zeigt. Text-Badge "T4.3" bleibt (Nutzer-Wunsch), nur der Rahmen fiel weg |
