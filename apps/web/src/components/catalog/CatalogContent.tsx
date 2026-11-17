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
import { catalogMediaSrc } from "../../lib/data/catalog/media";
import {
  priceLabel,
  servicePricingLabels,
} from "../../lib/utils/formatting/money";
import "../../styles/catalog/catalog-content.css";
import { useServiceNavigation } from "./service-navigation-context";

const resolveWidget = (widget: CatalogWidget): CatalogWidget => ({
  ...widget,
  media: widget.media
    ? { ...widget.media, url: catalogMediaSrc(widget.media.url) }
    : null,
  service: widget.service
    ? {
        ...widget.service,
        imageUrl: widget.service.imageUrl
          ? catalogMediaSrc(widget.service.imageUrl)
          : null,
      }
    : widget.service,
});
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
  const onOpenService = useServiceNavigation();
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
      <CatalogSections
        sections={resolveSections(item.sections)}
        onOpenService={onOpenService}
      />
    </CatalogCanvas>
  );
}

export function ServiceCanvas({ item }: { item: ServiceContent }) {
  const pricing = servicePricingLabels(item);
  const onOpenService = useServiceNavigation();
  return (
    <CatalogCanvas>
      <div className="catalog-detail-intro">
        <h1>{item.name || "Untitled service"}</h1>
        <div className="catalog-detail-summary">
          <CatalogMarkdown source={item.description} />
        </div>
        <div className="catalog-detail-meta">
          <strong>{pricing.price}</strong>
          {pricing.excess && <span>{pricing.excess}</span>}
        </div>
      </div>
      <CatalogSections
        sections={resolveSections(item.sections)}
        onOpenService={onOpenService}
      />
    </CatalogCanvas>
  );
}
