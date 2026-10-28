import type { ServiceContent } from "../../controllers/services/schemas.js";
import { imageId } from "../../utils/services/service-image-id.js";
export const columns = (v: ServiceContent) => ({ name: v.name, categories: v.categories.map(x => x.trim()), description: v.description, image_url: imageId(v.imageUrl) ? `/v1/service-images/${imageId(v.imageUrl)}` : v.imageUrl });
