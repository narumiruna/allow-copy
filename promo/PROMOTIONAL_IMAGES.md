# Chrome Web Store Promotional Images

This document describes the specifications and best practices for promotional images used in the Chrome Web Store listing.

Reference: https://developer.chrome.com/docs/webstore/best-listing

## Image Types and Specifications

### 1. Screenshots
- **Dimensions**: 1280x800 or 640x400 pixels
- **Format**: Square corners, full bleed (no padding)
- **Quantity**: Minimum 1, maximum 5 recommended
- **File**: `promo-screenshot.svg` (source), convert to PNG for upload
- **Purpose**: Display actual user experience focusing on core features

**Current Implementation**: 1280x800 before/after comparison showing:
- Left side: Website with copy protection (blocked state)
- Right side: Same website with Allow Copy enabled (working state)
- Bottom: Three key features listed

### 2. Small Promo Tile
- **Dimensions**: 440x280 pixels
- **Format**: Simple, saturated colors, recognizable when shrunk
- **File**: `promo-tile.svg` (source), convert to PNG for upload
- **Placement**: Homepage, category pages, and search results

**Current Implementation**: Green gradient background with:
- Extension icon (two documents)
- "Allow Copy" title
- Brief tagline
- Two feature tags

### 3. Marquee Image
- **Dimensions**: 1400x560 pixels
- **Format**: Wide banner, well-defined edges
- **File**: `promo-marquee.svg` (source), convert to PNG for upload
- **Purpose**: Used in rotating carousel on Chrome Web Store homepage (if selected)

**Current Implementation**: Horizontal layout with:
- Left: Large icon, title, tagline, and bullet points
- Right: Browser window mockup showing selected text
- Bottom: "Free & Open Source" badge

## Design Guidelines

### General Best Practices
- Display actual user experience focusing on core features
- Keep images clear, properly sized, and not blurry or pixelated
- Include visual aids like infographics to explain functionality
- Avoid excessive text that overwhelms users
- Maintain consistent branding with other listing elements

### Visual Design
- **Colors**: Use saturated colors; avoid excessive white and light gray
- **Composition**: Keep simple and avoid cluttered compositions
- **Edges**: Fill entire region with well-defined edges
- **Scalability**: Ensure images remain recognizable when shrunk to half size
- **Branding**: Maintain consistent branding across all promotional assets

### Content Guidelines
- Avoid misleading claims like "Editor's Choice" or ranking statements
- Focus on demonstrating the extension's functionality
- Show before/after comparisons when applicable
- Highlight key features visually

## Color Scheme

Based on the extension's branding:
- **Primary Green**: `#4CAF50`
- **Dark Green**: `#2E7D32`
- **Darker Green**: `#1B5E20`
- **Light Green Backgrounds**: `#E8F5E9`, `#C8E6C9`, `#A5D6A7`
- **Highlight**: `#B3E5FC` (blue for selected text)
- **Red (for "blocked" state)**: `#F44336`, `#D32F2F`

## Converting SVG to PNG

To convert SVG files to PNG for Chrome Web Store upload, use the provided conversion script:

```bash
# From the project root directory
cd promo
./convert.sh
```

Or run it directly from anywhere:

```bash
./promo/convert.sh
```

The script will:
- Check if `cairosvg` is installed (install with `python3 -m pip install cairosvg`)
- Convert all three promotional images to PNG format
- Place the PNG files in the same directory (`promo/`)

### Manual Conversion

If you prefer to convert manually:

```bash
cd promo

# Install CairoSVG if not already installed
python3 -m pip install cairosvg

# Convert screenshots (1280x800)
python3 -c "import cairosvg; cairosvg.svg2png(url='promo-screenshot.svg', write_to='promo-screenshot.png', output_width=1280, output_height=800)"

# Convert small promo tile (440x280)
python3 -c "import cairosvg; cairosvg.svg2png(url='promo-tile.svg', write_to='promo-tile.png', output_width=440, output_height=280)"

# Convert marquee (1400x560)
python3 -c "import cairosvg; cairosvg.svg2png(url='promo-marquee.svg', write_to='promo-marquee.png', output_width=1400, output_height=560)"
```

## File Structure

All promotional images are located in the `promo/` directory:

```
promo/
├── promo-screenshot.svg    # Screenshot source (1280x800)
├── promo-tile.svg          # Small promo tile source (440x280)
├── promo-marquee.svg       # Marquee source (1400x560)
├── promo-screenshot.png    # Generated PNG for upload (git-ignored)
├── promo-tile.png          # Generated PNG for upload (git-ignored)
├── promo-marquee.png       # Generated PNG for upload (git-ignored)
├── convert.sh              # Conversion script
└── PROMOTIONAL_IMAGES.md   # This file
```

## Updating Promotional Images

When updating promotional images:

1. Edit the SVG source files in the `promo/` directory (`promo-screenshot.svg`, `promo-tile.svg`, `promo-marquee.svg`)
2. Convert to PNG using `./promo/convert.sh`
3. Verify the PNG files look correct at their intended sizes
4. Upload the PNG files from `promo/` to Chrome Web Store Developer Dashboard

## Notes

- SVG files are kept as source for easy editing
- PNG files should not be committed to version control (add to `.gitignore`)
- Always preview images at actual size before uploading
- Test how images look on both light and dark backgrounds
- Ensure text is readable at all sizes
