import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from svg import *  # noqa

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "img")
W = 600


def siblings():
    s = Svg(W, 330, "Finding the next leaf")
    for col, (title, color, links) in enumerate([("(a) via the parent", ROSE, False), ("(b) via sibling links", GREEN, True)]):
        ox = 24 + col * 292
        s.text(ox, 64, title, size=15, weight=700, color=color)
        s.box(ox + 90, 84, 90, 34, "root", color=SKY, size=13)
        s.box(ox + 20, 158, 90, 34, "P1", color=VIOLET, size=13)
        s.box(ox + 160, 158, 90, 34, "P2", color=VIOLET, size=13)
        s.line(ox + 135, 118, ox + 65, 158, color=LINE)
        s.line(ox + 135, 118, ox + 205, 158, color=LINE)
        leaves = [ox + 0, ox + 68, ox + 140, ox + 208]
        for k, lx in enumerate(leaves):
            hl = k in (1, 2)
            s.box(lx, 232, 58, 32, "L%d" % (k + 1), color=AMBER if hl else GREEN, size=13)
        s.line(ox + 65, 192, leaves[0] + 29, 232, color=LINE)
        s.line(ox + 65, 192, leaves[1] + 29, 232, color=LINE)
        s.line(ox + 205, 192, leaves[2] + 29, 232, color=LINE)
        s.line(ox + 205, 192, leaves[3] + 29, 232, color=LINE)
        if links:
            s.arrow(leaves[1] + 58, 248, leaves[2], 248, color=GREEN, sw=2.4, head=8)
            s.text(ox, 296, "L2 → L3: one hop", size=13, color=GREEN)
        else:
            s.path("M %d 232 L %d 194 L %d 120 L %d 120 L %d 194 L %d 232" % (leaves[1] + 40, ox + 80, ox + 120, ox + 150, ox + 190, leaves[2] + 20),
                   color=ROSE, sw=2.2, dash="6 4")
            s.text(ox, 296, "L2 → P1 → root → P2 → L3", size=13, color=ROSE)
    s.save(os.path.join(OUT, "c4-siblings.svg"))


def highkey():
    s = Svg(W, 300, "Rightmost pointer vs high key")
    cw = 46
    for row, (title, keys, color, note) in enumerate([
            ("(a) implicit +∞: last pointer unpaired", ["K1", "K2", "K3"], ROSE, "last subtree: ≥ K3 … +∞"),
            ("(b) stored high key: every pointer has a key", ["K1", "K2", "K3", "HK"], GREEN, "last subtree: ≥ K3 and < HK")]):
        y = 66 + row * 116
        s.text(24, y, title, size=14, weight=700, color=color)
        x = 24
        for k, key in enumerate(keys):
            s.rect(x, y + 14, 14, 34, fill=tint(MUTED, 0.3), stroke=MUTED, rx=2)
            s.text(x + 7, y + 36, "p", size=11, color=MUTED, anchor="middle")
            x += 14
            hk = key == "HK"
            s.rect(x, y + 14, cw, 34, fill=tint(AMBER, 0.4) if hk else tint(SKY), stroke=AMBER if hk else SKY, rx=2)
            s.text(x + cw / 2, y + 36, key, size=14, anchor="middle", mono=True, weight=600)
            x += cw
        if row == 0:
            s.rect(x, y + 14, 14, 34, fill=tint(ROSE, 0.4), stroke=ROSE, rx=2)
            s.text(x + 7, y + 36, "p", size=11, color=ROSE, anchor="middle")
            x += 14
        s.text(x + 16, y + 36, note, size=13, color=MUTED)
    s.text(24, 286, "p = child pointer · PostgreSQL stores the high key as item 1", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c4-highkey.svg"))


def overflow():
    s = Svg(W, 280, "Overflow pages")
    s.rect(24, 60, 300, 190, fill=PANEL, stroke=SKY)
    s.text(36, 82, "primary page", size=14, weight=700, color=SKY)
    cells = [("k1 | small value", False), ("k2 | first bytes…", True), ("k3 | small value", False), ("k4 | first bytes…", True)]
    for k, (txt, ov) in enumerate(cells):
        y = 96 + k * 36
        s.rect(36, y, 276, 28, fill=tint(AMBER if ov else GREEN, 0.3), stroke=AMBER if ov else GREEN, rx=3)
        s.text(46, y + 19, txt, size=13, mono=True)
    s.rect(380, 60, 196, 190, fill=PANEL, stroke=AMBER)
    s.text(392, 82, "overflow page", size=14, weight=700, color=AMBER)
    for k, txt in enumerate(["…rest of k2", "…rest of k4", "(free)"]):
        y = 96 + k * 40
        free = txt == "(free)"
        s.rect(392, y, 172, 30, fill="none" if free else tint(AMBER, 0.3), stroke=LINE if free else AMBER, dash="4 3" if free else None, rx=3)
        s.text(402, y + 20, txt, size=13, mono=not free, color=MUTED if free else TEXT)
    s.arrow(312, 146, 390, 111, color=AMBER, head=7)
    s.arrow(312, 218, 390, 151, color=AMBER, head=7)
    s.text(392, 238, "next overflow → …", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c4-overflow.svg"))


def binsearch():
    s = Svg(W, 290, "Binary search through slot offsets")
    s.text(24, 64, "slot array (sorted by key)", size=13, color=VIOLET, weight=700)
    order = ["A", "C", "F", "K", "N", "R", "T"]
    for k, key in enumerate(order):
        target = key == "R"
        probe = key in ("K", "R")
        s.rect(24 + k * 64, 76, 58, 32, fill=tint(AMBER, 0.45) if target else tint(VIOLET, 0.3), stroke=AMBER if probe else VIOLET, rx=3, sw=2.4 if probe else 1.5)
        s.text(53 + k * 64, 97, "→" + key, size=13, anchor="middle", mono=True)
    s.text(24, 176, "cells (insertion order)", size=13, color=GREEN, weight=700)
    cells = ["T", "A", "K", "R", "C", "N", "F"]
    for k, key in enumerate(cells):
        target = key == "R"
        s.rect(24 + k * 64, 188, 58, 32, fill=tint(AMBER, 0.45) if target else tint(GREEN, 0.3), stroke=GREEN, rx=3)
        s.text(53 + k * 64, 209, key, size=14, anchor="middle")
    for n, key in enumerate(["K", "R"]):
        a = order.index(key)
        b = cells.index(key)
        s.arrow(53 + a * 64, 110, 53 + b * 64, 186, color=AMBER, sw=1.4, dash="5 3", head=7)
    s.text(24, 252, "search R: middle slot → K (go right) → middle of the rest → R found", size=13, color=AMBER)
    s.text(24, 272, "each probe follows an offset to read the key", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c4-binsearch.svg"))


def breadcrumbs():
    s = Svg(W, 320, "Breadcrumbs on the way down")
    s.box(70, 62, 100, 34, "root", color=SKY, size=13)
    s.box(40, 140, 100, 34, "N1", color=VIOLET, size=13)
    s.box(150, 140, 100, 34, "N2", color=VIOLET, size=13)
    s.box(110, 222, 100, 34, "leaf L7", color=AMBER, size=13)
    s.box(230, 222, 100, 34, "L8", color=GREEN, size=13)
    s.line(120, 96, 90, 140, color=LINE)
    s.arrow(130, 96, 196, 138, color=AMBER, sw=2.2)
    s.arrow(196, 174, 164, 220, color=AMBER, sw=2.2)
    s.line(206, 174, 280, 222, color=LINE)
    s.text(176, 112, "child 1", size=12, color=AMBER)
    s.text(118, 202, "child 0", size=12, color=AMBER)
    # stack
    sx = 380
    s.text(sx, 70, "stack (top first)", size=14, weight=700)
    for k, (page, idx) in enumerate([("N2", "0"), ("root", "1")]):
        y = 86 + k * 42
        s.rect(sx, y, 196, 36, fill=tint(AMBER if k == 0 else MUTED, 0.25), stroke=AMBER if k == 0 else LINE, rx=4)
        s.text(sx + 14, y + 23, "page %s, child %s" % (page, idx), size=13, mono=True)
    s.text(sx, 200, "leaf splits →", size=13, color=MUTED)
    s.text(sx, 220, "pop N2: insert separator", size=13, color=MUTED)
    s.text(sx, 240, "at position 0 + 1", size=13, color=MUTED)
    s.text(sx, 270, "N2 full too → pop root", size=13, color=MUTED)
    s.save(os.path.join(OUT, "c4-breadcrumbs.svg"))


def rebalance():
    s = Svg(W, 300, "Rebalancing instead of splitting")
    cw = 40
    s.text(24, 64, "Before: left full, right half empty", size=14, weight=700)
    s.cells(250, 76, ["30"], cw=cw, h=30, color=SKY)
    s.cells(40, 128, ["10", "13", "17", "22", "25"], cw=cw, h=30, color=GREEN)
    s.cells(360, 128, ["30", "35"], cw=cw, h=30, color=GREEN)
    s.arrow(250, 106, 140, 126, color=MUTED, sw=1.3, head=7)
    s.arrow(290, 106, 400, 126, color=MUTED, sw=1.3, head=7)
    s.line(24, 178, W - 24, 178, color=GRID)
    s.text(24, 206, "After: move 22, 25 right; parent separator 30 → 22", size=14, weight=700)
    s.cells(250, 218, ["22"], cw=cw, h=30, color=SKY, fills={0: tint(AMBER, 0.45)})
    s.cells(60, 266, ["10", "13", "17"], cw=cw, h=26, color=GREEN)
    s.cells(330, 266, ["22", "25", "30", "35"], cw=cw, h=26, color=GREEN, fills={0: tint(AMBER, 0.45), 1: tint(AMBER, 0.45)})
    s.arrow(250, 248, 120, 264, color=MUTED, sw=1.3, head=7)
    s.arrow(290, 248, 400, 264, color=MUTED, sw=1.3, head=7)
    s.save(os.path.join(OUT, "c4-rebalance.svg"))


def fill():
    s = Svg(W, 300, "Average leaf page fill (typical)")
    bars = [("Sequential keys,\nright-only append", 94, GREEN), ("Bulk-loaded index\n(fill factor 90)", 90, SKY),
            ("Random keys\n(e.g. UUIDv4)", 69, ROSE), ("Right after a\n50/50 split", 50, AMBER)]
    x0, y0, w, h = 210, 60, 340, 200
    for k, (label, pct, color) in enumerate(bars):
        y = y0 + k * 52
        a, b = label.split("\n")
        s.text(x0 - 12, y + 16, a, size=13, anchor="end")
        s.text(x0 - 12, y + 32, b, size=12, color=MUTED, anchor="end")
        s.rect(x0, y + 4, w, 32, fill=GRID, stroke=GRID, rx=4)
        s.rect(x0, y + 4, w * pct / 100, 32, fill=tint(color, 0.45), stroke=color, rx=4)
        s.text(x0 + w * pct / 100 - 8, y + 26, "%d%%" % pct, size=14, weight=700, anchor="end")
    s.text(24, 284, "Random inserts settle near ln 2 ≈ 69% full (classic result); rough values.", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c4-fill.svg"))


def fragmented():
    s = Svg(W, 250, "A fragmented page")
    x, y = 24, 60
    s.rect(x, y, 80, 70, fill=tint(SKY, 0.3), stroke=SKY, rx=0)
    s.text(x + 40, y + 40, "header", size=13, anchor="middle")
    for k in range(3):
        s.rect(x + 86 + k * 34, y + 18, 30, 34, fill=tint(VIOLET, 0.35), stroke=VIOLET, rx=2)
    s.rect(x + 190, y, 120, 70, fill="none", stroke=LINE, dash="4 3", rx=0)
    s.text(x + 250, y + 40, "free", size=13, color=MUTED, anchor="middle")
    segs = [("live", GREEN, 60), ("garbage", ROSE, 50), ("live", GREEN, 70), ("garbage", ROSE, 46), ("live", GREEN, 46)]
    cx = x + 310
    for name, color, wdt in segs:
        s.rect(cx, y, wdt, 70, fill=tint(color, 0.35), stroke=color, rx=0, dash="4 3" if name == "garbage" else None)
        s.text(cx + wdt / 2, y + 40, name if (name == "live" or wdt > 48) else "dead", size=11, anchor="middle")
        cx += wdt
    s.text(24, 166, "Total free = free gap + garbage, but no single gap may be big enough.", size=13, color=MUTED)
    s.text(24, 190, "Defragmenting rewrites the live cells together:", size=13, color=MUTED)
    s.rect(24, 202, 80, 28, fill=tint(SKY, 0.3), stroke=SKY, rx=0)
    s.rect(110, 202, 290, 28, fill="none", stroke=LINE, dash="4 3", rx=0)
    s.text(255, 221, "one contiguous free gap", size=12, color=MUTED, anchor="middle")
    s.rect(406, 202, 170, 28, fill=tint(GREEN, 0.35), stroke=GREEN, rx=0)
    s.text(491, 221, "live cells", size=12, anchor="middle")
    s.save(os.path.join(OUT, "c4-fragmented.svg"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    siblings()
    highkey()
    overflow()
    binsearch()
    breadcrumbs()
    rebalance()
    fill()
    fragmented()
