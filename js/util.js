// ============================================================
// Small helpers shared by every section.
// ============================================================

// Makes text safe to put inside HTML (so nobody's text can run as code)
export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// "Nov 13, 2026"
export function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date)) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Turns plain text into paragraphs: a blank line starts a new paragraph,
// a single line break stays a line break.
export function paragraphsHTML(text) {
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// Pressing Enter sends the message; Shift+Enter still starts a new line.
export function enterSends(textarea, send) {
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      send();
    }
  });
}

// ---------- Links in text ----------
// Text can hold links written as [words](https://...) (pasting from an email
// keeps its links this way) or plain https://... addresses.
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;
const MD_LINK = /\[([^\]\n]{1,300})\]\(((?:https?:\/\/|mailto:)[^\s)]{1,2000})\)/gi;

// Removes the link addresses, keeping the words (for titles and previews)
export function linkWords(text) {
  return String(text ?? '').replace(MD_LINK, '$1');
}

// Like paragraphsHTML, but links become clickable (opening in a new tab)
export function linkedParagraphsHTML(text) {
  const anchor = (href, words) => SAFE_LINK.test(href)
    ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(words)}</a>` : esc(words);
  const linkify = (p) => {
    let html = '';
    let last = 0;
    // [words](url) first, then plain addresses in the text between them
    const plain = (s) => esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, (url) => {
      const raw = url.replace(/&amp;/g, '&');
      return `<a href="${esc(raw)}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    for (const m of p.matchAll(MD_LINK)) {
      html += plain(p.slice(last, m.index)) + anchor(m[2], m[1]);
      last = m.index + m[0].length;
    }
    return html + plain(p.slice(last));
  };
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${p.split('\n').map(linkify).join('<br>')}</p>`)
    .join('');
}

// Pasted web or email content -> text that keeps its links as [words](url)
export function pastedTextWithLinks(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const BLOCK = /^(P|DIV|H[1-6]|LI|TR|BLOCKQUOTE|PRE|TABLE|UL|OL|SECTION|ARTICLE|HEADER|FOOTER)$/;
  let out = '';
  const walk = (node) => {
    if (node.nodeType === 3) { out += node.nodeValue.replace(/\s+/g, ' '); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (/^(SCRIPT|STYLE|HEAD|TITLE|META)$/.test(tag)) return;
    if (tag === 'BR') { out += '\n'; return; }
    if (tag === 'A') {
      const href = (node.getAttribute('href') || '').trim();
      const words = node.textContent.replace(/\s+/g, ' ').trim();
      if (SAFE_LINK.test(href) && words) {
        // a web address shown as itself stays plain (it's linked anyway); everything else keeps [words](address)
        out += words === href && /^https?:/i.test(href) ? href : `[${words.replace(/[[\]]/g, '')}](${href.replace(/\s/g, '%20').replace(/\)/g, '%29')})`;
        return;
      }
    }
    const block = BLOCK.test(tag);
    if (block) out += '\n';
    if (tag === 'LI') out += '• ';
    node.childNodes.forEach(walk);
    if (tag === 'P' || /^H[1-6]$/.test(tag)) out += '\n\n';
    else if (block) out += '\n';
  };
  walk(doc.body);
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/(• [^\n]*)\n\s*\n(?=• )/g, '$1\n')   // list items on their own lines, not paragraphs
    .trim();
}
