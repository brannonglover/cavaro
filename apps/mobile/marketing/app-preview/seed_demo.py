#!/usr/bin/env python3
"""
Seed a Cavaro guest install on a simulator with a realistic demo collection
for App Store preview capture.

Usage:
  xcrun simctl terminate <UDID> com.brannonglover.cavaro
  python3 seed_demo.py "$(find "$(xcrun simctl get_app_container <UDID> com.brannonglover.cavaro data)" -name cigars.db)"

Only touches the local SQLite DB of a *guest* install (guest mode never syncs).
Cigars are pulled from the cached catalog so photos and blends are real.
"""
import json
import sqlite3
import sys
from datetime import date, timedelta

TODAY = date(2026, 11, 19)


def d(days_ago):
    return (TODAY - timedelta(days=days_ago)).isoformat()


def strength(a, b, c, fa=(), fb=(), fc=()):
    return json.dumps({"thirds": [
        {"strength": a, "flavors": list(fa)},
        {"strength": b, "flavors": list(fb)},
        {"strength": c, "flavors": list(fc)},
    ]})


HUMIDORS = [
    # id, name, humidity, temp, notes
    (1, "Main Humidor", 69, 68, "Spanish cedar cabinet"),
    (2, "Travel Case", 65, 70, None),
    (3, "Aging Cabinet", 65, 66, "Long-term cellar"),
]

# brand, name, preferred size_name (or None), qty, humidor, favorite, collection,
# days since added, strength profile, flavor profile text
CIGARS = [
    ("Padrón", "Padrón 1964 Anniversary Maduro", "Exclusivo", 8, 1, 1, "cavaro", 160,
     strength(3, 3, 4, ["Cocoa", "Espresso"], ["Earth", "Leather"], ["Pepper", "Chocolate"]),
     "Dark cocoa, espresso, sweet earth"),
    ("Arturo Fuente", "Fuente Fuente OpusX", None, 3, 3, 1, "cavaro", 380,
     strength(4, 4, 4, ["Cedar", "Spice"], ["Leather", "Pepper"], ["Earth", "Sweet"]),
     "Cedar, red pepper, leather"),
    ("My Father", "Le Bijou 1922", None, 6, 1, 1, "cavaro", 120,
     strength(4, 4, 4, ["Pepper", "Espresso"], ["Cocoa", "Leather"], ["Earth"]),
     "Black pepper, espresso, cocoa"),
    ("Oliva", "Serie V Melanio", None, 5, 1, 0, "cavaro", 95,
     strength(3, 3, 3, ["Cedar", "Coffee"], ["Nuts", "Cocoa"], ["Leather"]),
     "Cedar, coffee, roasted nuts"),
    ("Davidoff", "Winston Churchill The Late Hour", None, 4, 1, 0, "cavaro", 70,
     strength(3, 3, 3, ["Cream", "Coffee"], ["Leather", "Spice"], ["Chocolate"]),
     "Creamy coffee, leather, dark chocolate"),
    ("Padrón", "Padrón 1926 Serie Natural", None, 2, 3, 0, "cavaro", 250,
     strength(4, 4, 4, ["Cocoa", "Earth"], ["Coffee"], ["Pepper"]),
     "Cocoa, coffee, mineral earth"),
    ("Arturo Fuente", "Hemingway", None, 5, 1, 0, "cavaro", 140,
     strength(2, 2, 3, ["Cedar", "Cream"], ["Nuts"], ["Spice"]),
     "Cedar, cream, baking spice"),
    ("Plasencia", "Alma Fuerte", None, 4, 1, 0, "cavaro", 60,
     strength(4, 4, 4, ["Pepper", "Earth"], ["Leather"], ["Coffee"]),
     "Pepper, earth, leather"),
    ("Perdomo", "20th Anniversary Maduro", None, 6, 1, 0, "cavaro", 45,
     strength(3, 3, 3, ["Chocolate", "Coffee"], ["Sweet"], ["Cedar"]),
     "Chocolate, coffee, sweet cedar"),
    ("Rocky Patel", "Decade", None, 3, 2, 0, "cavaro", 35,
     strength(3, 3, 3, ["Cedar", "Spice"], ["Leather"], ["Coffee"]),
     "Cedar, spice, leather"),
    ("AJ Fernandez", "New World Oscuro", None, 5, 2, 0, "cavaro", 28,
     strength(3, 4, 4, ["Coffee", "Chocolate"], ["Pepper"], ["Earth"]),
     "Coffee, dark chocolate, pepper"),
    ("My Father", "Don Pepin Garcia Series JJ Maduro", None, 4, 1, 0, "cavaro", 85,
     strength(3, 3, 4, ["Chocolate", "Fruit"], ["Earth", "Spice"], ["Sweet"]),
     "Chocolate, dried fruit, spice"),
    ("Arturo Fuente", "Don Carlos", None, 3, 3, 0, "cavaro", 300,
     strength(3, 3, 3, ["Cedar", "Nuts"], ["Cream"], ["Spice"]),
     "Cedar, almond, cream"),
    ("Davidoff", "Nicaragua", None, 2, 1, 0, "cavaro", 50,
     strength(3, 3, 3, ["Chocolate", "Spice"], ["Sweet"], ["Coffee"]),
     "Chocolate, spice, sweet finish"),
    ("Alec Bradley", "Prensado", None, 4, 1, 0, "cavaro", 110,
     strength(3, 3, 4, ["Earth", "Spice"], ["Cocoa"], ["Pepper"]),
     "Earth, cocoa, pepper"),
    ("La Flor Dominicana", "Double Ligero Maduro", None, 2, 2, 0, "cavaro", 75,
     strength(4, 4, 4, ["Pepper", "Earth"], ["Coffee"], ["Leather"]),
     "Pepper, earth, coffee"),
    ("Oliva", "Serie G Maduro", None, 0, 1, 1, "cavaro", 200,
     strength(2, 3, 3, ["Cocoa", "Cedar"], ["Coffee"], ["Sweet"]),
     "Cocoa, cedar, coffee"),
    # Not-for-me picks (drive the "Not your preference" insights)
    # Ashton has no filler in the catalog, so it doesn't make a liked origin
    # (Nicaragua) also look disliked.
    ("Ashton", "Ashton", None, 0, 1, 0, "dislikes", 180,
     strength(1, 1, 1, ["Hay", "Cream"], [], []), "Hay, cream"),
]

# (cigar name, days ago, rating, would_buy_again, liked, disliked, strength fb, draw, burn, finish, notes)
JOURNAL = [
    ("Padrón 1964 Anniversary Maduro", 2, 95, 1, ["Chocolate", "Espresso", "Earth"], [], "Just Right", "Good", "Excellent", "Long",
     "Rich cocoa from the first draw. Flawless burn, finish lingered for minutes."),
    ("Le Bijou 1922", 6, 93, 1, ["Pepper", "Espresso", "Cocoa"], [], "Just Right", "Good", "Excellent", "Long",
     "Big pepper up front settling into espresso. A perfect after-dinner smoke."),
    ("Serie V Melanio", 11, 91, 1, ["Cedar", "Coffee", "Nuts"], [], "Just Right", "Good", "Excellent", "Long",
     "Balanced and elegant. Cedar and roasted nuts, never harsh."),
    ("Winston Churchill The Late Hour", 15, 88, 1, ["Coffee", "Leather", "Chocolate"], [], "Just Right", "Good", "Average", "Medium",
     "Creamy coffee with a whiskey-cask sweetness on the finish."),
    ("Fuente Fuente OpusX", 21, 96, 1, ["Cedar", "Leather", "Pepper"], [], "Just Right", "Good", "Excellent", "Long",
     "Worth the hunt. Layered, complex, cedar and red pepper throughout."),
    ("20th Anniversary Maduro", 26, 87, 1, ["Chocolate", "Coffee"], [], "Just Right", "Good", "Excellent", "Medium",
     "Sweet chocolate maduro. Great value."),
    ("Don Pepin Garcia Series JJ Maduro", 31, 90, 1, ["Chocolate", "Fruit", "Spice"], [], "Just Right", "Good", "Excellent", "Long",
     "Dark fruit and cocoa. Lancero format shines."),
    ("Ashton", 38, 52, 0, [], ["Hay", "Floral"], "Too Mild", "Loose", "Average", "Short",
     "Too light for me. Not my style."),
    ("Hemingway", 44, 84, 1, ["Cedar", "Cream", "Nuts"], [], "Too Mild", "Good", "Excellent", "Medium",
     "Classic Fuente cedar. Lovely morning smoke, a touch mild."),
    ("Alma Fuerte", 49, 89, 1, ["Pepper", "Earth", "Leather"], [], "Just Right", "Good", "Average", "Long",
     "Powerful but refined. Leather and earth."),
    ("Padrón 1964 Anniversary Maduro", 55, 94, 1, ["Chocolate", "Coffee", "Earth"], [], "Just Right", "Good", "Excellent", "Long",
     "Still the benchmark."),
    ("Ashton", 61, 55, 0, ["Cream"], ["Hay"], "Too Mild", "Good", "Average", "Short",
     "Gave it another try. Pleasant but thin."),
    ("Decade", 67, 85, 1, ["Cedar", "Spice", "Leather"], [], "Just Right", "Good", "Excellent", "Medium",
     "Smooth Sumatra spice."),
    ("New World Oscuro", 72, 88, 1, ["Coffee", "Chocolate", "Pepper"], [], "Just Right", "Good", "Excellent", "Long",
     "Dark and oily. Espresso and cocoa."),
    ("Serie G Maduro", 80, 86, 1, ["Chocolate", "Cedar"], [], "Just Right", "Good", "Excellent", "Medium",
     "Perfect short smoke."),
    ("Prensado", 88, 87, 1, ["Earth", "Pepper", "Chocolate"], [], "Just Right", "Tight", "Average", "Long",
     "Box-press with real depth. Slightly tight draw."),
    ("Le Bijou 1922", 95, 92, 1, ["Pepper", "Coffee", "Leather"], [], "Just Right", "Good", "Excellent", "Long",
     "Bold and balanced."),
    ("Nicaragua", 103, 86, 1, ["Chocolate", "Spice"], [], "Just Right", "Good", "Excellent", "Medium",
     "Davidoff refinement with Nicaraguan spice."),
    ("Don Carlos", 112, 90, 1, ["Cedar", "Nuts", "Cream"], [], "Just Right", "Good", "Excellent", "Long",
     "Elegant. Almond and cedar."),
    ("Double Ligero Maduro", 120, 83, 1, ["Pepper", "Earth"], [], "Too Strong", "Good", "Average", "Long",
     "A heavyweight. Have a full meal first."),
    ("Serie V Melanio", 131, 90, 1, ["Cedar", "Coffee"], [], "Just Right", "Good", "Excellent", "Long",
     "Consistently excellent."),
    ("Padrón 1926 Serie Natural", 140, 93, 1, ["Cocoa", "Coffee", "Earth"], [], "Just Right", "Good", "Excellent", "Long",
     "Mineral and cocoa. Saving the rest to age."),
    ("Hemingway", 150, 82, 1, ["Cedar", "Cream"], [], "Too Mild", "Good", "Excellent", "Medium",
     "Nice, but I'm reaching for fuller cigars lately."),
    ("20th Anniversary Maduro", 162, 85, 1, ["Chocolate", "Coffee", "Leather"], [], "Just Right", "Good", "Excellent", "Medium",
     "Reliable everyday maduro."),
]

# (cigar name, humidor, qty, days since start, target months, notes)
CELLARED = [
    ("Fuente Fuente OpusX", 3, 2, 380, 24, "Resting until 2027"),
    ("Padrón 1926 Serie Natural", 3, 2, 250, 12, None),
    ("Don Carlos", 3, 3, 300, 18, None),
]


def pick_catalog_row(cur, brand, name, size_name):
    rows = cur.execute(
        "SELECT brand, name, line, description, wrapper, binder, filler, length, image, size_name "
        "FROM cigar_catalog WHERE brand = ? AND name = ? AND COALESCE(image,'') <> ''",
        (brand, name),
    ).fetchall()
    if not rows:
        raise SystemExit(f"Catalog row not found: {brand} / {name}")
    prefs = [size_name] if size_name else []
    prefs += ["Robusto", "Toro", "Exclusivo", "Corona"]
    for p in prefs:
        for r in rows:
            if (r[9] or "").lower() == p.lower():
                return r
    return rows[0]


def main(db_path):
    con = sqlite3.connect(db_path)
    cur = con.cursor()

    for t in ("smoke_journal_entries", "smoke_history", "cellared_items", "cigars", "humidors"):
        cur.execute(f"DELETE FROM {t}")
    cur.execute("DELETE FROM sqlite_sequence WHERE name IN ('smoke_journal_entries','smoke_history','cellared_items','cigars','humidors')")

    now = TODAY.isoformat() + "T09:41:00.000Z"
    for hid, name, hum, temp, notes in HUMIDORS:
        cur.execute(
            "INSERT INTO humidors (id, name, humidity, temperature, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
            (hid, name, hum, temp, notes, d(400) + "T12:00:00.000Z", now),
        )

    ids = {}
    for brand, name, size, qty, hid, fav, coll, added, sp, fp in CIGARS:
        r = pick_catalog_row(cur, brand, name, size)
        cur.execute(
            """INSERT INTO cigars (brand, name, line, description, wrapper, binder, filler, length, image,
                 quantity, collection, is_favorite, flavor_profile, strength_profile, date_added, humidor_id,
                 construction_quality)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8],
             qty, coll, fav, fp, sp, d(added), hid, "Excellent" if fav else None),
        )
        ids[name] = cur.lastrowid

    for (name, ago, rating, wba, liked, disliked, sfb, draw, burn, finish, notes) in JOURNAL:
        cid = ids[name]
        day = d(ago)
        cur.execute("INSERT INTO smoke_history (cigar_id, smoked_at) VALUES (?, ?)", (cid, day))
        cur.execute(
            """INSERT INTO smoke_journal_entries (cigar_id, smoked_date, rating, would_buy_again, notes,
                 liked_flavors, disliked_flavors, strength_feedback, draw, burn, finish, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (cid, day, rating, wba, notes, json.dumps(liked), json.dumps(disliked), sfb, draw, burn, finish,
             day + "T21:30:00.000Z", day + "T21:30:00.000Z"),
        )
        # keep cigar-level smoked_date in step with the latest smoke
        cur.execute("UPDATE cigars SET smoked_date = COALESCE(MAX(smoked_date, ?), ?) WHERE id = ?", (day, day, cid))

    for (name, hid, qty, ago, months, notes) in CELLARED:
        cur.execute(
            """INSERT INTO cellared_items (cigar_id, humidor_id, quantity, started_at, target_months, notes, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (ids[name], hid, qty, d(ago), months, notes, now, now),
        )

    con.commit()
    for t in ("humidors", "cigars", "smoke_journal_entries", "cellared_items"):
        print(t, cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0])
    print("in humidor:", cur.execute("SELECT SUM(quantity) FROM cigars WHERE collection='cavaro'").fetchone()[0])
    con.close()


if __name__ == "__main__":
    main(sys.argv[1])
