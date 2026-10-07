const { existsSync, readdirSync, readFileSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");
const { gzipSync } = require("node:zlib");

const MAX_ENTRIES = Number(process.env.MAX_ENTRIES || 10);

module.exports = async ({ github, context }) => {
  const { owner, repo } = context.repo;
  const issueNumber = context.issue.number;
  const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${context.runId}`;
  const headSha = context.payload.pull_request?.head?.sha ?? context.sha ?? "";
  const marker = process.env.MARKER || "<!-- pr-artifact-report -->";

  const entry = {
    sha: headSha.slice(0, 7),
    count: process.env.PR_COMMIT_COUNT || "X",
    date: new Date().toISOString().slice(0, 16).replace("T", " "),
    name: process.env.ARTIFACT_NAME || "artifact",
    url: process.env.ARTIFACT_URL || runUrl,
    links: parseLinks(process.env.LINKS),
  };

  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });
  const existing = comments.find((comment) => comment.body?.includes(marker));

  const entries = [entry, ...readHistory(existing)].slice(0, MAX_ENTRIES);
  const body = renderBody({
    marker,
    entries,
    title: process.env.TITLE || "📦 Artifact",
    sizes: collectSizes(process.env.SIZE_TABLE, process.env.SIZE_DIR),
    mode: process.env.SIZE_TABLE || "none",
    footer: process.env.FOOTER || "",
  });

  if (existing) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }

  return body;
};

function parseLinks(raw) {
  if (!raw || !raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((link) => link && link.label && link.url)
      : [];
  } catch {
    console.log("::warning::LINKS was not valid JSON, ignoring it");
    return [];
  }
}

function readHistory(existing) {
  if (!existing) {
    return [];
  }

  const match = existing.body.match(/<!-- data:(.*?)-->/s);

  if (!match) {
    return [];
  }

  try {
    const parsed = JSON.parse(match[1].trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatSize(bytes) {
  return `${(bytes / 1000).toFixed(1)} kB`;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const full = join(dir, item.name);
    return item.isDirectory() ? walk(full) : [full];
  });
}

function collectSizes(mode, dir) {
  if (!mode || mode === "none" || !dir || !existsSync(dir)) {
    return [];
  }

  const files = walk(dir).sort();

  if (mode === "css") {
    return files
      .filter((file) => file.endsWith(".css") && !file.endsWith(".min.css"))
      .map((file) => {
        const expanded = readFileSync(file);
        const minPath = file.replace(/\.css$/, ".min.css");
        const minified = existsSync(minPath) ? readFileSync(minPath) : expanded;

        return {
          file: relative(dir, file),
          columns: [
            formatSize(expanded.length),
            formatSize(minified.length),
            formatSize(gzipSync(minified).length),
          ],
        };
      });
  }

  return files.map((file) => ({
    file: relative(dir, file),
    columns: [formatSize(statSync(file).size)],
  }));
}

function renderBody({ marker, entries, title, sizes, mode, footer }) {
  const [latest, ...previous] = entries;

  const lines = [
    marker,
    `<!-- data:${JSON.stringify(entries)}-->`,
    `## ${title}`,
    ``,
    `**${latest.sha} · build N${latest.count}** _(${latest.date} UTC)_`,
    ``,
    `⬇️ **[${latest.name}.zip](${latest.url})**`,
  ];

  for (const link of latest.links) {
    lines.push(`${link.note ? `${link.note} ` : ""}**[${link.label}](${link.url})**`);
  }

  if (sizes.length) {
    const header = mode === "css" ? ["CSS", "Minified", "Gzipped"] : ["Size"];
    lines.push(
      ``,
      `| File | ${header.join(" | ")} |`,
      `| --- | ${header.map(() => "---:").join(" | ")} |`,
      ...sizes.map((entry) => `| \`${entry.file}\` | ${entry.columns.join(" | ")} |`),
    );
  }

  if (footer.trim()) {
    lines.push(``, footer.trim());
  }

  if (previous.length) {
    const extra = latest.links.map((link) => link.label);
    lines.push(
      ``,
      `<details>`,
      `<summary>Previous builds (${previous.length})</summary>`,
      ``,
      `| Build | Commit | Artifact |${extra.map((label) => ` ${label} |`).join("")}`,
      `| --- | --- | --- |${extra.map(() => " --- |").join("")}`,
      ...previous.map((item) => {
        const links = extra.map((label) => {
          const match = (item.links || []).find((link) => link.label === label);
          return ` ${match ? `[link](${match.url})` : "-"} |`;
        });
        return `| ${item.count} | ${item.sha} | [zip](${item.url}) |${links.join("")}`;
      }),
      ``,
      `</details>`,
    );
  }

  return lines.join("\n");
}
