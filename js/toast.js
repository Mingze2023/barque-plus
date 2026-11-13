// ============================================================
// Small message at the bottom of the screen, optionally with a
// button (used for "Deleted. Undo").
//
//   showToast('Event deleted.', { action: 'Undo', onAction: () => ..., seconds: 8 })
// ============================================================
let box = null;
let timer = null;

export function showToast(message, { action = null, onAction = null, seconds = 5 } = {}) {
  if (!box) {
    box = document.createElement('div');
    box.className = 'toast';
    box.setAttribute('role', 'status');
    document.body.appendChild(box);
  }
  clearTimeout(timer);
  box.innerHTML = '';

  const text = document.createElement('span');
  text.textContent = message;
  box.appendChild(text);

  if (action && onAction) {
    const button = document.createElement('button');
    button.className = 'toast-action';
    button.textContent = action;
    button.addEventListener('click', () => { hideToast(); onAction(); });
    box.appendChild(button);
  }

  box.classList.add('show');
  timer = setTimeout(hideToast, seconds * 1000);
}

export function hideToast() {
  if (box) box.classList.remove('show');
}
