-- Existing catalog rows and quotation history are preserved without inventing old terms.
ALTER TABLE packages ADD COLUMN package_type text NOT NULL DEFAULT 'catalog',
 ADD COLUMN custom_for_booking_request_id uuid,
 ALTER COLUMN published_at DROP NOT NULL;
ALTER TABLE packages ADD CONSTRAINT packages_custom_owner_fk FOREIGN KEY (custom_for_booking_request_id) REFERENCES booking_requests(id) ON DELETE RESTRICT,
 ADD CONSTRAINT packages_custom_owner_unique UNIQUE (custom_for_booking_request_id),
 ADD CONSTRAINT packages_type_owner_check CHECK (
  (package_type = 'catalog' AND custom_for_booking_request_id IS NULL AND published_at IS NOT NULL)
  OR (package_type = 'custom' AND custom_for_booking_request_id IS NOT NULL AND published_at IS NULL)
 );
CREATE FUNCTION enforce_booking_package_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM packages WHERE id=NEW.package_id AND package_type='custom' AND custom_for_booking_request_id <> NEW.id) THEN
  RAISE EXCEPTION 'Custom package belongs to another booking' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER booking_package_owner BEFORE INSERT OR UPDATE OF package_id ON booking_requests FOR EACH ROW EXECUTE FUNCTION enforce_booking_package_owner();
CREATE FUNCTION enforce_custom_package_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.package_type <> NEW.package_type OR OLD.custom_for_booking_request_id IS DISTINCT FROM NEW.custom_for_booking_request_id) THEN
  RAISE EXCEPTION 'Package type and ownership are immutable' USING ERRCODE='23514';
 END IF;
 IF NEW.package_type='custom' AND EXISTS (SELECT 1 FROM booking_requests WHERE package_id=NEW.id AND id <> NEW.custom_for_booking_request_id) THEN
  RAISE EXCEPTION 'Custom package belongs to another booking' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER custom_package_owner BEFORE INSERT OR UPDATE ON packages FOR EACH ROW EXECUTE FUNCTION enforce_custom_package_owner();
ALTER TABLE quotations ADD COLUMN offered_package_id uuid,
 ADD COLUMN offered_package_updated_at timestamptz(6),
 ADD COLUMN offered_package_terms jsonb,
 ADD COLUMN adjustments_reviewed boolean NOT NULL DEFAULT true;

ALTER TABLE quotations DROP CONSTRAINT quotations_total_amount_minor_check;
ALTER TABLE quotations ADD CONSTRAINT quotations_total_amount_minor_check CHECK (status='draft' OR total_amount_minor >= 0);
