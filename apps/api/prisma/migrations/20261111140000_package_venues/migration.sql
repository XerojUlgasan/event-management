-- Package-specific venue inclusions. Every linked venue is included.
-- This records package scope, not a venue reservation or availability.
BEGIN;

CREATE TABLE "package_venues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "package_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_venues_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "package_venues_sort_order_check" CHECK ("sort_order" >= 0)
);

CREATE INDEX "package_venues_venue_id_idx" ON "package_venues"("venue_id");
CREATE UNIQUE INDEX "package_venues_package_id_venue_id_key" ON "package_venues"("package_id", "venue_id");
CREATE UNIQUE INDEX "package_venues_package_id_sort_order_key" ON "package_venues"("package_id", "sort_order");

ALTER TABLE "package_venues" ADD CONSTRAINT "package_venues_package_id_fkey"
    FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "package_venues" ADD CONSTRAINT "package_venues_venue_id_fkey"
    FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Application sessions access records through the API, not direct table grants.
ALTER TABLE "package_venues" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "package_venues" FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
    FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.package_venues FROM %I', client_role);
    END LOOP;
END;
$$;

COMMIT;
