import {
  CATALOG_COLUMNS,
  LEGACY_CATALOG_COLUMNS,
  type CatalogSection,
  type CatalogWidget,
} from "@event-management/contracts/catalog";
import type { CSSProperties, ReactNode } from "react";
import { CatalogThumbnail } from "../atoms/CatalogThumbnail";
import { Markdown } from "../molecules/Markdown";

type WidgetStyle = CSSProperties & { "--catalog-widget-h": number };

export const CATALOG_GRID = {
  columns: CATALOG_COLUMNS,
  rowHeight: 52,
  gap: 12,
  padding: 20,
  referenceWidth: 1000,
  stackedReferenceWidth: 460,
  stackedBelow: 580,
} as const;

export function catalogGridMetrics(width: number, stacked: boolean) {
  const scale =
    width /
    (stacked
      ? CATALOG_GRID.stackedReferenceWidth
      : CATALOG_GRID.referenceWidth);

  return {
    rowHeight: CATALOG_GRID.rowHeight * scale,
    gap: CATALOG_GRID.gap * scale,
    padding: CATALOG_GRID.padding * scale,
  };
}

// Scale both axes from the same canvas width to keep widget proportions.
const scaled = (pixels: number) =>
  `calc(${pixels} * 100cqi / var(--catalog-grid-reference, ${CATALOG_GRID.referenceWidth}))`;

export const catalogGridStyle = {
  "--catalog-columns": CATALOG_GRID.columns,
  "--catalog-stacked-reference": CATALOG_GRID.stackedReferenceWidth,
  "--catalog-row-height": scaled(CATALOG_GRID.rowHeight),
  "--catalog-gap": scaled(CATALOG_GRID.gap),
  "--catalog-padding": scaled(CATALOG_GRID.padding),
} as CSSProperties;

/** Decorative guides use a constant-size pattern, even for large saved row gaps. */
export function CatalogGridGuides({
  rows,
  stacked = false,
}: {
  rows: number;
  stacked?: boolean;
}) {
  const columns = stacked ? 1 : CATALOG_GRID.columns;
  const style = {
    ...catalogGridStyle,
    "--catalog-guide-columns": columns,
    "--catalog-guide-rows": rows,
  } as CSSProperties;

  return <div className="ui-catalog-guides" style={style} aria-hidden="true" />;
}

export function CatalogGridRuler({ stacked = false }: { stacked?: boolean }) {
  const columns = stacked ? 1 : CATALOG_GRID.columns;
  const style = {
    ...catalogGridStyle,
    "--catalog-guide-columns": columns,
  } as CSSProperties;

  return (
    <div className="ui-catalog-ruler" style={style} aria-hidden="true">
      {Array.from({ length: columns }, (_, i) => (
        <span key={i}>{i + 1}</span>
      ))}
    </div>
  );
}

/** The caller resolves media URLs before passing content to these presentation components. */
export function CatalogCanvas({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ui-catalog-canvas${className ? ` ${className}` : ""}`}>
      <div className="ui-catalog-frame">{children}</div>
    </div>
  );
}

export function CatalogWidgetContent({
  widget,
  editor = false,
  mediaPlaceholder,
  servicePlaceholder,
  onOpenService,
  onOpenPackage,
  includedService = false,
}: {
  widget: CatalogWidget;
  includedService?: boolean;
  editor?: boolean;
  mediaPlaceholder?: ReactNode;
  servicePlaceholder?: ReactNode;
  onOpenService?: (id: string) => void;
  onOpenPackage?: (id: string) => void;
}) {
  const url = widget.media?.url || "";
  const autoplay = !editor && widget.autoplay;
  const reference = widget.type === "package" ? widget.package : widget.service;
  const entity = widget.type === "package" ? "package" : "service";
  const onOpen = entity === "package" ? onOpenPackage : onOpenService;

  const includedTerms = includedService && widget.type === "service" && (
    <span>
      Included ·{" "}
      {widget.serviceTerms?.includedHours == null
        ? "Hours unspecified"
        : `${widget.serviceTerms.includedHours} hours included`}{" "}
      ·{" "}
      {widget.serviceTerms?.hourlyRatePesos == null
        ? "Excess rate unspecified"
        : `₱${widget.serviceTerms.hourlyRatePesos.toLocaleString("en-PH")} / additional hour`}
    </span>
  );

  if ((widget.type === "service" || widget.type === "package") && reference) {
    const content = (
      <>
        <CatalogThumbnail src={reference.imageUrl} />
        <span className="ui-catalog-reference-details">
          <span className="ui-catalog-reference-name">{reference.name}</span>
          {includedTerms}
          {reference.description && (
            <span className="ui-catalog-reference-description">
              {reference.description}
            </span>
          )}
          <span
            className="ui-catalog-reference-link"
            aria-hidden={editor || undefined}
          >
            View {entity}
          </span>
        </span>
        {widget.caption && (
          <span className="ui-catalog-caption">{widget.caption}</span>
        )}
      </>
    );

    return (
      <div
        className={`ui-catalog-widget-content ui-catalog-reference ui-catalog-reference-${entity}`}
      >
        {editor ? (
          <div className="ui-catalog-reference-card">{content}</div>
        ) : onOpen ? (
          <button
            className="ui-catalog-reference-card ui-catalog-reference-action"
            type="button"
            aria-label={`View ${entity}: ${reference.name}`}
            onClick={() => onOpen(reference.id)}
          >
            {content}
          </button>
        ) : (
          <a
            className="ui-catalog-reference-card ui-catalog-reference-action"
            href={`/${entity === "package" ? "packages" : "services"}/${encodeURIComponent(reference.slug)}`}
            aria-label={`View ${entity}: ${reference.name}`}
          >
            {content}
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      className={`ui-catalog-widget-content ui-catalog-${widget.type === "service" || widget.type === "package" ? "reference" : widget.type}`}
    >
      {widget.type === "markdown" && (
        <Markdown source={widget.markdown || ""} />
      )}
      {widget.type === "photo" &&
        (url ? (
          <img
            src={url}
            alt={widget.alt}
            draggable={editor ? false : undefined}
          />
        ) : (
          (mediaPlaceholder ?? (
            <div className="ui-catalog-empty">Add a photo</div>
          ))
        ))}
      {widget.type === "video" &&
        (url ? (
          <video
            src={url}
            controls
            autoPlay={autoplay}
            muted={autoplay}
            playsInline
          />
        ) : (
          (mediaPlaceholder ?? (
            <div className="ui-catalog-empty">Add a video</div>
          ))
        ))}
      {includedTerms}
      {widget.type === "service" &&
        (servicePlaceholder ?? (
          <div className="ui-catalog-empty">
            {widget.serviceId
              ? "This service is unavailable."
              : "Choose a service"}
          </div>
        ))}
      {widget.type === "package" && (
        <div className="ui-catalog-empty">
          {widget.packageId
            ? "This package is unavailable."
            : "Choose a package"}
        </div>
      )}
      {widget.caption && <p className="ui-catalog-caption">{widget.caption}</p>}
    </div>
  );
}

export function CatalogSections({
  sections,
  includedServices = false,
  onOpenService,
  onOpenPackage,
}: {
  sections: CatalogSection[];
  includedServices?: boolean;
  onOpenService?: (id: string) => void;
  onOpenPackage?: (id: string) => void;
}) {
  return (
    <>
      {sections.map((section) => (
        <section className="ui-catalog-section" key={section.id}>
          {section.title && <h2>{section.title}</h2>}
          <div
            className="ui-catalog-grid"
            style={
              {
                ...catalogGridStyle,
                "--catalog-columns": section.columns ?? LEGACY_CATALOG_COLUMNS,
              } as CSSProperties
            }
          >
            {[...section.widgets]
              .sort((a, b) => a.y - b.y || a.x - b.x)
              .map((widget) => {
                const style: WidgetStyle = {
                  gridColumn: `${widget.x + 1} / span ${widget.w}`,
                  gridRow: `${widget.y + 1} / span ${widget.h}`,
                  "--catalog-widget-h": widget.h,
                };

                return (
                  <div
                    key={widget.id}
                    className="ui-catalog-widget"
                    style={style}
                  >
                    <CatalogWidgetContent
                      widget={widget}
                      includedService={includedServices}
                      onOpenService={onOpenService}
                      onOpenPackage={onOpenPackage}
                    />
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </>
  );
}
