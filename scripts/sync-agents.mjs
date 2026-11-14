#!/usr/bin/env node
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  symlink,
} from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const folders = [".agents", ".agent", ".claude", ".cursor"];
const entries = new Map();

async function inspect(folder, relativePath = "") {
  const path = join(root, folder, relativePath);
  let stats;
  try {
    stats = await lstat(path);
  } catch (error) {
    if (!relativePath && error.code === "ENOENT") return;
    throw error;
  }

  if (!relativePath && !stats.isDirectory()) {
    throw new Error(
      `${folder} must be a directory, not a file or symbolic link.`,
    );
  }

  let entry;
  if (stats.isDirectory()) {
    entry = { type: "directory", signature: "directory" };
  } else if (stats.isSymbolicLink()) {
    const target = await readlink(path);
    entry = { type: "symlink", target, signature: `symlink:${target}` };
  } else if (stats.isFile()) {
    const hash = createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
    entry = { type: "file", signature: `file:${hash}` };
  } else {
    throw new Error(`Unsupported entry: ${join(folder, relativePath)}`);
  }

  if (relativePath) {
    if (!entries.has(relativePath)) entries.set(relativePath, new Map());
    entries.get(relativePath).set(folder, entry);
  }
  // Preserve symbolic links as links; never scan through their targets.
  if (entry.type === "directory") {
    for (const name of (await readdir(path)).sort()) {
      await inspect(folder, join(relativePath, name));
    }
  }
}

// Inventory every folder before copying so conflicts have no preferred source.
for (const folder of folders) await inspect(folder);

const conflicts = [...entries]
  .filter(
    ([, copies]) =>
      new Set([...copies.values()].map((entry) => entry.signature)).size > 1,
  )
  .map(([path]) => path);

for (const path of conflicts) {
  console.error(
    `Conflict: ${path} differs in ${[...entries.get(path).keys()].join(", ")}; left unchanged.`,
  );
}

for (const folder of folders)
  await mkdir(join(root, folder), { recursive: true });

let copied = 0;
// Parents precede children, including when a path originated in a later folder.
const ordered = [...entries].sort(
  ([a], [b]) => a.split(sep).length - b.split(sep).length || a.localeCompare(b),
);
for (const [path, copies] of ordered) {
  // A file/directory conflict also blocks copying anything below that path.
  if (
    conflicts.some(
      (conflict) => path === conflict || path.startsWith(`${conflict}${sep}`),
    )
  )
    continue;

  const [sourceFolder, entry] = copies.entries().next().value;
  for (const folder of folders) {
    if (copies.has(folder)) continue;
    const destination = join(root, folder, path);
    if (entry.type === "directory") {
      await mkdir(destination);
    } else if (entry.type === "symlink") {
      await symlink(entry.target, destination);
    } else {
      // Refuse to overwrite a file even if it appeared after the inventory.
      await copyFile(
        join(root, sourceFolder, path),
        destination,
        constants.COPYFILE_EXCL,
      );
    }
    copied++;
  }
}

console.log(
  `Agent sync: added ${copied} entries; ${conflicts.length} conflicts.`,
);
if (conflicts.length) process.exitCode = 1;
