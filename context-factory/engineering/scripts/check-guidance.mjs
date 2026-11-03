#!/usr/bin/env node
// Structural checks only. Source claims and instruction compliance need separate review.
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const problems = [];
const documents = new Map();
const edges = new Map();
const local = (path) => relative(root, path).split("\\").join("/");

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path);
  }
  return files.sort();
}

// Ignore examples inside fences: only rendered navigation creates graph edges.
function prose(source) {
  return source.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, "");
}

function anchors(source) {
  const result = new Set();
  const counts = new Map();
  for (const match of prose(source).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const slug = match[1].toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, "").replace(/\s/g, "-");
    const count = counts.get(slug) ?? 0;
    counts.set(slug, count + 1);
    result.add(count ? `${slug}-${count}` : slug);
  }
  return result;
}

const files = [resolve(root, "AGENTS.md"), resolve(root, "README.md"), ...await markdownFiles(resolve(root, "context-factory"))];
for (const file of files) documents.set(file, await readFile(file, "utf8"));

for (const [file, source] of documents) {
  const targets = new Set();
  edges.set(file, targets);
  for (const match of prose(source).matchAll(/!?\[[^\]\n]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const href = match[1].replace(/^<|>$/g, "");
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) continue;
    const [pathname, hash] = href.split("#", 2);
    const target = pathname ? resolve(dirname(file), decodeURIComponent(pathname)) : file;
    try {
      const info = await stat(target);
      targets.add(target);
      if (hash && info.isFile() && target.endsWith(".md")) {
        const targetSource = documents.get(target) ?? await readFile(target, "utf8");
        if (!anchors(targetSource).has(decodeURIComponent(hash))) problems.push(`${local(file)}: missing anchor ${href}`);
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      problems.push(`${local(file)}: missing target ${href}`);
    }
  }
}

const engineering = resolve(root, "context-factory/engineering");
const isEngineeringSkill = (file) => local(file).startsWith("context-factory/engineering/") && local(file).endsWith("/SKILL.md");
const skills = files.filter(isEngineeringSkill);
const catalogFiles = [resolve(engineering, "README.md"), resolve(root, "context-factory/shared/engineering-principles.md")];
const registered = new Set(catalogFiles.flatMap((file) => [...(edges.get(file) ?? [])]));

for (const file of skills) {
  const source = documents.get(file);
  const header = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1];
  const name = header?.match(/^name:\s*([a-z\d-]+)\s*$/m)?.[1];
  const description = header?.match(/^description:\s*(.+)$/m)?.[1];
  if (!name || name.length > 64 || name !== relative(engineering, dirname(file)).split("\\").join("/")) problems.push(`${local(file)}: name must match its skill folder`);
  if (!description?.trim() || /^(?:""|'')$/.test(description.trim())) problems.push(`${local(file)}: missing description`);
  if (!registered.has(file)) problems.push(`${local(file)}: register in engineering index or principle digest`);
}
for (const file of registered) {
  if (isEngineeringSkill(file) && !skills.includes(file)) problems.push(`${local(file)}: catalog points to an absent skill`);
}

const shared = files.filter((file) => dirname(file) === resolve(root, "context-factory/shared"));
const indexTargets = edges.get(resolve(engineering, "README.md")) ?? new Set();
for (const file of shared) {
  if (!indexTargets.has(file)) problems.push(`${local(file)}: register in engineering index`);
}

const standing = ["agent-workflow.md", "engineering-principles.md"].map((name) => resolve(root, "context-factory/shared", name));
standing.push(resolve(engineering, "README.md"));
const role = resolve(root, "context-factory/agents/senior-developer/AGENT.md");
for (const entry of [resolve(root, "AGENTS.md"), role]) {
  for (const target of standing) {
    if (!edges.get(entry)?.has(target)) problems.push(`${local(entry)}: missing standing-guide link to ${local(target)}`);
  }
}

const reachable = new Set();
function visit(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  for (const target of edges.get(file) ?? []) visit(target);
}
visit(role);
for (const file of [...skills, ...shared]) {
  if (!reachable.has(file)) problems.push(`${local(file)}: unreachable from senior-developer entry point`);
}

if (problems.length) {
  for (const problem of problems) console.error(problem);
  process.exitCode = 1;
} else {
  console.log(`Guidance OK: ${documents.size} Markdown files, ${skills.length} engineering skills, ${shared.length} shared guides; links, anchors, metadata, registration, and senior-developer reachability checked.`);
  console.log("Structural checks do not prove agent compliance or application behavior.");
}
