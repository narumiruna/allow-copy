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

### From GitHub Releases (Recommended)

Download pre-built packages from the [Releases](https://github.com/narumiruna/allow-copy/releases) page:

#### Option 1: Load Unpacked Extension
1. Download the latest `.zip` file from releases
2. Extract the ZIP file to a folder
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" using the toggle in the top-right corner
5. Click "Load unpacked" button
6. Select the extracted folder
7. The extension is now installed and active!

#### Option 2: Install CRX Package (Advanced)
1. Download the latest `.crx` file from releases
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Drag and drop the `.crx` file onto the extensions page

**Note:** Chrome may show a warning for extensions not from the Chrome Web Store. This is expected for manually installed extensions.

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

## For Developers

### Building and Releasing

This repository includes a GitHub Actions workflow for automated builds and releases.

#### Creating a Release

1. **Update the version** in `manifest.json`

2. **Commit your changes:**
   ```bash
   git add manifest.json
   git commit -m "Bump version to X.Y.Z"
   git push
   ```

3. **Create and push a tag:**
   ```bash
   git tag v1.2.0  # Use the same version as in manifest.json
   git push origin v1.2.0
   ```

4. The GitHub Actions workflow will automatically:
   - Build a distributable ZIP package
   - Generate a signed CRX package
   - Create a GitHub Release with both artifacts
   - Include SHA256 checksums for verification

#### Manual Workflow Trigger

You can also trigger the release workflow manually:

1. Go to the **Actions** tab in GitHub
2. Select the "Build and Release Chrome Extension" workflow
3. Click "Run workflow"
4. Enter the tag name (e.g., `v1.2.0`)
5. Click "Run workflow"

#### Required Secrets

The workflow requires the following repository secret:

- **`CHROME_EXTENSION_PRIVATE_KEY`**: Private key (PEM format) for signing the CRX package

**To generate a private key:**

**Option 1: Using Chrome (Recommended)**
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Pack extension"
4. Select your extension directory
5. Leave "Private key file" empty for first-time packaging
6. Chrome will generate a `.pem` file in the parent directory

**Option 2: Using OpenSSL**
```bash
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
```

**To add the secret to GitHub:**
1. Copy the contents of the `.pem` file
2. Go to your repository Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `CHROME_EXTENSION_PRIVATE_KEY`
5. Value: Paste the entire contents of the `.pem` file
6. Click "Add secret"

**Security Note:** Keep your private key secure and never commit it to the repository. The workflow handles it securely and removes it after building.

## License

MIT License - See [LICENSE](LICENSE) file for details

## Contributing

Issues and pull requests are welcome!