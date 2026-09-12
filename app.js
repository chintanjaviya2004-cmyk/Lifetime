import { computeLifeStats } from "./lifemath.js";

const BIRTHDATE_KEY = "lifetime.birthdate";
const SETTINGS_KEY = "lifetime.settings";
const INSTALL_DISMISSED_KEY = "lifetime.installBannerDismissed";
const LAST_SEEN_RANK_KEY = "lifetime.lastSeenRank";
const GRID_VIEW_KEY = "lifetime.gridView";
const DEFAULT_TARGET_AGE = 60;
const RING_RADIUS = 88;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const onboardingScreen = document.getElementById("onboarding-screen");
const onboardingForm = document.getElementById("onboarding-form");
const birthdateInput = document.getElementById("birthdate-input");
const onboardingError = document.getElementById("onboarding-error");
const onboardingAgeChips = document.getElementById("onboarding-age-chips");
const onboardingAgeCustom = document.getElementById("onboarding-age-custom");
const onboardingAgeError = document.getElementById("onboarding-age-error");

const editScreen = document.getElementById("edit-screen");
const editForm = document.getElementById("edit-form");
const editBirthdateInput = document.getElementById("edit-birthdate-input");
const editError = document.getElementById("edit-error");
const editAgeChips = document.getElementById("edit-age-chips");
const editAgeCustom = document.getElementById("edit-age-custom");
const editAgeError = document.getElementById("edit-age-error");
const editBtn = document.getElementById("edit-btn");
const editCancel = document.getElementById("edit-cancel");
const clearDataBtn = document.getElementById("clear-data");
const exportDataBtn = document.getElementById("export-data-btn");
const importDataBtn = document.getElementById("import-data-btn");
const importDataInput = document.getElementById("import-data-input");

const dashboard = document.getElementById("dashboard");

const rankUpToast = document.getElementById("rank-up-toast");
const rankUpTitle = document.getElementById("rank-up-title");
const rankUpDismiss = document.getElementById("rank-up-dismiss");

let lastStats = null;
let liveClockTimer = null;

const todayISO = () => new Date().toISOString().slice(0, 10);
const pad2 = (n) => String(n).padStart(2, "0");

function validateBirthdate(value) {
  if (!value) return "Enter a date to continue.";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "That date doesn't look right.";
  if (value > todayISO()) return "Birthdate can't be in the future.";
  const age = new Date().getUTCFullYear() - d.getUTCFullYear();
  if (age > 120) return "Double-check that date — seems unusually old.";
  return null;
}

function validateTargetAge(value) {
  if (value === null || !Number.isFinite(value)) return "Choose or enter a life expectancy.";
  if (value < 1 || value > 120) return "Life expectancy must be between 1 and 120 years.";
  return null;
}

function getStoredBirthdate() {
  return localStorage.getItem(BIRTHDATE_KEY);
}

function saveBirthdate(value) {
  localStorage.setItem(BIRTHDATE_KEY, value);
}

// ---------- settings (target age) ----------

function getSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    const targetAge = Number(raw?.targetAge);
    if (Number.isFinite(targetAge) && targetAge >= 1 && targetAge <= 120) {
      return { targetAge };
    }
  } catch {}
  return { targetAge: DEFAULT_TARGET_AGE };
}

function saveSettings(partial) {
  const next = { ...getSettings(), ...partial };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

// ---------- age chip controls (shared by onboarding + edit forms) ----------

function wireAgeChips(rowEl, customInputEl) {
  const chips = Array.from(rowEl.querySelectorAll(".age-chip"));
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      const isCustom = chip.classList.contains("age-chip-custom");
      customInputEl.hidden = !isCustom;
      if (isCustom) customInputEl.focus();
    });
  });
}

function setAgeChipValue(rowEl, customInputEl, age) {
  const chips = Array.from(rowEl.querySelectorAll(".age-chip"));
  const preset = chips.find((c) => !c.classList.contains("age-chip-custom") && Number(c.dataset.age) === age);
  chips.forEach((c) => c.classList.remove("selected"));
  if (preset) {
    preset.classList.add("selected");
    customInputEl.hidden = true;
    customInputEl.value = "";
  } else {
    rowEl.querySelector(".age-chip-custom").classList.add("selected");
    customInputEl.hidden = false;
    customInputEl.value = age;
  }
}

function getAgeChipValue(rowEl, customInputEl) {
  const selectedChip = rowEl.querySelector(".age-chip.selected");
  if (!selectedChip) return null;
  if (selectedChip.classList.contains("age-chip-custom")) {
    const v = Number(customInputEl.value);
    return Number.isFinite(v) && customInputEl.value !== "" ? v : null;
  }
  return Number(selectedChip.dataset.age);
}

wireAgeChips(onboardingAgeChips, onboardingAgeCustom);
wireAgeChips(editAgeChips, editAgeCustom);

// ---------- animated count-up ----------

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// A per-element generation token so a new animateCountUp call on the same
// element supersedes any still-in-flight one instead of racing it — without
// this, two overlapping animations (e.g. boot's render and an edit-save
// shortly after) could both write to the same element, and a stray
// negative `elapsed` (t < 0) would send easeOutExpo's exponential to a huge
// garbage value since t was only ever clamped on its upper bound.
function animateCountUp(el, from, to, duration, formatFn) {
  const token = (el.__animToken = (el.__animToken || 0) + 1);
  const start = performance.now();
  function tick() {
    if (el.__animToken !== token) return; // superseded by a newer animation on this element
    const elapsed = performance.now() - start;
    const t = Math.max(0, Math.min(1, elapsed / duration));
    const eased = easeOutExpo(t);
    const value = from + (to - from) * eased;
    el.textContent = formatFn(value);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = formatFn(to);
  }
  requestAnimationFrame(tick);
}

const intFmt = (v) => Math.round(v).toLocaleString();

// ---------- years grid ----------

function renderYearsGrid(stats) {
  const grid = document.getElementById("years-grid");
  grid.innerHTML = "";

  for (let i = 0; i < stats.targetAgeYears; i++) {
    const cell = document.createElement("div");
    if (i < stats.yearsLived) cell.className = "year-cell lived";
    else if (i === stats.yearsLived && !stats.isPast) cell.className = "year-cell current";
    else cell.className = "year-cell ahead";
    grid.appendChild(cell);
  }
}

// ---------- weeks grid (canvas — targetAgeYears x 52 would be too many DOM nodes) ----------

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function sizeCanvasForDPR(canvas, cssWidth, cssHeight) {
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Simplifies each year to exactly 52 weeks (the well-known "life in weeks"
// convention) rather than the exact ~52.18 — an intentional approximation,
// same spirit as the documented Feb-29 rollover in lifemath.js.
function drawWeeksGrid(stats) {
  const canvas = document.getElementById("weeks-canvas");
  const gap = 2;
  const cols = 52;
  const rows = stats.targetAgeYears;
  // Measure the canvas's own available width, not its parent's clientWidth
  // — the parent (.years-section) has its own left/right padding, which
  // clientWidth includes. Sizing the canvas to that full padded width made
  // it overflow the section's content box by the padding amount on each
  // side, forcing the whole page into horizontal scroll. Clearing any
  // previous inline width first lets the "width:100%" CSS rule (which
  // correctly respects the parent's padding) determine the real available
  // width before we measure it.
  canvas.style.width = "100%";
  const containerWidth = canvas.clientWidth;
  if (containerWidth <= 0) return;

  const cell = (containerWidth - gap * (cols - 1)) / cols;
  const cssWidth = containerWidth;
  const cssHeight = rows * cell + gap * (rows - 1);
  const ctx = sizeCanvasForDPR(canvas, cssWidth, cssHeight);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const cs = getComputedStyle(document.documentElement);
  const colorLived = cs.getPropertyValue("--accent-dim").trim();
  const colorCurrent = cs.getPropertyValue("--accent").trim();
  const colorBorder = cs.getPropertyValue("--border").trim();
  const radius = Math.max(1, cell * 0.18);
  const totalWeeks = rows * cols;
  const livedWeeks = Math.min(stats.weeksLived, totalWeeks);
  const currentIndex = stats.isPast ? -1 : livedWeeks;

  for (let i = 0; i < totalWeeks; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * (cell + gap);
    const y = row * (cell + gap);
    ctx.beginPath();
    roundRectPath(ctx, x, y, cell, cell, radius);
    if (i < livedWeeks) {
      ctx.fillStyle = colorLived;
      ctx.fill();
    } else if (i === currentIndex) {
      ctx.fillStyle = colorCurrent;
      ctx.shadowColor = colorCurrent;
      ctx.shadowBlur = cell * 0.9;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.lineWidth = 1;
      ctx.strokeStyle = colorBorder;
      ctx.stroke();
    }
  }
}

function setGridView(view, stats) {
  const isWeeks = view === "weeks";
  document.getElementById("years-grid").hidden = isWeeks;
  document.getElementById("weeks-canvas").hidden = !isWeeks;
  document.getElementById("tab-years").setAttribute("aria-selected", String(!isWeeks));
  document.getElementById("tab-weeks").setAttribute("aria-selected", String(isWeeks));

  const totalWeeks = stats.targetAgeYears * 52;
  document.getElementById("grid-sub").textContent = isWeeks
    ? `${Math.min(stats.weeksLived, totalWeeks).toLocaleString()} / ${totalWeeks.toLocaleString()}`
    : `${Math.min(stats.yearsLived, stats.targetAgeYears)} / ${stats.targetAgeYears}`;

  localStorage.setItem(GRID_VIEW_KEY, view);
  if (isWeeks) requestAnimationFrame(() => drawWeeksGrid(stats));
}

document.getElementById("tab-years").addEventListener("click", () => {
  if (lastStats) setGridView("years", lastStats);
});
document.getElementById("tab-weeks").addEventListener("click", () => {
  if (lastStats) setGridView("weeks", lastStats);
});
window.addEventListener(
  "resize",
  debounce(() => {
    if (!document.getElementById("weeks-canvas").hidden && lastStats) drawWeeksGrid(lastStats);
  }, 150)
);

// ---------- Home Screen app icon badge ----------

function updateAppBadge(stats) {
  if (!("setAppBadge" in navigator)) return; // not supported on iOS Safari/PWA today
  try {
    if (stats.isPast) navigator.clearAppBadge().catch(() => {});
    else navigator.setAppBadge(stats.daysLeft).catch(() => {});
  } catch {}
}

// ---------- rank-up celebration ----------

let rankUpTimer = null;

function celebrateRankUp(stats) {
  rankUpTitle.textContent = stats.rank;
  rankUpToast.hidden = false;
  if (navigator.vibrate) navigator.vibrate([15, 40, 15]);
  clearTimeout(rankUpTimer);
  rankUpTimer = setTimeout(() => {
    rankUpToast.hidden = true;
  }, 6000);
}

function checkRankUp(stats) {
  const raw = localStorage.getItem(LAST_SEEN_RANK_KEY);
  const lastSeen = raw === null ? null : Number(raw);
  if (lastSeen !== null && stats.rankIndex > lastSeen) celebrateRankUp(stats);
  localStorage.setItem(LAST_SEEN_RANK_KEY, String(stats.rankIndex));
}

rankUpDismiss.addEventListener("click", () => {
  clearTimeout(rankUpTimer);
  rankUpToast.hidden = true;
});

// ---------- backup / restore ----------

function exportBackup() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    birthdate: getStoredBirthdate(),
    settings: getSettings(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lifetime-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function validateBackupPayload(data) {
  if (!data || typeof data.birthdate !== "string" || validateBirthdate(data.birthdate)) {
    return "That file doesn't look like a valid Lifetime backup.";
  }
  return null;
}

exportDataBtn.addEventListener("click", exportBackup);
importDataBtn.addEventListener("click", () => importDataInput.click());

importDataInput.addEventListener("change", async () => {
  const file = importDataInput.files[0];
  importDataInput.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const err = validateBackupPayload(data);
    if (err) {
      editError.textContent = err;
      editError.hidden = false;
      return;
    }
    saveBirthdate(data.birthdate);
    const restoredAge = Number(data.settings?.targetAge);
    saveSettings({ targetAge: validateTargetAge(restoredAge) ? DEFAULT_TARGET_AGE : restoredAge });
    editError.hidden = true;
    renderDashboard();
    editScreen.hidden = true;
    editBtn.focus();
  } catch {
    editError.textContent = "That file doesn't look like a valid Lifetime backup.";
    editError.hidden = false;
  }
});

// ---------- live ticking clock (total seconds, the main event) ----------

const liveSecondsEl = document.getElementById("live-seconds");
const secondsLabelTextEl = document.getElementById("seconds-label-text");
const liveSubEl = document.getElementById("live-sub");

function updateLiveClock(endTimestamp) {
  const now = Date.now();
  const isPast = now >= endTimestamp;
  const diffMs = Math.abs(endTimestamp - now);
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  liveSecondsEl.textContent = totalSeconds.toLocaleString();
  secondsLabelTextEl.textContent = isPast ? "SECONDS OVER" : "SECONDS LEFT";
  liveSubEl.textContent = `${days.toLocaleString()} days · ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

// Ticks every second directly off the absolute end timestamp (never
// accumulates a running total), so background-tab throttling just means a
// jump to the correct value on the next tick rather than any drift.
function startLiveClock(endTimestamp) {
  clearInterval(liveClockTimer);
  updateLiveClock(endTimestamp);
  liveClockTimer = setInterval(() => updateLiveClock(endTimestamp), 1000);
}

// ---------- dashboard render ----------

function renderDashboard() {
  const birthdate = getStoredBirthdate();
  const { targetAge } = getSettings();
  const stats = computeLifeStats(birthdate, targetAge);
  lastStats = stats;

  document.querySelector(".hero").classList.toggle("overtime", stats.isPast);
  startLiveClock(stats.endTimestamp);

  const clampedPct = Math.min(100, stats.percentLived);
  const ringWrap = document.getElementById("ring-wrap");
  ringWrap.setAttribute("aria-valuenow", clampedPct.toFixed(1));
  requestAnimationFrame(() => {
    const offset = RING_CIRCUMFERENCE * (1 - clampedPct / 100);
    document.getElementById("ring-progress").style.strokeDashoffset = String(offset);
  });

  animateCountUp(document.getElementById("hero-percent"), 0, stats.percentLived, 1400, (v) => v.toFixed(1));
  document.getElementById("rank-label").textContent = stats.isPast
    ? `${stats.rank} · overtime by ${Math.abs(stats.rawDaysLeft).toLocaleString()} days`
    : stats.rank;
  document.getElementById("narrative-line").textContent = stats.narrative;

  animateCountUp(document.getElementById("stat-days-lived"), 0, stats.daysLived, 1200, intFmt);
  animateCountUp(document.getElementById("stat-days-left"), 0, stats.daysLeft, 1200, intFmt);
  animateCountUp(document.getElementById("stat-weeks-left"), 0, stats.weeksLeft, 1200, intFmt);
  document.getElementById("stat-time-left").textContent = stats.isPast
    ? "0y 0m 0d"
    : `${stats.timeLeft.years}y ${stats.timeLeft.months}m ${stats.timeLeft.days}d`;
  document.getElementById("stat-percent").textContent = `${stats.percentLived.toFixed(1)}%`;
  document.getElementById("stat-rank").textContent = stats.rank;

  document.getElementById("footer-assumption").textContent =
    `Assuming a ${stats.targetAgeYears}-year life. Recalibrate anytime.`;

  // Dashboard must be unhidden before the grid views are (re)built below —
  // drawWeeksGrid measures the canvas's parent width, which reads 0 while
  // #dashboard still has `hidden` set (display:none).
  onboardingScreen.hidden = true;
  editScreen.hidden = true;
  dashboard.hidden = false;

  renderYearsGrid(stats);
  const savedView = localStorage.getItem(GRID_VIEW_KEY) === "weeks" ? "weeks" : "years";
  setGridView(savedView, stats);

  checkRankUp(stats);
  updateAppBadge(stats);
}

// ---------- onboarding ----------

birthdateInput.max = todayISO();

onboardingForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const birthError = validateBirthdate(birthdateInput.value);
  const age = getAgeChipValue(onboardingAgeChips, onboardingAgeCustom);
  const ageError = validateTargetAge(age);

  onboardingError.hidden = !birthError;
  if (birthError) onboardingError.textContent = birthError;
  onboardingAgeError.hidden = !ageError;
  if (ageError) onboardingAgeError.textContent = ageError;
  if (birthError || ageError) return;

  saveBirthdate(birthdateInput.value);
  saveSettings({ targetAge: age });
  renderDashboard();
});

// ---------- edit ----------

editBtn.addEventListener("click", () => {
  editBirthdateInput.max = todayISO();
  editBirthdateInput.value = getStoredBirthdate() || "";
  editError.hidden = true;
  setAgeChipValue(editAgeChips, editAgeCustom, getSettings().targetAge);
  editAgeError.hidden = true;
  editScreen.hidden = false;
  editBirthdateInput.focus();
});

editCancel.addEventListener("click", () => {
  editScreen.hidden = true;
  editBtn.focus();
});

editForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const birthError = validateBirthdate(editBirthdateInput.value);
  const age = getAgeChipValue(editAgeChips, editAgeCustom);
  const ageError = validateTargetAge(age);

  editError.hidden = !birthError;
  if (birthError) editError.textContent = birthError;
  editAgeError.hidden = !ageError;
  if (ageError) editAgeError.textContent = ageError;
  if (birthError || ageError) return;

  saveBirthdate(editBirthdateInput.value);
  saveSettings({ targetAge: age });
  renderDashboard();
  editScreen.hidden = true;
  editBtn.focus();
});

clearDataBtn.addEventListener("click", () => {
  if (confirm("Clear all stored data? This can't be undone.")) {
    if ("clearAppBadge" in navigator) navigator.clearAppBadge().catch(() => {});
    localStorage.clear();
    location.reload();
  }
});

// ---------- install banner ----------

const installBanner = document.getElementById("install-banner");
const installBannerText = document.getElementById("install-banner-text");
const installBtn = document.getElementById("install-btn");
const installDismiss = document.getElementById("install-dismiss");

let deferredInstallPrompt = null;

function showInstallBannerIfEligible() {
  if (localStorage.getItem(INSTALL_DISMISSED_KEY)) return;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (isStandalone) return;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS) {
    installBannerText.textContent = "Add Lifetime to your Home Screen: tap Share, then “Add to Home Screen.”";
    installBtn.hidden = true;
    installBanner.hidden = false;
  } else if (deferredInstallPrompt) {
    installBannerText.textContent = "Add Lifetime to your Home Screen for a one-tap glance.";
    installBtn.hidden = false;
    installBanner.hidden = false;
  }
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBannerIfEligible();
});

installBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBanner.hidden = true;
});

installDismiss.addEventListener("click", () => {
  localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
  installBanner.hidden = true;
});

// ---------- boot ----------

function boot() {
  const birthdate = getStoredBirthdate();
  const error = birthdate ? validateBirthdate(birthdate) : "missing";
  if (error) {
    onboardingScreen.hidden = false;
    birthdateInput.focus();
  } else {
    renderDashboard();
    showInstallBannerIfEligible();
  }
}

boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
