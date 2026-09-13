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
// Keine Persistenz des zuletzt aktiven Reiters: jeder Seitenaufruf startet
// bewusst wieder beim Kostenrechner (Basis-App), das ist keine Regression,
// weil es das vorher (eine App = ein Reiter) auch nicht gab.

(function () {
  "use strict";

  function boot() {
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
