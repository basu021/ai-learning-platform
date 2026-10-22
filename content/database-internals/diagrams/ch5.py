import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from svg import *  # noqa

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "img")
W = 600


def page_cache():
    s = Svg(W, 330, "Page cache (buffer pool)")
    # tree
    s.text(24, 64, "B-Tree (logical)", size=13, color=MUTED, weight=700)
    s.box(70, 76, 50, 28, "1", color=SKY, size=13)
    s.box(30, 130, 50, 28, "2", color=VIOLET, size=13)
    s.box(110, 130, 50, 28, "3", color=VIOLET, size=13)
    s.line(95, 104, 55, 130, color=LINE)
    s.line(95, 104, 135, 130, color=LINE)
    # cache
    s.text(220, 64, "cache slots (memory)", size=13, color=MUTED, weight=700)
    slots = [("3", VIOLET, True), ("1", SKY, False), ("", None, False), ("2", VIOLET, False), ("", None, False)]
    for k, (lab, c, dirty) in enumerate(slots):
        x = 220 + k * 72
        if lab:
            s.rect(x, 80, 64, 44, fill=tint(c), stroke=AMBER if dirty else c, sw=2.4 if dirty else 1.5)
            s.text(x + 32, 108, lab, size=15, weight=700, anchor="middle")
        else:
            s.rect(x, 80, 64, 44, fill="none", stroke=LINE, dash="4 3")
            s.text(x + 32, 108, "free", size=12, color=MUTED, anchor="middle")
    # disk
    s.text(24, 196, "data file on disk (page order)", size=13, color=MUTED, weight=700)
    for k in range(7):
        x = 24 + k * 78
        s.rect(x, 208, 70, 40, fill=tint(GREEN, 0.15), stroke=GREEN, rx=4)
        s.text(x + 35, 233, "page %d" % (k + 1) if k < 3 else "page %d" % (k + 1), size=12, anchor="middle")
    s.arrow(24 + 35, 206, 220 + 72 + 32, 126, color=MUTED, dash="4 3", sw=1.2, head=6)
    s.arrow(102 + 35, 206, 220 + 3 * 72 + 32, 126, color=MUTED, dash="4 3", sw=1.2, head=6)
    s.arrow(220 + 32, 126, 180 + 35, 206, color=AMBER, sw=1.6, head=7)
    s.text(24, 286, "dashed: page in (read) · amber: dirty page flushed (written back)", size=12, color=MUTED)
    s.text(24, 306, "Pages land in any free slot; memory order ≠ disk order.", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c5-page-cache.svg"))


def clock():
    s = Svg(W, 330, "CLOCK sweep")
    cx, cy, r = 190, 180, 110
    pages = [("P1", 1, False), ("P2", 0, False), ("P3", 1, True), ("P4", 1, False), ("P5", 0, False), ("P6", 1, False), ("P7", 0, True), ("P8", 1, False)]
    n = len(pages)
    for k, (lab, bit, ref) in enumerate(pages):
        a = -math.pi / 2 + k * 2 * math.pi / n
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        color = AMBER if ref else (GREEN if bit else ROSE)
        s.circle(x, y, 27, fill=tint(color, 0.3), stroke=color, sw=2)
        s.text(x, y - 2, lab, size=13, weight=700, anchor="middle")
        s.text(x, y + 14, "bit %d" % bit, size=11, color=MUTED, anchor="middle")
    a = -math.pi / 2 + 1 * 2 * math.pi / n
    s.arrow(cx, cy, cx + (r - 34) * math.cos(a), cy + (r - 34) * math.sin(a), color=SKY, sw=3, head=10)
    s.circle(cx, cy, 5, fill=SKY, stroke=SKY)
    s.text(cx, cy + 26, "hand", size=12, color=SKY, anchor="middle")
    lx = 350
    s.legend(lx, 90, [(GREEN, "bit 1: set to 0, skip"), (ROSE, "bit 0: evict"), (AMBER, "in use: skip")], size=13)
    s.lines(lx, 170, ["Hand at P2 (bit 0):", "→ P2 is evicted.", "", "An access sets a page's", "bit back to 1: it gets a", "second chance."], size=13, color=MUTED)
    s.save(os.path.join(OUT, "c5-clock.svg"))


def wal():
    s = Svg(W, 320, "Write-ahead logging")
    s.box(24, 60, 150, 44, "transaction", color=SKY, sub="UPDATE … ; COMMIT", size=14)
    s.box(230, 60, 150, 44, "page cache", color=VIOLET, sub="page becomes dirty", size=14)
    s.box(230, 150, 150, 44, "log buffer", color=AMBER, sub="records + LSN", size=14)
    s.arrow(174, 82, 228, 82, color=MUTED)
    s.arrow(174, 92, 228, 162, color=MUTED)
    s.text(184, 140, "1", size=14, weight=700, color=AMBER)
    # disk
    s.rect(430, 60, 146, 190, fill=PANEL, stroke=LINE)
    s.text(503, 82, "disk", size=13, color=MUTED, anchor="middle", weight=700)
    s.box(444, 96, 118, 50, "WAL", color=AMBER, sub="sequential append", size=14)
    s.box(444, 180, 118, 50, "data files", color=GREEN, sub="random writes", size=14)
    s.arrow(380, 172, 442, 128, color=AMBER, sw=2.2)
    s.text(392, 140, "2", size=14, weight=700, color=AMBER)
    s.arrow(380, 86, 442, 198, color=GREEN, sw=1.8, dash="6 4")
    s.text(408, 212, "3", size=14, weight=700, color=GREEN)
    s.lines(24, 236, ["1  change the cached page and write a log record", "2  COMMIT returns after the log is flushed (fsync)",
                      "3  dirty page written later, by the background writer", "   or a checkpoint — never before its log records"], size=13, color=MUTED)
    s.save(os.path.join(OUT, "c5-wal.svg"))


def aries():
    s = Svg(W, 310, "ARIES crash recovery")
    x0, x1 = 40, 560
    y = 110
    s.line(x0, y, x1, y, color=LINE, sw=2)
    marks = [(80, "last checkpoint", SKY), (250, "T1 commits", GREEN), (520, "crash", ROSE)]
    for x, lab, c in marks:
        s.line(x, y - 12, x, y + 12, color=c, sw=2.5)
        s.text(x, y - 20, lab, size=12, color=c, anchor="middle")
    s.text(380, y + 30, "T2 still running", size=12, color=AMBER, anchor="middle")
    s.line(300, y + 14, 520, y + 14, color=AMBER, sw=3)
    phases = [("1. Analysis", "find dirty pages + active transactions", SKY, 80, 520),
              ("2. Redo", "repeat history up to the crash", GREEN, 80, 520),
              ("3. Undo", "roll back T2, newest change first", ROSE, 520, 300)]
    for k, (name, desc, c, a, b) in enumerate(phases):
        yy = 172 + k * 46
        s.text(40, yy - 8, name, size=13, weight=700, color=c)
        s.text(140, yy - 8, desc, size=12, color=MUTED)
        s.arrow(a, yy + 4, b, yy + 4, color=c, sw=2.4)
    s.save(os.path.join(OUT, "c5-aries.svg"))


def serial_orders():
    s = Svg(W, 300, "Three transactions, six serial orders")
    cols = [SKY, AMBER, GREEN]
    s.text(24, 64, "Concurrent:", size=13, weight=700)
    for k, c in enumerate(cols):
        y = 78 + k * 26
        s.text(24, y + 15, "T%d" % (k + 1), size=13, color=c, weight=700)
        for j in range(3):
            s.rect(64 + k * 18 + j * 70, y, 56, 18, fill=tint(c, 0.35), stroke=c, rx=3)
    s.text(330, 64, "A serializable result equals one of:", size=13, weight=700)
    import itertools
    for i, perm in enumerate(itertools.permutations([0, 1, 2])):
        y = 80 + i * 32
        for j, t in enumerate(perm):
            s.rect(330 + j * 76, y, 70, 22, fill=tint(cols[t], 0.35), stroke=cols[t], rx=3)
            s.text(365 + j * 76, y + 16, "T%d" % (t + 1), size=12, anchor="middle", weight=600)
    s.text(24, 182, "Operations of T1, T2, T3 are", size=13, color=MUTED)
    s.text(24, 202, "interleaved in time.", size=13, color=MUTED)
    s.text(24, 286, "3! = 6 possible serial orders; any one of them is acceptable.", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c5-serial-orders.svg"))


def two_pl():
    s = Svg(W, 300, "Two-phase locking")
    x0, y0, w, h = 70, 60, 490, 170
    s.line(x0, y0 + h, x0 + w, y0 + h, color=LINE)
    s.line(x0, y0, x0, y0 + h, color=LINE)
    s.text(x0 + w / 2, y0 + h + 30, "time →", size=12, color=MUTED, anchor="middle")
    s.items.append('<text x="30" y="%d" font-family="%s" font-size="12" fill="%s" text-anchor="middle" transform="rotate(-90 30 %d)">locks held</text>' % (y0 + h / 2, FONT, MUTED, y0 + h / 2))
    pts = [(x0, y0 + h), (x0 + 60, y0 + h - 40), (x0 + 120, y0 + h - 40), (x0 + 170, y0 + h - 90), (x0 + 230, y0 + h - 140),
           (x0 + 260, y0 + h - 140), (x0 + 330, y0 + h - 90), (x0 + 400, y0 + h - 40), (x0 + 440, y0 + h)]
    d = "M %d %d" % pts[0]
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        d += " L %d %d L %d %d" % (xb, ya, xb, yb)
    s.path(d, color=INDIGO, sw=3)
    s.line(x0 + 245, y0 - 4, x0 + 245, y0 + h, color=AMBER, dash="5 4")
    s.text(x0 + 110, y0 + 20, "growing: only acquire", size=13, color=GREEN, anchor="middle")
    s.text(x0 + 360, y0 + 20, "shrinking: only release", size=13, color=ROSE, anchor="middle")
    s.text(x0 + 245, y0 + h + 48, "lock point", size=12, color=AMBER, anchor="middle")
    s.text(24, 292, "Strict 2PL holds exclusive locks until COMMIT/ROLLBACK.", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c5-2pl.svg"))


def deadlock():
    s = Svg(W, 260, "Deadlock: a cycle in the waits-for graph")
    s.box(60, 90, 130, 56, "T1", color=SKY, sub="holds row A", size=16)
    s.box(410, 90, 130, 56, "T2", color=AMBER, sub="holds row B", size=16)
    s.path("M 190 104 C 280 70, 320 70, 408 104", color=ROSE, sw=2.4)
    s._head(380, 92, 408, 104, ROSE, 9)
    s.text(300, 70, "T1 waits for B", size=13, color=ROSE, anchor="middle")
    s.path("M 410 134 C 320 170, 280 170, 192 134", color=ROSE, sw=2.4)
    s._head(220, 146, 192, 134, ROSE, 9)
    s.text(300, 186, "T2 waits for A", size=13, color=ROSE, anchor="middle")
    s.text(24, 232, "The database detects the cycle and aborts one transaction (the victim).", size=13, color=MUTED)
    s.save(os.path.join(OUT, "c5-deadlock.svg"))


def crabbing():
    s = Svg(W, 300, "Latch crabbing on insert")
    steps = [("a", ["root"], [True]), ("b", ["root", "inner"], [False, True]), ("c", ["root", "inner", "leaf"], [False, False, True])]
    for col, (lab, nodes, held) in enumerate(steps):
        ox = 40 + col * 190
        s.text(ox, 64, "(%s)" % lab, size=14, weight=700)
        for k, name in enumerate(nodes):
            y = 80 + k * 64
            color = AMBER if held[k] else MUTED
            s.box(ox, y, 120, 40, name, color=color, size=13, sub="W-latch" if held[k] else "released", sub_size=11)
            if k:
                s.line(ox + 60, y - 24, ox + 60, y, color=LINE)
    s.lines(24, 270, ["Each child is not full, so a split can't reach the parent:", "release the parent as soon as the child is latched."], size=12, color=MUTED, gap=17)
    s.save(os.path.join(OUT, "c5-crabbing.svg"))


def blink():
    s = Svg(W, 280, "B-link tree half-split")
    s.cells(220, 64, ["10", "40"], cw=44, h=30, color=SKY)
    s.text(220 + 88 + 10, 84, "parent: no pointer to N' yet", size=12, color=MUTED)
    s.cells(80, 150, ["10", "20", "HK 30"], cw=56, h=30, color=GREEN, fills={2: tint(AMBER, 0.45)})
    s.cells(330, 150, ["30", "35", "HK 40"], cw=56, h=30, color=GREEN, fills={2: tint(AMBER, 0.45)})
    s.text(80, 140, "N (split)", size=12, color=MUTED)
    s.text(330, 140, "N' (new)", size=12, color=AMBER)
    s.arrow(242, 94, 140, 148, color=MUTED, sw=1.3, head=7)
    s.arrow(248 + 1, 165, 328, 165, color=AMBER, sw=2.4, head=8)
    s.text(258, 192, "right-link", size=12, color=AMBER)
    s.lines(24, 226, ["Search 35 lands on N: 35 > high key 30, so the node split.", "Follow the right-link to N' — no restart, no parent latch."], size=13, color=MUTED, gap=20)
    s.save(os.path.join(OUT, "c5-blink.svg"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    page_cache()
    clock()
    wal()
    aries()
    serial_orders()
    two_pl()
    deadlock()
    crabbing()
    blink()
