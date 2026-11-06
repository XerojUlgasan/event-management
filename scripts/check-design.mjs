import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(join(root, "apps/web/package.json"))("typescript");
const nativeControls = new Set(["button", "input", "select", "textarea", "dialog"]);
const color = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?)\s*\(|(?<![-\w])(?:white|black|transparent)(?![-\w])/i;
const failures = [];
let filesChecked = 0;

async function files(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await files(path));
    else if ([".tsx", ".css", ".astro"].includes(extname(path))) found.push(path);
  }
  return found;
}

function report(path, source, position, message) {
  const line = source.slice(0, position).split("\n").length;
  failures.push(`${relative(root, path)}:${line}: ${message}`);
}

const scopes = process.argv.slice(2).map(path => resolve(path));
for (const path of await filesInScopes(scopes.length ? scopes : [join(root, "apps/web/src"), join(root, "packages/ui/src")])) {
  filesChecked++;
  const source = await readFile(path, "utf8");
  if (extname(path) === ".css") {
    const cleaned = source.replace(/\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, text => " ".repeat(text.length));
    for (const match of cleaned.matchAll(/(?:^|[;{])\s*(?:--[\w-]+|[-\w]+)\s*:\s*([^;{}]+)/gm)) {
      if (color.test(match[1])) report(path, source, match.index, "Use packages/theme color tokens in authored styles.");
    }
    continue;
  }
  if (extname(path) === ".astro") {
    const markup = source.replace(/^---[\s\S]*?---/, text => " ".repeat(text.length)).replace(/<!--[\s\S]*?-->/g, text => " ".repeat(text.length));
    for (const match of markup.matchAll(/<\s*(button|input|select|textarea|dialog)\b/g)) report(path, source, match.index, `Use the shared UI component for <${match[1]}>.`);
    continue;
  }
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const inWeb = path.startsWith(join(root, "apps/web/src"));
  const customScope = scopes.length > 0;
  function visit(node) {
    if ((inWeb || customScope) && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && nativeControls.has(node.tagName.getText(ast))) {
      report(path, source, node.getStart(ast), `Use the shared UI component for <${node.tagName.getText(ast)}>.`);
    }
    if (ts.isImportDeclaration(node) && /packages\/ui\/src|packages\/theme\/src/.test(node.moduleSpecifier.text)) {
      report(path, source, node.getStart(ast), "Import through the public workspace package exports.");
    }
    if (ts.isStringLiteral(node) && color.test(node.text)) {
      const parent = node.parent;
      const styleProperty = ts.isPropertyAssignment(parent) && /color|fill|stroke|shadow|background/i.test(parent.name.getText(ast));
      const colorAttribute = ts.isJsxAttribute(parent) && /^(?:fill|stroke|color|stopColor)$/.test(parent.name.getText(ast));
      if (styleProperty || colorAttribute) report(path, source, node.getStart(ast), "Use a theme token for the color value.");
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

async function filesInScopes(scopes) {
  return (await Promise.all(scopes.map(files))).flat();
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Design ownership OK: ${filesChecked} source files checked for native controls, public imports, and authored color literals.`);
  console.log("This check does not prove component fit, visual design, accessibility, or application behavior.");
}
