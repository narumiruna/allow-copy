# Repository Guidelines

## Project Structure & Module Organization
This repository is a Manifest V3 Chrome extension.
- Core scripts: `background.js` (service worker), `content.js` (page interaction overrides), `popup.js` (popup behavior), `storage-utils.js` (shared storage and migration logic).
- UI files: `popup.html`, `popup.css`.
- Configuration: `manifest.json`.
- Documentation and manual tests: `README.md`, `docs/TESTING.md`, `test-restriction.html`.
- Store assets: `icon*.png`, `icon.svg`, and `promo/`.

Keep related changes grouped (for example, popup behavior updates should include corresponding UI and docs updates).

## Architecture Notes
- `background.js` updates badge state and injects scripts on enabled sites after navigation.
- `content.js` enforces selection/copy/context-menu behavior with capture-phase listeners and style injection.
- `storage-utils.js` normalizes and migrates per-site config in `chrome.storage.sync`.
- `popup.js` is the user control surface and should gracefully disable controls on unsupported URLs.

## Build, Test, and Development Commands
- `just help`: list available recipes.
- `just zip`: build `allow-copy-<version>.zip` for Chrome Web Store upload.
- `just clean`: remove generated zip files.
- `just test`: run unit tests if test files are present.
- `node --check background.js content.js popup.js storage-utils.js`: run quick syntax checks.

Local development flow:
1. Open `chrome://extensions/`
2. Enable Developer mode
3. Load this directory as unpacked extension
4. Reload the extension after code changes

## Coding Style & Naming Conventions
- JavaScript style: 2-space indentation, single quotes, concise comments only when needed.
- Naming: `camelCase` for functions/variables, `UPPER_SNAKE_CASE` for constants (e.g., `STYLE_ID`).
- Prefer explicit guard clauses for unsupported URLs and expected Chrome API errors.
- Preserve privacy-first architecture; do not add broad host permissions without clear need.

## Testing Guidelines
Testing is manual-first (see `docs/TESTING.md`).
- Verify per-site toggle ON/OFF behavior.
- Confirm auto-injection behavior on enabled sites after navigation.
- Validate unsupported pages (`chrome://`, Web Store) fail gracefully.
- Use `test-restriction.html` for regression checks of selection, copy/cut, and context menu behavior.

## Commit & Pull Request Guidelines
- Follow existing commit style: short, imperative, specific (e.g., `Refactor ...`, `Add ...`, `bump version to ...`).
- Keep commits focused to one logical change.
- PRs should include:
  - concise summary of behavior changes,
  - test steps/results,
  - screenshots/GIFs for popup UI changes,
  - linked issue (if applicable).

## Security & Permission Notes
- Keep permission scope minimal (`activeTab`, `storage`, `scripting`, `webNavigation`).
- Injection logic should only target supported `http/https` pages and fail safely elsewhere.

## TDD
- Read and follow `docs/TDD_POLICY.md` for implementation and refactoring work.
