.PHONY: zip clean help

# Get version from manifest.json
VERSION := $(shell grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)
ZIP_NAME := allow-copy-$(VERSION).zip

# Files to include in the zip
FILES := manifest.json \
         background.js \
         content.js \
         popup.html \
         popup.js \
         popup.css \
         icon16.png \
         icon48.png \
         icon128.png

help:
	@echo "Available targets:"
	@echo "  make zip    - Create a zip file for Chrome Web Store upload"
	@echo "  make clean  - Remove generated zip files"
	@echo "  make help   - Show this help message"

zip: $(FILES)
	@echo "Creating $(ZIP_NAME)..."
	@zip -q $(ZIP_NAME) $(FILES)
	@echo "✓ Created $(ZIP_NAME) successfully"
	@echo "  Version: $(VERSION)"
	@echo "  Ready for Chrome Web Store upload"

clean:
	@echo "Cleaning up..."
	@rm -f allow-copy-*.zip
	@echo "✓ Cleaned up zip files"
