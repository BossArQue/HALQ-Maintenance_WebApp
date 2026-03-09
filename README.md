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
halq/
├── main.js              ← Electron main process (IPC, file system, updater)
├── preload.js           ← Bridge between main and renderer (window.halq API)
├── index.html           ← Entire UI — all views, styles, and JS in one file
├── package.json         ← Dependencies + electron-builder config
├── .gitignore
├── releases/
│   ├── version.json     ← Hosted on GitHub — controls what version gets pushed to users
│   └── app.asar         ← Built app archive uploaded after each release (gitignored from /dist)
└── userdata/            ← Created at runtime — NEVER committed to Git
    ├── creds.enc        ← Encrypted Appfolio credentials (safeStorage)
    ├── pin.enc          ← Encrypted settings PIN
    ├── settings.json    ← Excel path, theme, layout, prefs
    ├── wo-tags.json     ← Per-WO follow-up dates and categories
    ├── categories.json  ← Category list
    ├── session/         ← Electron session data (cookies, login state)
    └── notes/           ← Notes data
        ├── notebooks.json
        ├── pages/
        └── assets/
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

```bash
# Install asar tool once
npm install -g @electron/asar

# Repack source into asar
asar pack . releases/app.asar --unpack-dir node_modules
```

3. Update `releases/version.json` with new version + notes
4. `git add releases/ && git commit -m "Update vX.Y.Z" && git push`

Users get it on next launch. **No installer redistribution needed.**

> **Note:** If you change `package.json` dependencies (add/remove npm packages), you need to rebuild with `npm run build` — the asar-swap method only works when native dependencies haven't changed.

---

## Multi-Profile / Launcher

The launcher allows multiple HALQ instances to run simultaneously with different Appfolio accounts, each with fully isolated data.

> **Status:** The launcher UI is designed and previewed. Full multi-profile support (profile-scoped `userdata/`, CLI `--profile` arg, isolated sessions) is the next implementation milestone.

### Planned structure

```
userdata/
└── profiles/
    ├── profiles.json            ← List of profiles (name, color, url, id)
    ├── talley-properties/       ← One folder per profile
    │   ├── creds.enc
    │   ├── settings.json
    │   ├── wo-tags.json
    │   ├── categories.json
    │   ├── session/
    │   └── notes/
    └── westside-management/
        └── ...
```

Each profile gets its own Electron session partition (`persist:appfolio-<id>`, `persist:outlook-<id>`), so login cookies are never shared between instances.

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
