const test = require("node:test");
const assert = require("node:assert/strict");

function createStorageMock(initialSites = {}) {
	let sites = { ...initialSites };

	return {
		sync: {
			async get(keys) {
				if (Array.isArray(keys) && keys.includes("sites")) {
					return { sites };
				}
				return {};
			},
			async set(payload) {
				if (payload && Object.hasOwn(payload, "sites")) {
					sites = payload.sites;
				}
			},
		},
		getSites() {
			return sites;
		},
	};
}

test("normalizeSiteConfig migrates booleans to config object", () => {
	const { normalizeSiteConfig } = require("../storage-utils.js");
	const enabled = normalizeSiteConfig(true);
	const disabled = normalizeSiteConfig(false);

	assert.equal(enabled.enabled, true);
	assert.equal(disabled.enabled, false);
	assert.deepEqual(enabled.features, {
		textSelection: true,
		contextMenu: true,
		copyPaste: true,
		cursor: true,
	});
});

test("normalizeSiteConfig merges missing feature flags with defaults", () => {
	const { normalizeSiteConfig } = require("../storage-utils.js");
	const config = normalizeSiteConfig({
		enabled: true,
		features: { textSelection: false },
	});

	assert.deepEqual(config, {
		enabled: true,
		features: {
			textSelection: false,
			contextMenu: true,
			copyPaste: true,
			cursor: true,
		},
	});
});

test("setSiteConfig keeps existing feature preferences when disabling", async () => {
	const chromeMock = createStorageMock({
		"example.com": {
			enabled: true,
			features: {
				textSelection: false,
				contextMenu: true,
				copyPaste: false,
				cursor: true,
			},
		},
	});
	global.chrome = { storage: chromeMock };
	const { setSiteConfig, getSiteConfig } = require("../storage-utils.js");

	await setSiteConfig("example.com", false);
	const config = await getSiteConfig("example.com");

	assert.equal(config.enabled, false);
	assert.deepEqual(config.features, {
		textSelection: false,
		contextMenu: true,
		copyPaste: false,
		cursor: true,
	});
});

test("updateSiteFeatures keeps enabled state unchanged", async () => {
	const chromeMock = createStorageMock({
		"example.com": {
			enabled: false,
			features: {
				textSelection: true,
				contextMenu: true,
				copyPaste: true,
				cursor: true,
			},
		},
	});
	global.chrome = { storage: chromeMock };
	const { updateSiteFeatures, getSiteConfig } = require("../storage-utils.js");

	await updateSiteFeatures("example.com", {
		textSelection: false,
		contextMenu: false,
		copyPaste: true,
		cursor: true,
	});
	const config = await getSiteConfig("example.com");

	assert.equal(config.enabled, false);
	assert.deepEqual(config.features, {
		textSelection: false,
		contextMenu: false,
		copyPaste: true,
		cursor: true,
	});
});

test("migrateStorage converts only legacy boolean entries", async () => {
	const chromeMock = createStorageMock({
		"legacy-true.com": true,
		"legacy-false.com": false,
		"new-format.com": {
			enabled: true,
			features: {
				textSelection: false,
				contextMenu: true,
				copyPaste: true,
				cursor: true,
			},
		},
	});
	global.chrome = { storage: chromeMock };
	const { migrateStorage, getAllSites } = require("../storage-utils.js");

	await migrateStorage();
	const sites = await getAllSites();

	assert.equal(sites["legacy-true.com"].enabled, true);
	assert.equal(sites["legacy-false.com"].enabled, false);
	assert.deepEqual(sites["new-format.com"], {
		enabled: true,
		features: {
			textSelection: false,
			contextMenu: true,
			copyPaste: true,
			cursor: true,
		},
	});
});
