# Daems Racing Pit Log

A quick phone app for Daems Racing Team mechanics to log **tire pressures** and **kart setups** at the track.

## What it does

- **Event**: driver, mechanic, date and circuit, entered once and attached to every entry.
- **Tire pressures**: session type and number, track condition, rim temperature, cold pressures (required), hot pressures (can be added later) and optional comments. After each save the form clears and the session number goes up by one.
- **Setup**: session number, category, engine, back end and front end, plus optional comments. Each new setup starts as a copy of the previous one, and the list shows what changed between setups.
- **Edit or delete** any entry by tapping it in the list at the bottom of its screen.
- **Export to Excel**: one `.xlsx` file with a *Tire pressures* sheet and a *Setups* sheet.
- **Saved on the device**: entries stay on the phone (browser storage) until you clear them. Export to Excel regularly as your backup.
- **Works offline** after the first visit, so a bad signal at the track is no problem.

## Using it on a phone

1. Open the app link (see below) in Safari (iPhone) or Chrome (Android).
2. Add it to the home screen: Safari: Share → *Add to Home Screen*. Chrome: menu ⋮ → *Add to Home screen* / *Install app*.
3. It now opens full screen like a normal app.

Each phone keeps its own entries. Entries are not shared between phones.

## Hosting (GitHub Pages)

The app is plain HTML, CSS and JavaScript: no build step.

1. Repository **Settings → Pages**.
2. *Source*: **Deploy from a branch**, branch **main**, folder **/ (root)**, then *Save*.
3. After a minute the app is live at `https://<github-user>.github.io/DRT-Pit-Log/`.

## Updating the app

Edit the files and push to `main`. When you change any file, also bump `VERSION` in `sw.js` (e.g. `drt-pitlog-v2`) so phones pick up the new version. Saved entries are kept across updates.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | Look and feel (Daems blue and yellow) |
| `app.js` | All app logic, storage and the Excel export |
| `sw.js` | Offline support |
| `manifest.webmanifest`, `icon-*.png`, `apple-touch-icon.png` | Home-screen app icon and name |
| `logo.png` | Daems Racing logo |
