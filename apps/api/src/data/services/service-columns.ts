import type { ServiceContent } from "../../controllers/services/schemas.js";
export const columns = (v: ServiceContent, slug: string) => ({
  name: v.name.trim(),
  slug,
  hourly_rate_pesos: v.hourlyRatePesos,
  fixed_price_pesos: v.fixedPricePesos,
  included_hours: v.includedHours,
  description: v.description,
  ...(v.thumbnailMediaId !== undefined
    ? { thumbnail_media_id: v.thumbnailMediaId ?? null }
    : {}),
  ...(v.eventType !== undefined ? { event_type: v.eventType ?? null } : {}),
});
