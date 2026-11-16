// ============================================================
// Turning a video or audio link into a player on the page.
//
// Works with:
//   YouTube        youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...
//   Vimeo          vimeo.com/123456
//   Google Drive   drive.google.com/file/d/<id>/view   (file must be shared "Anyone with the link")
//   SoundCloud     soundcloud.com/artist/track
//   Direct files   links ending in .mp4 .webm .mov (video) or .mp3 .wav .ogg .m4a (audio)
//
//   const player = readMediaLink(link)  ->  { ok, kind: 'iframe' | 'video' | 'audio', src, site }
//                                           or { ok: false, error }
// ============================================================

export function readMediaLink(input) {
  const text = String(input || '').trim();
  if (!text) return { ok: false, error: 'Paste a link to the video or audio.' };

  let url;
  try {
    // Allow links pasted without https:// (like youtube.com/watch?v=...)
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
  } catch (e) {
    return { ok: false, error: 'That isn\'t a full link. It should start with https://' };
  }
  if (url.protocol === 'http:') url.protocol = 'https:';   // the site itself is https, so players must be too
  if (url.protocol !== 'https:') return { ok: false, error: 'That isn\'t a web link. It should start with https://' };

  const host = url.hostname.replace(/^www\.|^m\./, '');
  const path = url.pathname;

  // YouTube
  let id = null;
  if (host === 'youtu.be') id = path.slice(1).split('/')[0];
  if (host === 'youtube.com' || host === 'music.youtube.com') {
    if (path === '/watch') id = url.searchParams.get('v');
    else if (/^\/(shorts|embed|live)\//.test(path)) id = path.split('/')[2];
  }
  if ((host === 'youtube.com' || host === 'music.youtube.com') && !id) {
    return { ok: false, error: 'That YouTube link doesn\'t point to a video. Open the video and copy its link.' };
  }
  if (id !== null) {
    if (!/^[\w-]{6,}$/.test(id)) return { ok: false, error: 'That YouTube link is missing the video ID.' };
    return { ok: true, kind: 'iframe', site: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}` };
  }

  // Vimeo
  if (host === 'vimeo.com') {
    const m = path.match(/^\/(\d+)/);
    if (!m) return { ok: false, error: 'That Vimeo link is missing the video number.' };
    return { ok: true, kind: 'iframe', site: 'Vimeo', src: `https://player.vimeo.com/video/${m[1]}` };
  }

  // Google Drive
  if (host === 'drive.google.com') {
    const m = path.match(/\/file\/d\/([\w-]+)/) || (url.searchParams.get('id') ? [null, url.searchParams.get('id')] : null);
    if (!m) return { ok: false, error: 'Use the Google Drive "Share" link of a single file (it contains /file/d/).' };
    return { ok: true, kind: 'iframe', site: 'Google Drive', src: `https://drive.google.com/file/d/${m[1]}/preview` };
  }

  // SoundCloud
  if (host === 'soundcloud.com') {
    return { ok: true, kind: 'iframe', site: 'SoundCloud',
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.origin + url.pathname)}&color=%23f2b705&visual=true` };
  }

  // Direct files
  if (/\.(mp4|webm|mov|m4v)$/i.test(path)) return { ok: true, kind: 'video', site: 'video file', src: url.href };
  if (/\.(mp3|wav|ogg|oga|m4a|aac|flac)$/i.test(path)) return { ok: true, kind: 'audio', site: 'audio file', src: url.href };

  return { ok: false, error: 'Use a YouTube, Vimeo, Google Drive or SoundCloud link, or a direct link to a video or audio file.' };
}
