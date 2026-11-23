// ============================================================
// Inappropriate language filter (Step 14)
//
// Every comment, question, reply and lost item is checked with
// findBadLanguage(text) before it is sent. The word list is the file
// filter/bad-words.txt (edit it to add or remove words).
//
// What it catches, while matching WHOLE words only ("class" is fine):
//   - CAPITALS and accents                      FUCK, fück
//   - swapped characters                        sh1t, @ss, $hit, b!tch, a55
//   - look-alike letters from other alphabets   (Cyrillic а, е, о, ...)
//   - repeated letters                          fuuuuck, shiiit
//   - spaces or symbols between letters         f u c k, f.u.c.k, s-h-i-t, fu.ck
//   - a symbol hiding a letter                  f*ck, sh_t, f#ck
//   - common endings                            fucks, fucked, fucking, shitty
//   - phrases from the list                     (two words or more)
//   - words marked with * in the list, even inside other words (fuckface)
// Words marked with ! in the list are never blocked (butter is not butt + er).
// The editors' trash bins are the backup for anything it misses.
// ============================================================

const LIST_FILE = 'filter/bad-words.txt';

// Characters people swap in for letters. "1" and "|" can mean i or l, so
// text is checked both ways.
const SWAPS = {
  '@': 'a', '4': 'a', '^': 'a', 'α': 'a',
  '8': 'b', 'ß': 'b',
  '¢': 'c', '©': 'c',
  '3': 'e', '€': 'e', '£': 'e',
  '6': 'g', '9': 'g',
  '#': 'h',
  '1': 'i', '!': 'i', '|': 'i', '¡': 'i',
  '0': 'o', '°': 'o', 'ø': 'o',
  '$': 's', '5': 's', '§': 's',
  '7': 't', '+': 't',
  'µ': 'u',
  // look-alike letters from the Cyrillic and Greek alphabets
  'а': 'a', 'в': 'b', 'с': 'c', 'е': 'e', 'ё': 'e', 'н': 'h', 'і': 'i', 'ї': 'i', 'к': 'k',
  'м': 'm', 'о': 'o', 'р': 'p', 'ѕ': 's', 'т': 't', 'у': 'y', 'х': 'x',
  'ο': 'o', 'ν': 'v', 'κ': 'k', 'τ': 't', 'ι': 'i', 'ρ': 'p',
};
// In the second check, 1 and | mean l
const SWAPS_L = { ...SWAPS, '1': 'l', '|': 'l' };
// Symbols that stand in for one hidden letter (f*ck, sh_t)
const HIDERS = /[*_#?%]/;
// Endings that can be added to a listed word; short words only take -s/-es
const ENDINGS = ['s', 'es', 'z', 'ed', 'd', 'er', 'ers', 'ing', 'in', 'y', 'ey', 'ies', 'ier', 'iest'];
const SHORT_ENDINGS = ['s', 'es', 'z'];

let listPromise = null;

function stripAccents(text) {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

// One character -> a letter or digit (or '' for spacing/symbols)
function plain(ch, swaps) {
  const lower = ch.toLowerCase();
  if (swaps[lower]) return swaps[lower];
  return /[a-z0-9]/.test(lower) ? lower : '';
}

// "shitty" -> [1, 1, 1, 2, 1] (how many times each letter repeats in a row)
function runsOf(word) {
  return (word.match(/(.)\1*/g) || []).map((r) => r.length);
}

function squeeze(word) {
  return word.replace(/(.)\1+/g, '$1');   // fuuuck -> fuck
}

function parseList(text) {
  const words = new Set();      // single words, in plain letters
  const squeezed = new Map();   // squeezed word -> the listed words that squeeze to it
  const inside = [];            // * words, caught inside other words too
  const phrases = [];           // " two words " (spaces around)
  const symbols = [];           // entries with no letters at all (emoji)
  const allowed = new Set();    // ! words: never blocked (e.g. "butter", not butt + er)
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('!')) {
      const ok = [...stripAccents(line.slice(1).trim())].map((c) => plain(c, SWAPS)).join('');
      if (ok) allowed.add(ok);
      continue;
    }
    const star = line.startsWith('*');
    if (star) line = line.slice(1).trim();
    const parts = stripAccents(line).split(/\s+/)
      .map((w) => [...w].map((c) => plain(c, SWAPS)).join(''))
      .filter(Boolean);
    if (!parts.length) { symbols.push(line); continue; }
    const joined = parts.join('');
    if (parts.length > 1) phrases.push(` ${parts.join(' ')} `);
    words.add(joined);   // "blow job" also as "blowjob"
    const sq = squeeze(joined);
    if (!squeezed.has(sq)) squeezed.set(sq, []);
    squeezed.get(sq).push(joined);
    if (star) inside.push(joined);
  }
  return { words, squeezed, inside, phrases, symbols, allowed };
}

export function loadBadWords() {
  if (!listPromise) {
    listPromise = fetch(`${LIST_FILE}?v=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : ''))
      .then(parseList)
      .catch(() => parseList(''));
  }
  return listPromise;
}

// Is this one run of letters a listed word (or a listed word + ending)?
function isListed(word, list) {
  if (word.length < 2 || list.allowed.has(word)) return false;
  if (list.words.has(word)) return true;
  for (const end of ENDINGS) {
    if (word.length > end.length + 1 && word.endsWith(end)) {
      const stem = word.slice(0, -end.length);
      if (list.words.has(stem) && (stem.length >= 4 || SHORT_ENDINGS.includes(end))) return true;
    }
  }
  // Stretched letters (fuuuck, shiiiit, asss): only when a letter repeats 3+
  // times, which real English words never do, and every letter of the listed
  // word is still there ("as" is not "ass", "rapping" is not stretched).
  if (/(.)\1\1/.test(word)) {
    const runs = runsOf(word);
    for (const bad of list.squeezed.get(squeeze(word)) || []) {
      const badRuns = runsOf(bad);
      if (badRuns.every((n, i) => runs[i] >= n)) return true;
    }
    // stretched + ending: fuuuucking
    for (const end of ENDINGS) {
      if (word.endsWith(end) && isListed(squeeze(word.slice(0, -end.length)) + end, list)) return true;
    }
  }
  for (const bad of list.inside) {
    if (word.includes(bad)) return true;
  }
  return false;
}

// A word with a hidden letter (f*ck): does it fit a listed word?
function fitsHidden(pattern, list) {
  const re = new RegExp(`^${pattern.replace(/[*_#?%]/g, '[a-z]')}(s|es|ed|er|ing)?$`);
  for (const bad of list.words) {
    if (Math.abs(bad.length - pattern.length) <= 3 && bad.length >= 3 && re.test(bad)) return true;
  }
  return false;
}

function checkWith(text, list, swaps) {
  const chunks = stripAccents(text).split(/\s+/).filter(Boolean);
  const seq = [];        // the words in order, for phrases
  let singles = '';      // a run of one-letter chunks: "f u c k"

  const flushSingles = () => {
    // check every stretch of 3+ letters inside the run ("a f u c k" too)
    for (let a = 0; a < singles.length; a++) {
      for (let b = a + 3; b <= singles.length; b++) {
        if (isListed(singles.slice(a, b), list)) return true;
      }
    }
    singles = '';
    return false;
  };

  for (const chunk of chunks) {
    // Plain numbers ("2025", "5") are never words
    if (/^[\d.,:%$/-]+$/.test(chunk) && !/[a-z]/i.test(chunk)) {
      if (flushSingles()) return true;
      seq.push(chunk);
      continue;
    }
    // Hidden letter: keep the * or _ so the pattern can be tried
    if (HIDERS.test(chunk.slice(1, -1))) {
      const pattern = [...chunk].map((c) => (HIDERS.test(c) ? c : plain(c, swaps))).join('').replace(/^[*_#?%]+|[*_#?%]+$/g, '');
      if (/[a-z]/.test(pattern) && HIDERS.test(pattern) && fitsHidden(pattern, list)) return true;
    }
    const letters = [...chunk].map((c) => plain(c, swaps)).join('');   // "f.u.c.k" -> "fuck"
    const parts = chunk.split(/[^\p{L}\p{N}@$!|+^€£§°]+/u)
      .map((p) => [...p].map((c) => plain(c, swaps)).join(''))
      .filter(Boolean);                                                // "well...shit" -> well, shit

    if (letters.length === 1) { singles += letters; seq.push(letters); continue; }
    if (flushSingles()) return true;
    if (isListed(letters, list)) return true;
    for (const part of parts) if (part !== letters && isListed(part, list)) return true;
    seq.push(...(parts.length ? parts : [letters]));
  }
  if (flushSingles()) return true;

  if (list.phrases.length) {
    const line = ` ${seq.join(' ')} `;
    if (list.phrases.some((p) => line.includes(p))) return true;
  }
  return false;
}

// true if the text has inappropriate language
export async function findBadLanguage(text) {
  const list = await loadBadWords();
  if (!text || !list.words.size) return false;
  if (list.symbols.some((s) => text.includes(s))) return true;
  return checkWith(text, list, SWAPS) || checkWith(text, list, SWAPS_L);
}

// Shows the red glow and "Inappropriate language" on a text box until it's edited
export const BAD_LANGUAGE = 'Inappropriate language';
export function markBadLanguage(textarea) {
  textarea.classList.add('bad-language');
  textarea.addEventListener('input', () => textarea.classList.remove('bad-language'), { once: true });
}
