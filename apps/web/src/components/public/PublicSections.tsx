import type { CatalogSection } from "@event-management/contracts/catalog"
import { catalogMediaSrc } from "../../lib/data/catalog-media"

export function publicMarkdown(source: string) {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return source.split(/\n{2,}/).map((block) => {
    const trimmed = block.trim()
    const heading = /^(#{1,3}) /.exec(trimmed)
    const text = escape(heading ? trimmed.slice(heading[0].length) : trimmed).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br />")
    if (heading?.[1].length === 1) return `<h2>${text}</h2>`
    if (heading?.[1].length === 2) return `<h2>${text}</h2>`
    if (heading?.[1].length === 3) return `<h3>${text}</h3>`
    return `<p>${text}</p>`
  }).join("")
}

export function PublicSections({ sections }: { sections: CatalogSection[] }) {
  return <>{sections.map(section => <section className="canvas-section" key={section.id}>{section.title && <h2>{section.title}</h2>}<div className="canvas-public-grid">{[...section.widgets].sort((a, b) => a.y - b.y || a.x - b.x).map(widget => {
    const url = widget.media?.url ? catalogMediaSrc(widget.media.url) : ""
    return <div key={widget.id} className="canvas-public-widget" style={{ gridColumn: `${widget.x + 1} / span ${widget.w}`, gridRow: `${widget.y + 1} / span ${widget.h}` }}>
      <div className={`canvas-widget-content canvas-${widget.type}`}>
        {widget.type === "markdown" && <div className="canvas-public-markdown" dangerouslySetInnerHTML={{ __html: publicMarkdown(widget.markdown || "") }} />}
        {widget.type === "photo" && url && <img src={url} alt={widget.alt} />}
        {widget.type === "video" && url && <video src={url} controls muted={widget.autoplay} playsInline />}
        {widget.caption && <p className="canvas-caption">{widget.caption}</p>}
      </div>
    </div>
  })}</div></section>)}</>
}
