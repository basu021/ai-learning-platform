"""Builds the Database Administration subject from chapters/*.md.

Each file holds nodes in order:
  @chapter Title      @topic Title      @subtopic Title
  @summary One line shown under the title
followed by the page body (Markdown subset, see md2html.py).

  python3 build.py check                 convert everything, report sizes
  python3 build.py publish               upload diagrams, replace the subject's outline

Env: API, SUBJECT_ID, JWT_SECRET, ADMIN_ID, ADMIN_EMAIL.
"""
import base64
import glob
import hashlib
import hmac
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

from md2html import convert

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "images.%s.json")


def parse():
    nodes = []
    for path in sorted(glob.glob(os.path.join(HERE, "chapters", "ch*.md"))):
        cur = None
        for line in open(path, encoding="utf-8").read().split("\n"):
            m = re.match(r"^@(chapter|topic|subtopic) (.+)$", line)
            if m:
                cur = {"type": m.group(1).upper(), "title": m.group(2).strip(), "summary": None, "body": [], "file": os.path.basename(path)}
                nodes.append(cur)
                continue
            m = re.match(r"^@summary (.+)$", line)
            if m and cur is not None and not cur["body"]:
                cur["summary"] = m.group(1).strip()
                continue
            if cur is not None:
                cur["body"].append(line)
    for n in nodes:
        n["md"] = "\n".join(n["body"]).strip()
    return nodes


def images_used(nodes):
    used = []
    for n in nodes:
        used += re.findall(r"\(img:([\w-]+)\)", n["md"])
    return used


def b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def token():
    now = int(time.time())
    head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = b64(json.dumps({"sub": os.environ["ADMIN_ID"], "email": os.environ["ADMIN_EMAIL"], "iat": now, "exp": now + 3600}).encode())
    sig = b64(hmac.new(os.environ["JWT_SECRET"].encode(), ("%s.%s" % (head, body)).encode(), hashlib.sha256).digest())
    return "%s.%s.%s" % (head, body, sig)


def call(method, path, body=None):
    req = urllib.request.Request(
        os.environ["API"] + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        raise SystemExit("%s %s -> %s %s" % (method, path, e.code, e.read().decode()[:500]))


def upload_images(names):
    """Uploads changed diagrams; returns name -> url."""
    cache_path = CACHE % hashlib.md5((os.environ["API"] + os.environ["SUBJECT_ID"]).encode()).hexdigest()[:8]
    cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
    for name in sorted(set(names)):
        png = os.path.join(HERE, "img", name + ".png")
        digest = hashlib.sha256(open(png, "rb").read()).hexdigest()
        if cache.get(name, {}).get("sha") == digest:
            continue
        out = subprocess.check_output([
            "curl", "-sf", "-H", "Authorization: Bearer " + TOKEN,
            "-F", "file=@%s;type=image/png;filename=%s.png" % (png, name),
            "%s/api/subjects/%s/attachments?inline=1" % (os.environ["API"], os.environ["SUBJECT_ID"]),
        ])
        cache[name] = {"sha": digest, "url": json.loads(out.decode())["url"]}
        print("uploaded", name)
        json.dump(cache, open(cache_path, "w"), indent=1)
    return {k: v["url"] for k, v in cache.items()}


def main():
    global TOKEN
    nodes = parse()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    missing = [n for n in set(images_used(nodes)) if not os.path.exists(os.path.join(HERE, "img", n + ".png"))]
    if missing:
        raise SystemExit("missing PNGs: " + ", ".join(sorted(missing)))
    fake = {n: "/api/attachments/x/raw?sig=y" for n in images_used(nodes)}
    for n in nodes:
        n["html"] = convert(n["md"], fake) if n["md"] else None
    counts = {}
    for n in nodes:
        counts[n["type"]] = counts.get(n["type"], 0) + 1
    print("nodes:", counts, "diagrams:", len(set(images_used(nodes))))
    if cmd == "check":
        for n in nodes:
            pad = {"CHAPTER": "", "TOPIC": "  ", "SUBTOPIC": "    "}[n["type"]]
            print("%s%s  (%d words)" % (pad, n["title"], len(re.findall(r"\w+", n["md"]))))
        return

    TOKEN = token()
    sid = os.environ["SUBJECT_ID"]
    urls = upload_images(images_used(nodes))
    for n in nodes:
        n["html"] = convert(n["md"], urls) if n["md"] else None

    meta = os.path.join(HERE, "subject.md")
    if os.path.exists(meta):
        lines = open(meta, encoding="utf-8").read().split("\n")
        summary = lines[0][len("@summary "):].strip()
        call("PUT", "/api/subjects/" + sid, {"summary": summary, "content": convert("\n".join(lines[1:]), urls), "changeNote": "Database Internals, Part I"})
    subject = call("GET", "/api/subjects/" + sid)
    for top in subject["outline"]:
        call("DELETE", "/api/subjects/%s/nodes/%s?note=%s" % (sid, top["id"], "Replaced+by+Database+Internals+Part+I"))
    parents = {}
    for n in nodes:
        parent = {"CHAPTER": None, "TOPIC": parents.get("CHAPTER"), "SUBTOPIC": parents.get("TOPIC")}[n["type"]]
        body = {"type": n["type"], "title": n["title"], "changeNote": "Database Internals, Part I"}
        if parent:
            body["parentId"] = parent
        if n["summary"]:
            body["summary"] = n["summary"]
        if n["html"]:
            body["content"] = n["html"]
        created = call("POST", "/api/subjects/%s/nodes" % sid, body)
        node_id = created.get("id") or (created.get("result") or {}).get("id")
        if not node_id:
            raise SystemExit("unexpected create response: %s" % json.dumps(created)[:300])
        parents[n["type"]] = node_id
        if n["type"] == "CHAPTER":
            parents.pop("TOPIC", None)
    print("published", len(nodes), "nodes")


TOKEN = None
if __name__ == "__main__":
    main()
