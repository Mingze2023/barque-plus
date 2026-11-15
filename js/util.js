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
