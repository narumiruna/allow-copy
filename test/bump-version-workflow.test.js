const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
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
	const dir = mkdtempSync(path.join(tmpdir(), "allow-copy-version-"));

	try {
		writeFileSync(
			path.join(dir, "manifest.json"),
			'{\n\t"name": "Allow Copy",\n\t"version": "1.2.3"\n}\n',
		);

		const stdout = execFileSync(process.execPath, [bumpScript, ...args], {
			cwd: dir,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
		const text = readFileSync(path.join(dir, "manifest.json"), "utf8");

		return { stdout, manifest: JSON.parse(text) };
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

test("bump script supports major, minor, patch, and default patch", () => {
	assert.equal(runBump().stdout, "1.2.4");
	assert.equal(runBump(["patch"]).manifest.version, "1.2.4");
	assert.equal(runBump(["minor"]).manifest.version, "1.3.0");
	assert.equal(runBump(["major"]).manifest.version, "2.0.0");
});

test("bump script rejects unknown bump types", () => {
	assert.throws(() => runBump(["bad"]), /Command failed/);
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
