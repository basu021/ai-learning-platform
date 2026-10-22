import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from svg import *  # noqa

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "img")
W = 600


def lsm():
    s = Svg(W, 380, "LSM Tree write path")
    s.box(24, 56, 130, 40, "write", color=SKY, sub="put / delete", size=14)
    s.box(200, 56, 160, 40, "WAL (append)", color=AMBER, sub="durability", size=14)
    s.box(200, 116, 160, 44, "memtable", color=VIOLET, sub="sorted, in memory", size=14)
    s.arrow(154, 70, 198, 70, color=MUTED)
    s.arrow(154, 84, 198, 132, color=MUTED)
    s.box(410, 116, 166, 44, "flushing memtable", color=VIOLET, sub="read-only", size=13)
    s.arrow(360, 138, 408, 138, color=MUTED)
    s.text(370, 112, "switch", size=11, color=MUTED)
    s.line(24, 180, W - 24, 180, color=GRID, dash="5 4")
    s.text(24, 198, "memory ↑   disk ↓", size=12, color=MUTED)
    s.arrow(493, 160, 493, 214, color=GREEN, sw=2)
    s.text(500, 196, "flush (sequential)", size=11, color=GREEN)
    levels = [("L0", [(360, 70), (440, 70), (520, 56)], SKY), ("L1", [(200, 120), (330, 120), (460, 116)], VIOLET),
              ("L2 (largest)", [(130, 150), (288, 150), (446, 130)], GREEN)]
    for k, (name, tabs, c) in enumerate(levels):
        y = 220 + k * 50
        s.text(24, y + 22, name, size=14, weight=700, color=c)
        for x, wdt in tabs:
            s.rect(x, y, wdt - 6, 32, fill=tint(c), stroke=c, rx=4)
            s.text(x + (wdt - 6) / 2, y + 21, "SSTable", size=11, anchor="middle")
    s.text(24, 368, "compaction merges tables downward; sizes grow per level", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c7-lsm.svg"))


def two_component():
    s = Svg(W, 300, "Two-component LSM Tree flush")
    s.text(24, 64, "memory tree", size=13, weight=700, color=VIOLET)
    s.cells(24, 76, ["a", "f", "m", "t"], cw=40, h=28, color=VIOLET, fills={1: tint(AMBER, 0.45), 2: tint(AMBER, 0.45)})
    s.text(24, 136, "disk tree (100% full, read-only pages)", size=13, weight=700, color=GREEN)
    for k in range(6):
        hl = k in (2, 3)
        s.rect(24 + k * 64, 148, 58, 30, fill=tint(AMBER, 0.45) if hl else tint(GREEN), stroke=AMBER if hl else GREEN, rx=3, dash="4 3" if hl else None)
    s.arrow(124, 104, 170, 146, color=AMBER, sw=1.6)
    s.box(420, 140, 156, 44, "merged segment", color=AMBER, sub="written to a new place", size=13)
    s.arrow(282, 163, 418, 163, color=AMBER, sw=2)
    s.lines(24, 220, ["Each flush merges a memory subtree with the matching disk", "subtree and writes the result elsewhere (amber).",
                      "Old pieces (dashed) are discarded atomically.", "Frequent merges → high write amplification."], size=12, color=MUTED, gap=18)
    s.save(os.path.join(OUT, "c7-two-component.svg"))


def merge():
    s = Svg(W, 320, "Merge-iteration with a priority queue")
    s.text(24, 64, "iterator 1", size=13, weight=700, color=SKY)
    s.cells(24, 76, ["k2:v1", "k4:v2"], cw=74, h=30, color=SKY, size=12)
    s.text(24, 136, "iterator 2", size=13, weight=700, color=VIOLET)
    s.cells(24, 148, ["k1:v3", "k2:v4", "k3:v5"], cw=74, h=30, color=VIOLET, size=12)
    s.rect(290, 96, 120, 80, fill=tint(AMBER), stroke=AMBER)
    s.text(350, 92, "min-heap", size=12, color=AMBER, anchor="middle")
    s.text(350, 128, "k1:v3", size=13, anchor="middle", mono=True)
    s.text(350, 150, "k2:v1", size=13, anchor="middle", mono=True)
    s.arrow(172, 91, 288, 120, color=MUTED, sw=1.3, head=7)
    s.arrow(98, 178, 288, 150, color=MUTED, sw=1.3, head=7)
    s.arrow(410, 136, 450, 136, color=GREEN, sw=2)
    s.text(456, 120, "output", size=12, color=GREEN)
    s.cells(456, 128, ["k1"], cw=40, h=28, color=GREEN)
    s.text(24, 228, "result: k1:v3 · k2:(newest of v1, v4) · k3:v5 · k4:v2", size=13, color=TEXT, mono=False)
    s.text(24, 254, "Take the smallest head, refill from the same iterator, repeat.", size=12, color=MUTED)
    s.text(24, 274, "Equal keys meet in the queue → reconcile them there.", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c7-merge.svg"))


def leveled():
    s = Svg(W, 330, "Leveled compaction")
    rows = [("L0", 4, 74, SKY, "flushed tables; ranges may overlap"), ("L1", 4, 100, VIOLET, "no overlap"),
            ("L2", 6, 70, GREEN, "≈10× L1"), ("L3", 9, 50, AMBER, "≈10× L2 · bottommost")]
    for k, (name, n, wdt, c, note) in enumerate(rows):
        y = 60 + k * 60
        s.text(24, y + 22, name, size=15, weight=700, color=c)
        for i in range(n):
            x = 70 + i * (wdt + 6) if name != "L0" else 70 + i * 50
            hl = (name == "L1" and i == 1) or (name == "L2" and i in (1, 2))
            s.rect(x, y, wdt, 32, fill=tint(c, 0.45 if hl else 0.18), stroke=c, rx=3, dash="4 3" if hl else None)
        s.text(W - 24, y + 48, note, size=11, color=MUTED, anchor="end")
    s.arrow(226, 152, 196, 178, color=AMBER, sw=2)
    s.text(24, 316, "Dashed: an L1 table merges with the overlapping L2 tables → new L2 tables.", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c7-leveled.svg"))


def tiered():
    s = Svg(W, 300, "Size-tiered compaction")
    tiers = [(["s", "s", "s", "s"], 50, SKY), (["m", "m", "m"], 100, VIOLET), (["L"], 220, GREEN)]
    for k, (tabs, wdt, c) in enumerate(tiers):
        y = 64 + k * 64
        s.text(24, y + 22, "tier %d" % k, size=14, weight=700, color=c)
        for i, _ in enumerate(tabs):
            s.rect(100 + i * (wdt + 8), y, wdt, 32, fill=tint(c), stroke=c, rx=4)
    s.arrow(200, 98, 140, 126, color=AMBER, sw=2)
    s.text(340, 84, "4 similar tables → 1 bigger", size=12, color=AMBER)
    s.arrow(220, 162, 200, 190, color=AMBER, sw=2)
    s.text(24, 270, "Low write amplification; a big merge needs free space ≈ its inputs.", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c7-tiered.svg"))


def amplification():
    s = Svg(W, 330, "Where each design pays (qualitative)")
    cats = ["Read amp.", "Write amp.", "Space amp."]
    series = [("B-Tree", [1, 2, 2], SKY), ("LSM leveled", [2, 3, 1], VIOLET), ("LSM size-tiered", [3, 1, 3], AMBER)]
    x0, y0, h = 90, 70, 180
    gw = 160
    for c_i, cat in enumerate(cats):
        gx = x0 + c_i * gw
        s.text(gx + 60, y0 + h + 24, cat, size=13, anchor="middle")
        for s_i, (name, vals, color) in enumerate(series):
            v = vals[c_i]
            bh = v / 3 * h
            s.rect(gx + s_i * 40, y0 + h - bh, 34, bh, fill=tint(color, 0.45), stroke=color, rx=3)
    for lvl, lab in [(1, "low"), (2, "medium"), (3, "high")]:
        y = y0 + h - lvl / 3 * h
        s.line(x0 - 6, y, W - 24, y, color=GRID, sw=1)
        s.text(x0 - 10, y + 4, lab, size=11, color=MUTED, anchor="end")
    s.legend(x0, 300, [(SKY, "B-Tree")], size=12)
    s.legend(x0 + 130, 300, [(VIOLET, "LSM leveled")], size=12)
    s.legend(x0 + 290, 300, [(AMBER, "LSM size-tiered")], size=12)
    s.save(os.path.join(OUT, "c7-amplification.svg"))


def rum():
    s = Svg(W, 320, "RUM conjecture")
    A, B, C = (300, 66), (90, 280), (510, 280)
    s.path("M %d %d L %d %d L %d %d Z" % (A + B + C), color=LINE, sw=2, fill=tint(INDIGO, 0.08))
    s.text(300, 56, "Read-optimized", size=14, weight=700, color=SKY, anchor="middle")
    s.text(90, 304, "Update-optimized", size=14, weight=700, color=AMBER, anchor="middle")
    s.text(510, 304, "Memory-optimized", size=14, weight=700, color=GREEN, anchor="middle")
    pts = [("B-Tree", 270, 120, SKY), ("hash index", 340, 110, SKY), ("LSM Tree", 170, 230, AMBER), ("compressed /", 440, 236, GREEN), ("sparse index", 440, 252, GREEN)]
    for lab, x, y, c in pts:
        s.text(x, y, lab, size=13, anchor="middle", color=TEXT)
    s.circle(300, 200, 5, fill=MUTED, stroke=MUTED)
    s.text(300, 186, "ideal: impossible", size=11, color=MUTED, anchor="middle")
    s.save(os.path.join(OUT, "c7-rum.svg"))


def bloom():
    s = Svg(W, 300, "Bloom filter: 16 bits, 3 hash functions")
    setbits = {3, 5, 10, 8, 14}
    cw = 33
    x0 = 36
    for i in range(16):
        on = i in setbits
        s.rect(x0 + i * cw, 120, cw - 2, 34, fill=tint(GREEN, 0.5) if on else PANEL, stroke=GREEN if on else LINE, rx=2)
        s.text(x0 + i * cw + cw / 2 - 1, 142, "1" if on else "0", size=14, anchor="middle", mono=True, weight=700 if on else 400)
        s.text(x0 + i * cw + cw / 2 - 1, 170, str(i), size=10, color=MUTED, anchor="middle")
    def arrows(label, bits, y, color, xlab):
        s.text(xlab, y, label, size=13, weight=700, color=color, anchor="middle")
        for b in bits:
            s.arrow(xlab, y + 6 if y < 120 else y - 16, x0 + b * cw + cw / 2, 118 if y < 120 else 158, color=color, sw=1.3, head=6)
    arrows("key1 → 3, 5, 10", [3, 5, 10], 70, SKY, 150)
    arrows("key2 → 5, 8, 14", [5, 8, 14], 70, VIOLET, 430)
    arrows("key3 → 3, 10, 14", [3, 10, 14], 218, AMBER, 200)
    arrows("key4 → 5, 9, 15", [5, 9, 15], 218, ROSE, 460)
    s.text(200, 246, "all set → maybe (false positive)", size=12, color=AMBER, anchor="middle")
    s.text(460, 246, "bit 9 is 0 → definitely not", size=12, color=ROSE, anchor="middle")
    s.save(os.path.join(OUT, "c7-bloom.svg"))


def bloom_fp():
    s = Svg(W, 320, "Bloom filter false positives")
    x0, y0, w, h = 84, 60, 470, 190
    lo, hi = -5, 0

    def xpos(b):
        return x0 + (b - 2) / 18 * w

    def ypos(p):
        return y0 + h - (math.log10(p) - lo) / (hi - lo) * h

    axes(s, x0, y0, w, h, "bits per key", "false-positive rate", [2, 5, 10, 15, 20], [1, 0.1, 0.01, 0.001, 0.0001, 0.00001],
         xfmt=str, yfmt=lambda p: {1: "100%", 0.1: "10%", 0.01: "1%", 0.001: "0.1%", 0.0001: "0.01%", 0.00001: "0.001%"}[p],
         xpos=xpos, ypos=ypos)
    pts = []
    for i in range(0, 37):
        b = 2 + i * 0.5
        k = max(1, round(b * math.log(2)))
        p = (1 - math.exp(-k / b)) ** k
        pts.append((xpos(b), ypos(p)))
    polyline(s, pts, GREEN, dots=False)
    b, p = 10, 0.0082
    s.circle(xpos(b), ypos(p), 5, fill=AMBER, stroke=AMBER)
    s.text(xpos(b) + 10, ypos(p) - 8, "10 bits ≈ 0.8%", size=13, color=AMBER)
    s.save(os.path.join(OUT, "c7-bloom-fp.svg"))


def skiplist():
    s = Svg(W, 300, "Skiplist: searching for 7")
    keys = [None, 2, 3, 5, 7, 10, 12, 15]
    heights = {None: 3, 2: 1, 3: 1, 5: 2, 7: 1, 10: 3, 12: 1, 15: 2}
    cw = 66
    x0 = 30
    ybase = 230
    lh = 52
    for i, k in enumerate(keys):
        x = x0 + i * cw
        for lvl in range(heights[k]):
            y = ybase - lvl * lh
            s.rect(x, y, 48, 30, fill=tint(SKY if k is not None else MUTED, 0.3), stroke=SKY if k is not None else MUTED, rx=3)
            s.text(x + 24, y + 20, "head" if k is None else str(k), size=12, anchor="middle", weight=600)
    # links per level
    for lvl in range(3):
        prev = None
        for i, k in enumerate(keys):
            if heights[k] > lvl:
                if prev is not None:
                    y = ybase - lvl * lh + 15
                    s.arrow(x0 + prev * cw + 48, y, x0 + i * cw - 2, y, color=LINE, sw=1.2, head=6)
                prev = i
    # search path
    path = [(0, 2), (0, 1), (3, 1), (3, 0), (4, 0)]
    pts = [(x0 + i * cw + 24, ybase - l * lh + 15) for i, l in path]
    s.path("M " + " L ".join("%d %d" % p for p in pts), color=AMBER, sw=3, dash="6 4")
    s.text(24, 286, "head(L2) → 10 too big ↓ → 5 → 10 too big ↓ → 7 found", size=13, color=AMBER)
    s.save(os.path.join(OUT, "c7-skiplist.svg"))


def compression():
    s = Svg(W, 280, "Compressed blocks need an offset map")
    s.text(24, 64, "uncompressed blocks (fixed size)", size=13, weight=700, color=SKY)
    for i in range(4):
        s.rect(24 + i * 140, 76, 132, 34, fill=tint(SKY), stroke=SKY, rx=3)
        s.text(90 + i * 140, 98, "block %d" % i, size=13, anchor="middle")
    s.text(24, 160, "on disk (compressed, variable size)", size=13, weight=700, color=GREEN)
    sizes = [70, 110, 54, 90]
    x = 24
    for i, wdt in enumerate(sizes):
        s.rect(x, 172, wdt, 34, fill=tint(GREEN), stroke=GREEN, rx=3)
        s.text(x + wdt / 2, 194, "c%d" % i, size=13, anchor="middle")
        s.arrow(90 + i * 140, 112, x + wdt / 2, 170, color=MUTED, dash="4 3", sw=1.2, head=6)
        x += wdt + 2
    s.rect(x + 20, 172, 150, 34, fill=tint(AMBER), stroke=AMBER, rx=3)
    s.text(x + 95, 194, "offset map", size=13, anchor="middle")
    s.text(24, 246, "Read block 2: look up (offset, size) of c2 → read → decompress → cache", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c7-compression.svg"))


def bitcask():
    s = Svg(W, 300, "Bitcask")
    s.text(24, 64, "keydir (in-memory hash map)", size=13, weight=700, color=AMBER)
    for k, key in enumerate(["k1", "k2", "k3"]):
        s.rect(24, 76 + k * 40, 120, 32, fill=tint(AMBER), stroke=AMBER, rx=3)
        s.text(84, 97 + k * 40, key + " → file, offset", size=12, anchor="middle")
    s.text(260, 64, "append-only log files", size=13, weight=700, color=GREEN)
    recs = [("k1:a", True), ("k2:b", False), ("k3:c", False), ("k2:d", False), ("k1:e", False), ("k2:f", False)]
    live = {"k1:e": 0, "k2:f": 1, "k3:c": 2}
    for i, (r, _) in enumerate(recs):
        x = 260 + (i % 3) * 104
        y = 76 + (i // 3) * 60
        isl = r in live
        s.rect(x, y, 96, 32, fill=tint(GREEN, 0.4) if isl else PANEL, stroke=GREEN if isl else LINE, rx=3)
        s.text(x + 48, y + 21, r, size=12, anchor="middle", color=TEXT if isl else MUTED, mono=True)
        if isl:
            s.arrow(144, 92 + live[r] * 40, x - 2, y + 16, color=AMBER, sw=1.4, head=6)
    s.text(24, 240, "Grey records are shadowed: compaction drops them.", size=12, color=MUTED)
    s.text(24, 260, "One lookup + one read per get; no range scans; all keys in RAM.", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c7-bitcask.svg"))


def wisckey():
    s = Svg(W, 300, "WiscKey: keys and values separated")
    s.text(24, 64, "key LSM Tree (sorted, small)", size=13, weight=700, color=VIOLET)
    for k, key in enumerate(["a → @12", "c → @40", "f → @7", "k → @55"]):
        s.rect(24, 76 + k * 38, 150, 30, fill=tint(VIOLET), stroke=VIOLET, rx=3)
        s.text(99, 96 + k * 38, key, size=12, anchor="middle", mono=True)
    s.text(260, 64, "value log (append-only, unordered)", size=13, weight=700, color=GREEN)
    vals = [("@7 f:…", True), ("@12 a:…", True), ("@20 c:…", False), ("@40 c:…", True), ("@48 a:…", False), ("@55 k:…", True)]
    for i, (v, live) in enumerate(vals):
        x = 260 + (i % 3) * 104
        y = 76 + (i // 3) * 60
        s.rect(x, y, 96, 32, fill=tint(GREEN, 0.4) if live else PANEL, stroke=GREEN if live else LINE, rx=3)
        s.text(x + 48, y + 21, v, size=12, anchor="middle", mono=True, color=TEXT if live else MUTED)
    links = [(0, 1), (1, 3), (2, 0), (3, 5)]
    for ki, vi in links:
        x = 260 + (vi % 3) * 104
        y = 76 + (vi // 3) * 60
        s.arrow(174, 91 + ki * 38, x - 2, y + 16, color=AMBER, sw=1.3, head=6)
    s.text(24, 250, "Compaction moves only small keys; range scans read values randomly.", size=12, color=MUTED)
    s.text(24, 270, "Grey values are stale: vLog GC checks the key tree to find live ones.", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c7-wisckey.svg"))


def ftl():
    s = Svg(W, 300, "SSD garbage collection")
    def block(x, y, states, title):
        s.text(x, y - 8, title, size=13, weight=700)
        colors = {"live": GREEN, "dead": ROSE, "free": LINE}
        for i, st in enumerate(states):
            c = colors[st]
            s.rect(x + (i % 4) * 46, y + (i // 4) * 40, 40, 32, fill=tint(c, 0.4) if st != "free" else "none", stroke=c, rx=3, dash="4 3" if st == "free" else None)
            s.text(x + (i % 4) * 46 + 20, y + (i // 4) * 40 + 21, st, size=10, anchor="middle", color=MUTED if st == "free" else TEXT)
    block(24, 80, ["live", "dead", "dead", "live", "dead", "dead", "live", "dead"], "block A (mostly dead)")
    block(330, 80, ["live", "live", "free", "free", "free", "free", "free", "free"], "block B (has free pages)")
    s.arrow(210, 130, 326, 112, color=AMBER, sw=2)
    s.text(232, 108, "copy live", size=12, color=AMBER)
    s.lines(24, 210, ["1  copy block A's live pages into free pages of block B", "2  remap their logical addresses", "3  erase block A → all its pages free again"], size=13, color=MUTED, gap=20)
    s.save(os.path.join(OUT, "c7-ftl.svg"))


def stacking():
    s = Svg(W, 270, "Logs on top of logs")
    s.text(24, 64, "database log segments", size=13, weight=700, color=VIOLET)
    xs = [(24, 150), (176, 120), (298, 170), (470, 106)]
    for i, (x, wdt) in enumerate(xs):
        hl = i == 1
        s.rect(x, 76, wdt - 2, 34, fill=tint(ROSE, 0.4) if hl else tint(VIOLET), stroke=ROSE if hl else VIOLET, rx=3)
        s.text(x + wdt / 2, 98, "deleted" if hl else "seg %d" % (i + 1), size=12, anchor="middle")
    s.text(24, 150, "filesystem / FTL segments", size=13, weight=700, color=GREEN)
    for i in range(4):
        x = 24 + i * 138
        hl = i in (1, 2)
        s.rect(x, 162, 136, 34, fill=tint(AMBER, 0.35) if hl else tint(GREEN), stroke=AMBER if hl else GREEN, rx=3)
        s.text(x + 68, 184, "partly garbage" if hl else "segment", size=12, anchor="middle")
    s.line(176, 112, 176, 160, color=ROSE, dash="4 3")
    s.line(296, 112, 296, 160, color=ROSE, dash="4 3")
    s.text(24, 236, "One deleted database segment spans two lower segments:", size=12, color=MUTED)
    s.text(24, 254, "both must be cleaned up and relocated by the lower layer.", size=12, color=MUTED)
    s.save(os.path.join(OUT, "c7-stacking.svg"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for f in (lsm, two_component, merge, leveled, tiered, amplification, rum, bloom, bloom_fp, skiplist, compression, bitcask, wisckey, ftl, stacking):
        f()
