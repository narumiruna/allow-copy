# Extension.js + Radix UI + TypeScript Migration Proposal

Status: Approved and in progress.

## Goal

Migrate Allow Copy to Extension.js 4, React, TypeScript, and the complete requested Radix UI stack while preserving current Chrome behavior, privacy boundaries, stored settings, and release capability.

The requested Radix stack means `radix-ui` primitives, `@radix-ui/themes`, `@radix-ui/colors`, and `@radix-ui/react-icons`.

## Context

- The extension is a Chrome Manifest V3 extension with one popup, one service worker, and a programmatically injected content script.
- The main user job is enabling copy and selection fixes for the current site.
- Per-site optional host permission is a required privacy boundary and must not become broad install-time access.
- A permission prompt can destroy the popup, so pending enablement in `chrome.storage.session` and background finalization must remain.
- Existing `chrome.storage.sync` site data supports legacy booleans and current `{ enabled, features }` objects.
- Existing tests cover storage migration, URL and error handling, site permission flow, pending enablement, and core browser behavior.
- The current Playwright real-site test is network-dependent and should be replaced by a deterministic local regression fixture.
- Extension.js 4.0.32 requires Node.js 22.12 or newer and supports TypeScript and React without custom bundler configuration.
- A local Extension.js 4.0.32 spike confirmed that `chrome.scripting.executeScript({ files })` copies runtime-loaded files without compiling TypeScript.
- A second local spike confirmed that a self-contained imported TypeScript function works with `chrome.scripting.executeScript({ func })` after Extension.js compilation.

References:

- https://extension.js.org/
- https://github.com/extension-js/extension.js
- https://www.radix-ui.com/themes/docs/overview/getting-started
- https://www.radix-ui.com/primitives/docs/overview/introduction
- https://www.radix-ui.com/colors
- https://www.radix-ui.com/icons

## Assumptions

- This migration remains Chrome-only even though Extension.js supports additional browsers.
- User-facing behavior and English copy remain recognizable, while emoji and custom controls are replaced by accessible Radix components and icons.
- Existing sync keys, site records, defaults, optional permissions, and badge semantics remain compatible.
- Advanced feature controls remain configurable while the site is disabled.
- No new analytics, remote services, or broad host permissions are introduced.

## Non-Goals

- Adding Firefox, Edge, or Safari support.
- Changing the storage schema or deleting unknown stored fields.
- Adding options, onboarding, side-panel, account, or telemetry surfaces.
- Expanding the content-script feature set beyond current selection, context-menu, copy/cut, and cursor behavior.
- Redesigning the extension icon or store promotional assets.

## Capability Classification

| Capability | Class | Presentation |
| --- | --- | --- |
| Current hostname and per-site enable switch | Primary | Always visible, labeled, and first after the product heading |
| Enabled, disabled, permission-required, unsupported, saving, and failure status | Safety/status | Visible beside the primary control with text and icon |
| Detected restrictions | Supporting | Visible summary below primary status when detection is available |
| Configured feature summary | Supporting | Visible summary that reflects the saved configuration |
| Four individual feature controls | Advanced | Keyboard-accessible Radix Collapsible with a stable label |
| Loading or unavailable detection | Safety/status | Non-blocking message that does not hide the saved site state |

## Architecture

### Source layout

```text
src/
├── manifest.json
├── background.ts
├── content/
│   └── install-content-script.ts
├── images/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── lib/
│   ├── extension-logic.ts
│   ├── site-enablement.ts
│   ├── site-permissions.ts
│   └── storage.ts
├── popup/
│   ├── App.tsx
│   ├── index.html
│   ├── main.tsx
│   ├── popup.css
│   └── popup-controller.ts
└── types/
    └── extension.ts
```

Tests and development tooling will also use TypeScript.

Static HTML test fixtures and JSON, YAML, CSS, and image assets remain in their native formats.

### Extension entrypoints

- `src/manifest.json` is the Extension.js manifest source.
- `src/background.ts` is compiled to the Manifest V3 service worker.
- `src/popup/index.html` loads the React TypeScript entrypoint.
- Extension.js emits the loadable Chrome extension to `dist/chrome`.
- Production packaging uses `extension build --browser=chrome --zip` instead of a hand-maintained file list.

### Content injection

- `installContentScript` will be a self-contained TypeScript function with no closed-over module values.
- Popup and background injection will use `chrome.scripting.executeScript({ func: installContentScript, target: { allFrames: true } })`.
- The function will keep the existing duplicate-injection guard, restriction detection, event interception, style lifecycle, message handling, storage lookup, and cleanup behavior.
- This avoids checked-in JavaScript runtime files and avoids Extension.js's uncompiled runtime-file path.
- A production-build Playwright test will prove that the compiled function remains injectable after bundling and minification.

### Popup state ownership

- A typed controller hook owns active-tab lookup, URL support checks, storage, permission reconciliation, injection, messaging, and rollback.
- React owns only rendered popup state and user events.
- The main switch is controlled and temporarily disabled while an enable or disable operation is pending.
- A failed mutation restores the last confirmed state and presents actionable status.
- Pending permission state remains in `chrome.storage.session` so background finalization survives popup destruction.

### Data compatibility

- `sites` and `uiState.advancedExpanded` remain in `chrome.storage.sync`.
- Legacy boolean site records continue to normalize and migrate.
- Existing feature values remain when a site is disabled.
- Existing optional host permissions remain optional and per-host.
- No destructive storage migration is required, so rollback can load the prior release without data conversion.

## Tech Stack

- Extension.js 4.x for development, build, preview, and ZIP packaging.
- React 19 for the popup render tree.
- TypeScript in strict, no-emit, bundler-resolution mode.
- `radix-ui` Collapsible primitive for Advanced Options.
- `@radix-ui/themes` for Theme, Switch, Checkbox, Badge, Callout, Card, Flex, Text, Heading, and layout primitives.
- `@radix-ui/colors` for semantic grass, slate, amber, and red color tokens used by popup CSS.
- `@radix-ui/react-icons` for globe, status, restriction, feature, and disclosure icons.
- Vitest for typed unit and component tests.
- Testing Library for accessible popup interaction tests.
- Playwright for production-bundle extension tests.
- Biome for TypeScript, TSX, JSON, and CSS formatting and linting.

Exact compatible patch versions will be locked by `package-lock.json` during implementation.

## Experience Proposal

- Keep a compact popup with one reading column and no navigation.
- Place the icon, product name, short description, and current hostname at the top.
- Present “Enable for this site” as a labeled Radix Themes Switch with the current state in nearby text.
- Use Radix Badge or Callout treatments for enabled, disabled, permission-required, unsupported, and failure states.
- Replace emoji with Radix icons while retaining text labels so color and icons are never the only state signal.
- Show Detected Restrictions and Configured Features as concise lists with semantic Radix color tokens.
- Use a Radix Collapsible for Advanced Options and Radix Themes Checkbox controls for all four feature flags.
- Preserve visible focus rings, logical tab order, reduced-motion behavior, and at least 32-pixel interactive rows within the constrained popup.
- Use Theme appearance derived from the browser color scheme without changing extension behavior.

## State Model

| State | Primary control | Status and recovery |
| --- | --- | --- |
| Loading tab and configuration | Disabled | “Loading current site…” |
| Supported and disabled | Off and enabled | “Disabled for this site”; configuration remains editable |
| Supported and enabled | On and enabled | “Enabled for this site” |
| Saving | Disabled at requested position | “Saving…” without discarding the last confirmed state |
| Permission required or denied | Reverted off | Explain that site access must be allowed and permit retry through the switch |
| Unsupported browser page | Off and disabled | “Not available on this page” with the unsupported-page label |
| Injection failure | Off and disabled | “Could not run on this page”; closing and reopening or navigating is the recovery path |
| Detection unavailable but configuration loaded | Normal saved state | Keep controls usable and show that restriction details are unavailable |
| Feature update failure | Revert the affected checkbox | Keep the previous valid configuration and show a non-destructive error |
| No restrictions found | Normal saved state | Explicit “No restrictions detected” result |
| No features selected | Normal site state | Explicit “No features enabled” result |

## Plan

- [x] Capture the current green baseline with `just check` and the deterministic subset of Playwright tests; `npm test` passed 24 tests and the local Playwright flow passed, while `just check` exposed 11 pre-existing Biome lint errors in `content.js` and `popup.js` before running tests.
- [x] Add a failing browser or component specification for a labeled switch, keyboard-operable Advanced Options, and mutation rollback; the focused Playwright run failed because no labeled `switch` role existed and a failed feature save left the checkbox unchecked.
- [x] Add Extension.js, React, TypeScript, Radix, Vitest, and Testing Library dependencies and configure strict type checking; `npm run typecheck` passes with TypeScript 7 strict mode.
- [x] Move the manifest and icon assets under `src/` and add Extension.js development, build, preview, and ZIP scripts; `npm run build:chrome` emits `dist/chrome/manifest.json` without runtime-risk warnings.
- [x] Port shared URL, permission, pending-enablement, and storage behavior to typed modules while retaining the existing behavioral tests; focused Vitest coverage passes and adds malformed-record and unknown-field compatibility cases.
- [x] Port content behavior to the self-contained `installContentScript` TypeScript function and update popup/background injection; production-build Playwright proves selection and context-menu restoration before and after reload.
- [x] Port the service worker to TypeScript modules while preserving badge, navigation, storage, install, permission-added, and injection behavior; unit tests cover coordination and Playwright verifies the compiled injection and badge.
- [x] Implement the React popup with Radix Primitives, Themes, Colors, and Icons; component tests verify accessible names, keyboard operation, controlled pending state, unsupported state, and failed-save rollback.
- [x] Replace the remote Izaax regression with `test/fixtures/blocked-interactions.html`; Playwright now runs without external page requests.
- [x] Update Playwright to build and load `dist/chrome` rather than raw source files; six browser tests cover enabled state, feature updates, reload persistence, URL-hint validation, unsupported pages, and compiled function injection.
- [x] Convert test files, Playwright configuration, local server, and version tooling to TypeScript; no maintained JavaScript, JSX, MJS, or CJS files remain outside generated or dependency directories.
- [x] Update `justfile`, CI, release workflow, `.gitignore`, and the version bump path for Extension.js output; `npm run zip` produced and `unzip -l` inspected the versioned store artifact.
- [x] Update `README.md`, `docs/TESTING.md`, and repository guidance to describe Extension.js commands, source layout, production output, and Radix/TypeScript architecture.
- [x] Run formatting, linting, type checking, unit/component tests, production build, ZIP packaging, and local Playwright tests; `just biome`, `npm run check` (25 Vitest tests), `npm run test:e2e` (6 Playwright tests), `npm run zip`, ZIP inspection, and `npm audit --omit=dev` passed.
- [x] Perform a final diff review for permission expansion, storage incompatibility, generated artifacts, console noise, inaccessible icon-only controls, and stale JavaScript references; no blocking finding remained, and hardening added malformed-storage normalization, unknown-field preservation, failed-mutation rollback, path-contained local serving, and target-tab URL validation.

## Acceptance Criteria

- The popup is rendered by React from TypeScript and uses every requested Radix package for an appropriate responsibility.
- All maintained runtime and test code is TypeScript or TSX.
- The extension builds through Extension.js and loads from `dist/chrome`.
- The Chrome Web Store ZIP is generated by Extension.js and contains the compiled manifest, popup, service worker, icons, and injectible content behavior.
- Install-time permissions remain `storage`, `activeTab`, `scripting`, and `webNavigation` with HTTP and HTTPS access remaining optional.
- Existing stored site configuration and advanced disclosure state continue to load without reset.
- Enabling, disabling, per-feature updates, badge updates, automatic navigation behavior, and permission finalization remain functional.
- Unsupported URLs fail safely and disable the primary switch.
- Permission denial and storage or messaging failures restore the previous confirmed UI state.
- The primary switch and every advanced checkbox have visible labels, keyboard focus, accessible names, and non-color status cues.
- Unit, component, and local Playwright tests are deterministic and pass without external network access.
- CI runs dependency installation, formatting/linting, type checking, tests, and an Extension.js production build.
- Documentation and release automation reference `src/manifest.json` and `dist/chrome`, not removed root JavaScript files.

## Risks

- Extension.js may transform a function passed to `chrome.scripting.executeScript` in a way that introduces closed-over bundle symbols.
- The content installer will therefore remain self-contained and be guarded by a production-build browser test.
- Radix Themes can increase popup bundle size compared with handwritten HTML and CSS.
- The build report and popup startup test will be reviewed, but no speculative custom tree-shaking layer will be added.
- Permission prompts can close the popup before its promise continues.
- Existing session-backed pending enablement and `permissions.onAdded` finalization will remain a required tested path.
- React controlled state can expose toggle races.
- The current queue semantics will be replaced only by one serialized typed mutation path with disabled pending controls and rollback.
- Extension.js requires Node.js 22.12 or newer.
- `package.json`, CI, and contributor documentation make that runtime requirement explicit.
- A full development-dependency `npm audit` reports six high findings through Extension.js tooling dependencies (`extract-zip`, `less`, and `image-size`).
- The production dependency audit is clean, the affected tooling consumes only trusted repository input in this workflow, and npm's offered fix is an incompatible downgrade to Extension.js 3.5.1, so this remains an upstream risk to monitor.

## Rollback / Recovery

- Storage remains backward-compatible, so the prior release can be restored without a data rollback.
- The old root JavaScript entrypoints will be removed only after the compiled Extension.js build passes unit and local browser tests.
- Build and packaging changes will be kept in the same migration so no release can accidentally package TypeScript source as the extension.

## Completion Checklist

- [x] Every Plan item is complete with passing evidence.
- [x] `npm run check` passes.
- [x] `npm run build:chrome` passes without runtime-risk warnings.
- [x] `npm run test:e2e` passes against `dist/chrome` without external network access.
- [x] The versioned ZIP is generated and inspected.
- [x] `git status --short` contains only intended source, test, documentation, and lockfile changes.
- [x] The completed plan is moved to `docs/plans/archived/`.
