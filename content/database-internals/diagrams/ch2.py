import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from svg import *  # noqa

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "img")
W = 600


def bst_balance():
    s = Svg(W, 340, "Same 7 keys, different insert order")
    s.text(24, 66, "Balanced: 3 levels", size=15, weight=700, color=GREEN)
    pos = {50: (150, 110), 30: (90, 180), 70: (210, 180), 20: (60, 250), 40: (120, 250), 60: (180, 250), 80: (240, 250)}
    for a, b in [(50, 30), (50, 70), (30, 20), (30, 40), (70, 60), (70, 80)]:
        s.line(pos[a][0], pos[a][1], pos[b][0], pos[b][1], color=LINE)
    for k, (x, y) in pos.items():
        s.node(x, y, str(k), color=GREEN)
    s.text(150, 300, "find 80: 3 steps", size=13, color=MUTED, anchor="middle")
    s.text(330, 66, "Sorted inserts: 7 levels", size=15, weight=700, color=ROSE)
    keys = [20, 30, 40, 50, 60, 70, 80]
    pts = [(350 + i * 34, 96 + i * 34) for i in range(7)]
    for i in range(6):
        s.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], color=LINE)
    for i, k in enumerate(keys):
        s.node(pts[i][0], pts[i][1], str(k), color=ROSE)
    s.text(470, 330, "find 80: 7 steps (a linked list)", size=13, color=MUTED, anchor="middle")
    s.save(os.path.join(OUT, "c2-bst-balance.svg"))


def ssd():
    s = Svg(W, 330, "Inside an SSD")
    levels = [
        ("Die", "one or more per SSD", SKY),
        ("Plane", "several per die", VIOLET),
        ("Block", "64–512 pages · smallest ERASE unit", ROSE),
        ("Page", "2–16 KB · smallest READ / WRITE unit", GREEN),
        ("Cells", "1+ bits each, in strings and arrays", AMBER),
    ]
    for k, (name, note, c) in enumerate(levels):
        x = 24 + k * 22
        y = 54 + k * 52
        s.rect(x, y, W - 48 - k * 44, 42, fill=tint(c), stroke=c)
        s.text(x + 16, y + 27, name, size=16, weight=700)
        s.text(x + 110, y + 27, note, size=14, color=MUTED)
    s.save(os.path.join(OUT, "c2-ssd.svg"))


def btree():
    s = Svg(W, 350, "A B+-Tree with three levels")
    cw, h = 34, 30
    # root [30 | 60]: pointers at its left edge, between keys, right edge
    rx = (W - 2 * cw) / 2
    s.cells(rx, 56, ["30", "60"], cw=cw, h=h, color=SKY)
    s.text(rx + 2 * cw + 12, 76, "root", size=13, color=MUTED)
    ints = [(70, "20", "< 30"), (283, "45", "30 … 59"), (496, "75", "≥ 60")]
    for k, (x, key, rng) in enumerate(ints):
        s.cells(x, 146, [key], cw=cw, h=h, color=VIOLET)
        s.arrow(rx + k * cw, 86, x + cw / 2, 144, color=MUTED, sw=1.3, head=7)
        s.text(x + cw + 8, 166, rng, size=12, color=MUTED)
    leaves = [(24, ["10", "12", "15"], 70), (130, ["20", "23", "27"], 70 + cw),
              (237, ["30", "35", "41"], 283), (343, ["45", "50", "58"], 283 + cw)]
    for x, keys, px in leaves:
        s.cells(x, 236, keys, cw=30, h=h, color=GREEN)
        s.arrow(px, 176, x + 45, 234, color=MUTED, sw=1.3, head=7)
    s.rect(470, 236, 106, h, fill="none", stroke=LINE, dash="4 4", rx=3)
    s.text(523, 256, "…", size=14, color=MUTED, anchor="middle")
    for (x1, _, _), (x2, _, _) in zip(leaves, leaves[1:] + [(470, None, None)]):
        s.arrow(x1 + 92, 251, x2 - 2, 251, color=AMBER, sw=1.6, head=6, both=True)
    s.text(24, 300, "leaves hold keys + row data (or row pointers)", size=13, color=MUTED)
    s.text(24, 322, "sibling links: a range scan walks along the leaves", size=13, color=AMBER)
    s.save(os.path.join(OUT, "c2-btree.svg"))


def height():
    s = Svg(W, 360, "Tree height vs number of keys")
    x0, y0, w, h = 84, 56, 480, 220
    lo, hi = 3, 12  # 1e3 .. 1e12 keys
    maxh = 40

    def xpos(e):
        return x0 + (e - lo) / (hi - lo) * w

    def ypos(v):
        return y0 + h - v / maxh * h

    axes(s, x0, y0, w, h, "number of keys (log scale)", "levels (page reads)",
         [3, 6, 9, 12], [0, 10, 20, 30, 40],
         xfmt=lambda e: {3: "1 thousand", 6: "1 million", 9: "1 billion", 12: "1 trillion"}[e],
         xpos=xpos, ypos=ypos)
    for f, color, label in [(2, ROSE, "fanout 2 (binary tree)"), (100, AMBER, "fanout 100"), (1000, GREEN, "fanout 1,000")]:
        pts = []
        for i in range(0, 19):
            e = lo + i * 0.5
            pts.append((xpos(e), ypos(math.ceil(e / math.log10(f)))))
        polyline(s, pts, color, dots=False)
    s.legend(x0 + 10, y0 + 12, [(ROSE, "fanout 2 (binary tree): ~30 levels for 1 billion"),
                                 (AMBER, "fanout 100: 5 levels for 1 billion"),
                                 (GREEN, "fanout 1,000: 3 levels for 1 billion")], size=13)
    s.save(os.path.join(OUT, "c2-height.svg"))


def split():
    s = Svg(W, 340, "Leaf split while inserting 11 (N = 4)")
    cw, h = 40, 32
    s.text(24, 66, "Before: the leaf is full", size=14, weight=700)
    s.cells(24, 80, ["5"], cw=cw, h=h, color=SKY)
    s.text(24 + cw + 10, 100, "parent (keys ≥ 5 go right)", size=13, color=MUTED)
    s.arrow(24 + cw, 112, 24 + 2 * cw, 134, color=MUTED, sw=1.3, head=7)
    s.cells(24, 136, ["5", "7", "9", "13"], cw=cw, h=h, color=GREEN)
    s.text(24 + 4 * cw + 12, 157, "+ 11 → no room", size=14, color=ROSE)
    s.line(24, 194, W - 24, 194, color=GRID)
    s.text(24, 224, "After: split at the midpoint, promote 11", size=14, weight=700)
    px = 220
    s.cells(px, 238, ["5", "11"], cw=cw, h=h, color=SKY, fills={1: tint(AMBER, 0.45)})
    s.text(px + 2 * cw + 10, 259, "parent gets separator 11", size=13, color=AMBER)
    s.cells(60, 296, ["5", "7", "9"], cw=cw, h=h - 4, color=GREEN)
    s.cells(330, 296, ["11", "13"], cw=cw, h=h - 4, color=GREEN, fills={0: tint(AMBER, 0.45)})
    s.arrow(px + cw, 270, 60 + 1.5 * cw, 294, color=MUTED, sw=1.3, head=7)
    s.arrow(px + 2 * cw, 270, 330 + cw, 294, color=MUTED, sw=1.3, head=7)
    s.text(60 + 3 * cw + 10, 315, "old node", size=12, color=MUTED)
    s.text(330 + 2 * cw + 10, 315, "new node", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c2-split.svg"))


def merge():
    s = Svg(W, 350, "Leaf merge after deleting 16 (N = 4)")
    cw, h = 40, 32
    s.text(24, 66, "Before: two neighbours, half empty", size=14, weight=700)
    px = 220
    s.cells(px, 80, ["…", "15", "…"], cw=cw, h=h, color=SKY)
    s.cells(70, 140, ["10", "12"], cw=cw, h=h, color=GREEN)
    s.cells(330, 140, ["15", "16"], cw=cw, h=h, color=GREEN, fills={1: tint(ROSE, 0.45)})
    s.text(330 + 2 * cw + 10, 161, "delete 16", size=13, color=ROSE)
    s.arrow(px + cw, 112, 70 + cw, 138, color=MUTED, sw=1.3, head=7)
    s.arrow(px + 2 * cw, 112, 330 + cw, 138, color=MUTED, sw=1.3, head=7)
    s.line(24, 196, W - 24, 196, color=GRID)
    s.text(24, 226, "After: 10, 12, 15 fit in one node", size=14, weight=700)
    s.cells(px + cw / 2, 240, ["…", "…"], cw=cw, h=h, color=SKY)
    s.text(px + 2.5 * cw + 10, 261, "separator 15 removed", size=13, color=AMBER)
    s.arrow(px + 1.5 * cw, 272, px + 1.5 * cw, 296, color=MUTED, sw=1.3, head=7)
    s.cells(px, 298, ["10", "12", "15"], cw=cw, h=h - 4, color=GREEN)
    s.text(px + 3 * cw + 10, 317, "right node freed", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c2-merge.svg"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    bst_balance()
    ssd()
    btree()
    height()
    split()
    merge()
