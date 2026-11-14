import MarkdownPreview from "@uiw/react-markdown-preview";
import rehypeSanitize from "rehype-sanitize";
import { CATALOG_COLUMNS, type CatalogSection, type CatalogWidget } from "@event-management/contracts/catalog";
import type { CSSProperties, ReactNode } from "react";

type WidgetStyle = CSSProperties & { "--catalog-widget-h": number };
export const CATALOG_GRID = { columns: CATALOG_COLUMNS, rowHeight: 52, gap: 12, padding: 12 } as const;
export const catalogGridStyle = {
  "--catalog-columns": CATALOG_GRID.columns,
  "--catalog-row-height": `${CATALOG_GRID.rowHeight}px`,
  "--catalog-gap": `${CATALOG_GRID.gap}px`,
  "--catalog-padding": `${CATALOG_GRID.padding}px`,
} as CSSProperties;

/** Decorative guides use a constant-size pattern, even for large saved row gaps. */
export function CatalogGridGuides({ rows, stacked = false }: { rows: number; stacked?: boolean }) {
  const columns = stacked ? 1 : CATALOG_GRID.columns;
  const style = { ...catalogGridStyle, "--catalog-guide-columns": columns, "--catalog-guide-rows": rows } as CSSProperties;
  return <div className="ui-catalog-guides" style={style} aria-hidden="true" />;
}
export function CatalogGridRuler({ stacked = false }: { stacked?: boolean }) {
  const columns = stacked ? 1 : CATALOG_GRID.columns;
  const style = { ...catalogGridStyle, "--catalog-guide-columns": columns } as CSSProperties;
  return <div className="ui-catalog-ruler" style={style} aria-hidden="true">{Array.from({ length: columns }, (_, i) => <span key={i}>{i + 1}</span>)}</div>;
}

/** The caller resolves media URLs before passing content to these presentation components. */
export function CatalogCanvas({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`ui-catalog-canvas${className ? ` ${className}` : ""}`} style={catalogGridStyle}><div className="ui-catalog-frame">{children}</div></div>;
}

export function CatalogMarkdown({ source }: { source: string }) {
  return <MarkdownPreview source={source} rehypePlugins={[rehypeSanitize]} wrapperElement={{ "data-color-mode": "light" }} disableCopy />;
}

export function CatalogWidgetContent({ widget, editor = false, mediaPlaceholder }: { widget: CatalogWidget; editor?: boolean; mediaPlaceholder?: ReactNode }) {
  const url = widget.media?.url || "";
  const autoplay = !editor && widget.autoplay;
  return <div className={`ui-catalog-widget-content ui-catalog-${widget.type}`}>
    {widget.type === "markdown" && <CatalogMarkdown source={widget.markdown || ""} />}
    {widget.type === "photo" && (url ? <img src={url} alt={widget.alt} /> : mediaPlaceholder ?? <div className="ui-catalog-empty">Add a photo</div>)}
    {widget.type === "video" && (url ? <video src={url} controls autoPlay={autoplay} muted={autoplay} playsInline /> : mediaPlaceholder ?? <div className="ui-catalog-empty">Add a video</div>)}
    {widget.caption && <p className="ui-catalog-caption">{widget.caption}</p>}
  </div>;
}

export function CatalogSections({ sections }: { sections: CatalogSection[] }) {
  return <>{sections.map(section => <section className="ui-catalog-section" key={section.id}>
    {section.title && <h2>{section.title}</h2>}
    <div className="ui-catalog-grid">{[...section.widgets].sort((a, b) => a.y - b.y || a.x - b.x).map(widget => {
      const style: WidgetStyle = { gridColumn: `${widget.x + 1} / span ${widget.w}`, gridRow: `${widget.y + 1} / span ${widget.h}`, "--catalog-widget-h": widget.h };
      return <div key={widget.id} className="ui-catalog-widget" style={style}><CatalogWidgetContent widget={widget} /></div>;
    })}</div>
  </section>)}</>;
}
