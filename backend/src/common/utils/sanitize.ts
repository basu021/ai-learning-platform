import sanitizeHtml from 'sanitize-html';

// Rich-text bodies are authored by one user and rendered for others, so only
// the markup the editor can produce is allowed through.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'h4',
    'p',
    'br',
    'hr',
    'blockquote',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'code',
    'pre',
    'mark',
    'sub',
    'sup',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'span',
    'div',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'colgroup',
    'col',
    'label',
    'input',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    code: ['class'],
    pre: ['class'],
    span: ['class'],
    div: ['class', 'data-type'],
    ul: ['data-type'],
    li: ['data-type', 'data-checked'],
    th: ['colspan', 'rowspan', 'colwidth'],
    td: ['colspan', 'rowspan', 'colwidth'],
    col: ['style'],
    input: ['type', 'checked', 'disabled'],
    p: ['style'],
    h1: ['style'],
    h2: ['style'],
    h3: ['style'],
    h4: ['style'],
  },
  allowedStyles: {
    '*': { 'text-align': [/^(left|right|center|justify)$/] },
    col: { width: [/^\d+px$/], 'min-width': [/^\d+px$/] },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowedClasses: {
    code: [/^language-[\w-]+$/],
    pre: [/^language-[\w-]+$/],
    span: [/^hljs[\w-]*$/],
    div: [
      'callout',
      'callout-info',
      'callout-warning',
      'callout-danger',
      'callout-success',
    ],
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      rel: 'noopener noreferrer',
      target: '_blank',
    }),
  },
};

export function sanitizeRich(html: string | null | undefined): string | null {
  if (html == null) return null;
  const clean = sanitizeHtml(html, OPTIONS).trim();
  return clean.length ? clean : null;
}
