-- Quotations retain financial values, revision history and package identity.
-- Package/event details remain on the booking and its current proposal.
-- This deliberately discards existing offered-term snapshots. It does not
-- remove media objects; ordinary cleanup handles unreferenced uploads.
ALTER TABLE "quotations"
    DROP CONSTRAINT "quotations_snapshot_check",
    DROP COLUMN "offered_package_updated_at",
    DROP COLUMN "offered_package_terms";
