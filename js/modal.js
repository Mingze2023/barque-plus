// ============================================================
// Popup window used by any section (events now; lost items and
// polls later). Closes with the X button, the Esc key, or a click
// outside the box.
//
//   openModal({ title: 'Club Fair', subtitle: 'Added Nov 13', html: '<p>...</p>' })
// ============================================================
import { esc } from './util.js';

let overlay = null;
let lastFocused = null;

function build() {
  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <button class="modal-close" aria-label="Close">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <h2 class="modal-title" id="modalTitle"></h2>
      <div class="modal-subtitle" id="modalSubtitle"></div>
      <div class="modal-body" id="modalBody"></div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('.modal-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });
}

export function openModal({ title, subtitle = '', html = '' }) {
  if (!overlay) build();
  lastFocused = document.activeElement;
  overlay.querySelector('#modalTitle').textContent = title;
  overlay.querySelector('#modalSubtitle').innerHTML = esc(subtitle);
  overlay.querySelector('#modalSubtitle').hidden = !subtitle;
  overlay.querySelector('#modalBody').innerHTML = html;
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('open'));
  overlay.querySelector('.modal-close').focus();
}

export function closeModal() {
  if (!overlay || overlay.hidden) return;
  overlay.classList.remove('open');
  setTimeout(() => { overlay.hidden = true; }, 200);
  if (lastFocused) lastFocused.focus();
}
