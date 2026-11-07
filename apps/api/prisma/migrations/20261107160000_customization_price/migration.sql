-- Add optional price adjustment fields to customization_requests.
-- direction: 'add' (price increase) or 'deduct' (price reduction). NULL means no price impact recorded.
-- amount_minor: positive PHP cents. NULL when direction is NULL.
-- Both columns are nullable so existing rows and customer-originated records remain valid.
-- IF NOT EXISTS guards make this safe to re-run on databases where the columns were applied manually.
ALTER TABLE customization_requests
  ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('add', 'deduct')),
  ADD COLUMN IF NOT EXISTS amount_minor INTEGER CHECK (amount_minor > 0);

-- Enforce that direction and amount are either both set or both absent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'customization_price_pair'
      AND table_name = 'customization_requests'
  ) THEN
    ALTER TABLE customization_requests
      ADD CONSTRAINT customization_price_pair
        CHECK (
          (direction IS NULL AND amount_minor IS NULL) OR
          (direction IS NOT NULL AND amount_minor IS NOT NULL)
        );
  END IF;
END $$;
