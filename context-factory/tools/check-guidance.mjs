#!/usr/bin/env node
// Structural checks only: navigation and metadata cannot prove compliance or behavior.
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const slash = (path) => path.split(sep).join("/");

async function walk(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) return walk(path);
        return entry.isFile() && path.endsWith(".md") ? [path] : [];
      }),
    );
    return files.flat().sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

// Fenced and indented code, comments, and inline code are not rendered links.
function rendered(source, keepInlineCode = false) {
  let fence = null;
  return source
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .map((line) => {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (fence) {
        if (
          marker &&
          marker[1][0] === fence[0] &&
          marker[1].length >= fence.length
        )
          fence = null;
        return "";
      }
      if (marker) {
        fence = marker[1];
        return "";
      }
      if (/^(?: {4}|\t)/.test(line)) return "";
      return line.replace(/(`+)(.*?)\1/g, (_, marker, content) =>
        keepInlineCode ? content : "",
      );
    })
    .join("\n");
}

function slug(text) {
  return text
    .toLowerCase()
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/[^\p{L}\p{N}_\-\s]/gu, "")
    .replace(/\s/g, "-");
}
function anchors(source) {
  const found = new Set();
  const counts = new Map();
  const lines = rendered(source, true).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const atx = lines[i].match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    const setext =
      i + 1 < lines.length &&
      /^ {0,3}(?:=+|-+)\s*$/.test(lines[i + 1]) &&
      lines[i].trim();
    const heading = atx?.[1] || (setext ? lines[i].trim() : null);
    if (!heading) continue;
    const base = slug(heading);
    const n = counts.get(base) || 0;
    counts.set(base, n + 1);
    found.add(n ? `${base}-${n}` : base);
  }
  for (const match of rendered(source, true).matchAll(
    /<a\s+[^>]*(?:id|name)=["']([^"']+)["'][^>]*>/gi,
  ))
    found.add(match[1]);
  return found;
}

function links(source) {
  const prose = rendered(source);
  const references = new Map();
  for (const match of prose.matchAll(
    /^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/gm,
  ))
    references.set(
      match[1].trim().toLowerCase().replace(/\s+/g, " "),
      match[2] || match[3],
    );
  const result = [];
  for (const match of prose.matchAll(
    /!?\[([^\]\n]*)\]\((<[^>]+>|(?:\\.|[^\s()]|\([^()]*\))+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\)/g,
  ))
    result.push(match[2].replace(/^<|>$/g, "").replace(/\\([()])/g, "$1"));
  for (const match of prose.matchAll(/!?\[([^\]\n]+)\]\[([^\]\n]*)\]/g)) {
    const key = (match[2] || match[1])
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (references.has(key)) result.push(references.get(key));
  }
  for (const match of prose.matchAll(
    /<(?:a|img)\b[^>]*\b(?:href|src)=["']([^"']+)["'][^>]*>/gi,
  ))
    result.push(match[1]);
  return result;
}

export async function checkGuidance(root = defaultRoot) {
  root = resolve(root);
  const problems = [];
  const documents = new Map();
  const edges = new Map();
  const local = (path) => slash(relative(root, path));
  const requiredFiles = [
    "AGENTS.md",
    "README.md",
    "context-factory/README.md",
    "packages/ui/README.md",
    "packages/ui/STORYBOOK.md",
  ];
  const files = new Set([
    ...requiredFiles.map((file) => resolve(root, file)),
    ...(await walk(resolve(root, "context-factory"))),
    ...(await walk(resolve(root, "docs"))),
  ]);
  for (const file of files) {
    try {
      documents.set(file, await readFile(file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      problems.push(`${local(file)}: missing required document`);
    }
  }
  for (const [file, source] of documents) {
    const targets = new Set();
    edges.set(file, targets);
    for (const href of links(source)) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) continue;
      const [pathAndQuery, hash] = href.split("#", 2);
      const pathname = pathAndQuery.split("?", 1)[0];
      let target;
      try {
        target = pathname
          ? resolve(dirname(file), decodeURIComponent(pathname))
          : file;
      } catch {
        problems.push(`${local(file)}: invalid link ${href}`);
        continue;
      }
      try {
        const info = await stat(target);
        targets.add(target);
        if (hash && info.isFile() && target.endsWith(".md")) {
          const targetSource =
            documents.get(target) ?? (await readFile(target, "utf8"));
          let decoded;
          try {
            decoded = decodeURIComponent(hash);
          } catch {
            problems.push(`${local(file)}: invalid anchor ${href}`);
            continue;
          }
          if (!anchors(targetSource).has(decoded))
            problems.push(`${local(file)}: missing anchor ${href}`);
        }
      } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
        problems.push(`${local(file)}: missing target ${href}`);
      }
    }
    if (!local(file).startsWith("context-factory/history/")) {
      for (const match of source.matchAll(
        /\bcontext-factory\/(?:api|frontend|packages|limits|business-logic|QA|engineering|shared)(?=\/|\b)/g,
      ))
        problems.push(`${local(file)}: stale path ${match[0]}`);
    }
  }
  for (const old of [
    "api",
    "frontend",
    "packages",
    "limits",
    "business-logic",
    "QA",
    "engineering",
    "shared",
  ]) {
    try {
      await stat(resolve(root, "context-factory", old));
      problems.push(`context-factory/${old}: obsolete guidance path exists`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const skills = [...documents.keys()].filter(
    (file) =>
      local(file).startsWith("context-factory/") && file.endsWith("/SKILL.md"),
  );
  const names = new Map();
  for (const file of skills) {
    const header = documents
      .get(file)
      .match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/)?.[1];
    const fields = (name) =>
      [
        ...(header ?? "").matchAll(
          new RegExp(`^${name}:[ \t]*(.*?)[ \t]*$`, "gm"),
        ),
      ].map((m) => m[1].replace(/^(['"])(.*)\1$/, "$2"));
    const name = fields("name");
    const description = fields("description");
    const descriptionLine =
      header?.match(/^description:[ \t]*(.*?)[ \t]*$/m)?.[1] ?? "";
    const validScalar =
      !/^[>|\[\]{}&*!%@`]/.test(descriptionLine) &&
      (!/^["']/.test(descriptionLine) ||
        (descriptionLine.length >= 2 &&
          descriptionLine.endsWith(descriptionLine[0]))) &&
      (/^["']/.test(descriptionLine) || !/:\s|\s#/.test(descriptionLine));
    if (
      name.length !== 1 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name[0]) ||
      name[0].length > 64
    )
      problems.push(`${local(file)}: invalid skill name`);
    else if (names.has(name[0]))
      problems.push(
        `${local(file)}: duplicate skill name ${name[0]} (also ${local(names.get(name[0]))})`,
      );
    else names.set(name[0], file);
    if (
      description.length !== 1 ||
      !description[0].trim() ||
      description[0].length > 1024 ||
      !validScalar
    )
      problems.push(`${local(file)}: invalid skill description`);
  }
  const router = resolve(root, "context-factory/README.md");
  const mustLink = (from, to) => {
    const source = resolve(root, from),
      target = resolve(root, to);
    if (!edges.get(source)?.has(target))
      problems.push(`${from}: missing direct routing link to ${to}`);
  };
  mustLink("AGENTS.md", "context-factory/README.md");
  const requiredEdges = {
    "AGENTS.md": ["context-factory/runs/README.md"],
    "context-factory/agents/senior-developer.md": ["context-factory/README.md"],
    "context-factory/agents/documentation.md": ["context-factory/README.md"],
    "context-factory/areas/frontend/SKILL.md": [
      "context-factory/areas/packages/SKILL.md",
      "context-factory/areas/frontend/references/project-structure.md",
      "context-factory/areas/packages/references/reuse.md",
    ],
    "context-factory/areas/packages/SKILL.md": [
      "context-factory/areas/frontend/SKILL.md",
      "context-factory/areas/packages/references/reuse.md",
    ],
    "context-factory/areas/api/SKILL.md": [
      "context-factory/areas/api/references/auth-and-sessions.md",
    ],
    "context-factory/areas/contracts/SKILL.md": [
      "context-factory/areas/contracts/references/api-type-sync.md",
      "context-factory/areas/contracts/references/shared-limits.md",
    ],
    "context-factory/workflows/documentation/SKILL.md": [
      "context-factory/workflows/research/SKILL.md",
      "context-factory/workflows/documentation/references/recursive-review.md",
    ],
    "context-factory/workflows/qa/SKILL.md": [
      "accounts",
      "sessions",
      "pg-query",
      "seed-a-table",
    ].map((name) => `context-factory/workflows/qa/references/${name}.md`),
    "context-factory/history/README.md": [
      "context-factory/history/decisions/README.md",
      "context-factory/history/verification/README.md",
    ],
    "context-factory/history/decisions/README.md": [
      "context-factory/history/decisions/TEMPLATE.md",
    ],
    "context-factory/history/verification/README.md": [
      "context-factory/history/verification/TEMPLATE.md",
    ],
    "context-factory/runs/README.md": ["context-factory/runs/TEMPLATE.md"],
  };
  for (const [from, targets] of Object.entries(requiredEdges))
    for (const target of targets) mustLink(from, target);
  const routerTargets = [
    "agents/senior-developer.md",
    "agents/documentation.md",
    "business/README.md",
    "runs/README.md",
    "history/README.md",
    "areas/packages/references/reuse.md",
    "areas/api/references/auth-and-sessions.md",
    "areas/contracts/references/api-type-sync.md",
    "areas/contracts/references/shared-limits.md",
    ...["api", "frontend", "packages", "contracts"].map(
      (name) => `areas/${name}/SKILL.md`,
    ),
    ...[
      "investigate",
      "implement",
      "review",
      "qa",
      "documentation",
      "research",
      "tickets",
      "pull-requests",
    ].map((name) => `workflows/${name}/SKILL.md`),
  ];
  for (const target of routerTargets)
    mustLink("context-factory/README.md", `context-factory/${target}`);
  const routerLines = (documents.get(router) ?? "").split("\n");
  for (const [label, paths] of [
    [
      "UI and package reuse",
      [
        "areas/frontend/SKILL.md",
        "areas/packages/SKILL.md",
        "areas/packages/references/reuse.md",
      ],
    ],
    [
      "API and authentication",
      ["areas/api/SKILL.md", "areas/api/references/auth-and-sessions.md"],
    ],
    [
      "contract synchronization and limits",
      [
        "areas/contracts/SKILL.md",
        "areas/contracts/references/api-type-sync.md",
        "areas/contracts/references/shared-limits.md",
      ],
    ],
  ]) {
    const found = routerLines.some((line) => {
      const targets = links(line).map((href) =>
        resolve(dirname(router), href.split("#", 1)[0]),
      );
      return paths.every((path) =>
        targets.includes(resolve(dirname(router), path)),
      );
    });
    if (!found)
      problems.push(
        `context-factory/README.md: missing grouped routing links for ${label}`,
      );
  }
  const reachable = new Set();
  function visit(file) {
    if (reachable.has(file)) return;
    reachable.add(file);
    for (const target of edges.get(file) ?? []) visit(target);
  }
  visit(router);
  const runReachable = new Set();
  function visitRun(file) {
    if (runReachable.has(file)) return;
    runReachable.add(file);
    for (const target of edges.get(file) ?? []) {
      if (local(target).startsWith("context-factory/runs/")) visitRun(target);
    }
  }
  visitRun(resolve(root, "context-factory/runs/README.md"));
  for (const [file, source] of documents) {
    const path = local(file);
    if (
      !path.startsWith("context-factory/runs/") ||
      ["README.md", "TEMPLATE.md"].includes(path.split("/").at(-1))
    )
      continue;
    const name = path.split("/").at(-1);
    if (
      !/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(
        name,
      )
    )
      problems.push(`${path}: invalid run filename`);
    for (const field of [
      "Started",
      "Updated",
      "Status",
      "Scope",
      "Checkout",
      "Continues",
    ]) {
      if (!new RegExp(`^${field}:[ \t]*\\S`, "m").test(source))
        problems.push(`${path}: missing run metadata ${field}`);
    }
    if (!/^##[ \t]+Resume here[ \t]*$/m.test(source))
      problems.push(`${path}: missing Resume here section`);
    if (!runReachable.has(file))
      problems.push(`${path}: unreachable from runs index`);
  }
  for (const file of documents.keys()) {
    const path = local(file);
    if (
      !path.startsWith("context-factory/") ||
      path.startsWith("context-factory/history/") ||
      path.startsWith("context-factory/runs/") ||
      path.startsWith("context-factory/tools/")
    )
      continue;
    if (!reachable.has(file))
      problems.push(`${path}: unreachable from guidance router`);
  }
  return { problems, documentCount: documents.size, skillCount: skills.length };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await checkGuidance(process.argv[2]);
  if (result.problems.length) {
    for (const problem of result.problems) console.error(problem);
    process.exitCode = 1;
  } else {
    console.log(
      `Guidance OK: ${result.documentCount} Markdown documents, ${result.skillCount} skills; links, anchors, metadata, routes, and reachability checked.`,
    );
    console.log(
      "Structural checks do not prove agent compliance or application behavior.",
    );
  }
}
