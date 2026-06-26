const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const {
	chmodSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const bumpScript = path.join(root, ".github/scripts/bump-manifest-version.mjs");
const workflowPath = path.join(
	root,
	".github/workflows/bump-version-release.yml",
);

function runBump(args = []) {
	return withTempDir((dir) => {
		writeManifest(dir);
		const stdout = runBumpInDir(dir, args);
		const text = readFileSync(path.join(dir, "manifest.json"), "utf8");

		return { stdout, manifest: JSON.parse(text) };
	});
}

function runBumpInDir(dir, args = []) {
	return execFileSync(process.execPath, [bumpScript, ...args], {
		cwd: dir,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

function withTempDir(callback) {
	const dir = mkdtempSync(path.join(tmpdir(), "allow-copy-version-"));

	try {
		return callback(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function writeManifest(dir) {
	writeFileSync(
		path.join(dir, "manifest.json"),
		'{\n\t"name": "Allow Copy",\n\t"version": "1.2.3"\n}\n',
	);
}

function assertBumpFails(dir, stderrPattern, args = []) {
	assert.throws(
		() => runBumpInDir(dir, args),
		(error) => {
			assert.equal(error.status, 1);
			const stderr = error.stderr.toString();
			assert.match(stderr, stderrPattern);
			assert.doesNotMatch(stderr, /\n\s+at /);
			return true;
		},
	);
}

test("bump script supports major, minor, patch, and default patch", () => {
	assert.equal(runBump().stdout, "1.2.4");
	assert.equal(runBump(["patch"]).manifest.version, "1.2.4");
	assert.equal(runBump(["minor"]).manifest.version, "1.3.0");
	assert.equal(runBump(["major"]).manifest.version, "2.0.0");
});

test("bump script reports unknown bump types", () => {
	withTempDir((dir) => {
		writeManifest(dir);
		assertBumpFails(dir, /Unknown bump type: bad/, ["bad"]);
	});
});

test("bump script reports manifest read errors without a stack trace", () => {
	withTempDir((dir) => {
		assertBumpFails(dir, /Could not read manifest\.json:/);
	});
});

test("bump script reports manifest write errors without a stack trace", () => {
	withTempDir((dir) => {
		writeManifest(dir);
		chmodSync(path.join(dir, "manifest.json"), 0o400);
		assertBumpFails(dir, /Could not write manifest\.json:/);
	});
});

test("release workflow exposes bump choices, tags, and creates a release", () => {
	const workflow = readFileSync(workflowPath, "utf8");

	assert.match(workflow, /workflow_dispatch:/);
	assert.match(workflow, /default:\s*patch/);
	assert.match(workflow, /type:\s*choice/);
	assert.match(workflow, /-\s*major/);
	assert.match(workflow, /-\s*minor/);
	assert.match(workflow, /-\s*patch/);
	assert.match(workflow, /contents:\s*read/);
	assert.match(workflow, /PAT_TOKEN: \$\{\{ secrets\.PAT_TOKEN \}\}/);
	assert.match(workflow, /token: \$\{\{ secrets\.PAT_TOKEN \}\}/);
	assert.doesNotMatch(workflow, /github\.token/);
	assert.match(workflow, /git tag "\$TAG"/);
	assert.match(workflow, /gh release create "\$TAG"/);
});
