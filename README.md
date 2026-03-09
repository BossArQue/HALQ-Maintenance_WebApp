# HALQ — Maintenance Command Center

A desktop app for property management work order tracking. Built with Electron.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Development Setup](#development-setup)
3. [Running in Dev Mode](#running-in-dev-mode)
4. [Building the Executable (.exe)](#building-the-executable-exe)
5. [Patching Without Rebuilding](#patching-without-rebuilding)
6. [Auto-Updater](#auto-updater)
7. [Multi-Profile / Launcher](#multi-profile--launcher)
8. [Git Workflow](#git-workflow)
9. [File Reference](#file-reference)

---

## Project Structure

```
HALQ-Maintenance/
├── main.js              ← Single entry point — launcher mode OR HALQ mode
├── preload.js           ← HALQ bridge (window.halq API)
├── index.html           ← HALQ UI — all views, styles, and JS
├── package.json         ← Dependencies + electron-builder config
├── .gitignore
├── assets/
│   └── icon.ico         ← App icon (256×256)
├── launcher/
│   ├── preload.js       ← Launcher bridge (window.launcher API)
│   └── index.html       ← Launcher UI — profile picker
├── releases/
│   ├── version.json     ← Hosted on GitHub — controls what version gets pushed to users
│   └── app.asar         ← Built app archive uploaded after each release (gitignored from /dist)
└── userdata/            ← Created at runtime next to HALQ.exe — NEVER committed to Git
    ├── profiles-db.json ← Profile list (name, color, url, id)
    ├── launcher/        ← Electron internal data for launcher mode
    └── profiles/
        └── <profileId>/
            ├── creds.enc
            ├── pin.enc
            ├── settings.json
            ├── wo-tags.json
            ├── categories.json
            ├── electron/
            ├── session/
            └── notes/
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
git clone https://github.com/BossArQue/HALQ-Maintenance.git
cd HALQ-Maintenance
npm install
```

---

## Running in Dev Mode

```bash
npm start
```

Opens the Launcher. Click a profile to open HALQ for that profile. All changes to source files take effect on the next `npm start` — no build step needed during development.

---

## Building the Executable (.exe)

```bash
npm run build
```

Produces a Windows installer at `dist/HALQ Setup 1.0.0.exe`. The single exe handles both the launcher and HALQ app — mode is determined by whether `--profile=<id>` is passed as an argument.

**After building**, copy the generated `app.asar` into `releases/` for the auto-updater:

```powershell
Copy-Item dist\win-unpacked\resources\app.asar releases\app.asar -Force
```

Then push `releases/` to GitHub (see [Git Workflow](#git-workflow)).

---

## Patching Without Rebuilding

For quick fixes that don't change `package.json` dependencies, you can swap just the source files inside the installed `app.asar` without running a full build.

### Using patch.ps1 (recommended)

1. Make your changes to `main.js`, `preload.js`, or `index.html`
2. Run `patch.ps1` from PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File "D:\OneDrive\DEEH\Project\HALQ - Maintenance\patch.ps1"
```

### Manual steps

```powershell
cd "C:\Users\rashe\AppData\Local\Programs\HALQ\resources"
asar extract app.asar app_src
cp "D:\OneDrive\DEEH\Project\HALQ - Maintenance\main.js" app_src\main.js
asar pack app_src app.asar
Remove-Item -Recurse -Force app_src
```

> **Note:** If you change `package.json` dependencies, you must do a full `npm run build` — the patch method only works when no new npm packages are added.

---

## Auto-Updater

HALQ uses a lightweight asar-swap updater — no extra dependencies required.

### How it works

1. On startup (3 seconds after launch), HALQ fetches `releases/version.json` from GitHub
2. If a newer version is found, an update banner appears
3. User clicks **Install & Restart** — HALQ downloads the new `app.asar`, swaps it in, and relaunches

### Releasing an update

**Step 1** — Bump the version in `main.js`:
```js
const APP_VERSION = '1.1.0'
```

**Step 2** — Build and copy asar:
```bash
npm run build
Copy-Item dist\win-unpacked\resources\app.asar releases\app.asar -Force
```

**Step 3** — Update `releases/version.json`:
```json
{
  "version": "1.1.0",
  "notes": "What changed in this release",
  "asarUrl": "https://raw.githubusercontent.com/BossArQue/HALQ-Maintenance/main/releases/app.asar"
}
```

**Step 4** — Push to GitHub:
```bash
git add releases/
git commit -m "Release v1.1.0"
git push
```

---

## Multi-Profile / Launcher

HALQ supports multiple simultaneous instances, each with a separate Appfolio account and fully isolated data.

### How it works

- Launching `HALQ.exe` with no arguments opens the **Launcher** (profile picker)
- Clicking a profile in the launcher spawns `HALQ.exe --profile=<id>`
- Each profile gets its own isolated folder under `userdata/profiles/<id>/`
- Session cookies are never shared between profiles (`persist:appfolio-<id>`)

### userdata layout

```
userdata/
├── profiles-db.json          ← Shared profile registry
├── launcher/                 ← Electron internal data for the launcher window
└── profiles/
    ├── <profileId-1>/        ← All data for profile 1
    │   ├── creds.enc
    │   ├── settings.json
    │   ├── session/
    │   └── notes/
    └── <profileId-2>/        ← All data for profile 2
        └── ...
```

---

## Git Workflow

### Day-to-day

```bash
git add .
git commit -m "Fix: describe what changed"
git push
```

### Releasing a version

```bash
# 1. Bump APP_VERSION in main.js
# 2. Build
npm run build
Copy-Item dist\win-unpacked\resources\app.asar releases\app.asar -Force

# 3. Update releases/version.json

# 4. Commit and push
git add .
git commit -m "Release v1.1.0"
git push
```

### Useful commands

```bash
git status          # See what's changed
git log --oneline   # See commit history
git diff            # See exact line changes
git pull            # Pull latest (if working on multiple machines)
```

---

## File Reference

| File | Purpose | Recompile needed? |
|---|---|---|
| `main.js` | Main process — launcher + HALQ modes, all IPC handlers | ❌ asar swap |
| `preload.js` | HALQ bridge (`window.halq`) | ❌ asar swap |
| `index.html` | HALQ UI | ❌ asar swap |
| `launcher/preload.js` | Launcher bridge (`window.launcher`) | ❌ asar swap |
| `launcher/index.html` | Launcher UI | ❌ asar swap |
| `package.json` (scripts/build) | Build config | ❌ no |
| `package.json` (dependencies) | npm packages | ✅ full rebuild |
| `releases/version.json` | Update manifest | ❌ just push to GitHub |
| `releases/app.asar` | Packaged source for updater | Built from `npm run build` |
| `userdata/` | Runtime data | Never committed |

---

## Notes

- `userdata/` is in `.gitignore` — credentials and personal data are never pushed to GitHub
- `safeStorage` encrypts credentials using the OS keychain — tied to machine and user account
- In a packaged build, `userdata/` is created next to `HALQ.exe` (not inside the asar)
- To roll back an update: rename `app.asar.bak` → `app.asar` in the `resources/` folder
- `app.asar.bak` created during auto-updates is safe to delete