# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (Manifest V3) that enables right-clicking and copying on websites that disable these features. The extension bypasses JavaScript-based restrictions and CSS properties that prevent user interaction.

## Architecture

### Core Components

- **manifest.json**: Chrome extension manifest (Manifest V3)
  - Permissions: `storage` (for settings sync), `tabs` (for messaging across tabs)
  - Content script runs at `document_start` on `<all_urls>` with `all_frames: true`

- **content.js**: Main functionality - injected into all web pages
  - Uses capture phase (`true`) for event listeners to intercept before page handlers
  - Calls `e.preventDefault()` on contextmenu to prevent conflicts with custom right-click handlers (e.g., comic sites)
  - Overrides document properties (`oncontextmenu`, `onselectstart`, etc.) using `Object.defineProperty`
  - Injects `<style>` element with `!important` rules to override CSS user-select restrictions
  - Uses `MutationObserver` to monitor and re-apply style if removed
  - State management: `isEnabled` flag controls all functionality

- **popup.html/popup.js**: Extension popup UI
  - Toggle switch to enable/disable extension
  - Uses `chrome.storage.sync` for cross-device settings persistence
  - Broadcasts state changes to all tabs via `chrome.tabs.sendMessage()`

### Event Handling Strategy

The extension uses event capturing (third parameter `true`) to intercept events before website handlers:
- `mousedown`, `mouseup`, `click`: When right-click is detected (`button === 2`), calls `preventDefault()` to block page navigation while still allowing contextmenu to fire
- `contextmenu`: Uses `stopPropagation()` and `stopImmediatePropagation()` to block website handlers, but does NOT call `preventDefault()` so the browser's context menu can show
- `selectstart`, `copy`, `cut`: Allows text selection and clipboard operations
- All event listeners stored in array for cleanup when disabled
- Before enabling, always calls `disableInteractions()` first to prevent duplicate listeners

**Why multiple event types**: Some websites use `mousedown`/`mouseup` with `button === 2` check to implement navigation instead of `contextmenu` event. We must block these while allowing the browser's contextmenu to proceed.

### State Management

- Settings stored in `chrome.storage.sync` with key `enabled` (defaults to `true`)
- Popup broadcasts state changes to all tabs
- Content script listens for `toggleExtension` messages from popup

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
4. Use the toggle in the extension popup to verify enable/disable functionality

### Key Implementation Details

- **Timing**: Content script runs at `document_start` to intercept restrictions before page scripts execute
- **Event Blocking**: Uses `stopPropagation()` and `stopImmediatePropagation()` to block website handlers while allowing browser's default behavior (context menu)
- **State Reset**: Always calls `disableInteractions()` and `removeCleanup()` before enabling to ensure clean state and prevent duplicate listeners
- **Dynamic Reapplication**: `MutationObserver` watches for style element removal and re-applies if needed
- **Performance**: Uses `requestAnimationFrame` for waiting on DOM elements instead of intervals
- **Error Handling**: `Object.defineProperty` calls wrapped in try-catch as some properties may not be configurable
- **Compatibility**: Uses callback-based Chrome APIs with `chrome.runtime.lastError` check instead of Promise-based APIs for better compatibility

## File Structure

```
.
├── manifest.json      # Extension manifest
├── content.js         # Content script (main logic)
├── popup.html         # Extension popup UI
├── popup.js           # Popup logic
├── icon16.png         # Extension icons
├── icon48.png
└── icon128.png
```
