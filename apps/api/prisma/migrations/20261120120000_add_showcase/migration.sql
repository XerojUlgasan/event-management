BEGIN;

CREATE TABLE public.showcase_records (
  id               UUID          NOT NULL DEFAULT gen_random_uuid(),
  slug             TEXT          NOT NULL,
  title            TEXT          NOT NULL,
  description      TEXT          NOT NULL,
  cover_media_id   UUID          NOT NULL,
  preview_video_id UUID,
  published_at     TIMESTAMPTZ(6),
  created_by       UUID,
  created_at       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT showcase_records_pkey        PRIMARY KEY (id),
  CONSTRAINT showcase_records_slug_key    UNIQUE (slug),
  CONSTRAINT showcase_records_title_check
    CHECK (length(btrim(title))       BETWEEN 1 AND 120),
  CONSTRAINT showcase_records_desc_check
    CHECK (length(btrim(description)) BETWEEN 1 AND 2000),

  CONSTRAINT showcase_records_created_by_fkey  FOREIGN KEY (created_by)
    REFERENCES public.users(id)        ON DELETE SET NULL  ON UPDATE NO ACTION,
  CONSTRAINT showcase_records_cover_fkey       FOREIGN KEY (cover_media_id)
    REFERENCES public.media_assets(id) ON DELETE RESTRICT  ON UPDATE NO ACTION,
  CONSTRAINT showcase_records_preview_fkey     FOREIGN KEY (preview_video_id)
    REFERENCES public.media_assets(id) ON DELETE SET NULL  ON UPDATE NO ACTION
);

CREATE TABLE public.showcase_record_media (
  id          UUID    NOT NULL DEFAULT gen_random_uuid(),
  record_id   UUID    NOT NULL,
  media_id    UUID    NOT NULL,
  sort_order  INTEGER NOT NULL,

  CONSTRAINT showcase_record_media_pkey       PRIMARY KEY (id),
  CONSTRAINT showcase_record_media_sort_check CHECK (sort_order >= 0),

  CONSTRAINT showcase_record_media_record_fkey FOREIGN KEY (record_id)
    REFERENCES public.showcase_records(id) ON DELETE CASCADE  ON UPDATE NO ACTION,
  CONSTRAINT showcase_record_media_media_fkey  FOREIGN KEY (media_id)
    REFERENCES public.media_assets(id)     ON DELETE RESTRICT ON UPDATE NO ACTION
);

-- record_id leads both unique indexes and covers the CASCADE FK scan.
-- media_id needs its own index for RESTRICT checks and visibility joins.
CREATE UNIQUE INDEX showcase_record_media_record_id_media_id_key
  ON public.showcase_record_media(record_id, media_id);
CREATE UNIQUE INDEX showcase_record_media_record_id_sort_order_key
  ON public.showcase_record_media(record_id, sort_order);
CREATE INDEX showcase_record_media_media_id_idx
  ON public.showcase_record_media(media_id);

-- Deny-by-default RLS. Browser clients use the session-aware API, not direct
-- table access. No client policies are added; access is enforced in the API.
ALTER TABLE public.showcase_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showcase_record_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.showcase_records      FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.showcase_record_media FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.showcase_records FROM %I',
        client_role
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.showcase_record_media FROM %I',
        client_role
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
