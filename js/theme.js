// ============================================================
// Seasonal themes: Spring, Summer, Fall (default) and Winter.
// The colors themselves are in css/style.css ("Seasonal themes").
// The choice is saved in this browser (so pages open in the right
// colors right away) and to the account (so it follows you to other
// computers).
// ============================================================

export const THEMES = [
  { id: 'spring', label: 'Spring', note: 'Faint pinks',          swatches: ['#fdf3f6', '#f3a3bd', '#4a2236'] },
  { id: 'summer', label: 'Summer', note: 'Faint greens',         swatches: ['#f1f8ee', '#95d36b', '#1d3a29'] },
  { id: 'fall',   label: 'Fall',   note: 'Yellow, white, brown', swatches: ['#faf5e9', '#f2b705', '#3a2414'] },
  { id: 'winter', label: 'Winter', note: 'Faint and dark blues', swatches: ['#eef4fb', '#7fb8ec', '#142338'] },
];
export const DEFAULT_THEME = 'fall';

export function isTheme(id) {
  return THEMES.some((t) => t.id === id);
}

export function currentTheme() {
  return document.documentElement.dataset.theme || DEFAULT_THEME;
}

// Switches the colors and remembers the choice in this browser
export function applyTheme(id) {
  const theme = isTheme(id) ? id : DEFAULT_THEME;
  if (theme === DEFAULT_THEME) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('barque.theme', theme); } catch (e) { /* storage unavailable */ }
}
