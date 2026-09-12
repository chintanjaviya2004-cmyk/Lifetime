// Pure date-math for the life countdown. No DOM access here — this file is
// imported by app.js and widget.js as-is, and its logic is hand-ported
// (no ES modules there) into widget/scriptable-life-widget.js. Keep both in sync.

export function toUTCDateOnly(d) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

export function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

// Anniversary-style calendar subtraction of b - a (not a plain day-count
// divide), so a y/m/d breakdown matches how humans actually count time.
// Assumes b >= a; callers clamp/guard the reverse case themselves.
export function calendarDiff(a, b) {
  let years = b.getUTCFullYear() - a.getUTCFullYear();
  let months = b.getUTCMonth() - a.getUTCMonth();
  let days = b.getUTCDate() - a.getUTCDate();
  if (days < 0) {
    const prevMonth = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 0));
    days += prevMonth.getUTCDate();
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }
  return { years, months, days };
}

export function preciseAge(birth, today) {
  return calendarDiff(birth, today);
}

// Life-stage rank ladder, keyed by percent of life lived.
export const RANKS = [
  { max: 10, label: "Rank I — Initiate" },
  { max: 25, label: "Rank II — Ascendant" },
  { max: 40, label: "Rank III — Voyager" },
  { max: 55, label: "Rank IV — Vanguard" },
  { max: 70, label: "Rank V — Sage" },
  { max: 85, label: "Rank VI — Elder" },
  { max: 100, label: "Rank VII — Legacy" },
  { max: Infinity, label: "Rank VII+ — Legend" },
];

export function rankFor(percentLived) {
  return RANKS.find((r) => percentLived < r.max || r.max === Infinity).label;
}

export function rankIndexFor(percentLived) {
  return RANKS.findIndex((r) => percentLived < r.max || r.max === Infinity);
}

// Short motivational line per life stage — keeps the narrative going now
// that there are no milestone badges to supply that texture.
const NARRATIVE = [
  { max: 10, text: "Early days. Everything is still ahead of you." },
  { max: 25, text: "Foundations are being laid. Keep building." },
  { max: 40, text: "Momentum is real now. Make it count." },
  { max: 55, text: "The midpoint approaches. You know more than you did." },
  { max: 70, text: "Past the middle. Perspective is your edge now." },
  { max: 85, text: "Deep experience, fewer illusions. Use it well." },
  { max: 100, text: "The final stretch, by this clock's estimate." },
  { max: Infinity, text: "Every day now is bonus time. Spend it well." },
];

export function narrativeFor(percentLived) {
  return NARRATIVE.find((n) => percentLived < n.max || n.max === Infinity).text;
}

export function computeLifeStats(birthdateISO, targetAgeYears = 60, now = new Date()) {
  const birth = toUTCDateOnly(new Date(birthdateISO));
  const today = toUTCDateOnly(now);

  const end = new Date(birth);
  // Feb-29 births intentionally roll to Mar 1 when the target year isn't a
  // leap year (native Date behavior) — documented, not treated as a bug.
  end.setUTCFullYear(end.getUTCFullYear() + targetAgeYears);

  const daysLived = daysBetween(birth, today);
  const totalDays = daysBetween(birth, end);
  const rawDaysLeft = totalDays - daysLived;
  const daysLeft = Math.max(0, rawDaysLeft);
  const percentLived = (daysLived / totalDays) * 100; // not clamped — can exceed 100
  const weeksLeft = Math.floor(daysLeft / 7);
  const weeksLived = Math.floor(daysLived / 7);
  const isPast = rawDaysLeft < 0;

  // Time remaining as a y/m/d breakdown (not just raw days) for the "Time
  // Left" stat tile. Zeroed out once past the target age.
  const timeLeft = isPast ? { years: 0, months: 0, days: 0 } : calendarDiff(today, end);

  const yearsLived = Math.min(targetAgeYears, Math.floor(daysLived / 365.2425));

  return {
    daysLived,
    totalDays,
    daysLeft,
    rawDaysLeft,
    weeksLeft,
    weeksLived,
    percentLived,
    isPast,
    age: preciseAge(birth, today),
    timeLeft,
    rank: rankFor(percentLived),
    rankIndex: rankIndexFor(percentLived),
    narrative: narrativeFor(percentLived),
    endTimestamp: end.getTime(),
    yearsLived,
    targetAgeYears,
  };
}
