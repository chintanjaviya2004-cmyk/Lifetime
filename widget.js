import { computeLifeStats } from "./lifemath.js";

const DEFAULT_TARGET_AGE = 60;

function getBirthdate() {
  const params = new URLSearchParams(location.search);
  return params.get("birthdate") || localStorage.getItem("lifetime.birthdate");
}

// Mirrors app.js's getSettings() so this widget route stays consistent with
// whatever life-expectancy the user has set in the main app.
function getTargetAge() {
  const params = new URLSearchParams(location.search);
  const fromQuery = Number(params.get("targetAge"));
  if (Number.isFinite(fromQuery) && fromQuery >= 1 && fromQuery <= 120) return fromQuery;
  try {
    const raw = JSON.parse(localStorage.getItem("lifetime.settings"));
    const targetAge = Number(raw?.targetAge);
    if (Number.isFinite(targetAge) && targetAge >= 1 && targetAge <= 120) return targetAge;
  } catch {}
  return DEFAULT_TARGET_AGE;
}

function render() {
  const params = new URLSearchParams(location.search);
  if (params.get("bg") === "transparent") document.body.classList.add("transparent-bg");

  const birthdate = getBirthdate();
  const root = document.getElementById("widget-root");
  if (!birthdate) return; // keep the static "Open the app…" fallback markup

  const stats = computeLifeStats(birthdate, getTargetAge());
  const pct = Math.min(100, stats.percentLived).toFixed(1);

  root.innerHTML = `
    <p class="label">Life Lived</p>
    <p class="pct">${stats.percentLived.toFixed(1)}%</p>
    <div class="track"><div class="fill" style="width:${pct}%"></div></div>
    <p class="days">${stats.daysLeft.toLocaleString()} days left</p>
    <p class="rank">${stats.rank}</p>
  `;
}

render();
// Belt-and-suspenders refresh in case the widget host keeps this page alive
// instead of reloading it on its own schedule.
setInterval(render, 60000);
