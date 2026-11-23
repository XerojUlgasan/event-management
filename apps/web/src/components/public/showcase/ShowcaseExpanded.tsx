import type { ShowcaseRecord } from "@event-management/contracts/showcase";
import { ShowcaseGallery } from "./ShowcaseGallery";
import { HoverVideo } from "./HoverVideo";
import { showcaseMediaSrc } from "../../../lib/data/showcases/showcases";

export function ShowcaseExpanded({ item }: { item: ShowcaseRecord }) {
  return (
    <article className="showcase-expanded" id={item.slug}>
      <a
        className="showcase-expanded-cover"
        href={`/showcases/${item.slug}`}
        aria-label={`View showcase: ${item.title}`}
      >
        {item.previewVideoUrl ? (
          <HoverVideo
            src={showcaseMediaSrc(item.previewVideoUrl)}
            posterSrc={showcaseMediaSrc(item.coverUrl)}
          />
        ) : (
          <img
            className="showcase-expanded-cover-img"
            src={showcaseMediaSrc(item.coverUrl)}
            alt=""
            loading="lazy"
          />
        )}
      </a>
      <div className="showcase-expanded-body">
        <span className="showcase-kicker">Past event</span>
        <h2>
          <a href={`/showcases/${item.slug}`}>{item.title}</a>
        </h2>
        <p>{item.description}</p>
        <ShowcaseGallery media={item.media} />
      </div>
    </article>
  );
}
