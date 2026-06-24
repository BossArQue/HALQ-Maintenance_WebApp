# HALQ AppFolio Bridge — Browser Extension

Allows AppFolio and Outlook to load inside HALQ's embedded browser panel by removing the `X-Frame-Options` and `Content-Security-Policy` headers that block embedding. Also includes client-side patches to prevent AppFolio's JavaScript from detecting and blanking the iframe.

## Install (Chrome / Edge)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. **Allow** permissions when prompted (access to appfolio.com and outlook.com)
6. Done — the extension is now active

## Important Limitation: SSO Login in Iframes

**AppFolio's OAuth login flow cannot complete inside a cross-origin iframe** because modern Chrome blocks third-party cookies in iframes. This causes an infinite redirect loop (`ERR_TOO_MANY_REDIRECTS`) when AppFolio tries to log you in.

**Workaround:** When you see the "AppFolio login requires a new tab" message, click **"Open AppFolio in New Tab"** to log in. After logging in, return to HALQ and the AppFolio tab will work.

## Verify

1. Open HALQ in your browser
2. Click the **AppFolio** tab in the middle panel
3. If AppFolio shows a login page, use the **"Open AppFolio in New Tab"** button
4. Log in, then return to HALQ
5. AppFolio should now load inside the iframe

## How it works

- **Header stripping:** Uses Chrome's `declarativeNetRequest` API to remove `X-Frame-Options` and `CSP` headers from `*.appfolio.com` and `outlook.office.com`
- **Client-side patches:** Content script patches `window.self`, `window.parent`, `window.frameElement`, and prevents DOM blanking to stop AppFolio's JavaScript iframe-busting
- **Error detection:** The HALQ app detects Chrome's net-error page (`ERR_TOO_MANY_REDIRECTS`) and shows a helpful fallback with "Open in New Tab"

## Troubleshooting

- **"Redirected too many times":** This is the SSO cookie issue described above. Use the "Open in New Tab" button.
- **Extension not active:** Make sure the extension shows as "Enabled" on `chrome://extensions/` and has `host_permissions` for `*.appfolio.com`.
- **Still blank after login:** Some SaaS platforms have aggressive iframe detection that can't be fully patched. The new-tab fallback is the reliable solution.
