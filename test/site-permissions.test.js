const test = require("node:test");
const assert = require("node:assert/strict");

const {
	getPermissionOriginsForHostname,
	getPermissionOriginForUrl,
	ensurePersistentSiteAccess,
	hasPersistentSiteAccessForUrl,
} = require("../site-permissions.js");

test("getPermissionOriginsForHostname builds both http and https origins", () => {
	assert.deepEqual(getPermissionOriginsForHostname("example.com"), [
		"http://example.com/*",
		"https://example.com/*",
	]);
});

test("getPermissionOriginForUrl builds an origin pattern for the current page", () => {
	assert.equal(
		getPermissionOriginForUrl("https://example.com/path?x=1"),
		"https://example.com/*",
	);
});

test("ensurePersistentSiteAccess does not request permissions when all origins are already granted", async () => {
	const seenOrigins = [];
	const permissionsApi = {
		async contains({ origins }) {
			seenOrigins.push(...origins);
			return true;
		},
		async request() {
			throw new Error("request should not be called");
		},
	};

	const granted = await ensurePersistentSiteAccess(
		"example.com",
		permissionsApi,
	);

	assert.equal(granted, true);
	assert.deepEqual(seenOrigins, [
		"http://example.com/*",
		"https://example.com/*",
	]);
});

test("ensurePersistentSiteAccess requests missing origins and returns the browser decision", async () => {
	const requests = [];
	const permissionsApi = {
		async contains() {
			return false;
		},
		async request({ origins }) {
			requests.push(origins);
			return false;
		},
	};

	const granted = await ensurePersistentSiteAccess(
		"example.com",
		permissionsApi,
	);

	assert.equal(granted, false);
	assert.deepEqual(requests, [
		["http://example.com/*", "https://example.com/*"],
	]);
});

test("hasPersistentSiteAccessForUrl checks the current page origin only", async () => {
	const seenOrigins = [];
	const hasAccess = await hasPersistentSiteAccessForUrl(
		"https://example.com/path",
		{
			async contains({ origins }) {
				seenOrigins.push(...origins);
				return true;
			},
		},
	);

	assert.equal(hasAccess, true);
	assert.deepEqual(seenOrigins, ["https://example.com/*"]);
});
