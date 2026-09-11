// Lifetime — iOS Home Screen widget for the Scriptable app.
//
// Setup:
//   1. Install "Scriptable" (free) from the App Store.
//   2. Open Scriptable, tap "+", paste this entire file in, name it "Lifetime".
//   3. Edit the BIRTHDATE constant below to your own birthdate.
//   4. Long-press your Home Screen → tap "+" → search "Scriptable" → add a
//      Small or Medium widget.
//   5. Long-press the new widget placeholder → Edit Widget → set "Script" to
//      "Lifetime" and "When Interacting" to "Run Script".
//
// Note: iOS controls widget refresh timing itself (typically every 15-30
// min) — this can't be forced faster from the script. That's fine for a
// decades-long countdown and matches the "glance, no notifications" goal.
//
// Date math is a hand-ported copy of /lifemath.js (this runtime has no ES
// modules) — keep both in sync if the math ever changes. The web app now
// lets you edit your life-expectancy assumption from its Settings screen
// (stored in localStorage as lifetime.settings) — this script has no way to
// read that, so if you change it there, update TARGET_AGE below to match.

const BIRTHDATE = "1998-04-12"; // <-- EDIT THIS: YYYY-MM-DD
const TARGET_AGE = 60;

const PALETTE = {
  bgTop: "#0A0E14",
  bgBottom: "#12161F",
  track: "#181D28",
  accent: "#39FF88",
  text: "#F4F7F5",
  textSecondary: "#8B98A5",
};

function toUTCDateOnly(d) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

function computeLifeStats(birthdateISO, targetAgeYears, now) {
  const birth = toUTCDateOnly(new Date(birthdateISO));
  const today = toUTCDateOnly(now);
  const end = new Date(birth);
  end.setUTCFullYear(end.getUTCFullYear() + targetAgeYears);

  const daysLived = daysBetween(birth, today);
  const totalDays = daysBetween(birth, end);
  const rawDaysLeft = totalDays - daysLived;
  const daysLeft = Math.max(0, rawDaysLeft);
  const percentLived = (daysLived / totalDays) * 100;

  return { daysLived, daysLeft, percentLived, isPast: rawDaysLeft < 0 };
}

function rankFor(percentLived) {
  const ranks = [
    [10, "Rank I — Initiate"], [25, "Rank II — Ascendant"], [40, "Rank III — Voyager"],
    [55, "Rank IV — Vanguard"], [70, "Rank V — Sage"], [85, "Rank VI — Elder"],
    [100, "Rank VII — Legacy"], [Infinity, "Rank VII+ — Legend"],
  ];
  return ranks.find(([max]) => percentLived < max)[1];
}

const stats = computeLifeStats(BIRTHDATE, TARGET_AGE, new Date());
const clampedPct = Math.min(100, stats.percentLived);

const widget = new ListWidget();
const gradient = new LinearGradient();
gradient.colors = [new Color(PALETTE.bgTop), new Color(PALETTE.bgBottom)];
gradient.locations = [0, 1];
widget.backgroundGradient = gradient;
widget.setPadding(14, 16, 14, 16);

const stack = widget.addStack();
stack.layoutVertically();

const labelText = stack.addText("LIFE LIVED");
labelText.font = Font.mediumSystemFont(10);
labelText.textColor = new Color(PALETTE.textSecondary);

stack.addSpacer(4);

const pctText = stack.addText(`${stats.percentLived.toFixed(1)}%`);
pctText.font = Font.heavyMonospacedSystemFont(30);
pctText.textColor = new Color(PALETTE.accent);

stack.addSpacer(8);

const trackStack = stack.addStack();
trackStack.size = new Size(0, 8);
trackStack.cornerRadius = 4;
trackStack.backgroundColor = new Color(PALETTE.track);
const fillStack = trackStack.addStack();
fillStack.size = new Size(140 * (clampedPct / 100), 8);
fillStack.cornerRadius = 4;
fillStack.backgroundColor = new Color(PALETTE.accent);

stack.addSpacer(8);

const daysText = stack.addText(
  stats.isPast ? `past the ${TARGET_AGE}-year mark` : `${stats.daysLeft.toLocaleString()} days left`
);
daysText.font = Font.systemFont(11);
daysText.textColor = new Color(PALETTE.text);

if (config.widgetFamily === "medium") {
  stack.addSpacer(4);
  const rankText = stack.addText(rankFor(stats.percentLived));
  rankText.font = Font.systemFont(10);
  rankText.textColor = new Color(PALETTE.textSecondary);
}

Script.setWidget(widget);
if (!config.runsInWidget) widget.presentSmall();
Script.complete();
