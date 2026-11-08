#!/usr/bin/env python3
"""Baut die Karte der Ancient Lands (Dragonfire-Update) aus dem Client-Dump.

Aufruf: python build_karte.py [--refresh]
--refresh erzwingt einen erneuten Download, sonst wird ein lokaler
Zwischenspeicher im Temp-Verzeichnis benutzt.

Quelle: https://github.com/ao-data/ao-bin-dumps
  templates/NONE/DRAGON_001.template.xml  Grundgerüst des Gebiets: Inselbausteine,
                                         Teleporter (Leytore), Drachenaltäre, Truhen- und
                                         Schlüsselstein-Spawnpunkte,
                                         Ausgänge, Lore-Punkte
  dragonareatemplatemetadata.json        Insel-Slots, in die das Spiel je Instanz
                                         ein Camp einsetzt (DRAKE_ISLAND markiert)

Erzeugt:
  assets/ancient-lands.webp  Kartenbild (Gelände), um 45 Grad gedreht wie im Spiel
  js/karte-daten.js          feste Punkte als Leaflet-Koordinaten (KARTE_DATEN)

Koordinaten: im Dump x nach Osten, z nach Norden. Das Spiel zeigt das Gebiet
als Raute mit Norden oben, also um 45 Grad im Uhrzeigersinn gedreht
(gegen den Spiel-Screenshot geprüft: großer See im Westen, Drachen um die Mitte).
  lng = (x + z) / sqrt(2),  lat = (z - x) / sqrt(2)
"""
import json
import math
import os
import re
import sys
import tempfile
import urllib.request
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HIER = os.path.dirname(os.path.abspath(__file__))
BASIS = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/"
CACHE_DIR = os.path.join(tempfile.gettempdir(), "albion_kostenrechner_dumpcache")
DATEIEN = {
    "master": "templates/NONE/DRAGON_001.template.xml",
    "meta": "dragonareatemplatemetadata.json",
}

E = 580          # halbe Kantenlänge des gerenderten Bereichs (Dump-Einheiten)
R = 2.5          # Pixel je Einheit beim Rendern (vor dem Drehen)
ZIEL_PX = 4096   # Kantenlänge des fertigen Bildes
WURZEL2 = math.sqrt(2)


def laden(schluessel, erzwingen):
    pfad = os.path.join(CACHE_DIR, os.path.basename(DATEIEN[schluessel]))
    if not erzwingen and os.path.isfile(pfad) and os.path.getsize(pfad) > 1000:
        print(f"{schluessel}: aus Zwischenspeicher {pfad}")
    else:
        os.makedirs(CACHE_DIR, exist_ok=True)
        url = BASIS + DATEIEN[schluessel]
        print(f"{schluessel}: lade {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "albion-werkzeuge-build"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            daten = resp.read()
        with open(pfad, "wb") as f:
            f.write(daten)
    return pfad


def pos(el):
    teile = [float(v) for v in el.get("pos").split()]
    return teile[0], teile[2]  # x, z


def leaflet(x, z):
    """Dump-Koordinate -> [lat, lng] im gedrehten Kartenrahmen."""
    return [round((z - x) / WURZEL2, 1), round((x + z) / WURZEL2, 1)]


# ---------------------------------------------------------------- Raster-Helfer

N = int(2 * E * R)


def px(x, z):
    return ((x + E) * R, (E - z) * R)


def rechteck(draw, x, z, w, h, roty, fill):
    a = math.radians(roty)
    pts = []
    for dx, dz in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)):
        rx = dx * math.cos(a) + dz * math.sin(a)
        rz = -dx * math.sin(a) + dz * math.cos(a)
        pts.append(px(x + rx, z + rz))
    draw.polygon(pts, fill=fill)


def kreis(draw, x, z, r, fill):
    cx, cy = px(x, z)
    draw.ellipse([cx - r * R, cy - r * R, cx + r * R, cy + r * R], fill=fill)


def rauschen(groesse, zellen, seed):
    """Weiches Wertrauschen 0..1 (kleines Zufallsbild, bikubisch hochskaliert)."""
    rng = np.random.default_rng(seed)
    klein = Image.fromarray((rng.random((zellen, zellen)) * 255).astype(np.uint8), "L")
    return np.asarray(klein.resize((groesse, groesse), Image.BICUBIC), dtype=np.float32) / 255.0


def maske(bild):
    return np.asarray(bild, dtype=np.float32) / 255.0


def weich(arr, radius):
    img = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), "L")
    return maske(img.filter(ImageFilter.GaussianBlur(radius)))


def farbe(hexwert):
    hexwert = hexwert.lstrip("#")
    return np.array([int(hexwert[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def mischen(basis, rgb, alpha):
    """basis HxWx3 float, rgb (3,) oder HxWx3, alpha HxW 0..1."""
    a = alpha[..., None]
    return basis * (1 - a) + rgb * a


# ---------------------------------------------------------------- Gelände

def gelaende_rendern(root, slots, ziel):
    tiles = root.find("tiles")
    boden = Image.new("L", (N, N), 0)
    wasser = Image.new("L", (N, N), 0)
    stein = Image.new("L", (N, N), 0)
    hinter = Image.new("L", (N, N), 0)
    db, dw, ds, dh = (ImageDraw.Draw(i) for i in (boden, wasser, stein, hinter))

    for ct in root.iter("compoundtile"):
        name = ct.get("name") or ""
        x, z = pos(ct)
        roty = float(ct.get("roty", "0"))
        m = re.search(r"(\d+)x(\d+)", name)
        w, h = (int(m.group(1)), int(m.group(2))) if m else (20, 20)
        if "BACKDROP" in name:
            kreis(dh, x, z, 9 if "ISLAND" in name else 6, 255)
            continue
        if "RIVER" in name and not m:
            w, h = (20, 20) if "LARGE" not in name else (30, 30)
        # Randstücke ragen als Klippenkante über die Insel hinaus; verkleinert
        # gezeichnet runden sie den Umriss ab, statt Zacken zu bilden.
        f = 0.55 if "BORDER" in name else 1.0
        rechteck(db, x, z, w * f, h * f, roty, 255)
        if "RIVER" in name or "_C_WATER" in name:
            rechteck(dw, x, z, w * 0.72, h * 0.72, roty, 255)
        if "MOBCAMP" in name or "DRAGONSTONE" in name:
            rechteck(ds, x, z, w * 0.8, h * 0.8, roty, 255)

    baeume, gruen, felsen, glut = [], [], [], []
    for t in tiles.iter("tile"):
        name = t.get("name") or ""
        if not t.get("pos"):
            continue
        x, z = pos(t)
        if name.startswith("FishingZone_FRESHWATER_BASE"):
            rechteck(dw, x, z, 10, 10, 0, 255)
        elif name.startswith("DRAGON_WATER_river"):
            g = 30 if "30x30" in name else 20 if "20x20" in name else 10
            rechteck(dw, x, z, g * 0.8, g * 0.8, float(t.get("roty", "0")), 255)
        elif name.startswith("DRAGON_WATER_PUDDLE"):
            kreis(dw, x, z, 4, 255)
        elif "GROUND_STONE" in name or "KPR_FANATICS_GROUND" in name:
            kreis(ds, x, z, 5, 200)
        elif "FILL_TREE" in name or "TREE" in name and "DRAGON_" in name:
            baeume.append((x, z, 7 if "GIANT" in name else 4))
        elif name.startswith("DRAGON_VEG_BLEND") or name.startswith("DRAGON_VEG_GRASS"):
            gruen.append((x, z, 3.2 if "LARGE" in name else 2.2))
        elif name.startswith("DRAGON_ROCK") or name.startswith("DRAGON_PLATEAU_ROCK"):
            felsen.append((x, z, 2.6 if "LARGE" in name else 1.6))
        elif "LEYLINE" in name or "FIREBOWL" in name:
            glut.append((x, z))

    # Slots (Camps) sind im Grundgerüst ausgespart, das Spiel setzt dort je
    # Instanz eine Vorlage ein. Für die Karte als Boden auffüllen.
    for s in slots:
        r = 40 if s["groesse"] == "Medium" else 25
        rechteck(db, s["x"], s["z"], 2 * r, 2 * r, 0, 255)
        kreis(ds, s["x"], s["z"], r * 0.55, 150)

    # Restliche eingeschlossene Löcher füllen (von außen fluten).
    flut = boden.copy()
    ImageDraw.floodfill(flut, (0, 0), 128)
    b = np.asarray(boden).copy()
    b[np.asarray(flut) == 0] = 255
    # Öffnen (erst schrumpfen, dann wachsen): entfernt abgelöste Randstücke,
    # die sonst als kleine Stummel neben den Inseln stehen.
    offen = Image.fromarray(b).filter(ImageFilter.MinFilter(17)).filter(ImageFilter.MaxFilter(17))
    boden_arr = np.asarray(offen, dtype=np.float32) / 255.0

    # Organischer Rand: weichzeichnen, mit Rauschen schwellen.
    edge_noise = rauschen(N, 260, 7) * 0.35 + rauschen(N, 60, 8) * 0.25
    weichb = weich(boden_arr, 4.5 * R)
    insel = np.clip((weichb + (edge_noise - 0.3) * 0.35 - 0.42) * 7 + 0.5, 0, 1)

    # Farben (warm, passend zum dunklen App-Thema).
    n1 = rauschen(N, 90, 1)
    n2 = rauschen(N, 340, 2)
    gras_a, gras_b = farbe("#56643f"), farbe("#3f4f35")
    oberflaeche = gras_a[None, None, :] * (1 - n1[..., None]) + gras_b[None, None, :] * n1[..., None]
    oberflaeche *= (0.88 + n2[..., None] * 0.22)

    # Grünflecken, Felsen, Bäume
    gl = Image.new("L", (N, N), 0)
    dg = ImageDraw.Draw(gl)
    for x, z, r in gruen:
        kreis(dg, x, z, r, 170)
    oberflaeche = mischen(oberflaeche, farbe("#6f8048"), weich(maske(gl), 1.5 * R) * 0.55)

    st = weich(maske(stein), 1.2 * R)
    stein_n = rauschen(N, 400, 3)
    oberflaeche = mischen(oberflaeche, farbe("#8c8370") * (0.85 + stein_n[..., None] * 0.25), st * 0.5)

    fl = Image.new("L", (N, N), 0)
    df = ImageDraw.Draw(fl)
    for x, z, r in felsen:
        kreis(df, x, z, r, 255)
    fla = weich(maske(fl), 0.6 * R)
    oberflaeche = mischen(oberflaeche, farbe("#7a7466"), fla * 0.8)

    bs = Image.new("L", (N, N), 0)
    bk = Image.new("L", (N, N), 0)
    dbs, dbk = ImageDraw.Draw(bs), ImageDraw.Draw(bk)
    for x, z, r in baeume:
        kreis(dbs, x + r * 0.35, z - r * 0.35, r, 255)
    for x, z, r in baeume:
        kreis(dbk, x, z, r, 255)
    oberflaeche = mischen(oberflaeche, farbe("#141a10"), weich(maske(bs), 1.2 * R) * 0.55)
    krone = weich(maske(bk), 0.8 * R)
    oberflaeche = mischen(oberflaeche, farbe("#2c4026") * (0.8 + n2[..., None] * 0.4), krone * 0.95)

    wa = weich(maske(wasser), 3.0 * R) * insel
    wa = np.clip((wa - 0.4) * 4, 0, 1)
    wasser_farbe = farbe("#2d5a68") * (0.85 + n1[..., None] * 0.3)
    oberflaeche = mischen(oberflaeche, farbe("#1d2a22"), weich(wa, 1.5 * R) * 0.6)  # Ufer
    oberflaeche = mischen(oberflaeche, wasser_farbe, wa)

    # Glut der Leylinien und Feuerschalen
    gg = Image.new("L", (N, N), 0)
    dgg = ImageDraw.Draw(gg)
    for x, z in glut:
        kreis(dgg, x, z, 1.4, 255)
    glow = weich(maske(gg), 2.5 * R)
    oberflaeche = np.clip(oberflaeche + glow[..., None] * farbe("#d7963a") * 0.6, 0, 255)

    # Licht von Nordwesten: Kanten leicht aufhellen/abdunkeln (Relief).
    hoehe = weich(insel, 3 * R)
    gy, gx = np.gradient(hoehe)
    licht = np.clip((-gx - gy) * 18, -1, 1)
    oberflaeche = np.clip(oberflaeche * (1 + licht[..., None] * 0.25), 0, 255)

    hinter_arr = weich(maske(hinter), 2.0 * R)
    hinter_arr = np.clip((hinter_arr - 0.35) * 4, 0, 1) * (1 - insel)

    # -------------------------------------------------- drehen und komponieren
    def drehen(arr, modus="L"):
        if arr.ndim == 2:
            img = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), "L")
        else:
            img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
        img = img.rotate(-45, resample=Image.BICUBIC, expand=True)
        return img

    O = drehen(oberflaeche)
    M = maske(drehen(insel))
    H = maske(drehen(hinter_arr))
    G = O.size[0]

    # Hintergrund: tiefes Dunkel mit warmem Schimmer zur Mitte, Wolkenschleier.
    yy, xx = np.mgrid[0:G, 0:G].astype(np.float32)
    d = np.sqrt((xx - G / 2) ** 2 + (yy - G / 2) ** 2) / (G / 2)
    bild = farbe("#17120e")[None, None, :] * (1 - d[..., None] * 0.35) + farbe("#0b0907") * (d[..., None] * 0.35)
    wolke = rauschen(G, 24, 11) * 0.6 + rauschen(G, 70, 12) * 0.4
    bild = mischen(bild, farbe("#3a3a40"), np.clip(wolke - 0.45, 0, 1) * 0.35)

    # Ferne Felsinseln
    bild = mischen(bild, farbe("#2a221b"), H * 0.8)

    # Unterseite / Klippe: Maske mehrfach nach unten versetzt (schwebende Inseln).
    tiefe = int(14 * R)
    for i in range(tiefe, 0, -2):
        verschoben = np.zeros_like(M)
        verschoben[i:, :] = M[:-i, :]
        t = i / tiefe
        klippe = farbe("#4a3a2a") * (1 - t) + farbe("#1a130d") * t
        bild = mischen(bild, klippe, verschoben * (1 - M))
    # weicher Schatten unter den Inseln
    schatten = np.zeros_like(M)
    s = int(22 * R)
    schatten[s:, :] = M[:-s, :]
    bild = mischen(bild, farbe("#000000"), weich(schatten, 8 * R) * 0.45 * (1 - M))

    O_arr = np.asarray(O, dtype=np.float32)
    bild = mischen(bild, O_arr, M)

    # Goldener Rand oben (Kantenlicht)
    erodiert = maske(Image.fromarray((M * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5)))
    rand = np.clip(M - erodiert, 0, 1)
    bild = mischen(bild, farbe("#c9a25a"), rand * 0.55)

    # Raute (Spielfeld) außen transparent lassen
    alpha = np.ones((G, G), dtype=np.float32)
    rauten = (np.abs(xx - G / 2) + np.abs(yy - G / 2)) <= (G / 2) * 1.0
    alpha[~rauten] = 0
    rgba = np.dstack([np.clip(bild, 0, 255), alpha * 255]).astype(np.uint8)
    out = Image.fromarray(rgba, "RGBA").resize((ZIEL_PX, ZIEL_PX), Image.LANCZOS)
    out.save(ziel, "WEBP", quality=82, method=6)
    print(f"Kartenbild: {ziel} ({os.path.getsize(ziel) // 1024} KB, {ZIEL_PX} px)")


# ---------------------------------------------------------------- Daten

def daten_bauen(root, slots):
    def mitglieder(typ):
        for m in root.iter("criticalscenemember"):
            if m.get("type") == typ:
                yield m, m.find("tile")

    gruppen, verbindungen = {}, {}
    for _, t in mitglieder("teleporternode"):
        tn = t.find("teleporternode")
        x, z = pos(t)
        gruppen.setdefault(tn.get("groupid"), []).append((x, z))
        verbindungen.setdefault(tn.get("teleporterconnectionid"), []).append((tn.get("groupid"), x, z))

    def naechster_slot(x, z):
        best = min(slots, key=lambda s: (s["x"] - x) ** 2 + (s["z"] - z) ** 2)
        return best if math.hypot(best["x"] - x, best["z"] - z) < 75 else None

    inseln = []
    for gid, punkte in sorted(gruppen.items()):
        cx = sum(p[0] for p in punkte) / len(punkte)
        cz = sum(p[1] for p in punkte) / len(punkte)
        slot = naechster_slot(cx, cz)
        if slot:
            cx, cz = slot["x"], slot["z"]
        zentrum = math.hypot(cx, cz) < 60
        inseln.append({
            "id": gid,
            "nr": int(gid.split("_")[1]),
            "p": leaflet(cx, cz),
            "art": "zentrum" if zentrum else ("drache" if slot and slot["drache"] else
                                              ("gross" if slot and slot["groesse"] == "Medium" else
                                               "klein" if slot else "pfad")),
            "camp": bool(slot),
        })

    verb = []
    for cid, enden in sorted(verbindungen.items()):
        if len(enden) != 2:
            continue
        (ga, xa, za), (gb, xb, zb) = enden
        verb.append({"id": cid, "a": ga, "b": gb, "pa": leaflet(xa, za), "pb": leaflet(xb, zb)})

    schreine = [{"id": m.get("id"), "p": leaflet(*pos(t))}
                for m, t in mitglieder("actionbuilding") if t.get("name") == "DRAGON_REWARD_SHRINE"]
    lore = [{"id": t.find("loresnippet").get("loresnippetid"), "p": leaflet(*pos(t))}
            for _, t in mitglieder("loresnippet")]
    ausg = {}
    for m, t in mitglieder("dragonareareexit"):
        x, z = pos(t)
        schl = (round(x), round(z))
        if schl not in ausg:
            ausg[schl] = {"id": "ausgang_%d" % (len(ausg) + 1), "p": leaflet(x, z),
                          "zentrum": math.hypot(x, z) < 80}
    # Truhen: Positionen sind über alle sechs Varianten gleich, eine Ebene reicht.
    truhen = []
    ebene = root.find("tiles").find("layergroup")[0]
    for t in ebene.iter("tile"):
        name = t.get("name") or ""
        if "LOOTCHEST" not in name:
            continue
        art = "feuerdrache" if "FIRE_DRAKE" in name else "zentrum" if "CENTER_ISLAND" in name else "camp"
        truhen.append({"id": "truhe_%d" % (len(truhen) + 1), "art": art, "p": leaflet(*pos(t))})
    feuerdrache = None
    for t in root.find("tiles").iter("tile"):
        if t.get("name") == "DRAGON_AREA_MAIN_QUEST_BOSS_SPAWNPOINT":
            feuerdrache = leaflet(*pos(t))
    angeln = [leaflet(*pos(t)) for t in root.find("tiles").iter("tile")
              if t.get("name") == "FishingZone_FRESHWATER_SPOT_TREASURE"]
    camps = [{"p": leaflet(s["x"], s["z"]), "groesse": s["groesse"], "drache": s["drache"]} for s in slots]
    # Leytor-Schlüsselsteine: erscheinen nach dem Inselquest an einem festen
    # Belohnungsort (LocalQuestRewardSpawnLocation, deckungsgleich mit
    # DRAGON_KPR_FANATICS_KEY_MARKER_B). Die Camp-Vorlagen bringen je einen
    # eigenen mit, dessen Lage je Instanz wechselt.
    schluessel = []
    for t in root.find("tiles").iter("tile"):
        if t.get("name") == "LocalQuestRewardSpawnLocation":
            schluessel.append({"id": "schluessel_%d" % (len(schluessel) + 1), "p": leaflet(*pos(t))})
    # Leytore: die Podeste, an denen der Schlüsselstein eine Verbindung freischaltet.
    leytore = []
    for _, t in mitglieder("teleporternode"):
        tn = t.find("teleporternode")
        leytore.append({"p": leaflet(*pos(t)), "insel": tn.get("groupid"), "verbindung": tn.get("teleporterconnectionid")})

    return {
        "quelle": "ao-bin-dumps, templates/NONE/DRAGON_001 und dragonareatemplatemetadata",
        "ausdehnung": round(E * WURZEL2, 1),
        "inseln": inseln,
        "verbindungen": verb,
        "schreine": schreine,
        "truhen": truhen,
        "feuerdrache": feuerdrache,
        "camps": camps,
        "ausgaenge": list(ausg.values()),
        "lore": lore,
        "angeln": angeln,
        "schluessel": schluessel,
        "leytore": leytore,
    }


def main():
    erzwingen = "--refresh" in sys.argv
    root = ET.parse(laden("master", erzwingen)).getroot()
    with open(laden("meta", erzwingen), encoding="utf-8") as f:
        meta = json.load(f)["dragonareatemplatemetadata"]["master"]
    slots = []
    for s in meta["slot"]:
        x, _, z = (float(v) for v in s["@pos"].split())
        slots.append({"x": x, "z": z, "groesse": s["@size"], "drache": "DRAKE_ISLAND" in s.get("@slottags", "")})

    daten = daten_bauen(root, slots)
    ziel_js = os.path.join(HIER, "js", "karte-daten.js")
    with open(ziel_js, "w", encoding="utf-8") as f:
        f.write("// Erzeugt von build_karte.py, nicht von Hand bearbeiten.\n")
        f.write("// Feste Punkte der Ancient Lands aus dem Client-Dump, Leaflet-Koordinaten [lat, lng].\n")
        f.write("window.KARTE_DATEN = ")
        json.dump(daten, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print(f"Daten: {ziel_js} ({len(daten['inseln'])} Inseln, {len(daten['verbindungen'])} Verbindungen, "
          f"{len(daten['schreine'])} Altäre, {len(daten['truhen'])} Truhen, {len(daten['schluessel'])} Schlüsselsteine, "
          f"{len(daten['leytore'])} Leytore, {len(daten['ausgaenge'])} Ausgänge)")

    if "--nur-daten" not in sys.argv:
        gelaende_rendern(root, slots, os.path.join(HIER, "assets", "ancient-lands.webp"))


if __name__ == "__main__":
    main()
