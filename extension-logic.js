// Shared pure logic helpers for popup/background scripts.

((root) => {
	function parseSupportedHttpUrl(rawUrl) {
		if (!rawUrl) return null;

		try {
			const parsedUrl = new URL(rawUrl);
			const isSupportedProtocol =
				parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
			if (!isSupportedProtocol || !parsedUrl.hostname) {
				return null;
			}
			return parsedUrl;
		} catch (_e) {
			return null;
		}
	}

	function parseSupportedHostname(rawUrl) {
		const parsedUrl = parseSupportedHttpUrl(rawUrl);
		return parsedUrl ? parsedUrl.hostname : null;
	}

	function classifyPopupInjectionError(error) {
		const message = error?.message || "";

		if (message.includes("Cannot access")) {
			return {
				success: false,
				error: "Cannot access this page",
				shouldLog: false,
			};
		}

		if (message && !message.includes("duplicate")) {
			return { success: false, error: message, shouldLog: true };
		}

		return { success: true, shouldLog: false };
	}

	function shouldLogBackgroundInjectionError(error) {
		const message = error?.message || "";
		return Boolean(
			message &&
				!message.includes("Cannot access") &&
				!message.includes("No tab"),
		);
	}

	const ExtensionLogic = {
		parseSupportedHttpUrl,
		parseSupportedHostname,
		classifyPopupInjectionError,
		shouldLogBackgroundInjectionError,
	};

	if (typeof module !== "undefined" && module.exports) {
		module.exports = ExtensionLogic;
	} else {
		root.ExtensionLogic = ExtensionLogic;
	}
})(typeof self !== "undefined" ? self : this);
