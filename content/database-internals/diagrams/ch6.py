import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from svg import *  # noqa

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "img")
W = 600


def cow():
    s = Svg(W, 330, "Copy-on-write: update leaf C")
    # old tree
    s.box(120, 60, 80, 34, "root", color=MUTED, size=13)
    s.box(40, 130, 70, 32, "A", color=MUTED, size=13)
    s.box(130, 130, 70, 32, "B", color=MUTED, size=13)
    s.box(20, 200, 56, 30, "C", color=MUTED, size=13)
    s.box(86, 200, 56, 30, "D", color=GREEN, size=13)
    s.box(152, 200, 56, 30, "E", color=GREEN, size=13)
    s.box(218, 200, 56, 30, "F", color=GREEN, size=13)
    for a, b in [((160, 94), (75, 130)), ((160, 94), (165, 130)), ((75, 162), (48, 200)), ((75, 162), (114, 200)), ((165, 162), (180, 200)), ((165, 162), (246, 200))]:
        s.line(a[0], a[1], b[0], b[1], color=LINE)
    s.text(24, 262, "old version (still readable)", size=12, color=MUTED)
    # new path
    s.box(400, 60, 80, 34, "root'", color=AMBER, size=13)
    s.box(330, 130, 70, 32, "A'", color=AMBER, size=13)
    s.box(310, 200, 56, 30, "C'", color=AMBER, size=13)
    s.line(440, 94, 365, 130, color=AMBER, sw=2)
    s.line(365, 162, 338, 200, color=AMBER, sw=2)
    s.path("M 365 162 C 300 190, 150 180, 114 200", color=GREEN, sw=1.6, dash="5 4")
    s.path("M 440 94 C 380 110, 230 110, 165 130", color=GREEN, sw=1.6, dash="5 4")
    s.text(320, 262, "copied path (amber) + shared pages", size=12, color=AMBER)
    s.text(320, 280, "(green dashed links)", size=12, color=GREEN)
    s.arrow(520, 120, 470, 80, color=SKY, sw=2)
    s.text(470, 140, "atomic root switch", size=12, color=SKY)
    s.text(24, 310, "Readers of the old root keep a consistent snapshot; old pages are freed later.", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c6-cow.svg"))


def wiredtiger():
    s = Svg(W, 300, "WiredTiger pages")
    for col, (title, dirty) in enumerate([("clean page", False), ("dirty page", True)]):
        ox = 24 + col * 292
        s.text(ox, 64, title, size=15, weight=700, color=GREEN if not dirty else AMBER)
        s.box(ox, 80, 260, 44, "in-memory index", color=VIOLET, sub="built when the page is read", size=14)
        if dirty:
            s.box(ox, 140, 260, 44, "update buffer (skiplist)", color=AMBER, sub="new inserts / updates", size=14)
        s.box(ox, 210, 260, 44, "on-disk page image", color=GREEN, sub="base version", size=14)
        s.arrow(ox + 130, 124 if not dirty else 184, ox + 130, 208, color=MUTED, sw=1.3, head=7)
    s.text(24, 286, "Reads merge buffer + image; reconciliation writes a new image on flush.", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c6-wiredtiger.svg"))


def latree():
    s = Svg(W, 320, "LA-Tree: buffers cascade down subtrees")
    s.box(230, 56, 140, 36, "root", color=SKY, size=13)
    s.rect(390, 56, 140, 36, fill=tint(AMBER), stroke=AMBER, rx=6)
    s.cells(398, 63, ["+k1", "+k2", "-k3"], cw=40, h=22, color=AMBER, size=11)
    s.text(390, 108, "root buffer (full → push down)", size=12, color=AMBER)
    for k, x in enumerate([60, 330]):
        s.box(x, 150, 120, 34, "subtree %d" % (k + 1), color=VIOLET, size=13)
        s.rect(x + 130, 150, 100, 34, fill=tint(AMBER), stroke=AMBER, rx=6)
        s.cells(x + 136, 156, ["+k1", "-k3"] if k == 0 else ["+k2"], cw=40, h=22, color=AMBER, size=11)
        s.line(300, 92, x + 60, 150, color=LINE)
    for k, x in enumerate([30, 110, 300, 380]):
        s.box(x, 240, 70, 30, "leaf", color=GREEN, size=12)
    s.line(120, 184, 65, 240, color=LINE)
    s.line(120, 184, 145, 240, color=LINE)
    s.line(390, 184, 335, 240, color=LINE)
    s.line(390, 184, 415, 240, color=LINE)
    s.text(24, 300, "At the leaves, all batched changes are applied in one write.", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c6-latree.svg"))


def fdtree():
    s = Svg(W, 300, "FD-Tree")
    s.box(220, 56, 160, 40, "head B-Tree", color=AMBER, sub="mutable, small", size=14)
    s.text(392, 82, "random writes only here", size=12, color=AMBER)
    runs = [("L1", 260, SKY), ("L2", 420, VIOLET), ("L3", 552, GREEN)]
    for k, (name, wdt, c) in enumerate(runs):
        y = 128 + k * 50
        x = (W - wdt) / 2
        s.rect(x, y, wdt, 34, fill=tint(c), stroke=c, rx=4)
        s.text(x + 12, y + 22, name, size=14, weight=700)
        s.text(x + wdt - 12, y + 22, "immutable sorted run", size=12, color=MUTED, anchor="end")
        if k == 0:
            s.arrow(300, 96, 300, 126, color=AMBER, sw=1.6, head=7)
        else:
            s.arrow(300, y - 16, 300, y - 2, color=MUTED, sw=1.6, head=7)
    s.text(24, 286, "Each level ≈ k× bigger; full levels merge into the next one.", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c6-fdtree.svg"))


def cascading():
    s = Svg(W, 300, "Fractional cascading bridges")
    arrays = [("A1", ["12", "24", "25", "30", "32", "34", "39"], {2, 3}),
              ("A2", ["16", "22", "25", "26", "28", "30", "35"], {0, 3}),
              ("A3", ["11", "16", "24", "26", "30"], set())]
    cw = 52
    pos = {}
    for r, (name, vals, pulled) in enumerate(arrays):
        y = 70 + r * 80
        s.text(24, y + 22, name, size=15, weight=700)
        for k, v in enumerate(vals):
            x = 70 + k * (cw + 8)
            pull = k in pulled
            s.rect(x, y, cw, 32, fill=tint(AMBER, 0.45) if pull else tint(SKY), stroke=AMBER if pull else SKY, rx=3)
            s.text(x + cw / 2, y + 21, v, size=14, anchor="middle", mono=True)
            pos[(r, v)] = (x + cw / 2, y)
    # bridges from pulled elements to the lower array
    for (r, v) in [(0, "25"), (0, "30"), (1, "16"), (1, "26")]:
        x1, y1 = pos[(r, v)]
        x2, y2 = pos[(r + 1, v)]
        s.arrow(x1, y1 + 32, x2, y2 - 2, color=AMBER, sw=1.6, head=7)
    s.text(24, 290, "amber = pulled up from the level below, with a bridge pointing down", size=12, color=AMBER)
    s.save(os.path.join(OUT, "c6-cascading.svg"))


def bwtree():
    s = Svg(W, 300, "Bw-Tree: mapping table and delta chain")
    s.text(24, 64, "mapping table", size=14, weight=700, color=SKY)
    for k, (lid, hl) in enumerate([("P1", False), ("P2", True), ("P3", False)]):
        y = 78 + k * 36
        s.rect(24, y, 70, 30, fill=tint(SKY), stroke=SKY, rx=0)
        s.text(59, y + 20, lid, size=13, anchor="middle", mono=True)
        s.rect(94, y, 70, 30, fill=tint(AMBER, 0.4) if hl else PANEL, stroke=SKY, rx=0)
        s.text(129, y + 20, "→", size=14, anchor="middle")
    deltas = [("Δ delete k5", ROSE), ("Δ insert k9", GREEN), ("Δ update k2", AMBER)]
    x = 210
    for k, (lab, c) in enumerate(deltas):
        s.rect(x, 104, 104, 36, fill=tint(c), stroke=c, rx=6)
        s.text(x + 52, 127, lab, size=12, anchor="middle")
        s.arrow(x + 104, 122, x + 124, 122, color=MUTED, sw=1.4, head=6)
        x += 124
    s.arrow(164, 129, 208, 122, color=AMBER, sw=2.2)
    s.box(210, 190, 350, 44, "base node P2", color=VIOLET, sub="written once, never modified", size=14)
    s.arrow(x - 20, 140, 540, 188, color=MUTED, sw=1.4, head=6)
    s.text(24, 270, "New change: build a delta pointing to the head, then CAS the table entry.", size=12, color=MUTED)
    s.text(24, 290, "newest delta first → oldest → base", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c6-bwtree.svg"))


def veb():
    s = Svg(W, 320, "van Emde Boas layout")
    # logical tree of height 4 (15 nodes): top subtree (3 nodes) and 4 bottom subtrees (3 nodes each)
    levels = 4
    coords = {}
    for lvl in range(levels):
        n = 2 ** lvl
        for i in range(n):
            x = 24 + (i + 0.5) * (W - 48) / n
            y = 66 + lvl * 46
            coords[(lvl, i)] = (x, y)
    for (lvl, i), (x, y) in coords.items():
        if lvl < levels - 1:
            for c in (2 * i, 2 * i + 1):
                cx, cy = coords[(lvl + 1, c)]
                s.line(x, y, cx, cy, color=LINE)
    groups = {}
    colors = [AMBER, SKY, VIOLET, GREEN, ROSE]
    for (lvl, i) in coords:
        g = 0 if lvl < 2 else 1 + i // 2
        groups[(lvl, i)] = g
    order = []
    for g in range(5):
        members = sorted([k for k, v in groups.items() if v == g])
        order += members
    for idx, key in enumerate(order):
        x, y = coords[key]
        s.circle(x, y, 13, fill=tint(colors[groups[key]], 0.45), stroke=colors[groups[key]])
        s.text(x, y + 4, str(idx + 1), size=11, anchor="middle", weight=600)
    # memory strip
    s.text(24, 258, "memory / disk order:", size=12, color=MUTED)
    cw = (W - 48) / len(order)
    for idx, key in enumerate(order):
        c = colors[groups[key]]
        s.rect(24 + idx * cw, 268, cw - 2, 26, fill=tint(c, 0.45), stroke=c, rx=2)
        s.text(24 + idx * cw + cw / 2 - 1, 286, str(idx + 1), size=11, anchor="middle")
    s.text(24, 312, "each colour = one recursive subtree, stored contiguously", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c6-veb.svg"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    cow()
    wiredtiger()
    latree()
    fdtree()
    cascading()
    bwtree()
    veb()
