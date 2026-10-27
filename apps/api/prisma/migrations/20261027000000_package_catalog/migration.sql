CREATE TABLE "packages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived_at" TIMESTAMPTZ(6)
);
CREATE TABLE "package_versions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "package_id" UUID NOT NULL REFERENCES "packages"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL CHECK ("version" > 0),
  "state" TEXT NOT NULL CHECK ("state" IN ('draft', 'published', 'superseded')),
  "name" TEXT NOT NULL,
  "event_types" TEXT[] NOT NULL,
  "description" TEXT NOT NULL,
  "guest_min" INTEGER NOT NULL,
  "guest_max" INTEGER NOT NULL,
  "venue_details" TEXT NOT NULL,
  "inclusions" TEXT[] NOT NULL,
  "exclusions" TEXT[] NOT NULL,
  "terms" TEXT NOT NULL,
  "image_url" TEXT,
  "price_amount_minor" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMPTZ(6),
  CONSTRAINT "package_versions_range_check" CHECK ("guest_min" >= 30 AND "guest_max" <= 100 AND "guest_min" <= "guest_max"),
  CONSTRAINT "package_versions_price_check" CHECK ("price_amount_minor" IS NULL OR "price_amount_minor" > 0),
  CONSTRAINT "package_versions_publication_check" CHECK (("state" = 'draft' AND "published_at" IS NULL) OR ("state" IN ('published', 'superseded') AND "published_at" IS NOT NULL)),
  UNIQUE ("package_id", "version")
);
CREATE UNIQUE INDEX "package_versions_one_draft" ON "package_versions" ("package_id") WHERE "state" = 'draft';
CREATE UNIQUE INDEX "package_versions_one_published" ON "package_versions" ("package_id") WHERE "state" = 'published';
