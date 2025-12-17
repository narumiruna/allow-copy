# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (Manifest V3) that enables copying and text selection on websites that disable these features. The extension bypasses JavaScript-based restrictions and CSS properties that prevent user interaction.

## Architecture

### Core Components

- **manifest.json**: Chrome extension manifest (Manifest V3)
  - Permissions: `storage` (for settings sync), `tabs` (for messaging across tabs)
  - Content script runs at `document_start` on `<all_urls>` with `all_frames: true`

- **content.js**: Main functionality - injected into all web pages
  - Uses capture phase (`true`) for event listeners to intercept before page handlers
  - Intercepts left-click (button === 0) events with `stopPropagation()` to prevent websites from blocking text selection
  - Blocks right-click navigation by calling `e.preventDefault()` on mousedown/mouseup/click when `button === 2`
  - Allows browser context menu by not preventing default on contextmenu event
  - Overrides document properties (`oncontextmenu`, `onselectstart`, etc.) using `Object.defineProperty`
  - Injects `<style>` element (ID: `allow-copy-style`) with `!important` rules to override CSS user-select restrictions
  - Uses `MutationObserver` to monitor and re-apply style if removed
  - State management: `isEnabled` flag controls all functionality

- **popup.html/popup.js**: Extension popup UI
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

- **Per-site Settings**: Extension is enabled/disabled on a per-site basis
- **Storage Schema**: `chrome.storage.sync` stores `{sites: {[hostname]: boolean}}`
  - Key is the hostname (e.g., `"example.com"`)
  - Value is `true` if enabled for that site
  - Sites not in the object are disabled by default
- **Default Behavior**: Extension is disabled by default (opt-in model)
- **Popup Behavior**:
  - Shows current site's hostname
  - Toggle controls state only for the current site
  - Sends `toggleSite` message with hostname to the specific tab
- **Content Script Behavior**:
  - Reads `window.location.hostname` on load
  - Checks storage for that specific hostname
  - Only responds to `toggleSite` messages if hostname matches

## Development

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
4. Use the toggle in the extension popup to verify enable/disable functionality for specific sites
5. Test that different sites maintain independent enabled/disabled states
6. Verify that sites default to disabled when not explicitly enabled

### Key Implementation Details

- **Timing**: Content script runs at `document_start` to intercept restrictions before page scripts execute
- **Event Blocking**: Uses `stopPropagation()` and `stopImmediatePropagation()` to block website handlers while allowing browser's default behavior (context menu)
- **State Reset**: Always calls `disableInteractions()` and `removeCleanup()` before enabling to ensure clean state and prevent duplicate listeners
- **Dynamic Reapplication**: `MutationObserver` watches for style element removal and re-applies if needed
- **Performance**: Uses `requestAnimationFrame` for waiting on DOM elements instead of intervals
- **Error Handling**: `Object.defineProperty` calls wrapped in try-catch as some properties may not be configurable
- **Compatibility**: Uses callback-based Chrome APIs with `chrome.runtime.lastError` check instead of Promise-based APIs for better compatibility

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
├── manifest.json      # Extension manifest
├── content.js         # Content script (main logic)
├── popup.html         # Extension popup UI
├── popup.js           # Popup logic
├── icon.svg           # Icon source (vector)
├── icon16.png         # Extension icons
├── icon48.png
└── icon128.png
```
