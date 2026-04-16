const test = require("node:test");
const assert = require("node:assert/strict");

const {
	parseSupportedHttpUrl,
	parseSupportedHostname,
	classifyPopupInjectionError,
	shouldLogBackgroundInjectionError,
} = require("../extension-logic.js");

test("parseSupportedHttpUrl accepts only http/https with hostname", () => {
	assert.equal(
		parseSupportedHttpUrl("https://example.com/path").hostname,
		"example.com",
	);
	assert.equal(
		parseSupportedHttpUrl("http://example.com").hostname,
		"example.com",
	);
	assert.equal(parseSupportedHttpUrl("file:///tmp/index.html"), null);
	assert.equal(parseSupportedHttpUrl("chrome://extensions/"), null);
	assert.equal(parseSupportedHttpUrl("not-a-url"), null);
});

test("parseSupportedHostname returns hostname for supported URLs", () => {
	assert.equal(
		parseSupportedHostname("https://news.ycombinator.com/item?id=1"),
		"news.ycombinator.com",
	);
	assert.equal(parseSupportedHostname("chrome://settings/"), null);
});

test("classifyPopupInjectionError maps cannot-access errors to user-friendly failure", () => {
	const result = classifyPopupInjectionError(
		new Error("Cannot access contents of url"),
	);
	assert.deepEqual(result, {
		success: false,
		error: "Cannot access this page",
		shouldLog: false,
	});
});

test("classifyPopupInjectionError treats duplicate injection as success", () => {
	const result = classifyPopupInjectionError(
		new Error("Script already injected duplicate"),
	);
	assert.deepEqual(result, {
		success: true,
		shouldLog: false,
	});
});

test("classifyPopupInjectionError returns loggable error for unexpected failures", () => {
	const result = classifyPopupInjectionError(new Error("Boom"));
	assert.deepEqual(result, {
		success: false,
		error: "Boom",
		shouldLog: true,
	});
});

test("shouldLogBackgroundInjectionError ignores expected injection failures", () => {
	assert.equal(
		shouldLogBackgroundInjectionError(new Error("Cannot access page")),
		false,
	);
	assert.equal(
		shouldLogBackgroundInjectionError(new Error("No tab with id: 1")),
		false,
	);
	assert.equal(
		shouldLogBackgroundInjectionError(new Error("unexpected failure")),
		true,
	);
});
