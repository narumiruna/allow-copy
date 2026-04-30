const test = require("node:test");
const assert = require("node:assert/strict");

const {
	finalizePendingSiteEnables,
	getHostnamesFromOrigins,
} = require("../site-enablement.js");

test("getHostnamesFromOrigins extracts unique hostnames from permission origins", () => {
	assert.deepEqual(
		getHostnamesFromOrigins(["https://example.com/*", "http://example.com/*"]),
		["example.com"],
	);
});

test("finalizePendingSiteEnables persists enabled state for granted pending sites", async () => {
	const calls = [];
	const pending = new Map([
		[
			"example.com",
			{
				hostname: "example.com",
				features: {
					textSelection: false,
					contextMenu: true,
					copyPaste: true,
					cursor: true,
				},
			},
		],
	]);

	const finalized = await finalizePendingSiteEnables(
		["https://example.com/*"],
		{
			async getPending(hostname) {
				return pending.get(hostname) || null;
			},
			async clearPending(hostname) {
				pending.delete(hostname);
			},
			async setSiteConfig(hostname, enabled, features) {
				calls.push({ hostname, enabled, features });
			},
		},
	);

	assert.deepEqual(finalized, ["example.com"]);
	assert.deepEqual(calls, [
		{
			hostname: "example.com",
			enabled: true,
			features: {
				textSelection: false,
				contextMenu: true,
				copyPaste: true,
				cursor: true,
			},
		},
	]);
	assert.equal(pending.has("example.com"), false);
});

test("finalizePendingSiteEnables ignores granted origins without a pending site", async () => {
	const calls = [];

	const finalized = await finalizePendingSiteEnables(
		["https://example.com/*"],
		{
			async getPending() {
				return null;
			},
			async clearPending() {},
			async setSiteConfig(hostname, enabled, features) {
				calls.push({ hostname, enabled, features });
			},
		},
	);

	assert.deepEqual(finalized, []);
	assert.deepEqual(calls, []);
});
