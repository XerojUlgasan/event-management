import type { ShowcaseRecord } from "@event-management/contracts/showcase";
import { showcaseMediaSrc } from "../../../lib/data/showcases/showcases";

function countLabel(media: ShowcaseRecord["media"]): string {
  const photos = media.filter((m) => m.kind === "image").length;
  const videos = media.filter((m) => m.kind === "video").length;
  return [
    photos ? `${photos} photo${photos === 1 ? "" : "s"}` : "",
    videos ? `${videos} video${videos === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ShowcaseCard({ item }: { item: ShowcaseRecord }) {
  const label = countLabel(item.media);
  const overlay = (
    <span className="showcase-card-overlay">
      {label && <span className="showcase-card-overlay-count">{label}</span>}
      <span className="showcase-card-overlay-action">
        View showcase <span aria-hidden="true">→</span>
      </span>
    </span>
  );

  return (
    <a
      className="showcase-card"
      href={`/showcases/${item.slug}`}
      aria-label={`View showcase: ${item.title}`}
    >
      <span className="showcase-card-media">
        <img
          className="showcase-card-cover-img"
          src={showcaseMediaSrc(item.coverUrl)}
          alt=""
          loading="lazy"
        />
        {overlay}
      </span>
      <span className="showcase-card-title">{item.title}</span>
    </a>
  );
}
