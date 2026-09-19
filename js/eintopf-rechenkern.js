// js/eintopf-rechenkern.js
//
// Eintopf-Rechner-Reiter der App-Fusion (Paket C, 13.09.2026): der eigentliche
// Rechenkern. Migriert UNVERAENDERT (gleiche Formeln, gleiche Funktionen) aus
// dem TEMPLATE-String von eintopf_update.py (ehemals eigenstaendiger
// Eintopf-Rechner) - nur die Datenquelle darunter wurde getauscht:
//   - sell(id,stadt)/buy(id,stadt)/volOf/avgOf kommen jetzt aus
//     EINTOPF_PREISE (Live-Fetch, s. js/eintopf-preise.js) statt aus einem von
//     Python vorab eingebetteten P/VOL-Objekt.
//   - DATEN.stews/DATEN.sauce kommen aus EINTOPF_DATEN (s. js/eintopf-daten.js)
//     statt aus demselben eingebetteten Objekt.
//   - HOME (Craft-Stadt) kommt aus EINTOPF_PREISE.getHome() statt einer
//     modul-globalen let-Variable.
//
// Belegte Werte (RET_OHNE/RET_MIT/ORDERGEB/FEFF) unveraendert aus
// ../CLAUDE.md, nicht ohne neuen Beleg aendern.

const EINTOPF_RECHENKERN = (function () {
  "use strict";

  const D = EINTOPF_DATEN;
  const M = EINTOPF_PREISE;

  // Feste Spielwerte - im Craft- und Marktfenster abgelesen, nicht einstellbar.
  // Ressourcen-Ertragsrate am Kochtopf in Lymhurst (kein Stadtbonus auf Speisen):
  //
  // Audit-Befund 12 (14.09.2026, kosmetisch, s. AUDIT-2026-09-13.md): dieser
  // Wert ist eine EIGENE, unabhaengige Messung (Screenshot des Craft-Fensters,
  // s. ../CLAUDE.md "Im Spiel abgelesene Werte"), nicht aus REGELN.rrr()
  // abgeleitet - bewusst getrennter Code, s. Modulkommentar oben ("kein
  // gemeinsamer Code mit preise.js/preisvergleich.js"). Die REGELN.rrr()-
  // Formel in js/regeln.js liefert fuer dieselbe Situation (B=0,18, kein
  // Fokus) 0,18/1,18 = 0,152542... - der winzige Unterschied (0,03
  // Prozentpunkte, 0,06 % relativ) ist Rundung der abgelesenen Prozentzahl,
  // kein Fehler. Bewusst NICHT durch den Formelwert ersetzt: das waere ein
  // belegter (im Spiel abgelesener) Wert, der ohne neuen Beleg geaendert
  // wuerde, s. ../CLAUDE.md "Belegte Werte nie ohne neuen Beleg aendern".
  const RET_OHNE = 0.152; // ohne Fokus
  const RET_MIT = 0.435; // mit Fokus
  // Einstellungsgebuehr auf eigene Orders; Sofortgeschaefte zahlen sie nicht.
  const ORDERGEB = 0.025;
  // Fokus-Effizienz durch Spezialisierung auf Kochen/Eintoepfe: im Craft-Fenster
  // kostet eine Charge T8.3 (10 Stueck) 2.192 Fokus.
  //
  // Der Wert bleibt 2192/2353, obwohl `craftingfocus` laut Audit-Befund 1
  // (im Spiel belegt 19.09.2026) je STUECK gilt und der Rohfokus der Charge
  // damit 10 x 2.353 = 23.530 betraegt. Grund: dieser Rechner multipliziert
  // FEFF mit dem Dumpwert und behandelt das Ergebnis als Fokus je Charge.
  // f x (2192/2353) ist identisch mit f x 10 x (2192/23530), die beiden
  // Lesarten kuerzen sich hier also heraus, weil FEFF direkt gegen die
  // Messung geeicht ist. Deshalb war und ist dieser Reiter unberuehrt vom
  // Bugfix in js/rechenkern.js. Der Prozentwert ist allerdings nur relativ
  // zum Dumpwert je Stueck zu lesen; die echte Fokus-Effizienz ist 9,32 %
  // (2.192 von 23.530), entsprechend FCE 34.242.
  const FEFF = 2192 / 2353;

  function spanne(id, stadt) {
    const s = M.sell(id, stadt), b = M.buy(id, stadt);
    return s && b ? (s - b) / s : null;
  }

  const menge = (id, stadt, o) => Math.floor(M.volOf(id, stadt) * o.tage * o.anteil);

  // Verkaufswege ueber alle gewaehlten Verkaufsstaedte.
  //  Sofortverkauf = in bestehende Kauforders, nur Steuer
  //  Verkaufsorder = eigene Order zum guenstigsten Angebot, Steuer + Einstellgebuehr
  // Belegt am Marktfenster: 8 x 218.898 ergaben 4 % Steuer (70.047) und 2,5 %
  // Einstellungsgebuehr (43.780).
  function verkaufswege(itemId, o) {
    const w = [];
    for (const stadt of o.vkStaedte) {
      if (o.vk.sofort) {
        const p = M.buy(itemId, stadt);
        if (p) w.push({ art: "Sofortverkauf", stadt, brutto: p, netto: p * (1 - o.tax) });
      }
      if (o.vk.order) {
        const p = M.sell(itemId, stadt);
        if (p) w.push({ art: "Verkaufsorder", stadt, brutto: p, netto: p * (1 - o.tax - ORDERGEB) });
      }
    }
    return w.sort((a, b) => b.netto - a.netto);
  }

  // Beschaffungsvarianten eines Items in einer Stadt: Sofortkauf und/oder
  // Kauforder. Die Kauforder bietet auf Hoehe der besten bestehenden Order;
  // dazu kommt die Einstellungsgebuehr, die auch bei Teilfuellung faellig wird.
  function bezugsarten(id, stadt, o) {
    const a = [];
    if (o.bez.sofort) {
      const best = M.sell(id, stadt);
      const schnitt = M.avgOf(id, stadt);
      // Wer eine groessere Menge sofort kauft, arbeitet sich im Orderbuch nach
      // oben und zahlt nie weniger als das beste Angebot. Liegt der
      // 7-Tage-Durchschnitt darueber, ist das beste Angebot eine duenne
      // Spitze - dann ist der Durchschnitt die ehrlichere Grundlage.
      const p = o.basis === "avg" && schnitt && best ? Math.max(best, schnitt) : best;
      if (p) a.push({ art: "Sofortkauf", preis: p });
    }
    if (o.bez.order) {
      const p = M.buy(id, stadt);
      if (p) a.push({ art: "Kauforder", preis: p * (1 + ORDERGEB) });
    }
    return a;
  }

  // Guenstigste Kombination aus Stadt und Bezugsart fuer ein einzelnes Item.
  function billigste(id, o) {
    let best = null;
    for (const c of o.staedte) {
      for (const b of bezugsarten(id, c, o)) {
        if (!best || b.preis < best.preis) best = { stadt: c, art: b.art, preis: b.preis, lager: menge(id, c, o) };
      }
    }
    return best;
  }

  // Guenstigste aktuell verfuegbare Quelle je Fischstueckchen, ueber alle
  // Fische und den Direktkauf von Zerkleinertem Fisch - reiner Referenzwert.
  function bestChopQuelle(o) {
    const quellen = [{ id: "T1_FISHCHOPS", name: "Zerkleinerter Fisch", chops: 1 }, ...D.FISH];
    let best = null;
    for (const f of quellen) {
      const b = billigste(f.id, o);
      if (!b) continue;
      const pro = b.preis / f.chops;
      if (!best || pro < best.pro) best = { pro, name: f.name, stadt: b.stadt, art: b.art };
    }
    return best;
  }

  // Kosten fuer 1 Sauce je Beschaffungsweg. anzahl = Saucen fuer den ganzen
  // Batch, bestimmt wie tief der Markt reichen muss. Fischsauce und
  // Fischstueckchen haben weder craftingfocus noch craftingcategory - reine
  // Umwandlungsrezepte, kein Fokus, keine Rueckgewinnung.
  function sauceWege(lvl, o, anzahl) {
    const s = D.SAUCE[String(lvl)];
    const sg = billigste("T1_SEAWEED", o);
    const wege = [];

    const kauf = billigste(s.id, o);
    if (kauf) {
      wege.push({
        art: "kaufen", label: `Sauce kaufen (${kauf.stadt}, ${kauf.art})`, kosten: kauf.preis,
        gedeckt: kauf.lager >= anzahl, fehlend: Math.max(0, anzahl - kauf.lager),
        info: `Markt gibt ${anzahl_format(kauf.lager)} von ${anzahl_format(anzahl)} Stück her`,
      });
    }
    if (sg && o.eigenerPreis > 0) {
      wege.push({
        art: "eigen", label: "selbst craften (eigener Fischpreis)",
        kosten: s.chops * o.eigenerPreis + s.seaweed * sg.preis,
        gedeckt: true, fehlend: 0,
        info: `${anzahl_format(anzahl * s.chops)} Stückchen à ${fmt2(o.eigenerPreis)} · Seegras aus ${sg.stadt} (${sg.art})`,
      });
    }
    return { rezept: s, wege, bedarfChops: anzahl * s.chops, bedarfSeegras: anzahl * s.seaweed, seegras: sg };
  }
  // Zahlenformatierung ohne Abhaengigkeit von eintopf-ui.js (eigene, minimale
  // Kopie - die Rechenlogik bleibt bewusst DOM-/Anzeige-frei, s. Modulkommentar).
  function anzahl_format(n) { return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n); }
  function fmt2(v) { return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v); }

  // ─── Schmerzgrenze ────────────────────────────────────────────────────────
  // Bis zu welchem Preis je Fischstueckchen bleibt der Batch gerade noch bei
  // null? Die Gewinnformel nach dem Stueckchenpreis P aufgeloest.
  function schmerzgrenze(stew, ench, o, mitFokus) {
    if (!ench) return null; // ohne Sauce gibt es keine Grenze
    const ret = mitFokus ? RET_MIT : RET_OHNE;
    const basis = stew.base.reduce((a, [id, n]) => a + M.sell(id, M.getHome()) * n, 0);
    const gebuehr = (stew.nahrung[ench] || 0) * o.station / 100;
    const vk = verkaufswege(`${stew.id}@${ench}`, o)[0];
    const sg = billigste("T1_SEAWEED", o);
    if (!vk || !basis || !sg) return null;

    const s = D.SAUCE[String(ench)];
    const n = stew.ench[ench].sauce;
    const budget = vk.netto * stew.out;
    const uebrig = (budget - gebuehr) / (1 - ret) - basis - n * s.seaweed * sg.preis;
    const grenze = uebrig / (n * s.chops);
    return grenze > 0 ? grenze : null;
  }

  // ─── Kipppunkte ───────────────────────────────────────────────────────────
  // Der Gewinn ist linear im Stueckchenpreis P: Gewinn(P) = A - B x P.
  function gerade(stew, ench, o, mitFokus) {
    const ret = mitFokus ? RET_MIT : RET_OHNE;
    const basis = stew.base.reduce((a, [id, n]) => a + M.sell(id, M.getHome()) * n, 0);
    const gebuehr = (stew.nahrung[ench] || 0) * o.station / 100;
    const vk = verkaufswege(`${stew.id}@${ench}`, o)[0];
    const sg = billigste("T1_SEAWEED", o);
    if (!vk || !basis || !sg) return null;
    const s = D.SAUCE[String(ench)], n = stew.ench[ench].sauce;
    const K0 = (basis + n * s.seaweed * sg.preis) * (1 - ret) + gebuehr;
    const B = n * s.chops * (1 - ret);
    return {
      ench, B, K0, fokus: stew.ench[ench].focus * FEFF,
      A: vk.netto * stew.out - K0,
      gewinn: (P) => (vk.netto * stew.out - K0) - B * P,
      kosten: (P) => K0 + B * P,
    };
  }

  // Entscheidungsleiter: welche Stufe lohnt in welchem Preisbereich?
  function entscheidungsleiter(stew, o, mitFokus) {
    const linien = [1, 2, 3].map((e) => gerade(stew, e, o, mitFokus)).filter(Boolean);
    if (!linien.length) return [];

    const grenzen = [];
    for (let i = 0; i < linien.length; i++) {
      for (let j = i + 1; j < linien.length; j++) {
        const a = linien[i], b = linien[j];
        if (a.B === b.B) continue;
        const P = (a.A - b.A) / (a.B - b.B);
        if (P > 0 && isFinite(P)) grenzen.push(P);
        if (o.kriterium === "fokus" && a.fokus && b.fokus) {
          const Q = (a.A / a.fokus - b.A / b.fokus) / (a.B / a.fokus - b.B / b.fokus);
          if (Q > 0 && isFinite(Q)) grenzen.push(Q);
        }
        const M2 = a.A / a.B;
        if (M2 > 0 && isFinite(M2)) grenzen.push(M2);
      }
    }
    const l = gerade(stew, 1, o, mitFokus);
    if (l) grenzen.push(l.A / l.B);

    const punkte = [...new Set(grenzen.filter((x) => x > 0).map((x) => Math.round(x * 100) / 100))]
      .sort((a, b) => a - b);

    const sieger = (P) => {
      let best = null;
      for (const x of linien) {
        const g = x.gewinn(P), k = x.kosten(P);
        if (k <= 0 || g < 0) continue;
        const w = guete({ gewinn: g, fokus: x.fokus }, o);
        if (!best || w > best.w) best = { ench: x.ench, w };
      }
      return best ? best.ench : null;
    };

    const kanten = [0, ...punkte, punkte.length ? punkte[punkte.length - 1] * 1.5 + 100 : 1000];
    const roh = [];
    for (let i = 0; i < kanten.length - 1; i++) {
      const von = kanten[i], bis = kanten[i + 1];
      if (bis - von < 0.01) continue;
      roh.push({ von, bis, ench: sieger((von + bis) / 2) });
    }
    const zonen = [];
    for (const z of roh) {
      const letzte = zonen[zonen.length - 1];
      if (letzte && letzte.ench === z.ench) letzte.bis = z.bis;
      else zonen.push({ ...z });
    }
    if (zonen.length) zonen[zonen.length - 1].bis = null; // offen nach oben
    return zonen;
  }

  // ─── Strategien je Verzauberungsstufe ────────────────────────────────────
  function strategien(stew, ench, o, mitFokus) {
    const ret = mitFokus ? RET_MIT : RET_OHNE;
    const out = stew.out;
    const itemId = ench ? `${stew.id}@${ench}` : stew.id;

    const basis = stew.base.reduce((a, [id, n]) => a + M.sell(id, M.getHome()) * n, 0);
    const gebuehr = (stew.nahrung[ench] || 0) * o.station / 100;
    const vk = verkaufswege(itemId, o)[0] || null;
    const erloes = vk ? vk.netto * out : 0;

    const res = [];
    if (ench === 0) {
      if (basis > 0) {
        res.push({
          label: "Zutaten kaufen &amp; craften", kosten: basis * (1 - ret) + gebuehr,
          fokus: stew.focus0 * FEFF,
          detail: `Zutaten ${fmt0(basis)} &minus; Rückgewinnung, Gebühr ${fmt0(gebuehr)}`,
        });
      }
    } else {
      const n = stew.ench[ench].sauce;
      const sw = sauceWege(ench, o, n);
      const fk = stew.ench[ench].focus * FEFF;

      for (const w of sw.wege) {
        if (basis <= 0 || !w.kosten) continue;
        res.push({
          label: `Craften &middot; ${w.label}`,
          kosten: (basis + n * w.kosten) * (1 - ret) + gebuehr,
          fokus: fk, gedeckt: w.gedeckt, info: w.info,
          detail: `Zutaten ${fmt0(basis)} + ${n}&times; Sauce à ${fmt0(w.kosten)} &minus; Rückgewinnung, Gebühr ${fmt0(gebuehr)}`,
        });
      }
      // Kein "Upgrade-Pfad": die Verzauberungsstufe wird beim Kochen gewaehlt,
      // die Sauce ist dabei eine der vier Zutaten.
    }
    return res.map((r) => ({ ...r, erloes, vk, gewinn: erloes - r.kosten, gedeckt: r.gedeckt !== false }))
      .sort((a, b) => (b.gedeckt - a.gedeckt) || (b.gewinn - a.gewinn));
  }
  // Minimale, anzeigefreie Rundung fuer die Detail-Texte oben (kein Komma-Layout
  // notwendig, die UI-Schicht formatiert alle eigentlichen Tabellenwerte selbst).
  function fmt0(v) { return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.round(v)); }

  // Nach welchem Massstab eine Strategie besser ist. Bei begrenztem Fokus
  // zaehlt der Gewinn je Fokuspunkt, nicht der absolute Gewinn je Batch.
  function guete(s, o) {
    if (o.kriterium === "fokus" && s.fokus > 0) return s.gewinn / s.fokus;
    if (o.kriterium === "fokus") return s.gewinn > 0 ? Infinity : s.gewinn;
    return s.gewinn;
  }

  const varianten = () => D.STEWS.flatMap((s) => [0, 1, 2, 3].map((e) => ({ stew: s, ench: e })));

  return {
    RET_OHNE, RET_MIT, ORDERGEB, FEFF,
    spanne, menge,
    bezugsarten, billigste, bestChopQuelle, sauceWege,
    verkaufswege, strategien, gerade, entscheidungsleiter, schmerzgrenze, guete,
    varianten,
  };
})();
