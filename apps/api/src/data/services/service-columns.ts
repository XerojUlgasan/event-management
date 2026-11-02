import type { ServiceContent } from "../../controllers/services/schemas.js";
export const columns = (v: ServiceContent) => ({ name: v.name, hourly_rate_pesos: v.hourlyRatePesos, description: v.description });
