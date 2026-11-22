// js/tabs.js
//
// Reiterumschaltung der App-Fusion (13.09.2026): Kostenrechner / Eintopf-Rechner /
// Preisvergleich in einer Seite. Rein strukturell, keine Rechenlogik, kein
// Zustand ausser der sichtbaren Klasse/dem style.display - jeder Bereich bleibt
// fachlich eigenstaendig (eigenes Modul, eigener Zustand, eigener localStorage-
// Schluessel). Portiert aus dem Reiter-Umschalter des ehemals eigenstaendigen
// Eintopf-Rechners (Eintopf_Rechner.html), dort seit 13.09.2026 fuer
// Eintopf-Rechner/Preisvergleich im Einsatz.
//
// Seit v3.16.0 fuellt diese Datei ausserdem die app-weite Statusanzeige des
// Abrufplaners in der Reiterleiste (#abrufStatus, Daten aus PREISE.planer).
//
// Keine Persistenz des zuletzt aktiven Reiters: jeder Seitenaufruf startet
// bewusst wieder beim Kostenrechner (Basis-App), das ist keine Regression,
// weil es das vorher (eine App = ein Reiter) auch nicht gab.

(function () {
  "use strict";

  const ZUSTAND_TEXT = { ruht: "ruht", laeuft: "läuft", pausiert: "pausiert", limit: "wartet wegen Limit" };

  /** Text der Statusanzeige aus PREISE.planer.status(). Ohne DOM, testbar. */
  function abrufStatusText(s) {
    const bis = s.zustand === "limit" ? s.limitResetUm || s.wartetBis : null;
    const zustand = bis ? "Limit bis " + new Date(bis).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : ZUSTAND_TEXT[s.zustand] || s.zustand;
    return "Abrufe: " + zustand + " · " + s.offen + " offen · " + s.mb.toFixed(1).replace(".", ",") + " MB";
  }

  /** Tooltip der Statusanzeige. Ohne DOM, testbar. */
  function abrufStatusTitel(s, grenzen) {
    const zeilen = [
      "Warteschlange für die Preisabrufe von Kostenrechner, Gelegenheiten (Hintergrundscan), Craften: Gewinn und Veredeln leveln. Preisvergleich und Eintopf-Rechner rufen getrennt ab und zählen hier nicht mit.",
      "Abrufe laufen nacheinander mit " + String(grenzen.pauseMs / 1000).replace(".", ",") + " s Pause. Budget: höchstens " + grenzen.jeMinute + " je Minute und " + grenzen.je5Minuten + " je 5 Minuten (Limit der Schnittstelle: " + grenzen.limitJeMinute + " und " + grenzen.limitJe5Minuten + ").",
      "Letzte Minute: " + s.abrufeLetzteMinute + ", letzte 5 Minuten: " + s.abrufeLetzte5Minuten + ", seit dem Laden der Seite: " + s.abrufe + " Abrufe, " + s.mb.toFixed(2).replace(".", ",") + " MB Antwortdaten (unkomprimiert).",
    ];
    if (s.offen) zeilen.push("Offen: " + s.offenVordergrund + " im Vordergrund, " + s.offenHintergrund + " im Hintergrund.");
    if (s.zustand === "limit") {
      zeilen.push(
        "Wartet wegen Limit" + (s.wartetBis ? " bis " + new Date(s.wartetBis).toLocaleTimeString("de-DE") : "") + " und setzt dann selbst fort." +
          (s.limitResetUm ? " Die Schnittstelle drosselt und nennt als Ende " + new Date(s.limitResetUm).toLocaleTimeString("de-DE") + "." : "")
      );
    }
    if (s.zustand === "pausiert") {
      zeilen.push(s.hintergrundPausiert ? "Hintergrundabrufe sind angehalten." : "Hintergrundabrufe ruhen, solange der Tab verborgen ist.");
    }
    return zeilen.join(String.fromCharCode(10));
  }

  /** App-weite Statusanzeige des Abrufplaners (v3.16.0) in der Reiterleiste. */
  function abrufStatusEinrichten() {
    const feld = document.getElementById("abrufStatus");
    const text = document.getElementById("abrufStatusText");
    if (!feld || !text || typeof PREISE === "undefined" || !PREISE.planer) return;
    const grenzen = {
      pauseMs: PREISE.PAUSE_MS,
      jeMinute: PREISE.BUDGET_JE_MINUTE,
      je5Minuten: PREISE.BUDGET_JE_5_MINUTEN,
      limitJeMinute: PREISE.LIMIT_JE_MINUTE,
      limitJe5Minuten: PREISE.LIMIT_JE_5_MINUTEN,
    };
    const zeigen = (s) => {
      feld.dataset.zustand = s.zustand;
      text.textContent = abrufStatusText(s);
      feld.title = abrufStatusTitel(s, grenzen);
    };
    PREISE.planer.beiAenderung(zeigen);
    // Der Tooltip nennt Fensterwerte, die auch ohne Zustandswechsel altern.
    feld.addEventListener("mouseenter", () => zeigen(PREISE.planer.status()));
    feld.addEventListener("focus", () => zeigen(PREISE.planer.status()));
    zeigen(PREISE.planer.status());
  }

  // Fuer tests/test.html (dort gibt es kein App-Markup).
  window.TABS = { abrufStatusText, abrufStatusTitel };

  function boot() {
    abrufStatusEinrichten();
    const buttons = document.querySelectorAll(".tabbtn");
    if (!buttons.length) return; // z.B. in tests/test.html, wo kein App-Markup vorhanden ist

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        document.querySelectorAll(".tabpane").forEach((p) => {
          p.style.display = "none";
        });
        const pane = document.getElementById("tab-" + btn.dataset.tab);
        if (pane) pane.style.display = "";
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
