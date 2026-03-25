# Repository Guidelines

## Project Structure & Module Organization
This repository is a Manifest V3 Chrome extension.
- Core scripts: `background.js` (service worker), `content.js` (page interaction overrides), `popup.js` (popup behavior), `storage-utils.js` (shared storage and migration logic).
- UI files: `popup.html`, `popup.css`.
- Configuration: `manifest.json`.
- Documentation and manual tests: `README.md`, `docs/TESTING.md`, `test-restriction.html`.
- Store assets: `icon*.png`, `icon.svg`, and `promo/`.

Keep related changes grouped (for example, popup behavior updates should include corresponding UI and docs updates).

## Build, Test, and Development Commands
- `make help`: list available build targets.
- `make zip`: build `allow-copy-<version>.zip` for Chrome Web Store upload.
- `make clean`: remove generated zip files.
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

## Gotcha

- Read `docs/GOTCHA.md` (case-sensitive, in docs/) at session start; it MUST NOT be assumed to be auto-loaded.
- Apply relevant entries explicitly in root-cause analysis, fix design, and prevention checks.
- If the agent makes a mistake, add or update an entry in the same session; each entry MUST capture only a **non-obvious, experience-derived pitfall** with symptom, root cause, and prevention rule.

## Taste

- Read `docs/TASTE.md` (case-sensitive, in docs/) at session start; it MUST NOT be assumed to be auto-loaded.
- Apply relevant entries explicitly in recommendations, implementation choices, and tradeoff decisions.
- If the user expresses a stable preference, add or update an entry in the same session; each entry MUST capture only a **concrete, reusable preference signal** that should affect future decisions.

## TDD

- Read `docs/TDD_POLICY.md` at session start; it MUST NOT be assumed to be auto-loaded.
- Apply rules strictly during implementation and code changes.

## Changelog

- Append ONE line to the end of `docs/CHANGELOG.md`.
- Format: `YYYY-MM-DD | type(scope): summary (#ref)`.
