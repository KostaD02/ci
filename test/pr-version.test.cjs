const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const appendPrVersion = require("../.github/actions/pr-version/append-pr-version.cjs");

const SCRIPT = require.resolve("../.github/actions/pr-version/append-pr-version.cjs");

function packageWith(fields) {
  const dir = mkdtempSync(join(tmpdir(), "pkg-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "ext", ...fields }));
  return dir;
}

function readPackage(dir) {
  return readFileSync(join(dir, "package.json"), "utf8");
}

function assertRejected(version, prNumber, message) {
  const dir = packageWith({ version });
  const before = readPackage(dir);

  assert.throws(
    () => appendPrVersion({ dir, prNumber }),
    { message },
    `${version} + ${prNumber}`,
  );
  assert.equal(readPackage(dir), before);
}

function runScript(dir, prNumber) {
  const output = join(dir, "github-output");
  writeFileSync(output, "");

  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: dir,
    env: { ...process.env, PR_NUMBER: prNumber, GITHUB_OUTPUT: output },
    encoding: "utf8",
  });

  return { ...result, output: readFileSync(output, "utf8") };
}

test("appends the PR number as a fourth segment", () => {
  const dir = packageWith({ version: "1.2.0" });

  assert.deepEqual(appendPrVersion({ dir, prNumber: "22" }), {
    previous: "1.2.0",
    version: "1.2.0.22",
  });
  assert.equal(JSON.parse(readPackage(dir)).version, "1.2.0.22");
});

test("accepts versions with one or two segments", () => {
  for (const [version, expected] of [
    ["1", "1.22"],
    ["1.2", "1.2.22"],
  ]) {
    const dir = packageWith({ version });
    assert.equal(appendPrVersion({ dir, prNumber: "22" }).version, expected);
  }
});

test("accepts the bounds of a Chrome version segment", () => {
  assert.equal(
    appendPrVersion({ dir: packageWith({ version: "65535.0.0" }), prNumber: "65535" })
      .version,
    "65535.0.0.65535",
  );
  assert.equal(
    appendPrVersion({ dir: packageWith({ version: "0.0.0" }), prNumber: "0" }).version,
    "0.0.0.0",
  );
});

test("keeps the other fields and writes two-space json with a trailing newline", () => {
  const dir = packageWith({ version: "1.2.0", scripts: { build: "vite build" } });

  appendPrVersion({ dir, prNumber: "22" });

  assert.equal(
    readPackage(dir),
    `{\n  "name": "ext",\n  "version": "1.2.0.22",\n  "scripts": {\n    "build": "vite build"\n  }\n}\n`,
  );
});

test("rejects a missing PR number", () => {
  for (const prNumber of [undefined, ""]) {
    assertRejected("1.2.0", prNumber, /^No pull request number/);
  }
});

test("rejects a PR number that is not a whole number", () => {
  for (const prNumber of ["abc", "12a", "-1", "1.5", " 22", "022", "1e3"]) {
    assertRejected("1.2.0", prNumber, /must be an integer from 0 to 65535/);
  }
});

test("rejects a PR number above 65535 instead of clamping it", () => {
  assertRejected(
    "1.2.0",
    "65536",
    /^PR number "65536" must be an integer from 0 to 65535/,
  );
});

test("rejects a version that already has four segments", () => {
  assertRejected("1.2.3.4", "22", /version "1\.2\.3\.4" must be one to three integers/);
});

test("rejects prerelease and build suffixes", () => {
  for (const version of ["1.2.3-beta.1", "1.2.3+build.5"]) {
    assertRejected(version, "22", /must be one to three integers/);
  }
});

test("rejects other versions Chrome would not accept", () => {
  for (const version of ["v1.2.3", "01.2.3", "1.70000.0", "1..2", ""]) {
    assertRejected(version, "22", /must be one to three integers/);
  }
});

test("rejects a package.json without a version", () => {
  assertRejected(undefined, "22", /has no version$/);
});

test("the script writes the version to GITHUB_OUTPUT", () => {
  const dir = packageWith({ version: "1.2.0" });
  const result = runScript(dir, "22");

  assert.equal(result.status, 0);
  assert.equal(result.output, "version=1.2.0.22\n");
  assert.match(result.stdout, /1\.2\.0 -> 1\.2\.0\.22/);
});

test("the script reports an ::error:: and exits 1 on an invalid version", () => {
  const dir = packageWith({ version: "1.2.3-beta.1" });
  const result = runScript(dir, "22");

  assert.equal(result.status, 1);
  assert.equal(result.output, "");
  assert.match(result.stdout, /^::error::package\.json version "1\.2\.3-beta\.1"/m);
  assert.equal(JSON.parse(readPackage(dir)).version, "1.2.3-beta.1");
});
