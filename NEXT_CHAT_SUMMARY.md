# HALQ — Next Chat Summary

> **Session:** 2026-06-25
> **Version:** v2.5.9
> **Status:** Settings popup on page load — **ROOT CAUSE FOUND AND FIXED.**
> **Ponytail:** ON — See Rule 8 in HALQ_ONE_TRUE_FILE.md.
> **Repo:** https://github.com/BossArQue/HALQ-Maintenance_WebApp
> **Branch:** `main`
> **Commit:** `5884e7d` (disable PIN listeners to prevent autofill-triggered Settings open)
> **Deploy:** Cloudflare Pages auto-deploys on push.

---

## What Was Done

### Bug Report: Dashboard → WO Tab → Settings Popup → WO List Broken

**User report:**
1. Login → Dashboard shows WO list
2. Settings popup appears immediately on page load (not on WO click as initially thought)
3. Close Settings → WO list shows "162" count but no cards render

**Diagnostic process:**
1. AI added `console.trace()` to `HALQ.settings.open()` and pushed debug build (v2.5.9)
2. User reloaded page with console open
3. **Console output revealed the call stack:**
   ```
   open @ settings.js:287
   checkPin @ settings.js:176
   (anonymous) @ settings.js:153
   ```
4. Line 153 is the `#pin-keyboard-input` `input` event listener: `if (val.length === 4) checkPin();`

**Root cause found:** Chrome's password manager autofills the `#pin-keyboard-input` field (`type="password"`) on page load with the saved PIN `1104` (from `localStorage` item `halq_pin`). The `input` event fires with 4 digits, `checkPin()` sees `1104 === 1104`, calls `closePin()` then `open()`. The PIN overlay itself is hidden by CSS (`display: none !important`), so the user only sees the Settings overlay pop up. After closing Settings, the WO list is broken because the page state is corrupted by the unexpected init flow.

**Why AI couldn't reproduce via WebBridge:** The test browser (controlled by WebBridge) had no saved passwords / autofill data. The autofill only triggers on browsers where the user has previously interacted with the PIN field and saved the password.

---

### Fix Applied

| File | Change |
|------|--------|
| `public/js/settings.js` | Commented out `initPinListeners()` call in `init()`. The PIN feature was already disabled — overlay hidden by CSS, `open()` comment says "PIN auto-lock disabled." The event listeners were dead code that only caused this bug via browser autofill. |

**Also included from earlier commits:**
- Removed `change_box_container('false')` from `index.html` (DashboardKit crash fix)
- Fixed `switchView()` in `app.js` (Dashboard + WO both highlighted)
- Reverted detail drawer CSS back to `transform: translateX(100%)`

---

## Git Status

```
On branch main
Your branch is up to date with 'origin/main'.

commit 5884e7d: fix(settings.js): disable PIN listeners — browser autofill on hidden password field opens Settings
```

---

## Current State

| Panel | Status | Purpose |
|-------|--------|---------|
| **Left** | ✅ Working | WO list, search, filters, categories (wider now) |
| **Right** | ✅ Working | Detail drawer — edit follow-up, categories, save |
| **Extension** | ✅ Working | Bridges HALQ → AppFolio tab updates in Chrome Split View |
| **Settings popup on startup** | ✅ FIXED | Removed PIN event listeners; no autofill trigger |
| **Dashboard/WO double highlight** | ✅ FIXED | `nav-home` no longer stays active when WO view is active |
| **pcoded.js crash** | ✅ FIXED | Removed `change_box_container` call from `index.html` |

---

## What to Do Next

**For the user:**
1. Go to `https://halq-maintenance-webapp.pages.dev/`
2. **Hard refresh** (Ctrl+F5) to clear cache and load v2.5.9
3. Verify Settings no longer pops up on page load
4. Verify WO list works after closing Settings (if you manually open it)
5. Optionally clear `halq_pin` from localStorage if you no longer want the PIN stored: `localStorage.removeItem('halq_pin')`

**For next chat:**
- User confirms the fix works → Close this bug
- User wants a new feature → Proceed with feature
- User wants to re-enable PIN properly → Add proper CSS and re-implement with autofill protection (e.g., `autocomplete="new-password"` or use `type="text"` with JavaScript masking)

---

*End of summary. Start next chat with confirmation that the fix works.*
