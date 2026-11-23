SET local check_function_bodies = off;

CREATE EXTENSION "vector" SCHEMA "public";

CREATE TABLE "public"."_prisma_migrations" (
  "id"                  character varying(36)    NOT NULL,
  "checksum"            character varying(64)    NOT NULL,
  "finished_at"         timestamp with time zone,
  "migration_name"      character varying(255)   NOT NULL,
  "logs"                text,
  "rolled_back_at"      timestamp with time zone,
  "started_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "applied_steps_count" integer                  NOT NULL DEFAULT 0,
  CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."_prisma_migrations"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."_prisma_migrations" FROM "anon", "authenticated";

CREATE TABLE "public"."ai_tool_calls" (
  "id"                   uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "turn_id"              uuid                        NOT NULL,
  "tool_call_id"         text                        NOT NULL,
  "tool_name"            text                        NOT NULL,
  "customer_message_id"  uuid                        NOT NULL,
  "assistant_message_id" uuid,
  "status"               text                        NOT NULL DEFAULT 'started'::text,
  "input"                jsonb                       NOT NULL,
  "output"               jsonb,
  "error_code"           text,
  "started_at"           timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at"         timestamp(6) with time zone,
  CONSTRAINT "ai_tool_calls_completed_at_check" CHECK (((completed_at IS NULL) OR (completed_at >= started_at))),
  CONSTRAINT "ai_tool_calls_error_code_check" CHECK (((error_code IS NULL) OR (error_code ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'::text))),
  CONSTRAINT "ai_tool_calls_input_check" CHECK (((jsonb_typeof(input) = 'object'::text) AND (octet_length((input)::text) <= 65536))),
  CONSTRAINT "ai_tool_calls_output_size_check" CHECK (((output IS NULL) OR (octet_length((output)::text) <= 65536))),
  CONSTRAINT "ai_tool_calls_pkey" PRIMARY KEY (id),
  CONSTRAINT "ai_tool_calls_state_check"
    CHECK ((((status = 'started'::text) AND (completed_at IS NULL) AND (error_code IS NULL) AND (output IS NULL)) OR ((status = 'succeeded'::text) AND (completed_at IS
    NOT NULL) AND (error_code IS NULL)) OR ((status = 'failed'::text) AND (completed_at IS NOT NULL) AND (output IS NULL)))),
  CONSTRAINT "ai_tool_calls_status_check" CHECK ((status = ANY (ARRAY['started'::text, 'succeeded'::text, 'failed'::text]))),
  CONSTRAINT "ai_tool_calls_tool_call_id_check" CHECK (((btrim(tool_call_id) <> ''::text) AND (char_length(tool_call_id) <= 256))),
  CONSTRAINT "ai_tool_calls_tool_name_check" CHECK ((tool_name ~ '^[A-Za-z][A-Za-z0-9_]{0,127}$'::text)),
  CONSTRAINT "ai_tool_calls_turn_id_tool_call_id_key" UNIQUE (turn_id, tool_call_id)
);

ALTER TABLE "public"."ai_tool_calls"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."ai_tool_calls" FROM "anon", "authenticated";

CREATE TABLE "public"."audit_events" (
  "id"          uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "actor_id"    uuid,
  "action"      text                        NOT NULL,
  "entity_type" text                        NOT NULL,
  "entity_id"   uuid                        NOT NULL,
  "metadata"    jsonb                       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"  timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."audit_events"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."audit_events" FROM "anon", "authenticated";

CREATE TABLE "public"."booking_request_status_history" (
  "id"                 uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "booking_request_id" uuid                        NOT NULL,
  "status"             text                        NOT NULL,
  "reason"             text,
  "changed_by"         uuid                        NOT NULL,
  "created_at"         timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_request_status_history_pkey" PRIMARY KEY (id),
  CONSTRAINT "booking_request_status_history_status_check"
    CHECK ((status = ANY (ARRAY['under_review'::text, 'needs_details'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text])))
);

ALTER TABLE "public"."booking_request_status_history"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."booking_request_status_history" FROM "anon", "authenticated";

CREATE TABLE "public"."booking_requests" (
  "id"                       uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "reference"                text                        NOT NULL,
  "customer_id"              uuid                        NOT NULL,
  "package_id"               uuid,
  "event_type"               text                        NOT NULL,
  "starts_at"                timestamp(6) with time zone,
  "ends_at"                  timestamp(6) with time zone,
  "time_zone"                text                        NOT NULL,
  "guest_count"              integer,
  "contact_name"             text                        NOT NULL,
  "phone_number"             text                        NOT NULL,
  "preferred_venue_location" text,
  "special_requests"         text,
  "status"                   text                        NOT NULL DEFAULT 'under_review'::text,
  "out_of_range"             boolean                     NOT NULL,
  "created_at"               timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "preferred_date"           text                        NOT NULL,
  "estimated_duration"       text                        NOT NULL DEFAULT 'undecided'::text,
  "estimated_duration_days"  integer,
  "requested_days"           jsonb,
  CONSTRAINT "booking_requested_days_array" CHECK (((requested_days IS NULL) OR ((jsonb_typeof(requested_days) = 'array'::text) AND (jsonb_array_length(requested_days) > 0)))),
  CONSTRAINT "booking_requests_check" CHECK ((ends_at > starts_at)),
  CONSTRAINT "booking_requests_estimated_duration_check"
    CHECK
    ((estimated_duration = ANY (ARRAY['4_hours'::text, '8_hours'::text, '12_hours'::text, '1_day'::text, '2_days'::text, '3_days'::text, '4_days'::text, '5_days'::text,
    '6_days'::text, '1_week'::text, 'more_than_1_week'::text, 'undecided'::text]))),
  CONSTRAINT "booking_requests_estimated_duration_days_check"
    CHECK (((estimated_duration_days IS NULL) OR ((estimated_duration = 'more_than_1_week'::text) AND (estimated_duration_days >= 8)))),
  CONSTRAINT "booking_requests_guest_count_check" CHECK ((guest_count > 0)),
  CONSTRAINT "booking_requests_pkey" PRIMARY KEY (id),
  CONSTRAINT "booking_requests_reference_key" UNIQUE (reference),
  CONSTRAINT "booking_requests_status_check" CHECK ((status = ANY (ARRAY['under_review'::text, 'needs_details'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text])))
);

ALTER TABLE "public"."booking_requests"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."booking_requests" FROM "anon", "authenticated";

CREATE TABLE "public"."catalog_knowledge" (
  "id"               uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "package_id"       uuid,
  "service_id"       uuid,
  "chunk_key"        text                        NOT NULL,
  "content_markdown" text                        NOT NULL,
  "media_id"         uuid,
  "content_hash"     text                        NOT NULL,
  "embedding"        public.vector(768),
  "embedding_model"  text,
  "embedded_at"      timestamp(6) with time zone,
  CONSTRAINT "catalog_knowledge_chunk_key_check" CHECK ((btrim(chunk_key) <> ''::text)),
  CONSTRAINT "catalog_knowledge_content_hash_check" CHECK ((btrim(content_hash) <> ''::text)),
  CONSTRAINT "catalog_knowledge_embedding_state_check" CHECK ((((embedding IS NULL) AND (embedding_model IS NULL) AND (embedded_at IS NULL)) OR ((embedding IS
    NOT NULL) AND (embedding_model IS NOT NULL) AND (btrim(embedding_model) <> ''::text) AND (embedded_at IS NOT NULL)))),
  CONSTRAINT "catalog_knowledge_owner_check" CHECK ((((package_id IS NOT NULL) AND (service_id IS NULL)) OR ((package_id IS NULL) AND (service_id IS NOT NULL)))),
  CONSTRAINT "catalog_knowledge_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."catalog_knowledge"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."catalog_knowledge" FROM "anon", "authenticated";

CREATE TABLE "public"."conversations" (
  "id"                           uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "customer_id"                  uuid,
  "created_at"                   timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                   timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"                       text                        NOT NULL DEFAULT 'active'::text,
  "closed_at"                    timestamp(6) with time zone,
  "booking_request_id"           uuid,
  "ai_enabled"                   boolean                     NOT NULL DEFAULT true,
  "ai_version"                   integer                     NOT NULL DEFAULT 0,
  "claimed_guest_identity_id"    uuid,
  "guest_customer_message_count" integer                     NOT NULL DEFAULT 0,
  "guest_expires_at"             timestamp(6) with time zone,
  "guest_identity_id"            uuid,
  CONSTRAINT "conversations_guest_count_check" CHECK (((guest_customer_message_count >= 0) AND (guest_customer_message_count <= 5))),
  CONSTRAINT "conversations_owner_check" CHECK ((((customer_id IS
    NOT NULL) AND (guest_identity_id IS NULL) AND (guest_expires_at IS NULL)) OR ((customer_id IS NULL) AND (guest_identity_id IS NOT NULL) AND (guest_expires_at IS
    NOT NULL) AND (claimed_guest_identity_id IS NULL) AND (booking_request_id IS NULL)))),
  CONSTRAINT "conversations_pkey" PRIMARY KEY (id),
  CONSTRAINT "conversations_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'closed'::text])))
);

ALTER TABLE "public"."conversations"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."conversations" FROM "anon", "authenticated";

CREATE TABLE "public"."events_day" (
  "id"                       uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "booking_request_id"       uuid                        NOT NULL,
  "day"                      date                        NOT NULL,
  "starts_at"                timestamp(6) with time zone NOT NULL,
  "ends_at"                  timestamp(6) with time zone NOT NULL,
  "status"                   text                        NOT NULL DEFAULT 'scheduled'::text,
  "replacement_event_day_id" uuid,
  "created_at"               timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "events_day_pkey" PRIMARY KEY (id),
  CONSTRAINT "events_day_replacement_not_self_check" CHECK (((replacement_event_day_id IS NULL) OR (replacement_event_day_id <> id))),
  CONSTRAINT "events_day_replacement_status_check" CHECK (((status = 'moved'::text) = (replacement_event_day_id IS NOT NULL))),
  CONSTRAINT "events_day_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'cancelled'::text, 'moved'::text]))),
  CONSTRAINT "events_day_time_range_check" CHECK ((ends_at > starts_at))
);

ALTER TABLE "public"."events_day"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."events_day" FROM "anon", "authenticated";

CREATE TABLE "public"."guest_chat_identities" (
  "id"         uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "token_hash" text                        NOT NULL,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guest_chat_identities_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."guest_chat_identities"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."guest_chat_identities" FROM "anon", "authenticated";

CREATE TABLE "public"."guest_message_requests" (
  "conversation_id"      uuid    NOT NULL,
  "request_id"           uuid    NOT NULL,
  "message_id"           uuid    NOT NULL,
  "assistant_message_id" uuid,
  "assistant_error"      text,
  "completed"            boolean NOT NULL DEFAULT false,
  CONSTRAINT "guest_message_requests_pkey" PRIMARY KEY (conversation_id, request_id)
);

ALTER TABLE "public"."guest_message_requests"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."guest_message_requests" FROM "anon", "authenticated";

CREATE TABLE "public"."media_assets" (
  "id"          uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "kind"        text                        NOT NULL,
  "source"      text                        NOT NULL,
  "url"         text,
  "storage_key" text,
  "mime_type"   text,
  "byte_size"   integer,
  "created_by"  uuid,
  "created_at"  timestamp(6) with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "media_assets_kind_check" CHECK ((kind = ANY (ARRAY['image'::text, 'video'::text]))),
  CONSTRAINT "media_assets_pkey" PRIMARY KEY (id),
  CONSTRAINT "media_assets_source_check" CHECK ((source = ANY (ARRAY['upload'::text, 'sample'::text]))),
  CONSTRAINT "media_assets_source" CHECK ((((source = 'upload'::text) AND (storage_key IS NOT NULL) AND (url IS NULL) AND (mime_type IS NOT NULL) AND (byte_size IS
    NOT NULL) AND (byte_size > 0) AND (((kind = 'image'::text) AND (byte_size <= 10485760)) OR ((kind = 'video'::text) AND (byte_size <= 26214400)))) OR
    ((source = 'sample'::text) AND (kind = 'image'::text) AND (url IS
    NOT NULL) AND (url = ANY (ARRAY['/images/wedding.jpg'::text, '/images/dinner.jpg'::text, '/images/dessert.jpg'::text, '/images/hero.jpg'::text])) AND (storage_key IS NULL) AND
    (byte_size IS NULL)))),
  CONSTRAINT "media_assets_storage_key_key" UNIQUE (storage_key)
);

ALTER TABLE "public"."media_assets"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."media_assets" FROM "anon", "authenticated";

CREATE TABLE "public"."messages" (
  "id"              uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" uuid                        NOT NULL,
  "sender_id"       uuid,
  "body"            text                        NOT NULL,
  "created_at"      timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at"         timestamp(6) with time zone,
  "sender_role"     text                        NOT NULL DEFAULT 'customer'::text,
  "quotation_id"    uuid,
  "guest_origin"    boolean                     NOT NULL DEFAULT false,
  CONSTRAINT "messages_pkey" PRIMARY KEY (id),
  CONSTRAINT "messages_sender_role_check" CHECK ((sender_role = ANY (ARRAY['customer'::text, 'admin'::text, 'assistant'::text]))),
  CONSTRAINT "messages_sender_role_matches_id_check"
    CHECK ((((sender_role = 'assistant'::text) AND (sender_id IS NULL) AND (NOT guest_origin)) OR ((sender_role = ANY (ARRAY['customer'::text, 'admin'::text])) AND (sender_id IS
    NOT NULL) AND (NOT guest_origin)) OR ((sender_role = 'customer'::text) AND (sender_id IS NULL) AND guest_origin)))
);

ALTER TABLE "public"."messages"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."messages" FROM "anon", "authenticated";

CREATE TABLE "public"."package_services" (
  "id"         uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "package_id" uuid                        NOT NULL,
  "service_id" uuid                        NOT NULL,
  "role"       text                        NOT NULL,
  "sort_order" integer                     NOT NULL,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "package_services_pkey" PRIMARY KEY (id),
  CONSTRAINT "package_services_role_check" CHECK ((role = ANY (ARRAY['included'::text, 'optional'::text]))),
  CONSTRAINT "package_services_sort_order_check" CHECK ((sort_order >= 0))
);

ALTER TABLE "public"."package_services"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."package_services" FROM "anon", "authenticated";

CREATE TABLE "public"."packages" (
  "id"                            uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "created_at"                    timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                    timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived_at"                   timestamp(6) with time zone,
  "name"                          text                        NOT NULL,
  "max_guests"                    integer                     NOT NULL,
  "price"                         integer                     NOT NULL,
  "published_at"                  timestamp(6) with time zone DEFAULT now(),
  "description"                   text                        NOT NULL DEFAULT ''::text,
  "slug"                          text                        NOT NULL,
  "custom_for_booking_request_id" uuid,
  "package_type"                  text                        NOT NULL DEFAULT 'catalog'::text,
  "canvas"                        jsonb                       NOT NULL DEFAULT '[]'::jsonb,
  "thumbnail_media_id"            uuid,
  "event_type"                    text,
  CONSTRAINT "packages_event_type_check" CHECK ((event_type = ANY (ARRAY['Birthday'::text, 'Wedding'::text, 'Debut'::text, 'Corporate'::text]))),
  CONSTRAINT "packages_max_guests_check" CHECK ((max_guests > 0)),
  CONSTRAINT "packages_pkey" PRIMARY KEY (id),
  CONSTRAINT "packages_price_check" CHECK (((price > 0) AND (price <= 21474836))),
  CONSTRAINT "packages_type_owner_check" CHECK ((((package_type = 'catalog'::text) AND (custom_for_booking_request_id IS NULL) AND (published_at IS
    NOT NULL)) OR ((package_type = 'custom'::text) AND (custom_for_booking_request_id IS NOT NULL) AND (published_at IS NULL))))
);

ALTER TABLE "public"."packages"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."packages" FROM "anon", "authenticated";

CREATE TABLE "public"."quotations" (
  "id"                    uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "booking_request_id"    uuid                        NOT NULL,
  "version"               integer                     NOT NULL,
  "currency"              text                        NOT NULL DEFAULT 'PHP'::text,
  "base_amount_minor"     integer                     NOT NULL,
  "total_amount_minor"    integer                     NOT NULL,
  "items"                 jsonb                       NOT NULL DEFAULT '[]'::jsonb,
  "status"                text                        NOT NULL DEFAULT 'draft'::text,
  "created_by"            uuid                        NOT NULL,
  "created_at"            timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at"               timestamp(6) with time zone,
  "accepted_at"           timestamp(6) with time zone,
  "superseded_at"         timestamp(6) with time zone,
  "offered_package_id"    uuid                        NOT NULL,
  "adjustments_reviewed"  boolean                     NOT NULL DEFAULT true,
  "previous_quotation_id" uuid,
  "revision_reason"       text,
  CONSTRAINT "quotations_base_amount_check" CHECK ((base_amount_minor > 0)),
  CONSTRAINT "quotations_currency_check" CHECK ((currency = 'PHP'::text)),
  CONSTRAINT "quotations_final_total_check" CHECK (((status <> ALL (ARRAY['sent'::text, 'accepted'::text])) OR (total_amount_minor >= 0))),
  CONSTRAINT "quotations_pkey" PRIMARY KEY (id),
  CONSTRAINT "quotations_revision_not_self_check" CHECK (((previous_quotation_id IS NULL) OR (previous_quotation_id <> id))),
  CONSTRAINT "quotations_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'superseded'::text]))),
  CONSTRAINT "quotations_version_check" CHECK ((version > 0))
);

ALTER TABLE "public"."quotations"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."quotations" FROM "anon", "authenticated";

CREATE TABLE "public"."services" (
  "id"                 uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "created_at"         timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived_at"        timestamp(6) with time zone,
  "name"               text                        NOT NULL,
  "description"        text                        NOT NULL,
  "hourly_rate_pesos"  integer,
  "published_at"       timestamp with time zone    NOT NULL DEFAULT now(),
  "slug"               text                        NOT NULL,
  "canvas"             jsonb                       NOT NULL DEFAULT '[]'::jsonb,
  "fixed_price_pesos"  integer,
  "included_hours"     integer,
  "thumbnail_media_id" uuid,
  "event_type"         text,
  CONSTRAINT "services_event_type_check" CHECK ((event_type = ANY (ARRAY['Birthday'::text, 'Wedding'::text, 'Debut'::text, 'Corporate'::text]))),
  CONSTRAINT "services_fixed_pricing_check" CHECK ((((fixed_price_pesos IS NULL) AND (included_hours IS NULL)) OR ((fixed_price_pesos IS
    NOT NULL) AND (fixed_price_pesos > 0) AND (included_hours IS NOT NULL) AND (included_hours > 0) AND (hourly_rate_pesos IS NOT NULL)))),
  CONSTRAINT "services_hourly_rate_positive" CHECK (((hourly_rate_pesos IS NULL) OR (hourly_rate_pesos > 0))),
  CONSTRAINT "services_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."services"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."services" FROM "anon", "authenticated";

CREATE TABLE "public"."sessions" (
  "id"         uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid                        NOT NULL,
  "token_hash" text                        NOT NULL,
  "expires_at" timestamp(6) with time zone NOT NULL,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."sessions"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."sessions" FROM "anon", "authenticated";

CREATE TABLE "public"."showcase_record_media" (
  "id"         uuid    NOT NULL DEFAULT gen_random_uuid(),
  "record_id"  uuid    NOT NULL,
  "media_id"   uuid    NOT NULL,
  "sort_order" integer NOT NULL,
  CONSTRAINT "showcase_record_media_pkey" PRIMARY KEY (id),
  CONSTRAINT "showcase_record_media_sort_check" CHECK ((sort_order >= 0))
);

ALTER TABLE "public"."showcase_record_media"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."showcase_record_media" FROM "anon", "authenticated";

CREATE TABLE "public"."showcase_records" (
  "id"               uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "slug"             text                        NOT NULL,
  "title"            text                        NOT NULL,
  "description"      text                        NOT NULL,
  "cover_media_id"   uuid                        NOT NULL,
  "preview_video_id" uuid,
  "published_at"     timestamp(6) with time zone,
  "created_by"       uuid,
  "created_at"       timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at"       timestamp(6) with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "showcase_records_desc_check" CHECK (((length(btrim(description)) >= 1) AND (length(btrim(description)) <= 2000))),
  CONSTRAINT "showcase_records_pkey" PRIMARY KEY (id),
  CONSTRAINT "showcase_records_slug_key" UNIQUE (slug),
  CONSTRAINT "showcase_records_title_check" CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 120)))
);

ALTER TABLE "public"."showcase_records"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."showcase_records" FROM "anon", "authenticated";

CREATE TABLE "public"."users" (
  "id"            uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "firebase_uid"  text,
  "email"         text                        NOT NULL,
  "display_name"  text,
  "role"          text                        NOT NULL DEFAULT 'customer'::text,
  "created_at"    timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "password_hash" text,
  CONSTRAINT "users_identity_check" CHECK (((firebase_uid IS NOT NULL) OR (password_hash IS NOT NULL))),
  CONSTRAINT "users_pkey" PRIMARY KEY (id),
  CONSTRAINT "users_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'customer'::text])))
);

ALTER TABLE "public"."users"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."users" FROM "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.clemora_quotation_items_valid (
  items jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  PARALLEL SAFE
  SET search_path TO 'pg_catalog'
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."clemora_quotation_items_valid"(jsonb) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.clemora_quotation_total (
  base_amount integer,
  items       jsonb
)
  RETURNS bigint
  LANGUAGE plpgsql
  IMMUTABLE
  PARALLEL SAFE
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
DECLARE item jsonb; result bigint := base_amount;
BEGIN
  IF NOT public.clemora_quotation_items_valid(items) THEN RETURN NULL; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
    result := result + CASE WHEN item->>'direction' = 'add' THEN (item->>'amountMinor')::bigint ELSE -(item->>'amountMinor')::bigint END;
  END LOOP;
  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."clemora_quotation_total"(integer, jsonb) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.enforce_inquiry_catalog_package()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  IF NEW.package_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM packages WHERE id = NEW.package_id AND package_type = 'catalog') THEN
    RAISE EXCEPTION 'An inquiry must reference a catalog package' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."enforce_inquiry_catalog_package"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.enforce_private_package_identity()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  IF OLD.package_type <> NEW.package_type OR OLD.custom_for_booking_request_id IS DISTINCT FROM NEW.custom_for_booking_request_id THEN
    RAISE EXCEPTION 'Package type and ownership are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."enforce_private_package_identity"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.enforce_quotation_booking_links()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."enforce_quotation_booking_links"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.validate_ai_tool_call_messages()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
DECLARE
  customer_conversation_id UUID;
  assistant_conversation_id UUID;
BEGIN
  SELECT conversation_id INTO customer_conversation_id
  FROM public.messages
  WHERE id = NEW.customer_message_id AND sender_role = 'customer';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI tool call requires a customer message'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.assistant_message_id IS NOT NULL THEN
    SELECT conversation_id INTO assistant_conversation_id
    FROM public.messages
    WHERE id = NEW.assistant_message_id AND sender_role = 'assistant';

    IF NOT FOUND OR assistant_conversation_id IS DISTINCT FROM customer_conversation_id THEN
      RAISE EXCEPTION 'AI tool call reply must be an assistant message in the same conversation'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."validate_ai_tool_call_messages"() FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."booking_request_status_history"
  ADD CONSTRAINT "booking_request_status_history_booking_request_id_fkey" FOREIGN KEY (booking_request_id) REFERENCES public.booking_requests(id) ON DELETE CASCADE;

ALTER TABLE "public"."conversations"
  ADD CONSTRAINT "conversations_booking_request_id_fkey" FOREIGN KEY (booking_request_id) REFERENCES public.booking_requests(id) ON DELETE SET NULL;

ALTER TABLE "public"."events_day"
  ADD CONSTRAINT "events_day_booking_request_id_fkey" FOREIGN KEY (booking_request_id) REFERENCES public.booking_requests(id) ON DELETE RESTRICT;

ALTER TABLE "public"."conversations"
  ADD CONSTRAINT "conversations_claimed_guest_identity_id_fkey" FOREIGN KEY (claimed_guest_identity_id) REFERENCES public.guest_chat_identities(id) ON UPDATE CASCADE
    ON DELETE RESTRICT;

ALTER TABLE "public"."conversations"
  ADD CONSTRAINT "conversations_guest_identity_id_fkey" FOREIGN KEY (guest_identity_id) REFERENCES public.guest_chat_identities(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."guest_message_requests"
  ADD CONSTRAINT "guest_message_requests_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."catalog_knowledge"
  ADD CONSTRAINT "catalog_knowledge_media_id_fkey" FOREIGN KEY (media_id) REFERENCES public.media_assets(id) ON DELETE CASCADE;

ALTER TABLE "public"."messages"
  ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."ai_tool_calls"
  ADD CONSTRAINT "ai_tool_calls_assistant_message_id_fkey" FOREIGN KEY (assistant_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE "public"."ai_tool_calls"
  ADD CONSTRAINT "ai_tool_calls_customer_message_id_fkey" FOREIGN KEY (customer_message_id) REFERENCES public.messages(id) ON DELETE CASCADE;

ALTER TABLE "public"."packages"
  ADD CONSTRAINT "packages_custom_for_booking_request_id_fkey" FOREIGN KEY (custom_for_booking_request_id) REFERENCES public.booking_requests(id) ON DELETE RESTRICT;

ALTER TABLE "public"."booking_requests"
  ADD CONSTRAINT "booking_requests_package_id_fkey" FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE RESTRICT;

ALTER TABLE "public"."catalog_knowledge"
  ADD CONSTRAINT "catalog_knowledge_package_id_fkey" FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE CASCADE;

ALTER TABLE "public"."package_services"
  ADD CONSTRAINT "package_services_package_id_fkey" FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE CASCADE;

ALTER TABLE "public"."quotations"
  ADD CONSTRAINT "quotations_booking_request_id_fkey" FOREIGN KEY (booking_request_id) REFERENCES public.booking_requests(id) ON DELETE RESTRICT;

ALTER TABLE "public"."messages"
  ADD CONSTRAINT "messages_quotation_id_fkey" FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE RESTRICT;

ALTER TABLE "public"."quotations"
  ADD CONSTRAINT "quotations_previous_quotation_id_fkey" FOREIGN KEY (previous_quotation_id) REFERENCES public.quotations(id) ON DELETE RESTRICT;

ALTER TABLE "public"."catalog_knowledge"
  ADD CONSTRAINT "catalog_knowledge_service_id_fkey" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;

ALTER TABLE "public"."package_services"
  ADD CONSTRAINT "package_services_service_id_fkey" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;

ALTER TABLE "public"."showcase_record_media"
  ADD CONSTRAINT "showcase_record_media_media_fkey" FOREIGN KEY (media_id) REFERENCES public.media_assets(id) ON DELETE RESTRICT;

ALTER TABLE "public"."showcase_records"
  ADD CONSTRAINT "showcase_records_cover_fkey" FOREIGN KEY (cover_media_id) REFERENCES public.media_assets(id) ON DELETE RESTRICT;

ALTER TABLE "public"."showcase_record_media"
  ADD CONSTRAINT "showcase_record_media_record_fkey" FOREIGN KEY (record_id) REFERENCES public.showcase_records(id) ON DELETE CASCADE;

ALTER TABLE "public"."showcase_records"
  ADD CONSTRAINT "showcase_records_preview_fkey" FOREIGN KEY (preview_video_id) REFERENCES public.media_assets(id) ON DELETE SET NULL;

ALTER TABLE "public"."audit_events"
  ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."booking_request_status_history"
  ADD CONSTRAINT "booking_request_status_history_changed_by_fkey" FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE "public"."booking_requests"
  ADD CONSTRAINT "booking_requests_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE "public"."conversations"
  ADD CONSTRAINT "conversations_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."media_assets"
  ADD CONSTRAINT "media_assets_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."messages"
  ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."quotations"
  ADD CONSTRAINT "quotations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE "public"."sessions"
  ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."showcase_records"
  ADD CONSTRAINT "showcase_records_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX ai_tool_calls_assistant_message_id_idx ON public.ai_tool_calls USING btree (assistant_message_id);

CREATE INDEX ai_tool_calls_customer_message_id_idx ON public.ai_tool_calls USING btree (customer_message_id);

CREATE INDEX audit_events_actor_id_idx ON public.audit_events USING btree (actor_id);

CREATE INDEX audit_events_entity_type_entity_id_created_at_idx ON public.audit_events USING btree (entity_type, entity_id, created_at);

CREATE INDEX booking_request_status_history_booking_request_id_created_a_idx ON public.booking_request_status_history USING btree (booking_request_id, created_at);

CREATE INDEX booking_requests_customer_id_created_at_idx ON public.booking_requests USING btree (customer_id, created_at);

CREATE INDEX catalog_knowledge_media_id_idx ON public.catalog_knowledge USING btree (media_id);

CREATE UNIQUE INDEX catalog_knowledge_package_id_chunk_key_key ON public.catalog_knowledge USING btree (package_id, chunk_key);

CREATE UNIQUE INDEX catalog_knowledge_service_id_chunk_key_key ON public.catalog_knowledge USING btree (service_id, chunk_key);

CREATE UNIQUE INDEX conversations_active_guest_identity_key ON public.conversations USING btree (guest_identity_id)
  WHERE ((guest_identity_id IS NOT NULL) AND (status = 'active'::text));

CREATE UNIQUE INDEX conversations_booking_request_id_key ON public.conversations USING btree (booking_request_id)
  WHERE (booking_request_id IS NOT NULL);

CREATE INDEX conversations_claimed_guest_identity_idx ON public.conversations USING btree (claimed_guest_identity_id);

CREATE INDEX conversations_customer_id_created_at_idx ON public.conversations USING btree (customer_id, created_at);

CREATE INDEX conversations_status_idx ON public.conversations USING btree (status);

CREATE INDEX conversations_updated_at_id_idx ON public.conversations USING btree (updated_at DESC, id DESC);

CREATE INDEX events_day_booking_request_id_day_idx ON public.events_day USING btree (booking_request_id, day);

CREATE UNIQUE INDEX events_day_id_booking_request_id_key ON public.events_day USING btree (id, booking_request_id);

ALTER TABLE "public"."events_day"
  ADD CONSTRAINT "events_day_replacement_same_booking_fkey" FOREIGN KEY (replacement_event_day_id, booking_request_id) REFERENCES public.events_day(id, booking_request_id)
    ON DELETE RESTRICT;

CREATE INDEX events_day_replacement_event_day_id_booking_request_id_idx ON public.events_day USING btree (replacement_event_day_id, booking_request_id);

CREATE UNIQUE INDEX guest_chat_identities_token_hash_key ON public.guest_chat_identities USING btree (token_hash);

CREATE UNIQUE INDEX guest_message_requests_message_id_key ON public.guest_message_requests USING btree (message_id);

CREATE INDEX messages_conversation_id_created_at_idx ON public.messages USING btree (conversation_id, created_at);

CREATE UNIQUE INDEX messages_quotation_id_key ON public.messages USING btree (quotation_id);

CREATE UNIQUE INDEX package_services_package_id_service_id_key ON public.package_services USING btree (package_id, service_id);

CREATE UNIQUE INDEX package_services_package_id_sort_order_key ON public.package_services USING btree (package_id, sort_order);

CREATE INDEX package_services_service_id_idx ON public.package_services USING btree (service_id);

CREATE INDEX packages_canvas_idx ON public.packages USING gin (canvas jsonb_path_ops);

CREATE UNIQUE INDEX packages_custom_for_booking_request_id_key ON public.packages USING btree (custom_for_booking_request_id);

CREATE UNIQUE INDEX packages_name_lower_key ON public.packages USING btree (lower(name))
  WHERE (package_type = 'catalog'::text);

CREATE UNIQUE INDEX packages_slug_key ON public.packages USING btree (slug);

CREATE INDEX packages_thumbnail_media_id_idx ON public.packages USING btree (thumbnail_media_id)
  WHERE (thumbnail_media_id IS NOT NULL);

CREATE INDEX quotations_booking_request_id_status_idx ON public.quotations USING btree (booking_request_id, status);

CREATE UNIQUE INDEX quotations_booking_request_id_version_key ON public.quotations USING btree (booking_request_id, VERSION);

CREATE INDEX quotations_created_by_idx ON public.quotations USING btree (created_by);

CREATE UNIQUE INDEX quotations_one_accepted_per_booking ON public.quotations USING btree (booking_request_id)
  WHERE (status = 'accepted'::text);

CREATE UNIQUE INDEX quotations_one_sent_per_booking ON public.quotations USING btree (booking_request_id)
  WHERE (status = 'sent'::text);

CREATE INDEX quotations_previous_quotation_id_idx ON public.quotations USING btree (previous_quotation_id);

CREATE INDEX services_canvas_idx ON public.services USING gin (canvas jsonb_path_ops);

CREATE UNIQUE INDEX services_name_lower_key ON public.services USING btree (lower(name));

CREATE UNIQUE INDEX services_slug_key ON public.services USING btree (slug);

CREATE INDEX services_thumbnail_media_id_idx ON public.services USING btree (thumbnail_media_id)
  WHERE (thumbnail_media_id IS NOT NULL);

CREATE UNIQUE INDEX sessions_token_hash_key ON public.sessions USING btree (token_hash);

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);

CREATE INDEX showcase_record_media_media_id_idx ON public.showcase_record_media USING btree (media_id);

CREATE UNIQUE INDEX showcase_record_media_record_id_media_id_key ON public.showcase_record_media USING btree (record_id, media_id);

CREATE UNIQUE INDEX showcase_record_media_record_id_sort_order_key ON public.showcase_record_media USING btree (record_id, sort_order);

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE UNIQUE INDEX users_email_normalized_key ON public.users USING btree (lower(TRIM(BOTH FROM email)));

CREATE UNIQUE INDEX users_firebase_uid_key ON public.users USING btree (firebase_uid);

CREATE TRIGGER ai_tool_calls_validate_messages
  BEFORE INSERT OR UPDATE OF customer_message_id, assistant_message_id ON public.ai_tool_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ai_tool_call_messages();

CREATE TRIGGER booking_requests_catalog_package
  BEFORE INSERT OR UPDATE OF package_id ON public.booking_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_inquiry_catalog_package();

CREATE TRIGGER messages_quotation_booking
  BEFORE INSERT OR UPDATE OF quotation_id, conversation_id ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quotation_booking_links();

CREATE TRIGGER packages_private_identity
  BEFORE UPDATE ON public.packages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_private_package_identity();

CREATE TRIGGER quotations_revision_booking
  BEFORE INSERT OR UPDATE OF previous_quotation_id, booking_request_id ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quotation_booking_links();

COMMENT ON EXTENSION "vector" IS 'vector data type and ivfflat and hnsw access methods';

REVOKE ALL ON FUNCTION "public"."clemora_quotation_items_valid"(jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."clemora_quotation_items_valid"(jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."clemora_quotation_items_valid"(jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."clemora_quotation_total"(integer, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."clemora_quotation_total"(integer, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."clemora_quotation_total"(integer, jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."enforce_inquiry_catalog_package"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."enforce_inquiry_catalog_package"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."enforce_inquiry_catalog_package"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."enforce_private_package_identity"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."enforce_private_package_identity"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."enforce_private_package_identity"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."enforce_quotation_booking_links"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."enforce_quotation_booking_links"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."enforce_quotation_booking_links"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."validate_ai_tool_call_messages"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_ai_tool_call_messages"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_ai_tool_call_messages"() TO "service_role";

REVOKE ALL ON TABLE "public"."_prisma_migrations" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."_prisma_migrations" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."_prisma_migrations" TO "service_role";

REVOKE ALL ON TABLE "public"."ai_tool_calls" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ai_tool_calls" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ai_tool_calls" TO "service_role";

REVOKE ALL ON TABLE "public"."audit_events" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."audit_events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."audit_events" TO "service_role";

REVOKE ALL ON TABLE "public"."booking_request_status_history" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."booking_request_status_history" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."booking_request_status_history" TO "service_role";

REVOKE ALL ON TABLE "public"."booking_requests" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."booking_requests" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."booking_requests" TO "service_role";

REVOKE ALL ON TABLE "public"."catalog_knowledge" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."catalog_knowledge" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."catalog_knowledge" TO "service_role";

REVOKE ALL ON TABLE "public"."conversations" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversations" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversations" TO "service_role";

REVOKE ALL ON TABLE "public"."events_day" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events_day" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events_day" TO "service_role";

REVOKE ALL ON TABLE "public"."guest_chat_identities" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."guest_chat_identities" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."guest_chat_identities" TO "service_role";

REVOKE ALL ON TABLE "public"."guest_message_requests" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."guest_message_requests" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."guest_message_requests" TO "service_role";

REVOKE ALL ON TABLE "public"."media_assets" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."media_assets" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."media_assets" TO "service_role";

REVOKE ALL ON TABLE "public"."messages" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "service_role";

REVOKE ALL ON TABLE "public"."package_services" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."package_services" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."package_services" TO "service_role";

REVOKE ALL ON TABLE "public"."packages" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."packages" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."packages" TO "service_role";

REVOKE ALL ON TABLE "public"."quotations" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."quotations" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."quotations" TO "service_role";

REVOKE ALL ON TABLE "public"."services" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."services" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."services" TO "service_role";

REVOKE ALL ON TABLE "public"."sessions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sessions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sessions" TO "service_role";

REVOKE ALL ON TABLE "public"."showcase_record_media" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."showcase_record_media" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."showcase_record_media" TO "service_role";

REVOKE ALL ON TABLE "public"."showcase_records" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."showcase_records" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."showcase_records" TO "service_role";

REVOKE ALL ON TABLE "public"."users" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."users" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."users" TO "service_role";

ALTER TABLE "public"."quotations"
  ADD CONSTRAINT "quotations_items_check" CHECK (public.clemora_quotation_items_valid(items));

ALTER TABLE "public"."quotations"
  ADD CONSTRAINT "quotations_total_check" CHECK ((total_amount_minor = public.clemora_quotation_total(base_amount_minor, items)));

