import type { ShowcaseMediaItem } from "@event-management/contracts/showcase";
import { MAX_SHOWCASE_PREVIEW_THUMBNAILS } from "@event-management/contracts/limits/showcase";
import { showcaseMediaSrc } from "../../../lib/data/showcases/showcases";

type Props = { media: ShowcaseMediaItem[] } & (
  | { videoMode: "click" }
  | { videoMode: "preview"; detailHref: string; title: string }
);

export function ShowcaseGallery(props: Props) {
  const { media } = props;
  if (media.length === 0) return null;

  if (props.videoMode === "preview") {
    const thumbnails = media.slice(0, MAX_SHOWCASE_PREVIEW_THUMBNAILS);
    const remaining = media.length - thumbnails.length;

    return (
      <a
        className="showcase-gallery-preview"
        href={props.detailHref}
        aria-label={`View gallery for ${props.title} (${media.length} ${media.length === 1 ? "item" : "items"})`}
      >
        {thumbnails.map((item, index) => (
          <span key={item.id} className="showcase-gallery-thumbnail">
            {item.kind === "image" ? (
              <img src={showcaseMediaSrc(item.url)} alt="" loading="lazy" />
            ) : (
              <video
                src={`${showcaseMediaSrc(item.url)}#t=0.001`}
                preload="metadata"
                playsInline
                aria-hidden="true"
              />
            )}
            {remaining > 0 && index === thumbnails.length - 1 ? (
              <span className="showcase-gallery-overflow" aria-hidden="true">
                +{remaining}
              </span>
            ) : item.kind === "video" ? (
              <span className="showcase-gallery-play" aria-hidden="true">
                ▶
              </span>
            ) : null}
          </span>
        ))}
      </a>
    );
  }

  return (
    <div className="showcase-gallery">
      {media.map((item) => (
        <figure
          key={item.id}
          className={`showcase-gallery-item showcase-gallery-${item.kind}`}
        >
          {item.kind === "image" ? (
            <img src={showcaseMediaSrc(item.url)} alt="" loading="lazy" />
          ) : (
            <video
              src={showcaseMediaSrc(item.url)}
              controls
              preload="metadata"
              playsInline
              aria-label="Gallery video"
            />
          )}
        </figure>
      ))}
    </div>
  );
}
