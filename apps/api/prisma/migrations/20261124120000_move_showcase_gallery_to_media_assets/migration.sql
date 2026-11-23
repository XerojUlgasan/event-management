BEGIN;

LOCK TABLE public.showcase_records, public.showcase_record_media IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.showcase_record_media
    GROUP BY media_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot migrate galleries while a media asset belongs to multiple showcases';
  END IF;
END $$;

ALTER TABLE public.media_assets
  ADD COLUMN showcase_record_id UUID,
  ADD COLUMN gallery_position INTEGER,
  ADD CONSTRAINT media_assets_showcase_record_id_fkey FOREIGN KEY (showcase_record_id)
    REFERENCES public.showcase_records(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT media_assets_gallery_position_check CHECK (
    (showcase_record_id IS NULL AND gallery_position IS NULL)
    OR (showcase_record_id IS NOT NULL AND gallery_position IS NOT NULL AND gallery_position >= 0)
  );

UPDATE public.media_assets AS asset
SET showcase_record_id = link.record_id,
    gallery_position = link.sort_order
FROM public.showcase_record_media AS link
WHERE asset.id = link.media_id;

CREATE UNIQUE INDEX media_assets_showcase_record_id_gallery_position_key
  ON public.media_assets(showcase_record_id, gallery_position);
CREATE INDEX showcase_records_cover_media_id_idx
  ON public.showcase_records(cover_media_id);

DROP TABLE public.showcase_record_media;
ALTER TABLE public.showcase_records DROP COLUMN preview_video_id;

COMMIT;
