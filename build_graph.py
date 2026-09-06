#!/usr/bin/env python3
"""
build_graph.py

Erzeugt rezepte.js fuer den Albion Kostenrechner aus dem offiziellen
Client-Dump (ao-data/ao-bin-dumps). Laedt items.json (Rezepte) und
formatted/items.json (deutsche Namen), baut den Rezeptgraphen, leitet
fehlende ItemValues rekursiv ab, prueft Zyklenfreiheit und schreibt am Ende
rezepte.js in denselben Ordner.

Aufruf: python build_graph.py [--refresh]
--refresh erzwingt einen erneuten Download der Dumps, sonst wird ein lokaler
Zwischenspeicher im System-Temp-Ordner verwendet, wenn vorhanden.

Am Ende laeuft eine Selbstpruefung gegen die Abnahmekriterien aus
kostenrechner-PLAN.md, Abschnitt P1. Bricht mit Exitcode 1 ab, wenn eine
Pruefung fehlschlaegt.
"""

import json
import os
import re
import sys
import tempfile
import time
import urllib.request
from collections import deque

ITEMS_URL = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json"
NAMES_URL = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json"

CACHE_DIR = os.path.join(tempfile.gettempdir(), "albion_kostenrechner_dumpcache")
ITEMS_CACHE = os.path.join(CACHE_DIR, "items.json")
NAMES_CACHE = os.path.join(CACHE_DIR, "items_formatted.json")

OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rezepte.js")

# Heuristik fuer Zutaten ohne echte Marktaussicht (Arena, GvG, Fraktionen).
# Nur eine Kandidatenliste fuer die manuelle Pruefung in P6, keine harte Wahrheit.
NON_TRADEABLE_NAME_PATTERNS = [
    re.compile(r"^UNIQUE_GVGTOKEN_"),
    re.compile(r"_FACTION_[A-Z]+_TOKEN_\d+$"),
    re.compile(r"ARENA_CRYSTAL"),
    re.compile(r"ARENA_TOKEN"),
]


def download(url, cache_path, label, force_refresh):
    if not force_refresh and os.path.isfile(cache_path) and os.path.getsize(cache_path) > 100000:
        print(f"{label}: aus Zwischenspeicher {cache_path}")
        return
    print(f"{label}: lade von {url}")
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "albion-kostenrechner-build/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        content = resp.read()
    with open(cache_path, "wb") as f:
        f.write(content)
    print(f"{label}: {len(content) / 1024 / 1024:.2f} MB gespeichert")


def to_int(value, default=0):
    if value is None:
        return default
    try:
        return round(float(value))
    except (TypeError, ValueError):
        return default


def to_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).lower() == "true"


def as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


# Kompaktes Schema fuer rezepte.js. Kurze Schluessel sparen deutlich Dateigroesse
# ein (mehrere tausend Wiederholungen), Default-Werte werden weggelassen statt
# explizit gespeichert. Vollstaendige Doku des Schemas in kostenrechner-KONTEXT.md.
#
# Ingredient:  n=uniquename, c=count, l=enchantmentLevel (fehlt=0),
#              m=maxReturnAmount (fehlt=unbegrenzt), p=preserveQuality (fehlt=false)
# Recipe:      f=craftingfocus (fehlt=0), s=silver (fehlt=0),
#              a=amountCrafted (fehlt=1), i=[Ingredient,...], cur=[Currency,...]
# Currency:    n=Waehrungsname, a=Betrag
# Upgrade:     s=silver (fehlt=0), res=[{n,c,m},...], cur=[Currency,...]


def parse_ingredient(raw):
    ing = {
        "n": raw.get("@uniquename"),
        "c": to_int(raw.get("@count"), 1),
    }
    level = to_int(raw.get("@enchantmentlevel"), 0)
    if level:
        ing["l"] = level
    if "@maxreturnamount" in raw:
        ing["m"] = to_int(raw["@maxreturnamount"])
    if to_bool(raw.get("@preservequality"), False):
        ing["p"] = True
    return ing


def parse_recipe(raw):
    recipe = {"i": [parse_ingredient(r) for r in as_list(raw.get("craftresource")) if isinstance(r, dict)]}
    focus = to_int(raw.get("@craftingfocus"), 0)
    if focus:
        recipe["f"] = focus
    silver = to_int(raw.get("@silver"), 0)
    if silver:
        recipe["s"] = silver
    amount = to_int(raw.get("@amountcrafted"), 1)
    if amount != 1:
        recipe["a"] = amount
    if "currency" in raw:
        recipe["cur"] = [
            {"n": c.get("@uniquename"), "a": to_int(c.get("@amount"), 0)}
            for c in as_list(raw["currency"])
            if isinstance(c, dict)
        ]
    return recipe


def parse_upgrade(raw):
    if raw is None:
        return None
    resources = [r for r in as_list(raw.get("upgraderesource")) if isinstance(r, dict)]
    has_currency = "currency" in raw
    if not resources and not has_currency:
        return None
    upgrade = {
        "res": [
            {
                "n": r.get("@uniquename"),
                "c": to_int(r.get("@count"), 1),
                **({"m": to_int(r["@maxreturnamount"])} if "@maxreturnamount" in r else {}),
            }
            for r in resources
        ],
    }
    silver = to_int(raw.get("@silver"), 0)
    if silver:
        upgrade["s"] = silver
    if has_currency:
        upgrade["cur"] = [
            {"n": c.get("@uniquename"), "a": to_int(c.get("@amount"), 0)}
            for c in as_list(raw["currency"])
            if isinstance(c, dict)
        ]
    return upgrade


def parse_enchantments(raw):
    # je Stufe: r=[Recipe,...] direktes Craften auf dieser Stufe, u=Upgrade von Stufe-1
    result = {}
    ench_list = as_list(raw.get("enchantment")) if raw else []
    for ench in ench_list:
        if not isinstance(ench, dict):
            continue
        level = to_int(ench.get("@enchantmentlevel"), 0)
        if level <= 0:
            continue
        entry = {}
        cr = ench.get("craftingrequirements")
        if cr:
            entry["r"] = [parse_recipe(r) for r in as_list(cr) if isinstance(r, dict)]
        upgrade = parse_upgrade(ench.get("upgraderequirements"))
        if upgrade:
            entry["u"] = upgrade
        if entry:
            result[str(level)] = entry
    return result


def load_item_index(dump):
    items = dump["items"]
    index = {}
    group_of = {}
    for group_name, group_value in items.items():
        if group_name.startswith("@"):
            continue
        for entry in as_list(group_value):
            if not isinstance(entry, dict):
                continue
            uname = entry.get("@uniquename")
            if not uname:
                continue
            if uname in index:
                print(f"WARNUNG: doppelter uniquename {uname} in Gruppen {group_of[uname]} und {group_name}")
                continue
            index[uname] = entry
            group_of[uname] = group_name
    return index, group_of


def has_own_recipe(entry):
    if entry.get("craftingrequirements"):
        return True
    ench = entry.get("enchantments")
    if ench:
        for e in as_list(ench.get("enchantment")):
            if isinstance(e, dict) and (e.get("craftingrequirements") or e.get("upgraderequirements")):
                return True
    return False


# Root-Filter (06.09.2026): Sieg-Emote-Aufladungen und aehnliche kosmetische
# Nicht-Crafting-Items haben im Dump technisch ebenfalls ein Rezeptfeld
# (has_own_recipe() wuerde sie also als Ausgangspunkt/Root akzeptieren), sind
# aber kein echtes Spieler-Crafting. Als Root eingesammelt reissen sie ihre
# eigenen Zutaten mit in den Graph und landen als Eigenpreis-Kandidat, obwohl
# sie fachlich nichts mit "Make or Buy" zu tun haben.
#
# Empirisch am Dump geprueft, nicht geraten: alle vom Nutzer genannten
# Beispiele (Aufladung des Sieg-Emotes "Controllerbanner"/"Hammer"/
# "Hoellentor"/"Mobilversionbanner"/"Schwert" usw.) tragen
# @shopcategory="vanity" und @shopsubcategory1="killemotes". Dieselbe
# "vanity"-Kategorie deckt daneben weitere rein kosmetische Familien ab
# (Avatare, Avatarrahmen, kosmetische Ruestungs-/Waffen-/Reittier-/
# Umhang-Skins), die ebenfalls kein Spieler ueber diesen Rechner beschafft.
# Gegenprobe: keines der ausgeschlossenen "vanity"-Items wird von irgendeinem
# verbleibenden (nicht-vanity) Rezept als Zutat referenziert, es verschwindet
# also vollstaendig, statt nur als Root zu fehlen und trotzdem ueber eine
# Zutatenreferenz wieder hereinzukommen. Kandidatenliste dadurch von 365 auf
# rechnerisch 118 Eintraege gesunken, echte Zutaten wie
# QUESTITEM_TOKEN_ROYAL_T4 bleiben unveraendert im Graph.
#
# Zusaetzlich ausgeschlossen: interne Gamemaster-/Debug-Items (Name enthaelt
# "GAMEMASTER", z.B. UNIQUE_INTERNAL_HEAD_GAMEMASTER), ebenfalls nie von
# einem echten Rezept referenziert.
#
# Zusaetzlich ausgeschlossen (06.09.2026, Nutzer-Fund "HEAD_CLOTH_PROTOTYPE"
# in den Spezialisierungsknoten): Name enthaelt "PROTOTYPE". Betrifft 14
# Items im Graph, nicht nur das gemeldete Beispiel: T8_ARMOR/HEAD/SHOES
# _CLOTH/LEATHER/PLATE_PROTOTYPE (9, je Ruestungskategorie eines) sowie
# UNIQUE_WEAPONMASTER_ARMOR/HEAD/IDLE/POTION/SHOES_PROTOTYPE (5, interne
# "Waffenmeister"-Testreihe). Empirisch geprueft (am Beispiel
# T8_HEAD_CLOTH_PROTOTYPE): @shopsubcategory1="other" (kein "vanity", der
# bestehende Filter griff hier nicht), LocalizedNames komplett null (weder
# Deutsch noch Englisch), @mesh/@uisprite von T8_HEAD_CLOTH_SET1 kopiert,
# @silver="0" (kein echtes Item hat eine Stationsgebuehr von 0), und die
# eigene craftingspelllist referenziert einen Spell "PROTOTYPE_CD_PENALTY" -
# eindeutig interne Test-/Platzhalter-Eintraege, keine spielbaren Items.
# Gegenprobe: keines der 14 wird von irgendeinem verbleibenden Rezept als
# Zutat referenziert.
#
# Ausdruecklich NICHT hier gefiltert: Items ohne @craftingcategory oder ohne
# @tradable, die als Zutat in einem echten Rezept vorkommen (z.B. Fischsauce,
# GvG-/Fraktionsmarken, Arena-Kristall). Die bleiben im Graph und laufen
# weiterhin ueber find_non_tradeable_candidates() in die Eigenpreis-Pflege,
# das ist dort korrekt so.
ROOT_EXCLUDE_SHOPCATEGORIES = {"vanity"}


def is_excluded_root(name, entry):
    if entry.get("@shopcategory") in ROOT_EXCLUDE_SHOPCATEGORIES:
        return True
    if "GAMEMASTER" in name:
        return True
    if "PROTOTYPE" in name:
        return True
    return False


def build_node(entry):
    # Item-Knoten: t=tier, cc=craftingcategory, iv=itemvalue, el=eigene
    # Verzauberungsstufe, r=baseRecipes, e=enchantments je Stufe (s. parse_enchantments)
    node = {}
    if entry.get("@tier") is not None:
        node["t"] = to_int(entry["@tier"])
    if entry.get("@craftingcategory"):
        node["cc"] = entry["@craftingcategory"]
    if "@itemvalue" in entry:
        node["iv"] = to_int(entry["@itemvalue"], 0)
    # Veredelte Rohstoffe (Bretter, Barren, Stoff, Leder, Steinblock) sowie
    # Runen/Seelen/Relikte tragen ihre Verzauberungsstufe als eigenes Attribut
    # am Item selbst (jede Stufe ein eigener uniquename, z.B. T4_CLOTH_LEVEL1).
    # Ausruestung hat das Attribut nicht; deren Stufe steckt im "e"-Schluessel.
    # Fuer die Markt-ID braucht es aber genau diesen Wert, s. kostenrechner-KONTEXT.md.
    el = to_int(entry.get("@enchantmentlevel"), 0)
    if el:
        node["el"] = el
    cr = entry.get("craftingrequirements")
    if cr:
        node["r"] = [parse_recipe(r) for r in as_list(cr) if isinstance(r, dict)]
    ench = parse_enchantments(entry.get("enchantments"))
    if ench:
        node["e"] = ench
    return node


def collect_ingredient_refs(node):
    refs = set()
    for r in node.get("r", []):
        for ing in r["i"]:
            if ing["n"]:
                refs.add(ing["n"])
    for level_data in node.get("e", {}).values():
        for r in level_data.get("r", []):
            for ing in r["i"]:
                if ing["n"]:
                    refs.add(ing["n"])
        upgrade = level_data.get("u")
        if upgrade:
            for res in upgrade["res"]:
                if res["n"]:
                    refs.add(res["n"])
    return refs


def build_graph(index):
    roots = [
        name
        for name, entry in index.items()
        if has_own_recipe(entry) and not is_excluded_root(name, entry)
    ]
    nodes = {}
    missing = set()
    seen = set(roots)
    queue = deque(roots)
    while queue:
        name = queue.popleft()
        if name in nodes:
            continue
        entry = index.get(name)
        if entry is None:
            missing.add(name)
            continue
        node = build_node(entry)
        nodes[name] = node
        for ref in collect_ingredient_refs(node):
            if ref in seen:
                continue
            seen.add(ref)
            if ref in index:
                queue.append(ref)
            else:
                missing.add(ref)
    return nodes, sorted(missing)


def derive_itemvalues(nodes):
    sys.setrecursionlimit(10000)
    cache = {}
    mismatches = {}
    visiting = set()

    def value_of(name):
        if name in cache:
            return cache[name]
        node = nodes.get(name)
        if node is None:
            return None
        if "iv" in node and not node.get("ivd"):
            cache[name] = node["iv"]
            return node["iv"]
        if name in visiting:
            print(f"WARNUNG: Zyklus bei der ItemValue-Ableitung an {name}, breche dort ab")
            return None
        visiting.add(name)
        candidates = []
        for recipe in node.get("r", []):
            total = 0
            ok = True
            for ing in recipe["i"]:
                v = value_of(ing["n"])
                if v is None:
                    ok = False
                    break
                total += v * ing["c"]
            if ok:
                candidates.append(total)
        visiting.discard(name)
        if not candidates:
            return None
        distinct = sorted(set(candidates))
        result = candidates[0]
        if len(distinct) > 1:
            mismatches[name] = distinct
        node["iv"] = result
        node["ivd"] = True
        if name in mismatches:
            node["ivm"] = mismatches[name]
        cache[name] = result
        return result

    for name in list(nodes.keys()):
        value_of(name)
    return mismatches


def build_composite_edges(nodes):
    def cid(item, level):
        node = nodes.get(item)
        if node and node.get("e"):
            return f"{item}@{level}"
        return f"{item}@0"

    edges = {}
    for name, node in nodes.items():
        base_id = f"{name}@0"
        edges.setdefault(base_id, set())
        for recipe in node.get("r", []):
            for ing in recipe["i"]:
                if ing["n"] in nodes:
                    edges[base_id].add(cid(ing["n"], ing.get("l", 0)))
        for level_str, level_data in node.get("e", {}).items():
            level = int(level_str)
            this_id = f"{name}@{level}"
            edges.setdefault(this_id, set())
            for recipe in level_data.get("r", []):
                for ing in recipe["i"]:
                    if ing["n"] in nodes:
                        edges[this_id].add(cid(ing["n"], ing.get("l", 0)))
            upgrade = level_data.get("u")
            if upgrade:
                edges[this_id].add(f"{name}@{level - 1}")
                for res in upgrade["res"]:
                    if res["n"] in nodes:
                        edges[this_id].add(cid(res["n"], 0))
    return edges


def find_cycles_iterative(edges):
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {n: WHITE for n in edges}
    cycles = []

    for start in list(edges.keys()):
        if color.get(start, WHITE) != WHITE:
            continue
        color[start] = WHITE
        stack = [(start, iter(edges.get(start, ())))]
        color[start] = GRAY
        path = [start]
        while stack:
            node, it = stack[-1]
            advanced = False
            for nxt in it:
                if nxt not in color:
                    color[nxt] = WHITE
                if color[nxt] == WHITE:
                    color[nxt] = GRAY
                    path.append(nxt)
                    stack.append((nxt, iter(edges.get(nxt, ()))))
                    advanced = True
                    break
                elif color[nxt] == GRAY:
                    idx = path.index(nxt)
                    cycles.append(path[idx:] + [nxt])
            if not advanced:
                color[node] = BLACK
                stack.pop()
                path.pop()
    return cycles


def find_non_tradeable_candidates(index, nodes):
    candidates = set()
    for name in nodes:
        entry = index.get(name)
        if entry is None:
            continue
        tradable_attr = entry.get("@tradable")
        if tradable_attr is not None and str(tradable_attr).lower() == "false":
            candidates.add(name)
            continue
        if any(p.search(name) for p in NON_TRADEABLE_NAME_PATTERNS):
            candidates.add(name)
            continue
        cr = entry.get("craftingrequirements")
        if cr:
            recipes = [r for r in as_list(cr) if isinstance(r, dict)]
            if recipes and all(("currency" in r and not r.get("craftresource")) for r in recipes):
                candidates.add(name)
    return sorted(candidates)


def load_names(names_dump):
    names = {}
    for entry in names_dump:
        uname = entry.get("UniqueName")
        if not uname:
            continue
        localized = entry.get("LocalizedNames") or {}
        name = localized.get("DE-DE") or localized.get("EN-US")
        if name:
            names[uname] = name
    return names


def write_output(nodes, names, missing, candidates, meta):
    payload = {
        "meta": meta,
        "items": nodes,
        "namen": names,
        "fehlendeZutaten": missing,
        "nichtHandelbareKandidaten": candidates,
        "schema": {
            "item": "t=tier, cc=craftingcategory, iv=itemvalue, ivd=itemvalue abgeleitet statt aus Dump, "
            "ivm=abweichende ItemValues der Alternativrezepte, el=eigene Verzauberungsstufe des Items "
            "(fehlt=0, nur bei veredelten Rohstoffen/Runen/Seelen/Relikten, NICHT bei Ausruestung, "
            "s. e-Schluessel dort), r=Basisrezepte, e=Verzauberungsstufen",
            "recipe": "f=craftingfocus (fehlt=0), s=silver (fehlt=0), a=amountCrafted (fehlt=1), "
            "i=Zutaten, cur=Waehrungskosten statt/neben Zutaten",
            "ingredient": "n=uniquename, c=count, l=enchantmentLevel (fehlt=0), "
            "m=maxReturnAmount (fehlt=unbegrenzt), p=preserveQuality (fehlt=false)",
            "enchantmentEntry": "je Stufenschluessel '1'..'4': r=Rezepte fuer Direktcraft auf dieser Stufe, "
            "u=Upgrade von Stufe-1 (Materialien plus optional Silber/Waehrung)",
            "upgrade": "s=silver (fehlt=0), res=Materialien wie ingredient ohne l/p, cur=Waehrungskosten",
        },
    }
    json_text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    header = (
        "// Erzeugt von build_graph.py. Nicht von Hand bearbeiten, Aenderungen gehen beim naechsten Lauf verloren.\n"
        f"// Stand: {meta['generated']}\n"
    )
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(header)
        f.write("const REZEPTGRAPH = ")
        f.write(json_text)
        f.write(";\n")
    return os.path.getsize(OUTPUT_PATH)


def run_self_checks(nodes):
    ok = True

    def check(label, condition):
        nonlocal ok
        status = "OK" if condition else "FEHLER"
        print(f"[{status}] {label}")
        if not condition:
            ok = False

    royal = nodes.get("T4_HEAD_CLOTH_ROYAL")
    check("T4_HEAD_CLOTH_ROYAL vorhanden", royal is not None)
    if royal:
        base = royal.get("r", [])
        check("T4_HEAD_CLOTH_ROYAL hat genau 3 Basisrezepte", len(base) == 3)
        for r in base:
            tokens = [i for i in r["i"] if i["n"] == "QUESTITEM_TOKEN_ROYAL_T4"]
            check(
                "Basisrezept enthaelt 2x QUESTITEM_TOKEN_ROYAL_T4",
                len(tokens) == 1 and tokens[0]["c"] == 2,
            )
        check("T4_HEAD_CLOTH_ROYAL hat keine craftingcategory", "cc" not in royal)
        check("T4_HEAD_CLOTH_ROYAL Fokus 0 in allen Basisrezepten", all("f" not in r for r in base))

    set1 = nodes.get("T4_HEAD_CLOTH_SET1")
    check("T4_HEAD_CLOTH_SET1 vorhanden", set1 is not None)
    if set1:
        check("T4_HEAD_CLOTH_SET1 craftingcategory = cloth_helmet", set1.get("cc") == "cloth_helmet")
        base = set1.get("r", [])
        if base:
            ings = base[0]["i"]
            check(
                "Basisrezept 8x T4_CLOTH",
                len(ings) == 1 and ings[0]["n"] == "T4_CLOTH" and ings[0]["c"] == 8,
            )
            check("Basisrezept Fokus 429", base[0].get("f") == 429)
        else:
            check("T4_HEAD_CLOTH_SET1 hat ein Basisrezept", False)
        ench = set1.get("e", {})
        check("T4_HEAD_CLOTH_SET1 hat 4 Verzauberungsstufen", len(ench) == 4)
        expected_upgrade = {"1": ("T4_RUNE", 96), "2": ("T4_SOUL", 96), "3": ("T4_RELIC", 96)}
        for level, (mat, count) in expected_upgrade.items():
            data = ench.get(level, {})
            upgrade = data.get("u")
            check(
                f"Stufe {level} Upgrade-Material {count}x {mat}",
                bool(upgrade)
                and bool(upgrade.get("res"))
                and upgrade["res"][0]["n"] == mat
                and upgrade["res"][0]["c"] == count,
            )
        check("Stufe 4 hat kein Upgrade-Rezept", "u" not in ench.get("4", {}))

    check("ItemValue T4_HEAD_CLOTH_SET1 = 128", nodes.get("T4_HEAD_CLOTH_SET1", {}).get("iv") == 128)
    check("ItemValue T4_HEAD_CLOTH_ROYAL = 160", nodes.get("T4_HEAD_CLOTH_ROYAL", {}).get("iv") == 160)

    # el-Feld (eigene Verzauberungsstufe): Grundlage fuer die Markt-ID von
    # verzauberten Rohstoffen, s. kostenrechner-KONTEXT.md. Falsch waere hier
    # eine stumme Lehre: die API antwortet auf eine falsche ID mit Nullen statt
    # einem Fehler, ohne dieses Feld sieht das aus wie "kein Angebot".
    check("T4_CLOTH_LEVEL1 hat el = 1", nodes.get("T4_CLOTH_LEVEL1", {}).get("el") == 1)
    check("T6_CLOTH_LEVEL2 hat el = 2", nodes.get("T6_CLOTH_LEVEL2", {}).get("el") == 2)
    check("T4_CLOTH (Stufe 0) hat kein el-Feld", "el" not in nodes.get("T4_CLOTH", {}))
    check(
        "Ausruestung T4_HEAD_CLOTH_SET1 hat kein el-Feld (Stufe steckt im e-Schluessel)",
        "el" not in nodes.get("T4_HEAD_CLOTH_SET1", {}),
    )
    el_count = sum(1 for n in nodes.values() if n.get("el"))
    print(f"[INFO] {el_count} Knoten mit eigenem el-Feld (erwartet um die 312)")

    return ok


def main():
    force_refresh = "--refresh" in sys.argv
    start = time.time()

    download(ITEMS_URL, ITEMS_CACHE, "items.json", force_refresh)
    download(NAMES_URL, NAMES_CACHE, "formatted/items.json", force_refresh)

    with open(ITEMS_CACHE, encoding="utf-8") as f:
        dump = json.load(f)
    with open(NAMES_CACHE, encoding="utf-8") as f:
        names_dump = json.load(f)

    index, _group_of = load_item_index(dump)
    print(f"Item-Index geladen: {len(index)} Items ueber alle Gruppen")

    nodes, missing = build_graph(index)
    recipe_node_count = sum(1 for n in nodes.values() if n.get("r") or n.get("e"))
    print(f"Graph gebaut: {len(nodes)} Knoten, davon {recipe_node_count} mit eigenem Rezept")
    if missing:
        print(f"Fehlende Zutaten, nicht im Item-Index gefunden: {len(missing)}")
        for m in missing:
            print(f"  {m}")

    mismatches = derive_itemvalues(nodes)
    if mismatches:
        print(f"WARNUNG: {len(mismatches)} Items mit abweichenden ItemValues je Alternativrezept:")
        for name, values in mismatches.items():
            print(f"  {name}: {values}")

    edges = build_composite_edges(nodes)
    cycles = find_cycles_iterative(edges)
    if cycles:
        print(f"FEHLER: {len(cycles)} Zyklen gefunden:")
        for c in cycles[:10]:
            print("  " + " -> ".join(c))
    else:
        print("Zyklenpruefung: keine Zyklen gefunden")

    candidates = find_non_tradeable_candidates(index, nodes)
    print(f"Kandidaten fuer nicht handelbare Zutaten: {len(candidates)}")

    names = load_names(names_dump)
    print(f"Namenstabelle geladen: {len(names)} deutsche Namen mit EN-US Rueckfall")

    meta = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "nodeCount": len(nodes),
        "recipeNodeCount": recipe_node_count,
    }

    size = write_output(nodes, names, missing, candidates, meta)
    print(f"rezepte.js geschrieben: {size / 1024:.1f} KB, {len(nodes)} Knoten")

    ok = run_self_checks(nodes)
    ok = ok and not cycles
    elapsed = time.time() - start
    print(f"Laufzeit: {elapsed:.1f} s")
    if not ok:
        print("SELBSTPRUEFUNG FEHLGESCHLAGEN")
        sys.exit(1)
    print("Selbstpruefung erfolgreich, alle Abnahmekriterien erfuellt")


if __name__ == "__main__":
    main()
