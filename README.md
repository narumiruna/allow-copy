# Allow Right Click

A Chrome extension that enables right-clicking and copying on websites that disable these features.

## Features

- ✅ Enable right-click context menu on all websites
- ✅ Enable text selection and copying
- ✅ Bypass common JavaScript tricks that prevent these actions
- ✅ Works on all websites automatically
- ✅ No configuration needed

## Installation

### From Source (Developer Mode)

1. Clone this repository or download the source code:
   ```bash
   git clone https://github.com/narumiruna/allow-right-click.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" using the toggle in the top-right corner

4. Click "Load unpacked" button

5. Select the `allow-right-click` folder

6. The extension is now installed and active!

## How It Works

The extension uses a content script that:
- Intercepts and stops propagation of events that websites use to disable right-clicking
- Overrides CSS properties that prevent text selection
- Prevents websites from overriding browser default behaviors
- Applies these protections at document start and maintains them dynamically

## Usage

Once installed, the extension works automatically on all websites. No user interaction required!

Simply:
1. Visit any website that normally blocks right-clicking or copying
2. Right-click anywhere on the page - it will work!
3. Select and copy text - it will work!

## Privacy

This extension:
- Does not collect any data
- Does not send any information to external servers
- Only modifies the current page's behavior in your browser
- Has no tracking or analytics

## License

MIT License - See [LICENSE](LICENSE) file for details

## Contributing

Issues and pull requests are welcome!