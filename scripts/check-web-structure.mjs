import { readFile, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ts = createRequire(join(repository, "apps/web/package.json"))(
  "typescript",
);

// An alternate root permits isolated fixture checks without changing the checkout.
const args = process.argv.slice(2);

if (args.length && (args.length !== 2 || args[0] !== "--root")) {
  console.error(
    "Usage: node scripts/check-web-structure.mjs [--root <repository>]",
  );
  process.exit(2);
}

const root = args.length ? resolve(args[1]) : repository;

const web = join(root, "apps/web");

const sourceRoot = join(web, "src");

const failures = [];

let fileCount = 0;
let referenceCount = 0;
const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const pascal = /^[A-Z][A-Za-z0-9]*$/;

const domains = new Set([
  "auth",
  "catalog",
  "booking-requests",
  "quotations",
  "messages",
  "notifications",
  "event-days",
]);

const roles = new Set(["admin", "customer"]);

function report(path, message, line) {
  failures.push(`${relative(root, path)}${line ? `:${line}` : ""}: ${message}`);
}

function inside(path, parent) {
  const rel = relative(parent, path);

  return (
    rel === "" ||
    (!rel.startsWith(`..${sep}`) && rel !== ".." && !rel.startsWith(sep))
  );
}

async function walk(dir) {
  const result = [];

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (
      ["node_modules", "dist", "build", ".astro", "coverage"].includes(
        entry.name,
      )
    )
      continue;

    const path = join(dir, entry.name);

    if (entry.isDirectory()) result.push(...(await walk(path)));
    else if (entry.isFile()) result.push(path);
  }

  return result.sort();
}

function checkPlacement(path) {
  const parts = relative(web, path).split(sep);
  const [area, layer, ...tail] = parts;
  const name = parts.at(-1);
  const extension = extname(name);
  const base = name.slice(0, -extension.length);

  if (area === "tests") {
    if (
      parts.length !== 3 ||
      !kebab.test(layer) ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*\.test\.(?:ts|mjs)$/.test(name)
    )
      report(
        path,
        "Place tests in tests/<domain>/<kebab-case>.test.ts or .test.mjs.",
      );

    return;
  }

  if (area !== "src") return;

  if (layer === "pages") return; // Astro owns URL filenames, including dynamic routes.

  if (["env.ts", "middleware.ts"].includes(layer) && parts.length === 2) return;

  if (layer === "layouts") {
    if (parts.length !== 3 || extension !== ".astro" || !pascal.test(base))
      report(path, "Use layouts/<PascalCase>.astro.");

    return;
  }

  if (
    extension === ".tsx"
      ? !pascal.test(base)
      : ![".ts", ".mjs", ".css"].includes(extension) || !kebab.test(base)
  )
    report(
      path,
      "Use PascalCase for .tsx and kebab-case for .ts, .mjs, and .css filenames.",
    );

  for (const folder of tail.slice(0, -1))
    if (!kebab.test(folder))
      report(path, `Use kebab-case for folder '${folder}'.`);

  if (layer === "components") {
    if (![".tsx", ".ts"].includes(extension))
      report(
        path,
        "Use .tsx components or .ts supporting modules in components/.",
      );

    const [group, sub, ...rest] = tail;

    if (group === "app") {
      if (
        tail.length !== 2 ||
        !["App.tsx", "routes.ts", "navigation-types.ts"].includes(sub)
      )
        report(
          path,
          "Keep app bootstrap limited to App.tsx, routes.ts, and navigation-types.ts.",
        );
    } else if (group === "public") {
      if (tail.length !== 3 || !["catalog", "site"].includes(sub))
        report(
          path,
          "Place public components in components/public/catalog or components/public/site.",
        );
    } else if (group === "workspaces") {
      if (
        !roles.has(sub) ||
        (rest.length === 1 &&
          !(
            /(?:Shell|Sidebar|Dashboard)\.tsx$/.test(name) ||
            name === "navigation.ts"
          )) ||
        rest.length > 2 ||
        rest.length < 1
      )
        report(
          path,
          "Place workspace shells and navigation at workspaces/<role>/; group pages under a responsibility folder.",
        );
    } else if (!domains.has(group) || tail.length !== 2)
      report(
        path,
        "Place shared components in components/<domain>/ or a permitted public/workspace folder.",
      );
  } else if (layer === "lib") {
    if (![".ts", ".tsx"].includes(extension))
      report(path, "Use TypeScript modules in lib/.");

    const [group, domain] = tail;

    if (["data", "services", "utils", "server"].includes(group)) {
      if (tail.length !== 3 || !kebab.test(domain))
        report(
          path,
          "Place library files in lib/<layer>/<domain>/<responsibility>.",
        );
    } else if (["auth", "http", "navigation", "pagination"].includes(group)) {
      if (tail.length !== 2)
        report(
          path,
          "Place infrastructure modules directly in their lib/<infrastructure>/ folder.",
        );
    } else
      report(path, "Use a supported library layer or infrastructure folder.");
  } else if (layer === "styles") {
    if (extension !== ".css") report(path, "Use CSS files in styles/.");

    if (
      !(tail.length === 1 && name === "app.css") &&
      !(tail.length === 2 && kebab.test(tail[0]) && tail[0] !== "workspaces") &&
      !(tail.length === 3 && tail[0] === "workspaces" && roles.has(tail[1]))
    )
      report(
        path,
        "Place styles under styles/<domain>/ or styles/workspaces/<role>/; app.css is the root entry.",
      );
  } else if (layer === "demo") {
    if (extension !== ".ts")
      report(path, "Use TypeScript data modules in demo/.");

    if (name === "demo-data.ts")
      report(
        path,
        "Name demo data for its domain responsibility, such as photos.ts or sample-bookings.ts.",
      );

    if (tail.length !== 2 || !kebab.test(tail[0]))
      report(path, "Place demo data in demo/<domain>/<responsibility>.");
  } else report(path, "Place this file in a supported frontend layer.");
}

async function exists(path, allowDirectory = false) {
  try {
    const info = await stat(path);

    return info.isFile() || (allowDirectory && info.isDirectory());
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;

    throw error;
  }
}

async function resolveReference(from, specifier, resource = false) {
  if (!specifier.startsWith(".") && !specifier.startsWith("/src/")) return null;

  const target = specifier.startsWith("/src/")
    ? join(sourceRoot, specifier.slice(5))
    : resolve(dirname(from), specifier);

  const candidates = resource
    ? [target]
    : [
        target,
        ...[".ts", ".tsx", ".mjs", ".js", ".astro", ".css", ".json"].map(
          (ext) => target + ext,
        ),
        ...["index.ts", "index.tsx", "index.mjs", "index.js"].map((name) =>
          join(target, name),
        ),
      ];

  for (const candidate of candidates)
    if (await exists(candidate, resource)) return candidate;

  return false;
}

function dependencyBoundary(from, target, typeOnly) {
  const source = relative(sourceRoot, from).split(sep);
  const dest = relative(sourceRoot, target).split(sep);

  if (source[0] === "lib" && dest[0] === "components")
    return "Library modules must not import components.";

  if (
    source[0] === "lib" &&
    source[1] === "data" &&
    dest[0] === "lib" &&
    dest[1] === "services"
  )
    return "Data modules must not import client services.";

  if (
    source[0] === "lib" &&
    source[1] === "utils" &&
    dest[0] === "lib" &&
    ["data", "services", "auth", "http", "server"].includes(dest[1])
  )
    return "Pure utilities must not import data, services, auth, HTTP, or server modules.";

  if (
    !typeOnly &&
    dest[0] === "lib" &&
    dest[1] === "server" &&
    inside(from, sourceRoot) &&
    !["pages", "layouts"].includes(source[0]) &&
    source[0] !== "middleware.ts" &&
    !(source[0] === "lib" && source[1] === "server")
  )
    return "Browser runtime modules must not import server modules.";

  if (
    (source[0] === "components" && domains.has(source[1])) ||
    (source[0] === "components" && source[1] === "public")
  ) {
    if (dest[0] === "components" && dest[1] === "workspaces")
      return "Shared domain components must not import role workspace modules.";

    if (
      dest[0] === "components" &&
      dest[1] === "app" &&
      !["routes.ts", "navigation-types.ts"].includes(dest[2])
    )
      return "Shared domain components may import only app/routes.ts or app/navigation-types.ts from app bootstrap.";
  }

  return null;
}

async function checkReference(
  path,
  source,
  position,
  value,
  resource = false,
  typeOnly = false,
) {
  const from = relative(sourceRoot, path).split(sep);

  if (
    from[0] === "lib" &&
    from[1] === "utils" &&
    /^(?:react(?:\/|$)|react-dom(?:\/|$)|firebase\/storage(?:\/|$))/.test(value)
  ) {
    report(
      path,
      "Pure utilities must not import React or storage modules.",
      source.slice(0, position).split("\n").length,
    );
  }

  if (!value.startsWith(".") && !value.startsWith("/src/")) return;

  referenceCount++;
  const line = source.slice(0, position).split("\n").length;
  const target = await resolveReference(path, value, resource);

  if (target === false)
    report(
      path,
      `Cannot resolve ${resource ? "resource" : "module"} '${value}'.`,
      line,
    );
  else if (target && inside(target, sourceRoot)) {
    const error = dependencyBoundary(path, target, typeOnly);

    if (error) report(path, error, line);
  }
}

async function checkScript(path, source, offset = 0, complete = source) {
  const ast = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const references = [];
  function add(node, resource = false, typeOnly = false) {
    if (ts.isStringLiteralLike(node))
      references.push([
        node.getStart(ast) + offset,
        node.text,
        resource,
        typeOnly,
      ]);
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;

      const typeOnly =
        clause?.isTypeOnly ||
        (!!clause &&
          !clause.name &&
          !!bindings &&
          ts.isNamedImports(bindings) &&
          bindings.elements.length > 0 &&
          bindings.elements.every((item) => item.isTypeOnly));

      add(node.moduleSpecifier, false, typeOnly);
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const clause = node.exportClause;

      const typeOnly =
        node.isTypeOnly ||
        (!!clause &&
          ts.isNamedExports(clause) &&
          clause.elements.length > 0 &&
          clause.elements.every((item) => item.isTypeOnly));

      add(node.moduleSpecifier, false, typeOnly);
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1
    )
      add(node.arguments[0]);

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "ssrLoadModule" &&
      node.arguments.length >= 1
    )
      add(node.arguments[0]);

    if (
      ts.isNewExpression(node) &&
      node.expression.getText(ast) === "URL" &&
      node.arguments?.length === 2 &&
      node.arguments[1].getText(ast) === "import.meta.url"
    )
      add(node.arguments[0], true);

    ts.forEachChild(node, visit);
  }
  visit(ast);

  for (const [position, value, resource, typeOnly] of references)
    await checkReference(path, complete, position, value, resource, typeOnly);
}

async function checkContents(path) {
  const source = await readFile(path, "utf8");
  const extension = extname(path);

  if ([".ts", ".tsx", ".mjs", ".js"].includes(extension))
    await checkScript(path, source);

  if (extension === ".astro") {
    const frontmatter = source.match(/^---\s*\n([\s\S]*?)\n---/);

    if (frontmatter)
      await checkScript(
        path,
        frontmatter[1],
        frontmatter.index + frontmatter[0].indexOf(frontmatter[1]),
        source,
      );

    // Preserve offsets while excluding frontmatter and HTML comments from markup.
    const markup = source
      .replace(/^---\s*\n[\s\S]*?\n---/, (text) => " ".repeat(text.length))
      .replace(/<!--[\s\S]*?-->/g, (text) => " ".repeat(text.length));

    for (const match of markup.matchAll(
      /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi,
    )) {
      const bodyOffset = match.index + match[0].indexOf(">") + 1;
      await checkScript(
        path,
        source.slice(bodyOffset, bodyOffset + match[1].length),
        bodyOffset,
        source,
      );
    }
  }

  if (extension === ".css" || extension === ".astro") {
    // Only literal CSS imports are considered; package and remote imports are external.
    for (const match of source.matchAll(
      /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?/g,
    ))
      await checkReference(path, source, match.index, match[1]);
  }
}

for (const directory of [sourceRoot, join(web, "tests")]) {
  for (const path of await walk(directory)) {
    fileCount++;
    checkPlacement(path);
    await checkContents(path);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  console.error(
    `Web structure: ${failures.length} issue(s) in ${fileCount} files; ${referenceCount} local references checked.`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Web structure OK: ${fileCount} files and ${referenceCount} local references checked.`,
  );
  console.log(
    "Static checks do not prove semantic domain ownership or runtime behavior.",
  );
}
