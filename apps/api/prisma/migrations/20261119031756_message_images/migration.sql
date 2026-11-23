-- CreateTable
CREATE TABLE "message_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "content_hash" TEXT NOT NULL,
    "interpretation" JSONB NOT NULL,

    CONSTRAINT "message_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_images_storage_key_key" ON "message_images"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "message_images_message_id_position_key" ON "message_images"("message_id", "position");

-- AddForeignKey
ALTER TABLE "message_images" ADD CONSTRAINT "message_images_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep private chat assets bounded and accessible only through the server's
-- conversation-authorized image route. The ordered unique key also indexes
-- the message foreign key and caps each message at four image records.
ALTER TABLE public.message_images
  ADD CONSTRAINT message_images_position_check CHECK (position BETWEEN 0 AND 3),
  ADD CONSTRAINT message_images_mime_type_check CHECK (
    mime_type IN ('image/jpeg', 'image/png', 'image/webp')
  ),
  ADD CONSTRAINT message_images_byte_size_check CHECK (
    byte_size BETWEEN 1 AND 10485760
  ),
  ADD CONSTRAINT message_images_content_hash_check CHECK (
    content_hash ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT message_images_interpretation_check CHECK (
    jsonb_typeof(interpretation) = 'object'
    AND octet_length(interpretation::text) <= 16384
  );

ALTER TABLE public.message_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.message_images FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.message_images FROM %I',
        client_role
      );
    END IF;
  END LOOP;
END $$;
