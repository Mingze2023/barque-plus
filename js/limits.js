// ============================================================
// Daily limits (Step 15), the same everywhere
//
//                     News comments   Q&A questions + replies   Lost items
//   Students                5                    5                   1
//   Club Leaders            5                    5                   1
//   Teachers            unlimited            unlimited               1
//   Editors             unlimited            unlimited           unlimited
//
// Each post is saved together with users/{you}/limits/{kind} = { day, count },
// and firestore.rules only accepts the post if that count goes up by one
// (or restarts at 1 on a new day, at midnight Bellevue time) and stays within
// the limit. So the limits hold even if someone changes the page.
// If you change a number here, change dailyMax() in firestore.rules too.
// ============================================================
export const DAILY = { comments: 5, qa: 5, lost: 1 };

const MESSAGES = {
  comments: `You've posted ${DAILY.comments} comments today (the daily limit). You can post again tomorrow.`,
  qa: `You've posted ${DAILY.qa} questions and replies today (the daily limit). You can post again tomorrow.`,
  lost: "You've already added a lost item today. You can add another tomorrow.",
};

// Today's date in Bellevue as a day number (days since Jan 1 1970).
// firestore.rules works out the same number.
export function pacificDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return Date.UTC(get('year'), get('month') - 1, get('day')) / 86400000;
}

export function isUnlimited(ctx, kind) {
  if (ctx.profile.isEditor) return true;
  return ctx.profile.profileType === 'Teacher' && kind !== 'lost';
}

export function limitText(ctx, kind) {
  if (isUnlimited(ctx, kind)) return '';
  const n = DAILY[kind];
  if (kind === 'qa') return `You can post ${n} questions and replies per day.`;
  if (kind === 'comments') return `You can post ${n} comments per day.`;
  return n === 1 ? 'You can add 1 per day.' : `You can add ${n} per day.`;
}

// The record to save with your next post, or null if today's limit is used up.
// (Records from before counts existed have no count; they mean 1.)
export function nextLimit(snap, today, max) {
  const old = snap && snap.exists() ? snap.data() : null;
  if (!old || old.day < today) return { day: today, count: 1 };
  const used = typeof old.count === 'number' ? old.count : 1;
  return used < max ? { day: today, count: used + 1 } : null;
}

// Before posting: returns { unlimited: true }, { message } (limit reached),
// or { ref, record } to add to the same batch as the post.
export async function prepareLimit(ctx, kind) {
  if (isUnlimited(ctx, kind)) return { unlimited: true };
  const { db, firestore } = ctx.fb;
  const ref = firestore.doc(db, 'users', ctx.profile.uid, 'limits', kind);
  let snap = null;
  try { snap = await firestore.getDoc(ref); } catch (e) { /* the rules still check */ }
  const record = nextLimit(snap, pacificDay(), DAILY[kind]);
  return record ? { ref, record } : { message: MESSAGES[kind] };
}

// After the rules refused a post: was it the limit? (message, or '')
export async function limitMessageAfterRefusal(ctx, kind) {
  if (isUnlimited(ctx, kind)) return '';
  const { db, firestore } = ctx.fb;
  try {
    const snap = await firestore.getDoc(firestore.doc(db, 'users', ctx.profile.uid, 'limits', kind));
    return nextLimit(snap, pacificDay(), DAILY[kind]) ? '' : MESSAGES[kind];
  } catch (e) {
    return '';
  }
}
