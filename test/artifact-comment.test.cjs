const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const report = require("../.github/actions/artifact-comment/comment-pr.cjs");

const ENV_KEYS = [
  "ARTIFACT_NAME",
  "ARTIFACT_URL",
  "PR_COMMIT_COUNT",
  "TITLE",
  "MARKER",
  "SIZE_TABLE",
  "SIZE_DIR",
  "LINKS",
  "FOOTER",
];

const context = {
  repo: { owner: "KostaD02", repo: "ci" },
  issue: { number: 7 },
  runId: 1,
  payload: { pull_request: { head: { sha: "abcdef1234567" } } },
};

async function run(env, existing = []) {
  const calls = [];
  const github = {
    paginate: async () => existing,
    rest: {
      issues: {
        listComments: {},
        updateComment: async (args) => calls.push(["update", args]),
        createComment: async (args) => calls.push(["create", args]),
      },
    },
  };

  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(
    process.env,
    {
      ARTIFACT_NAME: "ci-PR-7-1",
      ARTIFACT_URL: "https://example.test/zip",
      PR_COMMIT_COUNT: "1",
    },
    env,
  );

  const body = await report({ github, context });
  return { body, calls };
}

function distWith(files) {
  const dir = mkdtempSync(join(tmpdir(), "dist-"));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

function previousComment(entries) {
  return {
    id: 42,
    body: `<!-- pr-artifact-report -->\n<!-- data:${JSON.stringify(entries)}-->\n## old`,
  };
}

test("creates a comment with the marker and the artifact link when none exists", async () => {
  const { body, calls } = await run({});

  assert.ok(body.startsWith("<!-- pr-artifact-report -->"));
  assert.match(body, /\*\*abcdef1 · build N1\*\*/);
  assert.match(body, /\[ci-PR-7-1\.zip\]\(https:\/\/example\.test\/zip\)/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "create");
  assert.equal(calls[0][1].issue_number, 7);
});

test("updates the existing comment and lists previous builds", async () => {
  const existing = previousComment([
    {
      sha: "0ldsha1",
      count: "1",
      date: "2026-10-07 05:00",
      name: "ci-PR-7-1",
      url: "https://example.test/old",
      links: [],
    },
  ]);
  const { body, calls } = await run(
    { ARTIFACT_NAME: "ci-PR-7-2", PR_COMMIT_COUNT: "2" },
    [existing],
  );

  assert.equal(calls[0][0], "update");
  assert.equal(calls[0][1].comment_id, 42);
  assert.match(body, /build N2/);
  assert.match(body, /Previous builds \(1\)/);
  assert.match(body, /\| 1 \| 0ldsha1 \| \[zip\]\(https:\/\/example\.test\/old\) \|/);
});

test("keeps at most ten builds in the history", async () => {
  const entries = Array.from({ length: 12 }, (_, i) => ({
    sha: `sha${i}`,
    count: String(i),
    date: "",
    name: "x",
    url: "u",
    links: [],
  }));
  const { body } = await run({}, [previousComment(entries)]);

  assert.match(body, /Previous builds \(9\)/);
});

test("renders a file size table", async () => {
  const dir = distWith({ "a.txt": "x".repeat(1234), "nested/b.txt": "y".repeat(10) });
  const { body } = await run({ SIZE_TABLE: "files", SIZE_DIR: dir });

  assert.match(body, /\| File \| Size \|/);
  assert.match(body, /\| `a\.txt` \| 1\.2 kB \|/);
  assert.match(body, /\| `nested\/b\.txt` \| 0\.0 kB \|/);
});

test("renders the css table with minified and gzipped sizes", async () => {
  const dir = distWith({
    "a.css": "body { margin: 0 }\n",
    "a.min.css": "body{margin:0}",
  });
  const { body } = await run({ SIZE_TABLE: "css", SIZE_DIR: dir });

  assert.match(body, /\| File \| CSS \| Minified \| Gzipped \|/);
  assert.match(body, /\| `a\.css` \| 0\.0 kB \| 0\.0 kB \| 0\.0 kB \|/);
  assert.doesNotMatch(body, /a\.min\.css/);
});

test("renders extra links and the footer", async () => {
  const { body } = await run({
    LINKS: '[{"label":"client image","url":"https://example.test/img","note":"docker"}]',
    FOOTER: "Install hint",
  });

  assert.match(body, /docker \*\*\[client image\]\(https:\/\/example\.test\/img\)\*\*/);
  assert.match(body, /\nInstall hint$/);
});

test("ignores links that are not valid json", async () => {
  const { body } = await run({ LINKS: "not json" });

  assert.doesNotMatch(body, /\[link\]/);
  assert.match(body, /\[ci-PR-7-1\.zip\]/);
});
