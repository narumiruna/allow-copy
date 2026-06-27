#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const bump = process.argv[2] || "patch";
const bumps = new Set(["major", "minor", "patch"]);

if (!bumps.has(bump)) {
	die(`Unknown bump type: ${bump}. Use major, minor, or patch.`);
}

const path = "manifest.json";
let text;
let manifest;

try {
	text = readFileSync(path, "utf8");
} catch (error) {
	die(`Could not read ${path}: ${error.message}`);
}

try {
	manifest = JSON.parse(text);
} catch (error) {
	die(`Could not parse ${path}: ${error.message}`);
}

const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(manifest.version);

if (!match) {
	die(`Invalid manifest version: ${manifest.version}`);
}

const parts = match.slice(1).map(Number);

if (bump === "major") {
	parts[0] += 1;
	parts[1] = 0;
	parts[2] = 0;
} else if (bump === "minor") {
	parts[1] += 1;
	parts[2] = 0;
} else {
	parts[2] += 1;
}

const version = parts.join(".");
const nextText = text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`);

if (nextText === text) {
	die("Could not replace manifest version.");
}

try {
	writeFileSync(path, nextText);
} catch (error) {
	die(`Could not write ${path}: ${error.message}`);
}

console.log(version);

function die(message) {
	console.error(message);
	process.exit(1);
}
