# Code Rules

> HALQ-specific coding standards. Generic guidelines are skipped — these are the rules that actually matter for this codebase.

---

## 1. File Organization

- **All source code** lives in `src/`. Root level is for config, docs, and build artifacts only.
- `index.html` is the single-file UI — keep styles and renderer JS inline. No external CSS/JS files.
- Launcher code stays in `src/launcher/` — same rules apply.

## 2. Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Constants | `SCREAMING_SNAKE_CASE` | `APP_VERSION`, `UPDATE_URL` |
| Functions | `camelCase` | `loadWorkOrders()`, `saveSettings()` |
| DOM IDs | `kebab-case` | `#wo-list`, `#ctx-menu` |
| IPC channels | `halq:` prefix | `halq:save-creds`, `halq:get-profiles` |

## 3. IPC Bridge (`window.halq`)

- All main-to-renderer communication goes through `preload.js`.
- Never expose `require('electron')` or Node APIs directly to the renderer.
- Preload API shape:
  ```js
  window.halq = {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, callback) => ipcRenderer.on(channel, callback),
    // ...etc
  };
  ```

## 4. State & Persistence

- Profile data → `userdata/profiles/<id>/`
- Launcher data → `userdata/launcher/`
- Never commit `userdata/` — it's in `.gitignore` for a reason.
- Use `safeStorage` for credentials — they're machine-tied and non-transferable.

## 5. Versioning

- Format: `1.MAJOR.MINOR`
- Bump `APP_VERSION` in `src/main.js` **before** building.
- Update `releases/version.json` with the same version + release notes.
- Update `CHANGELOG.md` for anything user-facing.

## 6. Building & Patching

| Scenario | Command |
|----------|---------|
| Full rebuild | `npm run build` |
| Quick patch (no new deps) | `.\patch.ps1` |
| Dev mode | `npm start` |

- If you add/remove npm packages → **must** do a full rebuild.
- If only editing `src/*.js` or `src/*.html` → patch is fine.

## 7. UI Patterns (index.html)

- Use CSS custom properties for theming (`--bg-primary`, `--text-primary`, etc.).
- Modals: single overlay container, swap inner HTML. Don't create multiple modal roots.
- Context menus: two-panel slide layout (left rail → right options). No hover flyouts.
- Filter chips: `All`, `Overdue`, `Due Today` are fixed. Categories populate dynamically.

## 8. Git Workflow

```bash
# Day-to-day
npm start              # test
.\patch.ps1            # patch installed app
git add .
git commit -m "fix: [what changed]"
git push

# Release
# 1. Bump APP_VERSION in src/main.js
# 2. npm run build
# 3. cp dist/win-unpacked/resources/app.asar releases/app.asar
# 4. Update releases/version.json
# 5. git add . && git commit -m "Release vX.Y.Z" && git push
```

## 9. What NOT to Do

- Don't split `index.html` into separate CSS/JS files — it's intentionally a single file for asar-swap simplicity.
- Don't hardcode paths in `patch.ps1` — it reads from `$PSScriptRoot\src` now.
- Don't commit `releases/app.asar` — it's a 28MB binary that gets rebuilt every release.
- Don't change established code patterns unless there's a clear bug or feature need.

## 10. Changelog & README

- Auto-update `CHANGELOG.md` for releases.
- Auto-update `README.md` for major architectural changes (new features, breaking changes).
- Always check if there's a Git push pending before closing VS Code.
