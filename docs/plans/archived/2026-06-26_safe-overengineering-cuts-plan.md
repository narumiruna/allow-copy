## Goal

Remove the three low-risk over-engineering leftovers without changing extension behavior: unused `getSiteFeatures`, thin local wrapper functions, and unused ESLint config. Success means the repo has fewer dead/delegating paths, no remaining references to removed symbols/config, and existing checks still pass.

## Context

Current evidence:
- `getSiteFeatures` appeared only in `storage-utils.js` definition/export sites before implementation.
- `background.js` wrappers `getEnabledSites` and `isSiteEnabled` only delegated to `StorageUtils` and had one internal call path each.
- `popup.js` wrappers `getSiteConfig` and `setSiteConfig` only delegated to `StorageUtils` and were only used inside `popup.js`.
- `eslint.config.js` was the only non-plan `eslint` reference; `package.json`, `justfile`, and CI use Biome, `node --check`, and `node --test`.

## Non-Goals

- Do not change popup toggle queue behavior.
- Do not replace Advanced Options with `<details>`.
- Do not simplify `content.js` timing/head/body injection logic.
- Do not remove `.pre-commit-config.yaml`.

## Assumptions

- `StorageUtils` is internal to this extension; removing an unused export is acceptable when `rg` confirms no repository consumer.
- Existing unit tests are sufficient for this behavior-preserving cleanup; no new tests are needed because this is deletion/inline delegation, not a behavior change.

## Plan

- [x] Remove `getSiteFeatures` from `storage-utils.js` implementation and both export objects to eliminate dead API surface; verified with `! rg -n "\\bgetSiteFeatures\\b" --glob '!node_modules' --glob '!docs/plans/**'` and `node --test test/storage-utils.test.js` passing 5 tests.
- [x] Inline `background.js` wrappers by replacing `getEnabledSites()` with `StorageUtils.getAllSites()` and `isSiteEnabled(hostname)` with `StorageUtils.isSiteEnabled(hostname)`, then delete the wrapper functions; verified with `! rg -n "async function (getEnabledSites|isSiteEnabled)\\(|\\bgetEnabledSites\\(" background.js` and `node --check background.js` passing.
- [x] Inline `popup.js` wrappers by replacing local `getSiteConfig(...)` and `setSiteConfig(...)` calls with `StorageUtils.getSiteConfig(...)` and `StorageUtils.setSiteConfig(...)`, then delete the wrapper functions; verified with `! rg -n "async function (getSiteConfig|setSiteConfig)\\(|[^.]\\b(getSiteConfig|setSiteConfig)\\(" popup.js` and `node --check popup.js` passing.
- [x] Delete `eslint.config.js` to remove unused tool config; verified with `test ! -e eslint.config.js` and `! rg -n "eslint" --glob '!node_modules' --glob '!docs/plans/**' .` passing.
- [x] Run the repo's existing fast validation after all edits; verified with `just test` passing 19 tests and `node --check background.js content.js popup.js storage-utils.js extension-logic.js site-enablement.js site-permissions.js` passing.
- [x] Review the final diff to confirm only the planned deletions/inlines happened; verified by reviewing `git diff -- background.js popup.js storage-utils.js eslint.config.js`.

## Risks

- Removing an export could affect an out-of-repo consumer only if someone manually imports extension internals; accepted because this Chrome extension does not expose `StorageUtils` as a public API.
- Deleting `eslint.config.js` could affect a contributor's personal ESLint command; mitigated by `rg` showing no repo scripts, CI, docs, or package dependency reference ESLint.

## Rollback / Recovery

- If validation fails, revert only the failing slice with `git checkout -- <path>` and keep independent successful slices.
- If hidden ESLint usage is later reported, restore `eslint.config.js` from git history instead of adding new lint tooling.

## Completion Checklist

- [x] Dead `getSiteFeatures` API is gone, verified by `! rg -n "\\bgetSiteFeatures\\b" --glob '!node_modules' --glob '!docs/plans/**'` returning no matches.
- [x] Thin wrappers are gone from `background.js` and `popup.js`, verified by targeted `rg` checks and `node --check background.js popup.js` passing.
- [x] Unused ESLint config is gone, verified by `test ! -e eslint.config.js` and no non-plan, non-`node_modules` `eslint` references.
- [x] Existing behavior checks pass, verified by `just test` passing 19 tests plus syntax checks for all extension scripts.
- [x] Final diff contains only the planned cleanup, verified by `git diff -- background.js popup.js storage-utils.js eslint.config.js` review.
