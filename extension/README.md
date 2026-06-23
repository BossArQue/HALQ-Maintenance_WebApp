# HALQ AppFolio Bridge — Browser Extension

Allows AppFolio and Outlook to load inside HALQ's embedded browser panel by removing the `X-Frame-Options` and `Content-Security-Policy` headers that block embedding.

## Install (Chrome / Edge)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. Done — the extension is now active

## Verify

1. Open HALQ in your browser
2. Click the **AppFolio** tab in the middle panel
3. AppFolio should load inside the iframe (not a blank/error page)
4. Log in to AppFolio inside the iframe (first time only)

## How it works

- The extension uses Chrome's `declarativeNetRequest` API
- It intercepts responses from `talley.appfolio.com` and `outlook.office.com`
- It removes the headers that tell the browser "don't allow this page in an iframe"
- No scripts, no popups, no data collection — purely header removal

## Troubleshooting

- **Third-party cookies:** If login doesn't persist, check that third-party cookies are allowed for `talley.appfolio.com`. In Chrome: `Settings → Privacy → Cookies → See all site data → Add [*.]talley.appfolio.com`.
- **Extension not active:** Make sure the extension shows as "Enabled" on `chrome://extensions/`.
