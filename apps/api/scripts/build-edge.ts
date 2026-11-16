import { build, type Metafile, type Plugin } from "esbuild";
import { createHash } from "node:crypto";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const externalPostgres: Plugin = {
  name: "external-postgres",
  setup(configured) {
    // Bundling pg rewrites its pool class into a module object, so Deno cannot extend it.
    configured.onResolve({ filter: /^pg$/ }, () => ({
      path: "npm:pg",
      external: true,
    }));
  },
};

const apiRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outdir = path.resolve(apiRoot, "../supabase/functions/api/_generated");

const result = await build({
  absWorkingDir: apiRoot,
  entryPoints: ["src/edge/server.ts"],
  outdir,
  bundle: true,
  format: "esm",
  splitting: true,
  // The Supabase edge runtime is Deno with Node compatibility. Node platform
  // leaves Node built-ins external and resolves the CJS entry points this API uses.
  platform: "node",
  target: "es2022",
  entryNames: "app",
  chunkNames: "chunks/[name]-[hash]",
  metafile: true,
  conditions: ["import", "module", "default"],
  plugins: [
    externalPostgres,
    {
      name: "catalog-sample-photos",
      setup(configured) {
        configured.onLoad(
          { filter: /sample-catalog-photos\.ts$/ },
          async () => {
            const paths = ["wedding", "dinner", "dessert", "hero"];
            const photos: Record<string, string> = {};
            for (const name of paths)
              photos[`/images/${name}.jpg`] = (
                await readFile(
                  path.resolve(apiRoot, `../web/public/images/${name}.jpg`),
                )
              ).toString("base64");
            return {
              contents: `const photos = ${JSON.stringify(photos)};
export const sampleCatalogPhotoPaths = Object.keys(photos);
export async function readSampleCatalogPhoto(url) {
  if (!Object.hasOwn(photos, url)) throw new Error("Unknown catalog sample photo");
  return Buffer.from(photos[url], "base64");
}`,
              loader: "js",
            };
          },
        );
      },
    },
    {
      name: "edge-environment",
      setup(configured) {
        // Supabase injects the function environment; dotenv/config would read .env synchronously.
        configured.onResolve({ filter: /^dotenv\/config$/ }, () => ({
          path: "dotenv/config",
          namespace: "edge-environment",
        }));
        configured.onLoad(
          { filter: /.*/, namespace: "edge-environment" },
          () => ({
            contents: "",
            loader: "js",
          }),
        );
      },
    },
  ],
});

const metafile = result.metafile;
if (!metafile) throw new Error("esbuild did not return a metafile");

const expected = new Set(
  Object.keys(metafile.outputs).map((output) =>
    path.normalize(path.resolve(apiRoot, output)),
  ),
);

await removeStaleOutput(outdir, expected);
await hideBundledPaths(outdir);
await installNodeGlobals(outdir);
await assertEntrySplits(path.join(outdir, "app.js"), metafile);

function outputFiles(directory: string, meta: Metafile) {
  return Object.keys(meta.outputs).filter((file) =>
    file.startsWith(path.relative(apiRoot, directory)),
  );
}

async function removeStaleOutput(directory: string, keep: Set<string>) {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const files = entries.filter((entry) => entry.isFile());
  await Promise.all(
    files.map(async (entry) => {
      const file = path.join(entry.parentPath, entry.name);
      if (!keep.has(path.normalize(file))) await rm(file);
    }),
  );
}

// esbuild names CommonJS wrappers with their original relative paths. The local
// function server treats those strings as files next to the generated bundle.
async function hideBundledPaths(directory: string) {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
      .map(async (entry) => {
        const file = path.join(entry.parentPath, entry.name);
        const source = await readFile(file, "utf8");
        const next = source.replaceAll(
          /(?:\.\.\/)+node_modules\/[^\s"'`]+/g,
          (specifier) => {
            return `bundled_${createHash("sha256").update(specifier).digest("hex").slice(0, 12)}`;
          },
        );
        const withRequire = next.includes("Dynamic require of")
          ? `import { createRequire as __createEdgeRequire } from "node:module";\n${next.replace(
              /var __require = \/\* @__PURE__ \*\/ \(\(x\) => typeof require !== "undefined" \? require : typeof Proxy !== "undefined" \? new Proxy\(x, \{\n  get: \(a, b\) => \(typeof require !== "undefined" \? require : a\)\[b\]\n\}\) : x\)\(function\(x\) \{\n  if \(typeof require !== "undefined"\) return require\.apply\(this, arguments\);\n  throw Error\('Dynamic require of "' \+ x \+ '" is not supported'\);\n\}\);/,
              "var __require = __createEdgeRequire(import.meta.url);",
            )}`
          : next;
        if (withRequire !== source) await writeFile(file, withRequire);
      }),
  );
}

// Deno does not provide Node's Buffer and process globals. The bundled pg client
// reads them while a route family loads, so every generated module installs them first.
async function installNodeGlobals(directory: string) {
  await writeFile(
    path.join(directory, "node-globals.js"),
    `import { Buffer } from "node:buffer";
import process from "node:process";
globalThis.Buffer = Buffer;
globalThis.process = process;
`,
  );
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith(".js") &&
          entry.name !== "node-globals.js",
      )
      .map(async (entry) => {
        const file = path.join(entry.parentPath, entry.name);
        const source = await readFile(file, "utf8");
        const specifier = file.includes(`${path.sep}chunks${path.sep}`)
          ? "../node-globals.js"
          : "./node-globals.js";
        if (source.startsWith(`import "${specifier}";`)) return;
        await writeFile(file, `import "${specifier}";\n${source}`);
      }),
  );
}

async function assertEntrySplits(entryFile: string, meta: Metafile) {
  const source = await readFile(entryFile, "utf8");
  if (/\bfrom\s+["'][^"']*controllers\//.test(source)) {
    throw new Error("Generated app.js statically imports a route controller");
  }
  if (!source.includes("import("))
    throw new Error("Generated app.js has no dynamic route import");
  const chunks = outputFiles(path.join(outdir, "chunks"), meta);
  if (chunks.length === 0)
    throw new Error("esbuild did not emit reusable chunks");
  console.log(
    `Edge bundle: ${path.relative(apiRoot, entryFile)} and ${chunks.length} chunks`,
  );
}
