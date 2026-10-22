"""Tiny SVG drawing kit for dark-theme diagrams (rendered to PNG later)."""
import html
import math

BG = "#0f172a"
PANEL = "#111c33"
TEXT = "#e2e8f0"
MUTED = "#94a3b8"
GRID = "#1e293b"
LINE = "#475569"
INDIGO = "#818cf8"
AMBER = "#fbbf24"
GREEN = "#34d399"
ROSE = "#fb7185"
SKY = "#38bdf8"
VIOLET = "#c084fc"

FONT = "DejaVu Sans, Liberation Sans, Arial, sans-serif"
MONO = "DejaVu Sans Mono, Liberation Mono, monospace"


def esc(s):
    return html.escape(str(s))


class Svg:
    def __init__(self, w, h, title=None):
        self.w, self.h = w, h
        self.items = []
        self.items.append('<rect x="0" y="0" width="%d" height="%d" rx="14" fill="%s"/>' % (w, h, BG))
        if title:
            self.text(24, 34, title, size=18, weight=700, color=TEXT)

    # ------------------------------------------------------------ primitives
    def text(self, x, y, s, size=13, color=TEXT, weight=400, anchor="start", mono=False, italic=False):
        self.items.append(
            '<text x="%s" y="%s" font-family="%s" font-size="%s" font-weight="%s" fill="%s" text-anchor="%s"%s>%s</text>'
            % (x, y, MONO if mono else FONT, size, weight, color, anchor, ' font-style="italic"' if italic else "", esc(s))
        )

    def lines(self, x, y, rows, size=13, color=TEXT, gap=None, anchor="start", mono=False, weight=400):
        gap = gap or size * 1.35
        for k, r in enumerate(rows):
            self.text(x, y + k * gap, r, size=size, color=color, anchor=anchor, mono=mono, weight=weight)

    def rect(self, x, y, w, h, fill=PANEL, stroke=LINE, rx=8, sw=1.5, dash=None, opacity=1):
        self.items.append(
            '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s" stroke="%s" stroke-width="%s"%s opacity="%s"/>'
            % (x, y, w, h, rx, fill, stroke, sw, ' stroke-dasharray="%s"' % dash if dash else "", opacity)
        )

    def box(self, x, y, w, h, label, color=INDIGO, sub=None, size=14, fill=None, mono=False, sub_size=11):
        self.rect(x, y, w, h, fill=fill or tint(color), stroke=color)
        if sub:
            self.text(x + w / 2, y + h / 2 - 3, label, size=size, weight=600, anchor="middle", mono=mono)
            self.text(x + w / 2, y + h / 2 + 14, sub, size=sub_size, color=MUTED, anchor="middle")
        else:
            self.text(x + w / 2, y + h / 2 + size * 0.35, label, size=size, weight=600, anchor="middle", mono=mono)

    def line(self, x1, y1, x2, y2, color=LINE, sw=1.5, dash=None):
        self.items.append(
            '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s/>'
            % (x1, y1, x2, y2, color, sw, ' stroke-dasharray="%s"' % dash if dash else "")
        )

    def arrow(self, x1, y1, x2, y2, color=MUTED, sw=1.6, dash=None, head=8, both=False):
        self.line(x1, y1, x2, y2, color, sw, dash)
        self._head(x1, y1, x2, y2, color, head)
        if both:
            self._head(x2, y2, x1, y1, color, head)

    def _head(self, x1, y1, x2, y2, color, head):
        a = math.atan2(y2 - y1, x2 - x1)
        p1 = (x2 - head * math.cos(a - 0.4), y2 - head * math.sin(a - 0.4))
        p2 = (x2 - head * math.cos(a + 0.4), y2 - head * math.sin(a + 0.4))
        self.items.append('<polygon points="%s,%s %s,%s %s,%s" fill="%s"/>' % (x2, y2, p1[0], p1[1], p2[0], p2[1], color))

    def path(self, d, color=LINE, sw=1.5, fill="none", dash=None):
        self.items.append(
            '<path d="%s" stroke="%s" stroke-width="%s" fill="%s"%s/>' % (d, color, sw, fill, ' stroke-dasharray="%s"' % dash if dash else "")
        )

    def circle(self, cx, cy, r, fill=PANEL, stroke=INDIGO, sw=1.5):
        self.items.append('<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (cx, cy, r, fill, stroke, sw))

    def node(self, cx, cy, label, color=INDIGO, r=18, size=13):
        self.circle(cx, cy, r, fill=tint(color), stroke=color)
        self.text(cx, cy + size * 0.35, label, size=size, weight=600, anchor="middle")

    def cells(self, x, y, labels, cw=34, h=30, color=INDIGO, fills=None, size=13, mono=True, gap=0):
        """A row of equal cells, e.g. keys in a B-tree node."""
        for k, lab in enumerate(labels):
            fx = x + k * (cw + gap)
            f = (fills or {}).get(k)
            self.rect(fx, y, cw, h, fill=f or tint(color), stroke=color, rx=3)
            self.text(fx + cw / 2, y + h / 2 + size * 0.35, lab, size=size, anchor="middle", mono=mono, weight=600)
        return x + len(labels) * (cw + gap) - gap

    def legend(self, x, y, entries, size=12):
        for k, (color, label) in enumerate(entries):
            self.rect(x, y + k * 20 - 10, 12, 12, fill=tint(color), stroke=color, rx=2)
            self.text(x + 18, y + k * 20, label, size=size, color=MUTED)

    def raw(self, s):
        self.items.append(s)

    def save(self, path):
        with open(path, "w") as f:
            f.write(
                '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">%s</svg>'
                % (self.w, self.h, self.w, self.h, "".join(self.items))
            )


def tint(color, alpha=0.16):
    c = color.lstrip("#")
    r, g, b = int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
    return "rgba(%d,%d,%d,%s)" % (r, g, b, alpha)


# ---------------------------------------------------------------- charts
def axes(s, x, y, w, h, xlabel, ylabel, xticks, yticks, xfmt=str, yfmt=str, xpos=None, ypos=None):
    """Draws axes; xpos/ypos map a value to a pixel. Returns nothing."""
    s.line(x, y + h, x + w, y + h, color=LINE)
    s.line(x, y, x, y + h, color=LINE)
    for v in yticks:
        py = ypos(v)
        s.line(x, py, x + w, py, color=GRID, sw=1)
        s.text(x - 8, py + 4, yfmt(v), size=11, color=MUTED, anchor="end")
    for v in xticks:
        px = xpos(v)
        s.line(px, y + h, px, y + h + 5, color=LINE, sw=1)
        s.text(px, y + h + 20, xfmt(v), size=11, color=MUTED, anchor="middle")
    s.text(x + w / 2, y + h + 42, xlabel, size=12, color=MUTED, anchor="middle")
    s.items.append(
        '<text x="%s" y="%s" font-family="%s" font-size="12" fill="%s" text-anchor="middle" transform="rotate(-90 %s %s)">%s</text>'
        % (x - 48, y + h / 2, FONT, MUTED, x - 48, y + h / 2, esc(ylabel))
    )


def polyline(s, pts, color, sw=2.5, dots=True):
    s.path("M " + " L ".join("%.1f %.1f" % p for p in pts), color=color, sw=sw)
    if dots:
        for (px, py) in pts:
            s.circle(px, py, 3.2, fill=color, stroke=color, sw=1)
