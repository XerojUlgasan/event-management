-- Local Supabase seed. Application fixtures stay in the API seed and are not loaded here.

-- Ensure the storage bucket exists so catalog media uploads work from the first run.
-- config.toml defines it but only takes effect when Supabase starts completely fresh.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-management',
  'event-management',
  false,
  26214400,
  ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm']
)
ON CONFLICT (id) DO NOTHING;
