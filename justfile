set shell := ["bash", "-euo", "pipefail", "-c"]

default:
    @just help

help:
    @echo "Available recipes:"
    @echo "  just zip    - Create a zip file for Chrome Web Store upload (fails if the zip already exists)"
    @echo "  just test   - Run unit tests (if present)"
    @echo "  just clean  - Remove generated zip files"
    @echo "  just help   - Show this help message"

zip:
    @version="$$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)"; \
    if [[ -z "$$version" ]]; then \
        echo "Error: Could not extract version from manifest.json. Please check that the file exists and contains a valid 'version' field."; \
        exit 1; \
    fi; \
    zip_name="allow-copy-$$version.zip"; \
    if [[ -e "$$zip_name" ]]; then \
        echo "Error: $$zip_name already exists. Run 'just clean' or remove it before creating a new archive."; \
        exit 1; \
    fi; \
    command -v zip >/dev/null 2>&1 || { echo "Error: 'zip' command not found. Please install the 'zip' utility and try again."; exit 1; }; \
    echo "Creating $$zip_name..."; \
    zip "$$zip_name" \
      manifest.json \
      background.js \
      content.js \
      storage-utils.js \
      popup.html \
      popup.js \
      popup.css \
      icon16.png \
      icon48.png \
      icon128.png; \
    echo "✓ Created $$zip_name successfully"; \
    echo "  Version: $$version"; \
    echo "  Ready for Chrome Web Store upload"

clean:
    @echo "Cleaning up..."
    @rm -f allow-copy-*.zip
    @echo "✓ Cleaned up zip files"

test:
    @if compgen -G "test/*.test.js" >/dev/null; then \
        node --test test/*.test.js; \
    else \
        echo "No unit tests found (skipping)."; \
    fi
