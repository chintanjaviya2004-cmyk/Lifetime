# Lifetime

A gamified countdown of your one life — installed as a Home Screen PWA, with
a bonus native-feeling widget on iOS.

Assumes a life expectancy from your birthdate — 60 years by default, editable
any time. Everything runs client-side; your data is stored only in your
browser's `localStorage`, never sent anywhere.

## Run locally

```
python3 -m http.server 8080
```

Open `http://localhost:8080`. To sanity-check on your phone before
deploying, find your computer's LAN IP (`ipconfig getifaddr en0` on macOS)
and open `http://<that-ip>:8080` on your phone while on the same Wi-Fi.
Note: the service worker only registers over `localhost` or HTTPS, so full
offline behavior needs the real deployed URL to test.

## Deploy to GitHub Pages

1. `git init -b main` (if not already a repo)
2. `git add -A && git commit -m "Initial commit"`
3. Create a GitHub repo under your own account (github.com "New repository",
   or `gh repo create Lifetime --public --source=. --remote=origin` if you
   have the GitHub CLI authenticated)
4. `git push -u origin main`
5. In the repo: **Settings → Pages → Source: Deploy from a branch**, branch
   `main`, folder `/ (root)`
6. Wait 1-2 minutes, then visit `https://<your-username>.github.io/Lifetime/`

On your phone, open that URL and:
- **iOS Safari:** Share → Add to Home Screen
- **Android Chrome:** menu → Install app (or the in-app install banner)

## The "widget" (no push notifications needed)

### iOS — Scriptable (recommended, looks native)

1. Install **Scriptable** (free) from the App Store.
2. Open it, tap **+**, paste in the contents of
   [`widget/scriptable-life-widget.js`](widget/scriptable-life-widget.js),
   name the script "Lifetime".
3. Edit the `BIRTHDATE` constant at the top of the script to your birthdate.
   If you've changed your life expectancy in the app's Settings, also edit
   `TARGET_AGE` in the script to match — the script can't read the app's
   storage, so this one value has to be kept in sync by hand.
4. Long-press your Home Screen → **+** → search "Scriptable" → add a Small
   or Medium widget.
5. Long-press the new widget → **Edit Widget** → set Script to "Lifetime".

iOS controls how often widgets refresh (roughly every 15-30 minutes) — this
can't be sped up from the script, but it's plenty for a decades-long
countdown.

### Android — webview widget (fallback, lower fidelity)

There's no single universal equivalent to Scriptable on Android without
writing a native app. The practical approximation: an app that can render a
URL inside a home-screen widget (e.g. **Widgy**), pointed at:

```
https://<your-username>.github.io/Lifetime/widget.html
```

Add `?bg=transparent` if your widget host supplies its own card background.
This is intentionally a simpler, less "native" experience than the iOS
Scriptable widget — it's a compact webpage, not a real widget renderer.

## Editing your birthdate or life expectancy

Tap the pencil icon in the app header. You can change your birthdate and
pick a life expectancy (60/70/80/90, or a custom number of years via the
"Custom" chip). The Android widget route and the main app both read this
same setting; the iOS Scriptable widget needs its `TARGET_AGE` constant
updated by hand (see above). There's also a "Clear all data" link in that
panel if you want to fully reset (useful for testing).

## Backup and restore

Since everything lives only in this browser's `localStorage`, clearing site
data or switching devices would otherwise lose it. In the edit panel:
- **Export backup** downloads a small JSON file with your birthdate and
  settings.
- **Restore backup** lets you pick that file back in (on this device or a
  new one) — it overwrites your current birthdate/settings after validating
  the file.

## Home Screen app icon badge

Where the platform supports it (Android Chrome and desktop Chrome/Edge
installed PWAs), the app puts your current days-left count right on the
Home Screen icon itself — no need to even open the app. iOS Safari/PWA does
not support this API yet, so this is a bonus on the platforms that have it,
not something to rely on for iOS.

## Years / Weeks view

Below the stats you can switch between two visualizations of the same
progress: **Years** (one square per year of your life expectancy) and
**Weeks** (the well-known "life in weeks" grid — one square per week,
52 per year). Your last choice is remembered. The weeks grid is rendered on
a `<canvas>` for performance (a 60-year life expectancy is 3,120 cells).

## Project structure

- `lifemath.js` — all date math (age, days left, % lived, rank), pure
  functions, the source of truth. `widget/scriptable-life-widget.js` is a
  hand-ported copy (Scriptable has no ES modules) — keep them in sync if
  this changes.
- `index.html` / `styles.css` / `app.js` — the main app
- `widget.html` / `widget.js` — compact route for the Android widget fallback
- `manifest.json` / `service-worker.js` — PWA install + offline support
- `icons/gen_icons.py` — regenerates the app icons if you want to restyle them

## Releasing an update

If you change any cached file, bump `CACHE_NAME` in `service-worker.js`
(e.g. from `lifetime-v2` to `lifetime-v3`) so installed devices pick up the
new version instead of serving stale cached assets.
