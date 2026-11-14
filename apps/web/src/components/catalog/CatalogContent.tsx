import {
  CatalogCanvas,
  CatalogMarkdown,
  CatalogSections,
  CatalogWidgetContent,
} from "@event-management/ui";
import type {
  CatalogSection,
  CatalogWidget,
  PackageContent,
  PackageServiceInput,
} from "@event-management/contracts/catalog";
import type { ReactNode } from "react";
import type { ServiceContent } from "../../lib/data/catalog/services";
import type { VenueContent } from "../../lib/data/catalog/venues";
import { catalogMediaSrc } from "../../lib/data/catalog/media";
import { priceLabel } from "../../lib/utils/formatting/money";
import "../../styles/catalog/catalog-content.css";

const resolveWidget = (widget: CatalogWidget): CatalogWidget =>
  widget.media
    ? {
        ...widget,
        media: { ...widget.media, url: catalogMediaSrc(widget.media.url) },
      }
    : widget;
const resolveSections = (sections: CatalogSection[]): CatalogSection[] =>
  sections.map((section) => ({
    ...section,
    widgets: section.widgets.map(resolveWidget),
  }));

// URL resolution belongs to the app; presentation is shared with public SSR.
export function WidgetContent({
  widget,
  editor = false,
  mediaPlaceholder,
}: {
  widget: CatalogWidget;
  editor?: boolean;
  mediaPlaceholder?: ReactNode;
}) {
  return (
    <CatalogWidgetContent
      widget={resolveWidget(widget)}
      editor={editor}
      mediaPlaceholder={mediaPlaceholder}
    />
  );
}

export function PackageCanvas({
  item,
  hideServices = false,
  bookingAction,
}: {
  item: Omit<PackageContent, "services"> & {
    services: (PackageServiceInput & { name?: string })[];
  };
  hideServices?: boolean;
  bookingAction?: ReactNode;
}) {
  return (
    <CatalogCanvas>
      <div className="catalog-detail-intro">
        <span>THE STYLED BY AMAC COLLECTION</span>
        <h1>{item.name || "Untitled package"}</h1>
        {item.description && <p>{item.description}</p>}
        <div className="catalog-detail-meta">
          <strong>{priceLabel(item.price)}</strong>
          <strong>Up to {item.maxGuests} guests</strong>
        </div>
        {bookingAction && (
          <div className="catalog-detail-action">{bookingAction}</div>
        )}
      </div>
      {!hideServices && item.services.length > 0 && (
        <section className="ui-catalog-section">
          <h2>Package services</h2>
          <ul>
            {item.services.map((service) => (
              <li key={service.serviceId}>
                {service.name ?? "Service"} ·{" "}
                {service.role === "included" ? "Included" : "Optional"}
              </li>
            ))}
          </ul>
        </section>
      )}
      <CatalogSections sections={resolveSections(item.sections)} />
    </CatalogCanvas>
  );
}

export const serviceRateLabel = (rate: number | null) =>
  rate == null
    ? "Rate not set"
    : `${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(rate)} / hour`;

export function ServiceCanvas({ item }: { item: ServiceContent }) {
  return (
    <CatalogCanvas>
      <div className="catalog-detail-intro">
        <h1>{item.name || "Untitled service"}</h1>
        <div className="catalog-detail-summary">
          <CatalogMarkdown source={item.description} />
        </div>
        <div className="catalog-detail-meta">
          <strong>{serviceRateLabel(item.hourlyRatePesos)}</strong>
        </div>
      </div>
      <CatalogSections sections={resolveSections(item.sections)} />
    </CatalogCanvas>
  );
}

export function VenueCanvas({ item }: { item: VenueContent }) {
  return (
    <CatalogCanvas>
      <div className="catalog-detail-intro">
        <h1>{item.name || "Untitled venue"}</h1>
        <p>{item.location}</p>
        <p>{item.description}</p>
        {item.maxGuests != null && (
          <div className="catalog-detail-meta">
            <strong>Up to {item.maxGuests} guests</strong>
          </div>
        )}
      </div>
      <CatalogSections sections={resolveSections(item.sections)} />
    </CatalogCanvas>
  );
}
