import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(join(repository, "apps/web/package.json"))(
  "typescript",
);
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--root")) {
  console.error("Usage: node scripts/check-env.mjs [--root <repository>]");
  process.exit(2);
}
const root = args.length ? resolve(args[1]) : repository;
const owners = new Set([
  "apps/api/src/utils/env.ts",
  "apps/web/src/lib/env/env.ts",
  "apps/web/src/lib/server/config/env.ts",
]);
const ignored = new Set([
  ".secrets",
  "node_modules",
  "dist",
  "build",
  ".astro",
  "_generated",
  "coverage",
]);
const failures = [];

function member(node, name) {
  return (
    (ts.isPropertyAccessExpression(node) && node.name.text === name) ||
    (ts.isElementAccessExpression(node) &&
      ts.isStringLiteral(node.argumentExpression) &&
      node.argumentExpression.text === name)
  );
}

function environmentHost(node) {
  return (
    (ts.isIdentifier(node) && ["process", "Deno"].includes(node.text)) ||
    (ts.isMetaProperty(node) &&
      node.keywordToken === ts.SyntaxKind.ImportKeyword) ||
    (member(node, "process") &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "globalThis")
  );
}

function inspect(path, source) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    const direct = member(node, "env") && environmentHost(node.expression);
    const destructured =
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      environmentHost(node.initializer) &&
      node.name.elements.some(
        (element) =>
          (element.propertyName ?? element.name).getText(file) === "env",
      );
    const imported =
      ts.isImportDeclaration(node) &&
      ["process", "node:process"].includes(node.moduleSpecifier.text) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings) &&
      node.importClause.namedBindings.elements.some(
        (element) => (element.propertyName ?? element.name).text === "env",
      );
    if (direct || destructured || imported) {
      const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
      failures.push(
        `${path}:${line + 1}: Read environment variables through the app's env utility.`,
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const absolute = join(directory, entry.name);
    const path = relative(root, absolute).split(sep).join("/");
    if (entry.isDirectory()) {
      // Tests deliberately control their runtime environment and disposable targets.
      if (/^apps\/[^/]+\/tests$/.test(path)) continue;
      await walk(absolute);
    } else if (
      /\.(?:[cm]?[jt]sx?|astro)$/.test(entry.name) &&
      !owners.has(path)
    ) {
      inspect(path, await readFile(absolute, "utf8"));
    }
  }
}

await walk(join(root, "apps"));
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Environment reads are centralized in app env utilities.");
}
