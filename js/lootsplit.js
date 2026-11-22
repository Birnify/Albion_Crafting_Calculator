// js/lootsplit.js
//
// Reiter "Lootsplit" (v3.20.0): nach einer Gruppenrunde ausrechnen, wem wie
// viel zusteht und wer wem wie viel überweist. Je Mitglied drei Werte:
// Lootwert (gehaltene Beute, geschätzt), Geldbeutel (eingesammeltes Silber),
// Regear (verlorene Ausrüstung). Die Gildenkasse bekommt ihren Anteil in %
// vom ganzen Topf, danach wird das Regear erstattet, der Rest wird gleich
// geteilt (Nutzer-Entscheidung 22.11.2026, v3.20.1).
//
// Reine Rechenfunktionen oben (ohne DOM, getestet in selbsttest()), die
// Verdrahtung mit der Seite darunter. Keine Abrufe, kein gemeinsamer Zustand
// mit anderen Reitern, eigener localStorage-Schlüssel.

(function () {
  "use strict";

  const SPEICHER = "albion_kostenrechner_lootsplit_v1";
  const MAX_WERT = 999999999999; // je Feld; darüber wird die Eingabe abgelehnt
  const MAX_ZEILEN = 100;
  const MAX_NAME = 40;
  const VORGABE_ZEILEN = 5;
  const GILDE = "gilde";
  const GILDE_NAME = "Gildenkasse";

  // ------------------------------------------------------------ reine Helfer

  /** Ganze Zahl mit Tausenderpunkt. */
  function zahlText(n) {
    return Math.round(Number(n) || 0).toLocaleString("de-DE");
  }

  /** Prozent mit Komma, höchstens eine Nachkommastelle. */
  function prozentText(p) {
    return String(Math.round((Number(p) || 0) * 10) / 10).replace(".", ",");
  }

  /**
   * Silber-Eingabe lesen. Versteht Tausenderpunkte ("1.234.567"), Komma als
   * Dezimaltrenner und die Kürzel k und m ("250k", "1,5m"). Leer zählt als 0.
   * Ergebnis: ganze Silber, oder null bei ungültiger oder negativer Eingabe.
   */
  function zahlLesen(text) {
    let s = String(text == null ? "" : text).toLowerCase().replace(/\s+/g, "");
    if (s === "") return 0;
    let faktor = 1;
    const kuerzel = /^(.*?)(k|m|mio)$/.exec(s);
    if (kuerzel) {
      s = kuerzel[1];
      faktor = kuerzel[2] === "k" ? 1e3 : 1e6;
    }
    let ganz = s;
    let bruch = "";
    if (s.indexOf(",") >= 0) {
      const teile = s.split(",");
      if (teile.length !== 2) return null;
      ganz = teile[0];
      bruch = teile[1];
      if (/^\d{1,3}(\.\d{3})+$/.test(ganz)) ganz = ganz.replace(/\./g, "");
    } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      ganz = s.replace(/\./g, ""); // deutscher Tausenderpunkt
    } else if (/^\d+\.\d+$/.test(s)) {
      const teile = s.split("."); // "1.5m": Punkt als Dezimaltrenner
      ganz = teile[0];
      bruch = teile[1];
    }
    if (!/^\d+$/.test(ganz) || !/^\d*$/.test(bruch)) return null;
    const wert = Math.round(Number(ganz + "." + (bruch || "0")) * faktor);
    if (!isFinite(wert) || wert < 0 || wert > MAX_WERT) return null;
    return wert;
  }

  /** Prozent-Eingabe 0 bis 100, eine Nachkommastelle. Leer zählt als 0, sonst null bei Ungültigem. */
  function prozentLesen(text) {
    const s = String(text == null ? "" : text).replace(/\s+/g, "").replace(/%$/, "");
    if (s === "") return 0;
    if (!/^\d{1,3}([.,]\d*)?$/.test(s)) return null;
    const p = Math.round(Number(s.replace(",", ".")) * 10) / 10;
    return isFinite(p) && p >= 0 && p <= 100 ? p : null;
  }

  function wert(v) {
    const x = Math.floor(Number(v));
    return isFinite(x) && x > 0 ? Math.min(x, MAX_WERT) : 0;
  }

  function leeresMitglied() {
    return { name: "", loot: 0, beutel: 0, regear: 0 };
  }

  /** Eine Zeile zählt als Mitglied, sobald sie einen Namen oder einen Wert trägt. */
  function zaehlt(m) {
    return !!(m && (String(m.name || "").trim() || wert(m.loot) || wert(m.beutel) || wert(m.regear)));
  }

  /** Abrunden von a × b / c in ganzen Zahlen, ohne Gleitkommafehler bei großen Werten. */
  function malDurch(a, b, c) {
    return Number((BigInt(a) * BigInt(b)) / BigInt(c));
  }

  /**
   * Die Rechnung. mitglieder: [{name, loot, beutel, regear}], prozent: Anteil
   * der Gildenkasse am ganzen Topf. Jede übergebene Zeile zählt als
   * Mitglied (leere Zeilen filtert die Oberfläche vorher über zaehlt()).
   *
   *   Topf = Loot + Geldbeutel
   *   Gildenkasse = abrunden(Topf × Prozent / 100)
   *   Verfügbar = Topf minus Gildenkasse; Rest = Verfügbar minus Regear
   *   Anteil = abrunden(Rest / Anzahl)
   *   Rundungsrest: an die Gildenkasse, falls Prozent > 0, sonst an das erste Mitglied
   *   Anspruch = Regear + Anteil; Saldo = hält minus Anspruch (> 0 zahlt, < 0 bekommt)
   *
   * Reicht es nach der Gildenkasse nicht fürs Regear (Rest < 0): die
   * Gildenkasse behält ihren Anteil, kein Anteil für die Mitglieder, Regear
   * anteilig (abrunden(Regear × Verfügbar / RegearSumme)), der Rundungsrest
   * geht an das Mitglied mit dem höchsten Regear.
   *
   * Summe aller Salden = Gildenkasse, immer exakt (ganze Silber).
   */
  function rechnen(mitglieder, prozent) {
    const liste = Array.isArray(mitglieder) ? mitglieder : [];
    const n = liste.length;
    const zehntel = Math.min(1000, Math.max(0, Math.round((Number(prozent) || 0) * 10)));
    const zeilen = liste.map((m, i) => {
      const mm = m && typeof m === "object" ? m : {};
      const loot = wert(mm.loot), beutel = wert(mm.beutel), regear = wert(mm.regear);
      return { name: String(mm.name == null ? "" : mm.name).trim() || "Mitglied " + (i + 1), loot: loot, beutel: beutel, regear: regear, haelt: loot + beutel, anspruch: 0, saldo: 0 };
    });
    const summe = (feld) => zeilen.reduce((s, z) => s + z[feld], 0);
    const lootSumme = summe("loot"), beutelSumme = summe("beutel"), regearSumme = summe("regear");
    const topf = lootSumme + beutelSumme;
    const gildeAusProzent = malDurch(topf, zehntel, 1000);
    const verfuegbar = topf - gildeAusProzent;
    const rest = verfuegbar - regearSumme;
    const e = {
      n: n, prozent: zehntel / 10, lootSumme: lootSumme, beutelSumme: beutelSumme, topf: topf, gildeAusProzent: gildeAusProzent, verfuegbar: verfuegbar,
      regearSumme: regearSumme, rest: rest, knapp: rest < 0, gildenkasse: gildeAusProzent, anteil: 0, rundungsrest: 0, rundungsrestAn: null, zeilen: zeilen, kontrolle: 0,
    };
    if (n > 0 && rest < 0) {
      let hoechstes = 0;
      zeilen.forEach((z, i) => {
        z.anspruch = malDurch(z.regear, verfuegbar, regearSumme);
        if (z.regear > zeilen[hoechstes].regear) hoechstes = i;
      });
      e.rundungsrest = verfuegbar - summe("anspruch");
      if (e.rundungsrest > 0) {
        zeilen[hoechstes].anspruch += e.rundungsrest;
        e.rundungsrestAn = hoechstes;
      }
    } else if (n > 0) {
      e.anteil = Math.floor(rest / n);
      e.rundungsrest = rest - e.anteil * n;
      zeilen.forEach((z) => {
        z.anspruch = z.regear + e.anteil;
      });
      if (e.rundungsrest > 0) {
        if (zehntel > 0) {
          e.gildenkasse += e.rundungsrest;
          e.rundungsrestAn = GILDE;
        } else {
          zeilen[0].anspruch += e.rundungsrest;
          e.rundungsrestAn = 0;
        }
      }
    }
    zeilen.forEach((z) => {
      z.saldo = z.haelt - z.anspruch;
    });
    e.kontrolle = summe("saldo") - e.gildenkasse;
    return e;
  }

  /**
   * Überweisungen aus den Salden: der größte Schuldner zahlt an den größten
   * Gläubiger, bis alles ausgeglichen ist. Die Gildenkasse ist ein Empfänger.
   * Höchstens (Beteiligte minus 1) Zeilen. von/an: Index in ergebnis.zeilen
   * oder "gilde".
   */
  function ueberweisungen(ergebnis) {
    const e = ergebnis || { zeilen: [], gildenkasse: 0 };
    const zahler = [], empfaenger = [];
    e.zeilen.forEach((z, i) => {
      if (z.saldo > 0) zahler.push({ id: i, name: z.name, offen: z.saldo });
      else if (z.saldo < 0) empfaenger.push({ id: i, name: z.name, offen: -z.saldo });
    });
    if (e.gildenkasse > 0) empfaenger.push({ id: GILDE, name: GILDE_NAME, offen: e.gildenkasse });
    const groesster = (arr) => arr.reduce((best, x) => (x.offen > best.offen ? x : best), arr[0]);
    const out = [];
    let sicherung = zahler.length + empfaenger.length + 1;
    while (sicherung-- > 0) {
      const offenZ = zahler.filter((x) => x.offen > 0), offenE = empfaenger.filter((x) => x.offen > 0);
      if (!offenZ.length || !offenE.length) break;
      const z = groesster(offenZ), g = groesster(offenE);
      const betrag = Math.min(z.offen, g.offen);
      z.offen -= betrag;
      g.offen -= betrag;
      out.push({ von: z.id, vonName: z.name, an: g.id, anName: g.name, betrag: betrag });
    }
    return out;
  }

  function saldoText(saldo) {
    return saldo > 0 ? "zahlt " + zahlText(saldo) : saldo < 0 ? "bekommt " + zahlText(-saldo) : "ausgeglichen";
  }

  /** Satzanfang des Hinweises, wenn es nicht fürs Regear reicht. */
  function knappText(e) {
    return e.gildeAusProzent > 0 ? "Nach der Gildenkasse reicht der Topf nicht fürs Regear" : "Topf reicht nicht fürs Regear";
  }

  /** Klartext für Discord: Kopfzeile, je Mitglied eine Zeile, darunter die Überweisungen. */
  function ergebnisText(ergebnis, liste) {
    const e = ergebnis;
    const ue = liste || ueberweisungen(e);
    const zeilen = [
      "Lootsplit: Topf " + zahlText(e.topf) + " · Gildenkasse " + zahlText(e.gildenkasse) + " (" + prozentText(e.prozent) + " %) · Regear " + zahlText(e.regearSumme) + " · Anteil " + zahlText(e.anteil),
    ];
    if (e.knapp) zeilen.push(knappText(e) + " (es fehlen " + zahlText(-e.rest) + "), Erstattung anteilig.");
    e.zeilen.forEach((z) => zeilen.push(z.name + ": Anspruch " + zahlText(z.anspruch) + ", " + saldoText(z.saldo)));
    zeilen.push("Überweisungen:" + (ue.length ? "" : " keine"));
    ue.forEach((u) => zeilen.push(u.vonName + " zahlt " + u.anName + " " + zahlText(u.betrag)));
    return zeilen.join("\n");
  }

  /** Speicherstand säubern. Ohne brauchbaren Stand: fünf leere Zeilen, Gildenkasse 0 %. */
  function bereinigen(roh) {
    const r = roh && typeof roh === "object" ? roh : null;
    if (!r || !Array.isArray(r.mitglieder)) {
      return { prozent: 0, mitglieder: Array.from({ length: VORGABE_ZEILEN }, leeresMitglied) };
    }
    const p = Number(r.prozent);
    return {
      prozent: isFinite(p) ? Math.min(100, Math.max(0, Math.round(p * 10) / 10)) : 0,
      mitglieder: r.mitglieder.filter((m) => m && typeof m === "object").slice(0, MAX_ZEILEN).map((m) => ({
        name: (typeof m.name === "string" ? m.name : "").trim().slice(0, MAX_NAME),
        loot: wert(m.loot),
        beutel: wert(m.beutel),
        regear: wert(m.regear),
      })),
    };
  }

  /** "Neuer Split": Werte leeren, Namen und Gildenkasse behalten. */
  function neuerSplit(zustand) {
    return { prozent: zustand.prozent, mitglieder: zustand.mitglieder.map((m) => ({ name: m.name, loot: 0, beutel: 0, regear: 0 })) };
  }

  // ------------------------------------------------------------ Oberfläche

  function boot() {
    const wurzel = document.getElementById("tab-lootsplit");
    if (!wurzel) return; // z.B. tests/test.html
    const el = (id) => document.getElementById(id);
    const tbody = el("lsZeilen");
    const feldProzent = el("lsProzent");

    let roh = null;
    try { roh = JSON.parse(localStorage.getItem(SPEICHER)); } catch (err) { roh = null; }
    let zustand = bereinigen(roh);
    let letztes = null; // { ergebnis, liste } der letzten Rechnung, für "Ergebnis kopieren"

    function speichern() {
      try { localStorage.setItem(SPEICHER, JSON.stringify({ v: 1, prozent: zustand.prozent, mitglieder: zustand.mitglieder })); } catch (err) { /* voll oder gesperrt: weiter ohne Speichern */ }
    }

    const neu = (tag, klasse, text) => {
      const x = document.createElement(tag);
      if (klasse) x.className = klasse;
      if (text != null) x.textContent = text;
      return x;
    };
    const feldText = (n) => (n > 0 ? zahlText(n) : "");

    const FELDER = [
      { feld: "name", label: "Name" },
      { feld: "loot", label: "Lootwert" },
      { feld: "beutel", label: "Geldbeutel" },
      { feld: "regear", label: "Regear" },
    ];

    function zeileBauen(m) {
      const tr = neu("tr");
      FELDER.forEach((f) => {
        const td = neu("td", f.feld === "name" ? "l" : "");
        const inp = neu("input", f.feld === "name" ? "ls-name" : "ls-zahl");
        inp.type = "text";
        inp.dataset.feld = f.feld;
        inp.autocomplete = "off";
        inp.spellcheck = false;
        if (f.feld === "name") {
          inp.maxLength = MAX_NAME;
          inp.value = m.name;
        } else {
          inp.inputMode = "text";
          inp.placeholder = "0";
          inp.value = feldText(m[f.feld]);
        }
        td.appendChild(inp);
        tr.appendChild(td);
      });
      ["anspruch", "haelt", "saldo"].forEach((k) => tr.appendChild(neu("td", "num ls-" + k)));
      const td = neu("td", "ls-weg-zelle");
      const weg = neu("button", "ls-weg", "×");
      weg.type = "button";
      td.appendChild(weg);
      tr.appendChild(td);
      return tr;
    }

    /** Platzhalter und aria-Beschriftungen nach der Zeilennummer setzen (nach Hinzufügen und Entfernen). */
    function nummern() {
      Array.from(tbody.rows).forEach((tr, i) => {
        const nr = "Mitglied " + (i + 1);
        tr.querySelectorAll("input").forEach((inp) => {
          const f = FELDER.find((x) => x.feld === inp.dataset.feld);
          if (inp.dataset.feld === "name") inp.placeholder = nr;
          inp.setAttribute("aria-label", f.label + ", " + (zustand.mitglieder[i].name || nr));
        });
        tr.querySelector(".ls-weg").setAttribute("aria-label", (zustand.mitglieder[i].name || nr) + " entfernen");
      });
    }

    function rechnungZeile(dl, text, zahl, klasse, titel) {
      const z = neu("div", "ls-rz" + (klasse ? " " + klasse : ""));
      z.appendChild(neu("span", "", text));
      z.appendChild(neu("b", "num", zahl));
      if (titel) z.title = titel;
      dl.appendChild(z);
    }

    /** Alles Errechnete neu anzeigen. Fasst die Eingabefelder nicht an (Fokus und Schreibmarke bleiben). */
    function zeigen() {
      const dabei = []; // Index in zustand.mitglieder je gezählter Zeile
      const eingabe = [];
      zustand.mitglieder.forEach((m, i) => {
        if (!zaehlt(m)) return;
        dabei.push(i);
        eingabe.push({ name: m.name || "Mitglied " + (i + 1), loot: m.loot, beutel: m.beutel, regear: m.regear });
      });
      const e = rechnen(eingabe, zustand.prozent);
      const liste = ueberweisungen(e);
      letztes = { ergebnis: e, liste: liste };

      Array.from(tbody.rows).forEach((tr, i) => {
        const k = dabei.indexOf(i);
        const z = k >= 0 ? e.zeilen[k] : null;
        tr.classList.toggle("ls-leer", !z);
        tr.title = z ? "" : "Leere Zeile, zählt nicht mit. Erst ein Name oder ein Wert macht sie zum Mitglied.";
        tr.querySelector(".ls-anspruch").textContent = z ? zahlText(z.anspruch) : "";
        tr.querySelector(".ls-haelt").textContent = z ? zahlText(z.haelt) : "";
        const s = tr.querySelector(".ls-saldo");
        s.textContent = z ? saldoText(z.saldo) : "";
        s.classList.toggle("ls-zahlt", !!z && z.saldo > 0);
        s.classList.toggle("ls-bekommt", !!z && z.saldo < 0);
        s.classList.toggle("ls-glatt", !!z && z.saldo === 0);
      });

      el("lsSumLoot").textContent = zahlText(e.lootSumme);
      el("lsSumBeutel").textContent = zahlText(e.beutelSumme);
      el("lsSumRegear").textContent = zahlText(e.regearSumme);
      el("lsSumAnspruch").textContent = zahlText(e.topf - e.gildenkasse);
      el("lsSumHaelt").textContent = zahlText(e.topf);
      el("lsSumSaldo").textContent = e.gildenkasse > 0 ? GILDE_NAME + " bekommt " + zahlText(e.gildenkasse) : "";

      const warnung = el("lsWarnung");
      warnung.hidden = !e.knapp;
      warnung.textContent = e.knapp
        ? knappText(e) + ": es fehlen " + zahlText(-e.rest) + ". Regear wird anteilig erstattet (" + prozentText((e.verfuegbar / e.regearSumme) * 100) + " %), kein Anteil."
        : "";

      const dl = el("lsRechnung");
      dl.textContent = "";
      const mitgl = e.n === 1 ? "1 Mitglied" : e.n + " Mitglieder";
      rechnungZeile(dl, "Topf (Lootwert " + zahlText(e.lootSumme) + " + Geldbeutel " + zahlText(e.beutelSumme) + ")", zahlText(e.topf));
      rechnungZeile(dl, "minus Gildenkasse (" + prozentText(e.prozent) + " % vom Topf)", zahlText(e.gildeAusProzent), "", "Die Gildenkasse bekommt ihren Teil vom ganzen Topf, noch vor dem Regear. Abgerundet auf ganze Silber.");
      rechnungZeile(dl, "minus Regear", zahlText(e.regearSumme), "", "Regear wird voll erstattet, bevor geteilt wird.");
      if (e.knapp) {
        rechnungZeile(dl, "Es fehlen", zahlText(-e.rest), "ls-rz-warn", "Was nach der Gildenkasse bleibt, deckt das Regear nicht. Jeder bekommt denselben Bruchteil seines Regears.");
      } else {
        rechnungZeile(dl, "Rest", zahlText(e.rest), "ls-rz-summe");
        rechnungZeile(dl, "geteilt durch " + mitgl + ": Anteil je Mitglied", zahlText(e.anteil), "ls-rz-summe", "Abgerundet auf ganze Silber. Leere Zeilen zählen nicht als Mitglied.");
      }
      if (e.rundungsrest > 0) {
        const an = e.rundungsrestAn === GILDE ? GILDE_NAME : e.zeilen[e.rundungsrestAn].name;
        rechnungZeile(dl, "Rundungsrest, geht an " + an, zahlText(e.rundungsrest), "", e.knapp ? "Geht an das Mitglied mit dem höchsten Regear." : "Geht an die Gildenkasse; ohne Gildenkasse an das erste Mitglied der Liste.");
      }
      if (e.gildenkasse > 0) rechnungZeile(dl, GILDE_NAME + " bekommt", zahlText(e.gildenkasse), "ls-rz-summe");

      const ol = el("lsUeberweisungen");
      ol.textContent = "";
      liste.forEach((u) => {
        const li = neu("li");
        li.appendChild(neu("span", "", u.vonName + " zahlt " + u.anName + " "));
        li.appendChild(neu("b", "num", zahlText(u.betrag)));
        ol.appendChild(li);
      });
      el("lsKeine").hidden = liste.length > 0;
      el("lsKeine").textContent = e.n === 0 ? "Noch keine Mitglieder mit Namen oder Werten." : "Nichts zu überweisen, alle Salden sind ausgeglichen.";
      el("lsKopieren").disabled = e.n === 0;
    }

    function allesBauen() {
      tbody.textContent = "";
      zustand.mitglieder.forEach((m) => tbody.appendChild(zeileBauen(m)));
      feldProzent.value = prozentText(zustand.prozent);
      nummern();
      zeigen();
    }

    function zeileHinzu(fokus) {
      if (zustand.mitglieder.length >= MAX_ZEILEN) return;
      const m = leeresMitglied();
      zustand.mitglieder.push(m);
      const tr = zeileBauen(m);
      tbody.appendChild(tr);
      nummern();
      speichern();
      zeigen();
      if (fokus) tr.querySelector(".ls-name").focus();
    }

    function falsch(inp, ja) {
      inp.classList.toggle("ls-falsch", ja);
      if (ja) inp.setAttribute("aria-invalid", "true");
      else inp.removeAttribute("aria-invalid");
    }

    tbody.addEventListener("input", (ev) => {
      const inp = ev.target;
      const tr = inp.closest("tr");
      if (!tr || !inp.dataset.feld) return;
      const m = zustand.mitglieder[tr.sectionRowIndex];
      if (inp.dataset.feld === "name") {
        m.name = inp.value.trim().slice(0, MAX_NAME);
        nummern();
      } else {
        const w = zahlLesen(inp.value);
        falsch(inp, w == null);
        if (w == null) return; // ungültig: der letzte gültige Wert rechnet weiter
        m[inp.dataset.feld] = w;
      }
      speichern();
      zeigen();
    });

    // Beim Verlassen: Anzeige mit Tausenderpunkt, Ungültiges fällt auf den letzten gültigen Wert zurück.
    tbody.addEventListener("focusout", (ev) => {
      const inp = ev.target;
      const tr = inp.closest && inp.closest("tr");
      if (!tr || !inp.dataset || !inp.dataset.feld) return;
      const m = zustand.mitglieder[tr.sectionRowIndex];
      if (!m) return;
      if (inp.dataset.feld === "name") inp.value = m.name;
      else {
        inp.value = feldText(m[inp.dataset.feld]);
        falsch(inp, false);
      }
    });

    tbody.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" || !ev.target.dataset || ev.target.dataset.feld !== "regear") return;
      const tr = ev.target.closest("tr");
      if (tr !== tbody.lastElementChild) return;
      ev.preventDefault();
      zeileHinzu(true);
    });

    tbody.addEventListener("click", (ev) => {
      const knopf = ev.target.closest && ev.target.closest(".ls-weg");
      if (!knopf) return;
      const tr = knopf.closest("tr");
      const i = tr.sectionRowIndex;
      zustand.mitglieder.splice(i, 1);
      tr.remove();
      nummern();
      speichern();
      zeigen();
      const naechste = tbody.rows[Math.min(i, tbody.rows.length - 1)];
      (naechste ? naechste.querySelector(".ls-weg") : el("lsPlus")).focus();
    });

    feldProzent.addEventListener("input", () => {
      const p = prozentLesen(feldProzent.value);
      falsch(feldProzent, p == null);
      if (p == null) return;
      zustand.prozent = p;
      speichern();
      zeigen();
    });
    feldProzent.addEventListener("blur", () => {
      feldProzent.value = prozentText(zustand.prozent);
      falsch(feldProzent, false);
    });

    el("lsPlus").addEventListener("click", () => zeileHinzu(true));

    el("lsNeu").addEventListener("click", () => {
      const hatWerte = zustand.mitglieder.some((m) => m.loot || m.beutel || m.regear);
      if (hatWerte && !window.confirm("Lootwert, Geldbeutel und Regear aller Mitglieder leeren? Namen und Gildenkasse bleiben.")) return;
      zustand = neuerSplit(zustand);
      speichern();
      tbody.querySelectorAll("input.ls-zahl").forEach((inp) => {
        inp.value = "";
        falsch(inp, false);
      });
      zeigen();
    });

    el("lsKopieren").addEventListener("click", () => {
      if (!letztes) return;
      const knopf = el("lsKopieren");
      const text = ergebnisText(letztes.ergebnis, letztes.liste);
      const fertig = () => {
        if (knopf.dataset.alt) return;
        knopf.dataset.alt = knopf.textContent;
        knopf.textContent = "Kopiert ✓";
        setTimeout(() => {
          knopf.textContent = knopf.dataset.alt;
          delete knopf.dataset.alt;
        }, 1200);
      };
      const ersatz = () => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (err) { /* ignorieren */ }
        document.body.removeChild(ta);
        fertig();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(fertig, ersatz);
      else ersatz();
    });

    allesBauen();
  }

  // ------------------------------------------------------------ Selbsttest

  function selbsttest() {
    const out = [];
    const t = (name, ok, details) => out.push({ name: name, ok: !!ok, details: details == null ? "" : String(details) });
    const M = (name, loot, beutel, regear) => ({ name: name, loot: loot, beutel: beutel, regear: regear });
    const kurz = (e) => JSON.stringify({ topf: e.topf, verf: e.verfuegbar, regear: e.regearSumme, rest: e.rest, gilde: e.gildenkasse, anteil: e.anteil, rr: e.rundungsrest, an: e.rundungsrestAn, anspruch: e.zeilen.map((z) => z.anspruch), saldo: e.zeilen.map((z) => z.saldo), kontrolle: e.kontrolle });
    const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    // Gleichen die Überweisungen jeden Saldo und die Gildenkasse exakt aus?
    const gleichtAus = (e, ue) => {
      const offen = e.zeilen.map((z) => z.saldo);
      let gilde = e.gildenkasse;
      ue.forEach((u) => {
        offen[u.von] -= u.betrag;
        if (u.an === GILDE) gilde -= u.betrag;
        else offen[u.an] += u.betrag;
      });
      return offen.every((x) => x === 0) && gilde === 0 && ue.every((u) => u.betrag > 0 && u.von !== u.an);
    };
    const beteiligte = (e) => e.zeilen.filter((z) => z.saldo !== 0).length + (e.gildenkasse > 0 ? 1 : 0);

    // (a) Normalfall: 3 Mitglieder, Gildenkasse 10 %, Loot und Silber ungleich verteilt.
    const a = rechnen([M("Anna", 900000, 100000, 0), M("Ben", 0, 250000, 300000), M("Cara", 50000, 0, 100000)], 10);
    t("(a) Topf 1.300.000, Gildenkasse 10 % vom Topf = 130.000, verfügbar 1.170.000, Regear 400.000, Rest 770.000", a.topf === 1300000 && a.gildeAusProzent === 130000 && a.verfuegbar === 1170000 && a.regearSumme === 400000 && a.rest === 770000 && !a.knapp, kurz(a));
    t("(a) Anteil 256.666, Rundungsrest 2 an die Gildenkasse (130.002)", a.anteil === 256666 && a.rundungsrest === 2 && a.rundungsrestAn === GILDE && a.gildenkasse === 130002, kurz(a));
    t("(a) Anspruch 256.666 / 556.666 / 356.666, hält 1.000.000 / 250.000 / 50.000", gleich(a.zeilen.map((z) => z.anspruch), [256666, 556666, 356666]) && gleich(a.zeilen.map((z) => z.haelt), [1000000, 250000, 50000]), kurz(a));
    t("(a) Saldo: zahlt 743.334, bekommt 306.666, bekommt 306.666; Summe der Salden minus Gildenkasse = 0", gleich(a.zeilen.map((z) => z.saldo), [743334, -306666, -306666]) && a.kontrolle === 0, kurz(a));
    const aUe = ueberweisungen(a);
    t("(a) Überweisungen: Anna zahlt Ben 306.666, Cara 306.666, Gildenkasse 130.002",
      gleich(aUe.map((u) => [u.vonName, u.anName, u.betrag]), [["Anna", "Ben", 306666], ["Anna", "Cara", 306666], ["Anna", "Gildenkasse", 130002]]) && aUe[2].an === GILDE, JSON.stringify(aUe));
    t("(a) Kopiertext", ergebnisText(a) === [
      "Lootsplit: Topf 1.300.000 · Gildenkasse 130.002 (10 %) · Regear 400.000 · Anteil 256.666",
      "Anna: Anspruch 256.666, zahlt 743.334",
      "Ben: Anspruch 556.666, bekommt 306.666",
      "Cara: Anspruch 356.666, bekommt 306.666",
      "Überweisungen:",
      "Anna zahlt Ben 306.666",
      "Anna zahlt Cara 306.666",
      "Anna zahlt Gildenkasse 130.002",
    ].join("\n"), ergebnisText(a));

    // (b) Gildenkasse 0 %.
    const b = rechnen([M("Anna", 900000, 100000, 0), M("Ben", 0, 250000, 300000), M("Cara", 50000, 0, 100000)], 0);
    t("(b) Gildenkasse 0 %: Anteil 300.000, Salden: zahlt 700.000, bekommt 350.000, bekommt 350.000; Summe 0", b.gildenkasse === 0 && b.anteil === 300000 && gleich(b.zeilen.map((z) => z.saldo), [700000, -350000, -350000]) && b.kontrolle === 0, kurz(b));
    t("(b) ohne Gildenkasse ist sie kein Empfänger", ueberweisungen(b).length === 2 && ueberweisungen(b).every((u) => u.an !== GILDE) && gleichtAus(b, ueberweisungen(b)), JSON.stringify(ueberweisungen(b)));

    // (c) Rundung, die nicht aufgeht.
    const c1 = rechnen([M("A", 100, 0, 0), M("B", 0, 0, 0), M("C", 0, 0, 0)], 0);
    t("(c) 100 durch 3 ohne Gildenkasse: Anteil 33, Rundungsrest 1 an das erste Mitglied (Anspruch 34 / 33 / 33), Summe 0", c1.anteil === 33 && c1.rundungsrest === 1 && c1.rundungsrestAn === 0 && gleich(c1.zeilen.map((z) => z.anspruch), [34, 33, 33]) && c1.kontrolle === 0 && c1.zeilen.reduce((s, z) => s + z.saldo, 0) === 0, kurz(c1));
    const c2 = rechnen([M("A", 0, 0, 0), M("B", 1001, 0, 0), M("C", 0, 0, 0)], 10);
    t("(c) 1.001 mit 10 %: Gildenkasse abgerundet 100, Anteil 300, Rundungsrest 1 an die Gildenkasse (101), Summe 0", c2.gildeAusProzent === 100 && c2.anteil === 300 && c2.rundungsrest === 1 && c2.rundungsrestAn === GILDE && c2.gildenkasse === 101 && gleich(c2.zeilen.map((z) => z.saldo), [-300, 701, -300]) && c2.kontrolle === 0, kurz(c2));
    const c3 = rechnen([M("A", 999, 0, 0), M("B", 0, 0, 0)], 12.5);
    t("(c) 12,5 % von 999 = 124 (abgerundet), Anteil 437, Rundungsrest 1 an die Gildenkasse", c3.prozent === 12.5 && c3.gildeAusProzent === 124 && c3.anteil === 437 && c3.gildenkasse === 125 && c3.kontrolle === 0, kurz(c3));

    // (d) Rest genau 0.
    const d = rechnen([M("A", 600, 400, 0), M("B", 0, 0, 900)], 10);
    t("(d) Rest genau 0 (Topf 1.000, Gildenkasse 100, Regear 900): kein Anteil, kein Hinweis; A zahlt B 900 und Gildenkasse 100", d.rest === 0 && !d.knapp && d.gildenkasse === 100 && d.verfuegbar === 900 && d.anteil === 0 && gleich(d.zeilen.map((z) => z.saldo), [1000, -900]) && d.kontrolle === 0 && gleich(ueberweisungen(d).map((u) => [u.von, u.an, u.betrag]), [[0, 1, 900], [0, GILDE, 100]]), kurz(d));

    // (e) Nach der Gildenkasse reicht der Topf nicht fürs Regear.
    const e5 = rechnen([M("A", 100, 0, 60), M("B", 0, 0, 60), M("C", 0, 0, 31)], 10);
    t("(e) Topf 100, Gildenkasse 10, verfügbar 90, Regear 151: anteilig 35 / 35 / 18, Rundungsrest 2 an das höchste Regear (erstes bei Gleichstand): 37 / 35 / 18", e5.knapp && e5.rest === -61 && e5.gildenkasse === 10 && e5.verfuegbar === 90 && e5.anteil === 0 && e5.rundungsrest === 2 && e5.rundungsrestAn === 0 && gleich(e5.zeilen.map((z) => z.anspruch), [37, 35, 18]), kurz(e5));
    t("(e) Summe der Ansprüche = verfügbar, Summe der Salden = Gildenkasse, Überweisungen gleichen aus", e5.zeilen.reduce((s, z) => s + z.anspruch, 0) === 90 && e5.zeilen.reduce((s, z) => s + z.saldo, 0) === 10 && e5.kontrolle === 0 && gleichtAus(e5, ueberweisungen(e5)), kurz(e5));
    const e6 = rechnen([M("A", 0, 10, 5), M("B", 0, 0, 21)], 50);
    t("(e) Rundungsrest geht an das höchste Regear, auch wenn es nicht das erste Mitglied ist (verfügbar 5 auf Regear 5 und 21: abgerundet 0 und 4, Rest 1 an B)", e6.knapp && e6.verfuegbar === 5 && e6.rundungsrestAn === 1 && gleich(e6.zeilen.map((z) => z.anspruch), [0, 5]) && e6.kontrolle === 0, kurz(e6));
    const e7 = rechnen([M("A", 0, 0, 500), M("B", 0, 0, 0)], 10);
    t("(e) Topf 0 bei Regear 500: niemand bekommt etwas, keine Überweisung", e7.knapp && gleich(e7.zeilen.map((z) => z.anspruch), [0, 0]) && ueberweisungen(e7).length === 0 && e7.kontrolle === 0, kurz(e7));
    t("(e) Kopiertext nennt den Fehlbetrag", ergebnisText(e5).split("\n")[1] === "Nach der Gildenkasse reicht der Topf nicht fürs Regear (es fehlen 61), Erstattung anteilig.", ergebnisText(e5));
    const e8 = rechnen([M("A", 1000, 0, 300), M("B", 0, 0, 500)], 50);
    t("(e) Topf 1.000, 50 %, Regear 300 und 500: Gildenkasse 500, verfügbar 500, Erstattung 187 und 313 (Rundungsrest 1 an das höchste Regear)", e8.knapp && e8.gildenkasse === 500 && e8.verfuegbar === 500 && e8.rest === -300 && e8.anteil === 0 && e8.rundungsrest === 1 && e8.rundungsrestAn === 1 && gleich(e8.zeilen.map((z) => z.anspruch), [187, 313]) && gleich(e8.zeilen.map((z) => z.saldo), [813, -313]) && e8.kontrolle === 0 && gleichtAus(e8, ueberweisungen(e8)), kurz(e8));
    const e9 = rechnen([M("A", 1000, 0, 0), M("B", 0, 0, 400)], 100);
    t("(e) 100 %: alles an die Gildenkasse, Regear wird nicht erstattet, Hinweis (knapp)", e9.knapp && e9.gildenkasse === 1000 && e9.verfuegbar === 0 && e9.rest === -400 && gleich(e9.zeilen.map((z) => z.anspruch), [0, 0]) && e9.kontrolle === 0 && gleich(ueberweisungen(e9).map((u) => [u.von, u.an, u.betrag]), [[0, GILDE, 1000]]), kurz(e9));
    const e10 = rechnen([M("A", 1000, 0, 0), M("B", 0, 0, 0)], 100);
    t("(e) 100 % ohne Regear: alles an die Gildenkasse, kein Hinweis", !e10.knapp && e10.gildenkasse === 1000 && e10.anteil === 0 && e10.rest === 0 && e10.kontrolle === 0, kurz(e10));
    const e11 = rechnen([M("A", 100, 0, 60), M("B", 0, 0, 60)], 0);
    t("(e) ohne Gildenkasse heißt der Hinweis „Topf reicht nicht fürs Regear“", e11.knapp && ergebnisText(e11).split("\n")[1] === "Topf reicht nicht fürs Regear (es fehlen 20), Erstattung anteilig." && gleich(e11.zeilen.map((z) => z.anspruch), [50, 50]), ergebnisText(e11));

    // (f) ein Mitglied.
    const f = rechnen([M("Solo", 1000, 500, 200)], 10);
    t("(f) ein Mitglied: Topf 1.500, Gildenkasse 150, Rest 1.150, Anteil 1.150, Anspruch 1.350, zahlt 150 an die Gildenkasse", f.n === 1 && f.gildenkasse === 150 && f.rest === 1150 && f.anteil === 1150 && f.zeilen[0].anspruch === 1350 && f.zeilen[0].saldo === 150 && f.kontrolle === 0 && gleich(ueberweisungen(f).map((u) => [u.von, u.an, u.betrag]), [[0, GILDE, 150]]), kurz(f));

    // (g) keine Mitglieder.
    const g = rechnen([], 10);
    t("(g) keine Mitglieder: kein Fehler, alles 0, keine Überweisungen", g.n === 0 && g.topf === 0 && g.gildenkasse === 0 && g.anteil === 0 && g.zeilen.length === 0 && g.kontrolle === 0 && ueberweisungen(g).length === 0, kurz(g));
    const g2 = rechnen(null, "quatsch");
    t("(g) kaputte Eingabe (null, Text als Prozent) wie leer", g2.n === 0 && g2.prozent === 0 && ueberweisungen(g2).length === 0 && ueberweisungen(null).length === 0, kurz(g2));
    t("(g) Kopiertext ohne Mitglieder", ergebnisText(g) === "Lootsplit: Topf 0 · Gildenkasse 0 (10 %) · Regear 0 · Anteil 0\nÜberweisungen: keine", ergebnisText(g));

    // (h) Überweisungen gleichen exakt aus und sind höchstens (Beteiligte minus 1) viele.
    const faelle = [a, b, c1, c2, c3, d, e5, e6, f, e8, e9, e10, e11,
      rechnen([M("A", 500000, 0, 0), M("B", 0, 300000, 0), M("C", 0, 0, 120000), M("D", 0, 0, 0), M("E", 77777, 1234, 0)], 15),
      rechnen([M("A", 10, 0, 0), M("B", 20, 0, 0), M("C", 30, 0, 0), M("D", 40, 0, 0), M("E", 0, 0, 0), M("F", 0, 0, 0), M("G", 0, 0, 7)], 0),
      rechnen([M("A", 999999999999, 999999999999, 0), M("B", 0, 0, 999999999999), M("C", 1, 0, 0)], 33.3),
    ];
    const gross = faelle[faelle.length - 1];
    t("(h) in allen " + faelle.length + " Fällen: Kontrollsumme 0, Überweisungen gleichen jeden Saldo und die Gildenkasse exakt aus",
      faelle.every((x) => x.kontrolle === 0 && gleichtAus(x, ueberweisungen(x))), faelle.map((x) => x.kontrolle + "/" + ueberweisungen(x).length).join(" "));
    t("(h) höchstens (Beteiligte minus 1) Überweisungen",
      faelle.every((x) => ueberweisungen(x).length <= Math.max(0, beteiligte(x) - 1)), faelle.map((x) => ueberweisungen(x).length + "<=" + (beteiligte(x) - 1)).join(" "));
    t("(h) große Werte (je 999.999.999.999) bleiben ganzzahlig exakt", gross.zeilen.every((z) => Number.isSafeInteger(z.saldo)) && gross.topf === 1999999999999 && gross.gildeAusProzent === 665999999999 && gross.verfuegbar === 1334000000000, kurz(gross));
    t("(h) leerer Name bekommt in der Rechnung „Mitglied n“", rechnen([M("", 5, 0, 0), M("  ", 0, 0, 0)], 0).zeilen.map((z) => z.name).join() === "Mitglied 1,Mitglied 2", "");

    // (i) Zahlen-Parser.
    const p = (s) => zahlLesen(s);
    t("(i) zahlLesen: „250k“ = 250.000, „1,5m“ = 1.500.000, „1.234.567“ = 1.234.567", p("250k") === 250000 && p("1,5m") === 1500000 && p("1.234.567") === 1234567, [p("250k"), p("1,5m"), p("1.234.567")].join());
    t("(i) zahlLesen: leer = 0, „abc“ und „-5“ abgelehnt (null)", p("") === 0 && p("   ") === 0 && p(null) === 0 && p("abc") === null && p("-5") === null, [p(""), p("abc"), p("-5")].join());
    t("(i) zahlLesen: Großbuchstaben, Leerzeichen, „mio“, Punkt als Dezimaltrenner am Kürzel", p("250 K") === 250000 && p("2M") === 2000000 && p("3mio") === 3000000 && p("1.5m") === 1500000 && p("0,5k") === 500 && p("1.234,5k") === 1234500, [p("250 K"), p("2M"), p("3mio"), p("1.5m"), p("0,5k"), p("1.234,5k")].join());
    t("(i) zahlLesen: „1.234“ ist 1.234 (Tausenderpunkt), „1234“ = 1.234, „12,6“ rundet auf 13", p("1.234") === 1234 && p("1234") === 1234 && p("12,6") === 13 && p("7") === 7 && p("0") === 0, [p("1.234"), p("1234"), p("12,6")].join());
    t("(i) zahlLesen: Unsinn abgelehnt („1,2,3“, „k“, „1..2“, „12abc“, „1e5“, „+5“, zu groß)", ["1,2,3", "k", "1..2", "12abc", "1e5", "+5", "1.2.3", "9999999999999", "5000000m"].every((s) => p(s) === null), ["1,2,3", "k", "1..2", "12abc", "1e5", "+5", "1.2.3", "9999999999999", "5000000m"].map(p).join());
    const q = (s) => prozentLesen(s);
    t("(i) prozentLesen: 0 bis 100, Komma, leer = 0, sonst abgelehnt", q("10") === 10 && q("12,5") === 12.5 && q("12.5 %") === 12.5 && q("") === 0 && q("100") === 100 && q("101") === null && q("-1") === null && q("abc") === null, [q("10"), q("12,5"), q("101"), q("-1")].join());
    t("zahlText und prozentText", zahlText(1234567) === "1.234.567" && zahlText(0) === "0" && prozentText(12.5) === "12,5" && prozentText(10) === "10", zahlText(1234567) + " " + prozentText(12.5));

    // Speichern: Bereiniger, leere Zeilen, Neuer Split.
    const v = bereinigen(null);
    t("bereinigen: ohne Speicherstand fünf leere Zeilen, Gildenkasse 0 %", v.prozent === 0 && v.mitglieder.length === 5 && v.mitglieder.every((m) => m.name === "" && m.loot === 0 && m.beutel === 0 && m.regear === 0) && v.mitglieder[0] !== v.mitglieder[1], JSON.stringify(v));
    const s = bereinigen({ prozent: "250", mitglieder: [{ name: "  Anna  ", loot: "1500", beutel: -3, regear: 2.9 }, null, "quatsch", { name: 7, loot: 1e15 }, { name: "x".repeat(90) }] });
    t("bereinigen: Prozent gedeckelt, Namen gekürzt, Werte ganzzahlig und nicht negativ, Kaputtes raus",
      s.prozent === 100 && s.mitglieder.length === 3 && gleich(s.mitglieder[0], { name: "Anna", loot: 1500, beutel: 0, regear: 2 }) && s.mitglieder[1].name === "" && s.mitglieder[1].loot === MAX_WERT && s.mitglieder[2].name.length === 40, JSON.stringify(s));
    t("bereinigen: kaputter Stand (Text, Liste fehlt) ergibt die Vorgabe; leere Liste bleibt leer", bereinigen("x").mitglieder.length === 5 && bereinigen({ prozent: 5 }).mitglieder.length === 5 && bereinigen({ prozent: 5, mitglieder: [] }).mitglieder.length === 0 && bereinigen({ prozent: 5, mitglieder: [] }).prozent === 5, "");
    t("bereinigen: höchstens 100 Zeilen", bereinigen({ mitglieder: Array.from({ length: 150 }, () => ({ name: "a" })) }).mitglieder.length === 100, "");
    t("zaehlt: leere Zeile zählt nicht, Name oder ein Wert schon", !zaehlt(leeresMitglied()) && !zaehlt({ name: "  ", loot: 0 }) && !zaehlt(null) && zaehlt({ name: "A" }) && zaehlt({ name: "", regear: 1 }) && zaehlt({ beutel: 5 }), "");
    const ns = neuerSplit({ prozent: 12.5, mitglieder: [M("Anna", 1, 2, 3), M("", 4, 0, 0)] });
    t("neuerSplit: Werte leer, Namen und Gildenkasse bleiben", ns.prozent === 12.5 && gleich(ns.mitglieder, [M("Anna", 0, 0, 0), M("", 0, 0, 0)]), JSON.stringify(ns));
    t("saldoText", saldoText(730000) === "zahlt 730.000" && saldoText(-320000) === "bekommt 320.000" && saldoText(0) === "ausgeglichen", "");
    return out;
  }

  window.LOOTSPLIT = {
    SPEICHER: SPEICHER,
    zahlLesen: zahlLesen,
    prozentLesen: prozentLesen,
    zahlText: zahlText,
    prozentText: prozentText,
    zaehlt: zaehlt,
    rechnen: rechnen,
    ueberweisungen: ueberweisungen,
    saldoText: saldoText,
    ergebnisText: ergebnisText,
    bereinigen: bereinigen,
    neuerSplit: neuerSplit,
    selbsttest: selbsttest,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
