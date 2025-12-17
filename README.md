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

## License

MIT License - See [LICENSE](LICENSE) file for details

## Contributing

Issues and pull requests are welcome!