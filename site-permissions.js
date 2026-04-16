// Per-site host permission helpers for persistent site access.

((root) => {
	function getPermissionOriginForUrl(rawUrl) {
		if (!rawUrl) {
			return null;
		}

		try {
			const parsedUrl = new URL(rawUrl);
			if (
				(parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") ||
				!parsedUrl.hostname
			) {
				return null;
			}

			return `${parsedUrl.protocol}//${parsedUrl.hostname}/*`;
		} catch (_e) {
			return null;
		}
	}

	function getPermissionOriginsForHostname(hostname) {
		if (!hostname) {
			return [];
		}

		return [`http://${hostname}/*`, `https://${hostname}/*`];
	}

	async function hasPersistentSiteAccessForUrl(
		rawUrl,
		permissionsApi = chrome.permissions,
	) {
		const origin = getPermissionOriginForUrl(rawUrl);
		if (!origin) {
			return false;
		}

		if (!permissionsApi || typeof permissionsApi.contains !== "function") {
			return false;
		}

		return await permissionsApi.contains({ origins: [origin] });
	}

	async function ensurePersistentSiteAccess(
		hostname,
		permissionsApi = chrome.permissions,
	) {
		const origins = getPermissionOriginsForHostname(hostname);
		if (origins.length === 0) {
			return false;
		}

		if (!permissionsApi || typeof permissionsApi.contains !== "function") {
			return false;
		}

		const alreadyGranted = await permissionsApi.contains({ origins });
		if (alreadyGranted) {
			return true;
		}

		if (typeof permissionsApi.request !== "function") {
			return false;
		}

		return await permissionsApi.request({ origins });
	}

	const SitePermissions = {
		getPermissionOriginForUrl,
		getPermissionOriginsForHostname,
		hasPersistentSiteAccessForUrl,
		ensurePersistentSiteAccess,
	};

	if (typeof module !== "undefined" && module.exports) {
		module.exports = SitePermissions;
	} else {
		root.SitePermissions = SitePermissions;
	}
})(typeof self !== "undefined" ? self : this);
