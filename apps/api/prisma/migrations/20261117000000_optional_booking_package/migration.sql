ALTER TABLE "booking_requests" ALTER COLUMN "package_id" DROP NOT NULL;

CREATE OR REPLACE FUNCTION enforce_inquiry_catalog_package() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.package_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM packages WHERE id = NEW.package_id AND package_type = 'catalog') THEN
    RAISE EXCEPTION 'An inquiry must reference a catalog package' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
