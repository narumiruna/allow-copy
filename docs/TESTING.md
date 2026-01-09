# Testing Checklist for Allow Copy Extension

## Phase 1: Restriction Detection Tests

### Using the Test Page

A test page is included in the repository at `test-restriction.html` with multiple restrictions:

1. **Setup**:

   - [ ] Open `test-restriction.html` in Chrome (use `file://` protocol or a local server)
   - [ ] Click extension icon to open popup

2. **Test Detection (Extension Disabled)**:

   - [ ] Verify toggle is OFF
   - [ ] Verify "Detected Restrictions" section appears with 🔍 icon
   - [ ] Verify it lists:
     - "Text selection disabled (CSS)"
     - "Right-click menu blocked (JavaScript)"
     - "Copy/cut operations blocked"
   - [ ] Verify "Enabled Features" section is hidden (not shown when disabled)

3. **Test Detection (Extension Enabled)**:

   - [ ] Toggle extension ON
   - [ ] Verify "Detected Restrictions" section still shows the same restrictions
   - [ ] Verify "Enabled Features" section appears with ⚡ icon
   - [ ] Verify it lists:
     - "Text selection restored"
     - "Right-click menu restored"
     - "Copy/cut operations enabled"

4. **Test on Real Sites**:

   - [ ] Visit a site with no restrictions (e.g., example.com)
   - [ ] Open popup, verify both detection sections are hidden
   - [ ] Visit a site with restrictions (e.g., some news sites)
   - [ ] Open popup, verify detected restrictions are shown
   - [ ] Enable extension, verify enabled features are shown

5. **Test Detection Accuracy**:
   - [ ] On test page, verify you cannot select text before enabling
   - [ ] Enable extension, verify you can now select text
   - [ ] Verify right-click menu works
   - [ ] Verify copy (Ctrl+C) works
   - [ ] Disable extension, verify restrictions return

## Phase 2: Granular Feature Control Tests

### Advanced Options Regression Tests

Use `test-restriction.html` (or a known restricted site) and verify each feature independently:

1. **Right-click only**:

   - [ ] Enable extension
   - [ ] In Advanced Options: uncheck **Enable text selection**
   - [ ] Keep **Enable right-click menu** checked
   - [ ] Verify right-click context menu still works

2. **Text selection only**:

   - [ ] Enable extension
   - [ ] In Advanced Options: check **Enable text selection**
   - [ ] Uncheck **Enable right-click menu**
   - [ ] Verify text selection works
   - [ ] Verify right-click is blocked by the site (or at least not force-enabled by the extension)

3. **Copy/cut only**:

   - [ ] Enable extension
   - [ ] Uncheck **Enable copy/cut operations**
   - [ ] Verify Ctrl+C / Copy is blocked again on the test page
   - [ ] Re-check and verify Ctrl+C works

4. **Cursor only**:
   - [ ] Enable extension on a site with custom cursor styling
   - [ ] Uncheck **Restore cursor styles**
   - [ ] Verify the site’s custom cursor remains
   - [ ] Re-check and verify cursor normalizes

### Advanced Options UI

1. **Advanced Options Visibility**:

   - [ ] Open popup on a disabled site
   - [ ] Verify "Advanced Options" section is hidden
   - [ ] Enable extension for the site
   - [ ] Verify "Advanced Options" section appears

2. **Expand/Collapse Functionality**:

   - [ ] Click "Advanced Options" header
   - [ ] Verify content expands and arrow rotates 90°
   - [ ] Click again, verify content collapses

3. **Feature Toggles**:

   - [ ] Expand Advanced Options
   - [ ] Verify all four feature checkboxes are checked by default
   - [ ] Uncheck "Enable text selection"
   - [ ] Try to select text on page - should not work
   - [ ] Re-check "Enable text selection"
   - [ ] Verify text selection works again

4. **Individual Feature Testing**:

   - [ ] **Text Selection**: Uncheck, verify cannot select text
   - [ ] **Right-click Menu**: Uncheck, verify right-click is blocked
   - [ ] **Copy/Cut Operations**: Uncheck, verify Ctrl+C doesn't work
   - [ ] **Restore Cursor**: Uncheck on site with custom cursor, verify cursor remains custom

5. **Feature Persistence**:

   - [ ] Disable "Restore cursor" feature
   - [ ] Close popup
   - [ ] Reopen popup
   - [ ] Verify "Restore cursor" is still unchecked
   - [ ] Reload page
   - [ ] Verify feature settings persist

6. **Advanced Options Expand State Persistence**:
   - [ ] Expand/collapse Advanced Options
   - [ ] Close popup
   - [ ] Reopen popup
   - [ ] Verify Advanced Options remains in the last expanded/collapsed state

### Backward Compatibility

1. **Migration from Old Format**:

   - [ ] Note: This requires manual storage manipulation or an old version
   - [ ] If possible, set storage to old boolean format: `{sites: {"example.com": true}}`
   - [ ] Reload extension
   - [ ] Open popup on example.com
   - [ ] Verify all features are enabled by default
   - [ ] Verify Advanced Options works correctly

2. **Mixed Format Compatibility**:
   - [ ] Have some sites in old format (boolean), some in new format (object)
   - [ ] Verify both work correctly
   - [ ] Verify badge shows correctly for both types

## Basic Functionality Tests

### 1. Installation and First Use

- [ ] Load extension at `chrome://extensions/`
- [ ] Extension icon appears in toolbar
- [ ] Click icon to open popup, verify correct content displays

### 2. Enable/Disable Functionality

- [ ] Open popup, verify current site hostname is shown
- [ ] Toggle switch to ON, verify green checkmark badge appears
- [ ] Toggle switch to OFF, verify badge disappears
- [ ] Reload page, verify settings persist

### 3. Text Selection Functionality

Suggested test sites:

- https://www.bbc.com/ (some articles may have copy restrictions)
- Other sites that disable right-click/copying

Test items:

- [ ] Cannot select text before enabling extension
- [ ] Can select text after enabling extension
- [ ] Can use right-click context menu
- [ ] Can copy text (Ctrl+C or right-click copy)
- [ ] Left-click on links works normally
- [ ] Right-click does not trigger page navigation

### 4. Auto-Injection Test

- [ ] Close tab on an enabled site
- [ ] Reopen same site
- [ ] Functionality works automatically (without reopening popup)
- [ ] Badge automatically shows green checkmark

### 5. Multi-Site Test

- [ ] Enable extension on site A
- [ ] Switch to site B (not enabled)
- [ ] Verify site B has no badge, functionality not enabled
- [ ] Switch back to site A
- [ ] Verify site A has badge, functionality works

### 6. Special Sites Test

Test that the following sites are properly skipped (no crashes):

- [ ] `chrome://extensions/`
- [ ] `chrome://settings/`
- [ ] Chrome Web Store
- [ ] New Tab page

### 7. Settings Sync Test (requires Chrome sync enabled on multiple devices)

- [ ] Enable a site on device A
- [ ] Wait for sync to complete
- [ ] Check same site on device B
- [ ] Verify settings have synced

### 8. Performance Test

- [ ] Page load speed is normal after enabling extension
- [ ] No noticeable delays or lag
- [ ] Browser memory usage is normal

### 9. Error Handling Test

- [ ] Quickly switch tabs before page finishes loading
- [ ] Rapidly toggle extension on/off
- [ ] Try to enable on protected pages (should fail gracefully)

### 10. Update Test

- [ ] Update version number in manifest.json
- [ ] Reload extension
- [ ] Verify list of enabled sites remains unchanged
- [ ] Verify functionality works normally

## Final Pre-Review Checklist

- [ ] Console logging follows policy: console.error only for real/unexpected errors, console.log for expected informational messages, no leftover debug logs
- [ ] All files use UTF-8 encoding
- [ ] No obfuscated code
- [ ] README.md content is complete and accurate
- [ ] manifest.json version number is updated
- [ ] All icon files exist and are correct

## Known Limitations

Record any known limitations or issues:

- Cannot work on chrome:// or chrome-extension:// pages (expected behavior)
- Some sites with complex DRM may not be fully unlockable
