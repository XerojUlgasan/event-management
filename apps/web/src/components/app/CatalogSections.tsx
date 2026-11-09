import MarkdownPreview from "@uiw/react-markdown-preview"
import rehypeSanitize from "rehype-sanitize"
import type { CatalogSection, CatalogWidget } from "@event-management/contracts/catalog"
import { catalogMediaSrc } from "../../lib/data/catalog-media"

export function WidgetContent({ widget, editor = false }: { widget: CatalogWidget; editor?: boolean }) {
  const url = widget.media?.url ? catalogMediaSrc(widget.media.url) : ""
  const autoplay = !editor && widget.autoplay
  return <div className={`canvas-widget-content canvas-${widget.type}`}>
    {widget.type === "markdown" && <MarkdownPreview source={widget.markdown || ""} rehypePlugins={[rehypeSanitize]} />}
    {widget.type === "photo" && (url ? <img src={url} alt={widget.alt} /> : <div className="canvas-empty">Add a photo</div>)}
    {widget.type === "video" && (url ? <video src={url} controls autoPlay={autoplay} muted={autoplay} playsInline /> : <div className="canvas-empty">Add a video</div>)}
    {!editor && widget.caption && <p className="canvas-caption">{widget.caption}</p>}
  </div>
}
export function CatalogSections({ sections }: { sections: CatalogSection[] }) {
  return <>{sections.map(section => <section className="canvas-section" key={section.id}>{section.title && <h2>{section.title}</h2>}<div className="canvas-public-grid">{[...section.widgets].sort((a, b) => a.y - b.y || a.x - b.x).map(widget => <div key={widget.id} className="canvas-public-widget" style={{ gridColumn: `${widget.x + 1} / span ${widget.w}`, gridRow: `${widget.y + 1} / span ${widget.h}` }}><WidgetContent widget={widget} /></div>)}</div></section>)}</>
}
