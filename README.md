# HALQ — Maintenance Command Center

A desktop app for property management work order tracking. Built with Electron.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Development Setup](#development-setup)
3. [Running in Dev Mode](#running-in-dev-mode)
4. [Building the Executable (.exe)](#building-the-executable-exe)
5. [Auto-Updater](#auto-updater)
6. [Pushing Updates Without Recompiling](#pushing-updates-without-recompiling)
7. [Multi-Profile / Launcher](#multi-profile--launcher)
8. [Git Workflow](#git-workflow)
9. [File Reference](#file-reference)

---

## Project Structure

```
HALQ - Maintenance/          ← Source / raw project
├── main.js                  ← Electron main process (IPC, file system, updater)
├── preload.js               ← Bridge: window.halq API
├── index.html               ← All UI — views, styles, JS in one file
├── package.json             ← Dependencies + electron-builder config
├── patch.ps1                ← Quick asar patch script (no full rebuild)
├── .gitignore
├── launcher/
│   ├── index.html           ← Launcher UI (profile picker)
│   └── preload.js           ← window.launcher API
├── releases/
│   ├── version.json         ← Update manifest (hosted on GitHub)
│   └── app.asar             ← Built archive for auto-updater
└── userdata/                ← Created at runtime next to HALQ.exe — NEVER committed
    ├── profiles-db.json     ← Profile registry
    ├── launcher/            ← Electron session data for launcher
    └── profiles/<id>/       ← Per-profile isolated data
        ├── creds.enc
        ├── pin.enc
        ├── settings.json
        ├── wo-tags.json
        ├── categories.json
        ├── session/
        └── notes/

HALQ/                        ← Installed app (next to source on OneDrive)
└── resources/
    └── app.asar             ← Patch target for quick deploys
```

---

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [Git](https://git-scm.com/)

### Install

```bash
git clone https://github.com/YOUR_USERNAME/halq.git
cd halq
npm install
```

### Required `package.json`

Your `package.json` should look like this:

```json
{
  "name": "halq",
  "version": "1.0.0",
  "description": "HALQ Maintenance Command Center",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --win"
  },
  "dependencies": {
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "electron": "^29.0.0",
    "electron-builder": "^24.0.0"
  },
  "build": {
    "appId": "com.yourname.halq",
    "productName": "HALQ",
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    },
    "files": [
      "main.js",
      "preload.js",
      "index.html",
      "node_modules/**/*"
    ],
    "extraResources": [],
    "asar": true
  }
}
```

---

## Running in Dev Mode

```bash
npm start
```

The app opens directly. All changes to `index.html`, `main.js`, or `preload.js` take effect on the next `npm start` — no build step needed during development.

---

## Building the Executable (.exe)

```bash
npm run build
```

This produces a Windows installer in `dist/`. The installer packages everything into an `.exe` using NSIS.

**After building**, copy the generated `app.asar` from `dist/win-unpacked/resources/app.asar` into your `releases/` folder for the updater:

```bash
cp dist/win-unpacked/resources/app.asar releases/app.asar
```

Then push `releases/` to GitHub (see [Git Workflow](#git-workflow)).

---

## Auto-Updater

HALQ uses a lightweight asar-swap updater — no extra dependencies required.

### How it works

1. On startup (3 seconds after launch), HALQ fetches `releases/version.json` from your GitHub repo
2. If the version there is newer than the running version, a banner appears at the bottom of the screen
3. User clicks **Install & Restart** — HALQ downloads the new `app.asar`, swaps it in, and relaunches
4. Next launch runs the new code

### Releasing an update

**Step 1** — Bump the version in `main.js`:
```js
const APP_VERSION = '1.1.0'   // was 1.0.0
```

**Step 2** — Build:
```bash
npm run build
cp dist/win-unpacked/resources/app.asar releases/app.asar
```

**Step 3** — Update `releases/version.json`:
```json
{
  "version": "1.1.0",
  "notes": "Fixed urgent filter, improved theme persistence",
  "asarUrl": "https://raw.githubusercontent.com/YOUR_USERNAME/halq/main/releases/app.asar"
}
```

**Step 4** — Push to GitHub:
```bash
git add releases/
git commit -m "Release v1.1.0"
git push
```

Every running instance will see the update within 3 seconds of their next launch.

### Configuring the update URL

In `main.js`, set `UPDATE_URL` to your GitHub raw URL:

```js
const UPDATE_URL = 'https://raw.githubusercontent.com/YOUR_USERNAME/halq/main/releases'
```

Replace `YOUR_USERNAME` and `halq` with your actual GitHub username and repo name.

---

## Pushing Updates Without Recompiling

Because `app.asar` is just a zip of your source files, you can push updates by:

1. Editing `index.html`, `main.js`, or `preload.js`
2. Repacking manually (no full electron-builder run needed):

```powershell
# Install asar tool once
npm install -g @electron/asar

# Patch installed app (PowerShell)
$install = "D:\OneDrive\DEEH\Project\HALQ\resources"
cd $install
asar extract app.asar app_src
Copy-Item "D:\OneDrive\DEEH\Project\HALQ - Maintenance\index.html" app_src\index.html -Force
asar pack app_src app.asar
Remove-Item -Recurse -Force app_src
```

3. Update `releases/version.json` with new version + notes
4. `git add releases/ && git commit -m "Update vX.Y.Z" && git push`

Users get it on next launch. **No installer redistribution needed.**

> **Note:** If you change `package.json` dependencies (add/remove npm packages), you need to rebuild with `npm run build` — the asar-swap method only works when native dependencies haven't changed.

---

## Multi-Profile / Launcher

The launcher allows multiple HALQ instances to run simultaneously with different Appfolio accounts, each with fully isolated data.

> **Status:** Fully implemented. The launcher and HALQ app are merged into a single executable — mode is determined by the presence of a `--profile=<id>` argument.

### How it works

- No `--profile` arg → **Launcher mode** → shows `launcher/index.html` (profile picker)
- `--profile=<id>` → **HALQ mode** → loads `index.html` with that profile's isolated data

### Data structure

```
userdata/                         ← Created next to HALQ.exe
├── profiles-db.json              ← Profile registry (name, color, appfolio URL)
├── launcher/                     ← Electron session for launcher window
└── profiles/<id>/                ← One folder per profile
    ├── creds.enc
    ├── pin.enc
    ├── settings.json
    ├── wo-tags.json
    ├── categories.json
    ├── session/                  ← persist:appfolio-<id>, persist:outlook-<id>
    └── notes/
```

Each profile gets its own Electron session partition — login cookies are never shared between instances.

---

## Git Workflow

### Initial setup (first time)

```bash
# In your project folder
git init
git add .
git commit -m "Initial commit"

# Create repo on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/halq.git
git branch -M main
git push -u origin main
```

### Day-to-day pushing updates

```bash
# 1. Make your changes to index.html / main.js / preload.js

# 2. Stage all changes
git add .

# 3. Commit with a message
git commit -m "Fix: urgent filter, persist theme"

# 4. Push to GitHub
git push
```

### Pushing a release (with updater)

```bash
# 1. Bump APP_VERSION in main.js
# 2. Build
npm run build
cp dist/win-unpacked/resources/app.asar releases/app.asar

# 3. Update releases/version.json

# 4. Commit and push
git add .
git commit -m "Release v1.1.0 — theme persistence, filter fixes"
git push
```

### Branching (optional but recommended)

```bash
# Create a branch for a new feature
git checkout -b feature/multi-profile

# Work on it, then merge back
git checkout main
git merge feature/multi-profile
git push
```

### Useful commands

```bash
git status          # See what's changed
git log --oneline   # See commit history
git diff            # See exact line changes before committing
git pull            # Pull latest from GitHub (if working on multiple machines)
```

---

## File Reference

| File | Purpose | Recompile needed on change? |
|---|---|---|
| `index.html` | All UI, styles, renderer JS | ❌ No — asar swap |
| `main.js` | IPC handlers, Node.js logic, updater | ❌ No — asar swap |
| `preload.js` | Bridge API (`window.halq`) | ❌ No — asar swap |
| `package.json` (scripts/build only) | Build config | ❌ No |
| `package.json` (dependencies) | npm packages | ✅ Yes — full rebuild |
| `releases/version.json` | Update manifest | ❌ No — just push to GitHub |
| `releases/app.asar` | Packaged source | Built from `npm run build` |
| `userdata/` | Runtime data | Never committed |

---

## Notes

- `userdata/` is in `.gitignore` — credentials and personal data are never pushed to GitHub
- `safeStorage` encrypts credentials using the OS keychain — they are tied to the machine and user account, not transferable
- The `app.asar.bak` file created during updates is safe to delete
- To roll back an update manually: rename `app.asar.bak` to `app.asar` in the `resources/` folder of your install directory
---

## Key Behaviors (index.html)

### Appfolio Advanced Search
WO clicks and the "Open in Appfolio" button both fire:
```
{afBaseUrl}/search/advanced_search?full_text_search={WO#}&section_keys=work_orders
```
Results are scoped to Work Orders only via `section_keys=work_orders`.

### Follow-up Date — Weekend Skipping
"Tomorrow" and "Next Day" are business-day-aware:

| Today | Tomorrow | Next Day |
|-------|----------|----------|
| Thursday | Friday | Monday |
| Friday | Monday | Tuesday |
| Saturday | Monday | Tuesday |

### Auto Due Date on New WOs
On every Excel load, WOs that have no saved tag and are ≤ 2 **business** days old get a follow-up date of `today + 3 business days` assigned silently. Business-day age is used (not calendar age) so weekend-created WOs are correctly detected on Monday.

### Category Drag-and-Drop Sort
Categories can be reordered via drag-and-drop in the Category Manager modal. The `⠿` handle on the left of each row is the grab target. New order is saved immediately to `categories.json`.