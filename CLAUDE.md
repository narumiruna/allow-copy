# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (Manifest V3) that enables copying and text selection on websites that disable these features. The extension bypasses JavaScript-based restrictions and CSS properties that prevent user interaction.

## Architecture

### Core Components

- **manifest.json**: Chrome extension manifest (Manifest V3)

  - Permissions: `storage` (for settings sync), `activeTab` (for tab access on user action), `scripting` (for dynamic content script injection), `webNavigation` (for detecting navigation events)
  - No static content scripts - uses dynamic injection for privacy
  - Background service worker for badge updates, tab monitoring, and content script injection

- **background.js**: Background service worker

  - **Content Script Injection**: Dynamically injects content script using `chrome.scripting.executeScript()` with `injectImmediately: true`
  - Injects on enabled sites via `webNavigation.onCommitted` event for automatic functionality
  - Prevents duplicate injection by checking for existing script with ping/pong mechanism
  - **Badge Management**: Updates badge indicator when switching tabs or navigating to different pages
  - Shows green checkmark (✓) badge when extension is enabled for current site
  - Hides badge when extension is disabled
  - Listens to `chrome.tabs.onActivated` (tab switching), `chrome.tabs.onUpdated` (navigation), and `chrome.storage.onChanged` (settings changes)
  - Skips badge updates and injection for special URLs (chrome://, chrome-extension://)
  - On extension install/reload, injects into already-open tabs with enabled sites

- **content.js**: Main functionality - dynamically injected into web pages

  - **Duplicate Prevention**: Checks `window.__allowCopyInjected` flag to prevent multiple injections
  - **Ping/Pong**: Responds to ping messages to indicate script is already injected
  - Uses capture phase (`true`) for event listeners to intercept before page handlers
  - Intercepts left-click (button === 0) events with `stopPropagation()` to prevent websites from blocking text selection
  - Blocks right-click navigation by calling `e.preventDefault()` on mousedown/mouseup/click when `button === 2`
  - Allows browser context menu by not preventing default on contextmenu event
  - Overrides document properties (`oncontextmenu`, `onselectstart`, etc.) using `Object.defineProperty`
  - Injects `<style>` element (ID: `allow-copy-style`) with `!important` rules to override:
    - CSS user-select restrictions (enables text selection)
    - CSS cursor restrictions (restores normal cursor behavior - I-beam on text, pointer on links, etc.)
  - Uses `MutationObserver` to monitor and re-apply style if removed
  - State management: `isEnabled` flag controls all functionality

- **popup.html/popup.js**: Extension popup UI
  - **Content Script Injection**: Injects content script when popup opens using `activeTab` permission
  - Displays current site's hostname
  - Toggle switch to enable/disable extension for the current site only
  - Uses `chrome.storage.sync` for cross-device settings persistence (per-site)
  - Sends state changes to the current tab only via `chrome.tabs.sendMessage()`

### Event Handling Strategy

The extension uses event capturing (third parameter `true`) to intercept events before website handlers:

- `mousedown`, `mouseup`, `click`: Handles both left-click (`button === 0`) and right-click (`button === 2`)
  - **Left-click**: Calls `stopPropagation()` and `stopImmediatePropagation()` to block website handlers that prevent text selection, but does NOT call `preventDefault()` to allow normal clicks and selection to work
  - **Right-click**: Additionally calls `preventDefault()` to block page navigation while still allowing contextmenu to fire
- `contextmenu`: Uses `stopPropagation()` and `stopImmediatePropagation()` to block website handlers, but does NOT call `preventDefault()` so the browser's context menu can show
- `selectstart`, `copy`, `cut`: Allows text selection and clipboard operations
- All event listeners stored in array for cleanup when disabled
- Before enabling, always calls `disableInteractions()` first to prevent duplicate listeners

**Why handle left-click**: Some websites block text selection by preventing mousedown/mouseup/click events on left-click. By intercepting and stopping propagation (but not preventing default), we allow the browser's native selection to work while blocking the website's handlers.

**Why handle right-click**: Some websites use `mousedown`/`mouseup` with `button === 2` check to implement navigation instead of `contextmenu` event. We must block these while allowing the browser's contextmenu to proceed.

### State Management

- **Per-site Settings**: Extension is enabled/disabled on a per-site basis with granular feature control
- **Storage Schema**: `chrome.storage.sync` stores site configurations with backward compatibility
  ```javascript
  {
    sites: {
      "example.com": {
        enabled: true,
        features: {
          textSelection: true,      // Enable text selection
          contextMenu: true,         // Enable right-click menu
          copyPaste: true,          // Enable copy/cut operations
          cursor: true              // Restore cursor styles
        }
      }
    }
  }
  ```
  - Key is the hostname (e.g., `"example.com"`)
  - Value is an object with `enabled` and `features` properties
  - **Backward Compatibility**: Old boolean format (`true`/`false`) is automatically migrated to new object format
  - Sites not in the object are disabled by default
- **Default Behavior**: Extension is disabled by default (opt-in model for privacy)
- **Storage Utilities**: `storage-utils.js` provides functions for reading/writing with automatic migration
- **Popup Behavior**:
  - Injects content script using `activeTab` permission when opened
  - Shows current site's hostname
  - Toggle controls state only for the current site
  - Sends `toggleSite` message with hostname to the specific tab
- **Content Script Behavior**:
  - Prevents duplicate injection with `window.__allowCopyInjected` flag
  - Responds to `ping` messages to indicate it's already injected
  - Reads `window.location.hostname` on load
  - Checks storage for that specific hostname
  - Only responds to `toggleSite` messages if hostname matches
- **Background Script Behavior**:
  - Auto-injects content script on navigation for enabled sites (via `webNavigation.onCommitted`)
  - Uses ping/pong to check if script is already injected before injecting again
  - Updates badge to show enabled/disabled state per site

### Permission Model

- **activeTab**: Grants temporary access to the current tab when user clicks extension icon
  - Access is automatically granted when popup is opened
  - No permission warning shown to users
  - Access is revoked when tab is closed or navigated away
- **scripting**: Allows dynamic injection of content scripts
  - Required for programmatic `chrome.scripting.executeScript()` calls
- **webNavigation**: Allows listening to navigation events
  - Used to detect when user navigates to enabled sites
  - Enables auto-injection on subsequent visits to enabled sites
- **storage**: For persisting per-site settings across devices

**Privacy Benefits**: This permission model avoids requesting broad `<all_urls>` access, satisfying Chrome Web Store requirements and providing better user privacy.

## Implemented Features

### Phase 1: Restriction Detection and Status Display ✅ COMPLETED

Enhance the popup UI to display detailed information about detected restrictions and enabled features:

**Detection Information**:

- Detect CSS-based restrictions:
  - `user-select: none` (text selection disabled)
  - `pointer-events: none` (mouse interaction disabled)
  - Cursor restrictions
- Detect JavaScript-based restrictions:
  - Event listeners blocking `contextmenu`
  - Event listeners blocking `selectstart`, `copy`, `cut`
  - Event listeners blocking mouse events

**Status Display in Popup**:

- ✅ **Current Status**: Extension enabled/disabled for this site
- 🔍 **Detected Restrictions**: List of restrictions found on the page
  - "Text selection disabled (CSS)"
  - "Right-click menu blocked (JavaScript)"
  - "Copy/cut operations blocked"
  - "Mouse cursor restrictions"
- ⚡ **Enabled Features**: What the extension is currently doing
  - "Text selection restored"
  - "Right-click menu restored"
  - "Copy/cut operations enabled"
  - "Cursor behavior normalized"

**Implementation Requirements**:

- Content script detects restrictions on page load
- Send detection results to popup via message passing
- Update popup UI to display detection results
- Real-time updates when restrictions are detected/removed

**Benefits**:

- Transparency: Users understand what the extension is doing
- Debugging: Helps identify if extension is working correctly
- Education: Users learn what restrictions websites apply

### Phase 2: Granular Feature Control ✅ COMPLETED

Allow users to selectively enable/disable specific features per site:

**Per-Site Feature Toggles**:

```
example.com
□ Enable text selection
□ Enable right-click menu
□ Enable copy/cut operations
□ Restore cursor styles
```

**Storage Schema Extension**:

```javascript
{
  sites: {
    "example.com": {
      enabled: true,
      features: {
        textSelection: true,
        contextMenu: true,
        copyPaste: true,
        cursor: false  // User chose to keep custom cursor
      }
    }
  }
}
```

**Implementation Considerations**:

- Backward compatibility with current boolean storage format
- Migration logic for existing settings
- Default behavior: all features enabled when extension is turned on
- UI/UX: Expandable "Advanced Options" section to avoid overwhelming simple users

**Benefits**:

- Maximum flexibility for power users
- Handle edge cases where users want some features but not others
- Better compatibility with sites that have legitimate cursor customizations

**Trade-offs**:

- Increased complexity in UI and code
- Most users will likely use the simple on/off toggle
- May confuse non-technical users

## Development

### Building for Chrome Web Store

To create a zip file for Chrome Web Store submission:

```bash
make zip      # Creates allow-copy-<version>.zip with all required files
make clean    # Removes generated zip files
make help     # Shows available commands
```

The version number is automatically extracted from `manifest.json`. The zip file includes only the necessary files for the extension (excludes development files like README.md, CLAUDE.md, TESTING.md, .git, etc.).

### Loading the Extension

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select this directory

### Testing

After making changes:

1. Go to `chrome://extensions/`
2. Click the reload icon on the extension card
3. Reload any test web pages
4. **First-time usage**: Click extension icon to open popup and enable for the current site
5. **Test auto-injection**: Navigate away and back to an enabled site - should work without opening popup
6. Use the toggle in the extension popup to verify enable/disable functionality for specific sites
7. Test that different sites maintain independent enabled/disabled states
8. Verify that sites default to disabled when not explicitly enabled
9. Check that the badge shows green checkmark (✓) on enabled sites

### Key Implementation Details

- **Dynamic Injection**: Content script is injected programmatically using `chrome.scripting.executeScript()` with `injectImmediately: true` for early timing
- **Injection Points**:
  - When popup opens (via `activeTab` permission)
  - On navigation to enabled sites (via `webNavigation.onCommitted`)
  - On extension install/reload for already-open enabled sites
- **Duplicate Prevention**:
  - Checks `window.__allowCopyInjected` flag in content script
  - Uses ping/pong messaging in background script before injection
- **Event Blocking**: Uses `stopPropagation()` and `stopImmediatePropagation()` to block website handlers while allowing browser's default behavior (context menu)
- **State Reset**: Always calls `disableInteractions()` and `removeCleanup()` before enabling to ensure clean state and prevent duplicate listeners
- **Dynamic Reapplication**: `MutationObserver` watches for style element removal and re-applies if needed
- **Performance**: Uses `requestAnimationFrame` for waiting on DOM elements instead of intervals
- **Error Handling**: `Object.defineProperty` calls wrapped in try-catch as some properties may not be configurable
- **Compatibility**: Uses callback-based Chrome APIs with `chrome.runtime.lastError` check instead of Promise-based APIs for better compatibility

**Note on Timing**: While `injectImmediately: true` provides early injection, it cannot fully match static `document_start` timing. However, this is acceptable because:

- Most websites apply restrictions via JavaScript that loads later
- Event interception works even when injected after page start
- CSS overrides with `!important` are effective regardless of timing
- The privacy benefits of `activeTab` outweigh the minor timing trade-off

## Icon Design

### Design Concept

The icon represents the "copy" functionality using a minimalist design of two overlapping documents.

### Design Specifications

- **Style**: Minimalist, clean design
- **Colors**:
  - Front document: `#4CAF50` (green fill) with `#2E7D32` (dark green border)
  - Back document: White fill with `#4CAF50` (green border)
  - Text lines: White on green background
- **Dimensions**:
  - Front document: 100x104px positioned at (2, 2)
  - Back document: 100x104px positioned at (26, 22) for visible overlap
  - Minimal margins: 2px from canvas edge
- **Borders**: 6px stroke width for clear visibility at all sizes
- **Border radius**: 6px for rounded corners

### Files

- `icon.svg` - Source vector file (128x128 viewBox)
- `icon16.png` - 16x16 pixels (toolbar)
- `icon48.png` - 48x48 pixels (extension management)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

### Regenerating Icons

If you need to modify the icon design:

1. Edit `icon.svg` with your changes
2. Run the conversion script:

```bash
python3 -c "
import cairosvg

cairosvg.svg2png(url='icon.svg', write_to='icon16.png', output_width=16, output_height=16)
cairosvg.svg2png(url='icon.svg', write_to='icon48.png', output_width=48, output_height=48)
cairosvg.svg2png(url='icon.svg', write_to='icon128.png', output_width=128, output_height=128)
"
```

**Note**: Requires `cairosvg` package: `python3 -m pip install cairosvg`

### Design Principles

- **Clear at small sizes**: Text lines are 10px high with 5px radius to remain visible at 16x16
- **Maximum space usage**: Documents positioned with 2px margin and 20px offset for overlap
- **Contrast**: Green/white color scheme provides strong visual contrast
- **Recognizable**: Two-document design universally represents copying

## File Structure

```
.
├── docs/              # Documentation
│   └── TESTING.md     # Testing instructions
├── promo/             # Promotional images for Chrome Web Store
│   ├── PROMOTIONAL_IMAGES.md  # Promotional image specifications
│   ├── convert.sh             # SVG to PNG conversion script
│   ├── promo-screenshot.svg   # Screenshot (1280x800)
│   ├── promo-tile.svg         # Small promo tile (440x280)
│   └── promo-marquee.svg      # Marquee image (1400x560)
├── manifest.json      # Extension manifest
├── background.js      # Background service worker (badge updates, injection)
├── storage-utils.js   # Storage utilities (migration, backward compatibility)
├── content.js         # Content script (main logic with granular features)
├── popup.html         # Extension popup UI
├── popup.js           # Popup logic with Advanced Options
├── popup.css          # Popup styles
├── test-restriction.html  # Test page with restrictions (for development)
├── icon.svg           # Icon source (vector)
├── icon16.png         # Extension icon (16x16)
├── icon48.png         # Extension icon (48x48)
├── icon128.png        # Extension icon (128x128)
├── Makefile           # Build script for Chrome Web Store zip
├── README.md          # Project documentation
├── CLAUDE.md          # Claude Code instructions
└── LICENSE            # MIT License
```
