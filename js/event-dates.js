// ============================================================
// Reading and showing event dates.
//
// Editors type the date in a box. Accepted forms:
//   11/20            one day (year optional: 11/20/2026 or 11/20/26)
//   Nov 20           one day, with the month written out
//   11/14-11/20      a range (also "11/14 - 11/20", "11/14 to 11/20", "11/14-20")
//   now-11/20        from today until 11/20
//   November         sometime that month (exact day not known yet)
//
// When no year is typed, the closest sensible year is used: a date
// more than 4 months in the past is taken to mean next year.
// ============================================================

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];
const MONTH_PATTERN = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const DAY = 24 * 60 * 60 * 1000;

function monthIndex(word) {
  return MONTHS.findIndex((m) => m.startsWith(word.slice(0, 3)));
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function fullYear(text) {
  const y = Number(text);
  return text.length === 2 ? 2000 + y : y;
}

// Picks the year for a month/day typed without one
function guessYear(month, day, now) {
  const thisYear = now.getFullYear();
  const candidate = new Date(thisYear, month, day);
  return candidate < new Date(now.getTime() - 120 * DAY) ? thisYear + 1 : thisYear;
}

// "11/20", "11/20/26", "nov 20", "november 20, 2026" -> { month, day, year (or null) }
function readDay(text) {
  let m = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
  if (m) return { month: Number(m[1]) - 1, day: Number(m[2]), year: m[3] ? fullYear(m[3]) : null };
  m = text.match(new RegExp(`^${MONTH_PATTERN}\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?$`));
  if (m) return { month: monthIndex(m[1]), day: Number(m[2]), year: m[3] ? Number(m[3]) : null };
  return null;
}

function isRealDate(year, month, day) {
  const d = new Date(year, month, day);
  return month >= 0 && month <= 11 && d.getMonth() === month && d.getDate() === day;
}

// Turns what the editor typed into { ok, kind, start, end } or { ok: false, error }.
//   kind: 'day' | 'range' | 'until' | 'month'
export function parseEventDate(input, now = new Date()) {
  const original = String(input || '').trim();
  const text = original.toLowerCase()
    .replace(/[–—]/g, '-')     // en/em dashes -> hyphen
    .replace(/\s+to\s+/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ');

  if (!text) return { ok: false, error: 'Type the date of the event.' };

  // Just a month: "November" or "Nov 2026"
  let m = text.match(new RegExp(`^${MONTH_PATTERN}(?:\\s+(\\d{4}))?$`));
  if (m) {
    const month = monthIndex(m[1]);
    const year = m[2] ? Number(m[2]) : guessYear(month, 28, now);
    return {
      ok: true, kind: 'month', text: original,
      start: new Date(year, month, 1),
      end: endOfDay(new Date(year, month + 1, 0)),
    };
  }

  // A range: "11/14-11/20", "11/14-20", "now-11/20"
  if (text.includes('-')) {
    const parts = text.split('-');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return { ok: false, error: 'For a range, use one dash, like 11/14-11/20.' };
    }
    const fromNow = parts[0] === 'now' || parts[0] === 'today';
    let start;
    if (fromNow) {
      start = startOfDay(now);
    } else {
      const a = readDay(parts[0]);
      if (!a) return { ok: false, error: `"${parts[0]}" isn't a date. Try 11/14.` };
      const year = a.year ?? guessYear(a.month, a.day, now);
      if (!isRealDate(year, a.month, a.day)) return { ok: false, error: `${parts[0]} isn't a real date.` };
      start = new Date(year, a.month, a.day);
    }

    // The end can be a full date, or just a day number in the same month ("11/14-20")
    let b = readDay(parts[1]);
    if (!b && /^\d{1,2}$/.test(parts[1]) && !fromNow) b = { month: start.getMonth(), day: Number(parts[1]), year: start.getFullYear() };
    if (!b) return { ok: false, error: `"${parts[1]}" isn't a date. Try 11/20.` };
    let endYear = b.year ?? start.getFullYear();
    if (b.year === null && b.month < start.getMonth()) endYear += 1; // crosses New Year, e.g. 12/28-1/3
    if (!isRealDate(endYear, b.month, b.day)) return { ok: false, error: `${parts[1]} isn't a real date.` };
    const end = endOfDay(new Date(endYear, b.month, b.day));
    if (end < start) return { ok: false, error: 'The end date is before the start date.' };

    return { ok: true, kind: fromNow ? 'until' : 'range', text: original, start, end };
  }

  // One day
  const d = readDay(text);
  if (!d) return { ok: false, error: `"${original}" isn't a date. Try 11/20, 11/14-11/20, now-11/20, or a month like November.` };
  const year = d.year ?? guessYear(d.month, d.day, now);
  if (!isRealDate(year, d.month, d.day)) return { ok: false, error: `${original} isn't a real date.` };
  const day = new Date(year, d.month, d.day);
  return { ok: true, kind: 'day', text: original, start: day, end: endOfDay(day) };
}

// ---------- Showing dates ----------
const short = (d) => d.toLocaleDateString('en-US', { month: 'short' });
const longDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const monthDay = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Full wording, for the popup and the preview: "Nov 14 – Nov 20, 2026"
export function describeEventDate({ kind, start, end }) {
  if (kind === 'month') return `Sometime in ${start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  if (kind === 'until') return `Now until ${longDate(end)}`;
  if (kind === 'range') {
    return start.getFullYear() === end.getFullYear()
      ? `${monthDay(start)} – ${longDate(end)}`
      : `${longDate(start)} – ${longDate(end)}`;
  }
  return start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// The two lines of the little date badge: { top, bottom, small }
export function badgeParts({ kind, start, end }) {
  if (kind === 'month') return { top: short(start), bottom: 'TBA', small: true };
  if (kind === 'until') return { top: `Until ${short(end)}`, bottom: String(end.getDate()) };
  if (kind === 'range') {
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    return {
      top: sameMonth ? short(start) : `${short(start)}–${short(end)}`,
      bottom: `${start.getDate()}–${end.getDate()}`,
      small: true,
    };
  }
  return { top: short(start), bottom: String(start.getDate()) };
}

// Is the event over? (its last day ended before today)
export function isPast(event, now = new Date()) {
  return event.end < startOfDay(now);
}
