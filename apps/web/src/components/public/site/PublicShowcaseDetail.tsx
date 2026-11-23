import type { ShowcaseRecord } from "@event-management/contracts/showcase";
import { ShowcaseGallery } from "./ShowcaseGallery";
import { showcaseMediaSrc } from "../../../lib/data/showcases/showcases";

export function PublicShowcaseDetail({ item }: { item: ShowcaseRecord }) {
  return (
    <article className="showcase-detail">
      <div className="showcase-detail-summary">
        <span className="showcase-kicker">Past event</span>
        <h1>{item.title}</h1>
        <p>{item.description}</p>
      </div>

      <figure className="showcase-detail-hero">
        <img src={showcaseMediaSrc(item.coverUrl)} alt="" />
      </figure>

      {item.media.length > 0 && (
        <section className="showcase-detail-gallery" aria-label="Gallery">
          <h2>Gallery</h2>
          <ShowcaseGallery media={item.media} videoMode="click" />
        </section>
      )}

      <div className="showcase-detail-footer">
        <a className="showcase-detail-back" href="/showcases">
          All showcases
          <span className="showcase-detail-back-arrow" aria-hidden="true">
            ↗
          </span>
        </a>
      </div>
    </article>
  );
}
