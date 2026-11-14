import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { checkGuidance } from "./check-guidance.mjs";

const skills = [
  "areas/api",
  "areas/frontend",
  "areas/packages",
  "areas/contracts",
  "workflows/investigate",
  "workflows/implement",
  "workflows/review",
  "workflows/qa",
  "workflows/documentation",
  "workflows/research",
  "workflows/tickets",
  "workflows/pull-requests",
];
const routes = [
  "agents/senior-developer.md",
  "agents/documentation.md",
  "business/README.md",
  "runs/README.md",
  "history/README.md",
  "areas/packages/references/reuse.md",
  "areas/api/references/auth-and-sessions.md",
  "areas/contracts/references/api-type-sync.md",
  "areas/contracts/references/shared-limits.md",
  ...skills.map((s) => `${s}/SKILL.md`),
];
async function put(root, path, content) {
  const file = join(root, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "guidance-check-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(root, "AGENTS.md", "[Router](context-factory/README.md)\n");
  await put(root, "README.md", "# Root\n");
  await put(root, "packages/ui/README.md", "# UI\n");
  await put(root, "packages/ui/STORYBOOK.md", "# Stories\n");
  await put(root, "docs/guide.md", "[UI](../packages/ui/README.md#ui)\n");
  await put(
    root,
    "context-factory/README.md",
    routes.map((path) => `[${path}](${path})`).join(" ") +
      "\n[Reference](workflows/review/references/review.md#review)\n",
  );
  for (const route of routes) {
    const content = route.endsWith("SKILL.md")
      ? `---\nname: ${route.split("/").slice(0, 2).join("-")}\ndescription: A useful guide.\n---\n# Guide\n`
      : "# Guide\n";
    await put(root, `context-factory/${route}`, content);
  }
  await put(
    root,
    "context-factory/workflows/review/references/review.md",
    "# Review\n",
  );
  const edges = {
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
  for (const [from, targets] of Object.entries(edges)) {
    for (const target of targets) {
      try {
        await readFile(join(root, target));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        await put(root, target, "# Guide\n");
      }
      await append(
        root,
        from,
        `\n[Link](${relative(dirname(from), target)})\n`,
      );
    }
  }
  return root;
}
async function append(root, path, text) {
  const file = join(root, path);
  await writeFile(file, (await readFile(file, "utf8")) + text);
}
async function rejects(root, phrase) {
  const { problems } = await checkGuidance(root);
  assert.ok(
    problems.some((p) => p.includes(phrase)),
    `Expected ${phrase}; got ${problems.join("\n")}`,
  );
}

test("valid linked guidance passes and ignores code examples and historic paths", async (t) => {
  const root = await fixture(t);
  await append(
    root,
    "docs/guide.md",
    "\n```md\n[example](missing.md)\n```\n`[example](missing.md)`\n",
  );
  await put(
    root,
    "context-factory/history/decisions/old.md",
    "`context-factory/engineering/old`\n",
  );
  assert.deepEqual((await checkGuidance(root)).problems, []);
});

test("missing targets and anchors are detected in incoming documentation", async (t) => {
  const root = await fixture(t);
  await append(
    root,
    "docs/guide.md",
    "\n[missing](no.md)\n[bad anchor](../README.md#absent)\n",
  );
  await rejects(root, "missing target no.md");
  await rejects(root, "missing anchor ../README.md#absent");
});

test("validates metadata and rejects duplicate skill names", async (t) => {
  const root = await fixture(t);
  await put(
    root,
    "context-factory/areas/api/SKILL.md",
    '---\nname: Bad Name\ndescription: ""\n---\n',
  );
  await put(
    root,
    "context-factory/areas/contracts/SKILL.md",
    "---\nname: areas-frontend\ndescription: Contracts.\n---\n",
  );
  await rejects(root, "invalid skill name");
  await rejects(root, "invalid skill description");
  await rejects(root, "duplicate skill name areas-frontend");
});

test("unreachable guides and skills are detected", async (t) => {
  const root = await fixture(t);
  await put(
    root,
    "context-factory/workflows/review/references/orphan.md",
    "# Orphan\n",
  );
  await put(
    root,
    "context-factory/workflows/extra/SKILL.md",
    "---\nname: extra\ndescription: Extra guide.\n---\n",
  );
  await rejects(root, "references/orphan.md: unreachable");
  await rejects(root, "workflows/extra/SKILL.md: unreachable");
});

test("required routing links and stale paths fail even if targets exist", async (t) => {
  const root = await fixture(t);
  const router = join(root, "context-factory/README.md");
  await writeFile(
    router,
    (await readFile(router, "utf8")).replace(
      "[areas/packages/references/reuse.md](areas/packages/references/reuse.md)",
      "",
    ),
  );
  await append(
    root,
    "AGENTS.md",
    "\nUse `context-factory/frontend/SKILL.md`.\n",
  );
  await rejects(
    root,
    "missing direct routing link to context-factory/areas/packages/references/reuse.md",
  );
  await rejects(root, "stale path context-factory/frontend");
});

test("reference links, duplicate heading anchors and fenced examples are handled", async (t) => {
  const root = await fixture(t);
  await put(
    root,
    "docs/guide.md",
    "# Same\n# Same\n[second][link]\n\n[link]: #same-1\n~~~\n[bad](missing.md)\n~~~\n",
  );
  assert.deepEqual((await checkGuidance(root)).problems, []);
  await append(
    root,
    "docs/guide.md",
    "\n[broken][missing]\n\n[missing]: #no-heading\n",
  );
  await rejects(root, "missing anchor #no-heading");
});

test("route links must occur together for related tasks", async (t) => {
  const root = await fixture(t);
  const router = join(root, "context-factory/README.md");
  const content = await readFile(router, "utf8");
  await writeFile(
    router,
    content.replace(
      "](areas/packages/references/reuse.md) ",
      "](areas/packages/references/reuse.md)\n",
    ),
  );
  await rejects(root, "missing grouped routing links for UI and package reuse");
});

test("frontend cannot lose the mandatory downstream reuse link", async (t) => {
  const root = await fixture(t);
  const file = join(root, "context-factory/areas/frontend/SKILL.md");
  await writeFile(
    file,
    (await readFile(file, "utf8")).replace(
      "[Link](../packages/references/reuse.md)",
      "",
    ),
  );
  await rejects(
    root,
    "areas/frontend/SKILL.md: missing direct routing link to context-factory/areas/packages/references/reuse.md",
  );
});

test("run records require a valid filename, metadata, resume section, and an index or predecessor chain", async (t) => {
  const root = await fixture(t);
  const record = "context-factory/runs/2026-11-14_10-59-01_first-run.md";
  const body =
    "# Run\nStarted: now\nUpdated: now\nStatus: in-progress\nScope: test\nCheckout: main\nContinues: none\n\n## Resume here\nContinue.\n";
  await put(root, record, body);
  await rejects(root, "first-run.md: unreachable from runs index");
  await append(
    root,
    "context-factory/runs/README.md",
    "\n[Recent](2026-11-14_10-59-02_next-run.md)\n",
  );
  await put(
    root,
    "context-factory/runs/2026-11-14_10-59-02_next-run.md",
    body + "\n[Prior](2026-11-14_10-59-01_first-run.md)\n",
  );
  assert.deepEqual((await checkGuidance(root)).problems, []);
  await put(root, "context-factory/runs/bad-name.md", "# Bad\n");
  await rejects(root, "bad-name.md: invalid run filename");
  await rejects(root, "bad-name.md: missing run metadata Started");
  await rejects(root, "bad-name.md: missing Resume here section");
});
