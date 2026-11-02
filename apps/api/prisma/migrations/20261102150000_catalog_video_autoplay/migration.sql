ALTER TABLE catalog_widgets
  ADD COLUMN autoplay BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT catalog_widgets_video_autoplay CHECK (type = 'video' OR NOT autoplay);
