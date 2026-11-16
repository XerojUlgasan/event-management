ALTER TABLE services
  ADD COLUMN fixed_price_pesos INTEGER,
  ADD COLUMN included_hours INTEGER,
  ADD CONSTRAINT services_fixed_pricing_check CHECK (
    (fixed_price_pesos IS NULL AND included_hours IS NULL)
    OR
    (fixed_price_pesos IS NOT NULL AND fixed_price_pesos > 0
      AND included_hours IS NOT NULL AND included_hours > 0
      AND hourly_rate_pesos IS NOT NULL)
  );
