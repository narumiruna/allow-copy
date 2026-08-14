set shell := ["bash", "-euo", "pipefail", "-c"]

default:
    @just help

help:
    @echo "Available recipes:"
    @echo "  just dev    - Start Extension.js with Chrome and hot reload"
    @echo "  just build  - Build the production Chrome extension"
    @echo "  just biome  - Format and lint with safe writes"
    @echo "  just check  - Run lint, type checks, tests, and a production build"
    @echo "  just test   - Run Vitest unit and component tests"
    @echo "  just e2e    - Build and run local Playwright extension tests"
    @echo "  just zip    - Create the versioned Chrome Web Store ZIP"
    @echo "  just clean  - Remove Extension.js build output"

dev:
    @npm run dev

build:
    @npm run build:chrome

biome:
    @npx biome check --write .

check:
    @npm run check

test:
    @npm test

e2e:
    @npm run test:e2e

zip:
    @npm run zip

clean:
    @npm run clean
