# Allow Copy

A Chrome extension that enables copying and text selection on websites that disable these features.

## Features

- ✅ Enable right-click context menu on all websites
- ✅ Enable text selection and copying
- ✅ Bypass common JavaScript tricks that prevent these actions
- ✅ Toggle on/off per-site with a simple button in the extension popup
- ✅ Prevents conflicts with custom right-click handlers on websites
- ✅ Works automatically on enabled sites
- ✅ Settings are saved and synced across devices
- ✅ Privacy-first: Uses activeTab permission (no broad website access)

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
- The content script is injected dynamically only on sites where you've enabled it
- For enabled sites, the script auto-injects on navigation to maintain functionality
- No broad permissions are requested - the extension only works where you want it

The content script:

- Intercepts and stops propagation of events that websites use to disable right-clicking
- **Blocks navigation on right-click** by preventing default behavior on `mousedown`/`mouseup`/`click` events when right mouse button is detected (e.g., comic websites where right-click navigates pages)
- **Allows browser context menu** by not preventing default on `contextmenu` event
- Overrides CSS properties that prevent text selection
- Prevents websites from overriding browser default behaviors
- Maintains these protections dynamically as pages update
- Can be toggled on/off per-site via the extension popup

## Usage

### First Time Setup

1. Visit a website where you want to enable copying and text selection
2. Click the extension icon in your browser toolbar to open the popup
3. Toggle the switch to **ON** to enable the extension for that site
4. The extension will show a green checkmark (✓) badge when enabled

### Using the Extension

Once enabled for a site, the extension works automatically:

1. Visit any website where you've enabled the extension
2. Right-click anywhere on the page - the browser's context menu will appear!
3. Select and copy text - it will work!

**Note:**

- The extension is disabled by default for all sites (opt-in model for your privacy)
- Each website has its own enable/disable setting
- Settings are saved and synced across your devices
- The extension blocks website navigation triggered by right-click while still allowing the browser's context menu

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
6. Navigate away and back to verify auto-injection on enabled sites
7. Test the toggle switch to verify enable/disable functionality
8. Check that the badge shows a green checkmark (✓) on enabled sites

### Technical Architecture

**Manifest V3 Chrome Extension** with dynamic content script injection:

- **manifest.json**: Extension configuration with `activeTab`, `storage`, `scripting`, and `webNavigation` permissions
- **background.js**: Service worker that manages badge updates, tab monitoring, and content script injection
  - Auto-injects content script on navigation for enabled sites
  - Updates badge indicator when switching tabs or navigating
  - Prevents duplicate injection with ping/pong mechanism
- **content.js**: Main functionality script injected into web pages
  - Intercepts mouse events in capture phase to prevent website handlers
  - Handles left-click (stops propagation to allow text selection)
  - Handles right-click (prevents navigation while allowing context menu)
  - Overrides CSS properties that disable text selection
  - Uses MutationObserver to maintain style overrides
- **popup.html/popup.js**: UI for toggling extension per-site

### File Structure

```
.
├── manifest.json      # Extension manifest (Manifest V3)
├── background.js      # Background service worker
├── content.js         # Content script (main functionality)
├── popup.html         # Extension popup UI
├── popup.js           # Popup logic and state management
├── icon.svg           # Icon source (vector)
├── icon16.png         # 16x16 toolbar icon
├── icon48.png         # 48x48 extension management icon
├── icon128.png        # 128x128 Chrome Web Store icon
├── Makefile           # Build automation
├── README.md          # This file
└── CLAUDE.md          # Detailed technical documentation
```

## License

MIT License - See [LICENSE](LICENSE) file for details

## Contributing

Issues and pull requests are welcome!

For detailed technical documentation, see [CLAUDE.md](CLAUDE.md).
