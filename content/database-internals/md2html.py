"""Small Markdown subset -> HTML in the shape the TipTap editor produces.

Blocks: ## / ### / #### headings, paragraphs, - lists, 1. lists, > quotes
(callouts), ``` code fences, | tables |, --- rules, ![alt](img:name) images.
Inline: **bold**, *italic*, `code`, ==highlight==, [text](url).
"""
import html
import re


def inline(text):
    # Code spans first, as placeholders, so **bold `code` bold** still works.
    codes = []

    def keep(m):
        codes.append("<code>" + html.escape(m.group(1), quote=False) + "</code>")
        return "\x00%d\x00" % (len(codes) - 1)

    s = re.sub(r"`([^`]+)`", keep, text)
    s = html.escape(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", s)
    s = re.sub(r"==(.+?)==", r"<mark>\1</mark>", s)
    s = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2" target="_blank" rel="noopener noreferrer nofollow">\1</a>', s)
    return re.sub(r"\x00(\d+)\x00", lambda m: codes[int(m.group(1))], s)


def para(text):
    return "<p>" + inline(text) + "</p>"


def convert(md, images):
    """`images` maps a diagram name to its uploaded URL."""
    lines = md.strip("\n").split("\n")
    out = []
    i = 0
    n = len(lines)

    def is_block_start(l):
        return (
            l.startswith("#") or l.startswith("```") or l.startswith("> ") or l == ">"
            or l.startswith("|") or re.match(r"^(-|\d+\.) ", l) or l.strip() == "---"
            or l.startswith("![")
        )

    while i < n:
        l = lines[i]
        if not l.strip():
            i += 1
            continue
        m = re.match(r"^(#{2,4}) (.*)$", l)
        if m:
            lvl = len(m.group(1))
            out.append("<h%d>%s</h%d>" % (lvl, inline(m.group(2)), lvl))
            i += 1
            continue
        if l.startswith("```"):
            lang = l[3:].strip() or "plaintext"
            body = []
            i += 1
            while i < n and not lines[i].startswith("```"):
                body.append(lines[i])
                i += 1
            i += 1
            out.append('<pre><code class="language-%s">%s</code></pre>' % (lang, html.escape("\n".join(body), quote=False)))
            continue
        if l.strip() == "---":
            out.append("<hr>")
            i += 1
            continue
        m = re.match(r"^!\[([^\]]*)\]\(img:([\w-]+)\)\s*$", l)
        if m:
            alt, name = m.group(1), m.group(2)
            if name not in images:
                raise KeyError("diagram not uploaded: " + name)
            out.append('<img src="%s" alt="%s" />' % (images[name], html.escape(alt)))
            i += 1
            continue
        if l.startswith("> ") or l == ">":
            body = []
            while i < n and (lines[i].startswith("> ") or lines[i] == ">"):
                body.append(lines[i][2:] if lines[i] != ">" else "")
                i += 1
            out.append("<blockquote>" + convert("\n".join(body), images) + "</blockquote>")
            continue
        if l.startswith("|"):
            rows = []
            while i < n and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.match(r"^:?-{2,}:?$", c) for c in cells):
                    rows.append(cells)
                i += 1
            html_rows = []
            for r_i, cells in enumerate(rows):
                tag = "th" if r_i == 0 else "td"
                html_rows.append("<tr>" + "".join("<%s><p>%s</p></%s>" % (tag, inline(c), tag) for c in cells) + "</tr>")
            out.append("<table><tbody>" + "".join(html_rows) + "</tbody></table>")
            continue
        m = re.match(r"^(-|\d+\.) ", l)
        if m:
            ordered = m.group(1) != "-"
            items = []
            while i < n and re.match(r"^(-|\d+\.) ", lines[i]):
                item = re.sub(r"^(-|\d+\.) ", "", lines[i])
                i += 1
                # Continuation lines are indented by two or more spaces.
                while i < n and lines[i].startswith("  ") and lines[i].strip():
                    item += " " + lines[i].strip()
                    i += 1
                items.append("<li>" + para(item) + "</li>")
            tag = "ol" if ordered else "ul"
            out.append("<%s>%s</%s>" % (tag, "".join(items), tag))
            continue
        body = [l]
        i += 1
        while i < n and lines[i].strip() and not is_block_start(lines[i]):
            body.append(lines[i])
            i += 1
        out.append(para(" ".join(s.strip() for s in body)))
    return "".join(out)
