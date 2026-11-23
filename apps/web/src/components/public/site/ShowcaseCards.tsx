import type { ShowcaseRecord } from "@event-management/contracts/showcase";
import { ShowcaseCard } from "./ShowcaseCard";

/** Landing-page strip of featured showcase thumbnails. */
export function ShowcaseCards({ items }: { items: ShowcaseRecord[] }) {
  return (
    <div className="showcase-strip">
      {items.map((item) => (
        <ShowcaseCard key={item.id} item={item} />
      ))}
    </div>
  );
}
