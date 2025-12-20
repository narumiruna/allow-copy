#!/usr/bin/env bash
#
# Convert promotional SVG images to PNG format for Chrome Web Store upload
#
# Usage: ./convert.sh
#
# Requirements: Python 3 with cairosvg package
#   Install: python3 -m pip install cairosvg

set -euo pipefail

# Change to the script's directory
cd "$(dirname "$0")"

# Check if cairosvg is installed
if ! python3 -c "import cairosvg" 2>/dev/null; then
    echo "Error: cairosvg package not found"
    echo "Install it with: python3 -m pip install cairosvg"
    exit 1
fi

echo "Converting promotional images..."

# Convert all promotional images
python3 -c "
import cairosvg

# Screenshot (1280x800)
print('Converting promo-screenshot.svg...')
cairosvg.svg2png(url='promo-screenshot.svg', write_to='promo-screenshot.png', output_width=1280, output_height=800)

# Small promo tile (440x280)
print('Converting promo-tile.svg...')
cairosvg.svg2png(url='promo-tile.svg', write_to='promo-tile.png', output_width=440, output_height=280)

# Marquee (1400x560)
print('Converting promo-marquee.svg...')
cairosvg.svg2png(url='promo-marquee.svg', write_to='promo-marquee.png', output_width=1400, output_height=560)

print('\n✓ All promotional images converted successfully!')
print('  - promo-screenshot.png (1280x800)')
print('  - promo-tile.png (440x280)')
print('  - promo-marquee.png (1400x560)')
print('\nReady for Chrome Web Store upload.')
"
