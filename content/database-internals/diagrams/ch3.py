import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from svg import *  # noqa

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "img")
W = 600


def endian():
    s = Svg(W, 250, "0xAABBCCDD in memory")
    cw = 70
    for row, (label, seq, color) in enumerate([("Big-endian", ["AA", "BB", "CC", "DD"], SKY),
                                               ("Little-endian", ["DD", "CC", "BB", "AA"], AMBER)]):
        y = 74 + row * 78
        s.text(24, y + 24, label, size=15, weight=700, color=color)
        for k, v in enumerate(seq):
            msb = v == "AA"
            s.rect(170 + k * cw, y, cw, 38, fill=tint(ROSE, 0.4) if msb else tint(color), stroke=color, rx=0)
            s.text(170 + k * cw + cw / 2, y + 25, v, size=16, weight=700, anchor="middle", mono=True)
        for k in range(4):
            s.text(170 + k * cw + cw / 2, y + 56, "a+%d" % k, size=12, color=MUTED, anchor="middle", mono=True)
    s.text(24, 236, "red = most significant byte · addresses grow left to right", size=13, color=MUTED)
    s.save(os.path.join(OUT, "c3-endian.svg"))


def slotted_page():
    s = Svg(W, 300, "A slotted page")
    x, y, w, h = 24, 56, W - 48, 150
    s.rect(x, y, w, h, fill=PANEL, stroke=LINE, rx=6)
    s.rect(x, y, w, 30, fill=tint(SKY, 0.3), stroke=SKY, rx=6)
    s.text(x + 12, y + 20, "page header: page id, flags, free-space bounds, checksum…", size=13)
    # slots
    for k in range(3):
        s.rect(x + 12 + k * 52, y + 44, 48, 30, fill=tint(VIOLET, 0.35), stroke=VIOLET, rx=3)
        s.text(x + 36 + k * 52, y + 64, "s%d" % (k + 1), size=13, anchor="middle", mono=True)
    s.arrow(x + 168, y + 59, x + 262, y + 59, color=VIOLET)
    s.text(x + 12, y + 92, "slot array grows →", size=12, color=VIOLET)
    # free
    s.rect(x + 270, y + 44, 90, 30, fill="none", stroke=LINE, dash="4 4", rx=3)
    s.text(x + 315, y + 64, "free", size=13, color=MUTED, anchor="middle")
    # cells
    cells = [("Tom", 60), ("Leslie", 86), ("Ron", 70)]
    cx = x + w - 12
    for name, cwid in cells:
        cx -= cwid
        s.rect(cx, y + 104, cwid - 4, 34, fill=tint(GREEN, 0.3), stroke=GREEN, rx=3)
        s.text(cx + (cwid - 4) / 2, y + 126, name, size=13, anchor="middle")
    s.arrow(cx - 6, y + 121, cx - 46, y + 121, color=GREEN)
    s.text(cx - 54, y + 126, "← cells grow", size=12, color=GREEN, anchor="end")
    s.text(24, 236, "Slots hold page-local offsets, kept in key order.", size=13, color=MUTED)
    s.text(24, 256, "Cells hold the records, in the order they were written.", size=13, color=MUTED)
    s.text(24, 276, "Outside the page, a record is known by (page, slot).", size=13, color=AMBER)
    s.save(os.path.join(OUT, "c3-slotted-page.svg"))


def cell_order():
    s = Svg(W, 330, "Insert order vs key order")
    rows = [
        ("1. insert Tom", ["Tom"], ["Tom"]),
        ("2. insert Leslie", ["Leslie", "Tom"], ["Tom", "Leslie"]),
        ("3. insert Ron", ["Leslie", "Ron", "Tom"], ["Tom", "Leslie", "Ron"]),
    ]
    s.text(170, 62, "slot array (sorted)", size=13, color=VIOLET, weight=700)
    s.text(410, 62, "cells (insert order)", size=13, color=GREEN, weight=700)
    for r, (label, slots, cells) in enumerate(rows):
        y = 78 + r * 78
        s.text(24, y + 22, label, size=14, weight=600)
        for k, name in enumerate(slots):
            new = (r == 2 and name == "Ron") or (r == 1 and name == "Leslie")
            s.rect(170 + k * 70, y, 64, 32, fill=tint(AMBER, 0.45) if new else tint(VIOLET, 0.3), stroke=VIOLET, rx=3)
            s.text(202 + k * 70, y + 21, "→" + name[0], size=13, anchor="middle", mono=True)
        for k, name in enumerate(cells):
            s.rect(410 + k * 58, y, 54, 32, fill=tint(GREEN, 0.3), stroke=GREEN, rx=3)
            s.text(437 + k * 58, y + 21, name, size=12, anchor="middle")
        if r == 2:
            s.text(170, y + 52, "Tom's slot shifted right; no cell moved", size=12, color=AMBER)
    s.save(os.path.join(OUT, "c3-cell-order.svg"))


def freelist():
    s = Svg(W, 260, "Fragmented page and its availability list")
    x, y = 24, 64
    segs = [(60, True), (40, False), (90, True), (70, False), (50, True), (30, False), (100, True), (62, True)]
    cx = x
    free_pos = []
    for wdt, used in segs:
        if used:
            s.rect(cx, y, wdt, 44, fill=tint(GREEN, 0.35), stroke=GREEN, rx=0)
        else:
            s.rect(cx, y, wdt, 44, fill="none", stroke=AMBER, dash="4 3", rx=0)
            free_pos.append((cx, wdt))
        cx += wdt
    ly = 150
    s.text(x, ly - 14, "availability list (offset, size)", size=14, weight=700, color=AMBER)
    for k, (px, wdt) in enumerate(free_pos):
        bx = x + k * 150
        s.rect(bx, ly, 136, 34, fill=tint(AMBER), stroke=AMBER, rx=4)
        s.text(bx + 68, ly + 22, "(%d, %d)" % (px - x, wdt), size=13, anchor="middle", mono=True)
        s.arrow(bx + 68, ly, px + wdt / 2, y + 46, color=AMBER, dash="4 3", sw=1.2, head=6)
    s.text(x, 216, "green = live cells · dashed = freed space", size=13, color=MUTED)
    s.text(x, 238, "A new cell takes a gap that fits (first fit or best fit).", size=13, color=MUTED)
    s.save(os.path.join(OUT, "c3-freelist.svg"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    endian()
    slotted_page()
    cell_order()
    freelist()
