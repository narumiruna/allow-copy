# Repository Guidelines

## Project Overview

This repository is a Chrome Manifest V3 extension built with Extension.js, React, TypeScript, and Radix UI.

The extension grants persistent access only after the user enables an individual HTTP or HTTPS hostname.

## Repository Structure

- Keep extension runtime source under `src/`.
- Keep the service worker in `src/background.ts`.
- Keep the self-contained injected function in `src/content/install-content-script.ts`.
- Keep popup React code and styles under `src/popup/`.
- Keep shared storage, permission, URL, and pending-enablement logic under `src/lib/`.
- Keep unit and component tests under `test/` and browser tests under `test/e2e/`.
- Treat `dist/` as generated Extension.js output.

## Code Style

- Write maintained runtime, test, and Node.js tooling code in TypeScript or TSX.
- Use two-space indentation, single quotes, and concise comments only where intent is not obvious.
- Keep `installContentScript` self-contained because Chrome serializes it for `chrome.scripting.executeScript({ func })`.
- Do not move runtime dependencies outside `installContentScript` unless a production-build browser test proves serialization still works.
- Use Radix UI primitives and themes for popup controls instead of hand-rolled switches, checkboxes, or disclosure widgets.

## Commands

- Run `just dev` to start Extension.js with Chrome and hot reload.
- Run `just build` to build the loadable extension at `dist/chrome`.
- Run `just check` for linting, type checking, Vitest, and a production build.
- Run `just e2e` for deterministic Playwright tests against `dist/chrome`.
- Run `just zip` to create `dist/chrome/allow-copy-<version>.zip`.
- Run `just clean` to remove generated build output.

## Security Boundaries

- Keep install-time permissions limited to `storage`, `activeTab`, `scripting`, and `webNavigation`.
- Keep HTTP and HTTPS host access in `optional_host_permissions`.
- Never replace per-site permission requests with broad required host access.
- Inject only into supported HTTP and HTTPS pages and fail safely elsewhere.
- Preserve the session-backed pending enablement flow because a permission prompt can destroy the popup.
- Do not add analytics, remote services, or browsing-data collection.

## Testing

- Follow `docs/TDD_POLICY.md` for observable behavior changes.
- Add regression coverage for storage compatibility, permission lifecycle, mutation rollback, and content injection changes.
- Keep unit tests deterministic and inject storage or permission fakes instead of using real browser state.
- Keep Playwright tests local and network-independent.
- Load `dist/chrome`, not TypeScript source, in extension browser tests.
- Use `test-restriction.html` and `test/fixtures/blocked-interactions.html` for interaction regressions.

## Releases

- Treat `src/manifest.json` as the extension version source.
- Use Extension.js ZIP output instead of maintaining a manual package file list.
- Do not dispatch release workflows, create tags, or publish packages without explicit authorization.
