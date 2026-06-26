// Background service worker for Allow Copy extension
// Handles badge updates and content script injection

// Import shared logic and storage utilities
importScripts("extension-logic.js");
// Import storage utilities
importScripts("storage-utils.js");
// Import site enablement coordination utilities
importScripts("site-enablement.js");
// Import site permission helpers
importScripts("site-permissions.js");

// Constants
const BADGE_CONFIG = {
	ENABLED: {
		text: "✓",
		color: "#4CAF50",
	},
	DISABLED: {
		text: "",
	},
};

async function isSiteEnabledForUrl(url) {
	const hostname = ExtensionLogic.parseSupportedHostname(url);
	if (!hostname) {
		return false;
	}

	const storedEnabled = await StorageUtils.isSiteEnabled(hostname);
	if (!storedEnabled) {
		return false;
	}

	return await SitePermissions.hasPersistentSiteAccessForUrl(url);
}

// Inject content script into a tab
async function injectContentScript(tabId) {
	try {
		// Check if content script is already injected by trying to send a message
		try {
			const response = await chrome.tabs.sendMessage(tabId, { action: "ping" });
			if (response?.pong) {
				return true;
			}
		} catch (_err) {
			// Expected errors: no listener (script not injected), tab closed, etc.
			// Continue to injection
		}

		// Inject in two steps to guarantee execution order across frames.
		await chrome.scripting.executeScript({
			target: { tabId, allFrames: true },
			files: ["storage-utils.js"],
			injectImmediately: true,
		});
		await chrome.scripting.executeScript({
			target: { tabId, allFrames: true },
			files: ["content.js"],
			injectImmediately: true,
		});

		return true;
	} catch (e) {
		// Log unexpected errors for debugging
		if (ExtensionLogic.shouldLogBackgroundInjectionError(e)) {
			console.error("Unexpected error injecting content script:", e);
		}
		return false;
	}
}

// Update badge for a specific tab
async function updateBadge(tabId, url) {
	try {
		if (!ExtensionLogic.parseSupportedHostname(url)) {
			await chrome.action.setBadgeText({
				text: BADGE_CONFIG.DISABLED.text,
				tabId,
			});
			return;
		}

		const enabled = await isSiteEnabledForUrl(url);

		if (enabled) {
			// Show green badge with checkmark
			await chrome.action.setBadgeText({
				text: BADGE_CONFIG.ENABLED.text,
				tabId,
			});
			await chrome.action.setBadgeBackgroundColor({
				color: BADGE_CONFIG.ENABLED.color,
				tabId,
			});

			// Inject content script if site is enabled
			await injectContentScript(tabId);
		} else {
			// No badge for disabled sites
			await chrome.action.setBadgeText({
				text: BADGE_CONFIG.DISABLED.text,
				tabId,
			});
		}
	} catch (e) {
		// Tab might have been closed during async operations - silently ignore these expected errors
		// Log other unexpected errors for debugging
		if (e.message && !e.message.includes("No tab with id")) {
			console.error("Unexpected error in updateBadge:", e);
		}
	}
}

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
	try {
		const tab = await chrome.tabs.get(activeInfo.tabId);
		await updateBadge(activeInfo.tabId, tab.url);
	} catch (_e) {
		// Tab might have been closed
	}
});

// Listen for tab updates (URL changes, page loads)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	try {
		// Only update when URL changes or page completes loading
		if (changeInfo.url || changeInfo.status === "complete") {
			await updateBadge(tabId, tab.url);
		}
	} catch (e) {
		// Error during tab update handling - log for debugging
		console.error("Error in tabs.onUpdated:", e);
	}
});

// Listen for storage changes (when user toggles a site)
chrome.storage.onChanged.addListener(async (changes, namespace) => {
	try {
		if (namespace === "sync" && changes.sites) {
			// Only update badge for the currently active tab to reduce CPU usage
			// This is sufficient since the badge is updated when switching tabs anyway
			const tabs = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});
			for (const tab of tabs) {
				if (tab && tab.id !== null && tab.id !== undefined && tab.url) {
					await updateBadge(tab.id, tab.url);
				}
			}
		}
	} catch (e) {
		// Error during storage change handling - log for debugging
		console.error("Error in storage.onChanged:", e);
	}
});

chrome.permissions.onAdded.addListener(async (permissions) => {
	try {
		const finalizedHostnames = await SiteEnablement.finalizePendingSiteEnables(
			permissions?.origins || [],
			{
				getPending: (hostname) => SiteEnablement.getPendingSiteEnable(hostname),
				clearPending: (hostname) =>
					SiteEnablement.clearPendingSiteEnable(hostname),
				setSiteConfig: (hostname, enabled, features) =>
					StorageUtils.setSiteConfig(hostname, enabled, features),
			},
		);

		if (finalizedHostnames.length === 0) {
			return;
		}

		const tabs = await chrome.tabs.query({});
		for (const tab of tabs) {
			const hostname = ExtensionLogic.parseSupportedHostname(tab.url);
			if (!hostname || !finalizedHostnames.includes(hostname)) {
				continue;
			}

			await updateBadge(tab.id, tab.url);
		}
	} catch (e) {
		console.error("Error in permissions.onAdded:", e);
	}
});

// Note: chrome.action.onClicked does not fire when a popup is defined in the manifest.
// If you want to use this listener, you must remove the default_popup from manifest.json
// and handle the extension icon click manually. Keeping this commented out for reference:
//
// chrome.action.onClicked.addListener(function(tab) {
//   injectContentScript(tab.id);
// });

// Listen for navigation events to inject content script on enabled sites
chrome.webNavigation.onCommitted.addListener(async (details) => {
	try {
		// Only handle main frame navigations
		if (details.frameId !== 0) return;

		if (!ExtensionLogic.parseSupportedHostname(details.url)) return;

		const enabled = await isSiteEnabledForUrl(details.url);

		if (enabled) {
			await injectContentScript(details.tabId);
		}
	} catch (e) {
		// Error during navigation handling - log for debugging
		console.error("Error in webNavigation.onCommitted:", e);
	}
});

// On extension install/update/reload, inject into already-open tabs with enabled sites
chrome.runtime.onInstalled.addListener(async () => {
	try {
		// Migrate storage from old format to new format if needed
		await StorageUtils.migrateStorage();

		const sites = await StorageUtils.getAllSites();
		const tabs = await chrome.tabs.query({});

		for (const tab of tabs) {
			const hostname = ExtensionLogic.parseSupportedHostname(tab.url);
			if (!hostname) continue;

			if (
				sites[hostname]?.enabled &&
				(await SitePermissions.hasPersistentSiteAccessForUrl(tab.url))
			) {
				await injectContentScript(tab.id);
			}

			// Update badge
			await updateBadge(tab.id, tab.url);
		}
	} catch (e) {
		// Error during extension initialization - log for debugging
		console.error("Error in runtime.onInstalled:", e);
	}
});
