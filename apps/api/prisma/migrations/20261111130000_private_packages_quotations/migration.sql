-- Generated with Prisma migrate diff between the baseline and proposed schemas.
-- Additive port: original inquiry fields and operational records remain untouched.
BEGIN;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "quotation_id" UUID;

-- AlterTable
ALTER TABLE "packages" ADD COLUMN     "custom_for_booking_request_id" UUID,
ADD COLUMN     "package_type" TEXT NOT NULL DEFAULT 'catalog',
ALTER COLUMN "published_at" DROP NOT NULL;

-- CreateTable
CREATE TABLE "package_services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "package_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_request_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "base_amount_minor" INTEGER NOT NULL,
    "total_amount_minor" INTEGER NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),
    "accepted_at" TIMESTAMPTZ(6),
    "superseded_at" TIMESTAMPTZ(6),
    "offered_package_id" UUID NOT NULL,
    "offered_package_updated_at" TIMESTAMPTZ(6) NOT NULL,
    "offered_package_terms" JSONB NOT NULL,
    "adjustments_reviewed" BOOLEAN NOT NULL DEFAULT true,
    "previous_quotation_id" UUID,
    "revision_reason" TEXT,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "package_services_service_id_idx" ON "package_services"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_services_package_id_service_id_key" ON "package_services"("package_id", "service_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_services_package_id_sort_order_key" ON "package_services"("package_id", "sort_order");

-- CreateIndex
CREATE INDEX "quotations_booking_request_id_status_idx" ON "quotations"("booking_request_id", "status");

-- CreateIndex
CREATE INDEX "quotations_created_by_idx" ON "quotations"("created_by");

-- CreateIndex
CREATE INDEX "quotations_previous_quotation_id_idx" ON "quotations"("previous_quotation_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_booking_request_id_version_key" ON "quotations"("booking_request_id", "version");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_created_at_idx" ON "audit_events"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_id_idx" ON "audit_events"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_quotation_id_key" ON "messages"("quotation_id");

-- CreateIndex
CREATE UNIQUE INDEX "packages_custom_for_booking_request_id_key" ON "packages"("custom_for_booking_request_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_custom_for_booking_request_id_fkey" FOREIGN KEY ("custom_for_booking_request_id") REFERENCES "booking_requests"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "package_services" ADD CONSTRAINT "package_services_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "package_services" ADD CONSTRAINT "package_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_booking_request_id_fkey" FOREIGN KEY ("booking_request_id") REFERENCES "booking_requests"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_previous_quotation_id_fkey" FOREIGN KEY ("previous_quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Private copies may retain the catalog title, but cannot take its public address.
DROP INDEX packages_name_lower_key;
CREATE UNIQUE INDEX packages_name_lower_key ON packages(lower(name)) WHERE package_type = 'catalog';
ALTER TABLE packages ADD CONSTRAINT packages_type_owner_check CHECK (
  (package_type = 'catalog' AND custom_for_booking_request_id IS NULL AND published_at IS NOT NULL)
  OR (package_type = 'custom' AND custom_for_booking_request_id IS NOT NULL AND published_at IS NULL)
);
CREATE FUNCTION enforce_private_package_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.package_type <> NEW.package_type OR OLD.custom_for_booking_request_id IS DISTINCT FROM NEW.custom_for_booking_request_id THEN
    RAISE EXCEPTION 'Package type and ownership are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER packages_private_identity BEFORE UPDATE ON packages FOR EACH ROW EXECUTE FUNCTION enforce_private_package_identity();

-- package_id always identifies the original catalog inquiry, never its proposal.
CREATE FUNCTION enforce_inquiry_catalog_package() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM packages WHERE id = NEW.package_id AND package_type = 'catalog') THEN
    RAISE EXCEPTION 'An inquiry must reference a catalog package' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER booking_requests_catalog_package BEFORE INSERT OR UPDATE OF package_id ON booking_requests FOR EACH ROW EXECUTE FUNCTION enforce_inquiry_catalog_package();

ALTER TABLE package_services ADD CONSTRAINT package_services_role_check CHECK (role IN ('included', 'optional')),
  ADD CONSTRAINT package_services_sort_order_check CHECK (sort_order >= 0);

-- JSONB references are historical identifiers, not service FKs. The API validates
-- current service eligibility on every save; descriptions remain self-contained.
CREATE FUNCTION clemora_quotation_items_valid(items jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog AS $$
DECLARE item jsonb; ids text[] := ARRAY[]::text[]; amount numeric; uuid_pattern text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  IF jsonb_typeof(items) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(items) > 100 THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF NOT (item ?& ARRAY['id','direction','kind','description','amountMinor']) THEN RETURN false; END IF;
    IF item - ARRAY['id','direction','kind','description','amountMinor','serviceId'] <> '{}'::jsonb THEN RETURN false; END IF;
    IF jsonb_typeof(item->'id') IS DISTINCT FROM 'string' OR NOT (item->>'id' ~ uuid_pattern) THEN RETURN false; END IF;
    IF lower(item->>'id') = ANY(ids) THEN RETURN false; END IF;
    ids := array_append(ids, lower(item->>'id'));
    IF jsonb_typeof(item->'direction') IS DISTINCT FROM 'string' OR item->>'direction' NOT IN ('add','deduct') THEN RETURN false; END IF;
    IF jsonb_typeof(item->'kind') IS DISTINCT FROM 'string' OR item->>'kind' NOT IN ('addition','deduction','substitution','adjustment') THEN RETURN false; END IF;
    IF jsonb_typeof(item->'description') IS DISTINCT FROM 'string' OR length(btrim(item->>'description')) NOT BETWEEN 1 AND 4000 THEN RETURN false; END IF;
    IF jsonb_typeof(item->'amountMinor') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    amount := (item->>'amountMinor')::numeric;
    IF amount <> trunc(amount) OR amount < 1 OR amount > 2147483647 THEN RETURN false; END IF;
    IF item ? 'serviceId' AND item->'serviceId' <> 'null'::jsonb AND (jsonb_typeof(item->'serviceId') IS DISTINCT FROM 'string' OR NOT (item->>'serviceId' ~ uuid_pattern)) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;
CREATE FUNCTION clemora_quotation_total(base_amount integer, items jsonb) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog, public AS $$
DECLARE item jsonb; result bigint := base_amount;
BEGIN
  IF NOT public.clemora_quotation_items_valid(items) THEN RETURN NULL; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
    result := result + CASE WHEN item->>'direction' = 'add' THEN (item->>'amountMinor')::bigint ELSE -(item->>'amountMinor')::bigint END;
  END LOOP;
  RETURN result;
END;
$$;
ALTER TABLE quotations ADD CONSTRAINT quotations_version_check CHECK (version > 0),
  ADD CONSTRAINT quotations_currency_check CHECK (currency = 'PHP'),
  ADD CONSTRAINT quotations_base_amount_check CHECK (base_amount_minor > 0),
  ADD CONSTRAINT quotations_status_check CHECK (status IN ('draft','sent','accepted','superseded')),
  ADD CONSTRAINT quotations_items_check CHECK (clemora_quotation_items_valid(items)),
  ADD CONSTRAINT quotations_total_check CHECK (total_amount_minor = clemora_quotation_total(base_amount_minor, items)),
  ADD CONSTRAINT quotations_final_total_check CHECK (status NOT IN ('sent','accepted') OR total_amount_minor >= 0),
  ADD CONSTRAINT quotations_snapshot_check CHECK (jsonb_typeof(offered_package_terms) = 'object'),
  ADD CONSTRAINT quotations_revision_not_self_check CHECK (previous_quotation_id IS NULL OR previous_quotation_id <> id);
CREATE UNIQUE INDEX quotations_one_sent_per_booking ON quotations(booking_request_id) WHERE status = 'sent';
CREATE UNIQUE INDEX quotations_one_accepted_per_booking ON quotations(booking_request_id) WHERE status = 'accepted';

CREATE FUNCTION enforce_quotation_booking_links() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'quotations' THEN
    IF NEW.previous_quotation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM quotations WHERE id = NEW.previous_quotation_id AND booking_request_id = NEW.booking_request_id) THEN
      RAISE EXCEPTION 'Quotation revision must belong to the same booking' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.quotation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM quotations q JOIN conversations c ON c.booking_request_id = q.booking_request_id WHERE q.id = NEW.quotation_id AND c.id = NEW.conversation_id
  ) THEN
    RAISE EXCEPTION 'Quotation message must use its booking conversation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER quotations_revision_booking BEFORE INSERT OR UPDATE OF previous_quotation_id, booking_request_id ON quotations FOR EACH ROW EXECUTE FUNCTION enforce_quotation_booking_links();
CREATE TRIGGER messages_quotation_booking BEFORE INSERT OR UPDATE OF quotation_id, conversation_id ON messages FOR EACH ROW EXECUTE FUNCTION enforce_quotation_booking_links();

-- Application sessions use the API; no direct browser table or function grants.
DO $$
DECLARE target_table text; client_role text; target_function text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['package_services','quotations','audit_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', target_table);
    FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', target_table, client_role);
    END LOOP;
  END LOOP;
  FOREACH target_function IN ARRAY ARRAY['enforce_private_package_identity()','enforce_inquiry_catalog_package()','clemora_quotation_items_valid(jsonb)','clemora_quotation_total(integer,jsonb)','enforce_quotation_booking_links()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', target_function);
    FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM %I', target_function, client_role);
    END LOOP;
  END LOOP;
END;
$$;

COMMIT;
