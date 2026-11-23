import type { ShowcaseRecord } from "@event-management/contracts/showcase";
import {
  MAX_SHOWCASE_PREVIEW_DESCRIPTION_LENGTH,
  MAX_SHOWCASE_PREVIEW_TITLE_LENGTH,
} from "@event-management/contracts/limits/showcase";
import { ShowcaseGallery } from "./ShowcaseGallery";
import { showcaseMediaSrc } from "../../../lib/data/showcases/showcases";

const segmenter = new Intl.Segmenter();

function previewText(text: string, maxLength: number) {
  const characters = Array.from(
    segmenter.segment(text),
    ({ segment }) => segment,
  );

  if (characters.length <= maxLength) return text;

  return `${characters
    .slice(0, maxLength - 1)
    .join("")
    .trimEnd()}…`;
}

export function ShowcaseExpanded({ item }: { item: ShowcaseRecord }) {
  const detailHref = `/showcases/${item.slug}`;
  const title = previewText(item.title, MAX_SHOWCASE_PREVIEW_TITLE_LENGTH);

  return (
    <article className="showcase-expanded" id={item.slug}>
      <a
        className="showcase-expanded-cover"
        href={detailHref}
        aria-label={`View showcase: ${title}`}
      >
        <img
          className="showcase-expanded-cover-img"
          src={showcaseMediaSrc(item.coverUrl)}
          alt=""
          loading="lazy"
        />
      </a>
      <div className="showcase-expanded-body">
        <h2>
          <a href={detailHref}>{title}</a>
        </h2>
        <p>
          {previewText(
            item.description,
            MAX_SHOWCASE_PREVIEW_DESCRIPTION_LENGTH,
          )}
        </p>
        <ShowcaseGallery
          media={item.media}
          videoMode="preview"
          detailHref={detailHref}
          title={title}
        />
      </div>
    </article>
  );
}
