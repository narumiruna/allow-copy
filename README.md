# Allow Copy

Allow Copy is a privacy-first Chrome extension that restores copying, text selection, right-click menus, and normal cursor behavior on sites that disable them.

## Features

- Opt in per hostname with no broad install-time host access.
- Restore text selection, context menus, copy and cut operations, and cursor styles independently.
- Detect common CSS and JavaScript restrictions.
- Apply Advanced Options immediately and save them per site in `chrome.storage.sync`.
- Show a badge when the current site is enabled.
- Preserve legacy boolean site settings through automatic normalization and migration.

## Install From Source

Requirements:

- Node.js 22.12 or newer.
- npm.

```bash
npm install
npm run build:chrome
```

Open `chrome://extensions/`, enable Developer mode, choose **Load unpacked**, and select `dist/chrome`.

## Usage

1. Open an HTTP or HTTPS page.
2. Open the Allow Copy popup.
3. Turn on **Enable for this site**.
4. Approve Chrome's permission prompt for that hostname.
5. Expand **Advanced Options** to enable or disable individual fixes.

The popup can close while Chrome displays the permission prompt.

The background service worker completes the pending enablement after permission is granted.

Protected browser pages and the Chrome Web Store are unsupported and leave the popup controls disabled.

## Privacy and Permissions

Allow Copy does not collect, transmit, or analyze browsing data.

The required permissions are:

- `activeTab` for the page associated with an explicit toolbar interaction.
- `storage` for per-site settings and pending permission state.
- `scripting` for the compiled content function.
- `webNavigation` for restoring behavior after navigation on enabled sites.

HTTP and HTTPS access remains in `optional_host_permissions` and is requested per hostname only when the user enables that site.

## Development

The extension uses Extension.js, React, strict TypeScript, and Radix UI Primitives, Themes, Colors, and Icons.

```bash
just help
just dev
just check
just e2e
just zip
just clean
```

Equivalent npm commands are available in `package.json`.

Extension.js writes production output to `dist/chrome`.

`just zip` creates `dist/chrome/allow-copy-<version>.zip` for Chrome Web Store upload.

## Testing

```bash
npm test
npm run typecheck
npm run build:chrome
npm run test:e2e
```

Vitest covers shared behavior and React state transitions.

Playwright builds and loads `dist/chrome`, then exercises only local fixtures so the suite does not depend on external sites.

See [`docs/TESTING.md`](docs/TESTING.md) for manual and automated coverage.

## Architecture

```text
src/
├── manifest.json
├── background.ts
├── content/install-content-script.ts
├── images/
├── lib/
├── popup/
└── types/
```

- `src/background.ts` updates the badge, coordinates permission completion, and injects enabled sites after navigation.
- `src/content/install-content-script.ts` is a self-contained function compiled and serialized through `chrome.scripting.executeScript({ func })`.
- `src/lib/storage.ts` preserves the existing sync schema and migrates legacy boolean entries.
- `src/popup/` contains the React and Radix UI popup with controlled pending and rollback states.
- `src/manifest.json` remains Chrome Manifest V3 with optional HTTP and HTTPS host access.

## Known Limitations

- Chrome internal pages and other protected extension pages cannot be modified.
- `pointer-events: none` is detected but not currently overridden.
- Sites with DRM or browser-enforced restrictions may remain unavailable.

## License

[MIT](LICENSE)
