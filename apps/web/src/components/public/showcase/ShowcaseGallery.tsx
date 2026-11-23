import type { ShowcaseMediaItem } from "@event-management/contracts/showcase";
import { showcaseMediaSrc } from "../../../lib/data/showcases/showcases";
import { GalleryVideo } from "./GalleryVideo";

type Props = {
  media: ShowcaseMediaItem[];
  /** "hover" (default) — hover-to-preview, click for controls.
   *  "click" — plain controls video, no hover effect. */
  videoMode?: "hover" | "click";
};

export function ShowcaseGallery({ media, videoMode = "hover" }: Props) {
  if (media.length === 0) return null;
  return (
    <div className="showcase-gallery">
      {media.map((item) => (
        <figure
          key={item.id}
          className={`showcase-gallery-item showcase-gallery-${item.kind}`}
        >
          {item.kind === "image" ? (
            <img src={showcaseMediaSrc(item.url)} alt="" loading="lazy" />
          ) : videoMode === "click" ? (
            <video
              src={showcaseMediaSrc(item.url)}
              controls
              preload="metadata"
              playsInline
              aria-label="Gallery video"
              style={{ width: "100%", height: "auto", display: "block", background: "#000" }}
            />
          ) : (
            <GalleryVideo src={showcaseMediaSrc(item.url)} />
          )}
        </figure>
      ))}
    </div>
  );
}
