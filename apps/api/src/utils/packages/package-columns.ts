import type { Content } from "../../controllers/packages/schemas.js";

export function columns(content: Content) {
  return { name: content.name.trim(), event_types: content.eventTypes.map(x => x.trim()),
    description: content.description.trim(), guest_max: content.guestMax,
    inclusions: [...new Set(content.inclusions.map(x => x.trim()).filter(Boolean))],
    exclusions: content.exclusions.map(x => x.trim()), image_url: content.imageUrl,
    price: content.price ? content.price.amountMinor / 100 : null };
}
