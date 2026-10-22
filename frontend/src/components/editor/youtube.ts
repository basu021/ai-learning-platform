import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

export interface YouTubeVideo {
  id: string;
  /** Start time in seconds, from ?t= or ?start=. */
  start?: number;
}

/** "90", "90s", "1m30s", "1h2m3s" → seconds. */
function parseTime(t: string | null): number | undefined {
  if (!t) return undefined;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (!m || !m[0]) return undefined;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

/** Video id (and start time) of a YouTube watch, share, shorts, live or embed URL. */
export function youTubeVideo(url: string): YouTubeVideo | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else id = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(u.pathname)?.[1] ?? null;
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  const start = parseTime(u.searchParams.get("t") ?? u.searchParams.get("start"));
  return start ? { id, start } : { id };
}

/** The video a paragraph links to, if the paragraph holds nothing but that one YouTube link. */
function videoOf(node: PMNode): YouTubeVideo | null {
  if (node.type.name !== "paragraph") return null;
  const text = node.textContent.trim();
  if (!text) return null;
  const hrefs = new Set<string>();
  let outside = "";
  node.forEach((child) => {
    const link = child.marks.find((m) => m.type.name === "link");
    if (link) hrefs.add(String(link.attrs.href));
    else outside += child.text ?? "";
  });
  if (hrefs.size === 1 && !outside.trim()) return youTubeVideo([...hrefs][0]);
  if (hrefs.size === 0 && !/\s/.test(text)) return youTubeVideo(text);
  return null;
}

/** Thumbnail with a play button; the real player loads on click (no YouTube requests before that). */
function player({ id, start }: YouTubeVideo): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "yt-embed";
  wrap.contentEditable = "false";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "yt-facade";
  button.setAttribute("aria-label", "Play video");
  const img = document.createElement("img");
  img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  img.alt = "";
  img.loading = "lazy";
  const play = document.createElement("span");
  play.className = "yt-play";
  play.setAttribute("aria-hidden", "true");
  button.append(img, play);
  button.addEventListener("click", (e) => {
    e.preventDefault();
    const frame = document.createElement("iframe");
    frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0${start ? `&start=${start}` : ""}`;
    frame.title = "YouTube video";
    frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    button.replaceWith(frame);
  });
  wrap.append(button);
  return wrap;
}

function decorate(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "paragraph") return true;
    const video = videoOf(node);
    if (video) {
      decos.push(
        Decoration.widget(pos, () => player(video), { side: -1, key: `yt-${video.id}-${video.start ?? 0}`, stopEvent: () => true, ignoreSelection: true }),
        Decoration.node(pos, pos + node.nodeSize, { class: "yt-source" }),
      );
    }
    return false;
  });
  return DecorationSet.create(doc, decos);
}

/**
 * Shows a YouTube player above any paragraph that contains only a YouTube link.
 * Display-only: the stored HTML stays a plain link.
 */
export const YouTubeLinks = Extension.create({
  name: "youtubeLinks",
  addProseMirrorPlugins() {
    const key = new PluginKey<DecorationSet>("youtubeLinks");
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => decorate(state.doc),
          apply: (tr, old) => (tr.docChanged ? decorate(tr.doc) : old.map(tr.mapping, tr.doc)),
        },
        props: { decorations: (state) => key.getState(state) },
      }),
    ];
  },
});
