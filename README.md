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
| `tests/test.html` | Testsuite, per Doppelklick |

Die belegten Spielregeln und Formeln, auf denen die Rechnung beruht, stehen
eine Ebene hoeher in `../CLAUDE.md`. Der Auftrag in Arbeitspaketen steht in
`kostenrechner-PLAN.md`, der laufende Stand in `kostenrechner-KONTEXT.md`.

## Datenquellen

Rezepte aus [ao-data/ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps)
(offizieller Client-Dump), Preise von
[Albion Online Data Project](https://www.albion-online-data.com/).
