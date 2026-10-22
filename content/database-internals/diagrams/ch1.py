import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from svg import *  # noqa

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "img")
W = 600


def architecture():
    s = Svg(W, 520, "Inside a database management system")
    s.box(200, 52, 200, 34, "Client / application", color=MUTED, size=14)
    s.arrow(300, 86, 300, 104, color=MUTED)
    layers = [
        (106, "Transport", "clients + other cluster nodes", SKY),
        (172, "Query processor", "parse → validate → optimize", VIOLET),
        (238, "Execution engine", "runs the plan, local + remote", AMBER),
    ]
    for y, name, sub, c in layers:
        s.rect(24, y, W - 48, 48, fill=tint(c), stroke=c)
        s.text(42, y + 30, name, size=16, weight=700)
        s.text(W - 42, y + 30, sub, size=14, color=MUTED, anchor="end")
        s.arrow(300, y + 48, 300, y + 64)
    s.text(316, 230, "execution plan", size=12, color=MUTED)
    s.rect(24, 304, W - 48, 196, fill=tint(GREEN, 0.10), stroke=GREEN)
    s.text(42, 332, "Storage engine", size=16, weight=700)
    comps = [("Transaction mgr", GREEN), ("Lock manager", GREEN), ("Access methods", GREEN),
             ("Buffer manager", GREEN), ("Recovery manager", GREEN)]
    for k, (a, c) in enumerate(comps):
        col, row = k % 3, k // 3
        s.box(42 + col * 176, 348 + row * 56, 164, 42, a, color=c, size=14)
    s.rect(42, 348, 340, 42, fill="none", stroke=AMBER, dash="5 4", rx=8, sw=2)
    s.text(42, 470, "dashed = concurrency control", size=12, color=AMBER)
    s.text(394, 426, "B-Tree, LSM, heap", size=12, color=MUTED)
    s.text(42, 490, "works on: data files, index files, log, page cache", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c1-architecture.svg"))


def latency():
    s = Svg(W, 330, "Access latency (log scale)")
    items = [("CPU cache", 1, SKY), ("RAM", 100, INDIGO), ("NVMe SSD", 20000, GREEN),
             ("SATA SSD", 100000, AMBER), ("HDD seek", 10000000, ROSE)]
    x0, y0, w = 130, 58, 440
    lo, hi = 0, 8

    def xpos(v):
        return x0 + (math.log10(v) - lo) / (hi - lo) * w

    labels = {0: "1ns", 2: "100ns", 4: "10µs", 6: "1ms", 8: "100ms"}
    h = 5 * 42
    for e in range(lo, hi + 1):
        px = x0 + (e - lo) / (hi - lo) * w
        s.line(px, y0 - 4, px, y0 + h, color=GRID, sw=1)
        if e in labels:
            s.text(px, y0 + h + 20, labels[e], size=13, color=MUTED, anchor="middle")
    for k, (name, ns, color) in enumerate(items):
        y = y0 + 6 + k * 42
        s.text(x0 - 12, y + 21, name, size=15, anchor="end")
        bw = max(6, xpos(ns) - x0)
        s.rect(x0, y, bw, 30, fill=tint(color, 0.35), stroke=color, rx=4)
        human = "%d ns" % ns if ns < 1000 else ("%d µs" % (ns / 1000) if ns < 1000000 else "%d ms" % (ns / 1000000))
        tx = xpos(ns) + 8
        if tx > W - 70:
            s.text(xpos(ns) - 8, y + 21, "~" + human, size=14, weight=600, anchor="end")
        else:
            s.text(tx, y + 21, "~" + human, size=14, color=MUTED)
    s.text(x0, y0 + h + 46, "each grid line = 10× slower (rough, hardware dependent)", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c1-latency.svg"))


def row_column():
    s = Svg(W, 400, "One table, two physical layouts")
    rows = [("10", "John", "1981"), ("20", "Sam", "1988"), ("30", "Keith", "1984")]
    colors = [SKY, VIOLET, AMBER]
    heads = ["ID", "Name", "Born"]
    cw = 70
    x0 = (W - 3 * cw) / 2
    for c, hd in enumerate(heads):
        s.rect(x0 + c * cw, 54, cw, 28, fill=tint(colors[c], 0.35), stroke=colors[c], rx=0)
        s.text(x0 + c * cw + cw / 2, 73, hd, size=14, weight=700, anchor="middle")
    for r, row in enumerate(rows):
        for c, v in enumerate(row):
            s.rect(x0 + c * cw, 82 + r * 28, cw, 28, fill=tint(colors[c], 0.12), stroke=colors[c], rx=0)
            s.text(x0 + c * cw + cw / 2, 101 + r * 28, v, size=14, anchor="middle")

    def strip(y, title, seq, note):
        s.text(24, y - 10, title, size=15, weight=700)
        bw = (W - 48) / 9
        for k, (v, c) in enumerate(seq):
            s.rect(24 + k * bw, y, bw, 32, fill=tint(colors[c], 0.3), stroke=colors[c], rx=0)
            s.text(24 + k * bw + bw / 2, y + 21, v, size=13, anchor="middle")
        s.text(24, y + 54, note, size=13, color=MUTED)

    strip(212, "Row store: one record after another", [(v, c) for row in rows for c, v in enumerate(row)],
          "a page read returns whole records → OLTP")
    strip(314, "Column store: one column after another", [(rows[r][c], c) for c in range(3) for r in range(3)],
          "a query on Born reads only that column → OLAP")
    s.save(os.path.join(OUT, "c1-row-column.svg"))


def indirection():
    s = Svg(W, 400, "How a secondary index reaches the row")
    s.text(24, 70, "(a) Direct pointer: PostgreSQL, Oracle", size=15, weight=700, color=SKY)
    s.box(24, 84, 210, 46, "Secondary index", color=VIOLET, sub="email → page 7, slot 3", size=14, sub_size=12)
    s.box(24, 140, 210, 46, "Primary key index", color=INDIGO, sub="id → page 7, slot 3", size=14, sub_size=12)
    s.box(330, 104, 150, 62, "Heap table", color=GREEN, sub="row at 7:3", size=15, sub_size=12)
    s.arrow(234, 107, 328, 126, color=VIOLET)
    s.arrow(234, 163, 328, 146, color=INDIGO)
    s.text(500, 130, "1 lookup", size=13, color=GREEN)
    s.line(24, 214, W - 24, 214, color=GRID)
    s.text(24, 246, "(b) Primary key as pointer: MySQL InnoDB", size=15, weight=700, color=SKY)
    s.box(24, 262, 210, 46, "Secondary index", color=VIOLET, sub="email → id 42", size=14, sub_size=12)
    s.box(310, 262, 266, 46, "Clustered primary key index", color=INDIGO, sub="id 42 → whole row in the leaf", size=14, sub_size=12)
    s.arrow(234, 285, 308, 285, color=VIOLET)
    s.text(24, 344, "2 lookups per secondary-index read,", size=13, color=MUTED)
    s.text(24, 364, "but rows can move without touching secondary indexes", size=13, color=MUTED)
    s.save(os.path.join(OUT, "c1-indirection.svg"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    architecture()
    latency()
    row_column()
    indirection()
