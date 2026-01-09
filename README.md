# Allow Copy

A Chrome extension that enables copying and text selection on websites that disable these features.

## Features

- Per-site opt-in toggle (disabled by default)
- Restore interactions (configurable per site):
  - Text selection
  - Right-click context menu
  - Copy/cut operations
  - Cursor normalization
- Detect restrictions and show them in the popup:
  - CSS: `user-select`, `pointer-events`, cursor styles
  - JS: document-level handlers like `oncontextmenu`, `onselectstart`, `oncopy`
- Advanced Options update immediately (when enabled) and are saved per site via `chrome.storage.sync`
- ✓ badge indicator when enabled for the current site
- Privacy-first permission model: `activeTab` (no `<all_urls>` host permissions)

## Installation

### From Source (Developer Mode)

1. Clone this repository or download the source code:

   ```bash
   git clone https://github.com/narumiruna/allow-copy.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" using the toggle in the top-right corner

4. Click "Load unpacked" button

5. Select the `allow-copy` folder

6. The extension is now installed and active!

## How It Works

The extension uses the `activeTab` permission model for enhanced privacy and security:

- When you click the extension icon, it gains temporary access to the current tab
- The popup injects the content script into the current page to detect restrictions and (optionally) apply fixes
- For sites you've enabled, the background script attempts to re-inject on navigation to maintain functionality
- No broad permissions are requested - the extension only works where you want it

If the extension doesn’t apply automatically after navigation, open the popup once on that page to grant access and re-inject.

The content script:

- Intercepts and stops propagation of events that websites use to disable right-clicking
- **Avoids right-click navigation** on sites that hijack right-click (automatically learns this per tab session and then prevents default on right-button `mousedown`/`mouseup`)
- **Allows browser context menu** by not preventing default on `contextmenu` event
- Overrides CSS properties that prevent text selection (and can normalize cursor styles)
- Prevents websites from overriding browser default behaviors
- Re-injects its override style if the page removes it
- Can be toggled on/off per-site via the extension popup

## Usage

### First Time Setup

1. Visit a website where you want to enable copying and text selection
2. Click the extension icon in your browser toolbar to open the popup
3. Toggle the switch to **ON** to enable the extension for that site
4. The extension will show a green checkmark (✓) badge when enabled

### Viewing Detected Restrictions

When you open the popup, you'll see:

- **🔍 Detected Restrictions**: Lists what restrictions the website has applied (or "No restrictions detected")

  - Text selection disabled (CSS)
  - Right-click menu blocked (JavaScript)
  - Copy/cut operations blocked
  - Mouse cursor restrictions
  - Mouse interaction disabled (CSS)

- **⚡ Enabled Features**: Shows which features are configured for this site
  - Text selection restored
  - Right-click menu restored
  - Copy/cut operations enabled
  - Cursor behavior normalized

### Using Advanced Options

The **Advanced Options** section lets you control individual features for the current site (you can configure it even while the site is disabled):

1. **Enable text selection**: Toggle CSS and event-based text selection blocking
2. **Enable right-click menu**: Toggle context menu blocking
3. **Enable copy/cut operations**: Toggle clipboard operation blocking
4. **Restore cursor styles**: Toggle cursor style restoration (disable if you want to keep site's custom cursor)

**Features:**

- Changes take effect **immediately** without page reload
- Settings are saved **per-site** and synced across devices
- All features enabled by default when you turn on the extension
- Advanced Options expand/collapse state is **remembered**

### Using the Extension

Once enabled for a site, the extension works automatically:

1. Visit any website where you've enabled the extension
2. Right-click anywhere on the page - the browser's context menu will appear!
3. Select and copy text - it will work!
4. Use Advanced Options to fine-tune which features you want enabled

**Note:**

- The extension is disabled by default for all sites (opt-in model for your privacy)
- Each website has its own enable/disable setting
- Feature preferences are saved per-site
- Settings are saved and synced across your devices
- Some sites use CSS like `pointer-events: none`; the extension detects this but does not currently override it
- The extension can block website navigation triggered by right-click while still allowing the browser's context menu

## Privacy & Security

This extension follows privacy-first principles:

- **Uses activeTab permission**: Only accesses tabs you explicitly interact with
- **Per-site opt-in**: You control exactly which sites the extension works on
- **No broad permissions**: Does not request access to all websites by default
- **No data collection**: Does not collect, store, or transmit any user data
- **No external servers**: All functionality is local to your browser
- **No tracking or analytics**: Your browsing activity is completely private
- **Open source**: All code is publicly available for review

The extension only modifies page behavior in your local browser and never shares information externally.

## Development

### Building for Chrome Web Store

To create a zip file for Chrome Web Store submission:

```bash
make zip      # Creates allow-copy-<version>.zip with all required files
make clean    # Removes generated zip files
make help     # Shows available commands
```

The version number is automatically extracted from `manifest.json`.

### Testing Changes

After making changes to the code:

1. Go to `chrome://extensions/`
2. Click the reload icon on the extension card
3. Reload any test web pages
4. Click the extension icon to open the popup and enable it for the test site
5. Test that the functionality works (right-click, text selection, copying)
6. Navigate away and back to verify functionality; if it doesn’t apply automatically, open the popup once to re-inject
7. Test the toggle switch to verify enable/disable functionality
8. Check that the badge shows a green checkmark (✓) on enabled sites

### Technical Architecture

**Manifest V3 Chrome Extension** with dynamic content script injection:

- **manifest.json**: Extension configuration with `activeTab`, `storage`, `scripting`, and `webNavigation` permissions
- **background.js**: Service worker that manages badge updates, tab monitoring, and content script injection
  - Attempts to auto-inject content script on navigation for enabled sites
  - Updates badge indicator when switching tabs or navigating
  - Prevents duplicate injection with ping/pong mechanism
  - Handles storage migration for backward compatibility
- **storage-utils.js**: Storage utilities for managing site configurations
  - Automatic migration from old boolean format to new object format
  - Functions for reading/writing site configs with backward compatibility
  - Per-site feature preferences management
- **content.js**: Main functionality script injected into web pages
  - Detects CSS and JavaScript-based restrictions before applying modifications
  - Intercepts mouse events in capture phase to prevent website handlers
  - Handles left-click (stops propagation to allow text selection)
  - Handles right-click (prevents navigation while allowing context menu)
  - Applies features selectively based on Advanced Options settings
  - Overrides CSS properties dynamically based on enabled features
  - Uses MutationObserver to maintain style overrides
  - Real-time feature updates without page reload
- **popup.html/popup.js/popup.css**: UI for toggling extension per-site
  - Displays detected restrictions and enabled features
  - Advanced Options for granular feature control
  - Real-time updates when toggling features
  - Per-site settings persistence

### File Structure

```
.
├── docs/                      # Documentation
│   └── TESTING.md             # Testing instructions
├── promo/                     # Promotional images
│   ├── PROMOTIONAL_IMAGES.md  # Image specifications
│   ├── convert.sh             # SVG to PNG converter
│   ├── promo-screenshot.svg   # Screenshot (1280x800)
│   ├── promo-tile.svg         # Small tile (440x280)
│   └── promo-marquee.svg      # Marquee (1400x560)
├── manifest.json              # Extension manifest (Manifest V3)
├── background.js              # Background service worker
├── storage-utils.js           # Storage utilities with migration
├── content.js                 # Content script (main functionality)
├── popup.html                 # Extension popup UI
├── popup.js                   # Popup logic and state management
├── popup.css                  # Popup styles
├── test-restriction.html      # Test page with restrictions
├── icon.svg                   # Icon source (vector)
├── icon16.png                 # 16x16 toolbar icon
├── icon48.png                 # 48x48 extension management icon
├── icon128.png                # 128x128 Chrome Web Store icon
├── Makefile                   # Build automation
├── README.md                  # This file
└── CLAUDE.md                  # Detailed technical documentation
```

## License

MIT License - See [LICENSE](LICENSE) file for details

## Contributing

Issues and pull requests are welcome!

For detailed technical documentation, see [CLAUDE.md](CLAUDE.md).
