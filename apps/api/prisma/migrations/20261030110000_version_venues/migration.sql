BEGIN;

CREATE TABLE "venue_versions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "venue_id" UUID NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL CHECK ("version" > 0),
  "state" TEXT NOT NULL CHECK ("state" IN ('draft', 'published', 'superseded')),
  "name" TEXT NOT NULL, "location" TEXT NOT NULL, "description" TEXT NOT NULL,
  "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "capacity_min" INTEGER CHECK ("capacity_min" > 0),
  "capacity_max" INTEGER CHECK ("capacity_max" > 0),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMPTZ(6),
  CONSTRAINT "venue_versions_publication_check" CHECK (("state" = 'draft' AND "published_at" IS NULL) OR ("state" IN ('published', 'superseded') AND "published_at" IS NOT NULL)),
  CONSTRAINT "venue_versions_capacity_range" CHECK ("capacity_min" IS NULL OR "capacity_max" IS NULL OR "capacity_min" <= "capacity_max"),
  CONSTRAINT "venue_versions_venue_id_version_key" UNIQUE ("venue_id", "version")
);
CREATE UNIQUE INDEX "venue_versions_one_draft" ON "venue_versions" ("venue_id") WHERE "state" = 'draft';
CREATE UNIQUE INDEX "venue_versions_one_published" ON "venue_versions" ("venue_id") WHERE "state" = 'published';
-- Legacy records were immediately public. Their original creation timestamp is
-- the best available publication timestamp; earlier edit history does not exist.
INSERT INTO "venue_versions" ("venue_id", "version", "state", "name", "location", "description", "created_at", "updated_at", "published_at")
SELECT "id", 1, 'published', "name", "location", "description", "created_at", "updated_at", "created_at" FROM "venues";
ALTER TABLE "venues" DROP COLUMN "name", DROP COLUMN "location", DROP COLUMN "description";
CREATE TABLE "venue_images" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "content_type" TEXT NOT NULL CHECK ("content_type" IN ('image/jpeg', 'image/png')),
  "data" BYTEA NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "venue_version_photos" (
  "venue_version_id" UUID NOT NULL REFERENCES "venue_versions"("id") ON DELETE CASCADE,
  "image_id" UUID NOT NULL REFERENCES "venue_images"("id") ON DELETE RESTRICT,
  "position" INTEGER NOT NULL CHECK ("position" >= 0 AND "position" < 10),
  PRIMARY KEY ("venue_version_id", "image_id"),
  UNIQUE ("venue_version_id", "position")
);
CREATE INDEX "venue_version_photos_image_id_idx" ON "venue_version_photos" ("image_id");

COMMIT;
