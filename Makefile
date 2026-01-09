.PHONY: zip clean help

# Get version from manifest.json
VERSION := $(shell grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)
ZIP_NAME := allow-copy-$(VERSION).zip

# Files to include in the zip
FILES := manifest.json \
         background.js \
         content.js \
         storage-utils.js \
         popup.html \
         popup.js \
         popup.css \
         icon16.png \
         icon48.png \
         icon128.png

help:
	@echo "Available targets:"
	@echo "  make zip    - Create a zip file for Chrome Web Store upload (fails if the zip already exists)"
	@echo "  make clean  - Remove generated zip files"
	@echo "  make help   - Show this help message"

zip: $(FILES)
	@if [ -z "$(VERSION)" ]; then \
		echo "Error: Could not extract version from manifest.json. Please check that the file exists and contains a valid 'version' field."; \
		exit 1; \
	fi
	@if [ -e "$(ZIP_NAME)" ]; then \
		echo "Error: $(ZIP_NAME) already exists. Run 'make clean' or remove it before creating a new archive."; \
		exit 1; \
	fi
	@command -v zip >/dev/null 2>&1 || { echo "Error: 'zip' command not found. Please install the 'zip' utility and try again."; exit 1; }
	@echo "Creating $(ZIP_NAME)..."
	@zip $(ZIP_NAME) $(FILES)
	@echo "✓ Created $(ZIP_NAME) successfully"
	@echo "  Version: $(VERSION)"
	@echo "  Ready for Chrome Web Store upload"

clean:
	@echo "Cleaning up..."
	@rm -f allow-copy-*.zip
	@echo "✓ Cleaned up zip files"
