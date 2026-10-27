CREATE TABLE "package_images" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "content_type" TEXT NOT NULL CHECK ("content_type" IN ('image/jpeg', 'image/png')),
  "data" BYTEA NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
