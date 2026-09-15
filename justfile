set shell := ["bash", "-euo", "pipefail", "-c"]

default:
    @just help

help:
    @echo "Available recipes:"
    @echo "  just install - Install npm dependencies when needed"
    @echo "  just dev     - Start Extension.js with Chrome and hot reload"
    @echo "  just build   - Build the production Chrome extension"
    @echo "  just biome  - Format and lint with safe writes"
    @echo "  just check  - Run lint, type checks, tests, and a production build"
    @echo "  just test   - Run Vitest unit and component tests"
    @echo "  just e2e    - Build and run local Playwright extension tests"
    @echo "  just zip    - Create the versioned Chrome Web Store ZIP"
    @echo "  just clean  - Remove Extension.js build output"

install:
    @if [[ ! -x node_modules/.bin/extension ]] || \
        [[ ! -f node_modules/.package-lock.json ]] || \
        [[ package.json -nt node_modules/.package-lock.json ]] || \
        [[ package-lock.json -nt node_modules/.package-lock.json ]]; then \
        npm install; \
    fi

dev: install
    @npm run dev

build: install
    @npm run build:chrome

biome: install
    @npx biome check --write .

check: install
    @npm run check

test: install
    @npm test

e2e: install
    @npm run test:e2e

zip: install
    @npm run zip

clean:
    @npm run clean
