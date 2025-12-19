# Testing Checklist for Allow Copy Extension

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
- https://www.hongxiu.com/ (Chinese novel site that blocks copying)
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
