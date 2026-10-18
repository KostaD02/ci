const { appendFileSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

// ? Chrome takes one to four dot-separated integers, each 0-65535 and without leading zeros
const MAX_SEGMENT = 65535;
const SEGMENT = /^(0|[1-9][0-9]*)$/;

function isSegment(value) {
  return SEGMENT.test(value) && Number(value) <= MAX_SEGMENT;
}

function appendPrVersion({ dir, prNumber }) {
  if (!prNumber) {
    throw new Error(
      "No pull request number, run this on a pull_request event or pass pr-number",
    );
  }

  if (!isSegment(prNumber)) {
    throw new Error(
      `PR number "${prNumber}" must be an integer from 0 to ${MAX_SEGMENT} to fit a Chrome version segment`,
    );
  }

  const file = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  const previous = pkg.version;

  if (typeof previous !== "string") {
    throw new Error(`${file} has no version`);
  }

  const segments = previous.split(".");

  if (segments.length > 3 || !segments.every(isSegment)) {
    throw new Error(
      `${file} version "${previous}" must be one to three integers from 0 to ${MAX_SEGMENT}, like 1.2.0, to take the PR number as an extra segment`,
    );
  }

  pkg.version = `${previous}.${prNumber}`;
  writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");

  return { previous, version: pkg.version };
}

module.exports = appendPrVersion;

if (require.main === module) {
  try {
    const { previous, version } = appendPrVersion({
      dir: ".",
      prNumber: process.env.PR_NUMBER,
    });

    console.log(`package.json version ${previous} -> ${version}`);

    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
    }
  } catch (error) {
    console.log(`::error::${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
