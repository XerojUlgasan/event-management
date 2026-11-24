import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import { MAX_VIDEO_SIZE_BYTES } from "@event-management/contracts/limits/videos";
import { ownedCatalogMediaKey } from "../../utils/catalog-media-paths.js";
import {
  detectCatalogMediaType,
  getCatalogMedia,
  putCatalogMedia,
} from "../../utils/catalog-media-storage.js";
import { insertIfNew, type SeedDb } from "./context.js";

const assetDirectory = fileURLToPath(new URL("./assets/", import.meta.url));

type SeedAsset = { file: string; id: string; createdBy: string | null };

type CatalogOwner = { kind: "package" | "service"; id: string };

async function matchesStoredAsset(key: string, bytes: Buffer) {
  const body = await getCatalogMedia(
    key,
    undefined,
    AbortSignal.timeout(30_000),
  );
  const existing = Buffer.from(await new Response(body).arrayBuffer());

  return bytes.equals(existing);
}

/** Attach the returned ID in the same seed transaction. */
export async function seedAssetUpload(
  db: SeedDb,
  { file, id, createdBy }: SeedAsset,
  owner?: CatalogOwner,
): Promise<string> {
  const path = resolve(assetDirectory, file);
  const asset = relative(assetDirectory, path);

  if (
    isAbsolute(file) ||
    !asset ||
    asset === ".." ||
    asset.startsWith(`..${sep}`)
  )
    throw new Error(
      `Seed asset must be relative to the asset directory: ${file}`,
    );

  const bytes = await readFile(path);
  const detected = detectCatalogMediaType(bytes);
  const limit =
    detected?.kind === "image" ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;

  if (!detected || bytes.length > limit || (owner && detected.kind !== "image"))
    throw new Error(`Invalid seed media file: ${file}`);

  const { kind, mimeType } = detected;
  const key = owner
    ? ownedCatalogMediaKey(owner, { id, kind, mime_type: mimeType })
    : `showcase-media/${id}`;
  const inserted = await insertIfNew(db, "media_assets", {
    id,
    kind,
    source: "upload",
    storage_key: key,
    mime_type: mimeType,
    byte_size: bytes.length,
    created_by: createdBy,
  });

  if (inserted) {
    try {
      await putCatalogMedia(key, bytes, mimeType);

      return id;
    } catch (error) {
      // An earlier transaction may have rolled back after writing this object.
      // Reuse only the same bytes, and leave any conflicting object untouched.
      if (await matchesStoredAsset(key, bytes).catch(() => false)) return id;

      throw new Error(`Could not upload seed asset: ${file}`, { cause: error });
    }
  }

  const existing = await db
    .selectFrom("media_assets")
    .select([
      "kind",
      "source",
      "storage_key",
      "mime_type",
      "byte_size",
      "created_by",
    ])
    .where("id", "=", id)
    .executeTakeFirstOrThrow();

  if (
    existing.kind !== kind ||
    existing.source !== "upload" ||
    existing.storage_key !== key ||
    existing.mime_type !== mimeType ||
    existing.byte_size !== bytes.length ||
    existing.created_by !== createdBy ||
    !(await matchesStoredAsset(key, bytes).catch(() => false))
  )
    throw new Error(
      `Seed asset ID is already used by different media: ${file}`,
    );

  return id;
}
