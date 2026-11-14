import type { ServiceContent } from "../../controllers/services/schemas.js";
export const columns = (v: ServiceContent, slug: string) => ({
  name: v.name.trim(),
  slug,
  hourly_rate_pesos: v.hourlyRatePesos,
  description: v.description,
});
