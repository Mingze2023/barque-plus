// ============================================================
// Shrinking pictures so they can be saved straight into Firestore.
//
// Firebase's free plan has no file storage, so pictures are stored as
// text ("data URLs") inside Firestore documents. A document can hold
// about 1 MB, so pictures are resized and compressed in the browser
// until they fit. Used by Student Art now, and by Clubs and the map later.
//
//   const dataUrl = await shrinkImage(file);   // throws a friendly Error if it can't
// ============================================================

export const MAX_IMAGE_CHARS = 900000;   // safely under Firestore's ~1 MB per document

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be opened as a picture. Try a JPG or PNG.')); };
    img.src = url;
  });
}

// Returns a JPEG data URL no longer than maxChars
export async function shrinkImage(file, { maxSide = 1600, maxChars = MAX_IMAGE_CHARS } = {}) {
  if (!file) throw new Error('Choose a picture first.');
  if (!/^image\//.test(file.type)) throw new Error('That file is not a picture. Choose a JPG, PNG, GIF or WebP file.');
  if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    throw new Error('iPhone HEIC pictures can\'t be opened by browsers. Export it as a JPG first (or take a screenshot of it).');
  }

  const img = await loadImage(file);
  let scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  // Try smaller sizes and lower quality until it fits
  for (let attempt = 0; attempt < 8; attempt++) {
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    context.fillStyle = '#ffffff';                 // transparent parts become white
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.75, 0.65]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= maxChars) return dataUrl;
    }
    scale *= 0.75;
  }
  throw new Error('That picture is too detailed to fit. Try a smaller picture.');
}

// "about 240 KB"
export function describeSize(dataUrl) {
  const bytes = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
  return bytes > 1000000 ? `about ${(bytes / 1000000).toFixed(1)} MB` : `about ${Math.round(bytes / 1000)} KB`;
}
