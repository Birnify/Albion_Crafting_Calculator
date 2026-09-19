---
name: define-feature
description: Macht aus einer groben Idee eine kurze, strukturierte Feature-Definition (Name, Idee, Motivation, Scope, Abgrenzung). Bewusst kein ausführlicher Umsetzungs-Prompt. Gedacht als Eingabe für die Brainstorming-Phase des albion-cycle-orchestrator. Nutzen, wenn eine grobe Idee sauber festgehalten werden soll, bevor entschieden wird, ob und wie sie gebaut wird.
user-invocable: true
allowed-tools:
  - AskUserQuestion
  - Read
---

# /define-feature: Feature-Definition

Nimmt eine grobe Idee entgegen und gibt eine kurze, strukturierte Definition
zurück. Gedacht als Eingabe für die Brainstorming-Phase des
`albion-cycle-orchestrator`, der selbst entscheidet, wie er sie umsetzt.

Bewusst **kein** ausführlicher Umsetzungs-Prompt: keine Implementierungsdetails,
keine Akzeptanzkriterien, kein fertiger Auftrag.

## Eingabe

Grobe Idee (Argumente des Aufrufs):

$ARGUMENTS

- Sind die Argumente leer, nimm die zuletzt im Chat besprochene Idee.
- Verweisen die Argumente auf eine Datei, lies sie mit Read.
- Gibt es weder Argumente noch eine erkennbare Idee: kurz fragen, worum es geht.
  Nichts erfinden.

## Ablauf

1. **Kernidee erfassen.** Worum geht es im Kern? Nicht ausschmücken, nicht mit
   Umsetzungsdetails anreichern.

2. **Lücken erkennen und gezielt nachfragen.** Vorher im bisherigen Chatverlauf
   und in `kostenrechner-PLAN.md` bzw. `EINTOPF-KONTEXT-ARCHIV.md` nachsehen, ob
   Motivation, Scope oder Abgrenzung schon feststehen. Dann zählt das als
   vorhanden. Bei echten, dort nicht auflösbaren Lücken über `AskUserQuestion`
   nachfragen, so viele Runden wie nötig, aber nur Fragen, die eines der fünf
   Felder tatsächlich klären.

   Typische Lücken in diesem Projekt:
   - Ein **Spielwert** fehlt, den nur der Nutzer im Spiel ablesen kann
     (Stationssatz, Verzauberungsgebühr, Stadtbonus, Fokus-Effizienz).
   - Unklar, ob die Idee **v1** ist oder in die v2-Liste gehört
     (andere Städte, Qualitätsstufen, Markttiefe).
   - Unklar, ob sie den Kostenrechner-Kern oder den Eintopf-/Preisvergleich-
     Reiter betrifft.

3. **Auf fünf Felder verdichten.** Nicht mehr, nicht weniger:
   - **Name**: kurzer, eindeutiger Titel
   - **Idee**: ein Satz, was es tut
   - **Motivation**: warum, welches Problem es löst
   - **Scope**: grob, was dazugehört
   - **Abgrenzung**: was bewusst nicht dazugehört

4. **Auf Ideen-Höhe bleiben.** Keine Implementierungsschritte, keine
   Akzeptanzkriterien. Der Orchestrator arbeitet das selbst aus.

5. **Scope bewahren.** Nichts hinzuerfinden, was der Nutzer nicht gesagt hat. Im
   Zweifel knapp lassen statt spekulativ ausschmücken.

## Ausgabeformat

Erst die Rückfragen stellen und beantworten lassen, falls Schritt 2 eine echte
Lücke ergeben hat. Danach die Definition in einem eigenen Codeblock ausgeben,
direkt kopierbar für den Orchestrator. Kein Vorspann, keine Meta-Diskussion, keine
Ausführung der Aufgabe selbst.

## Beispiel

**Eingabe:** `waer gut wenn ich sehen koennte wie alt die preise sind`

**Ausgabe:**

```
Name: Preisalter sichtbar machen

Idee: Zu jedem verwendeten Marktpreis anzeigen, wie alt er ist, und zu alte Preise ausschliessen.

Motivation: Bei Ausruestung sind Preise oft Tage alt. Eine Rechnung auf veralteten Preisen sieht genauso serioes aus wie eine auf frischen, ist aber wertlos.

Scope: Alter je Preis anzeigen, einstellbare Hoechstgrenze, zu alte Preise sperren den Weg.

Abgrenzung: Keine Vorhersage kuenftiger Preise, keine Historienkurve.
```
