import type { ServiceContent } from "../../controllers/services/schemas.js";
export const columns = (v: ServiceContent) => ({ name: v.name, categories: v.categories.map(x => x.trim()), description: v.description, image_url: v.imageUrl });
