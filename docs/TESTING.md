# Testing Allow Copy

## Automated Checks

Install dependencies and the Playwright Chromium build once:

```bash
npm install
npx playwright install chromium
```

Run the normal repository gate:

```bash
just check
```

This checks Biome, strict TypeScript, Vitest, and the Extension.js production build.

Run browser tests against the compiled extension:

```bash
just e2e
```

Playwright loads `dist/chrome` and uses only local pages served from `127.0.0.1`.

Automated coverage includes:

- accessible popup switch, checkboxes, and Advanced Options disclosure,
- enabled state persistence after navigation,
- compiled `executeScript({ func })` content injection,
- selection and context-menu restoration,
- immediate and persisted per-feature updates,
- unsupported-page handling,
- storage migration and forward-compatible unknown fields,
- permission and pending-enablement behavior,
- popup mutation rollback after failed saves.

## Manual Chrome Check

1. Run `npm run build:chrome`.
2. Open `chrome://extensions/`.
3. Enable Developer mode.
4. Load `dist/chrome` as an unpacked extension.
5. Open `test-restriction.html` through a local HTTP server.
6. Open the popup and verify the hostname and detected restrictions.
7. Enable the site and approve the per-host permission prompt.
8. Verify selection, right-click, and copying work.
9. Reload the page and verify the behavior and badge persist.
10. Disable each Advanced Option separately and verify only that behavior returns to the site's control.
11. Reopen the popup and verify feature and disclosure preferences persist.
12. Open `chrome://extensions/` and verify the popup reports an unsupported page with disabled controls.

## Permission Lifecycle

Verify this path after permission-related changes:

1. Remove the extension's access for the test hostname in Chrome.
2. Ensure the site is disabled in sync storage.
3. Enable the site from the popup.
4. Approve the Chrome permission prompt even if the popup closes.
5. Reopen the popup and verify the site is enabled.
6. Deny the prompt on another hostname and verify the switch returns to off with recovery guidance.

## Storage Compatibility

Use DevTools only in a disposable extension profile.

- Set a legacy record such as `{ "sites": { "example.com": true } }` and verify all feature defaults load enabled.
- Keep a site disabled after changing feature values and verify those values remain.
- Confirm a failed feature save restores the last confirmed checkbox state.

## Release Artifact

```bash
just clean
just zip
unzip -l dist/chrome/allow-copy-<version>.zip
```

The ZIP must contain the compiled `manifest.json`, `action/`, `background/`, and `images/` paths.

It must not contain TypeScript source, tests, development profiles, or another ZIP.
